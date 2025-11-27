import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckSquare, Folder, Loader2, Plus, Square, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { AddCollectionModal } from '../components/AddCollectionModal';
import { CollectionCard } from '../components/CollectionCard';
import { apiClient } from '../lib/api';

export function Dashboard() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirmBatchDelete, setShowConfirmBatchDelete] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['collections'],
    queryFn: () => apiClient.fetchCollections(),
  });

  const batchDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => apiClient.batchDeleteCollections(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      setSelectedIds(new Set());
      setSelectionMode(false);
      setShowConfirmBatchDelete(false);
    },
  });

  const handleSelect = (id: string, selected: boolean) => {
    const newSelected = new Set(selectedIds);
    if (selected) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (data?.collections) {
      if (selectedIds.size === data.collections.length) {
        setSelectedIds(new Set());
      } else {
        setSelectedIds(new Set(data.collections.map((c) => c.id)));
      }
    }
  };

  const handleBatchDelete = () => {
    batchDeleteMutation.mutate(Array.from(selectedIds));
  };

  return (
    <div>
      <div className="mb-lg">
        <div className="flex items-center justify-between mb-md">
          <h1 className="text-2xl font-bold text-text-primary">Your Collections</h1>
          <div className="flex items-center gap-sm">
            {data && data.collections.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (selectionMode) {
                    setSelectedIds(new Set());
                    setSelectionMode(false);
                  } else {
                    setSelectionMode(true);
                  }
                }}
                className={`btn ${selectionMode ? 'btn-secondary' : 'btn-ghost'} flex items-center gap-xs`}
              >
                {selectionMode ? <X size={18} /> : <CheckSquare size={18} />}
                {selectionMode ? 'Cancel' : 'Select'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary flex items-center gap-xs"
            >
              <Plus size={18} />
              Add Collection
            </button>
          </div>
        </div>

        {/* Selection mode toolbar */}
        {selectionMode && (
          <div className="flex items-center gap-md mb-md p-3 bg-bg-secondary rounded-lg border border-border">
            <button
              type="button"
              onClick={handleSelectAll}
              className="flex items-center gap-xs text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              {data && selectedIds.size === data.collections.length ? (
                <CheckSquare size={16} className="text-accent" />
              ) : (
                <Square size={16} />
              )}
              <span>
                {data && selectedIds.size === data.collections.length
                  ? 'Deselect All'
                  : 'Select All'}
              </span>
            </button>

            {selectedIds.size > 0 && (
              <>
                <span className="text-sm text-text-secondary">{selectedIds.size} selected</span>
                {!showConfirmBatchDelete ? (
                  <button
                    type="button"
                    onClick={() => setShowConfirmBatchDelete(true)}
                    className="flex items-center gap-xs px-3 py-1.5 text-sm bg-error/10 text-error border border-error/30 rounded-lg hover:bg-error/20 transition-colors"
                  >
                    <Trash2 size={14} />
                    <span>Delete Selected</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-sm">
                    <span className="text-sm text-error">
                      Delete {selectedIds.size} collections?
                    </span>
                    <button
                      type="button"
                      onClick={handleBatchDelete}
                      disabled={batchDeleteMutation.isPending}
                      className="px-3 py-1.5 text-sm bg-error text-white rounded-lg hover:bg-error/90 transition-colors disabled:opacity-50"
                    >
                      {batchDeleteMutation.isPending ? 'Deleting...' : 'Confirm'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowConfirmBatchDelete(false)}
                      className="px-3 py-1.5 text-sm bg-bg-tertiary text-text-primary rounded-lg hover:bg-bg-secondary transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <p className="text-text-secondary">Manage and explore your document collections</p>
      </div>

      {/* Add Collection Modal */}
      <AddCollectionModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-xl">
          <Loader2 className="animate-spin text-accent" size={32} />
          <span className="ml-md text-text-secondary">Loading collections...</span>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="card bg-red-50 border-error">
          <div className="flex items-start gap-md">
            <AlertCircle className="text-error flex-shrink-0" size={24} />
            <div>
              <h3 className="font-semibold text-error mb-sm">Failed to load collections</h3>
              <p className="text-sm text-text-secondary">
                {error instanceof Error ? error.message : 'An unexpected error occurred'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && data?.collections.length === 0 && (
        <div className="card text-center py-xl">
          <Folder className="mx-auto text-text-secondary mb-md" size={48} />
          <h3 className="text-lg font-semibold text-text-primary mb-sm">No collections yet</h3>
          <p className="text-text-secondary">Create your first collection to get started</p>
        </div>
      )}

      {/* Collections Grid */}
      {!isLoading && !isError && data && data.collections.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
          {data.collections.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              showCheckbox={selectionMode}
              isSelected={selectedIds.has(collection.id)}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
