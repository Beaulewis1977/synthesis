/**
 * Repository ingestion routes
 * Handles GitHub/Git repository ingestion and sync
 */

import {
  createRepoSource,
  deleteRepoSource,
  getPool,
  getRepoSource,
  listRepoSources,
  type RepositorySource,
} from '@synthesis/db';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { syncRepository } from '../services/repo-ingestion.js';

// Schemas
const CreateRepoSourceSchema = z.object({
  collection_id: z.string().uuid(),
  repo_url: z.string().url(),
  default_branch: z.string().default('main'),
  ignored_paths: z.array(z.string()).optional(),
});

const SyncRepoSchema = z.object({
  repo_source_id: z.string().uuid(),
});

export const repoRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/repos - List all repository sources for a collection
  fastify.get<{ Querystring: { collection_id: string } }>(
    '/api/repos',
    async (request, reply) => {
      const { collection_id } = request.query;

      if (!collection_id) {
        return reply.code(400).send({ error: 'collection_id is required' });
      }

      try {
        const repos = await listRepoSources(collection_id);
        return reply.send({ repos });
      } catch (error) {
        fastify.log.error(error, 'Failed to list repository sources');
        return reply.code(500).send({ error: 'Failed to list repository sources' });
      }
    }
  );

  // GET /api/repos/:id - Get a specific repository source
  fastify.get<{ Params: { id: string } }>('/api/repos/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const repo = await getRepoSource(id);

      if (!repo) {
        return reply.code(404).send({ error: 'Repository source not found' });
      }

      return reply.send({ repo });
    } catch (error) {
      fastify.log.error(error, 'Failed to get repository source');
      return reply.code(500).send({ error: 'Failed to get repository source' });
    }
  });

  // POST /api/repos - Add a new repository source
  fastify.post('/api/repos', async (request, reply) => {
    const validation = CreateRepoSourceSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.code(400).send({
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const { collection_id, repo_url, default_branch, ignored_paths } = validation.data;

    try {
      const repo = await createRepoSource({
        collectionId: collection_id,
        repoUrl: repo_url,
        defaultBranch: default_branch,
        ignoredPaths: ignored_paths,
      });

      return reply.code(201).send({ repo });
    } catch (error) {
      fastify.log.error(error, 'Failed to create repository source');
      
      // Check for unique constraint violation
      if (error instanceof Error && error.message.includes('unique')) {
        return reply.code(409).send({ error: 'Repository already exists in this collection' });
      }
      
      return reply.code(500).send({ error: 'Failed to create repository source' });
    }
  });

  // POST /api/repos/:id/sync - Trigger repository sync
  fastify.post<{ Params: { id: string } }>('/api/repos/:id/sync', async (request, reply) => {
    const { id } = request.params;

    try {
      const repo = await getRepoSource(id);

      if (!repo) {
        return reply.code(404).send({ error: 'Repository source not found' });
      }

      // Check if already syncing
      if (repo.sync_status === 'syncing') {
        return reply.code(409).send({
          error: 'Repository is already syncing',
          status: repo.sync_status,
        });
      }

      // Start sync in background
      const pool = getPool();
      syncRepository(pool, id).catch((error) => {
        fastify.log.error({ repoId: id, error }, 'Background repo sync failed');
      });

      return reply.code(202).send({
        message: 'Repository sync started',
        repo_source_id: id,
        status: 'syncing',
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to start repository sync');
      return reply.code(500).send({ error: 'Failed to start repository sync' });
    }
  });

  // DELETE /api/repos/:id - Delete a repository source
  fastify.delete<{ Params: { id: string } }>('/api/repos/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const repo = await getRepoSource(id);

      if (!repo) {
        return reply.code(404).send({ error: 'Repository source not found' });
      }

      await deleteRepoSource(id);

      return reply.send({
        success: true,
        message: 'Repository source deleted',
        repo_source_id: id,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to delete repository source');
      return reply.code(500).send({ error: 'Failed to delete repository source' });
    }
  });
};
