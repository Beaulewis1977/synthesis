/**
 * Collection Lifecycle Service
 *
 * Manages document versioning, archiving, and lifecycle operations.
 * Provides functions for archiving, superseding, and restoring documents.
 *
 * @module services/collection-lifecycle
 * @since Phase 7: Collection Versioning
 */

import { getPool } from '@synthesis/db';
import type { PoolClient } from 'pg';

// ============================================
// Types
// ============================================

export type LifecycleStatus = 'active' | 'archived' | 'superseded';

export interface DocumentVersion {
  id: string;
  title: string;
  doc_version: string | null;
  lifecycle_status: LifecycleStatus;
  created_at: Date;
  superseded_by: string | null;
  framework_version: string | null;
}

export interface VersionHistoryResult {
  document_id: string;
  source_url_hash: string | null;
  versions: DocumentVersion[];
}

export interface ArchiveResult {
  success: boolean;
  document_id: string;
  previous_status: LifecycleStatus;
  new_status: LifecycleStatus;
  archived_at: Date;
}

export interface SupersedeResult {
  success: boolean;
  old_document_id: string;
  new_document_id: string;
  message: string;
}

export interface RestoreResult {
  success: boolean;
  document_id: string;
  previous_status: LifecycleStatus;
  new_status: LifecycleStatus;
}

export interface BatchArchiveResult {
  success: boolean;
  archived_count: number;
  archived_ids: string[];
  failed_ids: string[];
  message: string;
}

export interface FrameworkVersionInfo {
  framework_version: string;
  document_count: number;
  active_count: number;
  archived_count: number;
}

export interface CollectionVersionStats {
  collection_id: string;
  total_documents: number;
  active_documents: number;
  archived_documents: number;
  superseded_documents: number;
  framework_versions: FrameworkVersionInfo[];
}

// ============================================
// Archive Operations
// ============================================

/**
 * Archive a single document by setting its lifecycle_status to 'archived'.
 * Archived documents are not deleted but hidden from default views.
 */
export async function archiveDocument(
  documentId: string,
  client?: PoolClient
): Promise<ArchiveResult> {
  const pool = getPool();
  const queryFn = client ? client.query.bind(client) : pool.query.bind(pool);

  // Get current status
  const currentResult = await queryFn('SELECT lifecycle_status FROM documents WHERE id = $1', [
    documentId,
  ]);

  if (currentResult.rows.length === 0) {
    throw new Error(`Document not found: ${documentId}`);
  }

  const previousStatus = currentResult.rows[0].lifecycle_status as LifecycleStatus;

  if (previousStatus === 'archived') {
    return {
      success: true,
      document_id: documentId,
      previous_status: previousStatus,
      new_status: 'archived',
      archived_at: new Date(),
    };
  }

  // Archive the document
  const result = await queryFn(
    `UPDATE documents 
     SET lifecycle_status = 'archived', 
         archived_at = NOW(), 
         updated_at = NOW() 
     WHERE id = $1 
     RETURNING archived_at`,
    [documentId]
  );

  return {
    success: true,
    document_id: documentId,
    previous_status: previousStatus,
    new_status: 'archived',
    archived_at: result.rows[0].archived_at,
  };
}

/**
 * Supersede an old document with a new one.
 * The old document is marked as 'superseded' and linked to the new document.
 */
