import { performance } from 'node:perf_hooks';
import { getPool } from '@synthesis/db';
import { Ollama } from 'ollama';
import OpenAI from 'openai';
import { getCostTracker } from '../services/cost-tracker.js';
import {
  buildEmbeddingCacheKey,
  getCachedEmbedding,
  setCachedEmbedding,
} from '../services/embedding-cache.js';
import type {
  ContentContext,
  EmbeddingConfig,
  EmbeddingProvider,
} from '../services/embedding-router.js';
import { getProviderConfig, selectEmbeddingProvider } from '../services/embedding-router.js';
import { observeEmbeddingLatency, trackEmbeddingRequest } from '../services/metrics.js';

type VoyageClient = {
  embed: (request: { input: string | string[]; model: string }) => Promise<{
    data?: Array<{ embedding?: number[] | null }>;
  }>;
};

type CohereClient = {
  embed: (request: {
    texts: string[];
    model: string;
    inputType: string;
    embeddingTypes?: string[];
    outputDimension?: number;
  }) => Promise<{
    embeddings?: { float?: number[][] };
  }>;
};

interface OllamaClient {
  embeddings: (input: { model: string; prompt: string }) => Promise<{ embedding: unknown }>;
}

let cachedOllama: OllamaClient | null = null;
let cachedOpenAI: OpenAI | null = null;
let cachedVoyage: VoyageClient | null = null;
let cachedCohere: CohereClient | null = null;

const DEFAULT_BATCH_SIZE = 10;

// Exponential backoff delays: 50ms, 100ms, 250ms
const RETRY_DELAYS = [50, 100, 250];

// Provider health tracking
interface ProviderHealth {
  success: number;
  failure: number;
  lastFailure?: Date;
}

const providerHealthStats = new Map<EmbeddingProvider, ProviderHealth>();

export interface EmbedOptions {
  provider?: EmbeddingProvider;
  model?: string;
  batchSize?: number;
  context?: ContentContext;
}

export interface EmbedBatchOptions extends EmbedOptions {
  contexts?: Array<ContentContext | undefined>;
}

interface OllamaRuntimeConfig {
  model: string;
}

export interface EmbedResult {
  embedding: number[];
  provider: EmbeddingProvider;
  model: string;
  dimensions: number;
  usedFallback: boolean;
}

export function __setOllamaClientForTesting(client: OllamaClient | null): void {
  cachedOllama = client;
}

export function __setOpenAIClientForTesting(client: OpenAI | null): void {
  cachedOpenAI = client;
}

export function __setVoyageClientForTesting(client: VoyageClient | null): void {
  cachedVoyage = client;
}

export function __setCohereClientForTesting(client: CohereClient | null): void {
  cachedCohere = client;
}

/**
 * Get provider health statistics for monitoring
 * Returns success/failure counts and last failure time for each provider
 */
export function getProviderHealth(): Map<EmbeddingProvider, ProviderHealth> {
  return new Map(providerHealthStats);
}

/**
 * Reset provider health statistics (useful for testing)
 */
export function __resetProviderHealth(): void {
  providerHealthStats.clear();
}

/**
 * Track provider success
 */
function trackProviderSuccess(provider: EmbeddingProvider): void {
  const stats = providerHealthStats.get(provider) ?? { success: 0, failure: 0 };
  stats.success++;
  providerHealthStats.set(provider, stats);
}

/**
 * Track provider failure
 */
function trackProviderFailure(provider: EmbeddingProvider): void {
  const stats = providerHealthStats.get(provider) ?? { success: 0, failure: 0 };
  stats.failure++;
  stats.lastFailure = new Date();
  providerHealthStats.set(provider, stats);
}

function getOllamaClient(): OllamaClient {
  if (cachedOllama) {
    return cachedOllama;
  }

  const host = process.env.OLLAMA_HOST ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  cachedOllama = new Ollama({ host });
  return cachedOllama;
}

