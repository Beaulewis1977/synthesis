/**
 * Google Gemini Chat Provider Tests
 *
 * Phase 16B: Unit tests for GoogleChatProvider
 * Tests the manual 10-turn tool execution loop and API integration.
 */

import type { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// =============================================================================
// Hoisted Mocks
// =============================================================================

const mockGenerateContentStream = vi.hoisted(() => vi.fn());
const mockBuildAgentTools = vi.hoisted(() => vi.fn());
const mockGetProviderApiKey = vi.hoisted(() => vi.fn());

// =============================================================================
// Module Mocks
// =============================================================================

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockImplementation(() => ({
      generateContentStream: mockGenerateContentStream,
    })),
  })),
  SchemaType: {
    STRING: 'STRING',
    NUMBER: 'NUMBER',
    INTEGER: 'INTEGER',
    BOOLEAN: 'BOOLEAN',
    ARRAY: 'ARRAY',
    OBJECT: 'OBJECT',
  },
}));

vi.mock('../../../agent/tools.js', () => ({
  __esModule: true,
  buildAgentTools: mockBuildAgentTools,
}));

vi.mock('../index.js', async (importOriginal) => {
  const original = (await importOriginal()) as object;
  return {
    ...original,
    getProviderApiKey: mockGetProviderApiKey,
  };
});

// =============================================================================
// Test Helpers
// =============================================================================

function createMockPool(): Pool {
  const query = vi.fn().mockResolvedValue({ rows: [] });
  const connect = vi.fn().mockResolvedValue({
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  });

  return {
    query,
    connect,
  } as unknown as Pool;
}

function createMockToolExecutors() {
  return {
    search_rag: vi.fn().mockResolvedValue(JSON.stringify({ results: [] })),
    add_document: vi.fn().mockResolvedValue(JSON.stringify({ id: 'doc-1' })),
    fetch_web_content: vi.fn().mockResolvedValue(JSON.stringify({ fetched: true })),
    list_collections: vi.fn().mockResolvedValue(JSON.stringify({ collections: [] })),
    list_documents: vi.fn().mockResolvedValue(JSON.stringify({ documents: [] })),
    get_document_status: vi.fn().mockResolvedValue(JSON.stringify({ status: 'complete' })),
    delete_document: vi.fn().mockResolvedValue(JSON.stringify({ deleted: true })),
    restart_ingest: vi.fn().mockResolvedValue(JSON.stringify({ restarted: true })),
    summarize_document: vi.fn().mockResolvedValue(JSON.stringify({ summary: 'Test summary' })),
  };
}

/**
 * Create a mock Google Gemini response stream
 * Yields chunks and then completes
 */
function createMockGoogleResponse(options: {
  text?: string;
  functionCalls?: Array<{ name: string; args: Record<string, unknown> }>;
  finishReason?: string;
  promptTokenCount?: number;
  candidatesTokenCount?: number;
}) {
  const chunks: Array<{
    candidates: Array<{
      content?: { parts: Array<{ text?: string; functionCall?: unknown }> };
      finishReason?: string;
    }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  }> = [];

  // Build response parts
  const parts: Array<{ text?: string; functionCall?: unknown }> = [];

  if (options.text) {
    parts.push({ text: options.text });
  }

  if (options.functionCalls) {
    for (const fc of options.functionCalls) {
      parts.push({ functionCall: fc });
    }
  }

  // Create chunk
  chunks.push({
    candidates: [
      {
        content: { parts },
        finishReason: options.finishReason ?? 'STOP',
      },
    ],
    usageMetadata: {
      promptTokenCount: options.promptTokenCount ?? 100,
      candidatesTokenCount: options.candidatesTokenCount ?? 50,
    },
  });

  // Return async generator
  return {
    stream: (async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    })(),
  };
}

// =============================================================================
// Tests
// =============================================================================

