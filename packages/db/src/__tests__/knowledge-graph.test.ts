/**
 * GPT Phase 2: Knowledge Graph Query Helpers - Unit Tests
 *
 * Tests CRUD operations for knowledge_nodes and knowledge_edges tables.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the client module
vi.mock('../client.js', () => ({
  query: vi.fn(),
}));

import { query } from '../client.js';
import {
  type KnowledgeEdgeRow,
  type KnowledgeEdgeType,
  type KnowledgeNodeRow,
  type KnowledgeNodeType,
  createEdge,
  createEdgesBatch,
  createNode,
  createNodesBatch,
  deleteEdge,
  deleteEdgesByCollection,
  deleteEdgesByNode,
  deleteNode,
  deleteNodesByCollection,
  deleteNodesByDocument,
  findOrCreateNode,
  getEdgeById,
  getEdgesByCollection,
  getGraphStats,
  getIncomingEdges,
  getNodeById,
  getNodeByName,
  getNodeNeighbors,
  getNodesByChunk,
  getNodesByCollection,
  getNodesByDocument,
  getOutgoingEdges,
} from '../knowledge-graph.js';

const mockQuery = vi.mocked(query);

// Test fixtures
const testCollectionId = '550e8400-e29b-41d4-a716-446655440000';
const testDocumentId = '550e8400-e29b-41d4-a716-446655440001';
const testNodeId = '550e8400-e29b-41d4-a716-446655440002';
const testTargetNodeId = '550e8400-e29b-41d4-a716-446655440003';
const testEdgeId = '550e8400-e29b-41d4-a716-446655440004';

const mockNodeRow: KnowledgeNodeRow = {
  id: testNodeId,
  collection_id: testCollectionId,
  node_type: 'symbol',
  name: 'UserService',
  document_id: testDocumentId,
  chunk_id: 42,
  metadata: { symbol_kind: 'class', file_path: 'lib/services/user.dart' },
  created_at: new Date('2025-01-01'),
};

const mockEdgeRow: KnowledgeEdgeRow = {
  id: testEdgeId,
  collection_id: testCollectionId,
  source_node_id: testNodeId,
  target_node_id: testTargetNodeId,
  edge_type: 'calls',
  metadata: {},
  created_at: new Date('2025-01-01'),
  updated_at: new Date('2025-01-02'),
};

describe('Knowledge Graph - Node Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createNode', () => {
    it('creates a node with all fields', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockNodeRow], rowCount: 1 } as never);

      const result = await createNode({
        collection_id: testCollectionId,
        node_type: 'symbol' as KnowledgeNodeType,
        name: 'UserService',
        document_id: testDocumentId,
        chunk_id: 42,
        metadata: { symbol_kind: 'class', file_path: 'lib/services/user.dart' },
      });

      expect(result).toEqual(mockNodeRow);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO knowledge_nodes'),
        expect.arrayContaining([testCollectionId, 'symbol', 'UserService'])
      );
    });

    it('creates a node with minimal fields', async () => {
      const minimalNode: KnowledgeNodeRow = {
        ...mockNodeRow,
        document_id: null,
        chunk_id: null,
        metadata: {},
      };
      mockQuery.mockResolvedValueOnce({ rows: [minimalNode], rowCount: 1 } as never);

      const result = await createNode({
        collection_id: testCollectionId,
        node_type: 'endpoint' as KnowledgeNodeType,
        name: '/api/users',
      });

      expect(result).toEqual(minimalNode);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO knowledge_nodes'),
        expect.arrayContaining([testCollectionId, 'endpoint', '/api/users', null, null])
      );
    });
  });

  describe('createNodesBatch', () => {
    it('creates multiple nodes in batch', async () => {
      const nodes = [mockNodeRow, { ...mockNodeRow, id: 'node-2', name: 'AuthService' }];
      mockQuery.mockResolvedValueOnce({ rows: nodes, rowCount: 2 } as never);

      const result = await createNodesBatch([
        {
          collection_id: testCollectionId,
          node_type: 'symbol' as KnowledgeNodeType,
          name: 'UserService',
        },
        {
          collection_id: testCollectionId,
          node_type: 'symbol' as KnowledgeNodeType,
          name: 'AuthService',
        },
      ]);

      expect(result).toHaveLength(2);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)'),
        expect.any(Array)
      );
    });

    it('returns empty array for empty input', async () => {
      const result = await createNodesBatch([]);
      expect(result).toEqual([]);
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe('getNodeById', () => {
    it('returns node when found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockNodeRow], rowCount: 1 } as never);

      const result = await getNodeById(testNodeId);

      expect(result).toEqual(mockNodeRow);
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM knowledge_nodes WHERE id = $1', [
        testNodeId,
      ]);
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const result = await getNodeById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('getNodesByCollection', () => {
    it('returns all nodes in collection', async () => {
      const nodes = [mockNodeRow, { ...mockNodeRow, id: 'node-2', name: 'AuthService' }];
      mockQuery.mockResolvedValueOnce({ rows: nodes, rowCount: 2 } as never);

      const result = await getNodesByCollection(testCollectionId);

      expect(result).toHaveLength(2);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE collection_id = $1'), [
        testCollectionId,
      ]);
    });

    it('filters by node type when specified', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockNodeRow], rowCount: 1 } as never);

      const result = await getNodesByCollection(testCollectionId, 'symbol' as KnowledgeNodeType);

      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('AND node_type = $2'), [
        testCollectionId,
        'symbol',
      ]);
    });
  });

  describe('getNodeByName', () => {
    it('returns node by name', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockNodeRow], rowCount: 1 } as never);

      const result = await getNodeByName(testCollectionId, 'UserService');

      expect(result).toEqual(mockNodeRow);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE collection_id = $1 AND name = $2'),
        [testCollectionId, 'UserService']
      );
    });

    it('filters by node type when specified', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockNodeRow], rowCount: 1 } as never);

      const result = await getNodeByName(
        testCollectionId,
        'UserService',
        'symbol' as KnowledgeNodeType
      );

      expect(result).toEqual(mockNodeRow);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('AND node_type = $3'), [
        testCollectionId,
        'UserService',
        'symbol',
      ]);
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const result = await getNodeByName(testCollectionId, 'NonExistent');

      expect(result).toBeNull();
    });
  });

  describe('getNodesByDocument', () => {
    it('returns nodes linked to document', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockNodeRow], rowCount: 1 } as never);

      const result = await getNodesByDocument(testDocumentId);

      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE document_id = $1'), [
        testDocumentId,
      ]);
    });
  });

  describe('getNodesByChunk', () => {
    it('returns nodes linked to chunk', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockNodeRow], rowCount: 1 } as never);

      const result = await getNodesByChunk(42);

      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE chunk_id = $1'), [42]);
    });
  });

  describe('deleteNode', () => {
    it('deletes node by id', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

      await deleteNode(testNodeId);

      expect(mockQuery).toHaveBeenCalledWith('DELETE FROM knowledge_nodes WHERE id = $1', [
        testNodeId,
      ]);
    });
  });

  describe('deleteNodesByDocument', () => {
    it('deletes all nodes linked to document', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 5 } as never);

      const result = await deleteNodesByDocument(testDocumentId);

      expect(result).toBe(5);
      expect(mockQuery).toHaveBeenCalledWith('DELETE FROM knowledge_nodes WHERE document_id = $1', [
        testDocumentId,
      ]);
    });
  });

  describe('deleteNodesByCollection', () => {
    it('deletes all nodes in collection', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 100 } as never);

      const result = await deleteNodesByCollection(testCollectionId);

      expect(result).toBe(100);
      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM knowledge_nodes WHERE collection_id = $1',
        [testCollectionId]
      );
    });
  });
});

describe('Knowledge Graph - Edge Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createEdge', () => {
    it('creates an edge with upsert behavior', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockEdgeRow], rowCount: 1 } as never);

      const result = await createEdge({
        collection_id: testCollectionId,
        source_node_id: testNodeId,
        target_node_id: testTargetNodeId,
        edge_type: 'calls' as KnowledgeEdgeType,
        metadata: { call_count: 5 },
      });

      expect(result).toEqual(mockEdgeRow);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.arrayContaining([testCollectionId, testNodeId, testTargetNodeId, 'calls'])
      );
    });

    it('creates an edge with minimal fields', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockEdgeRow], rowCount: 1 } as never);

      const result = await createEdge({
        collection_id: testCollectionId,
        source_node_id: testNodeId,
        target_node_id: testTargetNodeId,
        edge_type: 'imports' as KnowledgeEdgeType,
      });

      expect(result).toEqual(mockEdgeRow);
    });
  });

  describe('createEdgesBatch', () => {
    it('creates multiple edges in batch', async () => {
      const edges = [mockEdgeRow, { ...mockEdgeRow, id: 'edge-2', edge_type: 'imports' }];
      mockQuery.mockResolvedValueOnce({ rows: edges, rowCount: 2 } as never);

      const result = await createEdgesBatch([
        {
          collection_id: testCollectionId,
          source_node_id: testNodeId,
          target_node_id: testTargetNodeId,
          edge_type: 'calls' as KnowledgeEdgeType,
        },
        {
          collection_id: testCollectionId,
          source_node_id: testNodeId,
          target_node_id: testTargetNodeId,
          edge_type: 'imports' as KnowledgeEdgeType,
        },
      ]);

      expect(result).toHaveLength(2);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.any(Array)
      );
    });

    it('returns empty array for empty input', async () => {
      const result = await createEdgesBatch([]);
      expect(result).toEqual([]);
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe('getEdgeById', () => {
    it('returns edge when found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockEdgeRow], rowCount: 1 } as never);

      const result = await getEdgeById(testEdgeId);

      expect(result).toEqual(mockEdgeRow);
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);

      const result = await getEdgeById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('getOutgoingEdges', () => {
    it('returns all outgoing edges', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockEdgeRow], rowCount: 1 } as never);

      const result = await getOutgoingEdges(testNodeId);

      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE source_node_id = $1'), [
        testNodeId,
      ]);
    });

    it('filters by edge type when specified', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockEdgeRow], rowCount: 1 } as never);

      const result = await getOutgoingEdges(testNodeId, 'calls' as KnowledgeEdgeType);

      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('AND edge_type = $2'), [
        testNodeId,
        'calls',
      ]);
    });
  });

  describe('getIncomingEdges', () => {
    it('returns all incoming edges', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockEdgeRow], rowCount: 1 } as never);

      const result = await getIncomingEdges(testTargetNodeId);

      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE target_node_id = $1'), [
        testTargetNodeId,
      ]);
    });

    it('filters by edge type when specified', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockEdgeRow], rowCount: 1 } as never);

      const result = await getIncomingEdges(testTargetNodeId, 'calls' as KnowledgeEdgeType);

      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('AND edge_type = $2'), [
        testTargetNodeId,
        'calls',
      ]);
    });
  });

  describe('getEdgesByCollection', () => {
    it('returns all edges in collection', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockEdgeRow], rowCount: 1 } as never);

      const result = await getEdgesByCollection(testCollectionId);

      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE collection_id = $1'), [
        testCollectionId,
      ]);
    });

    it('filters by edge type when specified', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockEdgeRow], rowCount: 1 } as never);

      const result = await getEdgesByCollection(testCollectionId, 'calls' as KnowledgeEdgeType);

      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('AND edge_type = $2'), [
        testCollectionId,
        'calls',
      ]);
    });
  });

  describe('deleteEdge', () => {
    it('deletes edge by id', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

      await deleteEdge(testEdgeId);

      expect(mockQuery).toHaveBeenCalledWith('DELETE FROM knowledge_edges WHERE id = $1', [
        testEdgeId,
      ]);
    });
  });

  describe('deleteEdgesByNode', () => {
    it('deletes all edges connected to node', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 10 } as never);

      const result = await deleteEdgesByNode(testNodeId);

      expect(result).toBe(10);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('source_node_id = $1 OR target_node_id = $1'),
        [testNodeId]
      );
    });
  });

  describe('deleteEdgesByCollection', () => {
    it('deletes all edges in collection', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 50 } as never);

      const result = await deleteEdgesByCollection(testCollectionId);

      expect(result).toBe(50);
      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM knowledge_edges WHERE collection_id = $1',
        [testCollectionId]
      );
    });
  });
});

describe('Knowledge Graph - Statistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getGraphStats', () => {
    it('returns comprehensive graph statistics', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '10' }] } as never) // node count
        .mockResolvedValueOnce({ rows: [{ count: '25' }] } as never) // edge count
        .mockResolvedValueOnce({
          rows: [
            { node_type: 'symbol', count: '5' },
            { node_type: 'table', count: '3' },
            { node_type: 'endpoint', count: '2' },
          ],
        } as never) // nodes by type
        .mockResolvedValueOnce({
          rows: [
            { edge_type: 'calls', count: '15' },
            { edge_type: 'persists_to', count: '10' },
          ],
        } as never); // edges by type

      const result = await getGraphStats(testCollectionId);

      expect(result).toEqual({
        totalNodes: 10,
        totalEdges: 25,
        nodesByType: {
          symbol: 5,
          table: 3,
          endpoint: 2,
        },
        edgesByType: {
          calls: 15,
          persists_to: 10,
        },
      });
    });

    it('handles empty graph', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as never)
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as never)
        .mockResolvedValueOnce({ rows: [] } as never)
        .mockResolvedValueOnce({ rows: [] } as never);

      const result = await getGraphStats(testCollectionId);

      expect(result).toEqual({
        totalNodes: 0,
        totalEdges: 0,
        nodesByType: {},
        edgesByType: {},
      });
    });
  });
});

describe('Knowledge Graph - Traversal Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getNodeNeighbors', () => {
    it('returns outgoing and incoming neighbors', async () => {
      const outgoingNodes = [{ ...mockNodeRow, name: 'TargetService' }];
      const incomingNodes = [{ ...mockNodeRow, name: 'CallerService' }];

      mockQuery
        .mockResolvedValueOnce({ rows: outgoingNodes } as never)
        .mockResolvedValueOnce({ rows: incomingNodes } as never);

      const result = await getNodeNeighbors(testNodeId);

      expect(result.outgoing).toEqual(outgoingNodes);
      expect(result.incoming).toEqual(incomingNodes);
    });

    it('filters neighbors by edge types', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] } as never)
        .mockResolvedValueOnce({ rows: [] } as never);

      await getNodeNeighbors(testNodeId, ['calls', 'imports'] as KnowledgeEdgeType[]);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND ke.edge_type = ANY($2)'),
        [testNodeId, ['calls', 'imports']]
      );
    });
  });

  describe('findOrCreateNode', () => {
    it('returns existing node if found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockNodeRow], rowCount: 1 } as never);

      const result = await findOrCreateNode({
        collection_id: testCollectionId,
        node_type: 'symbol' as KnowledgeNodeType,
        name: 'UserService',
      });

      expect(result).toEqual(mockNodeRow);
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM knowledge_nodes WHERE'),
        [testCollectionId, 'UserService', 'symbol']
      );
    });

    it('creates new node if not found', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never) // SELECT returns empty
        .mockResolvedValueOnce({ rows: [mockNodeRow], rowCount: 1 } as never); // INSERT returns new node

      const result = await findOrCreateNode({
        collection_id: testCollectionId,
        node_type: 'symbol' as KnowledgeNodeType,
        name: 'NewService',
        metadata: { symbol_kind: 'class' },
      });

      expect(result).toEqual(mockNodeRow);
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Knowledge Graph - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles null document_id and chunk_id in node creation', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...mockNodeRow, document_id: null, chunk_id: null }],
      rowCount: 1,
    } as never);

    const result = await createNode({
      collection_id: testCollectionId,
      node_type: 'config_section' as KnowledgeNodeType,
      name: 'database',
    });

    expect(result.document_id).toBeNull();
    expect(result.chunk_id).toBeNull();
  });

  it('handles empty metadata in node creation', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ ...mockNodeRow, metadata: {} }],
      rowCount: 1,
    } as never);

    await createNode({
      collection_id: testCollectionId,
      node_type: 'table' as KnowledgeNodeType,
      name: 'users',
    });

    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining(['{}']));
  });

  it('handles rowCount being undefined in delete operations', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: undefined } as never);

    const result = await deleteNodesByDocument(testDocumentId);

    expect(result).toBe(0);
  });

  it('handles missing count in stats', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] } as never) // missing count row
      .mockResolvedValueOnce({ rows: [{ count: '5' }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const result = await getGraphStats(testCollectionId);

    expect(result.totalNodes).toBe(0);
    expect(result.totalEdges).toBe(5);
  });
});
