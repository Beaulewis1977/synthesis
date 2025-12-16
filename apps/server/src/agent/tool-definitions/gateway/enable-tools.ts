/**
 * Enable Tools Gateway Tool Definition
 *
 * Phase 16F: Gateway tool for dynamically enabling/disabling tools.
 * Always enabled, cannot be disabled.
 */

import { z } from 'zod';
import { getToolRegistry } from '../../../services/tool-registry.js';
import { createToolResponse } from '../adapters.js';
import { isValidProfile, isValidToolpack } from '../toolpacks.js';
import type { ProfileName, ToolpackName, UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const enableToolsInputSchema = z.object({
  /** Action to perform */
  action: z
    .enum(['enable', 'disable', 'apply_profile', 'status'])
    .describe('Action: enable/disable tools or toolpacks, apply profile, or check status'),
  /** Session ID for tracking (auto-generated if not provided) */
  session_id: z.string().optional().describe('Session ID for tool state tracking'),
  /** Toolpack name to enable/disable */
  toolpack: z
    .enum(['core', 'mobile_core', 'introspection', 'graphing', 'web', 'orchestration'])
    .optional()
    .describe('Toolpack to enable/disable'),
  /** Individual tool names to enable/disable */
  tools: z.array(z.string()).optional().describe('Individual tool names to enable/disable'),
  /** Profile to apply */
  profile: z
    .enum(['minimal', 'core', 'full'])
    .optional()
    .describe('Profile to apply (resets to profile defaults)'),
});

type EnableToolsInput = z.infer<typeof enableToolsInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const enableToolsTool: UnifiedToolDefinition = {
  name: 'enable_tools',
  description:
    'Enable or disable tools and toolpacks dynamically. Gateway tools (discover_tools, enable_tools) cannot be disabled.',
  inputSchema: enableToolsInputSchema,
  metadata: {
    toolpack: 'gateway',
    category: 'gateway',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: () => async (input: unknown) => {
    const parsed = enableToolsInputSchema.parse(input) as EnableToolsInput;
    const registry = getToolRegistry();

    // Use provided session ID or generate one with random component to prevent collisions
    const sessionId =
      parsed.session_id ?? `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    switch (parsed.action) {
      case 'status': {
        const snapshot = registry.getSnapshot(sessionId);
        const enabledTools = registry.getEnabledTools(sessionId);

        return createToolResponse('Current tool status.', {
          session_id: sessionId,
          active_profile: snapshot.activeProfile,
          enabled_count: snapshot.enabledCount,
          total_count: snapshot.totalCount,
          enabled_tools: enabledTools,
        });
      }

      case 'apply_profile': {
        if (!parsed.profile) {
          return createToolResponse(
            'Profile name required. Use profile: "minimal", "core", or "full".'
          );
        }

        if (!isValidProfile(parsed.profile)) {
          return createToolResponse(
            `Invalid profile: ${parsed.profile}. Valid profiles: minimal, core, full.`
          );
        }

        registry.applyProfile(sessionId, parsed.profile as ProfileName);
        const enabledTools = registry.getEnabledTools(sessionId);

        return createToolResponse(`Profile '${parsed.profile}' applied.`, {
          session_id: sessionId,
          profile: parsed.profile,
          enabled_count: enabledTools.length,
          enabled_tools: enabledTools,
        });
      }

      case 'enable': {
        const results: { enabled: string[]; failed: { name: string; reason: string }[] } = {
          enabled: [],
          failed: [],
        };

        // Enable toolpack if specified
        if (parsed.toolpack) {
          if (!isValidToolpack(parsed.toolpack)) {
            results.failed.push({
              name: parsed.toolpack,
              reason: 'Invalid toolpack name',
            });
          } else {
            const enabled = registry.enableToolpack(sessionId, parsed.toolpack as ToolpackName);
            results.enabled.push(...enabled);
          }
        }

        // Enable individual tools
        if (parsed.tools) {
          for (const toolName of parsed.tools) {
            const result = registry.enableTool(sessionId, toolName);
            if (result.ok) {
              results.enabled.push(toolName);
            } else {
              results.failed.push({
                name: toolName,
                reason: result.reason ?? 'Unknown error',
              });
            }
          }
        }

        if (results.enabled.length === 0 && results.failed.length === 0) {
          return createToolResponse('No tools specified. Use toolpack or tools parameter.');
        }

        return createToolResponse(
          `Enabled ${results.enabled.length} tool(s)${
            results.failed.length > 0 ? `, ${results.failed.length} failed` : ''
          }.`,
          {
            session_id: sessionId,
            enabled: results.enabled,
            failed: results.failed.length > 0 ? results.failed : undefined,
            total_enabled: registry.getEnabledToolCount(sessionId),
          }
        );
      }

      case 'disable': {
        const results: { disabled: string[]; failed: { name: string; reason: string }[] } = {
          disabled: [],
          failed: [],
        };

        // Disable toolpack if specified
        if (parsed.toolpack) {
          if (!isValidToolpack(parsed.toolpack)) {
            results.failed.push({
              name: parsed.toolpack,
              reason: 'Invalid toolpack name',
            });
          } else {
            const disabled = registry.disableToolpack(sessionId, parsed.toolpack as ToolpackName);
            results.disabled.push(...disabled);
          }
        }

        // Disable individual tools
        if (parsed.tools) {
          for (const toolName of parsed.tools) {
            const result = registry.disableTool(sessionId, toolName);
            if (result.ok) {
              results.disabled.push(toolName);
            } else {
              results.failed.push({
                name: toolName,
                reason: result.reason ?? 'Unknown error',
              });
            }
          }
        }

        if (results.disabled.length === 0 && results.failed.length === 0) {
          return createToolResponse('No tools specified. Use toolpack or tools parameter.');
        }

        return createToolResponse(
          `Disabled ${results.disabled.length} tool(s)${
            results.failed.length > 0 ? `, ${results.failed.length} failed` : ''
          }.`,
          {
            session_id: sessionId,
            disabled: results.disabled,
            failed: results.failed.length > 0 ? results.failed : undefined,
            total_enabled: registry.getEnabledToolCount(sessionId),
          }
        );
      }

      default:
        return createToolResponse(
          `Unknown action: ${parsed.action}. Use enable, disable, apply_profile, or status.`
        );
    }
  },
};
