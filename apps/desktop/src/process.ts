import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isPortInUse } from './docker';

/**
 * Information about a spawned process
 */
export interface ProcessInfo {
  pid: number;
  name: string;
  process: ChildProcess;
}

/**
 * Result of process operations
 */
export interface ProcessResult {
  success: boolean;
  error?: string;
  processes?: ProcessInfo[];
}

/**
 * Result of environment loading
 */
export interface EnvResult {
  success: boolean;
  env?: Record<string, string>;
  warnings?: string[];
  error?: string;
}

/**
 * Log retrieval result
 */
export interface LogResult {
  success: boolean;
  logs?: string;
  error?: string;
}

/**
 * Service configuration for Direct mode
 */
const SERVICES = [
  { name: 'server', command: 'pnpm', args: ['--filter', '@synthesis/server', 'dev'], port: 3333 },
  { name: 'web', command: 'pnpm', args: ['--filter', '@synthesis/web', 'dev'], port: 5173 },
  { name: 'mcp', command: 'pnpm', args: ['--filter', '@synthesis/mcp', 'dev'], port: 3001 },
] as const;

/**
 * In-memory log buffers for each service
 */
const logBuffers: Map<string, string[]> = new Map();
const MAX_LOG_LINES = 50;

/**
 * Store a log line for a service
 */
function storeLog(service: string, line: string) {
  if (!logBuffers.has(service)) {
    logBuffers.set(service, []);
  }
  const buffer = logBuffers.get(service);
  if (buffer) {
    buffer.push(line);
    if (buffer.length > MAX_LOG_LINES) {
      buffer.shift();
    }
  }
}

/**
 * Check if pnpm is installed and available
 */
export async function checkPnpm(): Promise<{
  available: boolean;
  version?: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    const process = spawn('pnpm', ['--version']);

    let stdout = '';
    let stderr = '';

    process.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve({ available: true, version: stdout.trim() });
      } else {
        resolve({
          available: false,
          error: stderr || 'pnpm command not found',
        });
      }
    });

    process.on('error', (err) => {
      resolve({
        available: false,
        error: `Failed to check pnpm: ${err.message}`,
      });
    });
  });
}

/**
 * Check if Node.js is installed and meets minimum version requirement (v22+)
 */
export async function checkNode(): Promise<{
  available: boolean;
  version?: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    const process = spawn('node', ['--version']);

    let stdout = '';
    let stderr = '';

    process.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        const version = stdout.trim();
        const majorVersion = Number.parseInt(version.replace('v', '').split('.')[0], 10);

        if (majorVersion >= 22) {
          resolve({ available: true, version });
        } else {
          resolve({
            available: false,
            error: `Node.js version ${version} is too old. Requires v22 or higher.`,
          });
        }
      } else {
        resolve({
          available: false,
          error: stderr || 'Node.js command not found',
        });
      }
    });

    process.on('error', (err) => {
      resolve({
        available: false,
        error: `Failed to check Node.js: ${err.message}`,
      });
    });
  });
}

/**
 * Check if required prerequisites (DB + Ollama) are already running
 */
export async function checkPrerequisites(): Promise<{ ready: boolean; error?: string }> {
  const [dbRunning, ollamaRunning] = await Promise.all([
    isPortInUse(5432), // PostgreSQL
    isPortInUse(11434), // Ollama
  ]);

  const missing: string[] = [];
  if (!dbRunning) missing.push('PostgreSQL (port 5432)');
  if (!ollamaRunning) missing.push('Ollama (port 11434)');

  if (missing.length > 0) {
    return {
      ready: false,
      error: `Required services not running: ${missing.join(', ')}`,
    };
  }

  return { ready: true };
}

/**
 * Load .env file and parse environment variables
 */
