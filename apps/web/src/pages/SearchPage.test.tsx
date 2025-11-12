import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../lib/api';
import { SearchPage } from './SearchPage';

// Mock API client
vi.mock('../lib/api', () => ({
  apiClient: {
    performSearch: vi.fn(),
  },
}));

const createWrapper = (initialEntries: string[] = ['/collections/col-123/search?q=test']) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/collections/:collectionId/search" element={children} />
          <Route path="/collections/:collectionId" element={<div>Collection Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('SearchPage - Tech Stack Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders tech stack filter chips', () => {
    vi.mocked(api.apiClient.performSearch).mockResolvedValue({
      query: 'test',
      results: [],
      total_results: 0,
      search_time_ms: 50,
    });

    render(<SearchPage />, {
      wrapper: createWrapper(['/collections/col-123/search?q=test']),
    });

    expect(screen.getByText('Filter by tech stack:')).toBeInTheDocument();
    expect(screen.getByText('postgres')).toBeInTheDocument();
    expect(screen.getByText('supabase')).toBeInTheDocument();
    expect(screen.getByText('redis')).toBeInTheDocument();
    expect(screen.getByText('flutter')).toBeInTheDocument();
    expect(screen.getByText('typescript')).toBeInTheDocument();
  });

  it('toggles chip selection on click', async () => {
    const user = userEvent.setup();
    vi.mocked(api.apiClient.performSearch).mockResolvedValue({
      query: 'test',
      results: [],
      total_results: 0,
      search_time_ms: 50,
    });

    render(<SearchPage />, {
      wrapper: createWrapper(['/collections/col-123/search?q=test']),
    });

    const postgresChip = screen.getByRole('button', { name: 'postgres' });

    // Initially unselected
    expect(postgresChip).not.toHaveClass('bg-accent');

    // Click to select
    await user.click(postgresChip);
    expect(postgresChip).toHaveClass('bg-accent');

    // Click to deselect
    await user.click(postgresChip);
    expect(postgresChip).not.toHaveClass('bg-accent');
  });

  it('loads tags from URL on mount', () => {
    vi.mocked(api.apiClient.performSearch).mockResolvedValue({
      query: 'test',
      results: [],
      total_results: 0,
      search_time_ms: 50,
    });

    render(<SearchPage />, {
      wrapper: createWrapper([
        '/collections/col-123/search?q=test&tech_stack=postgres&tech_stack=redis',
      ]),
    });

    const postgresChip = screen.getByRole('button', { name: 'postgres' });
    const redisChip = screen.getByRole('button', { name: 'redis' });
    const flutterChip = screen.getByRole('button', { name: 'flutter' });

    expect(postgresChip).toHaveClass('bg-accent');
    expect(redisChip).toHaveClass('bg-accent');
    expect(flutterChip).not.toHaveClass('bg-accent');
  });

  it('includes tech_stack in API request when tags selected', async () => {
    const mockPerformSearch = vi.mocked(api.apiClient.performSearch);
    mockPerformSearch.mockResolvedValue({
      query: 'test',
      results: [],
      total_results: 0,
      search_time_ms: 50,
    });

    render(<SearchPage />, {
      wrapper: createWrapper([
        '/collections/col-123/search?q=test&tech_stack=postgres&tech_stack=redis',
      ]),
    });

    await waitFor(() => {
      expect(mockPerformSearch).toHaveBeenCalledWith('test', 'col-123', 10, ['postgres', 'redis']);
    });
  });

  it('omits tech_stack from API request when no tags selected', async () => {
    const mockPerformSearch = vi.mocked(api.apiClient.performSearch);
    mockPerformSearch.mockResolvedValue({
      query: 'test',
      results: [],
      total_results: 0,
      search_time_ms: 50,
    });

    render(<SearchPage />, {
      wrapper: createWrapper(['/collections/col-123/search?q=test']),
    });

    await waitFor(() => {
      expect(mockPerformSearch).toHaveBeenCalledWith('test', 'col-123', 10, undefined);
    });
  });

  it('refetches when tags are toggled', async () => {
    const user = userEvent.setup();
    const mockPerformSearch = vi.mocked(api.apiClient.performSearch);
    mockPerformSearch.mockResolvedValue({
      query: 'test',
      results: [],
      total_results: 0,
      search_time_ms: 50,
    });

    render(<SearchPage />, {
      wrapper: createWrapper(['/collections/col-123/search?q=test']),
    });

    // Initial call without tags
    await waitFor(() => {
      expect(mockPerformSearch).toHaveBeenCalledWith('test', 'col-123', 10, undefined);
    });

    mockPerformSearch.mockClear();

    // Click postgres chip
    const postgresChip = screen.getByRole('button', { name: 'postgres' });
    await user.click(postgresChip);

    // Should refetch with postgres tag
    await waitFor(() => {
      expect(mockPerformSearch).toHaveBeenCalledWith('test', 'col-123', 10, ['postgres']);
    });
  });

  it('displays filtered tech stacks in result summary', async () => {
    vi.mocked(api.apiClient.performSearch).mockResolvedValue({
      query: 'test',
      results: [],
      total_results: 42,
      search_time_ms: 123,
    });

    render(<SearchPage />, {
      wrapper: createWrapper([
        '/collections/col-123/search?q=test&tech_stack=postgres&tech_stack=typescript',
      ]),
    });

    await waitFor(() => {
      expect(screen.getByText(/Found 42 results in 123ms/)).toBeInTheDocument();
      expect(screen.getByText(/filtered by: postgres, typescript/)).toBeInTheDocument();
    });
  });

  it('does not display filter info when no tags selected', async () => {
    vi.mocked(api.apiClient.performSearch).mockResolvedValue({
      query: 'test',
      results: [],
      total_results: 42,
      search_time_ms: 123,
    });

    render(<SearchPage />, {
      wrapper: createWrapper(['/collections/col-123/search?q=test']),
    });

    await waitFor(() => {
      expect(screen.getByText(/Found 42 results in 123ms/)).toBeInTheDocument();
      expect(screen.queryByText(/filtered by:/)).not.toBeInTheDocument();
    });
  });

  it('preserves tags when performing new search', async () => {
    const user = userEvent.setup();
    const mockPerformSearch = vi.mocked(api.apiClient.performSearch);
    mockPerformSearch.mockResolvedValue({
      query: 'test',
      results: [],
      total_results: 0,
      search_time_ms: 50,
    });

    render(<SearchPage />, {
      wrapper: createWrapper([
        '/collections/col-123/search?q=test&tech_stack=postgres&tech_stack=redis',
      ]),
    });

    // Clear and enter new search query
    const searchInput = screen.getByPlaceholderText(/Search for code/i);
    await user.clear(searchInput);
    await user.type(searchInput, 'new query');

    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);

    await waitFor(() => {
      expect(mockPerformSearch).toHaveBeenCalledWith('new query', 'col-123', 10, [
        'postgres',
        'redis',
      ]);
    });
  });
});
