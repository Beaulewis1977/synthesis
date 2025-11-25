import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { apiClient } from '../lib/api';
import { Modal } from './Modal';

interface AddCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddCollectionModal({ isOpen, onClose }: AddCollectionModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const createMutation = useMutation({
    mutationFn: () => apiClient.createCollection(name, description || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      handleClose();
    },
  });

  const handleClose = () => {
    setName('');
    setDescription('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      createMutation.mutate();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Collection" size="md">
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {/* Name Field */}
          <div>
            <label
              htmlFor="collection-name"
              className="block text-sm font-medium text-text-secondary mb-1"
            >
              Name *
            </label>
            <input
              id="collection-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Collection"
              className="input w-full"
              required
              maxLength={255}
            />
          </div>

          {/* Description Field */}
          <div>
            <label
              htmlFor="collection-description"
              className="block text-sm font-medium text-text-secondary mb-1"
            >
              Description
            </label>
            <textarea
              id="collection-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description for this collection..."
              className="input w-full min-h-[80px] resize-y"
              maxLength={1000}
            />
          </div>

          {/* Error Message */}
          {createMutation.isError && (
            <div className="text-sm text-error">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : 'Failed to create collection'}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-secondary"
              disabled={createMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary flex items-center gap-2"
              disabled={!name.trim() || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 size={16} className="animate-spin" />}
              Create Collection
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