function getOpenAIClient(): OpenAI {
  if (cachedOpenAI) {
    return cachedOpenAI;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  cachedOpenAI = new OpenAI({ apiKey });
  return cachedOpenAI;
}

export async function embedText(text: string, options: EmbedOptions = {}): Promise<EmbedResult> {
  const resolved = resolveProviderConfig(text, options);
  const overrideModel = options.model?.trim();
  const primaryConfig = overrideModel ? { ...resolved, model: overrideModel } : resolved;
  const cacheKey = buildEmbeddingCacheKey(
    text,
    primaryConfig.provider,
    primaryConfig.model,
    options.context
  );

  const cached = getCachedEmbedding(cacheKey);
  if (cached) {
    trackEmbeddingRequest(cached.provider, true);
    return {
      embedding: cached.embedding,
      provider: cached.provider,
      model: cached.model,
      dimensions: cached.dimensions,
      usedFallback: false,
    };
  }

  try {
    const start = performance.now();
    const embedding = await generateEmbeddingWithRetry(text, primaryConfig, options);
    const duration = Math.round(performance.now() - start);

    trackEmbeddingRequest(primaryConfig.provider, false);
    observeEmbeddingLatency(primaryConfig.provider, duration);
    trackProviderSuccess(primaryConfig.provider);

    // Track cost (async, non-blocking)
    trackEmbeddingCost(primaryConfig, text, options.context).catch((err) =>
      console.error('Cost tracking failed:', err)
    );

    // Use actual returned dimension, not static config
    const actualDimensions = embedding.length;
    if (actualDimensions !== primaryConfig.dimensions) {
      console.warn(
        `[Embed] Dimension mismatch for ${primaryConfig.provider}/${primaryConfig.model}: ` +
          `MODEL_DIMENSIONS says ${primaryConfig.dimensions}, provider returned ${actualDimensions}. ` +
          'Consider updating MODEL_DIMENSIONS map.'
      );
    }

    setCachedEmbedding(cacheKey, {
      embedding,
      provider: primaryConfig.provider,
      model: primaryConfig.model,
      dimensions: actualDimensions,
    });

    return {
      embedding,
      provider: primaryConfig.provider,
      model: primaryConfig.model,
      dimensions: actualDimensions,
      usedFallback: false,
    };
  } catch (error) {
    // Log primary provider failure after all retries exhausted
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      '[Embed] Primary provider failed after retries: ' +
        `provider=${primaryConfig.provider}, model=${primaryConfig.model}, ` +
        `error=${errorMessage}`
    );
    trackProviderFailure(primaryConfig.provider);

    const fallbackConfig = getFallbackConfig(primaryConfig);
    if (fallbackConfig.provider === primaryConfig.provider) {
      throw error;
    }

    console.warn(
      `[Embed] Falling back: ${primaryConfig.provider}/${primaryConfig.model} -> ` +
        `${fallbackConfig.provider}/${fallbackConfig.model}`
    );

    const fallbackKey = buildEmbeddingCacheKey(
      text,
      fallbackConfig.provider,
      fallbackConfig.model,
      options.context
    );

    const cachedFallback = getCachedEmbedding(fallbackKey);
    if (cachedFallback) {
      trackEmbeddingRequest(cachedFallback.provider, true);
      console.info(
        `[Embed] Fallback succeeded (cached): ${fallbackConfig.provider}/${fallbackConfig.model}`
      );
      return {
        embedding: cachedFallback.embedding,
        provider: cachedFallback.provider,
        model: cachedFallback.model,
        dimensions: cachedFallback.dimensions,
        usedFallback: true,
      };
    }

    try {
      const fallbackStart = performance.now();
      const embedding = await generateEmbeddingWithRetry(text, fallbackConfig, options);
      const duration = Math.round(performance.now() - fallbackStart);

      trackEmbeddingRequest(fallbackConfig.provider, false);
      observeEmbeddingLatency(fallbackConfig.provider, duration);
      trackProviderSuccess(fallbackConfig.provider);

      // Track fallback cost (async, non-blocking)
      trackEmbeddingCost(fallbackConfig, text, options.context).catch((err) =>
        console.error('Cost tracking failed:', err)
      );

      // Use actual returned dimension, not static config
      const actualDimensions = embedding.length;
      if (actualDimensions !== fallbackConfig.dimensions) {
        console.warn(
          `[Embed] Dimension mismatch for ${fallbackConfig.provider}/${fallbackConfig.model}: ` +
            `MODEL_DIMENSIONS says ${fallbackConfig.dimensions}, provider returned ${actualDimensions}. ` +
            'Consider updating MODEL_DIMENSIONS map.'
        );
      }

      setCachedEmbedding(fallbackKey, {
        embedding,
        provider: fallbackConfig.provider,
        model: fallbackConfig.model,
        dimensions: actualDimensions,
      });

      console.info(
        `[Embed] Fallback succeeded: ${fallbackConfig.provider}/${fallbackConfig.model} ` +
          `(original: ${primaryConfig.provider}/${primaryConfig.model})`
      );

      return {
        embedding,
        provider: fallbackConfig.provider,
        model: fallbackConfig.model,
        dimensions: actualDimensions,
        usedFallback: true,
      };
    } catch (fallbackError) {
      const fallbackErrorMessage =
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      console.error(
        '[Embed] Fallback provider also failed: ' +
          `provider=${fallbackConfig.provider}, model=${fallbackConfig.model}, ` +
          `error=${fallbackErrorMessage}`
      );
      trackProviderFailure(fallbackConfig.provider);
      throw fallbackError;
    }
  }
}

