import type { KnowledgeEdge, KnowledgeEdgeType, KnowledgeNode } from '@synthesis/shared';
import { ArrowRight } from 'lucide-react';
import { useMemo, useState } from 'react';

interface EdgeListProps {
  edges: KnowledgeEdge[];
  nodes: KnowledgeNode[];
  selectedEdgeId?: string;
  onSelectEdge: (edge: KnowledgeEdge) => void;
}

/**
 * Edge type to Tailwind color class mapping.
 * Each edge type has distinct background and text colors for visual differentiation.
 */
const EDGE_TYPE_COLORS: Record<KnowledgeEdgeType, string> = {
  calls: 'bg-blue-100 text-blue-800',
  defines: 'bg-purple-100 text-purple-800',
  belongs_to: 'bg-gray-100 text-gray-800',
  persists_to: 'bg-green-100 text-green-800',
  configured_by: 'bg-pink-100 text-pink-800',
  documents: 'bg-yellow-100 text-yellow-800',
  imports: 'bg-orange-100 text-orange-800',
  depends_on: 'bg-red-100 text-red-800',
};

/**
 * Human-readable labels for edge types.
 */
const EDGE_TYPE_LABELS: Record<KnowledgeEdgeType, string> = {
  calls: 'Calls',
  defines: 'Defines',
  belongs_to: 'Belongs To',
  persists_to: 'Persists To',
  configured_by: 'Configured By',
  documents: 'Documents',
  imports: 'Imports',
  depends_on: 'Depends On',
};

/**
 * EdgeList component for displaying and filtering knowledge graph edges.
 *
 * Features:
 * - Filter chips for edge types (only shows types present in data)
 * - Clickable edge list with source -> type -> target display
 * - Selected edge highlighting
 * - Empty state when no edges match filters
 */
export function EdgeList({ edges, nodes, selectedEdgeId, onSelectEdge }: EdgeListProps) {
  const [selectedTypes, setSelectedTypes] = useState<Set<KnowledgeEdgeType>>(new Set());

  // Build node lookup map by id for O(1) name resolution
  const nodeMap = useMemo(() => {
    const map = new Map<string, KnowledgeNode>();
    for (const node of nodes) {
      map.set(node.id, node);
    }
    return map;
  }, [nodes]);

  // Get unique edge types present in the data
  const presentEdgeTypes = useMemo(() => {
    const types = new Set<KnowledgeEdgeType>();
    for (const edge of edges) {
      types.add(edge.edge_type);
    }
    return Array.from(types).sort();
  }, [edges]);

  // Filter edges by selected types
  const filteredEdges = useMemo(() => {
    if (selectedTypes.size === 0) {
      return edges;
    }
    return edges.filter((edge) => selectedTypes.has(edge.edge_type));
  }, [edges, selectedTypes]);

  // Toggle a filter type
  const toggleType = (type: KnowledgeEdgeType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // Get node name by id, with fallback
  const getNodeName = (nodeId: string): string => {
    const node = nodeMap.get(nodeId);
    return node?.name ?? 'Unknown';
  };

  // Handle keyboard navigation for edge items
  const handleKeyDown = (event: React.KeyboardEvent, edge: KnowledgeEdge) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectEdge(edge);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filter Chips */}
      {presentEdgeTypes.length > 0 && (
        <div className="px-md pt-md pb-sm border-b border-border">
          <fieldset>
            <legend className="text-xs font-medium text-text-secondary mb-sm">
              Filter by Type
            </legend>
            <div className="flex flex-wrap gap-xs">
              {presentEdgeTypes.map((type) => {
                const isActive = selectedTypes.has(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleType(type)}
                    aria-pressed={isActive}
                    className={`px-2 py-1 text-xs font-medium rounded-full transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${
                      isActive
                        ? `${EDGE_TYPE_COLORS[type]} ring-2 ring-offset-1 ring-current`
                        : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'
                    }`}
                  >
                    {EDGE_TYPE_LABELS[type]}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
      )}

      {/* Edge List */}
      <div className="flex-1 overflow-y-auto" aria-label="Knowledge graph edges">
        {filteredEdges.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-text-secondary text-sm">
            {edges.length === 0 ? 'No edges in this graph' : 'No edges match the selected filters'}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filteredEdges.map((edge) => {
              const isSelected = edge.id === selectedEdgeId;
              const sourceName = getNodeName(edge.source_node_id);
              const targetName = getNodeName(edge.target_node_id);

              return (
                <li key={edge.id}>
                  <button
                    type="button"
                    onClick={() => onSelectEdge(edge)}
                    onKeyDown={(e) => handleKeyDown(e, edge)}
                    className={`w-full px-md py-sm text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset ${
                      isSelected ? 'bg-accent/10 border-l-2 border-l-accent' : 'hover:bg-bg-hover'
                    }`}
                    aria-selected={isSelected}
                    aria-label={`Edge from ${sourceName} ${edge.edge_type.replace(/_/g, ' ')} ${targetName}`}
                  >
                    <div className="flex items-center gap-sm min-w-0">
                      {/* Source Node */}
                      <span
                        className="text-sm font-medium text-text-primary truncate max-w-[120px]"
                        title={sourceName}
                      >
                        {sourceName}
                      </span>

                      {/* Arrow */}
                      <ArrowRight
                        size={14}
                        className="flex-shrink-0 text-text-secondary"
                        aria-hidden="true"
                      />

                      {/* Edge Type Badge */}
                      <span
                        className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded ${EDGE_TYPE_COLORS[edge.edge_type]}`}
                      >
                        {EDGE_TYPE_LABELS[edge.edge_type]}
                      </span>

                      {/* Arrow */}
                      <ArrowRight
                        size={14}
                        className="flex-shrink-0 text-text-secondary"
                        aria-hidden="true"
                      />

                      {/* Target Node */}
                      <span
                        className="text-sm font-medium text-text-primary truncate max-w-[120px]"
                        title={targetName}
                      >
                        {targetName}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer with count */}
      <div className="px-md py-sm border-t border-border bg-bg-secondary">
        <span className="text-xs text-text-secondary">
          {filteredEdges.length} of {edges.length} edge{edges.length !== 1 ? 's' : ''}
          {selectedTypes.size > 0 && (
            <button
              type="button"
              onClick={() => setSelectedTypes(new Set())}
              className="ml-2 text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
            >
              Clear filters
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

export default EdgeList;
