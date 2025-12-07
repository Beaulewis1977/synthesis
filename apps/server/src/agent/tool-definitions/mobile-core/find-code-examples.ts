/**
 * Find Code Examples Tool Definition
 *
 * Phase 16F: Unified tool definition for find_code_examples.
 * Finds working code examples for mobile features.
 */

import type { Pool } from 'pg';
import { z } from 'zod';
import { smartSearch } from '../../../services/search.js';
import { createToolResponse } from '../adapters.js';
import type { ToolContext, UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const findCodeExamplesInputSchema = z.object({
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
  framework: z.string().optional().describe('Framework name (e.g., flutter, react-native)'),
  top_k: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(5)
    .describe('Number of results (default: 5)'),
});

type FindCodeExamplesInput = z.infer<typeof findCodeExamplesInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const findCodeExamplesTool: UnifiedToolDefinition = {
  name: 'find_code_examples',
  description:
    'Find working code examples for mobile features. Returns practical, ready-to-use code snippets and examples from the documentation.',
  inputSchema: findCodeExamplesInputSchema,
  metadata: {
    toolpack: 'mobile_core',
    category: 'mobile',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: (db: Pool, context: ToolContext) => async (input: unknown) => {
    const parsed = findCodeExamplesInputSchema.parse(input) as FindCodeExamplesInput;
    const searchResult = await smartSearch(db, {
      query: parsed.query,
      collectionId: parsed.collectionId ?? context.collectionId,
      topK: parsed.top_k ?? 5,
      featureTags: parsed.featureTags,
      usageTier: 'example',
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
      `Code examples search completed for "${payload.query}". Returning ${payload.total_results} example(s).`,
      payload
    );
  },
};
