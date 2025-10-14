import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as api from '../lib/api';
import { BudgetAlerts } from './BudgetAlerts';

// Mock the API client
vi.mock('../lib/api', () => ({
  apiClient: {
    getCostAlerts: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('BudgetAlerts', () => {
  it('renders warning alert correctly', async () => {
    const mockAlerts = {
      alerts: [
        {
          id: 1,
          alert_type: 'warning' as const,
          threshold_usd: 10,
          current_spend_usd: 8.5,
          period: 'monthly',
          triggered_at: '2025-10-14T10:00:00Z',
          acknowledged: false,
        },
      ],
    };

    vi.mocked(api.apiClient.getCostAlerts).mockResolvedValue(mockAlerts);

    render(<BudgetAlerts />, { wrapper: createWrapper() });

    expect(await screen.findByText('⚠️ 80% Budget Warning')).toBeInTheDocument();
    expect(screen.getByText(/\$8\.50 of \$10\.00 used/)).toBeInTheDocument();
  });

  it('renders limit reached alert correctly', async () => {
    const mockAlerts = {
      alerts: [
        {
          id: 2,
          alert_type: 'limit_reached' as const,
          threshold_usd: 10,
          current_spend_usd: 10.0,
          period: 'monthly',
          triggered_at: '2025-10-14T10:00:00Z',
          acknowledged: false,
        },
      ],
    };

    vi.mocked(api.apiClient.getCostAlerts).mockResolvedValue(mockAlerts);

    render(<BudgetAlerts />, { wrapper: createWrapper() });

    expect(await screen.findByText('🚨 Budget Limit Reached')).toBeInTheDocument();
    expect(screen.getByText(/\$10\.00 of \$10\.00 used/)).toBeInTheDocument();
  });

  it('renders multiple alerts', async () => {
    const mockAlerts = {
      alerts: [
        {
          id: 1,
          alert_type: 'warning' as const,
          threshold_usd: 10,
          current_spend_usd: 8.0,
          period: 'monthly',
          triggered_at: '2025-10-13T10:00:00Z',
          acknowledged: false,
        },
        {
          id: 2,
          alert_type: 'limit_reached' as const,
          threshold_usd: 10,
          current_spend_usd: 10.5,
          period: 'monthly',
          triggered_at: '2025-10-14T10:00:00Z',
          acknowledged: false,
        },
      ],
    };

    vi.mocked(api.apiClient.getCostAlerts).mockResolvedValue(mockAlerts);

    render(<BudgetAlerts />, { wrapper: createWrapper() });

    expect(await screen.findByText('⚠️ 80% Budget Warning')).toBeInTheDocument();
    expect(screen.getByText('🚨 Budget Limit Reached')).toBeInTheDocument();
  });

  it('renders nothing when no alerts', async () => {
    vi.mocked(api.apiClient.getCostAlerts).mockResolvedValue({ alerts: [] });

    const { container } = render(<BudgetAlerts />, { wrapper: createWrapper() });

    // Wait a bit for loading to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing while loading', () => {
    vi.mocked(api.apiClient.getCostAlerts).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const { container } = render(<BudgetAlerts />, { wrapper: createWrapper() });

    expect(container.firstChild).toBeNull();
  });

  it('formats currency values correctly', async () => {
    const mockAlerts = {
      alerts: [
        {
          id: 1,
          alert_type: 'warning' as const,
          threshold_usd: 100.456,
          current_spend_usd: 85.678,
          period: 'monthly',
          triggered_at: '2025-10-14T10:00:00Z',
          acknowledged: false,
        },
      ],
    };

    vi.mocked(api.apiClient.getCostAlerts).mockResolvedValue(mockAlerts);

    render(<BudgetAlerts />, { wrapper: createWrapper() });

    expect(await screen.findByText(/\$85\.68 of \$100\.46 used/)).toBeInTheDocument();
  });
});
