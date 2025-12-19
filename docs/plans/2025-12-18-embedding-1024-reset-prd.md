# PRD / Summary: Move Synthesis to 1024-Dim Embeddings (Fresh Content Reset, Preserve Settings)

## Context

Synthesis currently stores embeddings in Postgres using a fixed-dimension pgvector column:
- `chunks.embedding VECTOR(768)` (`packages/db/migrations/001_initial_schema.sql`)

However, the system supports multiple embedding providers/models (Voyage, OpenAI, Cohere, Ollama, Google) and some strong code-focused models operate at (or prefer) 1024+ dimensions (e.g., Voyage v3+). pgvector requires a fixed dimension per column, so mixing dimensions in one column will cause ingestion failures.

We want to standardize the platform to **1024-dimensional embeddings** so we can adopt “best available” code/document embedding models (e.g., newer Voyage models; OpenAI v3 embeddings truncated to 1024 via the `dimensions` parameter; Cohere embeddings with `outputDimension=1024`), while keeping the operational simplicity of a single vector index.

This change is paired with a “fresh start” reset of content: we do **not** need to preserve existing documents/chunks/collections, but we **do** need to preserve admin/config settings.

## Goals

- Make the embedding storage dimension **1024** across the system.
- Allow use of modern, high-quality embedding models that are 1024-d (native) or can be generated at 1024-d (via provider parameters).
- Reset all existing content (collections/documents/chunks/graph/etc.) so we avoid backfilling/re-embedding complexity.
- Preserve settings/configuration so the system remains configured after the reset:
  - model/provider configs, API keys, provider settings, system settings, embedding profiles, custom providers, MCP servers.
- After migration, new collections can be created and ingest/search works end-to-end without dimension mismatch errors.

## Non-Goals (for this change)

- Supporting multiple embedding dimensions simultaneously (multi-vector storage per chunk). This is a future enhancement if needed.
- Migrating/re-embedding existing document content. We are explicitly discarding it.
- Improving retrieval quality beyond enabling better embedding models (quality work will be handled separately via evaluation/tuning).

## Users / Stakeholders

- Operator (you) using the UI to manage collections, ingest repos/docs, run search and chat.
- System integrators building the DocPack Generator (needs stable ingestion + retrieval substrate).

## Requirements

### Functional

- Ingestion succeeds for:
  - Uploaded docs (`POST /api/ingest` → `apps/server/src/routes/ingest.ts`)
  - Repo sync ingestion (`POST /api/repos/:id/sync` → `apps/server/src/services/repo-ingestion.ts`)
  - Ingestion agent (`POST /api/ingestion-agent/start` → `apps/server/src/ingestion-agent/worker.ts`)
- Search succeeds in:
  - Vector mode (`apps/server/src/services/vector.ts`)
  - Hybrid mode (`apps/server/src/services/hybrid.ts`)
  - Optional reranking/MMR/graph expansion paths remain compatible.
- UI remains fully usable after reset:
  - Settings page still shows saved configuration (API keys, model configs, custom providers, MCP servers).
  - New collections can be created and used normally.

### Data retention

Preserve (settings)
- `model_configs` (feature-level provider/model settings)
- `provider_api_keys` (encrypted provider keys)
- `provider_settings`
- `system_settings`
- `embedding_profiles` (and default profile setting)
- `custom_providers` (and any associated model curation fields)
- `mcp_server_configs`

Discard (content)
- All `collections` (we will recreate)
- All `documents`, `chunks`, `knowledge_nodes`, `knowledge_edges`
- Repo sources/sync state (`repository_sources`)
- Chats (`chat_sessions`, `chat_messages`)
- Workflows, task queries, code contexts (`workflow_*`, `task_queries`, `code_contexts`)
- Feedback, cost logs, ingestion jobs, and other operational history (unless we explicitly decide otherwise)

## Proposed Solution (High-Level)

### Decision: 1024 as the “platform embedding dimension”

All persisted chunk embeddings must be **exactly 1024-dimensional**.

