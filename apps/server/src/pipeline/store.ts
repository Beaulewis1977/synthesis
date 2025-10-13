import { deleteDocumentChunks, upsertChunk, withTransaction } from '@synthesis/db';
import type { Chunk } from './chunk.js';

const DEFAULT_MAX_CONCURRENT_UPSERTS = 10;

export interface StoreChunksOptions {
  /** Embedding model name stored alongside vectors. */
  embeddingModel?: string;
  /** Embedding provider identifier stored in chunk metadata. */
  embeddingProvider?: string;
  /** Dimensionality of the embedding vector. */
  embeddingDimensions?: number;
  /** Optional cap on concurrent upsert operations; defaults to 10 when invalid or unspecified. */
  maxConcurrentUpserts?: number;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function storeChunks(
  documentId: string,
  chunks: Chunk[],
  embeddings: number[][],
  options: StoreChunksOptions = {}
): Promise<void> {
  if (embeddings.length > 0 && embeddings.length !== chunks.length) {
    throw new Error('Chunks and embeddings length mismatch');
  }

  await withTransaction(async (client) => {
    // Delete existing chunks within the transaction
    await deleteDocumentChunks(documentId, client);

    if (chunks.length === 0) {
      return;
    }

    const embeddingModel =
      options.embeddingModel ?? process.env.EMBEDDING_MODEL ?? 'nomic-embed-text';
    const embeddingProvider = options.embeddingProvider;
    const embeddingDimensions = options.embeddingDimensions;
    const MAX_RETRIES = 3;
    const INITIAL_BACKOFF_MS = 100;
    const BACKOFF_FACTOR = 2;

    const retryWithBackoff = async <T>(operation: () => Promise<T>): Promise<T> => {
      let attempt = 0;
      let delay = INITIAL_BACKOFF_MS;

      // Try the operation with exponential backoff to cushion transient DB errors.
      while (true) {
        try {
          return await operation();
        } catch (error) {
          attempt += 1;
          if (attempt >= MAX_RETRIES) {
            throw error;
          }

          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= BACKOFF_FACTOR;
        }
      }
    };

    const providedConcurrency =
      typeof options.maxConcurrentUpserts === 'number' && options.maxConcurrentUpserts > 0
        ? options.maxConcurrentUpserts
        : undefined;

    const concurrency = Math.max(
      1,
      Math.min(providedConcurrency ?? DEFAULT_MAX_CONCURRENT_UPSERTS, chunks.length)
    );
    let nextIndex = 0;

    const workers = Array.from({ length: concurrency }, async () => {
      while (true) {
        const currentIndex = nextIndex++;

        if (currentIndex >= chunks.length) {
          break;
        }

        const chunk = chunks[currentIndex];
        const embedding = embeddings[currentIndex];
        const metadata = { ...chunk.metadata };

        if (embedding) {
          const resolvedModel =
            (typeof metadata.embedding_model === 'string' && metadata.embedding_model.length > 0
              ? metadata.embedding_model
              : embeddingModel) ?? 'nomic-embed-text';
          const resolvedProvider =
            typeof metadata.embedding_provider === 'string' &&
            metadata.embedding_provider.length > 0
              ? metadata.embedding_provider
              : embeddingProvider;
          const resolvedDimensions =
            typeof metadata.embedding_dimensions === 'number'
              ? metadata.embedding_dimensions
              : embeddingDimensions;

          metadata.embedding_model = resolvedModel;
          if (resolvedProvider) {
            metadata.embedding_provider = resolvedProvider;
          }
          if (typeof resolvedDimensions === 'number') {
            metadata.embedding_dimensions = resolvedDimensions;
          }
        }

        await retryWithBackoff(() =>
          upsertChunk(
            {
              doc_id: documentId,
              chunk_index: chunk.index,
              text: chunk.text,
              token_count: estimateTokens(chunk.text),
              embedding,
              embedding_model:
                embedding && typeof metadata.embedding_model === 'string'
                  ? metadata.embedding_model
                  : undefined,
              metadata,
            },
            client
          )
        );
      }
    });

    await Promise.all(workers);
  });
}
