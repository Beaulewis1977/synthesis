/**
 * YAML/JSON Config Parser - Extracts structure from configuration files
 * Designed for backend infrastructure configs (docker-compose.yml, tsconfig.json, etc.)
 */

import type { BackendAST } from '@synthesis/shared';
import yaml from 'js-yaml';

/**
 * Parse YAML or JSON configuration file and extract structure.
 *
 * This parser analyzes configuration files to extract:
 * - Top-level keys (treated as config sections)
 * - Nested key paths for critical settings (using dot notation)
 * - Logical sections for chunking
 *
 * Security Note: Only extracts key names, never logs values to prevent secret exposure.
 *
 * @param content - Raw file content (YAML or JSON string)
 * @param filePath - File path for format detection (.yaml, .yml, .json)
 * @returns BackendAST structure with config sections in tables array
 *
 * @example
 * ```typescript
 * const content = `
 * database:
 *   host: localhost
 *   port: 5432
 * redis:
 *   host: localhost
 *   port: 6379
 * `;
 * const ast = await parseConfigFile(content, 'config.yml');
 * // Returns: {
 * //   tables: [
 * //     { name: 'database', columns: [{ name: 'host', type: 'string' }, ...] },
 * //     { name: 'redis', columns: [{ name: 'host', type: 'string' }, ...] }
 * //   ],
 * //   functions: [],
 * //   indexes: [],
 * //   constraints: []
 * // }
 * ```
 */
export async function parseConfigFile(content: string, filePath: string): Promise<BackendAST> {
  const ast: BackendAST = {
    tables: [],
    indexes: [],
    functions: [],
    constraints: [],
  };

  try {
    // Detect format from file extension
    const format = detectFormat(filePath);

    // Parse content based on format
    let configData: unknown;
    if (format === 'yaml') {
      configData = parseYAML(content, filePath);
    } else if (format === 'json') {
      configData = parseJSON(content, filePath);
    } else {
      console.warn(`Unsupported config format: ${format}`);
      return ast;
    }

    // Validate parsed data is an object
    if (!configData || typeof configData !== 'object') {
      console.warn(`Config file ${filePath} did not parse to an object`);
      return ast;
    }

    // Extract structure from parsed config
    extractConfigStructure(configData, ast, format, content);

    return ast;
  } catch (error) {
    console.error(`Failed to parse config file ${filePath}:`, error);
    // Return empty AST on error (graceful degradation)
    return ast;
  }
}

/**
 * Detect file format from extension.
 *
 * @param filePath - File path to analyze
 * @returns Format type ('yaml', 'json', or 'unknown')
 */
function detectFormat(filePath: string): 'yaml' | 'json' | 'unknown' {
  const extension = filePath.split('.').pop()?.toLowerCase();

  if (extension === 'yaml' || extension === 'yml') {
    return 'yaml';
  }
  if (extension === 'json') {
    return 'json';
  }

  return 'unknown';
}

/**
 * Parse YAML content using js-yaml library.
 *
 * @param content - YAML string content
 * @param filePath - File path (for error messages)
 * @returns Parsed JavaScript object
 * @throws {yaml.YAMLException} If YAML is malformed
 */
function parseYAML(content: string, filePath: string): unknown {
  try {
    return yaml.load(content, {
      filename: filePath,
      // Use safe schema to prevent arbitrary code execution
      schema: yaml.DEFAULT_SCHEMA,
    });
  } catch (error) {
    if (error instanceof yaml.YAMLException) {
      throw new Error(
        `YAML parse error in ${filePath} at line ${error.mark?.line}: ${error.message}`
      );
    }
    throw error;
  }
}

/**
 * Parse JSON content using native JSON.parse.
 *
 * @param content - JSON string content
 * @param filePath - File path (for error messages)
 * @returns Parsed JavaScript object
 * @throws {SyntaxError} If JSON is malformed
 */
