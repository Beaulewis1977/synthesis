/**
 * Glob Files Tool Definition
 *
 * Find files matching glob patterns within a collection's storage directory.
 * Sandboxed to prevent access outside collection boundaries.
 */

import * as path from 'node:path';
import { glob } from 'glob';
import { z } from 'zod';
import { createToolResponse } from '../adapters.js';
import type { ToolContext, UnifiedToolDefinition } from '../types.js';
import { getCollectionDir, validateSandboxPath } from './sandbox.js';

// =============================================================================
// Input Schema
// =============================================================================

const globFilesInputSchema = z.object({
  pattern: z.string().min(1).describe('Glob pattern (e.g., "**/*.ts", "src/*.js")'),
  path: z.string().optional().describe('Subdirectory to search within (default: collection root)'),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .default(100)
    .describe('Maximum number of results to return (default: 100)'),
});

type GlobFilesInput = z.infer<typeof globFilesInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const globFilesTool: UnifiedToolDefinition = {
  name: 'glob_files',
  description:
    'Find files matching a glob pattern within the collection storage directory. Returns relative paths.',
  inputSchema: globFilesInputSchema,
  metadata: {
    toolpack: 'native',
    category: 'introspection',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: (_db, context: ToolContext) => async (input: unknown) => {
    const parsed = globFilesInputSchema.parse(input) as GlobFilesInput;
    const collectionDir = getCollectionDir(context.collectionId);

    // Determine search directory
    let searchDir = collectionDir;
    if (parsed.path) {
      searchDir = validateSandboxPath(parsed.path, context.collectionId);
    }

    try {
      // Run glob search
      const matches = await glob(parsed.pattern, {
        cwd: searchDir,
        nodir: true,
        dot: false,
        ignore: ['node_modules/**', '.git/**'],
      });

      // Sort by path and limit results
      const sortedMatches = matches.sort().slice(0, parsed.max_results);

      // Convert to relative paths from collection root
      const relativePaths = sortedMatches.map((match: string) => {
        const fullPath = path.join(searchDir, match);
        return path.relative(collectionDir, fullPath);
      });

      const payload = {
        pattern: parsed.pattern,
        search_path: parsed.path || '.',
        matches: relativePaths,
        total_found: matches.length,
        returned: relativePaths.length,
        truncated: matches.length > (parsed.max_results ?? 100),
      };

      return createToolResponse(
        `Found ${matches.length} file(s) matching "${parsed.pattern}"${matches.length > relativePaths.length ? ` (showing first ${relativePaths.length})` : ''}.`,
        payload
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return createToolResponse(`Failed to search files: ${message}`);
    }
  },
};
