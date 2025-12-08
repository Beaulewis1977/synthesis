# Synthesis Phase 17: Custom LLM Providers & API Testing Fixes

## Overview

This document outlines the implementation of custom OpenAI-compatible LLM provider support and fixes for missing API key testing functionality. Users will be able to add arbitrary LLM endpoints (vLLM, LMStudio, OpenRouter, Groq, etc.) with model auto-discovery and full tool calling support.

**NEW: Anthropic OAuth/API Key Toggle** - Switch between Claude subscription (OAuth) and API key billing.

## Current State

### Working Features
- Multi-provider chat (Anthropic, OpenAI, Google, Ollama, Z.AI/Zhipu, Moonshot)
- `OpenAICompatibleProvider` base class for OpenAI-compatible APIs
- API key encryption (AES-256-GCM) in `provider_api_keys` table
- `ProviderSettingsService` for provider-specific settings (e.g., Z.AI coding plan toggle)
- API key testing for: Anthropic, OpenAI, Google, Voyage, Cohere
- Per-chat model selection with persistence

### Known Issues
1. **Z.AI API key testing not supported** - Returns "Testing not supported for provider: zhipu"
2. **Moonshot API key testing not supported** - Returns "Testing not supported for provider: moonshot"
3. **No custom provider support** - Users cannot add arbitrary OpenAI-compatible endpoints
4. **Hardcoded provider list** - `PROVIDER_INFO` in `packages/shared` is static
5. **No OAuth option for Anthropic** - Currently only API key billing, no option to use Claude subscription

### Environment
- Branch: `feature/custom-llm-providers` (off `develop`)
- Infrastructure: Docker Compose (PostgreSQL + Ollama + Redis)
- Existing encryption: AES-256-GCM via `API_KEY_ENCRYPTION_KEY` env var

---

## Planned Features

### 0. Anthropic OAuth/API Key Toggle (NEW)

**Goal:** Allow users to switch between Claude subscription (OAuth) and API key billing

| Mode | Authentication | Billing |
|------|----------------|---------|
| **OAuth** | `CLAUDE_CODE_OAUTH_TOKEN` via CLI | Claude Pro/Max subscription |
| **API Key** | `ANTHROPIC_API_KEY` via SDK | Pay-per-use API billing |

**How it works:**
- OAuth mode spawns Claude CLI (`pathToClaudeCodeExecutable`) which reads `CLAUDE_CODE_OAUTH_TOKEN`
- API Key mode passes `apiKey` directly to the SDK
- Toggle stored in `provider_settings` table: `anthropic.auth_mode = 'oauth' | 'api_key'`

### 1. Fix Missing API Key Testing (Z.AI & Moonshot)

**Goal:** Enable "Test" button functionality for Z.AI and Moonshot providers

**Endpoints to test:**
| Provider | Test Endpoint | Auth Header |
|----------|---------------|-------------|
| Z.AI (Zhipu) | `https://api.z.ai/api/paas/v4/models` | `Authorization: Bearer {key}` |
| Moonshot | `https://api.moonshot.ai/v1/models` | `Authorization: Bearer {key}` |

### 2. Custom OpenAI-Compatible Providers

**Goal:** Allow users to add any OpenAI-compatible LLM endpoint

**Target Providers (examples):**
| Provider | Base URL | Notes |
|----------|----------|-------|
| vLLM | `http://localhost:8000/v1` | Local inference server |
| LMStudio | `http://localhost:1234/v1` | Desktop LLM app |
| OpenRouter | `https://openrouter.ai/api/v1` | Multi-provider gateway |
| Groq | `https://api.groq.com/openai/v1` | Fast inference |
| Together AI | `https://api.together.xyz/v1` | Multi-model API |

**Architecture:**
```text
CustomProviderService
├── CRUD operations (create, read, update, delete)
├── API key encryption (reuses existing AES-256-GCM)
├── Model auto-discovery (GET /v1/models)
├── Connection testing
└── Integration with ChatProvider factory
```

### 3. Model Auto-Discovery with Manual Fallback

**Goal:** Automatically discover available models, with manual entry fallback

**Flow:**
1. User enters Base URL + API Key
2. System calls `GET {baseUrl}/models`
3. If successful: Parse and display discovered models
4. If failed: Show warning, allow manual comma-separated model entry
5. Store both `discovered_models` and `custom_models` in database

---

## Implementation Phases

### Phase 17A: Anthropic OAuth/API Key Toggle (NEW)
**Status:** NOT STARTED

