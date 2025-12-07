/**
 * Z.AI (Zhipu) Chat Provider Tests
 *
 * Phase 16B: Unit tests for ZhipuChatProvider
 * Tests the manual 10-turn tool execution loop and OpenAI-compatible API integration.
 */

import type { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// =============================================================================
// Hoisted Mocks
// =============================================================================

const mockChatCompletionsCreate = vi.hoisted(() => vi.fn());
const mockBuildAgentTools = vi.hoisted(() => vi.fn());
const mockGetProviderApiKey = vi.hoisted(() => vi.fn());

// =============================================================================
// Module Mocks
// =============================================================================

vi.mock('openai', () => {
  return {
    __esModule: true,
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockChatCompletionsCreate,
        },
      },
    })),
  };
});

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

function createMockOpenAIResponse(options: {
  content?: string | null;
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  finishReason?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  model?: string;
}) {
  // Create streaming response chunks
  const chunks: Array<{
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
      index: number;
      delta: {
        role?: string;
        content?: string;
        tool_calls?: Array<{
          index: number;
          id?: string;
          type?: string;
          function?: { name?: string; arguments?: string };
        }>;
      };
      finish_reason: string | null;
    }>;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  }> = [];

  // If there's content, stream it
  if (options.content) {
    chunks.push({
      id: 'chatcmpl-test',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: options.model ?? 'glm-4.6',
      choices: [
        {
          index: 0,
          delta: { role: 'assistant', content: options.content },
          finish_reason: null,
        },
      ],
    });
  }

  // If there are tool calls, stream them
  if (options.toolCalls) {
    for (let i = 0; i < options.toolCalls.length; i++) {
      const tc = options.toolCalls[i];
      chunks.push({
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: options.model ?? 'glm-4.6',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: i,
                  id: tc.id,
                  type: 'function',
                  function: { name: tc.function.name, arguments: tc.function.arguments },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      });
    }
  }

  // Final chunk with finish reason and usage
  chunks.push({
    id: 'chatcmpl-test',
    object: 'chat.completion.chunk',
    created: Date.now(),
    model: options.model ?? 'glm-4.6',
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: options.finishReason ?? 'stop',
      },
    ],
    usage: {
      prompt_tokens: options.promptTokens ?? 100,
      completion_tokens: options.completionTokens ?? 50,
      total_tokens: options.totalTokens ?? 150,
    },
  });

  // Return an async iterator
  return (async function* () {
    for (const chunk of chunks) {
      yield chunk;
    }
  })();
}

// =============================================================================
// Tests
// =============================================================================

let ZhipuChatProvider: typeof import('../zhipu.js')['ZhipuChatProvider'];
let createZhipuProvider: typeof import('../zhipu.js')['createZhipuProvider'];
let OpenAI: typeof import('openai').default;

