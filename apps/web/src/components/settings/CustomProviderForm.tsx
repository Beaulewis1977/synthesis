/**
 * CustomProviderForm Component
 *
 * Phase 17H: Modal form for adding/editing custom OpenAI-compatible LLM providers.
 * Supports connection testing, model auto-discovery, and manual model fallback.
 */

import type { CreateCustomProviderInput, CustomProvider } from '@synthesis/shared';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Loader2,
  Server,
  Wifi,
  XCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  useCreateCustomProvider,
  useTestCustomProviderConnection,
  useUpdateCustomProvider,
} from '../../hooks/useCustomProviders';
import { Modal } from '../Modal';

interface CustomProviderFormProps {
  /** Existing provider for edit mode (pre-populates fields) */
  provider?: CustomProvider;
  /** Callback when provider is saved successfully */
  onSave: (provider: CustomProvider) => void;
  /** Callback when form is cancelled */
  onCancel: () => void;
  /** Whether the modal is open */
  isOpen: boolean;
}

/**
 * Validates a provider URL.
 * Allows:
 * - http://localhost:* (local development)
 * - http://127.0.0.1:* (loopback)
 * - https://* (secure remote)
 * - http://* with custom hostnames (Docker/WSL networking)
 */
function isValidProviderUrl(url: string): boolean {
  if (!url.trim()) return false;
  try {
    const parsed = new URL(url);
    // Allow http and https protocols, and ensure hostname is present
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname.length > 0
    );
  } catch {
    return false;
  }
}

