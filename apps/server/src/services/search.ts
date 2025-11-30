import type { DocumentMetadata } from '@synthesis/shared';
import type { Pool } from 'pg';
import type { ContentContext, EmbeddingProvider } from './embedding-router.js';
import { deriveContextFromMetadata, isEmbeddingProvider } from './embedding-router.js';
import { type RelatedFiles, getRelatedFiles } from './file-relationships.js';
import {
  type HybridDiagnostics,
  type HybridSearchParams,
  type HybridSearchResult,
  hybridSearch,
} from './hybrid.js';
import { type MMROptions, applyMMR, logMMRResults, resolveMMROptions } from './mmr.js';
import {
  type QueryIntent,
  analyzeQuery,
  getIntentSearchConfig,
  logIntentDetection,
  recordIntentMetric,
} from './query-intent.js';
import {
  type RerankedResult,
  type RerankerProvider,
  getRerankDefaultTopK,
  getRerankMaxCandidates,
  rerankResults,
} from './reranker.js';
import {
  type SearchParams,
  type SearchResponse,
  type SearchResult,
  searchCollection as vectorSearch,
} from './vector.js';

export type { SearchParams, SearchResponse, SearchResult } from './vector.js';

export interface SmartSearchParams extends SearchParams {
  mode?: 'vector' | 'hybrid';
  weights?: HybridSearchParams['weights'];
  rrfK?: number;
  rerank?: boolean;
  rerankProvider?: RerankerProvider;
  rerankTopK?: number;
  rerankMaxCandidates?: number;
  includeRelatedFiles?: boolean;
  /** Enable automatic intent detection (default: true) */
  autoIntent?: boolean;
  /** Override detected intent with explicit intent */
  intent?: QueryIntent;
  /** Enable MMR diversification (default: false, or env MMR_DEFAULT_ENABLED) */
  mmrEnabled?: boolean;
  /** MMR lambda parameter: 0.0 = max diversity, 1.0 = max relevance (default: 0.7) */
  mmrLambda?: number;
}

export interface SmartSearchResult extends SearchResult {
  vectorScore?: number;
  bm25Score?: number;
  fusedScore?: number;
  source?: HybridSearchResult['source'];
  trustWeight?: number;
  recencyWeight?: number;
  rerankScore?: number;
  rerankProvider?: RerankerProvider;
  originalSimilarity?: number;
  relatedFiles?: RelatedFiles | null;
}

/**
 * Diagnostics exposed in API response (snake_case for API consistency)
 */
export interface SearchDiagnostics {
  /** Vector search score statistics */
  vector_scores: {
    avg: number;
    max: number;
    min: number;
  };
  /** BM25 search score statistics */
  bm25_scores: {
    avg: number;
    max: number;
    min: number;
  };
  /** Number of results found by both methods */
  both_source_count: number;
  /** Timing breakdown in milliseconds */
  timing: {
    vector_ms: number;
    bm25_ms: number;
    fusion_ms: number;
    total_ms: number;
  };
  /** BM25 query type classification */
  bm25_query_type: string;
  /** PostgreSQL tsquery function used */
  bm25_ts_function: string;
  /** Weights used for fusion */
  weights: {
    vector: number;
    bm25: number;
  };
  /** RRF constant used */
  rrf_k: number;
}

/**
 * Intent information exposed in API response
 */
export interface IntentInfo {
  /** Detected or specified intent type */
  type: QueryIntent;
  /** Confidence score (0.0 - 1.0) */
  confidence: number;
  /** Whether intent was auto-detected */
  auto_detected: boolean;
  /** Signals that triggered classification */
  signals: string[];
}

/**
 * MMR diversification info exposed in API response
 */
export interface MMRInfo {
  /** Whether MMR was enabled */
  enabled: boolean;
  /** Lambda value used (0.0-1.0) */
  lambda: number;
  /** Average pairwise similarity among results (lower = more diverse) */
  avg_pairwise_similarity: number;
  /** Number of results deprioritized from original top-K */
  duplicates_removed: number;
  /** Number of true near-duplicates (similarity >= 0.95) that were filtered */
  near_duplicates_filtered: number;
}

