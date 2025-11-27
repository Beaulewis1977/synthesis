/**
 * EmbeddingProfileSelect Component Tests
 *
 * Phase 6: Tests for the embedding profile selector component.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EmbeddingProfile } from '../../types';
import { EmbeddingProfileSelect } from './EmbeddingProfileSelect';

const mockProfiles: EmbeddingProfile[] = [
  {
    id: 'profile-1',
    name: 'fast-cheap',
    displayName: 'Fast & Cheap',
    description: 'Local embedding with Ollama. Free and fast.',
    provider: 'ollama',
    model: 'nomic-embed-text',
    chunkSize: 1000,
    chunkOverlap: 150,
    codeAware: false,
    costTier: 'free',
    isSystem: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'profile-2',
    name: 'balanced',
    displayName: 'Balanced',
    description: 'OpenAI embeddings with code-aware chunking.',
    provider: 'openai',
    model: 'text-embedding-3-small',
    chunkSize: 800,
    chunkOverlap: 150,
    codeAware: true,
    costTier: 'low',
    isSystem: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'profile-3',
    name: 'high-accuracy',
    displayName: 'High Accuracy',
    description: 'Voyage embeddings optimized for code.',
    provider: 'voyage',
    model: 'voyage-code-2',
    chunkSize: 600,
    chunkOverlap: 100,
    codeAware: true,
    costTier: 'medium',
    isSystem: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

describe('EmbeddingProfileSelect', () => {
  it('renders the selected profile', () => {
    render(
      <EmbeddingProfileSelect
        profiles={mockProfiles}
        selectedId="profile-2"
        defaultProfileId="profile-2"
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText('Balanced')).toBeInTheDocument();
    expect(screen.getByText('openai / text-embedding-3-small')).toBeInTheDocument();
  });

  it('shows cost tier badge', () => {
    render(
      <EmbeddingProfileSelect
        profiles={mockProfiles}
        selectedId="profile-1"
        defaultProfileId="profile-1"
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('opens dropdown when clicked', () => {
    render(
      <EmbeddingProfileSelect
        profiles={mockProfiles}
        selectedId="profile-1"
        defaultProfileId="profile-1"
        onSelect={vi.fn()}
      />
    );

    // Initially only one button (the trigger)
    expect(screen.getAllByRole('button').length).toBe(1);

    // Click to open
    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Dropdown should be open (now we have multiple buttons - trigger + options)
    expect(screen.getAllByRole('button').length).toBeGreaterThan(1);
  });

  it('shows all profiles in dropdown', () => {
    render(
      <EmbeddingProfileSelect
        profiles={mockProfiles}
        selectedId="profile-1"
        defaultProfileId="profile-1"
        onSelect={vi.fn()}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByRole('button'));

    // All profiles should be visible (use getAllByText since selected profile appears twice)
    expect(screen.getAllByText('Fast & Cheap').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Balanced').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('High Accuracy').length).toBeGreaterThanOrEqual(1);
  });

  it('calls onSelect when a profile is clicked', () => {
    const onSelect = vi.fn();
    render(
      <EmbeddingProfileSelect
        profiles={mockProfiles}
        selectedId="profile-1"
        defaultProfileId="profile-1"
        onSelect={onSelect}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByRole('button'));

    // Click on a different profile (find button containing "Balanced")
    const buttons = screen.getAllByRole('button');
    const balancedButton = buttons.find((b) => b.textContent?.includes('Balanced'));
    if (balancedButton) {
      fireEvent.click(balancedButton);
    }

    expect(onSelect).toHaveBeenCalledWith('profile-2');
  });

  it('shows default indicator for default profile', () => {
    render(
      <EmbeddingProfileSelect
        profiles={mockProfiles}
        selectedId="profile-2"
        defaultProfileId="profile-2"
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText('(default)')).toBeInTheDocument();
  });

  it('shows profile details in dropdown', () => {
    render(
      <EmbeddingProfileSelect
        profiles={mockProfiles}
        selectedId="profile-1"
        defaultProfileId="profile-1"
        onSelect={vi.fn()}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByRole('button'));

    // Check for chunk size and overlap info (multiple profiles may have same values)
    expect(screen.getAllByText('Chunk: 1000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Overlap: \d+/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows code-aware indicator for code-aware profiles', () => {
    render(
      <EmbeddingProfileSelect
        profiles={mockProfiles}
        selectedId="profile-1"
        defaultProfileId="profile-1"
        onSelect={vi.fn()}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByRole('button'));

    // Balanced and High Accuracy are code-aware
    const codeAwareIndicators = screen.getAllByText('Code-aware');
    expect(codeAwareIndicators.length).toBe(2);
  });

  it('is disabled when disabled prop is true', () => {
    render(
      <EmbeddingProfileSelect
        profiles={mockProfiles}
        selectedId="profile-1"
        defaultProfileId="profile-1"
        onSelect={vi.fn()}
        disabled={true}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('closes dropdown when clicking outside', () => {
    render(
      <EmbeddingProfileSelect
        profiles={mockProfiles}
        selectedId="profile-1"
        defaultProfileId="profile-1"
        onSelect={vi.fn()}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getAllByRole('button').length).toBeGreaterThan(1);

    // Click the backdrop
    const backdrop = document.querySelector('.fixed.inset-0');
    if (backdrop) {
      fireEvent.click(backdrop);
    }

    // Dropdown should be closed (back to just the trigger button)
    expect(screen.getAllByRole('button').length).toBe(1);
  });
});
