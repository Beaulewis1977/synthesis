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
import {
  fromOpenAIToolCall,
  mapOpenAIStopReason,
  toOpenAIMessages,
  toOpenAITool,
} from './adapters.js';
import { getProviderApiKey } from './index.js';
import type {
  ChatParams,
  ChatProvider,
  ChatResponse,
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
   * Send chat message with manual tool execution loop
   */
  async chat(params: ChatParams): Promise<ChatResponse> {
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
    let finalResponse: OpenAI.Chat.Completions.ChatCompletion | null = null;

    while (turnCount < MAX_TURNS) {
      turnCount++;

      // Call OpenAI API
      const response = await client.chat.completions.create({
        model: params.model,
        messages,
        tools: openaiTools,
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        stop: params.stopSequences,
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new Error('OpenAI returned no choices');
      }

      // Check for tool calls
      const toolCalls = choice.message.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        // No more tool calls - we're done
        finalResponse = response;
        break;
      }

      // Add assistant message with tool calls to history
      messages.push({
        role: 'assistant',
        content: choice.message.content,
        tool_calls: toolCalls,
      });

      // Execute each tool and collect results
      const toolResults: ChatCompletionMessageParam[] = [];

      for (const toolCall of toolCalls) {
        try {
          // Parse tool call
          const normalizedToolCall = fromOpenAIToolCall(toolCall);

          // Find and execute tool
          const executor = toolExecutors[normalizedToolCall.name];
          if (!executor) {
            throw new Error(`Unknown tool: ${normalizedToolCall.name}`);
          }

          // Execute tool (returns JSON string)
          const result = await executor(normalizedToolCall.input);

          // Add tool result message
          toolResults.push({
            role: 'tool',
            content: result,
            tool_call_id: toolCall.id,
          });
        } catch (error) {
          // Add error as tool result
          const errorMessage = error instanceof Error ? error.message : 'Tool execution failed';
          toolResults.push({
            role: 'tool',
            content: JSON.stringify({ error: errorMessage }),
            tool_call_id: toolCall.id,
          });
        }
      }

      // Append tool results to conversation
      messages.push(...toolResults);
    }

    if (!finalResponse) {
      throw new Error(`Max turns (${MAX_TURNS}) reached without completion`);
    }

    // Build normalized response
    return this.buildResponse(finalResponse, params.model);
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
    // Cast to SDK types - our adapter types are compatible at runtime
    messages.push(...(openaiMessages as ChatCompletionMessageParam[]));

    return messages;
  }

  /**
   * Build normalized ChatResponse from OpenAI response
   */
  private buildResponse(
    response: OpenAI.Chat.Completions.ChatCompletion,
    requestedModel: string
  ): ChatResponse {
    const choice = response.choices[0];
    if (!choice) {
      throw new Error('OpenAI returned no choices');
    }

    const message = choice.message;

    // Extract text content
    const content = message.content ?? '';

    // Extract tool calls (should be empty in final response)
    const toolCalls = (message.tool_calls ?? []).map(fromOpenAIToolCall);

    // Map stop reason
    const stopReason = mapOpenAIStopReason(choice.finish_reason);

    // Extract usage
    const usage = {
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    };

    return {
      content,
      toolCalls,
      stopReason,
      usage,
      model: response.model || requestedModel,
      provider: 'openai',
    };
  }
}

/**
 * Factory function to create OpenAI provider instance
 */
export function createOpenAIProvider(db: Pool, context: ToolContext): ChatProvider {
  return new OpenAIChatProvider(db, context);
}
