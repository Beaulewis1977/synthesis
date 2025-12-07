/**
 * Sync Repo Tool Definition
 *
 * Phase 16F: Unified tool definition for sync_repo.
 * Triggers a sync for a repository to pull and ingest latest changes.
 */

import { getPool, getRepoSource } from '@synthesis/db';
import type { Pool } from 'pg';
import { z } from 'zod';
import { syncRepository } from '../../../services/repo-ingestion.js';
import { createToolResponse } from '../adapters.js';
import type { ToolContext, UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const syncRepoInputSchema = z.object({
  repo_source_id: z.string().uuid().describe('The ID of the repository source to sync'),
});

type SyncRepoInput = z.infer<typeof syncRepoInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const syncRepoTool: UnifiedToolDefinition = {
  name: 'sync_repo',
  description:
    'Trigger a sync for a repository to pull and ingest latest changes. The sync runs asynchronously in the background.',
  inputSchema: syncRepoInputSchema,
  metadata: {
    toolpack: 'core',
    category: 'core',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: (_db: Pool, _context: ToolContext) => async (input: unknown) => {
    const parsed = syncRepoInputSchema.parse(input) as SyncRepoInput;

    const pool = getPool();

    // Verify repo exists
    const repo = await getRepoSource(parsed.repo_source_id);
    if (!repo) {
      return createToolResponse(`Repository source ${parsed.repo_source_id} not found`, {
        started: false,
        error: 'Repository source not found',
      });
    }

    // Atomically attempt to mark repo as syncing to avoid race conditions
    const updateResult = await pool.query(
      `UPDATE repository_sources
       SET sync_status = 'syncing',
           sync_error = NULL,
           updated_at = NOW()
       WHERE id = $1 AND sync_status != 'syncing'
       RETURNING *`,
      [parsed.repo_source_id]
    );

    if (updateResult.rowCount === 0) {
      return createToolResponse(
        `Repository ${repo.repo_url} is already syncing. Check status later with list_repos.`,
        {
          started: false,
          repo_source_id: parsed.repo_source_id,
          repo_url: repo.repo_url,
          status: 'syncing',
          message: 'Repository is already syncing',
        }
      );
    }

    // Start sync in background (non-blocking)
    syncRepository(pool, parsed.repo_source_id).catch(async (error) => {
      console.error(`Background repo sync failed for ${parsed.repo_source_id}:`, error);
      // Rollback status to allow retry
      try {
        await pool.query(
          `UPDATE repository_sources
           SET sync_status = 'error',
               sync_error = $2,
               updated_at = NOW()
           WHERE id = $1`,
          [parsed.repo_source_id, error instanceof Error ? error.message : 'Unknown error']
        );
      } catch (updateErr) {
        console.error(
          `Failed to update sync status after error for ${parsed.repo_source_id}:`,
          updateErr
        );
      }
    });

    const payload = {
      started: true,
      repo_source_id: parsed.repo_source_id,
      repo_url: repo.repo_url,
      status: 'syncing',
      message: 'Sync started in background. Use list_repos to check progress.',
    };

    return createToolResponse(
      `Started sync for repository ${repo.repo_url}. This runs asynchronously.`,
      payload
    );
  },
};
