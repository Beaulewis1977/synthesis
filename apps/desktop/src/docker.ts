/**
 * Docker orchestration module for Synthesis Desktop
 * Handles Docker Compose operations for the Synthesis stack
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { addLog } from './logger.js';
import type { CommandResult, DockerCheckResult, OperationResult } from './types.js';

/** Active Docker Compose process */
let activeProcess: ChildProcess | null = null;

/**
 * Get the path to docker-compose.yml
 * In dev: project root
 * In production: extraResources
 */
export function getComposeFilePath(): string {
  if (app.isPackaged) {
    // In packaged app, docker-compose.yml is in resources
    return path.join(process.resourcesPath, 'docker-compose.yml');
  }
  // In development, go up from apps/desktop to project root
  return path.join(app.getAppPath(), '..', '..', 'docker-compose.yml');
}

/**
 * Get the project root directory (for running docker compose)
 */
export function getProjectRoot(): string {
  if (app.isPackaged) {
    // In packaged app, use resources directory
    return process.resourcesPath;
  }
  // In development, go up from apps/desktop to project root
  return path.join(app.getAppPath(), '..', '..');
}

/**
 * Execute a command and return the result
 */
function execCommand(command: string, args: string[], cwd?: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd: cwd || getProjectRoot(),
      shell: process.platform === 'win32',
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      addLog('debug', text.trim(), 'docker');
    });

    proc.stderr?.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      // Docker compose often writes to stderr for progress
      addLog('debug', text.trim(), 'docker');
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        output: stdout,
        error: stderr || undefined,
        code: code ?? undefined,
      });
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        error: err.message,
      });
    });
  });
}

/**
 * Check if Docker is available and get version
 */
export async function checkDocker(): Promise<DockerCheckResult> {
  try {
    const result = await execCommand('docker', ['--version']);

    if (result.success && result.output) {
      const versionMatch = result.output.match(/Docker version ([\d.]+)/);
      addLog('info', `Docker found: ${result.output.trim()}`, 'docker');
      return {
        available: true,
        version: versionMatch ? versionMatch[1] : 'unknown',
      };
    }

    addLog('error', 'Docker not found or not running', 'docker');
    return {
      available: false,
      error: result.error || 'Docker not found',
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    addLog('error', `Docker check failed: ${error}`, 'docker');
    return {
      available: false,
      error,
    };
  }
}

/**
 * Check if Docker Compose is available
 */
export async function checkDockerCompose(): Promise<boolean> {
  const result = await execCommand('docker', ['compose', 'version']);
  return result.success;
}

/**
 * Start the Synthesis stack using Docker Compose
 */
export async function startSynthesis(): Promise<OperationResult> {
  const composePath = getComposeFilePath();
  const projectRoot = getProjectRoot();

  // Check if docker-compose.yml exists
  if (!existsSync(composePath)) {
    const error = `docker-compose.yml not found at ${composePath}`;
    addLog('error', error, 'docker');
    return { success: false, error };
  }

  addLog('info', 'Starting Synthesis stack...', 'docker');
  addLog('info', `Using compose file: ${composePath}`, 'docker');
  addLog('info', `Working directory: ${projectRoot}`, 'docker');

  // Start with --profile app to include server, web, and mcp services
  const result = await execCommand(
    'docker',
    ['compose', '-f', composePath, '--profile', 'app', 'up', '-d'],
    projectRoot
  );

  if (result.success) {
    addLog('info', 'Docker Compose started successfully', 'docker');
    return { success: true };
  }

  addLog('error', `Failed to start: ${result.error}`, 'docker');
  return {
    success: false,
    error: result.error || 'Failed to start Docker Compose',
  };
}

/**
 * Stop the Synthesis stack
 */
export async function stopSynthesis(): Promise<OperationResult> {
  const composePath = getComposeFilePath();
  const projectRoot = getProjectRoot();

  addLog('info', 'Stopping Synthesis stack...', 'docker');

  // Stop all services including those with profiles
  const result = await execCommand(
    'docker',
    ['compose', '-f', composePath, '--profile', 'app', 'down'],
    projectRoot
  );

  if (result.success) {
    addLog('info', 'Docker Compose stopped successfully', 'docker');
    return { success: true };
  }

  addLog('error', `Failed to stop: ${result.error}`, 'docker');
  return {
    success: false,
    error: result.error || 'Failed to stop Docker Compose',
  };
}

/**
 * Get the status of Docker containers
 */
export async function getContainerStatus(): Promise<Map<string, boolean>> {
  const status = new Map<string, boolean>();

  const result = await execCommand('docker', ['ps', '--format', '{{.Names}}:{{.Status}}']);

  if (!result.success || !result.output) {
    return status;
  }

  const lines = result.output.trim().split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const name = trimmed.slice(0, colonIndex).trim();
    const containerStatus = trimmed.slice(colonIndex + 1).trim();
    if (!name || !containerStatus) continue;

    const isRunning = containerStatus.toLowerCase().includes('up');
    status.set(name, isRunning);
  }

  return status;
}

/**
 * Check if a specific container is running
 */
export async function isContainerRunning(containerName: string): Promise<boolean> {
  const status = await getContainerStatus();
  return status.get(containerName) ?? false;
}

/**
 * Get logs from a specific container
 */
export async function getContainerLogs(containerName: string, lines = 100): Promise<string> {
  const result = await execCommand('docker', ['logs', '--tail', lines.toString(), containerName]);

  return result.output || result.error || '';
}

/**
 * Clean up on app exit
 */
export function cleanup(): void {
  if (activeProcess) {
    activeProcess.kill();
    activeProcess = null;
  }
}
