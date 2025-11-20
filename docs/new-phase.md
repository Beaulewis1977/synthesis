### AGENT- DO NOT DO THIS PLAN YET. THIS IS FOR ANOTHER PLAN###


# Phase 16 – Agent Authored Knowledge Updates

## Why this exists
- **[Problem]** Current ingestion is append-only: once a document is chunked, any fixes discovered by the agent remain transient unless the user manually re-uploads corrected sources (`docs/06_PIPELINE.md`, `docs/phases/phase-13/05_ACCEPTANCE_CRITERIA.md`).
- **[Impact]** Bug fixes or improvements generated during autonomous coding loops never flow back into the knowledge base, so the agent can reintroduce the same defects later.
- **[Goal]** Provide a safe, auditable path for the agent to capture improvements, version them, and surface the latest trusted variant during retrieval.

## Objectives
- **[Version history]** Introduce first-class document versioning so each update is linked to prior state without losing provenance (`docs/03_DATABASE_SCHEMA.md`, `docs/phases/phase-11/03_METADATA_SCHEMA.md`).
- **[Patch overlays]** Allow chunk-level annotations or replacements that preserve the original text while promoting an approved fix for search.
- **[Autonomous workflow]** Extend agent tooling so it can propose, validate, and publish updates after running tests (`docs/04_AGENT_TOOLS.md`).
- **[Safety]** Require automated verification (tests/lint) and reviewer confirmation before a new version becomes canonical.
- **[Observability]** Track who/what changed a memory, when, why, and with which validation artifacts.

## Architecture overview

### Document versioning model
- **[Schema changes]**
  - Add `version` (INT, default 1) and `parent_doc_id` (UUID nullable, FK to `documents.id`) to `documents`.
  - Add `lock_version` (INT NOT NULL DEFAULT 1) that increments on every promotion/demotion; retain `updated_at` strictly for auditing so write conflicts rely on `lock_version`.
  - Add `is_canonical` (BOOL, default true) to indicate the active version.
  - Add optional `preferred_prior_doc_id` (UUID nullable) so rollback callers can pin their desired ancestor when multiple siblings exist.
  - Create `document_events` table capturing `{doc_id, event_type, actor, summary, artifacts, created_at}` for audit trails.
- **[Lifecycle]**
  - New agent-submitted code creates `version = previous.version + 1`, sets parent to prior doc, and resets canonical flag once approved.
  - Promotion compares the `lock_version` (or `version`) read at proposal time inside the `WHERE` clause; a mismatch means another publish landed and this attempt must refresh before retrying.
  - Each retry re-reads the latest canonical document, rebases the candidate, increments its `lock_version`, and retries up to `N` (default 3) times before surfacing a conflict to the agent.
  - Rollbacks first select the immediate prior sibling via `parent_doc_id`; if none exists, they fall back to the most recent canonical by `created_at` or a `preferred_prior_doc_id` pointer for deterministic restores.
  - Successful rollbacks/publishes increment both the promoted record's `lock_version` and `version` metadata so downstream writers see the new state.

### Document relationship mapping
- **[Schema changes]** Introduce `document_relationships` table with `{doc_id, related_doc_id, relationship_type, metadata, created_at}` to capture edges such as `supersedes`, `fixes`, `references`, or `duplicates` without leaving Postgres.
- **[Usage]**
  - Populate automatically when a new version is approved (e.g., `supersedes`), when the agent submits a bug fix (`fixes`), or when manual curation links supporting docs.
  - Surface relationships in retrieval so the agent can pull companion files, earlier versions, or regression history during reasoning.
- **[Integration]** Extend MCP and UI surfaces to present related documents alongside version history for quick navigation and review context.

### Chunk overlays
- **[New store]** `chunk_overrides` table keyed by `{doc_id, chunk_index}` storing patched code, diff metadata, and status (`proposed | validating | validated | needs_review | approved | rejected | superseded`).
- **[Search behavior]** Retrieval prefers approved overrides; fallback to base chunk if none exist. Metadata keeps both original and patched text for transparency.
- **[Metadata]** Extend chunk metadata with `patch_author`, `patch_version`, `validation_report_url` to keep lineage.
- **[Status flow]** Only one override row may exist per `(doc_id, chunk_index)`. The application enforces the state machine `proposed → validating → {approved | needs_review | rejected | superseded}` via transactional `SELECT ... FOR UPDATE` statements so a proposal cannot regress while validation runs. When a new proposal targets an already approved chunk, the previous override is marked `superseded`, its artifacts are preserved in `document_events`, and the row is updated in-place with the new `patched_text`, diff, and `lock_version` metadata.
- **[Indexing]** Add covering indexes on `doc_id` (for retrieval fan-out) and on `status` (for reviewer dashboards). Each proposal/approval transaction must update both the row and any dependent caches atomically to keep the `UNIQUE (doc_id, chunk_index)` invariant intact.

