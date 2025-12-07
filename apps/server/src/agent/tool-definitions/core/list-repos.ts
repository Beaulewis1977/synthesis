/**
 * List Repos Tool Definition
 *
 * Phase 16F: Unified tool definition for list_repos.
 * Lists all repository sources for a collection.
 */

import { listRepoSources } from '@synthesis/db';
import type { Pool } from 'pg';
import { z } from 'zod';
import { createToolResponse } from '../adapters.js';
import type { ToolContext, UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const listReposInputSchema = z.object({
  collection_id: z
    .string()
    .uuid()
    .optional()
    .describe('The ID of the collection to list repositories for'),
});

type ListReposInput = z.infer<typeof listReposInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const listReposTool: UnifiedToolDefinition = {
  name: 'list_repos',
  description:
    'List all repository sources for a collection, including their sync status and configuration.',
  inputSchema: listReposInputSchema,
  metadata: {
    toolpack: 'core',
    category: 'core',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: (_db: Pool, context: ToolContext) => async (input: unknown) => {
    const parsed = listReposInputSchema.parse(input) as ListReposInput;

    // Use provided collection_id or fall back to context
    const collectionId = parsed.collection_id ?? context.collectionId;

    // Guard against undefined collectionId
    if (!collectionId) {
      return createToolResponse('No collection ID provided and no active collection in context.', {
        error: 'Missing collection_id',
        repos: [],
        total: 0,
      });
    }

    const repos = await listRepoSources(collectionId);

    const payload = {
      collection_id: collectionId,
      repos: repos.map((repo) => ({
        id: repo.id,
        repo_url: repo.repo_url,
        default_branch: repo.default_branch,
        ignored_paths: repo.ignored_paths,
        sync_status: repo.sync_status,
        last_synced_at: repo.last_synced_at,
        created_at: repo.created_at,
      })),
      total: repos.length,
    };

    return createToolResponse(
      `Found ${repos.length} repository source(s) for collection ${collectionId}`,
      payload
    );
  },
};
