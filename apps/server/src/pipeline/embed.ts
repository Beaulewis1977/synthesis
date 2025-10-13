import { Ollama } from 'ollama';
import OpenAI from 'openai';
import type {
  ContentContext,
  EmbeddingConfig,
  EmbeddingProvider,
} from '../services/embedding-router.js';
import { getProviderConfig, selectEmbeddingProvider } from '../services/embedding-router.js';

type VoyageClient = {
  embed: (request: { input: string | string[]; model: string }) => Promise<{
    data?: Array<{ embedding?: number[] | null }>;
  }>;
};

interface OllamaClient {
  embeddings: (input: { model: string; prompt: string }) => Promise<{ embedding: unknown }>;
}

let cachedOllama: OllamaClient | null = null;
let cachedOpenAI: OpenAI | null = null;
let cachedVoyage: VoyageClient | null = null;

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 250;

export interface EmbedOptions {
  provider?: EmbeddingProvider;
  model?: string;
  batchSize?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  context?: ContentContext;
}

export interface EmbedBatchOptions extends EmbedOptions {
  contexts?: Array<ContentContext | undefined>;
}

interface OllamaRuntimeConfig {
  model: string;
  maxRetries: number;
  retryDelayMs: number;
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

  try {
    const embedding = await generateEmbedding(text, primaryConfig, options);
    return {
      embedding,
      provider: primaryConfig.provider,
      model: primaryConfig.model,
      dimensions: primaryConfig.dimensions,
      usedFallback: false,
    };
  } catch (error) {
    const fallbackConfig = getFallbackConfig(primaryConfig);
    if (fallbackConfig.provider === primaryConfig.provider) {
      throw error;
    }

    const embedding = await generateEmbedding(text, fallbackConfig, options);
    return {
      embedding,
      provider: fallbackConfig.provider,
      model: fallbackConfig.model,
      dimensions: fallbackConfig.dimensions,
      usedFallback: true,
    };
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
          maxRetries: options.maxRetries,
          retryDelayMs: options.retryDelayMs,
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

async function generateEmbedding(
  text: string,
  config: EmbeddingConfig,
  options: EmbedOptions
): Promise<number[]> {
  switch (config.provider) {
    case 'ollama':
      return embedWithOllama(text, resolveOllamaRuntimeConfig(config.model, options));
    case 'openai':
      return embedWithOpenAI(text, config);
    case 'voyage':
      return embedWithVoyage(text, config);
    default:
      throw new Error(`Unsupported embedding provider: ${config.provider}`);
  }
}

function resolveOllamaRuntimeConfig(model: string, options: EmbedOptions): OllamaRuntimeConfig {
  const resolvedModel = options.model?.trim() ?? model;
  if (resolvedModel.length === 0) {
    throw new Error('Embedding model cannot be empty');
  }

  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new Error('Embedding maxRetries cannot be negative');
  }

  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  if (!Number.isInteger(retryDelayMs) || retryDelayMs < 0) {
    throw new Error('Embedding retryDelayMs cannot be negative');
  }

  return { model: resolvedModel, maxRetries, retryDelayMs };
}

async function embedWithOllama(text: string, runtime: OllamaRuntimeConfig): Promise<number[]> {
  const response = await withRetry(
    async () => {
      const result = await getOllamaClient().embeddings({
        model: runtime.model,
        prompt: text,
      });
      return normalizeEmbedding(result?.embedding);
    },
    runtime.maxRetries,
    runtime.retryDelayMs
  );

  return response;
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

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  retryDelayMs: number
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= maxRetries) {
        throw error;
      }

      attempt += 1;
      if (retryDelayMs > 0) {
        await delay(retryDelayMs * attempt);
      }
    }
  }
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
