/**
 * Restart Ingest Tool Definition
 *
 * Phase 16F: Unified tool definition for restart_ingest.
 * Retries ingestion for a failed or stuck document.
 */

import { getDocument } from '@synthesis/db';
import type { Pool } from 'pg';
import { z } from 'zod';
import { ingestDocument } from '../../../pipeline/orchestrator.js';
import { createToolResponse } from '../adapters.js';
import type { UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const restartIngestInputSchema = z.object({
  doc_id: z.string().uuid().describe('Document ID'),
});

type RestartIngestInput = z.infer<typeof restartIngestInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const restartIngestTool: UnifiedToolDefinition = {
  name: 'restart_ingest',
  description: 'Retry ingestion for a document that previously failed or is stuck.',
  inputSchema: restartIngestInputSchema,
  metadata: {
    toolpack: 'core',
    category: 'core',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: (db: Pool) => async (input: unknown) => {
    const parsed = restartIngestInputSchema.parse(input) as RestartIngestInput;
    const document = await getDocument(parsed.doc_id);

    if (!document) {
      return createToolResponse(`Document ${parsed.doc_id} not found.`);
    }

    if (!document.file_path) {
      return createToolResponse(`Document ${document.id} has no stored file to ingest.`);
    }

    await db.query(
      `UPDATE documents
       SET status = 'pending',
           error_message = NULL,
           processed_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [document.id]
    );

    ingestDocument(document.id).catch((error: unknown) => {
      console.error(`Re-ingestion failed for ${document.id}`, error);
    });

    return createToolResponse(`Re-ingestion started for document ${document.title}.`);
  },
};
