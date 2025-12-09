/**
 * ApiKeyManager Component
 *
 * Phase 6: Manage API keys for various providers.
 * Allows setting, testing, and deleting API keys.
 * Phase 16G: Added provider settings (e.g., Z.AI coding plan toggle).
 * Phase 17A: Added Anthropic OAuth/API key authentication toggle.
 */

import {
  AlertTriangle,
  Check,
  CheckCircle,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Settings2,
  Trash2,
  User,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import {
  PROVIDER_DISPLAY_NAMES,
  useAnthropicAuthMode,
  useApiKeyStatus,
  useDeleteApiKey,
  useDeleteOAuthToken,
  useOAuthTokenStatus,
  useProviderSettings,
  useSetApiKey,
  useSetOAuthToken,
  useSetProviderSetting,
  useTestApiKey,
  useTestOAuthToken,
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

/**
 * Toggle component for provider settings
 */
function ProviderSettingToggle({
  label,
  description,
  currentValue,
  onToggle,
  isUpdating,
}: {
  label: string;
  description: string;
  currentValue: boolean;
  onToggle: (value: boolean) => void;
  isUpdating: boolean;
}) {
  return (
    <div className="p-md border border-border rounded-lg bg-bg-secondary/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-sm">
          <Settings2 size={16} className="text-accent" />
          <div>
            <span className="font-medium text-text-primary text-sm">{label}</span>
            <p className="text-xs text-text-secondary mt-xs">{description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onToggle(!currentValue)}
          disabled={isUpdating}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            currentValue ? 'bg-accent' : 'bg-gray-300'
          } ${isUpdating ? 'opacity-50' : ''}`}
          aria-label={`Toggle ${label}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              currentValue ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
}

/**
 * OAuth Token Input component for Anthropic (Phase 17A)
 */
function OAuthTokenInput({
  configured,
  maskedValue,
  onSave,
  onDelete,
  onTest,
  isSaving,
  isDeleting,
  isTesting,
  testResult,
}: {
  configured: boolean;
  maskedValue?: string;
  onSave: (token: string) => void;
  onDelete: () => void;
  onTest: () => void;
  isSaving: boolean;
  isDeleting: boolean;
  isTesting: boolean;
  testResult?: { valid: boolean; message: string } | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [tokenValue, setTokenValue] = useState('');

  const handleSave = () => {
    if (tokenValue.trim()) {
      onSave(tokenValue.trim());
      setTokenValue('');
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setTokenValue('');
    setIsEditing(false);
  };

  return (
    <div className="p-md border border-border rounded-lg">
      <div className="flex items-center justify-between mb-sm">
        <div className="flex items-center gap-sm">
          <User size={16} className={configured ? 'text-success' : 'text-text-secondary'} />
          <span className="font-medium text-text-primary">OAuth Token</span>
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
          CLAUDE_CODE_OAUTH_TOKEN
        </code>
      </div>

      {isEditing ? (
        <div className="space-y-sm">
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={tokenValue}
              onChange={(e) => setTokenValue(e.target.value)}
              placeholder="Paste OAuth token from: claude setup-token"
              className="input pr-10 text-sm font-mono"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-secondary hover:text-text-primary"
              aria-label={showToken ? 'Hide token' : 'Show token'}
            >
              {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="flex items-center gap-sm">
            <button
              type="button"
              onClick={handleSave}
              disabled={!tokenValue.trim() || isSaving}
              className="btn btn-primary text-sm flex items-center gap-xs"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Save
            </button>
            <button type="button" onClick={handleCancel} className="btn btn-secondary text-sm">
              Cancel
            </button>
          </div>
          <p className="text-xs text-text-secondary">
            Generate with: <code className="bg-bg-secondary px-1 rounded">claude setup-token</code>
          </p>
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
              {configured ? 'Update' : 'Add Token'}
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
  const { data: settingsData } = useProviderSettings();
  const setApiKeyMutation = useSetApiKey();
  const deleteApiKeyMutation = useDeleteApiKey();
  const testApiKeyMutation = useTestApiKey();
  const setProviderSettingMutation = useSetProviderSetting();

  // Phase 17A: Anthropic OAuth hooks
  const { data: oauthStatus } = useOAuthTokenStatus();
  const setOAuthTokenMutation = useSetOAuthToken();
  const deleteOAuthTokenMutation = useDeleteOAuthToken();
  const testOAuthTokenMutation = useTestOAuthToken();
  const anthropicAuthMode = useAnthropicAuthMode();

  const [testResults, setTestResults] = useState<
    Record<string, { valid: boolean; message: string }>
  >({});
  const [oauthTestResult, setOauthTestResult] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);

  // Get Zhipu coding plan setting
  const zhipuCodingPlan =
    settingsData?.settings?.find(
      (s) => s.provider === 'zhipu' && s.settingKey === 'use_coding_plan'
    )?.settingValue === 'true';

  const handleZhipuCodingPlanToggle = async (value: boolean) => {
    await setProviderSettingMutation.mutateAsync({
      provider: 'zhipu',
      key: 'use_coding_plan',
      value: value.toString(),
    });
  };

  // Phase 17A: Anthropic auth mode toggle handler
  const handleAnthropicAuthModeToggle = async (useOAuth: boolean) => {
    await setProviderSettingMutation.mutateAsync({
      provider: 'anthropic',
      key: 'auth_mode',
      value: useOAuth ? 'oauth' : 'api_key',
    });
  };

  // Phase 17A: OAuth token handlers
  const handleOAuthSave = async (token: string) => {
    await setOAuthTokenMutation.mutateAsync(token);
    setOauthTestResult(null);
  };

  const handleOAuthDelete = async () => {
    await deleteOAuthTokenMutation.mutateAsync();
    setOauthTestResult(null);
  };

  const handleOAuthTest = async () => {
    const result = await testOAuthTokenMutation.mutateAsync();
    setOauthTestResult(result);
  };

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
          <div key={key.provider}>
            <ApiKeyInput
              provider={key.provider}
              envVar={key.envVar}
              configured={key.configured}
              maskedValue={key.maskedValue}
              onSave={(apiKey) => handleSave(key.provider, apiKey)}
              onDelete={() => handleDelete(key.provider)}
              onTest={() => handleTest(key.provider)}
              isSaving={
                setApiKeyMutation.isPending &&
                setApiKeyMutation.variables?.provider === key.provider
              }
              isDeleting={
                deleteApiKeyMutation.isPending && deleteApiKeyMutation.variables === key.provider
              }
              isTesting={
                testApiKeyMutation.isPending && testApiKeyMutation.variables === key.provider
              }
              testResult={testResults[key.provider]}
            />
            {/* Z.AI (Zhipu) specific settings */}
            {key.provider === 'zhipu' && key.configured && (
              <div className="mt-sm ml-md space-y-sm">
                <ProviderSettingToggle
                  label="Use Coding Plan Endpoint"
                  description="Enable to use your Z.AI Coding Plan subscription ($3-$60/mo) instead of pay-per-use API credits."
                  currentValue={zhipuCodingPlan}
                  onToggle={handleZhipuCodingPlanToggle}
                  isUpdating={setProviderSettingMutation.isPending}
                />
                {/* Endpoint indicator */}
                <div
                  className={`text-xs px-sm py-xs rounded inline-flex items-center gap-xs ${
                    zhipuCodingPlan ? 'bg-accent/10 text-accent' : 'bg-gray-100 text-text-secondary'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${zhipuCodingPlan ? 'bg-accent' : 'bg-gray-400'}`}
                  />
                  {zhipuCodingPlan ? (
                    <span>
                      Using: <code className="font-mono">/api/coding/</code> (Subscription)
                    </span>
                  ) : (
                    <span>
                      Using: <code className="font-mono">/api/paas/</code> (Pay-per-use)
                    </span>
                  )}
                </div>
              </div>
            )}
            {/* Anthropic OAuth/API Key settings (Phase 17A) */}
            {key.provider === 'anthropic' && (
              <div className="mt-sm ml-md space-y-sm">
                {/* Auth mode toggle */}
                <ProviderSettingToggle
                  label="Use Claude Subscription (OAuth)"
                  description="Enable to use your Claude Pro/Max subscription instead of pay-per-use API credits."
                  currentValue={anthropicAuthMode === 'oauth'}
                  onToggle={handleAnthropicAuthModeToggle}
                  isUpdating={setProviderSettingMutation.isPending}
                />
                {/* OAuth Token input (shown when OAuth mode is selected) */}
                {anthropicAuthMode === 'oauth' && (
                  <OAuthTokenInput
                    configured={oauthStatus?.configured ?? false}
                    maskedValue={oauthStatus?.maskedValue}
                    onSave={handleOAuthSave}
                    onDelete={handleOAuthDelete}
                    onTest={handleOAuthTest}
                    isSaving={setOAuthTokenMutation.isPending}
                    isDeleting={deleteOAuthTokenMutation.isPending}
                    isTesting={testOAuthTokenMutation.isPending}
                    testResult={oauthTestResult}
                  />
                )}
                {/* Auth mode indicator */}
                <div
                  className={`text-xs px-sm py-xs rounded inline-flex items-center gap-xs ${
                    anthropicAuthMode === 'oauth'
                      ? 'bg-accent/10 text-accent'
                      : 'bg-gray-100 text-text-secondary'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      anthropicAuthMode === 'oauth' ? 'bg-accent' : 'bg-gray-400'
                    }`}
                  />
                  {anthropicAuthMode === 'oauth' ? (
                    <span>
                      Using: <code className="font-mono">CLAUDE_CODE_OAUTH_TOKEN</code>{' '}
                      (Subscription)
                    </span>
                  ) : (
                    <span>
                      Using: <code className="font-mono">ANTHROPIC_API_KEY</code> (Pay-per-use)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
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
