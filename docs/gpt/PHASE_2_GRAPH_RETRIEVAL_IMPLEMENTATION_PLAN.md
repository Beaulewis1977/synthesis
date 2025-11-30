# Phase 2: Graph-Style Retrieval & Context Expansion – Implementation Plan

**Version:** 2.0 · **Created:** November 2025 · **Updated:** November 2025  
**Branch:** `feature/gpt-phase2-graph-retrieval`  
**PR Title:** GPT Phase 2: Graph Retrieval & Context Expansion

---

## Prerequisites

- [ ] None - This phase can be implemented in parallel with Phase 1
- [ ] `develop` branch is up to date
- [ ] All existing tests pass (`pnpm test`)

---

## Related Documentation

- `docs/RAG_AND_MODEL_SELECTOR_IMPLEMENTATION_PLAN.md` (Phases 9, 13, 13.5)  
- `docs/CONFIGURATION.md` (Code Intelligence, Tech Stack)  
- `docs/guides/HYBRID_SEARCH_GUIDE.md`  
- `docs/guides/CODE_SEARCH_GUIDE.md`

---

## 1. Executive Summary

**Goal:** Add a lightweight **knowledge graph** on top of Synthesis so agents can retrieve **end‑to‑end contexts** (e.g., widget → service → endpoint → DB table → config) instead of isolated chunks.

This phase leverages existing work:

- AST‑aware code chunking and symbol metadata (Phase 13).
- Backend schema and config analysis (Phase 13.5).
- File relationship tracking (Phase 10, Phase 15 performance work).
- Hybrid search, MMR, and synthesis (Phases 11–12).

We will:

1. Define a graph schema over existing documents, chunks, and analysis outputs.
2. Build a **graph builder** that populates nodes and edges during ingestion.
3. Implement a **graph retrieval service** that expands from search results.
4. Integrate graph‑aware context into `smartSearch` and the synthesis engine.
5. Expose graph exploration endpoints and (later) MCP tools.

---

## 2. GitHub Workflow

**Single branch for entire phase:** `feature/gpt-phase2-graph-retrieval`

```bash
# 1. Create branch (WAIT FOR APPROVAL)
git checkout develop && git pull origin develop
git checkout -b feature/gpt-phase2-graph-retrieval

# 2. Implement all sub-phases (3.1 through 3.5) in order

# 3. Run tests and lint
pnpm test
pnpm lint

# 4. Present ALL changes for human review

# 5. After APPROVAL: commit
git add -A
git commit -m "feat(gpt-phase2): implement knowledge graph retrieval

- Add knowledge_nodes and knowledge_edges tables
- Create graph-builder service for ingestion
- Create graph-search service for retrieval
- Add /api/graph/context endpoint
- Integrate graph expansion with smartSearch
- Add unit and integration tests"

# 6. After APPROVAL: push
git push -u origin feature/gpt-phase2-graph-retrieval

# 7. Create PR
gh pr create --base develop --title "GPT Phase 2: Graph Retrieval & Context Expansion"
```

Follow rules in `docs/gpt/MASTER_PLAN.md` Section 2 and `agents.md`.

---

## 3. Phase Overview

**All sub-phases go into ONE branch and ONE PR.**

| # | Sub-Phase | Priority | Est. Time | Commit Scope |
|---|-----------|----------|-----------|---------------|
| 3.1 | Graph Schema & Storage | P0 | 2–3 days | `feat(gpt-phase2): add knowledge graph tables and types` |
| 3.2 | Graph Builder Pipeline | P0 | 4–6 days | `feat(gpt-phase2): add graph builder service` |
| 3.3 | Graph Retrieval Service | P1 | 4–6 days | `feat(gpt-phase2): add graph search and traversal` |
| 3.4 | RAG & Synthesis Integration | P1 | 3–4 days | `feat(gpt-phase2): integrate graph expansion with search` |
| 3.5 | Debug UI & MCP Tools | P2 | 3–5 days | `feat(gpt-phase2): add graph debug UI and MCP tool` |

### Commit Strategy

```bash
# Work on single branch
git checkout -b feature/gpt-phase2-graph-retrieval

# Commit after completing each sub-phase:
git commit -m "feat(gpt-phase2): add knowledge graph tables and types"
git commit -m "feat(gpt-phase2): add graph builder service"
git commit -m "feat(gpt-phase2): add graph search and traversal"
git commit -m "feat(gpt-phase2): integrate graph expansion with search"
git commit -m "feat(gpt-phase2): add graph debug UI and MCP tool"

# One PR at the end with all commits
git push -u origin feature/gpt-phase2-graph-retrieval
gh pr create --base develop --title "GPT Phase 2: Graph Retrieval & Context Expansion"
```

