# Phase 4: Model Config Service - Summary

**Branch:** `feature/phase-4-model-config`  
**Status:** Complete  
**Date:** November 2025

---

## Overview

Phase 4 implements a centralized Model Configuration Service that replaces hard-coded model references and scattered environment variables with a unified, runtime-configurable system.

## Features Implemented

### 1. Database Schema (`018_model_configs.sql`)
- Created `model_configs` table with:
  - `feature` - Feature identifier (chat, summary, ocr, embedding_*, reranker)
  - `provider` - Model provider (anthropic, openai, ollama, etc.)
  - `model` - Provider-specific model identifier
  - `local_only` - Restrict to local models
  - `enabled` - Enable/disable configuration
- Added constraints for valid feature and provider names
- Auto-updating `updated_at` trigger

### 2. Shared Types (`packages/shared/src/index.ts`)
- `ModelFeature` - Type for all configurable features
- `ModelConfig` - Configuration interface with source tracking
- `ModelConfigRow` - Database row type
- `ModelConfigUpdate` - Update input type
- `ProviderInfo` - Provider metadata for UI
- `DEFAULT_MODEL_CONFIGS` - Default configurations per feature
- `PROVIDER_INFO` - Provider metadata (models, API keys, local status)
- `FEATURE_ENV_VARS` - Environment variable mappings

### 3. ModelConfigService (`apps/server/src/services/model-config-service.ts`)
- **Config Precedence:** env → DB → default
- **Caching:** 1-minute TTL cache for performance
- **Methods:**
  - `getChatModelConfig()` - Chat/agent model
  - `getSummaryModelConfig()` - Document summarization
  - `getOCRModelConfig()` - Vision OCR
  - `getEmbeddingConfig(type)` - Embeddings (docs/code/writing)
  - `getRerankerConfig()` - Search reranking
  - `getAllConfigs()` - All feature configurations
  - `setConfig(feature, update)` - Update configuration
  - `resetConfig(feature)` - Reset to default
  - `isApiKeyConfigured(provider)` - Check API key status

### 4. Admin API Routes (`apps/server/src/routes/admin/models.ts`)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/models` | Get all configurations |
| GET | `/api/admin/models/:feature` | Get specific feature config |
| PUT | `/api/admin/models/:feature` | Update feature config |
| DELETE | `/api/admin/models/:feature` | Reset to default |
| POST | `/api/admin/models/reset` | Reset all to defaults |
| POST | `/api/admin/models/validate` | Validate config without saving |

### 5. Backend Integration
Updated the following files to use ModelConfigService:

| File | Change |
|------|--------|
| `agent/agent.ts` | Uses `getChatModelConfig()` for chat model |
| `agent/tools.ts` | Uses `getSummaryModelConfig()` for summarization |
| `pipeline/vision-ocr.ts` | Uses `getOCRModelConfig()` for OCR |
| `services/embedding-router.ts` | Added `selectEmbeddingProviderAsync()` |
| `services/reranker.ts` | Added `selectRerankerProviderAsync()` |

## Files Changed

### Created
- `packages/db/migrations/018_model_configs.sql`
- `apps/server/src/services/model-config-service.ts`
- `apps/server/src/services/__tests__/model-config-service.test.ts`
- `apps/server/src/routes/admin/models.ts`
- `PHASE_4_MODEL_CONFIG_SUMMARY.md`

### Modified
- `packages/shared/src/index.ts` - Added Phase 4 types
- `apps/server/src/index.ts` - Registered admin routes
- `apps/server/src/agent/agent.ts` - Use config service
- `apps/server/src/agent/tools.ts` - Use config service
- `apps/server/src/pipeline/vision-ocr.ts` - Use config service
- `apps/server/src/services/embedding-router.ts` - Added async method
- `apps/server/src/services/reranker.ts` - Added async method
- `apps/server/src/agent/__tests__/tools.test.ts` - Fixed mock

## Tests Added

- `model-config-service.test.ts` - 32 unit tests covering:
  - Feature validation
  - Provider validation for features
  - Model validation for providers
  - Config precedence (env → DB → default)
  - Caching behavior
  - All convenience methods
  - setConfig validation
  - resetConfig behavior
  - API key checking

## Acceptance Criteria

- [x] No hard-coded models in backend code
- [x] Config precedence: env → DB → default
- [x] Admin API endpoints functional
- [x] All existing tests pass (528 tests)
- [x] New unit tests for config service (32 tests)

## Environment Variables

New environment variables supported (all optional, fall back to defaults):

| Variable | Feature | Default |
|----------|---------|---------|
| `CHAT_PROVIDER` | Chat agent | anthropic |
| `CHAT_MODEL` | Chat agent | claude-3-5-haiku-20241022 |
| `SUMMARY_PROVIDER` | Summarization | anthropic |
| `SUMMARY_MODEL` | Summarization | claude-3-5-haiku-20241022 |
| `OCR_PROVIDER` | Vision OCR | anthropic |
| `VISION_OCR_MODEL` | Vision OCR | claude-3-5-haiku-20241022 |
| `DOC_EMBEDDING_PROVIDER` | Doc embeddings | ollama |
| `CODE_EMBEDDING_PROVIDER` | Code embeddings | voyage |
| `WRITING_EMBEDDING_PROVIDER` | Writing embeddings | openai |
| `RERANKER_PROVIDER` | Reranking | bge |

## API Usage Examples

### Get all configurations
```bash
curl http://localhost:3333/api/admin/models
```

### Update chat model
```bash
curl -X PUT http://localhost:3333/api/admin/models/chat \
  -H "Content-Type: application/json" \
  -d '{"provider": "openai", "model": "gpt-4o"}'
```

### Reset to defaults
```bash
curl -X POST http://localhost:3333/api/admin/models/reset
```

## Dependencies for Next Phase

Phase 5 (Embedding Profiles) and Phase 6 (Model Selector UI) can now build on:
- `ModelConfigService` for reading/writing configurations
- Admin API for UI integration
- Shared types for frontend consumption

## Known Issues

None.

## Breaking Changes

None. All changes are backward compatible:
- Existing env vars continue to work
- Default behavior unchanged
- New async methods added alongside existing sync methods
