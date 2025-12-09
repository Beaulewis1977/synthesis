/**
 * ChatModelSelector Component
 *
 * Phase 16G: Compact dropdown for selecting chat model per session.
 * Groups models by provider and supports dynamic Ollama model discovery.
 * Phase 17K: Added starred models, search, and tool support indicators for custom providers.
 */

import type { CustomProvider } from '@synthesis/shared';
import { PROVIDER_INFO } from '@synthesis/shared';
import { AlertTriangle, ChevronDown, Cpu, Loader2, Search, Star } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useCustomProviders } from '../hooks/useCustomProviders';
import { useOllamaModels } from '../hooks/useOllamaModels';
import { apiClient } from '../lib/api';

/** Threshold for showing search input in custom provider dropdown */
const SEARCH_THRESHOLD = 10;

interface ChatModelSelectorProps {
  sessionId: string | null;
  currentProvider: string | null;
  currentModel: string | null;
  disabled?: boolean;
  onModelChange?: (provider: string, model: string) => void;
}

// Providers available for chat (in display order)
const CHAT_PROVIDERS = ['anthropic', 'openai', 'google', 'ollama', 'zhipu', 'moonshot'] as const;

// Provider display names
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  ollama: 'Ollama',
  zhipu: 'Zhipu',
  moonshot: 'Moonshot',
};

// Models to filter out (embedding/reranking models)
const EXCLUDED_MODEL_PATTERNS = ['embed', 'voyage', 'rerank', 'ada', 'text-embedding'];

function isEmbeddingModel(model: string): boolean {
  const lowerModel = model.toLowerCase();
  return EXCLUDED_MODEL_PATTERNS.some((pattern) => lowerModel.includes(pattern));
}

