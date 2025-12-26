/**
 * EmbeddingProfileSelect Component
 *
 * Phase 6: Dropdown for selecting embedding profiles with cost tier badges.
 */

import { Check, ChevronDown, Cpu, DollarSign, Settings2, Sparkles, Zap } from 'lucide-react';
import { useState } from 'react';
import type { CostTier, EmbeddingProfile } from '../../types';

interface EmbeddingProfileSelectProps {
  profiles: EmbeddingProfile[];
  selectedId: string | null;
  defaultProfileId: string | null;
  onSelect: (profileId: string) => void;
  disabled?: boolean;
}

/**
 * Cost tier badge component
 */
function CostBadge({ tier }: { tier: CostTier }) {
  const config = {
    free: { label: 'Free', icon: Zap, className: 'bg-success/10 text-success' },
    low: { label: '$', icon: DollarSign, className: 'bg-accent/10 text-accent' },
    medium: { label: '$$', icon: DollarSign, className: 'bg-warning/10 text-warning' },
    high: { label: '$$$', icon: DollarSign, className: 'bg-error/10 text-error' },
  };

  const { label, icon: Icon, className } = config[tier];

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${className}`}
    >
      <Icon size={10} />
      {label}
    </span>
  );
}

/**
 * Use case badge for profiles (Code/Docs/General)
 * Note: With the new profile naming scheme (free-local, cheap, medium, high, none),
 * we rely on codeAware flag and costTier for display logic.
 */
function UseCaseBadge({ profile }: { profile: EmbeddingProfile }) {
  if (profile.name === 'none') return null;

  // Code-aware profiles get the Code badge
  if (profile.codeAware) {
    return (
      <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">Code</span>
    );
  }

  // All non-code profiles are now general purpose
  return <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">General</span>;
}

/**
 * Profile icon based on characteristics
 */
function ProfileIcon({ profile }: { profile: EmbeddingProfile }) {
  // Manual configuration icon
  if (profile.name === 'none') {
    return <Settings2 size={18} className="text-accent" />;
  }
  if (profile.costTier === 'free') {
    return <Cpu size={18} className="text-success" />;
  }
  if (profile.codeAware) {
    return <Sparkles size={18} className="text-accent" />;
  }
  return <Zap size={18} className="text-warning" />;
}

export function EmbeddingProfileSelect({
  profiles,
  selectedId,
  defaultProfileId,
  onSelect,
  disabled = false,
}: EmbeddingProfileSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Find selected profile
  const selectedProfile =
    profiles.find((p) => p.id === selectedId) || profiles.find((p) => p.id === defaultProfileId);

  // Sort profiles: 'none' (manual) first, then system profiles by cost tier, then custom
  const sortedProfiles = [...profiles].sort((a, b) => {
    // 'none' (manual) always first
    if (a.name === 'none') return -1;
    if (b.name === 'none') return 1;
    // Then system profiles before custom
    if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
    // Then by cost tier
    const tierOrder = { free: 0, low: 1, medium: 2, high: 3 };
    return tierOrder[a.costTier] - tierOrder[b.costTier];
  });

  return (
    <div className="relative">
      {/* Selected Profile Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={(e) => e.key === 'Escape' && setIsOpen(false)}
        disabled={disabled}
        className={`w-full flex items-center justify-between p-md border rounded-lg transition-all ${
          isOpen ? 'border-accent ring-2 ring-accent/20' : 'border-border hover:border-accent/50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {selectedProfile ? (
          <div className="flex items-center gap-md">
            <ProfileIcon profile={selectedProfile} />
            <div className="text-left">
              <div className="flex items-center gap-sm">
                <span className="font-medium text-text-primary">{selectedProfile.displayName}</span>
                <UseCaseBadge profile={selectedProfile} />
                {selectedProfile.name !== 'none' && <CostBadge tier={selectedProfile.costTier} />}
                {selectedProfile.id === defaultProfileId && (
                  <span className="text-xs text-text-secondary">(default)</span>
                )}
              </div>
              <span className="text-xs text-text-secondary">
                {selectedProfile.name === 'none'
                  ? 'Configure each content type manually'
                  : `${selectedProfile.provider} / ${selectedProfile.model}`}
              </span>
            </div>
          </div>
        ) : (
          <span className="text-text-secondary">Select a profile...</span>
        )}
        <ChevronDown
          size={18}
          className={`text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop to close dropdown */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop is decorative, keyboard handled by button */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} aria-hidden="true" />

          {/* Dropdown Content */}
          <div
            className="absolute z-20 w-full mt-xs bg-white border border-border rounded-lg shadow-lg overflow-hidden animate-slide-down"
            tabIndex={-1}
          >
            {sortedProfiles.map((profile) => {
              const isSelected =
                profile.id === selectedId || (!selectedId && profile.id === defaultProfileId);

              const isManual = profile.name === 'none';

              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => {
                    onSelect(profile.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-start gap-md p-md text-left transition-colors ${
                    isSelected ? 'bg-accent/5' : 'hover:bg-bg-secondary'
                  } ${isManual ? 'border-b border-border' : ''}`}
                >
                  <ProfileIcon profile={profile} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-sm">
                      <span className="font-medium text-text-primary">{profile.displayName}</span>
                      <UseCaseBadge profile={profile} />
                      {!isManual && <CostBadge tier={profile.costTier} />}
                      {profile.id === defaultProfileId && (
                        <span className="text-xs text-text-secondary">(default)</span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary mt-xs line-clamp-2">
                      {profile.description || `${profile.provider} / ${profile.model}`}
                    </p>
                    {!isManual && (
                      <div className="flex items-center gap-md mt-xs text-xs text-text-secondary">
                        <span>Chunk: {profile.chunkSize}</span>
                        <span>Overlap: {profile.chunkOverlap}</span>
                        {profile.codeAware && <span className="text-accent">Code-aware</span>}
                      </div>
                    )}
                  </div>
                  {isSelected && <Check size={18} className="text-accent flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
