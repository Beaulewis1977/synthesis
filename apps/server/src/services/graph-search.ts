/**
 * GPT Phase 2 Sub-Phase 3.3: Graph Retrieval Service
 *
 * Implements BFS traversal from seed nodes to connected nodes
 * for context expansion in RAG queries.
 */

import { performance } from 'node:perf_hooks';
import {
  type GraphStats,
  type KnowledgeEdgeRow,
  type KnowledgeEdgeType,
  type KnowledgeNodeRow,
  type KnowledgeNodeType,
  getGraphStats,
  getIncomingEdges,
  getNodeById,
  getNodeNeighbors,
  getNodesByChunk,
  getOutgoingEdges,
} from '@synthesis/db';
import type { Pool } from 'pg';
import { smartSearch } from './search.js';

// =============================================================================
// INTERFACES
// =============================================================================

export interface GraphSearchParams {
  collectionId: string;
  seedChunkIds?: number[];
  seedNodeIds?: string[];
  query?: string;
  maxDepth?: number;
  maxNodes?: number;
  edgeTypes?: KnowledgeEdgeType[];
  nodeTypes?: KnowledgeNodeType[];
}

export interface GraphChunk {
  id: number;
  text: string;
  doc_id: string;
  metadata: Record<string, unknown>;
  /** Distance (in hops) from the original seed nodes */
  hopDistance: number;
}

export interface GraphContextResult {
  nodes: KnowledgeNodeRow[];
  edges: KnowledgeEdgeRow[];
  chunks: GraphChunk[];
  stats: {
    nodesVisited: number;
    edgesTraversed: number;
    depthReached: number;
    durationMs: number;
  };
}

// =============================================================================
// CONFIG HELPERS
// =============================================================================

/**
 * Check if graph expansion is enabled via environment variable
 */
export function isGraphExpansionEnabled(): boolean {
  return process.env.ENABLE_GRAPH_EXPANSION === 'true';
}

/**
 * Get default max depth from environment or fallback to 3
 */
function getDefaultMaxDepth(): number {
  const val = Number.parseInt(process.env.GRAPH_MAX_DEPTH || '3', 10);
  return Number.isFinite(val) && val > 0 ? val : 3;
}

/**
 * Get default max nodes from environment or fallback to 50
 */
function getDefaultMaxNodes(): number {
  const val = Number.parseInt(process.env.GRAPH_MAX_NODES || '50', 10);
  return Number.isFinite(val) && val > 0 ? val : 50;
}

// =============================================================================
// MAIN GRAPH SEARCH FUNCTION
// =============================================================================

/**
 * Perform graph-based context retrieval starting from seed nodes.
 *
 * This function:
 * 1. Resolves seed nodes from chunk IDs, node IDs, or via semantic search
 * 2. Performs BFS traversal to find connected nodes within depth/node limits
 * 3. Collects edges between visited nodes
 * 4. Returns chunk text for nodes that have associated chunks
 *
 * @param db - PostgreSQL connection pool
 * @param params - Graph search parameters
 * @returns Graph context including nodes, edges, chunks, and stats
 */
