/**
 * Get Document Status Tool Definition
 *
 * Phase 16F: Unified tool definition for get_document_status.
 * Checks the processing status of a document.
 */

import type { Pool } from 'pg';
import { z } from 'zod';
import { createToolResponse } from '../adapters.js';
import type { UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const getDocumentStatusInputSchema = z.object({
  doc_id: z.string().uuid().describe('Document ID'),
});

type GetDocumentStatusInput = z.infer<typeof getDocumentStatusInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

interface DocumentStatusRow {
  id: string;
  title: string;
  status: string;
  error_message: string | null;
  created_at: Date;
  processed_at: Date | null;
  file_path: string | null;
  chunk_count: string;
  total_tokens: string | null;
}

export const getDocumentStatusTool: UnifiedToolDefinition = {
  name: 'get_document_status',
  description: 'Check the processing status of a document.',
  inputSchema: getDocumentStatusInputSchema,
  metadata: {
    toolpack: 'core',
    category: 'core',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: (db: Pool) => async (input: unknown) => {
    const parsed = getDocumentStatusInputSchema.parse(input) as GetDocumentStatusInput;

    const { rows } = await db.query<DocumentStatusRow>(
      `
      SELECT
        d.id,
        d.title,
        d.status,
        d.error_message,
        d.created_at,
        d.processed_at,
        d.file_path,
        COUNT(ch.id)::text AS chunk_count,
        SUM(ch.token_count)::text AS total_tokens
      FROM documents d
      LEFT JOIN chunks ch ON ch.doc_id = d.id
      WHERE d.id = $1
      GROUP BY d.id
    `,
      [parsed.doc_id]
    );

    if (rows.length === 0) {
      return createToolResponse(`Document ${parsed.doc_id} not found.`);
    }

    const doc = rows[0];
    const payload = {
      doc_id: doc.id,
      title: doc.title,
      status: doc.status,
      error: doc.error_message,
      created_at: doc.created_at,
      processed_at: doc.processed_at,
      chunk_count: Number(doc.chunk_count),
      total_tokens: doc.total_tokens ? Number(doc.total_tokens) : null,
      file_path: doc.file_path,
    };

    return createToolResponse(`Status retrieved for document ${doc.title}.`, payload);
  },
};
