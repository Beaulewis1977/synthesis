/**
 * Add Document Tool Definition
 *
 * Phase 16F: Unified tool definition for add_document.
 * Adds a document to the RAG system from file path or URL.
 */

import { createDocument } from '@synthesis/db';
import type { Pool } from 'pg';
import { z } from 'zod';
import { ingestDocument } from '../../../pipeline/orchestrator.js';
import { fetchWebContent } from '../../../services/documentOperations.js';
import {
  type RemoteDownloadResult,
  downloadRemoteFile,
  inferContentType,
  inferExtension,
  inferTitle,
  isUrl,
  readLocalFile,
  writeDocumentFile,
} from '../../utils/storage.js';
import { createToolResponse } from '../adapters.js';
import type { ToolContext, UnifiedToolDefinition } from '../types.js';

// =============================================================================
// Input Schema
// =============================================================================

const addDocumentInputSchema = z.object({
  source: z.string().min(1, 'source must not be empty').describe('File path or URL'),
  collection_id: z.string().uuid().optional().describe('Collection ID'),
  title: z.string().min(1).optional().describe('Document title'),
  metadata: z.record(z.any()).optional().describe('Additional metadata'),
});

type AddDocumentInput = z.infer<typeof addDocumentInputSchema>;

// =============================================================================
// Helper Functions
// =============================================================================

async function updateDocumentStatusSafe(
  db: import('pg').Pool,
  documentId: string,
  status: string,
  errorMessage?: string,
  filePath?: string
): Promise<void> {
  await db.query(
    `UPDATE documents
     SET status = $1,
         error_message = $2,
         updated_at = NOW(),
         processed_at = CASE WHEN $1 = 'complete' THEN NOW() ELSE processed_at END,
         file_path = COALESCE($3, file_path)
     WHERE id = $4`,
    [status, errorMessage ?? null, filePath ?? null, documentId]
  );
}

function isRawFileUrl(url: URL): boolean {
  const pathname = url.pathname.toLowerCase();
  const rawExtensions = [
    '.pdf',
    '.md',
    '.txt',
    '.json',
    '.yaml',
    '.yml',
    '.xml',
    '.csv',
    '.dart',
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.py',
    '.go',
    '.rs',
    '.java',
    '.kt',
    '.swift',
  ];

  return (
    rawExtensions.some((ext) => pathname.endsWith(ext)) ||
    url.hostname === 'raw.githubusercontent.com' ||
    url.hostname.includes('raw.') ||
    url.pathname.includes('/raw/')
  );
}

// =============================================================================
// Tool Definition
// =============================================================================

export const addDocumentTool: UnifiedToolDefinition = {
  name: 'add_document',
  description:
    'Add a document to the RAG system from a LOCAL FILE PATH or RAW FILE URL (PDFs, markdown, code files). For HTML web pages, use fetch_web_content instead.',
  inputSchema: addDocumentInputSchema,
  metadata: {
    toolpack: 'core',
    category: 'core',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: (db: Pool, context: ToolContext) => async (input: unknown) => {
    const parsed = addDocumentInputSchema.parse(input) as AddDocumentInput;
    const collectionId = parsed.collection_id ?? context.collectionId;
    const source = parsed.source.trim();
    const metadata = parsed.metadata ?? {};
    const remote = isUrl(source);

    // For remote URLs, check if it's an HTML page that should use fetch_web_content
    if (remote) {
      try {
        const url = new URL(source);
        if (!isRawFileUrl(url)) {
          // This is likely an HTML web page - redirect to fetch_web_content
          const result = await fetchWebContent(db, {
            url: source,
            collectionId,
            mode: 'single',
            titlePrefix: parsed.title,
          });

          return createToolResponse(
            `Detected web page URL. Used fetch_web_content for proper HTML extraction. Fetched and queued ${result.processed.length} page(s) for ingestion.`,
            result.processed
          );
        }
      } catch (error) {
        console.error(
          '[add_document] Failed to parse URL, falling back to direct download:',
          error
        );
        // Fall through to direct download handling below
      }
    }

    const download = remote ? await downloadRemoteFile(source) : await readLocalFile(source);
    const remoteDownload = remote ? (download as RemoteDownloadResult) : null;

    const referenceName = remoteDownload?.fileName ?? source;
    const contentType = inferContentType(
      referenceName,
      remoteDownload?.contentType ?? download.contentType
    );
    const extension = inferExtension(contentType, referenceName);
    const title = parsed.title?.trim()?.length ? parsed.title.trim() : inferTitle(referenceName);

    const document = await createDocument({
      collection_id: collectionId,
      title,
      file_path: undefined,
      content_type: contentType,
      file_size: download.buffer.length,
      source_url: remote ? source : undefined,
    });

    if (Object.keys(metadata).length > 0) {
      await db.query('UPDATE documents SET metadata = $1 WHERE id = $2', [metadata, document.id]);
    }

    const filePath = await writeDocumentFile(collectionId, document.id, extension, download.buffer);
    await updateDocumentStatusSafe(db, document.id, 'pending', undefined, filePath);

    ingestDocument(document.id).catch((error: unknown) => {
      console.error(`Ingestion failed for ${document.id}`, error);
    });

    return createToolResponse('Document queued for ingestion.', {
      doc_id: document.id,
      title,
      collection_id: collectionId,
      content_type: contentType,
      file_path: filePath,
      metadata,
    });
  },
};
