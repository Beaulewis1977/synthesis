import crypto from 'node:crypto';
import { LRUCache } from 'lru-cache';
import { markCacheEvent } from '../metrics.js';
import { getRedisClient } from '../redis.js';

const namespace = process.env.SEARCH_CACHE_NAMESPACE ?? 'search:v1';
const ttlSeconds = Number.parseInt(process.env.SEARCH_CACHE_TTL_SECONDS ?? '', 10) || 30 * 60;
const ttlMs = ttlSeconds * 1000;
const maxItems = Number.parseInt(process.env.SEARCH_CACHE_MAX_ITEMS ?? '', 10) || 500;

const memoryCache = new LRUCache<string, Record<string, unknown>>({
  max: maxItems,
  ttl: ttlMs,
  updateAgeOnGet: true,
});

export interface SearchCacheKeyInput {
  query: string;
  collectionId: string;
  mode: 'vector' | 'hybrid';
  rerank: boolean;
  rerankProvider?: string | null;
  rerankTopK?: number;
  rerankMaxCandidates?: number;
  topK?: number;
  minSimilarity?: number | null;
  techStack?: string[] | null;
  // GPT Phase 1: Feature-aware filtering
  featureTags?: string[] | null;
  platform?: string | null;
  usageTier?: string | null;
  weights?: { vector?: number; bm25?: number };
  page?: number;
  pageSize?: number;
  includeRelatedFiles?: boolean;
  /** MMR diversification enabled */
  mmrEnabled?: boolean;
  /** MMR lambda parameter (0.0-1.0) */
  mmrLambda?: number;
  // GPT Phase 2: Graph expansion
  /** Enable graph-based context expansion */
  expandWithGraph?: boolean;
  /** Maximum depth for graph traversal */
  graphMaxDepth?: number;
  /** Maximum nodes to visit during expansion */
  graphMaxNodes?: number;
}

export function createSearchCacheKey(input: SearchCacheKeyInput): string {
  const sortableStack = input.techStack ? [...input.techStack].sort() : null;
  // GPT Phase 1: Sort feature tags for consistent cache keys
  const sortableFeatureTags = input.featureTags ? [...input.featureTags].sort() : null;
  const payload = {
    q: input.query.trim().toLowerCase(),
    collectionId: input.collectionId,
    mode: input.mode,
    rerank: input.rerank,
    rerankProvider: input.rerankProvider ?? null,
    rerankTopK: input.rerankTopK ?? null,
    rerankMaxCandidates: input.rerankMaxCandidates ?? null,
    topK: input.topK ?? null,
    minSimilarity: input.minSimilarity ?? null,
    techStack: sortableStack,
    // GPT Phase 1: Feature-aware filtering
    featureTags: sortableFeatureTags,
    platform: input.platform ?? null,
    usageTier: input.usageTier ?? null,
    weights: input.weights ?? null,
    page: input.page ?? 1,
    pageSize: input.pageSize ?? null,
    includeRelatedFiles: input.includeRelatedFiles ?? false,
    mmrEnabled: input.mmrEnabled ?? false,
    mmrLambda: input.mmrLambda ?? null,
    // GPT Phase 2: Graph expansion
    expandWithGraph: input.expandWithGraph ?? false,
    graphMaxDepth: input.graphMaxDepth ?? null,
    graphMaxNodes: input.graphMaxNodes ?? null,
  };

  const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return `${namespace}:${hash}`;
}

export async function getCachedSearchResponse<T>(key: string): Promise<T | null> {
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
    console.warn('[cache] failed to read from redis', error);
    return null;
  }
}

export async function setCachedSearchResponse<T>(key: string, payload: T): Promise<void> {
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
    console.warn('[cache] failed to persist search result in redis', error);
  }
}

export async function invalidateSearchCache(pattern: string): Promise<void> {
  // Clearing the in-memory cache is intentional: we currently only support
  // pattern-based invalidation for Redis. Keeping the memory cache in sync
  // requires either key indexing or duplicate pattern matching, which we defer
  // until we have concrete invalidation use cases.
  memoryCache.clear();

  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  try {
    let scanCursor = 0;
    do {
      const [nextCursor, keys] = await redis.scan(scanCursor, 'MATCH', pattern, 'COUNT', 100);
      scanCursor = Number.parseInt(nextCursor, 10);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (scanCursor !== 0);
  } catch (error) {
    console.warn('[cache] failed to invalidate search cache', error);
  }
}
