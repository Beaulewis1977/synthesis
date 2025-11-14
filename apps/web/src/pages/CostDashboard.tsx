import { useQuery } from '@tanstack/react-query';
import { AlertCircle, DollarSign } from 'lucide-react';
import { BudgetAlerts } from '../components/BudgetAlerts';
import { CostBreakdown } from '../components/CostBreakdown';
import { CostSummary } from '../components/CostSummary';
import { apiClient } from '../lib/api';

export function CostDashboard() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['cost-summary'],
    queryFn: () => apiClient.getCostSummary(),
    // Optional: auto-refresh every 30 seconds
    refetchInterval: 30000,
  });

  return (
    <main className="max-w-4xl">
      <div className="mb-lg">
        <div className="flex items-center gap-sm mb-md">
          <DollarSign className="text-accent" size={28} aria-hidden="true" />
          <h1 className="text-2xl font-bold text-text-primary">API Cost Dashboard</h1>
        </div>
        <p className="text-text-secondary">Track your API spending and monitor budget usage</p>
      </div>

      {/* Loading State - Skeleton */}
      {isLoading && (
        <div className="max-w-4xl" aria-live="polite" aria-busy="true">
          <div className="sr-only">Loading cost data...</div>
          {/* Summary skeleton */}
          <div className="card mb-md animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-32 mb-md" />
            <div className="h-10 bg-gray-200 rounded w-48 mb-sm" />
            <div className="h-2 bg-gray-200 rounded w-full mb-sm" />
            <div className="h-4 bg-gray-200 rounded w-40" />
          </div>
          {/* Breakdown skeleton */}
          <div className="card mb-md animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-48 mb-md" />
            <div className="space-y-md">
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <div className="h-4 bg-gray-200 rounded w-full mb-xs" />
                  <div className="h-1.5 bg-gray-200 rounded w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="card bg-red-50 border-error animate-fade-in" role="alert">
          <div className="flex items-start gap-md">
            <AlertCircle className="text-error flex-shrink-0" size={24} aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-error mb-sm">Failed to load cost data</h2>
              <p className="text-sm text-text-secondary">
                {error instanceof Error ? error.message : 'An unexpected error occurred'}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-md btn btn-secondary text-sm"
                aria-label="Retry loading cost data"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Content */}
      {!isLoading && !isError && data && (
        <>
          <CostSummary
            current={data.current_spend}
            budget={data.budget}
            percentage={data.percentage_used}
            remaining={data.remaining}
          />

          <CostBreakdown breakdown={data.breakdown} />

          <BudgetAlerts />
        </>
      )}
    </main>
  );
}
