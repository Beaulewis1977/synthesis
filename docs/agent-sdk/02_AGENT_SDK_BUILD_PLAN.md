## Agent SDK Migration & Tools Build Plan

**Version:** 1.0  
**Date:** 2025-11-13

---

### Overview

This document outlines a **high-level build plan** for:

1. Migrating Synthesis’s internal agent implementation from the low-level TypeScript SDK to the Claude Agent SDK.
2. Defining a unified tool registry usable by both implementations.
3. Exposing key operations as tools (search, ingest, lifecycle, repo sync, MCP integrations).
4. Adding dedicated MCP servers (including Context7-like sources and `@new-phases`).

The plan is organized into phases to keep the work incremental and avoid over-engineering. No code is written here; this is a guide for a future implementation agent.

**Branch Strategy (high level)**

- Keep the **`main` branch** as the Messages API–based implementation (v2.0 line).
- Use an **`agent-sdk` (or `develop`) branch** for the Agent SDK migration and related tools/MCP work.
- Regularly merge `main` into `agent-sdk` to keep the migration up to date.
- Use `AGENT_IMPLEMENTATION=messages|agent-sdk` as a runtime flag so both implementations can coexist in the same codebase if desired.

---

### Phase A — Baseline Audit & Abstractions

**Goal:** Understand the current implementation deeply and introduce minimal abstractions without behaviour changes.

### A1. Audit current agent & tools implementation

- Files:
  - `apps/server/src/agent/agent.ts` — current agent loop using `@anthropic-ai/sdk`.
  - `apps/server/src/agent/tools.ts` — current tool definitions and executors.
  - `apps/server/src/routes/agent.ts` — HTTP routes using `runAgentChat`.
  - `apps/mcp/src/index.ts` — MCP server exposing Synthesis operations.

**Tasks:**

- Document:
  - The exact shape of `AgentConversationMessage`, `AgentChatParams`, `AgentToolCall`, `AgentChatResult`.
  - The set of tools provided by `buildAgentTools` (names, inputs, outputs).
  - Error handling patterns in `runAgentChat` and `agentRoutes`.

### A2. Introduce AgentRunner interface (conceptual)

- Design `AgentRunner` interface (see `01_AGENT_SDK_ARCHITECTURE_IMPACT.md`).
- Plan how to:
  - Wrap current `runAgentChat` inside a `MessagesApiAgentRunner`.
  - Create a placeholder `AgentSdkAgentRunner` with `TODO` sections.

### A3. Configuration planning

- Decide env variables for switching implementations:
  - `AGENT_IMPLEMENTATION=messages | agent-sdk`.
- Plan how the server will construct the correct runner at startup.

**Exit Criteria (Phase A):**

- Clear understanding of the current agent loop and tools.
- Design for `AgentRunner` and configuration toggles.
- No behavioural changes yet.

---

### Phase B — Unified Tool Registry

**Goal:** Define a single, neutral representation of tools that can be consumed by both agent implementations and MCP.

### B1. Tool definition format

- Define `AgentToolDefinition` and `ToolContext` (see architecture doc).
- Identify all existing tools in `buildAgentTools` and map them into:
  - `name`, `description`, `inputSchema` (zod/JSON-schema), `executor`.

### B2. Adapter for Messages API

- Plan an adapter that:
  - Takes an array of `AgentToolDefinition` and produces `Tool[]` for `messages.create`.
  - Provides `toolExecutors` lookup by name.

### B3. Adapter for Agent SDK

- Plan how to register the same `AgentToolDefinition` set with the Agent SDK.
- Consider how to pass context (db, collectionId, MCP clients) into executors.

### B4. MCP alignment

- Ensure MCP tools (in `apps/mcp/src/index.ts`) can reuse the same definitions or at least the same business logic.

**Exit Criteria (Phase B):**

- A clearly defined tool registry design.
- Mapping from existing tools to this registry is understood and enumerated.

---

### Phase C — Agent SDK Runner Implementation (Behind a Flag)

**Goal:** Implement `AgentSdkAgentRunner` using the Claude Agent SDK while keeping the existing `MessagesApiAgentRunner` intact.

> Note: This phase is design-only; a future agent will fill in actual imports and code once the Agent SDK WSL issue is resolved.

### C1. Agent SDK client & agent config design

- Define how to instantiate the Agent SDK client (equivalent to current `new Anthropic(...)`).
- Decide on an `Agent` configuration:
  - Model (e.g., `claude-3-7-sonnet` equivalent).
  - System prompt (based on `BASE_SYSTEM_PROMPT`, possibly updated for new tools).
  - Tools (from unified registry).
  - Limits: max turns, token budgets.

### C2. AgentSdkAgentRunner.runChat behaviour

- Map `/api/agent/chat` request fields to Agent SDK calls:
  - `message` → initial/user message.
  - `history` → prior messages.
  - `collectionId` → part of system or per-call context.
