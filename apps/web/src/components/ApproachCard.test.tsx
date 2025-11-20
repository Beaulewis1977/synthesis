import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Approach } from '../types';
import { ApproachCard } from './ApproachCard';

describe('ApproachCard', () => {
  const mockApproach: Approach = {
    method: 'Firebase Authentication',
    topic: 'User Authentication',
    summary:
      'Firebase Auth provides a complete authentication solution with support for email/password, social providers, and phone authentication.',
    consensusScore: 0.85,
    sources: [
      {
        docId: 'doc-1',
        docTitle: 'Firebase Official Docs',
        sourceUrl: 'https://firebase.google.com/docs/auth',
        snippet: 'Firebase Authentication provides backend services to authenticate users.',
        metadata: { source_quality: 'official' },
      },
      {
        docId: 'doc-2',
        docTitle: 'Community Tutorial',
        sourceUrl: null,
        snippet: 'A comprehensive guide to implementing Firebase Auth.',
        metadata: null,
      },
    ],
  };

  it('renders approach details correctly', () => {
    render(<ApproachCard approach={mockApproach} isRecommended={false} />);

    expect(screen.getByText('Firebase Authentication')).toBeInTheDocument();
    expect(screen.getByText('User Authentication')).toBeInTheDocument();
    expect(screen.getByText(/Firebase Auth provides/)).toBeInTheDocument();
    expect(screen.getByText('2 sources')).toBeInTheDocument();
  });

  it('shows correct star rating based on consensus score', () => {
    render(<ApproachCard approach={mockApproach} isRecommended={false} />);

    // 0.85 * 5 = 4.25, rounds to 4 stars
    const stars = screen.getByTitle(/Consensus: 85%/);
    expect(stars.textContent).toContain('⭐⭐⭐⭐');
    expect(stars.textContent).toContain('☆');
  });

  it('displays recommended badge when isRecommended is true', () => {
    render(<ApproachCard approach={mockApproach} isRecommended={true} />);

    expect(screen.getByText('✓ Recommended')).toBeInTheDocument();
  });

  it('does not display recommended badge when isRecommended is false', () => {
    render(<ApproachCard approach={mockApproach} isRecommended={false} />);

    expect(screen.queryByText('✓ Recommended')).not.toBeInTheDocument();
  });

  it('renders expandable sources list', () => {
    render(<ApproachCard approach={mockApproach} isRecommended={false} />);

    const summary = screen.getByText('View 2 sources');
    expect(summary).toBeInTheDocument();
  });

  it('shows all source details when expanded', () => {
    const { container } = render(<ApproachCard approach={mockApproach} isRecommended={false} />);

    // Expand the details
    const details = container.querySelector('details');
    expect(details).toBeInTheDocument();

    // Check that sources are in the DOM (even if hidden)
    expect(screen.getByText('Firebase Official Docs')).toBeInTheDocument();
    expect(screen.getByText('Community Tutorial')).toBeInTheDocument();
  });

  it('handles single source correctly', () => {
    const singleSourceApproach: Approach = {
      ...mockApproach,
      sources: [mockApproach.sources[0]],
    };

    render(<ApproachCard approach={singleSourceApproach} isRecommended={false} />);

    expect(screen.getByText('1 source')).toBeInTheDocument();
    expect(screen.getByText('View 1 source')).toBeInTheDocument();
  });

  it('handles missing source URLs gracefully', () => {
    render(<ApproachCard approach={mockApproach} isRecommended={false} />);

    const links = screen.getAllByRole('link');
    // Only one source has a URL
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', 'https://firebase.google.com/docs/auth');
  });

  it('displays untitled document when docTitle is null', () => {
    const approachWithNoTitle: Approach = {
      ...mockApproach,
      sources: [
        {
          ...mockApproach.sources[0],
          docTitle: null,
        },
      ],
    };

    render(<ApproachCard approach={approachWithNoTitle} isRecommended={false} />);

    expect(screen.getByText('Untitled Document')).toBeInTheDocument();
  });

  it('does not show topic when it matches method', () => {
    const approachSameTopic: Approach = {
      ...mockApproach,
      topic: 'Firebase Authentication', // Same as method
    };

    render(<ApproachCard approach={approachSameTopic} isRecommended={false} />);

    // Method should appear once
    const methodElements = screen.getAllByText('Firebase Authentication');
    expect(methodElements).toHaveLength(1);
  });
});
