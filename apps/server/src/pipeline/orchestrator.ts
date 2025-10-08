import fs from 'node:fs/promises';
import { type Document, getDocument, updateDocumentStatus } from '@synthesis/db';
import type { ChunkOptions } from './chunk.js';
import { chunkText } from './chunk.js';
import type { EmbedOptions } from './embed.js';
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

/**
 * Asserts that a retrieved document is present and contains the required ingestion fields.
 *
 * Throws an Error if the document is null or if either `file_path` or `content_type` is missing.
 *
 * @param document - The document object to validate.
 * @param documentId - The document identifier used in error messages.
 * @throws Error - "Document {documentId} not found" if `document` is null.
 * @throws Error - "Document {documentId} is missing file_path" if `file_path` is falsy.
 * @throws Error - "Document {documentId} is missing content_type" if `content_type` is falsy.
 */
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

/**
 * Orchestrates ingestion of a document by extracting its contents, chunking the text, producing embeddings, storing results, and updating the document's status through each stage.
 *
 * @param documentId - The identifier of the document to ingest.
 * @param options - Optional overrides for chunking and embedding behavior.
 *
 * @throws If any stage fails, updates the document status to `'error'` with the failure message and rethrows the original error.
 */
export async function ingestDocument(
  documentId: string,
  options: IngestOptions = {}
): Promise<void> {
  const document = await getDocument(documentId);
  assertDocumentReady(document, documentId);

  const buffer = await fs.readFile(document.file_path);

  try {
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
    const embeddings = await embedBatch(
      chunks.map((chunk) => chunk.text),
      options.embed
    );

    await storeChunks(documentId, chunks, embeddings, {
      embeddingModel: options.embed?.model,
    });

    await updateDocumentStatus(documentId, 'complete');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateDocumentStatus(documentId, 'error', message);
    throw error;
  }
}