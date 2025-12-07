/**
 * Get Project Tech Stack Tool Definition
 *
 * Phase 16F: Unified tool definition for get_project_tech_stack.
 * Gets the tech stack profile for a collection (frameworks, languages, databases).
 */

import { getTechStackProfile } from '@synthesis/db';
import type { Pool } from 'pg';
import { z } from 'zod';
import { createToolResponse } from '../adapters.js';
import type { ToolContext, UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const getProjectTechStackInputSchema = z.object({
  collectionId: z
    .string()
    .uuid()
    .optional()
    .describe('Collection ID (defaults to active collection)'),
});

type GetProjectTechStackInput = z.infer<typeof getProjectTechStackInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const getProjectTechStackTool: UnifiedToolDefinition = {
  name: 'get_project_tech_stack',
  description: 'Get the tech stack profile for a collection (frameworks, languages, databases).',
  inputSchema: getProjectTechStackInputSchema,
  metadata: {
    toolpack: 'introspection',
    category: 'introspection',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: (_db: Pool, context: ToolContext) => async (input: unknown) => {
    const parsed = getProjectTechStackInputSchema.parse(input) as GetProjectTechStackInput;

    const profile = await getTechStackProfile(parsed.collectionId ?? context.collectionId);

    if (!profile) {
      return createToolResponse('No tech stack profile found for this collection', {
        profile: null,
      });
    }

    const message = `Tech stack: ${profile.primary_framework ?? 'unknown'}`;

    return createToolResponse(message, profile);
  },
};
