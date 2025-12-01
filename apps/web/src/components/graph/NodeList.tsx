import type { KnowledgeNode, KnowledgeNodeType } from '@synthesis/shared';
import { Box, Code, Columns, Database, FileText, Link2, Search, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

/**
 * Props for the NodeList component
 */
interface NodeListProps {
  /** Array of knowledge graph nodes to display */
  nodes: KnowledgeNode[];
  /** ID of the currently selected node (if any) */
  selectedNodeId?: string;
  /** Callback when a node is selected */
  onSelectNode: (node: KnowledgeNode) => void;
}

/**
 * Mapping from node type to Lucide icon component
 */
const NODE_TYPE_ICONS: Record<KnowledgeNodeType, LucideIcon> = {
  document: FileText,
  chunk: Box,
  symbol: Code,
  endpoint: Link2,
  table: Database,
  column: Columns,
  config_section: Settings,
};

/**
 * Mapping from node type to Tailwind color classes for badges
 */
const NODE_TYPE_COLORS: Record<KnowledgeNodeType, string> = {
  document: 'bg-blue-100 text-blue-800',
  chunk: 'bg-gray-100 text-gray-800',
  symbol: 'bg-purple-100 text-purple-800',
  endpoint: 'bg-green-100 text-green-800',
  table: 'bg-orange-100 text-orange-800',
  column: 'bg-yellow-100 text-yellow-800',
  config_section: 'bg-pink-100 text-pink-800',
};

/**
 * Human-readable labels for node types
 */
const NODE_TYPE_LABELS: Record<KnowledgeNodeType, string> = {
  document: 'Document',
  chunk: 'Chunk',
  symbol: 'Symbol',
  endpoint: 'Endpoint',
  table: 'Table',
  column: 'Column',
  config_section: 'Config',
};

/**
 * NodeList component for the Graph Debug UI
 *
 * Displays a searchable, filterable list of knowledge graph nodes.
 * Supports:
 * - Case-insensitive search by node name
 * - Filter by node type (only shows types present in data)
 * - Visual type indicators with icons and colored badges
 * - Click-to-select with highlight state
 * - Keyboard accessible focus states
 *
 * @example
 * ```tsx
 * <NodeList
 *   nodes={graphNodes}
 *   selectedNodeId={selectedId}
 *   onSelectNode={(node) => setSelectedId(node.id)}
 * />
 * ```
 */
export function NodeList({ nodes, selectedNodeId, onSelectNode }: NodeListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTypeFilters, setActiveTypeFilters] = useState<Set<KnowledgeNodeType>>(new Set());

  // Extract unique node types present in the data
  const availableTypes = useMemo(() => {
    const types = new Set<KnowledgeNodeType>();
    for (const node of nodes) {
      types.add(node.node_type);
    }
    return Array.from(types).sort();
  }, [nodes]);

  // Filter nodes based on search query and type filters
  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      // Check search query match (case-insensitive)
      const matchesSearch =
        searchQuery === '' || node.name.toLowerCase().includes(searchQuery.toLowerCase());

      // Check type filter match (if no filters active, show all)
      const matchesType = activeTypeFilters.size === 0 || activeTypeFilters.has(node.node_type);

      return matchesSearch && matchesType;
    });
  }, [nodes, searchQuery, activeTypeFilters]);

  // Toggle a type filter
  const toggleTypeFilter = (type: KnowledgeNodeType) => {
    setActiveTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setActiveTypeFilters(new Set());
  };

  const hasActiveFilters = searchQuery !== '' || activeTypeFilters.size > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Search Input */}
      <div className="p-md border-b border-border">
        <label htmlFor="node-search" className="sr-only">
          Search nodes by name
        </label>
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
            aria-hidden="true"
          />
          <input
            id="node-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search nodes..."
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-bg-primary text-text-primary placeholder:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
      </div>

      {/* Type Filter Chips */}
      {availableTypes.length > 0 && (
        <div className="p-md border-b border-border">
          <fieldset>
            <legend className="sr-only">Filter by node type</legend>
            <div className="flex flex-wrap gap-2">
              {availableTypes.map((type) => {
                const isActive = activeTypeFilters.has(type);
                const Icon = NODE_TYPE_ICONS[type];
                const count = nodes.filter((n) => n.node_type === type).length;

                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleTypeFilter(type)}
                    aria-pressed={isActive}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-full transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${
                      isActive
                        ? `${NODE_TYPE_COLORS[type]} ring-2 ring-offset-1 ring-current`
                        : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                    }`}
                  >
                    <Icon size={12} aria-hidden="true" />
                    <span>{NODE_TYPE_LABELS[type]}</span>
                    <span
                      className={`px-1.5 py-0.5 text-[10px] rounded-full ${
                        isActive ? 'bg-white/30' : 'bg-bg-hover'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-2 text-xs text-text-secondary hover:text-text-primary underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Node List */}
      <div className="flex-1 overflow-y-auto" aria-label="Knowledge graph nodes">
        {filteredNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-lg text-center">
            <Search size={32} className="text-text-secondary mb-md" aria-hidden="true" />
            <p className="text-sm text-text-secondary">
              {nodes.length === 0 ? 'No nodes in the graph' : 'No nodes match your search criteria'}
            </p>
            {hasActiveFilters && nodes.length > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-sm text-sm text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filteredNodes.map((node) => {
              const Icon = NODE_TYPE_ICONS[node.node_type];
              const isSelected = node.id === selectedNodeId;

              return (
                <li key={node.id}>
                  <button
                    type="button"
                    onClick={() => onSelectNode(node)}
                    aria-selected={isSelected}
                    className={`w-full flex items-center gap-md p-md text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset ${
                      isSelected
                        ? 'bg-accent/10 border-l-2 border-l-accent'
                        : 'hover:bg-bg-secondary border-l-2 border-l-transparent'
                    }`}
                  >
                    {/* Type Icon */}
                    <div
                      className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg ${NODE_TYPE_COLORS[node.node_type]}`}
                    >
                      <Icon size={16} aria-hidden="true" />
                    </div>

                    {/* Node Info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${
                          isSelected ? 'text-text-primary' : 'text-text-primary'
                        }`}
                      >
                        {node.name}
                      </p>
                      <p className="text-xs text-text-secondary truncate">
                        {NODE_TYPE_LABELS[node.node_type]}
                        {node.document_id && ' \u2022 Linked to document'}
                      </p>
                    </div>

                    {/* Type Badge */}
                    <span
                      className={`flex-shrink-0 px-2 py-0.5 text-[10px] font-medium rounded-full uppercase tracking-wide ${NODE_TYPE_COLORS[node.node_type]}`}
                    >
                      {node.node_type.replace('_', ' ')}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Results Count */}
      {nodes.length > 0 && (
        <div className="p-sm border-t border-border text-xs text-text-secondary text-center">
          {filteredNodes.length === nodes.length
            ? `${nodes.length} node${nodes.length !== 1 ? 's' : ''}`
            : `${filteredNodes.length} of ${nodes.length} node${nodes.length !== 1 ? 's' : ''}`}
        </div>
      )}
    </div>
  );
}

export default NodeList;
