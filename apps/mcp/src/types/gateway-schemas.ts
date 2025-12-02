/**
 * Gateway Tool Input Schemas
 *
 * Zod schemas for the 5 always-on gateway tools per spec sections 3.1-3.5.
 * These tools form the dynamic tool management interface.
 *
 * @module apps/mcp/src/types/gateway-schemas
 * @since GPT Phase 3: Sub-Phase 5.6.0
 */

import { z } from 'zod';

// =============================================================================
// Shared Enum Schemas
// =============================================================================

/**
 * Toolpack names as Zod enum for validation
 * Note: 'gateway' excluded since gateway tools cannot be enabled/disabled
 */
export const toolpackNameSchema = z.enum(['core', 'mobile_core', 'introspection', 'graphing']);

/**
 * Category names as Zod enum for validation
 * Note: 'gateway' excluded since gateway tools cannot be filtered by category
 */
export const categoryNameSchema = z.enum(['core', 'mobile', 'graph', 'introspection']);

// =============================================================================
// 3.1 synthesis_discover_tools
// =============================================================================

/**
 * Input schema for synthesis_discover_tools
 *
 * Returns tool recommendations or full catalog for dynamic tool discovery.
 *
 * @example
 * // Get recommendations for a task
 * { task: "Find Flutter auth examples with Supabase" }
 *
 * @example
 * // List all available tools
 * { list_all: true }
 */
export const discoverToolsInputSchema = z
  .object({
    task: z
      .string()
      .optional()
      .describe('Describe what you want to accomplish - returns recommended tools/toolpacks'),
    list_all: z
      .boolean()
      .optional()
      .default(false)
      .describe('Return full catalog of all tools and toolpacks'),
  })
  .strict();

export type DiscoverToolsInput = z.infer<typeof discoverToolsInputSchema>;

// =============================================================================
// 3.2 enable_tools
// =============================================================================

/**
 * Input schema for enable_tools
 *
 * Enables tools by name, toolpack, or category. At least one must be provided.
 * Idempotent - enabling already-enabled tools is a no-op.
 *
 * @example
 * // Enable specific tools
 * { tools: ["search_mobile_docs", "find_code_examples"] }
 *
 * @example
 * // Enable entire toolpacks
 * { toolpacks: ["mobile_core", "introspection"] }
 *
 * @example
 * // Enable by category
 * { categories: ["mobile"] }
 */
export const enableToolsInputSchema = z
  .object({
    tools: z.array(z.string()).optional().describe('Specific tool names to enable'),
    toolpacks: z
      .array(toolpackNameSchema)
      .optional()
      .describe('Toolpacks to enable (e.g., "mobile_core", "introspection")'),
    categories: z
      .array(categoryNameSchema)
      .optional()
      .describe('Categories to enable (e.g., "mobile", "graph")'),
  })
  .strict()
  .refine(
    (data) =>
      (data.tools && data.tools.length > 0) ||
      (data.toolpacks && data.toolpacks.length > 0) ||
      (data.categories && data.categories.length > 0),
    { message: 'At least one of tools, toolpacks, or categories is required', path: ['tools'] }
  );

export type EnableToolsInput = z.infer<typeof enableToolsInputSchema>;

// =============================================================================
// 3.3 synthesis_router
// =============================================================================

/**
 * Input schema for synthesis_router
 *
 * Single entry point for tool execution with auto-enable support.
 * Validates params server-side using the tool's Zod schema.
 *
 * @example
 * {
 *   action: "search_mobile_docs",
 *   params: {
 *     collectionId: "123e4567-e89b-12d3-a456-426614174000",
 *     query: "auth with Supabase"
 *   }
 * }
 */
export const routerInputSchema = z
  .object({
    action: z.string().min(1).describe('Tool name to execute'),
    params: z.record(z.unknown()).describe('Tool parameters (validated server-side via Zod)'),
  })
  .strict();

export type RouterInput = z.infer<typeof routerInputSchema>;

