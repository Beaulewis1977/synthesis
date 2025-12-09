# Phase 17G: Frontend API Client & Hooks

## Goal

Add React Query hooks and API client methods for custom providers.

---

## Files to Create

| File | Description |
|------|-------------|
| `apps/web/src/hooks/useCustomProviders.ts` | React Query hooks |

## Files to Modify

| File | Changes |
|------|---------|
| `apps/web/src/lib/api.ts` | Add API client methods |
| `apps/web/src/types/index.ts` | Add CustomProvider types (if not using shared) |

---

## Implementation Details

### React Query Hooks

**File:** `apps/web/src/hooks/useCustomProviders.ts`

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { CreateCustomProviderInput, CustomProvider, TestConnectionResult } from '@synthesis/shared';

export function useCustomProviders() {
  return useQuery({
    queryKey: ['custom-providers'],
    queryFn: () => apiClient.listCustomProviders(),
    staleTime: 60 * 1000, // 1 minute
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

export function useTestExistingCustomProvider() {
  return useMutation({
    mutationFn: (id: string) => apiClient.testExistingCustomProvider(id),
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

### API Client Methods

**File:** `apps/web/src/lib/api.ts`

```typescript
// Add to ApiClient class:

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

async testExistingCustomProvider(id: string): Promise<TestConnectionResult> {
  return this.request<TestConnectionResult>(`/api/admin/custom-providers/${encodeURIComponent(id)}/test`, {
    method: 'POST',
  });
}

async discoverCustomProviderModels(id: string): Promise<string[]> {
  const response = await this.request<{ models: string[] }>(
    `/api/admin/custom-providers/${encodeURIComponent(id)}/models`
  );
  return response.models;
}
```

---

## Skills

- `frontend-design`
- `saas-backend-stack`

## Subagents (parallel, up to 2)

1. `Explore` - Find existing hook patterns in useModelConfig.ts
2. `Explore` - Find API client patterns

## MCP Tools

None needed

---

## Commit Message

```
feat(web): add custom provider API client and hooks
```

---

## Verification Checklist

- [ ] Hooks file created: `useCustomProviders.ts`
- [ ] API client methods added to `api.ts`
- [ ] Frontend types added (if needed)
- [ ] Hooks compile without errors
- [ ] API client methods match backend routes
- [ ] `pnpm typecheck` passes
