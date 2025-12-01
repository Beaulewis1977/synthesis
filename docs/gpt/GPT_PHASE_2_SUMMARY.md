# GPT Phase 2 Summary: Graph Retrieval & Context Expansion

**Branch:** `feature/gpt-phase2-graph-retrieval`
**PR Title:** GPT Phase 2: Graph Retrieval & Context Expansion
**Status:** Complete - Ready for Review

---

## Overview

This phase adds a lightweight **knowledge graph** on top of Synthesis so agents can retrieve **end-to-end contexts** (e.g., widget → service → endpoint → DB table → config) instead of isolated chunks. It leverages existing AST-aware code chunking and symbol metadata from earlier phases.

---

## Sub-Phase Progress

| # | Sub-Phase | Status | Commit |
|---|-----------|--------|--------|
| 3.1 | Graph Schema & Storage | ✅ Complete | `feat(gpt-phase2): add knowledge graph tables and types` |
| 3.2 | Graph Builder Pipeline | ✅ Complete | `feat(gpt-phase2): add graph builder service` |
| 3.3 | Graph Retrieval Service | ✅ Complete | `feat(gpt-phase2): add graph search and traversal` |
| 3.4 | RAG & Synthesis Integration | ✅ Complete | `feat(gpt-phase2): integrate graph expansion with search` |
| 3.5 | Debug UI & MCP Tools | ✅ Complete | `feat(gpt-phase2): add graph debug UI and MCP tool` |

---

## Sub-Phase 3.1: Graph Schema & Storage

**Completed:** December 2025
**Commit:** `feat(gpt-phase2): add knowledge graph tables and types`

### Purpose

Add TypeScript types, database tables, and query helpers to store and retrieve knowledge graph nodes and edges. This provides the foundation for graph-style retrieval.

### Files Created

| File | Purpose |
|------|---------|
| `packages/db/migrations/0024_knowledge_graph.sql` | Creates `knowledge_nodes` and `knowledge_edges` tables with optimized indexes |
| `packages/db/migrations/023_knowledge_edges_updated_at.sql` | Adds `updated_at` column to `knowledge_edges` and backfills existing rows |
| `packages/db/src/knowledge-graph.ts` | Query helpers for node/edge CRUD operations, graph statistics, and traversal |
| `packages/db/src/__tests__/knowledge-graph.test.ts` | 41 unit tests covering all query helper functions |

### Files Modified

| File | Changes |
|------|---------|
| `packages/shared/src/index.ts` | Added `KnowledgeNodeType`, `KnowledgeEdgeType`, `KnowledgeNode`, `KnowledgeEdge` types |
| `packages/db/src/index.ts` | Added export for `knowledge-graph.js` module |
| `.env.example` | Added GPT Phase 2 environment variables |

### New Types

```typescript
// Node types representing entities in the codebase graph
type KnowledgeNodeType =
  | 'document'       // File-level node
  | 'chunk'          // Chunk-level node
  | 'symbol'         // Function, class, widget, method
  | 'endpoint'       // API endpoint/route
  | 'table'          // Database table
  | 'column'         // Database column
  | 'config_section'; // Config file section

// Edge types representing relationships between nodes
type KnowledgeEdgeType =
  | 'calls'          // Function calls another function
  | 'defines'        // File defines a symbol
  | 'belongs_to'     // Chunk belongs to document, column belongs to table
  | 'persists_to'    // Function persists data to table
  | 'configured_by'  // Component configured by config section
  | 'documents'      // Doc chunk documents a symbol
  | 'imports'        // File imports another file
  | 'depends_on';    // Symbol depends on another symbol

// Knowledge graph node
interface KnowledgeNode {
  id: string;
  collection_id: string;
  node_type: KnowledgeNodeType;
  name: string;
  document_id?: string;
  chunk_id?: number;
  metadata: {
    framework?: string;
    symbol_kind?: string;
    file_path?: string;
    line_start?: number;
    line_end?: number;
    [key: string]: unknown;
  };
  created_at: Date;
}

// Knowledge graph edge
interface KnowledgeEdge {
  id: string;
  collection_id: string;
  source_node_id: string;
  target_node_id: string;
  edge_type: KnowledgeEdgeType;
  metadata?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}
```

