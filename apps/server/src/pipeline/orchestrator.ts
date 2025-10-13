import fs from 'node:fs/promises';
import {
  type Document,
  getDocument,
  updateDocumentMetadata,
  updateDocumentStatus,
} from '@synthesis/db';
import type { DocumentMetadata } from '@synthesis/shared';
import { type ContentContext, deriveContextFromMetadata } from '../services/embedding-router.js';
import { buildMetadata } from '../services/metadata-builder.js';
import type { Chunk, ChunkOptions } from './chunk.js';
import { chunkText } from './chunk.js';
import type { EmbedBatchOptions, EmbedOptions, EmbedResult } from './embed.js';
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

    const chunks = chunkText(extraction.text, options.chunk, {
      ...extraction.metadata,
      documentId,
    });
    await updateDocumentStatus(documentId, 'chunking');

    if (chunks.length === 0) {
      await storeChunks(documentId, [], []);
      await updateDocumentStatus(documentId, 'complete');
      return;
    }

    const baseMetadata = (document.metadata ?? {}) as DocumentMetadata;
    const contentContext = inferContentContext(document, baseMetadata);

    await updateDocumentStatus(documentId, 'embedding');
    const embedResults = await embedBatch(
      chunks.map((chunk) => chunk.text),
      mergeEmbedOptions(options.embed, contentContext, chunks.length)
    );

    const decoratedChunks = decorateChunksWithEmbeddingMetadata(chunks, embedResults);
    const firstResult = embedResults[0];

    await storeChunks(
      documentId,
      decoratedChunks,
      embedResults.map((result) => result.embedding),
      {
        embeddingModel: firstResult?.model ?? options.embed?.model,
        embeddingProvider: firstResult?.provider,
        embeddingDimensions: firstResult?.dimensions,
      }
    );

    if (firstResult) {
      const metadataBuilder = buildMetadata();

      metadataBuilder.setDocType(inferDocType(document, baseMetadata));

      if (document.source_url) {
        metadataBuilder.setSourceUrl(document.source_url);
      } else if (baseMetadata.source_url) {
        metadataBuilder.setSourceUrl(baseMetadata.source_url);
      }

      if (baseMetadata.source_quality) {
        metadataBuilder.setSourceQuality(baseMetadata.source_quality);
      }

      if (document.file_path) {
        metadataBuilder.setFilePath(document.file_path);
      }

      if (baseMetadata.language) {
        metadataBuilder.setLanguage(baseMetadata.language);
      }

      if (baseMetadata.content_category) {
        metadataBuilder.setContentCategory(baseMetadata.content_category);
      }

      if (baseMetadata.repo_name) {
        metadataBuilder.setRepo(baseMetadata.repo_name, baseMetadata.repo_stars);
      }

      metadataBuilder.setEmbedding(firstResult.provider, firstResult.model, firstResult.dimensions);

      const mergedMetadata = metadataBuilder.build(baseMetadata);

      await updateDocumentMetadata(documentId, mergedMetadata);
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

function mergeEmbedOptions(
  options: EmbedOptions | undefined,
  context: ContentContext,
  length: number
): EmbedBatchOptions {
  const contexts = Array.from({ length }, () => context);

  return {
    ...options,
    context,
    contexts,
  };
}

function inferContentContext(document: ReadyDocument, metadata: DocumentMetadata): ContentContext {
  const derived = deriveContextFromMetadata(metadata);
  const language =
    derived?.language ?? metadata.language ?? inferLanguageFromPath(document.file_path ?? '');

  const explicitType = derived?.type ?? inferTypeFromDocument(document, metadata);

  return {
    type: explicitType,
    language: language ?? undefined,
    collectionId: document.collection_id,
    isPersonalCollection: explicitType === 'personal',
  };
}

function inferTypeFromDocument(
  document: ReadyDocument,
  metadata: DocumentMetadata
): ContentContext['type'] {
  if (metadata.doc_type === 'personal_writing') {
    return 'personal';
  }

  if (metadata.doc_type === 'code_sample' || metadata.doc_type === 'build_plan') {
    return 'code';
  }

  if (isCodeFile(document.file_path ?? '') || isCodeMime(document.content_type ?? '')) {
    return 'code';
  }

  return 'docs';
}

function inferDocType(
  document: ReadyDocument,
  metadata: DocumentMetadata
): NonNullable<DocumentMetadata['doc_type']> {
  if (metadata.doc_type) {
    return metadata.doc_type;
  }

  if (isPersonalCollection(metadata)) {
    return 'personal_writing';
  }

  if (isCodeFile(document.file_path ?? '') || metadata.content_category === 'snippet') {
    return 'code_sample';
  }

  if ((document.source_url ?? '').includes('github.com')) {
    return 'repo';
  }

  return 'tutorial';
}

function isPersonalCollection(metadata: DocumentMetadata): boolean {
  return metadata.doc_type === 'personal_writing';
}

function isCodeFile(path: string): boolean {
  const lower = path.toLowerCase();
  return /\.(dart|ts|tsx|js|jsx|py|java|kt|c|cpp|go|rs)$/.test(lower);
}

function isCodeMime(contentType: string): boolean {
  const lower = contentType.toLowerCase();
  return (
    lower.includes('application/javascript') || lower.includes('text/x') || lower.includes('code')
  );
}

function inferLanguageFromPath(path: string): string | undefined {
  const lower = path.toLowerCase();
  if (lower.endsWith('.dart')) return 'dart';
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript';
  if (lower.endsWith('.js') || lower.endsWith('.jsx')) return 'javascript';
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'yaml';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
  return undefined;
}
