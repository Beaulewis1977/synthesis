/**
 * Search Mobile Docs Tool Definition
 *
 * Phase 16F: Unified tool definition for search_mobile_docs.
 * Searches mobile-specific documentation with feature tags, platform, and framework filters.
 */

import type { Pool } from 'pg';
import { z } from 'zod';
import { smartSearch } from '../../../services/search.js';
import { createToolResponse } from '../adapters.js';
import type { ToolContext, UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const searchMobileDocsInputSchema = z.object({
  collectionId: z
    .string()
    .uuid()
    .optional()
    .describe('Collection ID (defaults to active collection)'),
  query: z.string().min(1, 'query must not be empty').describe('Search query'),
  featureTags: z
    .array(z.string())
    .optional()
    .describe('Mobile feature tags (e.g., auth, payments, offline)'),
  platform: z.enum(['mobile', 'web', 'backend', 'shared']).optional().describe('Platform filter'),
  framework: z.string().optional().describe('Framework name (e.g., flutter, react-native)'),
  top_k: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe('Number of results (default: 10)'),
});

type SearchMobileDocsInput = z.infer<typeof searchMobileDocsInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const searchMobileDocsTool: UnifiedToolDefinition = {
  name: 'search_mobile_docs',
  description:
    'Search mobile-specific documentation with feature tags, platform, and framework filters. Use this for finding mobile development documentation, patterns, and best practices.',
  inputSchema: searchMobileDocsInputSchema,
  metadata: {
    toolpack: 'mobile_core',
    category: 'mobile',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: (db: Pool, context: ToolContext) => async (input: unknown) => {
    const parsed = searchMobileDocsInputSchema.parse(input) as SearchMobileDocsInput;
    const searchResult = await smartSearch(db, {
      query: parsed.query,
      collectionId: parsed.collectionId ?? context.collectionId,
      topK: parsed.top_k ?? 10,
      featureTags: parsed.featureTags,
      platform: parsed.platform,
      techStack: parsed.framework ? [parsed.framework] : undefined,
    });

    const payload = {
      query: searchResult.query,
      results: searchResult.results,
      total_results: searchResult.totalResults,
      search_time_ms: searchResult.searchTimeMs,
      metadata: searchResult.metadata,
    };

    return createToolResponse(
      `Mobile docs search completed for "${payload.query}". Returning ${payload.total_results} result(s).`,
      payload
    );
  },
};