---

## 4. Sub-Phase 3.1: Graph Schema & Storage

**Problem:** Relationships are implicit, not stored as a traversable graph.

### 3.1.1 TypeScript Types

**File:** `packages/shared/src/index.ts`

```typescript
// GPT Phase 2: Knowledge Graph Types
export type KnowledgeNodeType = 
  | 'document' | 'chunk' | 'symbol' | 'endpoint' 
  | 'table' | 'column' | 'config_section';

export type KnowledgeEdgeType = 
  | 'calls' | 'defines' | 'belongs_to' | 'persists_to' 
  | 'configured_by' | 'documents' | 'imports' | 'depends_on';

export interface KnowledgeNode {
  id: string;
  collection_id: string;
  node_type: KnowledgeNodeType;
  name: string;
  document_id?: string;
  chunk_id?: number;
  metadata: {
    framework?: string;
    symbol_kind?: string;  // function, class, widget, route, etc.
    file_path?: string;
    line_start?: number;
    line_end?: number;
    [key: string]: unknown;
  };
  created_at: Date;
}

export interface KnowledgeEdge {
  id: string;
  collection_id: string;
  source_node_id: string;
  target_node_id: string;
  edge_type: KnowledgeEdgeType;
  metadata?: Record<string, unknown>;
  created_at: Date;
}
```

### 3.1.2 Database Migration

**File:** `packages/db/migrations/0031_knowledge_graph.sql`

```sql
-- GPT Phase 2: Knowledge Graph Tables

-- Nodes table
CREATE TABLE IF NOT EXISTS knowledge_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  node_type VARCHAR(50) NOT NULL,
  name VARCHAR(500) NOT NULL,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  chunk_id INTEGER REFERENCES chunks(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Edges table
CREATE TABLE IF NOT EXISTS knowledge_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  edge_type VARCHAR(50) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_nodes_collection ON knowledge_nodes(collection_id);
CREATE INDEX idx_nodes_type ON knowledge_nodes(node_type);
CREATE INDEX idx_nodes_name ON knowledge_nodes(name);
CREATE INDEX idx_nodes_document ON knowledge_nodes(document_id) WHERE document_id IS NOT NULL;
CREATE INDEX idx_nodes_chunk ON knowledge_nodes(chunk_id) WHERE chunk_id IS NOT NULL;

CREATE INDEX idx_edges_collection ON knowledge_edges(collection_id);
CREATE INDEX idx_edges_source ON knowledge_edges(source_node_id);
CREATE INDEX idx_edges_target ON knowledge_edges(target_node_id);
CREATE INDEX idx_edges_type ON knowledge_edges(edge_type);

-- Composite index for graph traversal
CREATE INDEX idx_edges_traversal ON knowledge_edges(source_node_id, edge_type);
```

### 3.1.3 Environment Variables

**File:** `.env.example` (add these)

```bash
# GPT Phase 2: Graph Retrieval
ENABLE_GRAPH_BUILDER=true
ENABLE_GRAPH_EXPANSION=true
GRAPH_MAX_DEPTH=3
GRAPH_MAX_NODES=50
```

### 3.1.4 Key Files

| File | Action |
|------|--------|
| `packages/shared/src/index.ts` | ADD `KnowledgeNode`, `KnowledgeEdge` types |
| `packages/db/migrations/0031_knowledge_graph.sql` | CREATE tables |
| `packages/db/src/knowledge-graph.ts` | CREATE query helpers |

### 3.1.5 Acceptance Criteria

- [ ] Migration runs successfully
- [ ] Types compile without errors
- [ ] Tables support efficient lookup by `collection_id`, `node_type`, `name`

### 3.1.6 Agent Execution Guidance

#### Skills to Use
- `superpowers:brainstorming` — Design graph schema and node/edge relationships
- `backend-development` — Database layer implementation
- `planning` — Schema architecture and index strategy
- `superpowers:defense-in-depth` — Validation patterns in query helpers

#### MCP Servers
- `context7` — Lookup graph database patterns, pgvector documentation
- `sequentialthinking` — Design node/edge relationships systematically

#### Subagents (Parallel - 4 agents)
1. `rag-system-architect` — Design KnowledgeNode types (document, chunk, symbol, endpoint, table, column, config_section)
2. `rag-system-architect` — Design KnowledgeEdge types (calls, defines, belongs_to, persists_to, configured_by)
3. `doc-writer` — Draft migration SQL (0031_knowledge_graph.sql) with indexes for traversal
4. `rag-system-architect` — Create query helpers (packages/db/src/knowledge-graph.ts)

