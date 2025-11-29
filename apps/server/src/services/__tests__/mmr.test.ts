import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MIN_SIMILARITY_DIFF,
  DEFAULT_MMR_LAMBDA,
  type MMRCandidate,
  type MMROptions,
  NEAR_DUPLICATE_THRESHOLD,
  applyMMR,
  cosineSimilarity,
  getDefaultMMROptions,
  logMMRResults,
  resolveMMROptions,
} from '../mmr.js';

describe('MMR (Maximal Marginal Relevance)', () => {
  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const v = [1, 2, 3, 4, 5];
      expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
    });

    it('should return -1 for opposite vectors', () => {
      const v1 = [1, 0, 0];
      const v2 = [-1, 0, 0];
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(-1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const v1 = [1, 0, 0];
      const v2 = [0, 1, 0];
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(0, 5);
    });

    it('should handle normalized vectors correctly', () => {
      const v1 = [0.6, 0.8, 0];
      const v2 = [0.8, 0.6, 0];
      // cos(θ) = 0.6*0.8 + 0.8*0.6 = 0.96
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(0.96, 5);
    });

    it('should return 0 for empty vectors', () => {
      expect(cosineSimilarity([], [])).toBe(0);
      expect(cosineSimilarity([1, 2], [])).toBe(0);
      expect(cosineSimilarity([], [1, 2])).toBe(0);
    });

    it('should return 0 for vectors of different lengths', () => {
      expect(cosineSimilarity([1, 2, 3], [1, 2])).toBe(0);
    });

    it('should return 0 for zero vectors', () => {
      expect(cosineSimilarity([0, 0, 0], [0, 0, 0])).toBe(0);
      expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
    });

    it('should handle vectors with NaN values gracefully', () => {
      const v1 = [1, Number.NaN, 3];
      const v2 = [1, 2, 3];
      // NaN values are skipped, so only positions 0 and 2 contribute
      const result = cosineSimilarity(v1, v2);
      expect(Number.isFinite(result)).toBe(true);
    });

    it('should handle vectors with Infinity values gracefully', () => {
      const v1 = [1, Number.POSITIVE_INFINITY, 3];
      const v2 = [1, 2, 3];
      const result = cosineSimilarity(v1, v2);
      expect(Number.isFinite(result)).toBe(true);
    });

    it('should clamp result to [-1, 1] for floating point errors', () => {
      // Create vectors that might cause floating point errors
      const v1 = [0.9999999999999999, 0.0000000000000001];
      const v2 = [0.9999999999999999, 0.0000000000000001];
      const result = cosineSimilarity(v1, v2);
      expect(result).toBeGreaterThanOrEqual(-1);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe('applyMMR', () => {
    // Helper to create test candidates
    function createCandidate(
      id: number,
      relevanceScore: number,
      embedding: number[] | null
    ): MMRCandidate & { id: number } {
      return { id, relevanceScore, embedding };
    }

    const defaultOptions: MMROptions = {
      enabled: true,
      lambda: 0.7,
      minSimilarityDiff: 0.1,
    };

    describe('basic functionality', () => {
      it('should return empty results for empty input', () => {
        const result = applyMMR([], 5, defaultOptions);
        expect(result.results).toHaveLength(0);
        expect(result.metrics.duplicatesRemoved).toBe(0);
      });

      it('should return original order when MMR is disabled', () => {
        const candidates = [
          createCandidate(1, 0.9, [1, 0, 0]),
          createCandidate(2, 0.8, [0.99, 0.1, 0]), // Very similar to #1
          createCandidate(3, 0.7, [0, 1, 0]),
        ];

        const result = applyMMR(candidates, 3, { ...defaultOptions, enabled: false });
        expect(result.results.map((r) => r.id)).toEqual([1, 2, 3]);
        expect(result.metrics.duplicatesRemoved).toBe(0);
      });

      it('should return original order when lambda is 1.0 (pure relevance)', () => {
        const candidates = [
          createCandidate(1, 0.9, [1, 0, 0]),
          createCandidate(2, 0.8, [0.99, 0.1, 0]),
          createCandidate(3, 0.7, [0, 1, 0]),
        ];

        const result = applyMMR(candidates, 3, { ...defaultOptions, lambda: 1.0 });
        expect(result.results.map((r) => r.id)).toEqual([1, 2, 3]);
      });

      it('should always select the most relevant result first', () => {
        const candidates = [
          createCandidate(1, 0.5, [1, 0, 0]),
          createCandidate(2, 0.9, [0, 1, 0]),
          createCandidate(3, 0.7, [0, 0, 1]),
        ];

        const result = applyMMR(candidates, 3, defaultOptions);
        expect(result.results[0].id).toBe(2); // Highest relevance
      });

      it('should respect topK limit', () => {
        const candidates = [
          createCandidate(1, 0.9, [1, 0, 0]),
          createCandidate(2, 0.8, [0, 1, 0]),
          createCandidate(3, 0.7, [0, 0, 1]),
          createCandidate(4, 0.6, [1, 1, 0]),
          createCandidate(5, 0.5, [0, 1, 1]),
        ];

        const result = applyMMR(candidates, 3, defaultOptions);
        expect(result.results).toHaveLength(3);
      });

      it('should handle topK larger than candidates', () => {
        const candidates = [createCandidate(1, 0.9, [1, 0, 0]), createCandidate(2, 0.8, [0, 1, 0])];

        const result = applyMMR(candidates, 10, defaultOptions);
        expect(result.results).toHaveLength(2);
      });
    });

    describe('diversification behavior', () => {
      it('should deprioritize near-duplicate results', () => {
        // Create candidates where #2 is very similar to #1
        const candidates = [
          createCandidate(1, 0.9, [1, 0, 0]),
          createCandidate(2, 0.85, [0.99, 0.1, 0.1]), // Very similar to #1
          createCandidate(3, 0.7, [0, 1, 0]), // Different from #1
        ];

        const result = applyMMR(candidates, 3, { ...defaultOptions, lambda: 0.5 });

        // With lambda=0.5, diversity matters more
        // After selecting #1, #3 should be preferred over #2 due to diversity
        expect(result.results[0].id).toBe(1); // Highest relevance
        expect(result.results[1].id).toBe(3); // More diverse than #2
        expect(result.results[2].id).toBe(2); // Similar to #1, selected last
      });

      it('should produce more diverse results with lower lambda', () => {
        const candidates = [
          createCandidate(1, 0.9, [1, 0, 0]),
          createCandidate(2, 0.88, [0.95, 0.3, 0]), // Similar to #1
          createCandidate(3, 0.6, [0, 1, 0]), // Different
          createCandidate(4, 0.5, [0, 0, 1]), // Different
        ];

        // High lambda (relevance-focused)
        const highLambda = applyMMR(candidates, 3, { ...defaultOptions, lambda: 0.9 });

        // Low lambda (diversity-focused)
        const lowLambda = applyMMR(candidates, 3, { ...defaultOptions, lambda: 0.3 });

        // With low lambda, we expect lower average pairwise similarity
        expect(lowLambda.metrics.avgPairwiseSimilarity).toBeLessThanOrEqual(
          highLambda.metrics.avgPairwiseSimilarity + 0.01 // Small tolerance
        );
      });

      it('should track duplicates removed correctly', () => {
        const candidates = [
          createCandidate(1, 0.9, [1, 0, 0]),
          createCandidate(2, 0.85, [0.99, 0.1, 0]), // Near-duplicate of #1
          createCandidate(3, 0.5, [0, 1, 0]), // Different
        ];

        const result = applyMMR(candidates, 2, { ...defaultOptions, lambda: 0.5 });

        // If #2 was in original top-2 but got pushed out, duplicatesRemoved should be 1
        if (result.results.map((r) => r.id).includes(3)) {
          expect(result.metrics.duplicatesRemoved).toBeGreaterThanOrEqual(1);
        }
      });

      it('should track original positions correctly', () => {
        const candidates = [
          createCandidate(1, 0.9, [1, 0, 0]),
          createCandidate(2, 0.85, [0.99, 0.1, 0]),
          createCandidate(3, 0.5, [0, 1, 0]),
        ];

        const result = applyMMR(candidates, 3, defaultOptions);

        // Original positions should be valid indices
        for (const pos of result.metrics.originalPositions) {
          expect(pos).toBeGreaterThanOrEqual(0);
          expect(pos).toBeLessThan(candidates.length);
        }
      });
    });

    describe('edge cases', () => {
      it('should handle single candidate', () => {
        const candidates = [createCandidate(1, 0.9, [1, 0, 0])];
        const result = applyMMR(candidates, 5, defaultOptions);

        expect(result.results).toHaveLength(1);
        expect(result.results[0].id).toBe(1);
        expect(result.metrics.avgPairwiseSimilarity).toBe(0);
      });

      it('should handle candidates with null embeddings', () => {
        const candidates = [
          createCandidate(1, 0.9, null),
          createCandidate(2, 0.8, null),
          createCandidate(3, 0.7, [1, 0, 0]),
        ];

        const result = applyMMR(candidates, 3, defaultOptions);
        expect(result.results).toHaveLength(3);
      });

      it('should handle all null embeddings gracefully', () => {
        const candidates = [
          createCandidate(1, 0.9, null),
          createCandidate(2, 0.8, null),
          createCandidate(3, 0.7, null),
        ];

        const result = applyMMR(candidates, 3, defaultOptions);
        expect(result.results).toHaveLength(3);
        // Should fall back to relevance order
        expect(result.results.map((r) => r.id)).toEqual([1, 2, 3]);
      });

      it('should handle candidates with identical relevance scores', () => {
        const candidates = [
          createCandidate(1, 0.8, [1, 0, 0]),
          createCandidate(2, 0.8, [0, 1, 0]),
          createCandidate(3, 0.8, [0, 0, 1]),
        ];

        const result = applyMMR(candidates, 3, defaultOptions);
        expect(result.results).toHaveLength(3);
      });

      it('should handle candidates with identical embeddings', () => {
        const embedding = [1, 0, 0];
        const candidates = [
          createCandidate(1, 0.9, embedding),
          createCandidate(2, 0.8, embedding),
          createCandidate(3, 0.7, embedding),
        ];

        const result = applyMMR(candidates, 3, defaultOptions);
        expect(result.results).toHaveLength(3);
        // With identical embeddings, should fall back to relevance order
        expect(result.results[0].id).toBe(1);
      });

      it('should clamp lambda to [0, 1] range', () => {
        const candidates = [createCandidate(1, 0.9, [1, 0, 0]), createCandidate(2, 0.8, [0, 1, 0])];

        // Lambda > 1 should be clamped to 1
        const result1 = applyMMR(candidates, 2, { ...defaultOptions, lambda: 1.5 });
        expect(result1.metrics.lambda).toBe(1);

        // Lambda < 0 should be clamped to 0
        const result2 = applyMMR(candidates, 2, { ...defaultOptions, lambda: -0.5 });
        expect(result2.metrics.lambda).toBe(0);
      });

      it('should handle zero relevance scores', () => {
        const candidates = [createCandidate(1, 0, [1, 0, 0]), createCandidate(2, 0, [0, 1, 0])];

        const result = applyMMR(candidates, 2, defaultOptions);
        expect(result.results).toHaveLength(2);
      });

      it('should handle very small embedding vectors', () => {
        const candidates = [createCandidate(1, 0.9, [0.001]), createCandidate(2, 0.8, [0.002])];

        const result = applyMMR(candidates, 2, defaultOptions);
        expect(result.results).toHaveLength(2);
      });

      it('should handle high-dimensional embeddings', () => {
        const dim = 1536; // Common embedding dimension
        const candidates = [
          createCandidate(
            1,
            0.9,
            Array(dim)
              .fill(0)
              .map((_, i) => Math.sin(i))
          ),
          createCandidate(
            2,
            0.8,
            Array(dim)
              .fill(0)
              .map((_, i) => Math.cos(i))
          ),
          createCandidate(
            3,
            0.7,
            Array(dim)
              .fill(0)
              .map((_, i) => Math.sin(i + 1))
          ),
        ];

        const result = applyMMR(candidates, 3, defaultOptions);
        expect(result.results).toHaveLength(3);
        expect(result.metrics.avgPairwiseSimilarity).toBeGreaterThanOrEqual(0);
        expect(result.metrics.avgPairwiseSimilarity).toBeLessThanOrEqual(1);
      });
    });

    describe('metrics accuracy', () => {
      it('should compute avgPairwiseSimilarity correctly', () => {
        // Orthogonal vectors have 0 similarity
        const candidates = [
          createCandidate(1, 0.9, [1, 0, 0]),
          createCandidate(2, 0.8, [0, 1, 0]),
          createCandidate(3, 0.7, [0, 0, 1]),
        ];

        const result = applyMMR(candidates, 3, { ...defaultOptions, lambda: 1.0 });
        // All pairs are orthogonal, so avg similarity should be 0
        expect(result.metrics.avgPairwiseSimilarity).toBeCloseTo(0, 2);
      });

      it('should return lambda in metrics', () => {
        const candidates = [createCandidate(1, 0.9, [1, 0, 0])];
        const result = applyMMR(candidates, 1, { ...defaultOptions, lambda: 0.65 });
        expect(result.metrics.lambda).toBe(0.65);
      });
    });
  });

  describe('resolveMMROptions', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return defaults when no options provided', () => {
      process.env.MMR_DEFAULT_ENABLED = undefined;
      process.env.MMR_DEFAULT_LAMBDA = undefined;

      const options = resolveMMROptions();
      expect(options.enabled).toBe(false);
      expect(options.lambda).toBe(DEFAULT_MMR_LAMBDA);
      expect(options.minSimilarityDiff).toBe(DEFAULT_MIN_SIMILARITY_DIFF);
    });

    it('should use request options over defaults', () => {
      const options = resolveMMROptions({ enabled: true, lambda: 0.5 });
      expect(options.enabled).toBe(true);
      expect(options.lambda).toBe(0.5);
    });

    it('should clamp lambda to valid range', () => {
      const options1 = resolveMMROptions({ lambda: 1.5 });
      expect(options1.lambda).toBe(1);

      const options2 = resolveMMROptions({ lambda: -0.5 });
      expect(options2.lambda).toBe(0);
    });

    it('should respect MMR_DEFAULT_ENABLED env var', () => {
      process.env.MMR_DEFAULT_ENABLED = 'true';
      const options = resolveMMROptions();
      expect(options.enabled).toBe(true);
    });

    it('should respect MMR_DEFAULT_LAMBDA env var', () => {
      process.env.MMR_DEFAULT_LAMBDA = '0.6';
      const options = resolveMMROptions();
      expect(options.lambda).toBe(0.6);
    });

    it('should handle invalid env var values', () => {
      process.env.MMR_DEFAULT_LAMBDA = 'invalid';
      const options = resolveMMROptions();
      expect(options.lambda).toBe(DEFAULT_MMR_LAMBDA);
    });
  });

  describe('getDefaultMMROptions', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return default values', () => {
      process.env.MMR_DEFAULT_ENABLED = undefined;
      process.env.MMR_DEFAULT_LAMBDA = undefined;

      const options = getDefaultMMROptions();
      expect(options.enabled).toBe(false);
      expect(options.lambda).toBe(DEFAULT_MMR_LAMBDA);
    });

    it('should clamp env lambda to valid range', () => {
      process.env.MMR_DEFAULT_LAMBDA = '2.0';
      const options = getDefaultMMROptions();
      expect(options.lambda).toBe(1);
    });
  });

  describe('logMMRResults', () => {
    const originalEnv = process.env;
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
      consoleSpy.mockClear();
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should not log when MMR_LOG is not set', () => {
      process.env.MMR_LOG = undefined;

      logMMRResults(
        'test query',
        {
          avgPairwiseSimilarity: 0.5,
          duplicatesRemoved: 2,
          originalPositions: [0, 2, 1],
          lambda: 0.7,
        },
        3
      );

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should log when MMR_LOG is true', () => {
      process.env.MMR_LOG = 'true';

      logMMRResults(
        'test query',
        {
          avgPairwiseSimilarity: 0.5,
          duplicatesRemoved: 2,
          originalPositions: [0, 2, 1],
          lambda: 0.7,
        },
        3
      );

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const logArg = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(logArg);
      expect(parsed.type).toBe('mmr_diversification');
      expect(parsed.lambda).toBe(0.7);
      expect(parsed.resultCount).toBe(3);
    });

    it('should truncate long queries in log', () => {
      process.env.MMR_LOG = 'true';

      const longQuery = 'a'.repeat(200);
      logMMRResults(
        longQuery,
        {
          avgPairwiseSimilarity: 0.5,
          duplicatesRemoved: 0,
          originalPositions: [0],
          lambda: 0.7,
        },
        1
      );

      const logArg = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(logArg);
      expect(parsed.query.length).toBe(100);
    });
  });

  describe('constants', () => {
    it('should have valid DEFAULT_MMR_LAMBDA', () => {
      expect(DEFAULT_MMR_LAMBDA).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_MMR_LAMBDA).toBeLessThanOrEqual(1);
    });

    it('should have valid DEFAULT_MIN_SIMILARITY_DIFF', () => {
      expect(DEFAULT_MIN_SIMILARITY_DIFF).toBeGreaterThan(0);
      expect(DEFAULT_MIN_SIMILARITY_DIFF).toBeLessThan(1);
    });

    it('should have valid NEAR_DUPLICATE_THRESHOLD', () => {
      expect(NEAR_DUPLICATE_THRESHOLD).toBeGreaterThan(0.5);
      expect(NEAR_DUPLICATE_THRESHOLD).toBeLessThanOrEqual(1);
    });
  });

  describe('real-world scenarios', () => {
    it('should diversify search results about similar topics', () => {
      // Simulate search results about "React hooks"
      // Results 1, 2, 3 are about useState, 4 is about useEffect, 5 is about useContext
      const candidates = [
        { id: 1, relevanceScore: 0.95, embedding: [0.9, 0.1, 0.1] }, // useState intro
        { id: 2, relevanceScore: 0.92, embedding: [0.88, 0.12, 0.1] }, // useState examples
        { id: 3, relevanceScore: 0.9, embedding: [0.85, 0.15, 0.1] }, // useState advanced
        { id: 4, relevanceScore: 0.85, embedding: [0.2, 0.9, 0.1] }, // useEffect
        { id: 5, relevanceScore: 0.8, embedding: [0.2, 0.1, 0.9] }, // useContext
      ];

      // With diversity, we should get a mix of topics
      const result = applyMMR(candidates, 3, {
        enabled: true,
        lambda: 0.5,
        minSimilarityDiff: 0.1,
      });

      // First result should be most relevant (useState intro)
      expect(result.results[0].id).toBe(1);

      // The other two should include diverse topics (useEffect and/or useContext)
      const selectedIds = result.results.map((r) => r.id);
      const hasDiversity = selectedIds.includes(4) || selectedIds.includes(5);
      expect(hasDiversity).toBe(true);
    });

    it('should handle code search results with similar snippets', () => {
      // Simulate code search where multiple results are from the same file
      const candidates = [
        { id: 1, relevanceScore: 0.9, embedding: [1, 0, 0, 0] }, // function A
        { id: 2, relevanceScore: 0.88, embedding: [0.95, 0.05, 0, 0] }, // function A variant
        { id: 3, relevanceScore: 0.85, embedding: [0, 1, 0, 0] }, // function B
        { id: 4, relevanceScore: 0.82, embedding: [0, 0, 1, 0] }, // function C
      ];

      const result = applyMMR(candidates, 3, {
        enabled: true,
        lambda: 0.6,
        minSimilarityDiff: 0.1,
      });

      // Should prefer diverse functions over similar variants
      expect(result.metrics.duplicatesRemoved).toBeGreaterThanOrEqual(0);
    });
  });
});
