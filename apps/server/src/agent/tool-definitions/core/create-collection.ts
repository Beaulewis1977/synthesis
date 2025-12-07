/**
 * Create Collection Tool Definition
 *
 * Phase 16F: Unified tool definition for create_collection.
 * Creates a new document collection.
 */

import { createCollection } from '@synthesis/db';
import type { Pool } from 'pg';
import { z } from 'zod';
import { createToolResponse } from '../adapters.js';
import type { ToolContext, UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const createCollectionInputSchema = z.object({
  name: z.string().min(1).max(255).describe('The name of the collection'),
  description: z.string().optional().describe('Optional description of the collection'),
});

type CreateCollectionInput = z.infer<typeof createCollectionInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const createCollectionTool: UnifiedToolDefinition = {
  name: 'create_collection',
  description: 'Create a new document collection for organizing and storing documents.',
  inputSchema: createCollectionInputSchema,
  metadata: {
    toolpack: 'core',
    category: 'core',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: (_db: Pool, _context: ToolContext) => async (input: unknown) => {
    const parsed = createCollectionInputSchema.parse(input) as CreateCollectionInput;

    const collection = await createCollection(parsed.name, parsed.description);

    const payload = {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      created_at: collection.created_at,
    };

    return createToolResponse(
      `Created collection "${collection.name}" with ID ${collection.id}`,
      payload
    );
  },
};