#### Subagents (Sequential after parallel)
1. `test-writer` — Database query tests for node/edge CRUD and traversal
2. `code-standards-reviewer` — Review implementation (ALWAYS LAST)

#### Execution Notes
- Types and migration are independent and can be developed in parallel
- Query helpers depend on types being finalized
- Use `superpowers:defense-in-depth` for validation in query helpers (check collection_id, validate node_type)
- Index design is critical: composite index for (source_node_id, edge_type) enables efficient BFS traversal

---

## 5. Phase 2: Graph Builder Pipeline

**Problem:** There is no pipeline that converts existing AST and metadata into graph nodes/edges.

### 4.1 Deliverables

- A **graph builder service** that:
  - Runs during ingestion and re‑chunking.
  - Reads AST analysis results / metadata.
  - Writes nodes and edges to `knowledge_nodes` and `knowledge_edges`.
- Incremental update strategies:
  - Rebuild per document on re‑ingest.
  - Delete old nodes/edges scoped to that document before inserting new ones.

### 4.2 Integration Points

- Code chunkers and analyzers:
  - `apps/server/src/pipeline/code-chunker.ts`
  - `apps/server/src/pipeline/dart-analyzer.ts`
  - `apps/server/src/pipeline/ts-analyzer.ts`
  - `apps/server/src/pipeline/sql-analyzer.ts`
  - `apps/server/src/pipeline/config-analyzer.ts`
- File relationships:
  - `apps/server/src/services/file-relationships.ts`

These already provide enough information to derive:

- `symbol` nodes for functions/classes/widgets.
- `table` / `column` nodes for SQL.
- `config_section` nodes for config.
- Edges like `calls`, `depends_on`, `persists_to`, `configured_by`.

### 4.3 Key Files

| File | Action |
|------|--------|
| `apps/server/src/services/graph-builder.ts` | CREATE service with `buildGraphForDocument(docId: string)` and helpers |
| `apps/server/src/pipeline/orchestrator.ts` | MODIFY to call `buildGraphForDocument` after chunking/embedding |
| `apps/server/src/services/graph-builder.test.ts` | CREATE unit tests for node/edge creation |

### 4.4 Acceptance Criteria

- Ingesting or re‑ingesting a document:
  - Creates or updates corresponding nodes and edges.
- For a non‑trivial project (e.g., the Synthesis repo itself):
  - Graph contains symbols, DB tables, and relationships that match expectations.
- Tests cover:
  - Simple examples (function calling another function).
  - DB write path producing `persists_to` edges.

### 4.5 Agent Execution Guidance

#### Skills to Use
- `backend-development` — Service implementation for graph-builder.ts
- `rag-implementation` — Pipeline integration with existing AST analyzers
- `superpowers:subagent-driven-development` — Parallel task execution with quality gates
- `superpowers:root-cause-tracing` — Debug node/edge extraction issues

#### MCP Servers
- `sequentialthinking` — Design node/edge extraction logic systematically
- `context7` — AST parsing patterns for TypeScript, Dart, SQL

#### Subagents (Parallel - 5 agents MAX)
1. `rag-system-architect` — Design graph-builder.ts service structure and interfaces
2. `rag-system-architect` — Implement AST-to-node extraction (symbol, function, class, widget nodes)
3. `rag-system-architect` — Implement edge creation logic (calls, depends_on, imports relationships)
4. `rag-system-architect` — Implement SQL/config node extraction (table, column, config_section nodes)
5. `rag-system-architect` — Integrate with orchestrator.ts pipeline (call buildGraphForDocument after chunking)

#### Subagents (Sequential after parallel)
1. `test-writer` — Unit tests for graph-builder.ts covering all node/edge types
2. `code-standards-reviewer` — Review before commit (ALWAYS LAST)

#### Execution Notes
- Node extraction logic can be split by type (code vs SQL vs config) for parallel development
- Edge creation depends on nodes existing — ensure node creation runs first
- Integration with orchestrator is the final step after node/edge extraction is tested
- Use incremental updates: delete old nodes/edges for document before inserting new ones
- Leverage existing analyzers: dart-analyzer.ts, ts-analyzer.ts, sql-analyzer.ts, config-analyzer.ts

---

## 6. Phase 3: Graph Retrieval Service

**Problem:** The graph exists, but retrieval is still purely chunk‑based.

### 5.1 Deliverables

- A **graph retrieval API** on the server:
  - `graphSearch` service:
    - Inputs:
      - `collectionId`
      - `seedChunkIds` or `symbolNames` or `query`
      - `maxDepth`, `maxNodes`, optional `edgeTypes`
    - Outputs:
      - Nodes and edges plus associated chunks/documents.
