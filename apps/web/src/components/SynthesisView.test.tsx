import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiClient } from '../lib/api';
import type { SynthesisResponse } from '../types';
import { SynthesisView } from './SynthesisView';

// Mock the API client
vi.mock('../lib/api', () => ({
  apiClient: {
    synthesizeResults: vi.fn(),
  },
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('SynthesisView', () => {
  const mockSynthesisResponse: SynthesisResponse = {
    query: 'How to implement authentication in Flutter?',
    approaches: [
      {
        method: 'Firebase Authentication',
        topic: 'User Authentication',
        summary: 'Firebase Auth provides complete authentication with social providers.',
        consensusScore: 0.9,
        sources: [
          {
            docId: 'doc-1',
            docTitle: 'Firebase Docs',
            sourceUrl: 'https://firebase.google.com',
            snippet: 'Firebase Authentication documentation',
            metadata: null,
          },
        ],
      },
      {
        method: 'Supabase Authentication',
        topic: 'User Authentication',
        summary: 'Supabase provides open-source authentication.',
        consensusScore: 0.75,
        sources: [
          {
            docId: 'doc-2',
            docTitle: 'Supabase Docs',
            sourceUrl: 'https://supabase.com',
            snippet: 'Supabase authentication guide',
            metadata: null,
          },
        ],
      },
    ],
    conflicts: [
      {
        topic: 'Best Practice',
        source_a: {
          title: 'Firebase Guide',
          statement: 'Use Firebase for production.',
          url: 'https://firebase.google.com',
        },
        source_b: {
          title: 'Supabase Guide',
          statement: 'Use Supabase for production.',
          url: 'https://supabase.com',
        },
        severity: 'medium',
        difference: 'Different recommendations for production use.',
        recommendation: 'Choose based on your needs.',
      },
    ],
    recommended: {
      method: 'Firebase Authentication',
      topic: 'User Authentication',
      summary: 'Firebase Auth provides complete authentication with social providers.',
      consensusScore: 0.9,
      sources: [
        {
          docId: 'doc-1',
          docTitle: 'Firebase Docs',
          sourceUrl: 'https://firebase.google.com',
          snippet: 'Firebase Authentication documentation',
          metadata: null,
        },
      ],
    },
    metadata: {
      total_sources: 15,
      approaches_found: 2,
      conflicts_found: 1,
      synthesis_time_ms: 450,
    },
  };

  it('shows loading state initially', () => {
    vi.mocked(apiClient.synthesizeResults).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithQueryClient(<SynthesisView query="test query" collectionId="test-collection" />);

    expect(screen.getByText(/Analyzing sources/)).toBeInTheDocument();
  });

  it('renders synthesis results successfully', async () => {
    vi.mocked(apiClient.synthesizeResults).mockResolvedValue(mockSynthesisResponse);

    renderWithQueryClient(<SynthesisView query="test query" collectionId="test-collection" />);

    await waitFor(() => {
      expect(screen.getByText('sources analyzed')).toBeInTheDocument();
    });

    // Check metadata values are displayed
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('450ms')).toBeInTheDocument();

    // Check section headings
    expect(screen.getByText('Approaches')).toBeInTheDocument();
  });

  it('renders all approaches', async () => {
    vi.mocked(apiClient.synthesizeResults).mockResolvedValue(mockSynthesisResponse);

    renderWithQueryClient(<SynthesisView query="test query" collectionId="test-collection" />);

    await waitFor(() => {
      expect(screen.getByText('Firebase Authentication')).toBeInTheDocument();
    });

    expect(screen.getByText('Supabase Authentication')).toBeInTheDocument();
  });

  it('marks recommended approach correctly', async () => {
    vi.mocked(apiClient.synthesizeResults).mockResolvedValue(mockSynthesisResponse);

    renderWithQueryClient(<SynthesisView query="test query" collectionId="test-collection" />);

    await waitFor(() => {
      expect(screen.getByText('✓ Recommended')).toBeInTheDocument();
    });
  });

  it('renders conflicts list when conflicts exist', async () => {
    vi.mocked(apiClient.synthesizeResults).mockResolvedValue(mockSynthesisResponse);

    renderWithQueryClient(<SynthesisView query="test query" collectionId="test-collection" />);

    await waitFor(() => {
      expect(screen.getByText(/Contradictions Found/)).toBeInTheDocument();
    });

    expect(screen.getByText('Best Practice')).toBeInTheDocument();
  });

  it('handles error state with retry button', async () => {
    const errorMessage = 'Failed to fetch synthesis';
    vi.mocked(apiClient.synthesizeResults).mockRejectedValue(new Error(errorMessage));

    renderWithQueryClient(<SynthesisView query="test query" collectionId="test-collection" />);

    await waitFor(
      () => {
        expect(screen.getByText('Synthesis Failed')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('handles 404 error (feature disabled)', async () => {
    vi.mocked(apiClient.synthesizeResults).mockRejectedValue(
      new Error('Request failed with status 404')
    );

    renderWithQueryClient(<SynthesisView query="test query" collectionId="test-collection" />);

    await waitFor(
      () => {
        expect(screen.getByText('Synthesis Feature Disabled')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(screen.getByText(/ENABLE_SYNTHESIS=true/)).toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('handles empty results', async () => {
    const emptyResponse: SynthesisResponse = {
      query: 'test',
      approaches: [],
      conflicts: [],
      recommended: null,
      metadata: {
        total_sources: 0,
        approaches_found: 0,
        conflicts_found: 0,
        synthesis_time_ms: 50,
      },
    };

    vi.mocked(apiClient.synthesizeResults).mockResolvedValue(emptyResponse);

    renderWithQueryClient(<SynthesisView query="test query" collectionId="test-collection" />);

    await waitFor(
      () => {
        expect(screen.getByText('No approaches found')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(screen.getByText(/Try refining your query/)).toBeInTheDocument();
  });

  it('does not render conflicts section when no conflicts', async () => {
    const noConflictsResponse: SynthesisResponse = {
      ...mockSynthesisResponse,
      conflicts: [],
      metadata: {
        ...mockSynthesisResponse.metadata,
        conflicts_found: 0,
      },
    };

    vi.mocked(apiClient.synthesizeResults).mockResolvedValue(noConflictsResponse);

    renderWithQueryClient(<SynthesisView query="test query" collectionId="test-collection" />);

    await waitFor(() => {
      expect(screen.getByText('Firebase Authentication')).toBeInTheDocument();
    });

    expect(screen.queryByText(/Contradictions Found/)).not.toBeInTheDocument();
  });

  it('uses top_k=15 for API call', async () => {
    vi.mocked(apiClient.synthesizeResults).mockResolvedValue(mockSynthesisResponse);

    renderWithQueryClient(<SynthesisView query="test query" collectionId="test-collection-123" />);

    await waitFor(
      () => {
        expect(apiClient.synthesizeResults).toHaveBeenCalledWith(
          'test query',
          'test-collection-123',
          15
        );
      },
      { timeout: 3000 }
    );
  });
});
