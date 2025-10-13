import { Ollama } from 'ollama';

export interface EmbedOptions {
  /** Embedding model served by Ollama (default: `nomic-embed-text`). */
  model?: string;
  /** Maximum number of texts to embed in parallel (default: 10). */
  batchSize?: number;
  /** Number of retries for transient Ollama failures (default: 3). */
  maxRetries?: number;
  /** Delay between retries in milliseconds (default: 250). */
  retryDelayMs?: number;
}

interface EmbedRuntimeConfig {
  model: string;
  maxRetries: number;
  retryDelayMs: number;
}

const DEFAULT_MODEL = 'nomic-embed-text';
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 250;

interface EmbeddingsClient {
  embeddings: (input: { model: string; prompt: string }) => Promise<
    { embedding: number[] } | null | undefined
  >;
}

let cachedClient: EmbeddingsClient | null = null;

function getOllamaClient(): EmbeddingsClient {
  if (cachedClient) {
    return cachedClient;
  }

  const host = process.env.OLLAMA_HOST ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  cachedClient = new Ollama({ host });
  return cachedClient;
}

export function __setOllamaClientForTesting(client: EmbeddingsClient | null): void {
  cachedClient = client;
}

export async function embedText(text: string, options: EmbedOptions = {}): Promise<number[]> {
  const config = resolveRuntimeConfig(options);

  const embedding = await withRetry(
    async () => {
      const response = await getOllamaClient().embeddings({
        model: config.model,
        prompt: text,
      });

      return normalizeEmbedding(response);
    },
    config.maxRetries,
    config.retryDelayMs
  );

  return embedding;
}

export async function embedBatch(texts: string[], options: EmbedOptions = {}): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  if (batchSize <= 0) {
    throw new Error('Embedding batchSize must be greater than zero');
  }

  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const embeddings = await Promise.all(batch.map((text) => embedText(text, options)));
    results.push(...embeddings);
  }

  return results;
}

function resolveRuntimeConfig(options: EmbedOptions): EmbedRuntimeConfig {
  const model = options.model?.trim() ?? DEFAULT_MODEL;
  if (model.length === 0) {
    throw new Error('Embedding model cannot be empty');
  }

  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  if (maxRetries < 0) {
    throw new Error('Embedding maxRetries cannot be negative');
  }

  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  if (retryDelayMs < 0) {
    throw new Error('Embedding retryDelayMs cannot be negative');
  }

  return { model, maxRetries, retryDelayMs };
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  retryDelayMs: number
): Promise<T> {
  let attempt = 0;
  // We allow the initial attempt plus `maxRetries` additional attempts.
  // Example: maxRetries = 3 → up to 4 total attempts.
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
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeEmbedding(response: { embedding?: unknown } | null | undefined): number[] {
  if (!response || !Array.isArray(response.embedding)) {
    throw new Error('Ollama embedding response missing embedding array');
  }

  const embedding = response.embedding.map((value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error('Embedding values must be finite numbers');
    }

    return value;
  });

  if (embedding.length === 0) {
    throw new Error('Embedding array must contain at least one value');
  }

  return embedding;
}
