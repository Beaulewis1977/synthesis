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

## Final Testing Checklist

### Anthropic OAuth
- [ ] Toggle appears in Settings
- [ ] OAuth mode works (chat uses Claude subscription)
- [ ] API Key mode works (chat uses API billing)

### API Key Testing
- [ ] Z.AI API key test works
- [ ] Moonshot API key test works

### Custom Providers
- [ ] Can add custom provider with URL + API key
- [ ] Can add custom provider without API key (local)
- [ ] Model auto-discovery works (test with Ollama in OpenAI mode)
- [ ] Manual model entry fallback works
- [ ] Custom provider appears in chat model selector
- [ ] Can chat using custom provider with tools
- [ ] Delete custom provider works

### Code Quality
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (no new failures)
