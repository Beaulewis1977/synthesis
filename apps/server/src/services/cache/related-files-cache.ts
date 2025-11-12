import { LRUCache } from 'lru-cache';
import { markCacheEvent } from '../metrics.js';
import { getRedisClient } from '../redis.js';

const namespace = process.env.RELATED_FILES_CACHE_NAMESPACE ?? 'related-files:v1';
const ttlSeconds =
  Number.parseInt(process.env.RELATED_FILES_CACHE_TTL_SECONDS ?? '', 10) || 30 * 60;
const ttlMs = ttlSeconds * 1000;
const maxItems = Number.parseInt(process.env.RELATED_FILES_CACHE_MAX_ITEMS ?? '', 10) || 1000;

const memoryCache = new LRUCache<string, Record<string, unknown>>({
  max: maxItems,
  ttl: ttlMs,
  updateAgeOnGet: true,
});

export function toRelatedFilesCacheKey(collectionId: string, filePath: string): string {
  return `${namespace}:${collectionId}:${filePath}`;
}

export async function getCachedRelatedFiles<T>(key: string): Promise<T | null> {
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
    console.warn('[cache] failed to read related-files cache from redis', error);
    return null;
  }
}

export async function setCachedRelatedFiles<T>(key: string, payload: T): Promise<void> {
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
    console.warn('[cache] failed to persist related-files cache in redis', error);
  }
}

export async function invalidateRelatedFilesCache(key: string): Promise<void> {
  memoryCache.delete(key);

  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  try {
    await redis.del(key);
  } catch (error) {
    console.warn('[cache] failed to invalidate related-files cache', error);
  }
}
