import { performance } from 'node:perf_hooks';
import type { Pool } from 'pg';
import {
  type BM25Result,
  type BM25SearchMetadata,
  type QueryType,
  type TsQueryFunction,
  bm25SearchWithMetadata,
} from './bm25.js';
import { createSnippet } from './snippet.js';
import { type SearchParams, type SearchResult, searchCollection } from './vector.js';

export interface HybridSearchParams extends Omit<SearchParams, 'topK'> {
  topK?: number;
  weights?: {
    vector?: number;
    bm25?: number;
  };
  rrfK?: number;
  // GPT Phase 3: Source quality filtering (inherited from SearchParams but explicitly included for clarity)
  sourceQuality?: 'official' | 'verified' | 'community';
}

export interface HybridSearchResult extends SearchResult {
  vectorScore: number;
  bm25Score: number;
  fusedScore: number;
  source: 'vector' | 'bm25' | 'both';
}

/**
 * Score statistics for a search method
 */
export interface ScoreStats {
  /** Average score across all results */
  avg: number;
  /** Maximum score */
  max: number;
  /** Minimum score */
  min: number;
}

/**
 * Timing breakdown for hybrid search components
 */
export interface HybridTiming {
  /** Time spent on vector search (ms) */
  vectorMs: number;
  /** Time spent on BM25 search (ms) */
  bm25Ms: number;
  /** Time spent on result fusion (ms) */
  fusionMs: number;
  /** Total elapsed time (ms) */
  totalMs: number;
}

/**
 * Comprehensive diagnostics for hybrid search analysis
 */
export interface HybridDiagnostics {
  /** Number of results from vector search */
  vectorResultCount: number;
  /** Number of results from BM25 search */
  bm25ResultCount: number;
  /** Number of results after fusion */
  fusedResultCount: number;
  /** Number of results found by both methods */
  bothSourceCount: number;

  /** Vector search score statistics */
  vectorScores: ScoreStats;
  /** BM25 search score statistics */
  bm25Scores: ScoreStats;

  /** Timing breakdown */
  timing: HybridTiming;

  /** BM25 query type classification (from Phase 2) */
  bm25QueryType: QueryType;
  /** PostgreSQL tsquery function used */
  bm25TsFunction: TsQueryFunction;

  /** Weights used for fusion */
  weights: {
    vector: number;
    bm25: number;
  };
  /** RRF constant used */
  rrfK: number;
}

/**
 * Parse number from environment variable, allowing explicit 0 values
 * Treats empty/whitespace strings the same as null/undefined
 */
