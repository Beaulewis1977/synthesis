/**
 * ChatModelSelector Component
 *
 * Phase 16G: Compact dropdown for selecting chat model per session.
 * Groups models by provider and supports dynamic Ollama model discovery.
 */

import { PROVIDER_INFO } from '@synthesis/shared';
import { ChevronDown, Cpu, Loader2 } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useCustomProviders } from '../hooks/useCustomProviders';
import { useOllamaModels } from '../hooks/useOllamaModels';
import { apiClient } from '../lib/api';

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

export function ChatModelSelector({
  sessionId,
  currentProvider,
  currentModel,
  disabled = false,
  onModelChange,
}: ChatModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch Ollama models dynamically
  const { data: ollamaData, isLoading: ollamaLoading } = useOllamaModels();

  // Fetch custom providers
  const { data: customProviders } = useCustomProviders();

  // Build model options grouped by provider
  const modelGroups = useMemo(() => {
    const groups: Array<{
      provider: string;
      displayName: string;
      models: string[];
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
        });
      }
    }

    // Add custom providers after built-in providers
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
          });
        }
      }
    }

    return groups;
  }, [ollamaData, customProviders]);

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
  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (!dropdownRef.current?.contains(e.relatedTarget as Node)) {
      setIsOpen(false);
    }
  }, []);

  const isDisabled = disabled || isUpdating;

  return (
    <div className="relative" ref={dropdownRef} onBlur={handleBlur}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !isDisabled && setIsOpen(!isOpen)}
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
          {modelGroups.map((group) => (
            <div key={group.provider}>
              {/* Provider Header */}
              <div className="px-md py-xs bg-bg-secondary text-xs font-medium text-text-secondary uppercase tracking-wide sticky top-0">
                {group.displayName}
              </div>

              {/* Models */}
              {group.models.map((model) => {
                const isSelected = currentProvider === group.provider && currentModel === model;

                return (
                  <button
                    key={`${group.provider}-${model}`}
                    type="button"
                    onClick={() => handleSelect(group.provider, model)}
                    className={`
                      w-full text-left px-md py-sm text-sm
                      hover:bg-bg-hover transition-colors
                      ${isSelected ? 'bg-accent/10 text-accent' : 'text-text-primary'}
                    `}
                  >
                    <span className="truncate block">{model}</span>
                  </button>
                );
              })}
            </div>
          ))}

          {/* Empty State */}
          {modelGroups.length === 0 && !ollamaLoading && (
            <div className="px-md py-lg text-center text-text-secondary text-sm">
              No chat models available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
