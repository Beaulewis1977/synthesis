import type { ContentPlatform, MobileFeatureTag, UsageTier } from '@synthesis/shared';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { useState } from 'react';

/**
 * Feature tag categories for grouped display.
 * Each category maps to an array of MobileFeatureTag values.
 */
const FEATURE_CATEGORIES: Record<string, MobileFeatureTag[]> = {
  'Auth & Identity': ['auth', 'onboarding', 'social_auth'],
  Payments: ['billing', 'payments', 'subscriptions'],
  Communication: ['push_notifications', 'chat', 'realtime'],
  'Data & Storage': ['offline', 'local_storage', 'sync', 'caching', 'search'],
  'Navigation & UI': ['navigation', 'state_management', 'forms', 'theming', 'localization'],
  'Device Features': ['camera', 'file_upload', 'location', 'maps'],
  Analytics: ['analytics', 'deep_linking'],
};

/**
 * Platform options for the dropdown.
 */
const PLATFORM_OPTIONS: { value: ContentPlatform | ''; label: string }[] = [
  { value: '', label: 'All Platforms' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'web', label: 'Web' },
  { value: 'backend', label: 'Backend' },
  { value: 'shared', label: 'Shared' },
];

/**
 * Usage tier options for the dropdown.
 */
const USAGE_TIER_OPTIONS: { value: UsageTier | ''; label: string }[] = [
  { value: '', label: 'All Content Types' },
  { value: 'official', label: 'Official' },
  { value: 'reference', label: 'Reference' },
  { value: 'example', label: 'Example' },
  { value: 'recipe', label: 'Recipe' },
];

/**
 * Formats a feature tag for display by replacing underscores with spaces
 * and converting to title case.
 */
function formatFeatureTag(tag: string): string {
  return tag
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

interface MobileFeatureFilterProps {
  platform: string | null;
  usageTier: string | null;
  featureTags: string[];
  onPlatformChange: (platform: string | null) => void;
  onUsageTierChange: (tier: string | null) => void;
  onFeatureTagsChange: (tags: string[]) => void;
}

/**
 * MobileFeatureFilter component for filtering search results by mobile features.
 *
 * Provides:
 * - Platform dropdown (single-select)
 * - Usage tier dropdown (single-select)
 * - Feature tags (grouped multi-select with collapsible categories)
 * - Clear button for active filters
 */
export default function MobileFeatureFilter({
  platform,
  usageTier,
  featureTags,
  onPlatformChange,
  onUsageTierChange,
  onFeatureTagsChange,
}: MobileFeatureFilterProps) {
  // Track expanded categories (all collapsed by default)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Check if any filter is active
  const hasActiveFilters = platform !== null || usageTier !== null || featureTags.length > 0;

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Toggle a feature tag selection
  const toggleFeatureTag = (tag: string) => {
    const newTags = featureTags.includes(tag)
      ? featureTags.filter((t) => t !== tag)
      : [...featureTags, tag];
    onFeatureTagsChange(newTags);
  };

  // Clear all mobile filters
  const clearAllFilters = () => {
    onPlatformChange(null);
    onUsageTierChange(null);
    onFeatureTagsChange([]);
  };

  // Count active tags per category
  const getActiveCategoryCount = (category: string): number => {
    const categoryTags = FEATURE_CATEGORIES[category];
    return categoryTags.filter((tag) => featureTags.includes(tag)).length;
  };

  return (
    <div className="space-y-md">
      {/* Dropdowns Row */}
      <div className="flex flex-wrap gap-md">
        {/* Platform Dropdown */}
        <div className="flex flex-col gap-xs">
          <label htmlFor="platform-filter" className="text-sm font-medium text-text-secondary">
            Platform
          </label>
          <select
            id="platform-filter"
            value={platform ?? ''}
            onChange={(e) => onPlatformChange(e.target.value || null)}
            className="px-3 py-2 min-h-[44px] border border-border rounded-lg text-sm bg-bg-primary text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {PLATFORM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Usage Tier Dropdown */}
        <div className="flex flex-col gap-xs">
          <label htmlFor="usage-tier-filter" className="text-sm font-medium text-text-secondary">
            Content Type
          </label>
          <select
            id="usage-tier-filter"
            value={usageTier ?? ''}
            onChange={(e) => onUsageTierChange(e.target.value || null)}
            className="px-3 py-2 min-h-[44px] border border-border rounded-lg text-sm bg-bg-primary text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {USAGE_TIER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Feature Tags - Grouped Collapsible Sections */}
      <div className="space-y-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text-secondary">
            Feature Tags
            {featureTags.length > 0 && (
              <span className="ml-1 text-accent">({featureTags.length} active)</span>
            )}
          </span>
        </div>

        <div className="space-y-xs">
          {Object.entries(FEATURE_CATEGORIES).map(([category, tags]) => {
            const isExpanded = expandedCategories.has(category);
            const activeCount = getActiveCategoryCount(category);

            return (
              <fieldset key={category} className="border border-border rounded-lg overflow-hidden">
                <legend className="sr-only">{category} features</legend>

                {/* Category Header (Collapsible Toggle) */}
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  aria-expanded={isExpanded}
                  aria-controls={`category-${category.replace(/\s+/g, '-').toLowerCase()}`}
                  className="w-full flex items-center justify-between px-3 py-2 min-h-[44px] bg-bg-secondary hover:bg-bg-hover transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                >
                  <span className="flex items-center gap-sm text-sm font-medium text-text-primary">
                    {isExpanded ? (
                      <ChevronDown size={16} className="text-text-secondary" aria-hidden="true" />
                    ) : (
                      <ChevronRight size={16} className="text-text-secondary" aria-hidden="true" />
                    )}
                    {category}
                    {activeCount > 0 && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-accent text-white rounded-full">
                        {activeCount}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-text-secondary">{tags.length} tags</span>
                </button>

                {/* Collapsible Content */}
                {isExpanded && (
                  <div
                    id={`category-${category.replace(/\s+/g, '-').toLowerCase()}`}
                    className="px-3 py-2 bg-bg-primary border-t border-border"
                  >
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => {
                        const isSelected = featureTags.includes(tag);
                        return (
                          <label
                            key={tag}
                            className={`px-3 py-1.5 min-h-[36px] rounded-full text-sm font-medium transition-all duration-200 cursor-pointer flex items-center ${
                              isSelected
                                ? 'bg-accent text-white shadow-sm scale-100 hover:scale-105'
                                : 'bg-bg-secondary text-text-primary hover:bg-bg-hover active:scale-95'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleFeatureTag(tag)}
                              className="sr-only"
                              aria-label={`${isSelected ? 'Remove' : 'Add'} ${formatFeatureTag(tag)} filter`}
                            />
                            {formatFeatureTag(tag)}
                            {isSelected && (
                              <span className="ml-1" aria-hidden="true">
                                &#10003;
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </fieldset>
            );
          })}
        </div>
      </div>

      {/* Clear All Button */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearAllFilters}
          className="flex items-center gap-xs px-3 py-2 min-h-[44px] text-sm text-error hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-error rounded"
          aria-label="Clear all mobile filters"
        >
          <X size={14} aria-hidden="true" />
          Clear Mobile Filters
        </button>
      )}
    </div>
  );
}
