import { afterEach, describe, expect, it } from 'vitest';
import {
  deriveContextFromMetadata,
  getProviderConfig,
  isEmbeddingProvider,
  selectEmbeddingProvider,
} from '../embedding-router.js';

describe('embedding-router', () => {
  afterEach(() => {
    process.env.CODE_EMBEDDING_PROVIDER = undefined;
    process.env.DOC_EMBEDDING_PROVIDER = undefined;
  });

  it('prefers voyage for explicit code context', () => {
    const config = selectEmbeddingProvider('fn main() {}', { type: 'code' });
    expect(config.provider).toBe('voyage');
    expect(config.model).toBe('voyage-code-2');
  });

  it('auto-detects code content from heuristics', () => {
    const config = selectEmbeddingProvider('import { useState } from "react";');
    expect(config.provider).toBe('voyage');
  });

  it('respects environment override for docs provider', () => {
    process.env.DOC_EMBEDDING_PROVIDER = 'openai';
    const config = selectEmbeddingProvider('Regular documentation text');
    expect(config.provider).toBe('openai');
    expect(config.dimensions).toBe(1536);
  });

  it('falls back to default when override is invalid', () => {
    const config = getProviderConfig('invalid-provider', 'ollama');
    expect(config.provider).toBe('ollama');
  });

  it('derives personal context from metadata', () => {
    const context = deriveContextFromMetadata({
      doc_type: 'personal_writing',
      language: 'markdown',
    });
    expect(context).toEqual({ type: 'personal', language: 'markdown' });
  });

  it('isEmbeddingProvider guards supported values', () => {
    expect(isEmbeddingProvider('ollama')).toBe(true);
    expect(isEmbeddingProvider('voyage')).toBe(true);
    expect(isEmbeddingProvider('some-other')).toBe(false);
  });
});
