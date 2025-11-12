import { performance } from 'node:perf_hooks';
import { getPool } from '@synthesis/db';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  createSearchCacheKey,
  getCachedSearchResponse,
  setCachedSearchResponse,
} from '../services/cache/search-cache.js';
import { observeSearchLatency } from '../services/metrics.js';
import { createSnippet } from '../services/snippet.js';
import { type SmartSearchResponse, smartSearch } from '../services/search.js';

interface SearchRouteResponse {
  query: string;
  results: Array<{
    id: number;
    snippet: string;
    similarity: number;
    vector_score?: number | null;
    bm25_score?: number | null;
    fused_score?: number | null;
    source?: 'vector' | 'bm25' | 'both';
    doc_id: string;
    doc_title: string | null;
    source_url: string | null;
    citation: {
      title: string | null;
      page?: string | number | null;
      section?: string | null;
    };
    metadata: Record<string, unknown> | null;
    related_files: unknown | null;
  }>;
  total_results: number;
  search_time_ms: number;
  metadata: {
    search_mode: 'vector' | 'hybrid';
    vector_count?: number | null;
    bm25_count?: number | null;
    fused_count?: number | null;
    embedding_provider?: string | null;
    reranked: boolean;
    rerank_provider: string | null;
    pagination?: {
      page: number;
      page_size: number;
      total_results: number;
      total_pages: number;
    };
  };
}

const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = (() => {
  const envValue = Number.parseInt(process.env.SEARCH_PAGE_SIZE ?? '', 10);
  if (!Number.isFinite(envValue)) {
    return 10;
  }
  return Math.max(MIN_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, envValue));
})();

