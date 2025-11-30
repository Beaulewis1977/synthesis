# GPT-Oriented Enhancements: Master Plan

**Version:** 2.0 · **Created:** November 2025 · **Updated:** November 2025  
**Scope:** Agent-centric improvements for MCP + mobile SaaS workflows

---

## 1. Overview

This package defines a GPT-friendly roadmap for turning Synthesis into a **high‑leverage RAG + MCP backend** for agents that build and maintain mobile SaaS apps.

It focuses on three initiatives:

1. **Mobile Feature Recipes & Examples** – curated, metadata‑rich knowledge for mobile stacks.
2. **Graph‑Style Retrieval & Context Expansion** – knowledge graph on top of existing RAG.
3. **Task‑Specific MCP Tools for Development** – tools that match how code‑generation agents actually work.

Each initiative has its own implementation plan:

- `PHASE_1_MOBILE_RECIPES_IMPLEMENTATION_PLAN.md`
- `PHASE_2_GRAPH_RETRIEVAL_IMPLEMENTATION_PLAN.md`
- `PHASE_3_MCP_TASK_TOOLS_IMPLEMENTATION_PLAN.md`

### Implementation Order & Dependencies

```
Phase 1 (Mobile Recipes)     Phase 2 (Graph Retrieval)
         │                            │
         └──────────┬─────────────────┘
                    │
                    ▼
         Phase 3 (MCP Task Tools)
```

**Phase 1** and **Phase 2** can be implemented in parallel.  
**Phase 3** requires both Phase 1 and Phase 2 to be complete.

### Reference Documentation

These plans build on existing documentation and phases:

- `docs/RAG_AND_MODEL_SELECTOR_IMPLEMENTATION_PLAN.md`
- `docs/CONFIGURATION.md`
- `docs/guides/HYBRID_SEARCH_GUIDE.md`
- `docs/guides/CODE_SEARCH_GUIDE.md`
- `docs/guides/SYNTHESIS_GUIDE.md`
- `docs/agent-sdk/*.md`
- `docs/new-phases/*.md` (Phase 13 / 13.5 code intelligence, tech stack profiles)

---

## 2. GitHub Workflow

All work under the GPT phases MUST follow the guarded Git workflow. **Each phase gets its own branch and PR.**

### 2.1 Branch Strategy

| Phase | Branch Name | PR Title |
|-------|-------------|----------|
| Phase 1 | `feature/gpt-phase1-mobile-recipes` | GPT Phase 1: Mobile Feature Recipes & Metadata |
| Phase 2 | `feature/gpt-phase2-graph-retrieval` | GPT Phase 2: Graph Retrieval & Context Expansion |
| Phase 3 | `feature/gpt-phase3-mcp-task-tools` | GPT Phase 3: Task-Specific MCP Tools |

### 2.2 Rules

- **Base branch:** Always branch from `develop`
- **One PR per phase:** Do not combine phases into a single PR
- **No direct commits:** Agents MUST NOT commit or push without explicit human approval
- **Review before merge:** All PRs require human review before merging

### 2.3 Workflow Per Phase

```bash
# ════════════════════════════════════════════════════════════════
# STEP 1: Create branch (WAIT FOR HUMAN APPROVAL)
# ════════════════════════════════════════════════════════════════
git checkout develop && git pull origin develop
git checkout -b feature/gpt-phase1-mobile-recipes  # Use correct phase number

# ════════════════════════════════════════════════════════════════
# STEP 2: Implement sub-phases and commit after each
# ════════════════════════════════════════════════════════════════
# For EACH sub-phase:
#   1. Implement the sub-phase
#   2. Run tests: pnpm test
#   3. Run lint: pnpm lint
#   4. Present changes for human review
#   5. After APPROVAL: commit that sub-phase

# Example commits for Phase 1 (one per sub-phase):
git add -A && git commit -m "feat(gpt-phase1): add mobile metadata types and feature detector"
git add -A && git commit -m "feat(gpt-phase1): add recipe template and example recipes"
git add -A && git commit -m "feat(gpt-phase1): add feature-aware search filtering"
git add -A && git commit -m "feat(gpt-phase1): add UI components and MCP tool updates"
git add -A && git commit -m "feat(gpt-phase1): add evaluation harness and golden tasks"

# ════════════════════════════════════════════════════════════════
# STEP 3: After ALL sub-phases complete - Push branch
# ════════════════════════════════════════════════════════════════
git push -u origin feature/gpt-phase1-mobile-recipes

# ════════════════════════════════════════════════════════════════
# STEP 4: Create PR (contains all sub-phase commits)
# ════════════════════════════════════════════════════════════════
gh pr create --base develop \
  --title "GPT Phase 1: Mobile Feature Recipes & Metadata" \
  --body "## Summary
Implements GPT Phase 1 from docs/gpt/PHASE_1_MOBILE_RECIPES_IMPLEMENTATION_PLAN.md

## Commits (one per sub-phase)
- feat(gpt-phase1): add mobile metadata types and feature detector
- feat(gpt-phase1): add recipe template and example recipes
- feat(gpt-phase1): add feature-aware search filtering
- feat(gpt-phase1): add UI components and MCP tool updates
- feat(gpt-phase1): add evaluation harness and golden tasks

## Testing
- [ ] All existing tests pass
- [ ] New unit tests added for each sub-phase
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guide
- [ ] No console.log statements left
- [ ] Documentation updated
- [ ] Migration is reversible"
```

