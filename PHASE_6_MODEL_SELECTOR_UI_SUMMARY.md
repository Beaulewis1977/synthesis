# Phase Summary: Phase 6 – Model Selector Admin UI

**Date:** 2025-11-26  
**Branch:** `feature/phase-6-model-selector-ui`  
**Priority:** P1  
**Duration:** 1 day  
**Dependencies:** Phase 4 (Model Config Service), Phase 5 (Embedding Profiles)

---

## 📋 Overview

Implemented a comprehensive admin UI for runtime model configuration. This phase addresses the problem of having no UI for configuring AI models and providers, requiring developers to edit `.env` files directly.

**Problem Solved:** No way to configure AI models at runtime. Users had to manually edit environment variables and restart the server to change providers or models.

**Solution:** Created a full-featured settings page at `/settings/models` with:
- Model configuration cards for all features (Chat, OCR, Embeddings, etc.)
- Embedding profile selector with cost tier badges
- API key management with secure encrypted storage
- Real-time validation and optimistic updates

---

## ✅ Features Implemented

- [x] **Settings Page** - `/settings/models` with organized sections
- [x] **LLM Model Cards** - Configure Chat, Summarization, Vision OCR, Contradiction
- [x] **Embedding Configuration** - Profile selector + per-type overrides
- [x] **Reranker Configuration** - BGE (local), Cohere (cloud), None
- [x] **API Key Management** - Add, update, delete, test provider keys
- [x] **Secure Key Storage** - AES-256-GCM encryption at rest
- [x] **Config Source Indicator** - Shows if config is from env/db/default
- [x] **Local-Only Toggle** - Filters to local providers only
- [x] **Unsaved Changes Indicator** - Visual feedback for pending changes
- [x] **Optimistic Updates** - Immediate UI feedback with rollback on error
- [x] **Reset to Defaults** - Bulk reset all configurations

---

## 📁 Files Changed

### Created

| File | Purpose |
|------|---------|
| `apps/web/src/pages/settings/ModelsPage.tsx` | Main settings page component |
| `apps/web/src/components/settings/ModelConfigCard.tsx` | Feature configuration card |
| `apps/web/src/components/settings/EmbeddingProfileSelect.tsx` | Profile dropdown with cost badges |
| `apps/web/src/components/settings/ApiKeyManager.tsx` | API key management UI |
| `apps/web/src/components/settings/ModelConfigCard.test.tsx` | 10 unit tests |
| `apps/web/src/components/settings/EmbeddingProfileSelect.test.tsx` | 10 unit tests |
| `apps/web/src/hooks/useModelConfig.ts` | React Query hooks for data fetching |
| `apps/server/src/services/api-key-service.ts` | Secure API key storage service |
| `apps/server/src/routes/admin/api-keys.ts` | API key management endpoints |
| `packages/db/migrations/020_api_keys.sql` | Database table for encrypted keys |

### Modified

| File | Changes |
|------|---------|
| `apps/web/src/types/index.ts` | Added ModelConfig, EmbeddingProfile, ApiKeyStatus types |
| `apps/web/src/lib/api.ts` | Added API client methods for models, profiles, keys |
| `apps/web/src/App.tsx` | Added route for `/settings/models` |
| `apps/web/src/components/Layout.tsx` | Added Settings link to navigation |
| `apps/server/src/index.ts` | Registered API key routes |

---

## 🧪 Tests Added

### Unit Tests
- `ModelConfigCard.test.tsx` - **10 tests** covering:
  - Renders feature name and description
  - Shows current provider and model
  - Shows config source indicator
  - Shows unsaved indicator on changes
  - Shows Save button on changes
  - Calls onUpdate when Save clicked
  - Shows API key warning when missing
  - Filters providers when local-only enabled
  - Shows error message when provided
  - Disables inputs when updating

- `EmbeddingProfileSelect.test.tsx` - **10 tests** covering:
  - Renders selected profile
  - Shows cost tier badge
  - Opens dropdown when clicked
  - Shows all profiles in dropdown
  - Calls onSelect when profile clicked
  - Shows default indicator
  - Shows profile details in dropdown
  - Shows code-aware indicator
  - Is disabled when disabled prop true
  - Closes dropdown when clicking outside

### Test Results
```text
 ✓ src/components/settings/EmbeddingProfileSelect.test.tsx (10)
 ✓ src/components/settings/ModelConfigCard.test.tsx (10)

 Test Files  2 passed (2)
      Tests  20 passed (20)
```

---

## 🎯 Acceptance Criteria

- [x] **`/settings/models` page renders** - ✅ Complete
- [x] **Feature config cards work** - ✅ Chat, Embeddings, Reranker, etc.
- [x] **Provider/model dropdowns functional** - ✅ Filtered by feature type
- [x] **Local-only toggle works** - ✅ Filters to Ollama, BGE
- [x] **Validation error display** - ✅ Shows inline errors
- [x] **Embedding profile selector** - ✅ With cost badges
- [x] **API key management** - ✅ Add, update, delete, test
- [x] **All tests pass** - ✅ 20 new tests passing

---

## 🔌 API Endpoints

