# GPT Phase 3 Summary: Task-Specific MCP Tools

**Version:** 1.2
**Created:** December 2025
**Updated:** December 2025
**Branch:** `feature/gpt-phase3-mcp-task-tools`

---

## Phase Overview

**Goal:** Provide task-oriented MCP tools tuned for code-generation agents building mobile SaaS apps.

**Status:** Sub-Phase 5.4 Complete

---

## Completed: Sub-Phase 5.1 - Task Taxonomy & Tool Design

### Deliverables Created

| Document | Location | Purpose |
|----------|----------|---------|
| MCP Tool Specification | `docs/mcp/MCP_TOOL_SPEC_GPT_PHASE3.md` | Master spec with task taxonomy and tool summary |
| Existing Tool Specs | `docs/mcp/MCP_TOOL_SPECIFICATIONS.md` | Detailed specs for 4 existing tools |
| New Tool Specs | `docs/phases/gpt-phase3/MCP_TOOL_SPECIFICATIONS.md` | Detailed specs for 3 new tools |
| Feature Coverage Matrix | `docs/mcp/MCP_TOOL_FEATURE_COVERAGE_MATRIX.md` | Feature tag to tool mapping |
| Tool Selection Guide | `docs/mcp/MCP_TOOL_SELECTION_DECISION_TREE.md` | Decision tree and worked examples |

### Task Taxonomy

Defined 4 workflow categories for mobile SaaS development:

1. **Feature Design** - "What's the recommended pattern?"
   - Tools: `get_feature_recipe`, `search_mobile_docs` (sourceQuality='official')

2. **Implementation** - "Show me working code"
   - Tools: `find_code_examples`, `search_mobile_docs`

3. **Integration/Analysis** - "How does this project work?"
   - Tools: `get_project_tech_stack`, `find_symbol_usages`, `graph_expand_context`

4. **Maintenance** - "Where is X implemented?"
   - Tools: `get_db_schema`, `graph_expand_context`, `find_symbol_usages`

### Tool Inventory (7 Total)

| # | Tool | Status | HTTP Endpoint |
|---|------|--------|---------------|
| 1 | `search_mobile_docs` | ✅ Exists (enhance with sourceQuality) | POST /api/search |
| 2 | `find_code_examples` | ✅ Exists | POST /api/search |
| 3 | `get_feature_recipe` | ✅ Exists | POST /api/search |
| 4 | `graph_expand_context` | ✅ Exists | POST /api/graph/context |
| 5 | `find_symbol_usages` | 🆕 New | POST /api/graph/symbols (NEW) |
| 6 | `get_project_tech_stack` | 🆕 New MCP tool | GET /api/tech-profiles/:id (EXISTS) |
| 7 | `get_db_schema` | 🆕 New | GET /api/graph/schema/:id (NEW) |

### Feature Coverage

Mapped 26+ mobile feature tags across 7 categories:
- Auth & User Management (auth, onboarding, social_auth, biometric_auth, sso)
- Monetization (payments, billing, subscriptions, in_app_purchases)
- Communication (push_notifications, in_app_messaging, chat, realtime, email)
- Data & Storage (offline, sync, local_storage, caching, search, file_storage)
- Navigation & UX (navigation, deep_linking, routing, bottom_nav, tabs)
- Device Features (camera, location, permissions, sensors, background_processing)
- Analytics & Monitoring (analytics, crash_reporting, logging, performance_monitoring)

### Acceptance Criteria Met

- [x] Task taxonomy covers: auth, onboarding, billing, notifications, offline, navigation, state management
- [x] Each tool has: description, input/output schema, endpoint mapping
- [x] Existing tools (4) documented with current implementation
- [x] New tools (3) designed with Zod schemas and endpoint mappings
- [x] Feature coverage matrix shows which tools handle which features
- [x] Tool selection guidance: decision tree, worked examples, anti-patterns

---

## Completed: Sub-Phase 5.2 - HTTP API Enhancements

### Deliverables Created

| Component | Location | Purpose |
|-----------|----------|---------|
| Symbol Search Service | `apps/server/src/services/symbol-search.ts` | Find symbol definitions and usages via knowledge graph |
| Schema Extractor Service | `apps/server/src/services/schema-extractor.ts` | Extract DB schema from table/column nodes |
| Graph Routes (Symbols) | `apps/server/src/routes/graph.ts` | POST /api/graph/symbols endpoint |
| Graph Routes (Schema) | `apps/server/src/routes/graph.ts` | GET /api/graph/schema/:collectionId endpoint |
| Search Enhancement | `apps/server/src/routes/search.ts` | Added source_quality filter support |
| MCP Tools 15-17 | `apps/mcp/src/index.ts` | find_symbol_usages, get_project_tech_stack, get_db_schema |

