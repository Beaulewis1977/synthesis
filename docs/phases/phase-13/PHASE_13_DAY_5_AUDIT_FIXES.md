# Phase 13 Day 5 — Audit Findings & Fix Plan

Author: Code Intelligence Team

Scope: Align Day 5 validation prompt with the actual server behavior so large-scale tests, benchmarks, and documentation work end-to-end without surprises.

---

## Critical blockers to address

- Commands use non-UUID collection IDs where the server requires a UUID for `collection_id` in `/api/ingest`.
- References non-existent HTTP endpoints (document chunks) and assumes TS parser exists.
- Benchmark script depends on `ts-analyzer` (not yet implemented) and has a correctness bug in P90.
- Relationship/documentation paths mismatch (`routes/docs.ts` vs actual `routes/collections.ts`).
- Environment variable `CODE_MAX_CHUNK_LINES` is documented but not passed through the orchestrator.

---

## Detailed issues and corrective actions

### 1) Ingestion uses non-UUID collection identifiers

- Symptom: Day 5 examples pass strings like `flutter-test`/`ts-test` as `collection_id`.
- Root cause: The server validates `collection_id` as a UUID.
- Fix: Create a collection first, capture its UUID into `COLLECTION_ID`, and use that for all ingestion calls.

Suggested snippet:

```bash
# Create collection and capture UUID
COLLECTION_JSON=$(curl -s -X POST http://localhost:3333/api/collections \
  -H 'Content-Type: application/json' \
  -d '{"name":"flutter-test","description":"Flutter sample ingestion"}')
COLLECTION_ID=$(echo "$COLLECTION_JSON" | jq -r '.collection.id')

# Use the UUID in ingestion calls
curl -X POST http://localhost:3333/api/ingest \
  -F "file=@$file" \
  -F "collection_id=$COLLECTION_ID"
```

Also remove the extra `title` field in curl examples (the server uses the uploaded filename for title).

---

### 2) Document chunks API calls don’t exist

- Symptom: The prompt calls `GET /api/documents/{id}/chunks`.
- Root cause: No such route is implemented.
- Fix (Option A – recommended): Implement `GET /api/documents/:id/chunks` to return stored chunks for that document.
- Fix (Option B): Remove those calls and document alternative verification (e.g., DB query or an internal API).

If implementing (Option A), suggested shape:

```ts
// apps/server/src/routes/documents.ts
import type { FastifyPluginAsync } from 'fastify';
import { getDocumentChunks } from '@synthesis/db';

export const documentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { id: string } }>(
    '/api/documents/:id/chunks',
    async (request, reply) => {
      const chunks = await getDocumentChunks(request.params.id);
      return reply.send({ document_id: request.params.id, chunks });
    }
  );
};
```

---

### 3) TS parser requirement ahead of implementation

- Symptom: Day 5 assumes TypeScript parser & chunker exist ("Days 1-4 complete").
- Root cause: `chunkTypeScriptCode` is still a fallback and `ts-analyzer.ts` is not present yet.
- Fix: Gate Day 5 execution on completion of Day 4 tasks:
  - Implement `apps/server/src/pipeline/ts-analyzer.ts` and real `chunkTypeScriptCode`.
  - Add TS/TSX fixtures and tests (unit + integration) to assert code-aware chunks.
  - Only then execute Day 5 large-scale validation and benchmarks.

---

### 4) Benchmark script small correctness and dependency issues

- Symptom: Day 5 proposes a script that imports `parseTypeScriptFile` and uses `glob` without ensuring it’s available; P90 uses lexicographic sort.
- Root cause: Missing implementation/dependency and a typical sort pitfall.
- Fix:
  - Ensure `ts-analyzer.ts` exists or stub TS parts out until implemented.
  - Add `glob` dependency or replace with native discovery.
  - Fix P90:

```ts
const p90 = [...times].sort((a, b) => a - b)[Math.floor(times.length * 0.9)];
```

- Optional: Capture min/max and median for richer metrics.

---

### 5) Route path references

- Symptom: Day 5 references `routes/docs.ts` for API changes; related-files API actually lives in `apps/server/src/routes/collections.ts`.
- Fix: Update doc references to the correct file (`routes/collections.ts`).

---

### 6) Environment variable `CODE_MAX_CHUNK_LINES`

