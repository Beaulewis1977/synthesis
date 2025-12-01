import type { KnowledgeEdge, KnowledgeNode, KnowledgeNodeType } from '@synthesis/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D, {
  type ForceGraphMethods,
  type LinkObject,
  type NodeObject,
} from 'react-force-graph-2d';

/**
 * Node type to color mapping (hex colors)
 * Matches NodeList component colors for consistency
 */
const NODE_TYPE_COLORS: Record<KnowledgeNodeType, string> = {
  document: '#3B82F6', // blue
  chunk: '#6B7280', // gray
  symbol: '#8B5CF6', // purple
  endpoint: '#10B981', // green
  table: '#F97316', // orange
  column: '#EAB308', // yellow
  config_section: '#EC4899', // pink
};

/**
 * Selection highlight color for selected nodes
 */
const SELECTED_NODE_COLOR = '#EF4444'; // red ring

/**
 * Graph node with additional properties for react-force-graph-2d
 */
interface GraphNode extends NodeObject {
  id: string;
  name: string;
  nodeType: KnowledgeNodeType;
  originalNode: KnowledgeNode;
}

/**
 * Graph link with additional properties for react-force-graph-2d
 */
interface GraphLink extends LinkObject {
  source: string;
  target: string;
  edgeType: string;
  originalEdge: KnowledgeEdge;
}

/**
 * Force graph data structure
 */
interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface GraphVisualizationProps {
  /** Knowledge graph nodes to display */
  nodes: KnowledgeNode[];
  /** Knowledge graph edges to display */
  edges: KnowledgeEdge[];
  /** Currently selected node ID */
  selectedNodeId?: string;
  /** Callback when a node is clicked (null for background click) */
  onNodeClick: (node: KnowledgeNode | null) => void;
  /** Height of the graph canvas in pixels */
  height?: number;
}

/**
 * Truncate text to a maximum length with ellipsis
 */
function truncateLabel(text: string, maxLength = 20): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * GraphVisualization component for rendering knowledge graphs
 * using react-force-graph-2d with custom node rendering and interactions.
 */
export function GraphVisualization({
  nodes,
  edges,
  selectedNodeId,
  onNodeClick,
  height = 500,
}: GraphVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const [containerWidth, setContainerWidth] = useState<number>(800);

  // Track container width with ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      setContainerWidth(container.clientWidth);
    };

    // Initial width
    updateWidth();

    // Create ResizeObserver for responsive sizing
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Transform KnowledgeNode/Edge to ForceGraphData format
  const graphData: GraphData = useMemo(() => {
    // Create a Set of valid node IDs for edge validation
    const nodeIds = new Set(nodes.map((n) => n.id));

    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        name: n.name,
        nodeType: n.node_type,
        originalNode: n,
      })),
      links: edges
        // Only include edges where both source and target nodes exist
        .filter((e) => nodeIds.has(e.source_node_id) && nodeIds.has(e.target_node_id))
        .map((e) => ({
          source: e.source_node_id,
          target: e.target_node_id,
          edgeType: e.edge_type,
          originalEdge: e,
        })),
    };
  }, [nodes, edges]);

  // Custom node rendering with labels
  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = truncateLabel(node.name);
      const fontSize = Math.max(12 / globalScale, 4);
      const nodeRadius = 6;
      const isSelected = node.id === selectedNodeId;

      // Get position (with fallback)
      const x = node.x ?? 0;
      const y = node.y ?? 0;

      // Draw selection ring if selected
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, nodeRadius + 3, 0, 2 * Math.PI);
        ctx.strokeStyle = SELECTED_NODE_COLOR;
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }

      // Draw node circle
      ctx.beginPath();
      ctx.arc(x, y, nodeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = NODE_TYPE_COLORS[node.nodeType] || '#6B7280';
      ctx.fill();

      // Draw node border
      ctx.strokeStyle = '#1F2937'; // gray-800
      ctx.lineWidth = 1 / globalScale;
      ctx.stroke();

      // Draw label below node
      ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      // Draw text shadow for readability
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      const textY = y + nodeRadius + 2;
      ctx.fillText(label, x + 0.5, textY + 0.5);
      ctx.fillText(label, x - 0.5, textY + 0.5);
      ctx.fillText(label, x + 0.5, textY - 0.5);
      ctx.fillText(label, x - 0.5, textY - 0.5);

      // Draw actual text
      ctx.fillStyle = '#1F2937'; // gray-800
      ctx.fillText(label, x, textY);
    },
    [selectedNodeId]
  );

  // Handle node click
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      onNodeClick(node.originalNode);
    },
    [onNodeClick]
  );

  // Handle background click to deselect
  const handleBackgroundClick = useCallback(() => {
    onNodeClick(null);
  }, [onNodeClick]);

  // Zoom to fit when data changes
  useEffect(() => {
    if (graphRef.current && nodes.length > 0) {
      // Allow time for force simulation to settle
      const timer = setTimeout(() => {
        graphRef.current?.zoomToFit(400, 50);
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [nodes.length]);

  // Empty state
  if (nodes.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg"
        style={{ height }}
        role="img"
        aria-label="Empty knowledge graph"
      >
        <div className="text-center text-gray-500">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
            />
          </svg>
          <p className="mt-2 text-sm font-medium">No graph data</p>
          <p className="mt-1 text-xs">Add nodes to visualize the knowledge graph</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative bg-white border border-gray-200 rounded-lg overflow-hidden"
      style={{ height }}
      role="img"
      aria-label={`Knowledge graph with ${nodes.length} nodes and ${edges.length} edges`}
    >
      <ForceGraph2D<GraphNode, GraphLink>
        ref={graphRef}
        graphData={graphData}
        width={containerWidth}
        height={height}
        // Node rendering
        nodeCanvasObject={nodeCanvasObject}
        nodeCanvasObjectMode={() => 'replace'}
        nodeRelSize={6}
        // Link/Edge rendering
        linkColor={() => '#9CA3AF'} // gray-400
        linkWidth={1.5}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.1}
        // Interactions
        onNodeClick={handleNodeClick}
        onBackgroundClick={handleBackgroundClick}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        enableNodeDrag={true}
        // Force simulation
        cooldownTicks={100}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        // Performance
        warmupTicks={50}
        minZoom={0.5}
        maxZoom={4}
      />

      {/* Legend */}
      <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm rounded-md shadow-sm border border-gray-200 p-2">
        <div className="text-xs font-medium text-gray-700 mb-1">Node Types</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          {Object.entries(NODE_TYPE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <span className="text-xs text-gray-600 capitalize">{type.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Zoom controls hint */}
      <div className="absolute top-2 right-2 text-xs text-gray-500 bg-white/80 px-2 py-1 rounded">
        Scroll to zoom, drag to pan
      </div>
    </div>
  );
}

export default GraphVisualization;
