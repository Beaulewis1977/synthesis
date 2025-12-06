/**
 * OpenAI Chat Provider
 *
 * Phase 16B: OpenAI provider implementation with manual tool execution loop.
 * Implements the ChatProvider interface for OpenAI GPT models.
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
 * OpenAI Chat Provider Implementation
 *
 * Key features:
 * - Manual tool execution loop (max 10 turns)
 * - Converts normalized ChatTool[] to OpenAI function calling format
 * - Handles system prompts via system role messages
 * - Executes tools using buildAgentTools().toolExecutors
 */
export class OpenAIChatProvider implements ChatProvider {
  readonly name = 'openai' as const;
  readonly capabilities: ProviderCapabilities = {
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
    maxContextTokens: 128000, // GPT-4 Turbo context window
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
              input: chunk.toolCall.input,
            });
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
      provider: 'openai',
    };
  }

  /**
   * Send chat message with streaming support
   * Implements manual tool execution loop with OpenAI streaming API
   */
  async *streamChat(params: ChatParams): AsyncGenerator<ChatStreamChunk, void, unknown> {
    // Get API key
    const apiKey = await getProviderApiKey(this.db, 'openai');
    if (!apiKey) {
      throw new Error(
        'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable or configure in Settings > API Keys.'
      );
    }

    // Create OpenAI client
    const client = new OpenAI({ apiKey });

    // Build tools and executors
    const { toolExecutors } = buildAgentTools(this.db, this.context);

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
              // Yield tool_start when we first see the name
              yield {
                type: 'tool_start',
                toolCall: { id: existing.id, name: existing.name },
              };
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

          // Yield tool_end
          yield { type: 'tool_end', toolCall: { id: tc.id, name: tc.name } };

          // Add tool result to messages
          messages.push({
            role: 'tool',
            content: result,
            tool_call_id: tc.id,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Tool execution failed';
          yield { type: 'tool_end', toolCall: { id: tc.id, name: tc.name } };
          messages.push({
            role: 'tool',
            content: JSON.stringify({ error: errorMessage }),
            tool_call_id: tc.id,
          });
        }
      }
      // Continue to next turn
    }

    // Max turns reached
    yield {
      type: 'done',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      stopReason: 'max_tokens',
    };
  }

  /**
   * Check if provider is configured (has API key)
   */
  async isConfigured(): Promise<boolean> {
    const apiKey = await getProviderApiKey(this.db, 'openai');
    return apiKey !== null;
  }

  /**
   * Prepare messages for OpenAI API
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
 * Factory function to create OpenAI provider instance
 */
export function createOpenAIProvider(db: Pool, context: ToolContext): ChatProvider {
  return new OpenAIChatProvider(db, context);
}