**Goal:** Add toggle for Anthropic to switch between OAuth (Claude subscription) and API key billing

**Setup OAuth Token:**
```bash
# 1. Install Claude CLI (if not installed)
pnpm add -g @anthropic-ai/claude-code

# 2. Login to Claude
claude login

# 3. Generate OAuth token
claude setup-token
# Outputs: eyJhbGciOiJSUzI1...

# 4. Set environment variable
export CLAUDE_CODE_OAUTH_TOKEN='eyJhbGciOiJSUzI1...'
```

**Implementation:**

1. **Add auth mode helper** (`apps/server/src/services/api-key-service.ts`):
```typescript
// In ProviderSettingsService class
async getAnthropicAuthMode(): Promise<'oauth' | 'api_key'> {
  const value = await this.getSetting('anthropic', 'auth_mode');
  return (value === 'oauth') ? 'oauth' : 'api_key';
}
```

2. **Modify Anthropic provider** (`apps/server/src/services/chat-providers/anthropic.ts`):
```typescript
const authMode = await getProviderSettingsService(this.db).getAnthropicAuthMode();

if (authMode === 'oauth') {
  // OAuth: Use CLI which reads CLAUDE_CODE_OAUTH_TOKEN
  const response = query({
    prompt,
    options: {
      pathToClaudeCodeExecutable: claudeCliPath,
      // ... other options
    },
  });
} else {
  // API Key: Pass directly to SDK
  const apiKey = await getProviderApiKey(this.db, 'anthropic');
  const response = query({
    prompt,
    options: {
      apiKey,
      // ... other options
    },
  });
}
```

3. **Add OAuth test method** (`apps/server/src/services/api-key-service.ts`):
```typescript
private async testAnthropicOAuth(): Promise<{ valid: boolean; message: string }> {
  const cliPath = process.env.CLAUDE_CLI_PATH || 'claude';
  try {
    const { execSync } = await import('node:child_process');
    execSync(`${cliPath} --version`, { timeout: 5000 });
    return { valid: true, message: 'OAuth token is valid (CLI accessible)' };
  } catch {
    return { valid: false, message: 'OAuth token invalid or CLI not accessible' };
  }
}
```

4. **Add UI toggle** (`apps/web/src/components/settings/ApiKeyManager.tsx`):
```tsx
{key.provider === 'anthropic' && (
  <ProviderSettingToggle
    label="Use Claude Subscription (OAuth)"
    description="Uses your Claude Pro/Max subscription instead of API credits."
    currentValue={anthropicAuthMode === 'oauth'}
    onToggle={() => handleAnthropicAuthModeToggle()}
  />
)}
```

**Files to Modify:**
- `apps/server/src/services/api-key-service.ts`
- `apps/server/src/services/chat-providers/anthropic.ts`
- `apps/web/src/components/settings/ApiKeyManager.tsx`
- `apps/web/src/hooks/useModelConfig.ts`

**Commit:** `feat(anthropic): add OAuth/API key authentication toggle`

---

### Phase 17B: Fix Z.AI & Moonshot API Testing
**Status:** NOT STARTED

**Goal:** Add `testZhipuKey()` and `testMoonshotKey()` methods to `ApiKeyService`

**Implementation:**

```typescript
// apps/server/src/services/api-key-service.ts

// Add to switch statement (around line 317):
case 'zhipu':
  return await this.testZhipuKey(key);
case 'moonshot':
  return await this.testMoonshotKey(key);

// Add test methods:
private async testZhipuKey(key: string): Promise<{ valid: boolean; message: string }> {
  const response = await fetch('https://api.z.ai/api/paas/v4/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (response.ok) return { valid: true, message: 'API key is valid' };
  if (response.status === 401) return { valid: false, message: 'Invalid API key' };
  return { valid: false, message: `API error: ${response.status}` };
}

private async testMoonshotKey(key: string): Promise<{ valid: boolean; message: string }> {
  const response = await fetch('https://api.moonshot.ai/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (response.ok) return { valid: true, message: 'API key is valid' };
  if (response.status === 401) return { valid: false, message: 'Invalid API key' };
  return { valid: false, message: `API error: ${response.status}` };
}
```

**Files to Modify:**
- `apps/server/src/services/api-key-service.ts`

**Skills:** `synthesis-architecture`, `backend-development`

**Subagents:** None needed (simple fix)

**MCP Tools:**
- `context7` - Verify OpenAI SDK `/v1/models` endpoint format
- `perplexity` - Research Z.AI and Moonshot API documentation

