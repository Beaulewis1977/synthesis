import type { CostBreakdownItem } from '../types';

interface CostBreakdownProps {
  breakdown: CostBreakdownItem[];
}

export function CostBreakdown({ breakdown }: CostBreakdownProps) {
  if (!breakdown || breakdown.length === 0) {
    return (
      <div className="card mb-md animate-fade-in">
        <h2 className="text-lg font-semibold text-text-primary mb-md">Breakdown by Provider</h2>
        <div className="text-center py-8">
          <p className="text-sm text-text-secondary">No API usage recorded yet this month</p>
          <p className="text-xs text-text-secondary mt-2">
            Usage will appear here after your first API call
          </p>
        </div>
      </div>
    );
  }

  const total = breakdown.reduce((sum, item) => sum + item.total_cost, 0);

  return (
    <div className="card mb-md animate-fade-in">
      <h2 className="text-lg font-semibold text-text-primary mb-md">Breakdown by Provider</h2>

      <div className="space-y-md">
        {breakdown.map((item, index) => {
          const percentage = total > 0 ? (item.total_cost / total) * 100 : 0;
          const roundedPercentage = Number.isFinite(percentage) ? Math.round(percentage) : 0;

          return (
            <div
              key={`${item.provider}-${item.operation}`}
              className="animate-slide-down"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex flex-wrap justify-between text-sm mb-xs gap-2">
                <span className="font-medium text-text-primary">
                  {item.provider} - {item.operation}
                </span>
                <span className="text-text-secondary whitespace-nowrap">
                  ${item.total_cost.toFixed(2)} ({roundedPercentage}%)
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-1.5" role="presentation">
                <div
                  tabIndex={0}
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                  role="progressbar"
                  aria-valuenow={roundedPercentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${item.provider} ${item.operation}: ${roundedPercentage}%`}
                />
              </div>

              <p className="text-xs text-text-secondary mt-xs">
                {item.request_count.toLocaleString()} requests
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
