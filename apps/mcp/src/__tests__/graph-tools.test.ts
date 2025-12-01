/**
 * MCP Graph Tools Schema Tests
 *
 * Tests for the graph_expand_context MCP tool introduced in GPT Phase 2.
 * This tool enables agents to retrieve end-to-end contexts via graph traversal.
 *
 * Tests cover:
 * - Schema validation for graph_expand_context tool
 * - Valid inputs with all fields
 * - Minimal inputs (query only)
 * - Seed requirement validation (at least one seed required)
 * - maxDepth bounds (1-10)
 * - maxNodes bounds (1-200)
 * - Edge/node type enum validation
 *
 * @module apps/mcp/src/__tests__/graph-tools.test
 * @since GPT Phase 2: Graph Retrieval & Context Expansion
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// =============================================================================
// Schema Definitions (mirrored from planned index.ts implementation)
// =============================================================================

/**
 * Node types in the knowledge graph
 */
const knowledgeNodeTypeEnum = z.enum([
  'document',
  'chunk',
  'symbol',
  'endpoint',
  'table',
  'column',
  'config_section',
]);

/**
 * Edge types in the knowledge graph
 */
const knowledgeEdgeTypeEnum = z.enum([
  'calls',
  'defines',
  'belongs_to',
  'persists_to',
  'configured_by',
  'documents',
  'imports',
  'depends_on',
]);

/**
 * Schema for graph_expand_context MCP tool input.
 *
 * Requirements:
 * - collectionId is always required (UUID)
 * - At least one seed must be provided (query, seedChunkIds, or seedNodeIds)
 * - maxDepth must be 1-10 (default 3)
 * - maxNodes must be 1-200 (default 50)
 * - edgeTypes and nodeTypes are optional filters
 */
const graphExpandContextInput = z
  .object({
    collectionId: z.string().uuid().describe('The ID of the collection to search'),
    query: z.string().min(1).optional().describe('Search query to find seed nodes'),
    seedChunkIds: z
      .array(z.number().int().positive())
      .optional()
      .describe('Chunk IDs to use as starting points for graph traversal'),
    seedNodeIds: z
      .array(z.string().uuid())
      .optional()
      .describe('Node IDs to use as starting points for graph traversal'),
    maxDepth: z
      .number()
      .int()
      .min(1)
      .max(10)
      .default(3)
      .describe('Maximum traversal depth (default: 3, max: 10)'),
    maxNodes: z
      .number()
      .int()
      .min(1)
      .max(200)
      .default(50)
      .describe('Maximum nodes to return (default: 50, max: 200)'),
    edgeTypes: z
      .array(knowledgeEdgeTypeEnum)
      .optional()
      .describe('Edge types to traverse (if not specified, traverses all types)'),
    nodeTypes: z
      .array(knowledgeNodeTypeEnum)
      .optional()
      .describe('Node types to include in results (if not specified, includes all types)'),
  })
  .strict()
  .refine(
    (data) => {
      // At least one seed must be provided (non-empty)
      const hasQuery = data.query !== undefined && data.query.length > 0;
      const hasChunkSeeds = data.seedChunkIds !== undefined && data.seedChunkIds.length > 0;
      const hasNodeSeeds = data.seedNodeIds !== undefined && data.seedNodeIds.length > 0;
      return hasQuery || hasChunkSeeds || hasNodeSeeds;
    },
    {
      message: 'At least one seed must be provided: query, seedChunkIds, or seedNodeIds',
    }
  );

// =============================================================================
// Test Constants
// =============================================================================

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const VALID_NODE_UUID = '987fcdeb-51a2-43e8-8d5a-426614174001';

// =============================================================================
// Tests
// =============================================================================