export async function graphSearch(
  db: Pool,
  params: GraphSearchParams
): Promise<GraphContextResult> {
  const startTime = performance.now();
  const maxDepth = params.maxDepth ?? getDefaultMaxDepth();
  const maxNodes = params.maxNodes ?? getDefaultMaxNodes();

  // 1. Resolve seed nodes from various sources
  let seedNodeIds: string[] = params.seedNodeIds ? [...params.seedNodeIds] : [];

  // From chunk IDs - get nodes linked to those chunks
  if (params.seedChunkIds?.length) {
    for (const chunkId of params.seedChunkIds) {
      const nodes = await getNodesByChunk(chunkId);
      seedNodeIds.push(...nodes.map((n) => n.id));
    }
  }

  // From query via smartSearch - find relevant chunks, then their nodes
  // Skip if query is "*" (browse mode) or empty
  const isBrowseMode = !params.query || params.query === '*';
  if (params.query && !isBrowseMode && seedNodeIds.length === 0) {
    const searchResults = await smartSearch(db, {
      query: params.query,
      collectionId: params.collectionId,
      topK: 5,
      minSimilarity: 0.5,
    });
    for (const result of searchResults.results) {
      const nodes = await getNodesByChunk(result.id);
      seedNodeIds.push(...nodes.map((n) => n.id));
    }
  }

  // Dedupe seeds
  seedNodeIds = [...new Set(seedNodeIds)];

  // Browse mode: if no seeds but we have collectionId, get all nodes up to maxNodes
  if (seedNodeIds.length === 0 && params.collectionId && isBrowseMode) {
    const allNodesResult = await db.query(
      `SELECT id, collection_id, node_type, name, document_id, chunk_id, metadata, created_at
       FROM knowledge_nodes
       WHERE collection_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [params.collectionId, maxNodes]
    );

    const allNodes = allNodesResult.rows as KnowledgeNodeRow[];
    if (allNodes.length === 0) {
      return {
        nodes: [],
        edges: [],
        chunks: [],
        stats: {
          nodesVisited: 0,
          edgesTraversed: 0,
          depthReached: 0,
          durationMs: performance.now() - startTime,
        },
      };
    }

    // Get edges between these nodes
    const edges = await collectEdgesBetweenNodes(allNodes, params.edgeTypes);

    // Get chunks for nodes
    const chunks = await getChunksForNodes(db, allNodes);

    return {
      nodes: allNodes,
      edges,
      chunks,
      stats: {
        nodesVisited: allNodes.length,
        edgesTraversed: edges.length,
        depthReached: 0,
        durationMs: performance.now() - startTime,
      },
    };
  }

  // Return empty result if no seeds found and not in browse mode
  if (seedNodeIds.length === 0) {
    return {
      nodes: [],
      edges: [],
      chunks: [],
      stats: {
        nodesVisited: 0,
        edgesTraversed: 0,
        depthReached: 0,
        durationMs: performance.now() - startTime,
      },
    };
  }

  // 2. BFS traversal from seed nodes
  const { visitedNodes, maxDepthReached } = await bfsTraverse(
    seedNodeIds,
    maxDepth,
    maxNodes,
    params.edgeTypes,
    params.nodeTypes
  );

  // Extract just the nodes for edge collection
  const nodes = [...visitedNodes.values()].map((v) => v.node);

  // 3. Collect edges between visited nodes
  const edges = await collectEdgesBetweenNodes(nodes, params.edgeTypes);

  // 4. Get chunks for nodes that have chunk_id (with hop distance)
  const chunks = await getChunksForNodesWithDepth(db, visitedNodes);

  const durationMs = performance.now() - startTime;

  return {
    nodes,
    edges,
    chunks,
    stats: {
      nodesVisited: visitedNodes.size,
      edgesTraversed: edges.length,
      depthReached: maxDepthReached,
      durationMs,
    },
  };
}

// =============================================================================
// BFS TRAVERSAL
// =============================================================================

/** Node with its traversal depth */
interface NodeWithDepth {
  node: KnowledgeNodeRow;
  depth: number;
}

/**
 * Perform BFS traversal from seed nodes with depth and node limits.
 *
 * @param seedNodeIds - Starting node IDs
 * @param maxDepth - Maximum traversal depth
 * @param maxNodes - Maximum nodes to visit
 * @param edgeTypes - Optional edge type filter
 * @param nodeTypes - Optional node type filter
 * @returns Visited nodes map (with depth) and max depth reached
 */
async function bfsTraverse(
  seedNodeIds: string[],
  maxDepth: number,
  maxNodes: number,
  edgeTypes?: KnowledgeEdgeType[],
  nodeTypes?: KnowledgeNodeType[]
): Promise<{ visitedNodes: Map<string, NodeWithDepth>; maxDepthReached: number }> {
  const visited = new Map<string, NodeWithDepth>();
  const queue: Array<{ nodeId: string; depth: number }> = [];
  let maxDepthReached = 0;

  // Initialize queue with seed nodes
  for (const nodeId of seedNodeIds) {
    queue.push({ nodeId, depth: 0 });
  }

  while (queue.length > 0 && visited.size < maxNodes) {
    const item = queue.shift();
    if (!item) break;

    const { nodeId, depth } = item;

    // Skip if already visited
    if (visited.has(nodeId)) continue;

    // Fetch node from database
    const node = await getNodeById(nodeId);
    if (!node) continue;

    // Filter by node type if specified
    if (nodeTypes?.length && !nodeTypes.includes(node.node_type as KnowledgeNodeType)) {
      continue;
    }

    // Mark as visited with depth
    visited.set(nodeId, { node, depth });
    maxDepthReached = Math.max(maxDepthReached, depth);

    // Stop expanding if at max depth
    if (depth >= maxDepth) continue;

    // Get neighbors and add to queue
    const neighbors = await getNodeNeighbors(nodeId, edgeTypes);
    const allNeighbors = [...neighbors.outgoing, ...neighbors.incoming];

    for (const neighbor of allNeighbors) {
      if (!visited.has(neighbor.id) && visited.size < maxNodes) {
        queue.push({ nodeId: neighbor.id, depth: depth + 1 });
      }
    }
  }

  return { visitedNodes: visited, maxDepthReached };
}

// =============================================================================
// EDGE COLLECTION
// =============================================================================

/**
 * Collect all edges between visited nodes.
 *
 * Only includes edges where both endpoints are in the visited set,
 * ensuring the returned subgraph is consistent.
 *
 * @param nodes - Visited nodes
 * @param edgeTypes - Optional edge type filter
 * @returns Edges between visited nodes
 */
async function collectEdgesBetweenNodes(
  nodes: KnowledgeNodeRow[],
  edgeTypes?: KnowledgeEdgeType[]
): Promise<KnowledgeEdgeRow[]> {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: KnowledgeEdgeRow[] = [];
  const seenEdgeIds = new Set<string>();

  for (const node of nodes) {
    // Get all edges for this node (filter by first edge type if provided)
    // Note: getOutgoingEdges/getIncomingEdges only accept single edge type
    const filterType = edgeTypes?.[0];
    const outgoing = await getOutgoingEdges(node.id, filterType);
    const incoming = await getIncomingEdges(node.id, filterType);

    for (const edge of [...outgoing, ...incoming]) {
      // Only include edges where both endpoints are in visited set
      if (nodeIds.has(edge.source_node_id) && nodeIds.has(edge.target_node_id)) {
        if (!seenEdgeIds.has(edge.id)) {
          // Additional edge type filtering if multiple types specified
          if (!edgeTypes?.length || edgeTypes.includes(edge.edge_type as KnowledgeEdgeType)) {
            edges.push(edge);
            seenEdgeIds.add(edge.id);
          }
        }
      }
    }
  }

  return edges;
}

// =============================================================================
// CHUNK RETRIEVAL
// =============================================================================

/**
 * Get chunk text for nodes that have associated chunk_id, including hop distance.
 *
 * @param db - PostgreSQL connection pool
 * @param nodesWithDepth - Map of node IDs to nodes with their traversal depth
 * @returns Chunk data including id, text, metadata, and hop distance
 */
async function getChunksForNodesWithDepth(
  db: Pool,
  nodesWithDepth: Map<string, NodeWithDepth>
): Promise<GraphChunk[]> {
  // Build a map from chunk_id to minimum hop distance
  // (a chunk might be referenced by multiple nodes at different depths)
  const chunkDepthMap = new Map<number, number>();

  for (const { node, depth } of nodesWithDepth.values()) {
    if (node.chunk_id !== null) {
      const existingDepth = chunkDepthMap.get(node.chunk_id);
      if (existingDepth === undefined || depth < existingDepth) {
        chunkDepthMap.set(node.chunk_id, depth);
      }
    }
  }

  if (chunkDepthMap.size === 0) return [];

  const uniqueChunkIds = [...chunkDepthMap.keys()];

  const result = await db.query(
    'SELECT id, doc_id, text, metadata FROM chunks WHERE id = ANY($1)',
    [uniqueChunkIds]
  );

  return result.rows.map((row) => ({
    id: row.id as number,
    text: row.text as string,
    doc_id: row.doc_id as string,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    hopDistance: chunkDepthMap.get(row.id as number) ?? 0,
  }));
}

/**
 * Get chunk text for nodes (legacy version without depth tracking).
 * Used for browse mode where all nodes are at depth 0.
 *
 * @param db - PostgreSQL connection pool
 * @param nodes - Nodes to get chunks for
 * @returns Chunk data including id, text, and metadata with hopDistance=0
 */
async function getChunksForNodes(db: Pool, nodes: KnowledgeNodeRow[]): Promise<GraphChunk[]> {
  const chunkIds = nodes.filter((n) => n.chunk_id !== null).map((n) => n.chunk_id as number);

  if (chunkIds.length === 0) return [];

  const uniqueChunkIds = [...new Set(chunkIds)];

  const result = await db.query(
    'SELECT id, doc_id, text, metadata FROM chunks WHERE id = ANY($1)',
    [uniqueChunkIds]
  );

  return result.rows.map((row) => ({
    id: row.id as number,
    text: row.text as string,
    doc_id: row.doc_id as string,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    hopDistance: 0, // Browse mode: all nodes at root level
  }));
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

// Re-export getGraphStats for route use
export { getGraphStats };
export type { GraphStats, KnowledgeNodeRow, KnowledgeEdgeRow };
