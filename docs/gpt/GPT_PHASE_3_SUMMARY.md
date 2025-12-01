# GPT Phase 3 Summary: Task-Specific MCP Tools

**Version:** 1.0
**Created:** December 2025
**Branch:** `feature/gpt-phase3-mcp-task-tools`

---

## Phase Overview

**Goal:** Provide task-oriented MCP tools tuned for code-generation agents building mobile SaaS apps.

**Status:** Sub-Phase 5.1 Complete

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

## Remaining Sub-Phases

| # | Sub-Phase | Status | Est. Time |
|---|-----------|--------|-----------|
| 5.1 | Task Taxonomy & Tool Design | ✅ Complete | - |
| 5.2 | HTTP API Enhancements | Pending | 3-5 days |
| 5.3 | MCP Tool Implementation | Pending | 4-6 days |
| 5.4 | Agent Prompt & Config Updates | Pending | 2-3 days |
| 5.5 | Scenario-Based Evaluation | Pending | 2-3 days |

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

## Files Changed in This Sub-Phase

```
docs/mcp/
├── MCP_TOOL_SPEC_GPT_PHASE3.md              (CREATED - master spec)
├── MCP_TOOL_SPECIFICATIONS.md                (CREATED - existing tool details)
├── MCP_TOOL_FEATURE_COVERAGE_MATRIX.md       (CREATED - feature mapping)
└── MCP_TOOL_SELECTION_DECISION_TREE.md       (CREATED - decision guide)

docs/phases/gpt-phase3/
└── MCP_TOOL_SPECIFICATIONS.md                (CREATED - new tool details)

docs/gpt/
└── GPT_PHASE_3_SUMMARY.md                    (CREATED - this file)
```

---

## Next Steps (Sub-Phase 5.2)

1. Add new HTTP endpoints:
   - `POST /api/graph/symbols` - Symbol usage search
   - `GET /api/graph/schema/:collectionId` - Database schema extraction

2. Enhance existing endpoints:
   - Add `source_quality` filter support to `/api/search`

3. Create service layer:
   - `apps/server/src/services/symbol-search.ts` - Symbol lookup service
   - Extend `apps/server/src/services/graph-search.ts` - Schema extraction

---

## Related Documentation

- Implementation Plan: `docs/gpt/PHASE_3_MCP_TASK_TOOLS_IMPLEMENTATION_PLAN.md`
- Phase 2 Summary: `docs/gpt/GPT_PHASE_2_SUMMARY.md`
- Master Plan: `docs/gpt/MASTER_PLAN.md`
