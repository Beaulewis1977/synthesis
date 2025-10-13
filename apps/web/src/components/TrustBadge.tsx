interface TrustBadgeProps {
  sourceQuality?: 'official' | 'verified' | 'community' | string | null;
  className?: string;
}

const TRUST_STYLES: Record<'official' | 'verified' | 'community', string> = {
  official: 'bg-green-100 text-green-800 border-green-300',
  verified: 'bg-blue-100 text-blue-800 border-blue-300',
  community: 'bg-gray-100 text-gray-800 border-gray-300',
};

const TRUST_LABELS: Record<'official' | 'verified' | 'community', string> = {
  official: '📗 Official Docs',
  verified: '✓ Verified',
  community: '👥 Community',
};

export function TrustBadge({ sourceQuality, className }: TrustBadgeProps) {
  if (!sourceQuality) {
    return null;
  }

  const normalized = (sourceQuality as string).toLowerCase();

  if (normalized !== 'official' && normalized !== 'verified' && normalized !== 'community') {
    return null;
  }

  const variant = normalized as 'official' | 'verified' | 'community';

  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-2 py-1 rounded border ${TRUST_STYLES[variant]} ${className ?? ''}`.trim()}
    >
      {TRUST_LABELS[variant]}
    </span>
  );
}
