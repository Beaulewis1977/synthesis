import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../lib/api';

interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateCollectionModal({ isOpen, onClose }: CreateCollectionModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (isOpen) {
      // Focus input when modal opens
      timeoutId = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      // Reset form when modal closes
      setName('');
      setDescription('');
      createMutation.reset();
    }
    return () => clearTimeout(timeoutId);
  }, [isOpen]);

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      return apiClient.createCollection(data.name, data.description);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        // biome-ignore lint/a11y/useSemanticElements: using div for modal dialog to maintain custom styling
        className="bg-bg-primary border border-border rounded-lg shadow-xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 id="modal-title" className="text-lg font-semibold text-text-primary">
            Create New Collection
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-text-secondary mb-1">
              Name <span className="text-error">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
              placeholder="e.g. Flutter Docs"
              required
              disabled={createMutation.isPending}
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-text-secondary mb-1"
            >
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input w-full min-h-[80px]"
              placeholder="Optional description for this collection..."
              disabled={createMutation.isPending}
            />
          </div>

          {createMutation.isError && (
            <div className="text-sm text-error bg-red-50 p-3 rounded-md border border-red-100">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : 'Failed to create collection'}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={createMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary flex items-center gap-2"
              disabled={createMutation.isPending || !name.trim()}
            >
              {createMutation.isPending && <Loader2 className="animate-spin" size={16} />}
              Create Collection
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