**Estimated Commits:**
1. `fix(api-keys): add API key testing for Zhipu and Moonshot providers`

**Verification:**
- [ ] Z.AI "Test" button returns valid/invalid result
- [ ] Moonshot "Test" button returns valid/invalid result
- [ ] `pnpm typecheck` passes

---

### Phase 17C: Database Schema for Custom Providers
**Status:** NOT STARTED

**Goal:** Create `custom_providers` table for storing user-defined LLM endpoints

**Migration: `packages/db/migrations/028_custom_providers.sql`**

```sql
-- Custom LLM Provider Support
-- Phase 17B: Store user-defined OpenAI-compatible endpoints

CREATE TABLE custom_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,           -- Display name (e.g., "Local vLLM")
  base_url TEXT NOT NULL,              -- e.g., "http://localhost:8000/v1"
  encrypted_key TEXT,                  -- Encrypted API key (nullable for no-auth endpoints)
  provider_type TEXT NOT NULL DEFAULT 'openai-compatible',
  max_context_tokens INTEGER DEFAULT 8192,
  supports_vision BOOLEAN DEFAULT false,
  supports_tools BOOLEAN DEFAULT true,
  custom_models TEXT[],                -- Manual model list fallback
  discovered_models TEXT[],            -- Cached auto-discovered models
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update timestamp trigger
CREATE TRIGGER update_custom_providers_updated_at
  BEFORE UPDATE ON custom_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index for name lookups
CREATE INDEX idx_custom_providers_name ON custom_providers(name);
```

**Files to Create:**
- `packages/db/migrations/028_custom_providers.sql`

**Skills:** `saas-backend-stack`, `backend-development`

**Subagents:** None needed (simple migration)

**MCP Tools:** None needed

**Estimated Commits:**
1. `feat(db): add custom_providers table migration`

**Verification:**
- [ ] `pnpm --filter @synthesis/db migrate` succeeds
- [ ] Table exists with correct schema
- [ ] Trigger works (updated_at auto-updates)

---

### Phase 17E: Backend Custom Provider Service
**Status:** NOT STARTED

**Goal:** Create `CustomProviderService` with CRUD, encryption, testing, and model discovery

**New File: `apps/server/src/services/custom-provider-service.ts`**

```typescript
interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  hasApiKey: boolean;
  providerType: string;
  maxContextTokens: number;
  supportsVision: boolean;
  supportsTools: boolean;
  customModels: string[];
  discoveredModels: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface CreateCustomProviderInput {
  name: string;
  baseUrl: string;
  apiKey?: string;
  maxContextTokens?: number;
  supportsVision?: boolean;
  supportsTools?: boolean;
  customModels?: string[];
}

class CustomProviderService {
  constructor(private db: Pool) {}

  // CRUD
  async list(): Promise<CustomProvider[]>
  async get(id: string): Promise<CustomProvider | null>
  async getByName(name: string): Promise<CustomProvider | null>
  async create(input: CreateCustomProviderInput): Promise<CustomProvider>
  async update(id: string, updates: Partial<CreateCustomProviderInput>): Promise<CustomProvider>
  async delete(id: string): Promise<void>

  // API Key (uses same encryption as ApiKeyService)
  async getApiKey(id: string): Promise<string | null>

  // Testing & Discovery
  async testConnection(baseUrl: string, apiKey?: string): Promise<{
    valid: boolean;
    models?: string[];
    error?: string;
  }>
  async discoverModels(id: string): Promise<string[]>
  async refreshDiscoveredModels(id: string): Promise<string[]>
}
```

