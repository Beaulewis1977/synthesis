import { afterEach, describe, expect, it } from 'vitest';
import {
  MODEL_DIMENSIONS,
  deriveContextFromMetadata,
  getModelDimensions,
  getProviderConfig,
  isEmbeddingProvider,
  selectEmbeddingProvider,
  validate1024Dimension,
} from '../embedding-router.js';

describe('embedding-router', () => {
  afterEach(() => {
    process.env.CODE_EMBEDDING_PROVIDER = undefined;
    process.env.DOC_EMBEDDING_PROVIDER = undefined;
    process.env.WRITING_EMBEDDING_PROVIDER = undefined;
  });

  describe('selectEmbeddingProvider', () => {
    it('prefers voyage for explicit code context', () => {
      const config = selectEmbeddingProvider('fn main() {}', { type: 'code' });
      expect(config.provider).toBe('voyage');
      expect(config.model).toBe('voyage-3-large');
      expect(config.dimensions).toBe(1024);
    });

    it('auto-detects code content from heuristics', () => {
      const config = selectEmbeddingProvider('import { useState } from "react";');
      expect(config.provider).toBe('voyage');
      expect(config.dimensions).toBe(1024);
    });

    it('respects environment override for docs provider', () => {
      process.env.DOC_EMBEDDING_PROVIDER = 'openai';
      const config = selectEmbeddingProvider('Regular documentation text');
      expect(config.provider).toBe('openai');
      expect(config.dimensions).toBe(1024);
    });

    it('falls back to ollama for general documentation', () => {
      const config = selectEmbeddingProvider('Regular documentation text');
      expect(config.provider).toBe('ollama');
      expect(config.model).toBe('mxbai-embed-large');
      expect(config.dimensions).toBe(1024);
    });

    it('uses openai for personal/writing context', () => {
      const config = selectEmbeddingProvider('My personal journal entry', { type: 'personal' });
      expect(config.provider).toBe('openai');
      expect(config.dimensions).toBe(1024);
    });

    it('uses openai for personal collection flag', () => {
      const config = selectEmbeddingProvider('Some content', { isPersonalCollection: true });
      expect(config.provider).toBe('openai');
      expect(config.dimensions).toBe(1024);
    });
  });

  describe('getProviderConfig', () => {
    it('falls back to default when override is invalid', () => {
      const config = getProviderConfig('invalid-provider', 'ollama');
      expect(config.provider).toBe('ollama');
      expect(config.dimensions).toBe(1024);
    });

    it('returns ollama config with mxbai-embed-large', () => {
      const config = getProviderConfig('ollama');
      expect(config.provider).toBe('ollama');
      expect(config.model).toBe('mxbai-embed-large');
      expect(config.dimensions).toBe(1024);
    });

    it('returns voyage config with voyage-3-large', () => {
      const config = getProviderConfig('voyage');
      expect(config.provider).toBe('voyage');
      expect(config.model).toBe('voyage-3-large');
      expect(config.dimensions).toBe(1024);
    });

    it('returns openai config with text-embedding-3-large', () => {
      const config = getProviderConfig('openai');
      expect(config.provider).toBe('openai');
      expect(config.model).toBe('text-embedding-3-large');
      expect(config.dimensions).toBe(1024);
    });

    it('returns cohere config with embed-v4.0', () => {
      const config = getProviderConfig('cohere');
      expect(config.provider).toBe('cohere');
      expect(config.model).toBe('embed-v4.0');
      expect(config.dimensions).toBe(1024);
    });

    it('returns fallback config when provider is undefined', () => {
      const config = getProviderConfig(undefined, 'voyage');
      expect(config.provider).toBe('voyage');
      expect(config.dimensions).toBe(1024);
    });
  });

  describe('isEmbeddingProvider', () => {
    it('guards supported values', () => {
      expect(isEmbeddingProvider('ollama')).toBe(true);
      expect(isEmbeddingProvider('voyage')).toBe(true);
      expect(isEmbeddingProvider('openai')).toBe(true);
      expect(isEmbeddingProvider('cohere')).toBe(true);
      expect(isEmbeddingProvider('some-other')).toBe(false);
      expect(isEmbeddingProvider('google')).toBe(false);
      expect(isEmbeddingProvider(undefined)).toBe(false);
    });
  });

  describe('deriveContextFromMetadata', () => {
    it('derives personal context from metadata', () => {
      const context = deriveContextFromMetadata({
        doc_type: 'personal_writing',
        language: 'markdown',
      });
      expect(context).toEqual({ type: 'personal', language: 'markdown' });
    });

    it('derives code context from code_sample doc_type', () => {
      const context = deriveContextFromMetadata({
        doc_type: 'code_sample',
        language: 'typescript',
      });
      expect(context).toEqual({ type: 'code', language: 'typescript' });
    });

    it('derives code context from build_plan doc_type', () => {
      const context = deriveContextFromMetadata({
        doc_type: 'build_plan',
      });
      expect(context).toEqual({ type: 'code', language: undefined });
    });

    it('derives code context from framework presence', () => {
      const context = deriveContextFromMetadata({
        framework: 'flutter',
        language: 'dart',
      });
      expect(context).toEqual({ type: 'code', language: 'dart' });
    });

    it('derives docs context from language only', () => {
      const context = deriveContextFromMetadata({
        language: 'markdown',
      });
      expect(context).toEqual({ type: 'docs', language: 'markdown' });
    });

    it('returns undefined for empty metadata', () => {
      expect(deriveContextFromMetadata(null)).toBeUndefined();
      expect(deriveContextFromMetadata(undefined)).toBeUndefined();
      expect(deriveContextFromMetadata({})).toBeUndefined();
    });
  });

  describe('validate1024Dimension', () => {
    it('passes for supported 1024-dimension models', () => {
      expect(() => validate1024Dimension('mxbai-embed-large')).not.toThrow();
      expect(() => validate1024Dimension('voyage-code-3')).not.toThrow();
      expect(() => validate1024Dimension('voyage-3-large')).not.toThrow();
      expect(() => validate1024Dimension('voyage-3.5')).not.toThrow();
      expect(() => validate1024Dimension('text-embedding-3-large')).not.toThrow();
      expect(() => validate1024Dimension('text-embedding-3-small')).not.toThrow();
      expect(() => validate1024Dimension('embed-v4.0')).not.toThrow();
      expect(() => validate1024Dimension('embed-english-v3.0')).not.toThrow();
    });

    it('throws for unsupported models', () => {
      expect(() => validate1024Dimension('unknown-model')).toThrow(
        /Model 'unknown-model' is not supported/
      );
      expect(() => validate1024Dimension('nomic-embed-text')).toThrow(/not supported/);
      expect(() => validate1024Dimension('text-embedding-gecko')).toThrow(/not supported/);
    });

    it('includes supported models in error message', () => {
      try {
        validate1024Dimension('bad-model');
      } catch (e) {
        const error = e as Error;
        expect(error.message).toContain('mxbai-embed-large');
        expect(error.message).toContain('voyage-code-3');
        expect(error.message).toContain('text-embedding-3-large');
      }
    });
  });

  describe('getModelDimensions', () => {
    it('returns 1024 for all supported models', () => {
      expect(getModelDimensions('mxbai-embed-large')).toBe(1024);
      expect(getModelDimensions('voyage-code-3')).toBe(1024);
      expect(getModelDimensions('voyage-3-large')).toBe(1024);
      expect(getModelDimensions('text-embedding-3-large')).toBe(1024);
      expect(getModelDimensions('text-embedding-3-small')).toBe(1024);
      expect(getModelDimensions('embed-v4.0')).toBe(1024);
    });

    it('falls back to provider default for unknown models', () => {
      expect(getModelDimensions('unknown-model', 'ollama')).toBe(1024);
      expect(getModelDimensions('unknown-model', 'voyage')).toBe(1024);
      expect(getModelDimensions('unknown-model', 'openai')).toBe(1024);
      expect(getModelDimensions('unknown-model', 'cohere')).toBe(1024);
    });

    it('returns 1024 as ultimate fallback', () => {
      expect(getModelDimensions('totally-unknown')).toBe(1024);
    });
  });

  describe('MODEL_DIMENSIONS', () => {
    it('all models are 1024-dimensional', () => {
      for (const [model, dims] of Object.entries(MODEL_DIMENSIONS)) {
        expect(dims).toBe(1024);
      }
    });

    it('includes expected model families', () => {
      // Voyage models
      expect(MODEL_DIMENSIONS['voyage-code-3']).toBeDefined();
      expect(MODEL_DIMENSIONS['voyage-3-large']).toBeDefined();
      expect(MODEL_DIMENSIONS['voyage-3.5']).toBeDefined();
      expect(MODEL_DIMENSIONS['voyage-3.5-lite']).toBeDefined();

      // OpenAI models
      expect(MODEL_DIMENSIONS['text-embedding-3-large']).toBeDefined();
      expect(MODEL_DIMENSIONS['text-embedding-3-small']).toBeDefined();
      expect(MODEL_DIMENSIONS['text-embedding-ada-002']).toBeDefined();

      // Cohere models
      expect(MODEL_DIMENSIONS['embed-v4.0']).toBeDefined();
      expect(MODEL_DIMENSIONS['embed-english-v3.0']).toBeDefined();
      expect(MODEL_DIMENSIONS['embed-multilingual-v3.0']).toBeDefined();

      // Ollama models
      expect(MODEL_DIMENSIONS['mxbai-embed-large']).toBeDefined();
    });

    it('does not include deprecated/removed models', () => {
      // No Google models
      expect(MODEL_DIMENSIONS['text-embedding-gecko']).toBeUndefined();
      expect(MODEL_DIMENSIONS['text-embedding-004']).toBeUndefined();

      // No 768-dimension models
      expect(MODEL_DIMENSIONS['nomic-embed-text']).toBeUndefined();

      // No old voyage models that had different dimensions
      expect(MODEL_DIMENSIONS['voyage-code-2']).toBeUndefined();
    });
  });
});
