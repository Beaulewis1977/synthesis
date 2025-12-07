/**
 * React Query hooks for Model Configuration
 *
 * Phase 6: Provides data fetching and mutations for model configs,
 * embedding profiles, and API key management.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type {
  ApiKeysResponse,
  EmbeddingProfilesResponse,
  ModelConfigResponse,
  ModelConfigUpdate,
  ModelFeature,
} from '../types';

// Query keys for cache management
export const modelConfigKeys = {
  all: ['modelConfigs'] as const,
  feature: (feature: ModelFeature) => ['modelConfigs', feature] as const,
  profiles: ['embeddingProfiles'] as const,
  apiKeys: ['apiKeys'] as const,
};

/**
 * Hook to fetch all model configurations
 */
export function useModelConfigs() {
  return useQuery<ModelConfigResponse>({
    queryKey: modelConfigKeys.all,
    queryFn: () => apiClient.getModelConfigs(),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to fetch a specific feature's configuration
 */
export function useModelConfig(feature: ModelFeature) {
  return useQuery({
    queryKey: modelConfigKeys.feature(feature),
    queryFn: () => apiClient.getModelConfig(feature),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to update a model configuration with optimistic updates
 */
export function useUpdateModelConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ feature, update }: { feature: ModelFeature; update: ModelConfigUpdate }) =>
      apiClient.updateModelConfig(feature, update),

    // Optimistic update
    onMutate: async ({ feature, update }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: modelConfigKeys.all });

      // Snapshot previous value
      const previousConfigs = queryClient.getQueryData<ModelConfigResponse>(modelConfigKeys.all);

      // Optimistically update the cache
      if (previousConfigs) {
        queryClient.setQueryData<ModelConfigResponse>(modelConfigKeys.all, {
          ...previousConfigs,
          configs: previousConfigs.configs.map((config) =>
            config.feature === feature ? { ...config, ...update, source: 'db' as const } : config
          ),
        });
      }

      return { previousConfigs };
    },

    // Rollback on error
    onError: (_err, _variables, context) => {
      if (context?.previousConfigs) {
        queryClient.setQueryData(modelConfigKeys.all, context.previousConfigs);
      }
    },

    // Refetch after success or error
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: modelConfigKeys.all });
    },
  });
}

/**
 * Hook to reset a specific feature to defaults
 */
export function useResetModelConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (feature: ModelFeature) => apiClient.resetModelConfig(feature),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: modelConfigKeys.all });
    },
  });
}

/**
 * Hook to reset all model configurations
 */
export function useResetAllModelConfigs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.resetAllModelConfigs(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: modelConfigKeys.all });
    },
  });
}

/**
 * Hook to validate a configuration
 */
export function useValidateModelConfig() {
  return useMutation({
    mutationFn: ({ feature, update }: { feature: ModelFeature; update: ModelConfigUpdate }) =>
      apiClient.validateModelConfig(feature, update),
  });
}

// ============================================
// Embedding Profiles Hooks
// ============================================

/**
 * Hook to fetch all embedding profiles
 */
export function useEmbeddingProfiles() {
  return useQuery<EmbeddingProfilesResponse>({
    queryKey: modelConfigKeys.profiles,
    queryFn: () => apiClient.getEmbeddingProfiles(),
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to get a collection's embedding profile
 */
export function useCollectionProfile(collectionId: string) {
  return useQuery({
    queryKey: ['collectionProfile', collectionId],
    queryFn: () => apiClient.getCollectionProfile(collectionId),
    enabled: !!collectionId,
  });
}

/**
 * Hook to set a collection's embedding profile
 */
export function useSetCollectionProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ collectionId, profileId }: { collectionId: string; profileId: string | null }) =>
      apiClient.setCollectionProfile(collectionId, profileId),
    onSuccess: (_data, { collectionId }) => {
      queryClient.invalidateQueries({ queryKey: ['collectionProfile', collectionId] });
    },
  });
}

// ============================================
// API Key Management Hooks
// ============================================

/**
 * Hook to fetch API key status for all providers
 */
export function useApiKeyStatus() {
  return useQuery<ApiKeysResponse>({
    queryKey: modelConfigKeys.apiKeys,
    queryFn: () => apiClient.getApiKeyStatus(),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to set an API key
 */
export function useSetApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ provider, apiKey }: { provider: string; apiKey: string }) =>
      apiClient.setApiKey(provider, apiKey),
    onSuccess: () => {
      // Invalidate both API keys and model configs (to update missing keys)
      queryClient.invalidateQueries({ queryKey: modelConfigKeys.apiKeys });
      queryClient.invalidateQueries({ queryKey: modelConfigKeys.all });
    },
  });
}

