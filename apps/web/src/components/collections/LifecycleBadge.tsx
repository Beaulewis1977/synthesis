/**
 * LifecycleBadge Component
 *
 * Displays the lifecycle status of a document with appropriate styling.
 * Used in DocumentList and document detail views.
 *
 * @module components/collections/LifecycleBadge
 * @since Phase 7: Collection Versioning
 */

import { Archive, CheckCircle2, GitMerge, History } from 'lucide-react';
import type { LifecycleStatus } from '../../types';

interface LifecycleBadgeProps {
  status: LifecycleStatus;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

const STATUS_CONFIG: Record<
  LifecycleStatus,
  {
    label: string;
    icon: typeof CheckCircle2;
    bgColor: string;
    textColor: string;
    borderColor: string;
  }
> = {
  active: {
    label: 'Active',
    icon: CheckCircle2,
    bgColor: 'bg-success/10',
    textColor: 'text-success',
    borderColor: 'border-success/30',
  },
  archived: {
    label: 'Archived',
    icon: Archive,
    bgColor: 'bg-warning/10',
    textColor: 'text-warning',
    borderColor: 'border-warning/30',
  },
  superseded: {
    label: 'Superseded',
    icon: History,
    bgColor: 'bg-text-secondary/10',
    textColor: 'text-text-secondary',
    borderColor: 'border-text-secondary/30',
  },
};

export function LifecycleBadge({ status, size = 'sm', showLabel = true }: LifecycleBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  const Icon = config.icon;

  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1';
  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${config.bgColor} ${config.textColor} ${config.borderColor} ${sizeClasses}`}
      title={`Document is ${config.label.toLowerCase()}`}
    >
      <Icon size={iconSize} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

/**
 * VersionBadge Component
 *
 * Displays the version information for a document.
 */
interface VersionBadgeProps {
  version?: string | null;
  frameworkVersion?: string | null;
  branch?: string | null;
  size?: 'sm' | 'md';
}

export function VersionBadge({
  version,
  frameworkVersion,
  branch,
  size = 'sm',
}: VersionBadgeProps) {
  const displayVersion = version || frameworkVersion;

  if (!displayVersion && !branch) {
    return null;
  }

  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1';
  const iconSize = size === 'sm' ? 10 : 12;

  return (
    <div className="flex items-center gap-1">
      {displayVersion && (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent border border-accent/30 ${sizeClasses}`}
          title={frameworkVersion ? `Framework: ${frameworkVersion}` : `Version: ${version}`}
        >
          <GitMerge size={iconSize} />
          <span>{displayVersion}</span>
        </span>
      )}
      {branch && (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-bg-tertiary text-text-secondary border border-border ${sizeClasses}`}
          title={`Branch: ${branch}`}
        >
          <span className="font-mono">{branch}</span>
        </span>
      )}
    </div>
  );
}

/**
 * SupersededByLink Component
 *
 * Shows a link to the document that superseded this one.
 */
interface SupersededByLinkProps {
  supersededById: string;
  onClick?: (supersededById: string) => void;
}

export function SupersededByLink({ supersededById, onClick }: SupersededByLinkProps) {
  const handleClick = () => {
    if (onClick) {
      onClick(supersededById);
    }
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
      title="View the document that superseded this one"
    >
      <History size={12} />
      <span>Superseded by newer version</span>
    </button>
  );
}
