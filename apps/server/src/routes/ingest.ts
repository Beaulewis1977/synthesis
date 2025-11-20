import fs from 'node:fs/promises';
import path from 'node:path';
import type { MultipartFile } from '@fastify/multipart';
import { createDocument, updateDocumentStatus } from '@synthesis/db';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ingestDocument } from '../pipeline/orchestrator.js';

const STORAGE_PATH = process.env.STORAGE_PATH || './storage';

// Validation schema
const IngestBodySchema = z.object({
  collection_id: z.string().uuid(),
});

/**
 * Defines the routes for document ingestion.
 * @param fastify The Fastify instance.
 */
export const ingestRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Handles the upload and processing of one or more documents.
   * Supports both single file ('file') and multiple files ('files') fields.
   * Expects a multipart form with file(s) and a 'collection_id'.
   * @name POST /api/ingest
   * @function
   */
  fastify.post('/api/ingest', async (request, reply) => {
    try {
      // Iterate over multipart parts
      const parts = request.parts();
      let collectionId: string | undefined;
      const filesToProcess: MultipartFile[] = [];

      for await (const part of parts) {
        if (part.type === 'field' && part.fieldname === 'collection_id') {
          collectionId = part.value as string;
        } else if (part.type === 'file') {
          // Accumulate files (we need collectionId first to process them safely)
          // Note: fastify-multipart streams files. To handle multiple files safely
          // while waiting for collection_id, we might need to buffer them or ensure
          // collection_id comes first.
          // However, a simpler approach for batching with unknown field order:
          // Buffer the file content to memory (limited by limits.fileSize).
          filesToProcess.push(part);
        }
      }

      if (!collectionId) {
        return reply.code(400).send({ error: 'collection_id is required' });
      }

      // Validate collection_id
      const validation = IngestBodySchema.safeParse({ collection_id: collectionId });
      if (!validation.success) {
        return reply.code(400).send({
          error: 'Invalid collection_id',
          details: validation.error.issues,
        });
      }

      if (filesToProcess.length === 0) {
        return reply.code(400).send({ error: 'No files uploaded' });
      }

      const results: Array<{
        filename: string;
        status: 'success' | 'error';
        documentId?: string;
        error?: string;
      }> = [];

      // Create storage directory if needed
      const collectionStoragePath = path.join(STORAGE_PATH, collectionId);
      await fs.mkdir(collectionStoragePath, { recursive: true });

      // Process each file
      for (const file of filesToProcess) {
        const filename = file.filename;
        const contentType = file.mimetype;

        try {
          const buffer = await file.toBuffer();
          const fileSize = buffer.length;

          // Create document record
          const document = await createDocument({
            collection_id: collectionId,
            title: filename,
            content_type: contentType,
            file_size: fileSize,
          });

          // Save file to storage
          const filePath = path.join(
            collectionStoragePath,
            `${document.id}${path.extname(filename)}`
          );
          await fs.writeFile(filePath, buffer);

          // Update document status
          await updateDocumentStatus(document.id, 'pending', undefined, filePath);

          // Start ingestion (fire and forget)
          ingestDocument(document.id).catch((error) => {
            fastify.log.error({ docId: document.id, error }, 'Document ingestion failed');
          });

          results.push({
            filename,
            status: 'success',
            documentId: document.id,
          });
        } catch (error) {
          fastify.log.error({ filename, error }, 'File processing failed');
          results.push({
            filename,
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const successCount = results.filter((r) => r.status === 'success').length;
      const failureCount = results.filter((r) => r.status === 'error').length;

      return reply.code(201).send({
        message: `Processed ${filesToProcess.length} files (${successCount} succeeded, ${failureCount} failed)`,
        results,
      });
    } catch (error) {
      fastify.log.error(error, 'Batch ingest error');
      return reply.code(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
};
