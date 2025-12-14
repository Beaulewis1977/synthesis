import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { getPool } from '@synthesis/db';
import { type VoyageAI, VoyageAIClient } from '@voyageai/voyageai';
import type { TextClassificationPipeline } from '@xenova/transformers';
import { CohereClient } from 'cohere-ai';
import {
  createRerankCacheKey,
  getCachedRerankResults,
  setCachedRerankResults,
} from './cache/rerank-cache.js';
import { getCostTracker } from './cost-tracker.js';
import { observeRerankLatency } from './metrics.js';
import { getModelConfigService } from './model-config-service.js';
import { createSnippet } from './snippet.js';

export type RerankerProvider = 'cohere' | 'bge' | 'voyage' | 'none';

export interface RerankerConfig {
  provider: RerankerProvider;
  model: string;
}

export interface RerankOptions {
  provider?: RerankerProvider;
  model?: string;
  topK?: number;
  maxCandidates?: number;
}

export interface RerankCandidate {
  text: string;
  snippet?: string;
  similarity?: number;
}

export type RerankedResult<T extends RerankCandidate> = T & {
  rerankScore: number;
  rerankProvider: Exclude<RerankerProvider, 'none'> | 'none';
  originalSimilarity?: number;
};

interface PreparedCandidate<T extends RerankCandidate> {
  original: T;
  documentText: string;
  signature: string;
}

const FALLBACK_PROVIDER: RerankerProvider = 'bge';
const MAX_SUPPORTED_CANDIDATES = 50;
const DEFAULT_MODELS: Record<Exclude<RerankerProvider, 'none'>, string> = {
  bge: 'BAAI/bge-reranker-base',
  cohere: 'rerank-english-v3.0',
  voyage: 'rerank-2.5',
};

const defaultMaxCandidates = clampPositiveInt(
  process.env.RERANK_MAX_CANDIDATES,
  MAX_SUPPORTED_CANDIDATES,
  MAX_SUPPORTED_CANDIDATES
);
const defaultTopK = clampPositiveInt(process.env.RERANK_DEFAULT_TOP_K, 50, 10);
const defaultBgeBatchSize = clampPositiveInt(process.env.RERANK_BATCH_SIZE, 50, 8);
const HARD_RERANK_CAP = 10;
const RERANK_TEXT_LIMIT = readPositiveInt(process.env.RERANK_TEXT_LIMIT, 200);

let cohereClient: CohereClient | null = null;
let voyageClient: VoyageAIClient | null = null;
const bgePipelines = new Map<string, Promise<TextClassificationPipeline>>();

function getConfiguredProvider(): RerankerProvider {
  return parseProvider(process.env.RERANKER_PROVIDER) ?? 'none';
}

/**
 * Select reranker provider synchronously (legacy, uses env vars)
 * @deprecated Use selectRerankerProviderAsync for ModelConfigService support
 */