**Key Implementation Details:**
- Reuse `encryptKey()` and `decryptKey()` from `api-key-service.ts`
- Model discovery: `GET {baseUrl}/models` with `Authorization: Bearer {apiKey}`
- Parse OpenAI format: `{ data: [{ id: "model-name" }] }`
- **Timeout: 5-10 seconds** for connection test and model discovery (local servers like LMStudio may be offline - don't hang the UI)
- Error handling: Network errors, auth failures, invalid responses, timeouts

**Files to Create:**
- `apps/server/src/services/custom-provider-service.ts`

**Files to Modify:**
- `apps/server/src/services/api-key-service.ts` - Export encryption helpers

**Skills:** `synthesis-architecture`, `backend-development`, `saas-backend-stack`

**Subagents (parallel, up to 3):**
1. `Explore` - Find encryption patterns in api-key-service.ts
2. `Explore` - Find service singleton patterns in codebase
3. `context7-docs-fetcher` - OpenAI SDK /v1/models response format

**MCP Tools:**
- `context7` - OpenAI Node SDK documentation for models endpoint
- `perplexity` - Research vLLM, LMStudio model discovery APIs

**Estimated Commits:**
1. `feat(server): add CustomProviderService with CRUD and model discovery`

**Verification:**
- [ ] Service instantiates correctly
- [ ] CRUD operations work
- [ ] API key encryption/decryption works
- [ ] Model discovery parses OpenAI format
- [ ] `pnpm typecheck` passes

---

### Phase 17E: Backend Custom Provider Routes
**Status:** NOT STARTED

**Goal:** Create REST API routes for custom provider management

**New File: `apps/server/src/routes/admin/custom-providers.ts`**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/custom-providers` | List all custom providers |
| POST | `/api/admin/custom-providers` | Create new custom provider |
| GET | `/api/admin/custom-providers/:id` | Get single provider |
| PATCH | `/api/admin/custom-providers/:id` | Update provider |
| DELETE | `/api/admin/custom-providers/:id` | Delete provider |
| POST | `/api/admin/custom-providers/:id/test` | Test existing provider connection |
| GET | `/api/admin/custom-providers/:id/models` | Get/refresh discovered models |
| POST | `/api/admin/custom-providers/test-connection` | Test connection before saving |

**Request/Response Examples:**

```typescript
// POST /api/admin/custom-providers
{
  name: "Local vLLM",
  baseUrl: "http://localhost:8000/v1",
  apiKey: "sk-...",  // Optional
  maxContextTokens: 8192,
  supportsVision: false,
  supportsTools: true,
  customModels: ["llama-3-70b", "mistral-7b"]  // Optional fallback
}

// Response
{
  id: "uuid",
  name: "Local vLLM",
  baseUrl: "http://localhost:8000/v1",
  hasApiKey: true,
  providerType: "openai-compatible",
  maxContextTokens: 8192,
  supportsVision: false,
  supportsTools: true,
  customModels: ["llama-3-70b", "mistral-7b"],
  discoveredModels: ["llama-3-70b-instruct", "mistral-7b-instruct"],
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z"
}

// POST /api/admin/custom-providers/test-connection
{
  baseUrl: "http://localhost:8000/v1",
  apiKey: "sk-..."  // Optional
}

// Response
{
  valid: true,
  models: ["llama-3-70b-instruct", "mistral-7b-instruct"],
  message: "Connection successful"
}
```

**Files to Create:**
- `apps/server/src/routes/admin/custom-providers.ts`

**Files to Modify:**
- `apps/server/src/routes/admin/index.ts` - Register routes

**Skills:** `synthesis-architecture`, `backend-development`

**Subagents (parallel, up to 2):**
1. `Explore` - Find route patterns in existing admin routes
2. `code-reviewer` - Review after implementation

**MCP Tools:** None needed

**Estimated Commits:**
1. `feat(server): add custom-providers admin routes`

**Verification:**
- [ ] All endpoints respond correctly
- [ ] Input validation works
- [ ] Error handling returns proper status codes
- [ ] `pnpm typecheck` passes

---

### Phase 17F: Integrate Custom Providers into Chat System
**Status:** NOT STARTED

**Goal:** Wire custom providers into the ChatProvider factory for actual chat usage

**Critical Issue:** The current `OpenAICompatibleProvider` fetches API keys internally via `getProviderApiKey()`, which looks up the `provider_api_keys` table by provider name. A custom provider UUID won't be found there.

**Solution:** Add optional `apiKey` field to `OpenAICompatibleConfig` to pass keys directly.

**Modifications:**

1. **Update OpenAICompatibleConfig** (`apps/server/src/services/chat-providers/openai-compatible.ts`):
```typescript
export interface OpenAICompatibleConfig {
  providerName: ChatProviderType;
  baseURL: string;
  apiKeyProvider: string;
  maxContextTokens: number;
  supportsVision: boolean;
  apiKey?: string;  // NEW: Direct API key (bypasses getProviderApiKey lookup)
}
```

2. **Update OpenAICompatibleProvider.streamChat** (same file):
```typescript
async *streamChat(params: ChatParams): AsyncGenerator<ChatStreamChunk, void, unknown> {
  // Use direct apiKey if provided, otherwise lookup by provider name
  const apiKey = this.config.apiKey ?? await getProviderApiKey(this.db, this.config.apiKeyProvider);
  if (!apiKey) {
    throw new Error(
      `${this.config.providerName} API key not configured. ` +
        'Please set the API key in Settings > API Keys or via environment variable.'
    );
  }
  // ... rest unchanged
}
```

3. **Chat Provider Factory** (`apps/server/src/services/chat-providers/index.ts`):
```typescript
// Add function to get custom provider as ChatProvider
export async function getCustomChatProvider(
  db: Pool,
  context: ToolContext,
  customProviderId: string
): Promise<ChatProvider> {
  const service = getCustomProviderService(db);
  const provider = await service.get(customProviderId);
  if (!provider) throw new Error(`Custom provider not found: ${customProviderId}`);

  // Get decrypted API key from custom_providers table
  const apiKey = await service.getApiKey(customProviderId);

  return new OpenAICompatibleProvider(db, context, {
    providerName: `custom:${provider.id}` as ChatProviderType,
    baseURL: provider.baseUrl,
    apiKeyProvider: customProviderId,  // For error messages
    apiKey: apiKey ?? undefined,       // Pass directly (bypasses lookup)
    maxContextTokens: provider.maxContextTokens,
    supportsVision: provider.supportsVision,
  });
}

// Modify getConfiguredChatProviderWithOverride to handle custom:uuid format
export async function getConfiguredChatProviderWithOverride(
  db: Pool,
  context: ToolContext,
  providerOverride?: string
): Promise<ChatProvider> {
  if (providerOverride?.startsWith('custom:')) {
    const customId = providerOverride.replace('custom:', '');
    return getCustomChatProvider(db, context, customId);
  }
  // ... existing logic
}
```

2. **Shared Types** (`packages/shared/src/index.ts`):
```typescript
// Add CustomProvider types
export interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  hasApiKey: boolean;
  providerType: string;
  maxContextTokens: number;
  supportsVision: boolean;
  supportsTools: boolean;
  customModels: string[];
  discoveredModels: string[];
}

