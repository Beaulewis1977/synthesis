import type { Pool } from 'pg';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// =============================================================================
// Mocks for Claude Agent SDK
// =============================================================================

const queryMock = vi.hoisted(() => vi.fn());
const createSdkMcpServerMock = vi.hoisted(() => vi.fn(() => ({})));
const toolMock = vi.hoisted(() =>
  vi.fn((name: string, _desc: string, _schema: unknown, handler: unknown) => ({
    name,
    handler,
  }))
);

const buildAgentMcpServerMock = vi.hoisted(() => vi.fn(() => ({})));
const MCP_SERVER_NAME_MOCK = 'synthesis-rag-tools';
const MCP_TOOL_NAMES_MOCK = [
  'mcp__synthesis-rag-tools__search_rag',
  'mcp__synthesis-rag-tools__add_document',
  'mcp__synthesis-rag-tools__fetch_web_content',
  'mcp__synthesis-rag-tools__list_collections',
  'mcp__synthesis-rag-tools__list_documents',
  'mcp__synthesis-rag-tools__get_document_status',
  'mcp__synthesis-rag-tools__delete_document',
  'mcp__synthesis-rag-tools__restart_ingest',
  'mcp__synthesis-rag-tools__summarize_document',
];

const getProviderApiKeyMock = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  __esModule: true,
  query: queryMock,
  createSdkMcpServer: createSdkMcpServerMock,
  tool: toolMock,
}));

vi.mock('../../../agent/tools.js', () => ({
  __esModule: true,
  buildAgentMcpServer: buildAgentMcpServerMock,
  MCP_SERVER_NAME: MCP_SERVER_NAME_MOCK,
  MCP_TOOL_NAMES: MCP_TOOL_NAMES_MOCK,
}));

vi.mock('../index.js', () => ({
  __esModule: true,
  getProviderApiKey: getProviderApiKeyMock,
}));

// =============================================================================
// Helper to create mock async generator
// =============================================================================

interface MockMessage {
  type: string;
  subtype?: string;
  session_id?: string;
  message?: {
    content: unknown;
  };
  result?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  total_cost_usd?: number;
  num_turns?: number;
  duration_ms?: number;
}

async function* mockQueryGenerator(messages: MockMessage[]) {
  for (const msg of messages) {
    yield msg;
  }
}

// =============================================================================
// Tests
// =============================================================================

let AnthropicChatProvider: typeof import('../anthropic.js')['AnthropicChatProvider'];
let createAnthropicProvider: typeof import('../anthropic.js')['createAnthropicProvider'];

beforeAll(async () => {
  ({ AnthropicChatProvider, createAnthropicProvider } = await import('../anthropic.js'));
});

