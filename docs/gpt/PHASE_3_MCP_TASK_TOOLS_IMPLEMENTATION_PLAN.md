# Phase 3: Task-Specific MCP Tools for Development – Implementation Plan

**Version:** 1.0 · **Created:** November 2025  
**Related Docs:**  
- `docs/agent-sdk/00_AGENT_SDK_OVERVIEW.md`  
- `docs/agent-sdk/01_AGENT_SDK_ARCHITECTURE_IMPACT.md`  
- `docs/agent-sdk/02_AGENT_SDK_BUILD_PLAN.md`  
- `docs/RAG_AND_MODEL_SELECTOR_IMPLEMENTATION_PLAN.md` (Agent + tools sections)  
- `docs/guides/CODE_SEARCH_GUIDE.md`  
- `docs/guides/HYBRID_SEARCH_GUIDE.md`  
- `docs/guides/SYNTHESIS_GUIDE.md`  
- `docs/gpt/PHASE_1_MOBILE_RECIPES_IMPLEMENTATION_PLAN.md`  
- `docs/gpt/PHASE_2_GRAPH_RETRIEVAL_IMPLEMENTATION_PLAN.md`

---

## 1. Executive Summary

**Goal:** Provide a set of **task‑oriented MCP tools** tuned for code‑generation agents building and maintaining mobile SaaS apps, using Synthesis as the RAG backend.

Instead of generic “search” and “list documents”, tools should match how an agent thinks:

- “Find official docs for X”  
- “Show me code examples for Y (Flutter + Supabase)”  
- “What’s the tech stack and DB schema for this project?”  
- “Expand the context around this widget/service/table.”  
- “Give me your recommended recipe for this feature.”

This phase builds on:

- MCP server: `apps/mcp/src/index.ts`.
- Agent tool patterns from `docs/agent-sdk`.
- Mobile recipes (Phase 1) and graph retrieval (Phase 2).

---

## 2. Phase Overview

| # | Phase | Priority | Days | Branch (suggested) |
|---|-------|----------|------|--------------------|
| 1 | Task Taxonomy & Tool Design | P0 | 2–3 | `feature/gpt-phase3-mcp-design` |
| 2 | HTTP API Enhancements | P0 | 3–5 | `feature/gpt-phase3-api-layer` |
| 3 | MCP Tool Implementation | P1 | 4–6 | `feature/gpt-phase3-mcp-tools` |
| 4 | Agent Prompt & Config Updates | P1 | 2–3 | `feature/gpt-phase3-agent-prompts` |
| 5 | Scenario-Based Evaluation | P2 | 2–3 | `feature/gpt-phase3-mcp-eval` |

Use the Git workflow rules in `docs/RAG_AND_MODEL_SELECTOR_IMPLEMENTATION_PLAN.md` §2.

---

## 3. Phase 1: Task Taxonomy & Tool Design

**Problem:** Existing tools (`search_rag`, `list_collections`, `fetch_and_add_document_from_url`, etc.) are low‑level and not aligned with mobile SaaS development tasks.

### 3.1 Deliverables

- A **task taxonomy** describing key workflows:
  - Feature design: “What’s the recommended pattern for auth/billing/notifications?”
  - Implementation: “Show examples of X in Flutter using Y backend.”
  - Integration: “How does this project handle auth/routing/state management?”
  - Maintenance: “Where do we persist user settings?”, “Where is billing implemented?”
- Tool specifications (name, description, input schema, output schema) for:
  - **Docs & recipes:**
    - `search_mobile_docs`
    - `search_official_docs`
    - `get_feature_recipe`
  - **Examples & code:**
    - `find_code_examples`
    - `find_symbol_usages`
  - **Project introspection:**
    - `get_project_tech_stack`
    - `get_db_schema`
    - `graph_expand_context`

These will be described in a machine‑readable way (Zod schema → JSON Schema) similar to existing tools.

### 3.2 Specification Location

