import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as api from '../lib/api';
import { CostDashboard } from './CostDashboard';

// Mock the API client
vi.mock('../lib/api', () => ({
  apiClient: {
    getCostSummary: vi.fn(),
    getCostAlerts: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchInterval: false, // Disable auto-refetch for tests
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('CostDashboard', () => {
  const mockCostData = {
    current_spend: 5.25,
    budget: 10,
    percentage_used: 52.5,
    remaining: 4.75,
    breakdown: [
      { provider: 'cohere', operation: 'rerank', total_cost: 2.5, request_count: 250 },
      { provider: 'openai', operation: 'embed', total_cost: 2.75, request_count: 1000 },
    ],
  };

  it('renders loading state initially', () => {
    vi.mocked(api.apiClient.getCostSummary).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );
    vi.mocked(api.apiClient.getCostAlerts).mockResolvedValue({ alerts: [] });

    render(<CostDashboard />, { wrapper: createWrapper() });

    expect(screen.getByText('Loading cost data...')).toBeInTheDocument();
  });

  it('renders error state when API fails', async () => {
    vi.mocked(api.apiClient.getCostSummary).mockRejectedValue(new Error('Network error'));

    render(<CostDashboard />, { wrapper: createWrapper() });

    expect(await screen.findByText('Failed to load cost data')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('renders dashboard with cost data', async () => {
    vi.mocked(api.apiClient.getCostSummary).mockResolvedValue(mockCostData);
    vi.mocked(api.apiClient.getCostAlerts).mockResolvedValue({ alerts: [] });

    render(<CostDashboard />, { wrapper: createWrapper() });

    // Wait for data to load
    expect(await screen.findByText('$5.25')).toBeInTheDocument();
    expect(screen.getByText('/ $10.00')).toBeInTheDocument();
  });

  it('renders page title and description', () => {
    vi.mocked(api.apiClient.getCostSummary).mockResolvedValue(mockCostData);
    vi.mocked(api.apiClient.getCostAlerts).mockResolvedValue({ alerts: [] });

    render(<CostDashboard />, { wrapper: createWrapper() });

    expect(screen.getByText('API Cost Dashboard')).toBeInTheDocument();
    expect(
      screen.getByText('Track your API spending and monitor budget usage')
    ).toBeInTheDocument();
  });

  it('renders all child components with data', async () => {
    vi.mocked(api.apiClient.getCostSummary).mockResolvedValue(mockCostData);
    vi.mocked(api.apiClient.getCostAlerts).mockResolvedValue({ alerts: [] });

    render(<CostDashboard />, { wrapper: createWrapper() });

    // CostSummary should be rendered
    expect(await screen.findByText('Current Month')).toBeInTheDocument();

    // CostBreakdown should be rendered
    expect(screen.getByText('Breakdown by Provider')).toBeInTheDocument();
    expect(screen.getByText('cohere - rerank')).toBeInTheDocument();
    expect(screen.getByText('openai - embed')).toBeInTheDocument();
  });

  it('handles generic error objects', async () => {
    vi.mocked(api.apiClient.getCostSummary).mockRejectedValue({ message: 'Unknown error' });

    render(<CostDashboard />, { wrapper: createWrapper() });

    expect(await screen.findByText('Failed to load cost data')).toBeInTheDocument();
    expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument();
  });

  it('renders with empty breakdown', async () => {
    const emptyData = { ...mockCostData, breakdown: [] };
    vi.mocked(api.apiClient.getCostSummary).mockResolvedValue(emptyData);
    vi.mocked(api.apiClient.getCostAlerts).mockResolvedValue({ alerts: [] });

    render(<CostDashboard />, { wrapper: createWrapper() });

    expect(await screen.findByText('No API usage recorded yet this month')).toBeInTheDocument();
  });
});
