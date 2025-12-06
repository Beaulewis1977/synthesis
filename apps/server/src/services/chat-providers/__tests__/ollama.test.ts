/**
 * Ollama Chat Provider Tests
 *
 * Phase 16B: Unit tests for OllamaChatProvider
 */

import type { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatParams, ToolContext } from '../types.js';

// =============================================================================
// Mocks for Ollama SDK
// =============================================================================

const chatMock = vi.hoisted(() => vi.fn());
const listMock = vi.hoisted(() => vi.fn());

vi.mock('ollama', () => ({
  Ollama: vi.fn().mockImplementation(() => ({
    chat: chatMock,
    list: listMock,
  })),
}));

// =============================================================================
// Test Helpers
// =============================================================================

function createMockPool(): Pool {
  return {} as Pool;
}

function createMockContext(): ToolContext {
  return {
    collectionId: '11111111-1111-4111-8111-111111111111',
  };
}

/**
 * Create a mock streaming response for Ollama
 * Returns an async generator that yields streaming chunks
 */
function createMockOllamaStreamResponse(options: {
  content?: string;
  promptEvalCount?: number;
  evalCount?: number;
}) {
  return (async function* () {
    // Yield content chunk
    if (options.content) {
      yield {
        message: {
          role: 'assistant',
          content: options.content,
        },
        done: false,
      };
    }

    // Yield final chunk with token counts
    yield {
      message: {
        role: 'assistant',
        content: '',
      },
      done: true,
      prompt_eval_count: options.promptEvalCount ?? 0,
      eval_count: options.evalCount ?? 0,
    };
  })();
}

// =============================================================================
// Tests
// =============================================================================

