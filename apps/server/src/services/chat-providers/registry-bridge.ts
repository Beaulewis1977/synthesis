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
 *
 * IMPORTANT: Falls back to all tools when session not found in registry.
 * This ensures non-Anthropic providers (OpenAI, Google, Z.AI, Moonshot, Ollama)
 * always have tool executors available, even for new sessions.
 */
export function getSessionAgentTools(db: Pool, context: ToolContext): BuiltAgentTools {
  if (!context.sessionId) {
    // No session = all tools (backward compatible)
    return buildAllAgentTools(db, context);
  }

  // Check if session exists in registry, if not, return all tools
  const registry = getToolRegistry();
  const hasSession = registry.getEnabledToolCount(context.sessionId) > 0;

  if (!hasSession) {
    // Session not in registry - use all tools
    // Handles: (1) new sessions that haven't customized tools yet
    //          (2) sessions expired and cleaned up
    //          (3) sessions after registry reset
    console.debug(
      `[RegistryBridge] Session ${context.sessionId} not found in registry, using all tools`
    );
    return buildAllAgentTools(db, context);
  }

  const definitions = getSessionEnabledDefinitions(context.sessionId);
  return buildAgentToolsFromDefinitions(definitions, db, context);
}

/**
 * Build chat tools filtered by session-enabled tools
 * Uses the adapter functions for proper type handling
 *
 * IMPORTANT: Falls back to all tools when session not found in registry.
 */
export function getSessionChatTools(db: Pool, context: ToolContext): BuiltChatTools {
  if (!context.sessionId) {
    // No session = all tools (backward compatible)
    return buildAllChatTools(db, context);
  }

  // Check if session exists in registry, if not, return all tools
  const registry = getToolRegistry();
  const hasSession = registry.getEnabledToolCount(context.sessionId) > 0;

  if (!hasSession) {
    // Session not in registry - use all tools (see getSessionAgentTools for details)
    console.debug(
      `[RegistryBridge] Session ${context.sessionId} not found in registry, using all chat tools`
    );
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
 * Reset registry initialization state (for testing only)
 * In test environments, modules may be cached between tests, causing
 * ensureRegistryInitialized() to be a no-op after the first test.
 */
export function resetRegistryInitialization(): void {
  registryInitialized = false;
}

/**
 * Re-export for convenience
 */
export { MCP_SERVER_NAME };
