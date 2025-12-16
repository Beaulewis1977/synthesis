/**
 * Spawn Subagent Tool Definition
 *
 * Spawns a specialized Claude subagent to handle complex tasks autonomously.
 * Subagents run in separate context windows via claude CLI subprocess.
 *
 * Requires: claude CLI installed and in PATH on the server
 */

import { z } from 'zod';
import {
  type SubagentModel,
  type SubagentType,
  getSubagentRunner,
} from '../../../services/subagent-runner.js';
import { createToolResponse } from '../adapters.js';
import type { UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const spawnSubagentInputSchema = z.object({
  prompt: z.string().min(1, 'prompt must not be empty').describe('Detailed task for the subagent'),
  subagent_type: z
    .enum(['explore', 'plan', 'code-reviewer', 'test-writer', 'doc-writer'])
    .describe(
      'Type of specialized agent: explore (codebase exploration), plan (implementation planning), code-reviewer (code quality review), test-writer (test generation), doc-writer (documentation)'
    ),
  run_in_background: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Run async and return immediately with task ID (default: false). Recommended for long-running tasks.'
    ),
  model: z
    .enum(['sonnet', 'opus', 'haiku'])
    .optional()
    .describe('Model override: sonnet (default), opus (most capable), haiku (fastest)'),
  cwd: z.string().optional().describe('Working directory for the agent (default: project root)'),
  timeout_ms: z
    .number()
    .int()
    .min(30000)
    .max(1800000)
    .optional()
    .describe(
      'Timeout in milliseconds for Claude execution (default: 300000 = 5 minutes, max: 1800000 = 30 minutes). Note: Add ~15s for subprocess overhead.'
    ),
});

type SpawnSubagentInput = z.infer<typeof spawnSubagentInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const spawnSubagentTool: UnifiedToolDefinition = {
  name: 'spawn_subagent',
  description: `Spawn a specialized Claude subagent to handle complex tasks autonomously. Subagents run in separate context windows, preserving the main conversation's context.

Available subagent types:
- explore: Codebase exploration with Glob/Grep/Read tools
- plan: Implementation planning with alternatives and trade-offs
- code-reviewer: Quality, security, and maintainability review
- test-writer: Comprehensive test generation
- doc-writer: Documentation generation

Use run_in_background=true for long-running tasks to avoid blocking.`,
  inputSchema: spawnSubagentInputSchema,
  metadata: {
    toolpack: 'orchestration',
    category: 'orchestration',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: () => async (input: unknown) => {
    const parsed = spawnSubagentInputSchema.parse(input) as SpawnSubagentInput;

    const runner = getSubagentRunner({
      cwd: parsed.cwd,
      model: parsed.model as SubagentModel | undefined,
      timeout: parsed.timeout_ms,
    });

    // Check if claude CLI is available
    const isAvailable = await runner.isAvailable();
    if (!isAvailable) {
      return createToolResponse(
        'Subagent spawning unavailable: claude CLI is not installed or not in PATH.',
        {
          error: 'cli_not_available',
          message:
            'The claude CLI must be installed on the server for subagent functionality. Install it with: npm install -g @anthropic-ai/claude-code',
        }
      );
    }

    if (parsed.run_in_background) {
      // Run in background, return immediately with task ID
      const taskId = await runner.runBackground(
        parsed.subagent_type as SubagentType,
        parsed.prompt
      );

      return createToolResponse(`Subagent (${parsed.subagent_type}) launched in background.`, {
        task_id: taskId,
        subagent_type: parsed.subagent_type,
        status: 'running',
        message: 'Use get_subagent_status with task_id to check progress.',
      });
    }
    // Run synchronously, wait for completion
    const result = await runner.run(parsed.subagent_type as SubagentType, parsed.prompt);

    if (result.timedOut) {
      return createToolResponse(
        `Subagent (${parsed.subagent_type}) timed out after ${Math.round(result.durationMs / 1000)}s.`,
        {
          subagent_type: parsed.subagent_type,
          status: 'timeout',
          duration_ms: result.durationMs,
          partial_output: result.output.slice(0, 5000),
          message: 'Consider using run_in_background=true for long-running tasks.',
        }
      );
    }

    if (result.exitCode !== 0) {
      return createToolResponse(
        `Subagent (${parsed.subagent_type}) completed with errors (exit code ${result.exitCode}).`,
        {
          subagent_type: parsed.subagent_type,
          status: 'error',
          exit_code: result.exitCode,
          duration_ms: result.durationMs,
          output: result.output,
        }
      );
    }

    return createToolResponse(
      `Subagent (${parsed.subagent_type}) completed successfully in ${Math.round(result.durationMs / 1000)}s.`,
      {
        subagent_type: parsed.subagent_type,
        status: 'completed',
        duration_ms: result.durationMs,
        output: result.output,
      }
    );
  },
};
