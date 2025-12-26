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
    name: 'free-local',
    displayName: 'Free & Local',
    description: 'Free & Local - Ollama mxbai-embed-large (1024 dims)',
    provider: 'ollama',
    model: 'mxbai-embed-large',
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
    name: 'cheap',
    displayName: 'Cheap',
    description: 'Cheap - Voyage voyage-3.5-lite (1024 dims)',
    provider: 'voyage',
    model: 'voyage-3.5-lite',
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
    name: 'medium',
    displayName: 'Medium',
    description: 'Medium - Voyage voyage-3-large (1024 dims)',
    provider: 'voyage',
    model: 'voyage-3-large',
    chunkSize: 600,
    chunkOverlap: 100,
    codeAware: true,
    costTier: 'medium',
    isSystem: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'profile-4',
    name: 'high',
    displayName: 'High Quality',
    description: 'High Quality - Voyage voyage-3.5 (1024 dims)',
    provider: 'voyage',
    model: 'voyage-3.5',
    chunkSize: 600,
    chunkOverlap: 100,
    codeAware: true,
    costTier: 'high',
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

    expect(screen.getByText('Cheap')).toBeInTheDocument();
    expect(screen.getByText('voyage / voyage-3.5-lite')).toBeInTheDocument();
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
    expect(screen.getAllByText('Free & Local').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Cheap').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Medium').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('High Quality').length).toBeGreaterThanOrEqual(1);
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

    // Click on a different profile (find button containing "Cheap")
    const buttons = screen.getAllByRole('button');
    const cheapButton = buttons.find((b) => b.textContent?.includes('Cheap'));
    if (cheapButton) {
      fireEvent.click(cheapButton);
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

    // Cheap, Medium, and High Quality are code-aware
    const codeAwareIndicators = screen.getAllByText('Code-aware');
    expect(codeAwareIndicators.length).toBe(3);
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
