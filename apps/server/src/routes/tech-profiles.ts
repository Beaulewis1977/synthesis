/**
 * Tech Stack Profile routes
 * Manages tech stack configurations for collections
 */

import {
  applyTechStackTemplate,
  createTechStackProfile,
  getTechStackProfile,
  listTechStackTemplates,
  updateTechStackProfile,
} from '@synthesis/db';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const CreateProfileSchema = z.object({
  collection_id: z.string().uuid(),
  primary_language: z.string().optional(),
  primary_framework: z.string().optional(),
  database_type: z.string().optional(),
  frameworks: z.array(z.string()).optional(),
  version_constraints: z.record(z.string()).optional(),
});

const UpdateProfileSchema = z.object({
  primary_language: z.string().optional(),
  primary_framework: z.string().optional(),
  database_type: z.string().optional(),
  frameworks: z.array(z.string()).optional(),
  version_constraints: z.record(z.string()).optional(),
});

const ApplyTemplateSchema = z.object({
  template_name: z.string(),
});

export const techProfileRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/tech-profiles/templates - List available templates
  fastify.get<{ Querystring: { category?: string } }>(
    '/api/tech-profiles/templates',
    async (request, reply) => {
      const { category } = request.query;
      try {
        const templates = await listTechStackTemplates(category);
        return reply.send({ templates });
      } catch (error) {
        fastify.log.error(error, 'Failed to list tech stack templates');
        return reply.code(500).send({ error: 'Failed to list templates' });
      }
    }
  );

  // GET /api/tech-profiles/:collectionId - Get profile for a collection
  fastify.get<{ Params: { collectionId: string } }>(
    '/api/tech-profiles/:collectionId',
    async (request, reply) => {
      const { collectionId } = request.params;
      try {
        const profile = await getTechStackProfile(collectionId);
        if (!profile) {
          return reply.code(404).send({ error: 'Tech profile not found' });
        }
        return reply.send({ profile });
      } catch (error) {
        fastify.log.error(error, 'Failed to get tech profile');
        return reply.code(500).send({ error: 'Failed to get tech profile' });
      }
    }
  );

  // POST /api/tech-profiles - Create a new tech profile
  fastify.post('/api/tech-profiles', async (request, reply) => {
    const validation = CreateProfileSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send({
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const { collection_id, ...data } = validation.data;
    try {
      const profile = await createTechStackProfile({
        collectionId: collection_id,
        primaryLanguage: data.primary_language,
        primaryFramework: data.primary_framework,
        databaseType: data.database_type,
        frameworks: data.frameworks,
        versionConstraints: data.version_constraints,
      });
      return reply.code(201).send({ profile });
    } catch (error) {
      fastify.log.error(error, 'Failed to create tech profile');
      if (error instanceof Error && error.message.includes('unique')) {
        return reply.code(409).send({ error: 'Profile already exists for this collection' });
      }
      return reply.code(500).send({ error: 'Failed to create tech profile' });
    }
  });

  // PATCH /api/tech-profiles/:collectionId - Update a tech profile
  fastify.patch<{ Params: { collectionId: string } }>(
    '/api/tech-profiles/:collectionId',
    async (request, reply) => {
      const { collectionId } = request.params;
      const validation = UpdateProfileSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.code(400).send({
          error: 'Invalid request',
          details: validation.error.issues,
        });
      }

      try {
        const profile = await updateTechStackProfile(collectionId, {
          primary_language: validation.data.primary_language,
          primary_framework: validation.data.primary_framework,
          database_type: validation.data.database_type,
          frameworks: validation.data.frameworks,
          version_constraints: validation.data.version_constraints,
        });
        if (!profile) {
          return reply.code(404).send({ error: 'Tech profile not found' });
        }
        return reply.send({ profile });
      } catch (error) {
        fastify.log.error(error, 'Failed to update tech profile');
        return reply.code(500).send({ error: 'Failed to update tech profile' });
      }
    }
  );

  // POST /api/tech-profiles/:collectionId/apply-template - Apply a template
  fastify.post<{ Params: { collectionId: string } }>(
    '/api/tech-profiles/:collectionId/apply-template',
    async (request, reply) => {
      const { collectionId } = request.params;
      const validation = ApplyTemplateSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.code(400).send({
          error: 'Invalid request',
          details: validation.error.issues,
        });
      }

      try {
        const profile = await applyTechStackTemplate(collectionId, validation.data.template_name);
        return reply.send({
          message: `Applied template '${validation.data.template_name}'`,
          profile,
        });
      } catch (error) {
        fastify.log.error(error, 'Failed to apply template');
        if (error instanceof Error && error.message.includes('not found')) {
          return reply.code(404).send({ error: error.message });
        }
        return reply.code(500).send({ error: 'Failed to apply template' });
      }
    }
  );
};
