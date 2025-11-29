# GPT-Oriented Enhancements: Master Plan

**Version:** 1.0 · **Created:** November 2025  
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

These plans build on existing documentation and phases, especially:

- `docs/RAG_AND_MODEL_SELECTOR_IMPLEMENTATION_PLAN.md`
- `docs/CONFIGURATION.md`
- `docs/guides/HYBRID_SEARCH_GUIDE.md`
- `docs/guides/CODE_SEARCH_GUIDE.md`
- `docs/guides/SYNTHESIS_GUIDE.md`
- `docs/agent-sdk/*.md`
- `docs/new-phases/*.md` (Phase 13 / 13.5 code intelligence, tech stack profiles)

---

## 2. High-Level Objectives

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

## 3. Phased Roadmap

### 3.1 Phase A: Mobile Feature Recipes & Examples

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

### 3.2 Phase B: Graph-Style Retrieval & Context Expansion

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

### 3.3 Phase C: Task-Specific MCP Tools for Development

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

## 4. Dependencies & Integration Points

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

## 5. Execution Notes for Agents

- Follow the **Git workflow and review rules** from:
  - `agents.md`
  - `docs/RAG_AND_MODEL_SELECTOR_IMPLEMENTATION_PLAN.md` (Section 2)
- For each phase:
  - Read the corresponding GPT plan in this folder.
  - Cross‑reference the older phase docs for that area (search, metadata, code intelligence, MCP).
  - Propose changes, run tests, and produce a phase summary before asking for human approval.

Once all three initiatives are implemented, Synthesis should operate as a **high‑trust, agent‑aware RAG hub** for building and evolving mobile SaaS applications via MCP.

