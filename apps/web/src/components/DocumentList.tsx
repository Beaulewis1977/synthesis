import { CheckCircle, Clock, Edit2, Eye, RefreshCw, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatFileSize,
  formatRelativeTime,
  getFileTypeIcon,
  getFileTypeLabel,
} from '../lib/utils';
import type { Document } from '../types';
import { BatchActions, DocumentActions, LifecycleBadge, VersionBadge } from './collections';

interface DocumentListProps {
  documents: Document[];
  collectionId: string;
  onDelete: (documentId: string) => void;
  onBatchDelete?: (documentIds: string[]) => void;
  onRefresh?: (documentId: string) => void;
  isDeleting?: boolean;
  isBatchDeleting?: boolean;
  isRefreshing?: boolean;
  refreshingDocId?: string;
}

interface DocumentItemProps {
  document: Document;
  collectionId: string;
  onDelete: (documentId: string) => void;
  onRefresh?: (documentId: string) => void;
  isDeleting?: boolean;
  isRefreshing?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (documentId: string) => void;
  showCheckbox?: boolean;
}

function DocumentItem({
  document,
  collectionId,
  onDelete,
  onRefresh,
  isDeleting,
  isRefreshing,
  isSelected,
  onToggleSelect,
  showCheckbox,
}: DocumentItemProps) {
  const FileIcon = getFileTypeIcon(document.content_type ?? '');

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh(document.id);
    }
  };

  const getStatusBadge = () => {
    switch (document.status) {
      case 'complete':
        return (
          <span className="inline-flex items-center gap-xs text-success text-sm">
            <CheckCircle size={16} />
            Ready
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-xs text-warning text-sm">
            <Clock size={16} />
            Processing
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-xs text-error text-sm">
            <XCircle size={16} />
            Error
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`border border-border rounded-lg p-md hover:bg-bg-secondary transition-colors ${
        isSelected ? 'bg-accent/5 border-accent' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-md">
        <div className="flex items-start gap-md flex-1 min-w-0">
          {showCheckbox && onToggleSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(document.id)}
              className="mt-xs cursor-pointer w-4 h-4 accent-accent"
              aria-label={`Select ${document.title}`}
            />
          )}
          <FileIcon className="text-accent flex-shrink-0 mt-xs" size={20} />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-text-primary truncate mb-xs">{document.title}</h3>
            <div className="flex flex-wrap items-center gap-x-md gap-y-xs text-sm text-text-secondary">
              <span>{getFileTypeLabel(document.content_type ?? '')}</span>
              <span>•</span>
              <span>{formatFileSize(document.file_size ?? 0)}</span>
              <span>•</span>
              <span>{formatRelativeTime(document.created_at)}</span>
            </div>
            {document.error_message && (
              <p className="text-sm text-error mt-xs">{document.error_message}</p>
            )}
            {/* Phase 7: Lifecycle and Version badges */}
            <div className="flex flex-wrap items-center gap-xs mt-xs">
              {document.lifecycle_status && document.lifecycle_status !== 'active' && (
                <LifecycleBadge status={document.lifecycle_status} size="sm" />
              )}
              <VersionBadge
                version={document.doc_version}
                frameworkVersion={
                  document.metadata &&
                  typeof document.metadata === 'object' &&
                  'framework_version' in document.metadata
                    ? String(document.metadata.framework_version)
                    : null
                }
                branch={document.branch}
                size="sm"
              />
            </div>
            {/* Vision OCR indicator */}
            {document.metadata &&
              typeof document.metadata === 'object' &&
              'extractionMethod' in document.metadata &&
              document.metadata.extractionMethod === 'vision-ocr' && (
                <div className="flex items-center gap-xs text-xs text-text-secondary mt-xs">
                  <Eye size={12} />
                  <span>
                    Processed with Vision OCR
                    {'visionOCRConfidence' in document.metadata &&
                      typeof document.metadata.visionOCRConfidence === 'string' &&
                      ` (${document.metadata.visionOCRConfidence} confidence)`}
                  </span>
                </div>
              )}
          </div>
        </div>
        <div className="flex items-center gap-md flex-shrink-0">
          {getStatusBadge()}
          {!showCheckbox && (
            <>
              {/* Edit button */}
              <Link
                to={`/documents/${document.id}/edit`}
                className="text-text-secondary hover:text-accent transition-colors"
                title="Edit document chunks"
                aria-label="Edit document"
              >
                <Edit2 size={18} />
              </Link>
              {/* Refresh button for documents with source URLs */}
              {document.source_url && onRefresh && (
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="text-text-secondary hover:text-accent transition-colors"
                  title="Refresh document from source"
                  aria-label="Refresh document"
                  disabled={isRefreshing || isDeleting}
                >
                  <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
              )}

              {/* Document Actions (Archive, Restore, Delete, History) */}
              <DocumentActions
                documentId={document.id}
                collectionId={collectionId}
                lifecycleStatus={document.lifecycle_status || 'active'}
                onDelete={onDelete}
                isDeleting={isDeleting}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function DocumentList({
  documents,
  collectionId,
  onDelete,
  onBatchDelete,
  onRefresh,
  isDeleting,
  isBatchDeleting,
  isRefreshing,
  refreshingDocId,
}: DocumentListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);

  const toggleSelect = (documentId: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(documentId)) {
        newSet.delete(documentId);
      } else {
        newSet.add(documentId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map((doc) => doc.id)));
    }
  };

  const handleBatchDelete = () => {
    if (onBatchDelete && selectedIds.size > 0) {
      onBatchDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
      setShowBatchConfirm(false);
    }
  };

  if (documents.length === 0) {
    return (
      <div className="card text-center py-xl">
        <p className="text-text-secondary">No documents in this collection</p>
      </div>
    );
  }

  const showBatchMode = !!onBatchDelete;

  return (
    <div className="space-y-md">
      {showBatchMode && (
        <div className="flex items-center justify-between gap-md p-sm bg-bg-secondary rounded-lg flex-wrap">
          <div className="flex items-center gap-md">
            <input
              type="checkbox"
              checked={selectedIds.size === documents.length && documents.length > 0}
              onChange={toggleSelectAll}
              className="cursor-pointer w-4 h-4 accent-accent"
              aria-label="Select all documents"
            />
            <span className="text-sm text-text-secondary">
              {selectedIds.size > 0
                ? `${selectedIds.size} document${selectedIds.size !== 1 ? 's' : ''} selected`
                : 'Select documents'}
            </span>
          </div>

          <div className="flex items-center gap-sm">
            {/* Batch Archive/Restore Actions */}
            <BatchActions
              selectedIds={Array.from(selectedIds)}
              collectionId={collectionId}
              onClearSelection={() => setSelectedIds(new Set())}
            />

            {/* Batch Delete Action */}
            {selectedIds.size > 0 && !showBatchConfirm && (
              <button
                type="button"
                onClick={() => setShowBatchConfirm(true)}
                className="btn btn-danger text-sm"
                disabled={isBatchDeleting}
              >
                Delete
              </button>
            )}
            {showBatchConfirm && (
              <div className="flex gap-xs">
                <button
                  type="button"
                  onClick={handleBatchDelete}
                  className="btn btn-danger text-sm"
                  disabled={isBatchDeleting}
                >
                  {isBatchDeleting ? 'Deleting...' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBatchConfirm(false)}
                  className="btn btn-secondary text-sm"
                  disabled={isBatchDeleting}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="space-y-sm">
        {documents.map((document) => (
          <DocumentItem
            key={document.id}
            document={document}
            collectionId={collectionId}
            onDelete={onDelete}
            onRefresh={onRefresh}
            isDeleting={isDeleting}
            isRefreshing={isRefreshing && refreshingDocId === document.id}
            isSelected={selectedIds.has(document.id)}
            onToggleSelect={showBatchMode ? toggleSelect : undefined}
            showCheckbox={showBatchMode}
          />
        ))}
      </div>
    </div>
  );
}