### 2.4 Commit Message Format

Use conventional commits with GPT phase scope:

```
feat(gpt-phase1): description
feat(gpt-phase2): description  
feat(gpt-phase3): description
```

### 2.5 Reference Documentation

Agents should also follow:
- `agents.md` - Core agent rules and collaboration workflow
- `docs/RAG_AND_MODEL_SELECTOR_IMPLEMENTATION_PLAN.md` (Section 2: GitHub Workflow)

---

## 3. High-Level Objectives

- Make Synthesis the **single source of truth** for:
  - Official framework docs (Flutter, Supabase, Firebase, Stripe, etc.).
  - High‑quality code examples and reference repos.
  - Your own playbooks and build plans.
- Provide retrieval that understands:
  - Frameworks, SDK versions, and tech stacks.
  - Relationships between widgets, services, endpoints, DB tables, config.
  - When to use which source (official vs examples vs your notes).
- Expose **MCP tools that speak the agent’s language**:
  - “Find a Flutter auth example with Supabase.”
  - “Show the DB schema for this project.”
  - “Give me the recommended pattern for feature X.”

---

## 4. Phased Roadmap

### 4.1 Phase A: Mobile Feature Recipes & Examples

**Plan:** `PHASE_1_MOBILE_RECIPES_IMPLEMENTATION_PLAN.md`  
**Goal:** Curated, tagged knowledge base for mobile SaaS feature patterns.

Key ideas:

- Extend metadata guarantees (Phase 3) and tech‑stack detection (Phase 13.5) for **mobile features**:
  - `framework`, `framework_version`, `tech_stack`, `content_category`, `source_quality`.
  - `feature_tags` (login, onboarding, billing, notifications, offline, etc.).
- Create a “recipes” layer on top of:
  - Official docs collections.
  - Example repos and code snippets.
  - Your own notes/build plans.
- Wire these tags into `smartSearch` and Synthesis so agents can ask for:
  - “Official” vs “example” vs “your preferred” approach.

### 4.2 Phase B: Graph-Style Retrieval & Context Expansion

**Plan:** `PHASE_2_GRAPH_RETRIEVAL_IMPLEMENTATION_PLAN.md`  
**Goal:** Build a lightweight knowledge graph over existing chunks and ASTs.

Key ideas:

- Reuse Phase 13 code intelligence (AST chunking) and Phase 13.5 backend analysis:
  - Nodes: widgets/components, services, endpoints, DB tables, config sections, external docs.
  - Edges: `calls`, `depends_on`, `configured_by`, `persists_to`, `belongs_to`.
- Implement a **graph retrieval service** that:
  - Starts from search results or a symbol and expands outward.
  - Returns cohesive “end‑to‑end slices” (e.g., widget → service → API → DB table).
- Integrate with:
  - `smartSearch` (Phase 11) for fusion.
  - Synthesis engine (Phase 12) for higher‑quality multi‑source answers.

### 4.3 Phase C: Task-Specific MCP Tools for Development

**Plan:** `PHASE_3_MCP_TASK_TOOLS_IMPLEMENTATION_PLAN.md`  
**Goal:** Provide tools that encode your best practices and retrieval patterns.

