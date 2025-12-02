/**
 * GPT Phase 3 Sub-Phase 5.2: Symbol Search Service Tests
 *
 * Unit tests for the symbol-search service that finds symbol definitions
 * and usages across the knowledge graph for code navigation features.
 */

import type { Pool, QueryResult } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// =============================================================================
// MOCK SETUP
// =============================================================================

// We import after setting up the environment
// The module will be imported in each test to ensure fresh state
const mockQuery = vi.fn();

const createMockPool = () => {
  return {
    query: mockQuery,
  } as unknown as Pool;
};

// =============================================================================
// TEST DATA
// =============================================================================

const TEST_COLLECTION_ID = 'col-11111111-1111-4111-8111-111111111111';
const TEST_SYMBOL_NODE_ID = 'node-22222222-2222-4222-8222-222222222222';
const TEST_SYMBOL_NODE_ID_2 = 'node-33333333-3333-4333-8333-333333333333';
const TEST_DEFINITION_NODE_ID = 'node-44444444-4444-4444-8444-444444444444';
const TEST_USAGE_NODE_ID = 'node-55555555-5555-4555-8555-555555555555';
const TEST_USAGE_NODE_ID_2 = 'node-66666666-6666-4666-8666-666666666666';
const TEST_DOC_ID = 'doc-77777777-7777-4777-8777-777777777777';
const TEST_DOC_ID_2 = 'doc-88888888-8888-4888-8888-888888888888';
const TEST_CHUNK_ID = 1;
const TEST_CHUNK_ID_2 = 2;

/**
 * Create a mock symbol node row
 */
const createMockSymbolNode = (
  id: string,
  name: string,
  metadata: Record<string, unknown> = {},
  chunkId: number | null = null,
  documentId: string | null = null
) => ({
  id,
  collection_id: TEST_COLLECTION_ID,
  node_type: 'symbol',
  name,
  document_id: documentId,
  chunk_id: chunkId,
  metadata,
  created_at: new Date(),
});

/**
 * Create a mock location row from edge query
 */
const createMockLocationRow = (
  sourceNodeId: string,
  targetNodeId: string,
  edgeType: string,
  nodeName: string,
  documentId: string | null = null,
  chunkId: number | null = null,
  nodeMetadata: Record<string, unknown> = {}
) => ({
  source_node_id: sourceNodeId,
  target_node_id: targetNodeId,
  edge_type: edgeType,
  edge_metadata: {},
  node_id: sourceNodeId,
  node_name: nodeName,
  document_id: documentId,
  chunk_id: chunkId,
  node_metadata: nodeMetadata,
});

/**
 * Create a mock chunk data row
 */
const createMockChunk = (id: number, text: string) => ({
  id,
  text,
});

/**
 * Create a mock document data row
 */
const createMockDocument = (id: string, title: string) => ({
  id,
  title,
});

// =============================================================================
// TEST SUITE
// =============================================================================

