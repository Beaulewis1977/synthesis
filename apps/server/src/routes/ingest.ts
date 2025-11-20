import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
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
    const tempFiles: { path: string; filename: string; mimetype: string }[] = [];

    try {
      // Iterate over multipart parts
      const parts = request.parts();
      let collectionId: string | undefined;

      for await (const part of parts) {
        if (part.type === 'field' && part.fieldname === 'collection_id') {
          collectionId = part.value as string;
        } else if (part.type === 'file') {
          // Stream to a temp file immediately to avoid memory issues
          const tempPath = path.join(
            os.tmpdir(),
            `synthesis-upload-${Date.now()}-${Math.random().toString(36).substring(7)}`
          );
          await pipeline(part.file, createWriteStream(tempPath));
          tempFiles.push({
            path: tempPath,
            filename: part.filename,
            mimetype: part.mimetype,
          });
        }
      }

      if (!collectionId) {
        // Cleanup temp files if validation fails
        await Promise.all(tempFiles.map((f) => fs.unlink(f.path).catch(() => {})));
        return reply.code(400).send({ error: 'collection_id is required' });
      }

      // Validate collection_id
      const validation = IngestBodySchema.safeParse({ collection_id: collectionId });
      if (!validation.success) {
        await Promise.all(tempFiles.map((f) => fs.unlink(f.path).catch(() => {})));
        return reply.code(400).send({
          error: 'Invalid collection_id',
          details: validation.error.issues,
        });
      }

      if (tempFiles.length === 0) {
        return reply.code(400).send({ error: 'No files uploaded' });
      }

      // Create storage directory if needed
      const collectionStoragePath = path.join(STORAGE_PATH, collectionId);
      await fs.mkdir(collectionStoragePath, { recursive: true });

      // Process each file
      // Parallelize document creation and move operations
      const results = await Promise.all(
        tempFiles.map(async (file, index) => {
          try {
            const stats = await fs.stat(file.path);
            const fileSize = stats.size;

            if (!collectionId) {
              throw new Error('Collection ID is missing');
            }

            // Create document record
            const document = await createDocument({
              collection_id: collectionId,
              title: file.filename,
              content_type: file.mimetype,
              file_size: fileSize,
            });

            // Move file to final storage
            const finalPath = path.join(
              collectionStoragePath,
              `${document.id}${path.extname(file.filename)}`
            );

            // Use copy+unlink (or rename) to move
            await fs.rename(file.path, finalPath);

            // Update document status
            await updateDocumentStatus(document.id, 'pending', undefined, finalPath);

            // Start ingestion (fire and forget)
            ingestDocument(document.id).catch((error) => {
              fastify.log.error({ docId: document.id, error }, 'Document ingestion failed');
            });

            return {
              filename: file.filename,
              status: 'success' as const,
              documentId: document.id,
              uploadIndex: index,
            };
          } catch (error) {
            // Try to clean up temp file if processing failed and it still exists
            await fs.unlink(file.path).catch(() => {});

            fastify.log.error({ filename: file.filename, error }, 'File processing failed');
            return {
              filename: file.filename,
              status: 'error' as const,
              uploadIndex: index,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })
      );

      const successCount = results.filter((r) => r.status === 'success').length;
      const failureCount = results.filter((r) => r.status === 'error').length;

      return reply.code(201).send({
        message: `Processed ${tempFiles.length} files (${successCount} succeeded, ${failureCount} failed)`,
        results,
      });
    } catch (error) {
      // Global error handler - try to cleanup all temp files
      await Promise.all(tempFiles.map((f) => fs.unlink(f.path).catch(() => {})));

      fastify.log.error(error, 'Batch ingest error');
      return reply.code(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
};
