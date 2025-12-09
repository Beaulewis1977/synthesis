# Phase 17: Implementation Checklist

Master checklist for all Phase 17 verification items. Update status as work progresses.

**Legend:** `[ ]` pending | `[x]` complete | `[!]` blocked

---

## Phase 17A: Anthropic OAuth Toggle
- [x] `getAnthropicAuthMode()` method added to ProviderSettingsService
- [x] `testAnthropicOAuth()` method added to ApiKeyService
- [x] Anthropic provider branches on auth mode
- [x] OAuth toggle appears in Settings > API Keys
- [ ] OAuth mode works (chat uses Claude subscription) - needs manual testing
- [ ] API Key mode works (chat uses API billing) - needs manual testing
- [x] `pnpm typecheck` passes (pre-existing unrelated error in scripts/)

## Phase 17B: Fix Z.AI & Moonshot API Testing
- [x] `testZhipuKey()` method added
- [x] `testMoonshotKey()` method added
- [x] Z.AI "Test" button returns valid/invalid result
- [x] Moonshot "Test" button returns valid/invalid result
- [x] `pnpm typecheck` passes

## Phase 17C: Database Schema
- [x] Migration file created: `028_custom_providers.sql`
- [x] `pnpm --filter @synthesis/db migrate` succeeds
- [x] Table exists with correct schema
- [x] Trigger works (updated_at auto-updates)

## Phase 17D: Backend CustomProviderService
- [x] Service file created: `custom-provider-service.ts`
- [x] Encryption module extracted: `encryption.ts`
- [x] ApiKeyService updated to use shared encryption
- [x] Service instantiates correctly
- [x] CRUD operations implemented (list, get, getByName, create, update, delete)
- [x] API key encryption/decryption works
- [x] Model discovery parses OpenAI format
- [x] Connection test has 10s timeout
- [x] `pnpm typecheck` passes (pre-existing unrelated error in scripts/)

## Phase 17E: Backend Routes
- [x] Routes file created: `routes/admin/custom-providers.ts`
- [x] Routes registered in `apps/server/src/index.ts` (line 112)
- [x] All endpoints implemented correctly:
  - [x] GET `/api/admin/custom-providers`
  - [x] POST `/api/admin/custom-providers`
  - [x] GET `/api/admin/custom-providers/:id`
  - [x] PATCH `/api/admin/custom-providers/:id`
  - [x] DELETE `/api/admin/custom-providers/:id`
  - [x] POST `/api/admin/custom-providers/:id/test`
  - [x] GET `/api/admin/custom-providers/:id/models`
  - [x] POST `/api/admin/custom-providers/test-connection`
- [x] Input validation works (Zod schemas + UUID validation)
- [x] Error handling returns proper status codes (200/201/204/400/404/500)
- [x] Code review passed (no critical/moderate issues)
- [x] `pnpm typecheck` passes (pre-existing unrelated error in scripts/)

## Phase 17F: Chat Integration
- [x] `OpenAICompatibleConfig.apiKey` optional field added
- [x] `OpenAICompatibleProvider.streamChat` uses direct apiKey if provided
- [x] `getCustomChatProvider()` function added to factory
- [x] `getConfiguredChatProviderWithOverride()` handles `custom:uuid` format
- [x] CustomProvider types added to `packages/shared`
- [x] Custom provider resolves correctly in factory
- [ ] Chat works with custom provider - needs manual testing
- [ ] Tool calling works - needs manual testing
- [x] `pnpm typecheck` passes

## Phase 17G: Frontend Hooks
- [x] Hooks file created: `useCustomProviders.ts`
- [x] API client methods added to `api.ts`
- [x] Frontend types imported from `@synthesis/shared` (not duplicated)
- [x] Hooks compile without errors
- [x] API client methods match backend routes
- [x] `pnpm typecheck` passes

## Phase 17H: CustomProviderForm Component
- [x] Component file created: `CustomProviderForm.tsx`
- [x] Form renders correctly
- [x] Base URL validation allows localhost
- [x] Test connection shows results
- [x] Manual model fallback works when discovery fails
- [x] `pnpm typecheck` passes

## Phase 17I: Settings UI Integration
- [x] "Custom Providers" section added to ModelsPage
- [x] "Add Custom Provider" button works
- [x] Provider cards display correctly
- [x] Edit/Delete buttons work
- [x] `pnpm typecheck` passes

## Phase 17J: Chat Model Selector
- [x] Custom providers fetched with `useCustomProviders()`
- [x] Custom provider groups added after built-in providers
- [x] Custom providers appear in dropdown
- [x] Selection works (passes `custom:uuid` to backend)
- [ ] Chat functions with custom provider - needs manual testing
- [ ] Tool calling works - needs manual testing
- [x] `pnpm typecheck` passes

---

