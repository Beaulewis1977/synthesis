/**
 * Ollama Chat Provider
 *
 * Phase 16B: Ollama provider implementation for local LLM chat.
 * Uses Ollama SDK for chat completion with local models.
 */

import { Ollama } from 'ollama';
import type { Pool } from 'pg';
import type {
  ChatParams,
  ChatProvider,
  ChatResponse,
  ChatStopReason,
  ChatStreamChunk,
  ProviderCapabilities,
  ToolContext,
} from './types.js';

/**
 * Ollama message format (simple role + content)
 */
interface OllamaMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Ollama Chat Provider Implementation
 *
 * Capabilities:
 * - No tool calling support (Ollama doesn't reliably support it)
 * - Streaming supported
 * - No vision support
 * - 8K context window (varies by model, conservative default)
 */
export class OllamaChatProvider implements ChatProvider {
  readonly name = 'ollama' as const;
  readonly capabilities: ProviderCapabilities = {
    supportsTools: false,
    supportsStreaming: true,
    supportsVision: false,
    maxContextTokens: 8192,
  };

  private readonly client: Ollama;

  constructor(
    _db: Pool, // Required by factory signature, not used by Ollama
    _context: ToolContext // Required by factory signature, not used by Ollama
  ) {
    // Get Ollama host from environment
    const host = process.env.OLLAMA_HOST ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    this.client = new Ollama({ host });
  }

  /**
   * Send chat message (non-streaming)
   */
  async chat(params: ChatParams): Promise<ChatResponse> {
    let content = '';
    let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let stopReason: ChatStopReason = 'end_turn';

    for await (const chunk of this.streamChat(params)) {
      switch (chunk.type) {
        case 'text':
          content += chunk.text ?? '';
          break;
        case 'done':
          usage = chunk.usage ?? usage;
          stopReason = chunk.stopReason ?? stopReason;
          break;
      }
    }

    return {
      content,
      toolCalls: [], // Ollama doesn't support tools
      stopReason,
      usage,
      model: params.model,
      provider: 'ollama',
    };
  }

  /**
   * Stream chat message
   */
  async *streamChat(params: ChatParams): AsyncGenerator<ChatStreamChunk, void, unknown> {
    const messages = this.toOllamaMessages(params);

    try {
      const response = await this.client.chat({
        model: params.model,
        messages,
        stream: true,
        options: {
          temperature: params.temperature,
          num_predict: params.maxTokens,
          stop: params.stopSequences,
        },
      });

      let inputTokens = 0;
      let outputTokens = 0;

      for await (const part of response) {
        // Yield text chunks
        if (part.message?.content) {
          yield { type: 'text', text: part.message.content };
        }

        // Capture token counts from final part
        if (part.done) {
          inputTokens = part.prompt_eval_count ?? 0;
          outputTokens = part.eval_count ?? 0;
        }
      }

      // Yield done with usage
      yield {
        type: 'done',
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        stopReason: 'end_turn',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Ollama streaming chat failed: ${message}`);
    }
  }

  /**
   * Check if Ollama is configured and reachable
   */
  async isConfigured(): Promise<boolean> {
    try {
      // Try to list models to verify Ollama is running
      await this.client.list();
      return true;
    } catch {
      // Ollama not reachable
      return false;
    }
  }

  /**
   * Convert normalized messages to Ollama format
   *
   * Ollama uses simple role + content string format:
   * - System messages are treated as a 'system' role
   * - User and assistant messages map directly
   * - Complex content blocks are stringified
   */
  private toOllamaMessages(params: ChatParams): OllamaMessage[] {
    const messages: OllamaMessage[] = [];

    // Add system prompt if provided
    if (params.systemPrompt) {
      messages.push({
        role: 'system',
        content: params.systemPrompt,
      });
    }

    // Convert normalized messages
    for (const msg of params.messages) {
      // Skip system messages (already handled above)
      if (msg.role === 'system') {
        continue;
      }

      // Convert content to string
      let content: string;
      if (typeof msg.content === 'string') {
        content = msg.content;
      } else {
        // Complex content blocks - extract text only
        content = msg.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text ?? '')
          .join('\n');
      }

      messages.push({
        role: msg.role,
        content,
      });
    }

    return messages;
  }
}

/**
 * Factory function for creating Ollama provider
 * Signature matches ChatProviderFactory type
 */
export function createOllamaProvider(db: Pool, context: ToolContext): OllamaChatProvider {
  return new OllamaChatProvider(db, context);
}
