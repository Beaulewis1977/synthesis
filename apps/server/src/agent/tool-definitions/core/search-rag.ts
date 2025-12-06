/**
 * Search RAG Tool Definition
 *
 * Phase 16F: Unified tool definition for search_rag.
 * Searches the RAG knowledge base for relevant information.
 */

import type { Pool } from 'pg';
import { z } from 'zod';
import { smartSearch } from '../../../services/search.js';
import { createToolResponse } from '../adapters.js';
import type { ToolContext, UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const searchRagInputSchema = z.object({
  query: z.string().min(1, 'query must not be empty').describe('Search query'),
  collection_id: z
    .string()
    .uuid()
    .optional()
    .describe('Collection ID (defaults to active collection)'),
  top_k: z.number().int().min(1).max(50).optional().describe('Number of results (default: 5)'),
  min_similarity: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Minimum similarity threshold (default: 0.5)'),
  search_mode: z.enum(['vector', 'hybrid']).optional().describe('Search mode'),
});

type SearchRagInput = z.infer<typeof searchRagInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const searchRagTool: UnifiedToolDefinition = {
  name: 'search_rag',
  description:
    'Search the RAG knowledge base for relevant information and return matching chunks with citations.',
  inputSchema: searchRagInputSchema,
  metadata: {
    toolpack: 'core',
    category: 'core',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: (db: Pool, context: ToolContext) => async (input: unknown) => {
    const parsed = searchRagInputSchema.parse(input) as SearchRagInput;
    const searchResult = await smartSearch(db, {
      query: parsed.query,
      collectionId: parsed.collection_id ?? context.collectionId,
      topK: parsed.top_k ?? 5,
      minSimilarity: parsed.min_similarity ?? 0.5,
      mode: parsed.search_mode,
    });

    const payload = {
      query: searchResult.query,
      results: searchResult.results,
      total_results: searchResult.totalResults,
      search_time_ms: searchResult.searchTimeMs,
      metadata: searchResult.metadata,
    };

    return createToolResponse(
      `Search (${searchResult.metadata.searchMode}) completed for "${payload.query}". Returning ${payload.total_results} result(s).`,
      payload
    );
  },
};
