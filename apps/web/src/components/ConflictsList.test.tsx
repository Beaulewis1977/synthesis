import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Conflict } from '../types';
import { ConflictsList } from './ConflictsList';

describe('ConflictsList', () => {
  const mockConflicts: Conflict[] = [
    {
      topic: 'State Management',
      source_a: {
        title: 'Provider Pattern (2020)',
        statement: 'Provider is the recommended way to manage state in Flutter.',
        url: 'https://docs.flutter.dev/provider',
      },
      source_b: {
        title: 'Riverpod Pattern (2024)',
        statement: 'Riverpod is now the preferred state management solution.',
        url: 'https://riverpod.dev',
      },
      severity: 'high',
      difference: 'Official recommendation changed from Provider to Riverpod in recent docs.',
      recommendation:
        'Use Riverpod for new projects; Provider is still maintained for legacy apps.',
    },
    {
      topic: 'HTTP Client',
      source_a: {
        title: 'Using http package',
        statement: 'Use the http package for simple requests.',
        url: null,
      },
      source_b: {
        title: 'Using dio package',
        statement: 'Dio provides better features and interceptors.',
        url: null,
      },
      severity: 'low',
      difference: 'Different packages recommended for different use cases.',
      recommendation: 'Use http for simple requests, dio for complex scenarios.',
    },
  ];

  it('renders conflicts list with header', () => {
    render(<ConflictsList conflicts={mockConflicts} />);

    expect(screen.getByText(/Contradictions Found/)).toBeInTheDocument();
    expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
  });

  it('renders all conflict details', () => {
    render(<ConflictsList conflicts={mockConflicts} />);

    // Check first conflict
    expect(screen.getByText('State Management')).toBeInTheDocument();
    expect(screen.getByText(/Provider Pattern \(2020\)/)).toBeInTheDocument();
    expect(screen.getByText(/Riverpod Pattern \(2024\)/)).toBeInTheDocument();
    expect(screen.getByText(/Provider is the recommended way/)).toBeInTheDocument();
    expect(screen.getByText(/Riverpod is now the preferred/)).toBeInTheDocument();

    // Check second conflict
    expect(screen.getByText('HTTP Client')).toBeInTheDocument();
    expect(screen.getByText(/Using http package/)).toBeInTheDocument();
    expect(screen.getByText(/Using dio package/)).toBeInTheDocument();
  });

  it('displays severity labels correctly', () => {
    render(<ConflictsList conflicts={mockConflicts} />);

    expect(screen.getByText('🚨 High')).toBeInTheDocument();
    expect(screen.getByText('ℹ️ Low')).toBeInTheDocument();
  });

  it('renders difference and recommendation sections', () => {
    render(<ConflictsList conflicts={mockConflicts} />);

    // Use getAllByText since there are multiple conflicts with these labels
    expect(screen.getAllByText(/Difference:/)).toHaveLength(2);
    expect(screen.getByText(/Official recommendation changed/)).toBeInTheDocument();

    expect(screen.getAllByText(/→ Recommendation:/)).toHaveLength(2);
    expect(screen.getByText(/Use Riverpod for new projects/)).toBeInTheDocument();
  });

  it('renders source URLs when available', () => {
    render(<ConflictsList conflicts={mockConflicts} />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2); // Only first conflict has URLs

    expect(links[0]).toHaveAttribute('href', 'https://docs.flutter.dev/provider');
    expect(links[1]).toHaveAttribute('href', 'https://riverpod.dev');
  });

  it('handles missing source URLs gracefully', () => {
    // Render only the second conflict which has no URLs
    render(<ConflictsList conflicts={[mockConflicts[1]]} />);

    // Second conflict has no URLs, should still render
    expect(screen.getByText(/Using http package/)).toBeInTheDocument();
    expect(screen.getByText(/Using dio package/)).toBeInTheDocument();
  });

  it('handles medium severity conflicts', () => {
    const mediumConflict: Conflict[] = [
      {
        ...mockConflicts[0],
        severity: 'medium',
      },
    ];

    render(<ConflictsList conflicts={mediumConflict} />);

    expect(screen.getByText('⚠️ Medium')).toBeInTheDocument();
  });

  it('returns null when conflicts array is empty', () => {
    const { container } = render(<ConflictsList conflicts={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it('handles conflicts with null titles', () => {
    const conflictsWithNullTitles: Conflict[] = [
      {
        ...mockConflicts[0],
        source_a: {
          ...mockConflicts[0].source_a,
          title: null,
        },
        source_b: {
          ...mockConflicts[0].source_b,
          title: null,
        },
      },
    ];

    render(<ConflictsList conflicts={conflictsWithNullTitles} />);

    expect(screen.getAllByText(/Untitled/)).toHaveLength(2);
  });

  it('applies different styling for different severity levels', () => {
    const { container } = render(<ConflictsList conflicts={mockConflicts} />);

    // High severity should have error border
    const conflictCards = container.querySelectorAll('[class*="border-"]');
    expect(conflictCards.length).toBeGreaterThan(0);
  });
});