### Model Configuration
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/models` | Get all model configs with provider metadata |
| GET | `/api/admin/models/:feature` | Get specific feature config |
| PUT | `/api/admin/models/:feature` | Update feature config |
| DELETE | `/api/admin/models/:feature` | Reset feature to default |
| POST | `/api/admin/models/reset` | Reset all configs to defaults |
| POST | `/api/admin/models/validate` | Validate config without saving |

### API Key Management
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/api-keys` | Get status of all API keys |
| POST | `/api/admin/api-keys` | Set/update an API key |
| DELETE | `/api/admin/api-keys/:provider` | Delete an API key |
| POST | `/api/admin/api-keys/:provider/test` | Test API key validity |

---

## 🗄️ Database Migration

### New Table: `provider_api_keys`
```sql
CREATE TABLE provider_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL UNIQUE,
    encrypted_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Security
- Keys encrypted using **AES-256-GCM** before storage
- Format: `iv:authTag:ciphertext`
- Encryption key from `API_KEY_ENCRYPTION_KEY` env var
- Keys never returned in full after storage (only masked)

---

## 🎨 UI/UX Features

### Visual Indicators
- **Config Source Badge**: env (blue), db (green), default (gray)
- **Unsaved Changes**: Yellow border + "unsaved" badge
- **API Key Status**: Configured (green), Not set (yellow)
- **Cost Tier Badges**: Free (green), $ (blue), $$ (yellow), $$$ (red)

### Interactions
- **Optimistic Updates**: Immediate UI feedback, rollback on error
- **Provider Filtering**: Local-only mode hides cloud providers
- **Model Filtering**: Models filtered by selected provider
- **Dropdown Animation**: Smooth slide-down animation

### Accessibility
- All form controls have labels
- Tab navigation works correctly
- Focus visible on interactive elements
- Color not sole indicator of state (icons + text)

---

## 🆕 Models Added

### Google Gemini
- `gemini-2.5-flash-lite` - Chat
- `gemini-2.5-flash` - Chat
- `gemini-2.5-flash-image` - Vision
- `gemini-embedding-001` - Embeddings

### OpenAI
- `gpt-5-mini-2025-08-07` - Chat
- `gpt-5-nano-2025-08-07` - Chat

### Ollama (Local)
- `gpt-oss-20b` - Chat

### Anthropic
- `claude-sonnet-4-20250514` - Chat

---

## 🐛 Bugs Fixed

### Cohere API Key Test (405 Error)
- **Problem**: Test was using non-existent `/v1/check-api-key` endpoint
- **Fix**: Updated to use `/v2/rerank` endpoint with minimal test request

### Missing API Keys Warning (False Positive)
- **Problem**: Models route only checked env vars, not database-stored keys
- **Fix**: Updated to use `apiKeyService.getAllKeyStatus()` which checks both

---

## ⚠️ Known Issues

None. All features implemented and tested successfully.

---

## 💥 Breaking Changes

None. All changes are additive:
- New page at `/settings/models`
- New API endpoints under `/api/admin/`
- New database table `provider_api_keys`

---

## 🔗 Dependencies for Next Phase

Phase 7 (Collection Versioning) can now:
1. Use model configs to determine embedding provider per collection
2. Leverage embedding profiles for versioned re-ingestion
3. Build on the settings UI pattern for version management

---

## 📝 Notes for Reviewers

1. **API Key Security**: Keys are encrypted at rest using AES-256-GCM. The encryption key should be set via `API_KEY_ENCRYPTION_KEY` environment variable in production.

2. **Environment Variables Take Precedence**: If an API key is set in `.env`, it takes precedence over database-stored keys. The UI shows "env" as the source.

3. **Table Naming**: Used `provider_api_keys` instead of `api_keys` to avoid conflict with existing multi-user `api_keys` table from Phase 14.

4. **React Query Patterns**: Used optimistic updates with rollback for better UX. Cache invalidation happens on success or error.

### Testing Instructions
```bash
# Run web tests
pnpm --filter @synthesis/web test -- --run src/components/settings/

# Run typecheck
pnpm --filter @synthesis/web typecheck
pnpm --filter @synthesis/server typecheck

# Run migration
pnpm --filter @synthesis/db migrate

# Test API endpoints
curl http://localhost:3333/api/admin/models | jq .
curl http://localhost:3333/api/admin/api-keys | jq .
curl http://localhost:3333/api/admin/profiles | jq .
```

---

## 🔍 Review Checklist

### Code Quality
- [x] TypeScript best practices (strict types, proper interfaces)
- [x] React Query for data fetching (caching, optimistic updates)
- [x] Component composition (reusable cards, selectors)
- [x] Proper error handling with user feedback
- [x] No console.log in production code

### Testing
- [x] Unit tests for new components (20 tests)
- [x] Edge cases covered (missing keys, errors, loading states)
- [x] All tests passing

### Security
- [x] API keys encrypted at rest (AES-256-GCM)
- [x] Keys never exposed after storage (masked display)
- [x] Parameterized SQL queries
- [x] No sensitive data in logs

### UX
- [x] Loading states for async operations
- [x] Error messages displayed inline
- [x] Optimistic updates for responsiveness
- [x] Accessible form controls
- [x] Responsive design considerations

### Documentation
- [x] Types documented with JSDoc comments
- [x] API endpoints documented
- [x] Migration includes comments
- [x] Phase summary complete
