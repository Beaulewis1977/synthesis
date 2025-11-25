/**
 * Process manager for Synthesis Desktop
 * Handles spawning and managing development processes (non-Docker mode)
 */

import { type ChildProcess, spawn } from 'node:child_process';
import path from 'node:path';
import { app } from 'electron';
import { addLog } from './logger.js';
import type { OperationResult } from './types.js';

/** Active processes */
const processes: Map<string, ChildProcess> = new Map();

/** Process output buffers */
const outputBuffers: Map<string, string[]> = new Map();

/** Maximum lines to keep per process */
const MAX_OUTPUT_LINES = 500;

/**
 * Get the project root directory
 */
function getProjectRoot(): string {
  if (app.isPackaged) {
    return process.resourcesPath;
  }
  return path.join(app.getAppPath(), '..', '..');
}

/**
 * Spawn a process and track it
 */
function spawnProcess(name: string, command: string, args: string[], cwd: string): ChildProcess {
  addLog('info', `Starting ${name}: ${command} ${args.join(' ')}`, 'process');

  const proc = spawn(command, args, {
    cwd,
    shell: true,
    env: {
      ...process.env,
      FORCE_COLOR: '1', // Enable colored output
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Initialize output buffer
  outputBuffers.set(name, []);

  // Handle stdout
  proc.stdout?.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      addOutputLine(name, line);
      addLog('info', line, name);
    }
  });

  // Handle stderr
  proc.stderr?.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      addOutputLine(name, line);
      // Determine if it's actually an error or just info on stderr
      const isError =
        line.toLowerCase().includes('error') ||
        line.toLowerCase().includes('failed') ||
        line.toLowerCase().includes('exception');
      addLog(isError ? 'error' : 'warn', line, name);
    }
  });

  // Handle process exit
  proc.on('close', (code) => {
    addLog(code === 0 ? 'info' : 'error', `${name} exited with code ${code}`, 'process');
    processes.delete(name);
  });

  // Handle process error
  proc.on('error', (err) => {
    addLog('error', `${name} error: ${err.message}`, 'process');
    processes.delete(name);
  });

  processes.set(name, proc);
  return proc;
}

/**
 * Add a line to the output buffer
 */
function addOutputLine(name: string, line: string): void {
  const buffer = outputBuffers.get(name) || [];
  buffer.push(line);

  // Trim if over limit
  if (buffer.length > MAX_OUTPUT_LINES) {
    buffer.splice(0, buffer.length - MAX_OUTPUT_LINES);
  }

  outputBuffers.set(name, buffer);
}

/**
 * Start development mode (server + web)
 */
export async function startDevMode(): Promise<OperationResult> {
  const projectRoot = getProjectRoot();

  addLog('info', 'Starting development mode...', 'process');
  addLog('info', `Project root: ${projectRoot}`, 'process');

  try {
    // Check if pnpm is available
    const pnpmCheck = spawn('pnpm', ['--version'], { shell: true });
    await new Promise<void>((resolve, reject) => {
      pnpmCheck.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error('pnpm not found'));
      });
      pnpmCheck.on('error', reject);
    });
  } catch {
    const error = 'pnpm is not installed. Please install pnpm first.';
    addLog('error', error, 'process');
    return { success: false, error };
  }

  try {
    // Start server
    spawnProcess('server', 'pnpm', ['--filter', '@synthesis/server', 'dev'], projectRoot);

    // Wait a bit for server to start initializing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Start web
    spawnProcess('web', 'pnpm', ['--filter', '@synthesis/web', 'dev'], projectRoot);

    addLog('info', 'Development processes started', 'process');
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    addLog('error', `Failed to start dev mode: ${error}`, 'process');
    return { success: false, error };
  }
}

/**
 * Stop all development processes
 */
export async function stopDevMode(): Promise<OperationResult> {
  addLog('info', 'Stopping development processes...', 'process');

  const errors: string[] = [];

  for (const [name, proc] of processes) {
    try {
      addLog('info', `Stopping ${name}...`, 'process');

      // Try graceful shutdown first
      if (process.platform === 'win32') {
        // Windows: use taskkill and await completion
        const pid = proc.pid;
        if (pid !== undefined) {
          const killProc = spawn('taskkill', ['/pid', pid.toString(), '/f', '/t'], {
            shell: true,
          });
          await new Promise<void>((resolve) => {
            killProc.on('close', () => resolve());
            killProc.on('error', () => resolve());
            setTimeout(resolve, 5000); // Timeout after 5s
          });
        }
      } else {
        // Unix: send SIGTERM, then SIGKILL if needed
        proc.kill('SIGTERM');

        // Wait for graceful shutdown
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            proc.kill('SIGKILL');
            resolve();
          }, 5000);

          proc.on('close', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }

      addLog('info', `${name} stopped`, 'process');
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`${name}: ${error}`);
      addLog('error', `Failed to stop ${name}: ${error}`, 'process');
    }
  }

  processes.clear();

  if (errors.length > 0) {
    return {
      success: false,
      error: `Some processes failed to stop: ${errors.join(', ')}`,
    };
  }

  addLog('info', 'All development processes stopped', 'process');
  return { success: true };
}

/**
 * Check if any processes are running
 */
export function isRunning(): boolean {
  return processes.size > 0;
}

/**
 * Get list of running processes
 */
export function getRunningProcesses(): string[] {
  return Array.from(processes.keys());
}

/**
 * Get output buffer for a process
 */
export function getProcessOutput(name: string): string[] {
  return outputBuffers.get(name) || [];
}

/**
 * Clear output buffer for a process
 */
export function clearProcessOutput(name: string): void {
  outputBuffers.set(name, []);
}

/**
 * Clean up all processes on app exit
 */
export async function cleanup(): Promise<void> {
  if (processes.size > 0) {
    addLog('info', 'Cleaning up processes...', 'process');
    await stopDevMode();
  }
}
