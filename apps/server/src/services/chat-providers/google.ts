/**
 * Google Gemini Chat Provider
 *
 * Phase 16B: Google provider implementation with manual tool execution loop.
 * Implements the ChatProvider interface for Google Gemini models.
 */

import {
  type Content,
  type FunctionCall,
  type FunctionDeclarationsTool,
  type FunctionResponse,
  GoogleGenerativeAI,
  type Part,
  SchemaType,
} from '@google/generative-ai';
import type { Pool } from 'pg';
import { buildAgentTools } from '../../agent/tools.js';
import { mapGoogleStopReason } from './adapters.js';
import { getProviderApiKey } from './index.js';
import type {
  ChatContentBlock,
  ChatMessage,
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
 * Google Gemini Chat Provider Implementation
 *
 * Key features:
 * - Manual tool execution loop (max 10 turns)
 * - Converts normalized ChatTool[] to Google functionDeclaration format
 * - Handles system prompts via systemInstruction parameter
 * - Executes tools using buildAgentTools().toolExecutors
 * - Supports streaming via generateContentStream()
 */
export class GoogleChatProvider implements ChatProvider {
  readonly name = 'google' as const;
  readonly capabilities: ProviderCapabilities = {
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
    maxContextTokens: 1000000, // Gemini supports up to 1M context window
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
      provider: 'google',
    };
  }

  /**
   * Send chat message with streaming support
   * Implements manual tool execution loop with Google Gemini streaming API
   */
  async *streamChat(params: ChatParams): AsyncGenerator<ChatStreamChunk, void, unknown> {
    // Get API key
    const apiKey = await getProviderApiKey(this.db, 'google');
    if (!apiKey) {
      throw new Error(
        'Google API key not configured. Please set GOOGLE_API_KEY environment variable or configure in Settings > API Keys.'
      );
    }

    // Create Google AI client
    const genAI = new GoogleGenerativeAI(apiKey);

    // Build tools and executors
    const { toolExecutors } = buildAgentTools(this.db, this.context);

    // Convert tools to Google functionDeclaration format
    // Using type assertion as Google SDK expects specific Schema types
    // but our normalized format uses JSON Schema which is compatible at runtime
    const tools: FunctionDeclarationsTool | undefined = params.tools
      ? ({
          functionDeclarations: params.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: {
              type: SchemaType.OBJECT,
              properties: this.convertPropertiesToGoogleSchema(tool.inputSchema.properties),
              required: tool.inputSchema.required,
            },
          })),
        } as FunctionDeclarationsTool)
      : undefined;

    // Prepare model with system instruction if provided
    const model = genAI.getGenerativeModel({
      model: params.model,
      systemInstruction: params.systemPrompt,
    });

    // Convert messages to Google Content format
    const contents = this.prepareMessages(params);

    // Manual tool execution loop (max 10 turns)
    const MAX_TURNS = 10;
    let turnCount = 0;
    const conversationHistory = [...contents];

    while (turnCount < MAX_TURNS) {
      turnCount++;

      // Create streaming request
      const request: Parameters<typeof model.generateContentStream>[0] = {
        contents: conversationHistory,
        tools: tools ? [tools] : undefined,
        generationConfig: {
          maxOutputTokens: params.maxTokens,
          temperature: params.temperature,
          stopSequences: params.stopSequences,
        },
      };

      const stream = await model.generateContentStream(request);

      // Accumulate response parts
      const responseParts: Part[] = [];
      const toolCallIds: string[] = [];
      let finishReason: string | undefined = undefined;
      let inputTokens = 0;
      let outputTokens = 0;

      // Stream chunks
      for await (const chunk of stream.stream) {
        if (!chunk.candidates?.[0]) continue;

        const candidate = chunk.candidates[0];
        finishReason = candidate.finishReason;

        // Stream text content
        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            responseParts.push(part);

            // Emit text if present
            if ('text' in part && part.text) {
              yield { type: 'text', text: part.text };
            }

            // Emit tool_start when we see a function call
            if ('functionCall' in part && part.functionCall) {
              const fc = part.functionCall as FunctionCall;
              const toolCallId = `google-${toolCallIds.length}-${Date.now()}`;
              toolCallIds.push(toolCallId);
              yield {
                type: 'tool_start',
                toolCall: { id: toolCallId, name: fc.name, input: fc.args },
              };
            }
          }
        }

        // Capture token usage from metadata
        if (chunk.usageMetadata) {
          inputTokens = chunk.usageMetadata.promptTokenCount ?? 0;
          outputTokens = chunk.usageMetadata.candidatesTokenCount ?? 0;
        }
      }

      // Check for function calls in response
      const functionCalls = responseParts.filter((part) => 'functionCall' in part) as Array<{
        functionCall: FunctionCall;
      }>;

      // If no tool calls, we're done
      if (functionCalls.length === 0) {
        yield {
          type: 'done',
          usage: {
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
          },
          stopReason: mapGoogleStopReason(finishReason),
        };
        return;
      }

      // Add assistant's response to conversation history
      conversationHistory.push({
        role: 'model',
        parts: responseParts,
      });

      // Execute tool calls
      const functionResponses: FunctionResponse[] = [];

      for (let i = 0; i < functionCalls.length; i++) {
        const fc = functionCalls[i].functionCall;
        const toolCallId = toolCallIds[i] ?? `google-${i}-${Date.now()}`;

        try {
          const normalizedName = fc.name;
          const executor = toolExecutors[normalizedName];

          if (!executor) {
            throw new Error(`Unknown tool: ${normalizedName}`);
          }

          // Execute tool with args
          const result = await executor(fc.args as Record<string, unknown>);

          // Yield tool_end with input
          yield { type: 'tool_end', toolCall: { id: toolCallId, name: fc.name, input: fc.args } };

          // Add function response
          functionResponses.push({
            name: fc.name,
            response: { result },
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Tool execution failed';
          yield { type: 'tool_end', toolCall: { id: toolCallId, name: fc.name, input: fc.args } };

          functionResponses.push({
            name: fc.name,
            response: { error: errorMessage },
          });
        }
      }

      // Add function responses to conversation history
      conversationHistory.push({
        role: 'user',
        parts: functionResponses.map((fr) => ({
          functionResponse: fr,
        })),
      });

      // Continue to next turn
    }

    // Max turns reached
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
    const apiKey = await getProviderApiKey(this.db, 'google');
    return apiKey !== null;
  }

  /**
   * Prepare messages for Google Gemini API
   * Converts normalized ChatMessage[] to Google Content[] format
   *
   * Google format:
   * - role: 'user' | 'model' (not 'assistant')
   * - parts: array of text, inlineData, functionCall, or functionResponse
   *
   * Note: System prompts handled via systemInstruction parameter, not in messages
   */
  private prepareMessages(params: ChatParams): Content[] {
    const contents: Content[] = [];

    for (const msg of params.messages) {
      // Skip system messages (handled via systemInstruction)
      if (msg.role === 'system') {
        continue;
      }

      // Map role: assistant -> model
      const role = msg.role === 'assistant' ? 'model' : 'user';

      // Convert content to parts
      const parts = this.messageToParts(msg);

      contents.push({ role, parts });
    }

    return contents;
  }

  /**
   * Convert a ChatMessage to Google Parts array
   */
  private messageToParts(msg: ChatMessage): Part[] {
    // Simple text message
    if (typeof msg.content === 'string') {
      return [{ text: msg.content }];
    }

    // Complex content blocks
    const blocks = msg.content as ChatContentBlock[];
    const parts: Part[] = [];

    for (const block of blocks) {
      switch (block.type) {
        case 'text':
          if (block.text) {
            parts.push({ text: block.text });
          }
          break;

        case 'tool_use':
          // Google uses functionCall format
          if (block.name && block.input) {
            parts.push({
              functionCall: {
                name: block.name,
                args: block.input as Record<string, unknown>,
              },
            });
          }
          break;

        case 'tool_result':
          // Google uses functionResponse format
          if (block.toolUseId && block.content !== undefined) {
            // Extract function name from toolUseId or content
            const functionName = this.extractFunctionNameFromToolResult(block);
            parts.push({
              functionResponse: {
                name: functionName,
                response: block.isError ? { error: block.content } : { result: block.content },
              },
            });
          }
          break;

        case 'image':
          // Google supports inline images via inlineData
          if (block.source?.type === 'base64' && block.source.data) {
            parts.push({
              inlineData: {
                mimeType: block.source.mediaType ?? 'image/png',
                data: block.source.data,
              },
            });
          }
          break;
      }
    }

    return parts.length > 0 ? parts : [{ text: '' }];
  }

  /**
   * Convert JSON Schema properties to Google Schema format
   */
  private convertPropertiesToGoogleSchema(
    properties: Record<string, unknown>
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [
        key,
        this.convertPropertyToGoogleSchema(value as Record<string, unknown>),
      ])
    );
  }

  /**
   * Convert a JSON Schema property to Google Schema format
   * Maps JSON Schema types to Google SchemaType enum values
   */
  private convertPropertyToGoogleSchema(prop: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (prop.type) {
      // Map JSON Schema type to Google SchemaType
      const typeMap: Record<string, (typeof SchemaType)[keyof typeof SchemaType]> = {
        string: SchemaType.STRING,
        number: SchemaType.NUMBER,
        integer: SchemaType.INTEGER,
        boolean: SchemaType.BOOLEAN,
        array: SchemaType.ARRAY,
        object: SchemaType.OBJECT,
      };
      result.type = typeMap[prop.type as string] ?? SchemaType.STRING;
    }

    if (prop.description) {
      result.description = prop.description;
    }

    if (prop.enum) {
      result.enum = prop.enum;
    }

    if (prop.items && typeof prop.items === 'object') {
      result.items = this.convertPropertyToGoogleSchema(prop.items as Record<string, unknown>);
    }

    if (prop.properties && typeof prop.properties === 'object') {
      result.properties = this.convertPropertiesToGoogleSchema(
        prop.properties as Record<string, unknown>
      );
    }

    if (prop.required) {
      result.required = prop.required;
    }

    return result;
  }

  /**
   * Extract function name from tool result block
   * Google requires function name in functionResponse, but our normalized
   * format only has toolUseId. We extract from content or use a placeholder.
   */
  private extractFunctionNameFromToolResult(block: ChatContentBlock): string {
    // Try to parse function name from content if it's a JSON string
    if (typeof block.content === 'string') {
      try {
        const parsed = JSON.parse(block.content);
        if (parsed.function_name || parsed.name) {
          return parsed.function_name || parsed.name;
        }
      } catch {
        // Not JSON, continue
      }
    }

    // Fallback: use toolUseId or generic name
    return block.toolUseId ?? 'unknown_function';
  }
}

/**
 * Factory function to create Google provider instance
 */
export function createGoogleProvider(db: Pool, context: ToolContext): ChatProvider {
  return new GoogleChatProvider(db, context);
}
