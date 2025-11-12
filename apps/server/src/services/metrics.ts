import type { FastifyInstance } from 'fastify';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

const registry = new Registry();
let initialized = false;

const searchLatencyHistogram = new Histogram({
  name: 'search_latency_ms',
  help: 'Latency for smart search responses',
  buckets: [25, 50, 75, 100, 150, 200, 300, 400, 600, 800, 1200],
  labelNames: ['mode', 'reranked', 'source'],
  registers: [registry],
});

const cacheCounter = new Counter({
  name: 'search_cache_events_total',
  help: 'Cache events for search responses',
  labelNames: ['event', 'layer'],
  registers: [registry],
});

const embeddingCounter = new Counter({
  name: 'embedding_requests_total',
  help: 'Embedding requests grouped by provider and cache hit',
  labelNames: ['provider', 'cached'],
  registers: [registry],
});

const embeddingLatency = new Histogram({
  name: 'embedding_latency_ms',
  help: 'Latency for embedding providers',
  buckets: [20, 50, 75, 100, 150, 200, 400, 800],
  labelNames: ['provider'],
  registers: [registry],
});

const rerankLatency = new Histogram({
  name: 'rerank_latency_ms',
  help: 'Latency for reranking providers',
  buckets: [20, 50, 75, 100, 150, 200, 400],
  labelNames: ['provider'],
  registers: [registry],
});

export function initializeMetrics(): void {
  if (initialized) {
    return;
  }

  collectDefaultMetrics({ register: registry });
  initialized = true;
}

export async function registerMetricsRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/metrics', async (_, reply) => {
    reply.header('Content-Type', registry.contentType);
    return registry.metrics();
  });
}

export function observeSearchLatency(options: {
  mode: 'vector' | 'hybrid';
  reranked: boolean;
  source: 'live' | 'cache';
  durationMs: number;
}): void {
  searchLatencyHistogram.observe(
    {
      mode: options.mode,
      reranked: options.reranked ? 'yes' : 'no',
      source: options.source,
    },
    options.durationMs
  );
}

export function markCacheEvent(event: 'hit' | 'miss' | 'store', layer: 'memory' | 'redis'): void {
  cacheCounter.inc({ event, layer });
}

export function trackEmbeddingRequest(provider: string, cached: boolean): void {
  embeddingCounter.inc({ provider, cached: cached ? 'yes' : 'no' });
}

export function observeEmbeddingLatency(provider: string, durationMs: number): void {
  embeddingLatency.observe({ provider }, durationMs);
}

export function observeRerankLatency(provider: string, durationMs: number): void {
  rerankLatency.observe({ provider }, durationMs);
}