export interface SmartSearchResponse extends Omit<SearchResponse, 'results'> {
  results: SmartSearchResult[];
  metadata: {
    searchMode: 'vector' | 'hybrid';
    vectorCount?: number;
    bm25Count?: number;
    fusedCount?: number;
    embeddingProvider?: EmbeddingProvider;
    trustScoringApplied?: boolean;
    reranked?: boolean;
    rerankProvider?: RerankerProvider;
    /** Hybrid search diagnostics (only present in hybrid mode) */
    diagnostics?: SearchDiagnostics;
    /** Query intent information (when autoIntent is enabled) */
    intent?: IntentInfo;
    /** MMR diversification info (when mmrEnabled is true) */
    mmr?: MMRInfo;
  };
}

export async function smartSearch(
  db: Pool,
  params: SmartSearchParams
): Promise<SmartSearchResponse> {
  // Intent detection (enabled by default)
  const autoIntentEnabled = params.autoIntent !== false;
  const intentResult = autoIntentEnabled ? analyzeQuery(params.query) : null;
  const { intentResult: detectedIntent, searchConfig: autoSearchConfig } = intentResult ?? {
    intentResult: null,
    searchConfig: null,
  };

  // Get search config: explicit intent takes precedence, then auto-detected
  const effectiveIntent = params.intent ?? detectedIntent?.intent;
  const searchConfig = params.intent ? getIntentSearchConfig(params.intent) : autoSearchConfig;

  // Log and record metrics if intent was detected
  if (detectedIntent) {
    logIntentDetection(params.query, detectedIntent);
    recordIntentMetric(detectedIntent);
  }

  // Build intent info for response (works with both auto-detected and explicit intent)
  const intentInfo: IntentInfo | undefined = effectiveIntent
    ? {
        type: effectiveIntent,
        confidence: detectedIntent?.confidence ?? 1.0,
        auto_detected: !params.intent,
        signals: params.intent ? ['explicit_override'] : (detectedIntent?.signals ?? []),
      }
    : undefined;

  // Apply intent-based configuration if available
  // params.rerank explicitly set takes precedence, then searchConfig, then false
  const rerankRequested = params.rerank ?? searchConfig?.rerank ?? false;

  // Determine search mode: explicit > intent-based > env > default
  const envMode = process.env.SEARCH_MODE === 'hybrid' ? 'hybrid' : 'vector';
  const intentMode = searchConfig?.mode;
  const requestedMode = params.mode ?? intentMode ?? envMode;
  const mode = rerankRequested ? 'hybrid' : requestedMode;

  const hint =
    params.provider && params.context
      ? undefined
      : await inferCollectionEmbeddingHint(db, params.collectionId);
  const provider = params.provider ?? hint?.provider;
  const context = params.context ?? hint?.context;

  // Resolve MMR options
  const mmrOptions = resolveMMROptions({
    enabled: params.mmrEnabled,
    lambda: params.mmrLambda,
  });

  if (mode === 'hybrid') {
    // Apply intent-based weights if not explicitly provided
    // Works with both auto-detected and explicit intent
    const intentWeights =
      searchConfig && !params.weights
        ? { vector: searchConfig.vectorWeight, bm25: searchConfig.bm25Weight }
        : undefined;
    const hybridWeights = resolveHybridWeights(params.weights ?? intentWeights);
    const baseTopK = params.topK ?? 10;
    const candidateCap = rerankRequested
      ? Math.max(
          1,
          Math.min(
            params.rerankMaxCandidates ?? getRerankMaxCandidates(),
            getRerankMaxCandidates(),
            50
          )
        )
      : baseTopK;
    // If MMR is enabled, fetch more candidates to allow for diversification
    // Apply expansion to baseTopK, not to candidateCap (which is already expanded for reranking)
    const mmrExpansionFactor = mmrOptions.enabled ? 2 : 1;
    const expandedBaseTopK = baseTopK * mmrExpansionFactor;
    const hybridTopK = rerankRequested
      ? Math.max(candidateCap, expandedBaseTopK)
      : expandedBaseTopK;
    const { results, elapsedMs, vectorCount, bm25Count, diagnostics } = await hybridSearch(db, {
      query: params.query,
      collectionId: params.collectionId,
      topK: hybridTopK,
      minSimilarity: params.minSimilarity,
      weights: hybridWeights,
      rrfK: params.rrfK,
      provider,
      context,
      techStack: params.techStack,
      // GPT Phase 1: Feature-aware filtering
      featureTags: params.featureTags,
      platform: params.platform,
      usageTier: params.usageTier,
    });
    let fusedResults: SmartSearchResult[] = results.map((item) => ({
      ...item,
      similarity: item.fusedScore,
    }));

    const trustApplied = shouldApplyTrustScoring();

    if (rerankRequested) {
      const desiredTopK = Math.max(
        1,
        Math.min(params.rerankTopK ?? params.topK ?? getRerankDefaultTopK(), hybridTopK)
      );
      const reranked = await rerankResults<SmartSearchResult>(params.query, fusedResults, {
        provider: params.rerankProvider,
        topK: desiredTopK,
        maxCandidates: candidateCap,
      });

      let rankedResults: SmartSearchResult[] = reranked.map(mapRerankedResult);

      if (trustApplied) {
        rankedResults = applyTrustScoring(rankedResults);
      }

      rankedResults.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

      // Apply MMR diversification after reranking
      const { results: diversifiedResults, mmrInfo } = await applyMMRDiversification(
        db,
        rankedResults,
        mmrOptions,
        baseTopK,
        params.query
      );

      const enrichedResults = params.includeRelatedFiles
        ? await attachRelatedFiles(db, params.collectionId, diversifiedResults)
        : diversifiedResults;

      return {
        query: params.query,
        results: enrichedResults,
        totalResults: enrichedResults.length,
        searchTimeMs: elapsedMs,
        metadata: {
          searchMode: 'hybrid',
          vectorCount,
          bm25Count,
          fusedCount: enrichedResults.length,
          embeddingProvider: provider,
          trustScoringApplied: trustApplied,
          reranked: true,
          rerankProvider: rankedResults[0]?.rerankProvider ?? params.rerankProvider ?? 'none',
          diagnostics: mapDiagnostics(diagnostics),
          intent: intentInfo,
          mmr: mmrOptions.enabled ? mmrInfo : undefined,
        },
      };
    }

    if (trustApplied) {
      fusedResults = applyTrustScoring(fusedResults);
      fusedResults.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
    }

    // Apply MMR diversification
    const { results: diversifiedResults, mmrInfo } = await applyMMRDiversification(
      db,
      fusedResults,
      mmrOptions,
      baseTopK,
      params.query
    );

    const enrichedResults = params.includeRelatedFiles
      ? await attachRelatedFiles(db, params.collectionId, diversifiedResults)
      : diversifiedResults;

    return {
      query: params.query,
      results: enrichedResults,
      totalResults: enrichedResults.length,
      searchTimeMs: elapsedMs,
      metadata: {
        searchMode: 'hybrid',
        vectorCount,
        bm25Count,
        fusedCount: enrichedResults.length,
        embeddingProvider: provider,
        trustScoringApplied: trustApplied,
        reranked: false,
        rerankProvider: params.rerankProvider ?? 'none',
        diagnostics: mapDiagnostics(diagnostics),
        intent: intentInfo,
        mmr: mmrOptions.enabled ? mmrInfo : undefined,
      },
    };
  }

  // For vector-only mode, expand topK if MMR is enabled
  const vectorBaseTopK = params.topK ?? 10;
  const vectorMmrExpansionFactor = mmrOptions.enabled ? 2 : 1;
  const vectorTopK = vectorBaseTopK * vectorMmrExpansionFactor;

  const vectorResult = await vectorSearch(db, {
    query: params.query,
    collectionId: params.collectionId,
    topK: vectorTopK,
    minSimilarity: params.minSimilarity,
    provider,
    context,
    techStack: params.techStack,
    // GPT Phase 1: Feature-aware filtering
    featureTags: params.featureTags,
    platform: params.platform,
    usageTier: params.usageTier,
  });

  const trustApplied = shouldApplyTrustScoring();
  let rankedResults: SmartSearchResult[] = vectorResult.results;

  if (trustApplied) {
    rankedResults = applyTrustScoring(vectorResult.results);
    rankedResults.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
  }

  // Apply MMR diversification
  const { results: diversifiedResults, mmrInfo } = await applyMMRDiversification(
    db,
    rankedResults,
    mmrOptions,
    vectorBaseTopK,
    params.query
  );

  const enrichedResults = params.includeRelatedFiles
    ? await attachRelatedFiles(db, params.collectionId, diversifiedResults)
    : diversifiedResults;

  return {
    ...vectorResult,
    results: enrichedResults,
    totalResults: enrichedResults.length,
    metadata: {
      searchMode: 'vector',
      vectorCount: enrichedResults.length,
      fusedCount: enrichedResults.length,
      embeddingProvider: provider,
      trustScoringApplied: trustApplied,
      reranked: false,
      rerankProvider: params.rerankProvider ?? 'none',
      intent: intentInfo,
      mmr: mmrOptions.enabled ? mmrInfo : undefined,
    },
  };
}