/**
 * Hook to delete an API key
 */
export function useDeleteApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (provider: string) => apiClient.deleteApiKey(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: modelConfigKeys.apiKeys });
      queryClient.invalidateQueries({ queryKey: modelConfigKeys.all });
    },
  });
}

/**
 * Hook to test an API key
 */
export function useTestApiKey() {
  return useMutation({
    mutationFn: (provider: string) => apiClient.testApiKey(provider),
  });
}

// ============================================
// Provider Settings Hooks (Phase 16G)
// ============================================

export const providerSettingsKeys = {
  all: ['providerSettings'] as const,
  provider: (provider: string) => ['providerSettings', provider] as const,
};

/**
 * Hook to fetch all provider settings
 */
export function useProviderSettings() {
  return useQuery({
    queryKey: providerSettingsKeys.all,
    queryFn: () => apiClient.getProviderSettings(),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to fetch settings for a specific provider
 */
export function useProviderSettingsFor(provider: string) {
  return useQuery({
    queryKey: providerSettingsKeys.provider(provider),
    queryFn: () => apiClient.getProviderSettingsFor(provider),
    enabled: !!provider,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to set a provider setting
 */
export function useSetProviderSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ provider, key, value }: { provider: string; key: string; value: string }) =>
      apiClient.setProviderSetting(provider, key, value),
    onSuccess: (_data, { provider }) => {
      queryClient.invalidateQueries({ queryKey: providerSettingsKeys.all });
      queryClient.invalidateQueries({ queryKey: providerSettingsKeys.provider(provider) });
    },
  });
}

/**
 * Hook to delete a provider setting
 */
export function useDeleteProviderSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ provider, key }: { provider: string; key: string }) =>
      apiClient.deleteProviderSetting(provider, key),
    onSuccess: (_data, { provider }) => {
      queryClient.invalidateQueries({ queryKey: providerSettingsKeys.all });
      queryClient.invalidateQueries({ queryKey: providerSettingsKeys.provider(provider) });
    },
  });
}

// ============================================
// Helper Types and Constants
// ============================================

/**
 * Feature display names for UI
 */
export const FEATURE_DISPLAY_NAMES: Record<ModelFeature, string> = {
  chat: 'Chat Agent',
  summary: 'Summarization',
  ocr: 'Vision OCR',
  embedding_docs: 'Document Embeddings',
  embedding_code: 'Code Embeddings',
  embedding_writing: 'Writing Embeddings',
  reranker: 'Reranker',
  contradiction: 'Contradiction Detection',
};

/**
 * Feature descriptions for UI
 */
export const FEATURE_DESCRIPTIONS: Record<ModelFeature, string> = {
  chat: 'Main conversational AI for answering questions',
  summary: 'Generates summaries of documents and search results',
  ocr: 'Extracts text from images and PDFs',
  embedding_docs: 'Creates embeddings for documentation',
  embedding_code: 'Creates embeddings optimized for code',
  embedding_writing: 'Creates embeddings for personal writing',
  reranker: 'Re-ranks search results for better relevance',
  contradiction: 'Detects conflicting information across sources',
};

/**
 * Feature categories for grouping in UI
 */
export const FEATURE_CATEGORIES = {
  llm: ['chat', 'summary', 'ocr', 'contradiction'] as ModelFeature[],
  embedding: ['embedding_docs', 'embedding_code', 'embedding_writing'] as ModelFeature[],
  search: ['reranker'] as ModelFeature[],
};

/**
 * Provider display names
 */
export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  ollama: 'Ollama (Local)',
  google: 'Google AI',
  voyage: 'Voyage AI',
  cohere: 'Cohere',
  bge: 'BGE (Local)',
  none: 'None',
};

/**
 * Get valid providers for a feature type
 */
export function getProvidersForFeature(feature: ModelFeature): string[] {
  if (FEATURE_CATEGORIES.llm.includes(feature)) {
    return ['anthropic', 'openai', 'ollama', 'google'];
  }
  if (FEATURE_CATEGORIES.embedding.includes(feature)) {
    return ['ollama', 'openai', 'voyage', 'google'];
  }
  if (feature === 'reranker') {
    return ['bge', 'cohere', 'none'];
  }
  return [];
}
