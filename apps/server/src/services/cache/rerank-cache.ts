import crypto from 'node:crypto';
import { LRUCache } from 'lru-cache';
import { markCacheEvent } from '../metrics.js';
import { getRedisClient } from '../redis.js';

const namespace = process.env.RERANK_CACHE_NAMESPACE ?? 'rerank:v1';
const ttlSeconds = Number.parseInt(process.env.RERANK_CACHE_TTL_SECONDS ?? '', 10) || 5 * 60;
const ttlMs = ttlSeconds * 1000;
const maxItems = Number.parseInt(process.env.RERANK_CACHE_MAX_ITEMS ?? '', 10) || 500;

const memoryCache = new LRUCache<string, Record<string, unknown>>({
  max: maxItems,
  ttl: ttlMs,
  updateAgeOnGet: true,
});

export interface RerankCacheKeyInput {
  query: string;
  provider: string;
  signatures: string[];
  documents: string[];
}

export function createRerankCacheKey(input: RerankCacheKeyInput): string {
  const docHashes = input.documents.map((doc) =>
    crypto.createHash('sha1').update(doc).digest('hex')
  );

  const payload = {
    q: input.query.trim().toLowerCase(),
    provider: input.provider,
    signatures: input.signatures,
    docs: docHashes,
  };

  const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return `${namespace}:${hash}`;
}

export async function getCachedRerankResults<T>(key: string): Promise<T | null> {
  const cached = memoryCache.get(key);
  if (cached) {
    markCacheEvent('hit', 'memory');
    return cached as T;
  }
  markCacheEvent('miss', 'memory');

  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  try {
    const raw = await redis.get(key);
    if (!raw) {
      markCacheEvent('miss', 'redis');
      return null;
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    memoryCache.set(key, parsed);
    markCacheEvent('hit', 'redis');
    return parsed as T;
  } catch (error) {
    console.warn('[cache] failed to read rerank cache from redis', error);
    return null;
  }
}

export async function setCachedRerankResults<T>(key: string, payload: T): Promise<void> {
  memoryCache.set(key, payload as Record<string, unknown>);
  markCacheEvent('store', 'memory');

  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  try {
    await redis.set(key, JSON.stringify(payload), 'EX', ttlSeconds);
    markCacheEvent('store', 'redis');
  } catch (error) {
    console.warn('[cache] failed to persist rerank cache in redis', error);
  }
}