// =============================================================================
// 3.4 synthesis_mcp_bridge
// =============================================================================

/**
 * Input schema for synthesis_mcp_bridge
 *
 * Direct MCP call bypassing local tool registration state.
 * Use as fallback when router/native tools fail due to stale client visibility.
 *
 * @example
 * {
 *   server: "synthesis",
 *   tool: "search_rag",
 *   params: { collectionId: "...", query: "..." }
 * }
 */
export const bridgeInputSchema = z
  .object({
    server: z.literal('synthesis').describe('MCP server name (must be "synthesis")'),
    tool: z.string().min(1).describe('MCP tool name to call'),
    params: z.record(z.unknown()).describe('Tool parameters'),
  })
  .strict();

export type BridgeInput = z.infer<typeof bridgeInputSchema>;

// =============================================================================
// 3.5 synthesis_search
// =============================================================================

/**
 * Input schema for synthesis_search
 *
 * Always-available general search fallback.
 * Equivalent to search_rag but always enabled.
 *
 * @example
 * {
 *   collectionId: "123e4567-e89b-12d3-a456-426614174000",
 *   query: "flutter authentication",
 *   top_k: 10,
 *   min_similarity: 0.6
 * }
 */
export const searchInputSchema = z
  .object({
    collectionId: z.string().uuid().describe('Collection to search'),
    query: z.string().min(1).describe('Search query'),
    top_k: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(5)
      .describe('Number of results to return (default: 5)'),
    min_similarity: z
      .number()
      .min(0)
      .max(1)
      .default(0.5)
      .describe('Minimum similarity threshold (default: 0.5)'),
  })
  .strict();

export type SearchInput = z.infer<typeof searchInputSchema>;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Extract Zod shape for MCP SDK 1.19.x compatibility
 *
 * The MCP SDK expects a plain object shape, not a full Zod schema.
 * This helper extracts the shape from a strict Zod object schema.
 *
 * @param schema - Zod object schema with .strict()
 * @returns Plain shape object for MCP SDK inputSchema
 */
export function toInputShape<T extends z.ZodRawShape>(schema: z.ZodObject<T, 'strict'>): T {
  return schema.shape;
}

// =============================================================================
// Gateway Tool Registry
// =============================================================================

/**
 * All gateway tool input schemas
 */
export const GATEWAY_SCHEMAS = {
  synthesis_discover_tools: discoverToolsInputSchema,
  enable_tools: enableToolsInputSchema,
  synthesis_router: routerInputSchema,
  synthesis_mcp_bridge: bridgeInputSchema,
  synthesis_search: searchInputSchema,
} as const;

/**
 * Gateway tool name type
 */
export type GatewayToolName = keyof typeof GATEWAY_SCHEMAS;

/**
 * List of all gateway tool names
 */
export const GATEWAY_TOOL_NAMES: GatewayToolName[] = [
  'synthesis_discover_tools',
  'enable_tools',
  'synthesis_router',
  'synthesis_mcp_bridge',
  'synthesis_search',
];

/**
 * Gateway tool descriptions for MCP registration
 */
export const GATEWAY_TOOL_DESCRIPTIONS: Record<GatewayToolName, string> = {
  synthesis_discover_tools:
    'Discover available tools and toolpacks. Returns recommendations based on task or full catalog with list_all=true.',
  enable_tools:
    'Enable tools by name, toolpack, or category. Emits notifications/tools/list_changed when tools are enabled.',
  synthesis_router:
    'Execute any tool with auto-enable support. Use when native tool is not visible. Validates params server-side.',
  synthesis_mcp_bridge:
    'Direct MCP call bypassing local state. Last resort when router and native tools fail.',
  synthesis_search:
    'Always-on search fallback. Search the RAG knowledge base for relevant information.',
};

/**
 * Check if a tool name is a gateway tool
 */
export function isGatewayTool(name: string): name is GatewayToolName {
  return GATEWAY_TOOL_NAMES.includes(name as GatewayToolName);
}
