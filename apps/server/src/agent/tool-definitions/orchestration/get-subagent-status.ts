/**
 * Get Subagent Status Tool Definition
 *
 * Checks the status of a background subagent task.
 * Returns output and completion status.
 */

import { z } from 'zod';
import { getSubagentRunner } from '../../../services/subagent-runner.js';
import { createToolResponse } from '../adapters.js';
import type { UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const getSubagentStatusInputSchema = z.object({
  task_id: z
    .string()
    .uuid()
    .describe('Task ID returned from spawn_subagent with run_in_background=true'),
});

type GetSubagentStatusInput = z.infer<typeof getSubagentStatusInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const getSubagentStatusTool: UnifiedToolDefinition = {
  name: 'get_subagent_status',
  description:
    'Check the status of a background subagent task. Use the task_id returned from spawn_subagent with run_in_background=true.',
  inputSchema: getSubagentStatusInputSchema,
  metadata: {
    toolpack: 'orchestration',
    category: 'orchestration',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: () => async (input: unknown) => {
    const parsed = getSubagentStatusInputSchema.parse(input) as GetSubagentStatusInput;

    const runner = getSubagentRunner();
    const status = runner.getTaskStatus(parsed.task_id);

    if (!status.found) {
      return createToolResponse(`Task "${parsed.task_id}" not found.`, {
        task_id: parsed.task_id,
        error: 'not_found',
        message:
          'Task ID not found. It may have expired, been cleaned up, or never existed. Background tasks are tracked in-memory only.',
      });
    }

    if (status.completed) {
      return createToolResponse(`Subagent task completed (exit code ${status.exitCode}).`, {
        task_id: parsed.task_id,
        status: status.exitCode === 0 ? 'completed' : 'error',
        completed: true,
        exit_code: status.exitCode,
        duration_ms: status.durationMs,
        output: status.output,
      });
    }

    return createToolResponse('Subagent task is still running.', {
      task_id: parsed.task_id,
      status: 'running',
      completed: false,
      duration_ms: status.durationMs,
      partial_output: status.output.slice(-2000), // Last 2000 chars of output so far
    });
  },
};