describe('SymbolSearch Service', () => {
  let mockPool: Pool;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockPool = createMockPool();

    // Clear environment variables before each test
    process.env.ENABLE_SYMBOL_SEARCH = undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env.ENABLE_SYMBOL_SEARCH = undefined;
  });

  // ===========================================================================
  // isSymbolSearchEnabled TESTS
  // ===========================================================================

  describe('isSymbolSearchEnabled', () => {
    it('should return true when ENABLE_SYMBOL_SEARCH=true', async () => {
      process.env.ENABLE_SYMBOL_SEARCH = 'true';
      const { isSymbolSearchEnabled } = await import('../symbol-search.js');
      expect(isSymbolSearchEnabled()).toBe(true);
    });

    it('should return false when ENABLE_SYMBOL_SEARCH=false', async () => {
      process.env.ENABLE_SYMBOL_SEARCH = 'false';
      const { isSymbolSearchEnabled } = await import('../symbol-search.js');
      expect(isSymbolSearchEnabled()).toBe(false);
    });

    it('should return false when ENABLE_SYMBOL_SEARCH is not set', async () => {
      process.env.ENABLE_SYMBOL_SEARCH = undefined;
      const { isSymbolSearchEnabled } = await import('../symbol-search.js');
      expect(isSymbolSearchEnabled()).toBe(false);
    });

    it('should return false when ENABLE_SYMBOL_SEARCH has other value', async () => {
      process.env.ENABLE_SYMBOL_SEARCH = '1';
      const { isSymbolSearchEnabled } = await import('../symbol-search.js');
      expect(isSymbolSearchEnabled()).toBe(false);
    });

    it('should return false when ENABLE_SYMBOL_SEARCH is empty string', async () => {
      process.env.ENABLE_SYMBOL_SEARCH = '';
      const { isSymbolSearchEnabled } = await import('../symbol-search.js');
      expect(isSymbolSearchEnabled()).toBe(false);
    });
  });

  // ===========================================================================
  // findSymbolUsages TESTS
  // ===========================================================================

  describe('findSymbolUsages', () => {
    // =========================================================================
    // EMPTY RESULT SCENARIOS
    // =========================================================================

    describe('empty result scenarios', () => {
      it('should return empty result when no matching symbols found', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock query to return no symbol nodes
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'NonExistentSymbol',
        });

        expect(result.symbol).toBeNull();
        expect(result.definitions).toHaveLength(0);
        expect(result.usages).toHaveLength(0);
        expect(result.stats.totalDefinitions).toBe(0);
        expect(result.stats.totalUsages).toBe(0);
        expect(result.stats.documentsWithUsages).toBe(0);
        expect(result.stats.searchDurationMs).toBeGreaterThanOrEqual(0);
      });

      it('should return empty result when collectionId is empty', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        const result = await findSymbolUsages(mockPool, {
          collectionId: '',
          symbolName: 'SomeSymbol',
        });

        expect(result.symbol).toBeNull();
        expect(result.definitions).toHaveLength(0);
        expect(result.usages).toHaveLength(0);
        expect(mockQuery).not.toHaveBeenCalled();
      });

      it('should return empty result when symbolName is empty', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: '',
        });

        expect(result.symbol).toBeNull();
        expect(result.definitions).toHaveLength(0);
        expect(result.usages).toHaveLength(0);
        expect(mockQuery).not.toHaveBeenCalled();
      });
    });

    // =========================================================================
    // SYMBOL FINDING TESTS
    // =========================================================================

    describe('symbol finding', () => {
      it('should find symbols by exact name match (case-insensitive)', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'UserService', { kind: 'class' })],
        } as QueryResult);

        // Mock definitions query (empty)
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        // Mock usages query (empty)
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'userservice', // lowercase to test case-insensitivity
        });

        expect(result.symbol).not.toBeNull();
        expect(result.symbol?.name).toBe('UserService');
        expect(result.symbol?.kind).toBe('class');
        expect(result.symbol?.nodeId).toBe(TEST_SYMBOL_NODE_ID);

        // Verify the query used ILIKE for case-insensitive search
        expect(mockQuery).toHaveBeenCalledWith(
          expect.stringContaining('ILIKE'),
          expect.arrayContaining([TEST_COLLECTION_ID, '%userservice%', 'userservice'])
        );
      });

      it('should use the first matching symbol as the primary result', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding multiple symbol nodes
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'handleClick', { kind: 'function' }),
            createMockSymbolNode(TEST_SYMBOL_NODE_ID_2, 'handleClickEvent', { kind: 'function' }),
          ],
        } as QueryResult);

        // Mock definitions query (empty)
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        // Mock usages query (empty)
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'handleClick',
        });

        // Should use first match as primary
        expect(result.symbol?.name).toBe('handleClick');
        expect(result.symbol?.nodeId).toBe(TEST_SYMBOL_NODE_ID);
      });
    });

    // =========================================================================
    // SYMBOL KIND FILTERING TESTS
    // =========================================================================

    describe('symbol kind filtering', () => {
      it('should filter by symbolKind when provided', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding multiple symbol nodes with different kinds
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'Button', { kind: 'widget' }),
            createMockSymbolNode(TEST_SYMBOL_NODE_ID_2, 'ButtonClass', { kind: 'class' }),
          ],
        } as QueryResult);

        // Mock definitions query (empty)
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        // Mock usages query (empty)
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'Button',
          symbolKind: 'widget',
        });

        // Should only return the widget kind symbol
        expect(result.symbol?.name).toBe('Button');
        expect(result.symbol?.kind).toBe('widget');
      });

      it('should return empty when no symbols match the kind filter', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol nodes with different kind
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'fetchData', { kind: 'function' })],
        } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'fetchData',
          symbolKind: 'class', // Looking for class, but found function
        });

        expect(result.symbol).toBeNull();
        expect(result.definitions).toHaveLength(0);
        expect(result.usages).toHaveLength(0);
      });

      it('should infer symbol kind from name patterns when metadata.kind is absent', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node without explicit kind in metadata
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'UserRepository', {}), // Class pattern
          ],
        } as QueryResult);

        // Mock definitions query (empty)
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        // Mock usages query (empty)
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'UserRepository',
        });

        // Should infer 'class' from PascalCase with Repository suffix
        expect(result.symbol?.kind).toBe('class');
      });

      it('should infer widget kind from widget pattern', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'LoginWidget', {})],
        } as QueryResult);

        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'LoginWidget',
        });

        expect(result.symbol?.kind).toBe('widget');
      });

      it('should infer method kind from verb patterns', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'fetchUserData', {})],
        } as QueryResult);

        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'fetchUserData',
        });

        expect(result.symbol?.kind).toBe('method');
      });

      it('should infer constant kind from ALL_CAPS pattern', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'MAX_RETRY_COUNT', {})],
        } as QueryResult);

        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'MAX_RETRY_COUNT',
        });

        expect(result.symbol?.kind).toBe('constant');
      });

      it('should default to function kind when no pattern matches', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'someName', {})],
        } as QueryResult);

        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'someName',
        });

        expect(result.symbol?.kind).toBe('function');
      });
    });

    // =========================================================================
    // DEFINITIONS TESTS
    // =========================================================================

    describe('definitions', () => {
      it('should return definitions when includeDefinitions is true', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'UserService', { kind: 'class' })],
        } as QueryResult);

        // Mock definitions query
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockLocationRow(
              TEST_DEFINITION_NODE_ID,
              TEST_SYMBOL_NODE_ID,
              'defines',
              'UserService.dart',
              TEST_DOC_ID,
              TEST_CHUNK_ID,
              { file_path: 'lib/services/user_service.dart', line_number: 10 }
            ),
          ],
        } as QueryResult);

        // Mock usages query (empty)
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        // Mock chunk fetch
        mockQuery.mockResolvedValueOnce({
          rows: [createMockChunk(TEST_CHUNK_ID, 'class UserService { ... }')],
        } as QueryResult);

        // Mock document fetch
        mockQuery.mockResolvedValueOnce({
          rows: [createMockDocument(TEST_DOC_ID, 'UserService.dart')],
        } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'UserService',
          includeDefinitions: true,
        });

        expect(result.definitions).toHaveLength(1);
        expect(result.definitions[0].nodeId).toBe(TEST_DEFINITION_NODE_ID);
        expect(result.definitions[0].documentId).toBe(TEST_DOC_ID);
        expect(result.definitions[0].chunkId).toBe(TEST_CHUNK_ID);
        expect(result.definitions[0].filePath).toBe('lib/services/user_service.dart');
        expect(result.definitions[0].lineNumber).toBe(10);
        expect(result.definitions[0].chunkText).toBe('class UserService { ... }');
        expect(result.definitions[0].documentTitle).toBe('UserService.dart');
        expect(result.stats.totalDefinitions).toBe(1);
      });

      it('should not include definitions when includeDefinitions is false', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'UserService', { kind: 'class' })],
        } as QueryResult);

        // Mock usages query (empty)
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'UserService',
          includeDefinitions: false,
          includeUsages: true,
        });

        expect(result.definitions).toHaveLength(0);
        expect(result.stats.totalDefinitions).toBe(0);
      });

      it('should handle symbols with no definitions', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'ExternalLib', { kind: 'class' })],
        } as QueryResult);

        // Mock definitions query (empty - no definitions found)
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        // Mock usages query
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockLocationRow(
              TEST_USAGE_NODE_ID,
              TEST_SYMBOL_NODE_ID,
              'imports',
              'main.dart',
              TEST_DOC_ID,
              TEST_CHUNK_ID,
              {}
            ),
          ],
        } as QueryResult);

        // Mock chunk fetch
        mockQuery.mockResolvedValueOnce({
          rows: [createMockChunk(TEST_CHUNK_ID, 'import ExternalLib;')],
        } as QueryResult);

        // Mock document fetch
        mockQuery.mockResolvedValueOnce({
          rows: [createMockDocument(TEST_DOC_ID, 'main.dart')],
        } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'ExternalLib',
        });

        expect(result.symbol).not.toBeNull();
        expect(result.definitions).toHaveLength(0);
        expect(result.usages).toHaveLength(1);
        expect(result.stats.totalDefinitions).toBe(0);
        expect(result.stats.totalUsages).toBe(1);
      });
    });

    // =========================================================================
    // USAGES TESTS
    // =========================================================================

    describe('usages', () => {
      it('should return usages when includeUsages is true', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'formatDate', { kind: 'function' })],
        } as QueryResult);

        // Mock definitions query (empty)
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        // Mock usages query
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockLocationRow(
              TEST_USAGE_NODE_ID,
              TEST_SYMBOL_NODE_ID,
              'calls',
              'DateDisplay',
              TEST_DOC_ID,
              TEST_CHUNK_ID,
              { file_path: 'lib/widgets/date_display.dart', lineNumber: 25 }
            ),
          ],
        } as QueryResult);

        // Mock chunk fetch
        mockQuery.mockResolvedValueOnce({
          rows: [createMockChunk(TEST_CHUNK_ID, 'final formatted = formatDate(date);')],
        } as QueryResult);

        // Mock document fetch
        mockQuery.mockResolvedValueOnce({
          rows: [createMockDocument(TEST_DOC_ID, 'DateDisplay.dart')],
        } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'formatDate',
          includeUsages: true,
        });

        expect(result.usages).toHaveLength(1);
        expect(result.usages[0].nodeId).toBe(TEST_USAGE_NODE_ID);
        expect(result.usages[0].edgeType).toBe('calls');
        expect(result.usages[0].chunkText).toBe('final formatted = formatDate(date);');
        expect(result.usages[0].documentTitle).toBe('DateDisplay.dart');
        expect(result.stats.totalUsages).toBe(1);
      });

      it('should not include usages when includeUsages is false', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'formatDate', { kind: 'function' })],
        } as QueryResult);

        // Mock definitions query (empty)
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'formatDate',
          includeDefinitions: true,
          includeUsages: false,
        });

        expect(result.usages).toHaveLength(0);
        expect(result.stats.totalUsages).toBe(0);
      });

      it('should handle symbols with no usages', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'UnusedHelper', { kind: 'function' })],
        } as QueryResult);

        // Mock definitions query
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockLocationRow(
              TEST_DEFINITION_NODE_ID,
              TEST_SYMBOL_NODE_ID,
              'defines',
              'helpers.dart',
              TEST_DOC_ID,
              TEST_CHUNK_ID,
              {}
            ),
          ],
        } as QueryResult);

        // Mock usages query (empty)
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        // Mock chunk fetch
        mockQuery.mockResolvedValueOnce({
          rows: [createMockChunk(TEST_CHUNK_ID, 'void unusedHelper() {}')],
        } as QueryResult);

        // Mock document fetch
        mockQuery.mockResolvedValueOnce({
          rows: [createMockDocument(TEST_DOC_ID, 'helpers.dart')],
        } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'UnusedHelper',
        });

        expect(result.symbol).not.toBeNull();
        expect(result.definitions).toHaveLength(1);
        expect(result.usages).toHaveLength(0);
        expect(result.stats.totalDefinitions).toBe(1);
        expect(result.stats.totalUsages).toBe(0);
      });

      it('should include multiple usage edge types (calls, imports, depends_on)', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'ApiClient', { kind: 'class' })],
        } as QueryResult);

        // Mock definitions query (empty)
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        // Mock usages query with different edge types
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockLocationRow(
              TEST_USAGE_NODE_ID,
              TEST_SYMBOL_NODE_ID,
              'imports',
              'user_service.dart',
              TEST_DOC_ID,
              TEST_CHUNK_ID,
              {}
            ),
            createMockLocationRow(
              TEST_USAGE_NODE_ID_2,
              TEST_SYMBOL_NODE_ID,
              'calls',
              'auth_service.dart',
              TEST_DOC_ID_2,
              TEST_CHUNK_ID_2,
              {}
            ),
          ],
        } as QueryResult);

        // Mock chunk fetch
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockChunk(TEST_CHUNK_ID, 'import ApiClient;'),
            createMockChunk(TEST_CHUNK_ID_2, 'apiClient.fetch()'),
          ],
        } as QueryResult);

        // Mock document fetch
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockDocument(TEST_DOC_ID, 'user_service.dart'),
            createMockDocument(TEST_DOC_ID_2, 'auth_service.dart'),
          ],
        } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'ApiClient',
        });

        expect(result.usages).toHaveLength(2);
        expect(result.usages.map((u) => u.edgeType)).toContain('imports');
        expect(result.usages.map((u) => u.edgeType)).toContain('calls');
      });
    });

    // =========================================================================
    // RESULT LIMITS TESTS
    // =========================================================================

    describe('result limits', () => {
      it('should respect maxResults limit', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'CommonUtil', { kind: 'class' })],
        } as QueryResult);

        // Mock definitions query
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        // Mock usages query
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'CommonUtil',
          maxResults: 5,
        });

        // Verify that maxResults is passed to both definition and usage queries
        // The second call is for definitions, the third is for usages
        expect(mockQuery).toHaveBeenCalledTimes(3);

        // Check that the LIMIT clause is used correctly in definition query
        const definitionQueryCall = mockQuery.mock.calls[1];
        expect(definitionQueryCall[1]).toContain(5); // maxResults

        // Check that the LIMIT clause is used correctly in usage query
        const usageQueryCall = mockQuery.mock.calls[2];
        expect(usageQueryCall[1]).toContain(5); // maxResults
      });

      it('should use default maxResults of 20 when not specified', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'CommonUtil', { kind: 'class' })],
        } as QueryResult);

        // Mock definitions query
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        // Mock usages query
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'CommonUtil',
          // maxResults not specified
        });

        // Verify default limit of 20 is used
        const definitionQueryCall = mockQuery.mock.calls[1];
        expect(definitionQueryCall[1]).toContain(20); // default maxResults

        const usageQueryCall = mockQuery.mock.calls[2];
        expect(usageQueryCall[1]).toContain(20); // default maxResults
      });
    });

    // =========================================================================
    // STATS TESTS
    // =========================================================================

    describe('stats', () => {
      it('should return proper stats for totalDefinitions and totalUsages', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'ApiService', { kind: 'class' })],
        } as QueryResult);

        // Mock definitions query (2 definitions)
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockLocationRow(
              TEST_DEFINITION_NODE_ID,
              TEST_SYMBOL_NODE_ID,
              'defines',
              'api.dart',
              TEST_DOC_ID,
              TEST_CHUNK_ID,
              {}
            ),
            createMockLocationRow(
              'node-def-2',
              TEST_SYMBOL_NODE_ID,
              'defines',
              'api_impl.dart',
              TEST_DOC_ID_2,
              TEST_CHUNK_ID_2,
              {}
            ),
          ],
        } as QueryResult);

        // Mock usages query (3 usages)
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockLocationRow(
              TEST_USAGE_NODE_ID,
              TEST_SYMBOL_NODE_ID,
              'calls',
              'user.dart',
              TEST_DOC_ID,
              TEST_CHUNK_ID,
              {}
            ),
            createMockLocationRow(
              TEST_USAGE_NODE_ID_2,
              TEST_SYMBOL_NODE_ID,
              'imports',
              'auth.dart',
              TEST_DOC_ID_2,
              TEST_CHUNK_ID_2,
              {}
            ),
            createMockLocationRow(
              'node-usage-3',
              TEST_SYMBOL_NODE_ID,
              'depends_on',
              'main.dart',
              'doc-3',
              3,
              {}
            ),
          ],
        } as QueryResult);

        // Mock chunk fetch
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockChunk(TEST_CHUNK_ID, 'chunk 1'),
            createMockChunk(TEST_CHUNK_ID_2, 'chunk 2'),
            createMockChunk(3, 'chunk 3'),
          ],
        } as QueryResult);

        // Mock document fetch
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockDocument(TEST_DOC_ID, 'api.dart'),
            createMockDocument(TEST_DOC_ID_2, 'auth.dart'),
            createMockDocument('doc-3', 'main.dart'),
          ],
        } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'ApiService',
        });

        expect(result.stats.totalDefinitions).toBe(2);
        expect(result.stats.totalUsages).toBe(3);
      });

      it('should correctly count documentsWithUsages', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'Logger', { kind: 'class' })],
        } as QueryResult);

        // Mock definitions query (empty)
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        // Mock usages query (3 usages, 2 unique documents)
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockLocationRow(
              TEST_USAGE_NODE_ID,
              TEST_SYMBOL_NODE_ID,
              'calls',
              'auth.dart',
              TEST_DOC_ID,
              TEST_CHUNK_ID,
              {}
            ),
            createMockLocationRow(
              TEST_USAGE_NODE_ID_2,
              TEST_SYMBOL_NODE_ID,
              'calls',
              'user.dart',
              TEST_DOC_ID, // Same document as first usage
              TEST_CHUNK_ID_2,
              {}
            ),
            createMockLocationRow(
              'node-usage-3',
              TEST_SYMBOL_NODE_ID,
              'imports',
              'main.dart',
              TEST_DOC_ID_2, // Different document
              3,
              {}
            ),
          ],
        } as QueryResult);

        // Mock chunk fetch
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockChunk(TEST_CHUNK_ID, 'chunk 1'),
            createMockChunk(TEST_CHUNK_ID_2, 'chunk 2'),
            createMockChunk(3, 'chunk 3'),
          ],
        } as QueryResult);

        // Mock document fetch
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockDocument(TEST_DOC_ID, 'auth.dart'),
            createMockDocument(TEST_DOC_ID_2, 'main.dart'),
          ],
        } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'Logger',
        });

        expect(result.stats.documentsWithUsages).toBe(2); // 2 unique documents
      });

      it('should track searchDurationMs correctly', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'QuickFunction', { kind: 'function' })],
        } as QueryResult);

        // Mock definitions query (empty)
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        // Mock usages query (empty)
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'QuickFunction',
        });

        expect(result.stats.searchDurationMs).toBeGreaterThanOrEqual(0);
        expect(typeof result.stats.searchDurationMs).toBe('number');
        expect(Number.isInteger(result.stats.searchDurationMs)).toBe(true);
      });
    });

    // =========================================================================
    // ENRICHMENT TESTS
    // =========================================================================

    describe('enrichment', () => {
      it('should enrich results with chunk text and document info', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'DataModel', { kind: 'class' })],
        } as QueryResult);

        // Mock definitions query
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockLocationRow(
              TEST_DEFINITION_NODE_ID,
              TEST_SYMBOL_NODE_ID,
              'defines',
              'data_model.dart',
              TEST_DOC_ID,
              TEST_CHUNK_ID,
              { file_path: 'lib/models/data_model.dart' }
            ),
          ],
        } as QueryResult);

        // Mock usages query
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockLocationRow(
              TEST_USAGE_NODE_ID,
              TEST_SYMBOL_NODE_ID,
              'imports',
              'service.dart',
              TEST_DOC_ID_2,
              TEST_CHUNK_ID_2,
              { filePath: 'lib/services/service.dart' }
            ),
          ],
        } as QueryResult);

        // Mock chunk fetch
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockChunk(TEST_CHUNK_ID, 'class DataModel { String name; }'),
            createMockChunk(TEST_CHUNK_ID_2, "import 'package:app/models/data_model.dart';"),
          ],
        } as QueryResult);

        // Mock document fetch
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockDocument(TEST_DOC_ID, 'DataModel Definition'),
            createMockDocument(TEST_DOC_ID_2, 'Service File'),
          ],
        } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'DataModel',
        });

        // Check definition enrichment
        expect(result.definitions[0].chunkText).toBe('class DataModel { String name; }');
        expect(result.definitions[0].documentTitle).toBe('DataModel Definition');
        expect(result.definitions[0].filePath).toBe('lib/models/data_model.dart');

        // Check usage enrichment
        expect(result.usages[0].chunkText).toBe("import 'package:app/models/data_model.dart';");
        expect(result.usages[0].documentTitle).toBe('Service File');
        expect(result.usages[0].filePath).toBe('lib/services/service.dart');
      });

      it('should handle locations without associated chunks', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'ExternalApi', { kind: 'class' })],
        } as QueryResult);

        // Mock definitions query with no chunk_id
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockLocationRow(
              TEST_DEFINITION_NODE_ID,
              TEST_SYMBOL_NODE_ID,
              'defines',
              'external.dart',
              TEST_DOC_ID,
              null, // No chunk
              {}
            ),
          ],
        } as QueryResult);

        // Mock usages query (empty)
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        // No chunk fetch needed (empty chunk IDs)

        // Mock document fetch
        mockQuery.mockResolvedValueOnce({
          rows: [createMockDocument(TEST_DOC_ID, 'External API')],
        } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'ExternalApi',
        });

        expect(result.definitions[0].chunkId).toBeNull();
        expect(result.definitions[0].chunkText).toBeNull();
        expect(result.definitions[0].documentTitle).toBe('External API');
      });

      it('should handle locations without associated documents', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'Orphan', { kind: 'function' })],
        } as QueryResult);

        // Mock definitions query with no document_id
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockLocationRow(
              TEST_DEFINITION_NODE_ID,
              TEST_SYMBOL_NODE_ID,
              'defines',
              'orphan.dart',
              null, // No document
              TEST_CHUNK_ID,
              {}
            ),
          ],
        } as QueryResult);

        // Mock usages query (empty)
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        // Mock chunk fetch
        mockQuery.mockResolvedValueOnce({
          rows: [createMockChunk(TEST_CHUNK_ID, 'void orphan() {}')],
        } as QueryResult);

        // No document fetch needed (empty document IDs)

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'Orphan',
        });

        expect(result.definitions[0].documentId).toBeNull();
        expect(result.definitions[0].documentTitle).toBeNull();
        expect(result.definitions[0].chunkText).toBe('void orphan() {}');
      });

      it('should extract file_path from various metadata key formats', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'TestPath', { kind: 'function' })],
        } as QueryResult);

        // Mock definitions query with different file path keys
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockLocationRow(
              TEST_DEFINITION_NODE_ID,
              TEST_SYMBOL_NODE_ID,
              'defines',
              'test1.dart',
              null,
              null,
              { file_path: 'path/with/underscore.dart' }
            ),
          ],
        } as QueryResult);

        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'TestPath',
        });

        expect(result.definitions[0].filePath).toBe('path/with/underscore.dart');
      });

      it('should extract line_number from various metadata key formats', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'TestLine', { kind: 'function' })],
        } as QueryResult);

        // Mock definitions query with different line number keys
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockLocationRow(
              TEST_DEFINITION_NODE_ID,
              TEST_SYMBOL_NODE_ID,
              'defines',
              'test1.dart',
              null,
              null,
              { line_number: 42 }
            ),
          ],
        } as QueryResult);

        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'TestLine',
        });

        expect(result.definitions[0].lineNumber).toBe(42);
      });

      it('should handle line_number as string and parse it', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'TestLineStr', { kind: 'function' })],
        } as QueryResult);

        // Mock definitions query with string line number
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockLocationRow(
              TEST_DEFINITION_NODE_ID,
              TEST_SYMBOL_NODE_ID,
              'defines',
              'test.dart',
              null,
              null,
              { line: '100' } // String value
            ),
          ],
        } as QueryResult);

        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'TestLineStr',
        });

        expect(result.definitions[0].lineNumber).toBe(100);
      });

      it('should return null for invalid line_number values', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'TestInvalid', { kind: 'function' })],
        } as QueryResult);

        // Mock definitions query with invalid line number
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockLocationRow(
              TEST_DEFINITION_NODE_ID,
              TEST_SYMBOL_NODE_ID,
              'defines',
              'test.dart',
              null,
              null,
              { line_number: 'invalid' } // Invalid string
            ),
          ],
        } as QueryResult);

        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'TestInvalid',
        });

        expect(result.definitions[0].lineNumber).toBeNull();
      });
    });

    // =========================================================================
    // DEFAULT BEHAVIOR TESTS
    // =========================================================================

    describe('default behavior', () => {
      it('should include both definitions and usages by default', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'DefaultTest', { kind: 'class' })],
        } as QueryResult);

        // Mock definitions query
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockLocationRow(
              TEST_DEFINITION_NODE_ID,
              TEST_SYMBOL_NODE_ID,
              'defines',
              'default.dart',
              TEST_DOC_ID,
              TEST_CHUNK_ID,
              {}
            ),
          ],
        } as QueryResult);

        // Mock usages query
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockLocationRow(
              TEST_USAGE_NODE_ID,
              TEST_SYMBOL_NODE_ID,
              'calls',
              'caller.dart',
              TEST_DOC_ID_2,
              TEST_CHUNK_ID_2,
              {}
            ),
          ],
        } as QueryResult);

        // Mock chunk fetch
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockChunk(TEST_CHUNK_ID, 'definition chunk'),
            createMockChunk(TEST_CHUNK_ID_2, 'usage chunk'),
          ],
        } as QueryResult);

        // Mock document fetch
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockDocument(TEST_DOC_ID, 'Definition Doc'),
            createMockDocument(TEST_DOC_ID_2, 'Usage Doc'),
          ],
        } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'DefaultTest',
          // Not specifying includeDefinitions or includeUsages
        });

        // Both should be included by default
        expect(result.definitions).toHaveLength(1);
        expect(result.usages).toHaveLength(1);
      });
    });

    // =========================================================================
    // BATCH FETCHING TESTS
    // =========================================================================

    describe('batch fetching', () => {
      it('should batch fetch chunks for all locations', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'BatchTest', { kind: 'class' })],
        } as QueryResult);

        // Mock definitions query with multiple chunks
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockLocationRow(
              TEST_DEFINITION_NODE_ID,
              TEST_SYMBOL_NODE_ID,
              'defines',
              'def1.dart',
              TEST_DOC_ID,
              1,
              {}
            ),
            createMockLocationRow(
              'def-2',
              TEST_SYMBOL_NODE_ID,
              'defines',
              'def2.dart',
              TEST_DOC_ID_2,
              2,
              {}
            ),
          ],
        } as QueryResult);

        // Mock usages query with multiple chunks
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockLocationRow(
              TEST_USAGE_NODE_ID,
              TEST_SYMBOL_NODE_ID,
              'calls',
              'use1.dart',
              'doc-3',
              3,
              {}
            ),
            createMockLocationRow(
              TEST_USAGE_NODE_ID_2,
              TEST_SYMBOL_NODE_ID,
              'imports',
              'use2.dart',
              'doc-4',
              4,
              {}
            ),
          ],
        } as QueryResult);

        // Mock chunk fetch - should be called once for all chunk IDs
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockChunk(1, 'chunk 1'),
            createMockChunk(2, 'chunk 2'),
            createMockChunk(3, 'chunk 3'),
            createMockChunk(4, 'chunk 4'),
          ],
        } as QueryResult);

        // Mock document fetch - should be called once for all document IDs
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockDocument(TEST_DOC_ID, 'Doc 1'),
            createMockDocument(TEST_DOC_ID_2, 'Doc 2'),
            createMockDocument('doc-3', 'Doc 3'),
            createMockDocument('doc-4', 'Doc 4'),
          ],
        } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'BatchTest',
        });

        expect(result.definitions).toHaveLength(2);
        expect(result.usages).toHaveLength(2);

        // Verify all chunks are enriched
        expect(result.definitions[0].chunkText).toBe('chunk 1');
        expect(result.definitions[1].chunkText).toBe('chunk 2');
        expect(result.usages[0].chunkText).toBe('chunk 3');
        expect(result.usages[1].chunkText).toBe('chunk 4');

        // Verify all documents are enriched
        expect(result.definitions[0].documentTitle).toBe('Doc 1');
        expect(result.definitions[1].documentTitle).toBe('Doc 2');
        expect(result.usages[0].documentTitle).toBe('Doc 3');
        expect(result.usages[1].documentTitle).toBe('Doc 4');
      });

      it('should deduplicate chunk IDs when fetching', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'DedupTest', { kind: 'class' })],
        } as QueryResult);

        // Mock definitions query - same chunk ID used by multiple locations
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockLocationRow(
              TEST_DEFINITION_NODE_ID,
              TEST_SYMBOL_NODE_ID,
              'defines',
              'same.dart',
              TEST_DOC_ID,
              TEST_CHUNK_ID, // Same chunk
              {}
            ),
          ],
        } as QueryResult);

        // Mock usages query - also uses same chunk ID
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockLocationRow(
              TEST_USAGE_NODE_ID,
              TEST_SYMBOL_NODE_ID,
              'calls',
              'same.dart',
              TEST_DOC_ID,
              TEST_CHUNK_ID, // Same chunk as definition
              {}
            ),
          ],
        } as QueryResult);

        // Mock chunk fetch - should only contain one unique chunk ID
        mockQuery.mockResolvedValueOnce({
          rows: [createMockChunk(TEST_CHUNK_ID, 'shared chunk text')],
        } as QueryResult);

        // Mock document fetch
        mockQuery.mockResolvedValueOnce({
          rows: [createMockDocument(TEST_DOC_ID, 'Shared Doc')],
        } as QueryResult);

        const result = await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'DedupTest',
        });

        // Both locations should have the same enriched chunk text
        expect(result.definitions[0].chunkText).toBe('shared chunk text');
        expect(result.usages[0].chunkText).toBe('shared chunk text');
      });

      it('should not query chunks when no locations have chunk IDs', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'NoChunks', { kind: 'class' })],
        } as QueryResult);

        // Mock definitions query without chunk IDs
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockLocationRow(
              TEST_DEFINITION_NODE_ID,
              TEST_SYMBOL_NODE_ID,
              'defines',
              'def.dart',
              TEST_DOC_ID,
              null, // No chunk
              {}
            ),
          ],
        } as QueryResult);

        // Mock usages query (empty)
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        // Mock document fetch only (no chunk fetch)
        mockQuery.mockResolvedValueOnce({
          rows: [createMockDocument(TEST_DOC_ID, 'Doc')],
        } as QueryResult);

        await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'NoChunks',
        });

        // Should have 4 calls: symbol nodes, definitions, usages, documents
        // (no chunks query because no chunk IDs)
        expect(mockQuery).toHaveBeenCalledTimes(4);
      });

      it('should not query documents when no locations have document IDs', async () => {
        const { findSymbolUsages } = await import('../symbol-search.js');

        // Mock finding symbol node
        mockQuery.mockResolvedValueOnce({
          rows: [createMockSymbolNode(TEST_SYMBOL_NODE_ID, 'NoDocs', { kind: 'class' })],
        } as QueryResult);

        // Mock definitions query without document IDs
        mockQuery.mockResolvedValueOnce({
          rows: [
            createMockLocationRow(
              TEST_DEFINITION_NODE_ID,
              TEST_SYMBOL_NODE_ID,
              'defines',
              'def.dart',
              null, // No document
              TEST_CHUNK_ID,
              {}
            ),
          ],
        } as QueryResult);

        // Mock usages query (empty)
        mockQuery.mockResolvedValueOnce({ rows: [] } as QueryResult);

        // Mock chunk fetch only (no document fetch)
        mockQuery.mockResolvedValueOnce({
          rows: [createMockChunk(TEST_CHUNK_ID, 'chunk text')],
        } as QueryResult);

        await findSymbolUsages(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          symbolName: 'NoDocs',
        });

        // Should have 4 calls: symbol nodes, definitions, usages, chunks
        // (no documents query because no document IDs)
        expect(mockQuery).toHaveBeenCalledTimes(4);
      });
    });
  });
});
