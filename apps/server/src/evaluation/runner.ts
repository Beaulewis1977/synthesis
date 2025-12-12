/**
 * RAG Evaluation Runner
 *
 * Main orchestrator for running RAG evaluation benchmarks.
 * Executes queries, calculates metrics, and generates reports.
 */

import { performance } from 'node:perf_hooks';
import type { Pool } from 'pg';
import { type SmartSearchParams, type SmartSearchResult, smartSearch } from '../services/search.js';
import { aggregateMetrics, calculateRetrievalMetrics } from './metrics.js';
import type {
  AggregateMetrics,
  EvalCategory,
  EvalConfig,
  EvalDataset,
  EvalDifficulty,
  EvalQuery,
  EvalReport,
  EvalResult,
  EvalSearchResult,
  GenerationMetrics,
} from './types.js';

// =============================================================================
// Types
// =============================================================================

export interface EvalRunnerOptions {
  /** Database pool */
  db: Pool;

  /** Evaluation configuration */
  config: EvalConfig;

  /** Progress callback */
  onProgress?: (completed: number, total: number, currentQuery: string) => void;

  /** Result callback (for streaming results) */
  onResult?: (result: EvalResult) => void;

  /** LLM judge function (optional) */
  llmJudge?: (query: string, context: string, answer: string) => Promise<GenerationMetrics>;
}

// =============================================================================
// Main Evaluation Runner
// =============================================================================

/**
 * Run evaluation on a dataset
 */
export async function runEvaluation(
  dataset: EvalDataset,
  options: EvalRunnerOptions
): Promise<EvalReport> {
  const startTime = performance.now();
  const { db, config, onProgress, onResult, llmJudge } = options;

  // Filter queries by category if specified
  let queries = dataset.queries;
  if (config.categories && config.categories.length > 0) {
    const categorySet = new Set(config.categories);
    queries = queries.filter((q) => categorySet.has(q.category));
  }

  // Run evaluations
  const results: EvalResult[] = [];
  const errors: string[] = [];

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];

    if (onProgress) {
      onProgress(i, queries.length, query.query);
    }

    try {
      const result = await evaluateSingleQuery(query, db, config, llmJudge);
      results.push(result);

      if (onResult) {
        onResult(result);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`Query ${query.id}: ${errorMsg}`);

      // Create a failed result
      results.push({
        queryId: query.id,
        query: query.query,
        category: query.category,
        evaluatedAt: new Date().toISOString(),
        retrieval: {
          mrr: 0,
          ndcg_at_5: 0,
          ndcg_at_10: 0,
          recall_at_3: 0,
          recall_at_5: 0,
          recall_at_10: 0,
          precision_at_5: 0,
          hit_rate: 0,
          latency_ms: 0,
          num_results: 0,
          search_mode: config.searchMode,
          reranked: config.rerank,
        },
        searchResults: [],
        errors: [errorMsg],
      });
    }
  }

  const endTime = performance.now();

  // Build the report
  return buildReport(dataset, results, config, endTime - startTime);
}

// =============================================================================
// Single Query Evaluation
// =============================================================================

/**
 * Resolve file paths to document IDs for a given collection.
 * Used for cross-collection evaluation where ground truth uses file paths instead of doc IDs.
 */
async function resolveFilePathsToDocIds(
  db: Pool,
  collectionId: string,
  filePaths: string[]
): Promise<string[]> {
  if (filePaths.length === 0) return [];

  try {
    const result = await db.query<{ id: string }>(
      `SELECT id FROM documents
       WHERE collection_id = $1
       AND metadata->>'repoFilePath' = ANY($2)`,
      [collectionId, filePaths]
    );

    const resolvedIds = result.rows.map((r) => r.id);
    if (resolvedIds.length < filePaths.length) {
      console.warn(
        `[Eval] Resolved ${resolvedIds.length}/${filePaths.length} file paths to doc IDs for collection ${collectionId}`
      );
    }
    return resolvedIds;
  } catch (error) {
    console.error(`[Eval] Failed to resolve file paths: ${error}`);
    return [];
  }
}

/**
 * Evaluate a single query
 */