const SearchBodySchema = z
  .object({
    query: z.string().min(1, 'query must not be empty'),
    collection_id: z.string().uuid().optional(),
    collectionId: z.string().uuid().optional(),
    top_k: z.number().int().min(1).max(50).optional(),
    topK: z.number().int().min(1).max(50).optional(),
    min_similarity: z.number().min(0).max(1).optional(),
    minSimilarity: z.number().min(0).max(1).optional(),
    search_mode: z.enum(['vector', 'hybrid']).optional(),
    searchMode: z.enum(['vector', 'hybrid']).optional(),
    rerank: z.boolean().optional(),
    rerank_top_k: z.number().int().min(1).max(50).optional(),
    rerankTopK: z.number().int().min(1).max(50).optional(),
    rerank_max_candidates: z.number().int().min(1).max(50).optional(),
    rerankMaxCandidates: z.number().int().min(1).max(50).optional(),
    rerank_provider: z.enum(['cohere', 'bge', 'none']).optional(),
    rerankProvider: z.enum(['cohere', 'bge', 'none']).optional(),
    tech_stack: z.array(z.string()).optional(),
    page: z.number().int().min(1).optional(),
    page_size: z.number().int().min(1).max(50).optional(),
    pageSize: z.number().int().min(1).max(50).optional(),
    include_related_files: z.boolean().optional(),
    includeRelatedFiles: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Boolean(data.collection_id ?? data.collectionId), {
    message: 'collection_id is required',
    path: ['collection_id'],
  });

export const searchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/search', async (request, reply) => {
    const validation = SearchBodySchema.safeParse(request.body);

    if (!validation.success) {
      return reply.code(400).send({
        error: 'INVALID_INPUT',
        details: validation.error.issues,
      });
    }

    const {
      query,
      collectionId: camelCollectionId,
      collection_id: snakeCollectionId,
      top_k: snakeTopK,
      topK: camelTopK,
      min_similarity: snakeMinSimilarity,
      minSimilarity: camelMinSimilarity,
      search_mode: snakeSearchMode,
      searchMode: camelSearchMode,
      rerank,
      rerank_top_k: snakeRerankTopK,
      rerankTopK: camelRerankTopK,
      rerank_max_candidates: snakeRerankMax,
      rerankMaxCandidates: camelRerankMax,
      rerank_provider: snakeRerankProvider,
      rerankProvider: camelRerankProvider,
      tech_stack,
      page: requestPage,
      page_size: snakePageSize,
      pageSize: camelPageSize,
      include_related_files: snakeIncludeRelated,
      includeRelatedFiles: camelIncludeRelated,
    } = validation.data;

    const collectionId = (camelCollectionId ?? snakeCollectionId) as string;
    const topK = camelTopK ?? snakeTopK;
    const minSimilarity = camelMinSimilarity ?? snakeMinSimilarity;

    // Normalize tech_stack to lowercase for case-insensitive matching
    const techStack = tech_stack?.map((tag) => tag.toLowerCase());
    const includeRelatedFiles = camelIncludeRelated ?? snakeIncludeRelated ?? false;
    const page = normalizePage(requestPage);
    const pageSize = normalizePageSize(camelPageSize ?? snakePageSize ?? DEFAULT_PAGE_SIZE);

    // Validate and normalize SEARCH_MODE environment variable
    const envSearchMode = process.env.SEARCH_MODE?.trim().toLowerCase();
    const validatedEnvMode: 'vector' | 'hybrid' | undefined =
      envSearchMode === 'vector' || envSearchMode === 'hybrid' ? envSearchMode : undefined;

    const searchMode = camelSearchMode ?? snakeSearchMode ?? validatedEnvMode ?? 'vector';
    const rerankTopK = camelRerankTopK ?? snakeRerankTopK;
    const rerankMaxCandidates = camelRerankMax ?? snakeRerankMax;
    const rerankProvider = camelRerankProvider ?? snakeRerankProvider;

    const normalizedMinSimilarity = normalizeMinSimilarity(minSimilarity);

    const cacheKey = createSearchCacheKey({
      query,
      collectionId,
      mode: searchMode,
      rerank: rerank ?? false,
      rerankProvider,
      rerankTopK,
      rerankMaxCandidates,
      topK,
      minSimilarity: normalizedMinSimilarity,
      techStack,
      weights: undefined,
      page,
      pageSize,
      includeRelatedFiles,
    });

    const timerStart = performance.now();

    try {
      const cached = await getCachedSearchResponse<SearchRouteResponse>(cacheKey);
      if (cached) {
        observeSearchLatency({
          mode: cached.metadata.search_mode,
          reranked: cached.metadata.reranked ?? false,
          source: 'cache',
          durationMs: Math.round(performance.now() - timerStart),
        });
        return reply.header('x-cache', 'HIT').send(cached);
      }

      const result = await smartSearch(getPool(), {
        query,
        collectionId,
        topK,
        minSimilarity,
        mode: searchMode,
        rerank: rerank ?? false,
        rerankTopK,
        rerankMaxCandidates,
        rerankProvider,
        techStack,
        includeRelatedFiles,
      });

      const responsePayload = mapToRouteResponse(result);
      const pagedResponse = applyPagination(responsePayload, page, pageSize);

      await setCachedSearchResponse(cacheKey, pagedResponse);

      observeSearchLatency({
        mode: result.metadata.searchMode,
        reranked: result.metadata.reranked ?? false,
        source: 'live',
        durationMs: Math.round(performance.now() - timerStart),
      });

      return reply.header('x-cache', 'MISS').send(pagedResponse);
    } catch (error) {
      observeSearchLatency({
        mode: searchMode,
        reranked: rerank ?? false,
        source: 'live',
        durationMs: Math.round(performance.now() - timerStart),
      });
      fastify.log.error({ error }, 'Vector search failed');
      return reply.code(500).send({
        error: 'SEARCH_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
};

function mapToRouteResponse(result: SmartSearchResponse): SearchRouteResponse {
  return {
    query: result.query,
    results: result.results.map((item) => ({
      id: item.id,
      snippet: item.snippet ?? createSnippet(item.text),
      similarity: item.similarity,
      vector_score: item.vectorScore,
      bm25_score: item.bm25Score,
      fused_score: item.fusedScore,
      source: item.source,
      doc_id: item.docId,
      doc_title: item.docTitle ?? null,
      source_url: item.sourceUrl ?? null,
      citation: item.citation ?? {
        title: item.docTitle ?? null,
      },
      metadata: item.metadata ?? null,
      related_files: item.relatedFiles ?? null,
    })),
    total_results: result.totalResults,
    search_time_ms: result.searchTimeMs,
    metadata: {
      search_mode: result.metadata.searchMode,
      vector_count: result.metadata.vectorCount ?? null,
      bm25_count: result.metadata.bm25Count ?? null,
      fused_count: result.metadata.fusedCount ?? null,
      embedding_provider: result.metadata.embeddingProvider ?? null,
      reranked: result.metadata.reranked ?? false,
      rerank_provider: result.metadata.rerankProvider ?? 'none',
    },
  };
}

function applyPagination(
  response: SearchRouteResponse,
  requestedPage: number,
  pageSize: number
): SearchRouteResponse {
  const total = response.results.length;
  const totalPages = Math.max(1, Math.ceil(Math.max(total, 1) / pageSize));
  const safePage = Math.min(Math.max(1, requestedPage), totalPages);
  const start = (safePage - 1) * pageSize;
  const sliced = response.results.slice(start, start + pageSize);

  return {
    ...response,
    results: sliced,
    total_results: total,
    metadata: {
      ...response.metadata,
      pagination: {
        page: safePage,
        page_size: pageSize,
        total_results: total,
        total_pages: totalPages,
      },
    },
  };
}

function normalizePage(value: number | undefined): number {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return 1;
  }

  return Math.max(1, Math.trunc(value as number));
}

function normalizePageSize(value: number | undefined): number {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return DEFAULT_PAGE_SIZE;
  }

  const numeric = Math.trunc(value as number);
  return Math.max(MIN_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, numeric));
}

function normalizeMinSimilarity(value: number | undefined): number | null {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return null;
  }

  const numeric = Number(value);
  const clamped = Math.max(0, Math.min(1, numeric));
  return Number(clamped.toFixed(3));
}
