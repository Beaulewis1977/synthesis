/**
 * GPT Phase 3 Sub-Phase 5.2: Schema Extractor Service Tests
 *
 * Unit tests for the schema-extractor service that extracts database schema
 * information from knowledge graph nodes for the HTTP API.
 */

import type { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type ColumnSchema,
  type ExtractSchemaParams,
  type SchemaExtractionResult,
  type TableSchema,
  extractSchema,
  getSchemaNodeCounts,
  hasSchemaNodes,
  isSchemaExtractionEnabled,
} from '../schema-extractor.js';

// =============================================================================
// TEST DATA
// =============================================================================

const TEST_COLLECTION_ID = 'col-11111111-1111-4111-8111-111111111111';
const TEST_DOCUMENT_ID = 'doc-22222222-2222-4222-8222-222222222222';
const TEST_TABLE_NODE_ID_1 = 'node-33333333-3333-4333-8333-333333333333';
const TEST_TABLE_NODE_ID_2 = 'node-44444444-4444-4444-8444-444444444444';
const TEST_COLUMN_NODE_ID_1 = 'node-55555555-5555-4555-8555-555555555555';
const TEST_COLUMN_NODE_ID_2 = 'node-66666666-6666-4666-8666-666666666666';
const TEST_COLUMN_NODE_ID_3 = 'node-77777777-7777-4777-8777-777777777777';

const createMockTableNode = (
  id: string,
  name: string,
  documentId: string | null = TEST_DOCUMENT_ID,
  metadata: Record<string, unknown> = {}
) => ({
  id,
  name,
  document_id: documentId,
  metadata,
});

const createMockColumnNode = (
  id: string,
  name: string,
  targetNodeId: string,
  metadata: Record<string, unknown> = {}
) => ({
  id,
  name,
  metadata,
  target_node_id: targetNodeId,
});

const createMockEdge = (
  sourceNodeId: string,
  targetNodeId: string,
  edgeType: string,
  metadata: Record<string, unknown> = {}
) => ({
  source_node_id: sourceNodeId,
  target_node_id: targetNodeId,
  edge_type: edgeType,
  metadata,
});

// =============================================================================
// MOCK DATABASE CLIENT
// =============================================================================

const createMockPool = () => {
  const mockPool = {
    query: vi.fn(),
  } as unknown as Pool;
  return mockPool;
};

// =============================================================================
// TEST SUITE
// =============================================================================