### Database Migration (0024_knowledge_graph.sql)

```sql
-- Nodes table for entities (symbols, tables, endpoints, configs)
CREATE TABLE knowledge_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  node_type VARCHAR(50) NOT NULL,
  name VARCHAR(500) NOT NULL,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  chunk_id INTEGER REFERENCES chunks(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Edges table for relationships between nodes
CREATE TABLE knowledge_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  edge_type VARCHAR(50) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries and traversal
CREATE INDEX idx_knowledge_nodes_collection ON knowledge_nodes(collection_id);
CREATE INDEX idx_knowledge_nodes_type ON knowledge_nodes(node_type);
CREATE INDEX idx_knowledge_nodes_name ON knowledge_nodes(name);
CREATE INDEX idx_knowledge_edges_traversal ON knowledge_edges(source_node_id, edge_type);
CREATE INDEX idx_knowledge_edges_reverse_traversal ON knowledge_edges(target_node_id, edge_type);
CREATE UNIQUE INDEX idx_knowledge_edges_unique ON knowledge_edges(collection_id, source_node_id, target_node_id, edge_type);
```

#### Follow-up Migration (023_knowledge_edges_updated_at.sql)

```sql
ALTER TABLE knowledge_edges
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE knowledge_edges
SET updated_at = NOW()
WHERE updated_at IS NULL;
```

### Query Helper Functions (knowledge-graph.ts)

| Function | Signature | Description |
|----------|-----------|-------------|
| `createNode` | `(node, client?) => Promise<KnowledgeNodeRow>` | Create a single node |
| `createNodesBatch` | `(nodes[], client?) => Promise<KnowledgeNodeRow[]>` | Batch insert nodes |
| `getNodeById` | `(id) => Promise<KnowledgeNodeRow \| null>` | Get node by ID |
| `getNodesByCollection` | `(collectionId, nodeType?) => Promise<KnowledgeNodeRow[]>` | Get nodes in collection |
| `getNodeByName` | `(collectionId, name, nodeType?) => Promise<KnowledgeNodeRow \| null>` | Find node by name |
| `getNodesByDocument` | `(documentId) => Promise<KnowledgeNodeRow[]>` | Get nodes linked to document |
| `getNodesByChunk` | `(chunkId) => Promise<KnowledgeNodeRow[]>` | Get nodes linked to chunk |
| `deleteNode` | `(id, client?) => Promise<void>` | Delete node (cascades edges) |
| `deleteNodesByDocument` | `(documentId, client?) => Promise<number>` | Delete nodes by document |
| `deleteNodesByCollection` | `(collectionId, client?) => Promise<number>` | Delete all nodes in collection |
| `createEdge` | `(edge, client?) => Promise<KnowledgeEdgeRow>` | Create edge with upsert (preserves `created_at`, updates `updated_at` on conflict) |
| `createEdgesBatch` | `(edges[], client?) => Promise<KnowledgeEdgeRow[]>` | Batch insert edges |
| `getEdgeById` | `(id) => Promise<KnowledgeEdgeRow \| null>` | Get edge by ID |
| `getOutgoingEdges` | `(nodeId, edgeType?) => Promise<KnowledgeEdgeRow[]>` | Get outgoing edges |
| `getIncomingEdges` | `(nodeId, edgeType?) => Promise<KnowledgeEdgeRow[]>` | Get incoming edges |
| `getEdgesByCollection` | `(collectionId, edgeType?) => Promise<KnowledgeEdgeRow[]>` | Get edges in collection |
| `deleteEdge` | `(id, client?) => Promise<void>` | Delete edge by ID |
| `deleteEdgesByNode` | `(nodeId, client?) => Promise<number>` | Delete all edges for node |
| `deleteEdgesByCollection` | `(collectionId, client?) => Promise<number>` | Delete all edges in collection |
| `getGraphStats` | `(collectionId) => Promise<GraphStats>` | Get graph statistics |
| `getNodeNeighbors` | `(nodeId, edgeTypes?) => Promise<{outgoing, incoming}>` | Get neighbor nodes |
| `findOrCreateNode` | `(node, client?) => Promise<KnowledgeNodeRow>` | Find existing or create new |

