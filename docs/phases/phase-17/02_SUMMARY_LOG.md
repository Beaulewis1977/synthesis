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
**Status:** COMPLETE
**Date:** 2025-12-09
**Commits:** None yet (pending user approval)
**Notes:**
- Created migration file `packages/db/migrations/028_custom_providers.sql`
- Migration successfully applied with `pnpm --filter @synthesis/db migrate`
- Table `custom_providers` created with all required columns:
  - `id` (UUID primary key)
  - `name` (TEXT, unique, not null) - Display name
  - `base_url` (TEXT, not null) - OpenAI-compatible endpoint
  - `encrypted_key` (TEXT, nullable) - AES-256-GCM encrypted API key
  - `provider_type` (TEXT, default 'openai-compatible')
  - `max_context_tokens` (INTEGER, default 8192)
  - `supports_vision` (BOOLEAN, default false)
  - `supports_tools` (BOOLEAN, default true)
  - `custom_models` (TEXT[]) - Manual model list fallback
  - `discovered_models` (TEXT[]) - Auto-discovered models cache
  - `created_at`, `updated_at` (TIMESTAMPTZ)
- Created table-specific trigger function `update_custom_providers_updated_at()`
- Trigger `trigger_custom_providers_updated_at` auto-updates `updated_at` on row UPDATE
- Index `idx_custom_providers_name` created for efficient name lookups
- **Key Implementation Detail:** Followed project pattern of table-specific trigger functions (not generic `update_updated_at_column()` as mentioned in phase doc)
- **Files Created:**
  - `packages/db/migrations/028_custom_providers.sql`
- **Bug Fix (CodeRabbit):** Added explicit `DEFAULT '{}'` for `custom_models` and `discovered_models` array columns
  - **Issue:** NULL vs empty array confusion can complicate application logic
  - **Solution:** Created migration 029 to add explicit defaults and update existing NULL values
  - Both columns now default to empty arrays instead of NULL
- **Files Created:**
  - `packages/db/migrations/028_custom_providers.sql`
  - `packages/db/migrations/029_custom_providers_array_defaults.sql` (bug fix)
- **Files Modified:**
  - `docs/phases/phase-17/01_CHECKLIST.md` - Marked Phase 17C items as complete
  - `docs/phases/phase-17/17C_database_schema.md` - Marked verification checklist complete
  - `docs/phases/phase-17/00_PHASE_17_OVERVIEW.md` - Updated status and verification
  - `docs/phases/phase-17/02_SUMMARY_LOG.md` - This file

---

## Phase 17D: Backend CustomProviderService
**Status:** COMPLETE
**Date:** 2025-12-09
**Commits:** None yet (pending user approval)
**Notes:**
- Created shared encryption module `apps/server/src/services/encryption.ts`
  - Extracted AES-256-GCM encryption logic from `ApiKeyService`
  - Functions: `encryptValue()`, `decryptValue()`, `getEncryptionKey()`
  - Uses HKDF-SHA256 for key derivation from `API_KEY_ENCRYPTION_KEY` env var
  - Format: `{iv_hex}:{authTag_hex}:{encrypted_hex}`
  - Fully backward-compatible with existing encrypted data
- Updated `ApiKeyService` to use shared encryption module
  - Removed private `encryptKey()`, `decryptKey()`, `getEncryptionKey()` functions
  - Imported and used `encryptValue()` and `decryptValue()` from `./encryption.js`
  - Removed unused `crypto` import
  - All 6 usages updated successfully
- Created `CustomProviderService` with full CRUD operations:
  - **List**: `list()` - Returns all custom providers ordered by creation date
  - **Get**: `get(id)`, `getByName(name)` - Fetch single provider by ID or unique name
  - **Create**: `create(input)` - Validates uniqueness, encrypts API key, attempts model discovery
  - **Update**: `update(id, updates)` - Partial updates with dynamic SQL, checks name conflicts
  - **Delete**: `delete(id)` - Removes provider, throws error if not found
  - **API Key**: `getApiKey(id)` - Retrieves and decrypts API key securely
- Implemented connection testing with timeout:
  - Method: `testConnection(baseUrl, apiKey?)`
  - 10-second timeout using AbortController
  - Normalizes base URL (handles with/without `/v1` suffix)
  - Tests `{baseUrl}/v1/models` endpoint
  - Parses OpenAI format: `{ object: "list", data: [{ id: "model-name" }] }`
  - Error handling for: timeout, network, auth (401), not found (404), invalid format
  - Returns: `{ valid: boolean, models?: string[], error?: string }`
- Implemented model discovery:
  - Method: `discoverModels(id)` - Discovers models for existing provider
  - Method: `refreshDiscoveredModels(id)` - Discovers and updates DB cache
  - Gracefully handles failures (returns empty array, logs warnings)
  - Auto-invoked during `create()` if API key provided (non-blocking)
- Singleton pattern implementation:
  - Getter: `getCustomProviderService(db: Pool)`
  - Reset: `resetCustomProviderService()` for testing
  - Module-scoped instance variable
- TypeScript type safety:
  - Interfaces: `CustomProvider`, `CreateCustomProviderInput`, `TestConnectionResult`
  - Database row interface: `CustomProviderRow`
  - Helper method: `rowToProvider()` for type conversion
  - Proper typing for JSON response parsing (avoided `unknown` type errors)
- **Security Features:**
  - API keys encrypted at rest with AES-256-GCM
  - Never returns raw API keys (only `hasApiKey: boolean`)
  - Validates input before database operations
  - Name uniqueness enforced for create/update
- **Error Handling:**
  - Connection timeout: 10 seconds with clear message
  - Network errors: Caught and returned with details
  - Auth failures: 401 detected and reported
  - Not found: 404 detected for model endpoint
  - Invalid format: Validates OpenAI response structure
  - Database errors: Logged and re-thrown with context
- **Files Created:**
  - `apps/server/src/services/encryption.ts` - Shared encryption utilities (110 lines)
  - `apps/server/src/services/custom-provider-service.ts` - Main service (521 lines)
- **Files Modified:**
  - `apps/server/src/services/api-key-service.ts` - Migrated to shared encryption
  - `docs/phases/phase-17/01_CHECKLIST.md` - Marked Phase 17D items complete
  - `docs/phases/phase-17/02_SUMMARY_LOG.md` - This file
- **TypeScript Status:** All errors fixed (pre-existing unrelated error in `scripts/ingest-backend-recipes.ts`)
- **Next Steps:** Phase 17E - Create admin routes for custom provider management

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