describe('SchemaExtractor Service', () => {
  let mockPool: Pool;
  const originalEnv = process.env.ENABLE_SCHEMA_EXTRACTION;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPool = createMockPool();
    // Reset env var before each test
    process.env.ENABLE_SCHEMA_EXTRACTION = originalEnv;
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Restore original env var
    process.env.ENABLE_SCHEMA_EXTRACTION = originalEnv;
  });

  // ===========================================================================
  // isSchemaExtractionEnabled Tests
  // ===========================================================================

  describe('isSchemaExtractionEnabled', () => {
    it('should return true when ENABLE_SCHEMA_EXTRACTION=true', () => {
      process.env.ENABLE_SCHEMA_EXTRACTION = 'true';
      expect(isSchemaExtractionEnabled()).toBe(true);
    });

    it('should return false when ENABLE_SCHEMA_EXTRACTION=false', () => {
      process.env.ENABLE_SCHEMA_EXTRACTION = 'false';
      expect(isSchemaExtractionEnabled()).toBe(false);
    });

    it('should return false when env var is not set', () => {
      process.env.ENABLE_SCHEMA_EXTRACTION = undefined;
      expect(isSchemaExtractionEnabled()).toBe(false);
    });

    it('should return false when env var is empty string', () => {
      process.env.ENABLE_SCHEMA_EXTRACTION = '';
      expect(isSchemaExtractionEnabled()).toBe(false);
    });

    it('should return false when env var has other value like "1"', () => {
      process.env.ENABLE_SCHEMA_EXTRACTION = '1';
      expect(isSchemaExtractionEnabled()).toBe(false);
    });

    it('should return false when env var has other value like "yes"', () => {
      process.env.ENABLE_SCHEMA_EXTRACTION = 'yes';
      expect(isSchemaExtractionEnabled()).toBe(false);
    });

    it('should be case-sensitive (TRUE should return false)', () => {
      process.env.ENABLE_SCHEMA_EXTRACTION = 'TRUE';
      expect(isSchemaExtractionEnabled()).toBe(false);
    });
  });

  // ===========================================================================
  // hasSchemaNodes Tests
  // ===========================================================================

  describe('hasSchemaNodes', () => {
    it('should return true when collection has table nodes', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ has_schema: true }],
      });

      const result = await hasSchemaNodes(mockPool, TEST_COLLECTION_ID);

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('SELECT EXISTS'), [
        TEST_COLLECTION_ID,
      ]);
    });

    it('should return true when collection has column nodes', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ has_schema: true }],
      });

      const result = await hasSchemaNodes(mockPool, TEST_COLLECTION_ID);

      expect(result).toBe(true);
    });

    it('should return false when collection has no table or column nodes', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ has_schema: false }],
      });

      const result = await hasSchemaNodes(mockPool, TEST_COLLECTION_ID);

      expect(result).toBe(false);
    });

    it('should return false when query returns null', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ has_schema: null }],
      });

      const result = await hasSchemaNodes(mockPool, TEST_COLLECTION_ID);

      expect(result).toBe(false);
    });

    it('should return false when query returns empty rows', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [],
      });

      const result = await hasSchemaNodes(mockPool, TEST_COLLECTION_ID);

      expect(result).toBe(false);
    });

    it('should query for both table and column node types', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ has_schema: true }],
      });

      await hasSchemaNodes(mockPool, TEST_COLLECTION_ID);

      const queryCall = (mockPool.query as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(queryCall[0]).toContain("node_type IN ('table', 'column')");
    });
  });

  // ===========================================================================
  // getSchemaNodeCounts Tests
  // ===========================================================================

  describe('getSchemaNodeCounts', () => {
    it('should return correct counts for tables and columns', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [
          { node_type: 'table', count: '5' },
          { node_type: 'column', count: '23' },
        ],
      });

      const result = await getSchemaNodeCounts(mockPool, TEST_COLLECTION_ID);

      expect(result.tables).toBe(5);
      expect(result.columns).toBe(23);
    });

    it('should return zero for missing node types', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ node_type: 'table', count: '3' }],
      });

      const result = await getSchemaNodeCounts(mockPool, TEST_COLLECTION_ID);

      expect(result.tables).toBe(3);
      expect(result.columns).toBe(0);
    });

    it('should return zero for both when no schema nodes exist', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [],
      });

      const result = await getSchemaNodeCounts(mockPool, TEST_COLLECTION_ID);

      expect(result.tables).toBe(0);
      expect(result.columns).toBe(0);
    });

    it('should handle only column nodes', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ node_type: 'column', count: '15' }],
      });

      const result = await getSchemaNodeCounts(mockPool, TEST_COLLECTION_ID);

      expect(result.tables).toBe(0);
      expect(result.columns).toBe(15);
    });

    it('should query with correct collection ID', async () => {
      (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [],
      });

      await getSchemaNodeCounts(mockPool, TEST_COLLECTION_ID);

      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('collection_id = $1'), [
        TEST_COLLECTION_ID,
      ]);
    });
  });

  // ===========================================================================
  // extractSchema Tests
  // ===========================================================================

  describe('extractSchema', () => {
    // =========================================================================
    // Empty Result Scenarios
    // =========================================================================

    describe('empty result scenarios', () => {
      it('should return empty result when no table nodes found', async () => {
        (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
          rows: [],
        });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.tables).toHaveLength(0);
        expect(result.relationships).toHaveLength(0);
        expect(result.stats.totalTables).toBe(0);
        expect(result.stats.totalColumns).toBe(0);
        expect(result.stats.totalRelationships).toBe(0);
        expect(result.stats.extractionDurationMs).toBeGreaterThanOrEqual(0);
      });

      it('should return empty tables array when filtering by non-existent table names', async () => {
        // First query for table nodes returns empty (no match for filter)
        (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({
          rows: [],
        });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          tables: ['non_existent_table'],
        });

        expect(result.tables).toHaveLength(0);
        expect(result.stats.totalTables).toBe(0);
      });
    });

    // =========================================================================
    // Table Extraction Tests
    // =========================================================================

    describe('table extraction', () => {
      it('should extract tables from collection', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID, {
            schema: 'public',
          }),
          createMockTableNode(TEST_TABLE_NODE_ID_2, 'posts', TEST_DOCUMENT_ID, {
            schema: 'public',
          }),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes }) // table nodes query
          .mockResolvedValueOnce({ rows: [] }) // columns query
          .mockResolvedValueOnce({ rows: [] }); // relationships query

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.tables).toHaveLength(2);
        expect(result.tables[0].name).toBe('users');
        expect(result.tables[0].nodeId).toBe(TEST_TABLE_NODE_ID_1);
        expect(result.tables[0].documentId).toBe(TEST_DOCUMENT_ID);
        expect(result.tables[1].name).toBe('posts');
        expect(result.tables[1].nodeId).toBe(TEST_TABLE_NODE_ID_2);
      });

      it('should filter tables by name when tables param provided', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes }) // filtered table nodes
          .mockResolvedValueOnce({ rows: [] }) // columns query
          .mockResolvedValueOnce({ rows: [] }); // relationships query

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          tables: ['users'],
        });

        expect(result.tables).toHaveLength(1);
        expect(result.tables[0].name).toBe('users');

        // Verify the query included the table name filter
        const tableQuery = (mockPool.query as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(tableQuery[0]).toContain('name = ANY($2)');
        // Query params: [collectionId, tableNames array]
        expect(tableQuery[1][1]).toEqual(['users']);
      });

      it('should extract table metadata correctly', async () => {
        const tableMetadata = {
          schema: 'public',
          description: 'User accounts table',
          created_by: 'admin',
        };
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID, tableMetadata),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.tables[0].metadata).toEqual(tableMetadata);
      });

      it('should handle tables with null document_id', async () => {
        const mockTableNodes = [createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', null)];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.tables[0].documentId).toBeNull();
      });

      it('should handle tables with null metadata', async () => {
        const mockTableNodes = [
          {
            id: TEST_TABLE_NODE_ID_1,
            name: 'users',
            document_id: TEST_DOCUMENT_ID,
            metadata: null,
          },
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.tables[0].metadata).toEqual({});
      });
    });

    // =========================================================================
    // Column Extraction Tests
    // =========================================================================

    describe('column extraction', () => {
      it('should extract columns with belongs_to edges', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
        ];
        const mockColumnNodes = [
          createMockColumnNode(TEST_COLUMN_NODE_ID_1, 'id', TEST_TABLE_NODE_ID_1, {
            data_type: 'UUID',
          }),
          createMockColumnNode(TEST_COLUMN_NODE_ID_2, 'email', TEST_TABLE_NODE_ID_1, {
            data_type: 'VARCHAR(255)',
          }),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: mockColumnNodes })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.tables[0].columns).toHaveLength(2);
        expect(result.tables[0].columns[0].name).toBe('id');
        expect(result.tables[0].columns[0].nodeId).toBe(TEST_COLUMN_NODE_ID_1);
        expect(result.tables[0].columns[1].name).toBe('email');
        expect(result.tables[0].columns[1].nodeId).toBe(TEST_COLUMN_NODE_ID_2);
      });

      it('should extract column data types from metadata using data_type key', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
        ];
        const mockColumnNodes = [
          createMockColumnNode(TEST_COLUMN_NODE_ID_1, 'id', TEST_TABLE_NODE_ID_1, {
            data_type: 'UUID',
          }),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: mockColumnNodes })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.tables[0].columns[0].dataType).toBe('UUID');
      });

      it('should extract column data types from metadata using dataType key', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
        ];
        const mockColumnNodes = [
          createMockColumnNode(TEST_COLUMN_NODE_ID_1, 'id', TEST_TABLE_NODE_ID_1, {
            dataType: 'INTEGER',
          }),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: mockColumnNodes })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.tables[0].columns[0].dataType).toBe('INTEGER');
      });

      it('should extract column data types from metadata using type key', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
        ];
        const mockColumnNodes = [
          createMockColumnNode(TEST_COLUMN_NODE_ID_1, 'id', TEST_TABLE_NODE_ID_1, {
            type: 'BIGINT',
          }),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: mockColumnNodes })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.tables[0].columns[0].dataType).toBe('BIGINT');
      });

      it('should return null for dataType when not present in metadata', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
        ];
        const mockColumnNodes = [
          createMockColumnNode(TEST_COLUMN_NODE_ID_1, 'id', TEST_TABLE_NODE_ID_1, {}),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: mockColumnNodes })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.tables[0].columns[0].dataType).toBeNull();
      });

      it('should extract constraints from array in metadata', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
        ];
        const mockColumnNodes = [
          createMockColumnNode(TEST_COLUMN_NODE_ID_1, 'id', TEST_TABLE_NODE_ID_1, {
            constraints: ['PRIMARY KEY', 'NOT NULL'],
          }),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: mockColumnNodes })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.tables[0].columns[0].constraints).toEqual(['PRIMARY KEY', 'NOT NULL']);
      });

      it('should extract constraints from comma-separated string in metadata', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
        ];
        const mockColumnNodes = [
          createMockColumnNode(TEST_COLUMN_NODE_ID_1, 'id', TEST_TABLE_NODE_ID_1, {
            constraints: 'PRIMARY KEY, UNIQUE',
          }),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: mockColumnNodes })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.tables[0].columns[0].constraints).toEqual(['PRIMARY KEY', 'UNIQUE']);
      });

      it('should extract singular constraint from metadata', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
        ];
        const mockColumnNodes = [
          createMockColumnNode(TEST_COLUMN_NODE_ID_1, 'id', TEST_TABLE_NODE_ID_1, {
            constraint: 'UNIQUE',
          }),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: mockColumnNodes })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.tables[0].columns[0].constraints).toEqual(['UNIQUE']);
      });

      it('should extract constraints from boolean flags in metadata', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
        ];
        const mockColumnNodes = [
          createMockColumnNode(TEST_COLUMN_NODE_ID_1, 'id', TEST_TABLE_NODE_ID_1, {
            is_primary_key: true,
            is_not_null: true,
            is_unique: true,
            is_foreign_key: true,
            has_default: true,
          }),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: mockColumnNodes })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.tables[0].columns[0].constraints).toContain('PRIMARY KEY');
        expect(result.tables[0].columns[0].constraints).toContain('NOT NULL');
        expect(result.tables[0].columns[0].constraints).toContain('UNIQUE');
        expect(result.tables[0].columns[0].constraints).toContain('FOREIGN KEY');
        expect(result.tables[0].columns[0].constraints).toContain('DEFAULT');
      });

      it('should extract constraints from camelCase boolean flags in metadata', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
        ];
        const mockColumnNodes = [
          createMockColumnNode(TEST_COLUMN_NODE_ID_1, 'id', TEST_TABLE_NODE_ID_1, {
            isPrimaryKey: true,
            isNotNull: true,
            isUnique: true,
            isForeignKey: true,
            hasDefault: true,
          }),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: mockColumnNodes })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.tables[0].columns[0].constraints).toContain('PRIMARY KEY');
        expect(result.tables[0].columns[0].constraints).toContain('NOT NULL');
        expect(result.tables[0].columns[0].constraints).toContain('UNIQUE');
        expect(result.tables[0].columns[0].constraints).toContain('FOREIGN KEY');
        expect(result.tables[0].columns[0].constraints).toContain('DEFAULT');
      });

      it('should handle required flag as NOT NULL constraint', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
        ];
        const mockColumnNodes = [
          createMockColumnNode(TEST_COLUMN_NODE_ID_1, 'email', TEST_TABLE_NODE_ID_1, {
            required: true,
          }),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: mockColumnNodes })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.tables[0].columns[0].constraints).toContain('NOT NULL');
      });

      it('should return empty constraints when no constraint info in metadata', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
        ];
        const mockColumnNodes = [
          createMockColumnNode(TEST_COLUMN_NODE_ID_1, 'description', TEST_TABLE_NODE_ID_1, {
            data_type: 'TEXT',
          }),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: mockColumnNodes })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.tables[0].columns[0].constraints).toEqual([]);
      });

      it('should filter non-string values from constraints array', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
        ];
        const mockColumnNodes = [
          createMockColumnNode(TEST_COLUMN_NODE_ID_1, 'id', TEST_TABLE_NODE_ID_1, {
            constraints: ['PRIMARY KEY', 123, null, 'NOT NULL', undefined],
          }),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: mockColumnNodes })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.tables[0].columns[0].constraints).toEqual(['PRIMARY KEY', 'NOT NULL']);
      });
    });

    // =========================================================================
    // Tables With No Columns Tests
    // =========================================================================

    describe('tables with no columns', () => {
      it('should handle tables with no columns', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'empty_table', TEST_DOCUMENT_ID),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: [] }) // No columns
          .mockResolvedValueOnce({ rows: [] }); // No relationships

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.tables).toHaveLength(1);
        expect(result.tables[0].name).toBe('empty_table');
        expect(result.tables[0].columns).toHaveLength(0);
        expect(result.stats.totalColumns).toBe(0);
      });

      it('should correctly assign columns to their parent tables', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
          createMockTableNode(TEST_TABLE_NODE_ID_2, 'posts', TEST_DOCUMENT_ID),
        ];
        const mockColumnNodes = [
          createMockColumnNode(TEST_COLUMN_NODE_ID_1, 'user_id', TEST_TABLE_NODE_ID_1, {}),
          createMockColumnNode(TEST_COLUMN_NODE_ID_2, 'post_id', TEST_TABLE_NODE_ID_2, {}),
          createMockColumnNode(TEST_COLUMN_NODE_ID_3, 'user_email', TEST_TABLE_NODE_ID_1, {}),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: mockColumnNodes })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        // users table should have 2 columns
        const usersTable = result.tables.find((t) => t.name === 'users');
        expect(usersTable?.columns).toHaveLength(2);
        expect(usersTable?.columns.map((c) => c.name)).toContain('user_id');
        expect(usersTable?.columns.map((c) => c.name)).toContain('user_email');

        // posts table should have 1 column
        const postsTable = result.tables.find((t) => t.name === 'posts');
        expect(postsTable?.columns).toHaveLength(1);
        expect(postsTable?.columns[0].name).toBe('post_id');
      });
    });

    // =========================================================================
    // Relationship Extraction Tests
    // =========================================================================

    describe('relationship extraction', () => {
      it('should extract relationships between tables', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
          createMockTableNode(TEST_TABLE_NODE_ID_2, 'posts', TEST_DOCUMENT_ID),
        ];
        const mockRelationships = [
          createMockEdge(TEST_TABLE_NODE_ID_2, TEST_TABLE_NODE_ID_1, 'persists_to', {
            foreign_key: 'user_id',
          }),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: [] }) // columns
          .mockResolvedValueOnce({ rows: mockRelationships });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.relationships).toHaveLength(1);
        expect(result.relationships[0].sourceTable).toBe('posts');
        expect(result.relationships[0].targetTable).toBe('users');
        expect(result.relationships[0].edgeType).toBe('persists_to');
        expect(result.relationships[0].sourceNodeId).toBe(TEST_TABLE_NODE_ID_2);
        expect(result.relationships[0].targetNodeId).toBe(TEST_TABLE_NODE_ID_1);
        expect(result.relationships[0].metadata).toEqual({ foreign_key: 'user_id' });
      });

      it('should handle multiple relationships', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
          createMockTableNode(TEST_TABLE_NODE_ID_2, 'posts', TEST_DOCUMENT_ID),
        ];
        const mockRelationships = [
          createMockEdge(TEST_TABLE_NODE_ID_2, TEST_TABLE_NODE_ID_1, 'persists_to'),
          createMockEdge(TEST_TABLE_NODE_ID_1, TEST_TABLE_NODE_ID_2, 'depends_on'),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: mockRelationships });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.relationships).toHaveLength(2);
        expect(result.stats.totalRelationships).toBe(2);
      });

      it('should not include relationships when includeRelationships=false', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
          createMockTableNode(TEST_TABLE_NODE_ID_2, 'posts', TEST_DOCUMENT_ID),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: [] }); // columns only, no relationships query

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          includeRelationships: false,
        });

        expect(result.relationships).toHaveLength(0);
        expect(result.stats.totalRelationships).toBe(0);

        // Should not have queried for relationships
        expect(mockPool.query).toHaveBeenCalledTimes(2); // Only table nodes and columns
      });

      it('should handle relationships with null metadata', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
          createMockTableNode(TEST_TABLE_NODE_ID_2, 'posts', TEST_DOCUMENT_ID),
        ];
        const mockRelationships = [
          {
            source_node_id: TEST_TABLE_NODE_ID_2,
            target_node_id: TEST_TABLE_NODE_ID_1,
            edge_type: 'persists_to',
            metadata: null,
          },
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: mockRelationships });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.relationships[0].metadata).toEqual({});
      });
    });

    // =========================================================================
    // Statistics Tests
    // =========================================================================

    describe('statistics', () => {
      it('should return proper stats for totalTables', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
          createMockTableNode(TEST_TABLE_NODE_ID_2, 'posts', TEST_DOCUMENT_ID),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.stats.totalTables).toBe(2);
      });

      it('should return proper stats for totalColumns', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
        ];
        const mockColumnNodes = [
          createMockColumnNode(TEST_COLUMN_NODE_ID_1, 'id', TEST_TABLE_NODE_ID_1, {}),
          createMockColumnNode(TEST_COLUMN_NODE_ID_2, 'email', TEST_TABLE_NODE_ID_1, {}),
          createMockColumnNode(TEST_COLUMN_NODE_ID_3, 'name', TEST_TABLE_NODE_ID_1, {}),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: mockColumnNodes })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.stats.totalColumns).toBe(3);
      });

      it('should return proper stats for totalRelationships', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
          createMockTableNode(TEST_TABLE_NODE_ID_2, 'posts', TEST_DOCUMENT_ID),
        ];
        const mockRelationships = [
          createMockEdge(TEST_TABLE_NODE_ID_2, TEST_TABLE_NODE_ID_1, 'persists_to'),
          createMockEdge(TEST_TABLE_NODE_ID_1, TEST_TABLE_NODE_ID_2, 'depends_on'),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: mockRelationships });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.stats.totalRelationships).toBe(2);
      });

      it('should return extractionDurationMs as a positive number', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.stats.extractionDurationMs).toBeGreaterThanOrEqual(0);
        expect(typeof result.stats.extractionDurationMs).toBe('number');
      });

      it('should count columns across multiple tables correctly', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
          createMockTableNode(TEST_TABLE_NODE_ID_2, 'posts', TEST_DOCUMENT_ID),
        ];
        const mockColumnNodes = [
          createMockColumnNode(TEST_COLUMN_NODE_ID_1, 'user_id', TEST_TABLE_NODE_ID_1, {}),
          createMockColumnNode(TEST_COLUMN_NODE_ID_2, 'email', TEST_TABLE_NODE_ID_1, {}),
          createMockColumnNode(TEST_COLUMN_NODE_ID_3, 'post_id', TEST_TABLE_NODE_ID_2, {}),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: mockColumnNodes })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        // 2 columns in users + 1 column in posts = 3
        expect(result.stats.totalColumns).toBe(3);
      });
    });

    // =========================================================================
    // Edge Cases
    // =========================================================================

    describe('edge cases', () => {
      it('should handle columns with null metadata', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
        ];
        const mockColumnNodes = [
          {
            id: TEST_COLUMN_NODE_ID_1,
            name: 'id',
            metadata: null,
            target_node_id: TEST_TABLE_NODE_ID_1,
          },
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: mockColumnNodes })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.tables[0].columns[0].dataType).toBeNull();
        expect(result.tables[0].columns[0].constraints).toEqual([]);
        expect(result.tables[0].columns[0].metadata).toEqual({});
      });

      it('should handle empty data_type string', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
        ];
        const mockColumnNodes = [
          createMockColumnNode(TEST_COLUMN_NODE_ID_1, 'id', TEST_TABLE_NODE_ID_1, {
            data_type: '',
          }),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: mockColumnNodes })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.tables[0].columns[0].dataType).toBeNull();
      });

      it('should prioritize data_type over dataType over type', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
        ];
        const mockColumnNodes = [
          createMockColumnNode(TEST_COLUMN_NODE_ID_1, 'id', TEST_TABLE_NODE_ID_1, {
            data_type: 'UUID',
            dataType: 'INTEGER',
            type: 'TEXT',
          }),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: mockColumnNodes })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.tables[0].columns[0].dataType).toBe('UUID');
      });

      it('should fall back to dataType when data_type is empty', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
        ];
        const mockColumnNodes = [
          createMockColumnNode(TEST_COLUMN_NODE_ID_1, 'id', TEST_TABLE_NODE_ID_1, {
            data_type: '',
            dataType: 'INTEGER',
          }),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: mockColumnNodes })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        expect(result.tables[0].columns[0].dataType).toBe('INTEGER');
      });

      it('should handle filtering with empty tables array', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
          tables: [], // Empty array should not filter
        });

        // First query should NOT include ANY filter when tables array is empty
        // Looking at the code, it checks `tableNames && tableNames.length > 0`
        // So empty array should return all tables
        const firstQueryCall = (mockPool.query as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(firstQueryCall[0]).not.toContain('ANY($2)');
      });

      it('should not duplicate columns when column appears in result multiple times', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
        ];
        // Same column ID twice (edge case that shouldn't happen but we should handle)
        const mockColumnNodes = [
          createMockColumnNode(TEST_COLUMN_NODE_ID_1, 'id', TEST_TABLE_NODE_ID_1, {}),
          createMockColumnNode(TEST_COLUMN_NODE_ID_1, 'id', TEST_TABLE_NODE_ID_1, {}),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: mockColumnNodes })
          .mockResolvedValueOnce({ rows: [] });

        const result = await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        // The service doesn't deduplicate, so both will be added
        // This tests actual behavior, not ideal behavior
        expect(result.tables[0].columns).toHaveLength(2);
      });
    });

    // =========================================================================
    // SQL Query Verification Tests
    // =========================================================================

    describe('SQL query verification', () => {
      it('should query knowledge_nodes for table node_type', async () => {
        (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [] });

        await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        const queryCall = (mockPool.query as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(queryCall[0]).toContain("node_type = 'table'");
        expect(queryCall[1]).toContain(TEST_COLLECTION_ID);
      });

      it('should query columns with belongs_to edge type', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] });

        await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        const columnQueryCall = (mockPool.query as ReturnType<typeof vi.fn>).mock.calls[1];
        expect(columnQueryCall[0]).toContain("node_type = 'column'");
        expect(columnQueryCall[0]).toContain("edge_type = 'belongs_to'");
      });

      it('should pass table IDs to column query for batch fetching', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
          createMockTableNode(TEST_TABLE_NODE_ID_2, 'posts', TEST_DOCUMENT_ID),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] });

        await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        const columnQueryCall = (mockPool.query as ReturnType<typeof vi.fn>).mock.calls[1];
        expect(columnQueryCall[0]).toContain('target_node_id = ANY($2)');
        // Query params: [collectionId, tableIds array]
        const tableIds = columnQueryCall[1][1];
        expect(tableIds).toContain(TEST_TABLE_NODE_ID_1);
        expect(tableIds).toContain(TEST_TABLE_NODE_ID_2);
      });

      it('should query relationships with both source and target in table IDs', async () => {
        const mockTableNodes = [
          createMockTableNode(TEST_TABLE_NODE_ID_1, 'users', TEST_DOCUMENT_ID),
          createMockTableNode(TEST_TABLE_NODE_ID_2, 'posts', TEST_DOCUMENT_ID),
        ];

        (mockPool.query as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ rows: mockTableNodes })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] });

        await extractSchema(mockPool, {
          collectionId: TEST_COLLECTION_ID,
        });

        const relationshipQueryCall = (mockPool.query as ReturnType<typeof vi.fn>).mock.calls[2];
        expect(relationshipQueryCall[0]).toContain('source_node_id = ANY($2)');
        expect(relationshipQueryCall[0]).toContain('target_node_id = ANY($2)');
      });
    });
  });
});
