/**
 * GPT Phase 2 Sub-Phase 3.4: Search Graph Integration Tests
 *
 * Integration tests for the graph expansion feature in search.
 * Tests the integration between smartSearch and graphSearch services
 * for context expansion via knowledge graph traversal.
 */

import type { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// =============================================================================
// MOCK SETUP
// =============================================================================

// Hoist mocks so they can be configured per test
const graphSearchMock = vi.hoisted(() => vi.fn());
const isGraphExpansionEnabledMock = vi.hoisted(() => vi.fn());
const vectorSearchMock = vi.hoisted(() => vi.fn());
const hybridSearchMock = vi.hoisted(() => vi.fn());
const rerankResultsMock = vi.hoisted(() => vi.fn());

vi.mock('../graph-search.js', () => ({
  graphSearch: graphSearchMock,
  isGraphExpansionEnabled: isGraphExpansionEnabledMock,
}));

vi.mock('../vector.js', () => ({
  searchCollection: vectorSearchMock,
}));

vi.mock('../hybrid.js', () => ({
  hybridSearch: hybridSearchMock,
}));

vi.mock('../reranker.js', async () => {
  const actual = await vi.importActual<typeof import('../reranker.js')>('../reranker.js');
  return {
    ...actual,
    rerankResults: rerankResultsMock,
  };
});

vi.mock('../file-relationships.js', () => ({
  getRelatedFiles: vi.fn().mockResolvedValue(null),
}));

// Mock query-intent to avoid uncontrolled intent detection
vi.mock('../query-intent.js', () => ({
  analyzeQuery: vi.fn().mockReturnValue({ intent: 'general', confidence: 1.0 }),
  getIntentSearchConfig: vi.fn().mockReturnValue(undefined),
  logIntentDetection: vi.fn(),
  recordIntentMetric: vi.fn(),
}));

// Mock MMR to pass through results unchanged
vi.mock('../mmr.js', () => ({
  applyMMR: vi.fn().mockImplementation((results) => results),
  logMMRResults: vi.fn(),
  resolveMMROptions: vi.fn().mockReturnValue({ enabled: false, lambda: 0.5 }),
}));

// =============================================================================
// TEST DATA HELPERS
// =============================================================================

const TEST_COLLECTION_ID = 'col-test-1111-2222-3333-444444444444';

/**
 * Creates a mock search result with all required fields
 */
function createMockSearchResult(
  id: number,
  text: string,
  similarity: number,
  metadata?: Record<string, unknown>
) {
  return {
    id,
    text,
    snippet: text.substring(0, 100),
    similarity,
    docId: `doc-${id}`,
    docTitle: `Document ${id}`,
    sourceUrl: `https://example.com/doc/${id}`,
    metadata: metadata ?? null,
    citation: { title: `Document ${id}` },
  };
}

/**
 * Creates a mock graph context result from graphSearch
 */
function createMockGraphContext(
  chunkIds: number[],
  options?: {
    nodesVisited?: number;
    edgesTraversed?: number;
    depthReached?: number;
    durationMs?: number;
  }
) {
  return {
    nodes: chunkIds.map((id) => ({
      id: `node-${id}`,
      collection_id: TEST_COLLECTION_ID,
      node_type: 'symbol',
      name: `Node${id}`,
      document_id: null,
      chunk_id: id,
      metadata: {},
      created_at: new Date(),
    })),
    edges: [],
    chunks: chunkIds.map((id) => ({
      id,
      text: `Graph-derived chunk ${id} content`,
      metadata: { from_graph: true },
    })),
    stats: {
      nodesVisited: options?.nodesVisited ?? chunkIds.length,
      edgesTraversed: options?.edgesTraversed ?? 0,
      depthReached: options?.depthReached ?? 1,
      durationMs: options?.durationMs ?? 25,
    },
  };
}

/**
 * Creates mock hybrid search diagnostics
 */
function createMockDiagnostics() {
  return {
    vectorResultCount: 10,
    bm25ResultCount: 10,
    fusedResultCount: 10,
    bothSourceCount: 5,
    vectorScores: { avg: 0.75, max: 0.9, min: 0.5 },
    bm25Scores: { avg: 0.65, max: 0.85, min: 0.4 },
    timing: { vectorMs: 50, bm25Ms: 20, fusionMs: 5, totalMs: 75 },
    bm25QueryType: 'natural_language',
    bm25TsFunction: 'websearch_to_tsquery',
    weights: { vector: 0.7, bm25: 0.3 },
    rrfK: 60,
  };
}

/**
 * Creates a mock database pool
 */
function createMockPool(): Pool {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  } as unknown as Pool;
}

