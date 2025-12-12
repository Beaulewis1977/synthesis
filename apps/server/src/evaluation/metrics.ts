/**
 * RAG Retrieval Metrics
 *
 * Implementation of standard information retrieval metrics for evaluating
 * the Synthesis RAG pipeline's search quality.
 *
 * Metrics implemented:
 * - MRR (Mean Reciprocal Rank)
 * - NDCG@k (Normalized Discounted Cumulative Gain)
 * - Recall@k
 * - Precision@k
 * - Hit Rate
 */

import type {
  AggregateMetrics,
  EvalSearchResult,
  EvaluationMode,
  RetrievalMetrics,
} from './types.js';

// =============================================================================
// Core Metric Calculations
// =============================================================================

/**
 * Calculate Mean Reciprocal Rank (MRR)
 *
 * MRR = 1 / rank of first relevant result
 * If no relevant result is found, MRR = 0
 *
 * @param results - Search results in rank order
 * @param relevantIds - Set of relevant document/chunk IDs
 * @param useChunkIds - If true, match against chunkId; otherwise docId
 */
export function calculateMRR(
  results: EvalSearchResult[],
  relevantIds: Set<string>,
  useChunkIds = false
): number {
  for (let i = 0; i < results.length; i++) {
    const id = useChunkIds ? results[i].chunkId : results[i].docId;
    if (relevantIds.has(id)) {
      return 1 / (i + 1); // Rank is 1-indexed
    }
  }
  return 0;
}

/**
 * Calculate Discounted Cumulative Gain (DCG) at position k
 *
 * DCG@k = sum(rel_i / log2(i + 1)) for i = 1 to k
 *
 * Using binary relevance: rel_i = 1 if relevant, 0 otherwise
 */
export function calculateDCG(
  results: EvalSearchResult[],
  relevantIds: Set<string>,
  k: number,
  useChunkIds = false
): number {
  let dcg = 0;
  const limit = Math.min(k, results.length);

  for (let i = 0; i < limit; i++) {
    const id = useChunkIds ? results[i].chunkId : results[i].docId;
    const relevance = relevantIds.has(id) ? 1 : 0;
    // i + 2 because rank is 1-indexed and log2(1) = 0
    dcg += relevance / Math.log2(i + 2);
  }

  return dcg;
}

/**
 * Calculate Ideal DCG (IDCG) - the maximum possible DCG
 *
 * Assumes all relevant documents are ranked at the top
 */
export function calculateIDCG(numRelevant: number, k: number): number {
  let idcg = 0;
  const limit = Math.min(numRelevant, k);

  for (let i = 0; i < limit; i++) {
    idcg += 1 / Math.log2(i + 2);
  }

  return idcg;
}

/**
 * Calculate Normalized Discounted Cumulative Gain (NDCG) at position k
 *
 * NDCG@k = DCG@k / IDCG@k
 *
 * Measures ranking quality - higher is better when relevant docs are ranked higher
 */
export function calculateNDCG(
  results: EvalSearchResult[],
  relevantIds: Set<string>,
  k: number,
  useChunkIds = false
): number {
  const dcg = calculateDCG(results, relevantIds, k, useChunkIds);
  const idcg = calculateIDCG(relevantIds.size, k);

  // Avoid division by zero
  if (idcg === 0) return 0;

  return dcg / idcg;
}

/**
 * Calculate Recall at position k
 *
 * Recall@k = |relevant docs in top k| / |all relevant docs|
 *
 * Measures coverage - what fraction of relevant docs did we find?
 */
export function calculateRecall(
  results: EvalSearchResult[],
  relevantIds: Set<string>,
  k: number,
  useChunkIds = false
): number {
  if (relevantIds.size === 0) return 0;

  const topK = results.slice(0, k);
  let found = 0;

  for (const result of topK) {
    const id = useChunkIds ? result.chunkId : result.docId;
    if (relevantIds.has(id)) {
      found++;
    }
  }

  return found / relevantIds.size;
}

