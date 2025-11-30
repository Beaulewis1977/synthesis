# Phase 3: Task-Specific MCP Tools for Development – Implementation Plan

**Version:** 2.0 · **Created:** November 2025 · **Updated:** November 2025  
**Branch:** `feature/gpt-phase3-mcp-task-tools`  
**PR Title:** GPT Phase 3: Task-Specific MCP Tools

---

## Prerequisites

**This phase requires Phase 1 and Phase 2 to be complete:**

- [x] GPT Phase 1 merged (Mobile Feature Recipes & Metadata)
  - `feature_tags`, `platform`, `usage_tier` metadata available
  - Feature detector service available
- [x] GPT Phase 2 merged (Graph Retrieval)
  - `knowledge_nodes` and `knowledge_edges` tables exist
  - Graph search service available
  - `/api/graph/context` endpoint available
- [ ] `develop` branch is up to date with Phase 1 & 2
- [ ] All existing tests pass (`pnpm test`)

---

## Related Documentation

- `docs/agent-sdk/00_AGENT_SDK_OVERVIEW.md`  
- `docs/RAG_AND_MODEL_SELECTOR_IMPLEMENTATION_PLAN.md`
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

## 2. GitHub Workflow

**Single branch for entire phase:** `feature/gpt-phase3-mcp-task-tools`

**IMPORTANT:** Ensure Phase 1 and Phase 2 PRs are merged before starting this phase.

```bash
# 1. Verify prerequisites
git checkout develop && git pull origin develop
# Confirm Phase 1 and Phase 2 changes are present

# 2. Create branch (WAIT FOR APPROVAL)
git checkout -b feature/gpt-phase3-mcp-task-tools

# 3. Implement all sub-phases in order

# 4. Run tests and lint
pnpm test
pnpm lint

# 5. Present ALL changes for human review

# 6. After APPROVAL: commit
git add -A
git commit -m "feat(gpt-phase3): implement task-specific MCP tools

- Add search_mobile_docs MCP tool
- Add find_code_examples MCP tool
- Add get_feature_recipe MCP tool
- Add get_project_tech_stack MCP tool  
- Add get_db_schema MCP tool
- Add graph_expand_context MCP tool
- Add HTTP API endpoints for tools
- Update agent prompts with tool usage examples"

# 7. After APPROVAL: push
git push -u origin feature/gpt-phase3-mcp-task-tools

# 8. Create PR
gh pr create --base develop --title "GPT Phase 3: Task-Specific MCP Tools"
```

Follow rules in `docs/gpt/MASTER_PLAN.md` Section 2 and `agents.md`.

---

## 3. Phase Overview

**All sub-phases go into ONE branch and ONE PR.**

| # | Sub-Phase | Priority | Est. Time | Commit Scope |
|---|-----------|----------|-----------|---------------|
| 5.1 | Task Taxonomy & Tool Design | P0 | 2–3 days | `feat(gpt-phase3): add tool taxonomy and specifications` |
| 5.2 | HTTP API Enhancements | P0 | 3–5 days | `feat(gpt-phase3): add feature-aware search endpoints` |
| 5.3 | MCP Tool Implementation | P1 | 4–6 days | `feat(gpt-phase3): implement 6 new MCP tools` |
| 5.4 | Agent Prompt & Config Updates | P1 | 2–3 days | `feat(gpt-phase3): update agent prompts with tool examples` |
| 5.5 | Scenario-Based Evaluation | P2 | 2–3 days | `feat(gpt-phase3): add evaluation scenarios and harness` |

### Commit Strategy

```bash
# Work on single branch
git checkout -b feature/gpt-phase3-mcp-task-tools

# Commit after completing each sub-phase:
git commit -m "feat(gpt-phase3): add tool taxonomy and specifications"
git commit -m "feat(gpt-phase3): add feature-aware search endpoints"
git commit -m "feat(gpt-phase3): implement 6 new MCP tools"
git commit -m "feat(gpt-phase3): update agent prompts with tool examples"
git commit -m "feat(gpt-phase3): add evaluation scenarios and harness"

# One PR at the end with all commits
git push -u origin feature/gpt-phase3-mcp-task-tools
gh pr create --base develop --title "GPT Phase 3: Task-Specific MCP Tools"
```

---

## 4. Phase 1: Task Taxonomy & Tool Design

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

