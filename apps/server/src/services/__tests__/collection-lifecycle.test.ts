/**
 * Collection Lifecycle Service Tests
 *
 * Tests for document versioning, archiving, and lifecycle operations.
 *
 * @module services/__tests__/collection-lifecycle.test
 * @since Phase 7: Collection Versioning
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the database module
vi.mock('@synthesis/db', () => ({
  getPool: vi.fn(() => ({
    query: vi.fn(),
  })),
}));

import { getPool } from '@synthesis/db';
import {
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
} from '../collection-lifecycle.js';

describe('Collection Lifecycle Service', () => {
  const mockPool = {
    query: vi.fn(),
  };

  beforeAll(() => {
    (getPool as ReturnType<typeof vi.fn>).mockReturnValue(mockPool);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('archiveDocument', () => {
    it('should archive an active document', async () => {
      const documentId = 'doc-123';
      const archivedAt = new Date();

      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ lifecycle_status: 'active' }],
        })
        .mockResolvedValueOnce({
          rows: [{ archived_at: archivedAt }],
        });

      const result = await archiveDocument(documentId);

      expect(result.success).toBe(true);
      expect(result.document_id).toBe(documentId);
      expect(result.previous_status).toBe('active');
      expect(result.new_status).toBe('archived');
      expect(result.archived_at).toBe(archivedAt);
    });

    it('should return success without update if already archived', async () => {
      const documentId = 'doc-123';

      mockPool.query.mockResolvedValueOnce({
        rows: [{ lifecycle_status: 'archived' }],
      });

      const result = await archiveDocument(documentId);

      expect(result.success).toBe(true);
      expect(result.previous_status).toBe('archived');
      expect(result.new_status).toBe('archived');
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it('should throw error if document not found', async () => {
      const documentId = 'non-existent';

      mockPool.query.mockResolvedValueOnce({
        rows: [],
      });

      await expect(archiveDocument(documentId)).rejects.toThrow('Document not found');
    });
  });

  describe('restoreDocument', () => {
    it('should restore an archived document', async () => {
      const documentId = 'doc-123';

      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ lifecycle_status: 'archived' }],
        })
        .mockResolvedValueOnce({
          rows: [],
        });

      const result = await restoreDocument(documentId);

      expect(result.success).toBe(true);
      expect(result.document_id).toBe(documentId);
      expect(result.previous_status).toBe('archived');
      expect(result.new_status).toBe('active');
    });

    it('should restore a superseded document', async () => {
      const documentId = 'doc-123';

      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ lifecycle_status: 'superseded' }],
        })
        .mockResolvedValueOnce({
          rows: [],
        });

      const result = await restoreDocument(documentId);

      expect(result.success).toBe(true);
      expect(result.previous_status).toBe('superseded');
      expect(result.new_status).toBe('active');
    });

    it('should return success without update if already active', async () => {
      const documentId = 'doc-123';

      mockPool.query.mockResolvedValueOnce({
        rows: [{ lifecycle_status: 'active' }],
      });

      const result = await restoreDocument(documentId);

      expect(result.success).toBe(true);
      expect(result.previous_status).toBe('active');
      expect(result.new_status).toBe('active');
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('supersedeDocument', () => {
    it('should supersede a document with a new one', async () => {
      const oldDocId = 'old-doc';
      const newDocId = 'new-doc';

      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            { id: oldDocId, lifecycle_status: 'active' },
            { id: newDocId, lifecycle_status: 'active' },
          ],
        })
        .mockResolvedValueOnce({
          rows: [],
        });

      const result = await supersedeDocument(oldDocId, newDocId);

      expect(result.success).toBe(true);
      expect(result.old_document_id).toBe(oldDocId);
      expect(result.new_document_id).toBe(newDocId);
    });

    it('should fail if old document is already superseded', async () => {
      const oldDocId = 'old-doc';
      const newDocId = 'new-doc';

      mockPool.query.mockResolvedValueOnce({
        rows: [
          { id: oldDocId, lifecycle_status: 'superseded' },
          { id: newDocId, lifecycle_status: 'active' },
        ],
      });

      const result = await supersedeDocument(oldDocId, newDocId);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Document is already superseded');
    });

    it('should throw error if document not found', async () => {
      const oldDocId = 'old-doc';
      const newDocId = 'non-existent';

      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: oldDocId, lifecycle_status: 'active' }],
      });

      await expect(supersedeDocument(oldDocId, newDocId)).rejects.toThrow('Document not found');
    });
  });

  describe('batchArchiveDocuments', () => {
    it('should archive multiple documents', async () => {
      const documentIds = ['doc-1', 'doc-2', 'doc-3'];

      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'doc-1' }, { id: 'doc-2' }, { id: 'doc-3' }],
      });

      const result = await batchArchiveDocuments(documentIds);

      expect(result.success).toBe(true);
      expect(result.archived_count).toBe(3);
      expect(result.archived_ids).toEqual(documentIds);
      expect(result.failed_ids).toEqual([]);
    });

    it('should report partial success', async () => {
      const documentIds = ['doc-1', 'doc-2', 'doc-3'];

      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'doc-1' }, { id: 'doc-3' }],
      });

      const result = await batchArchiveDocuments(documentIds);

      expect(result.success).toBe(false);
      expect(result.archived_count).toBe(2);
      expect(result.archived_ids).toEqual(['doc-1', 'doc-3']);
      expect(result.failed_ids).toEqual(['doc-2']);
    });
  });

  describe('batchRestoreDocuments', () => {
    it('should restore multiple documents', async () => {
      const documentIds = ['doc-1', 'doc-2'];

      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'doc-1' }, { id: 'doc-2' }],
      });

      const result = await batchRestoreDocuments(documentIds);

      expect(result.restored_count).toBe(2);
      expect(result.restored_ids).toEqual(documentIds);
    });
  });

  describe('batchArchiveByFrameworkVersion', () => {
    it('should archive all documents with specific framework version', async () => {
      const collectionId = 'collection-123';
      const frameworkVersion = 'Flutter 3.24.0';

      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'doc-1' }, { id: 'doc-2' }],
      });

      const result = await batchArchiveByFrameworkVersion(collectionId, frameworkVersion);

      expect(result.success).toBe(true);
      expect(result.archived_count).toBe(2);
      expect(result.message).toContain(frameworkVersion);
    });
  });

  describe('getDocumentsByStatus', () => {
    it('should return all documents when status is "all"', async () => {
      const collectionId = 'collection-123';
      const mockDocs = [
        { id: 'doc-1', lifecycle_status: 'active' },
        { id: 'doc-2', lifecycle_status: 'archived' },
      ];

      mockPool.query.mockResolvedValueOnce({
        rows: mockDocs,
      });

      const result = await getDocumentsByStatus(collectionId, 'all');

      expect(result).toEqual(mockDocs);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE collection_id = $1'),
        [collectionId]
      );
    });

    it('should filter by specific status', async () => {
      const collectionId = 'collection-123';
      const mockDocs = [{ id: 'doc-1', lifecycle_status: 'active' }];

      mockPool.query.mockResolvedValueOnce({
        rows: mockDocs,
      });

      const result = await getDocumentsByStatus(collectionId, 'active');

      expect(result).toEqual(mockDocs);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND lifecycle_status = $2'),
        [collectionId, 'active']
      );
    });
  });

  describe('getDocumentVersionHistory', () => {
    it('should return version history for document with source_url_hash', async () => {
      const documentId = 'doc-123';
      const sourceUrlHash = 'hash-abc';
      const mockVersions = [
        { id: 'doc-123', title: 'Doc v2', doc_version: '2.0', lifecycle_status: 'active' },
        { id: 'doc-122', title: 'Doc v1', doc_version: '1.0', lifecycle_status: 'superseded' },
      ];

      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ source_url_hash: sourceUrlHash }],
        })
        .mockResolvedValueOnce({
          rows: mockVersions,
        });

      const result = await getDocumentVersionHistory(documentId);

      expect(result.document_id).toBe(documentId);
      expect(result.source_url_hash).toBe(sourceUrlHash);
      expect(result.versions).toHaveLength(2);
    });

    it('should return single document when no source_url_hash', async () => {
      const documentId = 'doc-123';
      const mockDoc = {
        id: documentId,
        title: 'Single Doc',
        doc_version: '1.0',
        lifecycle_status: 'active',
      };

      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ source_url_hash: null }],
        })
        .mockResolvedValueOnce({
          rows: [mockDoc],
        });

      const result = await getDocumentVersionHistory(documentId);

      expect(result.document_id).toBe(documentId);
      expect(result.source_url_hash).toBeNull();
      expect(result.versions).toHaveLength(1);
    });
  });

  describe('getCollectionFrameworkVersions', () => {
    it('should return framework versions with counts', async () => {
      const collectionId = 'collection-123';
      const mockVersions = [
        {
          framework_version: 'Flutter 3.24.0',
          document_count: '10',
          active_count: '8',
          archived_count: '2',
        },
        {
          framework_version: 'Flutter 3.22.0',
          document_count: '5',
          active_count: '0',
          archived_count: '5',
        },
      ];

      mockPool.query.mockResolvedValueOnce({
        rows: mockVersions,
      });

      const result = await getCollectionFrameworkVersions(collectionId);

      expect(result).toHaveLength(2);
      expect(result[0].framework_version).toBe('Flutter 3.24.0');
      expect(result[0].document_count).toBe(10);
      expect(result[0].active_count).toBe(8);
    });
  });

  describe('getCollectionVersionStats', () => {
    it('should return collection version statistics', async () => {
      const collectionId = 'collection-123';

      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              total_documents: '15',
              active_documents: '10',
              archived_documents: '3',
              superseded_documents: '2',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              framework_version: 'Flutter 3.24.0',
              document_count: '15',
              active_count: '10',
              archived_count: '3',
            },
          ],
        });

      const result = await getCollectionVersionStats(collectionId);

      expect(result.collection_id).toBe(collectionId);
      expect(result.total_documents).toBe(15);
      expect(result.active_documents).toBe(10);
      expect(result.archived_documents).toBe(3);
      expect(result.superseded_documents).toBe(2);
      expect(result.framework_versions).toHaveLength(1);
    });
  });
});