export async function embedBatch(
  texts: string[],
  options: EmbedBatchOptions = {}
): Promise<EmbedResult[]> {
  if (texts.length === 0) {
    return [];
  }

  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    throw new Error('Embedding batchSize must be greater than zero');
  }

  const results: EmbedResult[] = [];
  for (let index = 0; index < texts.length; index += batchSize) {
    const batch = texts.slice(index, index + batchSize);
    const contexts = options.contexts?.slice(index, index + batch.length);

    const batchResults = await Promise.all(
      batch.map((text, batchIndex) =>
        embedText(text, {
          provider: options.provider,
          model: options.model,
          context: contexts?.[batchIndex] ?? options.context,
        })
      )
    );

    results.push(...batchResults);
  }

  return results;
}

export async function embedTextToArray(
  text: string,
  options: EmbedOptions = {}
): Promise<number[]> {
  const result = await embedText(text, options);

  if (result.embedding.length !== result.dimensions) {
    throw new Error(
      `Embedding dimension mismatch: expected ${result.dimensions}, received ${result.embedding.length}`
    );
  }

  return result.embedding;
}

function resolveProviderConfig(text: string, options: EmbedOptions): EmbeddingConfig {
  if (options.provider) {
    return getProviderConfig(options.provider);
  }

  return selectEmbeddingProvider(text, options.context);
}

function getFallbackConfig(primary: EmbeddingConfig): EmbeddingConfig {
  if (primary.provider === 'ollama') {
    return primary;
  }

  return getProviderConfig('ollama');
}

/**
 * Generate embedding with exponential backoff retry logic
 * Retries on failure with delays: 50ms, 100ms, 250ms
 * Logs each retry attempt and final failure
 */
async function generateEmbeddingWithRetry(
  text: string,
  config: EmbeddingConfig,
  options: EmbedOptions
): Promise<number[]> {
  let lastError: Error | unknown;

  for (let attempt = 0; attempt < RETRY_DELAYS.length + 1; attempt++) {
    try {
      return await generateEmbedding(text, config, options);
    } catch (error) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (attempt < RETRY_DELAYS.length) {
        // Log retry attempt
        console.warn(
          `[Embed] Retry attempt ${attempt + 1}/${RETRY_DELAYS.length}: ` +
            `provider=${config.provider}, model=${config.model}, ` +
            `error=${errorMessage}, delay=${RETRY_DELAYS[attempt]}ms`
        );

        // Wait before retrying with exponential backoff
        await delay(RETRY_DELAYS[attempt]);
      } else {
        // All retries exhausted
        console.error(
          `[Embed] All retries exhausted (${RETRY_DELAYS.length + 1} total attempts): ` +
            `provider=${config.provider}, model=${config.model}, ` +
            `error=${errorMessage}`
        );
      }
    }
  }

  // This should never happen due to the throw in the loop, but TypeScript needs it
  throw lastError;
}

async function generateEmbedding(
  text: string,
  config: EmbeddingConfig,
  options: EmbedOptions
): Promise<number[]> {
  let embedding: number[];
  switch (config.provider) {
    case 'ollama':
      embedding = await embedWithOllama(text, resolveOllamaRuntimeConfig(config.model, options));
      break;
    case 'openai':
      embedding = await embedWithOpenAI(text, config);
      break;
    case 'voyage':
      embedding = await embedWithVoyage(text, config);
      break;
    case 'cohere':
      embedding = await embedWithCohere(text, config);
      break;
    default:
      throw new Error(`Unsupported embedding provider: ${config.provider}`);
  }

  // Enforce 1024-dimension standard
  if (embedding.length !== 1024) {
    throw new Error(
      `Embedding dimension must be 1024, but ${config.provider}/${config.model} returned ${embedding.length} dimensions. ` +
        'Only 1024-dimensional models are supported.'
    );
  }

  return embedding;
}