export function selectRerankerProvider(override?: RerankerProvider): RerankerProvider {
  const envOverride = parseProvider(process.env.RERANKER_PROVIDER_OVERRIDE);
  const provider = override ?? envOverride ?? getConfiguredProvider();
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

/**
 * Select reranker provider using ModelConfigService (async)
 * This is the preferred method for new code
 */
export async function selectRerankerProviderAsync(
  override?: RerankerProvider
): Promise<RerankerProvider> {
  const config = await selectRerankerConfigAsync({ provider: override });
  return config.provider;
}

/**
 * Validate reranker provider and check API key availability
 */
function validateRerankerProvider(provider: RerankerProvider): RerankerProvider {
  if (provider === 'cohere') {
    const cohereKeyRaw = process.env.COHERE_API_KEY;
    const cohereKey = cohereKeyRaw ? cohereKeyRaw.trim() : '';

    if (!cohereKey || cohereKey.length === 0 || cohereKey.toLowerCase() === 'undefined') {
      return FALLBACK_PROVIDER;
    }
  }

  if (provider === 'voyage') {
    const voyageKeyRaw = process.env.VOYAGE_API_KEY;
    const voyageKey = voyageKeyRaw ? voyageKeyRaw.trim() : '';

    if (!voyageKey || voyageKey.length === 0 || voyageKey.toLowerCase() === 'undefined') {
      return FALLBACK_PROVIDER;
    }
  }

  return provider;
}

export function getRerankMaxCandidates(): number {
  return defaultMaxCandidates;
}

export function getRerankDefaultTopK(): number {
  return defaultTopK;
}

export async function selectRerankerConfigAsync(
  overrides: Partial<RerankerConfig> = {}
): Promise<RerankerConfig> {
  const overrideModel = overrides.model;
  const envModel = process.env.RERANKER_MODEL;

  if (overrides.provider) {
    const validatedProvider = validateRerankerProvider(overrides.provider);
    return {
      provider: validatedProvider,
      model: selectModelForProvider(validatedProvider, overrideModel ?? envModel),
    };
  }

  try {
    const db = getPool();
    const modelConfigService = getModelConfigService(db);
    const config = await modelConfigService.getRerankerConfig();

    const providerFromConfig = parseProvider(config.provider) ?? 'none';
    const validatedProvider = validateRerankerProvider(providerFromConfig);

    return {
      provider: validatedProvider,
      model: selectModelForProvider(validatedProvider, overrideModel ?? config.model),
    };
  } catch {
    const providerFallback = selectRerankerProvider();
    const validatedProvider = validateRerankerProvider(providerFallback);

    return {
      provider: validatedProvider,
      model: selectModelForProvider(validatedProvider, overrideModel ?? envModel),
    };
  }
}

function selectModelForProvider(provider: RerankerProvider, candidate?: string | null): string {
  if (provider === 'none') {
    return '';
  }

  const defaultModel = DEFAULT_MODELS[provider];
  if (!candidate || candidate.trim() === '') {
    return defaultModel;
  }

  const normalized = candidate.toLowerCase();
  if (provider === 'bge') {
    return normalized.includes('bge-reranker') ? candidate : defaultModel;
  }

  if (provider === 'voyage' || provider === 'cohere') {
    return normalized.startsWith('rerank-') ? candidate : defaultModel;
  }

  return defaultModel;
}

export async function rerankResults<T extends RerankCandidate>(
  query: string,
  results: T[],
  options: RerankOptions = {}
): Promise<RerankedResult<T>[]> {
  if (!results.length) {
    return [];
  }

  // Use async provider selection to get config from ModelConfigService (UI settings)
  const { provider, model } = await selectRerankerConfigAsync({
    provider: options.provider,
    model: options.model,
  });
  const topK = Math.min(
    clampPositiveInt(options.topK, results.length, defaultTopK),
    HARD_RERANK_CAP
  );
  const maxCandidates = Math.min(
    clampPositiveInt(options.maxCandidates, results.length, defaultMaxCandidates),
    MAX_SUPPORTED_CANDIDATES,
    results.length,
    HARD_RERANK_CAP
  );

  if (provider === 'none') {
    return passthrough(results.slice(0, topK), provider);
  }

  const preparedCandidates = prepareCandidates(results, maxCandidates);

  let cacheKey: string | null = null;
  const cacheProviderKey = model ? `${provider}:${model}` : provider;
  cacheKey = createRerankCacheKey({
    query,
    provider: cacheProviderKey,
    documents: preparedCandidates.map((item) => item.documentText),
    signatures: preparedCandidates.map((item) => item.signature),
    topK,
  });

  if (cacheKey) {
    const cached = await getCachedRerankResults<RerankedResult<T>[]>(cacheKey);
    if (cached) {
      return cached.slice(0, topK);
    }
  }

  try {
    let reranked: RerankedResult<T>[];

    if (provider === 'cohere') {
      reranked = await rerankWithCohere(query, preparedCandidates, model);
    } else if (provider === 'voyage') {
      reranked = await rerankWithVoyage(query, preparedCandidates, model);
    } else {
      reranked = await rerankWithBGE(query, preparedCandidates, model);
    }

    if (cacheKey) {
      await setCachedRerankResults(cacheKey, reranked);
    }

    return reranked.slice(0, topK);
  } catch (error) {
    if (provider === 'cohere' || provider === 'voyage') {
      try {
        const fallback = await rerankWithBGE(query, preparedCandidates, DEFAULT_MODELS.bge);
        return fallback.slice(0, topK);
      } catch {
        return passthrough(
          preparedCandidates.slice(0, topK).map((entry) => entry.original),
          'none'
        );
      }
    }

    return passthrough(
      preparedCandidates.slice(0, topK).map((entry) => entry.original),
      'none'
    );
  }
}

async function rerankWithCohere<T extends RerankCandidate>(
  query: string,
  candidates: PreparedCandidate<T>[],
  model: string
): Promise<RerankedResult<T>[]> {
  const client = await getCohereClient();
  const start = performance.now();
  const response = await client.rerank({
    query,
    documents: candidates.map((item) => item.documentText),
    topN: candidates.length,
    model,
    returnDocuments: false,
  });
  observeRerankLatency('cohere', Math.round(performance.now() - start));

  // Track cost (Cohere charges per request, not per token)
  trackRerankCost(model).catch((err) => console.error('Cost tracking failed:', err));

  const scored = response.results
    .map((entry) => {
      if (typeof entry.index !== 'number') {
        return null;
      }

      const base = candidates[entry.index];
      if (!base) {
        return null;
      }

      return withRerankData(base.original, entry.relevanceScore ?? 0, 'cohere');
    })
    .filter((item): item is RerankedResult<T> => Boolean(item));

  return scored.sort((a, b) => b.rerankScore - a.rerankScore);
}

async function rerankWithVoyage<T extends RerankCandidate>(
  query: string,
  candidates: PreparedCandidate<T>[],
  model: string
): Promise<RerankedResult<T>[]> {
  const client = await getVoyageClient();
  const start = performance.now();

  const response = await client.rerank({
    query,
    documents: candidates.map((item) => item.documentText),
    model,
    topK: candidates.length,
  });

  observeRerankLatency('voyage', Math.round(performance.now() - start));

  // Track cost (Voyage charges per request)
  trackVoyageRerankCost(model).catch((err) => console.error('Cost tracking failed:', err));

  const results: VoyageAI.RerankResponseDataItem[] = response.data ?? [];
  const scored = results
    .map((entry: VoyageAI.RerankResponseDataItem) => {
      if (typeof entry.index !== 'number') {
        return null;
      }

      const base = candidates[entry.index];
      if (!base) {
        return null;
      }

      return withRerankData(base.original, entry.relevanceScore ?? 0, 'voyage');
    })
    .filter((item): item is RerankedResult<T> => Boolean(item));

  return scored.sort((a: RerankedResult<T>, b: RerankedResult<T>) => b.rerankScore - a.rerankScore);
}

async function rerankWithBGE<T extends RerankCandidate>(
  query: string,
  candidates: PreparedCandidate<T>[],
  model: string
): Promise<RerankedResult<T>[]> {
  const reranker = await loadBGEReranker(model);
  const start = performance.now();
  const batchSize = Math.max(1, defaultBgeBatchSize);
  const scored: RerankedResult<T>[] = [];

  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);

    for (const candidate of batch) {
      const output = await reranker(`${query} [SEP] ${candidate.documentText}`);
      const primary = Array.isArray(output) ? output[0] : output;
      const score = extractScore(primary);
      scored.push(withRerankData(candidate.original, score, 'bge'));
    }
  }

  const ordered = scored.sort((a, b) => b.rerankScore - a.rerankScore);
  observeRerankLatency('bge', Math.round(performance.now() - start));
  return ordered;
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

