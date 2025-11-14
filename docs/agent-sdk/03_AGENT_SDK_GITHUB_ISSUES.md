## Agent SDK Migration — Proposed GitHub Issues

**Version:** 1.0  
**Date:** 2025-11-13

---

### Overview

This document defines a set of **proposed GitHub issues** for the Agent SDK migration and related tool/MCP work. These are not created yet; they are templates that can be copied into GitHub later.

Suggested labels:

- `agent-sdk`
- `refactor`
- `feature`
- `mcp`
- `priority:high` / `priority:medium`

Milestone name (example, to avoid confusion with existing phases):

- `Milestone: Agent SDK Migration`

---

### Issue 1 — Refactor Agent Layer to AgentRunner Abstraction

**Title:** `refactor(agent): Introduce AgentRunner abstraction and keep messages-based implementation`

**Labels:** `agent-sdk`, `refactor`, `priority:high`

**Description:**

Refactor the current agent implementation to use a pluggable `AgentRunner` abstraction while preserving the existing `@anthropic-ai/sdk` Messages API behaviour.

**Acceptance Criteria:**

- [ ] A `AgentRunner` interface is defined (or equivalent) representing `runChat` behaviour.
- [ ] `MessagesApiAgentRunner` wraps the existing `runAgentChat` logic.
- [ ] `apps/server/src/routes/agent.ts` uses `AgentRunner` rather than calling `runAgentChat` directly.
- [ ] Configuration is added to select the implementation (e.g., `AGENT_IMPLEMENTATION=messages`).
- [ ] All existing tests for agent routes and `runAgentChat` pass unchanged.

**References:**

- `docs/agent-sdk/00_AGENT_SDK_OVERVIEW.md`
- `docs/agent-sdk/01_AGENT_SDK_ARCHITECTURE_IMPACT.md`
- `apps/server/src/agent/agent.ts`
- `apps/server/src/routes/agent.ts`

---

### Issue 2 — Create Unified Tool Registry

**Title:** `feat(agent): Define unified tool registry for agent and MCP`

**Labels:** `agent-sdk`, `feature`, `priority:high`

**Description:**

Define a single source of truth for Synthesis tools (search, ingest, management, etc.) that can be used by:

- The existing messages-based agent implementation.
- The new Agent SDK-based agent implementation.
- MCP servers (where appropriate).

**Acceptance Criteria:**

- [ ] An `AgentToolDefinition` type is created with `name`, `description`, `inputSchema`, and `executor`.
- [ ] Existing tools from `buildAgentTools` are mapped into this registry.
- [ ] Adapters exist to:
  - [ ] Convert the registry to Messages API `tools` format + executor map.
  - [ ] Prepare tool definitions for Agent SDK registration.
- [ ] No behaviour change for the current `/api/agent/chat` route.

**References:**

- `docs/agent-sdk/01_AGENT_SDK_ARCHITECTURE_IMPACT.md`
- `docs/agent-sdk/02_AGENT_SDK_BUILD_PLAN.md` (Phase B)

---

### Issue 3 — Implement AgentSdkAgentRunner (Behind Flag)

**Title:** `feat(agent-sdk): Implement AgentSdkAgentRunner behind feature flag`

**Labels:** `agent-sdk`, `feature`, `priority:high`

**Description:**

Implement an `AgentSdkAgentRunner` using the Claude Agent SDK that mirrors the behaviour of the existing messages-based agent. Keep this behind a feature flag and do not enable it in production initially.

**Acceptance Criteria:**

- [ ] Agent SDK client initialization is implemented (using `ANTHROPIC_API_KEY`).
- [ ] `AgentSdkAgentRunner.runChat` accepts `message`, `history`, and `collectionId` and returns a result compatible with `AgentChatResult`.
- [ ] Tools from the unified registry are registered with the Agent SDK.
- [ ] Internal multi-turn reasoning is handled by the Agent SDK (no manual tool loop).
- [ ] Configuration `AGENT_IMPLEMENTATION=agent-sdk` selects this runner.
- [ ] Tests verify basic parity with the messages-based implementation for core scenarios.

**References:**

- `docs/agent-sdk/01_AGENT_SDK_ARCHITECTURE_IMPACT.md`
- `docs/agent-sdk/02_AGENT_SDK_BUILD_PLAN.md` (Phase C)
- Claude Agent SDK docs: `https://docs.claude.com/en/docs/agent-sdk/overview`

---

### Issue 4 — Expand Tools for RAG, Lifecycle, and Repos

**Title:** `feat(agent-sdk): Expand tool set for RAG, lifecycle, and repo ingestion`

**Labels:** `agent-sdk`, `feature`, `priority:medium`

**Description:**

Expand the tool registry to cover all important Synthesis operations for your coding agents, including RAG, document lifecycle management, and repo ingestion/sync.

**Acceptance Criteria:**

