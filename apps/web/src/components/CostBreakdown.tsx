import type { CostBreakdownItem } from '../types';

interface CostBreakdownProps {
  breakdown: CostBreakdownItem[];
}

export function CostBreakdown({ breakdown }: CostBreakdownProps) {
  if (!breakdown || breakdown.length === 0) {
    return (
      <div className="card mb-md">
        <h2 className="text-lg font-semibold text-text-primary mb-md">Breakdown by Provider</h2>
        <p className="text-sm text-text-secondary">No API usage recorded yet this month</p>
      </div>
    );
  }

  const total = breakdown.reduce((sum, item) => sum + item.total_cost, 0);

  return (
    <div className="card mb-md">
      <h2 className="text-lg font-semibold text-text-primary mb-md">Breakdown by Provider</h2>

      <div className="space-y-md">
        {breakdown.map((item) => {
          const percentage = total > 0 ? (item.total_cost / total) * 100 : 0;
          const roundedPercentage = Number.isFinite(percentage) ? Math.round(percentage) : 0;

          return (
            <div key={`${item.provider}-${item.operation}`}>
              <div className="flex justify-between text-sm mb-xs">
                <span className="font-medium text-text-primary">
                  {item.provider} - {item.operation}
                </span>
                <span className="text-text-secondary">
                  ${item.total_cost.toFixed(2)} ({roundedPercentage}%)
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  tabIndex={0}
                  className="bg-blue-500 h-1.5 rounded-full"
                  style={{ width: `${percentage}%` }}
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
