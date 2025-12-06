/**
 * Tool Definition Adapters
 *
 * Phase 16F: Convert unified tool definitions to provider-specific formats.
 * Supports MCP format (Anthropic), ChatTool format (OpenAI/Google), and more.
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { Tool } from '@anthropic-ai/sdk/resources/messages.js';
import type { Pool } from 'pg';
import { z } from 'zod';
import type { ChatTool } from '../../services/chat-providers/types.js';
import type {
  BuiltAgentTools,
  BuiltChatTools,
  JsonSchemaObject,
  McpToolResult,
  ToolContext,
  ToolExecutor,
  ToolMetadata,
  UnifiedToolDefinition,
} from './types.js';

// biome-ignore lint/suspicious/noExplicitAny: MCP SDK handler accepts any input
type McpToolHandler = (args: Record<string, any>, extra: unknown) => Promise<McpToolResult>;

// =============================================================================
// JSON Schema Conversion
// =============================================================================

/**
 * Internal JSON Schema type for conversion
 */
type JsonSchema =
  | { type: 'string'; enum?: string[]; default?: unknown; description?: string }
  | { type: 'number'; default?: unknown; description?: string }
  | { type: 'boolean'; default?: unknown; description?: string }
  | { type: 'array'; items?: JsonSchema; default?: unknown; description?: string }
  | {
      type: 'object';
      properties: Record<string, JsonSchema>;
      required?: string[];
      default?: unknown;
      description?: string;
    };

/**
 * Convert a Zod schema to JSON Schema format
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  // Handle wrapped types first
  if (schema instanceof z.ZodDefault) {
    const inner = zodToJsonSchema(schema._def.innerType);
    // Merge default value with inner schema
    return { ...inner, default: schema._def.defaultValue() } as JsonSchema;
  }
  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema(schema._def.innerType);
  }
  if (schema instanceof z.ZodNullable) {
    return zodToJsonSchema(schema._def.innerType);
  }

  // Handle base types
  if (schema instanceof z.ZodString) {
    const result: JsonSchema = { type: 'string' };
    if (schema.description) result.description = schema.description;
    return result;
  }
  if (schema instanceof z.ZodNumber) {
    const result: JsonSchema = { type: 'number' };
    if (schema.description) result.description = schema.description;
    return result;
  }
  if (schema instanceof z.ZodBoolean) {
    const result: JsonSchema = { type: 'boolean' };
    if (schema.description) result.description = schema.description;
    return result;
  }
  if (schema instanceof z.ZodEnum) {
    const result: JsonSchema = { type: 'string', enum: schema._def.values };
    if (schema.description) result.description = schema.description;
    return result;
  }
  if (schema instanceof z.ZodArray) {
    const result: JsonSchema = {
      type: 'array',
      items: zodToJsonSchema(schema._def.type),
    };
    if (schema.description) result.description = schema.description;
    return result;
  }
  if (schema instanceof z.ZodObject) {
    const shape = schema._def.shape();
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value as z.ZodTypeAny);
      // Track required fields (not optional, not default)
      if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
        required.push(key);
      }
    }

    const result: JsonSchema = {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
    if (schema.description) result.description = schema.description;
    return result;
  }
  if (schema instanceof z.ZodRecord) {
    return { type: 'object', properties: {} };
  }

  // Fallback
  return { type: 'string' };
}

// =============================================================================
// MCP Tool Result Helpers
// =============================================================================

/**
 * Create a standard tool response string
 */
export function createToolResponse(message: string, payload?: unknown): string {
  return payload ? `${message}\n\n${JSON.stringify(payload, null, 2)}` : message;
}

/**
 * Create an MCP-compatible tool result
 */
export function createMcpToolResult(text: string, isError = false): McpToolResult {
  const result: McpToolResult = {
    content: [{ type: 'text' as const, text }],
  };
  if (isError) {
    result.isError = true;
  }
  return result;
}

// =============================================================================
// Adapter: Unified → Anthropic SDK Tool Format
// =============================================================================

