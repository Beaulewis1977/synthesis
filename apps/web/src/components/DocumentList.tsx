import { CheckCircle, Clock, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';
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
  isDeleting?: boolean;
}

interface DocumentItemProps {
  document: Document;
  onDelete: (documentId: string) => void;
  isDeleting?: boolean;
}

function DocumentItem({ document, onDelete, isDeleting }: DocumentItemProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const FileIcon = getFileTypeIcon(document.content_type);

  const handleDelete = () => {
    onDelete(document.id);
    setShowConfirm(false);
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
    <div className="border border-border rounded-lg p-md hover:bg-bg-secondary transition-colors">
      <div className="flex items-start justify-between gap-md">
        <div className="flex items-start gap-md flex-1 min-w-0">
          <FileIcon className="text-accent flex-shrink-0 mt-xs" size={20} />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-text-primary truncate mb-xs">{document.title}</h3>
            <div className="flex flex-wrap items-center gap-x-md gap-y-xs text-sm text-text-secondary">
              <span>{getFileTypeLabel(document.content_type)}</span>
              <span>•</span>
              <span>{formatFileSize(document.file_size)}</span>
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
          {!showConfirm ? (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="text-text-secondary hover:text-error transition-colors"
              title="Delete document"
              aria-label="Delete document"
              disabled={isDeleting}
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
        </div>
      </div>
    </div>
  );
}

export function DocumentList({ documents, onDelete, isDeleting }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="card text-center py-xl">
        <p className="text-text-secondary">No documents in this collection</p>
      </div>
    );
  }

  return (
    <div className="space-y-sm">
      {documents.map((document) => (
        <DocumentItem
          key={document.id}
          document={document}
          onDelete={onDelete}
          isDeleting={isDeleting}
        />
      ))}
    </div>
  );
}