export const searchCollection = vectorSearch;

async function attachRelatedFiles(
  db: Pool,
  collectionId: string,
  results: SmartSearchResult[]
): Promise<SmartSearchResult[]> {
  if (!collectionId || results.length === 0) {
    return results;
  }

  const requiresRelationships = results.some((result) => Boolean(extractFilePath(result.metadata)));

  if (!requiresRelationships) {
    return results;
  }

  const cache = new Map<string, Promise<RelatedFiles | null>>();

  const enrichedResults = await Promise.all(
    results.map(async (result) => {
      const filePath = extractFilePath(result.metadata);
      if (!filePath) {
        return result;
      }

      if (!cache.has(filePath)) {
        cache.set(
          filePath,
          getRelatedFiles(db, filePath, collectionId).catch((error) => {
            console.warn(
              `Failed to load related files for ${filePath} in collection ${collectionId}`,
              error
            );
            return null;
          })
        );
      }

      const relatedFilesPromise = cache.get(filePath);
      if (!relatedFilesPromise) {
        // This should theoretically not happen due to the cache.has check above,
        // but this handles the edge case and satisfies the linter.
        console.warn(`Cache miss for ${filePath} despite prior set`);
        return { ...result, relatedFiles: null };
      }

      const relatedFiles = await relatedFilesPromise;

      return {
        ...result,
        relatedFiles,
      };
    })
  );

  return enrichedResults;
}

