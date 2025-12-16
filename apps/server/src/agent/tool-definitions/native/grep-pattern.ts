/**
 * Grep Pattern Tool Definition
 *
 * Search file contents for regex patterns within a collection's storage directory.
 * Sandboxed to prevent access outside collection boundaries.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { glob } from 'glob';
import { z } from 'zod';
import { createToolResponse } from '../adapters.js';
import type { ToolContext, UnifiedToolDefinition } from '../types.js';
import { getCollectionDir, validateSandboxPath } from './sandbox.js';

// =============================================================================
// Input Schema
// =============================================================================

const grepPatternInputSchema = z.object({
  pattern: z.string().min(1).max(200).describe('Regex pattern to search for (max 200 characters)'),
  path: z.string().optional().describe('File or directory to search (default: collection root)'),
  glob: z.string().optional().describe('Filter files by glob pattern (e.g., "*.ts", "**/*.js")'),
  case_insensitive: z.boolean().optional().default(false).describe('Case insensitive search'),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .default(50)
    .describe('Maximum number of matches to return (default: 50)'),
  context_lines: z
    .number()
    .int()
    .min(0)
    .max(5)
    .optional()
    .default(0)
    .describe('Number of context lines before/after match (default: 0)'),
});

type GrepPatternInput = z.infer<typeof grepPatternInputSchema>;

interface GrepMatch {
  file: string;
  line: number;
  content: string;
  context_before?: string[];
  context_after?: string[];
}

// =============================================================================
// Tool Definition
// =============================================================================

export const grepPatternTool: UnifiedToolDefinition = {
  name: 'grep_pattern',
  description:
    'Search file contents for a regex pattern within the collection storage directory. Returns matching lines with file paths and line numbers.',
  inputSchema: grepPatternInputSchema,
  metadata: {
    toolpack: 'native',
    category: 'introspection',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: (_db, context: ToolContext) => async (input: unknown) => {
    const parsed = grepPatternInputSchema.parse(input) as GrepPatternInput;
    const collectionDir = getCollectionDir(context.collectionId);

    // Determine search path
    let searchPath = collectionDir;
    if (parsed.path) {
      searchPath = validateSandboxPath(parsed.path, context.collectionId);
    }

    try {
      // Compile regex
      const flags = parsed.case_insensitive ? 'gi' : 'g';
      const regex = new RegExp(parsed.pattern, flags);

      // Get files to search
      let filesToSearch: string[] = [];
      const stat = await fs.promises.stat(searchPath);

      if (stat.isFile()) {
        filesToSearch = [searchPath];
      } else if (stat.isDirectory()) {
        const pattern = parsed.glob || '**/*';
        const matches = await glob(pattern, {
          cwd: searchPath,
          nodir: true,
          dot: false,
          ignore: ['node_modules/**', '.git/**', '**/*.min.js', '**/*.map'],
        });
        filesToSearch = matches.map((m: string) => path.join(searchPath, m));
      }

      // Search files
      const results: GrepMatch[] = [];
      let totalMatches = 0;

      for (const filePath of filesToSearch) {
        if (results.length >= (parsed.max_results ?? 50)) break;

        try {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            if (results.length >= (parsed.max_results ?? 50)) break;

            const line = lines[i];
            if (regex.test(line)) {
              totalMatches++;
              regex.lastIndex = 0; // Reset regex state

              const match: GrepMatch = {
                file: path.relative(collectionDir, filePath),
                line: i + 1,
                content: line.trim().substring(0, 200),
              };

              // Add context if requested
              if (parsed.context_lines && parsed.context_lines > 0) {
                const ctxLines = parsed.context_lines;
                match.context_before = lines
                  .slice(Math.max(0, i - ctxLines), i)
                  .map((l) => l.trim().substring(0, 200));
                match.context_after = lines
                  .slice(i + 1, i + 1 + ctxLines)
                  .map((l) => l.trim().substring(0, 200));
              }

              results.push(match);
            }
          }
        } catch {}
      }

      const payload = {
        pattern: parsed.pattern,
        search_path: parsed.path || '.',
        files_searched: filesToSearch.length,
        matches: results,
        total_matches: totalMatches,
        returned: results.length,
        truncated: totalMatches > results.length,
      };

      return createToolResponse(
        `Found ${totalMatches} match(es) for "${parsed.pattern}" in ${filesToSearch.length} file(s)${totalMatches > results.length ? ` (showing first ${results.length})` : ''}.`,
        payload
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return createToolResponse(`Failed to search: ${message}`);
    }
  },
};
