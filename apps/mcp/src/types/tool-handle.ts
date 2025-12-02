/**
 * Tool Handle Types for Synthesis MCP Server
 *
 * Wraps the MCP TypeScript SDK 1.19.x's tool handle interface for
 * dynamic tool management operations (enable/disable/update/remove).
 *
 * @module apps/mcp/src/types/tool-handle
 * @since GPT Phase 3: Sub-Phase 5.6.0
 */

import type { z } from 'zod';

// =============================================================================
// MCP SDK Types (based on @modelcontextprotocol/sdk 1.19.x)
// =============================================================================

/**
 * MCP SDK Tool Handle interface
 *
 * This represents the return type of `server.registerTool()` in MCP SDK 1.19.x.
 * The handle provides mutable operations that emit `notifications/tools/list_changed`.
 *
 * @see https://github.com/modelcontextprotocol/typescript-sdk
 */
export interface McpToolHandle {
  /**
   * Enable this tool - makes it visible in `tools/list` responses
   * Automatically emits `notifications/tools/list_changed` to connected clients
   */
  enable(): void;

  /**
   * Disable this tool - hides it from `tools/list` responses
   * The tool remains registered but not visible to clients
   * Automatically emits `notifications/tools/list_changed`
   */
  disable(): void;

  /**
   * Update tool definition (schema, description, etc.)
   * Automatically emits `notifications/tools/list_changed`
   */
  update(updates: McpToolUpdateOptions): void;

  /**
   * Remove this tool from the server entirely
   * Automatically emits `notifications/tools/list_changed`
   */
  remove(): void;
}

/**
 * Options for updating a tool via `handle.update()`
 */
export interface McpToolUpdateOptions {
  /** Updated tool title */
  title?: string;
  /** Updated tool description */
  description?: string;
  /** Updated input schema */
  inputSchema?: Record<string, unknown>;
  /** Updated output schema */
  outputSchema?: Record<string, unknown>;
}

// =============================================================================
// Extended Toolpack and Category Types
// =============================================================================

/**
 * Toolpack names for grouping related tools
 * Extended from base to include 'gateway' for always-on tools
 */
export type ToolpackName = 'core' | 'mobile_core' | 'introspection' | 'graphing' | 'gateway';

/**
 * Category names for tool classification
 * Extended from base to include 'gateway'
 */
export type CategoryName = 'core' | 'mobile' | 'graph' | 'introspection' | 'gateway';

// =============================================================================
// Synthesis Tool Handle (Extended)
// =============================================================================

/**
 * Extended tool handle with metadata tracking for Synthesis
 * Wraps the MCP SDK handle with additional metadata
 */
export interface SynthesisToolHandle {
  /** Underlying MCP SDK handle */
  mcpHandle: McpToolHandle;

  /** Tool name (e.g., 'search_mobile_docs') */
  name: string;

  /** Toolpack this tool belongs to */
  toolpack: ToolpackName;

  /** Functional category of the tool */
  category: CategoryName;

  /** Whether this tool performs sensitive operations */
  sensitive: boolean;

  /** Tool version for compatibility tracking */
  version: string;

  /** Human-readable description for agent prompts */
  description: string;

  /** Input schema as JSON Schema (for token measurement) */
  inputSchemaJson: Record<string, unknown>;

  /** Current enable state (tracked separately for metadata) */
  isEnabled: boolean;

  /**
   * Enable this tool with metadata tracking
   * Updates both MCP SDK state and internal metadata
   */
  enable(): void;

  /**
   * Disable this tool with metadata tracking
   * Updates both MCP SDK state and internal metadata
   */
  disable(): void;
}

// =============================================================================
// Tool State Tracking
// =============================================================================

/**
 * Tool state for tracking runtime information
 */
export interface ToolState {
  /** Tool name */
  name: string;

  /** Current enable state */
  enabled: boolean;

  /** Timestamp when tool was last enabled */
  enabledAt?: Date;

  /** Number of times this tool has been called */
  callCount: number;

  /** Timestamp of last tool invocation */
  lastCalledAt?: Date;
}

/**
 * Registry state snapshot for debugging/introspection
 */
export interface RegistrySnapshot {
  /** State of all registered tools */
  tools: ToolState[];

  /** Count of currently enabled tools */
  enabledCount: number;

  /** Total count of registered tools */
  totalCount: number;

  /** Active startup profile */
  activeProfile: ProfileName;

  /** Server uptime in milliseconds */
  uptimeMs: number;
}

// =============================================================================
// Profile Types
// =============================================================================

/**
 * Startup profile names
 */
export type ProfileName = 'minimal' | 'mobile' | 'full';

// =============================================================================
// Tool Definition (Extended for 5.6)
// =============================================================================

/**
 * Complete tool definition including handler for dynamic registration
 * Extends the base ToolDefinition from tool-registry.ts
 */
export interface DynamicToolDefinition<TInput = unknown> {
  /** Unique tool name (e.g., 'search_mobile_docs') */
  name: string;

  /** Toolpack this tool belongs to */
  toolpack: ToolpackName;

  /** Functional category of the tool */
  category: CategoryName;

  /** Human-readable description for agent prompts */
  description: string;

  /** Zod schema for input validation */
  inputSchema: z.ZodType<TInput>;

  /** Async handler that executes the tool */
  handler: (input: TInput) => Promise<ToolResult>;

  /** Whether this tool performs sensitive operations */
  sensitive: boolean;

  /** Tool version for compatibility tracking */
  version: string;

  /** Whether tool starts enabled (based on profile) */
  enabledByDefault: boolean;
}

/**
 * Tool result type returned by MCP tools
 */
export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a value is a valid toolpack name
 */
export function isValidToolpackName(value: unknown): value is ToolpackName {
  return (
    typeof value === 'string' &&
    ['core', 'mobile_core', 'introspection', 'graphing', 'gateway'].includes(value)
  );
}

/**
 * Check if a value is a valid category name
 */
export function isValidCategoryName(value: unknown): value is CategoryName {
  return (
    typeof value === 'string' &&
    ['core', 'mobile', 'graph', 'introspection', 'gateway'].includes(value)
  );
}

/**
 * Check if a value is a valid profile name
 */
export function isValidProfileName(value: unknown): value is ProfileName {
  return typeof value === 'string' && ['minimal', 'mobile', 'full'].includes(value);
}
