/**
 * ModelConfigCard Component
 *
 * Phase 6: Card for configuring a single model feature (Chat, OCR, etc.)
 * Shows provider/model dropdowns, local-only toggle, and config source.
 */

import { AlertTriangle, Check, Database, FileCode, Loader2, Server } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  FEATURE_DESCRIPTIONS,
  FEATURE_DISPLAY_NAMES,
  PROVIDER_DISPLAY_NAMES,
  getProvidersForFeature,
} from '../../hooks/useModelConfig';
import type { ConfigSource, ModelConfig, ModelConfigUpdate, ProviderInfo } from '../../types';

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

  // Get valid providers for this feature
  const validProviders = getProvidersForFeature(config.feature);

  // Get models for selected provider
  const providerInfo = availableProviders[localProvider];
  const availableModels = providerInfo?.models || [];

  // Check if API key is missing for selected provider
  const isApiKeyMissing = providerInfo?.requiresApiKey && missingApiKeys.includes(localProvider);

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
    setLocalProvider(newProvider);
    // Reset model to first available for new provider
    const newProviderInfo = availableProviders[newProvider];
    if (newProviderInfo?.models.length > 0) {
      setLocalModel(newProviderInfo.models[0]);
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
          </label>
          <select
            id={`provider-${config.feature}`}
            value={localProvider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="input text-sm"
            disabled={isUpdating}
          >
            {filteredProviders.map((provider) => (
              <option key={provider} value={provider}>
                {PROVIDER_DISPLAY_NAMES[provider] || provider}
                {availableProviders[provider]?.isLocal ? ' 🏠' : ''}
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
            value={localModel}
            onChange={(e) => setLocalModel(e.target.value)}
            className="input text-sm"
            disabled={isUpdating || availableModels.length === 0}
          >
            {availableModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
            {availableModels.length === 0 && <option value="">No models available</option>}
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
