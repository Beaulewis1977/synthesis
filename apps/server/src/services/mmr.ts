/**
 * Maximal Marginal Relevance (MMR) Implementation
 *
 * MMR is a technique for diversifying search results by balancing relevance
 * and diversity. It iteratively selects results that are both relevant to
 * the query and dissimilar to already-selected results.
 *
 * Formula: MMR(d) = λ * relevance(d) - (1-λ) * max_similarity(d, selected)
 *
 * Where:
 * - λ (lambda) controls the trade-off: 1.0 = pure relevance, 0.0 = pure diversity
 * - relevance(d) is the original search score
 * - max_similarity(d, selected) is the maximum similarity to any selected result
 *
 * @see https://www.cs.cmu.edu/~jgc/publication/The_Use_MMR_Diversity_Based_LTMIR_1998.pdf
 */

/**
 * Configuration options for MMR diversification
 */
export interface MMROptions {
  /**
   * Lambda parameter controlling relevance vs diversity trade-off.
   * - 1.0 = pure relevance (no diversity boost)
   * - 0.0 = pure diversity (ignore relevance)
   * - 0.5-0.7 = balanced (recommended for most use cases)
   * @default 0.7
   */
  lambda: number;

  /**
   * Whether MMR diversification is enabled
   * @default false
   */
  enabled: boolean;

  /**
   * Minimum similarity difference to consider results as "too similar".
   * Results with similarity above (1 - minSimilarityDiff) to selected
   * results will be penalized more heavily.
   * @default 0.1
   */
  minSimilarityDiff?: number;
}

/**
 * Metrics about the diversification process
 */
export interface MMRDiversityMetrics {
  /** Average pairwise similarity among selected results (lower = more diverse) */
  avgPairwiseSimilarity: number;
  /** Number of results that were deprioritized from original top-K */
  duplicatesRemoved: number;
  /** Number of true near-duplicates (similarity >= 0.95) that were filtered */
  nearDuplicatesFiltered: number;
  /** Original position of each selected result before MMR */
  originalPositions: number[];
  /** The lambda value used */
  lambda: number;
}

/**
 * Result of MMR diversification
 */
export interface MMRResult<T> {
  /** Diversified results */
  results: T[];
  /** Metrics about the diversification */
  metrics: MMRDiversityMetrics;
}

/**
 * Interface for items that can be diversified with MMR.
 * Items must have a relevance score and an embedding vector.
 */
export interface MMRCandidate {
  /** Relevance score (higher = more relevant) */
  relevanceScore: number;
  /** Embedding vector for similarity computation */
  embedding: number[] | null;
}

// Import from shared - single source of truth
import { DEFAULT_MMR_LAMBDA } from '@synthesis/shared';

// Re-export for backwards compatibility with existing imports
export { DEFAULT_MMR_LAMBDA };

/** Default minimum similarity difference threshold */
export const DEFAULT_MIN_SIMILARITY_DIFF = 0.1;

/** Similarity threshold above which results are considered near-duplicates */
export const NEAR_DUPLICATE_THRESHOLD = 0.95;

/**
 * Computes cosine similarity between two vectors.
 *
 * Cosine similarity = (A · B) / (||A|| * ||B||)
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine similarity in range [-1, 1], or 0 if vectors are invalid
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0) {
    return 0;
  }

  if (a.length !== b.length) {
    // Vectors must have same dimensions
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const valA = a[i];
    const valB = b[i];

    // Skip if either value is not a finite number
    if (!Number.isFinite(valA) || !Number.isFinite(valB)) {
      continue;
    }

    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);

  if (denominator === 0) {
    return 0;
  }

  // Clamp to [-1, 1] to handle floating point errors
  const similarity = dotProduct / denominator;
  return Math.max(-1, Math.min(1, similarity));
}

/**
 * Computes the maximum similarity between a candidate and all selected items.
 *
 * @param candidateEmbedding - Embedding of the candidate
 * @param selectedEmbeddings - Embeddings of already selected items
 * @returns Maximum similarity to any selected item (0 if no selections)
 */
function maxSimilarityToSelected(
  candidateEmbedding: number[] | null,
  selectedEmbeddings: (number[] | null)[]
): number {
  if (!candidateEmbedding || selectedEmbeddings.length === 0) {
    return 0;
  }

  let maxSim = 0;

  for (const selectedEmb of selectedEmbeddings) {
    if (!selectedEmb) {
      continue;
    }

    const sim = cosineSimilarity(candidateEmbedding, selectedEmb);
    if (sim > maxSim) {
      maxSim = sim;
    }
  }

  return maxSim;
}

