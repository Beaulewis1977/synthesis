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

  if (monthsSince < 6) {
    return (
      <span className={`inline-flex items-center text-xs text-green-700 ${className ?? ''}`.trim()}>
        🕐 Updated recently
      </span>
    );
  }

  if (monthsSince < 12) {
    return (
      <span className={`inline-flex items-center text-xs text-amber-700 ${className ?? ''}`.trim()}>
        🕐 Updated {monthsSince} month{monthsSince === 1 ? '' : 's'} ago
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center text-xs text-gray-600 ${className ?? ''}`.trim()}>
      🕐 Older content
    </span>
  );
}
