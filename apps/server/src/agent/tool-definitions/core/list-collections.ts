/**
 * List Collections Tool Definition
 *
 * Phase 16F: Unified tool definition for list_collections.
 * Lists available collections with document counts.
 */

import type { Pool } from 'pg';
import { z } from 'zod';
import { createToolResponse } from '../adapters.js';
import type { UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const listCollectionsInputSchema = z.object({});

// =============================================================================
// Tool Definition
// =============================================================================

interface CollectionRow {
  id: string;
  name: string;
  description: string | null;
  doc_count: string;
  created_at: Date;
}

export const listCollectionsTool: UnifiedToolDefinition = {
  name: 'list_collections',
  description: 'List available collections with document counts.',
  inputSchema: listCollectionsInputSchema,
  metadata: {
    toolpack: 'core',
    category: 'core',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: (db: Pool) => async () => {
    const { rows } = await db.query<CollectionRow>(`
      SELECT
        c.id,
        c.name,
        c.description,
        COUNT(d.id)::text AS doc_count,
        c.created_at
      FROM collections c
      LEFT JOIN documents d ON d.collection_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

    const collections = rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      doc_count: Number(row.doc_count),
      created_at: row.created_at,
    }));

    return createToolResponse('Collections retrieved.', { collections });
  },
};