function extractFilePath(metadata: Record<string, unknown> | null | undefined): string | undefined {
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }

  const maybePath = (metadata as Record<string, unknown>).file_path;
  return typeof maybePath === 'string' && maybePath.length > 0 ? maybePath : undefined;
}

function mapRerankedResult(result: RerankedResult<SmartSearchResult>): SmartSearchResult {
  return {
    ...result,
    similarity: result.rerankScore,
    fusedScore: result.rerankScore,
  } as SmartSearchResult;
}

async function inferCollectionEmbeddingHint(
  db: Pool,
  collectionId: string
): Promise<{ provider?: EmbeddingProvider; context?: ContentContext }> {
  const { rows } = await db.query<{
    provider: string | null;
    doc_type: string | null;
    language: string | null;
  }>(
    `
      SELECT
        d.metadata->>'embedding_provider' AS provider,
        d.metadata->>'doc_type' AS doc_type,
        d.metadata->>'language' AS language
      FROM documents d
      WHERE d.collection_id = $1
      ORDER BY d.processed_at DESC NULLS LAST, d.created_at DESC
      LIMIT 1
    `,
    [collectionId]
  );

  if (rows.length === 0) {
    return {};
  }

  const row = rows[0];
  const provider = isEmbeddingProvider(row.provider ?? undefined)
    ? (row.provider as EmbeddingProvider)
    : undefined;

  const contextMetadata: Record<string, unknown> = {};
  if (row.doc_type) {
    contextMetadata.doc_type = row.doc_type;
  }
  if (row.language) {
    contextMetadata.language = row.language;
  }

  const context = Object.keys(contextMetadata).length
    ? deriveContextFromMetadata(contextMetadata)
    : undefined;

  return { provider, context };
}

const DEFAULT_VECTOR_WEIGHT = 0.7;
const DEFAULT_BM25_WEIGHT = 0.3;

function resolveHybridWeights(
  weights: HybridSearchParams['weights']
): NonNullable<HybridSearchParams['weights']> {
  const envVector = Number.parseFloat(process.env.HYBRID_VECTOR_WEIGHT ?? '');
  const envBm25 = Number.parseFloat(process.env.HYBRID_BM25_WEIGHT ?? '');

  const baseVector = Number.isFinite(envVector) ? envVector : DEFAULT_VECTOR_WEIGHT;
  const baseBm25 = Number.isFinite(envBm25) ? envBm25 : DEFAULT_BM25_WEIGHT;

  const overrideVector = weights?.vector ?? baseVector;
  const overrideBm25 = weights?.bm25 ?? baseBm25;

  const sum = overrideVector + overrideBm25;
  if (!Number.isFinite(sum) || sum <= 0) {
    return { vector: DEFAULT_VECTOR_WEIGHT, bm25: DEFAULT_BM25_WEIGHT };
  }

  return {
    vector: overrideVector / sum,
    bm25: overrideBm25 / sum,
  };
}