### New HTTP Endpoints

#### POST /api/graph/symbols - Symbol Usage Search
```typescript
// Request
{
  collection_id: string (UUID),
  symbol_name: string,
  symbol_kind?: 'function' | 'class' | 'widget' | 'method' | 'constant',
  include_definitions?: boolean,  // default: true
  include_usages?: boolean,       // default: true
  max_results?: number            // default: 20, max: 100
}

// Response
{
  symbol: { name, kind, nodeId } | null,
  definitions: SymbolLocation[],
  usages: Array<SymbolLocation & { edgeType }>,
  stats: { totalDefinitions, totalUsages, documentsWithUsages, searchDurationMs },
  symbol_search_enabled: boolean
}
```

#### GET /api/graph/schema/:collectionId - Database Schema Extraction
```typescript
// Query params
?tables=users,orders  // optional, comma-separated
&include_relationships=true  // optional, default: true

// Response
{
  collection_id: string,
  tables: TableSchema[],
  relationships: SchemaRelationship[],
  stats: { totalTables, totalColumns, totalRelationships, extractionDurationMs },
  schema_extraction_enabled: boolean
}
```

#### POST /api/search Enhancement - source_quality Filter
```typescript
// Added to existing search endpoint
{
  // ... existing params ...
  source_quality?: 'official' | 'verified' | 'community'
}
```

### New MCP Tools (Tools 15-17)

| # | Tool | Description | HTTP Endpoint |
|---|------|-------------|---------------|
| 15 | `find_symbol_usages` | Search for symbol definitions and usages across the codebase | POST /api/graph/symbols |
| 16 | `get_project_tech_stack` | Get technology stack profile for a project collection | GET /api/tech-profiles/:id |
| 17 | `get_db_schema` | Extract database schema from the codebase | GET /api/graph/schema/:id |

### Tests Added

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `apps/server/src/services/__tests__/symbol-search.test.ts` | 41 | Symbol search service |
| `apps/server/src/services/__tests__/schema-extractor.test.ts` | 59 | Schema extractor service |
| `apps/mcp/src/__tests__/phase3-tools.test.ts` | 71 | MCP tool Zod schema validation |

**Total New Tests:** 171 (all passing)

### Acceptance Criteria Met

- [x] POST /api/graph/symbols returns symbol definitions and usages
- [x] GET /api/graph/schema/:id returns table/column schema
- [x] /api/search accepts source_quality filter
- [x] MCP tools 15-17 are registered and functional
- [x] All new endpoints have proper error handling
- [x] Tests pass for all new code (171 tests)
- [x] Type checking passes (`pnpm typecheck`)

---

## Completed: Sub-Phase 5.3 - MCP Tool Implementation

### Deliverables Created

| Component | Location | Purpose |
|-----------|----------|---------|
| Tool Registry | `apps/mcp/src/tool-registry.ts` | ToolDefinition interface, metadata tracking for 5.6 compatibility |
| Toolpacks | `apps/mcp/src/toolpacks.ts` | Toolpack definitions (mobile_core, introspection, graphing, core) |
| Integration Tests | `apps/mcp/src/__tests__/mcp-integration.test.ts` | Registry, toolpack, and metadata tests |
| E2E Scenario Tests | `apps/mcp/src/__tests__/e2e-scenarios.test.ts` | Tool workflow scenario tests |

### Tool Registry Infrastructure

Created `tool-registry.ts` with:
- `ToolDefinition` interface with `{ toolpack, category, sensitive, version }` metadata
- `ToolRegistry` class for tool registration and lookup
- Helper functions: `createToolMetadata()`, `isValidToolpack()`, `isValidCategory()`
- Global `toolRegistry` singleton instance

### Toolpack Definitions

Created `toolpacks.ts` with 4 toolpacks:

| Toolpack | Category | Tools | Sensitive Tools |
|----------|----------|-------|-----------------|
| `mobile_core` | mobile | search_mobile_docs, find_code_examples, get_feature_recipe | - |
| `introspection` | introspection | get_project_tech_stack, get_db_schema, find_symbol_usages | get_db_schema |
| `graphing` | graph | graph_expand_context | - |
| `core` | core | search_rag, list_collections, list_documents, create_collection, fetch_and_add_document_from_url, delete_document, delete_collection, add_repo_to_collection, sync_repo, list_repos | delete_document, delete_collection |

### Server Enhancements

Updated `apps/mcp/src/index.ts`:
- Bumped version to `2.0.0`
- Added `capabilities: { tools: { listChanged: true } }` for dynamic tool management
- Added tool metadata registration for all 17 tools
- Updated startup messages to show registry stats

### Tests Added

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `apps/mcp/src/__tests__/mcp-integration.test.ts` | 46 | Tool registry, toolpacks, metadata consistency |
| `apps/mcp/src/__tests__/e2e-scenarios.test.ts` | 26 | E2E workflow scenarios for all Phase 3 tools |

**Total New Tests:** 72 (all passing)
**MCP Package Total:** 259 tests (all passing)

### Acceptance Criteria Met

- [x] Tools include `{ toolpack, category, sensitive }` metadata for 5.6 compatibility
- [x] Tool registry created with ToolDefinition interface
- [x] Toolpacks defined: mobile_core, introspection, graphing, core
- [x] Server version bumped to 2.0.0 with listChanged capability
- [x] Integration tests for registry and toolpacks (46 tests)
- [x] E2E scenario tests for all Phase 3 tools (26 tests)
- [x] All MCP package tests pass (259 tests)
- [x] Type checking passes (`pnpm typecheck`)

---

## Completed: Sub-Phase 5.4 - Agent Prompt & Config Updates

### Deliverables Created

| Component | Location | Purpose |
|-----------|----------|---------|
| Agent System Prompt Update | `apps/server/src/agent/agent.ts` | Added ~10 lines of MCP tool selection guidance |
| Agent Tool Usage Guide | `docs/mcp/MCP_AGENT_TOOL_USAGE_GUIDE.md` | Comprehensive guide for tool selection and workflows |

### Agent System Prompt Enhancement

Added tool selection guidance to `BASE_SYSTEM_PROMPT` in `apps/server/src/agent/agent.ts`:

```
MCP Tool Selection:
- Feature design (patterns/best practices): Use get_feature_recipe first for curated guides
- Code examples (working samples): Use find_code_examples to find demo implementations
- Framework-specific docs: Use search_mobile_docs with framework/featureTags filters
- General search: Use search_rag for broad collection searches
- Project analysis: Use get_project_tech_stack and get_db_schema to understand existing projects
- Code tracing: Use graph_expand_context and find_symbol_usages to trace code flow

For complex tasks, chain tools: get_feature_recipe → find_code_examples → search_mobile_docs
```

### Agent Tool Usage Guide

Created comprehensive `docs/mcp/MCP_AGENT_TOOL_USAGE_GUIDE.md` with:

- **Quick Reference Table**: Tool selection by task type
- **Tool Profiles**: When to use / when NOT to use each tool
- **Multi-Tool Workflows**: Standard workflows for feature design, bug investigation, refactoring, learning
- **Worked Examples**: 4 detailed examples (Stripe billing, auth bug, data persistence, symbol lookup)
- **Anti-Patterns**: Common mistakes and how to avoid them
- **Tool Selection Checklist**: 5-step decision process

### Files Changed

```
apps/server/src/agent/
└── agent.ts                              (MODIFIED - added tool selection guidance)

docs/mcp/
└── MCP_AGENT_TOOL_USAGE_GUIDE.md         (CREATED - comprehensive usage guide)
```

### Acceptance Criteria Met

- [x] Agent system prompt includes tool selection guidance (~10 lines)
- [x] MCP_AGENT_TOOL_USAGE_GUIDE.md created with comprehensive tool guidance
- [x] Tool profiles document when to use / when NOT to use each tool
- [x] Multi-tool workflow patterns documented
- [x] Worked examples cover common scenarios (auth, billing, code tracing)
- [x] Anti-patterns documented to prevent common mistakes
- [x] Type checking passes (`pnpm typecheck`)

---

## Remaining Sub-Phases