describe('MCP Graph Tools Schemas', () => {
  // ===========================================================================
  // graph_expand_context Schema Tests
  // ===========================================================================
  describe('graph_expand_context schema', () => {
    // =========================================================================
    // Valid Input Tests
    // =========================================================================
    describe('valid inputs', () => {
      it('should accept valid input with all fields', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'user authentication flow',
          seedChunkIds: [1, 2, 3],
          seedNodeIds: [VALID_NODE_UUID],
          maxDepth: 5,
          maxNodes: 100,
          edgeTypes: ['calls', 'persists_to'] as const,
          nodeTypes: ['symbol', 'table'] as const,
        };

        const result = graphExpandContextInput.parse(input);

        expect(result.collectionId).toBe(VALID_UUID);
        expect(result.query).toBe('user authentication flow');
        expect(result.seedChunkIds).toEqual([1, 2, 3]);
        expect(result.seedNodeIds).toEqual([VALID_NODE_UUID]);
        expect(result.maxDepth).toBe(5);
        expect(result.maxNodes).toBe(100);
        expect(result.edgeTypes).toEqual(['calls', 'persists_to']);
        expect(result.nodeTypes).toEqual(['symbol', 'table']);
      });

      it('should accept minimal input with only query', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'authentication',
        };

        const result = graphExpandContextInput.parse(input);

        expect(result.collectionId).toBe(VALID_UUID);
        expect(result.query).toBe('authentication');
        expect(result.maxDepth).toBe(3); // default
        expect(result.maxNodes).toBe(50); // default
        expect(result.seedChunkIds).toBeUndefined();
        expect(result.seedNodeIds).toBeUndefined();
        expect(result.edgeTypes).toBeUndefined();
        expect(result.nodeTypes).toBeUndefined();
      });

      it('should accept minimal input with only seedChunkIds', () => {
        const input = {
          collectionId: VALID_UUID,
          seedChunkIds: [1, 2],
        };

        const result = graphExpandContextInput.parse(input);

        expect(result.collectionId).toBe(VALID_UUID);
        expect(result.seedChunkIds).toEqual([1, 2]);
        expect(result.query).toBeUndefined();
      });

      it('should accept minimal input with only seedNodeIds', () => {
        const input = {
          collectionId: VALID_UUID,
          seedNodeIds: [VALID_NODE_UUID],
        };

        const result = graphExpandContextInput.parse(input);

        expect(result.collectionId).toBe(VALID_UUID);
        expect(result.seedNodeIds).toEqual([VALID_NODE_UUID]);
        expect(result.query).toBeUndefined();
        expect(result.seedChunkIds).toBeUndefined();
      });

      it('should accept combination of query and seedChunkIds', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'auth',
          seedChunkIds: [1],
        };

        const result = graphExpandContextInput.parse(input);

        expect(result.query).toBe('auth');
        expect(result.seedChunkIds).toEqual([1]);
      });

      it('should accept all seed types together', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'auth',
          seedChunkIds: [1, 2],
          seedNodeIds: [VALID_NODE_UUID],
        };

        const result = graphExpandContextInput.parse(input);

        expect(result.query).toBe('auth');
        expect(result.seedChunkIds).toEqual([1, 2]);
        expect(result.seedNodeIds).toEqual([VALID_NODE_UUID]);
      });
    });

    // =========================================================================
    // Seed Requirement Validation Tests
    // =========================================================================
    describe('seed requirement validation', () => {
      it('should reject input with no seed (no query, seedChunkIds, or seedNodeIds)', () => {
        const input = {
          collectionId: VALID_UUID,
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow(
          /At least one seed must be provided/
        );
      });

      it('should reject input with only maxDepth and maxNodes (no seed)', () => {
        const input = {
          collectionId: VALID_UUID,
          maxDepth: 5,
          maxNodes: 100,
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow(
          /At least one seed must be provided/
        );
      });

      it('should reject input with only edgeTypes and nodeTypes (no seed)', () => {
        const input = {
          collectionId: VALID_UUID,
          edgeTypes: ['calls'],
          nodeTypes: ['symbol'],
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow(
          /At least one seed must be provided/
        );
      });

      it('should accept empty seedChunkIds array with query as fallback seed', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          seedChunkIds: [],
        };

        // Should pass because query is provided
        const result = graphExpandContextInput.parse(input);
        expect(result.query).toBe('test');
      });

      it('should reject empty seedChunkIds array with no other seed', () => {
        const input = {
          collectionId: VALID_UUID,
          seedChunkIds: [],
        };

        // Empty arrays don't count as valid seeds - need at least one actual seed
        expect(() => graphExpandContextInput.parse(input)).toThrow(
          /At least one seed must be provided/
        );
      });
    });

    // =========================================================================
    // maxDepth Bounds Tests
    // =========================================================================
    describe('maxDepth bounds (1-10)', () => {
      it('should accept maxDepth at minimum (1)', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          maxDepth: 1,
        };

        const result = graphExpandContextInput.parse(input);
        expect(result.maxDepth).toBe(1);
      });

      it('should accept maxDepth at maximum (10)', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          maxDepth: 10,
        };

        const result = graphExpandContextInput.parse(input);
        expect(result.maxDepth).toBe(10);
      });

      it('should use default maxDepth (3) when not specified', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
        };

        const result = graphExpandContextInput.parse(input);
        expect(result.maxDepth).toBe(3);
      });

      it('should reject maxDepth below minimum (0)', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          maxDepth: 0,
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow();
      });

      it('should reject maxDepth above maximum (11)', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          maxDepth: 11,
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow();
      });

      it('should reject negative maxDepth', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          maxDepth: -1,
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow();
      });

      it('should reject non-integer maxDepth', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          maxDepth: 2.5,
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow();
      });
    });

    // =========================================================================
    // maxNodes Bounds Tests
    // =========================================================================
    describe('maxNodes bounds (1-200)', () => {
      it('should accept maxNodes at minimum (1)', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          maxNodes: 1,
        };

        const result = graphExpandContextInput.parse(input);
        expect(result.maxNodes).toBe(1);
      });

      it('should accept maxNodes at maximum (200)', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          maxNodes: 200,
        };

        const result = graphExpandContextInput.parse(input);
        expect(result.maxNodes).toBe(200);
      });

      it('should use default maxNodes (50) when not specified', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
        };

        const result = graphExpandContextInput.parse(input);
        expect(result.maxNodes).toBe(50);
      });

      it('should reject maxNodes below minimum (0)', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          maxNodes: 0,
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow();
      });

      it('should reject maxNodes above maximum (201)', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          maxNodes: 201,
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow();
      });

      it('should reject negative maxNodes', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          maxNodes: -10,
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow();
      });

      it('should reject non-integer maxNodes', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          maxNodes: 50.5,
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow();
      });
    });

    // =========================================================================
    // Edge Type Enum Validation Tests
    // =========================================================================
    describe('edge type enum validation', () => {
      it('should accept all valid edge types', () => {
        const validEdgeTypes = [
          'calls',
          'defines',
          'belongs_to',
          'persists_to',
          'configured_by',
          'documents',
          'imports',
          'depends_on',
        ] as const;

        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          edgeTypes: validEdgeTypes,
        };

        const result = graphExpandContextInput.parse(input);
        expect(result.edgeTypes).toEqual(validEdgeTypes);
      });

      it('should accept single edge type', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          edgeTypes: ['calls'] as const,
        };

        const result = graphExpandContextInput.parse(input);
        expect(result.edgeTypes).toEqual(['calls']);
      });

      it('should accept empty edge types array', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          edgeTypes: [],
        };

        const result = graphExpandContextInput.parse(input);
        expect(result.edgeTypes).toEqual([]);
      });

      it('should reject invalid edge type', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          edgeTypes: ['invalid_edge_type'],
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow();
      });

      it('should reject mixed valid and invalid edge types', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          edgeTypes: ['calls', 'invalid_type'],
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow();
      });
    });

    // =========================================================================
    // Node Type Enum Validation Tests
    // =========================================================================
    describe('node type enum validation', () => {
      it('should accept all valid node types', () => {
        const validNodeTypes = [
          'document',
          'chunk',
          'symbol',
          'endpoint',
          'table',
          'column',
          'config_section',
        ] as const;

        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          nodeTypes: validNodeTypes,
        };

        const result = graphExpandContextInput.parse(input);
        expect(result.nodeTypes).toEqual(validNodeTypes);
      });

      it('should accept single node type', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          nodeTypes: ['symbol'] as const,
        };

        const result = graphExpandContextInput.parse(input);
        expect(result.nodeTypes).toEqual(['symbol']);
      });

      it('should accept empty node types array', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          nodeTypes: [],
        };

        const result = graphExpandContextInput.parse(input);
        expect(result.nodeTypes).toEqual([]);
      });

      it('should reject invalid node type', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          nodeTypes: ['invalid_node_type'],
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow();
      });

      it('should reject mixed valid and invalid node types', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          nodeTypes: ['symbol', 'invalid_type'],
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow();
      });
    });

    // =========================================================================
    // Collection ID Validation Tests
    // =========================================================================
    describe('collectionId validation', () => {
      it('should accept valid UUID v4', () => {
        const input = {
          collectionId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          query: 'test',
        };

        expect(() => graphExpandContextInput.parse(input)).not.toThrow();
      });

      it('should reject invalid UUID format', () => {
        const input = {
          collectionId: 'not-a-uuid',
          query: 'test',
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow();
      });

      it('should reject missing collectionId', () => {
        const input = {
          query: 'test',
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow();
      });

      it('should reject UUID with wrong length', () => {
        const input = {
          collectionId: '123e4567-e89b-12d3-a456-42661417400', // too short
          query: 'test',
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow();
      });
    });

    // =========================================================================
    // Strict Mode Tests
    // =========================================================================
    describe('strict mode validation', () => {
      it('should reject extra fields (strict mode)', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          extraField: 'not allowed',
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow();
      });

      it('should reject misspelled field names', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'test',
          maxdepth: 5, // should be maxDepth
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow();
      });
    });

    // =========================================================================
    // seedChunkIds Validation Tests
    // =========================================================================
    describe('seedChunkIds validation', () => {
      it('should accept positive integer chunk IDs', () => {
        const input = {
          collectionId: VALID_UUID,
          seedChunkIds: [1, 2, 100, 9999],
        };

        const result = graphExpandContextInput.parse(input);
        expect(result.seedChunkIds).toEqual([1, 2, 100, 9999]);
      });

      it('should reject negative chunk IDs', () => {
        const input = {
          collectionId: VALID_UUID,
          seedChunkIds: [-1, 2, 3],
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow();
      });

      it('should reject zero chunk ID', () => {
        const input = {
          collectionId: VALID_UUID,
          seedChunkIds: [0, 1, 2],
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow();
      });

      it('should reject non-integer chunk IDs', () => {
        const input = {
          collectionId: VALID_UUID,
          seedChunkIds: [1.5, 2, 3],
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow();
      });

      it('should reject non-number chunk IDs', () => {
        const input = {
          collectionId: VALID_UUID,
          seedChunkIds: ['1', 2, 3],
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow();
      });
    });

    // =========================================================================
    // seedNodeIds Validation Tests
    // =========================================================================
    describe('seedNodeIds validation', () => {
      it('should accept valid UUID node IDs', () => {
        const input = {
          collectionId: VALID_UUID,
          seedNodeIds: [VALID_NODE_UUID, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'],
        };

        const result = graphExpandContextInput.parse(input);
        expect(result.seedNodeIds).toHaveLength(2);
      });

      it('should reject invalid UUID node IDs', () => {
        const input = {
          collectionId: VALID_UUID,
          seedNodeIds: ['not-a-uuid'],
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow();
      });

      it('should reject mixed valid and invalid UUIDs', () => {
        const input = {
          collectionId: VALID_UUID,
          seedNodeIds: [VALID_NODE_UUID, 'invalid'],
        };

        expect(() => graphExpandContextInput.parse(input)).toThrow();
      });
    });

    // =========================================================================
    // Query Validation Tests
    // =========================================================================
    describe('query validation', () => {
      it('should accept non-empty query string', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'user authentication',
        };

        const result = graphExpandContextInput.parse(input);
        expect(result.query).toBe('user authentication');
      });

      it('should accept single character query', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'a',
        };

        const result = graphExpandContextInput.parse(input);
        expect(result.query).toBe('a');
      });

      it('should reject empty query string', () => {
        const input = {
          collectionId: VALID_UUID,
          query: '',
        };

        // Empty string fails min(1) validation
        expect(() => graphExpandContextInput.parse(input)).toThrow();
      });

      it('should accept query with special characters', () => {
        const input = {
          collectionId: VALID_UUID,
          query: 'auth + OAuth2.0 & JWT',
        };

        const result = graphExpandContextInput.parse(input);
        expect(result.query).toBe('auth + OAuth2.0 & JWT');
      });
    });
  });

  // ===========================================================================
  // Type Inference Tests
  // ===========================================================================
  describe('schema type inference', () => {
    it('should infer correct types for graph_expand_context', () => {
      type GraphExpandContextInput = z.infer<typeof graphExpandContextInput>;

      // Type-level test: This would fail at compile time if types don't match
      const validInput: GraphExpandContextInput = {
        collectionId: VALID_UUID,
        query: 'test',
        seedChunkIds: [1, 2],
        seedNodeIds: [VALID_NODE_UUID],
        maxDepth: 5,
        maxNodes: 100,
        edgeTypes: ['calls', 'persists_to'],
        nodeTypes: ['symbol', 'table'],
      };

      expect(validInput).toBeDefined();
    });
  });

  // ===========================================================================
  // Edge Cases and Boundary Tests
  // ===========================================================================
  describe('edge cases and boundary conditions', () => {
    it('should handle very long query strings', () => {
      const input = {
        collectionId: VALID_UUID,
        query: 'a'.repeat(1000),
      };

      const result = graphExpandContextInput.parse(input);
      expect(result.query).toHaveLength(1000);
    });

    it('should handle many seed chunk IDs', () => {
      const input = {
        collectionId: VALID_UUID,
        seedChunkIds: Array.from({ length: 100 }, (_, i) => i + 1),
      };

      const result = graphExpandContextInput.parse(input);
      expect(result.seedChunkIds).toHaveLength(100);
    });

    it('should handle many seed node IDs', () => {
      const input = {
        collectionId: VALID_UUID,
        seedNodeIds: Array.from({ length: 50 }, () => VALID_NODE_UUID),
      };

      const result = graphExpandContextInput.parse(input);
      expect(result.seedNodeIds).toHaveLength(50);
    });

    it('should handle all edge types in array', () => {
      const allEdgeTypes = [
        'calls',
        'defines',
        'belongs_to',
        'persists_to',
        'configured_by',
        'documents',
        'imports',
        'depends_on',
      ] as const;

      const input = {
        collectionId: VALID_UUID,
        query: 'test',
        edgeTypes: allEdgeTypes,
      };

      const result = graphExpandContextInput.parse(input);
      expect(result.edgeTypes).toHaveLength(8);
    });

    it('should handle all node types in array', () => {
      const allNodeTypes = [
        'document',
        'chunk',
        'symbol',
        'endpoint',
        'table',
        'column',
        'config_section',
      ] as const;

      const input = {
        collectionId: VALID_UUID,
        query: 'test',
        nodeTypes: allNodeTypes,
      };

      const result = graphExpandContextInput.parse(input);
      expect(result.nodeTypes).toHaveLength(7);
    });
  });
});
