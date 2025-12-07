/**
 * Provider Settings Routes
 *
 * Phase 16G: Admin endpoints for managing provider-specific settings.
 *
 * Endpoints:
 * - GET  /api/admin/provider-settings                    - Get all provider settings
 * - GET  /api/admin/provider-settings/:provider          - Get settings for a provider
 * - PUT  /api/admin/provider-settings/:provider/:key     - Set a provider setting
 * - DELETE /api/admin/provider-settings/:provider/:key   - Delete a provider setting
 */

import { getPool } from '@synthesis/db';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getProviderSettingsService } from '../../services/api-key-service.js';

/**
 * Validation schema for setting a provider setting
 */
const SetSettingSchema = z.object({
  value: z.string(),
});

interface ProviderParams {
  provider: string;
}

interface SettingParams {
  provider: string;
  key: string;
}

/**
 * Register provider settings routes
 */
export async function providerSettingsRoutes(fastify: FastifyInstance): Promise<void> {
  const db = getPool();
  const settingsService = getProviderSettingsService(db);

  /**
   * GET /api/admin/provider-settings
   * Get all provider settings
   */
  fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const settings = await settingsService.getAllSettings();
      return reply.send({ settings });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error(`Failed to get provider settings: ${message}`);
      return reply.status(500).send({
        error: 'Failed to retrieve provider settings',
        message,
      });
    }
  });

  /**
   * GET /api/admin/provider-settings/:provider
   * Get settings for a specific provider
   */
  fastify.get<{ Params: ProviderParams }>(
    '/:provider',
    async (request: FastifyRequest<{ Params: ProviderParams }>, reply: FastifyReply) => {
      const { provider } = request.params;

      try {
        const settings = await settingsService.getProviderSettings(provider);
        return reply.send({ provider, settings });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error(`Failed to get settings for ${provider}: ${message}`);
        return reply.status(500).send({
          error: 'Failed to retrieve provider settings',
          message,
        });
      }
    }
  );

  /**
   * PUT /api/admin/provider-settings/:provider/:key
   * Set a provider setting
   */
  fastify.put<{ Params: SettingParams; Body: z.infer<typeof SetSettingSchema> }>(
    '/:provider/:key',
    async (
      request: FastifyRequest<{ Params: SettingParams; Body: z.infer<typeof SetSettingSchema> }>,
      reply: FastifyReply
    ) => {
      const { provider, key } = request.params;

      // Validate request body
      const parseResult = SetSettingSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parseResult.error.issues,
        });
      }

      const { value } = parseResult.data;

      try {
        await settingsService.setSetting(provider, key, value);

        fastify.log.info(`Provider setting updated: ${provider}.${key}`);

        return reply.send({
          message: `Setting ${key} for ${provider} saved successfully`,
          provider,
          key,
          value,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error(`Failed to set setting ${provider}.${key}: ${message}`);
        return reply.status(500).send({
          error: 'Failed to save provider setting',
          message,
        });
      }
    }
  );

  /**
   * DELETE /api/admin/provider-settings/:provider/:key
   * Delete a provider setting
   */
  fastify.delete<{ Params: SettingParams }>(
    '/:provider/:key',
    async (request: FastifyRequest<{ Params: SettingParams }>, reply: FastifyReply) => {
      const { provider, key } = request.params;

      try {
        await settingsService.deleteSetting(provider, key);

        fastify.log.info(`Provider setting deleted: ${provider}.${key}`);

        return reply.status(204).send();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error(`Failed to delete setting ${provider}.${key}: ${message}`);
        return reply.status(500).send({
          error: 'Failed to delete provider setting',
          message,
        });
      }
    }
  );
}

export default providerSettingsRoutes;