### 3.4 Agent Execution Guidance

#### Skills to Use
- `superpowers:brainstorming` — Design tool taxonomy and naming conventions
- `planning` — Structure taxonomy and tool specifications
- `superpowers:dispatching-parallel-agents` — Coordinate spec work across categories

#### MCP Servers
- `context7` — Reference MCP protocol patterns and Zod documentation
- `sequentialthinking` — Design tool interactions and parameter schemas

#### Subagents (Parallel - 4 agents)
1. `mcp-server-architect` — Design docs/recipes tool specs (search_mobile_docs, search_official_docs, get_feature_recipe)
2. `mcp-server-architect` — Design code/examples tool specs (find_code_examples, find_symbol_usages)
3. `mcp-server-architect` — Design introspection tool specs (get_project_tech_stack, get_db_schema, graph_expand_context)
4. `doc-writer` — Create MCP_TOOL_SPEC_GPT_PHASE3.md structure with taxonomy and endpoint mappings

#### Subagents (Sequential after parallel)
1. `code-standards-reviewer` — Review spec document (ALWAYS LAST)

#### Execution Notes
- Tool specs can be designed in parallel by category (docs, code, introspection)
- Consolidate all specs into single MCP_TOOL_SPEC_GPT_PHASE3.md document
- Use `superpowers:brainstorming` for tool naming: names should be verb_noun format (search_*, get_*, find_*)
- Each tool description should clearly state when to use it vs alternatives
- Zod schemas should be strict with proper descriptions for each field

---

## 5. Phase 2: HTTP API Enhancements

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

### 4.4 Agent Execution Guidance

#### Skills to Use
- `backend-development` — API implementation with Fastify routes
- `rag-implementation` — Search patterns and filter integration
- `superpowers:subagent-driven-development` — Parallel endpoint development with quality gates
- `superpowers:defense-in-depth` — Input validation at API boundaries

#### MCP Servers
- `context7` — Fastify patterns, Zod validation best practices
- `sequentialthinking` — Design API structure and response formats

#### Subagents (Parallel - 5 agents MAX)
1. `rag-system-architect` — POST /api/search/mobile endpoint (framework + feature filtering)
2. `rag-system-architect` — POST /api/search/examples endpoint (usage_tier='example' filter)
3. `rag-system-architect` — GET /api/projects/:id/tech-stack endpoint (aggregate tech detection)
4. `rag-system-architect` — GET /api/projects/:id/db-schema endpoint (SQL analyzer results)
5. `rag-system-architect` — Create projects.ts service for aggregation (tech stack + schema)

#### Subagents (Sequential after parallel)
1. `test-writer` — API endpoint tests for all 4 endpoints
2. `code-standards-reviewer` — Review all endpoints (ALWAYS LAST)

#### Execution Notes
- All endpoints are independent and can be fully parallelized
- Projects service may need to be created first if tech-stack and db-schema endpoints depend on it
- Use `superpowers:defense-in-depth` for strict input validation (Zod schemas with refinements)
- Response format should be consistent across all endpoints: { data, metadata, pagination }
- Include proper error responses with helpful messages for invalid parameters

---

## 6. Sub-Phase 5.3: MCP Tool Implementation

**Problem:** The MCP server needs to expose new capabilities in a strongly typed way.

### 5.3.1 Tool Implementation Pattern

**File:** `apps/mcp/src/index.ts`

Follow the existing pattern for each new tool:

```typescript
import { z } from 'zod';

// Example: search_mobile_docs tool
const SearchMobileDocsSchema = z.object({
  collection_id: z.string().uuid().optional(),
  framework: z.enum(['flutter', 'react_native', 'swift', 'kotlin']),
  framework_version: z.string().optional(),
  feature: z.string().optional().describe('Feature tag like auth, billing, push_notifications'),
  query: z.string().optional().describe('Free-text search query'),
  usage_tier_preference: z.enum(['official', 'balanced', 'examples', 'recipes-first']).optional(),
  limit: z.number().int().min(1).max(20).optional().default(10),
});

server.tool(
  'search_mobile_docs',
  'Search for mobile development documentation with framework and feature filtering. ' +
  'Use this when you need docs, guides, or tutorials for mobile app features.',
  SearchMobileDocsSchema,
  async (params) => {
    const response = await apiClient.post('/api/search/mobile', params);
    if (!response.ok) {
      return { error: `Search failed: ${await response.text()}` };
    }
    return response.json();
  }
);
```

