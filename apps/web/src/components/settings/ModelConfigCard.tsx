/**
 * ModelConfigCard Component
 *
 * Phase 6: Card for configuring a single model feature (Chat, OCR, etc.)
 * Shows provider/model dropdowns, local-only toggle, and config source.
 *
 * Updated for 1024-dimension embeddings:
 * - Filters embedding models to 1024-only
 * - Adds "Use profile settings" option for embedding features
 * - Removes Google from embedding providers (no 1024-dim models)
 */

import { AlertTriangle, Check, Database, FileCode, Loader2, Server } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  FEATURE_CATEGORIES,
  FEATURE_DESCRIPTIONS,
  FEATURE_DISPLAY_NAMES,
  PROVIDER_DISPLAY_NAMES,
  getProvidersForFeature,
  useEmbeddingProfiles,
} from '../../hooks/useModelConfig';
import type {
  ConfigSource,
  EmbeddingProfile,
  ModelConfig,
  ModelConfigUpdate,
  ProviderInfo,
} from '../../types';

interface ModelConfigCardProps {
  config: ModelConfig;
  availableProviders: Record<string, ProviderInfo>;
  missingApiKeys: string[];
  onUpdate: (update: ModelConfigUpdate) => void;
  isUpdating?: boolean;
  error?: string | null;
}

/**
 * Get icon for config source
 */
function SourceIcon({ source }: { source: ConfigSource }) {
  switch (source) {
    case 'env':
      return (
        <span title="From environment variable">
          <FileCode size={14} className="text-accent" />
        </span>
      );
    case 'db':
      return (
        <span title="From database">
          <Database size={14} className="text-success" />
        </span>
      );
    default:
      return (
        <span title="Default value">
          <Server size={14} className="text-text-secondary" />
        </span>
      );
  }
}

/**
 * Get label for config source
 */
function getSourceLabel(source: ConfigSource): string {
  switch (source) {
    case 'env':
      return 'env';
    case 'db':
      return 'saved';
    default:
      return 'default';
  }
}

/**
 * 1024-dimension embedding models by provider.
 * These are the only models that should be shown for embedding features.
 */
const EMBEDDING_1024_MODELS: Record<string, string[]> = {
  ollama: ['mxbai-embed-large'],
  openai: ['text-embedding-3-large', 'text-embedding-3-small'],
  voyage: ['voyage-3.5', 'voyage-3.5-lite', 'voyage-code-3', 'voyage-3-large'],
  cohere: ['embed-english-v3.0', 'embed-multilingual-v3.0'],
  // Note: Google removed - no 1024-dim embedding models available
};

/**
 * Check if a feature is an embedding feature
 */
function isEmbeddingFeature(feature: string): boolean {
  return FEATURE_CATEGORIES.embedding.includes(feature as ModelConfig['feature']);
}

/**
 * Filter models based on feature type.
 * For embedding features, only show 1024-dimension compatible models.
 * For reranker, filter to reranker-specific models.
 */
function filterModelsForFeature(feature: string, provider: string, models: string[]): string[] {
  const normalizedProvider = provider.toLowerCase();

  // For embedding features, only show 1024-dim models
  if (isEmbeddingFeature(feature)) {
    const allowed1024Models = EMBEDDING_1024_MODELS[normalizedProvider] || [];
    return models.filter((m) =>
      allowed1024Models.some((allowed) => m.toLowerCase() === allowed.toLowerCase())
    );
  }

  // Reranker filtering
  if (feature === 'reranker') {
    if (normalizedProvider === 'none') {
      return [];
    }
    if (normalizedProvider === 'bge') {
      return models.filter((m) => m.toLowerCase().includes('bge-reranker'));
    }
    if (normalizedProvider === 'voyage' || normalizedProvider === 'cohere') {
      return models.filter((m) => m.toLowerCase().startsWith('rerank-'));
    }
  }

  return models;
}

/**
 * Filter providers for embedding features.
 * Removes Google (no 1024-dim models) and adds filtering logic.
 */
function filterProvidersForEmbedding(providers: string[]): string[] {
  // Remove Google from embedding providers - no 1024-dim models available
  return providers.filter((p) => p.toLowerCase() !== 'google');
}

