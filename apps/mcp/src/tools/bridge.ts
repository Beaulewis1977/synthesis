/**
 * synthesis_mcp_bridge Gateway Tool Implementation
 *
 * Direct MCP call bypassing local enable/disable state.
 * Use as a fallback when:
 * - Client visibility is stale and tool isn't appearing
 * - Router is gated or unsuitable
 * - Direct MCP call needed bypassing local tool registration
 *
 * Key behavior:
 * - Does NOT auto-enable tools
 * - Does NOT check enabled state
 * - Does NOT emit notifications
 * - Executes tool directly via stored handler
 *
 * @module apps/mcp/src/tools/bridge
 * @since GPT Phase 3: Sub-Phase 5.6.3
 */

import type { DynamicToolRegistry } from '../tool-registry.js';
import type { BridgeResult, ToolResult } from '../types/gateway-responses.js';
import type { BridgeInput } from '../types/gateway-schemas.js';

/**
 * Execute a tool via the MCP bridge, bypassing enable/disable state
 *
 * This is an emergency fallback for when the router and native tools fail
 * due to stale client visibility. It directly executes the tool handler
 * without any enable checks or notifications.
 *
 * @param input - Bridge input with server, tool name, and params
 * @param registry - Dynamic tool registry
 * @returns BridgeResult with success/error status
 *
 * @example
 * ```typescript
 * const result = await executeMcpBridge(
 *   {
 *     server: 'synthesis',
 *     tool: 'search_rag',
 *     params: { collectionId: '...', query: 'auth' }
 *   },
 *   dynamicRegistry
 * );
 *
 * if (result.success) {
 *   console.log('Result:', result.result);
 * } else {
 *   console.log('Error:', result.error);
 * }
 * ```
 */
export async function executeMcpBridge(
  input: BridgeInput,
  registry: DynamicToolRegistry
): Promise<BridgeResult> {
  const { server, tool, params } = input;

  // Server validation is already enforced by Zod schema (z.literal('synthesis'))
  // but we double-check here for safety
  if (server !== 'synthesis') {
    return {
      success: false,
      error: `Unknown MCP server: '${server}'. Only 'synthesis' is supported.`,
      server,
      tool,
    };
  }

  // Check if tool exists (NOT if it's enabled - bridge bypasses enable state)
  const handler = registry.getToolHandler(tool);
  if (!handler) {
    return {
      success: false,
      error: `Tool '${tool}' not found in MCP server '${server}'.`,
      server,
      tool,
    };
  }

  // Execute the tool directly via the stored handler
  try {
    const result = await registry.execute(tool, params);

    return {
      success: true,
      result: result as ToolResult,
      server,
      tool,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      error: `Error executing tool '${tool}': ${errorMessage}`,
      server,
      tool,
    };
  }
}
