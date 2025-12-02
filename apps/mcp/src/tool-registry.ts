/**
 * Tool Registry for Synthesis MCP Server
 *
 * Provides infrastructure for tool metadata management and dynamic tool
 * management (Sub-Phase 5.6). This module defines:
 * - ToolDefinition interface with toolpack/category/sensitive metadata
 * - ToolMetadata type for runtime tool introspection
 * - ToolRegistry class for tracking registered tools
 * - DynamicToolRegistry class for MCP handle management with enable/disable
 *
 * @module apps/mcp/src/tool-registry
 * @since GPT Phase 3: Sub-Phase 5.3, Extended in Sub-Phase 5.6.1
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZodRawShape, ZodTypeAny, z } from 'zod';

import { TOOLPACKS } from './toolpacks.js';
import { GATEWAY_TOOL_NAMES, isGatewayTool } from './types/gateway-schemas.js';
import type { DynamicToolConfig, ProfileName } from './types/profiles.js';
import { PROFILES, isValidProfile } from './types/profiles.js';
import type { McpToolHandle, SynthesisToolHandle, ToolState } from './types/tool-handle.js';

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

// =============================================================================
// Enable/Disable Result Type (5.6.1)
// =============================================================================

/**
 * Reason codes for enable/disable operation failures
 */
export type EnableDisableReason =
  | 'already_enabled'
  | 'already_disabled'
  | 'gateway_protected'
  | 'not_found'
  | 'sensitive_gated';

/**
 * Result type for enable/disable operations
 * Provides structured feedback for gateway tool implementations
 */
export interface EnableDisableResult {
  /** Whether the operation succeeded */
  ok: boolean;
  /** Reason for failure (only present when ok=false) */
  reason?: EnableDisableReason;
}

// =============================================================================
// Enhanced Registry Snapshot (5.6.1)
// =============================================================================

/**
 * Call statistics for usage analysis
 */
export interface CallStats {
  /** Total number of tool calls across all tools */
  totalCalls: number;
  /** Top tools by usage (up to 5) */
  topTools: Array<{ name: string; count: number }>;
}

/**
 * Enhanced registry snapshot with call statistics
 * Extends the base RegistrySnapshot from types/tool-handle.ts
 */
export interface EnhancedRegistrySnapshot {
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
  /** Call statistics for usage analysis */
  callStats: CallStats;
}

// =============================================================================
// Tool Registration Options (5.6.1)
// =============================================================================

/**
 * Options for registering a tool with DynamicToolRegistry
 */
export interface DynamicToolOptions {
  /** Tool description for MCP registration */
  description: string;
  /** Input schema shape for MCP SDK (Zod schema shape from z.object().shape) */
  inputSchema?: ZodRawShape;
  /** Toolpack this tool belongs to */
  toolpack: ToolpackName;
  /** Functional category of the tool */
  category: CategoryName;
  /** Whether this tool performs sensitive operations */
  sensitive?: boolean;
  /** Tool version for compatibility tracking */
  version?: string;
}

// =============================================================================
// SynthesisToolHandle Factory (5.6.1)
// =============================================================================

/**
 * Create a SynthesisToolHandle that wraps an MCP SDK handle
 *
 * The wrapper tracks enable state separately from the MCP SDK to provide
 * accurate state queries without calling the SDK.
 *
 * @param mcpHandle The underlying MCP SDK handle
 * @param metadata Tool metadata for the handle
 * @returns A SynthesisToolHandle with enable/disable methods
 */
export function createSynthesisHandle(
  mcpHandle: McpToolHandle,
  metadata: ToolMetadata
): SynthesisToolHandle {
  let _isEnabled = true; // All tools start enabled after registration

  return {
    mcpHandle,
    name: metadata.name,
    toolpack: metadata.toolpack,
    category: metadata.category,
    sensitive: metadata.sensitive,
    version: metadata.version,
    get isEnabled() {
      return _isEnabled;
    },
    enable() {
      if (!_isEnabled) {
        mcpHandle.enable();
        _isEnabled = true;
      }
    },
    disable() {
      if (_isEnabled) {
        mcpHandle.disable();
        _isEnabled = false;
      }
    },
  };
}

// =============================================================================
// DynamicToolRegistry Class (5.6.1)
// =============================================================================

/**
 * Dynamic Tool Registry for MCP Server
 *
 * Manages MCP tool handles for enable/disable operations, profile-based
 * startup, and toolpack management. This is the core implementation for
 * Sub-Phase 5.6 dynamic tool management.
 *
 * @example
 * ```typescript
 * const config = parseEnvConfig();
 * const registry = new DynamicToolRegistry(server, config);
 *
 * // Register a tool
 * registry.registerTool('search_rag', {
 *   description: 'Search the RAG knowledge base',
 *   inputSchema: { collectionId: z.string().uuid() },
 *   toolpack: 'core',
 *   category: 'core',
 * }, async (input) => { ... });
 *
 * // Apply startup profile
 * registry.applyProfile('minimal');
 *
 * // Enable tools on demand
 * registry.enableToolpack('mobile_core');
 * ```
 */
