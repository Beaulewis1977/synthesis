/**
 * MCP Server Configuration Routes
 *
 * CRUD operations for external MCP server configurations.
 * Allows users to add, update, delete, and test MCP servers like Perplexity.
 */

import {
  createMcpServerConfig,
  deleteMcpServerConfig,
  getMcpServerConfig,
  getPool,
  listMcpServerConfigs,
  setMcpServerEnabled,
  updateMcpServerConfig,
} from '@synthesis/db';
import type { McpServerResponse } from '@synthesis/shared';
import { MCP_SERVER_PRESETS } from '@synthesis/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getApiKeyService } from '../../services/api-key-service.js';
import { getMcpClientManager } from '../../services/mcp-client.js';

// =============================================================================
// Schemas
// =============================================================================

const StdioConfigSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
});

const HttpConfigSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  timeout: z.number().positive().optional(),
});

const CreateMcpServerSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9_-]+$/i, 'Name must be alphanumeric with dashes/underscores'),
  displayName: z.string().max(255).optional(),
  serverType: z.enum(['stdio', 'sse', 'http']),
  config: z.union([StdioConfigSchema, HttpConfigSchema]),
  apiKeyEnvVar: z.string().max(100).optional(),
  enabled: z.boolean().optional().default(true),
  description: z.string().optional(),
});

