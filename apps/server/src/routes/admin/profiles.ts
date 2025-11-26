/**
 * Embedding Profiles Admin API Routes
 *
 * Phase 5: CRUD endpoints for embedding profile management.
 */

import { getPool } from '@synthesis/db';
import type {
  CreateEmbeddingProfileInput,
  EmbeddingProfilesResponse,
  UpdateEmbeddingProfileInput,
} from '@synthesis/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getEmbeddingProfileService } from '../../services/embedding-profile-service.js';

// Request type definitions
interface GetProfileParams {
  id: string;
}

interface SetCollectionProfileParams {
  id: string;
}

interface SetCollectionProfileBody {
  profileId: string | null;
}

/**
 * Register embedding profile admin routes
 */
export async function registerProfileRoutes(fastify: FastifyInstance): Promise<void> {
  const db = getPool();
  const profileService = getEmbeddingProfileService(db);

  // GET /api/admin/profiles - List all profiles
  fastify.get('/profiles', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const profiles = await profileService.getAllProfiles();
      const defaultProfile = await profileService.getDefaultProfile();

      const response: EmbeddingProfilesResponse = {
        profiles,
        defaultProfileId: defaultProfile.id,
      };

      return reply.send(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error({ error }, 'Failed to list profiles');
      return reply.status(500).send({ error: message });
    }
  });

  // GET /api/admin/profiles/:id - Get profile by ID
  fastify.get<{ Params: GetProfileParams }>(
    '/profiles/:id',
    async (request: FastifyRequest<{ Params: GetProfileParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const profile = await profileService.getProfile(id);

        if (!profile) {
          return reply.status(404).send({ error: 'Profile not found' });
        }

        return reply.send(profile);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ error }, 'Failed to get profile');
        return reply.status(500).send({ error: message });
      }
    }
  );

  // POST /api/admin/profiles - Create new profile
  fastify.post<{ Body: CreateEmbeddingProfileInput }>(
    '/profiles',
    async (request: FastifyRequest<{ Body: CreateEmbeddingProfileInput }>, reply: FastifyReply) => {
      try {
        const input = request.body;

        // Validate required fields
        if (!input.name || !input.displayName || !input.provider || !input.model) {
          return reply.status(400).send({
            error: 'Missing required fields: name, displayName, provider, model',
          });
        }

        const profile = await profileService.createProfile(input);
        return reply.status(201).send(profile);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';

        // Check for validation errors
        if (message.includes('Invalid') || message.includes('already exists')) {
          return reply.status(400).send({ error: message });
        }

        fastify.log.error({ error }, 'Failed to create profile');
        return reply.status(500).send({ error: message });
      }
    }
  );

  // PUT /api/admin/profiles/:id - Update profile
  fastify.put<{ Params: GetProfileParams; Body: UpdateEmbeddingProfileInput }>(
    '/profiles/:id',
    async (
      request: FastifyRequest<{ Params: GetProfileParams; Body: UpdateEmbeddingProfileInput }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const input = request.body;

        const profile = await profileService.updateProfile(id, input);
        return reply.send(profile);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';

        // Check for not found
        if (message.includes('not found')) {
          return reply.status(404).send({ error: message });
        }

        // Check for validation errors or system profile restrictions
        if (message.includes('Invalid') || message.includes('Cannot modify')) {
          return reply.status(400).send({ error: message });
        }

        fastify.log.error({ error }, 'Failed to update profile');
        return reply.status(500).send({ error: message });
      }
    }
  );

  // DELETE /api/admin/profiles/:id - Delete profile
  fastify.delete<{ Params: GetProfileParams }>(
    '/profiles/:id',
    async (request: FastifyRequest<{ Params: GetProfileParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        await profileService.deleteProfile(id);
        return reply.status(204).send();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';

        // Check for not found
        if (message.includes('not found')) {
          return reply.status(404).send({ error: message });
        }

        // Check for system profile or in-use errors
        if (message.includes('Cannot delete')) {
          return reply.status(400).send({ error: message });
        }

        fastify.log.error({ error }, 'Failed to delete profile');
        return reply.status(500).send({ error: message });
      }
    }
  );

  // PUT /api/collections/:id/profile - Set collection's embedding profile
  fastify.put<{ Params: SetCollectionProfileParams; Body: SetCollectionProfileBody }>(
    '/collections/:id/profile',
    async (
      request: FastifyRequest<{
        Params: SetCollectionProfileParams;
        Body: SetCollectionProfileBody;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id: collectionId } = request.params;
        const { profileId } = request.body;

        // Verify collection exists
        const collectionResult = await db.query('SELECT id FROM collections WHERE id = $1', [
          collectionId,
        ]);
        if (collectionResult.rows.length === 0) {
          return reply.status(404).send({ error: 'Collection not found' });
        }

        await profileService.setCollectionProfile(collectionId, profileId);

        // Return the updated profile
        let profile = profileId
          ? await profileService.getProfileById(profileId)
          : await profileService.getDefaultProfile();

        if (!profile) {
          profile = await profileService.getDefaultProfile();
          if (!profile) {
            return reply.status(404).send({ error: 'Profile not found' });
          }
        }

        return reply.send({
          collectionId,
          profile,
          message: profileId ? 'Profile set successfully' : 'Profile cleared, using default',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';

        if (message.includes('not found')) {
          return reply.status(404).send({ error: message });
        }

        fastify.log.error({ error }, 'Failed to set collection profile');
        return reply.status(500).send({ error: message });
      }
    }
  );

  // GET /api/collections/:id/profile - Get collection's embedding profile
  fastify.get<{ Params: SetCollectionProfileParams }>(
    '/collections/:id/profile',
    async (
      request: FastifyRequest<{ Params: SetCollectionProfileParams }>,
      reply: FastifyReply
    ) => {
      try {
        const { id: collectionId } = request.params;

        // Verify collection exists
        const collectionResult = await db.query(
          'SELECT id, embedding_profile_id FROM collections WHERE id = $1',
          [collectionId]
        );
        if (collectionResult.rows.length === 0) {
          return reply.status(404).send({ error: 'Collection not found' });
        }

        const profile = await profileService.getProfileForCollection(collectionId);
        const isDefault = !collectionResult.rows[0].embedding_profile_id;

        return reply.send({
          collectionId,
          profile,
          isDefault,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ error }, 'Failed to get collection profile');
        return reply.status(500).send({ error: message });
      }
    }
  );
}

export default registerProfileRoutes;
