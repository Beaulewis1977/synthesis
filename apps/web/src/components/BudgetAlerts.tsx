import { useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { apiClient } from '../lib/api';
import { formatRelativeTime } from '../lib/utils';

export function BudgetAlerts() {
  const { data, isLoading } = useQuery({
    queryKey: ['cost-alerts'],
    queryFn: () => apiClient.getCostAlerts(),
  });

  if (isLoading) return null;
  if (!data?.alerts?.length) return null;

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-text-primary mb-md">Budget Alerts</h2>

      <div className="space-y-sm">
        {data.alerts.map((alert) => {
          const isLimitReached = alert.alert_type === 'limit_reached';
          const bgColor = isLimitReached
            ? 'bg-red-50 border-error'
            : 'bg-yellow-50 border-yellow-500';
          const textColor = isLimitReached ? 'text-error' : 'text-yellow-800';
          const Icon = isLimitReached ? AlertCircle : AlertTriangle;

          return (
            <div key={alert.id} className={`p-md rounded border ${bgColor}`}>
              <div className="flex items-start gap-sm">
                <Icon className={`flex-shrink-0 ${textColor}`} size={20} />
                <div className="flex-1">
                  <p className={`font-medium ${textColor}`}>
                    {isLimitReached ? '🚨 Budget Limit Reached' : '⚠️ 80% Budget Warning'}
                  </p>
                  <p className="text-sm text-text-secondary mt-xs">
                    ${alert.current_spend_usd.toFixed(2)} of ${alert.threshold_usd.toFixed(2)} used
                  </p>
                  <p className="text-xs text-text-secondary mt-xs">
                    {formatRelativeTime(alert.triggered_at)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
