/**
 * Bash Command Tool Definition
 *
 * Execute shell commands within a collection's storage directory.
 * Heavily sandboxed to prevent dangerous operations.
 */

import { spawn } from 'node:child_process';
import { z } from 'zod';
import { createToolResponse } from '../adapters.js';
import type { ToolContext, UnifiedToolDefinition } from '../types.js';
import { getCollectionDir, validateCommand } from './sandbox.js';

// =============================================================================
// Input Schema
// =============================================================================

const bashCommandInputSchema = z.object({
  command: z.string().min(1).max(1000).describe('Shell command to execute'),
  timeout: z
    .number()
    .int()
    .min(1000)
    .max(60000)
    .optional()
    .default(30000)
    .describe('Timeout in milliseconds (default: 30000, max: 60000)'),
});

type BashCommandInput = z.infer<typeof bashCommandInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const bashCommandTool: UnifiedToolDefinition = {
  name: 'bash_command',
  description:
    'Execute a shell command within the collection storage directory. Only safe, read-only commands are allowed.',
  inputSchema: bashCommandInputSchema,
  metadata: {
    toolpack: 'native',
    category: 'introspection',
    sensitive: true, // Requires confirmation
    version: '1.0.0',
  },
  createExecutor: (_db, context: ToolContext) => async (input: unknown) => {
    const parsed = bashCommandInputSchema.parse(input) as BashCommandInput;
    const collectionDir = getCollectionDir(context.collectionId);

    // Validate command for safety
    try {
      validateCommand(parsed.command);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Command validation failed';
      return createToolResponse(`Command blocked: ${message}`);
    }

    return new Promise((resolve) => {
      const timeout = parsed.timeout ?? 30000;
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Spawn shell process
      const proc = spawn('sh', ['-c', parsed.command], {
        cwd: collectionDir,
        env: {
          ...process.env,
          HOME: collectionDir, // Restrict home directory
          PATH: '/usr/local/bin:/usr/bin:/bin', // Minimal PATH
        },
        timeout,
      });

      // Set up timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGTERM');
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill('SIGKILL');
          }
        }, 1000);
      }, timeout);

      // Collect output
      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
        // Limit output size
        if (stdout.length > 100000) {
          stdout = stdout.substring(0, 100000) + '\n... [output truncated]';
          proc.kill('SIGTERM');
        }
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
        if (stderr.length > 50000) {
          stderr = stderr.substring(0, 50000) + '\n... [output truncated]';
        }
      });

      proc.on('close', (code) => {
        clearTimeout(timeoutId);

        const payload = {
          command: parsed.command,
          cwd: collectionDir,
          exit_code: code,
          timed_out: timedOut,
          stdout: stdout.trim() || null,
          stderr: stderr.trim() || null,
        };

        if (timedOut) {
          resolve(createToolResponse(`Command timed out after ${timeout}ms`, payload));
        } else if (code !== 0) {
          resolve(
            createToolResponse(
              `Command exited with code ${code}${stderr ? `: ${stderr.substring(0, 200)}` : ''}`,
              payload
            )
          );
        } else {
          resolve(
            createToolResponse(
              `Command completed successfully${stdout ? ` (${stdout.split('\n').length} lines of output)` : ''}.`,
              payload
            )
          );
        }
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve(createToolResponse(`Failed to execute command: ${error.message}`));
      });
    });
  },
};
