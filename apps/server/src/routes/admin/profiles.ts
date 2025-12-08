/**
 * Embedding Profiles Admin API Routes
 *
 * Phase 5: CRUD endpoints for embedding profile management.
 */

import { getPool } from '@synthesis/db';
import { DEFAULT_PROFILE_NAME, type EmbeddingProfilesResponse } from '@synthesis/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
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

interface SetDefaultProfileBody {
  profileId: string | null;
}

const SetDefaultProfileBodySchema = z.object({
  profileId: z.string().uuid().nullable(),
});

const BaseEmbeddingProfileSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .min(2)
    .max(50),
  displayName: z.string().min(1),
  description: z.string().optional(),
  provider: z.enum(['ollama', 'openai', 'voyage']),
  model: z.string().min(1),
  chunkSize: z.number().int().min(100).max(10000).optional(),
  chunkOverlap: z.number().int().min(0).optional(),
  codeAware: z.boolean().optional(),
  costTier: z.enum(['free', 'low', 'medium', 'high']).optional(),
});

const CreateEmbeddingProfileSchema = BaseEmbeddingProfileSchema.refine(
  (data) =>
    data.chunkOverlap === undefined ||
    data.chunkSize === undefined ||
    data.chunkOverlap < data.chunkSize,
  {
    message: 'Chunk overlap must be less than chunk size',
    path: ['chunkOverlap'],
  }
);

type CreateEmbeddingProfileBody = z.infer<typeof CreateEmbeddingProfileSchema>;

const UpdateEmbeddingProfileSchema = BaseEmbeddingProfileSchema.partial().omit({ name: true });

type UpdateEmbeddingProfileBody = z.infer<typeof UpdateEmbeddingProfileSchema>;

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

  // GET /api/admin/profiles/default - Get the current default profile
  // NOTE: Must be registered before /profiles/:id to avoid route conflict
  fastify.get('/profiles/default', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const defaultProfile = await profileService.getDefaultProfile();
      return reply.send({
        profile: defaultProfile,
        isConfigured: defaultProfile.name !== DEFAULT_PROFILE_NAME, // Whether user has set a custom default
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error({ error }, 'Failed to get default profile');
      return reply.status(500).send({ error: message });
    }
  });

  // PUT /api/admin/profiles/default - Set the default profile
  // NOTE: Must be registered before /profiles/:id to avoid route conflict
  fastify.put<{ Body: SetDefaultProfileBody }>(
    '/profiles/default',
    async (request: FastifyRequest<{ Body: SetDefaultProfileBody }>, reply: FastifyReply) => {
      try {
        const parseResult = SetDefaultProfileBodySchema.safeParse(request.body);
        if (!parseResult.success) {
          return reply.status(400).send({
            error: 'Invalid request body',
            details: parseResult.error.issues,
          });
        }

        const { profileId } = parseResult.data;

        // profileId can be null to reset to default 'balanced'
        const updatedProfile = await profileService.setDefaultProfile(profileId ?? null);

        return reply.send({
          profile: updatedProfile,
          message: profileId
            ? 'Default profile updated successfully'
            : 'Default profile reset to balanced',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';

        if (message.includes('not found')) {
          return reply.status(404).send({ error: message });
        }

        fastify.log.error({ error }, 'Failed to set default profile');
        return reply.status(500).send({ error: message });
      }
    }
  );

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
  fastify.post<{ Body: CreateEmbeddingProfileBody }>(
    '/profiles',
    async (request: FastifyRequest<{ Body: CreateEmbeddingProfileBody }>, reply: FastifyReply) => {
      try {
        const parseResult = CreateEmbeddingProfileSchema.safeParse(request.body);
        if (!parseResult.success) {
          return reply.status(400).send({
            error: 'Invalid request body',
            details: parseResult.error.issues,
          });
        }

        const input = parseResult.data;

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
  fastify.put<{ Params: GetProfileParams; Body: UpdateEmbeddingProfileBody }>(
    '/profiles/:id',
    async (
      request: FastifyRequest<{ Params: GetProfileParams; Body: UpdateEmbeddingProfileBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const parseResult = UpdateEmbeddingProfileSchema.safeParse(request.body);
        if (!parseResult.success) {
          return reply.status(400).send({
            error: 'Invalid request body',
            details: parseResult.error.issues,
          });
        }

        const input = parseResult.data;

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
