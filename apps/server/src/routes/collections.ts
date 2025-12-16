import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {
  type ToolpackName,
  createCollection,
  deleteCollection,
  deleteDocumentChunks,
  getCollection,
  getCollectionOptimalSettings,
  getCollectionToolpacks,
  getDocument,
  getDocumentFileInfo,
  getPool,
  listCollections,
  listDocuments,
  updateCollectionOptimalSettings,
  updateCollectionToolpacks,
} from '@synthesis/db';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { deleteFileIfExists } from '../agent/utils/storage.js';
import { analyzerRegistry, calculateChunkingQuality } from '../pipeline/analyzers/registry.js';
import { ingestDocument } from '../pipeline/orchestrator.js';
import {
  DocumentNotFoundError,
  LifecycleOperationError,
  type LifecycleStatus,
  archiveDocument,
  batchArchiveByFrameworkVersion,
  batchArchiveDocuments,
  batchRestoreDocuments,
  getCollectionFrameworkVersions,
  getCollectionVersionStats,
  getDocumentVersionHistory,
  getDocumentsByStatus,
  restoreDocument,
  supersedeDocument,
} from '../services/collection-lifecycle.js';
import { generateOptimalSettings } from '../services/content-analyzer.js';
import { fetchWebContent } from '../services/documentOperations.js';
import { getRelatedFiles } from '../services/file-relationships.js';

const CreateCollectionSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
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

  // GET /api/collections/:id/language-stats - Get language statistics for collection
  fastify.get<{ Params: { id: string } }>(
    '/api/collections/:id/language-stats',
    async (request, reply) => {
      try {
        const { id } = request.params;
        const db = getPool();

        // Query documents with file extensions from metadata or file_path
        const result = await db.query(
          `SELECT
            LOWER(
              COALESCE(
                NULLIF(REGEXP_REPLACE(metadata->>'file_path', '.*\\.', ''), ''),
                NULLIF(REGEXP_REPLACE(file_path, '.*\\.', ''), '')
              )
            ) as extension,
            COUNT(*) as file_count
          FROM documents
          WHERE collection_id = $1
            AND (metadata->>'file_path' IS NOT NULL OR file_path IS NOT NULL)
            AND (
              (metadata->>'file_path' IS NOT NULL AND metadata->>'file_path' LIKE '%.%')
              OR (file_path IS NOT NULL AND file_path LIKE '%.%')
            )
          GROUP BY extension
          HAVING LENGTH(LOWER(
            COALESCE(
              NULLIF(REGEXP_REPLACE(metadata->>'file_path', '.*\\.', ''), ''),
              NULLIF(REGEXP_REPLACE(file_path, '.*\\.', ''), '')
            )
          )) BETWEEN 1 AND 10
          ORDER BY file_count DESC`,
          [id]
        );

        // Map extensions to language support status
        const stats = result.rows
          .filter((row) => row.extension)
          .map((row) => {
            const status = analyzerRegistry.getLanguageSupportStatus(row.extension);
            const analyzer = analyzerRegistry.getByExtension(row.extension);
            const chunkingQuality = calculateChunkingQuality(analyzer, []);
            return {
              ...status,
              fileCount: Number.parseInt(row.file_count, 10),
              chunkingQuality,
            };
          });

        return reply.send({ languages: stats });
      } catch (error) {
        fastify.log.error(error, 'Failed to get language stats');
        return reply.code(500).send({ error: 'Failed to get language stats' });
      }
    }
  );

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

  // PATCH /api/collections/:id/mmr-defaults - Update MMR defaults for collection
  const UpdateMMRDefaultsSchema = z.object({
    mmr_enabled: z.boolean().optional(),
    mmr_lambda: z.number().min(0.3).max(1.0).optional(),
  });

  fastify.patch<{
    Params: { id: string };
    Body: { mmr_enabled?: boolean; mmr_lambda?: number };
  }>('/api/collections/:id/mmr-defaults', async (request, reply) => {
    try {
      const validation = UpdateMMRDefaultsSchema.safeParse(request.body);

      if (!validation.success) {
        return reply.code(400).send({
          error: 'Invalid request',
          details: validation.error.issues,
        });
      }

      const { mmr_enabled, mmr_lambda } = validation.data;
      const db = getPool();

      const result = await db.query(
        `UPDATE collections
         SET mmr_enabled = COALESCE($1, mmr_enabled),
             mmr_lambda = COALESCE($2, mmr_lambda),
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [mmr_enabled, mmr_lambda, request.params.id]
      );

      if (result.rowCount === 0) {
        return reply.code(404).send({ error: 'Collection not found' });
      }

      fastify.log.info(
        { collectionId: request.params.id, mmr_enabled, mmr_lambda },
        'Collection MMR defaults updated'
      );

      return reply.send(result.rows[0]);
    } catch (error) {
      fastify.log.error(error, 'Failed to update collection MMR defaults');
      return reply.code(500).send({ error: 'Failed to update MMR defaults' });
    }
  });

  // GET /api/collections/:id/optimal-settings - Get auto-detected optimal settings
  fastify.get<{ Params: { id: string } }>(
    '/api/collections/:id/optimal-settings',
    async (request, reply) => {
      try {
        const settings = await getCollectionOptimalSettings(request.params.id);

        if (!settings) {
          return reply.code(404).send({
            error: 'No optimal settings found for this collection',
            hint: 'Ingest documents or POST to /api/collections/:id/analyze to generate settings',
          });
        }

        return reply.send(settings);
      } catch (error) {
        fastify.log.error(error, 'Failed to get optimal settings');
        return reply.code(500).send({ error: 'Failed to get optimal settings' });
      }
    }
  );

  // POST /api/collections/:id/analyze - Manually trigger content analysis
  fastify.post<{ Params: { id: string } }>(
    '/api/collections/:id/analyze',
    async (request, reply) => {
      try {
        // Verify collection exists
        const collection = await getCollection(request.params.id);
        if (!collection) {
          return reply.code(404).send({ error: 'Collection not found' });
        }

        const settings = await generateOptimalSettings(request.params.id);
        await updateCollectionOptimalSettings(request.params.id, settings);

        fastify.log.info(
          {
            collectionId: request.params.id,
            provider: settings.embeddingProvider,
            model: settings.embeddingModel,
            mode: settings.searchMode,
            confidence: settings.confidence,
          },
          'Collection optimal settings analyzed'
        );

        return reply.send(settings);
      } catch (error) {
        fastify.log.error(error, 'Failed to analyze collection');
        return reply.code(500).send({
          error: 'Failed to analyze collection',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

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

  // POST /api/collections/batch/delete - Batch delete multiple collections
  const BatchDeleteCollectionsSchema = z.object({
    collection_ids: z.array(z.string().uuid()).min(1),
  });

  fastify.post<{ Body: { collection_ids: string[] } }>(
    '/api/collections/batch/delete',
    async (request, reply) => {
      try {
        const validation = BatchDeleteCollectionsSchema.safeParse(request.body);
        if (!validation.success) {
          return reply.code(400).send({
            error: 'Invalid request',
            details: validation.error.issues,
          });
        }

        const { collection_ids } = validation.data;
        const deletedIds: string[] = [];
        const failedIds: string[] = [];

        for (const collectionId of collection_ids) {
          try {
            const collection = await getCollection(collectionId);
            if (collection) {
              await deleteCollection(collectionId);
              deletedIds.push(collectionId);
              fastify.log.info({ collection_id: collectionId }, 'Collection deleted in batch');
            } else {
              failedIds.push(collectionId);
            }
          } catch (err) {
            fastify.log.error(
              { collection_id: collectionId, error: err },
              'Failed to delete collection in batch'
            );
            failedIds.push(collectionId);
          }
        }

        return reply.send({
          deleted_count: deletedIds.length,
          deleted_ids: deletedIds,
          failed_ids: failedIds,
        });
      } catch (error) {
        fastify.log.error(error, 'Failed to batch delete collections');
        return reply.code(500).send({ error: 'Failed to batch delete collections' });
      }
    }
  );

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

  // ============================================
  // Phase 7: Collection Versioning Routes
  // ============================================

  // GET /api/collections/:id/documents/versioned - Get documents with lifecycle filtering
  fastify.get<{
    Params: { id: string };
    Querystring: { status?: string; framework_version?: string };
  }>('/api/collections/:id/documents/versioned', async (request, reply) => {
    try {
      const { id } = request.params;
      const { status, framework_version } = request.query;

      // Validate status if provided
      const validStatuses = ['active', 'archived', 'superseded', 'all'];
      if (status && !validStatuses.includes(status)) {
        return reply.code(400).send({
          error: 'Invalid status',
          message: `Status must be one of: ${validStatuses.join(', ')}`,
        });
      }

      const lifecycleStatus = (status as LifecycleStatus | 'all') || 'all';
      let documents = await getDocumentsByStatus(id, lifecycleStatus);

      // Filter by framework_version if provided
      if (framework_version) {
        documents = documents.filter((doc) => doc.framework_version === framework_version);
      }

      return reply.send({ documents });
    } catch (error) {
      fastify.log.error(error, 'Failed to get versioned documents');
      return reply.code(500).send({ error: 'Failed to get versioned documents' });
    }
  });

  // GET /api/collections/:id/versions - Get version statistics for a collection
  fastify.get<{ Params: { id: string } }>(
    '/api/collections/:id/versions',
    async (request, reply) => {
      try {
        const stats = await getCollectionVersionStats(request.params.id);
        return reply.send(stats);
      } catch (error) {
        fastify.log.error(error, 'Failed to get collection version stats');
        return reply.code(500).send({ error: 'Failed to get collection version stats' });
      }
    }
  );

  // GET /api/collections/:id/framework-versions - Get unique framework versions
  fastify.get<{ Params: { id: string } }>(
    '/api/collections/:id/framework-versions',
    async (request, reply) => {
      try {
        const versions = await getCollectionFrameworkVersions(request.params.id);
        return reply.send({ framework_versions: versions });
      } catch (error) {
        fastify.log.error(error, 'Failed to get framework versions');
        return reply.code(500).send({ error: 'Failed to get framework versions' });
      }
    }
  );

  // GET /api/documents/:id/version-history - Get version history for a document
  fastify.get<{ Params: { id: string } }>(
    '/api/documents/:id/version-history',
    async (request, reply) => {
      try {
        const history = await getDocumentVersionHistory(request.params.id);
        return reply.send(history);
      } catch (error) {
        fastify.log.error(error, 'Failed to get document version history');
        if (error instanceof Error && error.message.includes('not found')) {
          return reply.code(404).send({ error: error.message });
        }
        return reply.code(500).send({ error: 'Failed to get document version history' });
      }
    }
  );

  // POST /api/documents/:id/archive - Archive a document
  fastify.post<{ Params: { id: string } }>('/api/documents/:id/archive', async (request, reply) => {
    try {
      const result = await archiveDocument(request.params.id);
      fastify.log.info({ documentId: request.params.id }, 'Document archived');
      return reply.send(result);
    } catch (error) {
      fastify.log.error(error, 'Failed to archive document');
      if (error instanceof DocumentNotFoundError) {
        return reply.code(404).send({ error: error.message });
      }
      if (error instanceof LifecycleOperationError) {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      return reply.code(500).send({ error: 'Failed to archive document' });
    }
  });

  // POST /api/documents/:id/restore - Restore an archived/superseded document
  fastify.post<{ Params: { id: string } }>('/api/documents/:id/restore', async (request, reply) => {
    try {
      const result = await restoreDocument(request.params.id);
      fastify.log.info({ documentId: request.params.id }, 'Document restored');
      return reply.send(result);
    } catch (error) {
      fastify.log.error(error, 'Failed to restore document');
      if (error instanceof DocumentNotFoundError) {
        return reply.code(404).send({ error: error.message });
      }
      if (error instanceof LifecycleOperationError) {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      return reply.code(500).send({ error: 'Failed to restore document' });
    }
  });

  // POST /api/documents/:id/supersede - Supersede a document with a new one
  const SupersedeSchema = z.object({
    new_document_id: z.string().uuid(),
  });

  fastify.post<{ Params: { id: string }; Body: { new_document_id: string } }>(
    '/api/documents/:id/supersede',
    async (request, reply) => {
      try {
        const validation = SupersedeSchema.safeParse(request.body);
        if (!validation.success) {
          return reply.code(400).send({
            error: 'Invalid request',
            details: validation.error.issues,
          });
        }

        const result = await supersedeDocument(request.params.id, validation.data.new_document_id);
        if (!result.success) {
          return reply.code(400).send({ error: result.message });
        }

        fastify.log.info(
          { oldDocId: request.params.id, newDocId: validation.data.new_document_id },
          'Document superseded'
        );
        return reply.send(result);
      } catch (error) {
        fastify.log.error(error, 'Failed to supersede document');
        if (error instanceof DocumentNotFoundError) {
          return reply.code(404).send({ error: error.message });
        }
        if (error instanceof LifecycleOperationError) {
          return reply.code(error.statusCode).send({ error: error.message });
        }
        return reply.code(500).send({ error: 'Failed to supersede document' });
      }
    }
  );

  // POST /api/documents/batch/archive - Archive multiple documents
  const BatchArchiveSchema = z.object({
    document_ids: z.array(z.string().uuid()).min(1),
  });

  fastify.post<{ Body: { document_ids: string[] } }>(
    '/api/documents/batch/archive',
    async (request, reply) => {
      try {
        const validation = BatchArchiveSchema.safeParse(request.body);
        if (!validation.success) {
          return reply.code(400).send({
            error: 'Invalid request',
            details: validation.error.issues,
          });
        }

        const result = await batchArchiveDocuments(validation.data.document_ids);
        fastify.log.info({ count: result.archived_count }, 'Documents batch archived');
        return reply.send(result);
      } catch (error) {
        fastify.log.error(error, 'Failed to batch archive documents');
        return reply.code(500).send({ error: 'Failed to batch archive documents' });
      }
    }
  );

  // POST /api/documents/batch/restore - Restore multiple documents
  const BatchRestoreSchema = z.object({
    document_ids: z.array(z.string().uuid()).min(1),
  });

  fastify.post<{ Body: { document_ids: string[] } }>(
    '/api/documents/batch/restore',
    async (request, reply) => {
      try {
        const validation = BatchRestoreSchema.safeParse(request.body);
        if (!validation.success) {
          return reply.code(400).send({
            error: 'Invalid request',
            details: validation.error.issues,
          });
        }

        const result = await batchRestoreDocuments(validation.data.document_ids);
        fastify.log.info({ count: result.restored_count }, 'Documents batch restored');
        return reply.send(result);
      } catch (error) {
        fastify.log.error(error, 'Failed to batch restore documents');
        return reply.code(500).send({ error: 'Failed to batch restore documents' });
      }
    }
  );

  // POST /api/collections/:id/archive-by-version - Archive all docs with a specific framework version
  const ArchiveByVersionSchema = z.object({
    framework_version: z.string().min(1),
  });

  fastify.post<{ Params: { id: string }; Body: { framework_version: string } }>(
    '/api/collections/:id/archive-by-version',
    async (request, reply) => {
      try {
        const validation = ArchiveByVersionSchema.safeParse(request.body);
        if (!validation.success) {
          return reply.code(400).send({
            error: 'Invalid request',
            details: validation.error.issues,
          });
        }

        const result = await batchArchiveByFrameworkVersion(
          request.params.id,
          validation.data.framework_version
        );
        fastify.log.info(
          { collectionId: request.params.id, version: validation.data.framework_version },
          'Documents archived by framework version'
        );
        return reply.send(result);
      } catch (error) {
        fastify.log.error(error, 'Failed to archive by framework version');
        return reply.code(500).send({ error: 'Failed to archive by framework version' });
      }
    }
  );

  // ==========================================================================
  // Toolpack Management
  // ==========================================================================

  const VALID_TOOLPACKS: ToolpackName[] = [
    'gateway',
    'core',
    'mobile_core',
    'introspection',
    'graphing',
    'web',
    'orchestration',
  ];

  const UpdateToolpacksSchema = z.object({
    toolpacks: z.array(
      z.enum([
        'gateway',
        'core',
        'mobile_core',
        'introspection',
        'graphing',
        'web',
        'orchestration',
      ])
    ),
  });

  // GET /api/collections/:id/toolpacks - Get enabled toolpacks for a collection
  fastify.get<{ Params: { id: string } }>(
    '/api/collections/:id/toolpacks',
    async (request, reply) => {
      try {
        const collection = await getCollection(request.params.id);
        if (!collection) {
          return reply.code(404).send({ error: 'Collection not found' });
        }

        const toolpacks = await getCollectionToolpacks(request.params.id);
        return reply.send({
          toolpacks,
          available: VALID_TOOLPACKS,
        });
      } catch (error) {
        fastify.log.error(error, 'Failed to get collection toolpacks');
        return reply.code(500).send({ error: 'Failed to get collection toolpacks' });
      }
    }
  );

  // PATCH /api/collections/:id/toolpacks - Update enabled toolpacks for a collection
  fastify.patch<{ Params: { id: string }; Body: { toolpacks: ToolpackName[] } }>(
    '/api/collections/:id/toolpacks',
    async (request, reply) => {
      try {
        const collection = await getCollection(request.params.id);
        if (!collection) {
          return reply.code(404).send({ error: 'Collection not found' });
        }

        const validation = UpdateToolpacksSchema.safeParse(request.body);
        if (!validation.success) {
          return reply.code(400).send({
            error: 'Invalid request',
            details: validation.error.issues,
          });
        }

        // Gateway is always included
        const toolpacks = validation.data.toolpacks;
        await updateCollectionToolpacks(request.params.id, toolpacks);

        fastify.log.info(
          { collectionId: request.params.id, toolpacks },
          'Collection toolpacks updated'
        );

        // Return updated state
        const updated = await getCollectionToolpacks(request.params.id);
        return reply.send({
          toolpacks: updated,
          available: VALID_TOOLPACKS,
        });
      } catch (error) {
        fastify.log.error(error, 'Failed to update collection toolpacks');
        return reply.code(500).send({ error: 'Failed to update collection toolpacks' });
      }
    }
  );
};