### Pipeline updates
- **[Incremental ingest]** Allow `ingestDocument()` to run in "update" mode: skip extraction when agent supplies patched source, regenerate affected embeddings, and mark stale chunks (`docs/06_PIPELINE.md`).
- **[Diff detection]** Compute structured diffs (e.g., using tree-sitter for Dart/TS) to limit recomputation and maintain line ranges (`docs/phases/phase-13/05_ACCEPTANCE_CRITERIA.md`).
- **[Validation hooks]** Validation starts automatically the moment a proposal is submitted (no manual kick-off required). Maintainers can re-run validation via `POST /api/document-updates/:updateId/validate` if flaky tests or infrastructure failures occur.

#### Validation & approval workflow
- **Trigger** – Submission instantly enqueues a `validating` job. If no compute is available, the record stays `proposed` but includes `queued_at`; the worker flips the status to `validating` once it acquires a slot.
- **State transitions & blockers** – Transitions follow `proposed → validating → {validated | needs_review | rejected}`, and promotion to canonical requires a final `approved` decision. A proposal cannot leave `validating` until the test runner returns a terminal exit code. `needs_review` blocks further approvals until the proposer amends the diff or an approver overrides it.
- **Failure handling** – Test or lint failures push the record to `needs_review`, attach structured `failure_reasons[]`, and allow up to 3 automatic retries (configurable) before forcing a manual resubmission. Infrastructure errors (`timeout`, `runner_crash`) also move to `needs_review` but flag `retry_allowed = true` so the user can re-queue without edits.
- **Approver roles & fallback** – Only users or agents with the `DocumentApprover` role may transition `validated → approved`. If no such approver exists for the doc, ownership automatically escalates to the project owner specified in `documents.owner_id`; after 24h with no action, the system escalates to the global admin group via pager/notification.
- **Artifact storage** – Long-running test bundles (logs, coverage, screenshots) stream to `s3://knowledge-validation-artifacts/{doc_id}/{update_id}/{run_id}/`. Objects have a 45-day retention policy and are referenced through signed URLs stored in `validation_artifacts[]`, each containing `{kind, url, sha256, expires_at}` metadata so downstream reviewers can fetch or mirror the evidence.
- **Approval gate visualization** – the ASCII diagram below captures the exact transitions and exit criteria:

```
[proposed]
    | auto submission
    v
[validating] --tests pass--> [validated] --role=DocumentApprover--> [approved]
    | tests fail / infra issues
    v
[needs_review] --resubmit diff--> [proposed]
    | reviewer stops change
    v
[rejected]
```

- **Blocking conditions** – `approved` requires `validated` plus `artifact_urls` recorded and at least one approver signature. `rejected` records the acting approver and cannot be re-opened; the proposer must submit a new update ID.

### Agent tooling
- **[New tools]**
  - `propose_document_update`: accepts `{doc_id, source_diff, tests_run}`; stores draft version + chunk overrides.
  - `list_pending_updates`: lets reviewer agent or user inspect open proposals.
  - `approve_document_update` / `reject_document_update`: flips status, triggers re-ingestion, sets canonical flags.
- **[System prompt changes]** Encourage the builder agent to promote fixes via the new tools after validating locally (`docs/15_AGENT_PROMPTS.md`).
- **[MCP exposure]** Mirror the new endpoints so IDE agents can see pending updates and approve or revise them (`docs/07_MCP_SERVER.md`).

### API surface (`docs/05_API_SPEC.md`)
- `POST /api/documents/:id/updates` – submit proposal (with diff, tests, and `lock_version`), auto-enqueue validation, and return the initial `state` + reviewer SLA timestamps.
- `GET /api/documents/:id/updates` – list versions, patch overlays, validation state, failure reasons, artifact metadata, assigned approvers, and retry counters.
- `POST /api/document-updates/:updateId/validate` – manual re-run or escalation path; records why validation was retried and who triggered it.
- `POST /api/document-updates/:updateId/approve` – finalize and re-ingest when validation succeeded, or reject with reasons and escalation notes.
- `GET /api/documents/:id/history` – timeline of versions/events including optimistic-locking retries, rollbacks, and override transitions.