function usePerProviderSearch() {
  const [queries, setQueries] = useState<Map<string, string>>(new Map());

  const getQuery = useCallback(
    (provider: string): string => queries.get(provider) || '',
    [queries]
  );

  const setQuery = useCallback((provider: string, value: string) => {
    setQueries((prev) => {
      const next = new Map(prev);
      if (value) {
        next.set(provider, value);
      } else {
        next.delete(provider);
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setQueries(new Map());
  }, []);

  return { getQuery, setQuery, reset };
}

export function ChatModelSelector({
  sessionId,
  currentProvider,
  currentModel,
  disabled = false,
  onModelChange,
}: ChatModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const {
    getQuery: getSearchQuery,
    setQuery: setSearchQuery,
    reset: resetSearchQueries,
  } = usePerProviderSearch();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const globalSearchInputRef = useRef<HTMLInputElement>(null);

  // Fetch Ollama models dynamically
  const { data: ollamaData, isLoading: ollamaLoading } = useOllamaModels();

  // Fetch custom providers
  const { data: customProviders } = useCustomProviders();

  // Build model options grouped by provider
  // Phase 17K: Extended to include custom provider metadata for starred/tools
  const modelGroups = useMemo(() => {
    const groups: Array<{
      provider: string;
      displayName: string;
      models: string[];
      isCustom: boolean;
      customProviderData?: CustomProvider;
    }> = [];

    for (const provider of CHAT_PROVIDERS) {
      let models: string[] = [];

      if (provider === 'ollama') {
        // Use dynamic Ollama models if available
        if (ollamaData?.available && ollamaData.models.length > 0) {
          models = ollamaData.models.map((m) => m.name).filter((name) => !isEmbeddingModel(name));
        } else {
          // Fallback to static list
          const staticModels = PROVIDER_INFO[provider]?.models || [];
          models = staticModels.filter((m) => !isEmbeddingModel(m));
        }
      } else {
        // Use static provider models
        const providerModels = PROVIDER_INFO[provider]?.models || [];
        models = providerModels.filter((m) => !isEmbeddingModel(m));
      }

      if (models.length > 0) {
        groups.push({
          provider,
          displayName: PROVIDER_DISPLAY_NAMES[provider] || provider,
          models,
          isCustom: false,
        });
      }
    }

    // Add custom providers after built-in providers
    // Phase 17K: Include custom provider data for starred/tools metadata
    if (customProviders) {
      for (const provider of customProviders) {
        // Prefer discoveredModels, fallback to customModels
        const models =
          provider.discoveredModels?.length > 0
            ? provider.discoveredModels
            : provider.customModels || [];

        // Only add if provider has at least one model
        if (models.length > 0) {
          groups.push({
            provider: `custom:${provider.id}`,
            displayName: provider.name,
            models,
            isCustom: true,
            customProviderData: provider,
          });
        }
      }
    }

    return groups;
  }, [ollamaData, customProviders]);

  // Phase 17M: Filter all model groups based on global search query
  const filteredGroups = useMemo(() => {
    if (!globalSearchQuery.trim()) return modelGroups;
    const query = globalSearchQuery.toLowerCase();
    return modelGroups
      .map((group) => ({
        ...group,
        models: group.models.filter((m) => m.toLowerCase().includes(query)),
      }))
      .filter((group) => group.models.length > 0);
  }, [modelGroups, globalSearchQuery]);

  // Phase 17K: Get starred and no-tools models from custom provider data
  const getModelFlags = useCallback(
    (group: (typeof modelGroups)[0], model: string): { isStarred: boolean; noTools: boolean } => {
      if (!group.isCustom || !group.customProviderData) {
        return { isStarred: false, noTools: false };
      }
      const cp = group.customProviderData;
      return {
        isStarred: cp.starredModels?.includes(model) ?? false,
        noTools: cp.modelsWithoutTools?.includes(model) ?? false,
      };
    },
    []
  );

  // Phase 17K: Sort models for custom providers - starred first, then alphabetical
  const getSortedModels = useCallback(
    (group: (typeof modelGroups)[0], filterQuery: string): string[] => {
      let models = group.models;

      // Apply search filter
      if (filterQuery.trim()) {
        const query = filterQuery.toLowerCase();
        models = models.filter((m) => m.toLowerCase().includes(query));
      }

      // For custom providers, sort starred first
      if (group.isCustom && group.customProviderData?.starredModels?.length) {
        const starred = new Set(group.customProviderData.starredModels);
        const modelsToSort = [...models];
        return modelsToSort.sort((a, b) => {
          const aStarred = starred.has(a);
          const bStarred = starred.has(b);
          if (aStarred && !bStarred) return -1;
          if (!aStarred && bStarred) return 1;
          return a.localeCompare(b);
        });
      }

      return models;
    },
    []
  );

  // Get display label for current selection
  const displayLabel = useMemo(() => {
    if (!currentProvider || !currentModel) {
      return 'Using default';
    }
    // Truncate long model names
    const modelDisplay =
      currentModel.length > 25 ? `${currentModel.slice(0, 22)}...` : currentModel;
    return modelDisplay;
  }, [currentProvider, currentModel]);

  // Handle model selection
  const handleSelect = useCallback(
    async (provider: string, model: string) => {
      setIsOpen(false);

      // If selecting "default", clear the override
      if (provider === 'default') {
        onModelChange?.('', '');
        return;
      }

      setIsUpdating(true);
      try {
        // Persist to server if we have a session
        if (sessionId) {
          await apiClient.updateChatSessionModel(sessionId, provider, model);
        }
        onModelChange?.(provider, model);
      } catch (error) {
        console.error('Failed to update chat model:', error);
      } finally {
        setIsUpdating(false);
      }
    },
    [sessionId, onModelChange]
  );

  // Close dropdown when clicking outside
  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      if (!dropdownRef.current?.contains(e.relatedTarget as Node)) {
        setIsOpen(false);
        setGlobalSearchQuery(''); // Reset global search on close
        resetSearchQueries(); // Reset per-provider search on close
      }
    },
    [resetSearchQueries]
  );

  const isDisabled = disabled || isUpdating;

  // Toggle dropdown and reset search when closing
  const handleToggleDropdown = useCallback(() => {
    if (!isDisabled) {
      const willOpen = !isOpen;
      setIsOpen(willOpen);
      if (!willOpen) {
        setGlobalSearchQuery(''); // Reset global search on close
        resetSearchQueries(); // Reset per-provider search on close
      }
    }
  }, [isDisabled, isOpen, resetSearchQueries]);

  return (
    <div className="relative" ref={dropdownRef} onBlur={handleBlur}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggleDropdown}
        disabled={isDisabled}
        className={`
          flex items-center gap-xs px-sm py-xs rounded-md text-sm
          border border-border bg-bg-secondary
          hover:bg-bg-hover transition-colors
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${isOpen ? 'ring-1 ring-accent border-accent' : ''}
        `}
        title={currentModel || 'Using default model from settings'}
      >
        {isUpdating ? (
          <Loader2 size={14} className="animate-spin text-text-secondary" />
        ) : (
          <Cpu size={14} className="text-text-secondary" />
        )}
        <span className="text-text-primary max-w-[160px] truncate">{displayLabel}</span>
        <ChevronDown
          size={14}
          className={`text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="
            absolute right-0 top-full mt-xs z-50
            w-[280px] max-h-[400px] overflow-y-auto
            bg-bg-primary border border-border rounded-md shadow-lg
          "
        >
          {/* Global Search - Phase 17M */}
          <div className="px-md py-xs border-b border-border sticky top-0 bg-bg-primary z-10">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary"
              />
              <input
                ref={globalSearchInputRef}
                type="text"
                placeholder="Search all models..."
                aria-label="Search all models"
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 text-sm bg-bg-secondary border border-border rounded focus:outline-none focus:ring-1 focus:ring-accent"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Default Option */}
          <button
            type="button"
            onClick={() => handleSelect('default', '')}
            className={`
              w-full text-left px-md py-sm text-sm
              hover:bg-bg-hover transition-colors
              border-b border-border
              ${!currentProvider ? 'bg-accent/10 text-accent' : 'text-text-primary'}
            `}
          >
            <span className="font-medium">Use default</span>
            <span className="text-text-secondary text-xs ml-sm">(from Settings)</span>
          </button>

          {/* Ollama Loading State */}
          {ollamaLoading && (
            <div className="px-md py-sm text-xs text-text-secondary flex items-center gap-xs">
              <Loader2 size={12} className="animate-spin" />
              Loading Ollama models...
            </div>
          )}

          {/* Model Groups */}
          {filteredGroups.map((group) => {
            const showSearch = group.isCustom && group.models.length > SEARCH_THRESHOLD;
            const groupSearchQuery = getSearchQuery(group.provider);
            const sortedModels = getSortedModels(group, group.isCustom ? groupSearchQuery : '');
            const starredCount = group.customProviderData?.starredModels?.length || 0;

            return (
              <div key={group.provider}>
                {/* Provider Header */}
                <div className="px-md py-xs bg-bg-secondary text-xs font-medium text-text-secondary uppercase tracking-wide sticky top-0 flex items-center justify-between">
                  <span>{group.displayName}</span>
                  {group.isCustom && starredCount > 0 && (
                    <span className="flex items-center gap-1 text-warning">
                      <Star size={10} fill="currentColor" />
                      {starredCount}
                    </span>
                  )}
                </div>

                {/* Search input for custom providers with many models */}
                {showSearch && (
                  <div className="px-md py-xs border-b border-border">
                    <div className="relative">
                      <Search
                        size={14}
                        className="absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary"
                      />
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder={`Search ${group.models.length} models...`}
                        aria-label={`Search models in ${group.displayName}`}
                        value={groupSearchQuery}
                        onChange={(e) => {
                          setSearchQuery(group.provider, e.target.value);
                        }}
                        className="w-full pl-7 pr-2 py-1 text-xs bg-bg-secondary border border-border rounded focus:outline-none focus:ring-1 focus:ring-accent"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                )}

                {/* Models */}
                {sortedModels.length === 0 && groupSearchQuery ? (
                  <div className="px-md py-sm text-xs text-text-secondary">
                    No models match "{groupSearchQuery}"
                  </div>
                ) : (
                  sortedModels.map((model) => {
                    const isSelected = currentProvider === group.provider && currentModel === model;
                    const { isStarred, noTools } = getModelFlags(group, model);

                    return (
                      <button
                        key={`${group.provider}-${model}`}
                        type="button"
                        onClick={() => handleSelect(group.provider, model)}
                        className={`
                          w-full text-left px-md py-sm text-sm flex items-center gap-2
                          hover:bg-bg-hover transition-colors
                          ${isSelected ? 'bg-accent/10 text-accent' : 'text-text-primary'}
                        `}
                      >
                        {/* Star indicator for custom providers */}
                        {group.isCustom && isStarred && (
                          <Star
                            size={12}
                            className="text-warning flex-shrink-0"
                            fill="currentColor"
                          />
                        )}

                        {/* Model name */}
                        <span className="truncate flex-1">{model}</span>

                        {/* Tool support indicator */}
                        {group.isCustom && noTools && (
                          <span
                            className="flex items-center text-error flex-shrink-0"
                            title="This model does not support function calling"
                          >
                            <AlertTriangle size={12} />
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            );
          })}

          {/* Empty State */}
          {filteredGroups.length === 0 && !ollamaLoading && (
            <div className="px-md py-lg text-center text-text-secondary text-sm">
              {globalSearchQuery.trim()
                ? `No models match "${globalSearchQuery}"`
                : 'No chat models available'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
