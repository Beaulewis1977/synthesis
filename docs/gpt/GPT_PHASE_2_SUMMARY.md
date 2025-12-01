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
| 3.2 | Graph Builder Pipeline | ⏳ Pending | `feat(gpt-phase2): add graph builder service` |
| 3.3 | Graph Retrieval Service | ⏳ Pending | `feat(gpt-phase2): add graph search and traversal` |
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

## Sub-Phase 3.2: Graph Builder Pipeline (Pending)

**Status:** Pending
**Commit:** `feat(gpt-phase2): add graph builder service`

### Purpose

Create a graph builder service that populates nodes and edges during document ingestion by reading AST analysis results and metadata.

### Planned Files

| File | Purpose |
|------|---------|
| `apps/server/src/services/graph-builder.ts` | Service with `buildGraphForDocument(docId)` function |
| `apps/server/src/services/__tests__/graph-builder.test.ts` | Unit tests for node/edge extraction |

### Planned Changes

| File | Changes |
|------|---------|
| `apps/server/src/pipeline/orchestrator.ts` | Call `buildGraphForDocument` after chunking/embedding |

### Integration Points

- Code chunkers: `code-chunker.ts`
- Analyzers: `dart-analyzer.ts`, `ts-analyzer.ts`, `sql-analyzer.ts`, `config-analyzer.ts`
- File relationships: `file-relationships.ts`

---

## Sub-Phase 3.3: Graph Retrieval Service (Pending)

**Status:** Pending
**Commit:** `feat(gpt-phase2): add graph search and traversal`

### Purpose

Create a graph retrieval API that expands from search results to connected nodes using BFS traversal.

### Planned Files

| File | Purpose |
|------|---------|
| `apps/server/src/services/graph-search.ts` | `graphSearch` service with BFS traversal |
| `apps/server/src/routes/graph.ts` | `/api/graph/context` endpoint |

### API Design

```typescript
interface GraphSearchParams {
  collectionId: string;
  seedChunkIds?: number[];
  seedNodeIds?: string[];
  query?: string;
  maxDepth?: number;
  maxNodes?: number;
  edgeTypes?: string[];
}

interface GraphContextResult {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  chunks: Array<{ id: number; text: string; metadata: ChunkMetadata }>;
}
```

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
- [ ] Sub-phase 3.2: Graph Builder Pipeline
- [ ] Sub-phase 3.3: Graph Retrieval Service
- [ ] Sub-phase 3.4: RAG & Synthesis Integration
- [ ] Sub-phase 3.5: Debug UI & MCP Tools
- [ ] All tests passing
- [ ] Documentation updated
- [ ] PR created and reviewed
- [ ] Merged to develop