export function loadEnvForDirectMode(cwd: string): EnvResult {
  const envPath = join(cwd, '.env');

  if (!existsSync(envPath)) {
    return {
      success: false,
      error: '.env file not found',
    };
  }

  try {
    const envContent = readFileSync(envPath, 'utf-8');
    const env: Record<string, string> = {};
    const warnings: string[] = [];

    // Parse .env file
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const [, key, value] = match;
        env[key.trim()] = value.trim().replace(/^["']|["']$/g, ''); // Remove quotes
      }
    }

    // Check for critical variables
    const criticalVars = ['DATABASE_URL', 'ANTHROPIC_API_KEY'];
    for (const varName of criticalVars) {
      if (!env[varName]) {
        warnings.push(`Missing ${varName}`);
      }
    }

    return {
      success: true,
      env,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to read .env file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Start Synthesis services in Direct mode (spawn pnpm dev processes)
 */
export async function startDirectMode(
  cwd: string,
  envVars: Record<string, string>,
  onOutput?: (service: string, data: string) => void
): Promise<ProcessResult> {
  const processes: ProcessInfo[] = [];
  const errors: string[] = [];

  for (const service of SERVICES) {
    try {
      const proc = spawn(service.command, service.args, {
        cwd,
        env: { ...process.env, ...envVars }, // Merge environment variables
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      if (!proc.pid) {
        errors.push(`${service.name}: Failed to get process ID`);
        continue;
      }

      // Capture stdout
      proc.stdout?.on('data', (data) => {
        const text = data.toString();
        storeLog(service.name, text);
        onOutput?.(service.name, text);
      });

      // Capture stderr
      proc.stderr?.on('data', (data) => {
        const text = data.toString();
        storeLog(service.name, text);
        onOutput?.(service.name, text);
      });

      // Handle process errors
      proc.on('error', (err) => {
        const errorMsg = `${service.name}: ${err.message}`;
        errors.push(errorMsg);
        storeLog(service.name, `ERROR: ${errorMsg}`);
      });

      processes.push({
        pid: proc.pid,
        name: service.name,
        process: proc,
      });
    } catch (err) {
      const errorMsg = `Failed to start ${service.name}: ${err}`;
      errors.push(errorMsg);
    }
  }

  if (errors.length > 0) {
    // Stop any started processes
    await stopDirectMode(processes);
    return { success: false, error: errors.join('; ') };
  }

  return { success: true, processes };
}

/**
 * Stop all Direct mode processes with graceful shutdown and timeout
 */
export async function stopDirectMode(
  processes: ProcessInfo[]
): Promise<{ success: boolean; error?: string }> {
  const killPromises = processes.map(
    (procInfo) =>
      new Promise<void>((resolve) => {
        const { process: proc } = procInfo;

        // Set timeout for forceful kill (5 seconds)
        const timeout = setTimeout(() => {
          try {
            proc.kill('SIGKILL');
          } catch (err) {
            // Process might already be dead
          }
          resolve();
        }, 5000);

        // Listen for process exit
        proc.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });

        // Try graceful shutdown first
        try {
          proc.kill('SIGTERM');
        } catch (err) {
          // Process might already be dead
          clearTimeout(timeout);
          resolve();
        }
      })
  );

  await Promise.all(killPromises);
  logBuffers.clear(); // Clear logs on shutdown
  return { success: true };
}

/**
 * Get stored logs for a specific service or all services
 */
export async function getProcessLogs(service?: string): Promise<LogResult> {
  try {
    if (service) {
      const logs = logBuffers.get(service);
      if (!logs) {
        return { success: true, logs: `No logs for service: ${service}` };
      }
      return { success: true, logs: logs.join('') };
    }

    // Return all logs
    const allLogs: string[] = [];
    for (const [serviceName, logs] of logBuffers.entries()) {
      allLogs.push(`=== ${serviceName.toUpperCase()} ===\n`);
      allLogs.push(...logs);
      allLogs.push('\n');
    }

    return { success: true, logs: allLogs.join('') };
  } catch (error) {
    return {
      success: false,
      error: `Failed to get logs: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Check if a process is still running by PID
 */
export function isProcessRunning(pid: number): boolean {
  try {
    // Signal 0 is a special case: it doesn't actually send a signal,
    // but checks if the process exists
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