### Environment Variables

```bash
# GPT Phase 2: Knowledge Graph
ENABLE_GRAPH_BUILDER=false    # Enable graph building during ingestion
ENABLE_GRAPH_EXPANSION=false  # Enable graph expansion during search
GRAPH_MAX_DEPTH=3             # Maximum traversal depth
GRAPH_MAX_NODES=50            # Maximum nodes to return
```

### Test Results

- ✅ 41 knowledge-graph query helper tests pass
- ✅ TypeScript compiles without errors (`pnpm typecheck`)
- ✅ No breaking changes to existing APIs

### Acceptance Criteria

- [x] Migration runs successfully
- [x] Types compile without errors
- [x] Tables support efficient lookup by `collection_id`, `node_type`, `name`
- [x] Edges have unique constraint preventing duplicates
- [x] Query helpers handle all CRUD operations
- [x] Unit tests pass with good coverage (41 tests)
- [x] No breaking changes to existing APIs

---

## Sub-Phase 3.2: Graph Builder Pipeline

**Completed:** November 2025
**Commit:** `feat(gpt-phase2): add graph builder service`

### Purpose

Create a graph builder service that populates nodes and edges during document ingestion by reading AST analysis results and chunk metadata.

### Files Created

| File | Purpose |
|------|---------|
| `apps/server/src/services/graph-builder.ts` | Main service with `buildGraphForDocument()` and `buildGraphForCollection()` functions |
| `apps/server/src/services/__tests__/graph-builder.test.ts` | 27 unit tests covering node/edge extraction and error handling |

### Files Modified

| File | Changes |
|------|---------|
| `apps/server/src/pipeline/orchestrator.ts` | Added graph builder call after `storeChunks()` (feature flagged) |

### Key Functions

```typescript
// Main entry point - builds graph for a single document
export async function buildGraphForDocument(
  db: Pool,
  documentId: string,
  options?: GraphBuilderOptions
): Promise<GraphBuilderResult>;

// Bulk operation - builds graph for all documents in a collection
export async function buildGraphForCollection(
  db: Pool,
  collectionId: string,
  options?: GraphBuilderOptions
): Promise<CollectionGraphResult>;

// Check if graph builder is enabled
export function isGraphBuilderEnabled(): boolean;
```

### Interfaces

```typescript
interface GraphBuilderOptions {
  skipDefinesEdges?: boolean;      // Skip document -> symbol edges
  skipImportsEdges?: boolean;      // Skip document -> document edges
  skipBelongsToEdges?: boolean;    // Skip method -> class, column -> table edges
  skipDependsOnEdges?: boolean;    // Skip extends/implements edges
}

interface GraphBuilderResult {
  nodesCreated: number;
  edgesCreated: number;
  durationMs: number;
  warnings: string[];
}
```

### Node Extraction

| Chunk Metadata | Node Type | Symbol Kind |
|----------------|-----------|-------------|
| `function_name` (no class_context) | `symbol` | `function` |
| `class_name` | `symbol` | `class` |
| `class_name` + `is_widget=true` | `symbol` | `widget` |
| `function_name` + `class_context` | `symbol` | `method` |
| `constant_name` | `symbol` | `constant` |
| `sql_type='table'` + `table` | `table` | - |
| `columns[]` in table chunk | `column` | - |
| `config_section` | `config_section` | - |
| Route patterns in text (Express/Fastify/NestJS) | `endpoint` | - |

### Edge Extraction