export interface CreateCustomProviderInput {
  name: string;
  baseUrl: string;
  apiKey?: string;
  maxContextTokens?: number;
  supportsVision?: boolean;
  supportsTools?: boolean;
  customModels?: string[];
}

export interface TestConnectionResult {
  valid: boolean;
  models?: string[];
  error?: string;
}
```

**Files to Modify:**
- `apps/server/src/services/chat-providers/index.ts`
- `apps/server/src/services/chat-providers/openai-compatible.ts` (minor: handle custom apiKeyProvider)
- `packages/shared/src/index.ts`

**Skills:** `synthesis-architecture`, `llm-provider-integration`

**Subagents (parallel, up to 3):**
1. `Explore` - Find ChatProvider factory patterns
2. `Explore` - Find how provider override works in chat routes
3. `code-reviewer` - Review after implementation

**MCP Tools:**
- `context7` - OpenAI SDK patterns for custom baseURL

**Estimated Commits:**
1. `feat(shared): add CustomProvider types`
2. `feat(server): integrate custom providers into chat provider factory`

**Verification:**
- [ ] Custom provider resolves correctly in factory
- [ ] Chat works with custom provider
- [ ] Tool calling works (uses OpenAICompatibleProvider)
- [ ] `pnpm typecheck` passes

---

### Phase 17G: Frontend API Client & Hooks
**Status:** NOT STARTED

**Goal:** Add React Query hooks and API client methods for custom providers

**New File: `apps/web/src/hooks/useCustomProviders.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export function useCustomProviders() {
  return useQuery({
    queryKey: ['custom-providers'],
    queryFn: () => apiClient.listCustomProviders(),
    staleTime: 60 * 1000,
  });
}

export function useCustomProvider(id: string) {
  return useQuery({
    queryKey: ['custom-providers', id],
    queryFn: () => apiClient.getCustomProvider(id),
    enabled: !!id,
  });
}

export function useCreateCustomProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCustomProviderInput) => apiClient.createCustomProvider(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-providers'] }),
  });
}

export function useUpdateCustomProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateCustomProviderInput> }) =>
      apiClient.updateCustomProvider(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-providers'] }),
  });
}

export function useDeleteCustomProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteCustomProvider(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-providers'] }),
  });
}

export function useTestCustomProviderConnection() {
  return useMutation({
    mutationFn: (data: { baseUrl: string; apiKey?: string }) =>
      apiClient.testCustomProviderConnection(data.baseUrl, data.apiKey),
  });
}

