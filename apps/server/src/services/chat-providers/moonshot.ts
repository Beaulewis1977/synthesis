/**
 * Moonshot (Kimi) Chat Provider
 *
 * Phase 16D: Moonshot provider implementation with manual tool execution loop.
 * Implements the ChatProvider interface for Kimi models.
 *
 * Uses OpenAI-compatible API at api.moonshot.ai (international)
 * Models: kimi-k2-0905-preview, kimi-k2-thinking, kimi-k2-thinking-turbo
 *
 * Special Features:
 * - Thinking mode for kimi-k2-thinking* models (adds reasoning tokens)
 * - Built-in web search available via $web_search tool
 * - 256K context window for Kimi K2 models
 */

import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions.js';
import type { Pool } from 'pg';
import { buildAgentTools } from '../../agent/tools.js';
import { mapOpenAIStopReason, toOpenAIMessages, toOpenAITool } from './adapters.js';
import { getProviderApiKey } from './index.js';
import { ensureRegistryInitialized, getSessionAgentTools } from './registry-bridge.js';
import type {
  ChatParams,
  ChatProvider,
  ChatResponse,
  ChatStopReason,
  ChatStreamChunk,
  ChatToolCall,
  ProviderCapabilities,
  ToolContext,
} from './types.js';

/**
 * Moonshot Chat Provider Implementation
 *
 * Key features:
 * - Manual tool execution loop (max 25 turns)
 * - OpenAI-compatible API at api.moonshot.ai (international)
 * - Thinking mode for reasoning models (adds extra_body parameter)
 * - Uses standard OpenAI function calling format
 */
export class MoonshotChatProvider implements ChatProvider {
  readonly name = 'moonshot' as const;
  readonly capabilities: ProviderCapabilities = {
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: false, // Moonshot does not support vision yet
    maxContextTokens: 256000, // Kimi K2 supports 256K context
  };

  constructor(
    private readonly db: Pool,
    private readonly context: ToolContext
  ) {}

  /**
   * Send chat message with manual tool execution loop (non-streaming)
   * Internally uses streamChat() and accumulates results
   */
  async chat(params: ChatParams): Promise<ChatResponse> {
    let content = '';
    const toolCalls: ChatToolCall[] = [];
    let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let stopReason: ChatStopReason = 'end_turn';

    for await (const chunk of this.streamChat(params)) {
      switch (chunk.type) {
        case 'text':
          content += chunk.text ?? '';
          break;
        case 'tool_start':
          if (chunk.toolCall?.id && chunk.toolCall?.name) {
            toolCalls.push({
              id: chunk.toolCall.id,
              name: chunk.toolCall.name,
              input: chunk.toolCall.input, // May be undefined, updated in tool_end
            });
          }
          break;
        case 'tool_end':
          // Update tool call with parsed input (available after arguments accumulated)
          if (chunk.toolCall?.id && chunk.toolCall?.input !== undefined) {
            const tc = toolCalls.find((t) => t.id === chunk.toolCall?.id);
            if (tc) {
              tc.input = chunk.toolCall.input;
            }
          }
          break;
        case 'done':
          usage = chunk.usage ?? usage;
          stopReason = chunk.stopReason ?? stopReason;
          break;
      }
    }

    return {
      content,
      toolCalls,
      stopReason,
      usage,
      model: params.model,
      provider: 'moonshot',
    };
  }

