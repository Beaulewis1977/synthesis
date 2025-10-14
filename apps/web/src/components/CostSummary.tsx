interface CostSummaryProps {
  current: number;
  budget: number;
  percentage: number;
  remaining: number;
}

export function CostSummary({ current, budget, percentage, remaining }: CostSummaryProps) {
  const isWarning = percentage >= 80;
  const color = isWarning ? 'text-red-600' : 'text-green-600';
  const progressColor = isWarning ? 'bg-red-500' : 'bg-green-500';

  return (
    <div className="card mb-md">
      <h2 className="text-lg font-semibold text-text-primary mb-md">Current Month</h2>

      <div className="text-3xl font-bold mb-sm">
        <span className={color}>${current.toFixed(2)}</span>
        <span className="text-text-secondary"> / ${budget.toFixed(2)}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-sm">
        <div
          tabIndex={0}
          className={`h-2 rounded-full ${progressColor}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
          role="progressbar"
          aria-valuenow={Math.min(percentage, 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${percentage.toFixed(1)}% of budget used`}
        />
      </div>

      <p className="text-sm text-text-secondary">
        {percentage.toFixed(1)}% used · ${remaining.toFixed(2)} remaining
      </p>

      {isWarning && (
        <div className="mt-md p-sm bg-red-50 border border-error rounded text-sm text-error">
          ⚠️ Warning: You've reached {percentage.toFixed(0)}% of your monthly budget
        </div>
      )}
    </div>
  );
}
