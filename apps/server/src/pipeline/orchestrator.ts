import fs from 'node:fs/promises';
import {
  type Document,
  getDocument,
  getPool,
  updateDocumentMetadata,
  updateDocumentStatus,
} from '@synthesis/db';
import type { DocumentMetadata } from '@synthesis/shared';
import {
  type ContentContext,
  deriveContextFromMetadata,
  getProviderConfig,
} from '../services/embedding-router.js';
import { buildMetadata } from '../services/metadata-builder.js';
import { inferLanguages } from '../services/metadata-validator.js';
import { validateAndSplitChunks } from './chunk-splitter.js';
import type { Chunk, ChunkOptions } from './chunk.js';
import { chunkText } from './chunk.js';
import { chunkCodeFile } from './code-chunker.js';
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

    // If Vision OCR was used, update document metadata to reflect this
    if (extraction.metadata.extractionMethod === 'vision-ocr') {
      const visionOCRMetadata = {
        extractionMethod: 'vision-ocr',
        visionOCRConfidence: extraction.metadata.confidence,
        visionOCRCost: extraction.metadata.visionOCR?.estimatedCost,
      };
      await updateDocumentMetadata(documentId, {
        ...(document.metadata ?? {}),
        ...visionOCRMetadata,
      });
      console.info(
        `[Ingest] Document ${documentId} processed with Vision OCR (confidence: ${extraction.metadata.confidence})`
      );
    }

    await updateDocumentStatus(documentId, 'chunking');

    // Check if this is a code file and code chunking is enabled
    const codeFile = isCodeFile(document.file_path);
    const codeChunkingEnabled = process.env.CODE_CHUNKING === 'true';

    let chunks: Chunk[];

    if (codeFile && codeChunkingEnabled) {
      // Use code-aware chunking
      // console.info(`Using code-aware chunking for ${document.file_path}`);
      const parsedEnvMaxChunk = Number.parseInt(process.env.CODE_MAX_CHUNK_LINES ?? '', 10);
      const maxChunkSize = Number.isNaN(parsedEnvMaxChunk) ? 100 : Math.max(parsedEnvMaxChunk, 1);
      chunks = await chunkCodeFile(document.file_path, extraction.text, {
        preserveImports: process.env.PRESERVE_IMPORTS === 'true',
        trackRelationships: process.env.TRACK_RELATIONSHIPS === 'true',
        db: getPool(),
        collectionId: document.collection_id,
        maxChunkSize,
      });
    } else {
      // Use simple text chunking
      chunks = chunkText(extraction.text, options.chunk, {
        ...extraction.metadata,
        documentId,
      });
    }

    if (chunks.length === 0) {
      const errorMsg =
        `Document "${document.title}" produced no chunks. ` +
        'The file may be empty, corrupted, or require OCR for scanned content.';
      console.warn(
        `[Ingest] WARNING: Document ${documentId} (${document.title}) produced 0 chunks after extraction. ` +
          'This may indicate a problem with the source file (e.g., scanned PDF, empty file).'
      );
      await storeChunks(documentId, [], []);
      // Mark as error instead of complete when no chunks are produced
      await updateDocumentStatus(documentId, 'error', errorMsg);
      throw new Error(errorMsg);
    }

    const baseMetadata = (document.metadata ?? {}) as DocumentMetadata;
    const contentContext = inferContentContext(document, baseMetadata);

    // Validate and split chunks that exceed token limits
    const embeddingConfig = getProviderConfig(
      options.embed?.provider ?? (contentContext.type === 'code' ? 'voyage' : 'ollama')
    );
    const validatedChunks = validateAndSplitChunks(
      chunks,
      embeddingConfig.provider,
      embeddingConfig.model
    );

    if (validatedChunks.splitCount > 0) {
      console.info(
        `[Ingest] Document ${documentId}: ${validatedChunks.splitCount} chunks were split due to token limits, ` +
          `${validatedChunks.newChunksCreated} new chunks created`
      );
    }

    // Use validated chunks for embedding
    const chunksToEmbed: Chunk[] = validatedChunks.chunks;

    await updateDocumentStatus(documentId, 'embedding');
    const embedResults = await embedBatch(
      chunksToEmbed.map((chunk) => chunk.text),
      mergeEmbedOptions(options.embed, contentContext, chunksToEmbed.length)
    );

    const decoratedChunks = decorateChunksWithEmbeddingMetadata(chunksToEmbed, embedResults);
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

      // Phase 3: Set source and source_type
      if (document.source_url) {
        metadataBuilder.setSourceUrl(document.source_url);
        metadataBuilder.setSource(document.source_url);
      } else if (baseMetadata.source_url) {
        metadataBuilder.setSourceUrl(baseMetadata.source_url);
        metadataBuilder.setSource(baseMetadata.source_url);
      } else if (document.file_path) {
        metadataBuilder.setSource(document.file_path, 'file');
      }

      if (baseMetadata.source_quality) {
        metadataBuilder.setSourceQuality(baseMetadata.source_quality);
      }

      if (document.file_path) {
        metadataBuilder.setFilePath(document.file_path);
      }

      // Phase 3: Set languages array
      const languages = inferLanguages(document.file_path, extraction.text);
      metadataBuilder.setLanguages(languages);

      // Phase 3: Set ingested_at timestamp
      metadataBuilder.setIngestedAt();

      if (baseMetadata.language) {
        metadataBuilder.setLanguage(baseMetadata.language);
      }

      if (baseMetadata.content_category) {
        metadataBuilder.setContentCategory(baseMetadata.content_category);
      }

      if (baseMetadata.repo_name) {
        metadataBuilder.setRepo(baseMetadata.repo_name, baseMetadata.repo_stars);
      }

      // Phase 3: Set commit SHA if available
      if (baseMetadata.commit_sha) {
        metadataBuilder.setCommitSha(baseMetadata.commit_sha);
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
  return /\.(dart|ts|tsx|js|jsx|py|java|kt|c|cpp|go|rs|sql|yaml|yml|json)$/.test(lower);
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
  if (lower.endsWith('.sql')) return 'sql';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
  return undefined;
}