  /**
   * Send chat message with streaming support
   * Implements manual tool execution loop with Moonshot streaming API
   */
  async *streamChat(params: ChatParams): AsyncGenerator<ChatStreamChunk, void, unknown> {
    // Get API key
    const apiKey = await getProviderApiKey(this.db, 'moonshot');
    if (!apiKey) {
      throw new Error(
        'Moonshot API key not configured. Please set MOONSHOT_API_KEY environment variable or configure in Settings > API Keys.'
      );
    }

    // Create Moonshot client (OpenAI-compatible)
    // Uses international endpoint (api.moonshot.ai) - for China mainland use api.moonshot.cn
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://api.moonshot.ai/v1',
    });

    // Initialize registry and build tools filtered by session
    ensureRegistryInitialized();
    const { toolExecutors } = this.context.sessionId
      ? getSessionAgentTools(this.db, this.context)
      : buildAgentTools(this.db, this.context);

    // Convert tools to OpenAI format
    const openaiTools: ChatCompletionTool[] | undefined = params.tools
      ? params.tools.map(toOpenAITool)
      : undefined;

    // Convert messages to OpenAI format (handles system prompt)
    const messages = this.prepareMessages(params);

    // Prepare extra_body for thinking mode
    const extraBody = this.prepareExtraBody(params.model);

    // Manual tool execution loop (max 25 turns)
    const MAX_TURNS = 25;
    let turnCount = 0;

    while (turnCount < MAX_TURNS) {
      turnCount++;

      // Create streaming request
      const stream = await client.chat.completions.create({
        model: params.model,
        messages,
        tools: openaiTools,
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        stop: params.stopSequences,
        stream: true,
        ...(extraBody && { extra_body: extraBody }),
      });

      // Track accumulated tool calls by index
      const toolCallsAccum = new Map<number, { id: string; name: string; arguments: string }>();
      // Track which tool indices have emitted tool_start to avoid duplicates
      const emittedToolStarts = new Set<number>();
      let finishReason: string | null = null;
      let promptTokens = 0;
      let completionTokens = 0;

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;

        finishReason = choice.finish_reason ?? finishReason;
        const delta = choice.delta;

        // Stream text content
        if (delta?.content) {
          yield { type: 'text', text: delta.content };
        }

        // Accumulate tool calls (streamed incrementally by index)
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const existing = toolCallsAccum.get(tc.index) ?? {
              id: '',
              name: '',
              arguments: '',
            };
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) {
              existing.name = tc.function.name;
              // Yield tool_start only once per tool (when we first see the name)
              if (!emittedToolStarts.has(tc.index)) {
                emittedToolStarts.add(tc.index);
                yield {
                  type: 'tool_start',
                  toolCall: { id: existing.id, name: existing.name },
                };
              }
            }
            if (tc.function?.arguments) {
              existing.arguments += tc.function.arguments;
            }
            toolCallsAccum.set(tc.index, existing);
          }
        }

        // Capture usage from final chunk
        if (chunk.usage) {
          promptTokens = chunk.usage.prompt_tokens ?? 0;
          completionTokens = chunk.usage.completion_tokens ?? 0;
        }
      }

      // If no tool calls, we're done
      if (finishReason !== 'tool_calls' || toolCallsAccum.size === 0) {
        yield {
          type: 'done',
          usage: {
            inputTokens: promptTokens,
            outputTokens: completionTokens,
            totalTokens: promptTokens + completionTokens,
          },
          stopReason: mapOpenAIStopReason(finishReason),
        };
        return;
      }

      // Execute tool calls
      const toolCallsArray = Array.from(toolCallsAccum.values());

      // Add assistant message with tool calls to history
      messages.push({
        role: 'assistant',
        content: null,
        tool_calls: toolCallsArray.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });

      // Execute each tool
      for (const tc of toolCallsArray) {
        try {
          const input = JSON.parse(tc.arguments);
          const normalizedName = tc.name;
          const executor = toolExecutors[normalizedName];

          if (!executor) {
            throw new Error(`Unknown tool: ${normalizedName}`);
          }

          const result = await executor(input);

          // Yield tool_end with parsed input
          yield { type: 'tool_end', toolCall: { id: tc.id, name: tc.name, input } };

          // Add tool result to messages
          messages.push({
            role: 'tool',
            content: result,
            tool_call_id: tc.id,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Tool execution failed';
          // Include input even on error (may have been parsed successfully)
          const parsedInput = (() => {
            try {
              return JSON.parse(tc.arguments);
            } catch {
              return undefined;
            }
          })();
          yield { type: 'tool_end', toolCall: { id: tc.id, name: tc.name, input: parsedInput } };
          messages.push({
            role: 'tool',
            content: JSON.stringify({ error: errorMessage }),
            tool_call_id: tc.id,
          });
        }
      }
      // Continue to next turn
    }

    // Max turns reached (not token limit, so use end_turn)
    yield {
      type: 'done',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      stopReason: 'end_turn',
    };
  }

  /**
   * Check if provider is configured (has API key)
   */
  async isConfigured(): Promise<boolean> {
    const apiKey = await getProviderApiKey(this.db, 'moonshot');
    return apiKey !== null;
  }

  /**
   * Prepare messages for Moonshot API
   * Handles system prompt by converting to system message
   */
  private prepareMessages(params: ChatParams): ChatCompletionMessageParam[] {
    const messages: ChatCompletionMessageParam[] = [];

    // Add system message if provided
    if (params.systemPrompt) {
      messages.push({
        role: 'system',
        content: params.systemPrompt,
      });
    }

    // Convert normalized messages to OpenAI format
    const openaiMessages = toOpenAIMessages(params.messages);
    messages.push(...openaiMessages);

    return messages;
  }

  /**
   * Prepare extra_body parameter for thinking mode
   * Kimi K2 thinking models support extended reasoning via extra_body
   *
   * @param model Model name
   * @returns extra_body object or undefined
   */
  private prepareExtraBody(model: string): Record<string, unknown> | undefined {
    // Check if model name includes 'thinking' (e.g., kimi-k2-thinking, kimi-k2-thinking-turbo)
    if (model.toLowerCase().includes('thinking')) {
      return {
        thinking: {
          type: 'enabled',
          max_tokens: 4096, // Allocate 4K tokens for reasoning
        },
      };
    }

    return undefined;
  }
}

/**
 * Factory function to create Moonshot provider instance
 */
export function createMoonshotProvider(db: Pool, context: ToolContext): ChatProvider {
  return new MoonshotChatProvider(db, context);
}
