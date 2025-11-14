## Agent SDK Migration — Phase Prompts for Implementation Agents

**Version:** 1.0  
**Date:** 2025-11-13

---

### Purpose

This document provides **prompt templates** for each planned phase of the Agent SDK migration work. The idea is that you (or a future implementation agent) can:

- Pick a phase.
- Use the corresponding prompt as the system/user instructions.
- Execute that phase’s work with clear constraints (no over-engineering, no scope creep).

These prompts assume the agent already has access to the Synthesis codebase and documentation.

---

### General System Prompt (for all phases)

You can reuse this as a base system prompt, then add a phase-specific section.

> **System Prompt (base)**  
> You are an experienced TypeScript backend engineer working on the Synthesis project.  
> Synthesis is a RAG system with a Fastify backend, React frontend, PostgreSQL/pgvector, and a Claude-based agent layer.  
> The current agent is implemented using the `@anthropic-ai/sdk` Messages API with a manual tool-use loop; we want to migrate to the Claude Agent SDK (Agent API) gradually while keeping the system simple and not over-engineered.  
> You must carefully follow the design and constraints in `docs/agent-sdk/*`, `docs/new-phases/*`, and the existing architecture docs.  
> In this phase, you will work strictly within the scope defined in the phase-specific instructions.  
> Do not introduce new abstractions beyond what is planned unless absolutely necessary and justified in comments.  
> Prefer small, incremental changes and keep public APIs stable.  
> When in doubt, favor clarity and maintainability over cleverness.

---

### Phase A — Baseline Audit & Abstractions

> **User Prompt (Phase A)**  
> Phase: A — Baseline Audit & Abstractions.  
> Objective: Understand the current agent implementation and introduce a minimal `AgentRunner` abstraction without changing behaviour.  
> 
> 1. Read these docs and files carefully:  
>    - `docs/agent-sdk/00_AGENT_SDK_OVERVIEW.md`  
>    - `docs/agent-sdk/01_AGENT_SDK_ARCHITECTURE_IMPACT.md`  
>    - `apps/server/src/agent/agent.ts`  
>    - `apps/server/src/agent/tools.ts`  
>    - `apps/server/src/routes/agent.ts`  
>    - Agent-related tests under `apps/server/src/agent/__tests__/` and `apps/server/src/routes/__tests__/agent.test.ts`.  
> 2. Introduce an internal `AgentRunner` interface that abstracts `runChat` behaviour, as described in the docs, but keep the existing messages-based implementation intact.  
> 3. Implement `MessagesApiAgentRunner` as a thin wrapper around the existing `runAgentChat` logic.  
> 4. Update `apps/server/src/routes/agent.ts` to depend on `AgentRunner` instead of calling `runAgentChat` directly.  
> 5. Add configuration (e.g., `AGENT_IMPLEMENTATION`) but default to the current messages-based implementation.  
> 6. Do not yet introduce the Agent SDK or change any tool definitions in this phase.  
> 7. Ensure all existing tests still pass and add tests only where necessary to validate the new abstraction.  
> 
> Constraints:  
> - No over-engineering: do not add more layers than `AgentRunner` + `MessagesApiAgentRunner`.  
> - No behavioural changes: the HTTP API and agent behaviour should be identical.  
> - Keep changes local to the agent layer and routes.

---

### Phase B — Unified Tool Registry

> **User Prompt (Phase B)**  
> Phase: B — Unified Tool Registry.  
> Objective: Create a single tool registry used by both the messages-based agent and the future Agent SDK agent.  
> 
> 1. Read:  
>    - `docs/agent-sdk/01_AGENT_SDK_ARCHITECTURE_IMPACT.md` (tool registry section).  
>    - `docs/agent-sdk/02_AGENT_SDK_BUILD_PLAN.md` (Phase B).  
>    - `apps/server/src/agent/tools.ts`.  
> 2. Design and implement an `AgentToolDefinition` type and any necessary supporting types (e.g., `ToolContext`).  
> 3. Refactor `buildAgentTools` (or equivalent) to construct a list of `AgentToolDefinition` instances instead of ad-hoc structures.  
> 4. Implement an adapter that converts `AgentToolDefinition[]` into:  
>    - The Messages API `tools` format, and  
>    - A map of tool executors keyed by name.  
> 5. Update the existing messages-based agent implementation to use this registry and adapter.  
> 6. Do not implement Agent SDK usage yet in this phase.  
> 7. Ensure no changes to tool behaviour; all tests must still pass.  
> 
> Constraints:  
> - Minimal changes: reuse existing executors and service functions.  
> - No new tools yet; simply re-model the current ones.  
> - Avoid circular dependencies between registry, agent, and MCP.

---

### Phase C — AgentSdkAgentRunner Implementation

