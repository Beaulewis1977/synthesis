/**
 * synthesis_router Gateway Tool Implementation
 *
 * Universal tool dispatcher with configurable auto-enable behavior.
 * Provides a single entry point for tool execution with support for:
 * - Auto-enable on first use (ROUTER_MODE=auto)
 * - Respect enabled state (ROUTER_MODE=respect)
 * - Bypass enabled state (ROUTER_MODE=bypass)
 * - Sensitive tool gating (ROUTER_SENSITIVE_ENFORCE=true)
 *
 * @module apps/mcp/src/tools/router
 * @since GPT Phase 3: Sub-Phase 5.6.3
 */

import type { DynamicToolRegistry } from '../tool-registry.js';
import { getToolpackForTool } from '../toolpacks.js';
import type {
  RouterError,
  RouterMetadata,
  RouterResult,
  RouterSuccess,
  ToolResult,
} from '../types/gateway-responses.js';
import type { RouterInput } from '../types/gateway-schemas.js';
import type { ProfileName } from '../types/profiles.js';

/**
 * Build a gated error response for router
 *
 * @param toolName - Name of the gated tool
 * @param reason - Human-readable reason for gating
 * @param registry - Dynamic tool registry for available actions
 * @param requiresProfile - Optional profile that would enable the tool
 * @returns RouterError response
 */
function buildGatedError(
  toolName: string,
  reason: string,
  registry: DynamicToolRegistry,
  requiresProfile?: ProfileName
): RouterError {
  return {
    error: reason,
    gated: true,
    requiresEnable: [toolName],
    requiresProfile,
    availableActions: registry.listTools(),
  };
}

/**
 * Build a not-found error response
 *
 * @param toolName - Name of the unknown tool
 * @param registry - Dynamic tool registry for available actions
 * @returns RouterError response
 */
function buildNotFoundError(toolName: string, registry: DynamicToolRegistry): RouterError {
  return {
    error: `Unknown tool: '${toolName}'`,
    gated: false,
    availableActions: registry.listTools(),
  };
}

/**
 * Get the profile that would enable a sensitive tool based on its toolpack
 *
 * @param toolName - Name of the tool
 * @returns Profile name or undefined
 */
function getRequiredProfileForTool(toolName: string): ProfileName | undefined {
  const toolpack = getToolpackForTool(toolName);
  if (!toolpack) return undefined;

  // Introspection tools require 'full' profile
  if (toolpack === 'introspection') {
    return 'full';
  }

  return undefined;
}

/**
 * Execute a tool via the router with configurable auto-enable behavior
 *
 * Router modes:
 * - `auto` (default): Auto-enable disabled tools, then execute. Sensitive tools
 *   may be gated if ROUTER_SENSITIVE_ENFORCE=true.
 * - `respect`: Only execute enabled tools. Return gated error for disabled tools.
 * - `bypass`: Execute any tool directly without enabling (no visibility changes).
 *
 * @param input - Router input with action name and params
 * @param registry - Dynamic tool registry
 * @returns RouterResult (success with metadata or error)
 *
 * @example
 * ```typescript
 * const result = await executeViaRouter(
 *   { action: 'search_mobile_docs', params: { collectionId: '...', query: 'auth' } },
 *   dynamicRegistry
 * );
 *
 * if (isRouterError(result)) {
 *   console.log('Tool gated:', result.requiresEnable);
 * } else {
 *   console.log('Result:', result.result);
 * }
 * ```
 */
export async function executeViaRouter(
  input: RouterInput,
  registry: DynamicToolRegistry
): Promise<RouterResult> {
  const { action, params } = input;
  const startTime = performance.now();

  // 1. Check if tool exists
  const handle = registry.getHandle(action);
  if (!handle) {
    return buildNotFoundError(action, registry);
  }

  // Get configuration
  const config = registry.getConfig();
  const routerMode = config.routerMode;
  const sensitiveEnforce = config.sensitiveEnforce;

  // Track whether we auto-enabled
  let enabledNow = false;

  // 2. Handle based on router mode
  const isEnabled = registry.isEnabled(action);
  const isSensitive = handle.sensitive;

  switch (routerMode) {
    case 'respect':
      // Respect mode: only execute enabled tools
      if (!isEnabled) {
        return buildGatedError(
          action,
          `Tool '${action}' is not enabled. Enable it first with enable_tools.`,
          registry,
          getRequiredProfileForTool(action)
        );
      }
      break;

    case 'auto':
      // Auto mode: auto-enable disabled tools
      if (!isEnabled) {
        // Check sensitive enforcement
        if (isSensitive && sensitiveEnforce) {
          return buildGatedError(
            action,
            `Tool '${action}' is sensitive and requires explicit enable (ROUTER_SENSITIVE_ENFORCE=true).`,
            registry,
            getRequiredProfileForTool(action)
          );
        }

        // Auto-enable the tool
        const enableResult = registry.enable(action);
        if (enableResult.ok) {
          enabledNow = true;
        }
      }
      break;

    case 'bypass':
      // Bypass mode: execute directly without enabling
      // No enable checks needed
      break;
  }

  // 3. Execute the tool
  try {
    const result = await registry.execute(action, params);

    // 4. Record the call for statistics
    registry.recordCall(action);

    // 5. Build success response with metadata
    const executionMs = performance.now() - startTime;
    const metadata: RouterMetadata = {
      enabledNow,
      visibleToClient: registry.isEnabled(action),
      toolVersion: handle.version,
      executionMs: Math.round(executionMs * 100) / 100, // Round to 2 decimal places
    };

    const response: RouterSuccess = {
      result: result as ToolResult,
      _routerMetadata: metadata,
    };

    return response;
  } catch (error) {
    // Handle execution errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Build error tool result
    const errorResult: ToolResult = {
      content: [
        {
          type: 'text',
          text: `Error executing tool '${action}': ${errorMessage}`,
        },
      ],
      isError: true,
    };

    // Still return as RouterSuccess but with isError flag
    const executionMs = performance.now() - startTime;
    const metadata: RouterMetadata = {
      enabledNow,
      visibleToClient: registry.isEnabled(action),
      toolVersion: handle.version,
      executionMs: Math.round(executionMs * 100) / 100,
    };

    return {
      result: errorResult,
      _routerMetadata: metadata,
    };
  }
}
