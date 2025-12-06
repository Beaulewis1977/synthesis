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

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  __esModule: true,
  query: queryMock,
  createSdkMcpServer: createSdkMcpServerMock,
  tool: toolMock,
}));

vi.mock(
  '../tools.js',
  () => ({
    __esModule: true,
    buildAgentMcpServer: buildAgentMcpServerMock,
    MCP_SERVER_NAME: MCP_SERVER_NAME_MOCK,
    MCP_TOOL_NAMES: MCP_TOOL_NAMES_MOCK,
  }),
  { virtual: true }
);

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

let runAgentChat: typeof import('../agent.js')['runAgentChat'];

beforeAll(async () => {
  ({ runAgentChat } = await import('../agent.js'));
});

describe('runAgentChat', () => {
  const db = {} as Pool;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    vi.clearAllMocks();

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
    Reflect.deleteProperty(process.env, 'ANTHROPIC_API_KEY');
  });

  it('runs the agent loop using SDK, executes tools, and returns final response', async () => {
    const history = [{ role: 'user' as const, content: 'Previous question' }];

    const result = await runAgentChat(db, {
      message: 'Tell me about pgvector.',
      collectionId: '11111111-1111-4111-8111-111111111111',
      history,
    });

    // Verify MCP server was built
    expect(buildAgentMcpServerMock).toHaveBeenCalledWith(db, {
      collectionId: '11111111-1111-4111-8111-111111111111',
    });

    // Verify query was called with correct options
    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Tell me about pgvector'),
        options: expect.objectContaining({
          maxTurns: 10,
          permissionMode: 'bypassPermissions',
          mcpServers: expect.any(Object),
          allowedTools: expect.arrayContaining(['mcp__synthesis-rag-tools__search_rag']),
        }),
      })
    );

    // Verify result structure
    expect(result.message).toBe('pgvector is a PostgreSQL extension for vector similarity search.');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]).toMatchObject({
      id: 'tool-1',
      tool: 'search_rag', // Should be extracted from full MCP name
      status: 'completed',
    });

    // Verify usage tracking
    expect(result.usage).toEqual({
      input_tokens: 70,
      output_tokens: 40,
      total_cost_usd: 0.001,
      num_turns: 2,
      duration_ms: 1500,
    });

    // Verify history updated
    expect(result.history).toHaveLength(3);
    expect(result.history[result.history.length - 1]).toMatchObject({
      role: 'assistant',
      content: 'pgvector is a PostgreSQL extension for vector similarity search.',
    });
  });

  it('throws if API key missing', async () => {
    Reflect.deleteProperty(process.env, 'ANTHROPIC_API_KEY');

    await expect(
      runAgentChat(db, {
        message: 'Hi',
        collectionId: '11111111-1111-4111-8111-111111111111',
      })
    ).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });

  it('handles query without tool calls', async () => {
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

    const result = await runAgentChat(db, {
      message: 'Hello',
      collectionId: '11111111-1111-4111-8111-111111111111',
    });

    expect(result.message).toBe('Hello! How can I help you today?');
    expect(result.toolCalls).toHaveLength(0);
    expect(result.usage).toMatchObject({
      input_tokens: 20,
      output_tokens: 10,
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

    const result = await runAgentChat(db, {
      message: 'Search for something',
      collectionId: '11111111-1111-4111-8111-111111111111',
    });

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].status).toBe('error');
    expect(result.message).toContain('error');
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

    const result = await runAgentChat(db, {
      message: 'Complex task',
      collectionId: '11111111-1111-4111-8111-111111111111',
    });

    expect(result.message).toBe('Working on it...');
    expect(result.usage).toMatchObject({
      input_tokens: 500,
      output_tokens: 300,
      num_turns: 10,
    });
  });
});
