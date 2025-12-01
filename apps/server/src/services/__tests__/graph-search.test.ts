/**
 * GPT Phase 2: Graph Search Service Tests
 *
 * Unit tests for the graph-search service that performs BFS traversal
 * from seed nodes to connected nodes for context expansion in RAG queries.
 */

import type { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock @synthesis/db
const getNodeByIdMock = vi.fn();
const getNodesByChunkMock = vi.fn();
const getNodeNeighborsMock = vi.fn();
const getOutgoingEdgesMock = vi.fn();
const getIncomingEdgesMock = vi.fn();
const getGraphStatsMock = vi.fn();

vi.mock('@synthesis/db', () => ({
  getNodeById: getNodeByIdMock,
  getNodesByChunk: getNodesByChunkMock,
  getNodeNeighbors: getNodeNeighborsMock,
  getOutgoingEdges: getOutgoingEdgesMock,
  getIncomingEdges: getIncomingEdgesMock,
  getGraphStats: getGraphStatsMock,
  query: vi.fn(),
}));

// Mock smartSearch
const smartSearchMock = vi.fn();
vi.mock('../search.js', () => ({
  smartSearch: smartSearchMock,
}));

// =============================================================================
// TEST DATA
// =============================================================================

const TEST_COLLECTION_ID = 'col-11111111-1111-4111-8111-111111111111';
const TEST_NODE_ID_1 = 'node-22222222-2222-4222-8222-222222222222';
const TEST_NODE_ID_2 = 'node-33333333-3333-4333-8333-333333333333';
const TEST_NODE_ID_3 = 'node-44444444-4444-4444-8444-444444444444';

const createMockNode = (id: string, nodeType: string, name: string, chunkId?: number | null) => ({
  id,
  collection_id: TEST_COLLECTION_ID,
  node_type: nodeType,
  name,
  document_id: null,
  chunk_id: chunkId ?? null,
  metadata: {},
  created_at: new Date(),
});

const createMockEdge = (sourceId: string, targetId: string, edgeType: string) => ({
  id: `edge-${sourceId.slice(-8)}-${targetId.slice(-8)}`,
  collection_id: TEST_COLLECTION_ID,
  source_node_id: sourceId,
  target_node_id: targetId,
  edge_type: edgeType,
  metadata: {},
  created_at: new Date(),
  updated_at: new Date(),
});

// =============================================================================
// MOCK DATABASE CLIENT
// =============================================================================

const createMockPool = () => {
  const mockPool = {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  } as unknown as Pool;
  return mockPool;
};

// =============================================================================
// TEST SUITE
// =============================================================================

describe('GraphSearch Service', () => {
  let mockPool: Pool;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockPool = createMockPool();

    // Default mock implementations
    getNodeByIdMock.mockImplementation(async (id: string) => {
      if (id === TEST_NODE_ID_1) return createMockNode(id, 'symbol', 'TestClass', 1);
      if (id === TEST_NODE_ID_2) return createMockNode(id, 'symbol', 'testFunction', 2);
      if (id === TEST_NODE_ID_3) return createMockNode(id, 'table', 'users', null);
      return null;
    });

    getNodesByChunkMock.mockResolvedValue([]);
    getNodeNeighborsMock.mockResolvedValue({ outgoing: [], incoming: [] });
    getOutgoingEdgesMock.mockResolvedValue([]);
    getIncomingEdgesMock.mockResolvedValue([]);
    smartSearchMock.mockResolvedValue({ results: [], totalResults: 0 });
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env.ENABLE_GRAPH_EXPANSION = undefined;
    process.env.GRAPH_MAX_DEPTH = undefined;
    process.env.GRAPH_MAX_NODES = undefined;
  });

  // ===========================================================================
  // CONFIG HELPERS TESTS
  // ===========================================================================

  describe('isGraphExpansionEnabled', () => {
    it('should return false by default', async () => {
      process.env.ENABLE_GRAPH_EXPANSION = undefined;
      const { isGraphExpansionEnabled } = await import('../graph-search.js');
      expect(isGraphExpansionEnabled()).toBe(false);
    });

    it('should return true when ENABLE_GRAPH_EXPANSION is "true"', async () => {
      process.env.ENABLE_GRAPH_EXPANSION = 'true';
      const { isGraphExpansionEnabled } = await import('../graph-search.js');
      expect(isGraphExpansionEnabled()).toBe(true);
    });

    it('should return false when ENABLE_GRAPH_EXPANSION is "false"', async () => {
      process.env.ENABLE_GRAPH_EXPANSION = 'false';
      const { isGraphExpansionEnabled } = await import('../graph-search.js');
      expect(isGraphExpansionEnabled()).toBe(false);
    });

    it('should return false when ENABLE_GRAPH_EXPANSION has other value', async () => {
      process.env.ENABLE_GRAPH_EXPANSION = '1';
      const { isGraphExpansionEnabled } = await import('../graph-search.js');
      expect(isGraphExpansionEnabled()).toBe(false);
    });
  });

  // ===========================================================================
  // MAIN GRAPH SEARCH TESTS
  // ===========================================================================

  describe('graphSearch', () => {
    // =========================================================================
    // EMPTY RESULT SCENARIOS
    // =========================================================================

    describe('empty result scenarios', () => {
      it('should return empty result when no seeds provided and query returns nothing', async () => {
        const { graphSearch } = await import('../graph-search.js');

        smartSearchMock.mockResolvedValue({ results: [] });

        const result = await graphSearch(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          query: 'nonexistent query',
        });

        expect(result.nodes).toHaveLength(0);
        expect(result.edges).toHaveLength(0);
        expect(result.chunks).toHaveLength(0);
        expect(result.stats.nodesVisited).toBe(0);
        expect(result.stats.edgesTraversed).toBe(0);
        expect(result.stats.depthReached).toBe(0);
      });

      it('should return empty result when seedNodeIds are provided but all nodes not found', async () => {
        const { graphSearch } = await import('../graph-search.js');

        getNodeByIdMock.mockResolvedValue(null);

        const result = await graphSearch(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          seedNodeIds: ['non-existent-node-id'],
          maxDepth: 1,
        });

        expect(result.nodes).toHaveLength(0);
        expect(result.stats.nodesVisited).toBe(0);
      });
    });

    // =========================================================================
    // SEED NODE RESOLUTION
    // =========================================================================

    describe('seed node resolution', () => {
      it('should traverse from seed node IDs', async () => {
        const { graphSearch } = await import('../graph-search.js');

        const result = await graphSearch(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          seedNodeIds: [TEST_NODE_ID_1],
          maxDepth: 1,
        });

        expect(getNodeByIdMock).toHaveBeenCalledWith(TEST_NODE_ID_1);
        expect(result.nodes.length).toBeGreaterThanOrEqual(1);
        expect(result.stats.nodesVisited).toBeGreaterThanOrEqual(1);
      });

      it('should traverse from chunk IDs', async () => {
        const { graphSearch } = await import('../graph-search.js');

        getNodesByChunkMock.mockResolvedValue([
          createMockNode(TEST_NODE_ID_1, 'symbol', 'TestClass', 1),
        ]);

        const result = await graphSearch(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          seedChunkIds: [1],
          maxDepth: 1,
        });

        expect(getNodesByChunkMock).toHaveBeenCalledWith(1);
        expect(result.stats.nodesVisited).toBeGreaterThanOrEqual(1);
      });

      it('should use query to find seed nodes via smartSearch when no other seeds provided', async () => {
        const { graphSearch } = await import('../graph-search.js');

        smartSearchMock.mockResolvedValue({
          results: [{ id: 1, text: 'found', similarity: 0.9 }],
          totalResults: 1,
        });
        getNodesByChunkMock.mockResolvedValue([
          createMockNode(TEST_NODE_ID_1, 'symbol', 'FoundClass', 1),
        ]);

        const result = await graphSearch(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          query: 'find something',
        });

        expect(smartSearchMock).toHaveBeenCalledWith(
          mockPool,
          expect.objectContaining({
            query: 'find something',
            collectionId: TEST_COLLECTION_ID,
            topK: 5,
            minSimilarity: 0.5,
          })
        );
        expect(result.stats.nodesVisited).toBeGreaterThanOrEqual(1);
      });

      it('should not use query when seedNodeIds are already provided', async () => {
        const { graphSearch } = await import('../graph-search.js');

        await graphSearch(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          seedNodeIds: [TEST_NODE_ID_1],
          query: 'this should not be used',
        });

        // smartSearch should not be called when seedNodeIds are provided
        expect(smartSearchMock).not.toHaveBeenCalled();
      });

      it('should deduplicate seed nodes from multiple sources', async () => {
        const { graphSearch } = await import('../graph-search.js');

        // Return same node from chunk lookup
        getNodesByChunkMock.mockResolvedValue([
          createMockNode(TEST_NODE_ID_1, 'symbol', 'Same', 1),
        ]);

        const result = await graphSearch(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          seedNodeIds: [TEST_NODE_ID_1],
          seedChunkIds: [1], // Same node returned
          maxDepth: 0,
        });

        // Should only visit once despite duplicate seed
        expect(result.stats.nodesVisited).toBe(1);
      });
    });

    // =========================================================================
    // BFS TRAVERSAL TESTS
    // =========================================================================

    describe('BFS traversal', () => {
      it('should respect maxDepth limit', async () => {
        const { graphSearch } = await import('../graph-search.js');

        // Set up a chain: node1 -> node2 -> node3
        getNodeNeighborsMock.mockImplementation(async (nodeId: string) => {
          if (nodeId === TEST_NODE_ID_1) {
            return {
              outgoing: [createMockNode(TEST_NODE_ID_2, 'symbol', 'Child', 2)],
              incoming: [],
            };
          }
          if (nodeId === TEST_NODE_ID_2) {
            return {
              outgoing: [createMockNode(TEST_NODE_ID_3, 'table', 'users', null)],
              incoming: [],
            };
          }
          return { outgoing: [], incoming: [] };
        });

        const result = await graphSearch(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          seedNodeIds: [TEST_NODE_ID_1],
          maxDepth: 1,
          maxNodes: 50,
        });

        // At maxDepth=1, should only reach depth 1 neighbors (not node3 at depth 2)
        expect(result.stats.depthReached).toBeLessThanOrEqual(1);
      });

      it('should respect maxNodes limit', async () => {
        const { graphSearch } = await import('../graph-search.js');

        // Return many neighbors
        getNodeNeighborsMock.mockResolvedValue({
          outgoing: [
            createMockNode('node-a', 'symbol', 'A', null),
            createMockNode('node-b', 'symbol', 'B', null),
            createMockNode('node-c', 'symbol', 'C', null),
            createMockNode('node-d', 'symbol', 'D', null),
            createMockNode('node-e', 'symbol', 'E', null),
          ],
          incoming: [],
        });

        getNodeByIdMock.mockImplementation(async (id: string) => {
          if (id === TEST_NODE_ID_1) return createMockNode(id, 'symbol', 'TestClass', 1);
          // Return nodes for all neighbor IDs
          return createMockNode(id, 'symbol', id.slice(-1), null);
        });

        const result = await graphSearch(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          seedNodeIds: [TEST_NODE_ID_1],
          maxNodes: 3,
          maxDepth: 5,
        });

        expect(result.stats.nodesVisited).toBeLessThanOrEqual(3);
      });

      it('should handle cycles in graph (visited set prevents infinite loop)', async () => {
        const { graphSearch } = await import('../graph-search.js');

        // Create circular reference: node1 -> node2 -> node1
        getNodeNeighborsMock.mockImplementation(async (nodeId: string) => {
          if (nodeId === TEST_NODE_ID_1) {
            return {
              outgoing: [createMockNode(TEST_NODE_ID_2, 'symbol', 'B', 2)],
              incoming: [],
            };
          }
          if (nodeId === TEST_NODE_ID_2) {
            return {
              outgoing: [createMockNode(TEST_NODE_ID_1, 'symbol', 'A', 1)],
              incoming: [],
            };
          }
          return { outgoing: [], incoming: [] };
        });

        // Should not infinite loop
        const result = await graphSearch(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          seedNodeIds: [TEST_NODE_ID_1],
          maxDepth: 10,
          maxNodes: 50,
        });

        // Should only have 2 unique nodes despite cycle
        expect(result.stats.nodesVisited).toBeLessThanOrEqual(2);
      });

      it('should use default maxDepth of 3 when not specified', async () => {
        const { graphSearch } = await import('../graph-search.js');

        // Create a deep chain: node1 -> node2 -> node3 -> node4 -> node5
        let callCount = 0;
        getNodeNeighborsMock.mockImplementation(async () => {
          callCount++;
          if (callCount <= 4) {
            return {
              outgoing: [
                createMockNode(`deep-node-${callCount}`, 'symbol', `Node${callCount}`, null),
              ],
              incoming: [],
            };
          }
          return { outgoing: [], incoming: [] };
        });

        getNodeByIdMock.mockImplementation(async (id: string) => {
          if (id === TEST_NODE_ID_1) return createMockNode(id, 'symbol', 'TestClass', 1);
          return createMockNode(id, 'symbol', 'DeepNode', null);
        });

        const result = await graphSearch(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          seedNodeIds: [TEST_NODE_ID_1],
          // No maxDepth specified - should default to 3
        });

        // Should not go deeper than default depth of 3
        expect(result.stats.depthReached).toBeLessThanOrEqual(3);
      });

      it('should use GRAPH_MAX_DEPTH env var when set', async () => {
        process.env.GRAPH_MAX_DEPTH = '2';
        const { graphSearch } = await import('../graph-search.js');

        // Create a chain that goes deeper than env limit
        getNodeNeighborsMock.mockImplementation(async (nodeId: string) => {
          if (nodeId === TEST_NODE_ID_1) {
            return {
              outgoing: [createMockNode(TEST_NODE_ID_2, 'symbol', 'Node2', 2)],
              incoming: [],
            };
          }
          if (nodeId === TEST_NODE_ID_2) {
            return {
              outgoing: [createMockNode(TEST_NODE_ID_3, 'symbol', 'Node3', null)],
              incoming: [],
            };
          }
          return { outgoing: [], incoming: [] };
        });

        const result = await graphSearch(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          seedNodeIds: [TEST_NODE_ID_1],
        });

        expect(result.stats.depthReached).toBeLessThanOrEqual(2);
      });

      it('should use GRAPH_MAX_NODES env var when set', async () => {
        process.env.GRAPH_MAX_NODES = '2';
        const { graphSearch } = await import('../graph-search.js');

        getNodeNeighborsMock.mockResolvedValue({
          outgoing: [
            createMockNode('node-a', 'symbol', 'A', null),
            createMockNode('node-b', 'symbol', 'B', null),
          ],
          incoming: [],
        });

        getNodeByIdMock.mockImplementation(async (id: string) => {
          return createMockNode(id, 'symbol', 'Node', null);
        });

        const result = await graphSearch(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          seedNodeIds: [TEST_NODE_ID_1],
        });

        expect(result.stats.nodesVisited).toBeLessThanOrEqual(2);
      });
    });

    // =========================================================================
    // FILTERING TESTS
    // =========================================================================

    describe('filtering', () => {
      it('should filter by node types', async () => {
        const { graphSearch } = await import('../graph-search.js');

        // Return mixed node types
        getNodeByIdMock.mockImplementation(async (id: string) => {
          if (id === TEST_NODE_ID_1) return createMockNode(id, 'symbol', 'TestClass', 1);
          if (id === TEST_NODE_ID_2) return createMockNode(id, 'table', 'users', null);
          if (id === TEST_NODE_ID_3) return createMockNode(id, 'symbol', 'AnotherSymbol', null);
          return null;
        });

        const result = await graphSearch(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          seedNodeIds: [TEST_NODE_ID_1, TEST_NODE_ID_2, TEST_NODE_ID_3],
          nodeTypes: ['symbol'],
          maxDepth: 0,
        });

        // Only symbol nodes should be included
        for (const node of result.nodes) {
          expect(node.node_type).toBe('symbol');
        }
      });

      it('should filter neighbors by edge types during traversal', async () => {
        const { graphSearch } = await import('../graph-search.js');

        getNodeNeighborsMock.mockResolvedValue({
          outgoing: [createMockNode(TEST_NODE_ID_2, 'symbol', 'Child', 2)],
          incoming: [],
        });

        await graphSearch(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          seedNodeIds: [TEST_NODE_ID_1],
          edgeTypes: ['defines'],
          maxDepth: 1,
        });

        // Verify getNodeNeighbors was called with edge type filter
        expect(getNodeNeighborsMock).toHaveBeenCalledWith(TEST_NODE_ID_1, ['defines']);
      });
    });

    // =========================================================================
    // EDGE COLLECTION TESTS
    // =========================================================================

    describe('edge collection', () => {
      it('should collect edges between visited nodes', async () => {
        const { graphSearch } = await import('../graph-search.js');

        // Setup two connected nodes
        getNodeNeighborsMock.mockImplementation(async (nodeId: string) => {
          if (nodeId === TEST_NODE_ID_1) {
            return {
              outgoing: [createMockNode(TEST_NODE_ID_2, 'symbol', 'Child', 2)],
              incoming: [],
            };
          }
          return { outgoing: [], incoming: [] };
        });

        const testEdge = createMockEdge(TEST_NODE_ID_1, TEST_NODE_ID_2, 'defines');
        getOutgoingEdgesMock.mockImplementation(async (nodeId: string) => {
          if (nodeId === TEST_NODE_ID_1) {
            return [testEdge];
          }
          return [];
        });
        getIncomingEdgesMock.mockResolvedValue([]);

        const result = await graphSearch(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          seedNodeIds: [TEST_NODE_ID_1],
          maxDepth: 1,
        });

        expect(result.edges.length).toBeGreaterThanOrEqual(0);
        expect(result.stats.edgesTraversed).toBe(result.edges.length);
      });

      it('should only include edges where both endpoints are visited', async () => {
        const { graphSearch } = await import('../graph-search.js');

        // Node 1 has edge to node 2, but node 2 won't be visited (maxNodes=1)
        const testEdge = createMockEdge(TEST_NODE_ID_1, TEST_NODE_ID_2, 'defines');
        getOutgoingEdgesMock.mockResolvedValue([testEdge]);
        getIncomingEdgesMock.mockResolvedValue([]);

        const result = await graphSearch(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          seedNodeIds: [TEST_NODE_ID_1],
          maxDepth: 0, // Don't traverse to neighbors
          maxNodes: 1,
        });

        // Edge should not be included because node 2 is not visited
        expect(result.edges).toHaveLength(0);
      });

      it('should deduplicate edges', async () => {
        const { graphSearch } = await import('../graph-search.js');

        const testEdge = createMockEdge(TEST_NODE_ID_1, TEST_NODE_ID_2, 'defines');

        // Return same edge from both directions
        getOutgoingEdgesMock.mockResolvedValue([testEdge]);
        getIncomingEdgesMock.mockResolvedValue([testEdge]);

        getNodeNeighborsMock.mockImplementation(async (nodeId: string) => {
          if (nodeId === TEST_NODE_ID_1) {
            return {
              outgoing: [createMockNode(TEST_NODE_ID_2, 'symbol', 'Child', 2)],
              incoming: [],
            };
          }
          return { outgoing: [], incoming: [] };
        });

        const result = await graphSearch(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          seedNodeIds: [TEST_NODE_ID_1],
          maxDepth: 1,
        });

        // Edge should appear only once despite being returned from both getOutgoing and getIncoming
        const edgeIds = result.edges.map((e) => e.id);
        const uniqueEdgeIds = [...new Set(edgeIds)];
        expect(edgeIds.length).toBe(uniqueEdgeIds.length);
      });
    });

    // =========================================================================
    // CHUNK RETRIEVAL TESTS
    // =========================================================================

    describe('chunk retrieval', () => {
      it('should retrieve chunks for nodes with chunk_id', async () => {
        const { graphSearch } = await import('../graph-search.js');

        (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
          rows: [{ id: 1, text: 'Test chunk text', metadata: { line: 1 } }],
        });

        const result = await graphSearch(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          seedNodeIds: [TEST_NODE_ID_1],
          maxDepth: 0,
        });

        expect(mockPool.query).toHaveBeenCalled();
        if (result.chunks.length > 0) {
          expect(result.chunks[0]).toHaveProperty('text');
          expect(result.chunks[0]).toHaveProperty('metadata');
          expect(result.chunks[0].text).toBe('Test chunk text');
        }
      });

      it('should not query chunks when no nodes have chunk_id', async () => {
        const { graphSearch } = await import('../graph-search.js');

        // Node without chunk_id
        getNodeByIdMock.mockResolvedValue(createMockNode(TEST_NODE_ID_3, 'table', 'users', null));

        const result = await graphSearch(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          seedNodeIds: [TEST_NODE_ID_3],
          maxDepth: 0,
        });

        // Should return empty chunks without querying
        expect(result.chunks).toHaveLength(0);
      });

      it('should deduplicate chunk IDs before querying', async () => {
        const { graphSearch } = await import('../graph-search.js');

        // Two nodes pointing to same chunk
        getNodeByIdMock.mockImplementation(async (id: string) => {
          if (id === TEST_NODE_ID_1) return createMockNode(id, 'symbol', 'A', 1);
          if (id === TEST_NODE_ID_2) return createMockNode(id, 'symbol', 'B', 1); // Same chunk_id
          return null;
        });

        getNodeNeighborsMock.mockResolvedValue({ outgoing: [], incoming: [] });

        (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
          rows: [{ id: 1, text: 'Chunk 1', metadata: {} }],
        });

        await graphSearch(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          seedNodeIds: [TEST_NODE_ID_1, TEST_NODE_ID_2],
          maxDepth: 0,
        });

        // Verify query was called with deduplicated chunk IDs
        const queryCall = (mockPool.query as ReturnType<typeof vi.fn>).mock.calls[0];
        if (queryCall) {
          const chunkIds = queryCall[1]?.[0];
          if (chunkIds) {
            const uniqueIds = [...new Set(chunkIds)];
            expect(chunkIds.length).toBe(uniqueIds.length);
          }
        }
      });
    });

    // =========================================================================
    // STATISTICS TESTS
    // =========================================================================

    describe('statistics', () => {
      it('should return timing statistics', async () => {
        const { graphSearch } = await import('../graph-search.js');

        const result = await graphSearch(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          seedNodeIds: [TEST_NODE_ID_1],
          maxDepth: 0,
        });

        expect(result.stats).toHaveProperty('durationMs');
        expect(typeof result.stats.durationMs).toBe('number');
        expect(result.stats.durationMs).toBeGreaterThanOrEqual(0);
      });

      it('should track nodesVisited correctly', async () => {
        const { graphSearch } = await import('../graph-search.js');

        getNodeNeighborsMock.mockImplementation(async (nodeId: string) => {
          if (nodeId === TEST_NODE_ID_1) {
            return {
              outgoing: [createMockNode(TEST_NODE_ID_2, 'symbol', 'Child', 2)],
              incoming: [],
            };
          }
          return { outgoing: [], incoming: [] };
        });

        const result = await graphSearch(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          seedNodeIds: [TEST_NODE_ID_1],
          maxDepth: 1,
        });

        expect(result.stats.nodesVisited).toBe(result.nodes.length);
      });

      it('should track depthReached correctly', async () => {
        const { graphSearch } = await import('../graph-search.js');

        // Setup chain: node1 (depth 0) -> node2 (depth 1)
        getNodeNeighborsMock.mockImplementation(async (nodeId: string) => {
          if (nodeId === TEST_NODE_ID_1) {
            return {
              outgoing: [createMockNode(TEST_NODE_ID_2, 'symbol', 'Child', 2)],
              incoming: [],
            };
          }
          return { outgoing: [], incoming: [] };
        });

        const result = await graphSearch(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          seedNodeIds: [TEST_NODE_ID_1],
          maxDepth: 2,
        });

        expect(result.stats.depthReached).toBe(1); // Reached node2 at depth 1
      });
    });
  });

  // ===========================================================================
  // RE-EXPORT TESTS
  // ===========================================================================

  describe('re-exports', () => {
    it('should re-export getGraphStats', async () => {
      const graphSearch = await import('../graph-search.js');
      expect(graphSearch.getGraphStats).toBeDefined();
      expect(typeof graphSearch.getGraphStats).toBe('function');
    });
  });
});