export function CustomProviderForm({
  provider,
  onSave,
  onCancel,
  isOpen,
}: CustomProviderFormProps) {
  // Form field state
  const [name, setName] = useState(provider?.name || '');
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl || '');
  const [apiKey, setApiKey] = useState(''); // Never pre-populate for security
  const [maxContextTokens, setMaxContextTokens] = useState(provider?.maxContextTokens || 8192);
  const [supportsVision, setSupportsVision] = useState(provider?.supportsVision || false);
  const [supportsTools, setSupportsTools] = useState(provider?.supportsTools ?? true);
  const [customModels, setCustomModels] = useState(provider?.customModels?.join(', ') || '');

  // UI state
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [discoveredModels, setDiscoveredModels] = useState<string[]>(
    provider?.discoveredModels || []
  );
  const [testError, setTestError] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null); // Success message for manual model entry

  // Ref for tracking current test request (prevents race conditions)
  const testRequestRef = useRef(0);

  // Reset form state when modal opens or provider changes
  useEffect(() => {
    if (isOpen) {
      setName(provider?.name || '');
      setBaseUrl(provider?.baseUrl || '');
      setApiKey('');
      setMaxContextTokens(provider?.maxContextTokens || 8192);
      setSupportsVision(provider?.supportsVision || false);
      setSupportsTools(provider?.supportsTools ?? true);
      setCustomModels(provider?.customModels?.join(', ') || '');
      setShowApiKey(false);
      setShowAdvanced(false);
      setDiscoveredModels(provider?.discoveredModels || []);
      setTestError(null);
      setTestSuccess(false);
      setTestMessage(null);
      testRequestRef.current = 0;
    }
  }, [isOpen, provider]);

  // Mutations
  const testConnection = useTestCustomProviderConnection();
  const createProvider = useCreateCustomProvider();
  const updateProvider = useUpdateCustomProvider();

  // Derived state
  const isEditing = !!provider;
  const isTesting = testConnection.isPending;
  const isSaving = createProvider.isPending || updateProvider.isPending;
  const isNameValid = name.trim().length > 0;
  const isUrlValid = isValidProviderUrl(baseUrl);
  const canSave = isNameValid && isUrlValid && !isSaving;
  const canTest = isUrlValid && !isTesting;

  // Reset form state when modal opens/closes
  const handleClose = () => {
    if (!isSaving) {
      onCancel();
    }
  };

  const handleTestConnection = async () => {
    // Increment request ID to track this specific request
    const requestId = ++testRequestRef.current;

    setTestError(null);
    setTestSuccess(false);
    setTestMessage(null);
    setDiscoveredModels([]);

    try {
      const result = await testConnection.mutateAsync({
        baseUrl: baseUrl.trim(),
        apiKey: apiKey || undefined,
      });

      // Only update state if this is still the latest request
      // (prevents race conditions when URL changes during test)
      if (requestId === testRequestRef.current) {
        if (result.valid) {
          // Connection succeeded - may or may not have discovered models
          setDiscoveredModels(result.models || []);
          setTestSuccess(true);
          // Show message if provider doesn't expose models list (e.g., MiniMax)
          if (result.message) {
            setTestMessage(result.message);
          }
        } else {
          setTestError(result.error || 'Connection failed');
        }
      }
    } catch (err) {
      // Only update error state if this is still the latest request
      if (requestId === testRequestRef.current) {
        setTestError(err instanceof Error ? err.message : 'Connection test failed');
      }
    }
  };

  const handleSave = async () => {
    if (!canSave) return;

    const data: CreateCustomProviderInput = {
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      apiKey: apiKey || undefined,
      maxContextTokens,
      supportsVision,
      supportsTools,
      customModels: customModels
        ? customModels
            .split(',')
            .map((m) => m.trim())
            .filter(Boolean)
        : undefined,
    };

    try {
      if (isEditing && provider) {
        const updated = await updateProvider.mutateAsync({
          id: provider.id,
          data,
        });
        onSave(updated);
      } else {
        const created = await createProvider.mutateAsync(data);
        onSave(created);
      }
    } catch {
      // Error handled by mutation state - displayed below
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? 'Edit Custom Provider' : 'Add Custom Provider'}
      size="md"
      allowClose={!isSaving}
    >
      <div className="space-y-md">
        {/* Provider Name */}
        <div>
          <label
            htmlFor="provider-name"
            className="block text-sm font-medium text-text-secondary mb-1"
          >
            Name <span className="text-error">*</span>
          </label>
          <input
            id="provider-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input w-full"
            placeholder="e.g., Local vLLM, OpenRouter, Groq"
            disabled={isSaving}
          />
        </div>

        {/* Base URL */}
        <div>
          <label
            htmlFor="provider-base-url"
            className="block text-sm font-medium text-text-secondary mb-1"
          >
            Base URL <span className="text-error">*</span>
          </label>
          <input
            id="provider-base-url"
            type="url"
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value);
              // Reset test results when URL changes
              setTestSuccess(false);
              setTestError(null);
              setDiscoveredModels([]);
            }}
            className="input w-full font-mono text-sm"
            placeholder="http://localhost:8000/v1"
            disabled={isSaving}
          />
          <p className="text-xs text-text-secondary mt-1">
            OpenAI-compatible endpoint (e.g., vLLM, LMStudio, OpenRouter)
          </p>
        </div>

        {/* API Key */}
        <div>
          <label
            htmlFor="provider-api-key"
            className="block text-sm font-medium text-text-secondary mb-1"
          >
            API Key <span className="text-text-secondary font-normal">(optional)</span>
          </label>
          <div className="relative">
            <input
              id="provider-api-key"
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="input w-full pr-10 font-mono text-sm"
              placeholder={
                isEditing && provider?.hasApiKey
                  ? '••••••••••••••••'
                  : 'Leave empty for local endpoints'
              }
              disabled={isSaving}
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-secondary hover:text-text-primary transition-colors"
              aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
            >
              {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {isEditing && provider?.hasApiKey && !apiKey && (
            <p className="text-xs text-text-secondary mt-1">
              API key is configured. Enter a new key to update it.
            </p>
          )}
        </div>

        {/* Test Connection Button */}
        <div>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={!canTest}
            className="btn btn-secondary w-full flex items-center justify-center gap-sm"
          >
            {isTesting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Testing Connection...
              </>
            ) : testSuccess ? (
              <>
                <CheckCircle size={16} className="text-success" />
                Connection Successful
              </>
            ) : (
              <>
                <Wifi size={16} />
                Test Connection
              </>
            )}
          </button>
        </div>

        {/* Test Success: Discovered Models */}
        {testSuccess && discoveredModels.length > 0 && (
          <div className="p-sm bg-success/10 border border-success/30 rounded-lg">
            <div className="flex items-center gap-sm mb-sm">
              <CheckCircle size={16} className="text-success" />
              <span className="text-sm font-medium text-success">
                Discovered {discoveredModels.length} model
                {discoveredModels.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-xs">
              {discoveredModels.map((model) => (
                <div
                  key={model}
                  className="text-xs text-text-primary bg-bg-primary px-2 py-1 rounded font-mono"
                >
                  {model}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Test Success: No models discovered (manual entry required) */}
        {testSuccess && discoveredModels.length === 0 && testMessage && (
          <div className="p-sm bg-warning/10 border border-warning/30 rounded-lg">
            <div className="flex items-start gap-sm">
              <CheckCircle size={16} className="text-warning flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="text-sm font-medium text-warning">Connection Successful</span>
                <p className="text-xs text-warning/80 mt-xs">{testMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Test Error */}
        {testError && (
          <div className="p-sm bg-error/10 border border-error/30 rounded-lg">
            <div className="flex items-start gap-sm">
              <XCircle size={16} className="text-error flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="text-sm font-medium text-error">Connection Failed</span>
                <p className="text-xs text-error/80 mt-xs">{testError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Advanced Settings Toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-xs text-sm text-text-secondary hover:text-text-primary transition-colors"
          aria-expanded={showAdvanced}
          aria-controls="advanced-settings"
        >
          {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          Advanced Settings
        </button>

        {/* Advanced Settings */}
        {showAdvanced && (
          <div id="advanced-settings" className="space-y-md pl-md border-l-2 border-border">
            {/* Max Context Tokens */}
            <div>
              <label
                htmlFor="provider-max-tokens"
                className="block text-sm font-medium text-text-secondary mb-1"
              >
                Max Context Tokens
              </label>
              <input
                id="provider-max-tokens"
                type="number"
                value={maxContextTokens}
                onChange={(e) =>
                  setMaxContextTokens(
                    Math.min(1000000, Math.max(1, Number.parseInt(e.target.value, 10) || 8192))
                  )
                }
                className="input w-full"
                min={1}
                max={1000000}
                disabled={isSaving}
              />
              <p className="text-xs text-text-secondary mt-1">
                Maximum tokens for context window (default: 8192)
              </p>
            </div>

            {/* Capability Checkboxes */}
            <div className="space-y-sm">
              <div className="flex items-center gap-sm">
                <input
                  type="checkbox"
                  id="provider-supports-tools"
                  checked={supportsTools}
                  onChange={(e) => setSupportsTools(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                  disabled={isSaving}
                />
                <label
                  htmlFor="provider-supports-tools"
                  className="text-sm text-text-primary cursor-pointer"
                >
                  Supports Tools <span className="text-text-secondary">(function calling)</span>
                </label>
              </div>

              <div className="flex items-center gap-sm">
                <input
                  type="checkbox"
                  id="provider-supports-vision"
                  checked={supportsVision}
                  onChange={(e) => setSupportsVision(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                  disabled={isSaving}
                />
                <label
                  htmlFor="provider-supports-vision"
                  className="text-sm text-text-primary cursor-pointer"
                >
                  Supports Vision <span className="text-text-secondary">(image inputs)</span>
                </label>
              </div>
            </div>

            {/* Custom Models (Manual Fallback) */}
            <div>
              <label
                htmlFor="provider-custom-models"
                className="block text-sm font-medium text-text-secondary mb-1"
              >
                Custom Models <span className="text-text-secondary font-normal">(fallback)</span>
              </label>
              <textarea
                id="provider-custom-models"
                value={customModels}
                onChange={(e) => setCustomModels(e.target.value)}
                className="input w-full min-h-[60px] font-mono text-sm"
                placeholder="model-a, model-b, model-c"
                disabled={isSaving}
              />
              <p className="text-xs text-text-secondary mt-1">
                Comma-separated model names. Used if auto-discovery fails.
              </p>
              {testError && (
                <div className="mt-sm p-xs bg-warning/10 border border-warning/30 rounded flex items-start gap-xs">
                  <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-warning">
                    Auto-discovery failed. Enter models manually above.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mutation Error */}
        {(createProvider.isError || updateProvider.isError) && (
          <div className="p-sm bg-error/10 border border-error/30 rounded-lg flex items-start gap-sm">
            <AlertTriangle size={16} className="text-error flex-shrink-0 mt-0.5" />
            <div className="text-sm text-error">
              {createProvider.error?.message ||
                updateProvider.error?.message ||
                'Failed to save provider'}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-sm pt-md border-t border-border">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="btn btn-primary flex items-center gap-xs"
          >
            {isSaving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {isEditing ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                <Server size={14} />
                {isEditing ? 'Update Provider' : 'Add Provider'}
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
