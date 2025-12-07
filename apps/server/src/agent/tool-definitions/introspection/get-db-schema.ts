/**
 * Get Database Schema Tool Definition
 *
 * Phase 16F: Unified tool definition for get_db_schema.
 * Extracts database schema (tables, columns, relationships) from the collection.
 */

import type { Pool } from 'pg';
import { z } from 'zod';
import { extractSchema } from '../../../services/schema-extractor.js';
import { createToolResponse } from '../adapters.js';
import type { ToolContext, UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const getDbSchemaInputSchema = z.object({
  collectionId: z
    .string()
    .uuid()
    .optional()
    .describe('Collection ID (defaults to active collection)'),
  tables: z.array(z.string()).optional().describe('Filter to specific table names'),
  includeRelationships: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include table relationships in results'),
});

type GetDbSchemaInput = z.infer<typeof getDbSchemaInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const getDbSchemaTool: UnifiedToolDefinition = {
  name: 'get_db_schema',
  description: 'Extract database schema (tables, columns, relationships) from the collection.',
  inputSchema: getDbSchemaInputSchema,
  metadata: {
    toolpack: 'introspection',
    category: 'introspection',
    sensitive: true,
    version: '1.0.0',
  },
  createExecutor: (db: Pool, context: ToolContext) => async (input: unknown) => {
    const parsed = getDbSchemaInputSchema.parse(input) as GetDbSchemaInput;

    const result = await extractSchema(db, {
      collectionId: parsed.collectionId ?? context.collectionId,
      tables: parsed.tables,
      includeRelationships: parsed.includeRelationships ?? true,
    });

    const tableCount = result.tables?.length ?? 0;
    const message = `Extracted schema with ${tableCount} table(s)`;

    return createToolResponse(message, result);
  },
};