async function getVoyageClient(): Promise<VoyageAIClient> {
  if (voyageClient) {
    return voyageClient;
  }

  const apiKeyRaw = process.env.VOYAGE_API_KEY;
  const apiKey = apiKeyRaw ? apiKeyRaw.trim() : '';

  if (!apiKey || apiKey.length === 0 || apiKey.toLowerCase() === 'undefined') {
    throw new Error('VOYAGE_API_KEY is required for Voyage reranking');
  }

  voyageClient = new VoyageAIClient({ apiKey });
  return voyageClient;
}

async function loadBGEReranker(model: string): Promise<TextClassificationPipeline> {
  const modelToLoad = model || DEFAULT_MODELS.bge;
  const existing = bgePipelines.get(modelToLoad);
  if (existing) {
    return existing;
  }

  const promise = import('@xenova/transformers').then(async ({ pipeline }) => {
    const loaded = await pipeline('text-classification', modelToLoad);
    return loaded as TextClassificationPipeline;
  });
  bgePipelines.set(modelToLoad, promise);
  return promise;
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

function prepareCandidates<T extends RerankCandidate>(
  candidates: T[],
  cap: number
): PreparedCandidate<T>[] {
  return candidates.slice(0, cap).map((candidate, index) => {
    const documentText = buildRerankDocument(candidate);
    return {
      original: candidate,
      documentText,
      signature: buildCandidateSignature(candidate, documentText, index),
    };
  });
}

function buildRerankDocument(candidate: RerankCandidate): string {
  const title =
    (candidate as { docTitle?: string | null }).docTitle ??
    (candidate as { doc_title?: string | null }).doc_title ??
    '';
  const rawText = (candidate.text ?? '').replace(/\s+/g, ' ').trim();
  const baseSnippet = candidate.snippet ?? createSnippet(rawText, RERANK_TEXT_LIMIT);
  const snippet = (baseSnippet.length > 0 ? baseSnippet : rawText).slice(0, RERANK_TEXT_LIMIT);

  if (title && snippet) {
    return `${title} — ${snippet}`;
  }

  return title || snippet || '';
}

function buildCandidateSignature(
  candidate: RerankCandidate,
  documentText: string,
  index: number
): string {
  const identifier =
    (candidate as { id?: string | number }).id ??
    (candidate as { docId?: string }).docId ??
    (candidate as { doc_id?: string }).doc_id ??
    `idx-${index}`;
  const hash = createHash('sha1').update(documentText).digest('hex');
  return `${identifier}:${hash}`;
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

function parseProvider(provider?: string | null): RerankerProvider | undefined {
  if (!provider || provider.trim() === '') {
    return undefined;
  }
  return normalizeProvider(provider);
}

function normalizeProvider(provider?: string | null): RerankerProvider {
  switch ((provider ?? '').toLowerCase()) {
    case 'cohere':
      return 'cohere';
    case 'bge':
      return 'bge';
    case 'voyage':
      return 'voyage';
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

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

/**
 * Track Cohere reranking cost (async, non-blocking)
 * Cohere charges per request, not per token
 */
async function trackRerankCost(model: string): Promise<void> {
  try {
    const db = getPool();
    const costTracker = getCostTracker(db);

    await costTracker.track({
      provider: 'cohere',
      operation: 'rerank',
      tokens: 1, // Cohere charges per request
      model,
    });
  } catch (err) {
    console.error('Cost tracking failed:', err);
  }
}

/**
 * Track Voyage reranking cost (async, non-blocking)
 * Voyage charges per request
 */
async function trackVoyageRerankCost(model: string): Promise<void> {
  try {
    const db = getPool();
    const costTracker = getCostTracker(db);

    await costTracker.track({
      provider: 'voyage',
      operation: 'rerank',
      tokens: 1, // Voyage charges per request
      model,
    });
  } catch (err) {
    console.error('Voyage cost tracking failed:', err);
  }
}
