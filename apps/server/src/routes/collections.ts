import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {
  createCollection,
  deleteCollection,
  deleteDocumentChunks,
  getCollection,
  getDocument,
  getDocumentFileInfo,
  getPool,
  listCollections,
  listDocuments,
} from '@synthesis/db';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { deleteFileIfExists } from '../agent/utils/storage.js';
import { ingestDocument } from '../pipeline/orchestrator.js';
import { fetchWebContent } from '../services/documentOperations.js';
import { getRelatedFiles } from '../services/file-relationships.js';

const CreateCollectionSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

const BatchDeleteDocumentsSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(100),
});

export const collectionRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/collections - List all collections
  fastify.get('/api/collections', async (_request, reply) => {
    try {
      fastify.log.info('Attempting to list collections');
      const collections = await listCollections();
      fastify.log.info({ count: collections.length }, 'Collections retrieved');
      return reply.send({ collections });
    } catch (error) {
      fastify.log.error(error, 'Failed to list collections');
      return reply.code(500).send({ error: 'Failed to list collections' });
    }
  });

  // GET /api/collections/:id - Get collection by ID
  fastify.get<{ Params: { id: string } }>('/api/collections/:id', async (request, reply) => {
    try {
      const collection = await getCollection(request.params.id);

      if (!collection) {
        return reply.code(404).send({ error: 'Collection not found' });
      }

      return reply.send(collection);
    } catch (error) {
      fastify.log.error(error, 'Failed to get collection');
      return reply.code(500).send({ error: 'Failed to get collection' });
    }
  });

  // POST /api/collections - Create new collection
  fastify.post('/api/collections', async (request, reply) => {
    try {
      const validation = CreateCollectionSchema.safeParse(request.body);

      if (!validation.success) {
        return reply.code(400).send({
          error: 'Invalid request',
          details: validation.error.issues,
        });
      }

      const { name, description } = validation.data;
      const collection = await createCollection(name, description);

      return reply.code(201).send({ collection });
    } catch (error) {
      fastify.log.error(error, 'Failed to create collection');
      return reply.code(500).send({ error: 'Failed to create collection' });
    }
  });

  // GET /api/collections/:id/documents - Get documents in collection
  fastify.get<{ Params: { id: string } }>(
    '/api/collections/:id/documents',
    async (request, reply) => {
      try {
        const documents = await listDocuments(request.params.id);
        return reply.send({ documents });
      } catch (error) {
        fastify.log.error(error, 'Failed to list documents');
        return reply.code(500).send({ error: 'Failed to list documents' });
      }
    }
  );

  // DELETE /api/collections/:id - Delete collection and all its documents
  fastify.delete<{ Params: { id: string } }>('/api/collections/:id', async (request, reply) => {
    try {
      const collection = await getCollection(request.params.id);

      if (!collection) {
        return reply.code(404).send({ error: 'Collection not found' });
      }

      await deleteCollection(request.params.id);
      fastify.log.info({ collection_id: request.params.id }, 'Collection deleted');

      return reply.send({
        message: 'Collection deleted successfully',
        collection_id: request.params.id,
        collection_name: collection.name,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to delete collection');
      return reply.code(500).send({ error: 'Failed to delete collection' });
    }
  });

  // GET /api/documents/:id/related-files - Get related files for a document
  fastify.get<{ Params: { id: string } }>(
    '/api/documents/:id/related-files',
    async (request, reply) => {
      try {
        const db = getPool();
        const doc = await getDocumentFileInfo(request.params.id);

        if (!doc) {
          return reply.code(404).send({ error: 'Document not found' });
        }

        const filePath = doc.file_path;

        if (!filePath) {
          return reply.send({
            file_path: null,
            related_files: null,
          });
        }

        // Get related files
        const relatedFiles = await getRelatedFiles(db, filePath, doc.collection_id);

        return reply.send({
          file_path: filePath,
          related_files: relatedFiles,
        });
      } catch (error) {
        fastify.log.error(error, 'Failed to get related files');
        return reply.code(500).send({ error: 'Failed to get related files' });
      }
    }
  );

  // DELETE /api/documents/batch - Batch delete multiple documents
  fastify.delete('/api/documents/batch', async (request, reply) => {
    const validation = BatchDeleteDocumentsSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.code(400).send({
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const { documentIds } = validation.data;
    const db = getPool();
    const deleted: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];
    const filesToDelete: string[] = [];

    // Start transaction
    const client = await db.connect();
    let transactionStarted = false;

    try {
      await client.query('BEGIN');
      transactionStarted = true;

      // Process each document
      for (const docId of documentIds) {
        try {
          // Get document to retrieve file path
          const document = await getDocument(docId);

          if (!document) {
            failed.push({ id: docId, error: 'Document not found' });
            continue;
          }

          // Delete chunks
          await deleteDocumentChunks(document.id, client);

          // Delete document record
          await client.query('DELETE FROM documents WHERE id = $1', [document.id]);

          // Track file for deletion after commit
          if (document.file_path) {
            filesToDelete.push(document.file_path);
          }

          deleted.push(docId);
          fastify.log.info({ docId }, 'Document deleted in batch');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          failed.push({ id: docId, error: errorMessage });
          fastify.log.error({ docId, error }, 'Failed to delete document in batch');
        }
      }

      // Commit transaction
      await client.query('COMMIT');
      fastify.log.info(
        { deletedCount: deleted.length, failedCount: failed.length },
        'Batch deletion transaction committed'
      );
    } catch (error) {
      if (transactionStarted) {
        await client.query('ROLLBACK');
        fastify.log.error(error, 'Batch deletion transaction rolled back');
      }
      return reply.code(500).send({
        error: 'Batch deletion failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      client.release();
    }

    // Delete files from disk (after successful commit)
    for (const filePath of filesToDelete) {
      try {
        await deleteFileIfExists(filePath);
      } catch (error) {
        // Log but don't fail the operation if file deletion fails
        fastify.log.warn({ filePath, error }, 'Failed to delete file during batch deletion');
      }
    }

    return reply.send({
      deleted,
      failed,
      summary: {
        total: documentIds.length,
        deleted: deleted.length,
        failed: failed.length,
      },
    });
  });

  // POST /api/documents/:id/refresh - Refresh document from source URL
  fastify.post<{ Params: { id: string } }>('/api/documents/:id/refresh', async (request, reply) => {
    const documentId = request.params.id;
    const db = getPool();

    try {
      // Get document
      const document = await getDocument(documentId);

      if (!document) {
        return reply.code(404).send({ error: 'Document not found' });
      }

      if (!document.source_url) {
        return reply.code(400).send({
          error: 'Document has no source URL',
          message: 'Only documents fetched from URLs can be refreshed',
        });
      }

      fastify.log.info({ documentId, sourceUrl: document.source_url }, 'Refreshing document');

      // Fetch new content from URL
      const fetchResult = await fetchWebContent(db, {
        url: document.source_url,
        collectionId: document.collection_id,
        mode: 'single',
      });

      if (fetchResult.processed.length === 0) {
        return reply.code(500).send({
          error: 'Failed to fetch content',
          message: 'Could not retrieve content from the source URL',
        });
      }

      const newDoc = fetchResult.processed[0];
      const newDocId = newDoc.docId;

      // Read the new document's content to compute hash
      const newDocument = await getDocument(newDocId);
      let contentHash = '';
      let hasChanges = true;

      if (newDocument?.file_path) {
        try {
          const content = await fs.readFile(newDocument.file_path, 'utf-8');
          // Normalize content: trim whitespace, normalize line endings
          const normalizedContent = content.trim().replace(/\r\n/g, '\n');
          contentHash = crypto.createHash('sha256').update(normalizedContent).digest('hex');

          // Check if content has changed
          if (document.source_url_hash && document.source_url_hash === contentHash) {
            hasChanges = false;
            fastify.log.info({ documentId }, 'Document content unchanged, skipping re-ingestion');
          }
        } catch (error) {
          fastify.log.warn({ documentId, error }, 'Failed to compute content hash');
        }
      }

      if (hasChanges) {
        // Delete old chunks
        await deleteDocumentChunks(documentId);

        // Copy new file to old document's path (or update path)
        if (newDocument?.file_path && document.file_path) {
          try {
            await fs.copyFile(newDocument.file_path, document.file_path);
            fastify.log.info(
              { documentId, from: newDocument.file_path, to: document.file_path },
              'Copied new content'
            );
          } catch (error) {
            fastify.log.error({ documentId, error }, 'Failed to copy new content');
          }
        }

        // Update document metadata: increment version, update hash, set last_checked_at
        await db.query(
          `UPDATE documents 
           SET version = version + 1, 
               source_url_hash = $1, 
               last_checked_at = NOW(),
               updated_at = NOW()
           WHERE id = $2`,
          [contentHash, documentId]
        );

        // Re-run ingestion on the original document
        ingestDocument(documentId).catch((error: unknown) => {
          fastify.log.error({ documentId, error }, 'Re-ingestion failed after refresh');
        });

        fastify.log.info(
          { documentId, version: document.version + 1 },
          'Document refreshed successfully'
        );
      } else {
        // Just update last_checked_at
        await db.query(
          `UPDATE documents 
           SET last_checked_at = NOW(),
               updated_at = NOW()
           WHERE id = $1`,
          [documentId]
        );
      }

      // Clean up the temporary new document
      try {
        await deleteDocumentChunks(newDocId);
        await db.query('DELETE FROM documents WHERE id = $1', [newDocId]);
        if (newDocument?.file_path) {
          await deleteFileIfExists(newDocument.file_path);
        }
      } catch (error) {
        fastify.log.warn({ newDocId, error }, 'Failed to clean up temporary document');
      }

      const updatedDocument = await getDocument(documentId);

      return reply.send({
        documentId,
        version: updatedDocument?.version ?? document.version,
        hasChanges,
        message: hasChanges ? 'Document refreshed successfully' : 'Document is up to date',
      });
    } catch (error) {
      fastify.log.error({ documentId, error }, 'Failed to refresh document');
      return reply.code(500).send({
        error: 'Failed to refresh document',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
};
