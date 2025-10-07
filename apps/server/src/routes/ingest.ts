import type { FastifyPluginAsync } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { createDocument, updateDocumentStatus } from '@synthesis/db';
import { extract } from '../pipeline/extract.js';

const STORAGE_PATH = process.env.STORAGE_PATH || './storage';

// Validation schema
const IngestBodySchema = z.object({
  collection_id: z.string().uuid(),
});

export const ingestRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/ingest - Upload and process documents
  fastify.post('/api/ingest', async (request, reply) => {
    try {
      // Get multipart data
      const data = await request.file();
      
      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      // Get collection_id from fields
      const collectionId = data.fields.collection_id?.value;
      
      if (!collectionId) {
        return reply.code(400).send({ error: 'collection_id is required' });
      }

      // Validate collection_id
      const validation = IngestBodySchema.safeParse({ collection_id: collectionId });
      if (!validation.success) {
        return reply.code(400).send({ 
          error: 'Invalid collection_id', 
          details: validation.error.issues 
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
      await updateDocumentStatus(document.id, 'pending');

      // Start extraction (async, don't wait)
      extractDocument(document.id, buffer, contentType, filePath).catch((error) => {
        fastify.log.error({ docId: document.id, error }, 'Document extraction failed');
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
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
};

/**
 * Extract document text (runs async after upload)
 */
async function extractDocument(
  documentId: string,
  buffer: Buffer,
  contentType: string,
  filePath: string
): Promise<void> {
  try {
    // Update status to extracting
    await updateDocumentStatus(documentId, 'extracting');

    // Extract text
    const result = await extract(buffer, contentType, filePath);

    // For now, just mark as complete
    // In Phase 2, we'll add chunking and embedding
    await updateDocumentStatus(documentId, 'complete');

    console.log(`✅ Extracted document ${documentId}: ${result.text.length} characters`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await updateDocumentStatus(documentId, 'error', errorMessage);
    throw error;
  }
}
