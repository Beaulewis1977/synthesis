import { describe, expect, it } from 'vitest';
import { calculateRetrievalMetrics } from '../metrics.js';
import type { EvalSearchResult } from '../types.js';

describe('calculateRetrievalMetrics doc-level deduping', () => {
  it('dedupes by docId so recall and NDCG stay <= 1', () => {
    const results: EvalSearchResult[] = [
      {
        chunkId: '1',
        docId: 'docA',
        docTitle: 'A',
        text: 'a1',
        score: 0.9,
        rank: 1,
      },
      {
        chunkId: '2',
        docId: 'docA',
        docTitle: 'A',
        text: 'a2',
        score: 0.85,
        rank: 2,
      },
      {
        chunkId: '3',
        docId: 'docB',
        docTitle: 'B',
        text: 'b1',
        score: 0.8,
        rank: 3,
      },
      {
        chunkId: '4',
        docId: 'docC',
        docTitle: 'C',
        text: 'c1',
        score: 0.7,
        rank: 4,
      },
      {
        chunkId: '5',
        docId: 'docB',
        docTitle: 'B',
        text: 'b2',
        score: 0.69,
        rank: 5,
      },
    ];

    const metrics = calculateRetrievalMetrics(
      results,
      ['docA', 'docB'],
      undefined,
      12,
      'vector',
      false,
      'doc'
    );

    expect(metrics.recall_at_5).toBeCloseTo(1);
    expect(metrics.ndcg_at_5).toBeLessThanOrEqual(1);
    expect(metrics.ndcg_at_10).toBeLessThanOrEqual(1);
  });
});