export async function supersedeDocument(
  oldDocumentId: string,
  newDocumentId: string,
  client?: PoolClient
): Promise<SupersedeResult> {
  const pool = getPool();
  const queryFn = client ? client.query.bind(client) : pool.query.bind(pool);

  // Verify both documents exist
  const docsResult = await queryFn(
    'SELECT id, lifecycle_status FROM documents WHERE id = ANY($1)',
    [[oldDocumentId, newDocumentId]]
  );

  if (docsResult.rows.length !== 2) {
    const foundIds = docsResult.rows.map((r: { id: string }) => r.id);
    const missingId = [oldDocumentId, newDocumentId].find((id) => !foundIds.includes(id));
    throw new Error(`Document not found: ${missingId}`);
  }

  const oldDoc = docsResult.rows.find((r: { id: string }) => r.id === oldDocumentId);
  if (oldDoc.lifecycle_status === 'superseded') {
    return {
      success: false,
      old_document_id: oldDocumentId,
      new_document_id: newDocumentId,
      message: 'Document is already superseded',
    };
  }

  // Supersede the old document
  await queryFn(
    `UPDATE documents 
     SET lifecycle_status = 'superseded', 
         superseded_by = $2, 
         updated_at = NOW() 
     WHERE id = $1`,
    [oldDocumentId, newDocumentId]
  );

  return {
    success: true,
    old_document_id: oldDocumentId,
    new_document_id: newDocumentId,
    message: 'Document superseded successfully',
  };
}

/**
 * Restore an archived or superseded document to active status.
 */
export async function restoreDocument(
  documentId: string,
  client?: PoolClient
): Promise<RestoreResult> {
  const pool = getPool();
  const queryFn = client ? client.query.bind(client) : pool.query.bind(pool);

  // Get current status
  const currentResult = await queryFn('SELECT lifecycle_status FROM documents WHERE id = $1', [
    documentId,
  ]);

  if (currentResult.rows.length === 0) {
    throw new Error(`Document not found: ${documentId}`);
  }

  const previousStatus = currentResult.rows[0].lifecycle_status as LifecycleStatus;

  if (previousStatus === 'active') {
    return {
      success: true,
      document_id: documentId,
      previous_status: previousStatus,
      new_status: 'active',
    };
  }

  // Restore the document
  await queryFn(
    `UPDATE documents 
     SET lifecycle_status = 'active', 
         archived_at = NULL, 
         superseded_by = NULL, 
         updated_at = NOW() 
     WHERE id = $1`,
    [documentId]
  );

  return {
    success: true,
    document_id: documentId,
    previous_status: previousStatus,
    new_status: 'active',
  };
}

// ============================================
// Batch Operations
// ============================================

/**
 * Archive all documents in a collection with a specific framework version.
 * Useful when updating to a new framework version.
 */
export async function batchArchiveByFrameworkVersion(
  collectionId: string,
  frameworkVersion: string,
  client?: PoolClient
): Promise<BatchArchiveResult> {
  const pool = getPool();
  const queryFn = client ? client.query.bind(client) : pool.query.bind(pool);

  const result = await queryFn(
    `UPDATE documents 
     SET lifecycle_status = 'archived', 
         archived_at = NOW(), 
         updated_at = NOW() 
     WHERE collection_id = $1 
       AND metadata->>'framework_version' = $2 
       AND lifecycle_status = 'active'
     RETURNING id`,
    [collectionId, frameworkVersion]
  );

  const archivedIds = result.rows.map((r: { id: string }) => r.id);

  return {
    success: true,
    archived_count: archivedIds.length,
    archived_ids: archivedIds,
    failed_ids: [],
    message: `Archived ${archivedIds.length} documents with framework version ${frameworkVersion}`,
  };
}

/**
 * Archive multiple documents by their IDs.
 */
export async function batchArchiveDocuments(
  documentIds: string[],
  client?: PoolClient
): Promise<BatchArchiveResult> {
  const pool = getPool();
  const queryFn = client ? client.query.bind(client) : pool.query.bind(pool);

  const result = await queryFn(
    `UPDATE documents 
     SET lifecycle_status = 'archived', 
         archived_at = NOW(), 
         updated_at = NOW() 
     WHERE id = ANY($1) 
       AND lifecycle_status = 'active'
     RETURNING id`,
    [documentIds]
  );

  const archivedIds = result.rows.map((r: { id: string }) => r.id);
  const failedIds = documentIds.filter((id) => !archivedIds.includes(id));

  return {
    success: failedIds.length === 0,
    archived_count: archivedIds.length,
    archived_ids: archivedIds,
    failed_ids: failedIds,
    message: `Archived ${archivedIds.length} of ${documentIds.length} documents`,
  };
}