| Edge Type | Source | Target | Detection Method |
|-----------|--------|--------|------------------|
| `defines` | document | symbol | All symbols from document |
| `belongs_to` | method | class | `class_context` in chunk metadata |
| `belongs_to` | column | table | `table` in column metadata |
| `imports` | document | document | `file_imports` in document metadata |
| `depends_on` | class | class | `extends`/`implements`/`mixins` in metadata |
| `persists_to` | function | table | SQL patterns (INSERT/UPDATE/SELECT/DELETE) |
| `configured_by` | symbol | config | `maps_to` in config metadata + env var detection |

### Integration with Orchestrator

```typescript
// In apps/server/src/pipeline/orchestrator.ts (after storeChunks)
if (process.env.ENABLE_GRAPH_BUILDER === 'true') {
  try {
    const graphResult = await buildGraphForDocument(db, documentId);
    console.info(
      `[Ingest] Built knowledge graph: ${graphResult.nodesCreated} nodes, ` +
      `${graphResult.edgesCreated} edges (${graphResult.durationMs}ms)`
    );
  } catch (graphError) {
    // Non-blocking: log error but don't fail ingestion
    console.error(`[Ingest] Graph building failed:`, graphError);
  }
}
```

### Key Implementation Details

- **Idempotent**: Deletes existing nodes for document before rebuilding (via `deleteNodesByDocument`)
- **Transactional**: Uses PostgreSQL transaction (BEGIN/COMMIT/ROLLBACK) for atomicity
- **Non-blocking**: Logs errors but doesn't fail document ingestion pipeline
- **Feature flagged**: Controlled by `ENABLE_GRAPH_BUILDER` environment variable
- **Batch operations**: Uses `createNodesBatch` and `createEdgesBatch` for efficiency
- **Null-safe**: Guards against null/undefined chunk metadata

### Test Results

- ✅ 27 unit tests pass
- ✅ TypeScript compiles without errors
- ✅ Integration with orchestrator verified
- ✅ Error handling tested (null metadata, database errors, missing documents)

### Acceptance Criteria

- [x] Ingesting a document creates nodes for symbols, tables, configs
- [x] Re-ingesting updates graph (idempotent via delete + create)
- [x] Graph contains expected relationships (defines, belongs_to, imports, depends_on)
- [x] Feature flagged via `ENABLE_GRAPH_BUILDER`
- [x] Non-blocking: ingestion succeeds even if graph building fails
- [x] Unit tests pass with good coverage (27 tests)
- [x] TypeScript compiles without errors

---

## Sub-Phase 3.3: Graph Retrieval Service

**Completed:** November 2025
**Commit:** `feat(gpt-phase2): add graph search and traversal`

### Purpose

Create a graph retrieval API that expands from search results to connected nodes using BFS traversal, enabling agents to retrieve end-to-end context (widget → service → endpoint → DB table → config).

### Files Created

| File | Purpose |
|------|---------|
| `apps/server/src/services/graph-search.ts` | `graphSearch` service with BFS traversal, depth limiting, and node capping |
| `apps/server/src/routes/graph.ts` | `/api/graph/context` and `/api/graph/stats/:collectionId` endpoints |
| `apps/server/src/services/__tests__/graph-search.test.ts` | 29 unit tests covering BFS traversal, filtering, and edge cases |
| `apps/server/src/routes/__tests__/graph.test.ts` | 18 route tests covering all endpoints and error handling |

### Files Modified

| File | Changes |
|------|---------|
| `packages/shared/src/index.ts` | Added `GraphSearchParams` and `GraphContextResult` types |
| `apps/server/src/index.ts` | Registered `graphRoutes` |

### Key Functions

```typescript
// Main entry point - BFS traversal from seed nodes
export async function graphSearch(
  db: Pool,
  params: GraphSearchParams
): Promise<GraphContextResult>;

// Check if graph expansion is enabled
export function isGraphExpansionEnabled(): boolean;
```

### Interfaces

