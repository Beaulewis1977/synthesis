import { getPool } from '@synthesis/db';
import type { TextClassificationPipeline } from '@xenova/transformers';
import { CohereClient } from 'cohere-ai';
import { getCostTracker } from './cost-tracker.js';

export type RerankerProvider = 'cohere' | 'bge' | 'none';

export interface RerankOptions {
  provider?: RerankerProvider;
  topK?: number;
  maxCandidates?: number;
}

export interface RerankCandidate {
  text: string;
  similarity?: number;
}

export type RerankedResult<T extends RerankCandidate> = T & {
  rerankScore: number;
  rerankProvider: Exclude<RerankerProvider, 'none'> | 'none';
  originalSimilarity?: number;
};

const FALLBACK_PROVIDER: RerankerProvider = 'bge';
const MAX_SUPPORTED_CANDIDATES = 50;

const configuredProvider = normalizeProvider(process.env.RERANKER_PROVIDER);
const defaultMaxCandidates = clampPositiveInt(
  process.env.RERANK_MAX_CANDIDATES,
  MAX_SUPPORTED_CANDIDATES,
  MAX_SUPPORTED_CANDIDATES
);
const defaultTopK = clampPositiveInt(process.env.RERANK_DEFAULT_TOP_K, 50, 15);
const defaultBgeBatchSize = clampPositiveInt(process.env.RERANK_BATCH_SIZE, 50, 8);

let cohereClient: CohereClient | null = null;
let bgePipelinePromise: Promise<TextClassificationPipeline> | null = null;

export function selectRerankerProvider(override?: RerankerProvider): RerankerProvider {
  const envOverride = normalizeProvider(process.env.RERANKER_PROVIDER_OVERRIDE);
  const provider = normalizeProvider(override ?? envOverride ?? configuredProvider);
  const cohereKeyRaw = process.env.COHERE_API_KEY;
  const cohereKey = cohereKeyRaw ? cohereKeyRaw.trim() : '';

  if (
    provider === 'cohere' &&
    (!cohereKey || cohereKey.length === 0 || cohereKey.toLowerCase() === 'undefined')
  ) {
    return FALLBACK_PROVIDER;
  }

  return provider;
}

export function getRerankMaxCandidates(): number {
  return defaultMaxCandidates;
}

export function getRerankDefaultTopK(): number {
  return defaultTopK;
}

export async function rerankResults<T extends RerankCandidate>(
  query: string,
  results: T[],
  options: RerankOptions = {}
): Promise<RerankedResult<T>[]> {
  if (!results.length) {
    return [];
  }

  const provider = selectRerankerProvider(options.provider);
  const topK = clampPositiveInt(options.topK, results.length, defaultTopK);
  const maxCandidates = Math.min(
    clampPositiveInt(options.maxCandidates, results.length, defaultMaxCandidates),
    MAX_SUPPORTED_CANDIDATES,
    results.length
  );

  if (provider === 'none') {
    return passthrough(results.slice(0, topK), provider);
  }

  const candidates = results.slice(0, maxCandidates);

  try {
    const reranked =
      provider === 'cohere'
        ? await rerankWithCohere(query, candidates)
        : await rerankWithBGE(query, candidates);

    return reranked.slice(0, topK);
  } catch (error) {
    if (provider === 'cohere') {
      try {
        const fallback = await rerankWithBGE(query, candidates);
        return fallback.slice(0, topK);
      } catch {
        return passthrough(candidates.slice(0, topK), 'none');
      }
    }

    return passthrough(candidates.slice(0, topK), 'none');
  }
}

