import type { Pool } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bm25Search } from '../bm25.js';
import { fuseResults, hybridSearch } from '../hybrid.js';
import { searchCollection } from '../vector.js';

vi.mock('../bm25.js', () => ({
  bm25Search: vi.fn(),
}));

vi.mock('../vector.js', () => ({
  searchCollection: vi.fn(),
}));

describe('fuseResults', () => {
  it('combines overlapping results using RRF weighting', () => {
    const fused = fuseResults(
      [
        {
          id: 1,
          text: 'StatefulWidget lifecycle overview',
          similarity: 0.9,
          docId: 'doc-1',
          docTitle: 'Flutter Docs',
          sourceUrl: 'https://flutter.dev',
          metadata: null,
          citation: { title: 'Flutter Docs' },
        },
        {
          id: 2,
          text: 'Widget lifecycle explanation',
          similarity: 0.8,
          docId: 'doc-2',
          docTitle: 'Community',
          sourceUrl: null,
          metadata: null,
          citation: { title: 'Community' },
        },
      ],
      [
        {
          chunkId: 2,
          text: 'Widget lifecycle explanation',
          rank: 1,
          score: 1,
          docId: 'doc-2',
          docTitle: 'Community',
          sourceUrl: null,
          metadata: null,
        },
        {
          chunkId: 3,
          text: 'Lifecycle cheat sheet',
          rank: 2,
          score: 0.5,
          docId: 'doc-3',
          docTitle: 'Cheat Sheet',
          sourceUrl: null,
          metadata: null,
        },
      ],
      { vector: 0.7, bm25: 0.3 },
      60
    );

    expect(fused).toHaveLength(3);
    const overlap = fused.find((item) => item.id === 2);
    expect(overlap?.source).toBe('both');
    expect(overlap?.vectorScore).toBeCloseTo(0.8);
    expect(overlap?.bm25Score).toBeCloseTo(1);
    expect(overlap?.fusedScore).toBeGreaterThan(0);
  });
});

describe('hybridSearch', () => {
  const pool = {} as unknown as Pool;

  beforeEach(() => {
    vi.mocked(searchCollection).mockResolvedValue({
      query: 'test',
      results: [
        {
          id: 1,
          text: 'StatefulWidget overview',
          similarity: 0.9,
          docId: 'doc-1',
          docTitle: 'Flutter Docs',
          sourceUrl: 'https://flutter.dev',
          metadata: null,
          citation: { title: 'Flutter Docs' },
        },
      ],
      totalResults: 1,
      searchTimeMs: 42,
    });

    vi.mocked(bm25Search).mockResolvedValue([
      {
        chunkId: 2,
        text: 'StatefulWidget build method',
        rank: 1,
        score: 1,
        docId: 'doc-2',
        docTitle: 'Community',
        sourceUrl: null,
        metadata: null,
      },
    ]);
  });

  it('returns fused results sorted by fused score', async () => {
    const { results, vectorCount, bm25Count, elapsedMs } = await hybridSearch(pool, {
      query: 'StatefulWidget lifecycle',
      collectionId: 'collection-1',
      topK: 5,
    });

    expect(searchCollection).toHaveBeenCalledWith(pool, expect.objectContaining({ topK: 15 }));
    expect(bm25Search).toHaveBeenCalledWith(pool, expect.objectContaining({ topK: 15 }));
    expect(results).toHaveLength(2);
    expect(results[0].fusedScore).toBeGreaterThanOrEqual(results[1].fusedScore);
    expect(vectorCount).toBe(1);
    expect(bm25Count).toBe(1);
    expect(typeof elapsedMs).toBe('number');
  });
});