```typescript
interface GraphSearchParams {
  collectionId: string;
  seedChunkIds?: number[];      // Start from chunks
  seedNodeIds?: string[];        // Start from nodes
  query?: string;                // Find nodes via smartSearch first
  maxDepth?: number;             // Default: 3 (from GRAPH_MAX_DEPTH)
  maxNodes?: number;             // Default: 50 (from GRAPH_MAX_NODES)
  edgeTypes?: KnowledgeEdgeType[]; // Filter by edge type
  nodeTypes?: KnowledgeNodeType[]; // Filter by node type
}

interface GraphContextResult {
  nodes: KnowledgeNodeRow[];
  edges: KnowledgeEdgeRow[];
  chunks: Array<{ id: number; text: string; metadata: Record<string, unknown> }>;
  stats: {
    nodesVisited: number;
    edgesTraversed: number;
    depthReached: number;
    durationMs: number;
  };
}
```

### API Endpoints

**POST /api/graph/context** - Get graph context from seeds
```json
{
  "collection_id": "uuid",
  "seed_chunk_ids": [1, 2, 3],
  "seed_node_ids": ["uuid1", "uuid2"],
  "query": "optional search query",
  "max_depth": 3,
  "max_nodes": 50,
  "edge_types": ["calls", "defines"],
  "node_types": ["symbol", "table"]
}
```

Response:
```json
{
  "nodes": [...],
  "edges": [...],
  "chunks": [...],
  "stats": {
    "nodesVisited": 15,
    "edgesTraversed": 20,
    "depthReached": 2,
    "durationMs": 45
  },
  "graph_expansion_enabled": true
}
```

**GET /api/graph/stats/:collectionId** - Get graph statistics
```json
{
  "collection_id": "uuid",
  "total_nodes": 100,
  "total_edges": 150,
  "nodes_by_type": { "symbol": 80, "table": 20 },
  "edges_by_type": { "calls": 50, "defines": 100 }
}
```

### BFS Traversal Algorithm

1. **Seed Resolution**: Resolve seed nodes from chunk IDs, node IDs, or query (via smartSearch)
2. **BFS with Limits**: Traverse graph with visited set, respecting `maxDepth` and `maxNodes`
3. **Edge Collection**: Collect edges where both endpoints are in visited set
4. **Chunk Retrieval**: Batch fetch chunk text for nodes with `chunk_id`

### Key Implementation Details

- **Three seeding methods**: Chunk IDs, node IDs, or natural language query
- **BFS with visited set**: Prevents infinite loops on cyclic graphs
- **Depth and node limits**: Configurable via params or environment variables
- **Edge/node type filtering**: Optional filtering during traversal
- **Chunk deduplication**: Unique chunk IDs before database query
- **Feature flagged**: Controlled by `ENABLE_GRAPH_EXPANSION` environment variable
- **Performance tracking**: Returns timing statistics in response

### Test Results

- ✅ 29 graph-search service tests pass
- ✅ 18 graph route tests pass
- ✅ TypeScript compiles without errors
- ✅ All 47 new tests pass

### Acceptance Criteria

- [x] Given a known widget, graphSearch returns connected nodes (service, endpoint, tables, config)
- [x] Given a query, graph search starting from top chunks finds related symbols and tables
- [x] Graph expansion bounded by maxDepth and maxNodes
- [x] BFS handles cycles via visited set
- [x] Supports filtering by edge types and node types
- [x] Feature flagged via `ENABLE_GRAPH_EXPANSION`
- [x] Unit tests pass with good coverage (47 tests)
- [x] TypeScript compiles without errors

---

## Sub-Phase 3.4: RAG & Synthesis Integration

**Completed:** November 2025
**Commit:** `feat(gpt-phase2): integrate graph expansion with search`

### Purpose

Integrate graph context into `smartSearch` and the synthesis engine as an optional context expansion step, enabling agents to retrieve richer, more coherent clusters of chunks via knowledge graph traversal.

### Files Modified