function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null) return fallback;
  if (raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

const DEFAULT_TOP_K = 10;
const DEFAULT_VECTOR_WEIGHT = numberFromEnv('HYBRID_VECTOR_WEIGHT', 0.7);
const DEFAULT_BM25_WEIGHT = numberFromEnv('HYBRID_BM25_WEIGHT', 0.3);
const DEFAULT_WEIGHTS = { vector: DEFAULT_VECTOR_WEIGHT, bm25: DEFAULT_BM25_WEIGHT };
const DEFAULT_RRF_K = numberFromEnv('HYBRID_RRF_K', 60);

/**
 * Response from hybrid search including results and diagnostics
 */
export interface HybridSearchResponse {
  results: HybridSearchResult[];
  elapsedMs: number;
  vectorCount: number;
  bm25Count: number;
  diagnostics: HybridDiagnostics;
}

/**
 * Performs hybrid search combining vector similarity and BM25 full-text search.
 *
 * Uses Reciprocal Rank Fusion (RRF) to combine results from both methods.
 * Returns comprehensive diagnostics for analysis and debugging.
 *
 * @param db - PostgreSQL connection pool
 * @param params - Search parameters
 * @returns Search results with diagnostics
 */
export async function hybridSearch(
  db: Pool,
  params: HybridSearchParams
): Promise<HybridSearchResponse> {
  const topK = params.topK ?? DEFAULT_TOP_K;
  const weights = normalizeWeights({
    vector: params.weights?.vector ?? DEFAULT_WEIGHTS.vector,
    bm25: params.weights?.bm25 ?? DEFAULT_WEIGHTS.bm25,
  });
  const rrfK = params.rrfK ?? DEFAULT_RRF_K;

  const totalStart = performance.now();
  const expandedTopK = Math.max(topK * 3, topK);

  // Execute vector and BM25 searches in parallel with timing
  const vectorPromise = (async () => {
    const start = performance.now();
    const result = await searchCollection(db, {
      query: params.query,
      collectionId: params.collectionId,
      topK: expandedTopK,
      minSimilarity: params.minSimilarity,
      provider: params.provider,
      context: params.context,
      techStack: params.techStack,
      // GPT Phase 1: Feature-aware filtering
      featureTags: params.featureTags,
      platform: params.platform,
      usageTier: params.usageTier,
      // GPT Phase 3: Source quality filtering
      sourceQuality: params.sourceQuality,
    });
    return { result, elapsedMs: performance.now() - start };
  })();

  const bm25Promise = (async () => {
    const start = performance.now();
    const result = await bm25SearchWithMetadata(db, {
      query: params.query,
      collectionId: params.collectionId,
      topK: expandedTopK,
      techStack: params.techStack,
      // GPT Phase 1: Feature-aware filtering
      featureTags: params.featureTags,
      platform: params.platform,
      usageTier: params.usageTier,
      // GPT Phase 3: Source quality filtering
      sourceQuality: params.sourceQuality,
    });
    return { result, elapsedMs: performance.now() - start };
  })();

  const [vectorTimed, bm25Timed] = await Promise.all([vectorPromise, bm25Promise]);
  const vectorResponse = vectorTimed.result;
  const bm25Response = bm25Timed.result;
  const vectorMs = Math.round(vectorTimed.elapsedMs);
  const bm25Ms = Math.round(bm25Timed.elapsedMs);

  // Fuse results
  const fusionStart = performance.now();
  const fused = fuseResults(vectorResponse.results, bm25Response.results, weights, rrfK);
  const sorted = fused.sort((a, b) => b.fusedScore - a.fusedScore).slice(0, topK);
  const fusionEnd = performance.now();

  const totalEnd = performance.now();

  // Compute diagnostics
  const diagnostics = computeDiagnostics(
    vectorResponse.results,
    bm25Response.results,
    bm25Response.metadata,
    sorted,
    weights,
    rrfK,
    {
      vectorMs,
      bm25Ms,
      fusionMs: Math.round(fusionEnd - fusionStart),
      totalMs: Math.round(totalEnd - totalStart),
    }
  );

  // Log diagnostics if enabled
  logDiagnostics(params.query, diagnostics);

  return {
    results: sorted,
    elapsedMs: Math.round(totalEnd - totalStart),
    vectorCount: vectorResponse.results.length,
    bm25Count: bm25Response.results.length,
    diagnostics,
  };
}

/**
 * Fuses vector and BM25 results using Reciprocal Rank Fusion (RRF).
 *
 * RRF formula: score = sum(1 / (k + rank)) for each ranking
 * where k is a constant (default 60) that controls the impact of rank position.
 *
 * @param vectorResults - Results from vector similarity search
 * @param bm25Results - Results from BM25 full-text search
 * @param weights - Weights for vector and BM25 contributions
 * @param rrfK - RRF constant (higher = more uniform weighting)
 * @returns Fused results with scores from both methods
 */
export function fuseResults(
  vectorResults: SearchResult[],
  bm25Results: BM25Result[],
  weights = DEFAULT_WEIGHTS,
  rrfK = DEFAULT_RRF_K
): HybridSearchResult[] {
  const scoreMap = new Map<number, HybridSearchResult>();

  vectorResults.forEach((result, index) => {
    const rrfScore = 1 / (rrfK + index + 1);
    scoreMap.set(result.id, {
      ...result,
      vectorScore: result.similarity,
      bm25Score: 0,
      fusedScore: rrfScore * weights.vector,
      source: 'vector',
    });
  });

  bm25Results.forEach((result, index) => {
    const rrfScore = 1 / (rrfK + index + 1);
    const existing = scoreMap.get(result.chunkId);

    if (existing) {
      existing.bm25Score = result.score;
      existing.fusedScore += rrfScore * weights.bm25;
      existing.source = 'both';
    } else {
      scoreMap.set(result.chunkId, {
        id: result.chunkId,
        text: result.text,
        snippet: createSnippet(result.text),
        similarity: 0,
        docId: result.docId,
        docTitle: result.docTitle,
        sourceUrl: result.sourceUrl,
        metadata: result.metadata,
        citation: {
          title: result.docTitle,
        },
        vectorScore: 0,
        bm25Score: result.score,
        fusedScore: rrfScore * weights.bm25,
        source: 'bm25',
      });
    }
  });

  return Array.from(scoreMap.values());
}

/**
 * Normalizes weights to sum to 1.0
 */
function normalizeWeights(weights: { vector: number; bm25: number }): {
  vector: number;
  bm25: number;
} {
  const sum = weights.vector + weights.bm25;
  if (!Number.isFinite(sum) || sum <= 0) {
    return DEFAULT_WEIGHTS;
  }
  return {
    vector: weights.vector / sum,
    bm25: weights.bm25 / sum,
  };
}

/**
 * Computes score statistics for an array of numbers
 */
function computeScoreStats(scores: number[]): ScoreStats {
  if (scores.length === 0) {
    return { avg: 0, max: 0, min: 0 };
  }

  const sum = scores.reduce((acc, s) => acc + s, 0);
  return {
    avg: Number((sum / scores.length).toFixed(4)),
    max: Number(Math.max(...scores).toFixed(4)),
    min: Number(Math.min(...scores).toFixed(4)),
  };
}

/**
 * Computes comprehensive diagnostics for hybrid search
 */
function computeDiagnostics(
  vectorResults: SearchResult[],
  bm25Results: BM25Result[],
  bm25Metadata: BM25SearchMetadata,
  fusedResults: HybridSearchResult[],
  weights: { vector: number; bm25: number },
  rrfK: number,
  timing: HybridTiming
): HybridDiagnostics {
  // Count results by source
  const bothSourceCount = fusedResults.filter((r) => r.source === 'both').length;

  // Compute score statistics
  const vectorScores = computeScoreStats(vectorResults.map((r) => r.similarity));
  const bm25Scores = computeScoreStats(bm25Results.map((r) => r.score));

  return {
    vectorResultCount: vectorResults.length,
    bm25ResultCount: bm25Results.length,
    fusedResultCount: fusedResults.length,
    bothSourceCount,
    vectorScores,
    bm25Scores,
    timing,
    bm25QueryType: bm25Metadata.queryType,
    bm25TsFunction: bm25Metadata.tsFunction,
    weights: {
      vector: Number(weights.vector.toFixed(4)),
      bm25: Number(weights.bm25.toFixed(4)),
    },
    rrfK,
  };
}

/**
 * Logs hybrid search diagnostics if enabled via environment variable.
 * Set HYBRID_DIAGNOSTICS_LOG=true to enable.
 */
function logDiagnostics(query: string, diagnostics: HybridDiagnostics): void {
  const enabled = process.env.HYBRID_DIAGNOSTICS_LOG?.toLowerCase() === 'true';
  if (!enabled) {
    return;
  }

  const logData = {
    type: 'hybrid_search_diagnostics',
    query: query.slice(0, 100), // Truncate for logging
    vectorCount: diagnostics.vectorResultCount,
    bm25Count: diagnostics.bm25ResultCount,
    fusedCount: diagnostics.fusedResultCount,
    bothCount: diagnostics.bothSourceCount,
    vectorScoreAvg: diagnostics.vectorScores.avg,
    bm25ScoreAvg: diagnostics.bm25Scores.avg,
    bm25QueryType: diagnostics.bm25QueryType,
    weights: diagnostics.weights,
    timingMs: diagnostics.timing,
  };

  // Use structured JSON logging for production compatibility
  // biome-ignore lint/suspicious/noConsoleLog: Intentional diagnostic logging controlled by env var
  console.log(JSON.stringify(logData));
}
