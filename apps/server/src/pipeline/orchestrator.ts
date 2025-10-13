import fs from 'node:fs/promises';
import {
  type Document,
  getDocument,
  updateDocumentMetadata,
  updateDocumentStatus,
} from '@synthesis/db';
import type { Chunk, ChunkOptions } from './chunk.js';
import { chunkText } from './chunk.js';
import type { EmbedOptions, EmbedResult } from './embed.js';
import { embedBatch } from './embed.js';
import { extract } from './extract.js';
import { storeChunks } from './store.js';

export interface IngestOptions {
  /** Chunking configuration overrides. */
  chunk?: ChunkOptions;
  /** Embedding configuration overrides. */
  embed?: EmbedOptions;
}

type ReadyDocument = Document & {
  file_path: string;
  content_type: string;
};

function assertDocumentReady(
  document: Document | null,
  documentId: string
): asserts document is ReadyDocument {
  if (!document) {
    throw new Error(`Document ${documentId} not found`);
  }

  if (!document.file_path) {
    throw new Error(`Document ${documentId} is missing file_path`);
  }

  if (!document.content_type) {
    throw new Error(`Document ${documentId} is missing content_type`);
  }
}

export async function ingestDocument(
  documentId: string,
  options: IngestOptions = {}
): Promise<void> {
  const document = await getDocument(documentId);
  assertDocumentReady(document, documentId);

  try {
    const buffer = await fs.readFile(document.file_path);

    await updateDocumentStatus(documentId, 'extracting');
    const extraction = await extract(buffer, document.content_type, document.title);

    await updateDocumentStatus(documentId, 'chunking');
    const chunks = chunkText(extraction.text, options.chunk, {
      ...extraction.metadata,
      documentId,
    });

    if (chunks.length === 0) {
      await storeChunks(documentId, [], []);
      await updateDocumentStatus(documentId, 'complete');
      return;
    }

    await updateDocumentStatus(documentId, 'embedding');
    const embedResults = await embedBatch(
      chunks.map((chunk) => chunk.text),
      options.embed
    );

    const decoratedChunks = decorateChunksWithEmbeddingMetadata(chunks, embedResults);
    const firstResult = embedResults[0];

    await storeChunks(
      documentId,
      decoratedChunks,
      embedResults.map((result) => result.embedding),
      {
        embeddingModel: firstResult?.model ?? options.embed?.model,
      }
    );

    if (firstResult) {
      await updateDocumentMetadata(documentId, {
        embedding_provider: firstResult.provider,
        embedding_model: firstResult.model,
        embedding_dimensions: firstResult.dimensions,
      });
    }

    await updateDocumentStatus(documentId, 'complete');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateDocumentStatus(documentId, 'error', message);
    throw error;
  }
}

function decorateChunksWithEmbeddingMetadata(chunks: Chunk[], results: EmbedResult[]): Chunk[] {
  if (results.length === 0) {
    return chunks;
  }

  return chunks.map((chunk, index) => {
    const result = results[index] ?? results[0];

    return {
      ...chunk,
      metadata: {
        ...chunk.metadata,
        embedding_provider: result.provider,
        embedding_model: result.model,
        embedding_dimensions: result.dimensions,
      },
    };
  });
}