| File | Changes |
|------|---------|
| `apps/server/src/services/search.ts` | Added `expandWithGraph`, `graphMaxDepth`, `graphMaxNodes` params; implemented `expandWithGraphContext()` helper; integrated into all 3 search code paths |
| `apps/server/src/routes/search.ts` | Added `expand_with_graph`/`expandWithGraph`, `graph_max_depth`/`graphMaxDepth`, `graph_max_nodes`/`graphMaxNodes` params to schema and route handler |
| `apps/server/src/services/synthesis.ts` | Added `GraphCoverage` interface and `computeGraphCoverage()` function; tracks graph coverage in `SynthesisResponse.metadata` |
| `apps/server/src/services/cache/search-cache.ts` | Added graph expansion params to cache key |
| `.env.example` | Enhanced documentation for graph expansion variables |

### Files Created

| File | Purpose |
|------|---------|
| `apps/server/src/services/__tests__/search-graph-integration.test.ts` | 28 integration tests for graph expansion feature |

### New Interfaces

```typescript
// Graph expansion info exposed in API response
interface GraphExpansionInfo {
  enabled: boolean;
  nodesVisited: number;
  edgesTraversed: number;
  depthReached: number;
  expansionTimeMs: number;
  chunksAdded: number;
}

// Graph coverage for synthesis tracking
interface GraphCoverage {
  nodesRepresented: number;
  graphDerivedSources: number;
  graphExpansionUsed: boolean;
}
```

### New SmartSearchParams

```typescript
interface SmartSearchParams extends SearchParams {
  // ... existing params ...
  /** Enable graph expansion (default: env ENABLE_GRAPH_EXPANSION) */
  expandWithGraph?: boolean;
  /** Max graph traversal depth (default: env GRAPH_MAX_DEPTH or 3) */
  graphMaxDepth?: number;
  /** Max nodes to visit (default: env GRAPH_MAX_NODES or 50) */
  graphMaxNodes?: number;
}
```

### API Changes

**POST /api/search** - New parameters:
```json
{
  "expand_with_graph": true,
  "graph_max_depth": 3,
  "graph_max_nodes": 50
}
```

Response metadata includes:
```json
{
  "metadata": {
    "graph_expansion": {
      "enabled": true,
      "nodes_visited": 8,
      "edges_traversed": 5,
      "depth_reached": 2,
      "expansion_time_ms": 45,
      "chunks_added": 3
    }
  }
}
```

### Integration Flow

```
POST /api/search (with expandWithGraph=true)
    │
    └─ smartSearch()
        ├─ Intent Detection
        ├─ Search (Vector/Hybrid)
        ├─ Reranking
        ├─ Trust Scoring
        ├─ MMR Diversification
        ├─ Related Files
        │
        └─ [NEW] Graph Expansion
            ├─ Extract seed chunk IDs (max 10)
            ├─ Call graphSearch() for connected nodes
            ├─ Convert graph chunks to SmartSearchResult
            ├─ Deduplicate (original takes precedence)
            └─ Merge results + return stats
```

### Key Implementation Details

- **Feature flagged**: Controlled by `ENABLE_GRAPH_EXPANSION` env var, can be overridden per-request
- **Graceful degradation**: Graph errors don't fail search; original results returned
- **Deduplication**: Original results take precedence over graph-derived chunks
- **Seed limiting**: Max 10 seed chunks to avoid excessive expansion
- **Graph context tracking**: Graph-derived results have `graphContext` field with node/edge counts

### Test Results

- ✅ TypeScript compiles without errors
- ✅ All 28 graph integration tests pass (`search-graph-integration.test.ts`)
- ✅ All 27 integration tests pass (`integration.test.ts`)
- ✅ 1072 tests passing (36 pre-existing failures unrelated to graph expansion)

### Test Fix Details

The integration tests required additional mock setup to work correctly with the graph expansion feature:

**Changes to `search-graph-integration.test.ts`:**
- Added `vi.resetModules()` in `beforeEach` for fresh module imports
- Added mocks for `query-intent.js` and `mmr.js` dependencies
- Fixed unused variable warning by using `hasGraphDerivedResults`

**Changes to `integration.test.ts`:**
- Added `vi.resetModules()` in both `beforeEach` blocks
- Added mocks for `query-intent.js`, `mmr.js`, and `graph-search.js`