### 5.3.2 All Tools to Implement

```typescript
// 1. search_mobile_docs - Feature-aware mobile documentation search
const SearchMobileDocsSchema = z.object({
  collection_id: z.string().uuid().optional(),
  framework: z.enum(['flutter', 'react_native', 'swift', 'kotlin']),
  feature: z.string().optional(),
  query: z.string().optional(),
  usage_tier_preference: z.enum(['official', 'balanced', 'examples', 'recipes-first']).optional(),
  limit: z.number().optional().default(10),
});

// 2. find_code_examples - Find code examples for specific features
const FindCodeExamplesSchema = z.object({
  collection_id: z.string().uuid().optional(),
  framework: z.enum(['flutter', 'react_native', 'swift', 'kotlin']),
  feature: z.string().describe('Feature to find examples for'),
  language: z.string().optional(),
  tech_stack: z.array(z.string()).optional(),
  limit: z.number().optional().default(5),
});

// 3. get_feature_recipe - Get curated recipe for a feature
const GetFeatureRecipeSchema = z.object({
  framework: z.enum(['flutter', 'react_native', 'swift', 'kotlin']),
  feature: z.string().describe('Feature tag like auth, billing, push_notifications'),
  version: z.string().optional(),
  include_alternatives: z.boolean().optional().default(false),
});

// 4. get_project_tech_stack - Analyze project technology stack
const GetProjectTechStackSchema = z.object({
  collection_id: z.string().uuid().describe('Collection ID of the project'),
});

// 5. get_db_schema - Get database schema from project
const GetDbSchemaSchema = z.object({
  collection_id: z.string().uuid(),
  tables: z.array(z.string()).optional().describe('Filter to specific tables'),
  include_relationships: z.boolean().optional().default(true),
});

// 6. graph_expand_context - Expand context using knowledge graph
const GraphExpandContextSchema = z.object({
  collection_id: z.string().uuid(),
  seed: z.string().describe('Starting point: chunk ID, symbol name, or file path'),
  seed_type: z.enum(['chunk_id', 'symbol', 'file_path']).optional(),
  max_depth: z.number().int().min(1).max(5).optional().default(2),
  max_nodes: z.number().int().min(1).max(100).optional().default(20),
  edge_types: z.array(z.string()).optional().describe('Filter to specific edge types'),
});
```

### 5.3.3 Tool Descriptions (for Agent Prompts)

| Tool | When to Use |
|------|-------------|
| `search_mobile_docs` | Finding documentation, guides, or tutorials for mobile features |
| `find_code_examples` | Need working code examples for a specific feature |
| `get_feature_recipe` | Want the recommended pattern/approach for a feature |
| `get_project_tech_stack` | Need to understand what technologies a project uses |
| `get_db_schema` | Need to understand database structure |
| `graph_expand_context` | Need to trace code flow or understand relationships |

### 5.3.4 Key Files

| File | Action |
|------|--------|
| `apps/mcp/src/index.ts` | ADD 6 new tools with Zod schemas |
| `apps/mcp/src/api.ts` | ADD helper methods for new endpoints |

### 5.3.5 Acceptance Criteria

- [ ] All 6 tools implemented and registered
- [ ] Tools validate input via Zod
- [ ] Error messages are human-readable
- [ ] Tools return structured JSON responses
- [ ] Tools can be called successfully from Claude/MCP client

### 5.3.6 Agent Execution Guidance

#### Skills to Use
- `backend-development` — Tool implementation following existing patterns
- `superpowers:subagent-driven-development` — Parallel tool development with quality gates
- `superpowers:requesting-code-review` — Quality gate before merging MCP changes

#### MCP Servers
- `context7` — MCP SDK patterns, @modelcontextprotocol documentation

#### Subagents (Parallel - 5 agents MAX) — MAXIMUM PARALLELISM
1. `mcp-server-architect` — Tool: search_mobile_docs (framework + feature aware search with usage_tier_preference)
2. `mcp-server-architect` — Tool: find_code_examples (filter to usage_tier='example', code chunks)
3. `mcp-server-architect` — Tool: get_feature_recipe (curated patterns from recipe collection)
4. `mcp-server-architect` — Tools: get_project_tech_stack + get_db_schema (introspection pair, can share helper)
5. `mcp-server-architect` — Tool: graph_expand_context (knowledge graph exploration with seed types)