/**
 * Restore multiple documents by their IDs.
 */
export async function batchRestoreDocuments(
  documentIds: string[],
  client?: PoolClient
): Promise<{ restored_count: number; restored_ids: string[] }> {
  const pool = getPool();
  const queryFn = client ? client.query.bind(client) : pool.query.bind(pool);

  const result = await queryFn(
    `UPDATE documents 
     SET lifecycle_status = 'active', 
         archived_at = NULL, 
         superseded_by = NULL, 
         updated_at = NOW() 
     WHERE id = ANY($1) 
       AND lifecycle_status IN ('archived', 'superseded')
     RETURNING id`,
    [documentIds]
  );

  const restoredIds = result.rows.map((r: { id: string }) => r.id);

  return {
    restored_count: restoredIds.length,
    restored_ids: restoredIds,
  };
}

// ============================================
// Query Operations
// ============================================

/**
 * Get documents in a collection filtered by lifecycle status.
 */
export async function getDocumentsByStatus(
  collectionId: string,
  status?: LifecycleStatus | 'all',
  client?: PoolClient
): Promise<
  Array<{
    id: string;
    title: string;
    lifecycle_status: LifecycleStatus;
    doc_version: string | null;
    framework_version: string | null;
    created_at: Date;
    updated_at: Date;
    archived_at: Date | null;
    superseded_by: string | null;
  }>
> {
  const pool = getPool();
  const queryFn = client ? client.query.bind(client) : pool.query.bind(pool);

  let sql = `
    SELECT 
      id, 
      title, 
      lifecycle_status, 
      doc_version,
      metadata->>'framework_version' as framework_version,
      created_at, 
      updated_at, 
      archived_at, 
      superseded_by
    FROM documents 
    WHERE collection_id = $1
  `;
  const params: (string | undefined)[] = [collectionId];

  if (status && status !== 'all') {
    sql += ' AND lifecycle_status = $2';
    params.push(status);
  }

  sql += ' ORDER BY created_at DESC';

  const result = await queryFn(sql, params);
  return result.rows;
}

/**
 * Get version history for a document based on source_url_hash.
 * Returns all documents that share the same source.
 */
export async function getDocumentVersionHistory(
  documentId: string,
  client?: PoolClient
): Promise<VersionHistoryResult> {
  const pool = getPool();
  const queryFn = client ? client.query.bind(client) : pool.query.bind(pool);

  // First get the source_url_hash for the document
  const docResult = await queryFn('SELECT source_url_hash FROM documents WHERE id = $1', [
    documentId,
  ]);

  if (docResult.rows.length === 0) {
    throw new Error(`Document not found: ${documentId}`);
  }

  const sourceUrlHash = docResult.rows[0].source_url_hash;

  if (!sourceUrlHash) {
    // No source_url_hash means no version history
    const singleDoc = await queryFn(
      `SELECT 
        id, 
        title, 
        doc_version, 
        lifecycle_status, 
        created_at, 
        superseded_by,
        metadata->>'framework_version' as framework_version
       FROM documents 
       WHERE id = $1`,
      [documentId]
    );

    return {
      document_id: documentId,
      source_url_hash: null,
      versions: singleDoc.rows.map((r) => ({
        id: r.id,
        title: r.title,
        doc_version: r.doc_version,
        lifecycle_status: r.lifecycle_status,
        created_at: r.created_at,
        superseded_by: r.superseded_by,
        framework_version: r.framework_version,
      })),
    };
  }

  // Get all documents with the same source_url_hash
  const versionsResult = await queryFn(
    `SELECT 
      id, 
      title, 
      doc_version, 
      lifecycle_status, 
      created_at, 
      superseded_by,
      metadata->>'framework_version' as framework_version
     FROM documents 
     WHERE source_url_hash = $1 
     ORDER BY created_at DESC`,
    [sourceUrlHash]
  );

  return {
    document_id: documentId,
    source_url_hash: sourceUrlHash,
    versions: versionsResult.rows.map((r) => ({
      id: r.id,
      title: r.title,
      doc_version: r.doc_version,
      lifecycle_status: r.lifecycle_status,
      created_at: r.created_at,
      superseded_by: r.superseded_by,
      framework_version: r.framework_version,
    })),
  };
}

