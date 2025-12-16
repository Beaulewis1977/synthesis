/**
 * Subagent Runner Service
 *
 * Spawns Claude CLI subprocesses to handle complex tasks autonomously.
 * Each subagent type has a specialized system prompt for its domain.
 *
 * Requires: claude CLI installed and in PATH
 *
 * Security Note:
 * By default, subagents run with --dangerously-skip-permissions which disables
 * Claude Code's permission protections. This is required for autonomous operation
 * but should only be used in trusted environments (local dev, controlled servers).
 *
 * Set SUBAGENT_REQUIRE_PERMISSIONS=true to disable skip-permissions flag.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

// =============================================================================
// Types
// =============================================================================

export type SubagentType = 'explore' | 'plan' | 'code-reviewer' | 'test-writer' | 'doc-writer';

export type SubagentModel = 'sonnet' | 'opus' | 'haiku';

export interface SubagentOptions {
  /** Working directory for the agent */
  cwd?: string;
  /** Model to use (default: sonnet) */
  model?: SubagentModel;
  /** Timeout in milliseconds (default: 300000 = 5 minutes) */
  timeout?: number;
}

export interface SubagentResult {
  /** Agent output */
  output: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Exit code (0 = success) */
  exitCode: number;
  /** Whether the agent was killed due to timeout */
  timedOut: boolean;
}

interface BackgroundTask {
  process: ChildProcess;
  output: string;
  startTime: number;
  completed: boolean;
  exitCode: number | null;
  options: Required<SubagentOptions>;
}

// =============================================================================
// Subagent System Prompts
// =============================================================================

const SUBAGENT_PROMPTS: Record<SubagentType, string> = {
  explore: `You are an exploration agent. Your task is to thoroughly search the codebase to answer questions and find relevant information.

Use these strategies:
- Use Glob to find files by pattern (e.g., "**/*.ts" for TypeScript files)
- Use Grep to search for specific text or patterns
- Use Read to examine file contents
- Navigate through imports and dependencies to understand code flow

Be thorough but focused. Report your findings with specific file paths and line numbers.`,

  plan: `You are a planning agent. Your task is to create detailed implementation plans for tasks.

Your plans should include:
- Step-by-step breakdown of the implementation
- Files that need to be created or modified
- Dependencies and their order
- Potential risks or challenges
- Alternative approaches when relevant

Be specific and actionable. Include file paths and code snippets where helpful.`,

  'code-reviewer': `You are a code review agent. Your task is to review code for quality, security, and maintainability.

Focus on:
- Security vulnerabilities (OWASP top 10, injection, XSS, etc.)
- Performance issues and optimization opportunities
- Code style and consistency
- Error handling and edge cases
- Test coverage gaps
- Documentation needs

Provide specific, actionable feedback with file paths and line numbers.`,

  'test-writer': `You are a test writing agent. Your task is to generate comprehensive tests for code.

Your tests should:
- Cover happy path scenarios
- Test edge cases and error conditions
- Use appropriate mocking and fixtures
- Follow the project's testing conventions
- Include both unit and integration tests where appropriate

Generate complete, runnable test code with clear descriptions.`,

  'doc-writer': `You are a documentation agent. Your task is to write clear, comprehensive documentation.

Your documentation should:
- Explain the purpose and functionality
- Include usage examples
- Document API signatures and parameters
- Note any prerequisites or dependencies
- Follow the project's documentation style

Write for the intended audience (developers, users, etc.).`,
};

// =============================================================================
// Global Task Storage (persists across runner instances)
// =============================================================================

const backgroundTasks = new Map<string, BackgroundTask>();

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if permissions should be skipped (security-sensitive flag)
 */
function shouldSkipPermissions(): boolean {
  // Default: skip permissions (required for autonomous operation)
  // Set SUBAGENT_REQUIRE_PERMISSIONS=true to enforce permission prompts
  return process.env.SUBAGENT_REQUIRE_PERMISSIONS !== 'true';
}

/**
 * Convert model name to claude CLI model ID
 */
function getModelId(model: SubagentModel): string {
  switch (model) {
    case 'opus':
      return 'opus';
    case 'haiku':
      return 'haiku';
    default:
      return 'sonnet';
  }
}

/**
 * Build CLI arguments for subagent
 */
function buildCliArgs(model: SubagentModel, prompt: string): string[] {
  // Note: prompt must be passed as a single argument to avoid shell interpretation
  const args: string[] = ['--print'];

  if (shouldSkipPermissions()) {
    args.push('--dangerously-skip-permissions');
  }

  args.push('--model', getModelId(model));
  // Separator ensures prompt is treated purely as data
  args.push('--', prompt);

  return args;
}

// =============================================================================
// Subagent Runner Class
// =============================================================================

export class SubagentRunner {
  private options: Required<SubagentOptions>;

