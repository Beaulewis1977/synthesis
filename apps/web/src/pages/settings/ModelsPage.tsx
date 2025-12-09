/**
 * ModelsPage - Model Selector Admin UI
 *
 * Phase 6: Settings page for configuring AI models and providers.
 * Allows runtime configuration of Chat, Embeddings, Reranker, and API keys.
 */

import type { CustomProvider } from '@synthesis/shared';
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Code2,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiKeyManager } from '../../components/settings/ApiKeyManager';
import { CustomProviderForm } from '../../components/settings/CustomProviderForm';
import { EmbeddingProfileSelect } from '../../components/settings/EmbeddingProfileSelect';
import { ModelConfigCard } from '../../components/settings/ModelConfigCard';
import { useCustomProviders, useDeleteCustomProvider } from '../../hooks/useCustomProviders';
import {
  FEATURE_CATEGORIES,
  useEmbeddingProfiles,
  useModelConfigs,
  useResetAllModelConfigs,
  useSetDefaultEmbeddingProfile,
  useUpdateModelConfig,
} from '../../hooks/useModelConfig';
import { useOllamaModels } from '../../hooks/useOllamaModels';
import type { ModelFeature } from '../../types';

/**
 * Section header component
 */
function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Bot;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-md mb-lg">
      <div className="p-sm bg-accent/10 rounded-lg">
        <Icon size={20} className="text-accent" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        <p className="text-sm text-text-secondary mt-xs">{description}</p>
      </div>
    </div>
  );
}

/**
 * Tab component for embedding types
 */
function EmbeddingTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: 'docs' | 'code' | 'writing';
  onTabChange: (tab: 'docs' | 'code' | 'writing') => void;
}) {
  const tabs = [
    { id: 'docs' as const, label: 'Documents', icon: FileText },
    { id: 'code' as const, label: 'Code', icon: Code2 },
    { id: 'writing' as const, label: 'Writing', icon: Pencil },
  ];

  return (
    <div className="flex border-b border-border mb-md">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-xs px-md py-sm border-b-2 transition-colors ${
              isActive
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Icon size={16} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Card component for displaying a single custom provider
 */
interface CustomProviderCardProps {
  provider: CustomProvider;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function CustomProviderCard({ provider, onEdit, onDelete, isDeleting }: CustomProviderCardProps) {
  const modelCount =
    (provider.discoveredModels?.length || 0) + (provider.customModels?.length || 0);

  return (
    <div className="flex items-center justify-between p-md border border-border rounded-lg">
      <div>
        <h4 className="font-medium text-text-primary">{provider.name}</h4>
        <p className="text-sm text-text-secondary">{provider.baseUrl}</p>
        <div className="flex gap-xs mt-sm">
          <span className="text-xs px-1.5 py-0.5 bg-accent/10 text-accent rounded">
            {modelCount} model{modelCount !== 1 ? 's' : ''}
          </span>
          {provider.supportsTools && (
            <span className="text-xs px-1.5 py-0.5 bg-success/10 text-success rounded">Tools</span>
          )}
          {provider.supportsVision && (
            <span className="text-xs px-1.5 py-0.5 bg-success/10 text-success rounded">Vision</span>
          )}
        </div>
      </div>
      <div className="flex gap-xs">
        <button
          type="button"
          onClick={onEdit}
          className="p-sm rounded hover:bg-bg-secondary text-text-secondary hover:text-text-primary transition-colors"
          aria-label="Edit provider"
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className="p-sm rounded hover:bg-error/10 text-text-secondary hover:text-error transition-colors disabled:opacity-50"
          aria-label="Delete provider"
        >
          {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
        </button>
      </div>
    </div>
  );
}

/**
 * Section component for managing custom providers
 */
function CustomProvidersSection() {
  const { data: providers, isLoading, error } = useCustomProviders();
  const deleteProvider = useDeleteCustomProvider();
  const [editingProvider, setEditingProvider] = useState<CustomProvider | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleDelete = (provider: CustomProvider) => {
    if (window.confirm(`Delete "${provider.name}"? This cannot be undone.`)) {
      deleteProvider.mutate(provider.id);
    }
  };

  const handleEdit = (provider: CustomProvider) => {
    setEditingProvider(provider);
    setIsFormOpen(true);
  };

  const handleAdd = () => {
    setEditingProvider(null);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingProvider(null);
  };

  // Error state
  if (error) {
    return (
      <section className="mb-xl">
        <SectionHeader
          icon={Server}
          title="Custom Providers"
          description="Add OpenAI-compatible LLM endpoints (vLLM, LMStudio, OpenRouter, Groq, etc.)"
        />
        <div className="card">
          <div className="p-md bg-error/10 border border-error/30 rounded-lg flex items-center gap-sm text-error">
            <AlertTriangle size={18} />
            <span>
              Failed to load custom providers:{' '}
              {error instanceof Error ? error.message : 'Unknown error'}
            </span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-xl">
      <SectionHeader
        icon={Server}
        title="Custom Providers"
        description="Add OpenAI-compatible LLM endpoints (vLLM, LMStudio, OpenRouter, Groq, etc.)"
      />

      <div className="card">
        <div className="flex items-center justify-between mb-md">
          <h3 className="font-medium text-text-primary">Configured Providers</h3>
          <button
            type="button"
            onClick={handleAdd}
            className="btn btn-primary text-sm flex items-center gap-xs"
          >
            <Plus size={14} />
            Add Custom Provider
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-lg">
            <Loader2 className="animate-spin text-accent" size={24} />
            <span className="ml-sm text-text-secondary">Loading providers...</span>
          </div>
        ) : providers && providers.length > 0 ? (
          <div className="space-y-sm">
            {providers.map((provider) => (
              <CustomProviderCard
                key={provider.id}
                provider={provider}
                onEdit={() => handleEdit(provider)}
                onDelete={() => handleDelete(provider)}
                isDeleting={deleteProvider.isPending && deleteProvider.variables === provider.id}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-lg text-text-secondary">
            No custom providers configured
          </div>
        )}
      </div>

      {/* Custom Provider Form Modal */}
      <CustomProviderForm
        isOpen={isFormOpen}
        provider={editingProvider ?? undefined}
        onSave={handleFormClose}
        onCancel={handleFormClose}
      />
    </section>
  );
}

export function ModelsPage() {
  const [embeddingTab, setEmbeddingTab] = useState<'docs' | 'code' | 'writing'>('docs');
  const [updateErrors, setUpdateErrors] = useState<Record<string, string>>({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Fetch data
  const { data: configsData, isLoading: configsLoading, error: configsError } = useModelConfigs();
  const { data: ollamaData } = useOllamaModels();
  const { data: profilesData, isLoading: profilesLoading } = useEmbeddingProfiles();

  // Merge dynamic Ollama models with static provider info
  const mergedProviders = useMemo(() => {
    if (!configsData?.availableProviders) return {};

    const providers = { ...configsData.availableProviders };

    if (ollamaData?.available && ollamaData.models.length > 0 && providers.ollama) {
      providers.ollama = {
        ...providers.ollama,
        models: ollamaData.models.map((m) => m.name),
      };
    }

    return providers;
  }, [configsData?.availableProviders, ollamaData]);

  // Mutations
  const updateMutation = useUpdateModelConfig();
  const resetAllMutation = useResetAllModelConfigs();
  const setDefaultProfileMutation = useSetDefaultEmbeddingProfile();

  // Handle config update
  const handleUpdate = async (
    feature: ModelFeature,
    update: Parameters<typeof updateMutation.mutate>[0]['update']
  ) => {
    try {
      setUpdateErrors((prev) => {
        const next = { ...prev };
        delete next[feature];
        return next;
      });
      await updateMutation.mutateAsync({ feature, update });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update configuration';
      setUpdateErrors((prev) => ({ ...prev, [feature]: message }));
    }
  };

  // Handle reset all
  const handleResetAll = async () => {
    try {
      await resetAllMutation.mutateAsync();
      setShowResetConfirm(false);
      setUpdateErrors({});
    } catch (err) {
      console.error('Failed to reset configurations:', err);
    }
  };

  // Loading state
  if (configsLoading || profilesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-accent" size={32} />
        <span className="ml-md text-text-secondary">Loading model configurations...</span>
      </div>
    );
  }

  // Error state
  if (configsError) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="p-lg bg-error/10 border border-error/30 rounded-lg flex items-center gap-md">
          <AlertTriangle size={24} className="text-error" />
          <div>
            <h3 className="font-medium text-error">Failed to load configurations</h3>
            <p className="text-sm text-text-secondary mt-xs">
              {configsError instanceof Error ? configsError.message : 'Unknown error'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const configs = configsData?.configs || [];
  const missingApiKeys = configsData?.missingApiKeys || [];
  const profiles = profilesData?.profiles || [];
  const defaultProfileId = profilesData?.defaultProfileId || null;

  // Get configs by category
  const getConfigsForCategory = (features: ModelFeature[]) =>
    configs.filter((c) => features.includes(c.feature));

  const llmConfigs = getConfigsForCategory(FEATURE_CATEGORIES.llm);
  const embeddingConfigs = getConfigsForCategory(FEATURE_CATEGORIES.embedding);
  const searchConfigs = getConfigsForCategory(FEATURE_CATEGORIES.search);

  // Get current embedding config based on tab
  const embeddingFeatureMap = {
    docs: 'embedding_docs',
    code: 'embedding_code',
    writing: 'embedding_writing',
  } as const;
  const currentEmbeddingConfig = embeddingConfigs.find(
    (c) => c.feature === embeddingFeatureMap[embeddingTab]
  );

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-lg">
        <div className="flex items-center gap-md">
          <Link
            to="/"
            className="p-sm hover:bg-bg-secondary rounded-lg transition-colors"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft size={20} className="text-text-secondary" />
          </Link>
          <div className="flex items-center gap-sm">
            <Settings size={24} className="text-accent" />
            <h1 className="text-xl font-bold text-text-primary">Models & Providers</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowResetConfirm(true)}
          className="btn btn-secondary text-sm flex items-center gap-xs"
        >
          <RefreshCw size={14} />
          Reset All to Defaults
        </button>
      </div>

      {/* Missing API Keys Warning */}
      {missingApiKeys.length > 0 && (
        <div className="mb-lg p-md bg-warning/10 border border-warning/30 rounded-lg flex items-start gap-sm">
          <AlertTriangle size={18} className="text-warning flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-medium text-warning">Missing API Keys</span>
            <p className="text-sm text-text-secondary mt-xs">
              Some providers require API keys: {missingApiKeys.join(', ')}. Configure them in the
              API Keys section below.
            </p>
          </div>
        </div>
      )}

      {/* LLM Models Section */}
      <section className="mb-xl">
        <SectionHeader
          icon={Bot}
          title="LLM Models"
          description="Configure language models for chat, summarization, and vision tasks."
        />
        <div className="grid gap-md">
          {llmConfigs.map((config) => (
            <ModelConfigCard
              key={config.feature}
              config={config}
              availableProviders={mergedProviders}
              missingApiKeys={missingApiKeys}
              onUpdate={(update) => handleUpdate(config.feature, update)}
              isUpdating={
                updateMutation.isPending && updateMutation.variables?.feature === config.feature
              }
              error={updateErrors[config.feature]}
            />
          ))}
        </div>
      </section>

      {/* Embeddings Section */}
      <section className="mb-xl">
        <SectionHeader
          icon={Sparkles}
          title="Embeddings"
          description="Configure embedding models for different content types. Select a profile or customize per type."
        />

        {/* Profile Selector */}
        <div className="mb-lg">
          <span className="block text-sm font-medium text-text-primary mb-sm">
            Embedding Profile
          </span>
          <p className="text-xs text-text-secondary mb-sm">
            Profiles bundle provider, model, and chunking settings. Applied to new ingestions.
          </p>
          <EmbeddingProfileSelect
            profiles={profiles}
            selectedId={defaultProfileId}
            defaultProfileId={defaultProfileId}
            onSelect={(profileId) => {
              setDefaultProfileMutation.mutate(profileId);
            }}
            disabled={setDefaultProfileMutation.isPending}
          />
        </div>

        {/* Per-Type Configuration */}
        <div className="card">
          <h4 className="font-medium text-text-primary mb-md">Per-Type Configuration</h4>
          <p className="text-xs text-text-secondary mb-md">
            Override profile settings for specific content types.
          </p>

          <EmbeddingTabs activeTab={embeddingTab} onTabChange={setEmbeddingTab} />

          {currentEmbeddingConfig && (
            <ModelConfigCard
              config={currentEmbeddingConfig}
              availableProviders={mergedProviders}
              missingApiKeys={missingApiKeys}
              onUpdate={(update) => handleUpdate(currentEmbeddingConfig.feature, update)}
              isUpdating={
                updateMutation.isPending &&
                updateMutation.variables?.feature === currentEmbeddingConfig.feature
              }
              error={updateErrors[currentEmbeddingConfig.feature]}
            />
          )}
        </div>
      </section>

      {/* Search Section */}
      <section className="mb-xl">
        <SectionHeader
          icon={Search}
          title="Search"
          description="Configure reranking for improved search result relevance."
        />
        <div className="grid gap-md">
          {searchConfigs.map((config) => (
            <ModelConfigCard
              key={config.feature}
              config={config}
              availableProviders={mergedProviders}
              missingApiKeys={missingApiKeys}
              onUpdate={(update) => handleUpdate(config.feature, update)}
              isUpdating={
                updateMutation.isPending && updateMutation.variables?.feature === config.feature
              }
              error={updateErrors[config.feature]}
            />
          ))}
        </div>
      </section>

      {/* API Keys Section */}
      <section className="mb-xl">
        <div className="card">
          <ApiKeyManager />
        </div>
      </section>

      {/* Custom Providers Section */}
      <CustomProvidersSection />

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-lg max-w-md w-full mx-md animate-scale-in">
            <h3 className="text-lg font-semibold text-text-primary mb-md">
              Reset All Configurations?
            </h3>
            <p className="text-sm text-text-secondary mb-lg">
              This will reset all model configurations to their default values. Any custom settings
              saved to the database will be removed. Environment variable overrides will still
              apply.
            </p>
            <div className="flex justify-end gap-sm">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetAll}
                disabled={resetAllMutation.isPending}
                className="btn btn-danger flex items-center gap-xs"
              >
                {resetAllMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                Reset All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ModelsPage;
