import type { UsageTier } from '@synthesis/shared';

interface UsageTierBadgeProps {
  usageTier?: UsageTier | string | null;
  className?: string;
}

const TIER_STYLES: Record<UsageTier, string> = {
  official: 'bg-green-100 text-green-800 border-green-300',
  reference: 'bg-blue-100 text-blue-800 border-blue-300',
  example: 'bg-amber-100 text-amber-800 border-amber-300',
  recipe: 'bg-purple-100 text-purple-800 border-purple-300',
};

const TIER_LABELS: Record<UsageTier, string> = {
  official: 'Official',
  reference: 'Reference',
  example: 'Example',
  recipe: 'Recipe',
};

const TIER_ICONS: Record<UsageTier, string> = {
  official: '\u{1F4D7}',
  reference: '\u{1F4DA}',
  example: '\u{1F4A1}',
  recipe: '\u{1F373}',
};

const TIER_TOOLTIPS: Record<UsageTier, string> = {
  official: 'Authoritative documentation from official sources',
  reference: 'API documentation and technical references',
  example: 'Sample code and demonstration projects',
  recipe: 'Curated implementation guides with opinionated patterns',
};

const KNOWN_TIERS: UsageTier[] = ['official', 'reference', 'example', 'recipe'];

function isKnownTier(tier: string): tier is UsageTier {
  return KNOWN_TIERS.includes(tier as UsageTier);
}

export function UsageTierBadge({ usageTier, className }: UsageTierBadgeProps) {
  if (!usageTier || (typeof usageTier === 'string' && usageTier.trim() === '')) {
    return null;
  }

  const normalized = (usageTier as string).toLowerCase().trim();

  if (isKnownTier(normalized)) {
    return (
      <span
        className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${TIER_STYLES[normalized]} ${className ?? ''}`.trim()}
        aria-label={`Usage tier: ${normalized}`}
        title={TIER_TOOLTIPS[normalized]}
      >
        {TIER_ICONS[normalized]} {TIER_LABELS[normalized]}
      </span>
    );
  }

  // Handle unknown tier values gracefully with gray styling
  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border bg-gray-100 text-gray-800 border-gray-300 ${className ?? ''}`.trim()}
      aria-label={`Usage tier: ${usageTier}`}
      title={`Unknown usage tier: ${usageTier}`}
    >
      {usageTier}
    </span>
  );
}
