/**
 * Registry Bridge
 *
 * Phase 16F: Bridges the DynamicToolRegistry with ChatProvider implementations.
 * Provides filtered tools based on session-enabled tools.
 */

import type { Pool } from 'pg';
import {
  buildAgentToolsFromDefinitions,
  buildChatToolsFromDefinitions,
} from '../../agent/tool-definitions/adapters.js';
import {
  MCP_SERVER_NAME,
  buildAllAgentTools,
  buildAllChatTools,
  buildMcpServerFromDefinitions,
  getAllToolDefinitions,
  getMcpToolNames,
} from '../../agent/tool-definitions/index.js';
import type {
  BuiltAgentTools,
  BuiltChatTools,
  UnifiedToolDefinition,
} from '../../agent/tool-definitions/types.js';
import { getToolRegistry } from '../tool-registry.js';
import type { ToolContext } from './types.js';

// =============================================================================
// Tool Filtering Functions
// =============================================================================

/**
 * Get enabled tool definitions for a session
 * If no sessionId, returns all tools (backward compatible)
 */
export function getSessionEnabledDefinitions(
  sessionId: string | undefined
): UnifiedToolDefinition[] {
  if (!sessionId) {
    // No session = all tools available (backward compatible)
    return getAllToolDefinitions();
  }

  const registry = getToolRegistry();
  const enabledNames = registry.getEnabledTools(sessionId);

  return enabledNames
    .map((name) => registry.getToolDefinition(name))
    .filter((def): def is UnifiedToolDefinition => def !== undefined);
}

/**
 * Build agent tools filtered by session-enabled tools
 * Uses the adapter functions for proper type handling
 */
export function getSessionAgentTools(db: Pool, context: ToolContext): BuiltAgentTools {
  if (!context.sessionId) {
    // No session = all tools (backward compatible)
    return buildAllAgentTools(db, context);
  }

  const definitions = getSessionEnabledDefinitions(context.sessionId);
  return buildAgentToolsFromDefinitions(definitions, db, context);
}

/**
 * Build chat tools filtered by session-enabled tools
 * Uses the adapter functions for proper type handling
 */
export function getSessionChatTools(db: Pool, context: ToolContext): BuiltChatTools {
  if (!context.sessionId) {
    // No session = all tools (backward compatible)
    return buildAllChatTools(db, context);
  }

  const definitions = getSessionEnabledDefinitions(context.sessionId);
  return buildChatToolsFromDefinitions(definitions, db, context);
}

/**
 * Build MCP server filtered by session-enabled tools (for Anthropic)
 */
export function getSessionMcpServer(db: Pool, context: ToolContext) {
  // For now, return the full MCP server
  // The Anthropic provider will filter via allowedTools
  // A future enhancement could build a filtered MCP server
  return buildMcpServerFromDefinitions(db, context);
}

/**
 * Get MCP tool names filtered by session-enabled tools
 */
export function getSessionMcpToolNames(sessionId: string | undefined): string[] {
  if (!sessionId) {
    return getMcpToolNames();
  }

  const registry = getToolRegistry();
  const enabledNames = registry.getEnabledTools(sessionId);

  return enabledNames.map((name) => `mcp__${MCP_SERVER_NAME}__${name}`);
}

// =============================================================================
// Registry Initialization
// =============================================================================

let registryInitialized = false;

/**
 * Initialize the tool registry with all tool definitions
 * Called once on first provider access
 */
export function ensureRegistryInitialized(): void {
  if (registryInitialized) return;

  const registry = getToolRegistry();
  if (registry.size === 0) {
    registry.registerTools(getAllToolDefinitions());
    console.info(`[RegistryBridge] Initialized registry with ${registry.size} tools`);
  }

  registryInitialized = true;
}

/**
 * Re-export for convenience
 */
export { MCP_SERVER_NAME };
