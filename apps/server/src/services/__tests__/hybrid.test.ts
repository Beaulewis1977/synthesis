import type { Pool } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bm25SearchWithMetadata } from '../bm25.js';
import { fuseResults, hybridSearch } from '../hybrid.js';
import { searchCollection } from '../vector.js';

vi.mock('../bm25.js', () => ({
  bm25SearchWithMetadata: vi.fn(),
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
          snippet: 'StatefulWidget lifecycle overview',
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
          snippet: 'Widget lifecycle explanation',
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
          snippet: 'StatefulWidget overview',
          similarity: 0.9,
          docId: 'doc-1',
          docTitle: 'Flutter Docs',
          sourceUrl: 'https://flutter.dev',
          metadata: null,
          citation: { title: 'Flutter Docs' },
        },
        {
          id: 3,
          text: 'Another widget doc',
          snippet: 'Another widget doc',
          similarity: 0.75,
          docId: 'doc-3',
          docTitle: 'More Docs',
          sourceUrl: 'https://flutter.dev/more',
          metadata: null,
          citation: { title: 'More Docs' },
        },
      ],
      totalResults: 2,
      searchTimeMs: 42,
    });

    vi.mocked(bm25SearchWithMetadata).mockResolvedValue({
      results: [
        {
          chunkId: 2,
          text: 'StatefulWidget build method',
          rank: 1,
          score: 0.85,
          docId: 'doc-2',
          docTitle: 'Community',
          sourceUrl: null,
          metadata: null,
        },
        {
          chunkId: 1,
          text: 'StatefulWidget overview',
          rank: 2,
          score: 0.65,
          docId: 'doc-1',
          docTitle: 'Flutter Docs',
          sourceUrl: 'https://flutter.dev',
          metadata: null,
        },
      ],
      metadata: {
        queryType: 'natural_language',
        tsFunction: 'websearch_to_tsquery',
        elapsedMs: 15,
        resultCount: 2,
      },
    });
  });

  it('returns fused results sorted by fused score', async () => {
    const { results, vectorCount, bm25Count, elapsedMs } = await hybridSearch(pool, {
      query: 'StatefulWidget lifecycle',
      collectionId: 'collection-1',
      topK: 5,
    });

    expect(searchCollection).toHaveBeenCalledWith(pool, expect.objectContaining({ topK: 15 }));
    expect(bm25SearchWithMetadata).toHaveBeenCalledWith(
      pool,
      expect.objectContaining({ topK: 15 })
    );
    expect(results).toHaveLength(3);
    expect(results[0].fusedScore).toBeGreaterThanOrEqual(results[1].fusedScore);
    expect(vectorCount).toBe(2);
    expect(bm25Count).toBe(2);
    expect(typeof elapsedMs).toBe('number');
  });

  it('returns comprehensive diagnostics', async () => {
    const { diagnostics } = await hybridSearch(pool, {
      query: 'StatefulWidget lifecycle',
      collectionId: 'collection-1',
      topK: 5,
    });

    // Verify diagnostics structure
    expect(diagnostics).toBeDefined();
    expect(diagnostics.vectorResultCount).toBe(2);
    expect(diagnostics.bm25ResultCount).toBe(2);
    expect(diagnostics.fusedResultCount).toBeLessThanOrEqual(3);

    // Verify score statistics
    expect(diagnostics.vectorScores).toEqual({
      avg: expect.any(Number),
      max: expect.any(Number),
      min: expect.any(Number),
    });
    expect(diagnostics.vectorScores.max).toBeCloseTo(0.9, 2);
    expect(diagnostics.vectorScores.min).toBeCloseTo(0.75, 2);

    expect(diagnostics.bm25Scores).toEqual({
      avg: expect.any(Number),
      max: expect.any(Number),
      min: expect.any(Number),
    });
    expect(diagnostics.bm25Scores.max).toBeCloseTo(0.85, 2);
    expect(diagnostics.bm25Scores.min).toBeCloseTo(0.65, 2);

    // Verify timing breakdown
    expect(diagnostics.timing).toEqual({
      vectorMs: expect.any(Number),
      bm25Ms: expect.any(Number),
      fusionMs: expect.any(Number),
      totalMs: expect.any(Number),
    });
    expect(diagnostics.timing.totalMs).toBeGreaterThanOrEqual(0);

    // Verify BM25 query metadata
    expect(diagnostics.bm25QueryType).toBe('natural_language');
    expect(diagnostics.bm25TsFunction).toBe('websearch_to_tsquery');

    // Verify weights
    expect(diagnostics.weights.vector).toBeCloseTo(0.7, 2);
    expect(diagnostics.weights.bm25).toBeCloseTo(0.3, 2);
    expect(diagnostics.rrfK).toBe(60);
  });

  it('counts results found by both methods', async () => {
    const { diagnostics } = await hybridSearch(pool, {
      query: 'StatefulWidget lifecycle',
      collectionId: 'collection-1',
      topK: 5,
    });

    // ID 1 appears in both vector and BM25 results
    expect(diagnostics.bothSourceCount).toBe(1);
  });

  it('respects custom weights', async () => {
    const { diagnostics } = await hybridSearch(pool, {
      query: 'StatefulWidget lifecycle',
      collectionId: 'collection-1',
      topK: 5,
      weights: { vector: 0.5, bm25: 0.5 },
    });

    expect(diagnostics.weights.vector).toBeCloseTo(0.5, 2);
    expect(diagnostics.weights.bm25).toBeCloseTo(0.5, 2);
  });

  it('normalizes weights that do not sum to 1', async () => {
    const { diagnostics } = await hybridSearch(pool, {
      query: 'StatefulWidget lifecycle',
      collectionId: 'collection-1',
      topK: 5,
      weights: { vector: 2, bm25: 2 },
    });

    // Should be normalized to 0.5 each
    expect(diagnostics.weights.vector).toBeCloseTo(0.5, 2);
    expect(diagnostics.weights.bm25).toBeCloseTo(0.5, 2);
  });
});

describe('diagnostics edge cases', () => {
  const pool = {} as unknown as Pool;

  it('handles empty results gracefully', async () => {
    vi.mocked(searchCollection).mockResolvedValue({
      query: 'test',
      results: [],
      totalResults: 0,
      searchTimeMs: 5,
    });

    vi.mocked(bm25SearchWithMetadata).mockResolvedValue({
      results: [],
      metadata: {
        queryType: 'natural_language',
        tsFunction: 'websearch_to_tsquery',
        elapsedMs: 3,
        resultCount: 0,
      },
    });

    const { diagnostics } = await hybridSearch(pool, {
      query: 'nonexistent query',
      collectionId: 'collection-1',
      topK: 5,
    });

    expect(diagnostics.vectorResultCount).toBe(0);
    expect(diagnostics.bm25ResultCount).toBe(0);
    expect(diagnostics.fusedResultCount).toBe(0);
    expect(diagnostics.bothSourceCount).toBe(0);

    // Score stats should be 0 for empty results
    expect(diagnostics.vectorScores).toEqual({ avg: 0, max: 0, min: 0 });
    expect(diagnostics.bm25Scores).toEqual({ avg: 0, max: 0, min: 0 });
  });
});