let GoogleChatProvider: typeof import('../google.js')['GoogleChatProvider'];
let createGoogleProvider: typeof import('../google.js')['createGoogleProvider'];

describe('GoogleChatProvider', () => {
  const mockPool = createMockPool();
  const mockContext = { collectionId: '11111111-1111-4111-8111-111111111111' };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default API key configured
    mockGetProviderApiKey.mockResolvedValue('test-google-key');

    // Default tool executors
    const mockExecutors = createMockToolExecutors();
    mockBuildAgentTools.mockReturnValue({
      tools: [],
      toolExecutors: mockExecutors,
    });

    // Import after mocks are set up
    const module = await import('../google.js');
    GoogleChatProvider = module.GoogleChatProvider;
    createGoogleProvider = module.createGoogleProvider;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Provider Properties and Configuration Tests
  // ===========================================================================

  describe('provider properties', () => {
    it('should have correct name', () => {
      const provider = new GoogleChatProvider(mockPool, mockContext);
      expect(provider.name).toBe('google');
    });

    it('should have correct capabilities', () => {
      const provider = new GoogleChatProvider(mockPool, mockContext);
      expect(provider.capabilities).toEqual({
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: true,
        maxContextTokens: 1000000,
      });
    });
  });

  describe('isConfigured', () => {
    it('should return true when API key is configured', async () => {
      mockGetProviderApiKey.mockResolvedValue('test-api-key');
      const provider = new GoogleChatProvider(mockPool, mockContext);

      const result = await provider.isConfigured();

      expect(result).toBe(true);
      expect(mockGetProviderApiKey).toHaveBeenCalledWith(mockPool, 'google');
    });

    it('should return false when API key is not configured', async () => {
      mockGetProviderApiKey.mockResolvedValue(null);
      const provider = new GoogleChatProvider(mockPool, mockContext);

      const result = await provider.isConfigured();

      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // Chat Without Tools Tests
  // ===========================================================================

  describe('chat without tools', () => {
    it('should complete successfully with simple text response', async () => {
      mockGenerateContentStream.mockResolvedValue(
        createMockGoogleResponse({
          text: 'Hello! How can I help you today?',
          finishReason: 'STOP',
          promptTokenCount: 50,
          candidatesTokenCount: 15,
        })
      );

      const provider = new GoogleChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gemini-pro',
      });

      expect(result.content).toBe('Hello! How can I help you today?');
      expect(result.toolCalls).toHaveLength(0);
      expect(result.stopReason).toBe('end_turn');
      expect(result.usage).toEqual({
        inputTokens: 50,
        outputTokens: 15,
        totalTokens: 65,
      });
      expect(result.model).toBe('gemini-pro');
      expect(result.provider).toBe('google');
    });

    it('should handle system prompt correctly', async () => {
      const mockGetGenerativeModel = vi.fn().mockReturnValue({
        generateContentStream: mockGenerateContentStream,
      });

      const GoogleGenerativeAI = await import('@google/generative-ai');
      (
        GoogleGenerativeAI.GoogleGenerativeAI as unknown as ReturnType<typeof vi.fn>
      ).mockImplementation(() => ({
        getGenerativeModel: mockGetGenerativeModel,
      }));

      mockGenerateContentStream.mockResolvedValue(
        createMockGoogleResponse({
          text: 'I am a helpful assistant.',
        })
      );

      const provider = new GoogleChatProvider(mockPool, mockContext);
      await provider.chat({
        messages: [{ role: 'user', content: 'Who are you?' }],
        model: 'gemini-pro',
        systemPrompt: 'You are a helpful assistant.',
      });

      // Verify getGenerativeModel was called with systemInstruction
      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          systemInstruction: 'You are a helpful assistant.',
        })
      );
    });

    it('should pass optional parameters correctly', async () => {
      mockGenerateContentStream.mockResolvedValue(createMockGoogleResponse({ text: 'Response' }));

      const provider = new GoogleChatProvider(mockPool, mockContext);
      await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'gemini-pro',
        maxTokens: 1000,
        temperature: 0.7,
        stopSequences: ['END'],
      });

      expect(mockGenerateContentStream).toHaveBeenCalledWith(
        expect.objectContaining({
          generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.7,
            stopSequences: ['END'],
          },
        })
      );
    });

    it('should handle empty content response', async () => {
      mockGenerateContentStream.mockResolvedValue(
        createMockGoogleResponse({
          finishReason: 'STOP',
        })
      );

      const provider = new GoogleChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'gemini-pro',
      });

      expect(result.content).toBe('');
    });
  });

  // ===========================================================================
  // Chat With Tool Execution Tests
  // ===========================================================================

  describe('chat with tool execution', () => {
    const mockTools = [
      {
        name: 'search_rag',
        description: 'Search the knowledge base',
        inputSchema: {
          type: 'object' as const,
          properties: {
            query: { type: 'string' },
          },
          required: ['query'],
        },
      },
    ];

    it('should execute single tool and return final response', async () => {
      const toolExecutors = createMockToolExecutors();
      toolExecutors.search_rag.mockResolvedValue(
        JSON.stringify({ results: [{ text: 'Found result' }] })
      );
      mockBuildAgentTools.mockReturnValue({
        tools: [],
        toolExecutors,
      });

      // First call: model wants to use a tool
      mockGenerateContentStream
        .mockResolvedValueOnce(
          createMockGoogleResponse({
            functionCalls: [
              {
                name: 'search_rag',
                args: { query: 'test query' },
              },
            ],
            finishReason: 'STOP',
          })
        )
        // Second call: model returns final response after tool execution
        .mockResolvedValueOnce(
          createMockGoogleResponse({
            text: 'Based on the search results, I found relevant information.',
            finishReason: 'STOP',
          })
        );

      const provider = new GoogleChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Search for test query' }],
        model: 'gemini-pro',
        tools: mockTools,
      });

      expect(toolExecutors.search_rag).toHaveBeenCalledWith({ query: 'test query' });
      expect(result.content).toBe('Based on the search results, I found relevant information.');
      expect(mockGenerateContentStream).toHaveBeenCalledTimes(2);
    });

    it('should execute multiple tools in a single turn', async () => {
      const toolExecutors = createMockToolExecutors();
      mockBuildAgentTools.mockReturnValue({
        tools: [],
        toolExecutors,
      });

      // First call: model wants to use multiple tools
      mockGenerateContentStream
        .mockResolvedValueOnce(
          createMockGoogleResponse({
            functionCalls: [
              {
                name: 'search_rag',
                args: { query: 'query 1' },
              },
              {
                name: 'list_documents',
                args: {},
              },
            ],
            finishReason: 'STOP',
          })
        )
        .mockResolvedValueOnce(
          createMockGoogleResponse({
            text: 'Completed both searches.',
            finishReason: 'STOP',
          })
        );

      const provider = new GoogleChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Search and list docs' }],
        model: 'gemini-pro',
        tools: mockTools,
      });

      expect(toolExecutors.search_rag).toHaveBeenCalled();
      expect(toolExecutors.list_documents).toHaveBeenCalled();
      expect(result.content).toBe('Completed both searches.');
    });

    it('should handle multi-turn tool execution loop', async () => {
      const toolExecutors = createMockToolExecutors();
      mockBuildAgentTools.mockReturnValue({
        tools: [],
        toolExecutors,
      });

      // Turn 1: First tool call
      mockGenerateContentStream
        .mockResolvedValueOnce(
          createMockGoogleResponse({
            functionCalls: [
              {
                name: 'search_rag',
                args: { query: 'first query' },
              },
            ],
            finishReason: 'STOP',
          })
        )
        // Turn 2: Second tool call based on first results
        .mockResolvedValueOnce(
          createMockGoogleResponse({
            functionCalls: [
              {
                name: 'get_document_status',
                args: { doc_id: 'doc-1' },
              },
            ],
            finishReason: 'STOP',
          })
        )
        // Turn 3: Final response
        .mockResolvedValueOnce(
          createMockGoogleResponse({
            text: 'After multiple tool calls, here is the answer.',
            finishReason: 'STOP',
          })
        );

      const provider = new GoogleChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Complex query' }],
        model: 'gemini-pro',
        tools: mockTools,
      });

      expect(mockGenerateContentStream).toHaveBeenCalledTimes(3);
      expect(toolExecutors.search_rag).toHaveBeenCalled();
      expect(toolExecutors.get_document_status).toHaveBeenCalled();
      expect(result.content).toBe('After multiple tool calls, here is the answer.');
    });

    it('should convert tools to Google functionDeclaration format', async () => {
      mockGenerateContentStream.mockResolvedValue(
        createMockGoogleResponse({
          text: 'Response',
          finishReason: 'STOP',
        })
      );

      const provider = new GoogleChatProvider(mockPool, mockContext);
      await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'gemini-pro',
        tools: mockTools,
      });

      expect(mockGenerateContentStream).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: [
            {
              functionDeclarations: [
                {
                  name: 'search_rag',
                  description: 'Search the knowledge base',
                  parameters: {
                    type: 'OBJECT',
                    properties: {
                      query: { type: 'STRING' },
                    },
                    required: ['query'],
                  },
                },
              ],
            },
          ],
        })
      );
    });
  });

  // ===========================================================================
  // Max Turns Limit Tests
  // ===========================================================================

  describe('max turns limit', () => {
    it('should reach max turns (25) and complete', async () => {
      const toolExecutors = createMockToolExecutors();
      mockBuildAgentTools.mockReturnValue({
        tools: [],
        toolExecutors,
      });

      // Create a persistent mock that returns function calls for first 10 calls
      // then returns text to exit loop
      let callCount = 0;
      mockGenerateContentStream.mockImplementation(() => {
        callCount++;
        return createMockGoogleResponse({
          functionCalls: [
            {
              name: 'search_rag',
              args: { query: 'loop' },
            },
          ],
          finishReason: 'STOP',
        });
      });

      const provider = new GoogleChatProvider(mockPool, mockContext);

      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Trigger loop' }],
        model: 'gemini-pro',
        tools: [
          {
            name: 'search_rag',
            description: 'Search',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      });

      // Should have called 25 times (max turns limit)
      expect(mockGenerateContentStream).toHaveBeenCalledTimes(25);
      // Should complete gracefully with end_turn after max turns
      expect(result.stopReason).toBe('end_turn');
      // Usage should be 0 when max turns reached (as per implementation)
      expect(result.usage.totalTokens).toBe(0);
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('error handling', () => {
    it('should throw error when API key is not configured', async () => {
      mockGetProviderApiKey.mockResolvedValue(null);

      const provider = new GoogleChatProvider(mockPool, mockContext);

      await expect(
        provider.chat({
          messages: [{ role: 'user', content: 'Test' }],
          model: 'gemini-pro',
        })
      ).rejects.toThrow('Google API key not configured');
    });

    it('should handle response with no candidates', async () => {
      mockGenerateContentStream.mockResolvedValue({
        stream: (async function* () {
          yield { candidates: [] };
        })(),
      });

      const provider = new GoogleChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'gemini-pro',
      });

      // Should return empty content
      expect(result.content).toBe('');
    });

    it('should handle tool execution errors gracefully', async () => {
      const toolExecutors = createMockToolExecutors();
      toolExecutors.search_rag.mockRejectedValue(new Error('Tool execution failed'));
      mockBuildAgentTools.mockReturnValue({
        tools: [],
        toolExecutors,
      });

      // First call: tool call that will fail
      mockGenerateContentStream
        .mockResolvedValueOnce(
          createMockGoogleResponse({
            functionCalls: [
              {
                name: 'search_rag',
                args: { query: 'fail' },
              },
            ],
            finishReason: 'STOP',
          })
        )
        // Second call: model handles error and responds
        .mockResolvedValueOnce(
          createMockGoogleResponse({
            text: 'I encountered an error with the search tool.',
            finishReason: 'STOP',
          })
        );

      const provider = new GoogleChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Search' }],
        model: 'gemini-pro',
        tools: [
          {
            name: 'search_rag',
            description: 'Search',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      });

      // Should complete despite tool error
      expect(result.content).toBe('I encountered an error with the search tool.');

      // Verify error was passed as function response
      const secondCall = mockGenerateContentStream.mock.calls[1];
      const contents = secondCall[0].contents;
      const functionResponseMsg = contents.find(
        (c: { role: string; parts: Array<{ functionResponse?: unknown }> }) =>
          c.role === 'user' &&
          c.parts.some((p: { functionResponse?: unknown }) => p.functionResponse)
      );
      expect(functionResponseMsg).toBeDefined();
    });

    it('should handle unknown tool gracefully', async () => {
      const toolExecutors = createMockToolExecutors();
      mockBuildAgentTools.mockReturnValue({
        tools: [],
        toolExecutors,
      });

      mockGenerateContentStream
        .mockResolvedValueOnce(
          createMockGoogleResponse({
            functionCalls: [
              {
                name: 'unknown_tool',
                args: {},
              },
            ],
            finishReason: 'STOP',
          })
        )
        .mockResolvedValueOnce(
          createMockGoogleResponse({
            text: 'I do not recognize that tool.',
            finishReason: 'STOP',
          })
        );

      const provider = new GoogleChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Use unknown tool' }],
        model: 'gemini-pro',
        tools: [
          {
            name: 'unknown_tool',
            description: 'Unknown',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      });

      expect(result.content).toBe('I do not recognize that tool.');

      // Verify error was passed as function response
      const secondCall = mockGenerateContentStream.mock.calls[1];
      const contents = secondCall[0].contents;
      const functionResponseMsg = contents.find(
        (c: { role: string; parts: Array<{ functionResponse?: unknown }> }) =>
          c.role === 'user' &&
          c.parts.some((p: { functionResponse?: unknown }) => p.functionResponse)
      );
      expect(functionResponseMsg).toBeDefined();
    });

    it('should handle non-Error exceptions in tool execution', async () => {
      const toolExecutors = createMockToolExecutors();
      toolExecutors.search_rag.mockRejectedValue('String error');
      mockBuildAgentTools.mockReturnValue({
        tools: [],
        toolExecutors,
      });

      mockGenerateContentStream
        .mockResolvedValueOnce(
          createMockGoogleResponse({
            functionCalls: [
              {
                name: 'search_rag',
                args: {},
              },
            ],
            finishReason: 'STOP',
          })
        )
        .mockResolvedValueOnce(
          createMockGoogleResponse({
            text: 'Handled error.',
            finishReason: 'STOP',
          })
        );

      const provider = new GoogleChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'gemini-pro',
        tools: [
          {
            name: 'search_rag',
            description: 'Search',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      });

      expect(result.content).toBe('Handled error.');

      // Verify error message was used
      const secondCall = mockGenerateContentStream.mock.calls[1];
      const contents = secondCall[0].contents;
      const functionResponseMsg = contents.find(
        (c: { role: string; parts: Array<{ functionResponse?: unknown }> }) =>
          c.role === 'user' &&
          c.parts.some((p: { functionResponse?: unknown }) => p.functionResponse)
      );
      expect(functionResponseMsg).toBeDefined();
    });
  });

  // ===========================================================================
  // Stop Reason Mapping Tests
  // ===========================================================================

  describe('stop reason mapping', () => {
    it('should map "STOP" to "end_turn"', async () => {
      mockGenerateContentStream.mockResolvedValue(
        createMockGoogleResponse({
          text: 'Response',
          finishReason: 'STOP',
        })
      );

      const provider = new GoogleChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'gemini-pro',
      });

      expect(result.stopReason).toBe('end_turn');
    });

    it('should map "MAX_TOKENS" to "max_tokens"', async () => {
      mockGenerateContentStream.mockResolvedValue(
        createMockGoogleResponse({
          text: 'Truncated response...',
          finishReason: 'MAX_TOKENS',
        })
      );

      const provider = new GoogleChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'gemini-pro',
      });

      expect(result.stopReason).toBe('max_tokens');
    });

    it('should map "SAFETY" to "end_turn"', async () => {
      mockGenerateContentStream.mockResolvedValue(
        createMockGoogleResponse({
          text: 'Response',
          finishReason: 'SAFETY',
        })
      );

      const provider = new GoogleChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'gemini-pro',
      });

      expect(result.stopReason).toBe('end_turn');
    });

    it('should map unknown reason to "end_turn"', async () => {
      mockGenerateContentStream.mockResolvedValue(
        createMockGoogleResponse({
          text: 'Response',
          finishReason: 'UNKNOWN_REASON',
        })
      );

      const provider = new GoogleChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'gemini-pro',
      });

      expect(result.stopReason).toBe('end_turn');
    });
  });

  // ===========================================================================
  // Factory Function Tests
  // ===========================================================================

  describe('createGoogleProvider factory', () => {
    it('should create a GoogleChatProvider instance', () => {
      const provider = createGoogleProvider(mockPool, mockContext);

      expect(provider).toBeInstanceOf(GoogleChatProvider);
      expect(provider.name).toBe('google');
    });
  });

  // ===========================================================================
  // Message Conversion Tests
  // ===========================================================================

  describe('message conversion', () => {
    it('should convert user messages correctly', async () => {
      mockGenerateContentStream.mockResolvedValue(createMockGoogleResponse({ text: 'Response' }));

      const provider = new GoogleChatProvider(mockPool, mockContext);
      await provider.chat({
        messages: [
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'First response' },
          { role: 'user', content: 'Second message' },
        ],
        model: 'gemini-pro',
      });

      expect(mockGenerateContentStream).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.arrayContaining([
            expect.objectContaining({ role: 'user', parts: [{ text: 'First message' }] }),
            expect.objectContaining({ role: 'model', parts: [{ text: 'First response' }] }),
            expect.objectContaining({ role: 'user', parts: [{ text: 'Second message' }] }),
          ]),
        })
      );
    });

    it('should skip system messages in contents', async () => {
      mockGenerateContentStream.mockResolvedValue(createMockGoogleResponse({ text: 'Response' }));

      const provider = new GoogleChatProvider(mockPool, mockContext);
      await provider.chat({
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
        ],
        model: 'gemini-pro',
      });

      const call = mockGenerateContentStream.mock.calls[0][0];
      const contents = call.contents;

      // Should only have user message, system handled via systemInstruction
      expect(contents).toHaveLength(1);
      expect(contents[0].role).toBe('user');
    });
  });

  // ===========================================================================
  // Usage Tracking Tests
  // ===========================================================================

  describe('usage tracking', () => {
    it('should track token usage correctly', async () => {
      mockGenerateContentStream.mockResolvedValue(
        createMockGoogleResponse({
          text: 'Response',
          promptTokenCount: 200,
          candidatesTokenCount: 100,
        })
      );

      const provider = new GoogleChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'gemini-pro',
      });

      expect(result.usage).toEqual({
        inputTokens: 200,
        outputTokens: 100,
        totalTokens: 300,
      });
    });

    it('should handle missing usage metadata', async () => {
      mockGenerateContentStream.mockResolvedValue({
        stream: (async function* () {
          yield {
            candidates: [
              {
                content: { parts: [{ text: 'Response' }] },
                finishReason: 'STOP',
              },
            ],
            // No usageMetadata
          };
        })(),
      });

      const provider = new GoogleChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'gemini-pro',
      });

      expect(result.usage).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      });
    });
  });

  // ===========================================================================
  // Streaming Tests
  // ===========================================================================

  describe('streamChat', () => {
    it('should yield text chunks during streaming', async () => {
      mockGenerateContentStream.mockResolvedValue(
        createMockGoogleResponse({
          text: 'Streaming response',
          finishReason: 'STOP',
        })
      );

      const provider = new GoogleChatProvider(mockPool, mockContext);
      const chunks = [];

      for await (const chunk of provider.streamChat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'gemini-pro',
      })) {
        chunks.push(chunk);
      }

      // Should have text chunk and done chunk
      expect(chunks.some((c) => c.type === 'text')).toBe(true);
      expect(chunks.some((c) => c.type === 'done')).toBe(true);
    });

    it('should yield tool_start and tool_end chunks', async () => {
      const toolExecutors = createMockToolExecutors();
      mockBuildAgentTools.mockReturnValue({
        tools: [],
        toolExecutors,
      });

      mockGenerateContentStream
        .mockResolvedValueOnce(
          createMockGoogleResponse({
            functionCalls: [
              {
                name: 'search_rag',
                args: { query: 'test' },
              },
            ],
            finishReason: 'STOP',
          })
        )
        .mockResolvedValueOnce(
          createMockGoogleResponse({
            text: 'Done',
            finishReason: 'STOP',
          })
        );

      const provider = new GoogleChatProvider(mockPool, mockContext);
      const chunks = [];

      for await (const chunk of provider.streamChat({
        messages: [{ role: 'user', content: 'Search' }],
        model: 'gemini-pro',
        tools: [
          {
            name: 'search_rag',
            description: 'Search',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      })) {
        chunks.push(chunk);
      }

      // Should have tool_start, tool_end, text, and done chunks
      expect(chunks.some((c) => c.type === 'tool_start')).toBe(true);
      expect(chunks.some((c) => c.type === 'tool_end')).toBe(true);
      expect(chunks.some((c) => c.type === 'text')).toBe(true);
      expect(chunks.some((c) => c.type === 'done')).toBe(true);
    });
  });

  // ===========================================================================
  // Schema Conversion Tests
  // ===========================================================================

  describe('schema conversion', () => {
    it('should convert complex schema types correctly', async () => {
      mockGenerateContentStream.mockResolvedValue(createMockGoogleResponse({ text: 'Response' }));

      const provider = new GoogleChatProvider(mockPool, mockContext);
      await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'gemini-pro',
        tools: [
          {
            name: 'complex_tool',
            description: 'Complex tool',
            inputSchema: {
              type: 'object',
              properties: {
                stringParam: { type: 'string' },
                numberParam: { type: 'number' },
                integerParam: { type: 'integer' },
                booleanParam: { type: 'boolean' },
                arrayParam: {
                  type: 'array',
                  items: { type: 'string' },
                },
                objectParam: {
                  type: 'object',
                  properties: {
                    nested: { type: 'string' },
                  },
                },
              },
              required: ['stringParam'],
            },
          },
        ],
      });

      const call = mockGenerateContentStream.mock.calls[0][0];
      const functionDeclaration = call.tools[0].functionDeclarations[0];

      // Verify all types converted to Google SchemaType
      expect(functionDeclaration.parameters.properties.stringParam.type).toBe('STRING');
      expect(functionDeclaration.parameters.properties.numberParam.type).toBe('NUMBER');
      expect(functionDeclaration.parameters.properties.integerParam.type).toBe('INTEGER');
      expect(functionDeclaration.parameters.properties.booleanParam.type).toBe('BOOLEAN');
      expect(functionDeclaration.parameters.properties.arrayParam.type).toBe('ARRAY');
      expect(functionDeclaration.parameters.properties.objectParam.type).toBe('OBJECT');
    });
  });
});
