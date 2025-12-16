/**
 * Sandbox Helper for Native Tools
 *
 * Validates that file paths are within allowed collection directories.
 * Prevents path traversal attacks (e.g., ../../etc/passwd).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Get the storage path from environment
 */
export function getStoragePath(): string {
  const storagePath = process.env.STORAGE_PATH;
  if (!storagePath) {
    throw new Error('STORAGE_PATH environment variable not set');
  }
  return storagePath;
}

/**
 * Get the collection directory path
 */
export function getCollectionDir(collectionId: string): string {
  const storagePath = getStoragePath();
  return path.join(storagePath, 'collections', collectionId);
}

/**
 * Validates that a path is within the allowed collection directory.
 * Returns the resolved absolute path or throws if outside sandbox.
 *
 * @param inputPath - The path to validate (relative to collection root)
 * @param collectionId - The collection ID for sandboxing
 * @returns Resolved absolute path within the collection directory
 * @throws Error if path is outside the sandbox
 */
export function validateSandboxPath(inputPath: string, collectionId: string): string {
  const collectionDir = getCollectionDir(collectionId);

  // Resolve the path relative to collection directory
  const resolved = path.resolve(collectionDir, inputPath);

  // Ensure the resolved path starts with the collection directory
  // Use path.sep to handle trailing slashes correctly
  const normalizedCollectionDir = collectionDir.endsWith(path.sep)
    ? collectionDir
    : collectionDir + path.sep;

  if (!resolved.startsWith(normalizedCollectionDir) && resolved !== collectionDir) {
    throw new Error(`Path "${inputPath}" is outside collection sandbox`);
  }

  return resolved;
}

/**
 * Check if a path exists within the sandbox
 */
export async function sandboxPathExists(inputPath: string, collectionId: string): Promise<boolean> {
  try {
    const resolved = validateSandboxPath(inputPath, collectionId);
    await fs.promises.access(resolved);
    return true;
  } catch {
    return false;
  }
}

/**
 * List of dangerous commands that should be blocked
 */
const BLOCKED_COMMANDS = [
  'rm',
  'rmdir',
  'mv',
  'cp',
  'chmod',
  'chown',
  'sudo',
  'su',
  'dd',
  'mkfs',
  'fdisk',
  'mount',
  'umount',
  'kill',
  'killall',
  'pkill',
  'shutdown',
  'reboot',
  'halt',
  'poweroff',
  'systemctl',
  'service',
  'apt',
  'apt-get',
  'yum',
  'dnf',
  'pacman',
  'brew',
  'npm',
  'yarn',
  'pnpm',
  'pip',
  'curl',
  'wget',
  'nc',
  'netcat',
  'ssh',
  'scp',
  'rsync',
  'git',
  'docker',
  'kubectl',
];

/**
 * Validate that a shell command is safe to execute
 *
 * @param command - The command to validate
 * @throws Error if command contains blocked operations
 */
export function validateCommand(command: string): void {
  const trimmed = command.trim().toLowerCase();

  // Block command substitution and backticks to avoid bypassing validation
  if (/\$\(|`/.test(command)) {
    throw new Error('Command substitution ($() or backticks) is not allowed');
  }

  // Block absolute paths to executables (bypass prevention)
  if (/\/(?:bin|usr|sbin|opt)\//.test(command)) {
    throw new Error('Absolute paths to executables are not allowed');
  }

  // Block shell variable expansion (bypass prevention)
  if (/\$\{|\$[A-Za-z_]/.test(command)) {
    throw new Error('Variable expansion is not allowed');
  }

  // Check for blocked commands at start of command or after pipe/semicolon
  for (const blocked of BLOCKED_COMMANDS) {
    const patterns = [
      new RegExp(`^${blocked}\\s`, 'i'),
      new RegExp(`^${blocked}$`, 'i'),
      new RegExp(`\\|\\s*${blocked}\\s`, 'i'),
      new RegExp(`\\|\\s*${blocked}$`, 'i'),
      new RegExp(`;\\s*${blocked}\\s`, 'i'),
      new RegExp(`;\\s*${blocked}$`, 'i'),
      new RegExp(`&&\\s*${blocked}\\s`, 'i'),
      new RegExp(`&&\\s*${blocked}$`, 'i'),
      new RegExp(`\\|\\|\\s*${blocked}\\s`, 'i'),
      new RegExp(`\\|\\|\\s*${blocked}$`, 'i'),
    ];

    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        throw new Error(`Command "${blocked}" is not allowed in sandbox mode`);
      }
    }
  }

  // Block path traversal in command arguments
  if (command.includes('..')) {
    throw new Error('Path traversal ("..") is not allowed in commands');
  }
}
