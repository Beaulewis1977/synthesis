/**
 * Tool Definitions Index
 *
 * Phase 16F: Central export for all unified tool definitions.
 * Provides factory functions for building tools for different providers.
 */

import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import type { Pool } from 'pg';
import {
  buildAgentToolsFromDefinitions,
  buildChatToolsFromDefinitions,
  buildMcpSdkToolsFromDefinitions,
} from './adapters.js';
import { CORE_TOOLS } from './core/index.js';
import { GATEWAY_TOOLS } from './gateway/index.js';
import type {
  BuiltAgentTools,
  BuiltChatTools,
  ToolContext,
  UnifiedToolDefinition,
} from './types.js';

// =============================================================================
// Re-exports
// =============================================================================

export * from './types.js';
export * from './adapters.js';
export * from './toolpacks.js';
export { CORE_TOOLS } from './core/index.js';
export { GATEWAY_TOOLS } from './gateway/index.js';

// =============================================================================
// All Tool Definitions
// =============================================================================

/**
 * All available tool definitions (core + gateway for now)
 * Mobile, introspection, and graphing tools will be added in future phases
 */
export function getAllToolDefinitions(): UnifiedToolDefinition[] {
  return [
    ...CORE_TOOLS,
    ...GATEWAY_TOOLS,
    // TODO: Add mobile-core, introspection, graphing tools
  ];
}

/**
 * Get tool definitions by toolpack name
 */
export function getToolsByToolpack(toolpackName: string): UnifiedToolDefinition[] {
  const allTools = getAllToolDefinitions();
  return allTools.filter((tool) => tool.metadata.toolpack === toolpackName);
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Build agent tools from all definitions (for non-MCP providers)
 */
export function buildAllAgentTools(db: Pool, context: ToolContext): BuiltAgentTools {
  return buildAgentToolsFromDefinitions(getAllToolDefinitions(), db, context);
}

/**
 * Build chat tools from all definitions (for ChatProvider interface)
 */
export function buildAllChatTools(db: Pool, context: ToolContext): BuiltChatTools {
  return buildChatToolsFromDefinitions(getAllToolDefinitions(), db, context);
}

/**
 * MCP Server name for tool namespacing
 */
export const MCP_SERVER_NAME = 'synthesis-rag-tools';

/**
 * Build an MCP server with all tools for Claude Agent SDK
 */
export function buildMcpServerFromDefinitions(db: Pool, context: ToolContext) {
  const mcpTools = buildMcpSdkToolsFromDefinitions(getAllToolDefinitions(), db, context);

  return createSdkMcpServer({
    name: MCP_SERVER_NAME,
    version: '1.0.0',
    tools: mcpTools,
  });
}

/**
 * Get all MCP tool names (for allowedTools configuration)
 */
export function getMcpToolNames(): string[] {
  return getAllToolDefinitions().map((tool) => `mcp__${MCP_SERVER_NAME}__${tool.name}`);
}

// =============================================================================
// Registry Initialization
// =============================================================================

/**
 * Register all tool definitions with the registry
 */
export function registerAllTools(): void {
  // Import dynamically to avoid circular dependency
  import('../../services/tool-registry.js').then(({ getToolRegistry }) => {
    const registry = getToolRegistry();
    registry.registerTools(getAllToolDefinitions());
    console.info(`[ToolDefinitions] Registered ${registry.size} tools`);
  });
}
