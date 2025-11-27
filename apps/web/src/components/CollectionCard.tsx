import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreVertical, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { formatRelativeTime } from '../lib/utils';
import type { Collection } from '../types';
import { useToast } from './Toast';

interface CollectionCardProps {
  collection: Collection;
  isSelected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  showCheckbox?: boolean;
}

export function CollectionCard({
  collection,
  isSelected,
  onSelect,
  showCheckbox,
}: CollectionCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showMenu, setShowMenu] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const { addToast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.deleteCollection(collection.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      setShowMenu(false);
      setShowConfirmDelete(false);
      addToast('success', `Collection "${collection.name}" deleted successfully`);
    },
    onError: (error) => {
      console.error('Delete collection failed', error);
      addToast('error', `Failed to delete "${collection.name}". Please try again.`);
      setShowConfirmDelete(false);
    },
  });

  const handleView = () => {
    navigate(`/collections/${collection.id}`);
  };

  const handleChat = () => {
    navigate(`/chat/${collection.id}`);
  };

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  return (
    <div className={`card relative ${isSelected ? 'ring-2 ring-accent' : ''}`}>
      {/* Selection checkbox and menu */}
      <div className="absolute top-3 right-3 flex items-center gap-xs">
        {showCheckbox && onSelect && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(collection.id, e.target.checked)}
            className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
          />
        )}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Collection actions"
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
              <div className="absolute right-0 top-full mt-1 w-48 bg-bg-primary border border-border rounded-lg shadow-lg z-20 py-1">
                {!showConfirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setShowConfirmDelete(true)}
                    disabled={deleteMutation.isPending}
                    className="w-full flex items-center gap-sm px-3 py-2 text-sm text-error hover:bg-error/10 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                    <span>Delete Collection</span>
                  </button>
                ) : (
                  <div className="px-3 py-2">
                    <p className="text-xs text-text-secondary mb-2">
                      Delete "{collection.name}" and all its documents?
                    </p>
                    <div className="flex gap-xs">
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleteMutation.isPending}
                        className="flex-1 px-2 py-1 text-xs bg-error text-white rounded hover:bg-error/90 transition-colors disabled:opacity-50"
                      >
                        {deleteMutation.isPending ? 'Deleting...' : 'Confirm'}
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
      </div>

      <h3 className="text-lg font-semibold text-text-primary mb-sm pr-16">{collection.name}</h3>

      {collection.description && (
        <p className="text-text-secondary text-sm mb-md line-clamp-2">{collection.description}</p>
      )}

      <p className="text-text-secondary text-sm mb-md">
        Updated {formatRelativeTime(collection.updated_at)}
      </p>

      <div className="flex gap-sm">
        <button type="button" onClick={handleView} className="btn btn-secondary text-sm flex-1">
          View
        </button>
        <button type="button" onClick={handleChat} className="btn btn-primary text-sm flex-1">
          Chat
        </button>
      </div>
    </div>
  );
}