export class DynamicToolRegistry {
  /** MCP Server instance for tool registration */
  private server: McpServer;

  /** Map of tool name to SynthesisToolHandle */
  private handles: Map<string, SynthesisToolHandle> = new Map();

  /** Map of tool name to runtime state */
  private toolStates: Map<string, ToolState> = new Map();

  /** Map of tool name to handler function (for router/bridge execution) */
  private handlers: Map<
    string,
    // biome-ignore lint/suspicious/noExplicitAny: MCP SDK handler type is complex
    (input: any) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>
  > = new Map();

  /** Dynamic tool configuration from environment */
  private config: DynamicToolConfig;

  /** Server start time for uptime calculation */
  private startTime: number;

  /** Current active profile */
  private activeProfile: ProfileName;

  /** Set of gateway tool names (never disabled) */
  private readonly gatewayTools: Set<string>;

  /**
   * Create a new DynamicToolRegistry
   *
   * @param server MCP Server instance
   * @param config Dynamic tool configuration
   */
  constructor(server: McpServer, config: DynamicToolConfig) {
    this.server = server;
    this.config = config;
    this.startTime = Date.now();
    this.activeProfile = config.profile;
    this.gatewayTools = new Set(GATEWAY_TOOL_NAMES);
  }

  /**
   * Register a tool with the MCP server and store the handle
   *
   * @param name Tool name
   * @param options Tool registration options
   * @param handler Async handler function (typed to match MCP SDK expectations)
   * @returns The SynthesisToolHandle for the registered tool
   */
  registerTool(
    name: string,
    options: DynamicToolOptions,
    handler: (
      // biome-ignore lint/suspicious/noExplicitAny: MCP SDK handler type is complex
      input: any
    ) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>
  ): SynthesisToolHandle {
    // Register with MCP SDK
    const mcpOptions: { description: string; inputSchema?: ZodRawShape } = {
      description: options.description,
    };
    if (options.inputSchema) {
      mcpOptions.inputSchema = options.inputSchema;
    }

    // Cast the result to McpToolHandle (MCP SDK returns this type)
    // biome-ignore lint/suspicious/noExplicitAny: MCP SDK typing is complex
    const mcpHandle = (this.server as any).registerTool(name, mcpOptions, handler) as McpToolHandle;

    // Create metadata
    const metadata: ToolMetadata = {
      name,
      toolpack: options.toolpack,
      category: options.category,
      description: options.description,
      sensitive: options.sensitive ?? false,
      version: options.version ?? '1.0.0',
    };

    // Create wrapped handle
    const handle = createSynthesisHandle(mcpHandle, metadata);
    this.handles.set(name, handle);

    // Store handler for router/bridge execution
    this.handlers.set(name, handler);

    // Initialize tool state
    this.toolStates.set(name, {
      name,
      enabled: true,
      enabledAt: new Date(),
      callCount: 0,
      lastCalledAt: undefined,
    });

    return handle;
  }

  /**
   * Enable a tool by name
   *
   * @param name Tool name to enable
   * @returns Result indicating success or failure reason
   */
  enable(name: string): EnableDisableResult {
    const handle = this.handles.get(name);
    if (!handle) {
      return { ok: false, reason: 'not_found' };
    }

    if (handle.isEnabled) {
      return { ok: false, reason: 'already_enabled' };
    }

    handle.enable();

    // Update state
    const state = this.toolStates.get(name);
    if (state) {
      state.enabled = true;
      state.enabledAt = new Date();
    }

    return { ok: true };
  }

  /**
   * Disable a tool by name
   *
   * Gateway tools cannot be disabled.
   *
   * @param name Tool name to disable
   * @returns Result indicating success or failure reason
   */
  disable(name: string): EnableDisableResult {
    // Gateway tools cannot be disabled
    if (this.gatewayTools.has(name)) {
      return { ok: false, reason: 'gateway_protected' };
    }

    const handle = this.handles.get(name);
    if (!handle) {
      return { ok: false, reason: 'not_found' };
    }

    if (!handle.isEnabled) {
      return { ok: false, reason: 'already_disabled' };
    }

    handle.disable();

    // Update state
    const state = this.toolStates.get(name);
    if (state) {
      state.enabled = false;
    }

    return { ok: true };
  }

  /**
   * Enable all tools in a toolpack
   *
   * @param toolpack Toolpack name
   * @returns Array of tool names that were enabled
   */
  enableToolpack(toolpack: ToolpackName): string[] {
    const packDef = TOOLPACKS[toolpack];
    if (!packDef) {
      return [];
    }

    const enabled: string[] = [];
    for (const toolName of packDef.tools) {
      const result = this.enable(toolName);
      if (result.ok) {
        enabled.push(toolName);
      }
    }

    return enabled;
  }

  /**
   * Enable all tools in a category
   *
   * @param category Category name
   * @returns Array of tool names that were enabled
   */
  enableCategory(category: CategoryName): string[] {
    const enabled: string[] = [];

    for (const [name, handle] of this.handles) {
      if (handle.category === category) {
        const result = this.enable(name);
        if (result.ok) {
          enabled.push(name);
        }
      }
    }

    return enabled;
  }

