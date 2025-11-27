/**
 * DocumentActions Component
 *
 * Provides lifecycle action buttons for documents (archive, restore, etc.)
 * Used in DocumentList for individual document actions.
 *
 * @module components/collections/DocumentActions
 * @since Phase 7: Collection Versioning
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, History, MoreVertical, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { apiClient } from '../../lib/api';
import type { LifecycleStatus } from '../../types';
import { useToast } from '../Toast';

interface DocumentActionsProps {
  documentId: string;
  collectionId: string;
  lifecycleStatus: LifecycleStatus;
  onDelete: (documentId: string) => void;
  isDeleting?: boolean;
}

export function DocumentActions({
  documentId,
  collectionId,
  lifecycleStatus,
  onDelete,
  isDeleting,
}: DocumentActionsProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const queryClient = useQueryClient();

  const archiveMutation = useMutation({
    mutationFn: () => apiClient.archiveDocument(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['versioned-documents', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['version-stats', collectionId] });
      setShowMenu(false);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => apiClient.restoreDocument(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['versioned-documents', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['version-stats', collectionId] });
      setShowMenu(false);
    },
  });

  const handleArchive = () => {
    archiveMutation.mutate();
  };

  const handleRestore = () => {
    restoreMutation.mutate();
  };

  const handleDelete = () => {
    onDelete(documentId);
    setShowConfirmDelete(false);
    setShowMenu(false);
  };

  const isLoading = archiveMutation.isPending || restoreMutation.isPending || isDeleting;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        className="p-1 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
        disabled={isLoading}
        aria-label="Document actions"
      >
        <MoreVertical size={18} />
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => {
              setShowMenu(false);
              setShowConfirmDelete(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowMenu(false);
                setShowConfirmDelete(false);
              }
            }}
            role="button"
            tabIndex={-1}
            aria-label="Close menu"
          />
          <div className="absolute right-0 top-full mt-1 w-44 bg-bg-primary border border-border rounded-lg shadow-lg z-20 py-1">
            {/* Archive/Restore action */}
            {lifecycleStatus === 'active' ? (
              <button
                type="button"
                onClick={handleArchive}
                disabled={archiveMutation.isPending}
                className="w-full flex items-center gap-sm px-3 py-2 text-sm text-text-primary hover:bg-bg-secondary transition-colors disabled:opacity-50"
              >
                <Archive size={16} className="text-warning" />
                <span>{archiveMutation.isPending ? 'Archiving...' : 'Archive'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRestore}
                disabled={restoreMutation.isPending}
                className="w-full flex items-center gap-sm px-3 py-2 text-sm text-text-primary hover:bg-bg-secondary transition-colors disabled:opacity-50"
              >
                <RotateCcw size={16} className="text-success" />
                <span>{restoreMutation.isPending ? 'Restoring...' : 'Restore'}</span>
              </button>
            )}

            {/* View version history */}
            <button
              type="button"
              onClick={() => {
                // TODO: Open version history modal
                setShowMenu(false);
              }}
              className="w-full flex items-center gap-sm px-3 py-2 text-sm text-text-primary hover:bg-bg-secondary transition-colors"
            >
              <History size={16} className="text-text-secondary" />
              <span>Version History</span>
            </button>

            <div className="border-t border-border my-1" />

            {/* Delete action */}
            {!showConfirmDelete ? (
              <button
                type="button"
                onClick={() => setShowConfirmDelete(true)}
                disabled={isDeleting}
                className="w-full flex items-center gap-sm px-3 py-2 text-sm text-error hover:bg-error/10 transition-colors disabled:opacity-50"
              >
                <Trash2 size={16} />
                <span>Delete</span>
              </button>
            ) : (
              <div className="px-3 py-2">
                <p className="text-xs text-text-secondary mb-2">Delete permanently?</p>
                <div className="flex gap-xs">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex-1 px-2 py-1 text-xs bg-error text-white rounded hover:bg-error/90 transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting...' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfirmDelete(false)}
                    className="flex-1 px-2 py-1 text-xs bg-bg-tertiary text-text-primary rounded hover:bg-bg-secondary transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * BatchActions Component
 *
 * Provides batch action buttons for selected documents.
 */
interface BatchActionsProps {
  selectedIds: string[];
  collectionId: string;
  onClearSelection: () => void;
}

export function BatchActions({ selectedIds, collectionId, onClearSelection }: BatchActionsProps) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const batchArchiveMutation = useMutation({
    mutationFn: () => apiClient.batchArchiveDocuments(selectedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['versioned-documents', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['version-stats', collectionId] });
      onClearSelection();
    },
    onError: (error) => {
      console.error('Batch archive failed', error);
      addToast(
        'error',
        'Could not archive all selected documents. Some items may not have changed. Please retry.'
      );
      queryClient.invalidateQueries({ queryKey: ['documents', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['versioned-documents', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['version-stats', collectionId] });
    },
  });

  const batchRestoreMutation = useMutation({
    mutationFn: () => apiClient.batchRestoreDocuments(selectedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['versioned-documents', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['version-stats', collectionId] });
      onClearSelection();
    },
    onError: (error) => {
      console.error('Batch restore failed', error);
      addToast(
        'error',
        'Could not restore all selected documents. Some items may not have changed. Please retry.'
      );
      queryClient.invalidateQueries({ queryKey: ['documents', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['versioned-documents', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['version-stats', collectionId] });
    },
  });

  if (selectedIds.length === 0) {
    return null;
  }

  const isLoading = batchArchiveMutation.isPending || batchRestoreMutation.isPending;

  return (
    <div className="flex items-center gap-sm">
      <span className="text-sm text-text-secondary">{selectedIds.length} selected</span>
      <button
        type="button"
        onClick={() => batchArchiveMutation.mutate()}
        disabled={isLoading}
        className="flex items-center gap-xs px-3 py-1.5 text-sm bg-warning/10 text-warning border border-warning/30 rounded-lg hover:bg-warning/20 transition-colors disabled:opacity-50"
      >
        <Archive size={14} />
        <span>{batchArchiveMutation.isPending ? 'Archiving...' : 'Archive'}</span>
      </button>
      <button
        type="button"
        onClick={() => batchRestoreMutation.mutate()}
        disabled={isLoading}
        className="flex items-center gap-xs px-3 py-1.5 text-sm bg-success/10 text-success border border-success/30 rounded-lg hover:bg-success/20 transition-colors disabled:opacity-50"
      >
        <RotateCcw size={14} />
        <span>{batchRestoreMutation.isPending ? 'Restoring...' : 'Restore'}</span>
      </button>
      <button
        type="button"
        onClick={onClearSelection}
        className="text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        Clear
      </button>
    </div>
  );
}
