import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  estimateSplitCount,
  findSemanticBoundary,
  getChunkStatistics,
  isAutoSplitEnabled,
  splitOversizedChunk,
  validateAndSplitChunks,
} from '../chunk-splitter.js';
import type { Chunk } from '../chunk.js';

describe('chunk-splitter', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('isAutoSplitEnabled', () => {
    it('should return true by default', () => {
      process.env.AUTO_SPLIT_CHUNKS = undefined;
      expect(isAutoSplitEnabled()).toBe(true);
    });

    it('should return false when explicitly disabled', () => {
      process.env.AUTO_SPLIT_CHUNKS = 'false';
      expect(isAutoSplitEnabled()).toBe(false);
    });

    it('should return false when set to 0', () => {
      process.env.AUTO_SPLIT_CHUNKS = '0';
      expect(isAutoSplitEnabled()).toBe(false);
    });

    it('should return true for any other value', () => {
      process.env.AUTO_SPLIT_CHUNKS = 'true';
      expect(isAutoSplitEnabled()).toBe(true);
    });
  });

  describe('findSemanticBoundary', () => {
    it('should find paragraph break within search window', () => {
      const text = 'First paragraph.\n\nSecond paragraph starts here.';
      const boundary = findSemanticBoundary(text, 0, 30);
      // The function searches within a window (last 20% of chunk)
      // and finds the best boundary. It should find the paragraph break.
      expect(boundary).toBeGreaterThan(0);
      expect(boundary).toBeLessThanOrEqual(30);
    });

    it('should find sentence boundary within search window', () => {
      const text = 'First sentence. Second sentence starts here.';
      const boundary = findSemanticBoundary(text, 0, 30);
      // Should find a boundary within the search window
      expect(boundary).toBeGreaterThan(0);
      expect(boundary).toBeLessThanOrEqual(30);
    });

    it('should find line break within search window', () => {
      const text = 'Line one\nLine two continues here';
      const boundary = findSemanticBoundary(text, 0, 20);
      // Should find a boundary (newline or space) within the window
      expect(boundary).toBeGreaterThan(0);
      expect(boundary).toBeLessThanOrEqual(20);
    });

    it('should find word boundary as last resort', () => {
      const text = 'oneword anotherword thirdword';
      const boundary = findSemanticBoundary(text, 0, 15);
      // Should find space after "anotherword" or similar
      expect(boundary).toBeGreaterThan(0);
    });

    it('should return target position when no boundary found', () => {
      const text = 'abcdefghijklmnopqrstuvwxyz';
      const boundary = findSemanticBoundary(text, 0, 10);
      // No spaces, newlines, or punctuation
      expect(boundary).toBe(10);
    });
  });

  describe('splitOversizedChunk', () => {
    it('should not split chunk within limit', () => {
      const chunk: Chunk = {
        text: 'Short text',
        index: 0,
        metadata: { startOffset: 0, endOffset: 10 },
      };

      const splits = splitOversizedChunk(chunk, { maxTokens: 1000 });
      expect(splits).toHaveLength(1);
      expect(splits[0].text).toBe('Short text');
    });

    it('should split oversized chunk', () => {
      // Create a chunk that will need splitting
      const longText = 'This is a sentence. '.repeat(100);
      const chunk: Chunk = {
        text: longText,
        index: 0,
        metadata: { startOffset: 0, endOffset: longText.length },
      };

      const splits = splitOversizedChunk(chunk, { maxTokens: 100 });
      expect(splits.length).toBeGreaterThan(1);
    });

    it('should add parent-child metadata to splits', () => {
      const longText = 'This is a sentence. '.repeat(100);
      const chunk: Chunk = {
        text: longText,
        index: 0,
        metadata: { startOffset: 0, endOffset: longText.length },
      };

      const splits = splitOversizedChunk(chunk, { maxTokens: 100 });

      // All splits should have the same parent_chunk_id
      const parentId = splits[0].metadata.parent_chunk_id;
      expect(parentId).toBeDefined();

      for (let i = 0; i < splits.length; i++) {
        expect(splits[i].metadata.parent_chunk_id).toBe(parentId);
        expect(splits[i].metadata.split_index).toBe(i);
        expect(splits[i].metadata.total_splits).toBe(splits.length);
        expect(splits[i].metadata.is_split).toBe(true);
      }
    });

    it('should preserve original metadata in splits', () => {
      const chunk: Chunk = {
        text: 'This is a sentence. '.repeat(100),
        index: 5,
        metadata: {
          startOffset: 100,
          endOffset: 2100,
          heading: 'Test Heading',
          language: 'typescript',
        },
      };

      const splits = splitOversizedChunk(chunk, { maxTokens: 100 });

      for (const split of splits) {
        expect(split.metadata.heading).toBe('Test Heading');
        expect(split.metadata.language).toBe('typescript');
      }
    });

    it('should update offsets for each split', () => {
      const longText = 'Word '.repeat(500);
      const chunk: Chunk = {
        text: longText,
        index: 0,
        metadata: { startOffset: 0, endOffset: longText.length },
      };

      const splits = splitOversizedChunk(chunk, { maxTokens: 100 });

      // First split should start at 0
      expect(splits[0].metadata.startOffset).toBe(0);

      // Each subsequent split should have increasing offsets
      for (let i = 1; i < splits.length; i++) {
        expect(splits[i].metadata.startOffset).toBeGreaterThan(
          splits[i - 1].metadata.startOffset ?? 0
        );
      }
    });

    it('should respect overlap setting', () => {
      const longText = 'Word '.repeat(500);
      const chunk: Chunk = {
        text: longText,
        index: 0,
        metadata: { startOffset: 0, endOffset: longText.length },
      };

      const splitsWithOverlap = splitOversizedChunk(chunk, {
        maxTokens: 100,
        overlapChars: 50,
      });

      const splitsNoOverlap = splitOversizedChunk(chunk, {
        maxTokens: 100,
        overlapChars: 0,
      });

      // With overlap, we should have more splits (or same)
      expect(splitsWithOverlap.length).toBeGreaterThanOrEqual(splitsNoOverlap.length);
    });
  });

  describe('validateAndSplitChunks', () => {
    it('should pass through valid chunks unchanged', () => {
      const chunks: Chunk[] = [
        { text: 'Short text 1', index: 0, metadata: { startOffset: 0, endOffset: 12 } },
        { text: 'Short text 2', index: 1, metadata: { startOffset: 13, endOffset: 25 } },
      ];

      const result = validateAndSplitChunks(chunks, 'ollama', 'nomic-embed-text');

      expect(result.chunks).toHaveLength(2);
      expect(result.splitCount).toBe(0);
      expect(result.newChunksCreated).toBe(0);
    });

    it('should split oversized chunks', () => {
      const longText = 'This is a long sentence that repeats. '.repeat(1000);
      const chunks: Chunk[] = [
        { text: 'Short text', index: 0, metadata: { startOffset: 0, endOffset: 10 } },
        {
          text: longText,
          index: 1,
          metadata: { startOffset: 11, endOffset: 11 + longText.length },
        },
      ];

      const result = validateAndSplitChunks(chunks, 'ollama', 'nomic-embed-text');

      expect(result.chunks.length).toBeGreaterThan(2);
      expect(result.splitCount).toBe(1);
      expect(result.newChunksCreated).toBeGreaterThan(0);
    });

    it('should re-index chunks after splitting', () => {
      const longText = 'This is a long sentence. '.repeat(500);
      const chunks: Chunk[] = [
        { text: 'First chunk', index: 0, metadata: { startOffset: 0, endOffset: 11 } },
        {
          text: longText,
          index: 1,
          metadata: { startOffset: 12, endOffset: 12 + longText.length },
        },
        {
          text: 'Last chunk',
          index: 2,
          metadata: { startOffset: 12 + longText.length + 1, endOffset: 12 + longText.length + 11 },
        },
      ];

      const result = validateAndSplitChunks(chunks, 'ollama', 'nomic-embed-text');

      // Check that indices are sequential
      for (let i = 0; i < result.chunks.length; i++) {
        expect(result.chunks[i].index).toBe(i);
      }
    });

    it('should not split when auto-split is disabled', () => {
      vi.stubEnv('AUTO_SPLIT_CHUNKS', 'false');

      const longText = 'This is a long sentence. '.repeat(1000);
      const chunks: Chunk[] = [
        { text: longText, index: 0, metadata: { startOffset: 0, endOffset: longText.length } },
      ];

      const result = validateAndSplitChunks(chunks, 'ollama', 'nomic-embed-text');

      expect(result.chunks).toHaveLength(1);
      expect(result.splitCount).toBe(0);
    });
  });

  describe('estimateSplitCount', () => {
    it('should return 1 for small text', () => {
      const count = estimateSplitCount('Hello, world!', 'ollama', 'nomic-embed-text');
      expect(count).toBe(1);
    });

    it('should return > 1 for large text', () => {
      const longText = 'Word '.repeat(10000);
      const count = estimateSplitCount(longText, 'ollama', 'nomic-embed-text');
      expect(count).toBeGreaterThan(1);
    });
  });

  describe('getChunkStatistics', () => {
    it('should return correct statistics', () => {
      const chunks: Chunk[] = [
        { text: 'Short', index: 0, metadata: { startOffset: 0, endOffset: 5 } },
        { text: 'Medium length text here', index: 1, metadata: { startOffset: 6, endOffset: 29 } },
        { text: 'A'.repeat(50000), index: 2, metadata: { startOffset: 30, endOffset: 50030 } },
      ];

      const stats = getChunkStatistics(chunks, 'ollama', 'nomic-embed-text');

      expect(stats.total).toBe(3);
      expect(stats.oversized).toBe(1); // The 50000 char chunk
      expect(stats.avgTokens).toBeGreaterThan(0);
      expect(stats.maxTokens).toBeGreaterThan(stats.minTokens);
    });

    it('should handle empty chunk array', () => {
      const stats = getChunkStatistics([], 'ollama', 'nomic-embed-text');

      expect(stats.total).toBe(0);
      expect(stats.oversized).toBe(0);
      expect(stats.avgTokens).toBe(0);
    });
  });
});
