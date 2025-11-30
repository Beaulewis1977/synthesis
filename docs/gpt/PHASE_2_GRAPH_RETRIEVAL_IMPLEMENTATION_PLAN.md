# Phase 2: Graph-Style Retrieval & Context Expansion – Implementation Plan

**Version:** 1.0 · **Created:** November 2025  
**Related Docs:**  
- `docs/RAG_AND_MODEL_SELECTOR_IMPLEMENTATION_PLAN.md` (Phases 9, 13, 13.5)  
- `docs/CONFIGURATION.md` (Code Intelligence, Tech Stack, Performance)  
- `docs/guides/HYBRID_SEARCH_GUIDE.md`  
- `docs/guides/CODE_SEARCH_GUIDE.md`  
- `docs/guides/SYNTHESIS_GUIDE.md`  
- `docs/new-phases/06_PHASE_15_17_STATUS_REPORT.md`

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

For all work in this graph retrieval phase:

- Branches MUST be based on `develop`.
- Branch names MUST be descriptive and include the GPT phase and scope, for example:
  - `feature/gpt-phase2-graph-schema`
  - `feature/gpt-phase2-graph-builder`
  - `feature/gpt-phase2-graph-retrieval`
  - `feature/gpt-phase2-graph-rag-integration`
  - `feature/gpt-phase2-graph-ui-mcp`
- Agents MUST NOT commit or push without explicit human approval.
- Every push MUST be followed by a pull request into `develop`.

### 2.1 Workflow Per Phase

```bash
# 1. Create branch (WAIT FOR APPROVAL)
git checkout develop && git pull origin develop
git checkout -b feature/gpt-phase2-graph-scope

# 2. Implement changes...

# 3. Present changes to human for review

# 4. After APPROVAL: commit
git add -A
git commit -m "feat(phase2-graph): description"

# 5. After APPROVAL: push
git push -u origin feature/gpt-phase2-graph-scope

# 6. Create PR
gh pr create --base develop --title "GPT Phase 2: Graph Retrieval – Scope"
```

Adapt `feature/gpt-phase2-graph-scope` and the PR title per sub‑phase. Also follow `docs/RAG_AND_MODEL_SELECTOR_IMPLEMENTATION_PLAN.md` §2 and `agents.md`.

---

## 3. Phase Overview

| # | Phase | Priority | Days | Branch (suggested) |
|---|-------|----------|------|--------------------|
| 1 | Graph Schema & Storage | P0 | 2–3 | `feature/gpt-phase2-graph-schema` |
| 2 | Graph Builder Pipeline | P0 | 4–6 | `feature/gpt-phase2-graph-builder` |
| 3 | Graph Retrieval Service | P1 | 4–6 | `feature/gpt-phase2-graph-retrieval` |
| 4 | RAG & Synthesis Integration | P1 | 3–4 | `feature/gpt-phase2-graph-rag-integration` |
| 5 | Debug UI & MCP Tools | P2 | 3–5 | `feature/gpt-phase2-graph-ui-mcp` |

---

## 4. Phase 1: Graph Schema & Storage

**Problem:** Relationships are currently implicit (AST metadata, file relationships, DB schema), not stored as a unified graph that can be traversed for retrieval.

### 3.1 Deliverables

- A **graph schema** describing:
  - Node types (with references back to documents/chunks).
  - Edge types (with direction and semantics).
- One or more Postgres tables backing the graph:
  - `knowledge_nodes`
  - `knowledge_edges`

This is intentionally simple and uses Postgres, not a separate graph database.

### 3.2 Node & Edge Types (Conceptual)

**Node types (examples):**

- `doc` – document as ingested (official docs, recipes, README).
- `chunk` – existing chunk, especially code chunks and DB/config chunks.
- `symbol` – function, class, widget, method, constant, route.
- `endpoint` – HTTP or RPC endpoint (derived from backend code).
- `table` / `column` / `index` – from SQL analysis.
- `config_section` – config structures (YAML/JSON/etc.).

Each node should:

- Reference its underlying `documents.id` or `chunks.id` when applicable.
- Carry key metadata:
  - `framework`, `framework_version`, `tech_stack`, `feature_tags`, `source_quality`.
  - `symbol_name`, `symbol_kind`, `file_path`, `line_range`.

**Edge types (examples):**

- `calls` – symbol A calls symbol B.
- `defines` – chunk defines symbol.
- `belongs_to` – method belongs to class, route belongs to service.
- `persists_to` – code path writes to DB table / column.
- `configured_by` – code path controlled by config section.
- `documents` – doc or chunk explaining a symbol or table.

### 3.3 Key Files

| File | Action |
|------|--------|
| `packages/db/migrations/0XY_knowledge_graph.sql` | CREATE `knowledge_nodes` / `knowledge_edges` tables with indexes |
| `packages/db/src/knowledge-graph.ts` | CREATE typed helpers for insert/query (similar to `queries.ts`) |
| `packages/shared/src/index.ts` | ADD TypeScript types `KnowledgeNode`, `KnowledgeEdge`, `KnowledgeNodeType`, `KnowledgeEdgeType` |

### 3.4 Acceptance Criteria

- Schema defined and migration applied locally.
- Node/edge types cover:
  - Code symbols, DB tables, config sections, docs/recipes.
- `knowledge_nodes` / `knowledge_edges` can be queried efficiently by:
  - `collection_id`, `node_type`, `framework`, `symbol_name`, `table_name`.

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
- Given a **query** (e.g., “user signup flow”), graph search starting from top chunks finds related symbols and tables.
- Graph expansion is bounded by `maxDepth` and `maxNodes` and performs acceptably on demo projects.

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

Once this phase is complete, Synthesis will support **graph‑style retrieval** that helps agents see complete flows instead of disjoint snippets, especially valuable for designing and modifying mobile SaaS backends and apps.
