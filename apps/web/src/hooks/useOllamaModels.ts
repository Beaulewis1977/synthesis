/**
 * useOllamaModels Hook
 *
 * Phase 16G: Fetch available Ollama models for dynamic selection.
 * Uses React Query with 1-minute stale time and single retry (Ollama may be offline).
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { OllamaModelsResponse } from '../types';

export function useOllamaModels() {
  return useQuery<OllamaModelsResponse>({
    queryKey: ['ollama-models'],
    queryFn: () => apiClient.getOllamaModels(),
    staleTime: 60 * 1000, // 1 minute
    retry: 1, // Only retry once for Ollama (may be offline)
  });
}
