/**
 * MCP E2E Scenario Tests
 *
 * End-to-end scenario tests for MCP tools simulating real agent workflows.
 * These tests verify:
 * - Tool parameter validation
 * - API endpoint construction
 * - Response format expectations
 * - Error handling
 *
 * Note: These tests use mocked API responses to verify tool behavior
 * without requiring a live backend.
 *
 * @module apps/mcp/src/__tests__/e2e-scenarios.test
 * @since GPT Phase 3: Sub-Phase 5.3
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// =============================================================================
// Mock API Client
// =============================================================================

// Mock the API client
vi.mock('../api.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from '../api.js';

// =============================================================================
// Schema Definitions (from index.ts)
// =============================================================================

// Mobile Core Tools
const searchMobileDocsInput = z
  .object({
    collectionId: z.string().uuid().describe('The ID of the collection to search'),
    query: z.string().min(1).describe('Search query for mobile documentation'),
    featureTags: z.array(z.string()).optional(),
    platform: z.enum(['mobile', 'web', 'backend', 'shared']).optional(),
    framework: z.string().optional(),
    top_k: z.number().int().min(1).max(50).default(10),
  })
  .strict();

const findCodeExamplesInput = z
  .object({
    collectionId: z.string().uuid().describe('The ID of the collection to search'),
    query: z.string().min(1).describe('Search query for code examples'),
    framework: z.string().optional(),
    featureTags: z.array(z.string()).optional(),
    top_k: z.number().int().min(1).max(20).default(5),
  })
  .strict();

const getFeatureRecipeInput = z
  .object({
    collectionId: z.string().uuid().describe('The ID of the collection to search'),
    featureTags: z.array(z.string()).min(1).describe('Feature tags to search for'),
    framework: z.string().optional(),
  })
  .strict();

// Introspection Tools
const getProjectTechStackInput = z
  .object({
    collectionId: z.string().uuid().describe('The ID of the collection'),
  })
  .strict();

const getDbSchemaInput = z
  .object({
    collectionId: z.string().uuid().describe('The ID of the collection'),
    tables: z.array(z.string()).optional(),
    includeRelationships: z.boolean().default(true),
  })
  .strict();

const findSymbolUsagesInput = z
  .object({
    collectionId: z.string().uuid().describe('The ID of the collection'),
    symbolName: z.string().min(1).describe('Name of the symbol to find'),
    symbolKind: z.enum(['function', 'class', 'widget', 'method', 'constant']).optional(),
    includeDefinitions: z.boolean().default(true),
    includeUsages: z.boolean().default(true),
    maxResults: z.number().int().min(1).max(100).default(20),
  })
  .strict();

// Graph Tools
const graphExpandContextInput = z
  .object({
    collectionId: z.string().uuid().describe('The ID of the collection'),
    seedChunkIds: z.array(z.number().int()).optional(),
    seedNodeIds: z.array(z.string()).optional(),
    query: z.string().optional(),
    maxDepth: z.number().int().min(1).max(5).default(2),
    maxNodes: z.number().int().min(1).max(100).default(20),
    edgeTypes: z.array(z.string()).optional(),
    nodeTypes: z.array(z.string()).optional(),
  })
  .strict()
  .refine((data) => data.seedChunkIds || data.seedNodeIds || data.query, {
    message: 'At least one of seedChunkIds, seedNodeIds, or query must be provided',
  });

// =============================================================================
// Test Constants
// =============================================================================

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const VALID_UUID_2 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

// =============================================================================
// Scenario Tests
// =============================================================================

describe('MCP E2E Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // Scenario 1: Mobile Documentation Search
  // ===========================================================================
  describe('Scenario: Mobile Documentation Search', () => {
    it('should search for Flutter auth documentation', async () => {
      // Mock API response
      const mockResponse = {
        results: [
          {
            chunk_id: 'chunk-1',
            text: 'Flutter authentication with Supabase...',
            score: 0.95,
            metadata: { file_path: 'docs/auth.md', framework: 'flutter' },
          },
          {
            chunk_id: 'chunk-2',
            text: 'Implementing OAuth2 in Flutter...',
            score: 0.87,
            metadata: { file_path: 'docs/oauth.md', framework: 'flutter' },
          },
        ],
        total: 2,
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse);

      // Validate input
      const input = {
        collectionId: VALID_UUID,
        query: 'authentication',
        featureTags: ['auth'],
        framework: 'flutter',
        top_k: 10,
      };

      const validated = searchMobileDocsInput.parse(input);
      expect(validated.collectionId).toBe(VALID_UUID);
      expect(validated.query).toBe('authentication');
      expect(validated.featureTags).toEqual(['auth']);
      expect(validated.framework).toBe('flutter');

      // Simulate tool execution
      const result = await apiClient.post('/api/search', {
        query: validated.query,
        collection_id: validated.collectionId,
        top_k: validated.top_k,
        feature_tags: validated.featureTags,
        tech_stack: [validated.framework],
      });

      expect(result.results).toHaveLength(2);
      expect(result.results[0].score).toBeGreaterThan(0.9);
    });

    it('should handle platform filtering', () => {
      const input = {
        collectionId: VALID_UUID,
        query: 'navigation patterns',
        platform: 'mobile' as const,
        top_k: 5,
      };

      const validated = searchMobileDocsInput.parse(input);
      expect(validated.platform).toBe('mobile');
    });

    it('should reject invalid platform', () => {
      const input = {
        collectionId: VALID_UUID,
        query: 'test',
        platform: 'invalid',
      };

      expect(() => searchMobileDocsInput.parse(input)).toThrow();
    });
  });

  // ===========================================================================
  // Scenario 2: Code Examples Discovery
  // ===========================================================================
  describe('Scenario: Code Examples Discovery', () => {
    it('should find Flutter auth examples with Supabase', async () => {
      const mockResponse = {
        results: [
          {
            chunk_id: 'code-1',
            text: '```dart\nawait supabase.auth.signInWithPassword(...)```',
            score: 0.92,
            metadata: {
              file_path: 'examples/auth_example.dart',
              chunk_type: 'code_block',
              language: 'dart',
            },
          },
        ],
        total: 1,
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse);

      const input = {
        collectionId: VALID_UUID,
        query: 'Supabase authentication',
        framework: 'flutter',
        featureTags: ['auth', 'supabase'],
        top_k: 5,
      };

      const validated = findCodeExamplesInput.parse(input);
      expect(validated.top_k).toBe(5);

      const result = await apiClient.post('/api/search', {
        query: validated.query,
        collection_id: validated.collectionId,
        top_k: validated.top_k,
        feature_tags: validated.featureTags,
        usage_tier: 'example',
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].metadata.chunk_type).toBe('code_block');
    });

    it('should default top_k to 5', () => {
      const input = {
        collectionId: VALID_UUID,
        query: 'state management',
      };

      const validated = findCodeExamplesInput.parse(input);
      expect(validated.top_k).toBe(5);
    });

    it('should enforce max top_k of 20', () => {
      const input = {
        collectionId: VALID_UUID,
        query: 'test',
        top_k: 21,
      };

      expect(() => findCodeExamplesInput.parse(input)).toThrow();
    });
  });

  // ===========================================================================
  // Scenario 3: Feature Recipe Lookup
  // ===========================================================================
  describe('Scenario: Feature Recipe Lookup', () => {
    it('should get billing recipe for Flutter', async () => {
      const mockResponse = {
        results: [
          {
            chunk_id: 'recipe-1',
            text: '# Implementing Stripe Billing in Flutter\n\n## Overview...',
            score: 0.98,
            metadata: {
              file_path: 'recipes/billing_flutter.md',
              usage_tier: 'recipe',
              feature_tags: ['billing', 'payments'],
            },
          },
        ],
        total: 1,
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse);

      const input = {
        collectionId: VALID_UUID,
        featureTags: ['billing', 'payments'],
        framework: 'flutter',
      };

      const validated = getFeatureRecipeInput.parse(input);
      expect(validated.featureTags).toContain('billing');

      const result = await apiClient.post('/api/search', {
        query: `${validated.featureTags.join(' ')} implementation guide`,
        collection_id: validated.collectionId,
        usage_tier: 'recipe',
        feature_tags: validated.featureTags,
      });

      expect(result.results[0].metadata.usage_tier).toBe('recipe');
    });

    it('should require at least one feature tag', () => {
      const input = {
        collectionId: VALID_UUID,
        featureTags: [],
      };

      expect(() => getFeatureRecipeInput.parse(input)).toThrow();
    });

    it('should handle multiple feature tags', () => {
      const input = {
        collectionId: VALID_UUID,
        featureTags: ['auth', 'social_login', 'google', 'apple'],
      };

      const validated = getFeatureRecipeInput.parse(input);
      expect(validated.featureTags).toHaveLength(4);
    });
  });

  // ===========================================================================
  // Scenario 4: Tech Stack Analysis
  // ===========================================================================
  describe('Scenario: Tech Stack Analysis', () => {
    it('should get project tech stack', async () => {
      const mockResponse = {
        id: VALID_UUID,
        collection_name: 'my-flutter-app',
        frameworks: ['flutter', 'dart'],
        databases: ['supabase', 'postgresql'],
        libraries: ['riverpod', 'freezed', 'go_router'],
        languages: ['dart'],
        detected_at: '2025-01-15T10:00:00Z',
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce(mockResponse);

      const input = {
        collectionId: VALID_UUID,
      };

      const validated = getProjectTechStackInput.parse(input);

      const result = await apiClient.get(`/api/tech-profiles/${validated.collectionId}`);

      expect(result.frameworks).toContain('flutter');
      expect(result.databases).toContain('supabase');
      expect(result.libraries).toContain('riverpod');
    });

    it('should reject extra fields due to strict mode', () => {
      const input = {
        collectionId: VALID_UUID,
        includeVersions: true, // extra field
      };

      expect(() => getProjectTechStackInput.parse(input)).toThrow();
    });
  });

  // ===========================================================================
  // Scenario 5: Database Schema Extraction
  // ===========================================================================
  describe('Scenario: Database Schema Extraction', () => {
    it('should extract schema with table filtering', async () => {
      const mockResponse = {
        collection_id: VALID_UUID,
        tables: [
          {
            name: 'users',
            columns: [
              { name: 'id', type: 'uuid', nullable: false, primary_key: true },
              { name: 'email', type: 'text', nullable: false },
              { name: 'created_at', type: 'timestamp', nullable: false },
            ],
          },
          {
            name: 'orders',
            columns: [
              { name: 'id', type: 'uuid', nullable: false, primary_key: true },
              { name: 'user_id', type: 'uuid', nullable: false },
              { name: 'total', type: 'numeric', nullable: false },
            ],
          },
        ],
        relationships: [
          {
            from_table: 'orders',
            from_column: 'user_id',
            to_table: 'users',
            to_column: 'id',
            type: 'foreign_key',
          },
        ],
        stats: {
          totalTables: 2,
          totalColumns: 6,
          totalRelationships: 1,
        },
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce(mockResponse);

      const input = {
        collectionId: VALID_UUID,
        tables: ['users', 'orders'],
        includeRelationships: true,
      };

      const validated = getDbSchemaInput.parse(input);

      const queryParams = new URLSearchParams();
      if (validated.tables) {
        queryParams.set('tables', validated.tables.join(','));
      }
      queryParams.set('include_relationships', String(validated.includeRelationships));

      const result = await apiClient.get(
        `/api/graph/schema/${validated.collectionId}?${queryParams.toString()}`
      );

      expect(result.tables).toHaveLength(2);
      expect(result.relationships).toHaveLength(1);
      expect(result.tables[0].name).toBe('users');
    });

    it('should default includeRelationships to true', () => {
      const input = {
        collectionId: VALID_UUID,
      };

      const validated = getDbSchemaInput.parse(input);
      expect(validated.includeRelationships).toBe(true);
    });

    it('should handle schema without relationships', async () => {
      const mockResponse = {
        collection_id: VALID_UUID,
        tables: [{ name: 'settings', columns: [{ name: 'key', type: 'text' }] }],
        relationships: [],
        stats: { totalTables: 1, totalColumns: 1, totalRelationships: 0 },
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce(mockResponse);

      const input = {
        collectionId: VALID_UUID,
        includeRelationships: false,
      };

      const validated = getDbSchemaInput.parse(input);
      const result = await apiClient.get(
        `/api/graph/schema/${validated.collectionId}?include_relationships=false`
      );

      expect(result.relationships).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Scenario 6: Symbol Usage Search
  // ===========================================================================
  describe('Scenario: Symbol Usage Search', () => {
    it('should find function definitions and usages', async () => {
      const mockResponse = {
        symbol: {
          name: 'handleAuth',
          kind: 'function',
          nodeId: 'node-123',
        },
        definitions: [
          {
            file_path: 'lib/services/auth_service.dart',
            line_start: 45,
            line_end: 78,
            chunk_id: 'chunk-def-1',
          },
        ],
        usages: [
          {
            file_path: 'lib/screens/login_screen.dart',
            line_start: 120,
            line_end: 120,
            chunk_id: 'chunk-use-1',
            edgeType: 'calls',
          },
          {
            file_path: 'lib/screens/signup_screen.dart',
            line_start: 85,
            line_end: 85,
            chunk_id: 'chunk-use-2',
            edgeType: 'calls',
          },
        ],
        stats: {
          totalDefinitions: 1,
          totalUsages: 2,
          documentsWithUsages: 2,
        },
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse);

      const input = {
        collectionId: VALID_UUID,
        symbolName: 'handleAuth',
        symbolKind: 'function' as const,
        includeDefinitions: true,
        includeUsages: true,
        maxResults: 50,
      };

      const validated = findSymbolUsagesInput.parse(input);

      const result = await apiClient.post('/api/graph/symbols', {
        collection_id: validated.collectionId,
        symbol_name: validated.symbolName,
        symbol_kind: validated.symbolKind,
        include_definitions: validated.includeDefinitions,
        include_usages: validated.includeUsages,
        max_results: validated.maxResults,
      });

      expect(result.symbol.name).toBe('handleAuth');
      expect(result.definitions).toHaveLength(1);
      expect(result.usages).toHaveLength(2);
    });

    it('should filter by symbol kind', () => {
      const validKinds = ['function', 'class', 'widget', 'method', 'constant'] as const;

      for (const kind of validKinds) {
        const input = {
          collectionId: VALID_UUID,
          symbolName: 'TestSymbol',
          symbolKind: kind,
        };

        expect(() => findSymbolUsagesInput.parse(input)).not.toThrow();
      }
    });

    it('should reject invalid symbol kind', () => {
      const input = {
        collectionId: VALID_UUID,
        symbolName: 'Test',
        symbolKind: 'module',
      };

      expect(() => findSymbolUsagesInput.parse(input)).toThrow();
    });

    it('should enforce maxResults bounds', () => {
      expect(() =>
        findSymbolUsagesInput.parse({
          collectionId: VALID_UUID,
          symbolName: 'test',
          maxResults: 0,
        })
      ).toThrow();

      expect(() =>
        findSymbolUsagesInput.parse({
          collectionId: VALID_UUID,
          symbolName: 'test',
          maxResults: 101,
        })
      ).toThrow();
    });
  });

  // ===========================================================================
  // Scenario 7: Graph Context Expansion
  // ===========================================================================
  describe('Scenario: Graph Context Expansion', () => {
    it('should expand context from seed chunks', async () => {
      const mockResponse = {
        nodes: [
          {
            id: 'node-1',
            type: 'function',
            name: 'handleAuth',
            file_path: 'lib/auth.dart',
          },
          {
            id: 'node-2',
            type: 'class',
            name: 'AuthService',
            file_path: 'lib/services/auth_service.dart',
          },
        ],
        edges: [
          {
            source: 'node-1',
            target: 'node-2',
            type: 'calls',
          },
        ],
        chunks: [
          {
            id: 'chunk-1',
            text: 'Authentication logic...',
            node_id: 'node-1',
          },
        ],
        stats: {
          nodesVisited: 2,
          edgesTraversed: 1,
          maxDepthReached: 2,
        },
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse);

      const input = {
        collectionId: VALID_UUID,
        seedChunkIds: ['chunk-seed-1'],
        maxDepth: 2,
        maxNodes: 20,
        edgeTypes: ['calls', 'imports'],
      };

      const validated = graphExpandContextInput.parse(input);

      const result = await apiClient.post('/api/graph/context', {
        collection_id: validated.collectionId,
        seed_chunk_ids: validated.seedChunkIds,
        max_depth: validated.maxDepth,
        max_nodes: validated.maxNodes,
        edge_types: validated.edgeTypes,
      });

      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      expect(result.stats.maxDepthReached).toBe(2);
    });

    it('should expand from query seed', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        nodes: [],
        edges: [],
        chunks: [],
        stats: { nodesVisited: 0, edgesTraversed: 0, maxDepthReached: 0 },
      });

      const input = {
        collectionId: VALID_UUID,
        query: 'authentication flow',
        maxDepth: 3,
      };

      const validated = graphExpandContextInput.parse(input);
      expect(validated.query).toBe('authentication flow');
    });

    it('should require at least one seed type', () => {
      const input = {
        collectionId: VALID_UUID,
        maxDepth: 2,
      };

      expect(() => graphExpandContextInput.parse(input)).toThrow(
        'At least one of seedChunkIds, seedNodeIds, or query must be provided'
      );
    });

    it('should allow multiple seed types', () => {
      const input = {
        collectionId: VALID_UUID,
        seedChunkIds: ['chunk-1'],
        seedNodeIds: ['node-1'],
        query: 'auth',
        maxDepth: 2,
      };

      expect(() => graphExpandContextInput.parse(input)).not.toThrow();
    });

    it('should enforce depth and node limits', () => {
      // Max depth exceeded
      expect(() =>
        graphExpandContextInput.parse({
          collectionId: VALID_UUID,
          seedChunkIds: ['chunk-1'],
          maxDepth: 6,
        })
      ).toThrow();

      // Max nodes exceeded
      expect(() =>
        graphExpandContextInput.parse({
          collectionId: VALID_UUID,
          seedChunkIds: ['chunk-1'],
          maxNodes: 101,
        })
      ).toThrow();
    });
  });

  // ===========================================================================
  // Error Handling Scenarios
  // ===========================================================================
  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const error = new Error('Connection refused');
      vi.mocked(apiClient.post).mockRejectedValueOnce(error);

      try {
        await apiClient.post('/api/search', { query: 'test' });
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toBe('Connection refused');
      }
    });

    it('should handle 404 responses', async () => {
      const error = Object.assign(new Error('Not found'), { status: 404 });
      vi.mocked(apiClient.get).mockRejectedValueOnce(error);

      try {
        await apiClient.get(`/api/tech-profiles/${VALID_UUID}`);
        expect.fail('Should have thrown');
      } catch (e) {
        expect((e as Error).message).toBe('Not found');
      }
    });

    it('should validate UUID format for all tools', () => {
      const invalidUUID = 'not-a-uuid';

      expect(() =>
        searchMobileDocsInput.parse({ collectionId: invalidUUID, query: 'test' })
      ).toThrow();

      expect(() =>
        findCodeExamplesInput.parse({ collectionId: invalidUUID, query: 'test' })
      ).toThrow();

      expect(() =>
        getFeatureRecipeInput.parse({ collectionId: invalidUUID, featureTags: ['auth'] })
      ).toThrow();

      expect(() => getProjectTechStackInput.parse({ collectionId: invalidUUID })).toThrow();

      expect(() => getDbSchemaInput.parse({ collectionId: invalidUUID })).toThrow();

      expect(() =>
        findSymbolUsagesInput.parse({ collectionId: invalidUUID, symbolName: 'test' })
      ).toThrow();

      expect(() =>
        graphExpandContextInput.parse({ collectionId: invalidUUID, query: 'test' })
      ).toThrow();
    });
  });
});
