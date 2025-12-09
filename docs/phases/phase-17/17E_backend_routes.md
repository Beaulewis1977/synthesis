# Phase 17E: Backend Custom Provider Routes

## Goal

Create REST API routes for custom provider management.

---

## Files to Create

| File | Description |
|------|-------------|
| `apps/server/src/routes/admin/custom-providers.ts` | Route handlers |

## Files to Modify

| File | Changes |
|------|---------|
| `apps/server/src/routes/admin/index.ts` | Register routes |

---

## API Endpoints

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

---

## Implementation Details

### Request/Response Examples

**POST /api/admin/custom-providers**
```json
// Request
{
  "name": "Local vLLM",
  "baseUrl": "http://localhost:8000/v1",
  "apiKey": "sk-...",
  "maxContextTokens": 8192,
  "supportsVision": false,
  "supportsTools": true,
  "customModels": ["llama-3-70b", "mistral-7b"]
}

// Response
{
  "id": "uuid",
  "name": "Local vLLM",
  "baseUrl": "http://localhost:8000/v1",
  "hasApiKey": true,
  "providerType": "openai-compatible",
  "maxContextTokens": 8192,
  "supportsVision": false,
  "supportsTools": true,
  "customModels": ["llama-3-70b", "mistral-7b"],
  "discoveredModels": ["llama-3-70b-instruct", "mistral-7b-instruct"],
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:00Z"
}
```

**POST /api/admin/custom-providers/test-connection**
```json
// Request
{
  "baseUrl": "http://localhost:8000/v1",
  "apiKey": "sk-..."
}

// Response
{
  "valid": true,
  "models": ["llama-3-70b-instruct", "mistral-7b-instruct"],
  "message": "Connection successful"
}
```

### Route Structure

```typescript
import { FastifyPluginAsync } from 'fastify';
import { Pool } from 'pg';
import { getCustomProviderService } from '../../services/custom-provider-service.js';

export const customProvidersRoutes: FastifyPluginAsync<{ db: Pool }> = async (fastify, { db }) => {
  const service = getCustomProviderService(db);

  // List all providers
  fastify.get('/', async () => {
    return service.list();
  });

  // Create provider
  fastify.post('/', async (request) => {
    const input = request.body as CreateCustomProviderInput;
    return service.create(input);
  });

  // Get single provider
  fastify.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const provider = await service.get(id);
    if (!provider) {
      throw { statusCode: 404, message: 'Provider not found' };
    }
    return provider;
  });

  // Update provider
  fastify.patch('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const updates = request.body as Partial<CreateCustomProviderInput>;
    return service.update(id, updates);
  });

  // Delete provider
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await service.delete(id);
    return reply.status(204).send();
  });

  // Test existing provider
  fastify.post('/:id/test', async (request) => {
    const { id } = request.params as { id: string };
    const provider = await service.get(id);
    if (!provider) {
      throw { statusCode: 404, message: 'Provider not found' };
    }
    const apiKey = await service.getApiKey(id);
    return service.testConnection(provider.baseUrl, apiKey ?? undefined);
  });

  // Discover/refresh models
  fastify.get('/:id/models', async (request) => {
    const { id } = request.params as { id: string };
    const models = await service.refreshDiscoveredModels(id);
    return { models };
  });

  // Test connection (before saving)
  fastify.post('/test-connection', async (request) => {
    const { baseUrl, apiKey } = request.body as { baseUrl: string; apiKey?: string };
    return service.testConnection(baseUrl, apiKey);
  });
};
```

### Register Routes

**File:** `apps/server/src/routes/admin/index.ts`

```typescript
import { customProvidersRoutes } from './custom-providers.js';

// Add to admin routes registration:
await fastify.register(customProvidersRoutes, { prefix: '/custom-providers', db });
```

---

## Skills

- `synthesis-architecture`
- `backend-development`

## Subagents (parallel, up to 2)

1. `Explore` - Find route patterns in existing admin routes
2. `code-reviewer` - Review after implementation

## MCP Tools

None needed

---

## Commit Message

```
feat(server): add custom-providers admin routes
```

---

## Verification Checklist

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
