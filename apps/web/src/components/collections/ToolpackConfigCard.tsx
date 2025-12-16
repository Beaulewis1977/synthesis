/**
 * ToolpackConfigCard Component
 *
 * Card for configuring which toolpacks are enabled for a collection.
 * Gateway is always enabled and cannot be disabled.
 * Changes are debounced and saved automatically.
 */

import { Check, Loader2, Lock, Package } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { ToolpackConfig, ToolpackName } from '../../types';

// =============================================================================
// Toolpack Metadata
// =============================================================================

interface ToolpackMeta {
  displayName: string;
  description: string;
  toolCount: number;
  isLocked: boolean;
}

const TOOLPACK_META: Record<ToolpackName, ToolpackMeta> = {
  gateway: {
    displayName: 'Gateway',
    description: 'Tool discovery and management (always enabled)',
    toolCount: 2,
    isLocked: true,
  },
  core: {
    displayName: 'Core',
    description: 'Search, documents, collections, repos',
    toolCount: 14,
    isLocked: false,
  },
  mobile_core: {
    displayName: 'Mobile',
    description: 'Mobile docs search, code examples, recipes',
    toolCount: 3,
    isLocked: false,
  },
  introspection: {
    displayName: 'Introspection',
    description: 'Tech stack analysis, DB schema, symbol search',
    toolCount: 3,
    isLocked: false,
  },
  graphing: {
    displayName: 'Graphing',
    description: 'Knowledge graph traversal and expansion',
    toolCount: 1,
    isLocked: false,
  },
  web: {
    displayName: 'Web Search',
    description: 'Search web via Perplexity AI',
    toolCount: 1,
    isLocked: false,
  },
  orchestration: {
    displayName: 'Orchestration',
    description: 'Subagents and skills management',
    toolCount: 4,
    isLocked: false,
  },
};

// Order for display
const TOOLPACK_ORDER: ToolpackName[] = [
  'gateway',
  'core',
  'web',
  'orchestration',
  'mobile_core',
  'introspection',
  'graphing',
];

// =============================================================================
// Component Props
// =============================================================================

interface ToolpackConfigCardProps {
  config: ToolpackConfig;
  onUpdate: (toolpacks: ToolpackName[]) => void;
  isUpdating?: boolean;
  error?: string | null;
}

// =============================================================================
// Component
// =============================================================================

export function ToolpackConfigCard({
  config,
  onUpdate,
  isUpdating = false,
  error = null,
}: ToolpackConfigCardProps) {
  // Local state for immediate UI feedback
  const [localToolpacks, setLocalToolpacks] = useState<Set<ToolpackName>>(
    new Set(config.toolpacks)
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Reset when server config changes
  useEffect(() => {
    setLocalToolpacks(new Set(config.toolpacks));
    setHasChanges(false);
  }, [config.toolpacks]);

  // Track changes
  useEffect(() => {
    const serverSet = new Set(config.toolpacks);
    const changed =
      localToolpacks.size !== serverSet.size || [...localToolpacks].some((t) => !serverSet.has(t));
    setHasChanges(changed);
  }, [localToolpacks, config.toolpacks]);

  // Debounced save
  const debouncedSave = useCallback(
    (newToolpacks: Set<ToolpackName>) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      const timer = setTimeout(() => {
        onUpdate([...newToolpacks]);
      }, 300);

      setDebounceTimer(timer);
    },
    [onUpdate, debounceTimer]
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  // Toggle toolpack
  const handleToggle = (toolpack: ToolpackName) => {
    if (TOOLPACK_META[toolpack].isLocked) {
      return; // Can't toggle locked toolpacks
    }

    const newToolpacks = new Set(localToolpacks);
    if (newToolpacks.has(toolpack)) {
      newToolpacks.delete(toolpack);
    } else {
      newToolpacks.add(toolpack);
    }

    // Ensure gateway is always present
    newToolpacks.add('gateway');

    setLocalToolpacks(newToolpacks);
    debouncedSave(newToolpacks);
  };

  // Calculate total enabled tools
  const totalToolCount = [...localToolpacks].reduce(
    (sum, tp) => sum + (TOOLPACK_META[tp]?.toolCount ?? 0),
    0
  );

  return (
    <div
      className={`card transition-all ${
        hasChanges
          ? 'border-warning ring-1 ring-warning/20'
          : error
            ? 'border-error ring-1 ring-error/20'
            : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-md">
        <div className="flex items-center gap-sm">
          <Package size={18} className="text-accent" />
          <h3 className="text-md font-medium text-text-primary">Agent Toolpacks</h3>
          {isUpdating && <Loader2 size={14} className="animate-spin text-text-secondary" />}
          {hasChanges && !isUpdating && (
            <span className="text-xs px-xs py-0.5 rounded bg-warning/10 text-warning">
              saving...
            </span>
          )}
        </div>
        <span className="text-xs text-text-secondary">{totalToolCount} tools enabled</span>
      </div>

      {/* Description */}
      <p className="text-sm text-text-secondary mb-md">
        Configure which tool categories are available in chat. More tools = more capabilities, but
        larger context.
      </p>

      {/* Toolpack Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
        {TOOLPACK_ORDER.map((toolpack) => {
          const meta = TOOLPACK_META[toolpack];
          const isEnabled = localToolpacks.has(toolpack);

          return (
            <button
              key={toolpack}
              type="button"
              onClick={() => handleToggle(toolpack)}
              disabled={meta.isLocked || isUpdating}
              className={`
                p-sm rounded border text-left transition-all
                ${
                  isEnabled
                    ? 'border-accent bg-accent/5'
                    : 'border-border bg-surface hover:border-border-hover'
                }
                ${meta.isLocked ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}
                ${isUpdating ? 'opacity-50' : ''}
              `}
            >
              <div className="flex items-start justify-between gap-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-xs">
                    <span className="font-medium text-sm text-text-primary">
                      {meta.displayName}
                    </span>
                    {meta.isLocked && <Lock size={12} className="text-text-secondary" />}
                  </div>
                  <p className="text-xs text-text-secondary mt-xs line-clamp-2">
                    {meta.description}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-xs">
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center ${
                      isEnabled ? 'bg-accent text-white' : 'border border-border'
                    }`}
                  >
                    {isEnabled && <Check size={12} />}
                  </div>
                  <span className="text-xs text-text-secondary">{meta.toolCount} tools</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-md p-sm bg-error/10 border border-error/30 rounded text-xs text-error">
          {error}
        </div>
      )}
    </div>
  );
}
