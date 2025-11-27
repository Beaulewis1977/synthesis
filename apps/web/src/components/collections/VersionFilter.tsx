/**
 * VersionFilter Component
 *
 * Provides filtering controls for document lifecycle status and framework versions.
 * Used in CollectionView to filter documents by their versioning state.
 *
 * @module components/collections/VersionFilter
 * @since Phase 7: Collection Versioning
 */

import { useQuery } from '@tanstack/react-query';
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  Filter,
  GitBranch,
  History,
  Layers,
  RefreshCw,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { apiClient } from '../../lib/api';
import type { FrameworkVersionInfo, LifecycleStatus } from '../../types';

interface VersionFilterProps {
  collectionId: string;
  selectedStatus: LifecycleStatus | 'all';
  selectedFrameworkVersion: string | null;
  onStatusChange: (status: LifecycleStatus | 'all') => void;
  onFrameworkVersionChange: (version: string | null) => void;
}

const STATUS_OPTIONS: Array<{
  value: LifecycleStatus | 'all';
  label: string;
  icon: typeof CheckCircle2;
  color: string;
}> = [
  { value: 'all', label: 'All Documents', icon: Layers, color: 'text-text-secondary' },
  { value: 'active', label: 'Active', icon: CheckCircle2, color: 'text-success' },
  { value: 'archived', label: 'Archived', icon: Archive, color: 'text-warning' },
  { value: 'superseded', label: 'Superseded', icon: History, color: 'text-text-secondary' },
];

