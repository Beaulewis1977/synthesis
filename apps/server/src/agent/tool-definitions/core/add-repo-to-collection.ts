/**
 * Add Repo to Collection Tool Definition
 *
 * Phase 16F: Unified tool definition for add_repo_to_collection.
 * Adds a GitHub/Git repository to a collection for code ingestion.
 */

import { createRepoSource } from '@synthesis/db';
import type { Pool } from 'pg';
import { z } from 'zod';
import { createToolResponse } from '../adapters.js';
import type { ToolContext, UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const addRepoToCollectionInputSchema = z.object({
  collection_id: z.string().uuid().describe('The ID of the collection to add the repo to'),
  repo_url: z
    .string()
    .url()
    .describe('The Git repository URL (e.g., https://github.com/user/repo)'),
  default_branch: z.string().default('main').describe('The default branch to sync (default: main)'),
  ignored_paths: z
    .array(z.string())
    .optional()
    .describe('Paths to ignore during sync (e.g., ["node_modules/", "dist/"])'),
});

type AddRepoToCollectionInput = z.infer<typeof addRepoToCollectionInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const addRepoToCollectionTool: UnifiedToolDefinition = {
  name: 'add_repo_to_collection',
  description:
    'Add a GitHub or Git repository to a collection for code ingestion. The repository will be cloned and its files indexed.',
  inputSchema: addRepoToCollectionInputSchema,
  metadata: {
    toolpack: 'core',
    category: 'core',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: (_db: Pool, _context: ToolContext) => async (input: unknown) => {
    const parsed = addRepoToCollectionInputSchema.parse(input) as AddRepoToCollectionInput;

    const repo = await createRepoSource({
      collectionId: parsed.collection_id,
      repoUrl: parsed.repo_url,
      defaultBranch: parsed.default_branch,
      ignoredPaths: parsed.ignored_paths,
    });

    const payload = {
      id: repo.id,
      collection_id: repo.collection_id,
      repo_url: repo.repo_url,
      default_branch: repo.default_branch,
      ignored_paths: repo.ignored_paths,
      sync_status: repo.sync_status,
      created_at: repo.created_at,
    };

    return createToolResponse(
      `Added repository ${parsed.repo_url} to collection. Use sync_repo with ID ${repo.id} to start ingestion.`,
      payload
    );
  },
};
