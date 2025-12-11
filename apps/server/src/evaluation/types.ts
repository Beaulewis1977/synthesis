/**
 * RAG Evaluation Types
 *
 * Type definitions for the Synthesis RAG evaluation framework.
 * Covers both retrieval quality and generation quality metrics.
 */

// =============================================================================
// Evaluation Query Types
// =============================================================================

/**
 * Category of the evaluation query - maps to different use cases
 */
export type EvalCategory = 'docs' | 'code' | 'mobile' | 'general';

/**
 * Difficulty level for the query
 */
export type EvalDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Type of query based on expected answer format
 */
export type EvalQueryType = 'factual' | 'conceptual' | 'how-to' | 'comparison' | 'troubleshooting';

/**
 * A single evaluation query with ground truth annotations
 */
export interface EvalQuery {
  /** Unique identifier for the query */
  id: string;

  /** The search/chat query text */
  query: string;

  /** Category for grouping and filtering */
  category: EvalCategory;

  /** Difficulty level */
  difficulty: EvalDifficulty;

  /** Type of query */
  queryType: EvalQueryType;

  /** Document IDs that are relevant to this query (ground truth for retrieval) */
  relevantDocIds: string[];

  /** Chunk IDs that directly answer the query (more granular ground truth) */
  relevantChunkIds?: string[];

  /** Expected/ideal answer for generation evaluation */
  expectedAnswer?: string;

  /** Keywords that MUST appear in a correct answer */
  requiredKeywords?: string[];

  /** Keywords that should NOT appear (indicates wrong topic) */
  excludedKeywords?: string[];

  /** Collection ID to search in (optional, defaults to all) */
  collectionId?: string;

  /** Additional metadata for analysis */
  metadata?: {
    /** Source of this query (manual, synthetic, user-derived) */
    source?: 'manual' | 'synthetic' | 'user-derived';
    /** Date the query was created */
    createdAt?: string;
    /** Any tags for filtering */
    tags?: string[];
    /** Notes about the query */
    notes?: string;
    /** Source chunk ID (for synthetic queries) */
    sourceChunkId?: string;
    /** Source document title (for synthetic queries) */
    sourceDocTitle?: string;
  };
}

// =============================================================================
// Search Result Types (for evaluation)
// =============================================================================

/**
 * A search result as returned by the RAG system
 */
export interface EvalSearchResult {
  /** Chunk ID */
  chunkId: string;

  /** Parent document ID */
  docId: string;

  /** Document title */
  docTitle: string;

  /** Chunk text content */
  text: string;

  /** Similarity/relevance score from search */
  score: number;

  /** Rank position (1-indexed) */
  rank: number;

  /** Whether this result was reranked */
  reranked?: boolean;

  /** Original rank before reranking */
  originalRank?: number;
}

// =============================================================================
// Retrieval Metrics
// =============================================================================

/**
 * Retrieval quality metrics for a single query
 */
export interface RetrievalMetrics {
  /** Mean Reciprocal Rank - position of first relevant result */
  mrr: number;

  /** Normalized Discounted Cumulative Gain at k=5 */
  ndcg_at_5: number;

  /** Normalized Discounted Cumulative Gain at k=10 */
  ndcg_at_10: number;

  /** Recall at k=3 - fraction of relevant docs in top 3 */
  recall_at_3: number;

  /** Recall at k=5 - fraction of relevant docs in top 5 */
  recall_at_5: number;

  /** Recall at k=10 - fraction of relevant docs in top 10 */
  recall_at_10: number;

  /** Precision at k=5 - fraction of top 5 that are relevant */
  precision_at_5: number;

  /** Hit rate - whether at least one relevant doc was retrieved */
  hit_rate: number;

  /** Search latency in milliseconds */
  latency_ms: number;

  /** Number of results returned */
  num_results: number;

  /** Search mode used (vector, hybrid, bm25) */
  search_mode: 'vector' | 'hybrid' | 'bm25';

  /** Whether reranking was applied */
  reranked: boolean;
}

// =============================================================================
// Generation Metrics (LLM-as-Judge)
// =============================================================================

/**
 * Generation quality metrics for a single query (scored 0-1)
 */
export interface GenerationMetrics {
  /** Faithfulness - is the answer grounded in the retrieved context? */
  faithfulness: number;

  /** Relevancy - does the answer address the query? */
  relevancy: number;

  /** Completeness - are all key points covered? */
  completeness: number;

  /** Coherence - is the answer well-structured and readable? */
  coherence: number;

  /** Citation accuracy - are sources referenced correctly? */
  citation_accuracy: number;

  /** Generation latency in milliseconds */
  latency_ms: number;

  /** Number of tokens in the response */
  response_tokens: number;

  /** Judge's reasoning for the scores */
  reasoning: string;
}

// =============================================================================
// Evaluation Results
// =============================================================================

