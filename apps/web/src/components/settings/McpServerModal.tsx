/**
 * McpServerModal Component
 *
 * Modal for adding or editing an external MCP server configuration.
 * Supports presets (Perplexity, Brave Search), custom configurations,
 * and "Refresh from Preset" for updating existing preset-based servers.
 */

import { AlertTriangle, Loader2, Plus, RefreshCw, Save, Server, X, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  CreateMcpServerInput,
  McpServerPreset,
  McpServerResponse,
  McpServerType,
  McpStdioConfig,
  UpdateMcpServerInput,
} from '../../types';

interface McpServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: CreateMcpServerInput) => Promise<void>;
  onUpdate?: (id: string, data: UpdateMcpServerInput) => Promise<void>;
  presets: McpServerPreset[];
  /** If provided, modal opens in edit mode */
  server?: McpServerResponse;
  isSubmitting?: boolean;
  error?: string | null;
}

export function McpServerModal({
  isOpen,
  onClose,
  onAdd,
  onUpdate,
  presets,
  server,
  isSubmitting = false,
  error = null,
}: McpServerModalProps) {
  const isEditMode = !!server;

  // Find matching preset for this server (if any)
  const matchingPreset = server ? presets.find((p) => p.name === server.name) : null;

  const [mode, setMode] = useState<'preset' | 'custom'>('preset');
  const [selectedPreset, setSelectedPreset] = useState<McpServerPreset | null>(null);

  // Custom form state
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [serverType, setServerType] = useState<McpServerType>('stdio');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [apiKeyEnvVar, setApiKeyEnvVar] = useState('');
  const [description, setDescription] = useState('');

  // Populate form when editing
  useEffect(() => {
    if (server) {
      setMode('custom'); // Edit mode always shows custom form
      setName(server.name);
      setDisplayName(server.displayName || '');
      setServerType(server.serverType);
      const config = server.config as McpStdioConfig;
      setCommand(config.command || '');
      setArgs(config.args?.join(' ') || '');
      setApiKeyEnvVar(server.apiKeyEnvVar || '');
      setDescription(server.description || '');
    }
  }, [server]);

  const resetForm = () => {
    setMode('preset');
    setSelectedPreset(null);
    setName('');
    setDisplayName('');
    setServerType('stdio');
    setCommand('');
    setArgs('');
    setApiKeyEnvVar('');
    setDescription('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleAddPreset = async () => {
    if (!selectedPreset) return;

    try {
      await onAdd({
        name: selectedPreset.name,
        displayName: selectedPreset.displayName,
        serverType: selectedPreset.serverType,
        config: selectedPreset.config,
        apiKeyEnvVar: selectedPreset.apiKeyEnvVar,
        description: selectedPreset.description,
        enabled: true,
      });
      handleClose();
    } catch (error) {
      console.error('Failed to add MCP server from preset', error);
    }
  };

  const handleAddCustom = async () => {
    const config: McpStdioConfig = {
      command: command.trim(),
      args: args
        .trim()
        .split(/\s+/)
        .filter((a) => a.length > 0),
    };

    try {
      await onAdd({
        name: name.trim().toLowerCase().replace(/\s+/g, '-'),
        displayName: displayName.trim() || undefined,
        serverType,
        config,
        apiKeyEnvVar: apiKeyEnvVar.trim() || undefined,
        description: description.trim() || undefined,
        enabled: true,
      });
      handleClose();
    } catch (error) {
      console.error('Failed to add custom MCP server', error);
    }
  };

  const handleUpdate = async () => {
    if (!server || !onUpdate) return;

    const config: McpStdioConfig = {
      command: command.trim(),
      args: args
        .trim()
        .split(/\s+/)
        .filter((a) => a.length > 0),
    };

    try {
      await onUpdate(server.id, {
        displayName: displayName.trim() || null,
        serverType,
        config,
        apiKeyEnvVar: apiKeyEnvVar.trim() || null,
        description: description.trim() || null,
      });
      handleClose();
    } catch (error) {
      console.error('Failed to update MCP server', error);
    }
  };

  const handleRefreshFromPreset = async () => {
    if (!server || !onUpdate || !matchingPreset) return;

    try {
      await onUpdate(server.id, {
        displayName: matchingPreset.displayName,
        serverType: matchingPreset.serverType,
        config: matchingPreset.config,
        apiKeyEnvVar: matchingPreset.apiKeyEnvVar,
        description: matchingPreset.description,
      });
      handleClose();
    } catch (error) {
      console.error('Failed to refresh MCP server from preset', error);
    }
  };

  const handleSubmit = async () => {
    if (isEditMode) {
      await handleUpdate();
    } else if (mode === 'preset') {
      await handleAddPreset();
    } else {
      await handleAddCustom();
    }
  };

  const requiresCommand = serverType === 'stdio';
  const canSubmit = isEditMode
    ? requiresCommand
      ? command.trim().length > 0
      : true
    : mode === 'preset'
      ? selectedPreset !== null
      : name.trim().length > 0 && (!requiresCommand || command.trim().length > 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
        onKeyDown={(e) => e.key === 'Escape' && handleClose()}
        role="button"
        tabIndex={0}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div className="relative bg-surface border border-border rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-md border-b border-border">
          <div className="flex items-center gap-sm">
            <Server size={20} className="text-accent" />
            <h2 className="font-semibold text-text-primary">
              {isEditMode ? 'Edit MCP Server' : 'Add MCP Server'}
            </h2>
            {matchingPreset && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                Preset: {matchingPreset.displayName}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 text-text-secondary hover:text-text-primary rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-md overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Mode Tabs (only in add mode) */}
          {!isEditMode && (
            <div className="flex gap-sm mb-md">
              <button
                type="button"
                onClick={() => setMode('preset')}
                className={`flex-1 py-sm px-md rounded text-sm font-medium transition-colors ${
                  mode === 'preset'
                    ? 'bg-accent text-white'
                    : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                }`}
              >
                <Zap size={14} className="inline mr-xs" />
                Quick Add
              </button>
              <button
                type="button"
                onClick={() => setMode('custom')}
                className={`flex-1 py-sm px-md rounded text-sm font-medium transition-colors ${
                  mode === 'custom'
                    ? 'bg-accent text-white'
                    : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                }`}
              >
                <Plus size={14} className="inline mr-xs" />
                Custom
              </button>
            </div>
          )}

          {/* Refresh from Preset Button (edit mode + preset match) */}
          {isEditMode && matchingPreset && (
            <div className="mb-md p-sm bg-accent/5 border border-accent/20 rounded">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">Preset Available</p>
                  <p className="text-xs text-text-secondary">
                    Update this server with the latest preset configuration
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRefreshFromPreset}
                  disabled={isSubmitting}
                  className="btn btn-secondary text-xs flex items-center gap-xs"
                >
                  {isSubmitting ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  Refresh from Preset
                </button>
              </div>
            </div>
          )}

          {/* Preset Selection (add mode only) */}
          {!isEditMode && mode === 'preset' && (
            <div className="space-y-sm">
              <p className="text-sm text-text-secondary mb-sm">
                Select a pre-configured MCP server to add:
              </p>
              {presets.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setSelectedPreset(preset)}
                  className={`w-full p-sm rounded border text-left transition-all ${
                    selectedPreset?.name === preset.name
                      ? 'border-accent bg-accent/10'
                      : 'border-border bg-surface hover:border-border-hover hover:bg-bg-secondary'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-text-primary">{preset.displayName}</span>
                      <p className="text-xs text-text-secondary mt-xs">{preset.description}</p>
                    </div>
                    {preset.apiKeyEnvVar && (
                      <span className="text-xs text-warning bg-warning/10 px-1.5 py-0.5 rounded">
                        Needs API Key
                      </span>
                    )}
                  </div>
                  {selectedPreset?.name === preset.name && (
                    <div className="mt-sm pt-sm border-t border-border">
                      <code className="text-xs text-text-secondary font-mono block">
                        {(preset.config as McpStdioConfig).command}{' '}
                        {(preset.config as McpStdioConfig).args?.join(' ')}
                      </code>
                      {preset.apiKeyEnvVar && (
                        <p className="text-xs text-text-secondary mt-xs">
                          Requires:{' '}
                          <code className="bg-bg-secondary px-1 rounded">
                            {preset.apiKeyEnvVar}
                          </code>
                        </p>
                      )}
                    </div>
                  )}
                </button>
              ))}
              {presets.length === 0 && (
                <div className="text-center py-md text-text-secondary">No presets available.</div>
              )}
            </div>
          )}

          {/* Custom Form (add custom mode or edit mode) */}
          {((!isEditMode && mode === 'custom') || isEditMode) && (
            <div className="space-y-md">
              {/* Name (read-only in edit mode) */}
              <div>
                <label
                  htmlFor="mcp-name"
                  className="block text-sm font-medium text-text-primary mb-xs"
                >
                  Name {!isEditMode && <span className="text-error">*</span>}
                </label>
                <input
                  id="mcp-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-mcp-server"
                  className="input text-sm"
                  disabled={isEditMode}
                />
                <p className="text-xs text-text-secondary mt-xs">
                  {isEditMode
                    ? 'Name cannot be changed'
                    : 'Unique identifier (lowercase, dashes allowed)'}
                </p>
              </div>

              {/* Display Name */}
              <div>
                <label
                  htmlFor="mcp-display-name"
                  className="block text-sm font-medium text-text-primary mb-xs"
                >
                  Display Name
                </label>
                <input
                  id="mcp-display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="My MCP Server"
                  className="input text-sm"
                />
              </div>

              {/* Server Type */}
              <div>
                <label
                  htmlFor="mcp-server-type"
                  className="block text-sm font-medium text-text-primary mb-xs"
                >
                  Server Type
                </label>
                <select
                  id="mcp-server-type"
                  value={serverType}
                  onChange={(e) => setServerType(e.target.value as McpServerType)}
                  className="input text-sm"
                >
                  <option value="stdio">stdio (local process)</option>
                  <option value="sse">sse (Server-Sent Events)</option>
                  <option value="http">http (REST API)</option>
                </select>
              </div>

              {/* Command (for stdio) */}
              {serverType === 'stdio' && (
                <>
                  <div>
                    <label
                      htmlFor="mcp-command"
                      className="block text-sm font-medium text-text-primary mb-xs"
                    >
                      Command <span className="text-error">*</span>
                    </label>
                    <input
                      id="mcp-command"
                      type="text"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      placeholder="npx"
                      className="input text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="mcp-args"
                      className="block text-sm font-medium text-text-primary mb-xs"
                    >
                      Arguments
                    </label>
                    <input
                      id="mcp-args"
                      type="text"
                      value={args}
                      onChange={(e) => setArgs(e.target.value)}
                      placeholder="-y @some/mcp-server"
                      className="input text-sm font-mono"
                    />
                    <p className="text-xs text-text-secondary mt-xs">Space-separated arguments</p>
                  </div>
                </>
              )}

              {/* API Key Env Var */}
              <div>
                <label
                  htmlFor="mcp-api-key-env"
                  className="block text-sm font-medium text-text-primary mb-xs"
                >
                  API Key Environment Variable
                </label>
                <input
                  id="mcp-api-key-env"
                  type="text"
                  value={apiKeyEnvVar}
                  onChange={(e) => setApiKeyEnvVar(e.target.value)}
                  placeholder="MY_API_KEY"
                  className="input text-sm font-mono"
                />
                <p className="text-xs text-text-secondary mt-xs">
                  If the server requires an API key
                </p>
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="mcp-description"
                  className="block text-sm font-medium text-text-primary mb-xs"
                >
                  Description
                </label>
                <textarea
                  id="mcp-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this server do?"
                  className="input text-sm resize-none"
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-md p-sm bg-error/10 border border-error/30 rounded text-xs text-error flex items-center gap-sm">
              <AlertTriangle size={14} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-sm p-md border-t border-border">
          <button type="button" onClick={handleClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="btn btn-primary flex items-center gap-xs"
          >
            {isSubmitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isEditMode ? (
              <Save size={14} />
            ) : (
              <Plus size={14} />
            )}
            {isEditMode ? 'Save Changes' : 'Add Server'}
          </button>
        </div>
      </div>
    </div>
  );
}