/**
 * Calculate Precision at position k
 *
 * Precision@k = |relevant docs in top k| / k
 *
 * Measures accuracy - what fraction of returned docs are relevant?
 */
export function calculatePrecision(
  results: EvalSearchResult[],
  relevantIds: Set<string>,
  k: number,
  useChunkIds = false
): number {
  const topK = results.slice(0, k);
  if (topK.length === 0) return 0;

  let relevant = 0;

  for (const result of topK) {
    const id = useChunkIds ? result.chunkId : result.docId;
    if (relevantIds.has(id)) {
      relevant++;
    }
  }

  return relevant / topK.length;
}

/**
 * Calculate Hit Rate (also known as Success Rate)
 *
 * Hit Rate = 1 if at least one relevant doc in results, 0 otherwise
 *
 * Binary measure - did we find anything relevant at all?
 */
export function calculateHitRate(
  results: EvalSearchResult[],
  relevantIds: Set<string>,
  useChunkIds = false
): number {
  for (const result of results) {
    const id = useChunkIds ? result.chunkId : result.docId;
    if (relevantIds.has(id)) {
      return 1;
    }
  }
  return 0;
}

// =============================================================================
// Combined Metrics Calculation
// =============================================================================

/**
 * Calculate all retrieval metrics for a single query
 *
 * @param results - Search results to evaluate
 * @param relevantDocIds - Ground truth relevant document IDs
 * @param relevantChunkIds - Ground truth relevant chunk IDs (optional)
 * @param latencyMs - Search latency in milliseconds
 * @param searchMode - Search mode used
 * @param reranked - Whether reranking was applied
 * @param evaluationMode - How to match relevance ('doc', 'chunk', or 'flexible')
 */
export function calculateRetrievalMetrics(
  results: EvalSearchResult[],
  relevantDocIds: string[],
  relevantChunkIds: string[] | undefined,
  latencyMs: number,
  searchMode: 'vector' | 'hybrid' | 'bm25',
  reranked: boolean,
  evaluationMode: EvaluationMode = 'doc'
): RetrievalMetrics {
  let relevantIds: Set<string>;
  let useChunkIds: boolean;

  switch (evaluationMode) {
    case 'doc':
      // Always match by document ID (any chunk from relevant doc counts)
      useChunkIds = false;
      relevantIds = new Set(relevantDocIds);
      break;
    case 'chunk':
      // Match by chunk ID if available, otherwise fall back to doc ID
      useChunkIds = relevantChunkIds !== undefined && relevantChunkIds.length > 0;
      relevantIds = new Set(useChunkIds ? relevantChunkIds : relevantDocIds);
      break;
    case 'flexible':
      // Same as 'doc' - any chunk from relevant doc counts
      useChunkIds = false;
      relevantIds = new Set(relevantDocIds);
      break;
    default:
      // Default to doc-level matching
      useChunkIds = false;
      relevantIds = new Set(relevantDocIds);
  }

  // In doc-level evaluation, multiple chunks from the same document can appear in results.
  // Deduplicate by docId to avoid inflating recall/NDCG beyond 1.0.
  const resultsForScoring = useChunkIds ? results : dedupeResultsByDocId(results);

  return {
    mrr: calculateMRR(resultsForScoring, relevantIds, useChunkIds),
    ndcg_at_5: calculateNDCG(resultsForScoring, relevantIds, 5, useChunkIds),
    ndcg_at_10: calculateNDCG(resultsForScoring, relevantIds, 10, useChunkIds),
    recall_at_3: calculateRecall(resultsForScoring, relevantIds, 3, useChunkIds),
    recall_at_5: calculateRecall(resultsForScoring, relevantIds, 5, useChunkIds),
    recall_at_10: calculateRecall(resultsForScoring, relevantIds, 10, useChunkIds),
    precision_at_5: calculatePrecision(resultsForScoring, relevantIds, 5, useChunkIds),
    hit_rate: calculateHitRate(resultsForScoring, relevantIds, useChunkIds),
    latency_ms: latencyMs,
    num_results: resultsForScoring.length,
    search_mode: searchMode,
    reranked,
  };
}