/**
 * Computes the MMR score for a candidate.
 *
 * MMR(d) = λ * relevance(d) - (1-λ) * max_similarity(d, selected)
 *
 * @param relevanceScore - Original relevance score (normalized 0-1)
 * @param maxSimilarity - Maximum similarity to selected items
 * @param lambda - Trade-off parameter
 * @returns MMR score
 */
function computeMMRScore(relevanceScore: number, maxSimilarity: number, lambda: number): number {
  return lambda * relevanceScore - (1 - lambda) * maxSimilarity;
}

/**
 * Normalizes relevance scores to [0, 1] range.
 *
 * @param scores - Array of relevance scores
 * @returns Normalized scores
 */
function normalizeScores(scores: number[]): number[] {
  if (scores.length === 0) {
    return [];
  }

  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const range = maxScore - minScore;

  if (range === 0) {
    // All scores are the same
    return scores.map(() => 1);
  }

  return scores.map((score) => (score - minScore) / range);
}

/**
 * Computes average pairwise similarity among a set of embeddings.
 *
 * @param embeddings - Array of embedding vectors
 * @returns Average pairwise similarity (0 if fewer than 2 embeddings)
 */
function computeAvgPairwiseSimilarity(embeddings: (number[] | null)[]): number {
  const validEmbeddings = embeddings.filter((e): e is number[] => e !== null && e.length > 0);

  if (validEmbeddings.length < 2) {
    return 0;
  }

  let totalSimilarity = 0;
  let pairCount = 0;

  for (let i = 0; i < validEmbeddings.length; i++) {
    for (let j = i + 1; j < validEmbeddings.length; j++) {
      totalSimilarity += cosineSimilarity(validEmbeddings[i], validEmbeddings[j]);
      pairCount++;
    }
  }

  return pairCount > 0 ? totalSimilarity / pairCount : 0;
}

/**
 * Applies Maximal Marginal Relevance (MMR) to diversify search results.
 *
 * The algorithm works as follows:
 * 1. Select the most relevant result first
 * 2. For each subsequent slot, compute MMR score for all remaining candidates
 * 3. Select the candidate with the highest MMR score
 * 4. Repeat until topK results are selected
 *
 * @param candidates - Array of candidate results with relevance scores and embeddings
 * @param topK - Number of results to return
 * @param options - MMR configuration options
 * @returns Diversified results with metrics
 */