function shouldApplyTrustScoring(): boolean {
  return (process.env.ENABLE_TRUST_SCORING ?? '').toLowerCase() === 'true';
}

function applyTrustScoring(results: SmartSearchResult[]): SmartSearchResult[] {
  return results.map((result) => {
    const metadata = toDocumentMetadata(result.metadata);
    const trustWeight = computeTrustWeight(metadata);
    const recencyWeight = computeRecencyWeight(metadata);
    const trustMultiplier = trustWeight * recencyWeight;

    const similarity = Number(result.similarity ?? 0) * trustMultiplier;
    const fusedScore =
      typeof result.fusedScore === 'number'
        ? result.fusedScore * trustMultiplier
        : result.fusedScore;

    return {
      ...result,
      similarity,
      fusedScore,
      trustWeight,
      recencyWeight,
    };
  });
}

function toDocumentMetadata(metadata: unknown): DocumentMetadata | undefined {
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }

  return metadata as DocumentMetadata;
}

function computeTrustWeight(metadata: DocumentMetadata | undefined): number {
  const quality = metadata?.source_quality;
  switch (quality) {
    case 'official':
      return 1;
    case 'verified':
      return 0.85;
    case 'community':
      return 0.6;
    default:
      return 0.5;
  }
}

function computeRecencyWeight(metadata: DocumentMetadata | undefined): number {
  const lastVerified = parseTimestamp(metadata?.last_verified);
  if (!lastVerified) {
    return 0.7;
  }

  const now = new Date();
  let months =
    (now.getFullYear() - lastVerified.getFullYear()) * 12 +
    (now.getMonth() - lastVerified.getMonth());

  if (now.getDate() < lastVerified.getDate()) {
    months -= 1;
  }

  if (months < 6) {
    return 1;
  }
  if (months < 12) {
    return 0.9;
  }
  return 0.7;
}

function parseTimestamp(value: string | Date | undefined): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Maps internal HybridDiagnostics to API-friendly SearchDiagnostics (snake_case)
 */
function mapDiagnostics(diagnostics: HybridDiagnostics): SearchDiagnostics {
  return {
    vector_scores: {
      avg: diagnostics.vectorScores.avg,
      max: diagnostics.vectorScores.max,
      min: diagnostics.vectorScores.min,
    },
    bm25_scores: {
      avg: diagnostics.bm25Scores.avg,
      max: diagnostics.bm25Scores.max,
      min: diagnostics.bm25Scores.min,
    },
    both_source_count: diagnostics.bothSourceCount,
    timing: {
      vector_ms: diagnostics.timing.vectorMs,
      bm25_ms: diagnostics.timing.bm25Ms,
      fusion_ms: diagnostics.timing.fusionMs,
      total_ms: diagnostics.timing.totalMs,
    },
    bm25_query_type: diagnostics.bm25QueryType,
    bm25_ts_function: diagnostics.bm25TsFunction,
    weights: {
      vector: diagnostics.weights.vector,
      bm25: diagnostics.weights.bm25,
    },
    rrf_k: diagnostics.rrfK,
  };
}

/**
 * Fetches embeddings for a list of chunk IDs from the database.
 * Returns a map of chunk ID to embedding vector.
 *
 * @param db - PostgreSQL connection pool
 * @param chunkIds - Array of chunk IDs to fetch embeddings for
 * @returns Map of chunk ID to embedding vector (or null if not found)
 */
