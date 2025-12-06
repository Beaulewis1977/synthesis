/**
 * Fetch Web Content Tool Definition
 *
 * Phase 16F: Unified tool definition for fetch_web_content.
 * Fetches web content (single page or crawl) and ingests it.
 */

import type { Pool } from 'pg';
import { z } from 'zod';
import { fetchWebContent } from '../../../services/documentOperations.js';
import { createToolResponse } from '../adapters.js';
import type { ToolContext, UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const fetchWebContentInputSchema = z.object({
  url: z.string().url().describe('Web page URL'),
  collection_id: z.string().uuid().optional().describe('Collection ID'),
  mode: z.enum(['single', 'crawl']).optional().describe('Fetch mode (default: single)'),
  max_pages: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .describe('Max pages to crawl (default: 25)'),
  title_prefix: z.string().min(1).optional().describe('Title prefix for documents'),
});

type FetchWebContentInput = z.infer<typeof fetchWebContentInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const fetchWebContentTool: UnifiedToolDefinition = {
  name: 'fetch_web_content',
  description: 'Fetch web content (single page or crawl) and ingest it into the active collection.',
  inputSchema: fetchWebContentInputSchema,
  metadata: {
    toolpack: 'core',
    category: 'core',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: (db: Pool, context: ToolContext) => async (input: unknown) => {
    const parsed = fetchWebContentInputSchema.parse(input) as FetchWebContentInput;
    const collectionId = parsed.collection_id ?? context.collectionId;

    try {
      const result = await fetchWebContent(db, {
        url: parsed.url,
        collectionId,
        mode: parsed.mode ?? 'single',
        maxPages: parsed.max_pages ?? 25,
        titlePrefix: parsed.title_prefix,
      });

      return createToolResponse(
        `Fetched and queued ${result.processed.length} page(s) for ingestion.`,
        result.processed
      );
    } catch (error) {
      return createToolResponse(
        `Failed to fetch content from ${parsed.url}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
};