- Symptom: Documented in Day 5 and `.env.example`, but not wired into the orchestrator → chunker.
- Fix (Option A – recommended): Read `process.env.CODE_MAX_CHUNK_LINES` in `orchestrator.ts` and pass it as `maxChunkSize` into `chunkCodeFile`.
- Fix (Option B): Remove it from docs if not intended for this phase.

Example wiring (Option A):

```ts
// apps/server/src/pipeline/orchestrator.ts
const maxChunkSize = Number(process.env.CODE_MAX_CHUNK_LINES || 100);
...
chunks = await chunkCodeFile(document.file_path, extraction.text, {
  preserveImports: process.env.PRESERVE_IMPORTS === 'true',
  trackRelationships: process.env.TRACK_RELATIONSHIPS === 'true',
  db: getPool(),
  collectionId: document.collection_id,
  maxChunkSize,
});
```

---

### 7) SQL examples mixing collection names vs ids

- Symptom: Day 5 includes SQL that queries collections by name while ingestion examples (as written) would fail to create such collections.
- Fix: Either:
  - Ensure a collection with that `name` exists (via `POST /api/collections` before the SQL), or
  - Prefer using `collection_id` (UUID) in SQL examples to avoid ambiguity.

---

### 8) Search endpoint reference

- Symptom: Day 5 calls `POST /api/search` for function search.
- Risk: If the route isn’t exposed, the example will fail.
- Fix: Verify that a public search route exists and document its request/response; otherwise, adjust the example to use the existing search mechanism (e.g., agent tooling or a server route you actually have).

---

## Corrected command snippets (ready-to-run)

Large-scale ingestion (Dart), using a real UUID:

```bash
# Create collection
COLLECTION_JSON=$(curl -s -X POST http://localhost:3333/api/collections \
  -H 'Content-Type: application/json' \
  -d '{"name":"flutter-test","description":"Flutter sample ingestion"}')
COLLECTION_ID=$(echo "$COLLECTION_JSON" | jq -r '.collection.id')

# Ingest first 100 Dart files
find /tmp/flutter-samples -name "*.dart" -type f | head -n 100 | while read file; do
  echo "Ingesting: $file"
  curl -s -X POST http://localhost:3333/api/ingest \
    -F "file=@$file" \
    -F "collection_id=$COLLECTION_ID" \
    2>&1 | tee -a ingest.log >/dev/null
done
```

Performance P90 calculation (fix):

```ts
const p90 = [...times].sort((a, b) => a - b)[Math.floor(times.length * 0.9)];
```

Optional chunks endpoint (if implemented):

```bash
curl -s http://localhost:3333/api/documents/$DOC_ID/chunks | jq '.'
```

---

## Test plan deltas for Day 5

- After TS parser/chunker are implemented (Day 4 completion):
  - Update integration tests to assert code-aware chunks for TS/TSX.
  - Add performance smoke test thresholds (e.g., <500ms typical files) to CI-only or skip locally with an env guard.
- If adding the chunks endpoint: add route tests that validate schema and metadata integrity.

---

## Acceptance criteria mapping (post-fixes)

- Dart and TS function/class preservation targets validated using real projects and improved tests.
- Imports preserved when `PRESERVE_IMPORTS=true` for both languages.
- Related files endpoint verified on real inputs.
- Fallback behavior confirmed via malformed inputs.
- Feature flags verified (`CODE_CHUNKING`, `PRESERVE_IMPORTS`, `TRACK_RELATIONSHIPS`, optional `CODE_MAX_CHUNK_LINES`).

---

## Risks & mitigations

- TS parser coverage gaps (decorators/generics/overloads): expand fixtures; treat unknowns as code text without failing.
- Scale ingestion variability: throttle or batch requests to avoid transient errors.
- Endpoint drift: keep docs in lockstep with actual implemented routes; avoid referencing unimplemented APIs.

---

## Checklist (Day 5 readiness)

1) Ensure Day 4 TS work is complete (analyzer, chunker, tests).
2) Update Day 5 doc commands to use UUID collection IDs.
3) Either implement or remove document-chunks route references.
4) Fix benchmark P90 and ensure dependencies exist.
5) Wire `CODE_MAX_CHUNK_LINES` or remove from docs.
6) Verify search route exists (or update example).
7) Re-run Large-Scale Testing and Benchmarks.