describe('OllamaChatProvider', () => {
  let OllamaChatProvider: typeof import('../ollama.js')['OllamaChatProvider'];
  let createOllamaProvider: typeof import('../ollama.js')['createOllamaProvider'];

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();

    // Reset module to get fresh import with mocks
    vi.resetModules();
    ({ OllamaChatProvider, createOllamaProvider } = await import('../ollama.js'));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('constructor', () => {
    it('should create provider with default Ollama host', () => {
      const db = createMockPool();
      const context = createMockContext();

      const provider = new OllamaChatProvider(db, context);

      expect(provider.name).toBe('ollama');
      expect(provider.capabilities.supportsTools).toBe(false);
      expect(provider.capabilities.supportsStreaming).toBe(true);
      expect(provider.capabilities.supportsVision).toBe(false);
      expect(provider.capabilities.maxContextTokens).toBe(8192);
    });

    it('should use OLLAMA_HOST environment variable when set', async () => {
      vi.stubEnv('OLLAMA_HOST', 'http://custom-host:11434');

      vi.resetModules();
      const { Ollama } = await import('ollama');
      const { OllamaChatProvider: FreshProvider } = await import('../ollama.js');

      const db = createMockPool();
      const context = createMockContext();

      new FreshProvider(db, context);

      expect(Ollama).toHaveBeenCalledWith({ host: 'http://custom-host:11434' });
    });

    it('should use OLLAMA_BASE_URL as fallback', async () => {
      vi.stubEnv('OLLAMA_BASE_URL', 'http://base-url-host:11434');

      vi.resetModules();
      const { Ollama } = await import('ollama');
      const { OllamaChatProvider: FreshProvider } = await import('../ollama.js');

      const db = createMockPool();
      const context = createMockContext();

      new FreshProvider(db, context);

      expect(Ollama).toHaveBeenCalledWith({ host: 'http://base-url-host:11434' });
    });
  });

  describe('chat', () => {
    it('should send chat with simple message and return normalized response', async () => {
      chatMock.mockImplementation(() =>
        createMockOllamaStreamResponse({
          content: 'Hello! How can I help you today?',
          promptEvalCount: 15,
          evalCount: 10,
        })
      );

      const db = createMockPool();
      const context = createMockContext();
      const provider = new OllamaChatProvider(db, context);

      const params: ChatParams = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'llama3.2:3b',
      };

      const response = await provider.chat(params);

      expect(chatMock).toHaveBeenCalledWith({
        model: 'llama3.2:3b',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        options: {
          temperature: undefined,
          num_predict: undefined,
          stop: undefined,
        },
      });

      expect(response.content).toBe('Hello! How can I help you today?');
      expect(response.toolCalls).toEqual([]);
      expect(response.stopReason).toBe('end_turn');
      expect(response.usage).toEqual({
        inputTokens: 15,
        outputTokens: 10,
        totalTokens: 25,
      });
      expect(response.model).toBe('llama3.2:3b');
      expect(response.provider).toBe('ollama');
    });

    it('should include system prompt as first message', async () => {
      chatMock.mockImplementation(() =>
        createMockOllamaStreamResponse({
          content: 'I am a helpful assistant.',
          promptEvalCount: 30,
          evalCount: 8,
        })
      );

      const db = createMockPool();
      const context = createMockContext();
      const provider = new OllamaChatProvider(db, context);

      const params: ChatParams = {
        messages: [{ role: 'user', content: 'Who are you?' }],
        model: 'llama3.2:3b',
        systemPrompt: 'You are a helpful assistant.',
      };

      await provider.chat(params);

      expect(chatMock).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Who are you?' },
          ],
        })
      );
    });

    it('should handle conversation history with multiple messages', async () => {
      chatMock.mockImplementation(() =>
        createMockOllamaStreamResponse({
          content: 'The answer is 4.',
          promptEvalCount: 50,
          evalCount: 6,
        })
      );

      const db = createMockPool();
      const context = createMockContext();
      const provider = new OllamaChatProvider(db, context);

      const params: ChatParams = {
        messages: [
          { role: 'user', content: 'What is 2+2?' },
          { role: 'assistant', content: 'Let me calculate that.' },
          { role: 'user', content: 'Please tell me the result.' },
        ],
        model: 'llama3.2:3b',
      };

      await provider.chat(params);

      expect(chatMock).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'user', content: 'What is 2+2?' },
            { role: 'assistant', content: 'Let me calculate that.' },
            { role: 'user', content: 'Please tell me the result.' },
          ],
        })
      );
    });

    it('should extract text from complex content blocks', async () => {
      chatMock.mockImplementation(() =>
        createMockOllamaStreamResponse({
          content: 'I received your text messages.',
          promptEvalCount: 40,
          evalCount: 8,
        })
      );

      const db = createMockPool();
      const context = createMockContext();
      const provider = new OllamaChatProvider(db, context);

      const params: ChatParams = {
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'First part.' },
              { type: 'image', source: { type: 'base64', data: 'abc123' } },
              { type: 'text', text: 'Second part.' },
              { type: 'tool_result', toolUseId: 'tool-1', content: 'Result data' },
            ],
          },
        ],
        model: 'llama3.2:3b',
      };

      await provider.chat(params);

      expect(chatMock).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: 'user', content: 'First part.\nSecond part.' }],
        })
      );
    });

    it('should skip system messages in the messages array', async () => {
      chatMock.mockImplementation(() =>
        createMockOllamaStreamResponse({
          content: 'Response.',
        })
      );

      const db = createMockPool();
      const context = createMockContext();
      const provider = new OllamaChatProvider(db, context);

      const params: ChatParams = {
        messages: [
          { role: 'system', content: 'System in array (should be skipped)' },
          { role: 'user', content: 'User message' },
        ],
        model: 'llama3.2:3b',
        systemPrompt: 'Proper system prompt',
      };

      await provider.chat(params);

      expect(chatMock).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'Proper system prompt' },
            { role: 'user', content: 'User message' },
          ],
        })
      );
    });

    it('should pass optional parameters to Ollama', async () => {
      chatMock.mockImplementation(() =>
        createMockOllamaStreamResponse({
          content: 'Done.',
        })
      );

      const db = createMockPool();
      const context = createMockContext();
      const provider = new OllamaChatProvider(db, context);

      const params: ChatParams = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'llama3.2:3b',
        temperature: 0.7,
        maxTokens: 500,
        stopSequences: ['STOP', 'END'],
      };

      await provider.chat(params);

      expect(chatMock).toHaveBeenCalledWith({
        model: 'llama3.2:3b',
        messages: [{ role: 'user', content: 'Test' }],
        stream: true,
        options: {
          temperature: 0.7,
          num_predict: 500,
          stop: ['STOP', 'END'],
        },
      });
    });

    it('should handle response without token counts', async () => {
      chatMock.mockImplementation(() =>
        createMockOllamaStreamResponse({
          content: 'Response without counts.',
          // No promptEvalCount or evalCount (defaults to 0)
        })
      );

      const db = createMockPool();
      const context = createMockContext();
      const provider = new OllamaChatProvider(db, context);

      const params: ChatParams = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'llama3.2:3b',
      };

      const response = await provider.chat(params);

      expect(response.usage).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      });
    });

    it('should handle empty content response', async () => {
      // Stream with only final chunk (no content)
      chatMock.mockImplementation(() =>
        createMockOllamaStreamResponse({
          content: '',
        })
      );

      const db = createMockPool();
      const context = createMockContext();
      const provider = new OllamaChatProvider(db, context);

      const params: ChatParams = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'llama3.2:3b',
      };

      const response = await provider.chat(params);
      expect(response.content).toBe('');
      expect(response.stopReason).toBe('end_turn');
    });

    it('should wrap Ollama SDK errors with context', async () => {
      chatMock.mockRejectedValue(new Error('Connection refused'));

      const db = createMockPool();
      const context = createMockContext();
      const provider = new OllamaChatProvider(db, context);

      const params: ChatParams = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'llama3.2:3b',
      };

      await expect(provider.chat(params)).rejects.toThrow(
        'Ollama streaming chat failed: Connection refused'
      );
    });

    it('should handle non-Error thrown values', async () => {
      chatMock.mockRejectedValue('String error');

      const db = createMockPool();
      const context = createMockContext();
      const provider = new OllamaChatProvider(db, context);

      const params: ChatParams = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'llama3.2:3b',
      };

      await expect(provider.chat(params)).rejects.toThrow(
        'Ollama streaming chat failed: String error'
      );
    });
  });

  describe('isConfigured', () => {
    it('should return true when Ollama is reachable', async () => {
      listMock.mockResolvedValue({ models: [{ name: 'llama3.2:3b' }] });

      const db = createMockPool();
      const context = createMockContext();
      const provider = new OllamaChatProvider(db, context);

      const result = await provider.isConfigured();

      expect(result).toBe(true);
      expect(listMock).toHaveBeenCalledTimes(1);
    });

    it('should return false when Ollama is not reachable', async () => {
      listMock.mockRejectedValue(new Error('Connection refused'));

      const db = createMockPool();
      const context = createMockContext();
      const provider = new OllamaChatProvider(db, context);

      const result = await provider.isConfigured();

      expect(result).toBe(false);
      expect(listMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('createOllamaProvider factory', () => {
    it('should create OllamaChatProvider instance', () => {
      const db = createMockPool();
      const context = createMockContext();

      const provider = createOllamaProvider(db, context);

      expect(provider).toBeInstanceOf(OllamaChatProvider);
      expect(provider.name).toBe('ollama');
    });
  });
});
