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
import {
  type IntentInfo,
  type MMRInfo,
  type SearchDiagnostics,
  type SmartSearchResponse,
  smartSearch,
} from '../services/search.js';
import { createSnippet } from '../services/snippet.js';

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
    /** Hybrid search diagnostics (only present in hybrid mode) */
    diagnostics?: SearchDiagnostics | null;
    /** Query intent information (when autoIntent is enabled) */
    intent?: IntentInfo | null;
    /** MMR diversification info (when mmrEnabled is true) */
    mmr?: MMRInfo | null;
    /** Graph expansion info (when expandWithGraph is true) */
    graph_expansion?: {
      enabled: boolean;
      nodes_visited: number;
      edges_traversed: number;
      depth_reached: number;
      expansion_time_ms: number;
      chunks_added: number;
    } | null;
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
    // GPT Phase 1: Feature-aware filtering
    feature_tags: z.array(z.string()).optional(),
    featureTags: z.array(z.string()).optional(),
    platform: z.enum(['mobile', 'web', 'backend', 'shared']).optional(),
    usage_tier: z.enum(['official', 'reference', 'example', 'recipe']).optional(),
    usageTier: z.enum(['official', 'reference', 'example', 'recipe']).optional(),
    page: z.number().int().min(1).optional(),
    page_size: z.number().int().min(1).max(50).optional(),
    pageSize: z.number().int().min(1).max(50).optional(),
    include_related_files: z.boolean().optional(),
    includeRelatedFiles: z.boolean().optional(),
    /** Enable automatic query intent detection (default: true) */
    auto_intent: z.boolean().optional(),
    autoIntent: z.boolean().optional(),
    /** Override detected intent with explicit intent */
    intent: z
      .enum([
        'code_symbol',
        'natural_language',
        'error_message',
        'api_lookup',
        'conceptual',
        'comparison',
      ])
      .optional(),
    /** Enable MMR diversification (default: false, or env MMR_DEFAULT_ENABLED) */
    mmr_enabled: z.boolean().optional(),
    mmrEnabled: z.boolean().optional(),
    /** MMR lambda parameter: 0.0 = max diversity, 1.0 = max relevance (default: 0.7) */
    mmr_lambda: z.number().min(0).max(1).optional(),
    mmrLambda: z.number().min(0).max(1).optional(),
    // GPT Phase 2: Graph expansion
    /** Enable graph-based context expansion (default: env ENABLE_GRAPH_EXPANSION) */
    expand_with_graph: z.boolean().optional(),
    expandWithGraph: z.boolean().optional(),
    /** Maximum depth for graph traversal (1-10, default: 3 or env GRAPH_MAX_DEPTH) */
    graph_max_depth: z.number().int().min(1).max(10).optional(),
    graphMaxDepth: z.number().int().min(1).max(10).optional(),
    /** Maximum nodes to visit during expansion (1-100, default: 50 or env GRAPH_MAX_NODES) */
    graph_max_nodes: z.number().int().min(1).max(100).optional(),
    graphMaxNodes: z.number().int().min(1).max(100).optional(),
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
      // GPT Phase 1: Feature-aware filtering
      feature_tags: snakeFeatureTags,
      featureTags: camelFeatureTags,
      platform,
      usage_tier: snakeUsageTier,
      usageTier: camelUsageTier,
      page: requestPage,
      page_size: snakePageSize,
      pageSize: camelPageSize,
      include_related_files: snakeIncludeRelated,
      includeRelatedFiles: camelIncludeRelated,
      auto_intent: snakeAutoIntent,
      autoIntent: camelAutoIntent,
      intent,
      mmr_enabled: snakeMmrEnabled,
      mmrEnabled: camelMmrEnabled,
      mmr_lambda: snakeMmrLambda,
      mmrLambda: camelMmrLambda,
      // GPT Phase 2: Graph expansion
      expand_with_graph: snakeExpandWithGraph,
      expandWithGraph: camelExpandWithGraph,
      graph_max_depth: snakeGraphMaxDepth,
      graphMaxDepth: camelGraphMaxDepth,
      graph_max_nodes: snakeGraphMaxNodes,
      graphMaxNodes: camelGraphMaxNodes,
    } = validation.data;

    // Resolve MMR options from request
    let mmrEnabled = camelMmrEnabled ?? snakeMmrEnabled;
    let mmrLambda = camelMmrLambda ?? snakeMmrLambda;

    const collectionId = (camelCollectionId ?? snakeCollectionId) as string;

    // If MMR options not specified in request, use collection defaults
    if (mmrEnabled === undefined || mmrLambda === undefined) {
      try {
        const db = getPool();
        const collectionResult = await db.query(
          'SELECT mmr_enabled, mmr_lambda FROM collections WHERE id = $1',
          [collectionId]
        );
        if (collectionResult.rows[0]) {
          const row = collectionResult.rows[0];
          mmrEnabled = mmrEnabled ?? row.mmr_enabled ?? false;
          // Use nullish check to preserve explicit 0 value from DB
          const dbLambda = row.mmr_lambda;
          const parsedLambda = dbLambda != null ? Number(dbLambda) : 0.7;
          mmrLambda = mmrLambda ?? parsedLambda;
        }
      } catch (error) {
        // Fall back to safe defaults on DB error
        fastify.log.error({ error, collectionId }, 'Failed to fetch collection MMR defaults');
        mmrEnabled = mmrEnabled ?? false;
        mmrLambda = mmrLambda ?? 0.7;
      }
    }
    const topK = camelTopK ?? snakeTopK;
    const minSimilarity = camelMinSimilarity ?? snakeMinSimilarity;

    // Normalize tech_stack to lowercase for case-insensitive matching
    const techStack = tech_stack?.map((tag) => tag.toLowerCase());

    // GPT Phase 1: Normalize feature_tags to lowercase for case-insensitive matching
    const featureTags = (camelFeatureTags ?? snakeFeatureTags)?.map((tag) => tag.toLowerCase());
    const usageTier = camelUsageTier ?? snakeUsageTier;

    // GPT Phase 2: Graph expansion - default to env setting if not specified
    const expandWithGraph =
      camelExpandWithGraph ?? snakeExpandWithGraph ?? process.env.ENABLE_GRAPH_EXPANSION === 'true';
    const graphMaxDepth = camelGraphMaxDepth ?? snakeGraphMaxDepth;
    const graphMaxNodes = camelGraphMaxNodes ?? snakeGraphMaxNodes;

    const includeRelatedFiles = camelIncludeRelated ?? snakeIncludeRelated ?? false;
    const autoIntent = camelAutoIntent ?? snakeAutoIntent;
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
      // GPT Phase 1: Feature-aware filtering
      featureTags,
      platform,
      usageTier,
      weights: undefined,
      page,
      pageSize,
      includeRelatedFiles,
      mmrEnabled: mmrEnabled ?? false,
      mmrLambda,
      // GPT Phase 2: Graph expansion
      expandWithGraph,
      graphMaxDepth,
      graphMaxNodes,
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
        // GPT Phase 1: Feature-aware filtering
        featureTags,
        platform,
        usageTier,
        includeRelatedFiles,
        autoIntent,
        intent,
        mmrEnabled,
        mmrLambda,
        // GPT Phase 2: Graph expansion
        expandWithGraph,
        graphMaxDepth,
        graphMaxNodes,
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
      diagnostics: result.metadata.diagnostics ?? null,
      intent: result.metadata.intent ?? null,
      mmr: result.metadata.mmr ?? null,
      // GPT Phase 2: Graph expansion metadata
      graph_expansion: result.metadata.graphExpansion
        ? {
            enabled: result.metadata.graphExpansion.enabled,
            nodes_visited: result.metadata.graphExpansion.nodesVisited,
            edges_traversed: result.metadata.graphExpansion.edgesTraversed,
            depth_reached: result.metadata.graphExpansion.depthReached,
            expansion_time_ms: result.metadata.graphExpansion.expansionTimeMs,
            chunks_added: result.metadata.graphExpansion.chunksAdded,
          }
        : null,
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