  /**
   * Apply a startup profile
   *
   * This disables all non-gateway tools, then enables tools based on the
   * profile's toolpacks and additionalTools.
   *
   * @param profileName Profile name to apply
   * @throws Error if profile name is invalid
   */
  applyProfile(profileName: ProfileName): void {
    if (!isValidProfile(profileName)) {
      throw new Error(`Invalid profile: ${profileName}. Valid profiles: minimal, mobile, full`);
    }

    const profile = PROFILES[profileName];
    this.activeProfile = profileName;

    // 1. Disable ALL non-gateway tools
    for (const [name] of this.handles) {
      if (!this.gatewayTools.has(name)) {
        this.disable(name);
      }
    }

    // 2. Enable tools from profile toolpacks
    for (const toolpack of profile.toolpacks) {
      this.enableToolpack(toolpack);
    }

    // 3. Enable additional individual tools
    for (const tool of profile.additionalTools) {
      this.enable(tool);
    }
  }

  /**
   * Check if a tool is currently enabled
   *
   * @param name Tool name
   * @returns True if enabled, false if disabled or not found
   */
  isEnabled(name: string): boolean {
    const handle = this.handles.get(name);
    return handle?.isEnabled ?? false;
  }

  /**
   * Get the count of currently enabled tools
   *
   * @returns Number of enabled tools
   */
  getEnabledCount(): number {
    let count = 0;
    for (const handle of this.handles.values()) {
      if (handle.isEnabled) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get the count of sensitive tools
   *
   * @returns Number of tools marked as sensitive
   */
  getSensitiveToolCount(): number {
    let count = 0;
    for (const handle of this.handles.values()) {
      if (handle.sensitive) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get the total number of registered tools
   */
  get size(): number {
    return this.handles.size;
  }

  /**
   * Record a tool call for statistics
   *
   * @param name Tool name that was called
   */
  recordCall(name: string): void {
    const state = this.toolStates.get(name);
    if (state) {
      state.callCount++;
      state.lastCalledAt = new Date();
    }
  }

  /**
   * Get a snapshot of the registry state
   *
   * @returns Enhanced registry snapshot with tool states and call statistics
   */
  getSnapshot(): EnhancedRegistrySnapshot {
    const tools: ToolState[] = Array.from(this.toolStates.values());
    const enabledCount = this.getEnabledCount();
    const totalCount = this.handles.size;
    const uptimeMs = Date.now() - this.startTime;

    // Calculate call statistics
    const totalCalls = tools.reduce((sum, t) => sum + t.callCount, 0);
    const sortedByUsage = [...tools]
      .filter((t) => t.callCount > 0)
      .sort((a, b) => b.callCount - a.callCount)
      .slice(0, 5)
      .map((t) => ({ name: t.name, count: t.callCount }));

    return {
      tools,
      enabledCount,
      totalCount,
      activeProfile: this.activeProfile,
      uptimeMs,
      callStats: {
        totalCalls,
        topTools: sortedByUsage,
      },
    };
  }

  /**
   * Get a handle by name
   *
   * @param name Tool name
   * @returns The SynthesisToolHandle or undefined
   */
  getHandle(name: string): SynthesisToolHandle | undefined {
    return this.handles.get(name);
  }

  /**
   * List all registered tool names
   *
   * @returns Array of tool names
   */
  listTools(): string[] {
    return Array.from(this.handles.keys());
  }

  /**
   * List all enabled tool names
   *
   * @returns Array of enabled tool names
   */
  listEnabledTools(): string[] {
    return Array.from(this.handles.entries())
      .filter(([_, handle]) => handle.isEnabled)
      .map(([name]) => name);
  }

  /**
   * Get the current configuration
   */
  getConfig(): DynamicToolConfig {
    return this.config;
  }

  /**
   * Get the active profile name
   */
  getActiveProfile(): ProfileName {
    return this.activeProfile;
  }

  /**
   * Execute a tool by name with given parameters
   *
   * This method is used by gateway tools (router, bridge) to execute tools
   * programmatically. It bypasses the MCP SDK request flow and calls the
   * handler directly.
   *
   * @param name Tool name to execute
   * @param params Parameters to pass to the tool
   * @returns Tool result
   * @throws Error if tool handler not found
   */
  async execute(
    name: string,
    params: Record<string, unknown>
  ): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
    const handler = this.handlers.get(name);
    if (!handler) {
      throw new Error(`Tool handler not found: ${name}`);
    }
    return handler(params);
  }

  /**
   * Get the handler function for a tool
   *
   * This method is used to check if a tool exists before execution.
   *
   * @param name Tool name
   * @returns Handler function or undefined if not found
   */
  getToolHandler(name: string):
    | ((
        // biome-ignore lint/suspicious/noExplicitAny: MCP SDK handler type is complex
        input: any
      ) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>)
    | undefined {
    return this.handlers.get(name);
  }
}