describe('ZhipuChatProvider', () => {
  const mockPool = createMockPool();
  const mockContext = { collectionId: '11111111-1111-4111-8111-111111111111' };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default API key configured
    mockGetProviderApiKey.mockResolvedValue('test-zhipu-key');

    // Default tool executors
    const mockExecutors = createMockToolExecutors();
    mockBuildAgentTools.mockReturnValue({
      tools: [],
      toolExecutors: mockExecutors,
    });

    // Import after mocks are set up
    const module = await import('../zhipu.js');
    ZhipuChatProvider = module.ZhipuChatProvider;
    createZhipuProvider = module.createZhipuProvider;

    const openaiModule = await import('openai');
    OpenAI = openaiModule.default;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Provider Properties and Configuration Tests
  // ===========================================================================

  describe('provider properties', () => {
    it('should have correct name', () => {
      const provider = new ZhipuChatProvider(mockPool, mockContext);
      expect(provider.name).toBe('zhipu');
    });

    it('should have correct capabilities', () => {
      const provider = new ZhipuChatProvider(mockPool, mockContext);
      expect(provider.capabilities).toEqual({
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: false,
        maxContextTokens: 128000,
      });
    });
  });

  describe('isConfigured', () => {
    it('should return true when API key is configured', async () => {
      mockGetProviderApiKey.mockResolvedValue('test-api-key');
      const provider = new ZhipuChatProvider(mockPool, mockContext);

      const result = await provider.isConfigured();

      expect(result).toBe(true);
      expect(mockGetProviderApiKey).toHaveBeenCalledWith(mockPool, 'zhipu');
    });

    it('should return false when API key is not configured', async () => {
      mockGetProviderApiKey.mockResolvedValue(null);
      const provider = new ZhipuChatProvider(mockPool, mockContext);

      const result = await provider.isConfigured();

      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // Chat Without Tools Tests
  // ===========================================================================

  describe('chat without tools', () => {
    it('should complete successfully with simple text response', async () => {
      mockChatCompletionsCreate.mockResolvedValue(
        createMockOpenAIResponse({
          content: 'Hello! How can I help you today?',
          finishReason: 'stop',
          promptTokens: 50,
          completionTokens: 15,
          totalTokens: 65,
        })
      );

      const provider = new ZhipuChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'glm-4.6',
      });

      expect(result.content).toBe('Hello! How can I help you today?');
      expect(result.toolCalls).toHaveLength(0);
      expect(result.stopReason).toBe('end_turn'); // 'stop' maps to 'end_turn' for natural completion
      expect(result.usage).toEqual({
        inputTokens: 50,
        outputTokens: 15,
        totalTokens: 65,
      });
      expect(result.model).toBe('glm-4.6');
      expect(result.provider).toBe('zhipu');
    });

    it('should handle system prompt correctly', async () => {
      mockChatCompletionsCreate.mockResolvedValue(
        createMockOpenAIResponse({
          content: 'I am a helpful assistant.',
        })
      );

      const provider = new ZhipuChatProvider(mockPool, mockContext);
      await provider.chat({
        messages: [{ role: 'user', content: 'Who are you?' }],
        model: 'glm-4.6',
        systemPrompt: 'You are a helpful assistant.',
      });

      expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            { role: 'system', content: 'You are a helpful assistant.' },
          ]),
        })
      );
    });

    it('should pass optional parameters correctly', async () => {
      mockChatCompletionsCreate.mockResolvedValue(
        createMockOpenAIResponse({ content: 'Response' })
      );

      const provider = new ZhipuChatProvider(mockPool, mockContext);
      await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'glm-4.6',
        maxTokens: 1000,
        temperature: 0.7,
        stopSequences: ['END'],
      });

      expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'glm-4.6',
          max_tokens: 1000,
          temperature: 0.7,
          stop: ['END'],
        })
      );
    });

    it('should handle empty content response', async () => {
      mockChatCompletionsCreate.mockResolvedValue(
        createMockOpenAIResponse({
          content: null,
          finishReason: 'stop',
        })
      );

      const provider = new ZhipuChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'glm-4.6',
      });

      expect(result.content).toBe('');
    });

    it('should create OpenAI client with Zhipu baseURL', async () => {
      mockChatCompletionsCreate.mockResolvedValue(
        createMockOpenAIResponse({ content: 'Response' })
      );

      const provider = new ZhipuChatProvider(mockPool, mockContext);
      await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'glm-4.6',
      });

      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'test-zhipu-key',
        baseURL: 'https://api.z.ai/api/paas/v4',
      });
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
      mockChatCompletionsCreate
        .mockResolvedValueOnce(
          createMockOpenAIResponse({
            content: null,
            toolCalls: [
              {
                id: 'call-1',
                type: 'function',
                function: {
                  name: 'search_rag',
                  arguments: JSON.stringify({ query: 'test query' }),
                },
              },
            ],
            finishReason: 'tool_calls',
          })
        )
        // Second call: model returns final response after tool execution
        .mockResolvedValueOnce(
          createMockOpenAIResponse({
            content: 'Based on the search results, I found relevant information.',
            finishReason: 'stop',
          })
        );

      const provider = new ZhipuChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Search for test query' }],
        model: 'glm-4.6',
        tools: mockTools,
      });

      expect(toolExecutors.search_rag).toHaveBeenCalledWith({ query: 'test query' });
      expect(result.content).toBe('Based on the search results, I found relevant information.');
      expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(2);
    });

    it('should execute multiple tools in a single turn', async () => {
      const toolExecutors = createMockToolExecutors();
      mockBuildAgentTools.mockReturnValue({
        tools: [],
        toolExecutors,
      });

      // First call: model wants to use multiple tools
      mockChatCompletionsCreate
        .mockResolvedValueOnce(
          createMockOpenAIResponse({
            content: null,
            toolCalls: [
              {
                id: 'call-1',
                type: 'function',
                function: {
                  name: 'search_rag',
                  arguments: JSON.stringify({ query: 'query 1' }),
                },
              },
              {
                id: 'call-2',
                type: 'function',
                function: {
                  name: 'list_documents',
                  arguments: JSON.stringify({}),
                },
              },
            ],
            finishReason: 'tool_calls',
          })
        )
        .mockResolvedValueOnce(
          createMockOpenAIResponse({
            content: 'Completed both searches.',
            finishReason: 'stop',
          })
        );

      const provider = new ZhipuChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Search and list docs' }],
        model: 'glm-4.6',
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
      mockChatCompletionsCreate
        .mockResolvedValueOnce(
          createMockOpenAIResponse({
            content: null,
            toolCalls: [
              {
                id: 'call-1',
                type: 'function',
                function: {
                  name: 'search_rag',
                  arguments: JSON.stringify({ query: 'first query' }),
                },
              },
            ],
            finishReason: 'tool_calls',
          })
        )
        // Turn 2: Second tool call based on first results
        .mockResolvedValueOnce(
          createMockOpenAIResponse({
            content: null,
            toolCalls: [
              {
                id: 'call-2',
                type: 'function',
                function: {
                  name: 'get_document_status',
                  arguments: JSON.stringify({ doc_id: 'doc-1' }),
                },
              },
            ],
            finishReason: 'tool_calls',
          })
        )
        // Turn 3: Final response
        .mockResolvedValueOnce(
          createMockOpenAIResponse({
            content: 'After multiple tool calls, here is the answer.',
            finishReason: 'stop',
          })
        );

      const provider = new ZhipuChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Complex query' }],
        model: 'glm-4.6',
        tools: mockTools,
      });

      expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(3);
      expect(toolExecutors.search_rag).toHaveBeenCalled();
      expect(toolExecutors.get_document_status).toHaveBeenCalled();
      expect(result.content).toBe('After multiple tool calls, here is the answer.');
    });

    it('should convert tools to OpenAI function format', async () => {
      mockChatCompletionsCreate.mockResolvedValue(
        createMockOpenAIResponse({
          content: 'Response',
          finishReason: 'stop',
        })
      );

      const provider = new ZhipuChatProvider(mockPool, mockContext);
      await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'glm-4.6',
        tools: mockTools,
      });

      expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: [
            {
              type: 'function',
              function: {
                name: 'search_rag',
                description: 'Search the knowledge base',
                parameters: {
                  type: 'object',
                  properties: {
                    query: { type: 'string' },
                  },
                  required: ['query'],
                },
              },
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
    it('should complete with end_turn when max turns (25) is reached', async () => {
      const toolExecutors = createMockToolExecutors();
      mockBuildAgentTools.mockReturnValue({
        tools: [],
        toolExecutors,
      });

      // Always return tool calls to trigger infinite loop
      // Use mockImplementation to create a new stream each time
      mockChatCompletionsCreate.mockImplementation(() =>
        createMockOpenAIResponse({
          content: null,
          toolCalls: [
            {
              id: 'call-loop',
              type: 'function',
              function: {
                name: 'search_rag',
                arguments: JSON.stringify({ query: 'loop' }),
              },
            },
          ],
          finishReason: 'tool_calls',
        })
      );

      const provider = new ZhipuChatProvider(mockPool, mockContext);

      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Trigger loop' }],
        model: 'glm-4.6',
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

      // Should have called 25 times
      expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(25);
      // Should complete with end_turn (not throw)
      expect(result.stopReason).toBe('end_turn');
      expect(result.content).toBe('');
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('error handling', () => {
    it('should throw error when API key is not configured', async () => {
      mockGetProviderApiKey.mockResolvedValue(null);

      const provider = new ZhipuChatProvider(mockPool, mockContext);

      await expect(
        provider.chat({
          messages: [{ role: 'user', content: 'Test' }],
          model: 'glm-4.6',
        })
      ).rejects.toThrow('Zhipu API key not configured');
    });

    it('should handle empty stream gracefully', async () => {
      // Return an empty async iterator (no chunks)
      mockChatCompletionsCreate.mockResolvedValue(
        (async function* () {
          // Empty stream
        })()
      );

      const provider = new ZhipuChatProvider(mockPool, mockContext);

      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'glm-4.6',
      });

      // Should complete with default values
      expect(result.content).toBe('');
      expect(result.stopReason).toBe('end_turn');
    });

    it('should handle tool execution errors gracefully', async () => {
      const toolExecutors = createMockToolExecutors();
      toolExecutors.search_rag.mockRejectedValue(new Error('Tool execution failed'));
      mockBuildAgentTools.mockReturnValue({
        tools: [],
        toolExecutors,
      });

      // First call: tool call that will fail
      mockChatCompletionsCreate
        .mockResolvedValueOnce(
          createMockOpenAIResponse({
            content: null,
            toolCalls: [
              {
                id: 'call-fail',
                type: 'function',
                function: {
                  name: 'search_rag',
                  arguments: JSON.stringify({ query: 'fail' }),
                },
              },
            ],
            finishReason: 'tool_calls',
          })
        )
        // Second call: model handles error and responds
        .mockResolvedValueOnce(
          createMockOpenAIResponse({
            content: 'I encountered an error with the search tool.',
            finishReason: 'stop',
          })
        );

      const provider = new ZhipuChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Search' }],
        model: 'glm-4.6',
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

      // Verify error was passed as tool result
      const secondCall = mockChatCompletionsCreate.mock.calls[1];
      const messages = secondCall[0].messages;
      const toolResultMessage = messages.find((m: { role: string }) => m.role === 'tool');
      expect(toolResultMessage).toBeDefined();
      expect(toolResultMessage.content).toContain('Tool execution failed');
    });

    it('should handle unknown tool gracefully', async () => {
      const toolExecutors = createMockToolExecutors();
      mockBuildAgentTools.mockReturnValue({
        tools: [],
        toolExecutors,
      });

      mockChatCompletionsCreate
        .mockResolvedValueOnce(
          createMockOpenAIResponse({
            content: null,
            toolCalls: [
              {
                id: 'call-unknown',
                type: 'function',
                function: {
                  name: 'unknown_tool',
                  arguments: '{}',
                },
              },
            ],
            finishReason: 'tool_calls',
          })
        )
        .mockResolvedValueOnce(
          createMockOpenAIResponse({
            content: 'I do not recognize that tool.',
            finishReason: 'stop',
          })
        );

      const provider = new ZhipuChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Use unknown tool' }],
        model: 'glm-4.6',
        tools: [
          {
            name: 'unknown_tool',
            description: 'Unknown',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      });

      expect(result.content).toBe('I do not recognize that tool.');

      // Verify error was passed as tool result
      const secondCall = mockChatCompletionsCreate.mock.calls[1];
      const messages = secondCall[0].messages;
      const toolResultMessage = messages.find((m: { role: string }) => m.role === 'tool');
      expect(toolResultMessage.content).toContain('Unknown tool');
    });

    it('should handle non-Error exceptions in tool execution', async () => {
      const toolExecutors = createMockToolExecutors();
      toolExecutors.search_rag.mockRejectedValue('String error');
      mockBuildAgentTools.mockReturnValue({
        tools: [],
        toolExecutors,
      });

      mockChatCompletionsCreate
        .mockResolvedValueOnce(
          createMockOpenAIResponse({
            content: null,
            toolCalls: [
              {
                id: 'call-string-error',
                type: 'function',
                function: {
                  name: 'search_rag',
                  arguments: '{}',
                },
              },
            ],
            finishReason: 'tool_calls',
          })
        )
        .mockResolvedValueOnce(
          createMockOpenAIResponse({
            content: 'Handled error.',
            finishReason: 'stop',
          })
        );

      const provider = new ZhipuChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'glm-4.6',
        tools: [
          {
            name: 'search_rag',
            description: 'Search',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      });

      expect(result.content).toBe('Handled error.');

      // Verify generic error message was used
      const secondCall = mockChatCompletionsCreate.mock.calls[1];
      const messages = secondCall[0].messages;
      const toolResultMessage = messages.find((m: { role: string }) => m.role === 'tool');
      expect(toolResultMessage.content).toContain('Tool execution failed');
    });
  });

  // ===========================================================================
  // Stop Reason Mapping Tests
  // ===========================================================================

  describe('stop reason mapping', () => {
    it('should map "stop" to "end_turn"', async () => {
      // OpenAI's 'stop' indicates natural completion, mapped to 'end_turn' for consistency
      mockChatCompletionsCreate.mockResolvedValue(
        createMockOpenAIResponse({
          content: 'Response',
          finishReason: 'stop',
        })
      );

      const provider = new ZhipuChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'glm-4.6',
      });

      expect(result.stopReason).toBe('end_turn');
    });

    it('should map "length" to "max_tokens"', async () => {
      mockChatCompletionsCreate.mockResolvedValue(
        createMockOpenAIResponse({
          content: 'Truncated response...',
          finishReason: 'length',
        })
      );

      const provider = new ZhipuChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'glm-4.6',
      });

      expect(result.stopReason).toBe('max_tokens');
    });

    it('should map unknown reason to "end_turn"', async () => {
      mockChatCompletionsCreate.mockResolvedValue(
        createMockOpenAIResponse({
          content: 'Response',
          finishReason: 'unknown_reason',
        })
      );

      const provider = new ZhipuChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'glm-4.6',
      });

      expect(result.stopReason).toBe('end_turn');
    });
  });

  // ===========================================================================
  // Factory Function Tests
  // ===========================================================================

  describe('createZhipuProvider factory', () => {
    it('should create a ZhipuChatProvider instance', () => {
      const provider = createZhipuProvider(mockPool, mockContext);

      expect(provider).toBeInstanceOf(ZhipuChatProvider);
      expect(provider.name).toBe('zhipu');
    });
  });

  // ===========================================================================
  // Message Conversion Tests
  // ===========================================================================

  describe('message conversion', () => {
    it('should convert user messages correctly', async () => {
      mockChatCompletionsCreate.mockResolvedValue(
        createMockOpenAIResponse({ content: 'Response' })
      );

      const provider = new ZhipuChatProvider(mockPool, mockContext);
      await provider.chat({
        messages: [
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'First response' },
          { role: 'user', content: 'Second message' },
        ],
        model: 'glm-4.6',
      });

      expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'user', content: 'First message' }),
            expect.objectContaining({ role: 'assistant', content: 'First response' }),
            expect.objectContaining({ role: 'user', content: 'Second message' }),
          ]),
        })
      );
    });
  });

  // ===========================================================================
  // Usage Tracking Tests
  // ===========================================================================

  describe('usage tracking', () => {
    it('should track token usage correctly', async () => {
      mockChatCompletionsCreate.mockResolvedValue(
        createMockOpenAIResponse({
          content: 'Response',
          promptTokens: 200,
          completionTokens: 100,
          totalTokens: 300,
        })
      );

      const provider = new ZhipuChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'glm-4.6',
      });

      expect(result.usage).toEqual({
        inputTokens: 200,
        outputTokens: 100,
        totalTokens: 300,
      });
    });

    it('should handle missing usage data', async () => {
      // Return stream with no usage info in final chunk
      mockChatCompletionsCreate.mockResolvedValue(
        (async function* () {
          yield {
            id: 'chatcmpl-test',
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: 'glm-4.6',
            choices: [
              {
                index: 0,
                delta: { role: 'assistant', content: 'Response' },
                finish_reason: null,
              },
            ],
          };
          yield {
            id: 'chatcmpl-test',
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: 'glm-4.6',
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason: 'stop',
              },
            ],
            // No usage field
          };
        })()
      );

      const provider = new ZhipuChatProvider(mockPool, mockContext);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'glm-4.6',
      });

      expect(result.usage).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      });
    });
  });
});
