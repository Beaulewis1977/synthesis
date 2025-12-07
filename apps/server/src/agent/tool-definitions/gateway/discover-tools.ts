/**
 * Discover Tools Gateway Tool Definition
 *
 * Phase 16F: Gateway tool for discovering available toolpacks.
 * Always enabled, cannot be disabled.
 */

import { z } from 'zod';
import { getToolRegistry } from '../../../services/tool-registry.js';
import { createToolResponse } from '../adapters.js';
import { TOOLPACKS } from '../toolpacks.js';
import type { UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const discoverToolsInputSchema = z.object({
  /** Filter by toolpack name */
  toolpack: z
    .enum(['core', 'mobile_core', 'introspection', 'graphing', 'gateway'])
    .optional()
    .describe('Filter by specific toolpack'),
  /** Include tool descriptions */
  include_descriptions: z
    .boolean()
    .optional()
    .describe('Include tool descriptions in response (default: false)'),
});

type DiscoverToolsInput = z.infer<typeof discoverToolsInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const discoverToolsTool: UnifiedToolDefinition = {
  name: 'discover_tools',
  description:
    'Discover available toolpacks and tools. Use this to find tools for specific tasks before enabling them. Low token cost.',
  inputSchema: discoverToolsInputSchema,
  metadata: {
    toolpack: 'gateway',
    category: 'gateway',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: () => async (input: unknown) => {
    const parsed = discoverToolsInputSchema.parse(input) as DiscoverToolsInput;
    const registry = getToolRegistry();

    if (parsed.toolpack) {
      // Return specific toolpack details
      const toolpack = TOOLPACKS[parsed.toolpack];
      if (!toolpack) {
        return createToolResponse(`Toolpack '${parsed.toolpack}' not found.`);
      }

      const tools = toolpack.tools.map((name) => {
        const def = registry.getToolDefinition(name);
        const result: { name: string; description?: string; sensitive?: boolean } = { name };

        if (parsed.include_descriptions && def) {
          result.description = def.description;
          if (def.metadata.sensitive) {
            result.sensitive = true;
          }
        }

        return result;
      });

      return createToolResponse(`Toolpack '${parsed.toolpack}' details.`, {
        toolpack: parsed.toolpack,
        description: toolpack.description,
        tool_count: tools.length,
        sensitive_tools: toolpack.sensitiveTools,
        tools,
      });
    }

    // Return summary of all toolpacks
    const summary = Object.entries(TOOLPACKS).map(([name, pack]) => ({
      name,
      description: pack.description,
      tool_count: pack.tools.length,
      sensitive_count: pack.sensitiveTools.length,
      tools: parsed.include_descriptions ? pack.tools : undefined,
    }));

    return createToolResponse('Available toolpacks. Use enable_tools to activate a toolpack.', {
      toolpacks: summary,
      total_tools: registry.size,
      hint: 'Call discover_tools with toolpack parameter for detailed tool list.',
    });
  },
};