#### Subagents (Sequential after parallel)
1. `test-writer` — MCP tool tests for all 6 tools (input validation, API calls, response format)
2. `code-standards-reviewer` — Final review (ALWAYS LAST)

#### Execution Notes
- All 6 tools are independent — achieve maximum parallelism with 5 agents
- Each tool should follow existing pattern in apps/mcp/src/index.ts
- Tools 4 (tech_stack) and 5 (db_schema) can share a common introspection helper
- Use `superpowers:requesting-code-review` before merging to ensure consistency
- Test each tool manually with MCP client before marking complete
- Error responses should include actionable suggestions (e.g., "No results found. Try broadening feature filter.")

---

## 7. Phase 4: Agent Prompt & Config Updates

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
  - Guidance on tool selection priority (e.g., "use search_official_docs first, then find_code_examples, then get_feature_recipe").
- Agent can successfully complete at least a few end‑to‑end flows using only the MCP tools and Synthesis as the backend.

### 6.4 Agent Execution Guidance

#### Skills to Use
- `superpowers:brainstorming` — Design prompt structure and tool usage examples
- `planning` — Organize example workflows logically
- `superpowers:executing-plans` — Systematic updates across prompt files

#### MCP Servers
- `sequentialthinking` — Design prompt structure and tool selection logic

#### Subagents (Parallel - 4 agents)
1. `mcp-server-architect` — Design tool selection priority logic for prompts (when to use which tool)
2. `doc-writer` — Update 04_AGENT_SDK_PHASE_PROMPTS.md with MCP tools section
3. `doc-writer` — Create tool usage examples (auth flow, billing, notifications scenarios)
4. `mcp-server-architect` — Update agent.ts system prompt with tool descriptions and selection guidance

#### Subagents (Sequential after parallel)
1. `code-standards-reviewer` — Review prompt changes (ALWAYS LAST)

#### Execution Notes
- Prompts and examples can be developed in parallel
- System prompt update depends on tool descriptions being finalized
- Use `superpowers:brainstorming` for prompt wording to ensure clarity
- Tool selection priority should be explicit: "For feature implementation, try get_feature_recipe first, then find_code_examples, then search_mobile_docs"
- Include negative examples: "Don't use search_mobile_docs for project introspection — use get_project_tech_stack instead"

---

## 8. Phase 5: Scenario-Based Evaluation

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

### 7.4 Agent Execution Guidance

#### Skills to Use
- `planning` — Define evaluation scenarios and success criteria
- `backend-development` — Runner implementation with structured output
- `superpowers:executing-plans` — Systematic scenario execution
- `superpowers:subagent-driven-development` — Parallel scenario development

#### MCP Servers
- `sequentialthinking` — Design test scenarios with clear success criteria

#### Subagents (Parallel - 5 agents MAX)
1. `doc-writer` — Create auth flow scenario (.agent-scenarios/mobile-saas/flutter_supabase_auth.md)
2. `doc-writer` — Create billing scenario (.agent-scenarios/mobile-saas/flutter_stripe_billing.md)
3. `doc-writer` — Create notifications scenario (.agent-scenarios/mobile-saas/firebase_push_notifications.md)
4. `doc-writer` — Create persistence scenario (.agent-scenarios/mobile-saas/user_settings_trace.md)
5. `test-writer` — Create mcp_scenario_runner.mjs harness (call tools, log results, generate report)

#### Subagents (Sequential after parallel)
1. `code-standards-reviewer` — Final review (ALWAYS LAST)
2. `doc-writer` — Create GPT_PHASE_3_SUMMARY.md with phase outcomes and metrics

#### Execution Notes
- All scenarios are independent and can be written in parallel
- Runner can be developed in parallel with scenario definitions
- Use `superpowers:subagent-driven-development` for systematic scenario execution
- Each scenario should specify: starting collection, expected tools used, success criteria, expected sources
- Report format: JSON with tool_calls[], sources_found[], success_rate, failure_reasons[]

Once this phase is complete, you will have a set of well‑designed MCP tools and scenarios that let a GPT/Claude agent use Synthesis as a **reliable, high‑level RAG backend** for building and evolving mobile SaaS apps.