// Special value for "Use profile settings" option
const USE_PROFILE_VALUE = '__USE_PROFILE__';

export function ModelConfigCard({
  config,
  availableProviders,
  missingApiKeys,
  onUpdate,
  isUpdating = false,
  error = null,
}: ModelConfigCardProps) {
  const [localProvider, setLocalProvider] = useState(config.provider);
  const [localModel, setLocalModel] = useState(config.model);
  const [localOnly, setLocalOnly] = useState(config.localOnly);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch embedding profiles to show active profile name
  const { data: profilesData } = useEmbeddingProfiles();
  const defaultProfile = profilesData?.profiles.find(
    (p: EmbeddingProfile) => p.id === profilesData?.defaultProfileId
  );

  // Check if this is an embedding feature
  const isEmbedding = isEmbeddingFeature(config.feature);

  // Check if currently using profile settings (empty provider/model)
  const isUsingProfileSettings = isEmbedding && localProvider === '' && localModel === '';

  // Get valid providers for this feature
  let validProviders = getProvidersForFeature(config.feature);

  // For embedding features, filter out Google (no 1024-dim models)
  if (isEmbedding) {
    validProviders = filterProvidersForEmbedding(validProviders);
  }

  // Get models for selected provider (skip if using profile settings)
  const providerInfo = localProvider ? availableProviders[localProvider] : null;
  const rawAvailableModels = providerInfo?.models || [];
  const availableModels = localProvider
    ? filterModelsForFeature(config.feature, localProvider, rawAvailableModels)
    : [];

  // Check if API key is missing for selected provider
  const isApiKeyMissing =
    localProvider && providerInfo?.requiresApiKey && missingApiKeys.includes(localProvider);

  // Filter providers based on local-only setting
  const filteredProviders = localOnly
    ? validProviders.filter((p) => availableProviders[p]?.isLocal)
    : validProviders;

  // Reset local state when config changes from server
  useEffect(() => {
    setLocalProvider(config.provider);
    setLocalModel(config.model);
    setLocalOnly(config.localOnly);
    setHasChanges(false);
  }, [config.provider, config.model, config.localOnly]);

  // Track changes
  useEffect(() => {
    const changed =
      localProvider !== config.provider ||
      localModel !== config.model ||
      localOnly !== config.localOnly;
    setHasChanges(changed);
  }, [localProvider, localModel, localOnly, config]);

  // Handle provider change
  const handleProviderChange = (newProvider: string) => {
    // Handle "Use profile settings" option for embedding features
    if (newProvider === USE_PROFILE_VALUE) {
      setLocalProvider('');
      setLocalModel('');
      return;
    }

    setLocalProvider(newProvider);
    // Reset model to first available for new provider
    const newProviderInfo = availableProviders[newProvider];
    const filteredModels = filterModelsForFeature(
      config.feature,
      newProvider,
      newProviderInfo?.models || []
    );
    if (filteredModels.length > 0) {
      setLocalModel(filteredModels[0]);
    } else {
      setLocalModel('');
    }
  };

  // Handle local-only toggle
  const handleLocalOnlyChange = (checked: boolean) => {
    setLocalOnly(checked);
    // If enabling local-only and current provider is not local, switch to a local one
    if (checked && !availableProviders[localProvider]?.isLocal) {
      const localProviders = validProviders.filter((p) => availableProviders[p]?.isLocal);
      if (localProviders.length > 0) {
        handleProviderChange(localProviders[0]);
      }
    }
  };

  // Handle save
  const handleSave = () => {
    onUpdate({
      provider: localProvider,
      model: localModel,
      localOnly,
      enabled: true, // Always enable when saving
    });
  };

  return (
    <div
      className={`card transition-all ${
        hasChanges
          ? 'border-warning ring-1 ring-warning/20'
          : error
            ? 'border-error ring-1 ring-error/20'
            : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-md">
        <div>
          <h4 className="font-medium text-text-primary">{FEATURE_DISPLAY_NAMES[config.feature]}</h4>
          <p className="text-xs text-text-secondary mt-xs">
            {FEATURE_DESCRIPTIONS[config.feature]}
          </p>
        </div>
        <div className="flex items-center gap-xs text-xs text-text-secondary">
          <SourceIcon source={config.source} />
          <span>{getSourceLabel(config.source)}</span>
          {hasChanges && (
            <span className="ml-sm px-1.5 py-0.5 bg-warning/10 text-warning rounded text-xs">
              unsaved
            </span>
          )}
        </div>
      </div>

      {/* Provider & Model Selection */}
      <div className="grid grid-cols-2 gap-md mb-md">
        {/* Provider Dropdown */}
        <div>
          <label
            htmlFor={`provider-${config.feature}`}
            className="block text-xs font-medium text-text-secondary mb-xs"
          >
            Provider
            {isEmbedding && <span className="ml-xs text-accent font-normal">(1024 dims)</span>}
          </label>
          <select
            id={`provider-${config.feature}`}
            value={isUsingProfileSettings ? USE_PROFILE_VALUE : localProvider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="input text-sm"
            disabled={isUpdating}
          >
            {/* "Use profile settings" option for embedding features */}
            {isEmbedding && (
              <option value={USE_PROFILE_VALUE}>
                Use profile settings
                {defaultProfile ? ` (${defaultProfile.displayName})` : ''}
              </option>
            )}
            {filteredProviders.map((provider) => (
              <option key={provider} value={provider}>
                {PROVIDER_DISPLAY_NAMES[provider] || provider}
                {availableProviders[provider]?.isLocal ? ' (Local)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Model Dropdown */}
        <div>
          <label
            htmlFor={`model-${config.feature}`}
            className="block text-xs font-medium text-text-secondary mb-xs"
          >
            Model
          </label>
          <select
            id={`model-${config.feature}`}
            value={isUsingProfileSettings ? USE_PROFILE_VALUE : localModel}
            onChange={(e) => {
              if (e.target.value !== USE_PROFILE_VALUE) {
                setLocalModel(e.target.value);
              }
            }}
            className="input text-sm"
            disabled={isUpdating || isUsingProfileSettings || availableModels.length === 0}
          >
            {/* Show profile info when using profile settings */}
            {isUsingProfileSettings && (
              <option value={USE_PROFILE_VALUE}>
                {defaultProfile
                  ? `${defaultProfile.model} (from profile)`
                  : 'Using profile settings'}
              </option>
            )}
            {!isUsingProfileSettings &&
              availableModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            {!isUsingProfileSettings && availableModels.length === 0 && (
              <option value="">No models available</option>
            )}
          </select>
        </div>
      </div>

      {/* Local-only Toggle */}
      <div className="flex items-center justify-between py-sm border-t border-border">
        <div className="flex items-center gap-sm">
          <input
            type="checkbox"
            id={`local-only-${config.feature}`}
            checked={localOnly}
            onChange={(e) => handleLocalOnlyChange(e.target.checked)}
            className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
            disabled={isUpdating}
          />
          <label
            htmlFor={`local-only-${config.feature}`}
            className="text-sm text-text-primary cursor-pointer"
          >
            Local only
          </label>
          <span className="text-xs text-text-secondary">(no cloud APIs)</span>
        </div>
      </div>

      {/* API Key Warning */}
      {isApiKeyMissing && (
        <div className="mt-md p-sm bg-warning/10 border border-warning/30 rounded flex items-start gap-sm">
          <AlertTriangle size={16} className="text-warning flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-medium text-warning">API key required</span>
            <p className="text-text-secondary mt-xs">
              Set <code className="bg-bg-secondary px-1 rounded">{providerInfo?.apiKeyEnvVar}</code>{' '}
              in Settings → API Keys
            </p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-md p-sm bg-error/10 border border-error/30 rounded text-xs text-error">
          {error}
        </div>
      )}

      {/* Save Button */}
      {hasChanges && (
        <div className="mt-md pt-md border-t border-border flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isUpdating}
            className="btn btn-primary text-sm flex items-center gap-xs"
          >
            {isUpdating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check size={14} />
                Save Changes
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