function resolveOllamaRuntimeConfig(model: string, options: EmbedOptions): OllamaRuntimeConfig {
  const resolvedModel = options.model?.trim() ?? model;
  if (resolvedModel.length === 0) {
    throw new Error('Embedding model cannot be empty');
  }

  return { model: resolvedModel };
}

async function embedWithOllama(text: string, runtime: OllamaRuntimeConfig): Promise<number[]> {
  // Note: Retry logic is now handled by generateEmbeddingWithRetry wrapper
  // to ensure consistent retry behavior across all providers
  const result = await getOllamaClient().embeddings({
    model: runtime.model,
    prompt: text,
  });
  return normalizeEmbedding(result?.embedding);
}

async function embedWithOpenAI(text: string, config: EmbeddingConfig): Promise<number[]> {
  const client = getOpenAIClient();
  const response = await client.embeddings.create({
    model: config.model,
    input: text,
    dimensions: config.dimensions,
  });

  const embedding = response.data?.[0]?.embedding;
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error('OpenAI embedding response missing embedding array');
  }

  return embedding.map(validateEmbeddingValue);
}

async function embedWithVoyage(text: string, config: EmbeddingConfig): Promise<number[]> {
  const client = await getVoyageClient();
  const response = await client.embed({
    input: [text],
    model: config.model,
  });

  const embedding = response.data?.[0]?.embedding;
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error('Voyage embedding response missing embedding array');
  }

  return embedding.map(validateEmbeddingValue);
}

async function embedWithCohere(text: string, config: EmbeddingConfig): Promise<number[]> {
  const client = await getCohereClient();
  const response = await client.embed({
    texts: [text],
    model: config.model,
    inputType: 'search_document',
    embeddingTypes: ['float'],
    outputDimension: config.dimensions,
  });

  const embeddings = response.embeddings?.float;
  if (!embeddings || !Array.isArray(embeddings) || embeddings.length === 0) {
    throw new Error('Cohere embedding response missing embeddings array');
  }

  const embedding = embeddings[0];
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error('Cohere embedding response missing embedding array');
  }

  return embedding.map(validateEmbeddingValue);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeEmbedding(value: unknown): number[] {
  if (!Array.isArray(value)) {
    throw new Error('Embedding response missing embedding array');
  }

  if (value.length === 0) {
    throw new Error('Embedding array must contain at least one value');
  }

  return value.map(validateEmbeddingValue);
}

function validateEmbeddingValue(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Embedding values must be finite numbers');
  }

  return value;
}

async function getVoyageClient(): Promise<VoyageClient> {
  if (cachedVoyage) {
    return cachedVoyage;
  }

  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error('VOYAGE_API_KEY environment variable is not set');
  }

  const module = await loadVoyageModule();
  cachedVoyage = new module.VoyageAIClient({ apiKey }) as VoyageClient;
  return cachedVoyage;
}

async function loadVoyageModule(): Promise<{
  VoyageAIClient: new (options: { apiKey?: string }) => VoyageClient;
}> {
  return import('@voyageai/voyageai');
}

async function getCohereClient(): Promise<CohereClient> {
  if (cachedCohere) {
    return cachedCohere;
  }

  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) {
    throw new Error('COHERE_API_KEY environment variable is not set');
  }

  const module = await loadCohereModule();
  cachedCohere = new module.CohereClientV2({ token: apiKey }) as CohereClient;
  return cachedCohere;
}

async function loadCohereModule(): Promise<{
  CohereClientV2: new (options: { token?: string }) => CohereClient;
}> {
  return import('cohere-ai') as unknown as {
    CohereClientV2: new (options: { token?: string }) => CohereClient;
  };
}

/**
 * Track embedding cost (async, non-blocking)
 * Skips tracking for free providers (Ollama)
 */
async function trackEmbeddingCost(
  config: EmbeddingConfig,
  text: string,
  context?: ContentContext
): Promise<void> {
  // Skip tracking for free providers
  if (config.provider === 'ollama') {
    return;
  }

  try {
    const db = getPool();
    const costTracker = getCostTracker(db);

    // Rough token estimate: ~0.75 tokens per word
    const tokens = Math.ceil(text.split(/\s+/).length * 0.75);

    await costTracker.track({
      provider: config.provider,
      operation: 'embed',
      tokens,
      model: config.model,
      collectionId: context?.collectionId,
    });
  } catch (err) {
    console.error('Cost tracking failed:', err);
  }
}
