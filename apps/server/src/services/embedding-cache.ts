import crypto from 'node:crypto';
import { LRUCache } from 'lru-cache';
import type { ContentContext, EmbeddingProvider } from './embedding-router.js';

interface CachedEmbedding {
  embedding: number[];
  provider: EmbeddingProvider;
  model: string;
  dimensions: number;
}

const ttlMs = Number.parseInt(process.env.EMBEDDING_CACHE_TTL_MS ?? '', 10) || 15 * 60 * 1000;
const maxSize = Number.parseInt(process.env.EMBEDDING_CACHE_MAX_ITEMS ?? '', 10) || 1000;

const cache = new LRUCache<string, CachedEmbedding>({
  max: maxSize,
  ttl: ttlMs,
  updateAgeOnGet: true,
});

export function buildEmbeddingCacheKey(
  text: string,
  provider: EmbeddingProvider,
  model: string,
  context?: ContentContext
): string {
  const normalized = {
    provider,
    model,
    language: context?.language ?? null,
    type: context?.type ?? null,
    hash: crypto.createHash('sha256').update(text.trim()).digest('hex'),
  };

  return JSON.stringify(normalized);
}

export function getCachedEmbedding(key: string): CachedEmbedding | null {
  const cached = cache.get(key);
  if (!cached) {
    return null;
  }

  return {
    ...cached,
    embedding: [...cached.embedding],
  };
}

export function setCachedEmbedding(key: string, payload: CachedEmbedding): void {
  cache.set(key, {
    ...payload,
    embedding: [...payload.embedding],
  });
}
