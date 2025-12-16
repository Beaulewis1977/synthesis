/**
 * Read File Tool Definition
 *
 * Read file contents within a collection's storage directory.
 * Sandboxed to prevent access outside collection boundaries.
 */

import * as fs from 'node:fs';
import { z } from 'zod';
import { createToolResponse } from '../adapters.js';
import type { ToolContext, UnifiedToolDefinition } from '../types.js';
import { validateSandboxPath } from './sandbox.js';

// =============================================================================
// Input Schema
// =============================================================================

const readFileInputSchema = z.object({
  path: z.string().min(1).describe('File path relative to collection root'),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .default(0)
    .describe('Start line number (0-indexed, default: 0)'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(2000)
    .optional()
    .default(500)
    .describe('Maximum number of lines to read (default: 500, max: 2000)'),
});

type ReadFileInput = z.infer<typeof readFileInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const readFileTool: UnifiedToolDefinition = {
  name: 'read_file',
  description:
    'Read the contents of a file within the collection storage directory. Returns line-numbered content.',
  inputSchema: readFileInputSchema,
  metadata: {
    toolpack: 'native',
    category: 'introspection',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: (_db, context: ToolContext) => async (input: unknown) => {
    const parsed = readFileInputSchema.parse(input) as ReadFileInput;

    // Validate and resolve path
    const filePath = validateSandboxPath(parsed.path, context.collectionId);

    try {
      // Check if file exists and is a file
      const stat = await fs.promises.stat(filePath);
      if (!stat.isFile()) {
        return createToolResponse(`Path "${parsed.path}" is not a file`);
      }

      // Check file size (skip very large files)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (stat.size > maxSize) {
        return createToolResponse(
          `File "${parsed.path}" is too large (${Math.round(stat.size / 1024 / 1024)}MB). Maximum size is 10MB.`
        );
      }

      // Read file content
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const allLines = content.split('\n');

      // Apply offset and limit
      const startLine = parsed.offset ?? 0;
      const lineLimit = parsed.limit ?? 500;
      const endLine = Math.min(startLine + lineLimit, allLines.length);
      const selectedLines = allLines.slice(startLine, endLine);

      // Format with line numbers
      const numberedLines = selectedLines.map((line, i) => {
        const lineNum = startLine + i + 1;
        const truncatedLine = line.length > 500 ? line.substring(0, 500) + '...' : line;
        return `${String(lineNum).padStart(6)}→${truncatedLine}`;
      });

      const payload = {
        file: parsed.path,
        start_line: startLine + 1,
        end_line: endLine,
        total_lines: allLines.length,
        returned_lines: selectedLines.length,
        truncated: endLine < allLines.length,
        content: numberedLines.join('\n'),
      };

      return createToolResponse(
        `Read ${selectedLines.length} line(s) from "${parsed.path}" (lines ${startLine + 1}-${endLine} of ${allLines.length}).`,
        payload
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return createToolResponse(`File not found: "${parsed.path}"`);
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      return createToolResponse(`Failed to read file: ${message}`);
    }
  },
};