| # | Sub-Phase | Status | Est. Time |
|---|-----------|--------|-----------|
| 5.1 | Task Taxonomy & Tool Design | ✅ Complete | - |
| 5.2 | HTTP API Enhancements | ✅ Complete | - |
| 5.3 | MCP Tool Implementation | ✅ Complete | - |
| 5.4 | Agent Prompt & Config Updates | ✅ Complete | - |
| 5.5 | Scenario-Based Evaluation | Pending | 2-3 days |
| 5.6 | Dynamic Tool Management | Pending | 3-4 days |

---

## Key Decisions Made

1. **Merged `search_official_docs` into `search_mobile_docs`**
   - Added `sourceQuality` parameter to filter by 'official', 'verified', or 'community'
   - Reduces tool count while maintaining functionality
   - Agent instructions cover both use cases

2. **Leveraged existing `/api/tech-profiles` endpoint**
   - `get_project_tech_stack` uses existing infrastructure
   - Only needs MCP tool wrapper, no new HTTP endpoint

3. **Knowledge graph-based schema extraction**
   - `get_db_schema` queries `knowledge_nodes` for table/column nodes
   - Leverages Phase 2 graph infrastructure

4. **Symbol usage via graph edges**
   - `find_symbol_usages` queries 'defines', 'calls', 'imports' edges
   - Returns both definitions and usage locations

---

## Files Changed

### Sub-Phase 5.1 (Task Taxonomy)
```
docs/mcp/
├── MCP_TOOL_SPEC_GPT_PHASE3.md              (CREATED - master spec)
├── MCP_TOOL_SPECIFICATIONS.md                (CREATED - existing tool details)
├── MCP_TOOL_FEATURE_COVERAGE_MATRIX.md       (CREATED - feature mapping)
└── MCP_TOOL_SELECTION_DECISION_TREE.md       (CREATED - decision guide)

docs/phases/gpt-phase3/
└── MCP_TOOL_SPECIFICATIONS.md                (CREATED - new tool details)
```

### Sub-Phase 5.2 (HTTP API Enhancements)
```
apps/server/src/services/
├── symbol-search.ts                          (CREATED - symbol usage search)
├── schema-extractor.ts                       (CREATED - DB schema extraction)
├── search.ts                                 (MODIFIED - added sourceQuality filter)
├── vector.ts                                 (MODIFIED - added sourceQuality filter)
├── hybrid.ts                                 (MODIFIED - added sourceQuality filter)
├── bm25.ts                                   (MODIFIED - added sourceQuality filter)
└── cache/search-cache.ts                     (MODIFIED - added sourceQuality to cache key)

apps/server/src/routes/
├── graph.ts                                  (MODIFIED - added /symbols and /schema endpoints)
└── search.ts                                 (MODIFIED - added source_quality param)

apps/mcp/src/
└── index.ts                                  (MODIFIED - added tools 15-17, updated count to 17)

apps/server/src/services/__tests__/
├── symbol-search.test.ts                     (CREATED - 41 tests)
└── schema-extractor.test.ts                  (CREATED - 59 tests)

apps/mcp/src/__tests__/
└── phase3-tools.test.ts                      (CREATED - 71 tests)
```

### Sub-Phase 5.3 (MCP Tool Implementation)
```
apps/mcp/src/
├── tool-registry.ts                          (CREATED - ToolDefinition, ToolRegistry class)
├── toolpacks.ts                              (CREATED - TOOLPACKS, TOOL_METADATA definitions)
├── index.ts                                  (MODIFIED - v2.0.0, listChanged, metadata registration)
└── __tests__/
    ├── mcp-integration.test.ts               (CREATED - 46 tests)
    └── e2e-scenarios.test.ts                 (CREATED - 26 tests)
```

---

## Next Steps (Sub-Phase 5.5)

Sub-Phase 5.4 added tool selection guidance to the agent system prompt and comprehensive documentation.

For Sub-Phase 5.5 (Scenario-Based Evaluation), focus on:
1. Create scenario test files in `.agent-scenarios/mobile-saas/`
2. Build `mcp_scenario_runner.mjs` harness
3. Define success criteria for each scenario
4. Test tool workflows end-to-end

---

## Related Documentation

- Implementation Plan: `docs/gpt/PHASE_3_MCP_TASK_TOOLS_IMPLEMENTATION_PLAN.md`
- Phase 2 Summary: `docs/gpt/GPT_PHASE_2_SUMMARY.md`
- Master Plan: `docs/gpt/MASTER_PLAN.md`