| File | Action |
|------|--------|
| `docs/mcp/MCP_TOOL_SPEC_GPT_PHASE3.md` | CREATE a spec doc listing each new tool and mappings to API endpoints |

The spec doc should reference:

- Underlying HTTP APIs (existing or planned).
- Relevant metadata fields (framework, feature_tags, platform).
- Which collections to search (recipes, official docs, example repos).

### 3.3 Acceptance Criteria

- Taxonomy covers:
  - At least auth, onboarding, billing, notifications, offline, navigation, state management.
- For each tool:
  - Clear `description` and input/output fields.
  - Mapped to existing or planned HTTP endpoints.

---

## 4. Phase 2: HTTP API Enhancements

**Problem:** Some of the desired tools need higher‑level HTTP endpoints than the current set (`/api/search`, `/api/synthesis/compare`, `/api/collections`, etc.).

### 4.1 Deliverables

- New or extended HTTP endpoints that encapsulate **best‑practice retrieval patterns**:

Examples (sketch):

- `POST /api/search/mobile`  
  - Input: `framework`, `framework_version?`, `feature_tags`, `usage_tier_preference`, `query?`.  
  - Behavior: Wraps `smartSearch` with filters and boosts as defined in Phase 1.

- `POST /api/search/examples`  
  - Input: `framework`, `feature`, `language?`, `tech_stack?`.  
  - Behavior: Filters to `usage_tier='example'` and code chunks.

- `GET /api/projects/:id/tech-stack`  
  - Behavior: Summarizes tech stack from `detectTechStack`, collection metadata, and `collection_tech_profiles`.

- `GET /api/projects/:id/db-schema`  
  - Behavior: Returns DB schema info derived from SQL analyzers (tables, columns, constraints).

- `POST /api/graph/context`  
  - Behavior: Graph expansion API defined in Phase 2.

These endpoints are thin wrappers around existing services, tuned for agent consumption.

### 4.2 Integration Points

| File | Action |
|------|--------|
| `apps/server/src/routes/search.ts` | ADD sub‑routes or new plugin for `/api/search/mobile` and `/api/search/examples` |
| `apps/server/src/services/search.ts` | EXTEND to support new filters and presets (feature‑aware retrieval) |
| `apps/server/src/routes/projects.ts` | CREATE (if not existing) for `tech-stack` and `db-schema` endpoints |
| `apps/server/src/services/projects.ts` | CREATE to aggregate tech detection, schema analysis, and metadata |
| `apps/server/src/routes/graph.ts` | ADD `/api/graph/context` if not created in Phase 2 |

### 4.3 Acceptance Criteria

- Endpoints accept JSON payloads matching the task taxonomy.
- Responses include:
  - Rich metadata: `framework`, `framework_version`, `feature_tags`, `source_quality`, `file_path`, `line_range`, `chunk_type`.
  - Stable identifiers (collection IDs, document IDs, chunk IDs).

---

## 5. Phase 3: MCP Tool Implementation

**Problem:** The MCP server needs to expose the new API capabilities in a GPT‑friendly, strongly typed way.

### 5.1 Deliverables

- Implement new MCP tools in `apps/mcp/src/index.ts` using the existing pattern:
  - Zod schemas → `toJsonSchema` → `server.registerTool(...)`.

Target tools (names may be adjusted slightly for ergonomics):

1. `search_mobile_docs`
   - Inputs: `collectionId?`, `framework`, `frameworkVersion?`, `feature?`, `query?`, `usageTierPreference?`.
   - Backend: `POST /api/search/mobile`.

2. `search_official_docs`
   - Inputs: `framework`, `topic`, `versionRange?`.
   - Backend: `POST /api/search/mobile` with `usage_tier_preference='official'` and `source_quality='official'`.

3. `get_feature_recipe`
   - Inputs: `framework`, `feature`, `version?`.
   - Backend: search in recipes collection + optional summary via synthesis.

4. `find_code_examples`
   - Inputs: `framework`, `feature`, `language?`, `techStack?`.
   - Backend: `POST /api/search/examples`.

