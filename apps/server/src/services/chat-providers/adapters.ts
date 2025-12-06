/**
 * Tool Format Adapters
 *
 * Phase 16A: Convert between normalized ChatTool format and provider-specific formats.
 * Each provider has slightly different tool/function calling schemas.
 */

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.js';
import type { ChatContentBlock, ChatMessage, ChatTool, ChatToolCall } from './types.js';

// =============================================================================
// Anthropic Adapters
// =============================================================================

/**
 * Anthropic tool format
 */
export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Anthropic tool_use block from response
 */
export interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

/**
 * Anthropic message format
 */
export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

export type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

/**
 * Convert normalized tool to Anthropic format
 */
export function toAnthropicTool(tool: ChatTool): AnthropicTool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  };
}

/**
 * Convert Anthropic tool_use response to normalized format
 */
export function fromAnthropicToolUse(block: AnthropicToolUseBlock): ChatToolCall {
  return {
    id: block.id,
    name: block.name,
    input: block.input,
  };
}

/**
 * Convert normalized messages to Anthropic format
 * Note: System messages are handled separately in Anthropic API
 */
export function toAnthropicMessages(messages: ChatMessage[]): AnthropicMessage[] {
  return messages
    .filter((msg) => msg.role !== 'system') // System handled separately
    .map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: typeof msg.content === 'string' ? msg.content : toAnthropicContent(msg.content),
    }));
}

/**
 * Convert normalized content blocks to Anthropic format
 */
function toAnthropicContent(blocks: ChatContentBlock[]): AnthropicContentBlock[] {
  return blocks.map((block) => {
    switch (block.type) {
      case 'text':
        return { type: 'text' as const, text: block.text ?? '' };
      case 'tool_use':
        return {
          type: 'tool_use' as const,
          id: block.id ?? '',
          name: block.name ?? '',
          input: block.input,
        };
      case 'tool_result':
        return {
          type: 'tool_result' as const,
          tool_use_id: block.toolUseId ?? '',
          content: block.content ?? '',
          is_error: block.isError,
        };
      default:
        return { type: 'text' as const, text: '' };
    }
  });
}

// =============================================================================
// OpenAI Adapters
// =============================================================================

/**
 * OpenAI tool format (function calling)
 */
export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

/**
 * OpenAI tool call from response
 */
export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

/**
 * OpenAI message format
 */
export type OpenAIMessage = ChatCompletionMessageParam;

/**
 * Convert normalized tool to OpenAI function format
 */
export function toOpenAITool(tool: ChatTool): OpenAITool {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  };
}

/**
 * Convert OpenAI tool_call to normalized format
 */
export function fromOpenAIToolCall(call: OpenAIToolCall): ChatToolCall {
  let input: unknown;
  try {
    input = JSON.parse(call.function.arguments);
  } catch {
    input = call.function.arguments;
  }

  return {
    id: call.id,
    name: call.function.name,
    input,
  };
}

/**
 * Convert normalized messages to OpenAI format
 */
export function toOpenAIMessages(messages: ChatMessage[]): OpenAIMessage[] {
  return messages.flatMap((msg) => {
    if (typeof msg.content === 'string') {
      return [
        {
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content ?? '',
        },
      ];
    }

    // Handle complex content (tool results, etc.)
    return toOpenAIMessageWithContent(msg);
  });
}

/**
 * Convert message with content blocks to OpenAI format
 *
 * Note: This may expand a single normalized message into
 * multiple OpenAI messages (e.g. one per tool_result block).
 */
function toOpenAIMessageWithContent(msg: ChatMessage): OpenAIMessage[] {
  const blocks = msg.content as ChatContentBlock[];

  // Check for tool results
  const toolResults = blocks.filter((b) => b.type === 'tool_result' && b.toolUseId);
  if (toolResults.length > 0) {
    return toolResults.map((tr) => ({
      role: 'tool' as const,
      content: tr.content ?? '',
      tool_call_id: tr.toolUseId as string,
    }));
  }

  // Check for tool calls (assistant message)
  const toolCalls = blocks.filter((b) => b.type === 'tool_use');
  if (toolCalls.length > 0) {
    return [
      {
        role: 'assistant' as const,
        content: '',
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id ?? '',
          type: 'function' as const,
          function: {
            name: tc.name ?? '',
            arguments: JSON.stringify(tc.input ?? {}),
          },
        })),
      },
    ];
  }

  // Default: join text blocks
  const text = blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('\n');

  return [
    {
      role: msg.role as 'user' | 'assistant' | 'system',
      content: text,
    },
  ];
}

// =============================================================================
// Google AI Adapters (Gemini)
// =============================================================================

/**
 * Google functionDeclaration format
 */
export interface GoogleFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Google function call from response
 */
export interface GoogleFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

/**
 * Convert normalized tool to Google functionDeclaration
 */
export function toGoogleTool(tool: ChatTool): GoogleFunctionDeclaration {
  return {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties: tool.inputSchema.properties,
      required: tool.inputSchema.required,
    },
  };
}

/**
 * Convert Google function call to normalized format
 * Note: Google doesn't provide an ID, so we generate one
 */
export function fromGoogleFunctionCall(call: GoogleFunctionCall, index: number): ChatToolCall {
  return {
    id: `google-${index}-${Date.now()}`,
    name: call.name,
    input: call.args,
  };
}

// =============================================================================
// Stop Reason Mapping
// =============================================================================

/**
 * Map Anthropic stop reason to normalized format
 */
export function mapAnthropicStopReason(
  reason: string | null
): 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' {
  switch (reason) {
    case 'tool_use':
      return 'tool_use';
    case 'max_tokens':
      return 'max_tokens';
    case 'stop_sequence':
      return 'stop_sequence';
    default:
      return 'end_turn';
  }
}

/**
 * Map OpenAI finish reason to normalized format
 *
 * OpenAI's 'stop' indicates the model finished naturally (reached end or a stop sequence).
 * We map this to 'end_turn' for consistency with other providers (Google maps STOP -> end_turn).
 * Use 'content_filter' for OpenAI-specific filtering stops if needed.
 */
export function mapOpenAIStopReason(
  reason: string | null | undefined
): 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' {
  switch (reason) {
    case 'tool_calls':
      return 'tool_use';
    case 'length':
      return 'max_tokens';
    case 'stop':
      return 'end_turn'; // Natural completion, consistent with Google's STOP -> end_turn
    default:
      return 'end_turn';
  }
}

/**
 * Map Google finish reason to normalized format
 */
export function mapGoogleStopReason(
  reason: string | undefined
): 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' {
  switch (reason) {
    case 'STOP':
      return 'end_turn';
    case 'MAX_TOKENS':
      return 'max_tokens';
    case 'SAFETY':
    case 'RECITATION':
    case 'OTHER':
      return 'end_turn';
    default:
      return 'end_turn';
  }
}
