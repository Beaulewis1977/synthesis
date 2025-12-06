/**
 * Z.AI (Zhipu) Chat Provider
 *
 * Phase 16B: Zhipu provider implementation using OpenAI-compatible API.
 * API Endpoint: https://api.z.ai/api/paas/v4
 * Models: GLM-4.6, GLM-4.5-Air
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
 * Z.AI (Zhipu) Chat Provider Implementation
 *
 * Uses OpenAI-compatible API at api.z.ai/api/paas/v4
 * Supports GLM-4 series models with tool calling and streaming
 *
 * Key features:
 * - OpenAI-compatible API format
 * - Manual tool execution loop (max 10 turns)
 * - Built-in web_search tool support (future enhancement)
 * - Handles system prompts via system role messages
 */
export class ZhipuChatProvider implements ChatProvider {
  readonly name = 'zhipu' as const;
  readonly capabilities: ProviderCapabilities = {
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: false, // GLM-4V supports vision, but not implemented yet
    maxContextTokens: 128000, // GLM-4.6 context window
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
      provider: 'zhipu',
    };
  }

  /**
   * Send chat message with streaming support
   * Implements manual tool execution loop with OpenAI-compatible streaming API
   */
  async *streamChat(params: ChatParams): AsyncGenerator<ChatStreamChunk, void, unknown> {
    // Get API key
    const apiKey = await getProviderApiKey(this.db, 'zhipu');
    if (!apiKey) {
      throw new Error(
        'Zhipu API key not configured. Please set ZHIPU_API_KEY environment variable or configure in Settings > API Keys.'
      );
    }

    // Create OpenAI client with Zhipu endpoint
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://api.z.ai/api/paas/v4',
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

    // Manual tool execution loop (max 10 turns)
    const MAX_TURNS = 10;
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
    const apiKey = await getProviderApiKey(this.db, 'zhipu');
    return apiKey !== null;
  }

  /**
   * Prepare messages for Zhipu API (OpenAI-compatible)
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
}

/**
 * Factory function to create Zhipu provider instance
 */
export function createZhipuProvider(db: Pool, context: ToolContext): ChatProvider {
  return new ZhipuChatProvider(db, context);
}