- Decide how to:
  - Feed history into the Agent SDK (messages or conversation state).
  - Run a single logical “turn” (call) that may internally perform multiple tool uses.
  - Extract the final assistant message and tool call information for the response.

### C3. Tool execution & context

- Plan how the Agent SDK will call tools and how executors receive:
  - `db` connection.
  - `collectionId`.
  - MCP clients (if needed).

### C4. Usage & logging

- Decide how to aggregate usage (tokens) from the Agent SDK responses into `usage` fields that match current `AgentChatResult`.

**Exit Criteria (Phase C):**

- Clear design for `AgentSdkAgentRunner`, including interaction with history, tools, and usage.
- Plan for maintaining compatibility with current `/api/agent/chat` response shape.

---

### Phase D — Tools Expansion for Synthesis & MCP

**Goal:** Expand the set of tools to cover all key operations Synthesis and your coding agents need, including new-phase features and external MCP servers.

### D1. Core RAG tools

- `search_rag` — existing.
- `search_hybrid`, `search_code`, `search_docs` — optional specialized variants.
- `get_document_chunks`, `get_related_files` — for direct context retrieval.

### D2. Collection & document management tools

- `list_collections`, `create_collection`, `delete_collection`.
- `list_documents`, `get_document`, `delete_document`.
- `add_document_from_file`, `add_document_from_url`.

### D3. Doc lifecycle tools (from new-phases plans)

- `refresh_document` — triggers re-ingestion of a stale document.
- `mark_document_stale` / `check_document_freshness` — for scheduled jobs.
- `update_document_metadata` — allows manual metadata edits.

### D4. Repo ingestion & sync tools (from extended tech stack plan)

- `add_repo_to_collection` — clone & ingest a repo.
- `sync_repo` — pull & diff to update changed files only.
- Optional: `list_repos`, `get_repo_status` for monitoring.

### D5. External MCP / Context7 tools

- `context7_search_docs` — call Context7 MCP server for library/framework docs.
- `new_phases_plan_lookup` — query the `@new-phases` MCP server for future plans.
- `synthesis_mcp_search` — self-call to Synthesis MCP from within the Agent SDK for meta workflows.

### D6. Utility tools

- `log_feedback` — record thumbs up/down on answers.
- `report_issue` — create an issue stub in a repo or internal log.

**Exit Criteria (Phase D):**

- A catalog of tools and their input/output shapes is defined.
- Each tool is mapped to an existing or planned backend/service function.

---

### Phase E — MCP Servers and Integration

**Goal:** Ensure MCP servers align with the new tool design and are easily callable by the Agent SDK.

### E1. Synthesis MCP alignment

- Verify the Synthesis MCP server exposes:
  - Search operations.
  - Collection/document listing and management.
  - Ingestion operations.
- Plan MCP tool descriptions that match the Agent SDK tools where practical.

### E2. New MCP servers

- `new-phases` MCP:
  - Expose planning docs from `docs/new-phases` and `docs/agent-sdk`.
  - Tools for “get plan for X”, “list phases for Y”, etc.

- Context7-like MCP:
  - Tools to search doc sets for libraries/frameworks by name, version, and topic.

### E3. Agent SDK integration

- For each MCP server, decide how to:
  - Instantiate a client (HTTP/MCP transport).
  - Wire it into tool executors.

**Exit Criteria (Phase E):**

- Design for MCP integration via tools is clear.
- MCP servers’ responsibilities and boundaries are well understood.

---

### Phase F — Testing, Rollout, and Cleanup

**Goal:** Adopt the Agent SDK implementation safely and gradually.

### F1. Dual-mode testing strategy

- Keep both `MessagesApiAgentRunner` and `AgentSdkAgentRunner` implementations available.
- Add tests that:
  - Exercise the same scenarios against both implementations.
  - Compare outputs for core behaviour (allowing some flexibility in wording).

### F2. Rollout strategy

- Development / staging:
  - Use `AGENT_IMPLEMENTATION=agent-sdk`.
  - Run regression tests and manual scenarios.

- Production (for you / early adopters):
  - Start with `AGENT_IMPLEMENTATION=messages`.
  - Gradually enable `agent-sdk` in a controlled environment.

### F3. Cleanup (optional, later)

- Once satisfied, optionally:
  - Make `agent-sdk` the default implementation.
  - Keep the messages-based implementation as a fallback or remove it if no longer needed.

**Exit Criteria (Phase F):**

- Agent SDK implementation is stable and optionally the default.
- The system still feels simple and not over-engineered.

---

### Summary

This build plan keeps the migration **incremental** and **contained**:

- Phase A–C focus on abstraction and new Agent SDK runner.
- Phase B & D define and expand tools in a unified way.
- Phase E integrates MCP servers and external knowledge sources.
- Phase F handles testing and gradual rollout.

A future implementation agent can take these phases, create more detailed day-by-day tasks, and implement them without disrupting Synthesis’s overall architecture or over-complicating the design.