Provider/model strategy (1024 compatibility)
- Voyage: prefer models that natively return 1024 dims (e.g., v3+ code models).
- OpenAI: use v3 embeddings with `dimensions=1024` at embed time (provider-supported truncation).
- Cohere: use `outputDimension=1024` (provider-supported).
- Ollama: select a 1024-d embedding model (e.g., `mxbai-embed-large`), and/or keep Ollama only for chat if embedding dims aren’t aligned.
- Google embeddings: currently treated as fixed-dim in code; if fixed at 768, it becomes incompatible with a single 1024 store and should be disabled for embedding storage (or deferred to a future multi-embedding architecture).

### Database strategy

Change the schema so the canonical embedding column is 1024-d and re-index it with HNSW.

Because we are discarding content, we can drop and recreate the embedding storage without backfill. We still preserve the settings tables listed above.

### Application strategy

- Ensure ingestion always generates embeddings at 1024 dimensions for the configured embedding provider/model.
- Ensure retrieval queries use the 1024 embedding column (vector similarity and hybrid vector branch).
- Ensure UI configuration prevents choosing embedding providers/models that cannot produce 1024-d vectors (or clearly warns/blocks).

## Implementation Outline (what we will do)

### 1) Pre-migration checklist

- Confirm which environment(s) this applies to (local/dev vs production-like).
- Confirm we are comfortable losing all content tables (collections/documents/chunks/etc.).
- Confirm “settings to preserve” list above is complete.

### 2) Backup settings (DB-level)

- Export data-only backups of preserved settings tables.
- Validate backup can be restored (quick spot-check on a staging DB or via restore dry-run).

### 3) Apply schema change to 1024 embeddings

- Add a new migration that updates embedding storage to 1024 dims, including index rebuild:
  - Drop the existing HNSW index on `chunks.embedding`.
  - Drop and recreate the `chunks.embedding` column as `VECTOR(1024)` (or recreate the whole `chunks` table if simpler given a content wipe).
  - Recreate the HNSW index for cosine similarity.
- Ensure any ancillary constraints or generated columns remain intact.

### 4) Wipe all content

- Remove content rows/tables as per “Discard” list, while keeping the preserved settings tables.
- Because we are recreating collections, we can delete all `collections` rows and rely on cascade deletes for dependent content tables where foreign keys are configured with `ON DELETE CASCADE`.

### 5) Restore settings

- Restore the settings backup into the migrated schema.
- Confirm that settings UI and admin APIs show configured values:
  - `/api/admin/models`
  - `/api/admin/api-keys`
  - `/api/admin/custom-providers`
  - `/api/admin/mcp-servers`
  - `/api/admin/provider-settings`

### 6) Update runtime defaults and guardrails

- Update embedding profile presets (and defaults) to only include/choose 1024-compatible embeddings by default.
- Add validation/guardrails so the system refuses to select an embedding model that cannot produce 1024 dims when the DB requires 1024.

### 7) Verification (post-migration)

- Create a new collection in the UI.
- Ingest:
  - A small repo (via repo source + sync)
  - A few docs (PDF/DOCX/MD/TXT)
  - Optionally run ingestion agent for a small topic
- Confirm:
  - Ingestion completes and embeddings persist successfully (no pgvector dimension errors).
  - `/api/search` returns results in vector and hybrid modes.
  - Chat and synthesis (if enabled) remain functional.

## Risks / Tradeoffs

- Some providers/models are fixed-dimension (e.g., 768) and will become incompatible with a single 1024 store; we must enforce configuration constraints.
- If we later want an embedding model that cannot output 1024, we’ll need either:
  - another schema migration, or
  - a multi-embedding storage architecture (future scope).
- Wiping content also removes operational history (cost logs, feedback) that might be useful later; explicitly confirm that’s acceptable.

## Success Criteria (Acceptance)

- Settings are preserved and visible after the reset (API keys, model configs, custom providers, MCP configs, system settings, embedding profiles).
- New collections can be created.
- Ingestion works end-to-end and stores embeddings without dimension mismatch failures.
- Search (vector + hybrid) works end-to-end using the 1024 embeddings.
- No production-blocking regressions in the UI settings and core routes.

## Open Questions

- Do we want to preserve any “operational history” tables (cost tracking, feedback) even if we discard documents?
- Which embedding models will be “blessed defaults” for:
  - docs ingestion
  - code ingestion
  - personal writing (if used)
- Do we want a hard block vs warning in the UI when selecting an incompatible embedding provider/model?

