import type { ContentPlatform } from '@synthesis/shared';

interface PlatformBadgeProps {
  platform?: ContentPlatform | string | null;
  className?: string;
}

const PLATFORM_STYLES: Record<ContentPlatform, string> = {
  mobile: 'bg-green-100 text-green-800 border-green-300',
  web: 'bg-blue-100 text-blue-800 border-blue-300',
  backend: 'bg-purple-100 text-purple-800 border-purple-300',
  shared: 'bg-gray-100 text-gray-800 border-gray-300',
};

const PLATFORM_LABELS: Record<ContentPlatform, string> = {
  mobile: '\uD83D\uDCF1 Mobile',
  web: '\uD83C\uDF10 Web',
  backend: '\u2699\uFE0F Backend',
  shared: '\uD83D\uDD17 Shared',
};

const PLATFORM_TOOLTIPS: Record<ContentPlatform, string> = {
  mobile: 'Mobile platform content (Flutter, React Native, native apps)',
  web: 'Web platform content (React, Vue, browser-based)',
  backend: 'Backend/server content (Node.js, APIs, databases)',
  shared: 'Shared/cross-platform content',
};

const VALID_PLATFORMS = Object.keys(PLATFORM_STYLES) as ContentPlatform[];

function isValidPlatform(value: string): value is ContentPlatform {
  return VALID_PLATFORMS.includes(value as ContentPlatform);
}

export function PlatformBadge({ platform, className }: PlatformBadgeProps) {
  if (!platform || (typeof platform === 'string' && platform.trim() === '')) {
    return null;
  }

  const normalized = (platform as string).toLowerCase().trim();

  // Handle known platform values
  if (isValidPlatform(normalized)) {
    return (
      <span
        className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${PLATFORM_STYLES[normalized]} ${className ?? ''}`.trim()}
        aria-label={`Platform: ${normalized}`}
        title={PLATFORM_TOOLTIPS[normalized]}
      >
        {PLATFORM_LABELS[normalized]}
      </span>
    );
  }

  // Handle unknown platform values gracefully - show as-is with gray styling
  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border bg-gray-100 text-gray-800 border-gray-300 ${className ?? ''}`.trim()}
      aria-label={`Platform: ${platform}`}
      title={`Platform: ${platform}`}
    >
      {platform}
    </span>
  );
}

// Default export for backward compatibility
export default PlatformBadge;