function parseJSON(content: string, filePath: string): unknown {
  try {
    return JSON.parse(content);
  } catch (error) {
    if (error instanceof SyntaxError) {
      // Extract line number from error message if available
      const lineMatch = error.message.match(/line (\d+)/i);
      const line = lineMatch ? ` at line ${lineMatch[1]}` : '';
      throw new Error(`JSON parse error in ${filePath}${line}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Extract configuration structure and populate BackendAST.
 *
 * Treats top-level keys as "tables" (config sections) and nested keys as "columns".
 * This allows config files to be chunked and searched like database schemas.
 *
 * @param configData - Parsed config object
 * @param ast - BackendAST to populate
 * @param format - Config format (for metadata)
 * @param originalContent - Original content for line range estimation
 */
function extractConfigStructure(
  configData: unknown,
  ast: BackendAST,
  format: 'yaml' | 'json',
  originalContent: string
): void {
  if (typeof configData !== 'object' || configData === null) {
    return;
  }

  const obj = configData as Record<string, unknown>;

  // Process each top-level key as a config section
  for (const [sectionName, sectionValue] of Object.entries(obj)) {
    const columns = extractNestedKeys(sectionValue, sectionName, 0);

    const bounds = findSectionBounds(originalContent, sectionName);
    const commentSuffix = bounds?.lineRange
      ? ` (lines ${bounds.lineRange[0]}-${bounds.lineRange[1]})`
      : '';

    ast.tables.push({
      name: sectionName,
      columns,
      comment: `Config section from ${format} file${commentSuffix}`,
      lineRange: bounds?.lineRange,
      startOffset: bounds?.startOffset,
      endOffset: bounds?.endOffset,
    });
  }
}

/**
 * Recursively extract nested keys from config value.
 *
 * Converts nested structures to flat dot-notation paths:
 * - `{ database: { host: 'localhost' } }` → `database.host`
 * - `{ services: [{ name: 'web' }] }` → `services[].name`
 *
 * Limits depth to prevent excessive nesting.
 *
 * @param value - Config value to analyze
 * @param prefix - Dot-notation prefix for nested paths
 * @param depth - Current nesting depth
 * @param maxDepth - Maximum nesting depth (default: 3)
 * @returns Array of column definitions representing config keys
 */
function extractNestedKeys(
  value: unknown,
  prefix: string,
  depth: number,
  maxDepth = 3
): BackendAST['tables'][0]['columns'] {
  const columns: BackendAST['tables'][0]['columns'] = [];

  // Stop at max depth to prevent excessive nesting
  if (depth >= maxDepth) {
    columns.push({
      name: prefix,
      type: getConfigValueType(value),
      comment: 'Nested structure (depth limit reached)',
    });
    return columns;
  }

  // Handle null/undefined
  if (value === null || value === undefined) {
    columns.push({
      name: prefix,
      type: 'null',
    });
    return columns;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    if (value.length === 0) {
      columns.push({
        name: prefix,
        type: 'array',
        comment: 'Empty array',
      });
    } else {
      // Process first element to infer array structure
      const firstElement = value[0];
      if (typeof firstElement === 'object' && firstElement !== null) {
        // Array of objects - extract keys from first object
        const nestedColumns = extractNestedKeys(firstElement, `${prefix}[]`, depth + 1, maxDepth);
        columns.push(...nestedColumns);
      } else {
        // Array of primitives
        columns.push({
          name: prefix,
          type: `array<${getConfigValueType(firstElement)}>`,
          comment: `Array of ${value.length} items`,
        });
      }
    }
    return columns;
  }

  // Handle objects
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);

    // Empty object
    if (keys.length === 0) {
      columns.push({
        name: prefix,
        type: 'object',
        comment: 'Empty object',
      });
      return columns;
    }

    // Recursively process nested keys
    for (const [key, nestedValue] of Object.entries(obj)) {
      // Create dot-notation path (except for first level)
      const nestedPrefix = depth === 0 ? key : `${prefix}.${key}`;
      const nestedColumns = extractNestedKeys(nestedValue, nestedPrefix, depth + 1, maxDepth);
      columns.push(...nestedColumns);
    }

    return columns;
  }

  // Handle primitive values
  columns.push({
    name: prefix,
    type: getConfigValueType(value),
  });

  return columns;
}

/**
 * Get TypeScript-style type name for config value.
 *
 * Security: Never includes actual values to prevent secret exposure.
 *
 * @param value - Value to type-check
 * @returns Type name ('string', 'number', 'boolean', etc.)
 */
function getConfigValueType(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';

  const type = typeof value;

  // Return primitive types directly
  if (type === 'string' || type === 'number' || type === 'boolean') {
    return type;
  }

  if (type === 'object') {
    return 'object';
  }

  return 'unknown';
}

/**
 * Estimate line range for a config section in the original content.
 *
 * Note: This is approximate for YAML (js-yaml doesn't provide line numbers in parsed output).
 * For JSON, we cannot reliably determine line numbers without a custom parser.
 *
 * @param content - Original file content
 * @param sectionName - Top-level section name to find
 * @returns Line range tuple [startLine, endLine] or undefined if not found
 */
interface SectionBounds {
  lineRange?: [number, number];
  startOffset: number;
  endOffset: number;
}

function findSectionBounds(content: string, sectionName: string): SectionBounds | undefined {
  const lines = content.split('\n');
  const lineOffsets = getLineStartOffsets(content);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const isYamlKey = trimmed.startsWith(`${sectionName}:`);
    const isJsonKey = trimmed.startsWith(`"${sectionName}":`);

    if (!isYamlKey && !isJsonKey) {
      continue;
    }

    const indentLevel = Math.max(getIndentLevel(line), 0);
    let endLineExclusive = lines.length;

    for (let j = i + 1; j < lines.length; j++) {
      const candidate = lines[j];
      const candidateTrimmed = candidate.trim();

      if (
        !candidateTrimmed ||
        candidateTrimmed.startsWith('#') ||
        candidateTrimmed.startsWith('//')
      ) {
        continue;
      }

      const candidateIndent = Math.max(getIndentLevel(candidate), 0);

      if (candidateIndent <= indentLevel && isLikelyTopLevelKey(candidateTrimmed)) {
        endLineExclusive = j;
        break;
      }
    }

    const startOffset = lineOffsets[i] ?? 0;
    const endOffset =
      endLineExclusive < lineOffsets.length ? lineOffsets[endLineExclusive] : content.length;
    const lastLineIndex = Math.min(Math.max(endLineExclusive - 1, i), lines.length - 1);
    const lineRange: [number, number] = [i + 1, lastLineIndex + 1];

    return {
      lineRange,
      startOffset,
      endOffset,
    };
  }

  return undefined;
}

function getLineStartOffsets(content: string): number[] {
  const offsets: number[] = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') {
      offsets.push(i + 1);
    }
  }
  offsets.push(content.length);
  return offsets;
}

function isLikelyTopLevelKey(trimmedLine: string): boolean {
  return /^["']?[\w.-]+["']?\s*:/.test(trimmedLine);
}

/**
 * Get indentation level of a line (number of leading spaces).
 *
 * @param line - Line to analyze
 * @returns Number of leading spaces (0 for no indent, -1 for empty line)
 */
function getIndentLevel(line: string): number {
  if (!line || !line.trim()) {
    return -1; // Empty line
  }

  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}
