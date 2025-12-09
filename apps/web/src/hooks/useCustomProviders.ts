/**
 * React Query hooks for Custom Providers
 *
 * Phase 17G: Provides data fetching and mutations for custom LLM providers.
 */

import type {
  CreateCustomProviderInput,
  CustomProvider,
  TestConnectionResult,
} from '@synthesis/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

// Query keys for cache management
export const customProviderKeys = {
  all: ['custom-providers'] as const,
  detail: (id: string) => ['custom-providers', id] as const,
  models: (id: string) => ['custom-providers', id, 'models'] as const,
};

/**
 * Hook to fetch all custom providers
 */
export function useCustomProviders() {
  return useQuery<CustomProvider[]>({
    queryKey: customProviderKeys.all,
    queryFn: () => apiClient.listCustomProviders(),
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to fetch a single custom provider by ID
 */
export function useCustomProvider(id: string) {
  return useQuery<CustomProvider>({
    queryKey: customProviderKeys.detail(id),
    queryFn: () => apiClient.getCustomProvider(id),
    enabled: !!id,
  });
}

/**
 * Hook to create a new custom provider
 */
export function useCreateCustomProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCustomProviderInput) => apiClient.createCustomProvider(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customProviderKeys.all });
    },
  });
}

/**
 * Hook to update an existing custom provider
 */
export function useUpdateCustomProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateCustomProviderInput> }) =>
      apiClient.updateCustomProvider(id, data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: customProviderKeys.all });
      queryClient.invalidateQueries({ queryKey: customProviderKeys.detail(id) });
    },
  });
}

/**
 * Hook to delete a custom provider
 */
export function useDeleteCustomProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteCustomProvider(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: customProviderKeys.all });
      queryClient.invalidateQueries({ queryKey: customProviderKeys.detail(id) });
    },
  });
}

/**
 * Hook to test connection before saving (baseUrl + optional apiKey)
 */
export function useTestCustomProviderConnection() {
  return useMutation<TestConnectionResult, Error, { baseUrl: string; apiKey?: string }>({
    mutationFn: (data) => apiClient.testCustomProviderConnection(data.baseUrl, data.apiKey),
  });
}

/**
 * Hook to test an existing saved provider's connection
 */
export function useTestExistingCustomProvider() {
  return useMutation<TestConnectionResult, Error, string>({
    mutationFn: (id) => apiClient.testExistingCustomProvider(id),
  });
}

/**
 * Hook to discover/refresh models for an existing provider
 */
export function useDiscoverCustomProviderModels(id: string) {
  return useQuery<string[]>({
    queryKey: customProviderKeys.models(id),
    queryFn: () => apiClient.discoverCustomProviderModels(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes (models change infrequently)
  });
}
