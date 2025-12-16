/**
 * Native Tools Index
 *
 * Export all native file system tools (sandboxed to collection directories).
 */

import type { UnifiedToolDefinition } from '../types.js';
import { bashCommandTool } from './bash-command.js';
import { globFilesTool } from './glob-files.js';
import { grepPatternTool } from './grep-pattern.js';
import { readFileTool } from './read-file.js';

/**
 * All native tools for file system operations
 */
export const NATIVE_TOOLS: UnifiedToolDefinition[] = [
  globFilesTool,
  grepPatternTool,
  readFileTool,
  bashCommandTool,
];

export { bashCommandTool } from './bash-command.js';
export { globFilesTool } from './glob-files.js';
export { grepPatternTool } from './grep-pattern.js';
export { readFileTool } from './read-file.js';
