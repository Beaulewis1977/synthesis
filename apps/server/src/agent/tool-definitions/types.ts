/**
 * Unified Tool Definition Types
 *
 * Phase 16F: Single source of truth for tool definitions.
 * These types are used to generate both MCP format (Claude Agent SDK)
 * and ChatTool format (OpenAI/Google/Zhipu/Moonshot) from the same source.
 */

import type { Tool } from '@anthropic-ai/sdk/resources/messages.js';
import type { Pool } from 'pg';
import type { z } from 'zod';
import type { ChatTool } from '../../services/chat-providers/types.js';

// =============================================================================
// Toolpack & Category Types
// =============================================================================

/**
 * Toolpack names for grouping related tools
 */
export type ToolpackName = 'core' | 'mobile_core' | 'introspection' | 'graphing' | 'gateway';

/**
 * Category names for tool classification
 */
export type CategoryName = 'core' | 'mobile' | 'graph' | 'introspection' | 'gateway';

// =============================================================================
// Tool Metadata
// =============================================================================

/**
 * Metadata for a tool definition
 */
export interface ToolMetadata {
  /** Toolpack this tool belongs to */
  toolpack: ToolpackName;
  /** Functional category of the tool */
  category: CategoryName;
  /** Whether this tool performs sensitive operations */
  sensitive: boolean;
  /** Tool version for compatibility tracking */
  version: string;
}

// =============================================================================
// Tool Context
// =============================================================================

/**
 * Context required for tool execution
 */
export interface ToolContext {
  /** Active collection ID for scoped operations */
  collectionId: string;
  /** Optional session ID for dynamic tool filtering (Phase 16F) */
  sessionId?: string;
}

// =============================================================================
// Tool Result Types
// =============================================================================

/**
 * Standard tool result (string for non-MCP providers)
 */
export type ToolResult = string;

/**
 * MCP tool result format required by Claude Agent SDK
 */
export interface McpToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

// =============================================================================
// Tool Executor Types
// =============================================================================

/**
 * Standard tool executor function (for OpenAI/Google/etc)
 */
export type ToolExecutor<TInput = unknown> = (input: TInput) => Promise<ToolResult>;

/**
 * MCP tool executor function (for Anthropic SDK)
 */
export type McpToolExecutor<TInput = unknown> = (input: TInput) => Promise<McpToolResult>;

// =============================================================================
// Unified Tool Definition
// =============================================================================

/**
 * JSON Schema type for tool input validation
 */
export interface JsonSchemaObject {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
}

/**
 * Unified tool definition - the single source of truth
 *
 * Each tool is defined once with:
 * - Zod schema for type safety and validation
 * - Executor function for tool logic
 * - Metadata for categorization and dynamic management
 *
 * Adapters convert this to provider-specific formats.
 *
 * Note: We use `z.ZodTypeAny` instead of `z.ZodType<TInput>` to allow
 * arrays of mixed tool definitions without type variance issues.
 */
export interface UnifiedToolDefinition {
  /** Unique tool name (e.g., 'search_rag') */
  name: string;

  /** Human-readable description for agent prompts */
  description: string;

  /** Zod schema for input validation */
  inputSchema: z.ZodTypeAny;

  /** Tool metadata for categorization */
  metadata: ToolMetadata;

  /**
   * Create an executor function for this tool.
   *
   * The executor is created with database and context dependencies,
   * allowing tools to access resources without coupling to global state.
   *
   * @param db Database pool for queries
   * @param context Tool context with collection ID
   * @returns Executor function that takes validated input
   */
  createExecutor: (db: Pool, context: ToolContext) => ToolExecutor;
}

// =============================================================================
// Toolpack Definition
// =============================================================================

/**
 * Toolpack definition with metadata
 */
export interface ToolpackDefinition {
  /** Toolpack name */
  name: ToolpackName;
  /** Human-readable description of the toolpack */
  description: string;
  /** Default category for tools in this pack */
  defaultCategory: CategoryName;
  /** Tool names included in this toolpack */
  tools: string[];
  /** Tool names marked as sensitive within this pack */
  sensitiveTools: string[];
}

// =============================================================================
// Profile Types (defined early for use in SessionToolState)
// =============================================================================

/**
 * Profile names for startup tool configuration
 */
export type ProfileName = 'minimal' | 'core' | 'full';

// =============================================================================
// Registry Types
// =============================================================================

/**
 * Tool state for runtime tracking
 */
export interface ToolState {
  /** Tool name */
  name: string;
  /** Whether tool is currently enabled */
  enabled: boolean;
  /** When the tool was enabled */
  enabledAt?: Date;
  /** Number of times tool has been called */
  callCount: number;
  /** Last time tool was called */
  lastCalledAt?: Date;
}

/**
 * Session state for tracking enabled tools per session
 */
export interface SessionToolState {
  /** Session identifier */
  sessionId: string;
  /** Set of enabled tool names */
  enabledTools: Set<string>;
  /** Active profile name */
  activeProfile: ProfileName;
  /** Session creation time */
  createdAt: Date;
  /** Last activity time */
  lastActivityAt: Date;
}

// =============================================================================
// Adapter Output Types
// =============================================================================

/**
 * Output from building tools for non-MCP providers
 */
export interface BuiltAgentTools {
  /** Tool definitions in Anthropic SDK format */
  tools: Tool[];
  /** Map of tool name to executor function */
  toolExecutors: Record<string, ToolExecutor>;
  /** Metadata for each tool */
  toolMetadata: Record<string, ToolMetadata>;
}

/**
 * Output from building tools for ChatProvider interface
 */
export interface BuiltChatTools {
  /** Tool definitions in ChatTool format */
  tools: ChatTool[];
  /** Map of tool name to executor function */
  toolExecutors: Record<string, ToolExecutor>;
}

// =============================================================================
// Enable/Disable Result Types
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
 */
export interface EnableDisableResult {
  /** Whether the operation succeeded */
  ok: boolean;
  /** Reason for failure (only present when ok=false) */
  reason?: EnableDisableReason;
}

// =============================================================================
// Profile Definition Types
// =============================================================================

/**
 * Profile definition for startup tool sets
 */
export interface ProfileDefinition {
  /** Profile name */
  name: ProfileName;
  /** Description of the profile */
  description: string;
  /** Toolpacks to enable by default */
  toolpacks: ToolpackName[];
  /** Additional individual tools to enable */
  additionalTools: string[];
}
