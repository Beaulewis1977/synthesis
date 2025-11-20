import type { Pool } from 'pg';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const anthropicCreateMock = vi.hoisted(() => vi.fn());
const searchExecutorMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue('Tool search_rag executed successfully.')
);
const buildAgentToolsMock = vi.hoisted(() =>
  vi.fn(() => ({
    tools: [
      {
        name: 'search_rag',
        description: 'mock tool',
        input_schema: { type: 'object', properties: {} },
      },
    ],
    toolExecutors: {
      search_rag: searchExecutorMock,
    },
  }))
);

vi.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: anthropicCreateMock,
    },
  })),
}));

vi.mock(
  '../tools.js',
  () => ({
    __esModule: true,
    buildAgentTools: buildAgentToolsMock,
  }),
  { virtual: true }
);

let runAgentChat: typeof import('../agent.js')['runAgentChat'];

beforeAll(async () => {
  ({ runAgentChat } = await import('../agent.js'));
});

describe('runAgentChat', () => {
  const db = {} as Pool;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    vi.clearAllMocks();

    anthropicCreateMock
      .mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: 'tool-1',
            name: 'search_rag',
            input: { query: 'What is pgvector?' },
          },
        ],
        usage: {
          input_tokens: 50,
          output_tokens: 10,
        },
      })
      .mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: 'pgvector is a PostgreSQL extension for vector similarity search.',
          },
        ],
        usage: {
          input_tokens: 20,
          output_tokens: 30,
        },
      });
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, 'ANTHROPIC_API_KEY');
  });

  it('runs the agent loop, executes tools, and returns final response', async () => {
    const history = [{ role: 'user' as const, content: 'Previous question' }];

    const result = await runAgentChat(db, {
      message: 'Tell me about pgvector.',
      collectionId: '11111111-1111-4111-8111-111111111111',
      history,
    });

    expect(buildAgentToolsMock).toHaveBeenCalledWith(db, {
      collectionId: '11111111-1111-4111-8111-111111111111',
    });

    expect(anthropicCreateMock).toHaveBeenCalledTimes(2);
    expect(searchExecutorMock).toHaveBeenCalledWith({ query: 'What is pgvector?' });

    expect(result.message).toBe('pgvector is a PostgreSQL extension for vector similarity search.');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]).toMatchObject({
      id: 'tool-1',
      tool: 'search_rag',
      status: 'completed',
      result: 'Tool search_rag executed successfully.',
    });

    expect(result.usage).toEqual({
      input_tokens: 70,
      output_tokens: 40,
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
});
