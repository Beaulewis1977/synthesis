import { Ollama } from 'ollama';
import OpenAI from 'openai';
import type {
  ContentContext,
  EmbeddingConfig,
  EmbeddingProvider,
  ProviderSelection,
} from '../services/embedding-router.js';
import { getProviderConfig, selectEmbeddingProvider } from '../services/embedding-router.js';

interface OllamaClient {
  embeddings: (input: { model: string; prompt: string }) => Promise<{ embedding: unknown }>;
}

let cachedOllama: OllamaClient | null = null;
let cachedOpenAI: OpenAI | null = null;

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
  const selection = resolveProviderSelection(text, options);
  const overrideModel = options.model?.trim();
  const primaryConfig = overrideModel
    ? { ...selection.primary, model: overrideModel }
    : selection.primary;

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
    if (primaryConfig.provider === selection.fallback.provider) {
      throw error;
    }

    const fallbackConfig = selection.fallback;
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

function resolveProviderSelection(text: string, options: EmbedOptions): ProviderSelection {
  if (options.provider) {
    const config = getProviderConfig(options.provider);
    return {
      primary: config,
      fallback: getProviderConfig('ollama'),
    };
  }

  return selectEmbeddingProvider(text, options.context);
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
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error('VOYAGE_API_KEY environment variable is not set');
  }

  const timeoutMs = Number.parseInt(process.env.VOYAGE_TIMEOUT_MS || '30000', 10);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: [text],
        model: config.model,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Voyage API error: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as {
      data?: Array<{ embedding?: number[] | null }>;
    };

    const embedding = payload.data?.[0]?.embedding;
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Voyage embedding response missing embedding array');
    }

    return embedding.map(validateEmbeddingValue);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Voyage API request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
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
