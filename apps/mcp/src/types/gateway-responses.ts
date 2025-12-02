/**
 * Gateway Tool Response Types
 *
 * Response type definitions for the 5 always-on gateway tools.
 * These ensure consistent API contracts across the dynamic tool management system.
 *
 * @module apps/mcp/src/types/gateway-responses
 * @since GPT Phase 3: Sub-Phase 5.6.0
 */

import type { CategoryName, ProfileName, ToolpackName } from './tool-handle.js';

// =============================================================================
// Common Types
// =============================================================================

/**
 * MCP content item (text-only for Synthesis)
 */
export interface ToolContentItem {
  type: 'text';
  text: string;
}

/**
 * Standard MCP tool result
 */
export interface ToolResult {
  content: ToolContentItem[];
  isError?: boolean;
}

/**
 * Tool reference with metadata
 */
export interface ToolRef {
  /** Tool name */
  name: string;

  /** Human-readable description */
  description: string;

  /** Toolpack this tool belongs to */
  toolpack: ToolpackName;

  /** Functional category */
  category: CategoryName;

  /** Whether this tool performs sensitive operations */
  sensitive: boolean;

  /** Tool version */
  version: string;

  /** Current enable state */
  enabled: boolean;

  /** Relevance score for task-based recommendations (0-1) */
  relevance?: number;
}

/**
 * Toolpack information for discovery
 */
export interface ToolpackInfo {
  /** Toolpack name */
  name: ToolpackName;

  /** Human-readable description */
  description: string;

  /** Tool names in this toolpack */
  tools: string[];

  /** Sensitive tools in this toolpack */
  sensitiveTools: string[];

  /** Default startup profile for this toolpack */
  defaultProfile: ProfileName;

  /** Count of enabled tools in this toolpack */
  enabledCount: number;

  /** Total tools in this toolpack */
  totalCount: number;
}

/**
 * Category information for discovery
 */
export interface CategoryInfo {
  /** Category name */
  name: CategoryName;

  /** Human-readable description */
  description: string;

  /** Tool names in this category */
  tools: string[];

  /** Count of enabled tools in this category */
  enabledCount: number;

  /** Total tools in this category */
  totalCount: number;
}

// =============================================================================
// synthesis_discover_tools Response
// =============================================================================

/**
 * Response from synthesis_discover_tools
 */
export interface DiscoverResult {
  /** Recommended tools based on task (only if task was provided) */
  recommended?: ToolRef[];

  /** All available toolpacks */
  toolpacks: ToolpackInfo[];

  /** All available categories */
  categories: CategoryInfo[];

  /** Suggestion message for the agent */
  suggestion?: string;

  /** Total registered tools */
  totalTools: number;

  /** Currently enabled tools */
  enabledTools: number;
}

// =============================================================================
// enable_tools Response
// =============================================================================

/**
 * Response from enable_tools
 */
export interface EnableResult {
  /** Tools that were newly enabled */
  enabled: string[];

  /** Tools that were already enabled (no-op) */
  alreadyEnabled: string[];

  /** Tool names that were not found */
  notFound: string[];

  /** Human-readable summary message */
  message: string;

  /** Whether notifications/tools/list_changed was sent */
  notificationSent: boolean;
}

// =============================================================================
// synthesis_router Response
// =============================================================================

/**
 * Router execution metadata
 */
export interface RouterMetadata {
  /** Whether the tool was auto-enabled for this call */
  enabledNow: boolean;

  /** Whether the tool is visible to the client after this call */
  visibleToClient: boolean;

  /** Tool version that was executed */
  toolVersion: string;

  /** Execution time in milliseconds */
  executionMs: number;
}

/**
 * Router error response (tool gated or not found)
 */
export interface RouterError {
  /** Error message */
  error: string;

  /** Whether the tool is gated (requires explicit enable) */
  gated: boolean;

  /** Tools that need to be enabled */
  requiresEnable?: string[];

  /** Profile that would enable the required tools */
  requiresProfile?: ProfileName;

  /** List of available tool names for suggestions */
  availableActions?: string[];
}

/**
 * Router success response
 */
export interface RouterSuccess {
  /** The actual tool result */
  result: ToolResult;

  /** Router execution metadata */
  _routerMetadata: RouterMetadata;
}

/**
 * Router result (success or error)
 */
export type RouterResult = RouterSuccess | RouterError;

/**
 * Type guard for router error
 */
export function isRouterError(result: RouterResult): result is RouterError {
  return 'error' in result && 'gated' in result;
}

/**
 * Type guard for router success
 */
export function isRouterSuccess(result: RouterResult): result is RouterSuccess {
  return 'result' in result && '_routerMetadata' in result;
}

// =============================================================================
// synthesis_mcp_bridge Response
// =============================================================================

/**
 * Response from synthesis_mcp_bridge
 */
export interface BridgeResult {
  /** Whether the call succeeded */
  success: boolean;

  /** The tool result (if success) */
  result?: ToolResult;

  /** Error message (if failure) */
  error?: string;

  /** MCP server that was called */
  server: string;

  /** Tool that was called */
  tool: string;
}

// =============================================================================
// synthesis_search Response
// =============================================================================

/**
 * Search result chunk
 */
export interface SearchChunk {
  /** Chunk ID */
  id: number;

  /** Chunk text content */
  text: string;

  /** Similarity score (0-1) */
  similarity: number;

  /** Parent document ID */
  documentId: string;

  /** Parent document title */
  documentTitle: string;

  /** Chunk metadata */
  metadata: Record<string, unknown>;
}

/**
 * Response from synthesis_search
 */
export interface SearchResult {
  /** Matching chunks */
  chunks: SearchChunk[];

  /** Original search query */
  query: string;

  /** Collection that was searched */
  collectionId: string;

  /** Number of results returned */
  count: number;

  /** Total matches before top_k limit (if available) */
  totalMatches?: number;
}

// =============================================================================
// Helper Types
// =============================================================================

/**
 * Result wrapper for consistent JSON serialization
 */
export interface GatewayResponse<T> {
  /** Response data */
  data: T;

  /** Timestamp of the response */
  timestamp: string;

  /** Gateway tool that produced this response */
  source: string;
}

/**
 * Create a gateway response wrapper
 */
export function wrapGatewayResponse<T>(data: T, source: string): GatewayResponse<T> {
  return {
    data,
    timestamp: new Date().toISOString(),
    source,
  };
}

/**
 * Convert any result to MCP ToolResult format
 */
export function toToolResult(data: unknown, isError = false): ToolResult {
  return {
    content: [
      {
        type: 'text',
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      },
    ],
    isError,
  };
}

// Re-export ProfileName for convenience
export type { ProfileName };
