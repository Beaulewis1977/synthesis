import { useQuery } from '@tanstack/react-query';
import { AlertCircle, DollarSign, Loader2 } from 'lucide-react';
import { BudgetAlerts } from '../components/BudgetAlerts';
import { CostBreakdown } from '../components/CostBreakdown';
import { CostSummary } from '../components/CostSummary';
import { apiClient } from '../lib/api';

export function CostDashboard() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['cost-summary'],
    queryFn: () => apiClient.getCostSummary(),
    // Optional: auto-refresh every 30 seconds
    refetchInterval: 30000,
  });

  return (
    <div>
      <div className="mb-lg">
        <div className="flex items-center gap-sm mb-md">
          <DollarSign className="text-accent" size={28} />
          <h1 className="text-2xl font-bold text-text-primary">API Cost Dashboard</h1>
        </div>
        <p className="text-text-secondary">Track your API spending and monitor budget usage</p>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-xl">
          <Loader2 className="animate-spin text-accent" size={32} />
          <span className="ml-md text-text-secondary">Loading cost data...</span>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="card bg-red-50 border-error">
          <div className="flex items-start gap-md">
            <AlertCircle className="text-error flex-shrink-0" size={24} />
            <div>
              <h3 className="font-semibold text-error mb-sm">Failed to load cost data</h3>
              <p className="text-sm text-text-secondary">
                {error instanceof Error ? error.message : 'An unexpected error occurred'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Content */}
      {!isLoading && !isError && data && (
        <div className="max-w-4xl">
          <CostSummary
            current={data.current_spend}
            budget={data.budget}
            percentage={data.percentage_used}
            remaining={data.remaining}
          />

          <CostBreakdown breakdown={data.breakdown} />

          <BudgetAlerts />
        </div>
      )}
    </div>
  );
}
