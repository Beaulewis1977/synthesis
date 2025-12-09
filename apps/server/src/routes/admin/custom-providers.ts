/**
 * Custom Provider Management Routes
 *
 * Phase 17E: Admin endpoints for managing custom OpenAI-compatible LLM providers.
 *
 * Endpoints:
 * - GET    /api/admin/custom-providers                 - List all custom providers
 * - POST   /api/admin/custom-providers                 - Create new custom provider
 * - GET    /api/admin/custom-providers/:id             - Get single provider by ID
 * - PATCH  /api/admin/custom-providers/:id             - Update provider
 * - DELETE /api/admin/custom-providers/:id             - Delete provider
 * - POST   /api/admin/custom-providers/:id/test        - Test existing provider connection
 * - GET    /api/admin/custom-providers/:id/models      - Get/refresh discovered models
 * - POST   /api/admin/custom-providers/test-connection - Test connection before saving
 */

import { getPool } from '@synthesis/db';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getCustomProviderService } from '../../services/custom-provider-service.js';

/**
 * Validation schema for creating a custom provider
 */
const CreateCustomProviderSchema = z.object({
  name: z.string().min(1).max(100),
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
  maxContextTokens: z.number().int().min(1024).max(128000).optional(),
  supportsVision: z.boolean().optional(),
  supportsTools: z.boolean().optional(),
  customModels: z.array(z.string()).optional(),
});

/**
 * Validation schema for updating a custom provider (partial updates)
 */
const UpdateCustomProviderSchema = CreateCustomProviderSchema.partial();

/**
 * Validation schema for testing a connection
 */
const TestConnectionSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
});

/**
 * Parameter interface for routes with :id
 */
interface ProviderIdParams {
  id: string;
}

/**
 * Helper function to validate UUID format
 */
function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Register custom provider management routes
 */