### UI updates (`docs/08_UI_SPEC.md`)
- **[Document view]** Show version timeline, pending proposals, and the diff for review.
- **[Chat citations]** When a chunk comes from an override, label it with the version and approval date.
- **[Notifications]** Surface alerts when the agent needs human approval.

### Observability & governance
- Emit structured logs for every update attempt (proposal, validation, approval).
- Dashboard metrics: number of successful updates, failure reasons, time-to-approval.
- Retain validation artifacts (test output, lint logs) in object storage and link via `document_events`.

## Phase 16 implementation plan

### Day 1 – Data & migration groundwork
- **[Task]** Design SQL migrations for `documents`, `chunk_overrides`, `document_events`, and `document_relationships`.
- **[Task]** Implement repository helpers for new tables in `packages/db/`.
- **[Task]** Backfill existing documents with `version = 1` and `is_canonical = true`.

### Day 2 – Pipeline & search integration
- **[Task]** Extend ingestion to handle update mode, regenerate embeddings selectively, and toggle canonical flags.
- **[Task]** Modify search services to prefer approved overrides, expose version metadata, and optionally join `document_relationships` for related context (`docs/phases/phase-11/01_HYBRID_SEARCH_ARCHITECTURE.md`).
- **[Task]** Add audit logging via `document_events` during ingest.

### Day 3 – Agent & API tooling
- **[Task]** Implement new REST endpoints and validation flows in Fastify.
- **[Task]** Add agent tools wrapping the endpoints, including prompts to ensure tests run.
- **[Task]** Update MCP server to forward update management operations.

### Day 4 – UI & QA
- **[Task]** Add document history views, diff renderers, and approval controls in `apps/web`.
- **[Task]** Write end-to-end tests covering proposal → approval → retrieval.
- **[Task]** Document workflows and update Phase summary templates.

## Technical specifications

### Database migrations
```sql
ALTER TABLE documents
  ADD COLUMN version INT NOT NULL DEFAULT 1,
  ADD COLUMN parent_doc_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  ADD COLUMN is_canonical BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE document_events (
  id BIGSERIAL PRIMARY KEY,
  doc_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  summary TEXT,
  artifacts JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chunk_overrides (
  id BIGSERIAL PRIMARY KEY,
  doc_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',
  patched_text TEXT NOT NULL,
  diff_summary TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (doc_id, chunk_index)
);

CREATE INDEX chunk_overrides_doc_id_idx
  ON chunk_overrides (doc_id);

CREATE INDEX chunk_overrides_status_idx
  ON chunk_overrides (status);

CREATE TABLE document_relationships (
  id BIGSERIAL PRIMARY KEY,
  doc_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  related_doc_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX document_relationships_type_idx
  ON document_relationships (relationship_type, doc_id);
```

### API contract additions
- **`POST /api/documents/:id/updates`** – creates the proposal and enqueues validation.
  ```json
  {
    "source_diff": "<patch>",
    "notes": "Fix null pointer in AuthService.login",
    "lock_version": 3,
    "tests": {
      "requested": true,
      "runner": "gha-linux-large",
      "artifact_expectation": ["logs", "coverage"],
      "timeout_sec": 3600
    }
  }
  ```
  Response
  ```json
  {
    "update_id": "6b1d...",
    "next_version": 4,
    "state": "validating",
    "retry_count": 0,
    "artifact_urls": [],
    "approver": null
  }
  ```
- **`GET /api/documents/:id/updates`** – surfaces validation progress, artifacts, and reviewer assignments.
  ```json
  {
    "updates": [
      {
        "id": "6b1d...",
        "version": 4,
        "state": "needs_review",
        "failure_reasons": ["unit-tests failed", "lint error"],
        "artifact_urls": [
          {
            "kind": "logs",
            "url": "https://artifacts.s3.amazonaws.com/knowledge-validation/6b1d/logs.tar.gz",
            "sha256": "abc123",
            "expires_at": "2025-01-18T12:33:00Z"
          }
        ],
        "queued_at": "2025-01-17T08:00:00Z",
        "validated_at": null,
        "approver": null
      }
    ]
  }
  ```
