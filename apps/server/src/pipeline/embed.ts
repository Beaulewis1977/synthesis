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

/**
 * Get a cached singleton Ollama embeddings client configured from OLLAMA_HOST or the default host.
 *
 * @returns An `EmbeddingsClient` instance connected to the configured Ollama host.
 */
function getOllamaClient(): EmbeddingsClient {
  if (cachedClient) {
    return cachedClient;
  }

  const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434';
  cachedClient = new Ollama({ host });
  return cachedClient;
}

/**
 * Injects or clears the cached Ollama embeddings client for testing.
 *
 * @param client - EmbeddingsClient to use as the cached client, or `null` to clear the cache
 */
export function __setOllamaClientForTesting(client: EmbeddingsClient | null): void {
  cachedClient = client;
}

/**
 * Obtain an embedding vector for the given text.
 *
 * Applies configured model, retry, and validation rules from `options`.
 *
 * @param text - The input text to embed
 * @param options - Optional embedding configuration (model, maxRetries, retryDelayMs, batchSize)
 * @returns The embedding vector as an array of numbers
 */
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

/**
 * Embed multiple input texts in configurable-size batches and return their vector embeddings.
 *
 * @param texts - Array of input strings to embed, processed in order.
 * @param options - Optional embedding configuration (e.g., `model`, `batchSize`, `maxRetries`, `retryDelayMs`).
 * @returns An array of embedding vectors (`number[]`) corresponding to each input text, in the same order.
 * @throws If `options.batchSize` is less than or equal to zero.
 */
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

/**
 * Validate and normalize embedding options into a concrete runtime configuration.
 *
 * @param options - Partial embedding options; `model` is trimmed and defaults to `DEFAULT_MODEL`, `maxRetries` defaults to `DEFAULT_MAX_RETRIES`, and `retryDelayMs` defaults to `DEFAULT_RETRY_DELAY_MS`.
 * @returns The resolved EmbedRuntimeConfig containing `model`, `maxRetries`, and `retryDelayMs`.
 * @throws Error if `model` is empty after trimming.
 * @throws Error if `maxRetries` is negative.
 * @throws Error if `retryDelayMs` is negative.
 */
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

/**
 * Retries an asynchronous operation up to a configured number of retries, applying an incremental delay between attempts.
 *
 * @param fn - The async operation to execute.
 * @param maxRetries - Number of retry attempts allowed after the initial attempt (e.g., 3 means up to 4 total attempts).
 * @param retryDelayMs - Base delay in milliseconds used between retries; the actual delay is `retryDelayMs * attempt` where `attempt` starts at 1 for the first retry.
 * @returns The value resolved by `fn`.
 * @throws The last error thrown by `fn` if all attempts (initial + `maxRetries`) fail.
 */
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

/**
 * Pauses execution for a specified number of milliseconds.
 *
 * @param ms - Delay duration in milliseconds
 * @returns Resolves after the specified delay
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Validate and extract a numeric embedding array from an Ollama response.
 *
 * @param response - The Ollama response object that is expected to contain an `embedding` array.
 * @returns The validated embedding array as a `number[]`.
 * @throws Error if `response` is null/undefined or does not contain an embedding array.
 * @throws Error if any embedding value is not a finite number.
 * @throws Error if the embedding array is empty.
 */
function normalizeEmbedding(response: { embedding?: unknown } | null | undefined): number[] {
  if (!response || !Array.isArray(response.embedding)) {
    throw new Error('Ollama embedding response missing embedding array');
  }

  const embedding = response.embedding.map((value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new Error('Embedding values must be numeric');
    }

    return value;
  });

  if (embedding.length === 0) {
    throw new Error('Embedding array must contain at least one value');
  }

  return embedding;
}