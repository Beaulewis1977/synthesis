# GPT Phase 2 Summary: Graph Retrieval & Context Expansion

**Branch:** `feature/gpt-phase2-graph-retrieval`
**PR Title:** GPT Phase 2: Graph Retrieval & Context Expansion
**Status:** In Progress

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
| 3.4 | RAG & Synthesis Integration | ⏳ Pending | `feat(gpt-phase2): integrate graph expansion with search` |
| 3.5 | Debug UI & MCP Tools | ⏳ Pending | `feat(gpt-phase2): add graph debug UI and MCP tool` |

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

## Sub-Phase 3.4: RAG & Synthesis Integration (Pending)

**Status:** Pending
**Commit:** `feat(gpt-phase2): integrate graph expansion with search`

### Purpose

Integrate graph context into `smartSearch` and the synthesis engine as an optional context expansion step.

### Planned Changes

| File | Changes |
|------|---------|
| `apps/server/src/services/search.ts` | Add optional graph expansion step |
| `apps/server/src/routes/search.ts` | Add `enableGraphExpansion` parameter |
| `apps/server/src/services/synthesis.ts` | Accept graph-derived results as additional sources |

---

## Sub-Phase 3.5: Debug UI & MCP Tools (Pending)

**Status:** Pending
**Commit:** `feat(gpt-phase2): add graph debug UI and MCP tool`

### Purpose

Add visibility into the knowledge graph through a debug UI and MCP tool for agents.

### Planned Files

| File | Purpose |
|------|---------|
| `apps/web/src/pages/GraphDebugPage.tsx` | Per-document graph view |
| `apps/web/src/components/graph/NodeList.tsx` | List component for nodes |
| `apps/web/src/components/graph/EdgeList.tsx` | List component for edges |

### Planned Changes

| File | Changes |
|------|---------|
| `apps/mcp/src/index.ts` | Add `graph_expand_context` tool |

---

## Phase 2 Completion Checklist

- [x] Sub-phase 3.1: Graph Schema & Storage
- [x] Sub-phase 3.2: Graph Builder Pipeline
- [x] Sub-phase 3.3: Graph Retrieval Service
- [ ] Sub-phase 3.4: RAG & Synthesis Integration
- [ ] Sub-phase 3.5: Debug UI & MCP Tools
- [ ] All tests passing
- [ ] Documentation updated
- [ ] PR created and reviewed
- [ ] Merged to develop
