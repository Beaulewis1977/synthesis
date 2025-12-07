/**
 * Delete Collection Tool Definition
 *
 * Phase 16F: Unified tool definition for delete_collection.
 * Deletes an entire collection and all its documents.
 * SENSITIVE: Requires confirmation to prevent accidental deletion.
 */

import { deleteCollection, getCollection } from '@synthesis/db';
import type { Pool } from 'pg';
import { z } from 'zod';
import { createToolResponse } from '../adapters.js';
import type { ToolContext, UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const deleteCollectionInputSchema = z.object({
  collection_id: z.string().uuid().describe('The ID of the collection to delete'),
  confirm: z.boolean().describe('Must be set to true to confirm deletion'),
});

type DeleteCollectionInput = z.infer<typeof deleteCollectionInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const deleteCollectionTool: UnifiedToolDefinition = {
  name: 'delete_collection',
  description:
    'Delete an entire collection and all its documents. DESTRUCTIVE OPERATION. Requires confirm=true to proceed.',
  inputSchema: deleteCollectionInputSchema,
  metadata: {
    toolpack: 'core',
    category: 'core',
    sensitive: true, // SENSITIVE - destructive operation
    version: '1.0.0',
  },
  createExecutor: (_db: Pool, _context: ToolContext) => async (input: unknown) => {
    const parsed = deleteCollectionInputSchema.parse(input) as DeleteCollectionInput;

    // Safety check: require confirmation
    if (!parsed.confirm) {
      return createToolResponse(
        'Deletion not confirmed. Set confirm=true to permanently remove the collection and all its documents.',
        { confirmed: false, deleted: false }
      );
    }

    // Get collection info before deletion for response
    const collection = await getCollection(parsed.collection_id);
    if (!collection) {
      return createToolResponse(`Collection ${parsed.collection_id} not found`, {
        deleted: false,
        error: 'Collection not found',
      });
    }

    // Perform deletion
    await deleteCollection(parsed.collection_id);

    const payload = {
      deleted: true,
      collection_id: parsed.collection_id,
      collection_name: collection.name,
      message: 'Collection and all documents permanently deleted',
    };

    return createToolResponse(
      `Deleted collection "${collection.name}" (${parsed.collection_id}) and all its documents`,
      payload
    );
  },
};
