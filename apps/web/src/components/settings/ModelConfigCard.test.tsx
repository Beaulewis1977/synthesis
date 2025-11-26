/**
 * ModelConfigCard Component Tests
 *
 * Phase 6: Tests for the model configuration card component.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ModelConfig, ProviderInfo } from '../../types';
import { ModelConfigCard } from './ModelConfigCard';

const mockConfig: ModelConfig = {
  feature: 'chat',
  provider: 'anthropic',
  model: 'claude-3-5-haiku-20241022',
  localOnly: false,
  enabled: true,
  source: 'default',
};

const mockProviders: Record<string, ProviderInfo> = {
  anthropic: {
    models: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'],
    requiresApiKey: true,
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    isLocal: false,
  },
  openai: {
    models: ['gpt-4o', 'gpt-4o-mini'],
    requiresApiKey: true,
    apiKeyEnvVar: 'OPENAI_API_KEY',
    isLocal: false,
  },
  ollama: {
    models: ['llama3.2', 'mistral'],
    requiresApiKey: false,
    isLocal: true,
  },
};

describe('ModelConfigCard', () => {
  it('renders the feature name and description', () => {
    render(
      <ModelConfigCard
        config={mockConfig}
        availableProviders={mockProviders}
        missingApiKeys={[]}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByText('Chat Agent')).toBeInTheDocument();
    expect(screen.getByText('Main conversational AI for answering questions')).toBeInTheDocument();
  });

  it('shows the current provider and model', () => {
    render(
      <ModelConfigCard
        config={mockConfig}
        availableProviders={mockProviders}
        missingApiKeys={[]}
        onUpdate={vi.fn()}
      />
    );

    const providerSelect = screen.getByLabelText('Provider') as HTMLSelectElement;
    const modelSelect = screen.getByLabelText('Model') as HTMLSelectElement;

    expect(providerSelect.value).toBe('anthropic');
    expect(modelSelect.value).toBe('claude-3-5-haiku-20241022');
  });

  it('shows config source indicator', () => {
    render(
      <ModelConfigCard
        config={mockConfig}
        availableProviders={mockProviders}
        missingApiKeys={[]}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByText('default')).toBeInTheDocument();
  });

  it('shows unsaved indicator when changes are made', () => {
    render(
      <ModelConfigCard
        config={mockConfig}
        availableProviders={mockProviders}
        missingApiKeys={[]}
        onUpdate={vi.fn()}
      />
    );

    // Initially no unsaved indicator
    expect(screen.queryByText('unsaved')).not.toBeInTheDocument();

    // Change the provider
    const providerSelect = screen.getByLabelText('Provider');
    fireEvent.change(providerSelect, { target: { value: 'openai' } });

    // Now should show unsaved
    expect(screen.getByText('unsaved')).toBeInTheDocument();
  });

  it('shows Save button when changes are made', () => {
    render(
      <ModelConfigCard
        config={mockConfig}
        availableProviders={mockProviders}
        missingApiKeys={[]}
        onUpdate={vi.fn()}
      />
    );

    // Initially no save button
    expect(screen.queryByText('Save Changes')).not.toBeInTheDocument();

    // Change the model
    const modelSelect = screen.getByLabelText('Model');
    fireEvent.change(modelSelect, { target: { value: 'claude-3-5-sonnet-20241022' } });

    // Now should show save button
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('calls onUpdate when Save is clicked', () => {
    const onUpdate = vi.fn();
    render(
      <ModelConfigCard
        config={mockConfig}
        availableProviders={mockProviders}
        missingApiKeys={[]}
        onUpdate={onUpdate}
      />
    );

    // Change the provider
    const providerSelect = screen.getByLabelText('Provider');
    fireEvent.change(providerSelect, { target: { value: 'openai' } });

    // Click save
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    expect(onUpdate).toHaveBeenCalledWith({
      provider: 'openai',
      model: 'gpt-4o', // First model of new provider
      localOnly: false,
    });
  });

  it('shows API key warning when key is missing', () => {
    render(
      <ModelConfigCard
        config={mockConfig}
        availableProviders={mockProviders}
        missingApiKeys={['anthropic']}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByText('API key required')).toBeInTheDocument();
    expect(screen.getByText('ANTHROPIC_API_KEY')).toBeInTheDocument();
  });

  it('filters providers when local-only is enabled', () => {
    const localOnlyConfig: ModelConfig = {
      ...mockConfig,
      localOnly: true,
      provider: 'ollama',
      model: 'llama3.2',
    };

    render(
      <ModelConfigCard
        config={localOnlyConfig}
        availableProviders={mockProviders}
        missingApiKeys={[]}
        onUpdate={vi.fn()}
      />
    );

    const providerSelect = screen.getByLabelText('Provider') as HTMLSelectElement;
    const options = Array.from(providerSelect.options).map((o) => o.value);

    // Should only show local providers
    expect(options).toContain('ollama');
    expect(options).not.toContain('anthropic');
    expect(options).not.toContain('openai');
  });

  it('shows error message when provided', () => {
    render(
      <ModelConfigCard
        config={mockConfig}
        availableProviders={mockProviders}
        missingApiKeys={[]}
        onUpdate={vi.fn()}
        error="Failed to update configuration"
      />
    );

    expect(screen.getByText('Failed to update configuration')).toBeInTheDocument();
  });

  it('disables inputs when updating', () => {
    render(
      <ModelConfigCard
        config={mockConfig}
        availableProviders={mockProviders}
        missingApiKeys={[]}
        onUpdate={vi.fn()}
        isUpdating={true}
      />
    );

    const providerSelect = screen.getByLabelText('Provider') as HTMLSelectElement;
    const modelSelect = screen.getByLabelText('Model') as HTMLSelectElement;
    const localOnlyCheckbox = screen.getByLabelText('Local only') as HTMLInputElement;

    expect(providerSelect.disabled).toBe(true);
    expect(modelSelect.disabled).toBe(true);
    expect(localOnlyCheckbox.disabled).toBe(true);
  });
});