## Phase 17K: Model Curation & Tool Support
- [x] Migration 030 created for `starred_models` and `models_without_tools` columns
- [x] `CustomProvider` interface updated with new fields (`starredModels`, `modelsWithoutTools`)
- [x] `CustomProviderService` methods added:
  - [x] `updateStarredModels(id, models[])`
  - [x] `updateModelsWithoutTools(id, models[])`
  - [x] `addModelWithoutTools(id, modelName)`
  - [x] `modelSupportsTools(id, modelName)`
  - [x] `getModelsWithoutTools(id)`
- [x] Routes added for model curation:
  - [x] `PATCH /api/admin/custom-providers/:id/starred-models`
  - [x] `PATCH /api/admin/custom-providers/:id/models-without-tools`
  - [x] `POST /api/admin/custom-providers/:id/mark-no-tools/:model`
- [x] Auto-retry logic in `openai-compatible.ts`:
  - [x] Catches 404 "No endpoints found that support tool use" error
  - [x] Auto-retries without tools
  - [x] Auto-marks model as not supporting tools
  - [x] Shows warning message to user
- [x] Chat provider factory updated to check `modelsWithoutTools` list
- [x] Frontend API client methods added
- [x] Frontend hooks added (`useUpdateStarredModels`, `useUpdateModelsWithoutTools`, `useMarkModelNoTools`)
- [x] `ModelCurationModal` component created
- [x] `ModelsPage` updated with "Manage Models" button on provider cards
- [x] `ChatModelSelector` updated:
  - [x] Starred models appear first
  - [x] Search input for providers with >10 models
  - [x] Star indicator (⭐) for starred models
  - [x] Warning indicator (⚠️) for models without tool support
- [x] `pnpm typecheck` passes

## Phase 17L: Provider Connection Fallback
- [x] `testChatCompletionsFallback()` method added to `CustomProviderService`
- [x] Fallback triggers when `/models` returns 404
- [x] Tests `/chat/completions` with minimal request
- [x] Accepts 400, 404, 422, 500 as "valid connection" (model error, not auth error)
- [x] Returns success message for manual model entry
- [x] `TestConnectionResult.message` field added to shared types
- [x] `CustomProviderForm` updated to show success message
- [x] MiniMax and similar providers can now be added
- [x] `pnpm typecheck` passes

## Phase 17M: Provider Polish & Model Lists
- [ ] **Update PROVIDER_INFO model lists** - Add more models for built-in providers:
  - [ ] Z.AI (Zhipu): Add latest GLM models
  - [ ] Moonshot: Add latest Kimi models
  - [ ] OpenAI: Verify model list is current
  - [ ] Google: Verify Gemini model list
  - [ ] Anthropic: Verify Claude model list
- [ ] **Fix URL normalization bug** in `testConnection()`:
  - [ ] Handle full URLs like `https://api.openai.com/v1/models`
  - [ ] Handle trailing slashes properly
  - [ ] Extract base URL correctly from various input formats
- [ ] **Cleanup incorrectly created custom providers**:
  - [ ] Remove Z.AI/GLM if added as custom provider
  - [ ] Remove Moonshot if added as custom provider
  - [ ] Remove OpenAI if added as custom provider
  - [ ] Verify API keys are in correct section
- [ ] `pnpm typecheck` passes

---

## Final Testing Checklist

### Anthropic OAuth
- [ ] Toggle appears in Settings
- [ ] OAuth mode works (chat uses Claude subscription)
- [ ] API Key mode works (chat uses API billing)

### API Key Testing
- [ ] Z.AI API key test works
- [ ] Moonshot API key test works

### Custom Providers
- [x] Can add custom provider with URL + API key (tested with OpenRouter)
- [ ] Can add custom provider without API key (local)
- [x] Model auto-discovery works (tested with OpenRouter - 500+ models)
- [x] Manual model entry fallback works (tested with MiniMax)
- [x] Custom provider appears in chat model selector
- [ ] Can chat using custom provider with tools
- [ ] Can chat using custom provider without tools
- [ ] Delete custom provider works

### Model Curation (Phase 17K)
- [ ] Can star models in Settings > Models > Custom Providers > Manage Models
- [ ] Starred models appear first in chat dropdown
- [ ] Search works for providers with many models
- [ ] Can mark models as "no tool support"
- [ ] Warning indicator shows for no-tool models

### Auto-Retry Tool Support (Phase 17K)
- [ ] Models without tools trigger auto-retry
- [ ] Warning message shown to user
- [ ] Model auto-marked in database
- [ ] Next request skips tools automatically

### Provider Fallback (Phase 17L)
- [x] MiniMax connection test succeeds
- [x] Success message shows for manual model entry
- [x] Can add MiniMax models manually

### Code Quality
- [x] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (no new failures)