Key ideas:

- Build on the existing MCP server (`apps/mcp/src/index.ts`) and Agent SDK plans:
  - `docs/agent-sdk/00_AGENT_SDK_OVERVIEW.md`
  - `docs/agent-sdk/02_AGENT_SDK_BUILD_PLAN.md`
- Add tools for:
  - Tech‑aware doc search (`search_mobile_docs`, `search_official_docs`).
  - Example discovery (`find_code_examples`).
  - Project introspection (`get_project_tech_stack`, `get_db_schema`, `graph_expand_context`).
  - Pattern lookup (`get_feature_recipe`).
- Update agent prompts so Claude/GPT knows exactly when to call which tool.

---

## 5. Dependencies & Integration Points

- **RAG & Model Selector Plan:** reuse phases and services instead of re‑inventing:
  - Token‑aware chunking and profiles (Phases 1, 5).
  - Metadata guarantees (Phase 3).
  - Model configuration and selector UI (Phases 4–6).
  - Code intelligence & tech stack profiles (Phases 9, 13, 13.5).
- **Guides & Config:**
  - `docs/guides/HYBRID_SEARCH_GUIDE.md` – base search behavior.
  - `docs/guides/CODE_SEARCH_GUIDE.md` – code search expectations.
  - `docs/guides/SYNTHESIS_GUIDE.md` – synthesis semantics and costs.
  - `docs/CONFIGURATION.md` – env flags for search, embeddings, synthesis, MCP.
- **Agent Layer:**
  - Existing `runAgentChat` loop and tool set (`apps/server/src/agent/*.ts`).
  - Agent SDK migration docs under `docs/agent-sdk/`.

Each phase plan in this folder links back to these documents and assumes the v2.0 architecture described in the main docs.

---

## 6. Execution Notes for Agents

### 6.1 Before Starting Any Phase

1. **Read the full phase document** - Don't skim, read every section
2. **Check prerequisites** - Ensure dependent phases are complete
3. **Review existing code** - Understand current patterns before modifying
4. **Ask questions** - If anything is unclear, ask before implementing

### 6.2 Implementation Checklist

For each phase:

- [ ] Create feature branch from `develop`
- [ ] Implement all deliverables listed in the phase doc
- [ ] Write unit tests for new code (aim for 80%+ coverage)
- [ ] Update TypeScript types in `packages/shared/src/index.ts`
- [ ] Run `pnpm test` - all tests must pass
- [ ] Run `pnpm lint` - no lint errors
- [ ] Run `pnpm build` - builds successfully
- [ ] Create phase summary document
- [ ] Present changes for human review
- [ ] After approval: commit, push, create PR

### 6.3 Phase Summary Template

After completing implementation, create `GPT_PHASE_X_SUMMARY.md` in project root:

```markdown
# GPT Phase X Summary: [Title]

## Completed
- Feature 1
- Feature 2

## Files Changed
- `path/to/file.ts` - Description

## New Files
- `path/to/new/file.ts` - Purpose

## Database Migrations
- `XXXX_migration_name.sql` - Description

## Tests Added
- `file.test.ts` - X tests covering Y

## Environment Variables
- `VAR_NAME` - Description (default: value)

## Breaking Changes
None / List any

## Known Issues
None / List any

## Next Steps
- What Phase 2/3 can now build on
```

### 6.4 Reference Documentation

Follow the **Git workflow and review rules** from:
- `agents.md`
- `docs/RAG_AND_MODEL_SELECTOR_IMPLEMENTATION_PLAN.md` (Section 2)

Cross-reference existing phase docs:
- Phase 3 (Metadata): `docs/phases/phase-3/`
- Phase 11 (Search): `docs/phases/phase-11/`
- Phase 13 (Code Intelligence): `docs/phases/phase-13/`

### 6.5 Success Criteria

Once all three phases are implemented, Synthesis should:

1. **Phase 1 Complete:** Search understands mobile features, platforms, and usage tiers
2. **Phase 2 Complete:** Retrieval can expand context via knowledge graph
3. **Phase 3 Complete:** MCP tools match agent workflows for mobile SaaS development

The system operates as a **high‑trust, agent‑aware RAG hub** for building and evolving mobile SaaS applications via MCP.