export function VersionFilter({
  collectionId,
  selectedStatus,
  selectedFrameworkVersion,
  onStatusChange,
  onFrameworkVersionChange,
}: VersionFilterProps) {
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);

  // Fetch framework versions for this collection
  const { data: versionsData, isLoading: versionsLoading } = useQuery({
    queryKey: ['framework-versions', collectionId],
    queryFn: () => apiClient.getFrameworkVersions(collectionId),
    enabled: !!collectionId,
  });

  // Fetch version stats for this collection
  const { data: statsData } = useQuery({
    queryKey: ['version-stats', collectionId],
    queryFn: () => apiClient.getCollectionVersionStats(collectionId),
    enabled: !!collectionId,
  });

  const frameworkVersions = versionsData?.framework_versions || [];
  const hasFilters = selectedStatus !== 'all' || selectedFrameworkVersion !== null;

  const clearFilters = () => {
    onStatusChange('all');
    onFrameworkVersionChange(null);
  };

  const selectedStatusOption =
    STATUS_OPTIONS.find((opt) => opt.value === selectedStatus) || STATUS_OPTIONS[0];
  const StatusIcon = selectedStatusOption.icon;

  return (
    <div className="flex flex-wrap items-center gap-sm">
      {/* Status Filter */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setShowStatusDropdown(!showStatusDropdown);
            setShowVersionDropdown(false);
          }}
          className={`flex items-center gap-xs px-3 py-1.5 rounded-lg border transition-colors text-sm ${
            selectedStatus !== 'all'
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border bg-bg-secondary hover:bg-bg-tertiary text-text-secondary'
          }`}
        >
          <StatusIcon size={16} className={selectedStatusOption.color} />
          <span>{selectedStatusOption.label}</span>
          <ChevronDown
            size={14}
            className={
              showStatusDropdown ? 'rotate-180 transition-transform' : 'transition-transform'
            }
          />
        </button>

        {showStatusDropdown && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowStatusDropdown(false)}
              onKeyDown={(e) => e.key === 'Escape' && setShowStatusDropdown(false)}
              role="button"
              tabIndex={-1}
              aria-label="Close dropdown"
            />
            <div className="absolute top-full left-0 mt-1 w-48 bg-bg-primary border border-border rounded-lg shadow-lg z-20 py-1">
              {STATUS_OPTIONS.map((option) => {
                const Icon = option.icon;
                const count = statsData
                  ? option.value === 'all'
                    ? statsData.total_documents
                    : option.value === 'active'
                      ? statsData.active_documents
                      : option.value === 'archived'
                        ? statsData.archived_documents
                        : statsData.superseded_documents
                  : null;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onStatusChange(option.value);
                      setShowStatusDropdown(false);
                    }}
                    className={`w-full flex items-center justify-between gap-sm px-3 py-2 text-sm hover:bg-bg-secondary transition-colors ${
                      selectedStatus === option.value
                        ? 'bg-accent/10 text-accent'
                        : 'text-text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-sm">
                      <Icon size={16} className={option.color} />
                      <span>{option.label}</span>
                    </div>
                    {count !== null && (
                      <span className="text-xs text-text-secondary bg-bg-tertiary px-1.5 py-0.5 rounded">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Framework Version Filter */}
      {frameworkVersions.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowVersionDropdown(!showVersionDropdown);
              setShowStatusDropdown(false);
            }}
            className={`flex items-center gap-xs px-3 py-1.5 rounded-lg border transition-colors text-sm ${
              selectedFrameworkVersion
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border bg-bg-secondary hover:bg-bg-tertiary text-text-secondary'
            }`}
          >
            <GitBranch size={16} />
            <span>{selectedFrameworkVersion || 'All Versions'}</span>
            <ChevronDown
              size={14}
              className={
                showVersionDropdown ? 'rotate-180 transition-transform' : 'transition-transform'
              }
            />
          </button>

          {showVersionDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowVersionDropdown(false)}
                onKeyDown={(e) => e.key === 'Escape' && setShowVersionDropdown(false)}
                role="button"
                tabIndex={-1}
                aria-label="Close dropdown"
              />
              <div className="absolute top-full left-0 mt-1 w-56 bg-bg-primary border border-border rounded-lg shadow-lg z-20 py-1 max-h-64 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    onFrameworkVersionChange(null);
                    setShowVersionDropdown(false);
                  }}
                  className={`w-full flex items-center justify-between gap-sm px-3 py-2 text-sm hover:bg-bg-secondary transition-colors ${
                    !selectedFrameworkVersion ? 'bg-accent/10 text-accent' : 'text-text-primary'
                  }`}
                >
                  <span>All Versions</span>
                </button>
                <div className="border-t border-border my-1" />
                {versionsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <RefreshCw size={16} className="animate-spin text-text-secondary" />
                  </div>
                ) : (
                  frameworkVersions.map((version: FrameworkVersionInfo) => (
                    <button
                      key={version.framework_version}
                      type="button"
                      onClick={() => {
                        onFrameworkVersionChange(version.framework_version);
                        setShowVersionDropdown(false);
                      }}
                      className={`w-full flex items-center justify-between gap-sm px-3 py-2 text-sm hover:bg-bg-secondary transition-colors ${
                        selectedFrameworkVersion === version.framework_version
                          ? 'bg-accent/10 text-accent'
                          : 'text-text-primary'
                      }`}
                    >
                      <span className="truncate">{version.framework_version}</span>
                      <div className="flex items-center gap-xs text-xs">
                        <span className="text-success">{version.active_count}</span>
                        <span className="text-text-secondary">/</span>
                        <span className="text-text-secondary">{version.document_count}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Clear Filters Button */}
      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="flex items-center gap-xs px-2 py-1.5 text-sm text-text-secondary hover:text-error transition-colors"
          title="Clear all filters"
        >
          <X size={14} />
          <span>Clear</span>
        </button>
      )}

      {/* Filter indicator */}
      {hasFilters && (
        <div className="flex items-center gap-xs text-xs text-accent">
          <Filter size={12} />
          <span>Filtered</span>
        </div>
      )}
    </div>
  );
}

/**
 * VersionStats Component
 *
 * Displays version statistics summary for a collection.
 */
interface VersionStatsProps {
  collectionId: string;
}

export function VersionStats({ collectionId }: VersionStatsProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['version-stats', collectionId],
    queryFn: () => apiClient.getCollectionVersionStats(collectionId),
    enabled: !!collectionId,
  });

  if (isLoading || !stats) {
    return null;
  }

  return (
    <div className="flex items-center gap-md text-sm">
      <div className="flex items-center gap-xs">
        <CheckCircle2 size={14} className="text-success" />
        <span className="text-text-secondary">{stats.active_documents} active</span>
      </div>
      {stats.archived_documents > 0 && (
        <div className="flex items-center gap-xs">
          <Archive size={14} className="text-warning" />
          <span className="text-text-secondary">{stats.archived_documents} archived</span>
        </div>
      )}
      {stats.superseded_documents > 0 && (
        <div className="flex items-center gap-xs">
          <History size={14} className="text-text-secondary" />
          <span className="text-text-secondary">{stats.superseded_documents} superseded</span>
        </div>
      )}
    </div>
  );
}
