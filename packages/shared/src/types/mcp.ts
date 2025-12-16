/**
 * MCP Server Configuration Types
 *
 * Types for configuring external MCP servers (Perplexity, custom servers, etc.)
 * Used by both backend (mcp-client service) and frontend (settings UI).
 */

// =============================================================================
// Server Type
// =============================================================================

/**
 * MCP server connection types
 * - stdio: Local process communication via stdin/stdout
 * - sse: Server-Sent Events over HTTP
 * - http: HTTP/REST-based communication
 */
export type McpServerType = 'stdio' | 'sse' | 'http';

// =============================================================================
// Config Schemas
// =============================================================================

/**
 * Configuration for stdio-based MCP servers (local processes)
 */
export interface McpStdioConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

/**
 * Configuration for SSE/HTTP-based MCP servers (remote)
 */
export interface McpHttpConfig {
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Union type for all MCP server configurations
 */
export type McpServerConfigData = McpStdioConfig | McpHttpConfig;

// =============================================================================
// Database Model
// =============================================================================

/**
 * MCP server configuration as stored in database
 */
export interface McpServerConfig {
  id: string;
  name: string;
  displayName: string | null;
  serverType: McpServerType;
  config: McpServerConfigData;
  apiKeyEnvVar: string | null;
  enabled: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * MCP server configuration for create operations
 */
export interface CreateMcpServerConfig {
  name: string;
  displayName?: string;
  serverType: McpServerType;
  config: McpServerConfigData;
  apiKeyEnvVar?: string;
  enabled?: boolean;
  description?: string;
}

/**
 * MCP server configuration for update operations
 */
export interface UpdateMcpServerConfig {
  displayName?: string | null;
  serverType?: McpServerType;
  config?: McpServerConfigData;
  apiKeyEnvVar?: string | null;
  enabled?: boolean;
  description?: string | null;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * MCP server returned from API (safe, no sensitive data)
 */
export interface McpServerResponse {
  id: string;
  name: string;
  displayName: string | null;
  serverType: McpServerType;
  config: McpServerConfigData;
  apiKeyEnvVar: string | null;
  apiKeyConfigured: boolean; // True if env var is set
  enabled: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Test connection result
 */
export interface McpConnectionTestResult {
  success: boolean;
  serverName?: string;
  tools?: string[];
  error?: string;
  latencyMs?: number;
}

// =============================================================================
// SDK Integration Types
// =============================================================================

/**
 * MCP server definition for Anthropic SDK mcpServers option
 */
export interface McpServerForSdk {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

// =============================================================================
// Presets
// =============================================================================

/**
 * Known MCP server presets for easy configuration
 */
export interface McpServerPreset {
  name: string;
  displayName: string;
  description: string;
  serverType: McpServerType;
  config: McpServerConfigData;
  apiKeyEnvVar?: string;
  documentationUrl?: string;
}

/**
 * Available MCP server presets
 */
export const MCP_SERVER_PRESETS: McpServerPreset[] = [
  {
    name: 'perplexity',
    displayName: 'Perplexity AI',
    description: 'Web search and research via Perplexity AI',
    serverType: 'stdio',
    config: {
      command: 'npx',
      args: ['-y', '@perplexity-ai/mcp-server'],
    },
    apiKeyEnvVar: 'PERPLEXITY_API_KEY',
    documentationUrl: 'https://github.com/perplexityai/modelcontextprotocol',
  },
  {
    name: 'brave-search',
    displayName: 'Brave Search',
    description: 'Web search via Brave Search API',
    serverType: 'stdio',
    config: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
    },
    apiKeyEnvVar: 'BRAVE_API_KEY',
    documentationUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search',
  },
  {
    name: 'filesystem',
    displayName: 'Filesystem',
    description: 'Read and write files on the local filesystem',
    serverType: 'stdio',
    config: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
    },
    documentationUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
  },
];
