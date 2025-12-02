/**
 * Toolpack Definitions for Synthesis MCP Server
 *
 * Defines logical groupings of tools (toolpacks) for:
 * - Organized tool discovery
 * - Batch enable/disable operations (Sub-Phase 5.6)
 * - Context window optimization
 *
 * @module apps/mcp/src/toolpacks
 * @since GPT Phase 3: Sub-Phase 5.3
 */

import type { CategoryName, ToolpackName } from './tool-registry.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Toolpack definition with metadata
 */
export interface ToolpackDefinition {
  /** Human-readable description of the toolpack */
  description: string;

  /** Default category for tools in this pack */
  defaultCategory: CategoryName;

  /** Tools included in this toolpack */
  tools: string[];

  /** Tools marked as sensitive within this pack */
  sensitive: string[];
}

/**
 * Complete toolpack configuration
 */
export type ToolpackConfig = Record<ToolpackName, ToolpackDefinition>;

// =============================================================================
// Toolpack Definitions
// =============================================================================

/**
 * Toolpack definitions for the Synthesis MCP server
 *
 * These groupings are designed for:
 * 1. Logical organization by use case
 * 2. Token optimization (enable only needed packs)
 * 3. Security (sensitive tools clearly marked)
 *
 * @example
 * ```typescript
 * // Get tools in mobile_core pack
 * const mobileTools = TOOLPACKS.mobile_core.tools;
 * // ['search_mobile_docs', 'find_code_examples', 'get_feature_recipe']
 *
 * // Check sensitive tools in introspection pack
 * const sensitiveTools = TOOLPACKS.introspection.sensitive;
 * // ['get_db_schema']
 * ```
 */