- Routing strategies:
  - From a **query**:
    - Use existing `smartSearch` to get top chunks.
    - Map those chunks → nodes → neighbors.
  - From a **symbol** or **table**:
    - Look up corresponding `symbol`/`table` node.
    - Expand outward via edges.

### 5.2 Key Files

| File | Action |
|------|--------|
| `apps/server/src/services/graph-search.ts` | CREATE `graphSearch` and helpers (BFS/limited depth + filters) |
| `apps/server/src/routes/graph.ts` | CREATE Fastify plugin exposing `/api/graph/context` |

### 5.3 API Sketch

```typescript
// Service
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
  // Optional convenience payload:
  chunks: Array<{ id: number; text: string; metadata: ChunkMetadata }>;
}
```

### 5.4 Acceptance Criteria

- Given a **known widget** or backend handler:
  - `graphSearch` returns connected nodes (service, endpoint, tables, config).
- Given a **query** (e.g., "user signup flow"), graph search starting from top chunks finds related symbols and tables.
- Graph expansion is bounded by `maxDepth` and `maxNodes` and performs acceptably on demo projects.

### 5.5 Agent Execution Guidance

#### Skills to Use
- `backend-development` — Service implementation for graph-search.ts
- `rag-implementation` — Retrieval patterns and BFS traversal algorithms
- `superpowers:root-cause-tracing` — Debug traversal issues when results are unexpected
- `superpowers:condition-based-waiting` — Handle async traversal in tests without race conditions

#### MCP Servers
- `sequentialthinking` — Design traversal algorithms (BFS with depth limiting)
- `context7` — BFS/graph algorithm patterns, performance optimization techniques

#### Subagents (Parallel - 4 agents)
1. `rag-system-architect` — Design graph search interface (GraphSearchParams, GraphContextResult)
2. `rag-system-architect` — Implement BFS traversal with depth limiting and visited set
3. `rag-system-architect` — Implement edge type filtering and node capping (maxNodes)
4. `rag-system-architect` — Create /api/graph/context route (apps/server/src/routes/graph.ts)

#### Subagents (Sequential after parallel)
1. `test-writer` — Integration tests for graph search with various seed types
2. `code-standards-reviewer` — Review implementation (ALWAYS LAST)

#### Execution Notes
- Interface design must complete first to ensure consistent types across components
- BFS and filtering can be developed in parallel after interface is defined
- Route depends on service being complete and tested
- Use `superpowers:condition-based-waiting` for async traversal tests to avoid flaky tests
- Performance: use database-side filtering where possible, avoid fetching all nodes into memory

---

## 7. Phase 4: RAG & Synthesis Integration

**Problem:** Graph retrieval is useful, but agents still consume the classic RAG and synthesis APIs.

### 6.1 Deliverables

- Integrate graph context into:
  - `smartSearch` (Phase 11) as an **optional context expansion step**.
  - Synthesis (`apps/server/src/services/synthesis.ts`) as additional sources.
- Add configuration/env flags:
  - `ENABLE_GRAPH_EXPANSION=true|false`
  - `GRAPH_MAX_DEPTH`, `GRAPH_MAX_NODES`

### 6.2 Integration Strategies

- **Search Integration:**
  - Option A (lightweight): Expose a separate endpoint `/api/search/with-graph`.
  - Option B (deeper): When `includeRelatedFiles` or `enableGraphExpansion` is true:
    - Run `smartSearch` as today.
    - For top‑K chunks, call `graphSearch` to pull additional related chunks.
    - Merge and de‑duplicate results before returning.
- **Synthesis Integration:**
  - When synthesis is enabled:
    - Use base search results + graph neighbors as inputs to `synthesizeResults`.
    - Optionally annotate approaches with **graph coverage** (how many distinct nodes covered).

### 6.3 Key Files

| File | Action |
|------|--------|
| `apps/server/src/services/search.ts` | MODIFY to optionally call `graphSearch` and merge results |
| `apps/server/src/routes/search.ts` | MODIFY request schema to include `enableGraphExpansion` |
| `apps/server/src/services/synthesis.ts` | MODIFY to accept additional graph‑derived results |

### 6.4 Acceptance Criteria

- Feature flagged: disabling graph expansion yields current behavior.
- With graph expansion enabled:
  - Agents get **richer, more coherent clusters** of chunks for complex tasks.
  - No significant regressions on simple question/answer queries.

### 6.5 Agent Execution Guidance