**Pre-existing Failures (Unrelated to Phase 2.4):**
- `integration-backend.test.ts` - Backend parsing integration tests
- `integration-code.test.ts` - Code chunking integration tests
- `embedding-profile-service.test.ts` - Profile update tests

These failures existed before the graph expansion changes and are tracked separately.

### Acceptance Criteria

- [x] Feature flagged: disabling graph expansion yields current behavior
- [x] With graph expansion enabled, results include graph-derived chunks
- [x] Synthesis tracks graph coverage in metadata
- [x] No regressions on existing search functionality
- [x] TypeScript compiles without errors
- [x] Environment variables documented

---

## Sub-Phase 3.5: Debug UI & MCP Tools

**Completed:** December 2025
**Commit:** `feat(gpt-phase2): add graph debug UI and MCP tool`

### Purpose

Add visibility into the knowledge graph through a debug UI and MCP tool for agents. Enables developers to inspect nodes, edges, and graph statistics, and allows agents to expand search context using graph traversal.

### Files Created

| File | Purpose |
|------|---------|
| `apps/web/src/pages/GraphDebugPage.tsx` | Main debug page with Stats, Visualization, Nodes, Edges tabs |
| `apps/web/src/components/graph/NodeList.tsx` | Searchable/filterable node list with type chips |
| `apps/web/src/components/graph/EdgeList.tsx` | Filterable edge list with source→type→target display |
| `apps/web/src/components/graph/GraphVisualization.tsx` | Interactive force-directed graph using react-force-graph-2d |
| `apps/web/src/components/graph/types.ts` | Re-exports types from @synthesis/shared |
| `apps/web/src/components/graph/index.ts` | Barrel exports for components and types |
| `apps/web/src/components/graph/__tests__/NodeList.test.tsx` | 27 unit tests for NodeList component |
| `apps/web/src/components/graph/__tests__/EdgeList.test.tsx` | 25 unit tests for EdgeList component |
| `apps/mcp/src/__tests__/graph-tools.test.ts` | Schema validation tests for MCP graph tool |

### Files Modified

| File | Changes |
|------|---------|
| `apps/web/src/App.tsx` | Added `/graph` route with lazy-loaded GraphDebugPage |
| `apps/web/src/components/Layout.tsx` | Added "Graph" nav link |
| `apps/web/src/lib/api.ts` | Added `getGraphStats()` and `getGraphContext()` methods |
| `apps/web/src/types/index.ts` | Added `GraphStatsResponse`, `GraphContextRequest`, `GraphContextResponse` types |
| `apps/mcp/src/index.ts` | Added `graph_expand_context` MCP tool (tool count now 14) |
| `apps/web/src/pages/CollectionView.tsx` | Added `GraphCoverageCard` component with node/edge stats and coverage indicator |

### Features

**1. Stats Tab**
- Total node and edge counts
- Breakdown by type with colored badges
- Empty state when no graph data

**2. Visualization Tab**
- Interactive force-directed graph using react-force-graph-2d
- Node colors by type (symbol=purple, table=orange, endpoint=green, etc.)
- Click-to-select nodes with details panel
- Zoom/pan controls with legend

**3. Nodes Tab**
- Case-insensitive search by name
- Type filter chips (only shows types present in data)
- Click-to-select with highlight state
- Count of filtered/total nodes

**4. Edges Tab**
- Filter chips by edge type
- Source→Type→Target display with arrows
- Click-to-select with details panel
- Count of filtered/total edges

**5. MCP Tool: `graph_expand_context`**
Enables agents to expand search context via graph traversal:
```json
{
  "name": "graph_expand_context",
  "description": "Expand search context using knowledge graph traversal",
  "input": {
    "collection_id": "uuid",
    "seed_chunk_ids": [1, 2, 3],
    "seed_node_ids": ["uuid1"],
    "query": "optional search",
    "max_depth": 3,
    "max_nodes": 50,
    "edge_types": ["calls", "defines"],
    "node_types": ["symbol", "table"]
  }
}
```

