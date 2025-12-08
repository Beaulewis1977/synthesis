/**
 * API Key Management Routes
 *
 * Phase 6: Admin endpoints for managing API keys.
 * Phase 17A: Added OAuth token management for Anthropic.
 *
 * Endpoints:
 * - GET  /api/admin/api-keys                   - Get status of all API keys
 * - POST /api/admin/api-keys                   - Set an API key
 * - DELETE /api/admin/api-keys/:provider       - Delete an API key
 * - POST /api/admin/api-keys/:provider/test    - Test an API key
 * - GET  /api/admin/api-keys/oauth/status      - Get OAuth token status (Anthropic)
 * - POST /api/admin/api-keys/oauth             - Set OAuth token (Anthropic)
 * - DELETE /api/admin/api-keys/oauth           - Delete OAuth token (Anthropic)
 * - POST /api/admin/api-keys/oauth/test        - Test OAuth token (Anthropic)
 */

import { getPool } from '@synthesis/db';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getApiKeyService } from '../../services/api-key-service.js';

/**
 * Validation schema for setting an API key
 */
const SetApiKeySchema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().min(1),
});

/**
 * Validation schema for setting an OAuth token
 */
const SetOAuthTokenSchema = z.object({
  token: z.string().min(1),
});

interface ProviderParams {
  provider: string;
}

/**
 * Register API key management routes
 */
export async function apiKeyRoutes(fastify: FastifyInstance): Promise<void> {
  const db = getPool();
  const apiKeyService = getApiKeyService(db);

  /**
   * GET /api/admin/api-keys
   * Get status of all API keys
   */
  fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const keys = await apiKeyService.getAllKeyStatus();
      return reply.send({ keys });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error(`Failed to get API key status: ${message}`);
      return reply.status(500).send({
        error: 'Failed to retrieve API key status',
        message,
      });
    }
  });

  /**
   * POST /api/admin/api-keys
   * Set or update an API key
   */
  fastify.post<{ Body: z.infer<typeof SetApiKeySchema> }>(
    '/',
    async (
      request: FastifyRequest<{ Body: z.infer<typeof SetApiKeySchema> }>,
      reply: FastifyReply
    ) => {
      // Validate request body
      const parseResult = SetApiKeySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parseResult.error.issues,
        });
      }

      const { provider, apiKey } = parseResult.data;

      try {
        await apiKeyService.setKey(provider, apiKey);

        fastify.log.info('API key configuration updated');

        return reply.send({
          message: `API key for ${provider} saved successfully`,
          provider,
          configured: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error(`Failed to set API key for ${provider}: ${message}`);
        return reply.status(500).send({
          error: 'Failed to save API key',
          message,
        });
      }
    }
  );

  /**
   * DELETE /api/admin/api-keys/:provider
   * Delete an API key
   */
  fastify.delete<{ Params: ProviderParams }>(
    '/:provider',
    async (request: FastifyRequest<{ Params: ProviderParams }>, reply: FastifyReply) => {
      const { provider } = request.params;

      try {
        await apiKeyService.deleteKey(provider);

        fastify.log.info(`API key deleted for provider: ${provider}`);

        return reply.send({
          message: `API key for ${provider} deleted successfully`,
          provider,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';

        if (message.includes('No stored API key')) {
          return reply.status(404).send({
            error: 'API key not found',
            message,
          });
        }

        fastify.log.error(`Failed to delete API key for ${provider}: ${message}`);
        return reply.status(500).send({
          error: 'Failed to delete API key',
          message,
        });
      }
    }
  );

  /**
   * POST /api/admin/api-keys/:provider/test
   * Test an API key
   */
  fastify.post<{ Params: ProviderParams }>(
    '/:provider/test',
    async (request: FastifyRequest<{ Params: ProviderParams }>, reply: FastifyReply) => {
      const { provider } = request.params;

      try {
        const result = await apiKeyService.testKey(provider);

        fastify.log.info(`API key test for ${provider}: ${result.valid ? 'valid' : 'invalid'}`);

        return reply.send(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error(`Failed to test API key for ${provider}: ${message}`);
        return reply.status(500).send({
          valid: false,
          message: `Test failed: ${message}`,
        });
      }
    }
  );

  // ==========================================================================
  // OAuth Token Routes (Phase 17A - Anthropic only)
  // ==========================================================================

  /**
   * GET /api/admin/api-keys/oauth/status
   * Get OAuth token status for Anthropic
   */
  fastify.get('/oauth/status', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = await apiKeyService.getOAuthTokenStatus();
      return reply.send(status);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error(`Failed to get OAuth token status: ${message}`);
      return reply.status(500).send({
        error: 'Failed to retrieve OAuth token status',
        message,
      });
    }
  });

  /**
   * POST /api/admin/api-keys/oauth
   * Set OAuth token for Anthropic
   */
  fastify.post<{ Body: z.infer<typeof SetOAuthTokenSchema> }>(
    '/oauth',
    async (
      request: FastifyRequest<{ Body: z.infer<typeof SetOAuthTokenSchema> }>,
      reply: FastifyReply
    ) => {
      const parseResult = SetOAuthTokenSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parseResult.error.issues,
        });
      }

      const { token } = parseResult.data;

      try {
        await apiKeyService.setOAuthToken('anthropic', token);

        fastify.log.info('Anthropic OAuth token saved');

        return reply.send({
          message: 'OAuth token saved successfully',
          provider: 'anthropic',
          configured: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error(`Failed to set OAuth token: ${message}`);
        return reply.status(500).send({
          error: 'Failed to save OAuth token',
          message,
        });
      }
    }
  );

  /**
   * DELETE /api/admin/api-keys/oauth
   * Delete OAuth token for Anthropic
   */
  fastify.delete('/oauth', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      await apiKeyService.deleteOAuthToken('anthropic');

      fastify.log.info('Anthropic OAuth token deleted');

      return reply.send({
        message: 'OAuth token deleted successfully',
        provider: 'anthropic',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message.includes('No stored OAuth token')) {
        return reply.status(404).send({
          error: 'OAuth token not found',
          message,
        });
      }

      fastify.log.error(`Failed to delete OAuth token: ${message}`);
      return reply.status(500).send({
        error: 'Failed to delete OAuth token',
        message,
      });
    }
  });

  /**
   * POST /api/admin/api-keys/oauth/test
   * Test OAuth token for Anthropic
   */
  fastify.post('/oauth/test', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await apiKeyService.testAnthropicOAuth();

      fastify.log.info(`Anthropic OAuth test: ${result.valid ? 'valid' : 'invalid'}`);

      return reply.send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error(`Failed to test OAuth token: ${message}`);
      return reply.status(500).send({
        valid: false,
        message: `Test failed: ${message}`,
      });
    }
  });
}

export default apiKeyRoutes;
