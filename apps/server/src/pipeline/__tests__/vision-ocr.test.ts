import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateVisionOCRCost, isVisionOCREnabled } from '../vision-ocr.js';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
      },
    })),
  };
});

// Mock pdf-to-img
vi.mock('pdf-to-img', () => ({
  pdf: vi.fn(),
}));

describe('vision-ocr', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('isVisionOCREnabled', () => {
    it('returns false by default (explicit opt-in)', () => {
      process.env.VISION_OCR_ENABLED = undefined;
      expect(isVisionOCREnabled()).toBe(false);
    });

    it('returns true when VISION_OCR_ENABLED=true', () => {
      process.env.VISION_OCR_ENABLED = 'true';
      expect(isVisionOCREnabled()).toBe(true);
    });

    it('returns false for any non-true value', () => {
      process.env.VISION_OCR_ENABLED = 'false';
      expect(isVisionOCREnabled()).toBe(false);

      process.env.VISION_OCR_ENABLED = 'flase';
      expect(isVisionOCREnabled()).toBe(false);
    });
  });

  describe('calculateVisionOCRCost', () => {
    it('calculates cost for claude-3-5-haiku-20241022', () => {
      const inputTokens = 10000; // 10K input tokens
      const outputTokens = 5000; // 5K output tokens

      const cost = calculateVisionOCRCost(inputTokens, outputTokens, 'claude-3-5-haiku-20241022');

      // Input: 10 * 0.0008 = 0.008
      // Output: 5 * 0.004 = 0.02
      // Total: 0.028
      expect(cost).toBeCloseTo(0.028, 4);
    });

    it('calculates cost for claude-3-5-sonnet-20241022', () => {
      const inputTokens = 10000;
      const outputTokens = 5000;

      const cost = calculateVisionOCRCost(inputTokens, outputTokens, 'claude-3-5-sonnet-20241022');

      // Input: 10 * 0.003 = 0.03
      // Output: 5 * 0.015 = 0.075
      // Total: 0.105
      expect(cost).toBeCloseTo(0.105, 4);
    });

    it('uses default model when model not specified', () => {
      const inputTokens = 1000;
      const outputTokens = 500;

      const cost = calculateVisionOCRCost(inputTokens, outputTokens);

      // Default is claude-3-5-haiku-20241022
      // Input: 1 * 0.0008 = 0.0008
      // Output: 0.5 * 0.004 = 0.002
      // Total: 0.0028
      expect(cost).toBeCloseTo(0.0028, 4);
    });

    it('falls back to haiku pricing for unknown model', () => {
      const inputTokens = 1000;
      const outputTokens = 500;

      const cost = calculateVisionOCRCost(inputTokens, outputTokens, 'unknown-model');

      // Falls back to claude-3-5-haiku-20241022 pricing
      expect(cost).toBeCloseTo(0.0028, 4);
    });

    it('handles zero tokens', () => {
      const cost = calculateVisionOCRCost(0, 0);
      expect(cost).toBe(0);
    });

    it('handles large token counts', () => {
      const inputTokens = 100000; // 100K tokens (typical for multi-page PDF)
      const outputTokens = 50000;

      const cost = calculateVisionOCRCost(inputTokens, outputTokens, 'claude-3-5-haiku-20241022');

      // Input: 100 * 0.0008 = 0.08
      // Output: 50 * 0.004 = 0.2
      // Total: 0.28
      expect(cost).toBeCloseTo(0.28, 4);
    });
  });

  describe('extractTextWithVision', () => {
    it('throws when Vision OCR is disabled', async () => {
      process.env.VISION_OCR_ENABLED = 'false';

      // Re-import to get fresh module with updated env
      const { extractTextWithVision } = await import('../vision-ocr.js');

      await expect(extractTextWithVision(Buffer.from('test'))).rejects.toThrow(
        'Vision OCR is disabled'
      );
    });
  });
});

describe('vision-ocr integration scenarios', () => {
  describe('cost estimation for typical PDFs', () => {
    it('estimates cost for 10-page scanned PDF', () => {
      // Typical 10-page PDF:
      // - ~13,340 image tokens per page (1024x1024 tiles)
      // - ~500 output tokens per page
      const pagesCount = 10;
      const imageTokensPerPage = 13340;
      const outputTokensPerPage = 500;

      const totalInputTokens = pagesCount * imageTokensPerPage;
      const totalOutputTokens = pagesCount * outputTokensPerPage;

      const cost = calculateVisionOCRCost(totalInputTokens, totalOutputTokens);

      // Should be around $0.03 for 10 pages with Haiku
      expect(cost).toBeLessThan(0.15);
      expect(cost).toBeGreaterThan(0.01);
    });

    it('estimates cost for 50-page scanned PDF', () => {
      const pagesCount = 50;
      const imageTokensPerPage = 13340;
      const outputTokensPerPage = 500;

      const totalInputTokens = pagesCount * imageTokensPerPage;
      const totalOutputTokens = pagesCount * outputTokensPerPage;

      const cost = calculateVisionOCRCost(totalInputTokens, totalOutputTokens);

      // Should be around $0.15 for 50 pages with Haiku
      expect(cost).toBeLessThan(0.75);
      expect(cost).toBeGreaterThan(0.05);
    });
  });
});