  constructor(options: SubagentOptions = {}) {
    this.options = {
      cwd: options.cwd ?? process.cwd(),
      model: options.model ?? 'sonnet',
      timeout: options.timeout ?? 300000, // 5 minutes default
    };
  }

  /**
   * Check if claude CLI is available
   */
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('claude', ['--version'], {
        cwd: this.options.cwd,
        env: process.env,
        shell: false,
      });

      proc.on('close', (code) => {
        resolve(code === 0);
      });

      proc.on('error', () => {
        resolve(false);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 5000);
    });
  }

  /**
   * Run a subagent synchronously (waits for completion)
   */
  async run(type: SubagentType, prompt: string): Promise<SubagentResult> {
    const start = Date.now();
    const systemPrompt = SUBAGENT_PROMPTS[type];
    const fullPrompt = `${systemPrompt}\n\n## Task\n\n${prompt}`;

    return new Promise((resolve) => {
      const args = buildCliArgs(this.options.model, fullPrompt);

      const proc = spawn('claude', args, {
        cwd: this.options.cwd,
        env: process.env,
        shell: false,
      });

      let output = '';
      let timedOut = false;

      proc.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      // Set timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGTERM');
        // Force kill after 5 seconds if still running
        setTimeout(() => proc.kill('SIGKILL'), 5000);
      }, this.options.timeout);

      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        resolve({
          output: output.trim(),
          durationMs: Date.now() - start,
          exitCode: code ?? 1,
          timedOut,
        });
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve({
          output: `Error spawning subagent: ${error.message}`,
          durationMs: Date.now() - start,
          exitCode: 1,
          timedOut: false,
        });
      });
    });
  }

  /**
   * Run a subagent in the background (returns immediately with task ID)
   */
  async runBackground(type: SubagentType, prompt: string): Promise<string> {
    const taskId = randomUUID();
    const systemPrompt = SUBAGENT_PROMPTS[type];
    const fullPrompt = `${systemPrompt}\n\n## Task\n\n${prompt}`;

    const args = buildCliArgs(this.options.model, fullPrompt);

    const proc = spawn('claude', args, {
      cwd: this.options.cwd,
      env: process.env,
      shell: false,
      detached: true,
    });

    const task: BackgroundTask = {
      process: proc,
      output: '',
      startTime: Date.now(),
      completed: false,
      exitCode: null,
      options: { ...this.options },
    };

    backgroundTasks.set(taskId, task);

    proc.stdout?.on('data', (data: Buffer) => {
      task.output += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      task.output += data.toString();
    });

    proc.on('close', (code) => {
      task.completed = true;
      task.exitCode = code;
    });

    proc.on('error', (error) => {
      task.completed = true;
      task.exitCode = 1;
      task.output += `\nError: ${error.message}`;
    });

    // Set timeout for background tasks
    setTimeout(() => {
      if (!task.completed) {
        proc.kill('SIGTERM');
        task.output += '\n[Subagent timed out]';
        setTimeout(() => {
          if (!task.completed) {
            proc.kill('SIGKILL');
          }
        }, 5000);
      }
    }, this.options.timeout);

    return taskId;
  }

  /**
   * Get the status of a background task
   * Note: Uses global task storage, so works across runner instances
   */
  getTaskStatus(taskId: string): {
    found: boolean;
    completed: boolean;
    output: string;
    durationMs: number;
    exitCode: number | null;
  } {
    const task = backgroundTasks.get(taskId);

    if (!task) {
      return {
        found: false,
        completed: false,
        output: '',
        durationMs: 0,
        exitCode: null,
      };
    }

    return {
      found: true,
      completed: task.completed,
      output: task.output.trim(),
      durationMs: Date.now() - task.startTime,
      exitCode: task.exitCode,
    };
  }

  /**
   * Clean up completed background tasks
   * Note: Uses global task storage
   */
  cleanupCompletedTasks(): number {
    let cleaned = 0;
    for (const [taskId, task] of backgroundTasks) {
      if (task.completed) {
        backgroundTasks.delete(taskId);
        cleaned++;
      }
    }
    return cleaned;
  }
}

// =============================================================================
// Factory Function (creates new instance per call)
// =============================================================================

/**
 * Create a new SubagentRunner instance with the given options.
 *
 * Unlike a singleton, this creates a fresh instance each time,
 * allowing per-call configuration of cwd, model, and timeout.
 *
 * Background tasks are stored globally and accessible from any instance.
 */
export function createSubagentRunner(options?: SubagentOptions): SubagentRunner {
  return new SubagentRunner(options);
}

/**
 * Get a SubagentRunner instance.
 *
 * Note: For backward compatibility, this returns a new instance each call
 * to support per-call options. Background tasks are stored globally.
 *
 * @deprecated Use createSubagentRunner() for clarity
 */
export function getSubagentRunner(options?: SubagentOptions): SubagentRunner {
  return new SubagentRunner(options);
}