- [ ] RAG tools added: `search_rag`, `search_code`, `get_document_chunks`, `get_related_files`.
- [ ] Collection tools: `list_collections`, `create_collection`, `delete_collection`.
- [ ] Document tools: `list_documents`, `get_document`, `add_document_from_url`, `delete_document`.
- [ ] Lifecycle tools: `refresh_document`, `check_document_freshness`, `update_document_metadata`.
- [ ] Repo tools: `add_repo_to_collection`, `sync_repo`, `get_repo_status`.
- [ ] Each tool is wired to an existing (or planned) backend service.

**References:**

- `docs/new-phases/01_BUILD_PLAN.md`
- `docs/new-phases/07_EXTENDED_TECH_STACK_AND_REPO_INGESTION_PLAN.md`
- `docs/agent-sdk/02_AGENT_SDK_BUILD_PLAN.md` (Phase D)

---

### Issue 5 — Integrate MCP Servers (Synthesis, new-phases, Context7)

**Title:** `feat(mcp): Integrate Synthesis, new-phases, and Context7 MCP servers into agent tools`

**Labels:** `agent-sdk`, `mcp`, `feature`, `priority:medium`

**Description:**

Integrate multiple MCP servers into the Agent SDK via tools so the agent can:

- Query Synthesis itself via MCP (meta workflows).
- Use `@new-phases` MCP to look up future plans and docs.
- Use a Context7-like MCP server to retrieve external library and framework docs.

**Acceptance Criteria:**

- [ ] Existing Synthesis MCP server is inventoried and documented.
- [ ] `new-phases` MCP server is designed (or implemented) with tools that expose planning docs.
- [ ] Context7-style MCP client is designed for external doc search.
- [ ] Agent tools are added:
  - [ ] `synthesis_mcp_search`
  - [ ] `new_phases_plan_lookup`
  - [ ] `context7_search_docs`
- [ ] Tools are usable by both Messages API and Agent SDK implementations.

**References:**

- `docs/new-phases/06_PHASE_15_17_STATUS_REPORT.md`
- `docs/new-phases/07_EXTENDED_TECH_STACK_AND_REPO_INGESTION_PLAN.md`
- `docs/agent-sdk/02_AGENT_SDK_BUILD_PLAN.md` (Phase E)

---

### Issue 6 — Dual-Mode Testing & Rollout

**Title:** `chore(agent-sdk): Add dual-mode tests and rollout strategy for Agent SDK`

**Labels:** `agent-sdk`, `refactor`, `priority:medium`

**Description:**

Ensure safe rollout of the Agent SDK implementation by running both implementations side-by-side in tests and providing a clear deployment strategy.

**Acceptance Criteria:**

- [ ] Tests exist that can run key scenarios with both `MessagesApiAgentRunner` and `AgentSdkAgentRunner`.
- [ ] Differences in wording are tolerated but core behaviour (tool usage, outcomes) is validated.
- [ ] Configuration-driven selection (`AGENT_IMPLEMENTATION`) is documented.
- [ ] A brief rollout plan is documented in `docs/agent-sdk/02_AGENT_SDK_BUILD_PLAN.md`.

**References:**

- `docs/agent-sdk/02_AGENT_SDK_BUILD_PLAN.md` (Phase F)

---

### Issue 7 — Update Documentation for Agent SDK Migration

**Title:** `docs(agent-sdk): Document Agent SDK architecture and usage`

**Labels:** `agent-sdk`, `documentation`, `priority:medium`

**Description:**

Update documentation to explain the new Agent SDK-based architecture and how tools, MCP servers, and agents fit together.

**Acceptance Criteria:**

- [ ] `docs/agent-sdk/00_AGENT_SDK_OVERVIEW.md` is finalized to match implementation.
- [ ] `docs/agent-sdk/01_AGENT_SDK_ARCHITECTURE_IMPACT.md` reflects actual architecture.
- [ ] Main architecture docs (`docs/02_ARCHITECTURE.md`, `docs/04_AGENT_TOOLS.md`) are updated with the new agent layer design.
- [ ] New-phase docs that reference agents and tools are cross-linked to the Agent SDK docs.

**References:**

- `docs/agent-sdk/*`
- `docs/04_AGENT_TOOLS.md`
- `docs/02_ARCHITECTURE.md`

---

### Issue 8 — (Optional) Remove Legacy Messages-Based Implementation

**Title:** `chore(agent-sdk): Remove legacy messages-based Agent implementation (optional)`

**Labels:** `agent-sdk`, `refactor`, `priority:low`

**Description:**

After the Agent SDK implementation has been stable for a while, consider removing the legacy messages-based agent implementation to simplify the codebase.

**Acceptance Criteria:**

- [ ] Decision is made whether to keep or remove the messages-based implementation.
- [ ] If removed, all references to the old implementation are deleted.
- [ ] Tests and docs are updated accordingly.

**References:**

- Previous issues in this document.
- `docs/agent-sdk/02_AGENT_SDK_BUILD_PLAN.md` (Phase F)

---

### Notes

- These issues are intentionally high-level and should be broken down further by an implementation agent if needed.
- They are designed to avoid over-engineering by focusing on:
  - A single `AgentRunner` abstraction.
  - A unified tool registry.
  - Incremental adoption of the Agent SDK.
  - Clear boundaries between the agent layer, RAG services, and MCP servers.