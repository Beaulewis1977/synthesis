# Implementation Plan: Move Synthesis to 1024-Dim Embeddings (-codex)

## Overview

Migrate Synthesis to a strict 1024-dimensional embedding standard, wipe all content data while preserving API keys and settings, and align provider metadata, defaults, validation, and UI to 1024-only embeddings. Embedding profiles are replaced with a 4-tier ladder (free/local -> cheap -> medium -> high) plus "none/manual"; default profile becomes free/local. Cohere remains embedding + rerank only; Google embeddings are removed.

**Estimated effort**: 60-90 min (plus migration runtime)

---

## Phase 0: Pre-flight (Safety + Alignment)

### 0.1 Confirm scope of reset
- Wipe everything except:
  - `provider_api_keys` (includes `anthropic_oauth`)
  - `provider_settings` (auth_mode, etc)
  - `model_configs`
  - `system_settings`
  - `custom_providers`
  - `mcp_server_configs`
- All other tables are truncated.

### 0.2 Back up preserved settings (manual)
```bash
pg_dump -U postgres -d synthesis \
  -t provider_api_keys \
  -t provider_settings \
  -t model_configs \
  -t system_settings \
  -t custom_providers \
  -t mcp_server_configs \
  > settings_backup.sql
```

---

## Phase 1: Database Migration (Reset + Schema)

### 1.1 Migration: reset content + 1024d vector
**File**: `packages/db/migrations/036_embedding_1024_reset.sql` (use next available number)

Key points:
- Truncate everything except the keep list above.
- Reset identity sequences where appropriate.
- Drop and recreate HNSW index after changing the vector dimension.

```sql
BEGIN;

-- Wipe content (cascades to documents, chunks, chat, graphs, ingestion, feedback, etc.)
TRUNCATE TABLE collections RESTART IDENTITY CASCADE;

-- Wipe tables not linked to collections (start-over scope)
TRUNCATE TABLE
  users,
  organizations,
  organization_members,
  collection_permissions,
  api_keys,
  sessions,
  audit_log,
  workflow_templates,
  workflow_instances,
  task_queries,
  code_contexts,
  budget_alerts
RESTART IDENTITY CASCADE;

-- Drop index before altering vector dimensions
DROP INDEX IF EXISTS chunks_embedding_hnsw;

-- Change embedding column to 1024 dimensions
ALTER TABLE chunks ALTER COLUMN embedding TYPE VECTOR(1024);

-- Recreate HNSW index for 1024d vectors
CREATE INDEX chunks_embedding_hnsw ON chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

COMMENT ON COLUMN chunks.embedding IS '1024-dimensional embedding vector (standardized dimension)';

COMMIT;
```

### 1.2 Migration: update embedding profile presets (1024 only)
**File**: `packages/db/migrations/037_update_embedding_profiles_1024.sql` (use next available number)

Update system profiles to 1024d models and reset presets. Keep the `none` profile (provider/model empty).

Preset ladder:
- **Free/local**: `mxbai-embed-large`
- **Cheap**: `voyage-3.5-lite`
- **Medium**: `voyage-3-large`
- **High**: `voyage-3.5`

Notes:
- Remove Google from the provider check constraint.
- Keep Cohere as an allowed provider (not in presets).
- Set the default embedding profile to **free/local** in `system_settings`.

### 1.3 Clean preserved model configs
**File**: `packages/db/migrations/037_update_embedding_profiles_1024.sql` (same migration)

- Keep existing LLM configs (`chat`, `summary`, `ocr`, `contradiction`).
- Delete or reset `embedding_docs`, `embedding_code`, `embedding_writing` rows so they fall back to new 1024 defaults/profile.

---

## Phase 2: Codebase Alignment (Defaults + Validation)

### 2.1 Embedding dimensions and provider defaults
**File**: `apps/server/src/services/embedding-router.ts`

- Update `MODEL_DIMENSIONS` to only include 1024d models.
- Remove 768/1536 models from the map.
- Set all provider defaults to 1024d:
  - `ollama` -> `mxbai-embed-large`
  - `openai` -> `text-embedding-3-large` with `dimensions=1024`
  - `voyage` -> `voyage-3-large` (general default)
  - `cohere` -> `embed-v4.0` with `outputDimension=1024`
- Add and use a validator that enforces 1024d only.

### 2.2 Enforce 1024d in embedding pipeline
**File**: `apps/server/src/pipeline/embed.ts`

- Fail fast if returned embedding length is not 1024.
- Ensure config dimensions are always 1024 for OpenAI/Cohere requests.

### 2.3 Remove/block incompatible providers for embeddings
**Files**:
- `packages/shared/src/index.ts`
- `packages/shared/src/embedding-profiles.ts`
- `apps/server/src/services/model-config-service.ts`
- `apps/web/src/hooks/useModelConfig.ts`

