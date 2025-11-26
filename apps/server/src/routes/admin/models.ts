/**
 * Admin Model Configuration Routes
 *
 * Phase 4: API endpoints for managing model configurations
 *
 * Endpoints:
 * - GET  /api/admin/models          - Get all model configurations
 * - GET  /api/admin/models/:feature - Get specific feature configuration
 * - PUT  /api/admin/models/:feature - Update feature configuration
 * - DELETE /api/admin/models/:feature - Reset feature to default
 * - POST /api/admin/models/reset    - Reset all configurations to defaults
 */

import { getPool } from '@synthesis/db';
import type { ModelFeature } from '@synthesis/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  getModelConfigService,
  isValidFeature,
  isValidProviderForFeature,
} from '../../services/model-config-service.js';

/**
 * Validation schema for updating a model config
 */
const UpdateModelConfigSchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  localOnly: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

type UpdateModelConfigBody = z.infer<typeof UpdateModelConfigSchema>;

interface FeatureParams {
  feature: string;
}

/**
 * Register admin model configuration routes
 */
export async function adminModelRoutes(fastify: FastifyInstance): Promise<void> {
  const db = getPool();
  const modelConfigService = getModelConfigService(db);

  /**
   * GET /api/admin/models
   * Get all model configurations with provider metadata
   */
  fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const response = await modelConfigService.getModelConfigResponse();

      // Add API key status for each provider
      const missingApiKeys = modelConfigService.getMissingApiKeys();

      return reply.send({
        ...response,
        missingApiKeys,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error(`Failed to get model configs: ${message}`);
      return reply.status(500).send({
        error: 'Failed to retrieve model configurations',
        message,
      });
    }
  });

  /**
   * GET /api/admin/models/:feature
   * Get configuration for a specific feature
   */
  fastify.get<{ Params: FeatureParams }>(
    '/:feature',
    async (request: FastifyRequest<{ Params: FeatureParams }>, reply: FastifyReply) => {
      const { feature } = request.params;

      if (!isValidFeature(feature)) {
        return reply.status(400).send({
          error: 'Invalid feature',
          message: `Feature '${feature}' is not a valid model feature`,
          validFeatures: [
            'chat',
            'summary',
            'ocr',
            'embedding_docs',
            'embedding_code',
            'embedding_writing',
            'reranker',
            'contradiction',
          ],
        });
      }

      try {
        const config = await modelConfigService.getConfig(feature);

        // Check if API key is configured for this provider
        const apiKeyConfigured = modelConfigService.isApiKeyConfigured(config.provider);

        return reply.send({
          config,
          apiKeyConfigured,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error(`Failed to get config for ${feature}: ${message}`);
        return reply.status(500).send({
          error: 'Failed to retrieve configuration',
          message,
        });
      }
    }
  );

  /**
   * PUT /api/admin/models/:feature
   * Update configuration for a specific feature
   */
  fastify.put<{ Params: FeatureParams; Body: UpdateModelConfigBody }>(
    '/:feature',
    async (
      request: FastifyRequest<{ Params: FeatureParams; Body: UpdateModelConfigBody }>,
      reply: FastifyReply
    ) => {
      const { feature } = request.params;

      if (!isValidFeature(feature)) {
        return reply.status(400).send({
          error: 'Invalid feature',
          message: `Feature '${feature}' is not a valid model feature`,
        });
      }

      // Validate request body
      const parseResult = UpdateModelConfigSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parseResult.error.issues,
        });
      }

      const update = parseResult.data;

      // Validate provider if provided
      if (update.provider && !isValidProviderForFeature(feature as ModelFeature, update.provider)) {
        return reply.status(400).send({
          error: 'Invalid provider',
          message: `Provider '${update.provider}' is not valid for feature '${feature}'`,
        });
      }

      try {
        const config = await modelConfigService.setConfig(feature as ModelFeature, update);

        // Check if API key is configured for the new provider
        const apiKeyConfigured = modelConfigService.isApiKeyConfigured(config.provider);

        fastify.log.info(`Updated model config for ${feature}: ${config.provider}/${config.model}`);

        return reply.send({
          config,
          apiKeyConfigured,
          message: `Configuration for '${feature}' updated successfully`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error(`Failed to update config for ${feature}: ${message}`);

        // Check if it's a validation error
        if (message.includes('Invalid')) {
          return reply.status(400).send({
            error: 'Validation error',
            message,
          });
        }

        return reply.status(500).send({
          error: 'Failed to update configuration',
          message,
        });
      }
    }
  );

  /**
   * DELETE /api/admin/models/:feature
   * Reset a specific feature to default configuration
   */
  fastify.delete<{ Params: FeatureParams }>(
    '/:feature',
    async (request: FastifyRequest<{ Params: FeatureParams }>, reply: FastifyReply) => {
      const { feature } = request.params;

      if (!isValidFeature(feature)) {
        return reply.status(400).send({
          error: 'Invalid feature',
          message: `Feature '${feature}' is not a valid model feature`,
        });
      }

      try {
        const config = await modelConfigService.resetConfig(feature as ModelFeature);

        fastify.log.info(`Reset model config for ${feature} to defaults`);

        return reply.send({
          config,
          message: `Configuration for '${feature}' reset to defaults`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error(`Failed to reset config for ${feature}: ${message}`);
        return reply.status(500).send({
          error: 'Failed to reset configuration',
          message,
        });
      }
    }
  );

  /**
   * POST /api/admin/models/reset
   * Reset all configurations to defaults
   */
  fastify.post('/reset', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      await modelConfigService.resetAllConfigs();

      fastify.log.info('Reset all model configs to defaults');

      // Return the new default configurations
      const response = await modelConfigService.getModelConfigResponse();

      return reply.send({
        ...response,
        message: 'All configurations reset to defaults',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error(`Failed to reset all configs: ${message}`);
      return reply.status(500).send({
        error: 'Failed to reset configurations',
        message,
      });
    }
  });

  /**
   * POST /api/admin/models/validate
   * Validate a configuration without saving it
   */
  fastify.post<{ Body: { feature: string } & UpdateModelConfigBody }>(
    '/validate',
    async (
      request: FastifyRequest<{ Body: { feature: string } & UpdateModelConfigBody }>,
      reply: FastifyReply
    ) => {
      const { feature, provider, localOnly } = request.body;

      if (!feature || !isValidFeature(feature)) {
        return reply.status(400).send({
          valid: false,
          error: 'Invalid feature',
          message: `Feature '${feature}' is not a valid model feature`,
        });
      }

      const errors: string[] = [];

      // Validate provider
      if (provider && !isValidProviderForFeature(feature as ModelFeature, provider)) {
        errors.push(`Provider '${provider}' is not valid for feature '${feature}'`);
      }

      // Check API key
      if (provider && !modelConfigService.isApiKeyConfigured(provider)) {
        errors.push(`API key not configured for provider '${provider}'`);
      }

      // Check local-only constraint
      if (localOnly && provider) {
        const { PROVIDER_INFO } = await import('@synthesis/shared');
        const providerInfo = PROVIDER_INFO[provider];
        if (providerInfo && !providerInfo.isLocal) {
          errors.push(`Provider '${provider}' is not a local provider but local_only is enabled`);
        }
      }

      if (errors.length > 0) {
        return reply.send({
          valid: false,
          errors,
        });
      }

      return reply.send({
        valid: true,
        message: 'Configuration is valid',
      });
    }
  );
}

export default adminModelRoutes;