/**
 * Complete evaluation result for a single query
 */
export interface EvalResult {
  /** Query ID */
  queryId: string;

  /** The original query */
  query: string;

  /** Category */
  category: EvalCategory;

  /** Timestamp of evaluation */
  evaluatedAt: string;

  /** Retrieval metrics */
  retrieval: RetrievalMetrics;

  /** Generation metrics (optional - only if generation was evaluated) */
  generation?: GenerationMetrics;

  /** The search results returned */
  searchResults: EvalSearchResult[];

  /** The generated answer (if applicable) */
  generatedAnswer?: string;

  /** Any errors during evaluation */
  errors?: string[];
}

// =============================================================================
// Aggregate Metrics
// =============================================================================

/**
 * Aggregated metrics across multiple queries
 */
export interface AggregateMetrics {
  /** Number of queries evaluated */
  count: number;

  /** Mean values */
  mean: {
    mrr: number;
    ndcg_at_5: number;
    ndcg_at_10: number;
    recall_at_3: number;
    recall_at_5: number;
    recall_at_10: number;
    precision_at_5: number;
    hit_rate: number;
    latency_ms: number;
    faithfulness?: number;
    relevancy?: number;
    completeness?: number;
  };

  /** Standard deviation */
  stddev: {
    mrr: number;
    ndcg_at_5: number;
    recall_at_5: number;
    latency_ms: number;
    faithfulness?: number;
    relevancy?: number;
  };

  /** Percentiles */
  percentiles: {
    latency_p50: number;
    latency_p95: number;
    latency_p99: number;
  };
}

// =============================================================================
// Evaluation Report
// =============================================================================

/**
 * Complete evaluation report
 */
export interface EvalReport {
  /** Report metadata */
  metadata: {
    /** Report ID */
    id: string;
    /** Timestamp */
    timestamp: string;
    /** Version of evaluation framework */
    version: string;
    /** Configuration used */
    config: EvalConfig;
    /** Total duration in ms */
    duration_ms: number;
  };

  /** Overall metrics across all queries */
  overall: AggregateMetrics;

  /** Metrics broken down by category */
  byCategory: Record<EvalCategory, AggregateMetrics>;

  /** Metrics broken down by difficulty */
  byDifficulty: Record<EvalDifficulty, AggregateMetrics>;

  /** Individual query results */
  results: EvalResult[];

  /** Comparison with baseline (if provided) */
  comparison?: {
    baselineId: string;
    deltas: {
      mrr: number;
      ndcg_at_5: number;
      recall_at_5: number;
      faithfulness?: number;
    };
    improved: string[];
    regressed: string[];
  };

  /** Notable failures for debugging */
  failures: {
    /** Queries with zero relevant results retrieved */
    zeroHits: string[];
    /** Queries with low faithfulness (<0.5) */
    lowFaithfulness: string[];
    /** Queries with high latency (>2s) */
    highLatency: string[];
  };
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Evaluation mode determines how relevance is calculated
 */
export type EvaluationMode = 'doc' | 'chunk' | 'flexible';

/**
 * Evaluation configuration
 */
export interface EvalConfig {
  /** Categories to evaluate */
  categories?: EvalCategory[];

  /** Whether to run generation evaluation */
  evaluateGeneration: boolean;

  /** Search mode to use */
  searchMode: 'vector' | 'hybrid' | 'bm25';

  /** Whether to enable reranking */
  rerank: boolean;

  /** Top K for retrieval */
  topK: number;

  /** Collection IDs to search (empty = all) */
  collectionIds?: string[];

  /** Baseline report ID to compare against */
  baselineId?: string;

  /** Maximum concurrent evaluations */
  concurrency: number;

  /** Timeout per query in ms */
  timeoutMs: number;

  /** Evaluation mode - how to match relevant results
   * - 'doc': Always match by document ID (any chunk from relevant doc counts)
   * - 'chunk': Match by chunk ID if available, otherwise doc ID
   * - 'flexible': Same as 'doc' (any chunk from relevant doc counts)
   * @default 'doc'
   */
  evaluationMode?: EvaluationMode;
}

/**
 * Default evaluation configuration
 */
export const DEFAULT_EVAL_CONFIG: EvalConfig = {
  evaluateGeneration: true,
  searchMode: 'hybrid',
  rerank: true,
  topK: 10,
  concurrency: 5,
  timeoutMs: 30000,
  evaluationMode: 'doc',
};

// =============================================================================
// Dataset Types
// =============================================================================

/**
 * A complete evaluation dataset
 */
export interface EvalDataset {
  /** Dataset metadata */
  metadata: {
    name: string;
    description: string;
    version: string;
    createdAt: string;
    source: 'manual' | 'synthetic' | 'mixed';
  };

  /** The queries in this dataset */
  queries: EvalQuery[];
}
