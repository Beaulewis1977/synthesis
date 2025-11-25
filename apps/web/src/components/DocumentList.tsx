import { CheckCircle, Clock, Edit2, RefreshCw, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatFileSize,
  formatRelativeTime,
  getFileTypeIcon,
  getFileTypeLabel,
} from '../lib/utils';
import type { Document } from '../types';

interface DocumentListProps {
  documents: Document[];
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
  onDelete,
  onRefresh,
  isDeleting,
  isRefreshing,
  isSelected,
  onToggleSelect,
  showCheckbox,
}: DocumentItemProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const FileIcon = getFileTypeIcon(document.content_type ?? '');

  const handleDelete = () => {
    onDelete(document.id);
    setShowConfirm(false);
  };

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
              {!showConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowConfirm(true)}
                  className="text-text-secondary hover:text-error transition-colors"
                  title="Delete document"
                  aria-label="Delete document"
                  disabled={isDeleting || isRefreshing}
                >
                  <Trash2 size={18} />
                </button>
              ) : (
                <div className="flex gap-xs">
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="btn btn-danger text-xs py-1 px-2"
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfirm(false)}
                    className="btn btn-secondary text-xs py-1 px-2"
                    disabled={isDeleting}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function DocumentList({
  documents,
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
  const hasSelection = selectedIds.size > 0;

  return (
    <div className="space-y-md">
      {showBatchMode && (
        <div className="flex items-center justify-between gap-md p-sm bg-bg-secondary rounded-lg">
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
          {hasSelection && !showBatchConfirm && (
            <button
              type="button"
              onClick={() => setShowBatchConfirm(true)}
              className="btn btn-danger text-sm"
              disabled={isBatchDeleting}
            >
              <Trash2 size={16} className="mr-xs" />
              Delete Selected ({selectedIds.size})
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
                {isBatchDeleting ? 'Deleting...' : 'Confirm Delete'}
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
      )}
      <div className="space-y-sm">
        {documents.map((document) => (
          <DocumentItem
            key={document.id}
            document={document}
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