#### Skills to Use
- `rag-implementation` — Integration patterns for search + graph expansion
- `backend-development` — Feature flags and configuration management
- `superpowers:executing-plans` — Systematic integration with existing services

#### MCP Servers
- `context7` — Reference search/synthesis patterns from existing implementation
- `sequentialthinking` — Design integration strategy (Option A vs Option B approach)

#### Subagents (Parallel - 4 agents)
1. `rag-system-architect` — Design graph expansion strategy for smartSearch (when to expand, how to merge)
2. `rag-system-architect` — Implement search.ts graph integration (enableGraphExpansion flag, result merging)
3. `rag-system-architect` — Implement synthesis.ts graph-aware sources (annotate with graph coverage)
4. `doc-writer` — Document .env configuration (ENABLE_GRAPH_BUILDER, GRAPH_MAX_DEPTH, GRAPH_MAX_NODES)

#### Subagents (Sequential after parallel)
1. `test-writer` — Integration tests (graph + search + synthesis combined)
2. `code-standards-reviewer` — Review changes (ALWAYS LAST)

#### Execution Notes
- Feature flags should be added to .env.example first to document configuration
- Search and synthesis integration can be developed in parallel
- Ensure backward compatibility: when graph is disabled, behavior must match existing implementation exactly
- De-duplication is critical: merged results should not contain duplicate chunks
- Consider performance: graph expansion adds latency, so make it opt-in via enableGraphExpansion parameter

---

## 8. Phase 5: Debug UI & MCP Tools

**Problem:** Without visibility into the graph, it’s hard to debug or leverage it effectively via MCP.

### 7.1 Deliverables

- **Debug UI** in the web app:
  - A per‑document “Graph View” showing:
    - Nodes related to the file (symbols, tables, config).
    - Edges between them (calls, persists_to, configured_by).
  - A per‑collection “Graph Stats” view:
    - Node/edge counts by type.
    - Simple indicators of coverage (e.g., % of files with symbol nodes).
- MCP tools (coordinated with Phase 3 plan):
  - `graph_expand_context`:
    - Inputs: `collectionId`, `seed`, `maxDepth`, `maxNodes`.
    - Returns: nodes, edges, and key chunks as JSON.
  - Used by agents to pull “the full context” around a symbol, file, or feature.

### 7.2 Key Files

| File | Action |
|------|--------|
| `apps/web/src/pages/GraphDebugPage.tsx` | CREATE basic graph/debug UI (table/list first, viz optional later) |
| `apps/web/src/components/graph/NodeList.tsx` | CREATE list component for nodes |
| `apps/web/src/components/graph/EdgeList.tsx` | CREATE list component for edges |
| `apps/mcp/src/index.ts` | ADD `graph_expand_context` tool using `/api/graph/context` |

### 7.3 Acceptance Criteria

- Web UI:
  - Can inspect graph around a document or symbol without errors.
- MCP:
  - Agent can call `graph_expand_context` and receive:
    - A structured graph + snippet texts.
  - This tool integrates naturally with new mobile feature recipes and task‑specific tools (Phase 3).

### 7.4 Agent Execution Guidance

#### Skills to Use
- `frontend-development` — Debug UI implementation with React
- `frontend-design` — Visual design for node/edge display
- `superpowers:brainstorming` — UX design for graph exploration interface
- `superpowers:requesting-code-review` — Quality gate before merging

#### MCP Servers
- `chrome-devtools` — UI testing, screenshots, performance analysis of debug views

#### Subagents (Parallel - 5 agents MAX)
1. `frontend-ui-architect` — GraphDebugPage.tsx (main page structure with collection/document selector)
2. `frontend-ui-architect` — NodeList.tsx component (filterable list of nodes by type)
3. `frontend-ui-architect` — EdgeList.tsx component (filterable list of edges by type)
4. `frontend-ui-architect` — Graph stats/coverage indicators (node/edge counts, coverage %)
5. `mcp-server-architect` — graph_expand_context MCP tool with seed types and depth control

#### Subagents (Sequential after parallel)
1. `test-writer` — UI component tests + MCP tool integration tests
2. `code-standards-reviewer` — Final review (ALWAYS LAST)

#### Execution Notes
- All UI components can be developed in parallel (no dependencies between them)
- MCP tool is independent of UI — can be developed in parallel
- Use `chrome-devtools` for visual regression testing and performance profiling
- Start with table/list views before adding graph visualization (optional enhancement)
- Graph visualization library (if added later): consider react-force-graph or d3

Once this phase is complete, Synthesis will support **graph‑style retrieval** that helps agents see complete flows instead of disjoint snippets, especially valuable for designing and modifying mobile SaaS backends and apps.
