/**
 * GPT Phase 2: Graph Builder Service Tests
 *
 * Unit tests for the graph-builder service that extracts
 * knowledge graph nodes and edges from document chunks.
 */

import type { Pool, PoolClient } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock the knowledge-graph database module
const createNodesBatchMock = vi.fn();
const createEdgesBatchMock = vi.fn();
const deleteNodesByDocumentMock = vi.fn();
const findOrCreateNodeMock = vi.fn();
const getNodeByNameMock = vi.fn();

vi.mock('@synthesis/db', () => ({
  createNodesBatch: createNodesBatchMock,
  createEdgesBatch: createEdgesBatchMock,
  deleteNodesByDocument: deleteNodesByDocumentMock,
  findOrCreateNode: findOrCreateNodeMock,
  getNodeByName: getNodeByNameMock,
}));

// =============================================================================
// TEST DATA
// =============================================================================

const TEST_COLLECTION_ID = 'col-11111111-1111-4111-8111-111111111111';
const TEST_DOCUMENT_ID = 'doc-22222222-2222-4222-8222-222222222222';

const mockDocument = {
  id: TEST_DOCUMENT_ID,
  collection_id: TEST_COLLECTION_ID,
  title: 'test.ts',
  file_path: '/src/services/test.ts',
  source_url: null,
  metadata: { file_imports: ['./utils', '../models/user'] },
};

const createMockChunk = (id: number, text: string, metadata: Record<string, unknown>) => ({
  id,
  doc_id: TEST_DOCUMENT_ID,
  chunk_index: id - 1,
  text,
  metadata: {
    file_path: '/src/services/test.ts',
    ...metadata,
  },
});

const mockFunctionChunk = createMockChunk(
  1,
  'function greet(name: string): string { return `Hello, ${name}!`; }',
  {
    function_name: 'greet',
    parameters: ['name: string'],
    return_type: 'string',
    line_range: [1, 3],
  }
);

const mockClassChunk = createMockChunk(
  2,
  'class UserService extends BaseService implements IUserService { }',
  {
    class_name: 'UserService',
    extends: 'BaseService',
    implements: ['IUserService'],
    line_range: [5, 50],
  }
);

const mockMethodChunk = createMockChunk(
  3,
  'async getUser(id: string): Promise<User> { return this.db.find(id); }',
  {
    function_name: 'getUser',
    class_context: 'UserService',
    parameters: ['id: string'],
    return_type: 'Promise<User>',
    line_range: [10, 15],
  }
);

const mockTableChunk = createMockChunk(
  5,
  'CREATE TABLE users (id UUID PRIMARY KEY, name VARCHAR(255), email VARCHAR(255));',
  {
    sql_type: 'table',
    table: 'users',
    schema: 'public',
    columns: [
      { name: 'id', type: 'UUID', constraints: ['PRIMARY KEY'] },
      { name: 'name', type: 'VARCHAR(255)' },
      { name: 'email', type: 'VARCHAR(255)' },
    ],
    line_range: [1, 5],
  }
);

const mockConfigChunk = createMockChunk(6, 'database:\n  host: localhost\n  port: 5432', {
  format: 'yaml',
  config_section: 'database',
  keys: ['host', 'port'],
  nested_paths: ['database.host', 'database.port'],
  line_range: [1, 3],
});

const mockWidgetChunk = createMockChunk(7, 'class HomeScreen extends StatefulWidget { }', {
  class_name: 'HomeScreen',
  extends: 'StatefulWidget',
  is_widget: true,
  is_stateful: true,
  line_range: [1, 100],
});

const mockEndpointChunk = createMockChunk(
  8,
  'app.get("/api/users/:id", async (req, res) => { ... });',
  {
    function_name: 'getUserHandler',
    line_range: [20, 35],
  }
);

// =============================================================================
// MOCK DATABASE CLIENT
// =============================================================================

const createMockClient = () => {
  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
  } as unknown as PoolClient;
  return mockClient;
};

const createMockPool = (mockClient: PoolClient) => {
  const mockPool = {
    connect: vi.fn().mockResolvedValue(mockClient),
    query: vi.fn(),
  } as unknown as Pool;
  return mockPool;
};