async function rerankWithCohere<T extends RerankCandidate>(
  query: string,
  results: T[]
): Promise<RerankedResult<T>[]> {
  const client = await getCohereClient();
  const response = await client.rerank({
    query,
    documents: results.map((item) => item.text ?? ''),
    topN: results.length,
    model: 'rerank-english-v3.0',
    returnDocuments: false,
  });

  // Track cost (Cohere charges per request, not per token)
  trackRerankCost().catch((err) => console.error('Cost tracking failed:', err));

  const scored = response.results
    .map((entry) => {
      if (typeof entry.index !== 'number') {
        return null;
      }

      const base = results[entry.index];
      if (!base) {
        return null;
      }

      return withRerankData(base, entry.relevanceScore ?? 0, 'cohere');
    })
    .filter((item): item is RerankedResult<T> => Boolean(item));

  return scored.sort((a, b) => b.rerankScore - a.rerankScore);
}

async function rerankWithBGE<T extends RerankCandidate>(
  query: string,
  results: T[]
): Promise<RerankedResult<T>[]> {
  const reranker = await loadBGEReranker();
  const batchSize = Math.max(1, defaultBgeBatchSize);
  const scored: RerankedResult<T>[] = [];

  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);

    for (const candidate of batch) {
      const output = await reranker(`${query} [SEP] ${candidate.text}`);
      const primary = Array.isArray(output) ? output[0] : output;
      const score = extractScore(primary);
      scored.push(withRerankData(candidate, score, 'bge'));
    }
  }

  return scored.sort((a, b) => b.rerankScore - a.rerankScore);
}

async function getCohereClient(): Promise<CohereClient> {
  if (cohereClient) {
    return cohereClient;
  }

  const token = process.env.COHERE_API_KEY;
  if (!token) {
    throw new Error('COHERE_API_KEY is required for Cohere reranking');
  }

  cohereClient = new CohereClient({ token });
  return cohereClient;
}

async function loadBGEReranker(): Promise<TextClassificationPipeline> {
  if (!bgePipelinePromise) {
    bgePipelinePromise = import('@xenova/transformers').then(async ({ pipeline }) => {
      const loaded = await pipeline('text-classification', 'BAAI/bge-reranker-base');
      return loaded as TextClassificationPipeline;
    });
  }

  return bgePipelinePromise;
}

function withRerankData<T extends RerankCandidate>(
  item: T,
  score: number,
  provider: Exclude<RerankerProvider, 'none'>
): RerankedResult<T> {
  const numericScore = Number.isFinite(score) ? Number(score) : 0;

  return {
    ...item,
    rerankScore: numericScore,
    rerankProvider: provider,
    originalSimilarity: item.similarity,
  };
}

function passthrough<T extends RerankCandidate>(
  items: T[],
  provider: RerankerProvider
): RerankedResult<T>[] {
  return items.map((item) => ({
    ...item,
    rerankScore: Number(item.similarity ?? 0),
    rerankProvider: provider,
    originalSimilarity: item.similarity,
  }));
}

function extractScore(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (Array.isArray(value) && value.length > 0) {
    return extractScore(value[0]);
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.score === 'number') {
      return record.score;
    }
    if (typeof record.value === 'number') {
      return record.value;
    }
  }

  return 0;
}

function normalizeProvider(provider?: string | null): RerankerProvider {
  switch ((provider ?? '').toLowerCase()) {
    case 'cohere':
      return 'cohere';
    case 'bge':
      return 'bge';
    case 'none':
      return 'none';
    default:
      return 'none';
  }
}

function clampPositiveInt(
  value: number | string | undefined,
  max: number,
  fallback: number
): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.min(fallback, max);
  }

  return Math.min(parsed, max);
}

/**
 * Track Cohere reranking cost (async, non-blocking)
 * Cohere charges per request, not per token
 */
async function trackRerankCost(): Promise<void> {
  try {
    const db = getPool();
    const costTracker = getCostTracker(db);

    await costTracker.track({
      provider: 'cohere',
      operation: 'rerank',
      tokens: 1, // Cohere charges per request
      model: 'rerank-english-v3.0',
    });
  } catch (err) {
    console.error('Cost tracking failed:', err);
  }
}
