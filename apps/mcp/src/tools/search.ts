/**
 * synthesis_search Gateway Tool Implementation
 *
 * Always-on search fallback equivalent to search_rag.
 * This gateway tool provides search functionality that cannot be disabled,
 * ensuring agents always have access to basic RAG capabilities.
 *
 * @module apps/mcp/src/tools/search
 * @since GPT Phase 3: Sub-Phase 5.6.3
 */

import type { SearchChunk, SearchResult } from '../types/gateway-responses.js';
import type { SearchInput } from '../types/gateway-schemas.js';

/**
 * API client interface for making backend requests
 */
export interface ApiClient {
  post: <T = unknown>(endpoint: string, body: unknown) => Promise<T>;
}

/**
 * Raw search response from the backend API
 */
interface ApiSearchResponse {
  results?: Array<{
    id?: number;
    text?: string;
    similarity?: number;
    document_id?: string;
    document_title?: string;
    metadata?: Record<string, unknown>;
  }>;
  query?: string;
  collection_id?: string;
  total_matches?: number;
}

/**
 * Transform backend API response to SearchResult format
 *
 * @param response - Raw API response
 * @param input - Original search input
 * @returns Formatted SearchResult
 */
function transformSearchResponse(response: ApiSearchResponse, input: SearchInput): SearchResult {
  const chunks: SearchChunk[] = (response.results || []).map((item, index) => ({
    id: item.id ?? index,
    text: item.text ?? '',
    similarity: item.similarity ?? 0,
    documentId: item.document_id ?? '',
    documentTitle: item.document_title ?? '',
    metadata: item.metadata ?? {},
  }));

  return {
    chunks,
    query: input.query,
    collectionId: input.collectionId,
    count: chunks.length,
    totalMatches: response.total_matches,
  };
}

/**
 * Execute search against the RAG knowledge base
 *
 * This is the always-on search fallback that cannot be disabled.
 * It provides the same functionality as search_rag but is available
 * in the minimal profile.
 *
 * @param input - Search input with collection ID, query, and options
 * @param apiClient - API client for backend requests
 * @returns SearchResult with matching chunks
 *
 * @example
 * ```typescript
 * const result = await executeSearch(
 *   {
 *     collectionId: '123e4567-e89b-12d3-a456-426614174000',
 *     query: 'flutter authentication',
 *     top_k: 10,
 *     min_similarity: 0.6
 *   },
 *   apiClient
 * );
 *
 * console.log(`Found ${result.count} results`);
 * for (const chunk of result.chunks) {
 *   console.log(`- ${chunk.documentTitle}: ${chunk.similarity}`);
 * }
 * ```
 */
export async function executeSearch(
  input: SearchInput,
  apiClient: ApiClient
): Promise<SearchResult> {
  const { collectionId, query, top_k, min_similarity } = input;

  // Call the backend search API
  const response = await apiClient.post<ApiSearchResponse>('/api/search', {
    collectionId,
    query,
    top_k,
    min_similarity,
  });

  // Transform response to SearchResult format
  return transformSearchResponse(response, input);
}