export function useDiscoverCustomProviderModels(id: string) {
  return useQuery({
    queryKey: ['custom-providers', id, 'models'],
    queryFn: () => apiClient.discoverCustomProviderModels(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

**API Client Methods** (`apps/web/src/lib/api.ts`):

```typescript
// Custom Provider Methods
async listCustomProviders(): Promise<CustomProvider[]> {
  return this.request<CustomProvider[]>('/api/admin/custom-providers');
}

async getCustomProvider(id: string): Promise<CustomProvider> {
  return this.request<CustomProvider>(`/api/admin/custom-providers/${encodeURIComponent(id)}`);
}

async createCustomProvider(data: CreateCustomProviderInput): Promise<CustomProvider> {
  return this.request<CustomProvider>('/api/admin/custom-providers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async updateCustomProvider(id: string, data: Partial<CreateCustomProviderInput>): Promise<CustomProvider> {
  return this.request<CustomProvider>(`/api/admin/custom-providers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

async deleteCustomProvider(id: string): Promise<void> {
  return this.request<void>(`/api/admin/custom-providers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

async testCustomProviderConnection(baseUrl: string, apiKey?: string): Promise<TestConnectionResult> {
  return this.request<TestConnectionResult>('/api/admin/custom-providers/test-connection', {
    method: 'POST',
    body: JSON.stringify({ baseUrl, apiKey }),
  });
}

async discoverCustomProviderModels(id: string): Promise<string[]> {
  const response = await this.request<{ models: string[] }>(
    `/api/admin/custom-providers/${encodeURIComponent(id)}/models`
  );
  return response.models;
}
```

**Files to Create:**
- `apps/web/src/hooks/useCustomProviders.ts`

**Files to Modify:**
- `apps/web/src/lib/api.ts`
- `apps/web/src/types/index.ts` (add CustomProvider types)

**Skills:** `frontend-design`, `saas-backend-stack`

**Subagents (parallel, up to 2):**
1. `Explore` - Find existing hook patterns in useModelConfig.ts
2. `Explore` - Find API client patterns

**MCP Tools:** None needed

**Estimated Commits:**
1. `feat(web): add custom provider API client and hooks`

**Verification:**
- [ ] Hooks compile without errors
- [ ] API client methods match backend routes
- [ ] `pnpm typecheck` passes

---

### Phase 17H: Frontend Custom Provider Form Component
**Status:** NOT STARTED

**Goal:** Create modal form for adding/editing custom providers

**New File: `apps/web/src/components/settings/CustomProviderForm.tsx`**

**Features:**
- Name input (required)
- Base URL input (required, with validation)
  - **Must allow:** `http://localhost:*`, `http://127.0.0.1:*`, `https://*`
  - Primary use case is local inference (vLLM, Ollama, LMStudio)
- API Key input (optional, password type)
- Max Context Tokens input (number, default 8192)
- Supports Vision checkbox
- Supports Tools checkbox (default true)
- Custom Models textarea (comma-separated, fallback)
- "Test Connection" button:
  - Shows loading spinner during test
  - On success: Shows discovered models in list
  - On failure: Shows error message, enables manual model entry
- Save/Cancel buttons

**UI States:**
1. **Empty**: Initial state, waiting for user input
2. **Testing**: Connection test in progress
3. **Success**: Shows discovered models, ready to save
4. **Failed**: Shows error, allows manual model entry
5. **Saving**: Save in progress

**Files to Create:**
- `apps/web/src/components/settings/CustomProviderForm.tsx`

**Skills:** `frontend-design`, `professional-frontend-stack`

**Subagents (parallel, up to 3):**
1. `Explore` - Find modal patterns in codebase
2. `Explore` - Find form validation patterns
3. `frontend-ui-architect` - Design form layout

**MCP Tools:** None needed

**Estimated Commits:**
1. `feat(web): add CustomProviderForm component`

**Verification:**
- [ ] Form renders correctly
- [ ] Validation works
- [ ] Test connection shows results
- [ ] Manual model fallback works
- [ ] `pnpm typecheck` passes

---

### Phase 17I: Settings UI Integration
**Status:** NOT STARTED

**Goal:** Add "Custom Providers" section to ModelsPage

**Modifications to `apps/web/src/pages/settings/ModelsPage.tsx`:**

1. Add "Custom Providers" section header after API Keys
2. "Add Custom Provider" button
3. List of existing custom providers as cards:
   - Provider name + base URL
   - Model count badge
   - Edit / Delete buttons
4. Modal integration for CustomProviderForm

**UI Layout:**
```
Settings > Models
├── LLM Features (Chat, Summary, OCR)
├── Embedding Features
├── API Keys
│   ├── [existing providers]
│   └── Test buttons (now working for Z.AI & Moonshot)
├── Custom Providers  <-- NEW
│   ├── [Add Custom Provider] button
│   ├── Custom Provider Card 1
│   ├── Custom Provider Card 2
│   └── ...
└── Reset to Defaults
```

**Files to Modify:**
- `apps/web/src/pages/settings/ModelsPage.tsx`

**Skills:** `frontend-design`, `synthesis-architecture`

**Subagents (parallel, up to 2):**
1. `Explore` - Find card component patterns
2. `code-reviewer` - Review after implementation

**MCP Tools:** None needed

**Estimated Commits:**
1. `feat(web): add Custom Providers section to ModelsPage`

**Verification:**
- [ ] Section renders correctly
- [ ] Add button opens form modal
- [ ] Provider cards display correctly
- [ ] Edit/Delete work
- [ ] `pnpm typecheck` passes

---

### Phase 17J: Chat Model Selector Integration
**Status:** NOT STARTED

**Goal:** Add custom providers to ChatModelSelector dropdown

**Modifications to `apps/web/src/components/ChatModelSelector.tsx`:**

1. Fetch custom providers with `useCustomProviders()`
2. Add custom provider groups after built-in providers:

```typescript
// Add to modelGroups useMemo:
const { data: customProviders } = useCustomProviders();

// After existing provider groups:
if (customProviders) {
  for (const provider of customProviders) {
    const models = provider.discoveredModels?.length > 0
      ? provider.discoveredModels
      : provider.customModels || [];

    if (models.length > 0) {
      groups.push({
        provider: `custom:${provider.id}`,
        displayName: provider.name,
        models,
      });
    }
  }
}
```

3. Handle selection: Pass `custom:uuid` format to backend

**Files to Modify:**
- `apps/web/src/components/ChatModelSelector.tsx`

**Skills:** `frontend-design`, `synthesis-architecture`

**Subagents:**
1. `code-reviewer` - Review after implementation

**MCP Tools:** None needed

**Estimated Commits:**
1. `feat(web): integrate custom providers into ChatModelSelector`

**Verification:**
- [ ] Custom providers appear in dropdown
- [ ] Selection works
- [ ] Chat functions with custom provider
- [ ] Tool calling works
- [ ] `pnpm typecheck` passes

---

## Parallel Execution Plan

### Wave 1: Foundation (3 tasks in parallel)
| Task | Subagent/Skill | Dependencies |
|------|----------------|--------------|
| Phase 17A: Fix API Testing | None (simple) | None |
| Phase 17B: Database Migration | None (simple) | None |
| Research: OpenAI /v1/models format | `context7` MCP | None |

### Wave 2: Backend Core (3 tasks in parallel)
| Task | Subagent/Skill | Dependencies |
|------|----------------|--------------|
| Phase 17C: CustomProviderService | `Explore` x2, `backend-development` | 17B |
| Phase 17D: Routes (can start outline) | `Explore`, `synthesis-architecture` | 17B |
| Shared Types | None | None |

### Wave 3: Backend Complete + Frontend Start (4 tasks in parallel)
| Task | Subagent/Skill | Dependencies |
|------|----------------|--------------|
| Phase 17D: Routes (complete) | `code-reviewer` | 17C |
| Phase 17E: Chat Integration | `Explore` x2, `llm-provider-integration` | 17C, 17D |
| Phase 17F: API Client & Hooks | `Explore` x2, `frontend-design` | 17D (routes defined) |
| Frontend Types | None | Shared Types |

### Wave 4: Frontend UI (3 tasks in parallel)
| Task | Subagent/Skill | Dependencies |
|------|----------------|--------------|
| Phase 17G: CustomProviderForm | `Explore` x2, `frontend-ui-architect` | 17F |
| Phase 17H: ModelsPage Integration | `Explore`, `frontend-design` | 17F, 17G |
| Phase 17I: ChatModelSelector | `frontend-design` | 17F |

### Wave 5: Review & Testing (2 tasks in parallel)
| Task | Subagent/Skill | Dependencies |
|------|----------------|--------------|
| Code Review | `code-reviewer` | All phases |
| Integration Testing | `test-writer` | All phases |

---

## GitHub Workflow

### Branch Strategy
- **Base branch:** `develop`
- **Feature branch:** `feature/custom-llm-providers` (already created)

### IMPORTANT: No Committing or Pushing Without User Permission

**Before ANY commit:**
1. Show the user the changes to be committed
2. Wait for explicit approval
3. Only then run `git commit`

**Before ANY push:**
1. Show the user the commits to be pushed
2. Wait for explicit approval
3. Only then run `git push`

### Commit Strategy (atomic, logical units)

| Phase | Commit Message |
|-------|---------------|
| 17A | `fix(api-keys): add API key testing for Zhipu and Moonshot providers` |
| 17B | `feat(db): add custom_providers table migration` |
| 17C | `feat(server): add CustomProviderService with CRUD and model discovery` |
| 17D | `feat(server): add custom-providers admin routes` |
| 17E.1 | `feat(shared): add CustomProvider types` |
| 17E.2 | `feat(server): integrate custom providers into chat provider factory` |
| 17F | `feat(web): add custom provider API client and hooks` |
| 17G | `feat(web): add CustomProviderForm component` |
| 17H | `feat(web): add Custom Providers section to ModelsPage` |
| 17I | `feat(web): integrate custom providers into ChatModelSelector` |

### PR Strategy
- **Single PR** for all Phase 17 changes
- **Title:** `feat: add custom OpenAI-compatible LLM provider support`
- **Target:** `develop`
- **Description:** Include overview, screenshots, testing notes

---

## Testing Checklist

### API Key Testing (17A)
- [ ] Z.AI "Test" button returns valid/invalid result
- [ ] Moonshot "Test" button returns valid/invalid result

### Custom Providers (17B-17I)
- [ ] Can create custom provider with URL + API key
- [ ] Can create custom provider without API key (local)
- [ ] Connection test works (shows discovered models)
- [ ] Connection test failure allows manual model entry
- [ ] Custom provider appears in Settings list
- [ ] Can edit custom provider
- [ ] Can delete custom provider
- [ ] Custom provider appears in ChatModelSelector
- [ ] Can chat using custom provider
- [ ] Tool calling works with custom provider

### General
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (no new failures)

---

## MCP Servers & Tools to Use

| Tool | Purpose |
|------|---------|
| `context7` | OpenAI SDK docs for /v1/models, custom baseURL patterns |
| `perplexity` | Research provider APIs (vLLM, LMStudio, OpenRouter, Groq) |
| `mcp__ide__getDiagnostics` | TypeScript errors during implementation |

---

## Skills Reference

| Skill | Used In |
|-------|---------|
| `synthesis-architecture` | 17A, 17C, 17D, 17E, 17H, 17I |
| `backend-development` | 17A, 17B, 17C, 17D |
| `saas-backend-stack` | 17B, 17C, 17F |
| `llm-provider-integration` | 17E |
| `frontend-design` | 17F, 17G, 17H, 17I |
| `professional-frontend-stack` | 17G |

---

## Subagents Reference

| Subagent | Used In |
|----------|---------|
| `Explore` | 17C, 17D, 17E, 17F, 17G, 17H |
| `code-reviewer` | 17D, 17H, 17I, Wave 5 |
| `frontend-ui-architect` | 17G |
| `test-writer` | Wave 5 |
| `context7-docs-fetcher` | 17C (OpenAI SDK) |

---

## Reference Links

- OpenAI /v1/models endpoint: https://platform.openai.com/docs/api-reference/models/list
- vLLM OpenAI-compatible server: https://docs.vllm.ai/en/latest/serving/openai_compatible_server/
- LMStudio OpenAI compatibility: https://lmstudio.ai/docs/api/openai-api
- OpenRouter API: https://openrouter.ai/docs
- Existing OpenAICompatibleProvider: `apps/server/src/services/chat-providers/openai-compatible.ts`
- ApiKeyService: `apps/server/src/services/api-key-service.ts`
- ChatModelSelector: `apps/web/src/components/ChatModelSelector.tsx`
- ModelsPage: `apps/web/src/pages/settings/ModelsPage.tsx`

---

## Notes

### Security Considerations
- API keys encrypted with AES-256-GCM (same as existing provider keys)
- Never return raw API keys to frontend (only `hasApiKey: boolean`)
- Validate base URLs (allow localhost, HTTPS, custom domains)

### Backward Compatibility
- Existing providers unchanged
- Custom providers use separate table
- `custom:uuid` format distinguishes from built-in providers

### Known Limitations (For Future Debugging)
- **System messages:** Some providers (O1 models, certain local models) may not support `system` role messages. The `OpenAICompatibleProvider` currently assumes system message support. If a user adds a quirky local provider that fails, this is a likely cause.

### Future Enhancements (Out of Scope)
- Provider health monitoring
- Usage tracking per custom provider
- Import/export provider configs
- Provider templates (one-click vLLM, LMStudio setup)
