# Plan: Cohere Rerank + Gemini 3 LLM Model List (-codex)

## Overview

Scope change: no Cohere chat provider. Keep Cohere for **embedding + rerank only**. Ensure Gemini 3 Pro/Flash (and image preview) remain in LLM model lists, remove other Gemini LLMs, and tighten per-feature model validation so rerank models cannot be selected for chat/embeddings. Set Cohere reranker default to `rerank-v3.5`.

**Estimated effort**: 30-45 min

---

## Phase 1: Shared Model Metadata

### 1.1 Provider metadata updates
**File**: `packages/shared/src/index.ts`

- Keep `LLMProvider` as-is (no Cohere).
- Update `PROVIDER_INFO.google.models` to include only:
  - `gemini-3-pro-preview`
  - `gemini-3-flash-preview`
  - `gemini-3-pro-image-preview` (image models stay)
- Remove Gemini 2.5 LLM models from the list.
- Ensure Cohere metadata contains only embedding + rerank models:
  - Embeddings: `embed-v4.0`, `embed-english-v3.0`, `embed-multilingual-v3.0`
  - Rerank: `rerank-v3.5`, `rerank-english-v3.0`, `rerank-multilingual-v3.0`

---

## Phase 2: Provider Validation and UI Filters

### 2.1 Server-side provider validation
**File**: `apps/server/src/services/model-config-service.ts`

- Keep Cohere **out** of LLM features (`chat`, `summary`, `ocr`, `contradiction`).
- Strengthen per-feature model validation so:
  - rerank models cannot be used for embeddings or chat
  - embedding models cannot be used for rerank

### 2.2 UI provider lists
**File**: `apps/web/src/hooks/useModelConfig.ts`

- LLM provider list should include Google (Gemini 3), exclude Cohere.
- Reranker providers include Cohere, Voyage, BGE, None.

---

## Phase 3: Reranker Defaults and Pricing

### 3.1 Cohere reranker default
**File**: `apps/server/src/services/reranker.ts`

- Set `DEFAULT_MODELS.cohere = 'rerank-v3.5'`.
- Ensure model selection accepts `rerank-v3.5`, `rerank-english-v3.0`, `rerank-multilingual-v3.0`.

### 3.2 Pricing coverage
**File**: `apps/server/src/services/cost-tracker.ts`

- Ensure Cohere rerank pricing includes `rerank-v3.5` and `rerank-english-v3.0`.

---

## Phase 4: UI Updates

### 4.1 Model config UI
**File**: `apps/web/src/components/settings/ModelConfigCard.tsx`

- Rerank model dropdown should surface Cohere `rerank-*` models.
- No Cohere option should appear for chat/summary/ocr/contradiction.

---

## Phase 5: Testing Checklist

1) **Rerank**
   - Set reranker to `rerank-v3.5`.
   - Run a search with reranking enabled.
   - Verify `rerankProvider` is `cohere`.

2) **Validation**
   - Cohere does not appear in LLM provider dropdowns.
   - Rerank models cannot be selected for embeddings or chat.

---

## Files to Modify Summary

| File | Change |
| --- | --- |
| `packages/shared/src/index.ts` | Update Gemini 3 list; Cohere embedding + rerank only |
| `apps/server/src/services/model-config-service.ts` | Provider + per-feature model validation |
| `apps/web/src/hooks/useModelConfig.ts` | Provider lists |
| `apps/server/src/services/reranker.ts` | Default Cohere rerank model |
| `apps/server/src/services/cost-tracker.ts` | Ensure Cohere rerank pricing |
| `apps/web/src/components/settings/ModelConfigCard.tsx` | Rerank filtering sanity |