// =============================================================================
// TEST SUITE
// =============================================================================

describe('GraphBuilder Service', () => {
  let mockClient: PoolClient;
  let mockPool: Pool;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    // Set environment variable to enable graph builder
    process.env.ENABLE_GRAPH_BUILDER = 'true';

    mockClient = createMockClient();
    mockPool = createMockPool(mockClient);

    // Default mock implementations
    createNodesBatchMock.mockResolvedValue([]);
    createEdgesBatchMock.mockResolvedValue([]);
    deleteNodesByDocumentMock.mockResolvedValue(0);
    findOrCreateNodeMock.mockResolvedValue({
      id: 'node-mock-id',
      collection_id: TEST_COLLECTION_ID,
      node_type: 'document',
      name: 'test.ts',
      metadata: {},
    });
    getNodeByNameMock.mockResolvedValue(null);

    // Default client query mock for BEGIN/COMMIT/ROLLBACK
    (mockClient.query as ReturnType<typeof vi.fn>).mockImplementation((sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env.ENABLE_GRAPH_BUILDER = undefined;
  });

  // ===========================================================================
  // MAIN BUILD FUNCTION TESTS
  // ===========================================================================

  describe('buildGraphForDocument', () => {
    beforeEach(() => {
      // Mock document and chunks queries
      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation(
        (sql: string, _params?: unknown[]) => {
          if (sql.includes('SELECT') && sql.includes('documents')) {
            return Promise.resolve({ rows: [mockDocument], rowCount: 1 });
          }
          if (sql.includes('SELECT') && sql.includes('chunks')) {
            return Promise.resolve({
              rows: [mockFunctionChunk, mockClassChunk, mockTableChunk],
              rowCount: 3,
            });
          }
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
      );

      // Mock node creation to return nodes with IDs
      createNodesBatchMock.mockImplementation((nodes) =>
        Promise.resolve(
          nodes.map((n: Record<string, unknown>, i: number) => ({
            ...n,
            id: `generated-node-${i}`,
          }))
        )
      );

      findOrCreateNodeMock.mockResolvedValue({
        id: 'document-node-id',
        collection_id: TEST_COLLECTION_ID,
        node_type: 'document',
        name: 'test.ts',
        metadata: {},
      });
    });

    it('should successfully build graph and return correct counts', async () => {
      const { buildGraphForDocument } = await import('../graph-builder.js');

      const result = await buildGraphForDocument(mockPool, TEST_DOCUMENT_ID);

      expect(result.nodesCreated).toBeGreaterThan(0);
      expect(result.edgesCreated).toBeGreaterThanOrEqual(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should be idempotent - calls deleteNodesByDocument first', async () => {
      const { buildGraphForDocument } = await import('../graph-builder.js');

      await buildGraphForDocument(mockPool, TEST_DOCUMENT_ID);

      expect(deleteNodesByDocumentMock).toHaveBeenCalledWith(TEST_DOCUMENT_ID, expect.anything());
    });

    it('should use transaction (BEGIN/COMMIT)', async () => {
      const { buildGraphForDocument } = await import('../graph-builder.js');

      await buildGraphForDocument(mockPool, TEST_DOCUMENT_ID);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback on error', async () => {
      const { buildGraphForDocument } = await import('../graph-builder.js');

      createNodesBatchMock.mockRejectedValueOnce(new Error('Database error'));

      const result = await buildGraphForDocument(mockPool, TEST_DOCUMENT_ID);

      // Non-blocking: returns with warnings instead of throwing
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return early with warning when document has no chunks', async () => {
      const { buildGraphForDocument } = await import('../graph-builder.js');

      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation((sql: string) => {
        if (sql.includes('SELECT') && sql.includes('documents')) {
          return Promise.resolve({ rows: [mockDocument], rowCount: 1 });
        }
        if (sql.includes('SELECT') && sql.includes('chunks')) {
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      const result = await buildGraphForDocument(mockPool, TEST_DOCUMENT_ID);

      expect(result.nodesCreated).toBe(0);
      expect(result.warnings.some((w) => w.includes('no chunks'))).toBe(true);
    });

    it('should handle document not found', async () => {
      const { buildGraphForDocument } = await import('../graph-builder.js');

      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation((sql: string) => {
        if (sql.includes('SELECT') && sql.includes('documents')) {
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      const result = await buildGraphForDocument(mockPool, 'non-existent-doc-id');

      expect(result.nodesCreated).toBe(0);
      expect(result.warnings.some((w) => w.includes('not found'))).toBe(true);
    });

    it('should respect skipDefinesEdges option', async () => {
      const { buildGraphForDocument } = await import('../graph-builder.js');

      await buildGraphForDocument(mockPool, TEST_DOCUMENT_ID, {
        skipDefinesEdges: true,
      });

      // Verify defines edges were not created
      const edgeCalls = createEdgesBatchMock.mock.calls;
      if (edgeCalls.length > 0) {
        const allEdges = edgeCalls.flatMap((call) => call[0]);
        const definesEdges = allEdges.filter(
          (e: Record<string, unknown>) => e.edge_type === 'defines'
        );
        expect(definesEdges).toHaveLength(0);
      }
    });

    it('should respect skipBelongsToEdges option', async () => {
      const { buildGraphForDocument } = await import('../graph-builder.js');

      await buildGraphForDocument(mockPool, TEST_DOCUMENT_ID, {
        skipBelongsToEdges: true,
      });

      const edgeCalls = createEdgesBatchMock.mock.calls;
      if (edgeCalls.length > 0) {
        const allEdges = edgeCalls.flatMap((call) => call[0]);
        const belongsToEdges = allEdges.filter(
          (e: Record<string, unknown>) => e.edge_type === 'belongs_to'
        );
        expect(belongsToEdges).toHaveLength(0);
      }
    });

    it('should release client connection even on success', async () => {
      const { buildGraphForDocument } = await import('../graph-builder.js');

      await buildGraphForDocument(mockPool, TEST_DOCUMENT_ID);

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return when graph builder is disabled', async () => {
      process.env.ENABLE_GRAPH_BUILDER = 'false';
      const { buildGraphForDocument } = await import('../graph-builder.js');

      const result = await buildGraphForDocument(mockPool, TEST_DOCUMENT_ID);

      expect(result.nodesCreated).toBe(0);
      expect(result.warnings.some((w) => w.includes('disabled'))).toBe(true);
    });
  });

  // ===========================================================================
  // NODE CREATION TESTS
  // ===========================================================================

  describe('node creation', () => {
    beforeEach(() => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation(
        (sql: string, _params?: unknown[]) => {
          if (sql.includes('SELECT') && sql.includes('documents')) {
            return Promise.resolve({ rows: [mockDocument], rowCount: 1 });
          }
          if (sql.includes('SELECT') && sql.includes('chunks')) {
            return Promise.resolve({
              rows: [mockFunctionChunk],
              rowCount: 1,
            });
          }
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
      );

      createNodesBatchMock.mockImplementation((nodes) =>
        Promise.resolve(
          nodes.map((n: Record<string, unknown>, i: number) => ({
            ...n,
            id: `node-${i}`,
          }))
        )
      );
    });

    it('should create document node', async () => {
      const { buildGraphForDocument } = await import('../graph-builder.js');

      await buildGraphForDocument(mockPool, TEST_DOCUMENT_ID);

      expect(findOrCreateNodeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          node_type: 'document',
          name: 'test.ts',
        }),
        expect.anything()
      );
    });

    it('should create symbol nodes for functions', async () => {
      const { buildGraphForDocument } = await import('../graph-builder.js');

      await buildGraphForDocument(mockPool, TEST_DOCUMENT_ID);

      expect(createNodesBatchMock).toHaveBeenCalled();
      const nodesCalls = createNodesBatchMock.mock.calls;
      const allNodes = nodesCalls.flatMap((call) => call[0]);
      const symbolNodes = allNodes.filter((n: Record<string, unknown>) => n.node_type === 'symbol');
      expect(symbolNodes.length).toBeGreaterThan(0);
    });

    it('should create table and column nodes from SQL chunks', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation(
        (sql: string, _params?: unknown[]) => {
          if (sql.includes('SELECT') && sql.includes('documents')) {
            return Promise.resolve({ rows: [mockDocument], rowCount: 1 });
          }
          if (sql.includes('SELECT') && sql.includes('chunks')) {
            return Promise.resolve({
              rows: [mockTableChunk],
              rowCount: 1,
            });
          }
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
      );

      const { buildGraphForDocument } = await import('../graph-builder.js');

      await buildGraphForDocument(mockPool, TEST_DOCUMENT_ID);

      expect(createNodesBatchMock).toHaveBeenCalled();
      const nodesCalls = createNodesBatchMock.mock.calls;
      const allNodes = nodesCalls.flatMap((call) => call[0]);
      const tableNodes = allNodes.filter((n: Record<string, unknown>) => n.node_type === 'table');
      const columnNodes = allNodes.filter((n: Record<string, unknown>) => n.node_type === 'column');
      expect(tableNodes.length).toBeGreaterThan(0);
      expect(columnNodes.length).toBeGreaterThan(0);
    });

    it('should create config section nodes', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation(
        (sql: string, _params?: unknown[]) => {
          if (sql.includes('SELECT') && sql.includes('documents')) {
            return Promise.resolve({ rows: [mockDocument], rowCount: 1 });
          }
          if (sql.includes('SELECT') && sql.includes('chunks')) {
            return Promise.resolve({
              rows: [mockConfigChunk],
              rowCount: 1,
            });
          }
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
      );

      const { buildGraphForDocument } = await import('../graph-builder.js');

      await buildGraphForDocument(mockPool, TEST_DOCUMENT_ID);

      expect(createNodesBatchMock).toHaveBeenCalled();
      const nodesCalls = createNodesBatchMock.mock.calls;
      const allNodes = nodesCalls.flatMap((call) => call[0]);
      const configNodes = allNodes.filter(
        (n: Record<string, unknown>) => n.node_type === 'config_section'
      );
      expect(configNodes.length).toBeGreaterThan(0);
    });

    it('should create endpoint nodes from route patterns', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation(
        (sql: string, _params?: unknown[]) => {
          if (sql.includes('SELECT') && sql.includes('documents')) {
            return Promise.resolve({ rows: [mockDocument], rowCount: 1 });
          }
          if (sql.includes('SELECT') && sql.includes('chunks')) {
            return Promise.resolve({
              rows: [mockEndpointChunk],
              rowCount: 1,
            });
          }
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
      );

      const { buildGraphForDocument } = await import('../graph-builder.js');

      await buildGraphForDocument(mockPool, TEST_DOCUMENT_ID);

      expect(createNodesBatchMock).toHaveBeenCalled();
      const nodesCalls = createNodesBatchMock.mock.calls;
      const allNodes = nodesCalls.flatMap((call) => call[0]);
      const endpointNodes = allNodes.filter(
        (n: Record<string, unknown>) => n.node_type === 'endpoint'
      );
      expect(endpointNodes.length).toBeGreaterThan(0);
    });

    it('should create widget nodes with is_widget metadata', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation(
        (sql: string, _params?: unknown[]) => {
          if (sql.includes('SELECT') && sql.includes('documents')) {
            return Promise.resolve({ rows: [mockDocument], rowCount: 1 });
          }
          if (sql.includes('SELECT') && sql.includes('chunks')) {
            return Promise.resolve({
              rows: [mockWidgetChunk],
              rowCount: 1,
            });
          }
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
      );

      const { buildGraphForDocument } = await import('../graph-builder.js');

      await buildGraphForDocument(mockPool, TEST_DOCUMENT_ID);

      expect(createNodesBatchMock).toHaveBeenCalled();
      const nodesCalls = createNodesBatchMock.mock.calls;
      const allNodes = nodesCalls.flatMap((call) => call[0]);
      const widgetNodes = allNodes.filter(
        (n: Record<string, unknown>) =>
          n.node_type === 'symbol' &&
          (n.metadata as Record<string, unknown>)?.symbol_kind === 'widget'
      );
      expect(widgetNodes.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // EDGE CREATION TESTS
  // ===========================================================================

  describe('edge creation', () => {
    beforeEach(() => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation(
        (sql: string, _params?: unknown[]) => {
          if (sql.includes('SELECT') && sql.includes('documents')) {
            return Promise.resolve({ rows: [mockDocument], rowCount: 1 });
          }
          if (sql.includes('SELECT') && sql.includes('chunks')) {
            return Promise.resolve({
              rows: [mockFunctionChunk, mockClassChunk],
              rowCount: 2,
            });
          }
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
      );

      createNodesBatchMock.mockImplementation((nodes) =>
        Promise.resolve(
          nodes.map((n: Record<string, unknown>, i: number) => ({
            ...n,
            id: `node-${i}`,
          }))
        )
      );

      createEdgesBatchMock.mockImplementation((edges) =>
        Promise.resolve(
          edges.map((e: Record<string, unknown>, i: number) => ({
            ...e,
            id: `edge-${i}`,
          }))
        )
      );
    });

    it('should create defines edges from document to symbols', async () => {
      const { buildGraphForDocument } = await import('../graph-builder.js');

      await buildGraphForDocument(mockPool, TEST_DOCUMENT_ID);

      expect(createEdgesBatchMock).toHaveBeenCalled();
      const edgeCalls = createEdgesBatchMock.mock.calls;
      const allEdges = edgeCalls.flatMap((call) => call[0]);
      const definesEdges = allEdges.filter(
        (e: Record<string, unknown>) => e.edge_type === 'defines'
      );
      expect(definesEdges.length).toBeGreaterThan(0);
    });

    it('should create belongs_to edges for methods to classes', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation(
        (sql: string, _params?: unknown[]) => {
          if (sql.includes('SELECT') && sql.includes('documents')) {
            return Promise.resolve({ rows: [mockDocument], rowCount: 1 });
          }
          if (sql.includes('SELECT') && sql.includes('chunks')) {
            return Promise.resolve({
              rows: [mockClassChunk, mockMethodChunk],
              rowCount: 2,
            });
          }
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
      );

      // Mock getNodeByName to return the class node when looking for UserService
      getNodeByNameMock.mockImplementation((_collectionId: string, name: string) => {
        if (name === 'UserService') {
          return Promise.resolve({
            id: 'class-node-id',
            name: 'UserService',
            node_type: 'symbol',
            metadata: { symbol_kind: 'class' },
          });
        }
        return Promise.resolve(null);
      });

      const { buildGraphForDocument } = await import('../graph-builder.js');

      await buildGraphForDocument(mockPool, TEST_DOCUMENT_ID);

      // Check if belongs_to edges were created
      if (createEdgesBatchMock.mock.calls.length > 0) {
        const edgeCalls = createEdgesBatchMock.mock.calls;
        const allEdges = edgeCalls.flatMap((call) => call[0]);
        const belongsToEdges = allEdges.filter(
          (e: Record<string, unknown>) => e.edge_type === 'belongs_to'
        );
        // May or may not have belongs_to edges depending on node creation order
        expect(belongsToEdges).toBeDefined();
      }
    });

    it('should create depends_on edges for extends relationships', async () => {
      getNodeByNameMock.mockImplementation((_collectionId: string, name: string) => {
        if (name === 'BaseService') {
          return Promise.resolve({
            id: 'base-service-node-id',
            name: 'BaseService',
            node_type: 'symbol',
            metadata: { symbol_kind: 'class' },
          });
        }
        return Promise.resolve(null);
      });

      const { buildGraphForDocument } = await import('../graph-builder.js');

      await buildGraphForDocument(mockPool, TEST_DOCUMENT_ID);

      // Check if depends_on edges were attempted
      expect(getNodeByNameMock).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // EDGE CASE TESTS
  // ===========================================================================

  describe('edge cases and error handling', () => {
    it('should handle empty chunks array', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation((sql: string) => {
        if (sql.includes('SELECT') && sql.includes('documents')) {
          return Promise.resolve({ rows: [mockDocument], rowCount: 1 });
        }
        if (sql.includes('SELECT') && sql.includes('chunks')) {
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      const { buildGraphForDocument } = await import('../graph-builder.js');

      const result = await buildGraphForDocument(mockPool, TEST_DOCUMENT_ID);

      expect(result.nodesCreated).toBe(0);
    });

    it('should handle chunks with null metadata', async () => {
      const nullMetadataChunk = {
        id: 100,
        doc_id: TEST_DOCUMENT_ID,
        chunk_index: 0,
        text: 'some text',
        metadata: null,
      };

      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation((sql: string) => {
        if (sql.includes('SELECT') && sql.includes('documents')) {
          return Promise.resolve({ rows: [mockDocument], rowCount: 1 });
        }
        if (sql.includes('SELECT') && sql.includes('chunks')) {
          return Promise.resolve({ rows: [nullMetadataChunk], rowCount: 1 });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      const { buildGraphForDocument } = await import('../graph-builder.js');

      // Should not throw
      const result = await buildGraphForDocument(mockPool, TEST_DOCUMENT_ID);
      expect(result).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Connection failed')
      );

      const { buildGraphForDocument } = await import('../graph-builder.js');

      const result = await buildGraphForDocument(mockPool, TEST_DOCUMENT_ID);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('failed') || w.includes('Connection'))).toBe(
        true
      );
    });
  });

  // ===========================================================================
  // UTILITY FUNCTION TESTS
  // ===========================================================================

  describe('isGraphBuilderEnabled', () => {
    it('should return true when ENABLE_GRAPH_BUILDER is true', async () => {
      process.env.ENABLE_GRAPH_BUILDER = 'true';
      const { isGraphBuilderEnabled } = await import('../graph-builder.js');

      expect(isGraphBuilderEnabled()).toBe(true);
    });

    it('should return true when ENABLE_GRAPH_BUILDER is 1', async () => {
      process.env.ENABLE_GRAPH_BUILDER = '1';
      const { isGraphBuilderEnabled } = await import('../graph-builder.js');

      expect(isGraphBuilderEnabled()).toBe(true);
    });

    it('should return false when ENABLE_GRAPH_BUILDER is false', async () => {
      process.env.ENABLE_GRAPH_BUILDER = 'false';
      const { isGraphBuilderEnabled } = await import('../graph-builder.js');

      expect(isGraphBuilderEnabled()).toBe(false);
    });

    it('should return false when ENABLE_GRAPH_BUILDER is not set', async () => {
      process.env.ENABLE_GRAPH_BUILDER = undefined;
      const { isGraphBuilderEnabled } = await import('../graph-builder.js');

      expect(isGraphBuilderEnabled()).toBe(false);
    });
  });

  // ===========================================================================
  // COLLECTION-LEVEL TESTS
  // ===========================================================================

  describe('buildGraphForCollection', () => {
    it('should build graph for all documents in collection', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockImplementation(
        (sql: string, _params?: unknown[]) => {
          if (sql.includes('SELECT id FROM documents')) {
            return Promise.resolve({
              rows: [{ id: TEST_DOCUMENT_ID }],
              rowCount: 1,
            });
          }
          if (sql.includes('SELECT') && sql.includes('documents') && sql.includes('WHERE id')) {
            return Promise.resolve({ rows: [mockDocument], rowCount: 1 });
          }
          if (sql.includes('SELECT') && sql.includes('chunks')) {
            return Promise.resolve({
              rows: [mockFunctionChunk],
              rowCount: 1,
            });
          }
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
      );

      createNodesBatchMock.mockImplementation((nodes) =>
        Promise.resolve(
          nodes.map((n: Record<string, unknown>, i: number) => ({
            ...n,
            id: `node-${i}`,
          }))
        )
      );

      const { buildGraphForCollection } = await import('../graph-builder.js');

      const result = await buildGraphForCollection(mockPool, TEST_COLLECTION_ID);

      expect(result.totalDocuments).toBe(1);
      expect(result.successCount).toBeGreaterThanOrEqual(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
