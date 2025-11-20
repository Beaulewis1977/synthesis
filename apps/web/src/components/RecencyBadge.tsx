interface RecencyBadgeProps {
  lastVerified?: string | Date | null;
  className?: string;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function diffInMonths(date: Date): number {
  const now = new Date();
  const months =
    (now.getFullYear() - date.getFullYear()) * 12 +
    (now.getMonth() - date.getMonth()) +
    (now.getDate() - date.getDate()) / 30;
  return Math.max(0, Math.floor(months));
}

export function RecencyBadge({ lastVerified, className }: RecencyBadgeProps) {
  const verifiedDate = toDate(lastVerified);

  if (!verifiedDate) {
    return null;
  }

  const monthsSince = diffInMonths(verifiedDate);
  const isoDate = verifiedDate.toISOString();

  let label: string;
  let colorClass: string;
  let tooltip: string;

  if (monthsSince < 6) {
    label = '🕐 Updated recently';
    colorClass = 'text-green-700';
    tooltip = `Last verified ${monthsSince === 0 ? 'this month' : `${monthsSince} month${monthsSince === 1 ? '' : 's'} ago`}`;
  } else if (monthsSince < 12) {
    label = `🕐 Updated ${monthsSince} month${monthsSince === 1 ? '' : 's'} ago`;
    colorClass = 'text-amber-700';
    tooltip = `Last verified ${monthsSince} months ago - may need review`;
  } else {
    label = '🕐 Older content';
    colorClass = 'text-gray-600';
    tooltip = 'Last verified over a year ago - information may be outdated';
  }

  return (
    <time
      dateTime={isoDate}
      className={`inline-flex items-center text-xs ${colorClass} ${className ?? ''} animate-fade-in`.trim()}
      aria-label={tooltip}
      title={tooltip}
    >
      {label}
    </time>
  );
}
