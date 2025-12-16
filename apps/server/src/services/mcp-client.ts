/**
 * MCP Client Manager Service
 *
 * Manages external MCP server configurations and provides them to the Anthropic SDK.
 * Supports stdio-based servers (local processes) and HTTP/SSE servers (remote).
 *
 * Key responsibilities:
 * - Load enabled MCP server configurations from database
 * - Convert configs to SDK-compatible format
 * - Test connections to external MCP servers
 * - Manage API keys (from env vars or database)
 */

import { getMcpServerConfig, getPool, listEnabledMcpServerConfigs } from '@synthesis/db';
import type {
  McpConnectionTestResult,
  McpHttpConfig,
  McpServerConfig,
  McpServerForSdk,
  McpStdioConfig,
} from '@synthesis/shared';
import { getApiKeyService } from './api-key-service.js';

/**
 * MCP Client Manager
 *
 * Singleton service for managing external MCP servers.
 */
export class McpClientManager {
  /**
   * Get all enabled MCP servers in SDK-compatible format.
   * This is called when initializing a chat session to merge external servers.
   *
   * @returns Record of server name to SDK server config
   */
  async getEnabledMcpServersForSdk(): Promise<Record<string, McpServerForSdk>> {
    const servers: Record<string, McpServerForSdk> = {};

    try {
      const configs = await listEnabledMcpServerConfigs();

      for (const config of configs) {
        // Get API key from env or database
        const apiKeyValue = config.apiKeyEnvVar
          ? await this.getApiKey(config.name, config.apiKeyEnvVar)
          : null;

        const sdkConfig = this.configToSdkFormat(config, apiKeyValue);
        if (sdkConfig) {
          servers[config.name] = sdkConfig;
        }
      }
    } catch (error) {
      console.error('[McpClientManager] Failed to load MCP server configs:', error);
    }

    return servers;
  }

  /**
   * Convert a database config to SDK format.
   * Only stdio servers are currently supported by the SDK.
   *
   * @param config The database config
   * @param apiKeyValue Optional pre-fetched API key value
   * @returns SDK-compatible config or null if not supported
   */
  private configToSdkFormat(
    config: McpServerConfig,
    apiKeyValue?: string | null
  ): McpServerForSdk | null {
    // Only stdio servers are supported by the SDK currently
    if (config.serverType !== 'stdio') {
      console.warn(
        `[McpClientManager] Server type '${config.serverType}' not supported for SDK integration: ${config.name}`
      );
      return null;
    }

    const stdioConfig = config.config as McpStdioConfig;

    // Build environment variables, including API key if configured
    const env: Record<string, string> = { ...stdioConfig.env };

    // Inject API key if apiKeyEnvVar is set and we have a value
    if (config.apiKeyEnvVar && apiKeyValue) {
      env[config.apiKeyEnvVar] = apiKeyValue;
    } else if (config.apiKeyEnvVar && !apiKeyValue) {
      console.warn(
        `[McpClientManager] API key not configured for server: ${config.name} (env var: ${config.apiKeyEnvVar})`
      );
    }

    return {
      command: stdioConfig.command,
      args: stdioConfig.args,
      env: Object.keys(env).length > 0 ? env : undefined,
      cwd: stdioConfig.cwd,
    };
  }

  /**
   * Get API key for an MCP server.
   * Checks environment variable first, then database.
   *
   * @param serverName The MCP server name (used as provider prefix in db)
   * @param envVar The environment variable name
   * @returns API key value or null if not configured
   */
  async getApiKey(serverName: string, envVar: string): Promise<string | null> {
    // Check environment variable first
    const envValue = process.env[envVar];
    if (envValue) {
      return envValue;
    }

    // Check database with mcp_ prefix
    try {
      const apiKeyService = getApiKeyService(getPool());
      const dbKey = await apiKeyService.getKey(`mcp_${serverName}`);
      return dbKey;
    } catch (error) {
      console.error(
        `[McpClientManager] Failed to get API key from database for ${serverName}:`,
        error
      );
      return null;
    }
  }

  /**
   * Check if API key is configured for an MCP server.
   *
   * @param serverName The MCP server name
   * @param envVar The environment variable name
   * @returns True if configured (in env or db)
   */
  async isApiKeyConfiguredAsync(serverName: string, envVar: string): Promise<boolean> {
    const key = await this.getApiKey(serverName, envVar);
    return !!key;
  }