**6. Graph Coverage Card (CollectionView)**
Per-collection graph statistics displayed alongside MMR Defaults on the Collection Documents page:
- Total node and edge counts (large bold numbers)
- Node type badges with colors matching GraphDebugPage (symbol=purple, endpoint=green, table=orange, config=pink)
- Coverage progress bar showing "X of Y documents indexed" with percentage
- Color-coded progress: green (80%+), yellow (50-79%), accent (1-49%)
- "View Graph" link to navigate to `/graph` page
- Empty state with prompt to build graph when no data exists

```
┌─ Knowledge Graph Coverage ─────────────────────── View Graph ─┐
│                                                               │
│  977 nodes    850 edges                                       │
│                                                               │
│  Node Types:                                                  │
│  ● symbol (848)  ● endpoint (10)                              │
│                                                               │
│  Coverage: 119 of 151 documents indexed                  79%  │
│  ████████████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░  │
└───────────────────────────────────────────────────────────────┘
```

### Technical Details

- **Types**: Uses `@synthesis/shared` types for `KnowledgeNode` and `KnowledgeEdge`
- **Data fetching**: React Query with loading/error states
- **State management**: URL-driven state for collection selection and active tab
- **Accessibility**: ARIA attributes, keyboard navigation, focus states
- **Styling**: Tailwind CSS with custom design tokens (text-text-primary, bg-bg-primary, etc.)
- **Visualization**: react-force-graph-2d with custom node rendering and labels

### API Methods

```typescript
// Get graph statistics for a collection
async getGraphStats(collectionId: string): Promise<GraphStatsResponse>

// Get graph context from seeds
async getGraphContext(params: GraphContextRequest): Promise<GraphContextResponse>
```

### Test Results

- ✅ 52 graph component tests pass (27 NodeList + 25 EdgeList)
- ✅ 59 MCP graph tools schema tests pass
- ✅ TypeScript compiles without errors

### MCP Test Configuration

Added test infrastructure to `apps/mcp/package.json`:
- Added `vitest` as devDependency
- Added `test` and `test:watch` scripts
- **116 total MCP tests** now run with `pnpm --filter @synthesis/mcp test`
  - 57 mobile tools tests (Phase 1)
  - 59 graph tools tests (Phase 2)

### MCP SDK 1.19.x Compatibility Fix

Updated tool registration for MCP SDK 1.19.x API change:
- SDK now expects Zod shape objects, not JSON schemas
- Created `toInputShape()` helper to extract `.shape` from `z.object()` schemas
- Updated all 13 tool registrations to use `inputSchema: toInputShape(schema)`
- Separated `graph_expand_context` base schema from `.refine()` validation
- All tools verified working: `search_rag`, `search_mobile_docs`, `graph_expand_context`, etc.

### Acceptance Criteria

- [x] Graph debug page accessible at `/graph` route
- [x] Stats tab shows node/edge counts and type breakdowns
- [x] Visualization tab renders interactive force-directed graph
- [x] Nodes tab is searchable and filterable by type
- [x] Edges tab is filterable with source→type→target display
- [x] MCP tool `graph_expand_context` added with full schema
- [x] MCP tools compatible with SDK 1.19.x (all 13 tools verified working)
- [x] Graph coverage card on CollectionView shows node/edge stats and coverage %
- [x] 52 unit tests pass
- [x] TypeScript compiles without errors
- [x] Accessible with keyboard navigation

---

## Phase 2 Completion Checklist

- [x] Sub-phase 3.1: Graph Schema & Storage
- [x] Sub-phase 3.2: Graph Builder Pipeline
- [x] Sub-phase 3.3: Graph Retrieval Service
- [x] Sub-phase 3.4: RAG & Synthesis Integration
- [x] Sub-phase 3.5: Debug UI & MCP Tools
- [x] All new tests passing (52 graph UI + 59 MCP schema = 111 tests)
- [x] MCP test infrastructure configured
- [x] Documentation updated
- [ ] PR created and reviewed
- [ ] Merged to develop
