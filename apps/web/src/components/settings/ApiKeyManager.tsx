/**
 * ApiKeyManager Component
 *
 * Phase 6: Manage API keys for various providers.
 * Allows setting, testing, and deleting API keys.
 */

import {
  AlertTriangle,
  Check,
  CheckCircle,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import {
  PROVIDER_DISPLAY_NAMES,
  useApiKeyStatus,
  useDeleteApiKey,
  useSetApiKey,
  useTestApiKey,
} from '../../hooks/useModelConfig';

interface ApiKeyInputProps {
  provider: string;
  envVar: string;
  configured: boolean;
  maskedValue?: string;
  onSave: (apiKey: string) => void;
  onDelete: () => void;
  onTest: () => void;
  isSaving: boolean;
  isDeleting: boolean;
  isTesting: boolean;
  testResult?: { valid: boolean; message: string } | null;
}

function ApiKeyInput({
  provider,
  envVar,
  configured,
  maskedValue,
  onSave,
  onDelete,
  onTest,
  isSaving,
  isDeleting,
  isTesting,
  testResult,
}: ApiKeyInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [keyValue, setKeyValue] = useState('');

  const handleSave = () => {
    if (keyValue.trim()) {
      onSave(keyValue.trim());
      setKeyValue('');
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setKeyValue('');
    setIsEditing(false);
  };

  return (
    <div className="p-md border border-border rounded-lg">
      <div className="flex items-center justify-between mb-sm">
        <div className="flex items-center gap-sm">
          <Key size={16} className={configured ? 'text-success' : 'text-text-secondary'} />
          <span className="font-medium text-text-primary">
            {PROVIDER_DISPLAY_NAMES[provider] || provider}
          </span>
          {configured ? (
            <span className="text-xs px-1.5 py-0.5 bg-success/10 text-success rounded">
              Configured
            </span>
          ) : (
            <span className="text-xs px-1.5 py-0.5 bg-warning/10 text-warning rounded">
              Not set
            </span>
          )}
        </div>
        <code className="text-xs text-text-secondary bg-bg-secondary px-2 py-0.5 rounded">
          {envVar}
        </code>
      </div>

      {isEditing ? (
        <div className="space-y-sm">
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              placeholder={`Enter ${PROVIDER_DISPLAY_NAMES[provider] || provider} API key...`}
              className="input pr-10 text-sm font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-secondary hover:text-text-primary"
              aria-label={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="flex items-center gap-sm">
            <button
              type="button"
              onClick={handleSave}
              disabled={!keyValue.trim() || isSaving}
              className="btn btn-primary text-sm flex items-center gap-xs"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Save
            </button>
            <button type="button" onClick={handleCancel} className="btn btn-secondary text-sm">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-sm">
            {configured && maskedValue && (
              <span className="text-sm font-mono text-text-secondary">{maskedValue}</span>
            )}
          </div>
          <div className="flex items-center gap-sm">
            {configured && (
              <>
                <button
                  type="button"
                  onClick={onTest}
                  disabled={isTesting}
                  className="btn btn-secondary text-sm flex items-center gap-xs"
                >
                  {isTesting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : testResult?.valid === true ? (
                    <CheckCircle size={14} className="text-success" />
                  ) : testResult?.valid === false ? (
                    <XCircle size={14} className="text-error" />
                  ) : (
                    <Check size={14} />
                  )}
                  Test
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={isDeleting}
                  className="btn btn-secondary text-sm flex items-center gap-xs text-error hover:bg-error/10"
                >
                  {isDeleting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  Remove
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="btn btn-primary text-sm"
            >
              {configured ? 'Update' : 'Add Key'}
            </button>
          </div>
        </div>
      )}

      {/* Test Result */}
      {testResult && (
        <div
          className={`mt-sm p-sm rounded text-xs flex items-center gap-sm ${
            testResult.valid ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
          }`}
        >
          {testResult.valid ? <CheckCircle size={14} /> : <XCircle size={14} />}
          {testResult.message}
        </div>
      )}
    </div>
  );
}

export function ApiKeyManager() {
  const { data, isLoading, error } = useApiKeyStatus();
  const setApiKeyMutation = useSetApiKey();
  const deleteApiKeyMutation = useDeleteApiKey();
  const testApiKeyMutation = useTestApiKey();

  const [testResults, setTestResults] = useState<
    Record<string, { valid: boolean; message: string }>
  >({});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-lg">
        <Loader2 className="animate-spin text-accent" size={24} />
        <span className="ml-sm text-text-secondary">Loading API keys...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-md bg-error/10 border border-error/30 rounded-lg flex items-center gap-sm text-error">
        <AlertTriangle size={18} />
        <span>Failed to load API key status</span>
      </div>
    );
  }

  const keys = data?.keys || [];

  // Sort keys: configured first, then alphabetically
  const sortedKeys = [...keys].sort((a, b) => {
    if (a.configured !== b.configured) return a.configured ? -1 : 1;
    return a.provider.localeCompare(b.provider);
  });

  const handleSave = async (provider: string, apiKey: string) => {
    await setApiKeyMutation.mutateAsync({ provider, apiKey });
    // Clear test result on save
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[provider];
      return next;
    });
  };

  const handleDelete = async (provider: string) => {
    await deleteApiKeyMutation.mutateAsync(provider);
    // Clear test result on delete
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[provider];
      return next;
    });
  };

  const handleTest = async (provider: string) => {
    const result = await testApiKeyMutation.mutateAsync(provider);
    setTestResults((prev) => ({ ...prev, [provider]: result }));
  };

  return (
    <div className="space-y-md">
      <div className="flex items-center gap-sm mb-md">
        <Key size={20} className="text-accent" />
        <h3 className="font-semibold text-text-primary">API Keys</h3>
      </div>

      <p className="text-sm text-text-secondary mb-lg">
        Configure API keys for cloud providers. Keys are stored securely and never exposed after
        entry.
      </p>

      <div className="space-y-sm">
        {sortedKeys.map((key) => (
          <ApiKeyInput
            key={key.provider}
            provider={key.provider}
            envVar={key.envVar}
            configured={key.configured}
            maskedValue={key.maskedValue}
            onSave={(apiKey) => handleSave(key.provider, apiKey)}
            onDelete={() => handleDelete(key.provider)}
            onTest={() => handleTest(key.provider)}
            isSaving={
              setApiKeyMutation.isPending && setApiKeyMutation.variables?.provider === key.provider
            }
            isDeleting={
              deleteApiKeyMutation.isPending && deleteApiKeyMutation.variables === key.provider
            }
            isTesting={
              testApiKeyMutation.isPending && testApiKeyMutation.variables === key.provider
            }
            testResult={testResults[key.provider]}
          />
        ))}
      </div>

      {keys.length === 0 && (
        <div className="text-center py-lg text-text-secondary">
          No API keys configured. Add keys to enable cloud providers.
        </div>
      )}
    </div>
  );
}
