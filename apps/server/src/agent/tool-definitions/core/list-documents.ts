/**
 * List Documents Tool Definition
 *
 * Phase 16F: Unified tool definition for list_documents.
 * Lists documents in a collection with status information.
 */

import type { Pool } from 'pg';
import { z } from 'zod';
import { createToolResponse } from '../adapters.js';
import type { ToolContext, UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const listDocumentsInputSchema = z.object({
  collection_id: z.string().uuid().optional().describe('Collection ID'),
  status: z
    .enum(['pending', 'extracting', 'chunking', 'embedding', 'complete', 'error', 'all'])
    .optional()
    .describe('Filter by status (default: all)'),
  limit: z.number().int().min(1).max(200).optional().describe('Max results (default: 50)'),
});

type ListDocumentsInput = z.infer<typeof listDocumentsInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

interface DocumentRow {
  id: string;
  title: string;
  status: string;
  file_size: number | null;
  source_url: string | null;
  created_at: Date;
  updated_at: Date;
  chunk_count: string;
  token_count: string | null;
}

export const listDocumentsTool: UnifiedToolDefinition = {
  name: 'list_documents',
  description: 'List documents in a collection with status information.',
  inputSchema: listDocumentsInputSchema,
  metadata: {
    toolpack: 'core',
    category: 'core',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: (db: Pool, context: ToolContext) => async (input: unknown) => {
    const parsed = listDocumentsInputSchema.parse(input) as ListDocumentsInput;
    const collectionId = parsed.collection_id ?? context.collectionId;
    const params: Array<string | number> = [collectionId];
    let paramIndex = 2;

    let statusFilter = '';
    if (parsed.status && parsed.status !== 'all') {
      statusFilter = `AND d.status = $${paramIndex++}`;
      params.push(parsed.status);
    }

    params.push(parsed.limit ?? 50);

    const { rows } = await db.query<DocumentRow>(
      `
      SELECT
        d.id,
        d.title,
        d.status,
        d.file_size,
        d.source_url,
        d.created_at,
        d.updated_at,
        COUNT(ch.id)::text AS chunk_count,
        SUM(ch.token_count)::text AS token_count
      FROM documents d
      LEFT JOIN chunks ch ON ch.doc_id = d.id
      WHERE d.collection_id = $1
      ${statusFilter}
      GROUP BY d.id
      ORDER BY d.created_at DESC
      LIMIT $${paramIndex}
    `,
      params
    );

    const documents = rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      file_size: row.file_size,
      source_url: row.source_url,
      created_at: row.created_at,
      updated_at: row.updated_at,
      chunk_count: Number(row.chunk_count),
      token_count: row.token_count ? Number(row.token_count) : null,
    }));

    return createToolResponse(`Retrieved ${documents.length} document(s).`, { documents });
  },
};