Actions:
- Remove Google from `EmbeddingProvider` and provider lists.
- Remove non-1024 Ollama models (`nomic-embed-text`, `jina-embeddings-v2-base-code`).
- Keep `mxbai-embed-large` as the only local embedding model.
- Ensure embedding model validation rejects any 768/1536 models.

### 2.4 Update defaults for per-feature embeddings
**Files**:
- `packages/shared/src/index.ts` (DEFAULT_MODEL_CONFIGS)
- `apps/server/src/services/metadata-builder.ts`
- `apps/server/src/pipeline/store.ts`

Defaults:
- `embedding_docs` -> `voyage-3-large`
- `embedding_code` -> `voyage-code-3`
- `embedding_writing` -> `voyage-3.5`
- Update metadata defaults to 1024d and a 1024-capable model/provider.

### 2.5 Sweep config and evaluation tools
**File**: `apps/server/src/evaluation/sweep-config.ts`

- Remove 768/1536 models from sweep lists.
- Ensure `getModelDimensions()` returns 1024 for all embeddings used in sweeps.

### 2.6 Tests and scripts
**Files** (examples):
- `apps/server/src/pipeline/__tests__/embed.test.ts`
- `apps/server/src/pipeline/__tests__/orchestrator.test.ts`
- `apps/server/src/services/__tests__/embedding-router.test.ts`
- `apps/server/src/services/__tests__/metadata-builder.test.ts`
- Any scripts asserting 768/1536 dims

Update expectations to 1024 and remove invalid models.

---

## Phase 3: UI/Settings Updates

### 3.1 Embedding model selection
**Files**:
- `apps/web/src/hooks/useModelConfig.ts`
- `apps/web/src/components/settings/ModelConfigCard.tsx`

Actions:
- Remove Google from embedding providers.
- Filter embedding models to 1024-only.
- Add a clear "Use profile (inherit)" option for embedding model selectors so presets remain in control unless an override is chosen.

### 3.2 Embedding profile UI
**Files**:
- `apps/web/src/components/settings/EmbeddingProfileSelect.tsx`
- `packages/shared/src/embedding-profiles.ts`

Ensure UI labels and descriptions reflect the new 4-tier ladder. Default profile should highlight free/local.

---

## Phase 4: Verification Checklist

### 4.1 Schema and data reset
- `SELECT COUNT(*) FROM collections;` returns 0.
- `SELECT COUNT(*) FROM documents;` returns 0.
- `SELECT COUNT(*) FROM chunks;` returns 0.
- `SELECT COUNT(*) FROM chat_sessions;` returns 0.

### 4.2 Settings preserved
- `/api/admin/api-keys` returns prior keys (masked)
- `/api/admin/models` returns saved model configs
- `/api/admin/custom-providers` returns custom providers
- `/api/admin/mcp-servers` returns MCP configs

### 4.3 Embedding enforcement
- Ingest a markdown file; chunk embeddings stored at 1024 dims.
- Search endpoint works with vector/hybrid modes.
- Using a 768/1536 model triggers a clear error.

### 4.4 UI validation
- Embedding provider dropdown does not show incompatible providers.
- Embedding model dropdown shows only 1024d models.
- "Use profile" option behaves as expected.

---

## Files to Modify Summary

| File | Change |
| --- | --- |
| `packages/db/migrations/036_embedding_1024_reset.sql` | NEW - Reset + 1024d vector |
| `packages/db/migrations/037_update_embedding_profiles_1024.sql` | NEW - 1024d profile updates |
| `apps/server/src/services/embedding-router.ts` | Enforce 1024d providers/models |
| `apps/server/src/pipeline/embed.ts` | Enforce embedding length=1024 |
| `packages/shared/src/index.ts` | Defaults, providers, model info |
| `packages/shared/src/embedding-profiles.ts` | Profile presets updated |
| `apps/server/src/services/model-config-service.ts` | Provider/model validation |
| `apps/web/src/hooks/useModelConfig.ts` | Provider lists & UI filtering |
| `apps/web/src/components/settings/ModelConfigCard.tsx` | Inherit option + filtering |
| `apps/server/src/evaluation/sweep-config.ts` | Remove 768/1536 models |
| Tests + scripts | Update 1024d expectations |

---

## Rollback Plan

If issues occur:
1. Restore `settings_backup.sql`.
2. Revert the embedding column to prior dimension:
   ```sql
   ALTER TABLE chunks ALTER COLUMN embedding TYPE VECTOR(768);
   ```
3. Rebuild HNSW index for prior dimension.
4. Revert code changes.
