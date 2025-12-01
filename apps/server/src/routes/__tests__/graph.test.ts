import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the graphSearch service
vi.mock('../../services/graph-search.js', () => ({
  graphSearch: vi.fn(),
  isGraphExpansionEnabled: vi.fn(() => false),
  getGraphStats: vi.fn(),
}));

// Mock @synthesis/db
vi.mock('@synthesis/db', () => ({
  getPool: vi.fn(() => ({})),
}));

import {
  getGraphStats,
  graphSearch,
  isGraphExpansionEnabled,
} from '../../services/graph-search.js';
import { graphRoutes } from '../graph.js';

const TEST_COLLECTION_ID = '11111111-1111-4111-8111-111111111111';
const TEST_NODE_ID = '22222222-2222-4222-8222-222222222222';

describe('Graph Routes', () => {
  let fastify: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    fastify = Fastify();
    await fastify.register(graphRoutes);
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('POST /api/graph/context', () => {
    it('returns graph context for valid request with seed_node_ids', async () => {
      (graphSearch as ReturnType<typeof vi.fn>).mockResolvedValue({
        nodes: [{ id: TEST_NODE_ID, node_type: 'symbol', name: 'TestClass', metadata: {} }],
        edges: [],
        chunks: [{ id: 1, text: 'test chunk', metadata: {} }],
        stats: { nodesVisited: 1, edgesTraversed: 0, depthReached: 0, durationMs: 10 },
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/graph/context',
        payload: {
          collection_id: TEST_COLLECTION_ID,
          seed_node_ids: [TEST_NODE_ID],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.nodes).toHaveLength(1);
      expect(body.stats.nodesVisited).toBe(1);
      expect(body).toHaveProperty('graph_expansion_enabled');
    });

    it('returns graph context for valid request with query', async () => {
      (graphSearch as ReturnType<typeof vi.fn>).mockResolvedValue({
        nodes: [],
        edges: [],
        chunks: [],
        stats: { nodesVisited: 0, edgesTraversed: 0, depthReached: 0, durationMs: 5 },
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/graph/context',
        payload: {
          collection_id: TEST_COLLECTION_ID,
          query: 'test query',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.nodes).toEqual([]);
      expect(body.edges).toEqual([]);
      expect(body.chunks).toEqual([]);
    });

    it('returns graph context for valid request with seed_chunk_ids', async () => {
      (graphSearch as ReturnType<typeof vi.fn>).mockResolvedValue({
        nodes: [],
        edges: [],
        chunks: [],
        stats: { nodesVisited: 0, edgesTraversed: 0, depthReached: 0, durationMs: 5 },
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/graph/context',
        payload: {
          collection_id: TEST_COLLECTION_ID,
          seed_chunk_ids: [1, 2, 3],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(graphSearch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          collectionId: TEST_COLLECTION_ID,
          seedChunkIds: [1, 2, 3],
        })
      );
    });

    it('returns 400 when no seeds provided', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/graph/context',
        payload: {
          collection_id: TEST_COLLECTION_ID,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('INVALID_INPUT');
    });

    it('returns 400 for invalid collection_id format', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/graph/context',
        payload: {
          collection_id: 'not-a-uuid',
          seed_node_ids: [TEST_NODE_ID],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('INVALID_INPUT');
    });

    it('returns 400 when collection_id is missing', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/graph/context',
        payload: {
          seed_node_ids: [TEST_NODE_ID],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('INVALID_INPUT');
    });

    it('accepts camelCase parameters', async () => {
      (graphSearch as ReturnType<typeof vi.fn>).mockResolvedValue({
        nodes: [],
        edges: [],
        chunks: [],
        stats: { nodesVisited: 0, edgesTraversed: 0, depthReached: 0, durationMs: 5 },
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/graph/context',
        payload: {
          collectionId: TEST_COLLECTION_ID,
          seedNodeIds: [TEST_NODE_ID],
          maxDepth: 2,
          maxNodes: 25,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(graphSearch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          collectionId: TEST_COLLECTION_ID,
          seedNodeIds: [TEST_NODE_ID],
          maxDepth: 2,
          maxNodes: 25,
        })
      );
    });

    it('passes edge_types filter to service', async () => {
      (graphSearch as ReturnType<typeof vi.fn>).mockResolvedValue({
        nodes: [],
        edges: [],
        chunks: [],
        stats: { nodesVisited: 0, edgesTraversed: 0, depthReached: 0, durationMs: 5 },
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/graph/context',
        payload: {
          collection_id: TEST_COLLECTION_ID,
          seed_node_ids: [TEST_NODE_ID],
          edge_types: ['calls', 'defines'],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(graphSearch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          edgeTypes: ['calls', 'defines'],
        })
      );
    });

    it('passes node_types filter to service', async () => {
      (graphSearch as ReturnType<typeof vi.fn>).mockResolvedValue({
        nodes: [],
        edges: [],
        chunks: [],
        stats: { nodesVisited: 0, edgesTraversed: 0, depthReached: 0, durationMs: 5 },
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/graph/context',
        payload: {
          collection_id: TEST_COLLECTION_ID,
          seed_node_ids: [TEST_NODE_ID],
          node_types: ['symbol', 'table'],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(graphSearch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          nodeTypes: ['symbol', 'table'],
        })
      );
    });

    it('returns 400 for invalid edge_type value', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/graph/context',
        payload: {
          collection_id: TEST_COLLECTION_ID,
          seed_node_ids: [TEST_NODE_ID],
          edge_types: ['invalid_edge_type'],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('INVALID_INPUT');
    });

    it('returns 400 for invalid node_type value', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/graph/context',
        payload: {
          collection_id: TEST_COLLECTION_ID,
          seed_node_ids: [TEST_NODE_ID],
          node_types: ['invalid_node_type'],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('INVALID_INPUT');
    });

    it('returns 500 when graphSearch throws', async () => {
      (graphSearch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Database error'));

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/graph/context',
        payload: {
          collection_id: TEST_COLLECTION_ID,
          seed_node_ids: [TEST_NODE_ID],
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('GRAPH_SEARCH_FAILED');
      expect(body.message).toBe('Database error');
    });

    it('includes graph_expansion_enabled flag in response', async () => {
      (graphSearch as ReturnType<typeof vi.fn>).mockResolvedValue({
        nodes: [],
        edges: [],
        chunks: [],
        stats: { nodesVisited: 0, edgesTraversed: 0, depthReached: 0, durationMs: 5 },
      });
      (isGraphExpansionEnabled as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/graph/context',
        payload: {
          collection_id: TEST_COLLECTION_ID,
          seed_node_ids: [TEST_NODE_ID],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.graph_expansion_enabled).toBe(true);
    });
  });

  describe('GET /api/graph/stats/:collectionId', () => {
    it('returns stats for valid collection', async () => {
      (getGraphStats as ReturnType<typeof vi.fn>).mockResolvedValue({
        totalNodes: 100,
        totalEdges: 50,
        nodesByType: { symbol: 80, table: 20 },
        edgesByType: { calls: 30, defines: 20 },
      });

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/graph/stats/${TEST_COLLECTION_ID}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.collection_id).toBe(TEST_COLLECTION_ID);
      expect(body.total_nodes).toBe(100);
      expect(body.total_edges).toBe(50);
      expect(body.nodes_by_type).toEqual({ symbol: 80, table: 20 });
      expect(body.edges_by_type).toEqual({ calls: 30, defines: 20 });
    });

    it('returns 400 for invalid UUID', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/graph/stats/not-a-uuid',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('INVALID_INPUT');
      expect(body.message).toBe('collectionId must be a valid UUID');
    });

    it('returns 400 for malformed UUID', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/graph/stats/12345678-1234-1234-1234-123456789',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('INVALID_INPUT');
    });

    it('returns 500 when getGraphStats throws', async () => {
      (getGraphStats as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/graph/stats/${TEST_COLLECTION_ID}`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('GRAPH_STATS_FAILED');
      expect(body.message).toBe('DB error');
    });

    it('returns stats with zero counts for empty collection', async () => {
      (getGraphStats as ReturnType<typeof vi.fn>).mockResolvedValue({
        totalNodes: 0,
        totalEdges: 0,
        nodesByType: {},
        edgesByType: {},
      });

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/graph/stats/${TEST_COLLECTION_ID}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.total_nodes).toBe(0);
      expect(body.total_edges).toBe(0);
      expect(body.nodes_by_type).toEqual({});
      expect(body.edges_by_type).toEqual({});
    });
  });
});
