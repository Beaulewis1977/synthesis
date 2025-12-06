/**
 * Delete Document Tool Definition
 *
 * Phase 16F: Unified tool definition for delete_document.
 * Deletes a document and all associated chunks.
 */

import type { Pool } from 'pg';
import { z } from 'zod';
import { deleteDocumentById } from '../../../services/documentOperations.js';
import { createToolResponse } from '../adapters.js';
import type { UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const deleteDocumentInputSchema = z.object({
  doc_id: z.string().uuid().describe('Document ID'),
  confirm: z.boolean().optional().describe('Confirm deletion'),
});

type DeleteDocumentInput = z.infer<typeof deleteDocumentInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const deleteDocumentTool: UnifiedToolDefinition = {
  name: 'delete_document',
  description: 'Delete a document and all associated chunks (requires confirm=true).',
  inputSchema: deleteDocumentInputSchema,
  metadata: {
    toolpack: 'core',
    category: 'core',
    sensitive: true, // Destructive operation
    version: '1.0.0',
  },
  createExecutor: (db: Pool) => async (input: unknown) => {
    const parsed = deleteDocumentInputSchema.parse(input) as DeleteDocumentInput;

    if (!parsed.confirm) {
      return createToolResponse(
        'Deletion not confirmed. Set confirm=true to permanently remove the document.'
      );
    }

    try {
      const result = await deleteDocumentById(db, {
        docId: parsed.doc_id,
      });

      return createToolResponse(`Document ${result.title} deleted.`, {
        doc_id: result.docId,
        title: result.title,
      });
    } catch (error) {
      return createToolResponse(
        error instanceof Error ? error.message : 'Failed to delete document.'
      );
    }
  },
};
