/**
 * McpServerCard Component
 *
 * Card for displaying and managing an external MCP server configuration.
 * Shows server info, enable/disable toggle, test connection, API key input, and delete.
 */

import {
  AlertTriangle,
  Check,
  CheckCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Pencil,
  Power,
  Server,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import type { McpConnectionTestResult, McpServerResponse, McpStdioConfig } from '../../types';

interface McpServerCardProps {
  server: McpServerResponse;
  onToggleEnabled: (id: string, enabled: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onTest: (id: string) => Promise<McpConnectionTestResult>;
  onEdit?: (server: McpServerResponse) => void;
  onSetApiKey?: (id: string, apiKey: string) => Promise<void>;
  onDeleteApiKey?: (id: string) => Promise<void>;
  isTogglingEnabled?: boolean;
  isDeleting?: boolean;
  isTesting?: boolean;
  isSettingApiKey?: boolean;
  isDeletingApiKey?: boolean;
}

export function McpServerCard({
  server,
  onToggleEnabled,
  onDelete,
  onTest,
  onEdit,
  onSetApiKey,
  onDeleteApiKey,
  isTogglingEnabled = false,
  isDeleting = false,
  isTesting = false,
  isSettingApiKey = false,
  isDeletingApiKey = false,
}: McpServerCardProps) {
  const [testResult, setTestResult] = useState<McpConnectionTestResult | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const handleToggle = async () => {
    try {
      await onToggleEnabled(server.id, !server.enabled);
    } catch (error) {
      console.error('Failed to toggle MCP server', error);
    }
  };

  const handleTest = async () => {
    setTestResult(null);
    try {
      const result = await onTest(server.id);
      setTestResult(result);
    } catch (error) {
      console.error('Failed to test MCP server', error);
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test server connection',
      });
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(server.id);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Failed to delete MCP server', error);
    }
  };

  const handleSetApiKey = async () => {
    if (onSetApiKey && apiKeyValue.trim()) {
      try {
        await onSetApiKey(server.id, apiKeyValue.trim());
        setApiKeyValue('');
        setShowApiKeyInput(false);
        setShowApiKey(false);
      } catch (error) {
        console.error('Failed to set MCP server API key', error);
      }
    }
  };

  const handleDeleteApiKey = async () => {
    if (onDeleteApiKey) {
      try {
        await onDeleteApiKey(server.id);
      } catch (error) {
        console.error('Failed to delete MCP server API key', error);
        throw error instanceof Error ? error : new Error('Failed to delete MCP server API key');
      }
    }
  };

  // Get command preview for stdio servers
  const getCommandPreview = (): string => {
    if (server.serverType === 'stdio') {
      const config = server.config as McpStdioConfig;
      const args = config.args?.join(' ') || '';
      return `${config.command} ${args}`.trim();
    }
    return (server.config as { url?: string }).url || '';
  };

  return (
    <div
      className={`p-md border rounded-lg transition-all ${
        server.enabled ? 'border-accent bg-accent/5' : 'border-border bg-surface'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-sm">
        <div className="flex items-center gap-sm">
          <Server size={18} className={server.enabled ? 'text-accent' : 'text-text-secondary'} />
          <div>
            <div className="flex items-center gap-xs">
              <span className="font-medium text-text-primary">
                {server.displayName || server.name}
              </span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${
                  server.enabled ? 'bg-success/10 text-success' : 'bg-gray-200 text-text-secondary'
                }`}
              >
                {server.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            {server.description && (
              <p className="text-xs text-text-secondary mt-xs">{server.description}</p>
            )}
          </div>
        </div>

        {/* Enable/Disable Toggle */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={isTogglingEnabled}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            server.enabled ? 'bg-accent' : 'bg-gray-300'
          } ${isTogglingEnabled ? 'opacity-50' : ''}`}
          aria-label={server.enabled ? 'Disable server' : 'Enable server'}
        >
          {isTogglingEnabled ? (
            <Loader2
              size={12}
              className="absolute left-1/2 -translate-x-1/2 animate-spin text-white"
            />
          ) : (
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                server.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          )}
        </button>
      </div>

      {/* Server Details */}
      <div className="space-y-xs mb-sm">
        {/* Type Badge */}
        <div className="flex items-center gap-sm text-xs">
          <span className="text-text-secondary">Type:</span>
          <span className="px-1.5 py-0.5 bg-bg-secondary rounded font-mono">
            {server.serverType}
          </span>
        </div>

        {/* Command Preview */}
        <div className="flex items-center gap-sm text-xs">
          <span className="text-text-secondary">Command:</span>
          <code className="px-1.5 py-0.5 bg-bg-secondary rounded font-mono text-text-primary truncate max-w-xs">
            {getCommandPreview()}
          </code>
        </div>

        {/* API Key Status */}
        {server.apiKeyEnvVar && (
          <div className="space-y-xs">
            <div className="flex items-center gap-sm text-xs">
              <Key
                size={12}
                className={server.apiKeyConfigured ? 'text-success' : 'text-warning'}
              />
              <span className="text-text-secondary">{server.apiKeyEnvVar}:</span>
              {server.apiKeyConfigured ? (
                <span className="text-success flex items-center gap-xs">
                  <Check size={12} />
                  Configured
                </span>
              ) : (
                <span className="text-warning flex items-center gap-xs">
                  <AlertTriangle size={12} />
                  Not set
                </span>
              )}
              {/* API Key Actions */}
              {onSetApiKey && (
                <button
                  type="button"
                  onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                  className="text-xs text-accent hover:underline ml-auto"
                >
                  {server.apiKeyConfigured ? 'Update' : 'Add Key'}
                </button>
              )}
              {server.apiKeyConfigured && onDeleteApiKey && (
                <button
                  type="button"
                  onClick={handleDeleteApiKey}
                  disabled={isDeletingApiKey}
                  className="text-xs text-error hover:underline"
                >
                  {isDeletingApiKey ? <Loader2 size={10} className="animate-spin" /> : 'Remove'}
                </button>
              )}
            </div>

            {/* API Key Input Form */}
            {showApiKeyInput && (
              <div className="pt-xs">
                <div className="flex items-center gap-xs">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKeyValue}
                      onChange={(e) => setApiKeyValue(e.target.value)}
                      placeholder={`Enter ${server.apiKeyEnvVar} value...`}
                      className="input text-xs font-mono pr-8 w-full"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-text-secondary hover:text-text-primary"
                      aria-label={showApiKey ? 'Hide key' : 'Show key'}
                    >
                      {showApiKey ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleSetApiKey}
                    disabled={!apiKeyValue.trim() || isSettingApiKey}
                    className="btn btn-primary text-xs flex items-center gap-xs"
                  >
                    {isSettingApiKey ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <Check size={10} />
                    )}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowApiKeyInput(false);
                      setApiKeyValue('');
                      setShowApiKey(false);
                    }}
                    className="btn btn-secondary text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-sm border-t border-border">
        <div className="flex items-center gap-sm">
          {/* Test Connection */}
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting || !server.enabled}
            className="btn btn-secondary text-xs flex items-center gap-xs"
          >
            {isTesting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : testResult?.success ? (
              <CheckCircle size={12} className="text-success" />
            ) : testResult?.success === false ? (
              <XCircle size={12} className="text-error" />
            ) : (
              <Power size={12} />
            )}
            Test
          </button>

          {/* Edit */}
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(server)}
              className="btn btn-secondary text-xs"
              aria-label="Edit server"
            >
              <Pencil size={12} />
            </button>
          )}

          {/* Delete */}
          {showDeleteConfirm ? (
            <div className="flex items-center gap-xs">
              <span className="text-xs text-error">Delete?</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="btn btn-secondary text-xs bg-error/10 text-error hover:bg-error/20"
              >
                {isDeleting ? <Loader2 size={12} className="animate-spin" /> : 'Yes'}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="btn btn-secondary text-xs"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="btn btn-secondary text-xs text-error hover:bg-error/10"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>

        {/* External Link */}
        {server.description?.includes('http') && (
          <a
            href={server.description}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent hover:underline flex items-center gap-xs"
          >
            Docs
            <ExternalLink size={10} />
          </a>
        )}
      </div>

      {/* Test Result */}
      {testResult && (
        <div
          className={`mt-sm p-sm rounded text-xs flex items-center gap-sm ${
            testResult.success ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
          }`}
        >
          {testResult.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
          <div>
            {testResult.success ? (
              <span>
                Connected{testResult.serverName && ` to ${testResult.serverName}`}
                {testResult.latencyMs && ` (${testResult.latencyMs}ms)`}
              </span>
            ) : (
              <span>{testResult.error || 'Connection failed'}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