async function evaluateSingleQuery(
  query: EvalQuery,
  db: Pool,
  config: EvalConfig,
  llmJudge?: (query: string, context: string, answer: string) => Promise<GenerationMetrics>
): Promise<EvalResult> {
  const startTime = performance.now();

  // Build search params - collectionId is required by search
  const collectionId = query.collectionId ?? config.collectionIds?.[0];
  if (!collectionId) {
    throw new Error(`No collectionId specified for query ${query.id}`);
  }

  const searchParams: SmartSearchParams = {
    query: query.query,
    collectionId,
    topK: config.topK,
    mode: config.searchMode === 'bm25' ? 'vector' : config.searchMode, // bm25 is handled via hybrid
    rerank: config.rerank,
    autoIntent: true,
  };

  // Execute search
  const searchResponse = await smartSearch(db, searchParams);
  const searchEndTime = performance.now();

  // Convert results to evaluation format
  const searchResults: EvalSearchResult[] = searchResponse.results.map(
    (r: SmartSearchResult, index: number) => ({
      chunkId: String(r.id), // chunk id is stored as number
      docId: r.docId,
      docTitle: r.docTitle ?? '',
      text: r.text,
      score: r.similarity,
      rank: index + 1,
      reranked: r.rerankScore !== undefined,
      originalRank: r.rerankScore !== undefined ? undefined : index + 1,
    })
  );

  // Resolve ground truth: prefer file paths (portable), fallback to doc IDs (collection-specific)
  let relevantDocIds = query.relevantDocIds;
  if (query.relevantFilePaths && query.relevantFilePaths.length > 0) {
    const resolvedIds = await resolveFilePathsToDocIds(db, collectionId, query.relevantFilePaths);
    if (resolvedIds.length > 0) {
      relevantDocIds = resolvedIds;
    }
  }

  // Calculate retrieval metrics
  const retrievalMetrics = calculateRetrievalMetrics(
    searchResults,
    relevantDocIds,
    query.relevantChunkIds,
    searchEndTime - startTime,
    config.searchMode,
    config.rerank,
    config.evaluationMode ?? 'doc'
  );

  // Build result
  const result: EvalResult = {
    queryId: query.id,
    query: query.query,
    category: query.category,
    evaluatedAt: new Date().toISOString(),
    retrieval: retrievalMetrics,
    searchResults,
  };

  // Run generation evaluation if enabled and judge is provided
  if (config.evaluateGeneration && llmJudge && searchResults.length > 0) {
    // Build context from search results
    const context = searchResults
      .slice(0, 5)
      .map((r) => `[${r.docTitle}]: ${r.text}`)
      .join('\n\n');

    // For now, we'll use the expected answer as the "generated" answer
    // TODO: In a full implementation, this would call the agent to generate a real answer
    const answer = query.expectedAnswer ?? 'No answer generated';

    if (!query.expectedAnswer) {
      console.warn(
        `[WARN] Query ${query.id}: No expectedAnswer provided, generation metrics will be invalid`
      );
    }

    try {
      const generationMetrics = await llmJudge(query.query, context, answer);
      result.generation = generationMetrics;
      result.generatedAnswer = answer;
    } catch (error) {
      result.errors = result.errors ?? [];
      result.errors.push(
        `Generation eval failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return result;
}

// =============================================================================
// Report Building
// =============================================================================

/**
 * Build the evaluation report from results
 */
function buildReport(
  dataset: EvalDataset,
  results: EvalResult[],
  config: EvalConfig,
  durationMs: number
): EvalReport {
  // Group results by category
  const byCategory = groupBy(results, (r) => r.category);

  // Group results by difficulty
  const byDifficulty = groupBy(results, (r) => {
    const query = dataset.queries.find((q) => q.id === r.queryId);
    return query?.difficulty ?? 'medium';
  });

  // Calculate aggregates
  const allRetrievalMetrics = results.map((r) => r.retrieval);
  const allGenerationMetrics = results
    .filter((r) => r.generation)
    .map((r) => ({
      faithfulness: r.generation?.faithfulness ?? 0,
      relevancy: r.generation?.relevancy ?? 0,
      completeness: r.generation?.completeness ?? 0,
    }));

  const overall = aggregateMetrics(
    allRetrievalMetrics,
    allGenerationMetrics.length > 0 ? allGenerationMetrics : undefined
  );

  // Build category aggregates
  const categoryAggregates: Record<EvalCategory, AggregateMetrics> = {} as Record<
    EvalCategory,
    AggregateMetrics
  >;
  for (const [category, categoryResults] of Object.entries(byCategory)) {
    const metrics = categoryResults.map((r) => r.retrieval);
    const genMetrics = categoryResults
      .filter((r) => r.generation)
      .map((r) => ({
        faithfulness: r.generation?.faithfulness ?? 0,
        relevancy: r.generation?.relevancy ?? 0,
        completeness: r.generation?.completeness ?? 0,
      }));
    categoryAggregates[category as EvalCategory] = aggregateMetrics(
      metrics,
      genMetrics.length > 0 ? genMetrics : undefined
    );
  }

  // Build difficulty aggregates
  const difficultyAggregates: Record<EvalDifficulty, AggregateMetrics> = {} as Record<
    EvalDifficulty,
    AggregateMetrics
  >;
  for (const [difficulty, diffResults] of Object.entries(byDifficulty)) {
    const metrics = diffResults.map((r) => r.retrieval);
    difficultyAggregates[difficulty as EvalDifficulty] = aggregateMetrics(metrics);
  }

  // Identify failures
  const zeroHits = results.filter((r) => r.retrieval.hit_rate === 0).map((r) => r.queryId);

  const lowFaithfulness = results
    .filter((r) => r.generation && r.generation.faithfulness < 0.5)
    .map((r) => r.queryId);

  const highLatency = results.filter((r) => r.retrieval.latency_ms > 2000).map((r) => r.queryId);

  return {
    metadata: {
      id: `eval-${Date.now()}`,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      config,
      duration_ms: durationMs,
    },
    overall,
    byCategory: categoryAggregates,
    byDifficulty: difficultyAggregates,
    results,
    failures: {
      zeroHits,
      lowFaithfulness,
      highLatency,
    },
  };
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Group array items by a key function
 */
function groupBy<T, K extends string>(items: T[], keyFn: (item: T) => K): Record<K, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  }
  return groups as Record<K, T[]>;
}

/**
 * Load a dataset from a JSON file
 */
export async function loadDataset(filePath: string): Promise<EvalDataset> {
  const fs = await import('node:fs/promises');
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as EvalDataset;
}

/**
 * Save a report to a JSON file
 */
export async function saveReport(report: EvalReport, filePath: string): Promise<void> {
  const fs = await import('node:fs/promises');
  await fs.writeFile(filePath, JSON.stringify(report, null, 2));
}

/**
 * Create a default config with overrides
 */
export function createConfig(overrides: Partial<EvalConfig> = {}): EvalConfig {
  return {
    evaluateGeneration: true,
    searchMode: 'hybrid',
    rerank: true,
    topK: 10,
    concurrency: 5,
    timeoutMs: 30000,
    ...overrides,
  };
}