export async function customProviderRoutes(fastify: FastifyInstance): Promise<void> {
  const db = getPool();
  const service = getCustomProviderService(db);

  /**
   * GET /api/admin/custom-providers
   * List all custom providers
   */
  fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const providers = await service.list();
      return reply.send({ providers });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error(`Failed to list custom providers: ${message}`);
      return reply.status(500).send({
        error: 'Failed to retrieve custom providers',
        message,
      });
    }
  });

  /**
   * POST /api/admin/custom-providers
   * Create a new custom provider
   */
  fastify.post<{ Body: z.infer<typeof CreateCustomProviderSchema> }>(
    '/',
    async (
      request: FastifyRequest<{ Body: z.infer<typeof CreateCustomProviderSchema> }>,
      reply: FastifyReply
    ) => {
      // Validate request body
      const validation = CreateCustomProviderSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: validation.error.issues,
        });
      }

      const input = validation.data;

      try {
        const provider = await service.create(input);

        fastify.log.info(
          { providerId: provider.id, providerName: provider.name },
          'Custom provider created'
        );

        return reply.status(201).send(provider);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';

        // Check for duplicate name
        if (message.includes('already exists')) {
          fastify.log.warn(`Duplicate provider name: ${input.name}`);
          return reply.status(400).send({ error: message });
        }

        fastify.log.error(`Failed to create custom provider: ${message}`);
        return reply.status(500).send({
          error: 'Failed to create custom provider',
          message,
        });
      }
    }
  );

  /**
   * GET /api/admin/custom-providers/:id
   * Get a single custom provider by ID
   */
  fastify.get<{ Params: ProviderIdParams }>(
    '/:id',
    async (request: FastifyRequest<{ Params: ProviderIdParams }>, reply: FastifyReply) => {
      const { id } = request.params;

      // Validate UUID format
      if (!isValidUUID(id)) {
        return reply.status(400).send({ error: 'Invalid provider ID format' });
      }

      try {
        const provider = await service.get(id);

        if (!provider) {
          return reply.status(404).send({ error: `Provider with ID '${id}' not found` });
        }

        return reply.send(provider);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error(`Failed to get custom provider ${id}: ${message}`);
        return reply.status(500).send({
          error: 'Failed to retrieve custom provider',
          message,
        });
      }
    }
  );

  /**
   * PATCH /api/admin/custom-providers/:id
   * Update an existing custom provider
   */
  fastify.patch<{ Params: ProviderIdParams; Body: z.infer<typeof UpdateCustomProviderSchema> }>(
    '/:id',
    async (
      request: FastifyRequest<{
        Params: ProviderIdParams;
        Body: z.infer<typeof UpdateCustomProviderSchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      // Validate UUID format
      if (!isValidUUID(id)) {
        return reply.status(400).send({ error: 'Invalid provider ID format' });
      }

      // Validate request body
      const validation = UpdateCustomProviderSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: validation.error.issues,
        });
      }

      const updates = validation.data;

      try {
        const provider = await service.update(id, updates);

        fastify.log.info(
          { providerId: provider.id, providerName: provider.name },
          'Custom provider updated'
        );

        return reply.send(provider);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';

        // Check for specific error types
        if (message.includes('not found')) {
          return reply.status(404).send({ error: message });
        }
        if (message.includes('already exists')) {
          fastify.log.warn(`Duplicate provider name in update for ${id}`);
          return reply.status(400).send({ error: message });
        }

        fastify.log.error(`Failed to update custom provider ${id}: ${message}`);
        return reply.status(500).send({
          error: 'Failed to update custom provider',
          message,
        });
      }
    }
  );

  /**
   * DELETE /api/admin/custom-providers/:id
   * Delete a custom provider
   */
  fastify.delete<{ Params: ProviderIdParams }>(
    '/:id',
    async (request: FastifyRequest<{ Params: ProviderIdParams }>, reply: FastifyReply) => {
      const { id } = request.params;

      // Validate UUID format
      if (!isValidUUID(id)) {
        return reply.status(400).send({ error: 'Invalid provider ID format' });
      }

      try {
        await service.delete(id);

        fastify.log.info({ providerId: id }, 'Custom provider deleted');

        return reply.status(204).send();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';

        // Check if provider not found
        if (message.includes('not found')) {
          return reply.status(404).send({ error: message });
        }

        fastify.log.error(`Failed to delete custom provider ${id}: ${message}`);
        return reply.status(500).send({
          error: 'Failed to delete custom provider',
          message,
        });
      }
    }
  );

  /**
   * POST /api/admin/custom-providers/:id/test
   * Test connection for an existing provider
   */
  fastify.post<{ Params: ProviderIdParams }>(
    '/:id/test',
    async (request: FastifyRequest<{ Params: ProviderIdParams }>, reply: FastifyReply) => {
      const { id } = request.params;

      // Validate UUID format
      if (!isValidUUID(id)) {
        return reply.status(400).send({ error: 'Invalid provider ID format' });
      }

      try {
        // Get provider details
        const provider = await service.get(id);

        if (!provider) {
          return reply.status(404).send({ error: `Provider with ID '${id}' not found` });
        }

        // Get decrypted API key
        const apiKey = await service.getApiKey(id);

        // Test connection
        const result = await service.testConnection(provider.baseUrl, apiKey || undefined);

        fastify.log.info(
          { providerId: id, providerName: provider.name, valid: result.valid },
          'Custom provider connection tested'
        );

        return reply.send(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error(`Failed to test custom provider ${id}: ${message}`);
        return reply.status(500).send({
          error: 'Failed to test custom provider',
          message,
        });
      }
    }
  );

  /**
   * GET /api/admin/custom-providers/:id/models
   * Get/refresh discovered models for a provider
   */
  fastify.get<{ Params: ProviderIdParams }>(
    '/:id/models',
    async (request: FastifyRequest<{ Params: ProviderIdParams }>, reply: FastifyReply) => {
      const { id } = request.params;

      // Validate UUID format
      if (!isValidUUID(id)) {
        return reply.status(400).send({ error: 'Invalid provider ID format' });
      }

      try {
        // Verify provider exists
        const provider = await service.get(id);

        if (!provider) {
          return reply.status(404).send({ error: `Provider with ID '${id}' not found` });
        }

        // Refresh discovered models
        const models = await service.refreshDiscoveredModels(id);

        fastify.log.info(
          { providerId: id, providerName: provider.name, modelCount: models.length },
          'Custom provider models refreshed'
        );

        return reply.send({ models });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error(`Failed to refresh models for custom provider ${id}: ${message}`);
        return reply.status(500).send({
          error: 'Failed to refresh models',
          message,
        });
      }
    }
  );

  /**
   * POST /api/admin/custom-providers/test-connection
   * Test connection to a provider before saving (no DB persistence)
   */
  fastify.post<{ Body: z.infer<typeof TestConnectionSchema> }>(
    '/test-connection',
    async (
      request: FastifyRequest<{ Body: z.infer<typeof TestConnectionSchema> }>,
      reply: FastifyReply
    ) => {
      // Validate request body
      const validation = TestConnectionSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: validation.error.issues,
        });
      }

      const { baseUrl, apiKey } = validation.data;

      try {
        const result = await service.testConnection(baseUrl, apiKey);

        fastify.log.info(
          { baseUrl, valid: result.valid },
          'Custom provider connection test completed'
        );

        return reply.send(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error(`Failed to test connection to ${baseUrl}: ${message}`);
        return reply.status(500).send({
          error: 'Failed to test connection',
          message,
        });
      }
    }
  );

  // ==========================================================================
  // Phase 17K: Model Curation Routes
  // ==========================================================================

  /**
   * Validation schema for starred models update
   */
  const StarredModelsSchema = z.object({
    models: z.array(z.string()),
  });

  /**
   * Validation schema for models without tools update
   */
  const ModelsWithoutToolsSchema = z.object({
    models: z.array(z.string()),
  });

  /**
   * PATCH /api/admin/custom-providers/:id/starred-models
   * Update starred models for a provider
   */
  fastify.patch<{ Params: ProviderIdParams; Body: z.infer<typeof StarredModelsSchema> }>(
    '/:id/starred-models',
    async (
      request: FastifyRequest<{
        Params: ProviderIdParams;
        Body: z.infer<typeof StarredModelsSchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      if (!isValidUUID(id)) {
        return reply.status(400).send({ error: 'Invalid provider ID format' });
      }

      const validation = StarredModelsSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: validation.error.issues,
        });
      }

      try {
        await service.updateStarredModels(id, validation.data.models);

        fastify.log.info(
          { providerId: id, count: validation.data.models.length },
          'Updated starred models'
        );

        return reply.send({
          message: 'Starred models updated successfully',
          count: validation.data.models.length,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('not found')) {
          return reply.status(404).send({ error: message });
        }
        fastify.log.error(`Failed to update starred models for ${id}: ${message}`);
        return reply.status(500).send({ error: 'Failed to update starred models', message });
      }
    }
  );

  /**
   * PATCH /api/admin/custom-providers/:id/models-without-tools
   * Update models without tools list for a provider
   */
  fastify.patch<{ Params: ProviderIdParams; Body: z.infer<typeof ModelsWithoutToolsSchema> }>(
    '/:id/models-without-tools',
    async (
      request: FastifyRequest<{
        Params: ProviderIdParams;
        Body: z.infer<typeof ModelsWithoutToolsSchema>;
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;

      if (!isValidUUID(id)) {
        return reply.status(400).send({ error: 'Invalid provider ID format' });
      }

      const validation = ModelsWithoutToolsSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: validation.error.issues,
        });
      }

      try {
        await service.updateModelsWithoutTools(id, validation.data.models);

        fastify.log.info(
          { providerId: id, count: validation.data.models.length },
          'Updated models without tools'
        );

        return reply.send({
          message: 'Models without tools updated successfully',
          count: validation.data.models.length,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('not found')) {
          return reply.status(404).send({ error: message });
        }
        fastify.log.error(`Failed to update models without tools for ${id}: ${message}`);
        return reply.status(500).send({ error: 'Failed to update models without tools', message });
      }
    }
  );

  /**
   * POST /api/admin/custom-providers/:id/mark-no-tools/:model
   * Mark a single model as not supporting tools (used by auto-detection)
   */
  fastify.post<{ Params: { id: string; model: string } }>(
    '/:id/mark-no-tools/:model',
    async (
      request: FastifyRequest<{ Params: { id: string; model: string } }>,
      reply: FastifyReply
    ) => {
      const { id, model } = request.params;

      if (!isValidUUID(id)) {
        return reply.status(400).send({ error: 'Invalid provider ID format' });
      }

      // Decode the model name (it may be URL-encoded)
      const modelName = decodeURIComponent(model);

      try {
        await service.addModelWithoutTools(id, modelName);

        fastify.log.info(
          { providerId: id, model: modelName },
          'Marked model as not supporting tools'
        );

        return reply.send({
          message: `Model "${modelName}" marked as not supporting tools`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('not found')) {
          return reply.status(404).send({ error: message });
        }
        fastify.log.error(`Failed to mark model ${modelName} as no tools for ${id}: ${message}`);
        return reply.status(500).send({ error: 'Failed to mark model', message });
      }
    }
  );
}

export default customProviderRoutes;
