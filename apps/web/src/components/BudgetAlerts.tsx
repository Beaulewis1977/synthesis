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
    <section className="card animate-fade-in" aria-label="Budget alerts">
      <h2 className="text-lg font-semibold text-text-primary mb-md">Budget Alerts</h2>

      <div className="space-y-sm" aria-live="polite" aria-atomic="false">
        {data.alerts.map((alert, index) => {
          const isLimitReached = alert.alert_type === 'limit_reached';
          const bgColor = isLimitReached
            ? 'bg-red-50 border-error'
            : 'bg-yellow-50 border-yellow-500';
          const textColor = isLimitReached ? 'text-error' : 'text-yellow-800';
          const Icon = isLimitReached ? AlertCircle : AlertTriangle;

          return (
            <div
              key={alert.id}
              className={`p-md rounded border ${bgColor} animate-slide-down`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start gap-sm">
                <Icon className={`flex-shrink-0 ${textColor}`} size={20} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${textColor}`}>
                    {isLimitReached ? (
                      <>
                        <span role="img" aria-label="Alert">
                          🚨
                        </span>{' '}
                        Budget Limit Reached
                      </>
                    ) : (
                      <>
                        <span role="img" aria-label="Warning">
                          ⚠️
                        </span>{' '}
                        80% Budget Warning
                      </>
                    )}
                  </p>
                  <p className="text-sm text-text-secondary mt-xs break-words">
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
