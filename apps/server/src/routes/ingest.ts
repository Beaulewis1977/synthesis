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
   * Handles the upload and processing of a new document.
   * It expects a multipart form with a file and a 'collection_id'.
   * The file is saved to storage, a document record is created in the database,
   * and the text extraction process is started asynchronously.
   * @name POST /api/ingest
   * @function
   */
  fastify.post('/api/ingest', async (request, reply) => {
    try {
      // Get multipart data
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      // Get collection_id from fields
      const collectionIdField = data.fields.collection_id;
      if (
        !collectionIdField ||
        Array.isArray(collectionIdField) ||
        !('value' in collectionIdField)
      ) {
        return reply.code(400).send({ error: 'collection_id is missing or invalid' });
      }
      const collectionId = collectionIdField.value as string;

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

      const file = data as MultipartFile;
      const filename = file.filename;
      const contentType = file.mimetype;

      // Read file buffer
      const buffer = await file.toBuffer();
      const fileSize = buffer.length;

      // Create document record
      const document = await createDocument({
        collection_id: collectionId as string,
        title: filename,
        content_type: contentType,
        file_size: fileSize,
      });

      // Create storage directory if needed
      const collectionStoragePath = path.join(STORAGE_PATH, collectionId as string);
      await fs.mkdir(collectionStoragePath, { recursive: true });

      // Save file to storage
      const filePath = path.join(collectionStoragePath, `${document.id}${path.extname(filename)}`);
      await fs.writeFile(filePath, buffer);

      // Update document with file path
      await updateDocumentStatus(document.id, 'pending', undefined, filePath);

      // Start ingestion pipeline asynchronously
      ingestDocument(document.id).catch((error) => {
        fastify.log.error({ docId: document.id, error }, 'Document ingestion failed');
      });

      return reply.code(201).send({
        document_id: document.id,
        status: 'pending',
        message: 'Document uploaded successfully, processing started',
      });
    } catch (error) {
      fastify.log.error(error, 'Ingest error');
      return reply.code(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
};
