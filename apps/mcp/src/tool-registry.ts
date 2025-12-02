/**
 * Tool Registry for Synthesis MCP Server
 *
 * Provides infrastructure for tool metadata management to support future
 * dynamic tool management (Sub-Phase 5.6). This module defines:
 * - ToolDefinition interface with toolpack/category/sensitive metadata
 * - ToolMetadata type for runtime tool introspection
 * - Registry class for tracking registered tools
 *
 * @module apps/mcp/src/tool-registry
 * @since GPT Phase 3: Sub-Phase 5.3
 */

import type { z } from 'zod';

// =============================================================================
// Types & Interfaces
// =============================================================================

/**
 * Toolpack names for grouping related tools
 * Extended in 5.6.0 to include 'gateway' for always-on tools
 */
export type ToolpackName = 'core' | 'mobile_core' | 'introspection' | 'graphing' | 'gateway';

/**
 * Category names for tool classification
 * Extended in 5.6.0 to include 'gateway' for always-on tools
 */
export type CategoryName = 'core' | 'mobile' | 'graph' | 'introspection' | 'gateway';

/**
 * Tool result type returned by MCP tools
 */
export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/**
 * Complete tool definition including metadata for dynamic management
 *
 * Note: This registry is primarily for metadata introspection and 5.6 compatibility.
 * The actual tool schemas and handlers are registered directly with the MCP server
 * via server.registerTool(). The inputSchema and handler fields are optional here
 * because the registry serves as a metadata catalog, not the primary tool executor.
 */
export interface ToolDefinition<TInput = unknown> {
  /** Unique tool name (e.g., 'search_mobile_docs') */
  name: string;

  /** Toolpack this tool belongs to */
  toolpack: ToolpackName;

  /** Functional category of the tool */
  category: CategoryName;

  /** Human-readable description for agent prompts */
  description: string;

  /** Zod schema for input validation (optional - actual schema in server.registerTool) */
  inputSchema?: z.ZodType<TInput>;

  /** Async handler that executes the tool (optional - actual handler in server.registerTool) */
  handler?: (input: TInput) => Promise<ToolResult>;

  /** Whether this tool performs sensitive operations (delete, schema access) */
  sensitive?: boolean;

  /** Tool version for compatibility tracking */
  version?: string;
}

/**
 * Lightweight metadata for tool introspection (without handler)
 */
export interface ToolMetadata {
  name: string;
  toolpack: ToolpackName;
  category: CategoryName;
  description: string;
  sensitive: boolean;
  version: string;
}

// =============================================================================
// Tool Registry Class
// =============================================================================

/**
 * Registry for managing tool metadata
 *
 * This registry tracks tool definitions for future dynamic tool management.
 * In Sub-Phase 5.6, this will be extended to support enable/disable operations.
 *
 * @example
 * ```typescript
 * const registry = new ToolRegistry();
 *
 * registry.register({
 *   name: 'search_mobile_docs',
 *   toolpack: 'mobile_core',
 *   category: 'mobile',
 *   description: 'Search mobile documentation',
 *   inputSchema: searchMobileDocsInput,
 *   handler: async (input) => { ... },
 * });
 *
 * const metadata = registry.getMetadata('search_mobile_docs');
 * const allTools = registry.listTools();
 * ```
 */
export class ToolRegistry {
  /** Map of tool name to full definition */
  private tools: Map<string, ToolDefinition> = new Map();

  /** Set of currently enabled tools (all enabled by default for 5.3) */
  private enabledTools: Set<string> = new Set();

  /**
   * Register a tool with metadata
   * @param definition Complete tool definition
   */
  register(definition: ToolDefinition): void {
    const normalized: ToolDefinition = {
      ...definition,
      sensitive: definition.sensitive ?? false,
      version: definition.version ?? '1.0.0',
    };
    this.tools.set(definition.name, normalized);
    // All tools are enabled by default in 5.3
    this.enabledTools.add(definition.name);
  }

  /**
   * Get full definition for a tool
   * @param name Tool name
   * @returns Tool definition or undefined
   */
  getDefinition(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Get lightweight metadata for a tool (safe to expose to agents)
   * @param name Tool name
   * @returns Tool metadata or undefined
   */
  getMetadata(name: string): ToolMetadata | undefined {
    const def = this.tools.get(name);
    if (!def) return undefined;

    return {
      name: def.name,
      toolpack: def.toolpack,
      category: def.category,
      description: def.description,
      sensitive: def.sensitive ?? false,
      version: def.version ?? '1.0.0',
    };
  }

  /**
   * List all registered tool names
   * @returns Array of tool names
   */
  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * List all tool metadata
   * @returns Array of tool metadata objects
   */
  listMetadata(): ToolMetadata[] {
    return this.listTools()
      .map((name) => this.getMetadata(name))
      .filter((m): m is ToolMetadata => m !== undefined);
  }

  /**
   * Get tools by toolpack
   * @param toolpack Toolpack name
   * @returns Array of tool names in the toolpack
   */
  getToolsByToolpack(toolpack: ToolpackName): string[] {
    return Array.from(this.tools.entries())
      .filter(([_, def]) => def.toolpack === toolpack)
      .map(([name]) => name);
  }

  /**
   * Get tools by category
   * @param category Category name
   * @returns Array of tool names in the category
   */
  getToolsByCategory(category: CategoryName): string[] {
    return Array.from(this.tools.entries())
      .filter(([_, def]) => def.category === category)
      .map(([name]) => name);
  }

  /**
   * Get sensitive tools
   * @returns Array of sensitive tool names
   */
  getSensitiveTools(): string[] {
    return Array.from(this.tools.entries())
      .filter(([_, def]) => def.sensitive === true)
      .map(([name]) => name);
  }

  /**
   * Check if a tool is enabled
   * @param name Tool name
   * @returns True if enabled
   */
  isEnabled(name: string): boolean {
    return this.enabledTools.has(name);
  }

  /**
   * Get count of registered tools
   * @returns Number of tools
   */
  get size(): number {
    return this.tools.size;
  }

  /**
   * Clear all registered tools (for testing)
   */
  clear(): void {
    this.tools.clear();
    this.enabledTools.clear();
  }
}

// =============================================================================
// Global Registry Instance
// =============================================================================

/**
 * Global tool registry instance
 *
 * This is the shared registry used by the MCP server.
 * Tools register themselves during server initialization.
 */
export const toolRegistry = new ToolRegistry();

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create tool metadata object from partial definition
 * @param partial Partial tool definition with required fields
 * @returns Complete tool metadata
 */
export function createToolMetadata(
  partial: Pick<ToolMetadata, 'name' | 'toolpack' | 'category' | 'description'> &
    Partial<Pick<ToolMetadata, 'sensitive' | 'version'>>
): ToolMetadata {
  return {
    name: partial.name,
    toolpack: partial.toolpack,
    category: partial.category,
    description: partial.description,
    sensitive: partial.sensitive ?? false,
    version: partial.version ?? '1.0.0',
  };
}

/**
 * Validate that a string is a valid toolpack name
 * @param value Value to check
 * @returns True if valid toolpack name
 */
export function isValidToolpack(value: string): value is ToolpackName {
  return ['core', 'mobile_core', 'introspection', 'graphing', 'gateway'].includes(value);
}

/**
 * Validate that a string is a valid category name
 * @param value Value to check
 * @returns True if valid category name
 */
export function isValidCategory(value: string): value is CategoryName {
  return ['core', 'mobile', 'graph', 'introspection', 'gateway'].includes(value);
}