> **User Prompt (Phase C)**  
> Phase: C — AgentSdkAgentRunner Implementation.  
> Objective: Implement `AgentSdkAgentRunner` using the Claude Agent SDK, behind a feature flag, while preserving compatibility.  
> 
> 1. Read:  
>    - `docs/agent-sdk/01_AGENT_SDK_ARCHITECTURE_IMPACT.md` (AgentSdkAgentRunner section).  
>    - `docs/agent-sdk/02_AGENT_SDK_BUILD_PLAN.md` (Phase C).  
>    - Claude Agent SDK docs: `https://docs.claude.com/en/docs/agent-sdk/overview`.  
> 2. Implement `AgentSdkAgentRunner` that:  
>    - Uses the same `AgentRunner` interface.  
>    - Accepts `message`, `history`, and `collectionId`.  
>    - Uses the unified tool registry to register tools with the Agent SDK.  
>    - Runs a single logical agent interaction corresponding to one `/api/agent/chat` call.  
> 3. Map the Agent SDK’s responses back to the existing `AgentChatResult` shape (message, toolCalls, history, usage).  
> 4. Wire the `AGENT_IMPLEMENTATION` config so that `agent-sdk` selects this new runner.  
> 5. Add basic tests that run a few happy-path scenarios through both runner implementations and compare behaviour.  
> 
> Constraints:  
> - Do not change the HTTP API.  
> - Do not remove the messages-based implementation.  
> - Keep the number of Agent SDK–specific abstractions small; favor direct usage of its recommended patterns.

---

### Phase D — Tools Expansion (RAG, Lifecycle, Repos, External)

> **User Prompt (Phase D)**  
> Phase: D — Tools Expansion.  
> Objective: Extend the tool registry to cover core RAG operations, lifecycle management, repo ingestion/sync, and external MCP-based tools.  
> 
> 1. Read:  
>    - `docs/agent-sdk/02_AGENT_SDK_BUILD_PLAN.md` (Phase D).  
>    - `docs/new-phases/01_BUILD_PLAN.md` and `02_GITHUB_ISSUES.md`.  
>    - `docs/new-phases/07_EXTENDED_TECH_STACK_AND_REPO_INGESTION_PLAN.md`.  
> 2. For each tool described in the build plans (search, ingest, collections, documents, lifecycle, repos, external MCP), design:  
>    - A clear `name`.  
>    - A human-readable `description`.  
>    - An `inputSchema` (consider zod or JSON schema).  
>    - An `executor` that calls existing or new backend services.  
> 3. Implement these tools incrementally, keeping each change small and well-tested.  
> 4. Ensure tools are usable by **both** the messages-based runner and the Agent SDK runner through the unified registry.  
> 
> Constraints:  
> - Prefer using existing services (search, ingest, repo operations) rather than inventing new ones.  
> - Keep each tool focused; avoid mega-tools that do too many things.  
> - Maintain backwards compatibility.

---

### Phase E — MCP Integration

> **User Prompt (Phase E)**  
> Phase: E — MCP Integration.  
> Objective: Align Synthesis’s MCP servers and external MCP servers with the new tool design so the Agent SDK can call them via tools.  
> 
> 1. Read:  
>    - `apps/mcp/src/index.ts`.  
>    - `docs/new-phases/06_PHASE_15_17_STATUS_REPORT.md`.  
>    - `docs/new-phases/07_EXTENDED_TECH_STACK_AND_REPO_INGESTION_PLAN.md`.  
> 2. Inventory existing MCP tools and map them to the unified tool registry where feasible.  
> 3. Design or refine MCP servers for:  
>    - Synthesis itself.  
>    - `@new-phases` (planning docs).  
>    - Context7-like external docs.  
> 4. Implement tool executors that call these MCP servers internally, presenting them to the agent as normal tools.  
> 5. Keep the MCP protocol and server boundaries simple and focused on a few high-value operations.  
> 
> Constraints:  
> - Avoid creating an overly generic "MCP router"; tools should encapsulate MCP usage.  
> - Reuse common client logic where sensible, but avoid premature abstraction.

---

### Phase F — Dual-Mode Testing & Rollout

> **User Prompt (Phase F)**  
> Phase: F — Dual-Mode Testing & Rollout.  
> Objective: Validate the Agent SDK implementation against the legacy implementation, then roll it out safely.  
> 
> 1. Add tests that exercise both `MessagesApiAgentRunner` and `AgentSdkAgentRunner` using the same scenarios:  
>    - Basic Q&A with tools.  
>    - Multi-step RAG queries.  
>    - Repo/search/lifecycle-related tasks.  
> 2. Allow some textual variation in responses but enforce that:  
>    - The correct tools are used.  
>    - The outcomes (e.g., docs added, queries executed) are equivalent.  
> 3. Document a rollout plan (dev, staging, production) in `docs/agent-sdk/02_AGENT_SDK_BUILD_PLAN.md`.  
> 4. Help configure environments to use `AGENT_IMPLEMENTATION=agent-sdk` in staging for a while.  
> 
> Constraints:  
> - No breaking changes to public APIs.  
> - Keep configuration simple (env vars, no complex feature flag systems).  
> - Avoid over-engineering testing harnesses; focus on key flows.

---

### Usage Notes

- These prompts are deliberately **structured but flexible**. You can adapt them as you learn more or as project needs change.
- The guiding principles remain:  
> Minimal abstractions, incremental change, strong tests, and clear boundaries between agent, tools, MCP, and core RAG services.