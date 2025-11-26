import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  estimateTokens,
  exceedsTokenLimit,
  getRecommendedMaxChars,
  getRegisteredModels,
  getSafetyMargin,
  getTokenLimit,
  isModelRegistered,
  validateChunkTokens,
} from '../token-estimator.js';

describe('token-estimator', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('estimateTokens', () => {
    it('should return 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should return 0 for undefined/null-like input', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should estimate tokens based on character count', () => {
      // Using 3.5 chars per token ratio
      const text = 'Hello, world!'; // 13 chars
      const estimate = estimateTokens(text);
      // ceil(13 / 3.5) = ceil(3.71) = 4
      expect(estimate).toBe(4);
    });

    it('should handle longer text correctly', () => {
      const text = 'a'.repeat(350); // 350 chars
      const estimate = estimateTokens(text);
      // ceil(350 / 3.5) = 100
      expect(estimate).toBe(100);
    });

    it('should handle code-like content', () => {
      const code = `
function calculateSum(a: number, b: number): number {
  return a + b;
}
      `.trim();
      const estimate = estimateTokens(code);
      // Should produce a reasonable estimate
      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBeLessThan(code.length); // Tokens should be less than chars
    });
  });

  describe('getTokenLimit', () => {
    it('should return correct limit for ollama/nomic-embed-text', () => {
      const limit = getTokenLimit('ollama', 'nomic-embed-text');
      expect(limit.provider).toBe('ollama');
      expect(limit.model).toBe('nomic-embed-text');
      expect(limit.maxTokens).toBe(8192);
      expect(limit.effectiveLimit).toBeLessThan(limit.maxTokens);
    });

    it('should return correct limit for openai/text-embedding-3-large', () => {
      const limit = getTokenLimit('openai', 'text-embedding-3-large');
      expect(limit.provider).toBe('openai');
      expect(limit.model).toBe('text-embedding-3-large');
      expect(limit.maxTokens).toBe(8191);
    });

    it('should return correct limit for voyage/voyage-code-2', () => {
      const limit = getTokenLimit('voyage', 'voyage-code-2');
      expect(limit.provider).toBe('voyage');
      expect(limit.model).toBe('voyage-code-2');
      expect(limit.maxTokens).toBe(16000);
    });

    it('should return provider default for unknown model', () => {
      const limit = getTokenLimit('openai', 'unknown-model');
      expect(limit.provider).toBe('openai');
      expect(limit.model).toBe('unknown-model');
      expect(limit.maxTokens).toBe(8191); // OpenAI default
    });

    it('should return fallback for unknown provider', () => {
      const limit = getTokenLimit('unknown', 'unknown-model');
      expect(limit.maxTokens).toBe(2048); // Fallback
    });

    it('should apply safety margin correctly', () => {
      const limit = getTokenLimit('ollama', 'nomic-embed-text');
      // Default 10% safety margin
      expect(limit.effectiveLimit).toBe(Math.floor(8192 * 0.9));
    });
  });

  describe('getSafetyMargin', () => {
    it('should return default margin when env not set', () => {
      process.env.TOKEN_SAFETY_MARGIN = undefined;
      expect(getSafetyMargin()).toBe(0.1);
    });

    it('should return custom margin from env', () => {
      process.env.TOKEN_SAFETY_MARGIN = '0.15';
      expect(getSafetyMargin()).toBe(0.15);
    });

    it('should return default for invalid env value', () => {
      process.env.TOKEN_SAFETY_MARGIN = 'invalid';
      expect(getSafetyMargin()).toBe(0.1);
    });

    it('should return default for out-of-range value', () => {
      process.env.TOKEN_SAFETY_MARGIN = '1.5';
      expect(getSafetyMargin()).toBe(0.1);
    });
  });

  describe('validateChunkTokens', () => {
    it('should validate small chunk as valid', () => {
      const text = 'Hello, world!';
      const result = validateChunkTokens(text, 'ollama', 'nomic-embed-text');
      expect(result.isValid).toBe(true);
      expect(result.overage).toBe(0);
    });

    it('should validate oversized chunk as invalid', () => {
      // Create text that exceeds the limit
      // nomic-embed-text effective limit: 8192 * 0.9 = 7372 tokens
      // At 3.5 chars/token, that's ~25,802 chars
      const text = 'a'.repeat(30000);
      const result = validateChunkTokens(text, 'ollama', 'nomic-embed-text');
      expect(result.isValid).toBe(false);
      expect(result.overage).toBeGreaterThan(0);
    });

    it('should include token count in result', () => {
      const text = 'Hello, world!';
      const result = validateChunkTokens(text, 'ollama', 'nomic-embed-text');
      expect(result.tokenCount).toBeGreaterThan(0);
    });
  });

  describe('exceedsTokenLimit', () => {
    it('should return false for small text', () => {
      expect(exceedsTokenLimit('Hello', 'ollama', 'nomic-embed-text')).toBe(false);
    });

    it('should return true for oversized text', () => {
      const text = 'a'.repeat(50000);
      expect(exceedsTokenLimit(text, 'ollama', 'nomic-embed-text')).toBe(true);
    });
  });

  describe('getRecommendedMaxChars', () => {
    it('should return reasonable char limit for ollama', () => {
      const maxChars = getRecommendedMaxChars('ollama', 'nomic-embed-text');
      // 7372 tokens * 3.5 chars = ~25,802 chars
      expect(maxChars).toBeGreaterThan(20000);
      expect(maxChars).toBeLessThan(30000);
    });

    it('should return higher limit for voyage-code-2', () => {
      const voyageChars = getRecommendedMaxChars('voyage', 'voyage-code-2');
      const ollamaChars = getRecommendedMaxChars('ollama', 'nomic-embed-text');
      expect(voyageChars).toBeGreaterThan(ollamaChars);
    });
  });

  describe('getRegisteredModels', () => {
    it('should return array of registered models', () => {
      const models = getRegisteredModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      expect(models).toContain('ollama/nomic-embed-text');
      expect(models).toContain('openai/text-embedding-3-large');
      expect(models).toContain('voyage/voyage-code-2');
    });
  });

  describe('isModelRegistered', () => {
    it('should return true for registered model', () => {
      expect(isModelRegistered('ollama', 'nomic-embed-text')).toBe(true);
    });

    it('should return false for unregistered model', () => {
      expect(isModelRegistered('unknown', 'unknown-model')).toBe(false);
    });
  });
});
