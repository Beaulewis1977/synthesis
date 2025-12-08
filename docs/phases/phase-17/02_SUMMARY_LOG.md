# Phase 17: Progress Summary Log

Agent-updated log of completed work. Update after each sub-phase completion.

---

## Phase 17A: Anthropic OAuth Toggle
**Status:** IMPLEMENTED (Awaiting Testing)
**Date:** 2025-12-08
**Commits:** None yet (pending user approval)
**Notes:**
- Added `getAnthropicAuthMode()` to `ProviderSettingsService` for reading auth mode setting
- Added OAuth token management methods to `ApiKeyService`:
  - `setOAuthToken()` - Store encrypted OAuth token
  - `getOAuthToken()` - Retrieve token (checks env var then DB)
  - `deleteOAuthToken()` - Remove stored token
  - `getOAuthTokenStatus()` - Get token status for UI
  - `testAnthropicOAuth()` - Test token validity and CLI accessibility
- Updated `AnthropicChatProvider`:
  - Added `configureAuthentication()` method that sets appropriate env var based on mode
  - OAuth mode: Sets `CLAUDE_CODE_OAUTH_TOKEN`, clears `ANTHROPIC_API_KEY`
  - API key mode: Sets `ANTHROPIC_API_KEY`, clears `CLAUDE_CODE_OAUTH_TOKEN`
  - Updated `isConfigured()` to check for OAuth token or API key based on mode
- Added OAuth routes to `routes/admin/api-keys.ts`:
  - `GET /api/admin/api-keys/oauth/status`
  - `POST /api/admin/api-keys/oauth`
  - `DELETE /api/admin/api-keys/oauth`
  - `POST /api/admin/api-keys/oauth/test`
- Added frontend API client methods in `apps/web/src/lib/api.ts`
- Added React Query hooks in `useModelConfig.ts`:
  - `useOAuthTokenStatus()` - Fetch token status
  - `useSetOAuthToken()` - Save token mutation
  - `useDeleteOAuthToken()` - Delete token mutation
  - `useTestOAuthToken()` - Test token mutation
  - `useAnthropicAuthMode()` - Get current auth mode from settings
- Updated `ApiKeyManager.tsx` with:
  - `OAuthTokenInput` component for OAuth token management
  - Auth mode toggle in Anthropic section
  - Mode indicator showing which auth method is active
- **Files Modified:**
  - `apps/server/src/services/api-key-service.ts`
  - `apps/server/src/services/chat-providers/anthropic.ts`
  - `apps/server/src/routes/admin/api-keys.ts`
  - `apps/web/src/lib/api.ts`
  - `apps/web/src/hooks/useModelConfig.ts`
  - `apps/web/src/components/settings/ApiKeyManager.tsx`

---

## Phase 17B: Fix Z.AI & Moonshot API Testing
**Status:** COMPLETE (with endpoint correction)
**Date:** 2025-12-08
**Commits:** None yet (pending user approval)
**Notes:**
- Added `testZhipuKey()` method to `ApiKeyService` for Z.AI API key validation
  - **Corrected endpoint:** `https://api.z.ai/api/paas/v4/chat/completions` (POST)
  - Initial implementation used `/models` endpoint which is not documented
  - CodeRabbit review caught this - corrected to use documented `/chat/completions` endpoint
  - Uses minimal request (glm-4-air model, 1 max_token) to minimize API costs
  - Returns valid/invalid status with appropriate error messages
- Added `testMoonshotKey()` method to `ApiKeyService` for Moonshot API key validation
  - Tests against `https://api.moonshot.ai/v1/models` (GET)
  - Uses `Authorization: Bearer {key}` header
  - Returns valid/invalid status with appropriate error messages
- Added switch cases in `testKey()` method for both providers
- Both methods follow the existing test method pattern
- **Provider Identity Notes:**
  - GLM (Zhipu) and Kimi (Moonshot) are Claude-architecture-based models
  - When asked their identity, they may respond as "Claude" - this is expected behavior
  - Provider selection IS working correctly (verified via backend logs and streaming responses)
  - API calls go to correct endpoints (api.z.ai and api.moonshot.ai)
- **Files Modified:**
  - `apps/server/src/services/api-key-service.ts` - Added test methods and switch cases
  - `docs/phases/phase-17/17B_api_testing_fix.md` - Updated with corrected endpoint

---

## Phase 17C: Database Schema
**Status:** NOT STARTED
**Date:** -
**Commits:** -
**Notes:** -

---

## Phase 17D: Backend CustomProviderService
**Status:** NOT STARTED
**Date:** -
**Commits:** -
**Notes:** -

---

## Phase 17E: Backend Routes
**Status:** NOT STARTED
**Date:** -
**Commits:** -
**Notes:** -

---

## Phase 17F: Chat Integration
**Status:** NOT STARTED
**Date:** -
**Commits:** -
**Notes:** -

---

## Phase 17G: Frontend Hooks
**Status:** NOT STARTED
**Date:** -
**Commits:** -
**Notes:** -

---

## Phase 17H: CustomProviderForm Component
**Status:** NOT STARTED
**Date:** -
**Commits:** -
**Notes:** -

---

## Phase 17I: Settings UI Integration
**Status:** NOT STARTED
**Date:** -
**Commits:** -
**Notes:** -

---

## Phase 17J: Chat Model Selector
**Status:** NOT STARTED
**Date:** -
**Commits:** -
**Notes:** -

---

## Final Review
**Status:** NOT STARTED
**Date:** -
**PR:** -
**Notes:** -
