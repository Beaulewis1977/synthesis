interface FeatureTagBadgesProps {
  featureTags?: string[] | null;
  className?: string;
}

/**
 * Formats a feature tag for display by replacing underscores with spaces
 * and converting to title case.
 *
 * @example
 * formatFeatureTag('push_notifications') // 'Push Notifications'
 * formatFeatureTag('auth') // 'Auth'
 */
function formatFeatureTag(tag: string): string {
  return tag
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Displays mobile feature tags as small chips with neutral styling.
 * Renders all tags with flex-wrap layout (no truncation).
 *
 * @example
 * <FeatureTagBadges featureTags={['auth', 'push_notifications', 'offline']} />
 */
export default function FeatureTagBadges({ featureTags, className }: FeatureTagBadgesProps) {
  if (!featureTags || featureTags.length === 0) {
    return null;
  }

  // Deduplicate tags while preserving order
  const uniqueTags = [...new Set(featureTags)];

  return (
    <div className={`flex flex-wrap gap-1 ${className ?? ''}`.trim()}>
      {uniqueTags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"
          title={formatFeatureTag(tag)}
        >
          {formatFeatureTag(tag)}
        </span>
      ))}
    </div>
  );
}