async function fetchChunkEmbeddings(
  db: Pool,
  chunkIds: number[]
): Promise<Map<number, number[] | null>> {
  if (chunkIds.length === 0) {
    return new Map();
  }

  let rows: Array<{ id: number; embedding: string | null }>;

  try {
    // Query embeddings for all chunk IDs in a single batch
    const result = await db.query<{ id: number; embedding: string | null }>(
      `
      SELECT id, embedding::text
      FROM chunks
      WHERE id = ANY($1::int[])
      `,
      [chunkIds]
    );
    rows = result.rows;
  } catch (error) {
    // Log warning and return empty map - MMR will gracefully degrade
    console.warn('[MMR] Failed to fetch chunk embeddings:', error);
    return new Map(chunkIds.map((id) => [id, null]));
  }

  const embeddingMap = new Map<number, number[] | null>();

  for (const row of rows) {
    if (row.embedding) {
      // Parse the pgvector string format: [0.1,0.2,0.3,...]
      try {
        const vectorStr = row.embedding.replace(/^\[|\]$/g, '');
        const embedding = vectorStr.split(',').map((v) => Number.parseFloat(v.trim()));
        if (embedding.every((v) => Number.isFinite(v))) {
          embeddingMap.set(row.id, embedding);
        } else {
          embeddingMap.set(row.id, null);
        }
      } catch {
        embeddingMap.set(row.id, null);
      }
    } else {
      embeddingMap.set(row.id, null);
    }
  }

  // Ensure all requested IDs have an entry (null if not found)
  for (const id of chunkIds) {
    if (!embeddingMap.has(id)) {
      embeddingMap.set(id, null);
    }
  }

  return embeddingMap;
}

/**
 * Result with embedding attached for MMR processing
 */
interface ResultWithEmbedding extends SmartSearchResult {
  _embedding?: number[] | null;
}

/**
 * Applies MMR diversification to search results.
 *
 * @param db - PostgreSQL connection pool
 * @param results - Search results to diversify
 * @param options - MMR options
 * @param topK - Number of results to return
 * @param query - Original search query (for logging)
 * @returns Diversified results and MMR info
 */
async function applyMMRDiversification(
  db: Pool,
  results: SmartSearchResult[],
  options: MMROptions,
  topK: number,
  query: string
): Promise<{ results: SmartSearchResult[]; mmrInfo: MMRInfo }> {
  // If MMR is disabled or not enough results, return as-is
  if (!options.enabled || results.length <= 1) {
    return {
      results: results.slice(0, topK),
      mmrInfo: {
        enabled: false,
        lambda: options.lambda,
        avg_pairwise_similarity: 0,
        duplicates_removed: 0,
        near_duplicates_filtered: 0,
      },
    };
  }

  // Fetch embeddings for all result chunks
  const chunkIds = results.map((r) => r.id);
  const embeddingMap = await fetchChunkEmbeddings(db, chunkIds);

  // Attach embeddings to results
  const resultsWithEmbeddings: ResultWithEmbedding[] = results.map((r) => ({
    ...r,
    _embedding: embeddingMap.get(r.id) ?? null,
  }));

  // Check if we have enough embeddings for meaningful MMR
  const embeddingCount = resultsWithEmbeddings.filter((r) => r._embedding !== null).length;
  if (embeddingCount < 2) {
    // Not enough embeddings for MMR, return original order
    return {
      results: results.slice(0, topK),
      mmrInfo: {
        enabled: true,
        lambda: options.lambda,
        avg_pairwise_similarity: 0,
        duplicates_removed: 0,
        near_duplicates_filtered: 0,
      },
    };
  }

  // Apply MMR algorithm
  const mmrResult = applyMMR(
    resultsWithEmbeddings.map((r) => ({
      ...r,
      relevanceScore: r.similarity ?? 0,
      embedding: r._embedding ?? null,
    })),
    topK,
    options
  );

  // Log MMR results if enabled
  logMMRResults(query, mmrResult.metrics, mmrResult.results.length);

  // Remove internal _embedding field from results
  const diversifiedResults: SmartSearchResult[] = mmrResult.results.map((r) => {
    const { _embedding, relevanceScore, embedding, ...rest } = r as ResultWithEmbedding & {
      relevanceScore: number;
      embedding: number[] | null;
    };
    return rest;
  });

  return {
    results: diversifiedResults,
    mmrInfo: {
      enabled: true,
      lambda: mmrResult.metrics.lambda,
      avg_pairwise_similarity: mmrResult.metrics.avgPairwiseSimilarity,
      duplicates_removed: mmrResult.metrics.duplicatesRemoved,
      near_duplicates_filtered: mmrResult.metrics.nearDuplicatesFiltered,
    },
  };
}

// Re-export resolveMMROptions for use in routes
export { resolveMMROptions } from './mmr.js';