// =============================================================================
// Helpers
// =============================================================================

function dedupeResultsByDocId(results: EvalSearchResult[]): EvalSearchResult[] {
  const seen = new Set<string>();
  const deduped: EvalSearchResult[] = [];
  for (const result of results) {
    if (seen.has(result.docId)) continue;
    seen.add(result.docId);
    deduped.push(result);
  }
  return deduped;
}

// =============================================================================
// Aggregation Functions
// =============================================================================

/**
 * Calculate mean of an array of numbers
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map((v) => (v - avg) ** 2);
  return Math.sqrt(mean(squaredDiffs));
}

/**
 * Calculate percentile (0-100)
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Aggregate metrics across multiple evaluation results
 */
export function aggregateMetrics(
  metrics: RetrievalMetrics[],
  generationMetrics?: { faithfulness: number; relevancy: number; completeness: number }[]
): AggregateMetrics {
  const mrrValues = metrics.map((m) => m.mrr);
  const ndcg5Values = metrics.map((m) => m.ndcg_at_5);
  const ndcg10Values = metrics.map((m) => m.ndcg_at_10);
  const recall3Values = metrics.map((m) => m.recall_at_3);
  const recall5Values = metrics.map((m) => m.recall_at_5);
  const recall10Values = metrics.map((m) => m.recall_at_10);
  const precision5Values = metrics.map((m) => m.precision_at_5);
  const hitRateValues = metrics.map((m) => m.hit_rate);
  const latencyValues = metrics.map((m) => m.latency_ms);

  const result: AggregateMetrics = {
    count: metrics.length,
    mean: {
      mrr: mean(mrrValues),
      ndcg_at_5: mean(ndcg5Values),
      ndcg_at_10: mean(ndcg10Values),
      recall_at_3: mean(recall3Values),
      recall_at_5: mean(recall5Values),
      recall_at_10: mean(recall10Values),
      precision_at_5: mean(precision5Values),
      hit_rate: mean(hitRateValues),
      latency_ms: mean(latencyValues),
    },
    stddev: {
      mrr: stddev(mrrValues),
      ndcg_at_5: stddev(ndcg5Values),
      recall_at_5: stddev(recall5Values),
      latency_ms: stddev(latencyValues),
    },
    percentiles: {
      latency_p50: percentile(latencyValues, 50),
      latency_p95: percentile(latencyValues, 95),
      latency_p99: percentile(latencyValues, 99),
    },
  };

  // Add generation metrics if available
  if (generationMetrics && generationMetrics.length > 0) {
    const faithfulnessValues = generationMetrics.map((m) => m.faithfulness);
    const relevancyValues = generationMetrics.map((m) => m.relevancy);
    const completenessValues = generationMetrics.map((m) => m.completeness);

    result.mean.faithfulness = mean(faithfulnessValues);
    result.mean.relevancy = mean(relevancyValues);
    result.mean.completeness = mean(completenessValues);

    result.stddev.faithfulness = stddev(faithfulnessValues);
    result.stddev.relevancy = stddev(relevancyValues);
  }

  return result;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format a metric value for display (0-1 scale, 2 decimal places)
 */
export function formatMetric(value: number): string {
  return value.toFixed(3);
}

/**
 * Format a latency value for display
 */
export function formatLatency(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Calculate the delta between two metric values and format with sign
 */
export function formatDelta(current: number, baseline: number): string {
  const delta = current - baseline;
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(3)}`;
}

/**
 * Determine if a metric improved, regressed, or stayed the same
 * (within a tolerance of 0.01)
 */
export function compareMetrics(
  current: number,
  baseline: number,
  tolerance = 0.01
): 'improved' | 'regressed' | 'unchanged' {
  const delta = current - baseline;
  if (delta > tolerance) return 'improved';
  if (delta < -tolerance) return 'regressed';
  return 'unchanged';
}