/**
 * Convert a unified tool definition to Anthropic SDK Tool format
 */
export function toAnthropicTool(
  definition: UnifiedToolDefinition,
  db: Pool,
  context: ToolContext
): { definition: Tool; executor: ToolExecutor } {
  const jsonSchema = zodToJsonSchema(definition.inputSchema);

  return {
    definition: {
      name: definition.name,
      description: definition.description,
      input_schema: jsonSchema as Tool['input_schema'],
    },
    executor: definition.createExecutor(db, context),
  };
}

// =============================================================================
// Adapter: Unified → ChatTool Format
// =============================================================================

/**
 * Convert a unified tool definition to ChatTool format
 */
export function toChatTool(definition: UnifiedToolDefinition): ChatTool {
  const jsonSchema = zodToJsonSchema(definition.inputSchema) as JsonSchemaObject;

  return {
    name: definition.name,
    description: definition.description,
    inputSchema: jsonSchema,
  };
}

// =============================================================================
// Adapter: Unified → MCP SDK tool() Format
// =============================================================================

/**
 * Extract Zod shape from a ZodObject for MCP SDK tool() function
 */
function extractZodShape(schema: z.ZodTypeAny): Record<string, z.ZodTypeAny> {
  if (schema instanceof z.ZodObject) {
    return schema._def.shape();
  }
  // Return empty shape for non-object schemas
  return {};
}

/**
 * Convert a unified tool definition to MCP SDK tool() format.
 *
 * This creates a tool registration for the Claude Agent SDK's createSdkMcpServer().
 * The tool() function requires Zod schemas directly, not JSON Schema.
 */
export function toMcpSdkTool(
  definition: UnifiedToolDefinition,
  db: Pool,
  context: ToolContext
): ReturnType<typeof tool> {
  const shape = extractZodShape(definition.inputSchema);
  const executor = definition.createExecutor(db, context);

  // Create handler that matches MCP SDK expectations
  const handler: McpToolHandler = async (input) => {
    try {
      const result = await executor(input);
      return createMcpToolResult(result);
    } catch (error) {
      return createMcpToolResult(
        `Error in ${definition.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        true
      );
    }
  };

  return tool(definition.name, definition.description, shape, handler);
}

// =============================================================================
// Batch Adapters
// =============================================================================

/**
 * Build agent tools from unified definitions (for non-MCP providers)
 *
 * Returns tools in Anthropic SDK format with executors.
 */
export function buildAgentToolsFromDefinitions(
  definitions: UnifiedToolDefinition[],
  db: Pool,
  context: ToolContext
): BuiltAgentTools {
  const tools: Tool[] = [];
  const toolExecutors: Record<string, ToolExecutor> = {};
  const toolMetadata: Record<string, ToolMetadata> = {};

  for (const def of definitions) {
    const { definition, executor } = toAnthropicTool(def, db, context);
    tools.push(definition);
    toolExecutors[def.name] = executor;
    toolMetadata[def.name] = def.metadata;
  }

  return { tools, toolExecutors, toolMetadata };
}

/**
 * Build chat tools from unified definitions (for ChatProvider interface)
 */
export function buildChatToolsFromDefinitions(
  definitions: UnifiedToolDefinition[],
  db: Pool,
  context: ToolContext
): BuiltChatTools {
  const tools: ChatTool[] = [];
  const toolExecutors: Record<string, ToolExecutor> = {};

  for (const def of definitions) {
    tools.push(toChatTool(def));
    toolExecutors[def.name] = def.createExecutor(db, context);
  }

  return { tools, toolExecutors };
}

/**
 * Build MCP SDK tools from unified definitions (for Anthropic Claude Agent SDK)
 *
 * Returns an array of tool registrations for createSdkMcpServer().
 */
export function buildMcpSdkToolsFromDefinitions(
  definitions: UnifiedToolDefinition[],
  db: Pool,
  context: ToolContext
): ReturnType<typeof tool>[] {
  return definitions.map((def) => toMcpSdkTool(def, db, context));
}