export function applyMMR<T extends MMRCandidate>(
  candidates: T[],
  topK: number,
  options: MMROptions
): MMRResult<T> {
  // Validate inputs
  if (!options.enabled || candidates.length === 0) {
    return {
      results: candidates.slice(0, topK),
      metrics: {
        avgPairwiseSimilarity: 0,
        duplicatesRemoved: 0,
        nearDuplicatesFiltered: 0,
        originalPositions: candidates.slice(0, topK).map((_, i) => i),
        lambda: options.lambda,
      },
    };
  }

  const lambda = Math.max(0, Math.min(1, options.lambda));
  const effectiveTopK = Math.min(topK, candidates.length);

  // If lambda is 1.0, MMR has no effect (pure relevance)
  if (lambda >= 1.0) {
    return {
      results: candidates.slice(0, effectiveTopK),
      metrics: {
        avgPairwiseSimilarity: computeAvgPairwiseSimilarity(
          candidates.slice(0, effectiveTopK).map((c) => c.embedding)
        ),
        duplicatesRemoved: 0,
        nearDuplicatesFiltered: 0,
        originalPositions: candidates.slice(0, effectiveTopK).map((_, i) => i),
        lambda,
      },
    };
  }

  // Normalize relevance scores for fair comparison
  const relevanceScores = candidates.map((c) => c.relevanceScore);
  const normalizedScores = normalizeScores(relevanceScores);

  // Track which candidates have been selected
  const selected: T[] = [];
  const selectedEmbeddings: (number[] | null)[] = [];
  const selectedIndices = new Set<number>();
  const originalPositions: number[] = [];

  // Count how many results were moved from their original position
  let positionChanges = 0;

  // Select results iteratively
  for (let slot = 0; slot < effectiveTopK; slot++) {
    let bestIndex = -1;
    let bestMMRScore = Number.NEGATIVE_INFINITY;

    // Find the candidate with the highest MMR score
    for (let i = 0; i < candidates.length; i++) {
      if (selectedIndices.has(i)) {
        continue;
      }

      const candidate = candidates[i];
      const normalizedRelevance = normalizedScores[i];

      // Compute max similarity to already selected items
      const maxSim = maxSimilarityToSelected(candidate.embedding, selectedEmbeddings);

      // Compute MMR score
      const mmrScore = computeMMRScore(normalizedRelevance, maxSim, lambda);

      if (mmrScore > bestMMRScore) {
        bestMMRScore = mmrScore;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) {
      // No more candidates available
      break;
    }

    // Track if this result was moved from its original position
    if (bestIndex !== slot) {
      positionChanges++;
    }

    // Add the best candidate to selected results
    const bestCandidate = candidates[bestIndex];
    selected.push(bestCandidate);
    selectedEmbeddings.push(bestCandidate.embedding);
    selectedIndices.add(bestIndex);
    originalPositions.push(bestIndex);
  }

  // Compute diversity metrics
  const avgPairwiseSimilarity = computeAvgPairwiseSimilarity(selectedEmbeddings);

  // Count near-duplicates that were deprioritized
  // A near-duplicate is a result that would have been in top-K by relevance
  // but was pushed out due to high similarity to selected results
  const originalTopKIndices = new Set(candidates.slice(0, effectiveTopK).map((_, i) => i));
  const duplicatesRemoved = [...originalTopKIndices].filter((i) => !selectedIndices.has(i)).length;

  // Also count true near-duplicates (similarity >= NEAR_DUPLICATE_THRESHOLD) that were deprioritized
  // This provides insight into how many semantically identical results were filtered
  let nearDuplicatesFiltered = 0;
  for (const idx of originalTopKIndices) {
    if (!selectedIndices.has(idx)) {
      const candidate = candidates[idx];
      const maxSim = maxSimilarityToSelected(candidate.embedding, selectedEmbeddings);
      if (maxSim >= NEAR_DUPLICATE_THRESHOLD) {
        nearDuplicatesFiltered++;
      }
    }
  }

  return {
    results: selected,
    metrics: {
      avgPairwiseSimilarity: Number(avgPairwiseSimilarity.toFixed(4)),
      duplicatesRemoved,
      nearDuplicatesFiltered,
      originalPositions,
      lambda,
    },
  };
}

/**
 * Gets the default MMR options from environment variables.
 *
 * @returns Default MMR options
 */
export function getDefaultMMROptions(): MMROptions {
  const envEnabled = process.env.MMR_DEFAULT_ENABLED?.toLowerCase();
  const envLambda = Number.parseFloat(process.env.MMR_DEFAULT_LAMBDA ?? '');

  return {
    enabled: envEnabled === 'true',
    lambda: Number.isFinite(envLambda) ? Math.max(0, Math.min(1, envLambda)) : DEFAULT_MMR_LAMBDA,
    minSimilarityDiff: DEFAULT_MIN_SIMILARITY_DIFF,
  };
}

/**
 * Resolves MMR options by merging request options with defaults.
 *
 * @param requestOptions - Options from the request (partial)
 * @returns Resolved MMR options
 */
export function resolveMMROptions(
  requestOptions?: Partial<Pick<MMROptions, 'enabled' | 'lambda'>>
): MMROptions {
  const defaults = getDefaultMMROptions();

  return {
    enabled: requestOptions?.enabled ?? defaults.enabled,
    lambda:
      requestOptions?.lambda !== undefined
        ? Math.max(0, Math.min(1, requestOptions.lambda))
        : defaults.lambda,
    minSimilarityDiff: defaults.minSimilarityDiff,
  };
}

/**
 * Logs MMR diversification results if enabled via environment variable.
 * Set MMR_LOG=true to enable.
 *
 * @param query - The search query
 * @param metrics - MMR metrics
 * @param resultCount - Number of results returned
 */
export function logMMRResults(
  query: string,
  metrics: MMRDiversityMetrics,
  resultCount: number
): void {
  const enabled = process.env.MMR_LOG?.toLowerCase() === 'true';
  if (!enabled) {
    return;
  }

  const logData = {
    type: 'mmr_diversification',
    query: query.slice(0, 100), // Truncate for logging
    lambda: metrics.lambda,
    resultCount,
    avgPairwiseSimilarity: metrics.avgPairwiseSimilarity,
    duplicatesRemoved: metrics.duplicatesRemoved,
    positionChanges: metrics.originalPositions.filter((pos, idx) => pos !== idx).length,
  };

  // Use structured JSON logging for production compatibility
  // biome-ignore lint/suspicious/noConsoleLog: Intentional diagnostic logging controlled by env var
  console.log(JSON.stringify(logData));
}