  /**
   * Test connection to an MCP server.
   * For stdio servers, attempts to spawn the process and check for tools.
   *
   * @param configId The ID of the config to test
   * @returns Test result with success status and discovered tools
   */
  async testConnection(configId: string): Promise<McpConnectionTestResult> {
    const startTime = Date.now();

    try {
      const config = await getMcpServerConfig(configId);
      if (!config) {
        return { success: false, error: 'Configuration not found' };
      }

      if (config.serverType === 'stdio') {
        return await this.testStdioServer(config, startTime);
      }
      if (config.serverType === 'sse' || config.serverType === 'http') {
        return await this.testHttpServer(config, startTime);
      }

      return { success: false, error: `Unsupported server type: ${config.serverType}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Test a stdio-based MCP server by spawning the process.
   */
  private async testStdioServer(
    config: McpServerConfig,
    startTime: number
  ): Promise<McpConnectionTestResult> {
    const { spawn } = await import('node:child_process');

    const stdioConfig = config.config as McpStdioConfig;

    // Build environment with API key - filter out undefined values from process.env
    const processEnv = Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => entry[1] !== undefined
      )
    );
    const env: Record<string, string> = {
      ...processEnv,
      ...stdioConfig.env,
    };

    if (config.apiKeyEnvVar) {
      // Get API key from env or database
      const apiKeyValue = await this.getApiKey(config.name, config.apiKeyEnvVar);
      if (!apiKeyValue) {
        return {
          success: false,
          serverName: config.name,
          error: `Required API key not configured: ${config.apiKeyEnvVar}`,
          latencyMs: Date.now() - startTime,
        };
      }
      env[config.apiKeyEnvVar] = apiKeyValue;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        child.kill();
        resolve({
          success: false,
          serverName: config.name,
          error: 'Connection timeout (10s)',
          latencyMs: Date.now() - startTime,
        });
      }, 10000);

      const child = spawn(stdioConfig.command, stdioConfig.args || [], {
        env,
        cwd: stdioConfig.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Send initialize request (MCP protocol)
      const initRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'synthesis-test',
            version: '1.0.0',
          },
        },
      });

      child.stdin?.write(initRequest + '\n');

      // Wait for response
      setTimeout(() => {
        clearTimeout(timeout);
        child.kill();

        // Parse response to check for success
        try {
          const lines = stdout.split('\n').filter((l) => l.trim());
          for (const line of lines) {
            const response = JSON.parse(line);
            if (response.result?.serverInfo) {
              resolve({
                success: true,
                serverName: response.result.serverInfo.name || config.name,
                latencyMs: Date.now() - startTime,
              });
              return;
            }
          }
        } catch {
          // Parse error, check if stderr has useful info
        }

        if (stderr.includes('error') || stderr.includes('Error')) {
          resolve({
            success: false,
            serverName: config.name,
            error: stderr.substring(0, 200),
            latencyMs: Date.now() - startTime,
          });
        } else {
          // Process started but didn't respond to MCP protocol
          resolve({
            success: true,
            serverName: config.name,
            latencyMs: Date.now() - startTime,
          });
        }
      }, 3000);

      child.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          serverName: config.name,
          error: `Failed to spawn process: ${error.message}`,
          latencyMs: Date.now() - startTime,
        });
      });

      child.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          clearTimeout(timeout);
          resolve({
            success: false,
            serverName: config.name,
            error: `Process exited with code ${code}: ${stderr.substring(0, 200)}`,
            latencyMs: Date.now() - startTime,
          });
        }
      });
    });
  }

  /**
   * Test an HTTP/SSE-based MCP server.
   */
  private async testHttpServer(
    config: McpServerConfig,
    startTime: number
  ): Promise<McpConnectionTestResult> {
    const httpConfig = config.config as McpHttpConfig;

    try {
      const response = await fetch(httpConfig.url, {
        method: 'GET',
        headers: {
          ...httpConfig.headers,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(httpConfig.timeout || 10000),
      });

      if (response.ok) {
        return {
          success: true,
          serverName: config.name,
          latencyMs: Date.now() - startTime,
        };
      }

      return {
        success: false,
        serverName: config.name,
        error: `HTTP ${response.status}: ${response.statusText}`,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        serverName: config.name,
        error: error instanceof Error ? error.message : 'Connection failed',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Check if an API key environment variable is configured.
   *
   * @param envVar The environment variable name
   * @returns True if the env var is set
   */
  isApiKeyConfigured(envVar: string): boolean {
    return !!process.env[envVar];
  }
}

// Singleton instance
let mcpClientManager: McpClientManager | null = null;

/**
 * Get the singleton MCP client manager instance.
 */
export function getMcpClientManager(): McpClientManager {
  if (!mcpClientManager) {
    mcpClientManager = new McpClientManager();
  }
  return mcpClientManager;
}
