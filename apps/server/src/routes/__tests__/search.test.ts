import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchRoutes } from '../search.js';

vi.mock('../../services/search.js', () => ({
  searchCollection: vi.fn(),
}));

vi.mock('@synthesis/db', () => ({
  getPool: vi.fn(() => ({})),
}));

const { searchCollection } = await import('../../services/search.js');

describe('POST /api/search route', () => {
  let fastify: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    fastify = Fastify();
    await fastify.register(searchRoutes);
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
    vi.clearAllMocks();
  });

  it('returns search results for a valid request', async () => {
    (searchCollection as vi.Mock).mockResolvedValue({
      query: 'test',
      results: [
        {
          id: 1,
          text: 'Example chunk',
          similarity: 0.9,
          docId: 'doc-1',
          docTitle: 'Doc',
          sourceUrl: null,
          metadata: { page: 1 },
          citation: { title: 'Doc', page: 1 },
        },
      ],
      totalResults: 1,
      searchTimeMs: 42,
    });

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/search',
      payload: {
        query: 'test',
        collection_id: '11111111-1111-4111-8111-111111111111',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toMatchObject({
      query: 'test',
      total_results: 1,
      search_time_ms: 42,
      results: [
        expect.objectContaining({
          id: 1,
          text: 'Example chunk',
          doc_id: 'doc-1',
          citation: { title: 'Doc', page: 1 },
        }),
      ],
    });
    expect(searchCollection).toHaveBeenCalled();
  });

  it('returns 400 when payload is invalid', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/search',
      payload: { collection_id: 'not-a-uuid' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('INVALID_INPUT');
  });
});
