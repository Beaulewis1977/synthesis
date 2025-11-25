/**
 * Document management routes
 * Includes chunk viewing/editing, metadata editing, and stale document management
 */

import { getDocument, getDocumentChunks, getPool, upsertChunk } from '@synthesis/db';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { embedText } from '../pipeline/embed.js';
import { getStaleDocuments, runStaleCheckJob } from '../services/stale-check-job.js';

// Schemas
const UpdateChunkSchema = z.object({
  text: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateDocumentMetadataSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const BatchDeleteSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(100),
});

export const documentRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/documents/:id - Get document details
  fastify.get<{ Params: { id: string } }>('/api/documents/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const document = await getDocument(id);

      if (!document) {
        return reply.code(404).send({ error: 'Document not found' });
      }

      return reply.send({ document });
    } catch (error) {
      fastify.log.error(error, 'Failed to get document');
      return reply.code(500).send({ error: 'Failed to get document' });
    }
  });

  // GET /api/documents/:id/chunks - Get all chunks for a document
  fastify.get<{ Params: { id: string } }>('/api/documents/:id/chunks', async (request, reply) => {
    const { id } = request.params;

    try {
      const document = await getDocument(id);

      if (!document) {
        return reply.code(404).send({ error: 'Document not found' });
      }

      const chunks = await getDocumentChunks(id);

      return reply.send({
        document: {
          id: document.id,
          title: document.title,
          status: document.status,
        },
        chunks: chunks.map((chunk) => ({
          id: chunk.id,
          chunk_index: chunk.chunk_index,
          text: chunk.text,
          token_count: chunk.token_count,
          metadata: chunk.metadata,
          has_embedding: !!chunk.embedding,
          embedding_model: chunk.embedding_model,
        })),
        total: chunks.length,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to get document chunks');
      return reply.code(500).send({ error: 'Failed to get document chunks' });
    }
  });

  // PUT /api/documents/:id/chunks/:chunkIndex - Update a specific chunk
  fastify.put<{ Params: { id: string; chunkIndex: string } }>(
    '/api/documents/:id/chunks/:chunkIndex',
    async (request, reply) => {
      const { id, chunkIndex } = request.params;
      const chunkIdx = Number.parseInt(chunkIndex, 10);

      if (Number.isNaN(chunkIdx) || chunkIdx < 0) {
        return reply.code(400).send({ error: 'Invalid chunk index' });
      }

      const validation = UpdateChunkSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.code(400).send({
          error: 'Invalid request',
          details: validation.error.issues,
        });
      }

      try {
        const document = await getDocument(id);

        if (!document) {
          return reply.code(404).send({ error: 'Document not found' });
        }

        const { text, metadata } = validation.data;

        // Generate new embedding for the updated text
        fastify.log.info(
          { docId: id, chunkIndex: chunkIdx },
          'Generating embedding for updated chunk'
        );

        let embedding: number[] | undefined;
        let embeddingModel: string | undefined;

        try {
          const embeddingResult = await embedText(text);
          embedding = embeddingResult.embedding;
          embeddingModel = embeddingResult.model;
        } catch (embeddingError) {
          fastify.log.warn(
            { error: embeddingError },
            'Failed to generate embedding, saving without'
          );
        }

        // Upsert the chunk
        const updatedChunk = await upsertChunk({
          doc_id: id,
          chunk_index: chunkIdx,
          text,
          token_count: Math.ceil(text.length / 4), // Rough estimate
          embedding,
          embedding_model: embeddingModel,
          metadata: metadata || {},
        });

        return reply.send({
          message: 'Chunk updated successfully',
          chunk: {
            id: updatedChunk.id,
            chunk_index: updatedChunk.chunk_index,
            text: updatedChunk.text,
            token_count: updatedChunk.token_count,
            metadata: updatedChunk.metadata,
            has_embedding: !!updatedChunk.embedding,
            embedding_model: updatedChunk.embedding_model,
          },
        });
      } catch (error) {
        fastify.log.error(error, 'Failed to update chunk');
        return reply.code(500).send({ error: 'Failed to update chunk' });
      }
    }
  );

  // PATCH /api/documents/:id/metadata - Update document metadata
  fastify.patch<{ Params: { id: string } }>(
    '/api/documents/:id/metadata',
    async (request, reply) => {
      const { id } = request.params;

      const validation = UpdateDocumentMetadataSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.code(400).send({
          error: 'Invalid request',
          details: validation.error.issues,
        });
      }

      try {
        const document = await getDocument(id);

        if (!document) {
          return reply.code(404).send({ error: 'Document not found' });
        }

        const { title, metadata } = validation.data;
        const pool = getPool();

        const updates: string[] = ['updated_at = NOW()'];
        const params: (string | null)[] = [id];
        let paramIndex = 2;

        if (title) {
          updates.push(`title = $${paramIndex++}`);
          params.push(title);
        }

        if (metadata) {
          updates.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${paramIndex++}::jsonb`);
          params.push(JSON.stringify(metadata));
        }

        await pool.query(`UPDATE documents SET ${updates.join(', ')} WHERE id = $1`, params);

        const updatedDocument = await getDocument(id);

        return reply.send({
          message: 'Document metadata updated successfully',
          document: updatedDocument,
        });
      } catch (error) {
        fastify.log.error(error, 'Failed to update document metadata');
        return reply.code(500).send({ error: 'Failed to update document metadata' });
      }
    }
  );

  // GET /api/documents/stale - Get stale documents
  fastify.get<{ Querystring: { collection_id?: string } }>(
    '/api/documents/stale',
    async (request, reply) => {
      const { collection_id } = request.query;

      try {
        const staleDocuments = await getStaleDocuments(collection_id);

        return reply.send({
          documents: staleDocuments,
          total: staleDocuments.length,
        });
      } catch (error) {
        fastify.log.error(error, 'Failed to get stale documents');
        return reply.code(500).send({ error: 'Failed to get stale documents' });
      }
    }
  );

  // POST /api/documents/stale-check - Trigger manual stale check
  fastify.post('/api/documents/stale-check', async (_request, reply) => {
    try {
      // Run in background, return immediately
      const jobPromise = runStaleCheckJob((stats) => {
        fastify.log.info({ stats }, 'Stale check progress');
      });

      // Don't await - let it run in background
      jobPromise.catch((error) => {
        fastify.log.error(error, 'Background stale check failed');
      });

      return reply.code(202).send({
        message: 'Stale check job started',
        status: 'processing',
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to start stale check');
      return reply.code(500).send({ error: 'Failed to start stale check' });
    }
  });

  // DELETE /api/documents/batch - Batch delete multiple documents
  fastify.delete('/api/documents/batch', async (request, reply) => {
    const validation = BatchDeleteSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send({
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const { documentIds } = validation.data;
    const pool = getPool();

    const deleted: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    // Process each document
    for (const docId of documentIds) {
      try {
        const document = await getDocument(docId);

        if (!document) {
          failed.push({ id: docId, error: 'Document not found' });
          continue;
        }

        // Delete chunks first
        await pool.query('DELETE FROM chunks WHERE doc_id = $1', [docId]);

        // Delete document
        await pool.query('DELETE FROM documents WHERE id = $1', [docId]);

        deleted.push(docId);
      } catch (error) {
        fastify.log.error({ error, docId }, 'Failed to delete document in batch');
        failed.push({
          id: docId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
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

  // DELETE /api/documents/:id - Delete a single document
  fastify.delete<{ Params: { id: string } }>('/api/documents/:id', async (request, reply) => {
    const { id } = request.params;
    const pool = getPool();

    try {
      const document = await getDocument(id);

      if (!document) {
        return reply.code(404).send({ error: 'Document not found' });
      }

      // Delete chunks first (should cascade, but be explicit)
      await pool.query('DELETE FROM chunks WHERE doc_id = $1', [id]);

      // Delete document
      await pool.query('DELETE FROM documents WHERE id = $1', [id]);

      return reply.send({
        success: true,
        message: 'Document deleted successfully',
        documentId: id,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to delete document');
      return reply.code(500).send({ error: 'Failed to delete document' });
    }
  });
};