- **`POST /api/document-updates/:updateId/validate`** – manual retry endpoint (body: `{ "reason": "retry_after_flake" }`). Response mirrors the `GET` payload but with new `state` and `retry_count`.
- **`POST /api/document-updates/:updateId/approve`** – approval/rejection gate.
  ```json
  {
    "action": "approve",
    "approver_id": "user-123",
    "notes": "Validation artifacts reviewed",
    "artifact_urls": ["https://.../coverage.html"],
    "lock_version": 4
  }
  ```
  Response includes `{ "state": "approved", "approved_at": "...", "previous_canonical_id": "..." }`. Rejecting uses `"action": "reject"` plus a required `"reason"`; the update enters the `rejected` terminal state and cannot be reopened.

### Agent tool schemas
```typescript
updateDocument = z.object({
  doc_id: z.string().uuid(),
  diff: z.string(),
  tests: z.object({ ran: z.boolean(), results_path: z.string().url().optional() }),
  notes: z.string().max(500)
});

approveUpdate = z.object({ update_id: z.string().uuid(), promote: z.boolean().default(true) });
```

### Pipeline changes
- Guard ingestion with explicit `lock_version` checks: every publish transaction runs `WHERE id = :candidate_id AND lock_version = :expected AND is_canonical = false AND NOT EXISTS (SELECT 1 FROM documents WHERE parent_doc_id = :candidate_id AND is_canonical = true)`.
- Recalculate embeddings only for affected chunks; leverage existing chunk indices for untouched blocks.
- Update search caches/RAG context stores after promotion.
- On promotion conflicts, perform a bounded retry loop (default 3 attempts) that re-reads the canonical row, replays validation if necessary, increments the candidate `lock_version`, and aborts with a conflict error if contention persists.
- Rollbacks select the immediate prior sibling via `parent_doc_id`; if missing, pick the newest earlier canonical by `created_at` or follow `preferred_prior_doc_id` when provided so the caller can dictate the fallback document.

#### Promotion transaction pseudocode
```sql
BEGIN;
  -- ensure candidate is still valid and no newer canonical exists
  UPDATE documents
    SET is_canonical = true,
        lock_version = lock_version + 1
    WHERE id = :candidate_id
      AND lock_version = :expected_lock_version
      AND is_canonical = false
      AND NOT EXISTS (
        SELECT 1 FROM documents
        WHERE parent_doc_id = :candidate_id
          AND is_canonical = true
      );

  -- demote the previous canonical
  UPDATE documents
    SET is_canonical = false,
        lock_version = lock_version + 1
    WHERE id = :previous_canonical_id;

  IF NOT FOUND THEN
    ROLLBACK; -- lock_version mismatch or race
  ELSE
    COMMIT;
  END IF;
END;
```
Application code retries the block up to `N` times with exponential backoff; if all retries fail it surfaces a conflict so the agent can rebase.

### UI features
- Diff viewer using Monaco or CodeMirror diff mode.
- Timeline component referencing `document_events`.
- Badge in chat message cards showing `Version 3 (Approved Oct 15, 2025)` when citing patched chunks.

## Acceptance criteria
- **[Version control]** Every update creates a new document version linked to its parent; canonical pointer reflects approval state.
- **[Patch visibility]** Search and retrieval return patched chunks with metadata while preserving access to the original text.
- **[Agent workflow]** Builder agent can propose, validate, and request approval for fixes entirely via tools; reviewer can approve/reject.
- **[Safety nets]** Updates are blocked if tests fail or if reviewer rejects; all actions logged in `document_events`.
- **[UI parity]** Web dashboard exposes version history, diff, and approval controls; MCP surfaces equivalent info.
- **[Auditability]** Each change records actor, time, summary, and validation artifacts accessible via API.

## Risks & mitigations
- **[Race conditions]** Mitigate with version locking and `WHERE is_canonical = true` guards during promotion.
- **[Embedding drift]** Run nightly job to re-embed canonical documents to catch schema/model upgrades.
- **[Storage growth]** Configure retention policy (e.g., keep last 5 versions) with manual override for critical docs.
- **[Security]** Require explicit roles/scopes for approval endpoints to prevent untrusted agents from publishing.

## Open questions
- **[Diff granularity]** Do we store full new source blobs or structural AST patches per language?
- **[Automatic approval]** Should low-risk changes (docs-only) auto-promote after passing tests?
- **[Conflict resolution]** Need policy when human edits and agent proposals overlap.