describe('AnthropicChatProvider', () => {
  const mockDb = {} as Pool;
  const mockContext = {
    collectionId: '11111111-1111-4111-8111-111111111111',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: API key is configured
    getProviderApiKeyMock.mockResolvedValue('test-anthropic-key');

    // Default mock: successful query with tool call
    queryMock.mockReturnValue(
      mockQueryGenerator([
        // Session init
        { type: 'system', subtype: 'init', session_id: 'sess-123' },
        // Assistant makes a tool call
        {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'mcp__synthesis-rag-tools__search_rag',
                input: { query: 'What is pgvector?' },
              },
            ],
          },
        },
        // Tool result
        {
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'tool-1',
                content: [{ type: 'text', text: 'Search results for pgvector...' }],
                is_error: false,
              },
            ],
          },
        },
        // Assistant final response
        {
          type: 'assistant',
          message: {
            content: [
              {
                type: 'text',
                text: 'pgvector is a PostgreSQL extension for vector similarity search.',
              },
            ],
          },
        },
        // Final result with usage
        {
          type: 'result',
          subtype: 'success',
          result: 'pgvector is a PostgreSQL extension for vector similarity search.',
          usage: {
            input_tokens: 70,
            output_tokens: 40,
          },
          total_cost_usd: 0.001,
          num_turns: 2,
          duration_ms: 1500,
        },
      ])
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor and properties', () => {
    it('has correct name and capabilities', () => {
      const provider = new AnthropicChatProvider(mockDb, mockContext);

      expect(provider.name).toBe('anthropic');
      expect(provider.capabilities).toEqual({
        supportsTools: true,
        supportsStreaming: true,
        supportsVision: true,
        maxContextTokens: 200000,
      });
    });
  });

  describe('createAnthropicProvider factory', () => {
    it('creates an AnthropicChatProvider instance', () => {
      const provider = createAnthropicProvider(mockDb, mockContext);

      expect(provider).toBeInstanceOf(AnthropicChatProvider);
      expect(provider.name).toBe('anthropic');
    });
  });

  describe('chat()', () => {
    it('executes chat with tool calls and returns normalized response', async () => {
      const provider = new AnthropicChatProvider(mockDb, mockContext);

      const result = await provider.chat({
        messages: [
          { role: 'user', content: 'Previous question' },
          { role: 'assistant', content: 'Previous answer' },
          { role: 'user', content: 'Tell me about pgvector.' },
        ],
        model: 'claude-sonnet-4-20250514',
      });

      // Verify MCP server was built with correct context
      expect(buildAgentMcpServerMock).toHaveBeenCalledWith(mockDb, mockContext);

      // Verify query was called
      expect(queryMock).toHaveBeenCalledTimes(1);
      const queryCall = queryMock.mock.calls[0][0];

      // Verify prompt contains the user message
      expect(queryCall.prompt).toContain('Tell me about pgvector');

      // Verify query options
      expect(queryCall.options.maxTurns).toBe(25);
      expect(queryCall.options.permissionMode).toBe('bypassPermissions');
      expect(queryCall.options.model).toBe('claude-sonnet-4-20250514');
      expect(queryCall.options.mcpServers).toHaveProperty(MCP_SERVER_NAME_MOCK);
      expect(queryCall.options.allowedTools).toContain('mcp__synthesis-rag-tools__search_rag');

      // Verify result structure
      expect(result.content).toBe(
        'pgvector is a PostgreSQL extension for vector similarity search.'
      );
      expect(result.provider).toBe('anthropic');
      expect(result.model).toBe('claude-sonnet-4-20250514');

      // Verify tool calls
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]).toMatchObject({
        id: 'tool-1',
        name: 'search_rag', // Extracted from full MCP name
        input: { query: 'What is pgvector?' },
      });

      // Verify usage tracking
      expect(result.usage).toEqual({
        inputTokens: 70,
        outputTokens: 40,
        totalTokens: 110,
      });

      // Verify stop reason - 'end_turn' because all tools completed successfully
      expect(result.stopReason).toBe('end_turn');
    });

    it('handles chat without tool calls', async () => {
      queryMock.mockReturnValue(
        mockQueryGenerator([
          { type: 'system', subtype: 'init', session_id: 'sess-456' },
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: 'Hello! How can I help you today?' }],
            },
          },
          {
            type: 'result',
            subtype: 'success',
            result: 'Hello! How can I help you today?',
            usage: { input_tokens: 20, output_tokens: 10 },
            total_cost_usd: 0.0001,
            num_turns: 1,
            duration_ms: 500,
          },
        ])
      );

      const provider = new AnthropicChatProvider(mockDb, mockContext);

      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-sonnet-4-20250514',
      });

      expect(result.content).toBe('Hello! How can I help you today?');
      expect(result.toolCalls).toHaveLength(0);
      expect(result.stopReason).toBe('end_turn');
      expect(result.usage).toMatchObject({
        inputTokens: 20,
        outputTokens: 10,
        totalTokens: 30,
      });
    });

    it('handles tool errors gracefully', async () => {
      queryMock.mockReturnValue(
        mockQueryGenerator([
          { type: 'system', subtype: 'init', session_id: 'sess-789' },
          {
            type: 'user',
            message: {
              content: [
                {
                  type: 'tool_use',
                  id: 'tool-err',
                  name: 'mcp__synthesis-rag-tools__search_rag',
                  input: { query: 'test' },
                },
              ],
            },
          },
          {
            type: 'user',
            message: {
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: 'tool-err',
                  content: [{ type: 'text', text: 'Database connection failed' }],
                  is_error: true,
                },
              ],
            },
          },
          {
            type: 'assistant',
            message: {
              content: [
                { type: 'text', text: 'I encountered an error while searching. Please try again.' },
              ],
            },
          },
          {
            type: 'result',
            subtype: 'success',
            result: 'I encountered an error while searching. Please try again.',
            usage: { input_tokens: 30, output_tokens: 20 },
            total_cost_usd: 0.0002,
            num_turns: 2,
            duration_ms: 800,
          },
        ])
      );

      const provider = new AnthropicChatProvider(mockDb, mockContext);

      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Search for something' }],
        model: 'claude-sonnet-4-20250514',
      });

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('search_rag');
      expect(result.content).toContain('error');
      // stopReason is 'end_turn' because the conversation completed (tool error was handled)
      expect(result.stopReason).toBe('end_turn');
    });

    it('handles max turns exceeded', async () => {
      queryMock.mockReturnValue(
        mockQueryGenerator([
          { type: 'system', subtype: 'init', session_id: 'sess-max' },
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: 'Working on it...' }],
            },
          },
          {
            type: 'result',
            subtype: 'error_max_turns',
            usage: { input_tokens: 500, output_tokens: 300 },
            num_turns: 10,
          },
        ])
      );

      const provider = new AnthropicChatProvider(mockDb, mockContext);

      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Complex task' }],
        model: 'claude-sonnet-4-20250514',
      });

      expect(result.content).toBe('Working on it...');
      expect(result.stopReason).toBe('max_tokens');
      expect(result.usage).toMatchObject({
        inputTokens: 500,
        outputTokens: 300,
        totalTokens: 800,
      });
    });

    it('uses custom system prompt when provided', async () => {
      queryMock.mockReturnValue(
        mockQueryGenerator([
          { type: 'system', subtype: 'init', session_id: 'sess-sys' },
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: 'Custom response' }],
            },
          },
          {
            type: 'result',
            subtype: 'success',
            result: 'Custom response',
            usage: { input_tokens: 10, output_tokens: 5 },
          },
        ])
      );

      const provider = new AnthropicChatProvider(mockDb, mockContext);

      await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'claude-sonnet-4-20250514',
        systemPrompt: 'You are a helpful assistant.',
      });

      expect(queryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            systemPrompt: expect.stringContaining('You are a helpful assistant.'),
          }),
        })
      );
    });

    it('handles assistant message with string content', async () => {
      queryMock.mockReturnValue(
        mockQueryGenerator([
          { type: 'system', subtype: 'init', session_id: 'sess-str' },
          {
            type: 'assistant',
            message: {
              content: 'Direct string content',
            },
          },
          {
            type: 'result',
            subtype: 'success',
            result: 'Direct string content',
            usage: { input_tokens: 10, output_tokens: 5 },
          },
        ])
      );

      const provider = new AnthropicChatProvider(mockDb, mockContext);

      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'claude-sonnet-4-20250514',
      });

      expect(result.content).toBe('Direct string content');
    });

    it('throws error when messages array is empty', async () => {
      const provider = new AnthropicChatProvider(mockDb, mockContext);

      await expect(
        provider.chat({
          messages: [],
          model: 'claude-sonnet-4-20250514',
        })
      ).rejects.toThrow(/at least one message/);
    });

    it('propagates SDK errors', async () => {
      queryMock.mockImplementation(() => {
        throw new Error('SDK connection failed');
      });

      const provider = new AnthropicChatProvider(mockDb, mockContext);

      await expect(
        provider.chat({
          messages: [{ role: 'user', content: 'Test' }],
          model: 'claude-sonnet-4-20250514',
        })
      ).rejects.toThrow('SDK connection failed');
    });

    it('uses result as fallback when no assistant message is captured', async () => {
      queryMock.mockReturnValue(
        mockQueryGenerator([
          { type: 'system', subtype: 'init', session_id: 'sess-fallback' },
          {
            type: 'result',
            subtype: 'success',
            result: 'Fallback result text',
            usage: { input_tokens: 10, output_tokens: 5 },
          },
        ])
      );

      const provider = new AnthropicChatProvider(mockDb, mockContext);

      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'claude-sonnet-4-20250514',
      });

      expect(result.content).toBe('Fallback result text');
    });

    it('includes conversation history in prompt', async () => {
      queryMock.mockReturnValue(
        mockQueryGenerator([
          { type: 'system', subtype: 'init', session_id: 'sess-hist' },
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: 'Response' }],
            },
          },
          {
            type: 'result',
            subtype: 'success',
            result: 'Response',
            usage: { input_tokens: 10, output_tokens: 5 },
          },
        ])
      );

      const provider = new AnthropicChatProvider(mockDb, mockContext);

      await provider.chat({
        messages: [
          { role: 'user', content: 'First question' },
          { role: 'assistant', content: 'First answer' },
          { role: 'user', content: 'Follow-up question' },
        ],
        model: 'claude-sonnet-4-20250514',
      });

      // Verify the prompt includes conversation history
      expect(queryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringMatching(/First question.*First answer.*Follow-up question/s),
        })
      );
    });
  });

  describe('isConfigured()', () => {
    it('returns true when API key is configured', async () => {
      getProviderApiKeyMock.mockResolvedValue('test-key');

      const provider = new AnthropicChatProvider(mockDb, mockContext);
      const result = await provider.isConfigured();

      expect(result).toBe(true);
      expect(getProviderApiKeyMock).toHaveBeenCalledWith(mockDb, 'anthropic');
    });

    it('returns false when API key is not configured', async () => {
      getProviderApiKeyMock.mockResolvedValue(null);

      const provider = new AnthropicChatProvider(mockDb, mockContext);
      const result = await provider.isConfigured();

      expect(result).toBe(false);
      expect(getProviderApiKeyMock).toHaveBeenCalledWith(mockDb, 'anthropic');
    });
  });
});