/**
 * Get unique framework versions in a collection with counts.
 */
export async function getCollectionFrameworkVersions(
  collectionId: string,
  client?: PoolClient
): Promise<FrameworkVersionInfo[]> {
  const pool = getPool();
  const queryFn = client ? client.query.bind(client) : pool.query.bind(pool);

  const result = await queryFn(
    `SELECT 
      metadata->>'framework_version' as framework_version,
      COUNT(*) as document_count,
      COUNT(*) FILTER (WHERE lifecycle_status = 'active') as active_count,
      COUNT(*) FILTER (WHERE lifecycle_status = 'archived') as archived_count
     FROM documents 
     WHERE collection_id = $1 
       AND metadata->>'framework_version' IS NOT NULL
     GROUP BY metadata->>'framework_version'
     ORDER BY metadata->>'framework_version' DESC`,
    [collectionId]
  );

  return result.rows.map((r) => ({
    framework_version: r.framework_version,
    document_count: Number.parseInt(r.document_count, 10),
    active_count: Number.parseInt(r.active_count, 10),
    archived_count: Number.parseInt(r.archived_count, 10),
  }));
}

/**
 * Get version statistics for a collection.
 */
export async function getCollectionVersionStats(
  collectionId: string,
  client?: PoolClient
): Promise<CollectionVersionStats> {
  const pool = getPool();
  const queryFn = client ? client.query.bind(client) : pool.query.bind(pool);

  const statsResult = await queryFn(
    `SELECT 
      COUNT(*) as total_documents,
      COUNT(*) FILTER (WHERE lifecycle_status = 'active') as active_documents,
      COUNT(*) FILTER (WHERE lifecycle_status = 'archived') as archived_documents,
      COUNT(*) FILTER (WHERE lifecycle_status = 'superseded') as superseded_documents
     FROM documents 
     WHERE collection_id = $1`,
    [collectionId]
  );

  const frameworkVersions = await getCollectionFrameworkVersions(collectionId, client);

  const stats = statsResult.rows[0];

  return {
    collection_id: collectionId,
    total_documents: Number.parseInt(stats.total_documents, 10),
    active_documents: Number.parseInt(stats.active_documents, 10),
    archived_documents: Number.parseInt(stats.archived_documents, 10),
    superseded_documents: Number.parseInt(stats.superseded_documents, 10),
    framework_versions: frameworkVersions,
  };
}

/**
 * Update the doc_version field for a document.
 */
export async function setDocumentVersion(
  documentId: string,
  version: string,
  client?: PoolClient
): Promise<void> {
  const pool = getPool();
  const queryFn = client ? client.query.bind(client) : pool.query.bind(pool);

  await queryFn(
    `UPDATE documents 
     SET doc_version = $2, updated_at = NOW() 
     WHERE id = $1`,
    [documentId, version]
  );
}

/**
 * Update the branch field for a document.
 */
export async function setDocumentBranch(
  documentId: string,
  branch: string,
  client?: PoolClient
): Promise<void> {
  const pool = getPool();
  const queryFn = client ? client.query.bind(client) : pool.query.bind(pool);

  await queryFn(
    `UPDATE documents 
     SET branch = $2, updated_at = NOW() 
     WHERE id = $1`,
    [documentId, branch]
  );
}
