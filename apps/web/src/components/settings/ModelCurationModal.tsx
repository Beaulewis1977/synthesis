/**
 * ModelCurationModal - Phase 17K
 *
 * Modal for curating which models to show in the chat selector for a custom provider.
 * Allows starring favorites and marking models that don't support tool calling.
 */

import type { CustomProvider } from '@synthesis/shared';
import { AlertTriangle, Loader2, Search, Star, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  useUpdateModelsWithoutTools,
  useUpdateStarredModels,
} from '../../hooks/useCustomProviders';
import { Modal } from '../Modal';

interface ModelCurationModalProps {
  provider: CustomProvider;
  isOpen: boolean;
  onClose: () => void;
}

export function ModelCurationModal({ provider, isOpen, onClose }: ModelCurationModalProps) {
  // Get all available models (discovered + custom)
  const allModels = useMemo(() => {
    const models = new Set<string>();
    for (const m of provider.discoveredModels ?? []) models.add(m);
    for (const m of provider.customModels ?? []) models.add(m);
    return Array.from(models).sort();
  }, [provider.discoveredModels, provider.customModels]);

  // Local state for edits
  const [starredModels, setStarredModels] = useState<Set<string>>(
    new Set(provider.starredModels || [])
  );
  const [modelsWithoutTools, setModelsWithoutTools] = useState<Set<string>>(
    new Set(provider.modelsWithoutTools || [])
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Reset state when provider changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: provider.id needed to reset state when provider object is replaced
  useEffect(() => {
    setStarredModels(new Set(provider.starredModels || []));
    setModelsWithoutTools(new Set(provider.modelsWithoutTools || []));
    setSearchQuery('');
  }, [provider.id, provider.starredModels, provider.modelsWithoutTools]);

  // Mutations
  const updateStarredMutation = useUpdateStarredModels();
  const updateNoToolsMutation = useUpdateModelsWithoutTools();

  const isSaving = updateStarredMutation.isPending || updateNoToolsMutation.isPending;

  // Filter models by search query
  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return allModels;
    const query = searchQuery.toLowerCase();
    return allModels.filter((m) => m.toLowerCase().includes(query));
  }, [allModels, searchQuery]);

  // Toggle star status
  const toggleStar = (model: string) => {
    setStarredModels((prev) => {
      const next = new Set(prev);
      if (next.has(model)) {
        next.delete(model);
      } else {
        next.add(model);
      }
      return next;
    });
  };

  // Toggle tool support status
  const toggleToolSupport = (model: string) => {
    setModelsWithoutTools((prev) => {
      const next = new Set(prev);
      if (next.has(model)) {
        next.delete(model);
      } else {
        next.add(model);
      }
      return next;
    });
  };

  // Save changes
  const handleSave = async () => {
    try {
      await Promise.all([
        updateStarredMutation.mutateAsync({
          id: provider.id,
          models: Array.from(starredModels),
        }),
        updateNoToolsMutation.mutateAsync({
          id: provider.id,
          models: Array.from(modelsWithoutTools),
        }),
      ]);
      onClose();
    } catch (error) {
      console.error('Failed to save model curation:', error);
    }
  };

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    const origStarred = new Set(provider.starredModels || []);
    const origNoTools = new Set(provider.modelsWithoutTools || []);

    if (starredModels.size !== origStarred.size) return true;
    if (modelsWithoutTools.size !== origNoTools.size) return true;

    for (const m of starredModels) {
      if (!origStarred.has(m)) return true;
    }
    for (const m of modelsWithoutTools) {
      if (!origNoTools.has(m)) return true;
    }

    return false;
  }, [starredModels, modelsWithoutTools, provider.starredModels, provider.modelsWithoutTools]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Manage Models - ${provider.name}`} size="lg">
      <div className="flex flex-col gap-4">
        {/* Description */}
        <p className="text-sm text-text-secondary">
          Star models to show them prominently in the chat selector. Mark models that don't support
          function calling to prevent tool errors.
        </p>

        {/* Stats */}
        <div className="flex gap-4 text-sm">
          <span className="text-text-secondary">{allModels.length} models available</span>
          <span className="text-warning">
            <Star size={14} className="inline mr-1" />
            {starredModels.size} starred
          </span>
          <span className="text-error">
            <Wrench size={14} className="inline mr-1" />
            {modelsWithoutTools.size} no tools
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
          />
          <input
            type="text"
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>

        {/* Model List */}
        <div className="border border-border rounded-lg max-h-[400px] overflow-y-auto">
          {filteredModels.length === 0 ? (
            <div className="p-4 text-center text-text-secondary">
              {searchQuery ? 'No models match your search' : 'No models available'}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredModels.map((model) => {
                const isStarred = starredModels.has(model);
                const noTools = modelsWithoutTools.has(model);

                return (
                  <div
                    key={model}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-bg-secondary"
                  >
                    {/* Star button */}
                    <button
                      type="button"
                      onClick={() => toggleStar(model)}
                      className={`p-1 rounded transition-colors ${
                        isStarred
                          ? 'text-warning hover:text-warning/80'
                          : 'text-text-secondary hover:text-warning'
                      }`}
                      title={isStarred ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star size={16} fill={isStarred ? 'currentColor' : 'none'} />
                    </button>

                    {/* Model name */}
                    <span className="flex-1 text-sm font-mono truncate" title={model}>
                      {model}
                    </span>

                    {/* Tool support toggle */}
                    <button
                      type="button"
                      onClick={() => toggleToolSupport(model)}
                      className={`p-1 rounded transition-colors ${
                        noTools
                          ? 'text-error hover:text-error/80'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                      title={noTools ? 'Enable tool support' : 'Mark as no tool support'}
                    >
                      <Wrench size={16} className={noTools ? 'opacity-50' : ''} />
                      {noTools && (
                        <span className="absolute -top-0.5 -right-0.5 text-[8px]">✕</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex gap-6 text-xs text-text-secondary">
          <div className="flex items-center gap-1">
            <Star size={12} className="text-warning" fill="currentColor" />
            <span>Starred = Shows first in selector</span>
          </div>
          <div className="flex items-center gap-1">
            <Wrench size={12} className="text-error opacity-50" />
            <span>No tools = Skips function calling</span>
          </div>
        </div>

        {/* Save Error */}
        {(updateStarredMutation.isError || updateNoToolsMutation.isError) && (
          <div className="p-3 bg-error/10 border border-error/30 rounded-lg flex items-start gap-2">
            <AlertTriangle size={16} className="text-error flex-shrink-0 mt-0.5" />
            <div className="text-sm text-error">
              {updateStarredMutation.error?.message ||
                updateNoToolsMutation.error?.message ||
                'Failed to save model curation'}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