const UpdateMcpServerSchema = z.object({
  displayName: z.string().max(255).optional().nullable(),
  serverType: z.enum(['stdio', 'sse', 'http']).optional(),
  config: z.union([StdioConfigSchema, HttpConfigSchema]).optional(),
  apiKeyEnvVar: z.string().max(100).optional().nullable(),
  enabled: z.boolean().optional(),
  description: z.string().optional().nullable(),
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert a database config to API response format.
 * Checks if API key is configured (from env var or database).
 */
async function toResponse(
  config: Awaited<ReturnType<typeof getMcpServerConfig>>
): Promise<McpServerResponse | null> {
  if (!config) return null;

  // Check if API key is configured (env var or database)
  let apiKeyConfigured = true;
  if (config.apiKeyEnvVar) {
    const mcpClient = getMcpClientManager();
    apiKeyConfigured = await mcpClient.isApiKeyConfiguredAsync(config.name, config.apiKeyEnvVar);
  }

  return {
    id: config.id,
    name: config.name,
    displayName: config.displayName,
    serverType: config.serverType,
    config: config.config,
    apiKeyEnvVar: config.apiKeyEnvVar,
    apiKeyConfigured,
    enabled: config.enabled,
    description: config.description,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  };
}

// =============================================================================
// Routes
// =============================================================================

export const mcpServerRoutes: FastifyPluginAsync = async (fastify) => {
  const mcpClient = getMcpClientManager();

  // GET / - List all MCP server configs
  fastify.get('/', async (_request, reply) => {
    try {
      const configs = await listMcpServerConfigs();
      const servers = await Promise.all(configs.map(toResponse));
      return reply.send({ servers: servers.filter((s): s is McpServerResponse => s !== null) });
    } catch (error) {
      fastify.log.error(error, 'Failed to list MCP servers');
      return reply.code(500).send({ error: 'Failed to list MCP servers' });
    }
  });

  // GET /presets - List available presets
  fastify.get('/presets', async (_request, reply) => {
    return reply.send({ presets: MCP_SERVER_PRESETS });
  });

  // GET /:id - Get a specific MCP server config
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const config = await getMcpServerConfig(id);
      if (!config) {
        return reply.code(404).send({ error: 'MCP server not found' });
      }

      return reply.send({ server: await toResponse(config) });
    } catch (error) {
      fastify.log.error(error, 'Failed to get MCP server');
      return reply.code(500).send({ error: 'Failed to get MCP server' });
    }
  });

  // POST / - Create a new MCP server config
  fastify.post('/', async (request, reply) => {
    const validation = CreateMcpServerSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.code(400).send({
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const data = validation.data;

    try {
      const config = await createMcpServerConfig({
        name: data.name,
        displayName: data.displayName,
        serverType: data.serverType,
        config: data.config,
        apiKeyEnvVar: data.apiKeyEnvVar,
        enabled: data.enabled,
        description: data.description,
      });

      return reply.code(201).send({ server: await toResponse(config) });
    } catch (error) {
      fastify.log.error(error, 'Failed to create MCP server');

      // Check for unique constraint violation
      if (error instanceof Error && error.message.includes('unique')) {
        return reply.code(409).send({ error: 'An MCP server with this name already exists' });
      }

      return reply.code(500).send({ error: 'Failed to create MCP server' });
    }
  });

  // PATCH /:id - Update an MCP server config
  fastify.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const validation = UpdateMcpServerSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.code(400).send({
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    try {
      const existing = await getMcpServerConfig(id);
      if (!existing) {
        return reply.code(404).send({ error: 'MCP server not found' });
      }

      const config = await updateMcpServerConfig(id, validation.data);
      return reply.send({ server: await toResponse(config) });
    } catch (error) {
      fastify.log.error(error, 'Failed to update MCP server');
      return reply.code(500).send({ error: 'Failed to update MCP server' });
    }
  });

  // PATCH /:id/enabled - Toggle enabled status
  fastify.patch<{ Params: { id: string }; Body: { enabled: boolean } }>(
    '/:id/enabled',
    async (request, reply) => {
      const { id } = request.params;
      const { enabled } = request.body;

      if (typeof enabled !== 'boolean') {
        return reply.code(400).send({ error: 'enabled must be a boolean' });
      }

      try {
        const config = await setMcpServerEnabled(id, enabled);
        if (!config) {
          return reply.code(404).send({ error: 'MCP server not found' });
        }

        return reply.send({ server: await toResponse(config) });
      } catch (error) {
        fastify.log.error(error, 'Failed to update MCP server enabled status');
        return reply.code(500).send({ error: 'Failed to update MCP server' });
      }
    }
  );

  // DELETE /:id - Delete an MCP server config
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const deleted = await deleteMcpServerConfig(id);
      if (!deleted) {
        return reply.code(404).send({ error: 'MCP server not found' });
      }

      return reply.send({ success: true, message: 'MCP server deleted' });
    } catch (error) {
      fastify.log.error(error, 'Failed to delete MCP server');
      return reply.code(500).send({ error: 'Failed to delete MCP server' });
    }
  });

  // POST /:id/test - Test connection to an MCP server
  fastify.post<{ Params: { id: string } }>('/:id/test', async (request, reply) => {
    const { id } = request.params;

    try {
      const config = await getMcpServerConfig(id);
      if (!config) {
        return reply.code(404).send({ error: 'MCP server not found' });
      }

      const result = await mcpClient.testConnection(id);
      return reply.send(result);
    } catch (error) {
      fastify.log.error(error, 'Failed to test MCP server connection');
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      });
    }
  });

  // POST /:id/api-key - Set API key for an MCP server
  fastify.post<{ Params: { id: string }; Body: { apiKey: string } }>(
    '/:id/api-key',
    async (request, reply) => {
      const { id } = request.params;
      const { apiKey } = request.body;

      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        return reply.code(400).send({ error: 'API key is required' });
      }

      try {
        const config = await getMcpServerConfig(id);
        if (!config) {
          return reply.code(404).send({ error: 'MCP server not found' });
        }

        if (!config.apiKeyEnvVar) {
          return reply.code(400).send({ error: 'This MCP server does not require an API key' });
        }

        // Store API key with mcp_ prefix
        const apiKeyService = getApiKeyService(getPool());
        await apiKeyService.setKey(`mcp_${config.name}`, apiKey.trim());

        return reply.send({
          success: true,
          message: `API key set for ${config.name}`,
          server: await toResponse(config),
        });
      } catch (error) {
        fastify.log.error(error, 'Failed to set MCP server API key');
        return reply.code(500).send({ error: 'Failed to set API key' });
      }
    }
  );

  // DELETE /:id/api-key - Delete API key for an MCP server
  fastify.delete<{ Params: { id: string } }>('/:id/api-key', async (request, reply) => {
    const { id } = request.params;

    try {
      const config = await getMcpServerConfig(id);
      if (!config) {
        return reply.code(404).send({ error: 'MCP server not found' });
      }

      // Delete API key with mcp_ prefix
      const apiKeyService = getApiKeyService(getPool());
      await apiKeyService.deleteKey(`mcp_${config.name}`);

      return reply.send({
        success: true,
        message: `API key deleted for ${config.name}`,
        server: await toResponse(config),
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to delete MCP server API key');
      return reply.code(500).send({ error: 'Failed to delete API key' });
    }
  });
};
