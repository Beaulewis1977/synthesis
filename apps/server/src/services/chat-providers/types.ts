/**
 * Chat Provider Types
 *
 * Phase 16A: Provider-agnostic interfaces for multi-provider chat support.
 * Phase 16B: Updated with factory context for tool support.
 * These types normalize the differences between Anthropic, OpenAI, Google, etc.
 */

import type { LLMProvider } from '@synthesis/shared';
import type { Pool } from 'pg';

/**
 * Extended provider type including P2 providers (Zhipu, Moonshot)
 */
export type ChatProviderType = LLMProvider;

/**
 * Provider capability flags
 */
export interface ProviderCapabilities {
  /** Supports tool/function calling */
  supportsTools: boolean;
  /** Supports streaming responses */
  supportsStreaming: boolean;
  /** Supports vision/image input */
  supportsVision: boolean;
  /** Maximum context window (tokens) */
  maxContextTokens: number;
}

/**
 * Content block types for complex message content
 */
export interface ChatContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result';
  /** For text blocks */
  text?: string;
  /** For image blocks */
  source?: {
    type: 'base64' | 'url';
    mediaType?: string;
    data?: string;
    url?: string;
  };
  /** For tool_use blocks */
  id?: string;
  name?: string;
  input?: unknown;
  /** For tool_result blocks */
  toolUseId?: string;
  content?: string;
  isError?: boolean;
}

/**
 * Normalized message format (provider-agnostic)
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ChatContentBlock[];
}

/**
 * Normalized tool definition (provider-agnostic)
 * Based on JSON Schema format that all providers support
 */
export interface ChatTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Parameters for chat request
 */
export interface ChatParams {
  /** Conversation messages */
  messages: ChatMessage[];
  /** Model identifier (provider-specific) */
  model: string;
  /** System prompt (handled differently by each provider) */
  systemPrompt?: string;
  /** Tools available to the model */
  tools?: ChatTool[];
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Sampling temperature (0-1) */
  temperature?: number;
  /** Stop sequences */
  stopSequences?: string[];
}

/**
 * Normalized tool call from model response
 */
export interface ChatToolCall {
  /** Unique identifier for this tool call */
  id: string;
  /** Tool name */
  name: string;
  /** Tool input arguments */
  input: unknown;
}

/**
 * Token usage tracking
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Stop reason for model response
 */
export type ChatStopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';

/**
 * Normalized chat response (non-streaming)
 */
export interface ChatResponse {
  /** Text content from response */
  content: string;
  /** Tool calls requested by model */
  toolCalls: ChatToolCall[];
  /** Why the model stopped generating */
  stopReason: ChatStopReason;
  /** Token usage */
  usage: TokenUsage;
  /** Model that actually responded */
  model: string;
  /** Provider that handled request */
  provider: ChatProviderType;
}

/**
 * Streaming chunk types for real-time response
 */
export type ChatStreamChunkType =
  | 'text'
  | 'tool_start'
  | 'tool_delta'
  | 'tool_end'
  | 'usage'
  | 'done';

/**
 * Streaming chunk (for Phase 16C SSE streaming)
 */
export interface ChatStreamChunk {
  type: ChatStreamChunkType;
  /** For text chunks - the token/text fragment */
  text?: string;
  /** For tool chunks - partial tool call data */
  toolCall?: Partial<ChatToolCall>;
  /** For usage/done chunks - final token counts */
  usage?: TokenUsage;
  /** For done chunks - the stop reason */
  stopReason?: ChatStopReason;
}

/**
 * Chat provider interface
 *
 * Implementations must normalize their SDK's response format
 * to these common types.
 */
export interface ChatProvider {
  /** Provider identifier */
  readonly name: ChatProviderType;

  /** Provider capabilities */
  readonly capabilities: ProviderCapabilities;

  /**
   * Send chat message (non-streaming)
   * @param params Chat parameters
   * @returns Normalized response
   */
  chat(params: ChatParams): Promise<ChatResponse>;

  /**
   * Send chat message (streaming) - Phase 16C
   * Returns async generator for token-by-token streaming
   * @param params Chat parameters
   * @returns Async generator of stream chunks
   */
  streamChat?(params: ChatParams): AsyncGenerator<ChatStreamChunk, void, unknown>;

  /**
   * Check if provider is configured (has API key if required)
   * Async to support database lookup via ApiKeyService
   */
  isConfigured(): Promise<boolean>;
}

/**
 * Context required for tool execution in providers
 */
export interface ToolContext {
  /** Active collection ID for scoped operations */
  collectionId: string;
}

/**
 * Factory function signature for creating providers
 * Phase 16B: Updated to accept db pool and tool context
 */
export type ChatProviderFactory = (db: Pool, context: ToolContext) => ChatProvider;
