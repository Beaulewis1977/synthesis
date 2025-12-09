# Phase 17D: Backend CustomProviderService

## Goal

Create `CustomProviderService` with CRUD operations, API key encryption, connection testing, and model discovery.

---

## Files to Create

| File | Description |
|------|-------------|
| `apps/server/src/services/custom-provider-service.ts` | Service class |

## Files to Modify

| File | Changes |
|------|---------|
| `apps/server/src/services/api-key-service.ts` | Export encryption helpers |

---

## Implementation Details

### Interface Definitions

```typescript
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
  createdAt: Date;
  updatedAt: Date;
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

### Service Class

```typescript
class CustomProviderService {
  constructor(private db: Pool) {}

  // CRUD Operations
  async list(): Promise<CustomProvider[]>
  async get(id: string): Promise<CustomProvider | null>
  async getByName(name: string): Promise<CustomProvider | null>
  async create(input: CreateCustomProviderInput): Promise<CustomProvider>
  async update(id: string, updates: Partial<CreateCustomProviderInput>): Promise<CustomProvider>
  async delete(id: string): Promise<void>

  // API Key (reuses encryption from ApiKeyService)
  async getApiKey(id: string): Promise<string | null>

  // Testing & Discovery
  async testConnection(baseUrl: string, apiKey?: string): Promise<TestConnectionResult>
  async discoverModels(id: string): Promise<string[]>
  async refreshDiscoveredModels(id: string): Promise<string[]>
}

// Singleton pattern
let instance: CustomProviderService | null = null;
export function getCustomProviderService(db: Pool): CustomProviderService {
  if (!instance) {
    instance = new CustomProviderService(db);
  }
  return instance;
}
```

### Key Implementation Notes

1. **Encryption:** Reuse `encryptKey()` and `decryptKey()` from `api-key-service.ts`

2. **Model Discovery:**
   ```typescript
   async testConnection(baseUrl: string, apiKey?: string): Promise<TestConnectionResult> {
     const controller = new AbortController();
     const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

     try {
       const response = await fetch(`${baseUrl}/models`, {
         headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
         signal: controller.signal,
       });
       clearTimeout(timeoutId);

       if (!response.ok) {
         return { valid: false, error: `HTTP ${response.status}` };
       }

       const data = await response.json();
       // Parse OpenAI format: { data: [{ id: "model-name" }] }
       const models = data.data?.map((m: { id: string }) => m.id) || [];
       return { valid: true, models };
     } catch (error) {
       clearTimeout(timeoutId);
       if (error instanceof Error && error.name === 'AbortError') {
         return { valid: false, error: 'Connection timeout (10s)' };
       }
       return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
     }
   }
   ```

3. **Timeout:** 5-10 seconds for connection test (local servers may be offline)

---

## Skills

- `synthesis-architecture`
- `backend-development`
- `saas-backend-stack`

## Subagents (parallel, up to 3)

1. `Explore` - Find encryption patterns in api-key-service.ts
2. `Explore` - Find service singleton patterns in codebase
3. `context7-docs-fetcher` - OpenAI SDK /v1/models response format

## MCP Tools

- `context7` - OpenAI Node SDK documentation for models endpoint
- `perplexity` - Research vLLM, LMStudio model discovery APIs

---

## Commit Message

```
feat(server): add CustomProviderService with CRUD and model discovery
```

---

## Verification Checklist

- [x] Service file created: `custom-provider-service.ts`
- [x] Encryption module created: `encryption.ts`
- [x] ApiKeyService updated to use shared encryption
- [x] Service instantiates correctly (singleton pattern with getter)
- [x] CRUD operations work (list, get, getByName, create, update, delete)
- [x] API key encryption/decryption works (AES-256-GCM with HKDF)
- [x] Model discovery parses OpenAI format correctly
- [x] Connection test has 10s timeout (using AbortController)
- [x] `pnpm typecheck` passes (no errors in our implementation)