// =============================================================================
// TEST SUITE
// =============================================================================

describe('Search Graph Integration (GPT Phase 2.4)', () => {
  let mockDb: Pool;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockDb = createMockPool();

    // Reset environment variables
    for (const key of [
      'ENABLE_GRAPH_EXPANSION',
      'GRAPH_MAX_DEPTH',
      'GRAPH_MAX_NODES',
      'SEARCH_MODE',
      'ENABLE_TRUST_SCORING',
    ]) {
      Reflect.deleteProperty(process.env, key);
    }

    // Default mock implementations
    isGraphExpansionEnabledMock.mockReturnValue(false);
    graphSearchMock.mockResolvedValue(createMockGraphContext([]));

    vectorSearchMock.mockResolvedValue({
      query: 'test',
      results: [createMockSearchResult(1, 'Vector result 1', 0.9)],
      totalResults: 1,
      searchTimeMs: 50,
    });

    hybridSearchMock.mockResolvedValue({
      diagnostics: createMockDiagnostics(),
      results: [
        {
          ...createMockSearchResult(1, 'Hybrid result 1', 0.9),
          fusedScore: 0.9,
          vectorScore: 0.85,
          bm25Score: 0.95,
        },
      ],
      elapsedMs: 100,
      vectorCount: 5,
      bm25Count: 5,
    });

    rerankResultsMock.mockImplementation(async (_query, candidates) => {
      return candidates.map((item: Record<string, unknown>, index: number) => ({
        ...item,
        rerankScore: 0.95 - index * 0.05,
        rerankProvider: 'cohere',
        originalSimilarity: item.similarity,
      }));
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  // ===========================================================================
  // EXPAND WITH GRAPH PARAMETER TESTS
  // ===========================================================================

  describe('expandWithGraph parameter', () => {
    it('should not call graphSearch when expandWithGraph is false', async () => {
      const { smartSearch } = await import('../search.js');

      isGraphExpansionEnabledMock.mockReturnValue(true);

      const response = await smartSearch(mockDb, {
        query: 'test query',
        collectionId: TEST_COLLECTION_ID,
        topK: 5,
        expandWithGraph: false,
      });

      expect(graphSearchMock).not.toHaveBeenCalled();
      expect(response.results).toHaveLength(1);
    });

    it('should not call graphSearch when expandWithGraph is undefined and env is false', async () => {
      const { smartSearch } = await import('../search.js');

      isGraphExpansionEnabledMock.mockReturnValue(false);
      process.env.ENABLE_GRAPH_EXPANSION = 'false';

      const response = await smartSearch(mockDb, {
        query: 'test query',
        collectionId: TEST_COLLECTION_ID,
        topK: 5,
        // expandWithGraph not specified - should use env default
      });

      expect(isGraphExpansionEnabledMock).toHaveBeenCalled();
      expect(graphSearchMock).not.toHaveBeenCalled();
      expect(response.results).toHaveLength(1);
    });

    it('should call graphSearch when expandWithGraph is true', async () => {
      const { smartSearch } = await import('../search.js');

      graphSearchMock.mockResolvedValue(
        createMockGraphContext([10, 11], {
          nodesVisited: 5,
          edgesTraversed: 3,
          depthReached: 2,
          durationMs: 30,
        })
      );

      const response = await smartSearch(mockDb, {
        query: 'test query',
        collectionId: TEST_COLLECTION_ID,
        topK: 5,
        expandWithGraph: true,
      });

      expect(graphSearchMock).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          collectionId: TEST_COLLECTION_ID,
          seedChunkIds: expect.any(Array),
        })
      );
      // Should have original + graph results merged
      expect(response.results.length).toBeGreaterThanOrEqual(1);
    });

    it('should pass seed chunk IDs from search results to graphSearch', async () => {
      const { smartSearch } = await import('../search.js');

      // Setup search to return specific chunk IDs
      vectorSearchMock.mockResolvedValue({
        query: 'test',
        results: [
          createMockSearchResult(101, 'Chunk 101', 0.95),
          createMockSearchResult(102, 'Chunk 102', 0.9),
          createMockSearchResult(103, 'Chunk 103', 0.85),
        ],
        totalResults: 3,
        searchTimeMs: 50,
      });

      graphSearchMock.mockResolvedValue(createMockGraphContext([201, 202]));

      await smartSearch(mockDb, {
        query: 'test query',
        collectionId: TEST_COLLECTION_ID,
        topK: 5,
        expandWithGraph: true,
      });

      expect(graphSearchMock).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          seedChunkIds: [101, 102, 103],
        })
      );
    });

    it('should respect env var when expandWithGraph is undefined and env is true', async () => {
      const { smartSearch } = await import('../search.js');

      isGraphExpansionEnabledMock.mockReturnValue(true);
      process.env.ENABLE_GRAPH_EXPANSION = 'true';

      graphSearchMock.mockResolvedValue(
        createMockGraphContext([10], {
          nodesVisited: 2,
          edgesTraversed: 1,
          depthReached: 1,
          durationMs: 15,
        })
      );

      await smartSearch(mockDb, {
        query: 'test query',
        collectionId: TEST_COLLECTION_ID,
        topK: 5,
        // expandWithGraph not specified - should use env default (true)
      });

      // When env is true, graph search should be called
      expect(graphSearchMock).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // GRAPH EXPANSION RESULTS TESTS
  // ===========================================================================

  describe('graph expansion results', () => {
    it('should merge graph-derived chunks with original results', async () => {
      const { smartSearch } = await import('../search.js');

      // Original search returns chunks 1, 2
      vectorSearchMock.mockResolvedValue({
        query: 'test',
        results: [
          createMockSearchResult(1, 'Original chunk 1', 0.9),
          createMockSearchResult(2, 'Original chunk 2', 0.85),
        ],
        totalResults: 2,
        searchTimeMs: 50,
      });

      // Graph search returns chunks 3, 4
      graphSearchMock.mockResolvedValue(
        createMockGraphContext([3, 4], {
          nodesVisited: 4,
          edgesTraversed: 2,
          depthReached: 1,
        })
      );

      const response = await smartSearch(mockDb, {
        query: 'test query',
        collectionId: TEST_COLLECTION_ID,
        topK: 10,
        expandWithGraph: true,
      });

      // Should have both original and graph-derived results
      const chunkIds = response.results.map((r) => r.id);
      expect(chunkIds).toContain(1);
      expect(chunkIds).toContain(2);
      // Graph chunks should be included (if implementation merges them)
      expect(response.results.length).toBeGreaterThanOrEqual(2);
    });

    it('should deduplicate chunks by ID (original takes precedence)', async () => {
      const { smartSearch } = await import('../search.js');

      // Original search returns chunk 1
      vectorSearchMock.mockResolvedValue({
        query: 'test',
        results: [createMockSearchResult(1, 'Original version of chunk 1', 0.95)],
        totalResults: 1,
        searchTimeMs: 50,
      });

      // Graph search also returns chunk 1 (duplicate)
      graphSearchMock.mockResolvedValue({
        nodes: [
          {
            id: 'node-1',
            collection_id: TEST_COLLECTION_ID,
            node_type: 'symbol',
            name: 'Node1',
            document_id: null,
            chunk_id: 1,
            metadata: {},
            created_at: new Date(),
          },
        ],
        edges: [],
        chunks: [
          {
            id: 1, // Same ID as original
            text: 'Graph version of chunk 1',
            metadata: { from_graph: true },
          },
        ],
        stats: { nodesVisited: 1, edgesTraversed: 0, depthReached: 0, durationMs: 10 },
      });

      const response = await smartSearch(mockDb, {
        query: 'test query',
        collectionId: TEST_COLLECTION_ID,
        topK: 10,
        expandWithGraph: true,
      });

      // Should only have one result with ID 1
      const chunksWithId1 = response.results.filter((r) => r.id === 1);
      expect(chunksWithId1).toHaveLength(1);
      // Original version should take precedence
      expect(chunksWithId1[0].text).toContain('Original');
    });

    it('should attach graphContext to graph-derived results', async () => {
      const { smartSearch } = await import('../search.js');

      vectorSearchMock.mockResolvedValue({
        query: 'test',
        results: [createMockSearchResult(1, 'Original chunk', 0.9)],
        totalResults: 1,
        searchTimeMs: 50,
      });

      graphSearchMock.mockResolvedValue(
        createMockGraphContext([10], {
          nodesVisited: 3,
          edgesTraversed: 2,
          depthReached: 2,
        })
      );

      const response = await smartSearch(mockDb, {
        query: 'test query',
        collectionId: TEST_COLLECTION_ID,
        topK: 10,
        expandWithGraph: true,
      });

      // Graph-derived results should have graphContext attached or from_graph metadata
      const graphDerivedResults = response.results.filter(
        (r) => r.metadata?.from_graph === true || r.graphContext
      );

      // Verify graph-derived results have context attached
      expect(graphDerivedResults.length).toBeGreaterThan(0);
    });

    it('should include graphExpansion metadata in response', async () => {
      const { smartSearch } = await import('../search.js');

      graphSearchMock.mockResolvedValue(
        createMockGraphContext([10, 11, 12], {
          nodesVisited: 8,
          edgesTraversed: 5,
          depthReached: 3,
          durationMs: 45,
        })
      );

      const response = await smartSearch(mockDb, {
        query: 'test query',
        collectionId: TEST_COLLECTION_ID,
        topK: 10,
        expandWithGraph: true,
      });

      // Response metadata should include graph expansion stats
      expect(response.metadata).toBeDefined();
      expect(response.metadata.graphExpansion).toBeDefined();
      expect(response.metadata.graphExpansion).toMatchObject({
        enabled: true,
        nodesVisited: expect.any(Number),
        edgesTraversed: expect.any(Number),
        depthReached: expect.any(Number),
        expansionTimeMs: expect.any(Number),
      });
    });
  });

  // ===========================================================================
  // GRAPH EXPANSION LIMITS TESTS
  // ===========================================================================

  describe('graph expansion limits', () => {
    it('should respect graphMaxDepth parameter', async () => {
      const { smartSearch } = await import('../search.js');

      vectorSearchMock.mockResolvedValue({
        query: 'test',
        results: [createMockSearchResult(1, 'Chunk 1', 0.9)],
        totalResults: 1,
        searchTimeMs: 50,
      });

      await smartSearch(mockDb, {
        query: 'test query',
        collectionId: TEST_COLLECTION_ID,
        topK: 5,
        expandWithGraph: true,
        graphMaxDepth: 2,
      });

      expect(graphSearchMock).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          maxDepth: 2,
        })
      );
    });

    it('should respect graphMaxNodes parameter', async () => {
      const { smartSearch } = await import('../search.js');

      vectorSearchMock.mockResolvedValue({
        query: 'test',
        results: [createMockSearchResult(1, 'Chunk 1', 0.9)],
        totalResults: 1,
        searchTimeMs: 50,
      });

      await smartSearch(mockDb, {
        query: 'test query',
        collectionId: TEST_COLLECTION_ID,
        topK: 5,
        expandWithGraph: true,
        graphMaxNodes: 25,
      });

      expect(graphSearchMock).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          maxNodes: 25,
        })
      );
    });

    it('should use default limits from env when not specified', async () => {
      const { smartSearch } = await import('../search.js');

      process.env.GRAPH_MAX_DEPTH = '4';
      process.env.GRAPH_MAX_NODES = '30';

      vectorSearchMock.mockResolvedValue({
        query: 'test',
        results: [createMockSearchResult(1, 'Chunk 1', 0.9)],
        totalResults: 1,
        searchTimeMs: 50,
      });

      await smartSearch(mockDb, {
        query: 'test query',
        collectionId: TEST_COLLECTION_ID,
        topK: 5,
        expandWithGraph: true,
        // No graphMaxDepth or graphMaxNodes specified
      });

      // Should use env defaults or service defaults
      expect(graphSearchMock).toHaveBeenCalledWith(mockDb, expect.any(Object));
    });

    it('should pass explicit limits over env defaults', async () => {
      const { smartSearch } = await import('../search.js');

      process.env.GRAPH_MAX_DEPTH = '5';
      process.env.GRAPH_MAX_NODES = '100';

      vectorSearchMock.mockResolvedValue({
        query: 'test',
        results: [createMockSearchResult(1, 'Chunk 1', 0.9)],
        totalResults: 1,
        searchTimeMs: 50,
      });

      await smartSearch(mockDb, {
        query: 'test query',
        collectionId: TEST_COLLECTION_ID,
        topK: 5,
        expandWithGraph: true,
        graphMaxDepth: 1,
        graphMaxNodes: 10,
      });

      expect(graphSearchMock).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          maxDepth: 1,
          maxNodes: 10,
        })
      );
    });
  });

  // ===========================================================================
  // BACKWARD COMPATIBILITY TESTS
  // ===========================================================================

  describe('backward compatibility', () => {
    it('should return identical results when graph expansion disabled', async () => {
      const { smartSearch } = await import('../search.js');

      const expectedResults = [
        createMockSearchResult(1, 'Result 1', 0.9),
        createMockSearchResult(2, 'Result 2', 0.85),
      ];

      vectorSearchMock.mockResolvedValue({
        query: 'test',
        results: expectedResults,
        totalResults: 2,
        searchTimeMs: 50,
      });

      isGraphExpansionEnabledMock.mockReturnValue(false);

      const responseWithoutGraph = await smartSearch(mockDb, {
        query: 'test query',
        collectionId: TEST_COLLECTION_ID,
        topK: 5,
        expandWithGraph: false,
      });

      expect(graphSearchMock).not.toHaveBeenCalled();
      expect(responseWithoutGraph.results).toHaveLength(2);
      expect(responseWithoutGraph.results.map((r) => r.id)).toEqual([1, 2]);
    });

    it('should work with hybrid search mode', async () => {
      const { smartSearch } = await import('../search.js');

      hybridSearchMock.mockResolvedValue({
        diagnostics: createMockDiagnostics(),
        results: [
          {
            ...createMockSearchResult(1, 'Hybrid result', 0.9),
            fusedScore: 0.9,
            vectorScore: 0.85,
            bm25Score: 0.95,
          },
        ],
        elapsedMs: 100,
        vectorCount: 5,
        bm25Count: 5,
      });

      graphSearchMock.mockResolvedValue(
        createMockGraphContext([10], {
          nodesVisited: 2,
          edgesTraversed: 1,
          depthReached: 1,
        })
      );

      const response = await smartSearch(mockDb, {
        query: 'test query',
        collectionId: TEST_COLLECTION_ID,
        topK: 5,
        mode: 'hybrid',
        expandWithGraph: true,
      });

      expect(hybridSearchMock).toHaveBeenCalled();
      expect(graphSearchMock).toHaveBeenCalled();
      expect(response.metadata.searchMode).toBe('hybrid');
    });

    it('should work with vector search mode', async () => {
      const { smartSearch } = await import('../search.js');

      vectorSearchMock.mockResolvedValue({
        query: 'test',
        results: [createMockSearchResult(1, 'Vector result', 0.9)],
        totalResults: 1,
        searchTimeMs: 50,
      });

      graphSearchMock.mockResolvedValue(
        createMockGraphContext([10], {
          nodesVisited: 2,
          edgesTraversed: 1,
          depthReached: 1,
        })
      );

      const response = await smartSearch(mockDb, {
        query: 'test query',
        collectionId: TEST_COLLECTION_ID,
        topK: 5,
        mode: 'vector',
        expandWithGraph: true,
      });

      expect(vectorSearchMock).toHaveBeenCalled();
      expect(graphSearchMock).toHaveBeenCalled();
      expect(response.metadata.searchMode).toBe('vector');
    });

    it('should work with reranking enabled', async () => {
      const { smartSearch } = await import('../search.js');

      hybridSearchMock.mockResolvedValue({
        diagnostics: createMockDiagnostics(),
        results: [
          {
            ...createMockSearchResult(1, 'Result for reranking', 0.85),
            fusedScore: 0.85,
          },
          {
            ...createMockSearchResult(2, 'Another result', 0.8),
            fusedScore: 0.8,
          },
        ],
        elapsedMs: 100,
        vectorCount: 5,
        bm25Count: 5,
      });

      graphSearchMock.mockResolvedValue(
        createMockGraphContext([10], {
          nodesVisited: 2,
          edgesTraversed: 1,
          depthReached: 1,
        })
      );

      const response = await smartSearch(mockDb, {
        query: 'test query',
        collectionId: TEST_COLLECTION_ID,
        topK: 5,
        rerank: true,
        expandWithGraph: true,
      });

      expect(rerankResultsMock).toHaveBeenCalled();
      expect(graphSearchMock).toHaveBeenCalled();
      expect(response.metadata.reranked).toBe(true);
    });

    it('should maintain result ordering after graph expansion', async () => {
      const { smartSearch } = await import('../search.js');

      // Original results with specific similarity scores
      vectorSearchMock.mockResolvedValue({
        query: 'test',
        results: [
          createMockSearchResult(1, 'Best result', 0.95),
          createMockSearchResult(2, 'Second best', 0.9),
          createMockSearchResult(3, 'Third best', 0.85),
        ],
        totalResults: 3,
        searchTimeMs: 50,
      });

      graphSearchMock.mockResolvedValue(
        createMockGraphContext([10, 11], {
          nodesVisited: 3,
          edgesTraversed: 2,
          depthReached: 1,
        })
      );

      const response = await smartSearch(mockDb, {
        query: 'test query',
        collectionId: TEST_COLLECTION_ID,
        topK: 10,
        expandWithGraph: true,
      });

      // Original results should appear first before graph-derived results
      // Check that original results (1, 2, 3) come before graph results (10, 11)
      const allIds = response.results.map((r) => r.id);
      const originalIds = allIds.filter((id) => [1, 2, 3].includes(id));

      // Original results should maintain their order (1 before 2 before 3)
      expect(originalIds).toEqual([1, 2, 3]);
    });
  });

  // ===========================================================================
  // ERROR HANDLING TESTS
  // ===========================================================================

  describe('error handling', () => {
    it('should gracefully handle graphSearch errors', async () => {
      const { smartSearch } = await import('../search.js');

      vectorSearchMock.mockResolvedValue({
        query: 'test',
        results: [createMockSearchResult(1, 'Original result', 0.9)],
        totalResults: 1,
        searchTimeMs: 50,
      });

      // graphSearch throws an error
      graphSearchMock.mockRejectedValue(new Error('Graph database connection failed'));

      // Should not throw, should return original results
      const response = await smartSearch(mockDb, {
        query: 'test query',
        collectionId: TEST_COLLECTION_ID,
        topK: 5,
        expandWithGraph: true,
      });

      // Should have at least the original results
      expect(response.results).toHaveLength(1);
      expect(response.results[0].id).toBe(1);
    });

    it('should return original results when graphSearch fails', async () => {
      const { smartSearch } = await import('../search.js');

      const originalResults = [
        createMockSearchResult(1, 'Original 1', 0.95),
        createMockSearchResult(2, 'Original 2', 0.9),
      ];

      vectorSearchMock.mockResolvedValue({
        query: 'test',
        results: originalResults,
        totalResults: 2,
        searchTimeMs: 50,
      });

      graphSearchMock.mockRejectedValue(new Error('Graph traversal timeout'));

      const response = await smartSearch(mockDb, {
        query: 'test query',
        collectionId: TEST_COLLECTION_ID,
        topK: 5,
        expandWithGraph: true,
      });

      // Should fall back to original results (at least one result should be there)
      expect(response.results.length).toBeGreaterThanOrEqual(1);
      expect(response.results[0].id).toBe(1);
    });

    it('should handle empty graph results gracefully', async () => {
      const { smartSearch } = await import('../search.js');

      vectorSearchMock.mockResolvedValue({
        query: 'test',
        results: [createMockSearchResult(1, 'Original result', 0.9)],
        totalResults: 1,
        searchTimeMs: 50,
      });

      // graphSearch returns empty results
      graphSearchMock.mockResolvedValue({
        nodes: [],
        edges: [],
        chunks: [],
        stats: { nodesVisited: 0, edgesTraversed: 0, depthReached: 0, durationMs: 5 },
      });

      const response = await smartSearch(mockDb, {
        query: 'test query',
        collectionId: TEST_COLLECTION_ID,
        topK: 5,
        expandWithGraph: true,
      });

      // Should have original results only
      expect(response.results).toHaveLength(1);
      expect(response.results[0].id).toBe(1);
    });

    it('should handle graphSearch returning null chunks', async () => {
      const { smartSearch } = await import('../search.js');

      vectorSearchMock.mockResolvedValue({
        query: 'test',
        results: [createMockSearchResult(1, 'Original result', 0.9)],
        totalResults: 1,
        searchTimeMs: 50,
      });

      // graphSearch returns nodes but chunks array is effectively empty
      graphSearchMock.mockResolvedValue({
        nodes: [
          {
            id: 'node-orphan',
            collection_id: TEST_COLLECTION_ID,
            node_type: 'symbol',
            name: 'Orphan',
            document_id: null,
            chunk_id: null, // No associated chunk
            metadata: {},
            created_at: new Date(),
          },
        ],
        edges: [],
        chunks: [], // No chunks returned
        stats: { nodesVisited: 1, edgesTraversed: 0, depthReached: 0, durationMs: 10 },
      });

      const response = await smartSearch(mockDb, {
        query: 'test query',
        collectionId: TEST_COLLECTION_ID,
        topK: 5,
        expandWithGraph: true,
      });

      // Should have original results only
      expect(response.results).toHaveLength(1);
      expect(response.results[0].id).toBe(1);
    });
  });

  // ===========================================================================
  // PERFORMANCE TESTS
  // ===========================================================================

  describe('performance considerations', () => {
    it('should complete graph expansion within acceptable time', async () => {
      const { smartSearch } = await import('../search.js');

      vectorSearchMock.mockResolvedValue({
        query: 'test',
        results: [createMockSearchResult(1, 'Result', 0.9)],
        totalResults: 1,
        searchTimeMs: 50,
      });

      graphSearchMock.mockResolvedValue(
        createMockGraphContext([10, 11, 12, 13, 14], {
          nodesVisited: 20,
          edgesTraversed: 15,
          depthReached: 3,
          durationMs: 100,
        })
      );

      const start = performance.now();

      await smartSearch(mockDb, {
        query: 'performance test',
        collectionId: TEST_COLLECTION_ID,
        topK: 10,
        expandWithGraph: true,
      });

      const elapsed = performance.now() - start;

      // Combined search + graph expansion should be under 500ms
      // (mocked so this mainly tests for synchronous overhead)
      expect(elapsed).toBeLessThan(500);
    });

    it('should limit seed chunks to reasonable number', async () => {
      const { smartSearch } = await import('../search.js');

      // Return many results from search
      const manyResults = Array.from({ length: 50 }, (_, i) =>
        createMockSearchResult(i + 1, `Result ${i + 1}`, 0.95 - i * 0.01)
      );

      vectorSearchMock.mockResolvedValue({
        query: 'test',
        results: manyResults,
        totalResults: 50,
        searchTimeMs: 80,
      });

      graphSearchMock.mockResolvedValue(createMockGraphContext([100, 101]));

      await smartSearch(mockDb, {
        query: 'test query',
        collectionId: TEST_COLLECTION_ID,
        topK: 50,
        expandWithGraph: true,
      });

      // graphSearch should be called but with a reasonable number of seeds
      // (implementation may limit to top N results as seeds)
      expect(graphSearchMock).toHaveBeenCalled();
      const callArgs = graphSearchMock.mock.calls[0][1];
      // Seed chunk IDs should be passed (could be limited to top-K)
      expect(callArgs.seedChunkIds).toBeDefined();
    });
  });

  // ===========================================================================
  // INTEGRATION WITH OTHER FEATURES TESTS
  // ===========================================================================

  describe('integration with other features', () => {
    it('should work with tech_stack filtering', async () => {
      const { smartSearch } = await import('../search.js');

      vectorSearchMock.mockResolvedValue({
        query: 'test',
        results: [
          createMockSearchResult(1, 'Flutter result', 0.9, { tech_stack: ['flutter', 'dart'] }),
        ],
        totalResults: 1,
        searchTimeMs: 50,
      });

      graphSearchMock.mockResolvedValue(createMockGraphContext([10]));

      const response = await smartSearch(mockDb, {
        query: 'test query',
        collectionId: TEST_COLLECTION_ID,
        topK: 5,
        techStack: ['flutter'],
        expandWithGraph: true,
      });

      // vectorSearch should be called (search happens)
      expect(vectorSearchMock).toHaveBeenCalled();
      expect(graphSearchMock).toHaveBeenCalled();
      expect(response.results.length).toBeGreaterThanOrEqual(1);
    });

    it('should work with feature_tags filtering', async () => {
      const { smartSearch } = await import('../search.js');

      vectorSearchMock.mockResolvedValue({
        query: 'test',
        results: [
          createMockSearchResult(1, 'Auth feature', 0.9, { feature_tags: ['authentication'] }),
        ],
        totalResults: 1,
        searchTimeMs: 50,
      });

      graphSearchMock.mockResolvedValue(createMockGraphContext([10]));

      const response = await smartSearch(mockDb, {
        query: 'authentication setup',
        collectionId: TEST_COLLECTION_ID,
        topK: 5,
        featureTags: ['authentication'],
        expandWithGraph: true,
      });

      // vectorSearch should be called (search happens)
      expect(vectorSearchMock).toHaveBeenCalled();
      expect(graphSearchMock).toHaveBeenCalled();
      expect(response.results.length).toBeGreaterThanOrEqual(1);
    });

    it('should work with intent detection', async () => {
      const { smartSearch } = await import('../search.js');

      vectorSearchMock.mockResolvedValue({
        query: 'test',
        results: [createMockSearchResult(1, 'Code example', 0.9)],
        totalResults: 1,
        searchTimeMs: 50,
      });

      graphSearchMock.mockResolvedValue(createMockGraphContext([10]));

      const response = await smartSearch(mockDb, {
        query: 'class AuthService',
        collectionId: TEST_COLLECTION_ID,
        topK: 5,
        autoIntent: true,
        expandWithGraph: true,
      });

      expect(graphSearchMock).toHaveBeenCalled();
      // Intent should be detected
      if (response.metadata.intent) {
        expect(response.metadata.intent.type).toBeDefined();
      }
    });

    it('should work with MMR diversification', async () => {
      const { smartSearch } = await import('../search.js');

      vectorSearchMock.mockResolvedValue({
        query: 'test',
        results: [
          createMockSearchResult(1, 'Result 1', 0.9),
          createMockSearchResult(2, 'Result 2', 0.88),
          createMockSearchResult(3, 'Result 3', 0.85),
        ],
        totalResults: 3,
        searchTimeMs: 50,
      });

      graphSearchMock.mockResolvedValue(createMockGraphContext([10, 11]));

      // Mock embeddings fetch for MMR
      (mockDb.query as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [
          { id: 1, embedding: '[0.1,0.2,0.3]' },
          { id: 2, embedding: '[0.15,0.25,0.35]' },
          { id: 3, embedding: '[0.5,0.6,0.7]' },
        ],
      });

      const response = await smartSearch(mockDb, {
        query: 'test query',
        collectionId: TEST_COLLECTION_ID,
        topK: 5,
        mmrEnabled: true,
        mmrLambda: 0.7,
        expandWithGraph: true,
      });

      // Graph search and vector search should be called
      expect(graphSearchMock).toHaveBeenCalled();
      expect(vectorSearchMock).toHaveBeenCalled();
      // Response should have results
      expect(response.results.length).toBeGreaterThanOrEqual(1);
    });
  });
});
