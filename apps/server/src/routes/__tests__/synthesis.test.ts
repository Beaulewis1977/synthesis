import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { synthesisRoutes } from '../synthesis.js';

vi.mock('../../services/search.js', () => ({
  smartSearch: vi.fn(),
}));

vi.mock('../../services/synthesis.js', () => ({
  synthesizeResults: vi.fn(),
}));

vi.mock('@synthesis/db', () => ({
  getPool: vi.fn(() => ({})),
}));

const { smartSearch } = await import('../../services/search.js');
const { synthesizeResults } = await import('../../services/synthesis.js');

describe('POST /api/synthesis/compare route', () => {
  let fastify: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.ENABLE_SYNTHESIS = undefined;
    fastify = Fastify();
    await fastify.register(synthesisRoutes);
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('returns 404 when synthesis feature disabled', async () => {
    process.env.ENABLE_SYNTHESIS = 'false';

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/synthesis/compare',
      payload: {
        query: 'test',
        collection_id: '11111111-1111-4111-8111-111111111111',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(smartSearch).not.toHaveBeenCalled();
  });

  it('returns synthesis when enabled', async () => {
    process.env.ENABLE_SYNTHESIS = 'true';

    (smartSearch as vi.Mock).mockResolvedValue({
      query: 'test',
      results: [
        {
          id: 1,
          text: 'Doc snippet',
          similarity: 0.9,
          docId: 'doc-1',
          docTitle: 'Doc',
          sourceUrl: null,
          metadata: {},
          citation: { title: 'Doc' },
        },
      ],
      totalResults: 1,
      searchTimeMs: 12,
      metadata: {
        searchMode: 'hybrid',
      },
    });

    (synthesizeResults as vi.Mock).mockResolvedValue({
      query: 'test',
      approaches: [],
      conflicts: [],
      recommended: null,
      metadata: {
        total_sources: 1,
        approaches_found: 0,
        conflicts_found: 0,
        synthesis_time_ms: 3,
      },
    });

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/synthesis/compare',
      payload: {
        query: 'test',
        collection_id: '11111111-1111-4111-8111-111111111111',
        top_k: 10,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body).toMatchObject({
      metadata: {
        total_sources: 1,
        synthesis_time_ms: 3,
      },
    });
    expect(smartSearch).toHaveBeenCalled();
    expect(synthesizeResults).toHaveBeenCalledWith(
      'test',
      expect.any(Array),
      expect.objectContaining({ maxResults: 10 })
    );
  });
});
