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
- [ ] Service file created: `custom-provider-service.ts`
- [ ] Service instantiates correctly
- [ ] CRUD operations work (list, get, create, update, delete)
- [ ] API key encryption/decryption works
- [ ] Model discovery parses OpenAI format
- [ ] Connection test has 5-10s timeout
- [ ] `pnpm typecheck` passes

## Phase 17E: Backend Routes
- [ ] Routes file created: `routes/admin/custom-providers.ts`
- [ ] Routes registered in `routes/admin/index.ts`
- [ ] All endpoints respond correctly:
  - [ ] GET `/api/admin/custom-providers`
  - [ ] POST `/api/admin/custom-providers`
  - [ ] GET `/api/admin/custom-providers/:id`
  - [ ] PATCH `/api/admin/custom-providers/:id`
  - [ ] DELETE `/api/admin/custom-providers/:id`
  - [ ] POST `/api/admin/custom-providers/:id/test`
  - [ ] GET `/api/admin/custom-providers/:id/models`
  - [ ] POST `/api/admin/custom-providers/test-connection`
- [ ] Input validation works
- [ ] Error handling returns proper status codes
- [ ] `pnpm typecheck` passes

## Phase 17F: Chat Integration
- [ ] `OpenAICompatibleConfig.apiKey` optional field added
- [ ] `OpenAICompatibleProvider.streamChat` uses direct apiKey if provided
- [ ] `getCustomChatProvider()` function added to factory
- [ ] `getConfiguredChatProviderWithOverride()` handles `custom:uuid` format
- [ ] CustomProvider types added to `packages/shared`
- [ ] Custom provider resolves correctly in factory
- [ ] Chat works with custom provider
- [ ] Tool calling works
- [ ] `pnpm typecheck` passes

## Phase 17G: Frontend Hooks
- [ ] Hooks file created: `useCustomProviders.ts`
- [ ] API client methods added to `api.ts`
- [ ] Frontend types added
- [ ] Hooks compile without errors
- [ ] API client methods match backend routes
- [ ] `pnpm typecheck` passes

## Phase 17H: CustomProviderForm Component
- [ ] Component file created: `CustomProviderForm.tsx`
- [ ] Form renders correctly
- [ ] Base URL validation allows localhost
- [ ] Test connection shows results
- [ ] Manual model fallback works when discovery fails
- [ ] `pnpm typecheck` passes

## Phase 17I: Settings UI Integration
- [ ] "Custom Providers" section added to ModelsPage
- [ ] "Add Custom Provider" button works
- [ ] Provider cards display correctly
- [ ] Edit/Delete buttons work
- [ ] `pnpm typecheck` passes

## Phase 17J: Chat Model Selector
- [ ] Custom providers fetched with `useCustomProviders()`
- [ ] Custom provider groups added after built-in providers
- [ ] Custom providers appear in dropdown
- [ ] Selection works (passes `custom:uuid` to backend)
- [ ] Chat functions with custom provider
- [ ] Tool calling works
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
