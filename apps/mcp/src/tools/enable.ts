/**
 * Enable Gateway Tool Implementation
 *
 * Implements the enable_tools gateway tool for dynamic tool management.
 * Enables tools by name, toolpack, or category with idempotent behavior.
 *
 * @module apps/mcp/src/tools/enable
 * @since GPT Phase 3: Sub-Phase 5.6.2
 */

import type { CategoryName, DynamicToolRegistry, ToolpackName } from '../tool-registry.js';
import { TOOLPACKS } from '../toolpacks.js';
import type { EnableResult } from '../types/gateway-responses.js';
import type { EnableToolsInput } from '../types/gateway-schemas.js';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build human-readable message summarizing enable operation
 *
 * @param enabled Tools that were newly enabled
 * @param alreadyEnabled Tools that were already enabled (idempotent)
 * @param notFound Tool names that were not found
 * @returns Human-readable summary message
 */
export function buildEnableMessage(
  enabled: string[],
  alreadyEnabled: string[],
  notFound: string[]
): string {
  const parts: string[] = [];

  if (enabled.length > 0) {
    parts.push(`Enabled ${enabled.length} tool(s): ${enabled.join(', ')}`);
  }

  if (alreadyEnabled.length > 0) {
    parts.push(`Already enabled: ${alreadyEnabled.join(', ')}`);
  }

  if (notFound.length > 0) {
    parts.push(`Not found: ${notFound.join(', ')}`);
  }

  if (parts.length === 0) {
    return 'No tools to enable.';
  }

  return parts.join('. ') + '.';
}

/**
 * Get all tools in a category from the TOOLPACKS definitions
 *
 * @param category Category name
 * @returns Array of tool names in the category
 */
function getToolsInCategory(category: CategoryName): string[] {
  const tools: string[] = [];

  for (const [_, packDef] of Object.entries(TOOLPACKS)) {
    if (packDef.defaultCategory === category) {
      tools.push(...packDef.tools);
    }
  }

  return tools;
}

// =============================================================================
// Main Enable Function
// =============================================================================

/**
 * Enable tools by name, toolpack, or category
 *
 * This is the main entry point for the enable_tools gateway tool.
 *
 * Features:
 * - Idempotent: enabling already-enabled tools is a no-op
 * - Supports tools, toolpacks, and categories in one call
 * - Deduplicates when same tool is referenced multiple ways
 * - MCP SDK handles notifications/tools/list_changed emission
 *
 * @param input Validated enable input (at least one of tools/toolpacks/categories)
 * @param registry Dynamic tool registry for enable operations
 * @returns EnableResult with enabled/alreadyEnabled/notFound arrays
 */
export function enableTools(input: EnableToolsInput, registry: DynamicToolRegistry): EnableResult {
  const enabled: string[] = [];
  const alreadyEnabled: string[] = [];
  const notFound: string[] = [];

  // Track processed tools to avoid duplicates
  const processed = new Set<string>();

  // 1. Enable specific tools by name
  if (input.tools && input.tools.length > 0) {
    for (const toolName of input.tools) {
      if (processed.has(toolName)) continue;
      processed.add(toolName);

      const result = registry.enable(toolName);
      if (result.ok) {
        enabled.push(toolName);
      } else if (result.reason === 'already_enabled') {
        alreadyEnabled.push(toolName);
      } else if (result.reason === 'not_found') {
        notFound.push(toolName);
      }
      // Note: gateway_protected tools are already enabled, so they'd hit already_enabled
    }
  }

  // 2. Enable by toolpacks
  if (input.toolpacks && input.toolpacks.length > 0) {
    for (const toolpack of input.toolpacks) {
      const packDef = TOOLPACKS[toolpack];
      if (!packDef) continue;

      for (const toolName of packDef.tools) {
        if (processed.has(toolName)) continue;
        processed.add(toolName);

        const result = registry.enable(toolName);
        if (result.ok) {
          enabled.push(toolName);
        } else if (result.reason === 'already_enabled') {
          alreadyEnabled.push(toolName);
        }
        // not_found shouldn't happen for toolpack tools, but handle anyway
        else if (result.reason === 'not_found') {
          notFound.push(toolName);
        }
      }
    }
  }

  // 3. Enable by categories
  if (input.categories && input.categories.length > 0) {
    for (const category of input.categories) {
      const categoryTools = getToolsInCategory(category);

      for (const toolName of categoryTools) {
        if (processed.has(toolName)) continue;
        processed.add(toolName);

        const result = registry.enable(toolName);
        if (result.ok) {
          enabled.push(toolName);
        } else if (result.reason === 'already_enabled') {
          alreadyEnabled.push(toolName);
        } else if (result.reason === 'not_found') {
          notFound.push(toolName);
        }
      }
    }
  }

  // notificationSent is true if any tools were newly enabled
  // The actual notification is emitted by MCP SDK when handle.enable() is called
  const notificationSent = enabled.length > 0;
  const message = buildEnableMessage(enabled, alreadyEnabled, notFound);

  return {
    enabled,
    alreadyEnabled,
    notFound,
    message,
    notificationSent,
  };
}
