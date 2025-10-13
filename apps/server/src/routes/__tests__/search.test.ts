import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchRoutes } from '../search.js';

vi.mock('../../services/search.js', () => ({
  smartSearch: vi.fn(),
}));

vi.mock('@synthesis/db', () => ({
  getPool: vi.fn(() => ({})),
}));

const { smartSearch } = await import('../../services/search.js');

describe('POST /api/search route', () => {
  let fastify: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    process.env.SEARCH_MODE = undefined;
    fastify = Fastify();
    await fastify.register(searchRoutes);
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
    vi.clearAllMocks();
  });

  it('returns search results for a valid request', async () => {
    (smartSearch as vi.Mock).mockResolvedValue({
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
      metadata: {
        searchMode: 'vector',
        vectorCount: 1,
        fusedCount: 1,
        embeddingProvider: 'ollama',
      },
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
    const body = JSON.parse(response.payload);
    expect(body).toMatchObject({
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
    expect(body.metadata.embedding_provider).toBe('ollama');
    expect(smartSearch).toHaveBeenCalled();
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

  it('routes to hybrid search when requested', async () => {
    (smartSearch as vi.Mock).mockResolvedValue({
      results: [
        {
          id: 1,
          text: 'Hybrid match',
          vectorScore: 0.8,
          bm25Score: 0.6,
          fusedScore: 0.9,
          source: 'both',
          docId: 'doc-1',
          docTitle: 'Doc',
          sourceUrl: null,
          metadata: null,
          citation: { title: 'Doc' },
        },
      ],
      query: 'test',
      totalResults: 1,
      searchTimeMs: 55,
      metadata: {
        searchMode: 'hybrid',
        vectorCount: 1,
        bm25Count: 1,
        fusedCount: 1,
        embeddingProvider: 'voyage',
      },
    });

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/search',
      payload: {
        query: 'test',
        search_mode: 'hybrid',
        collection_id: '11111111-1111-4111-8111-111111111111',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.metadata.search_mode).toBe('hybrid');
    expect(body.results[0]).toMatchObject({
      vector_score: 0.8,
      bm25_score: 0.6,
      fused_score: 0.9,
      source: 'both',
    });
    expect(body.metadata.embedding_provider).toBe('voyage');
    expect(smartSearch).toHaveBeenCalled();
  });
});
