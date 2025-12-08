# Phase 17F: Integrate Custom Providers into Chat System

## Goal

Wire custom providers into the ChatProvider factory for actual chat usage.

---

## Critical Issue

The current `OpenAICompatibleProvider` fetches API keys internally via `getProviderApiKey()`, which looks up the `provider_api_keys` table by provider name. A custom provider UUID won't be found there.

**Solution:** Add optional `apiKey` field to `OpenAICompatibleConfig` to pass keys directly.

---

## Files to Modify

| File | Changes |
|------|---------|
| `apps/server/src/services/chat-providers/openai-compatible.ts` | Add optional `apiKey` field |
| `apps/server/src/services/chat-providers/index.ts` | Add custom provider factory |
| `packages/shared/src/index.ts` | Add CustomProvider types |

---

## Implementation Details

### 1. Update OpenAICompatibleConfig

**File:** `apps/server/src/services/chat-providers/openai-compatible.ts`

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

### 2. Update streamChat Method

**File:** `apps/server/src/services/chat-providers/openai-compatible.ts`

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

### 3. Add Custom Provider Factory

**File:** `apps/server/src/services/chat-providers/index.ts`

```typescript
import { getCustomProviderService } from '../custom-provider-service.js';

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

### 4. Add Shared Types

**File:** `packages/shared/src/index.ts`

```typescript
// Custom Provider Types
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

---

## Skills

- `synthesis-architecture`
- `llm-provider-integration`

## Subagents (parallel, up to 3)

1. `Explore` - Find ChatProvider factory patterns
2. `Explore` - Find how provider override works in chat routes
3. `code-reviewer` - Review after implementation

## MCP Tools

- `context7` - OpenAI SDK patterns for custom baseURL

---

## Commit Messages

```
feat(shared): add CustomProvider types
```

```
feat(server): integrate custom providers into chat provider factory
```

---

## Verification Checklist

- [ ] `OpenAICompatibleConfig.apiKey` optional field added
- [ ] `OpenAICompatibleProvider.streamChat` uses direct apiKey if provided
- [ ] `getCustomChatProvider()` function added to factory
- [ ] `getConfiguredChatProviderWithOverride()` handles `custom:uuid` format
- [ ] CustomProvider types added to `packages/shared`
- [ ] Custom provider resolves correctly in factory
- [ ] Chat works with custom provider
- [ ] Tool calling works
- [ ] `pnpm typecheck` passes
