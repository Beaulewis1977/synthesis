/**
 * Find Symbol Usages Tool Definition
 *
 * Phase 16F: Unified tool definition for find_symbol_usages.
 * Finds where a symbol (function, class, widget, method, constant) is defined and used across the codebase.
 */

import type { Pool } from 'pg';
import { z } from 'zod';
import { findSymbolUsages } from '../../../services/symbol-search.js';
import { createToolResponse } from '../adapters.js';
import type { ToolContext, UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const findSymbolUsagesInputSchema = z.object({
  collectionId: z
    .string()
    .uuid()
    .optional()
    .describe('Collection ID (defaults to active collection)'),
  symbolName: z.string().min(1).describe('Symbol name to search'),
  symbolKind: z
    .enum(['function', 'class', 'widget', 'method', 'constant'])
    .optional()
    .describe('Type of symbol to search for'),
  includeDefinitions: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include symbol definitions in results'),
  includeUsages: z.boolean().optional().default(true).describe('Include symbol usages in results'),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe('Maximum number of results'),
});

type FindSymbolUsagesInput = z.infer<typeof findSymbolUsagesInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const findSymbolUsagesTool: UnifiedToolDefinition = {
  name: 'find_symbol_usages',
  description:
    'Find where a symbol (function, class, widget, method, constant) is defined and used across the codebase.',
  inputSchema: findSymbolUsagesInputSchema,
  metadata: {
    toolpack: 'introspection',
    category: 'introspection',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: (db: Pool, context: ToolContext) => async (input: unknown) => {
    const parsed = findSymbolUsagesInputSchema.parse(input) as FindSymbolUsagesInput;

    const result = await findSymbolUsages(db, {
      collectionId: parsed.collectionId ?? context.collectionId,
      symbolName: parsed.symbolName,
      symbolKind: parsed.symbolKind,
      includeDefinitions: parsed.includeDefinitions ?? true,
      includeUsages: parsed.includeUsages ?? true,
      maxResults: parsed.maxResults ?? 20,
    });

    const message = `Found ${result.definitions?.length ?? 0} definition(s) and ${result.usages?.length ?? 0} usage(s) for symbol "${parsed.symbolName}"`;

    return createToolResponse(message, result);
  },
};