5. `get_project_tech_stack`
   - Inputs: `projectCollectionId`.
   - Backend: `GET /api/projects/:id/tech-stack`.

6. `get_db_schema`
   - Inputs: `projectCollectionId`, optional filters (tables, schemas).
   - Backend: `GET /api/projects/:id/db-schema`.

7. `graph_expand_context`
   - Inputs: `collectionId`, `seed` (chunk ID, symbol name, or file path), `maxDepth?`, `maxNodes?`.
   - Backend: `POST /api/graph/context`.

### 5.2 Key Files

| File | Action |
|------|--------|
| `apps/mcp/src/index.ts` | ADD new tools with Zod schemas and error handling consistent with existing tools |
| `apps/mcp/src/api.ts` | MAY EXTEND helper methods for new endpoints |

### 5.3 Acceptance Criteria

- Tools validate input strictly via Zod.
- Errors are returned as human‑readable text in tool responses (consistent with current tools).
- Tools return JSON string payloads that agents can parse into structured objects.

---

## 6. Phase 4: Agent Prompt & Config Updates

**Problem:** Without clear instructions, agents may misuse tools or fail to use the more powerful ones.

### 6.1 Deliverables

- Updated **agent prompts** and configuration, building on `docs/agent-sdk`:
  - System prompt additions describing:
    - When to use mobile‑specific tools vs generic search.
    - How to choose between official docs, examples, and recipes.
    - When to expand context via the graph.
  - Tool usage examples in prompt templates.

### 6.2 Integration Points

- `docs/agent-sdk/04_AGENT_SDK_PHASE_PROMPTS.md`
  - Add a section “MCP Tools for Mobile SaaS Development” with examples like:
    - “Designing an auth flow in Flutter + Supabase”.
    - “Adding Stripe billing to an existing Flutter app.”
    - “Understanding how this project handles offline caching.”
- `apps/server/src/agent/agent.ts`
  - If/when migrating to the Claude Agent SDK or another agent runtime, ensure:
    - New MCP tools are exposed as tools to the agent.
    - The agent system prompt references them explicitly.

### 6.3 Acceptance Criteria

- Prompt templates include:
  - At least one worked example per new tool.
  - Guidance on tool selection priority (e.g., “use search_official_docs first, then find_code_examples, then get_feature_recipe”).
- Agent can successfully complete at least a few end‑to‑end flows using only the MCP tools and Synthesis as the backend.

---

## 7. Phase 5: Scenario-Based Evaluation

**Problem:** It’s not obvious whether the new tools actually make agents more reliable for real development tasks.

### 7.1 Deliverables

- A set of **scenario tests** that combine:
  - Mobile recipes (Phase 1).
  - Graph retrieval (Phase 2).
  - MCP task tools (this phase).
- Example scenarios:
  - Build a minimal Flutter + Supabase auth flow.
  - Add Stripe billing to an existing Flutter app with a Node/TS backend.
  - Add push notifications using Firebase to an Android + iOS app.
  - Trace and modify the persistence path for user settings in a given repo.

Each scenario should:

- Specify a starting repo/collection.
- Define success criteria (files created/modified, patterns used, docs consulted).
- Log all MCP tool calls and responses for analysis.

### 7.2 Key Files

| File | Action |
|------|--------|
| `.agent-scenarios/mobile-saas/*.md` | DEFINE scenario descriptions and expected outcomes |
| `apps/server/perf/mcp_scenario_runner.mjs` | CREATE script to run scenarios via MCP (or simulate calls) |

### 7.3 Acceptance Criteria

- For each scenario:
  - The agent uses the new tools (not just generic search) at least once.
  - The final code and design decisions align with your recipes and official docs.
- Scenario runner produces a concise report listing:
  - Which tools were used.
  - Where retrieval or planning failed.

Once this phase is complete, you will have a set of well‑designed MCP tools and scenarios that let a GPT/Claude agent use Synthesis as a **reliable, high‑level RAG backend** for building and evolving mobile SaaS apps.

