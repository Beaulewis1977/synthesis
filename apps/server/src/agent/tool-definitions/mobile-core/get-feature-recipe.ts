/**
 * Get Feature Recipe Tool Definition
 *
 * Phase 16F: Unified tool definition for get_feature_recipe.
 * Gets curated implementation recipes for mobile features.
 */

import type { Pool } from 'pg';
import { z } from 'zod';
import { smartSearch } from '../../../services/search.js';
import { createToolResponse } from '../adapters.js';
import type { ToolContext, UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const getFeatureRecipeInputSchema = z.object({
  collectionId: z
    .string()
    .uuid()
    .optional()
    .describe('Collection ID (defaults to active collection)'),
  featureTags: z
    .array(z.string())
    .min(1, 'at least one feature tag is required')
    .describe('Required array of feature tags'),
  framework: z.string().optional().describe('Framework name (e.g., flutter, react-native)'),
  top_k: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .default(5)
    .describe('Number of results (default: 5)'),
});

type GetFeatureRecipeInput = z.infer<typeof getFeatureRecipeInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const getFeatureRecipeTool: UnifiedToolDefinition = {
  name: 'get_feature_recipe',
  description:
    'Get curated implementation recipes for mobile features. Returns step-by-step guides and best practices for implementing specific features.',
  inputSchema: getFeatureRecipeInputSchema,
  metadata: {
    toolpack: 'mobile_core',
    category: 'mobile',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: (db: Pool, context: ToolContext) => async (input: unknown) => {
    const parsed = getFeatureRecipeInputSchema.parse(input) as GetFeatureRecipeInput;
    const query = `${parsed.featureTags.join(' ')} implementation guide`;
    const searchResult = await smartSearch(db, {
      query,
      collectionId: parsed.collectionId ?? context.collectionId,
      topK: parsed.top_k ?? 5,
      featureTags: parsed.featureTags,
      usageTier: 'recipe',
      techStack: parsed.framework ? [parsed.framework] : undefined,
    });

    const payload = {
      query: searchResult.query,
      feature_tags: parsed.featureTags,
      results: searchResult.results,
      total_results: searchResult.totalResults,
      search_time_ms: searchResult.searchTimeMs,
      metadata: searchResult.metadata,
    };

    return createToolResponse(
      `Feature recipe search completed for "${parsed.featureTags.join(', ')}". Returning ${payload.total_results} recipe(s).`,
      payload
    );
  },
};