export const TOOLPACKS: ToolpackConfig = {
  /**
   * Mobile Core Pack
   *
   * Tools for mobile development documentation, examples, and recipes.
   * Primary use: Feature implementation workflows
   */
  mobile_core: {
    description: 'Mobile development: docs, examples, recipes',
    defaultCategory: 'mobile',
    tools: ['search_mobile_docs', 'find_code_examples', 'get_feature_recipe'],
    sensitive: [],
  },

  /**
   * Introspection Pack
   *
   * Tools for analyzing project structure, tech stack, and database schema.
   * Primary use: Understanding existing codebases
   */
  introspection: {
    description: 'Project analysis: tech stack, symbols, schema',
    defaultCategory: 'introspection',
    tools: ['get_project_tech_stack', 'get_db_schema', 'find_symbol_usages'],
    sensitive: ['get_db_schema'], // May expose database structure
  },

  /**
   * Graphing Pack
   *
   * Tools for knowledge graph traversal and context expansion.
   * Primary use: Code navigation and relationship discovery
   */
  graphing: {
    description: 'Knowledge graph traversal and context expansion',
    defaultCategory: 'graph',
    tools: ['graph_expand_context'],
    sensitive: [],
  },

  /**
   * Core Pack
   *
   * Basic RAG operations: search, collections, documents, repos.
   * Primary use: General knowledge management
   */
  core: {
    description: 'Basic RAG operations: collections, documents, repos',
    defaultCategory: 'core',
    tools: [
      'search_rag',
      'list_collections',
      'list_documents',
      'create_collection',
      'fetch_and_add_document_from_url',
      'delete_document',
      'delete_collection',
      'add_repo_to_collection',
      'sync_repo',
      'list_repos',
    ],
    sensitive: ['delete_document', 'delete_collection'], // Destructive operations
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get all tools across all toolpacks
 * @returns Array of all tool names
 */
export function getAllTools(): string[] {
  const tools = new Set<string>();
  for (const pack of Object.values(TOOLPACKS)) {
    for (const tool of pack.tools) {
      tools.add(tool);
    }
  }
  return Array.from(tools);
}

/**
 * Get all sensitive tools across all toolpacks
 * @returns Array of sensitive tool names
 */
export function getAllSensitiveTools(): string[] {
  const sensitive = new Set<string>();
  for (const pack of Object.values(TOOLPACKS)) {
    for (const tool of pack.sensitive) {
      sensitive.add(tool);
    }
  }
  return Array.from(sensitive);
}

/**
 * Get the toolpack a tool belongs to
 * @param toolName Tool name to look up
 * @returns Toolpack name or undefined
 */
export function getToolpackForTool(toolName: string): ToolpackName | undefined {
  for (const [packName, pack] of Object.entries(TOOLPACKS)) {
    if (pack.tools.includes(toolName)) {
      return packName as ToolpackName;
    }
  }
  return undefined;
}

/**
 * Check if a tool is marked as sensitive
 * @param toolName Tool name to check
 * @returns True if sensitive
 */
export function isToolSensitive(toolName: string): boolean {
  for (const pack of Object.values(TOOLPACKS)) {
    if (pack.sensitive.includes(toolName)) {
      return true;
    }
  }
  return false;
}

/**
 * Get toolpack definition by name
 * @param packName Toolpack name
 * @returns Toolpack definition or undefined
 */
export function getToolpack(packName: ToolpackName): ToolpackDefinition | undefined {
  return TOOLPACKS[packName];
}

/**
 * List all toolpack names
 * @returns Array of toolpack names
 */
export function listToolpacks(): ToolpackName[] {
  return Object.keys(TOOLPACKS) as ToolpackName[];
}

/**
 * Get tool count per toolpack
 * @returns Map of toolpack name to tool count
 */
export function getToolpackCounts(): Record<ToolpackName, number> {
  return {
    core: TOOLPACKS.core.tools.length,
    mobile_core: TOOLPACKS.mobile_core.tools.length,
    introspection: TOOLPACKS.introspection.tools.length,
    graphing: TOOLPACKS.graphing.tools.length,
  };
}

// =============================================================================
// Tool Metadata Mapping
// =============================================================================

/**
 * Map of tool names to their metadata (toolpack, category, sensitive)
 *
 * This provides a flat lookup table for tool metadata without needing
 * to search through toolpacks.
 */
export const TOOL_METADATA: Record<
  string,
  { toolpack: ToolpackName; category: CategoryName; sensitive: boolean }
> = {
  // Mobile Core
  search_mobile_docs: { toolpack: 'mobile_core', category: 'mobile', sensitive: false },
  find_code_examples: { toolpack: 'mobile_core', category: 'mobile', sensitive: false },
  get_feature_recipe: { toolpack: 'mobile_core', category: 'mobile', sensitive: false },

  // Introspection
  get_project_tech_stack: {
    toolpack: 'introspection',
    category: 'introspection',
    sensitive: false,
  },
  get_db_schema: { toolpack: 'introspection', category: 'introspection', sensitive: true },
  find_symbol_usages: { toolpack: 'introspection', category: 'introspection', sensitive: false },

  // Graphing
  graph_expand_context: { toolpack: 'graphing', category: 'graph', sensitive: false },

  // Core
  search_rag: { toolpack: 'core', category: 'core', sensitive: false },
  list_collections: { toolpack: 'core', category: 'core', sensitive: false },
  list_documents: { toolpack: 'core', category: 'core', sensitive: false },
  create_collection: { toolpack: 'core', category: 'core', sensitive: false },
  fetch_and_add_document_from_url: { toolpack: 'core', category: 'core', sensitive: false },
  delete_document: { toolpack: 'core', category: 'core', sensitive: true },
  delete_collection: { toolpack: 'core', category: 'core', sensitive: true },
  add_repo_to_collection: { toolpack: 'core', category: 'core', sensitive: false },
  sync_repo: { toolpack: 'core', category: 'core', sensitive: false },
  list_repos: { toolpack: 'core', category: 'core', sensitive: false },
};

/**
 * Get metadata for a tool from the flat lookup table
 * @param toolName Tool name
 * @returns Tool metadata or undefined
 */
export function getToolMetadata(
  toolName: string
): { toolpack: ToolpackName; category: CategoryName; sensitive: boolean } | undefined {
  return TOOL_METADATA[toolName];
}
