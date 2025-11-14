## Agent SDK Migration Overview

**Version:** 1.0  
**Date:** 2025-11-13

---

### Purpose

This document provides a high-level overview for migrating Synthesis from the low-level Anthropic TypeScript SDK (`@anthropic-ai/sdk`) to the higher-level Claude Agent SDK (Agent API), and for introducing richer tool orchestration and dedicated MCP servers (e.g. Context7, Synthesis MCP, new-phases MCP).

The goal is to:

- Keep Synthesis **simple and not over-engineered**.
- Preserve the existing RAG pipeline and HTTP API surface.
- Move the internal “Claude agent” implementation to the Agent SDK over time.
- Expose all important operations (search, ingest, doc lifecycle, repo sync, etc.) as **Agent tools** and as **MCP servers**.

This folder (`docs/agent-sdk`) contains the planning docs an implementation agent will need (phases, build plans, prompts, and GitHub issue templates).

---

### Current Agent Implementation (as of v2.0 planning)

From `apps/server/src/agent/agent.ts`:

- Synthesis currently uses `@anthropic-ai/sdk` directly:
  - `import Anthropic from '@anthropic-ai/sdk';`
  - `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })`.
  - `anthropic.messages.create(...)` to run a manual agent loop.
- The loop is implemented by `runAgentChat`:
  - It builds a **system prompt** (`BASE_SYSTEM_PROMPT`) that describes an autonomous RAG assistant for collections.
  - It uses `buildAgentTools(db, { collectionId })` to get:
    - `tools` (tool definitions in Anthropic Messages API format).
    - `toolExecutors` (local functions to run when Claude emits `tool_use` blocks).
  - It sends `messages` (history + new user message) and `tools` into `messages.create`.
  - It parses `tool_use` blocks, calls local executors, and sends `tool_result` blocks back as user messages.
  - It loops up to `maxTurns` (10), updating usage totals and the final assistant message.

From `apps/server/src/routes/agent.ts`:

- HTTP route `/api/agent/chat` validates input and calls `runAgentChat` with:
  - `message` (user message),
  - `collectionId`,
  - `history` (prior user/assistant messages).
- The route then sends back:
  - `message` (assistant text),
  - `tool_calls` (local record of tool calls),
  - `history`,
  - `usage` (token counts).

Tests (`apps/server/src/agent/__tests__/agent.test.ts`, `.../routes/__tests__/agent.test.ts`) mock `@anthropic-ai/sdk` and verify this loop.

**Key point:** Synthesis already has a structured internal “agent loop” and a set of tools. The migration is mostly about swapping the low-level `messages.create` loop for the Agent SDK’s agent runtime, not redesigning the entire system.

---

### Claude TypeScript SDK vs Agent SDK

**`@anthropic-ai/sdk` (TypeScript SDK)**

- Low-level, typed HTTP client for Claude’s API [as described in its repo](https://github.com/anthropics/anthropic-sdk-typescript).
- You directly call `client.messages.create({...})` and manage:
  - Messages and roles.
  - Tool definitions and `tool_use` / `tool_result` parsing.
  - Multi-turn loops, retries, streaming, and error handling.
- Advantages:
  - Simple dependency.
  - Full control over prompt and flow.
- Disadvantages for Synthesis’s goals:
  - More boilerplate for multi-step workflows.
  - Every new tool and flow requires more custom control logic.

## Claude Agent SDK (Agent API)

- Higher-level **agent framework** built on top of the same underlying API [see Claude Agent SDK docs](https://docs.claude.com/en/docs/agent-sdk/overview).
- You define:
  - Tools (name, description, schema, executor function).
  - An Agent configuration (model, system prompt, tools, limits, etc.).
- The Agent SDK manages:
  - Multi-turn reasoning loops.
  - Tool selection and invocation.
  - State between steps.
- Advantages for Synthesis:
  - Less custom glue code for tool orchestration.
  - Easier to add more complex, long-running workflows (e.g. ingestion agents, doc lifecycle jobs) without re-writing the loop.
  - More natural expression of “autonomous” behaviours.

**Design decision:** For Synthesis, the Agent SDK should eventually become the **primary runtime** for agentic workflows (e.g. ingestion, doc maintenance, tool orchestration), while the TypeScript SDK can remain as a low-level client where direct calls are simpler or needed.

---

### Scope of Agent SDK Migration

The migration should:

1. **Preserve the HTTP API and core RAG pipeline**
   - `/api/agent/chat` should keep the same contract as much as possible (or be extended carefully).
   - `/api/search`, `/api/ingest`, `/api/docs`, `/api/synthesis/compare`, `/api/costs/*` continue to work the same.

2. **Refactor the internal “agent layer” behind a clean abstraction**
   - Introduce an internal interface like `AgentRunner` or `ClaudeAgentClient` with a method like:
     - `run({ message, history, collectionId, context }): Promise<AgentChatResult>`.
   - Provide two implementations:
     - `MessagesApiAgentRunner` (current implementation using `@anthropic-ai/sdk`).
     - `AgentSdkAgentRunner` (new implementation using Claude Agent SDK).
   - Allow configuration/feature flag to choose implementation per environment.

3. **Model Synthesis operations as Agent tools**
   - Tools for:
     - Search & RAG (search_rag, hybrid search variants).
     - Document ingestion, re-ingestion, deletion.
     - Collection management (list/create/delete collections, list documents).
     - Doc lifecycle (marking stale, refreshing, updating metadata).
     - Repo ingestion and sync.
     - External MCP servers (Context7, codebase explorers, etc.).

4. **Integrate MCP servers cleanly**
   - Keep Synthesis’s MCP server(s) as first-class.
   - Add dedicated MCP servers for:
     - `@new-phases` (future features and planning docs).
     - Context7-like external knowledge sources (e.g. libraries, frameworks).
   - Make these available as tools to the Agent SDK agent.

---

### Design Constraints

- **No over-engineering**
  - Do not introduce a complex plugin system or generic “agent-of-agents” architecture.
  - Keep the number of abstraction layers minimal:
    - HTTP routes → Agent runner → Agent SDK or TS SDK → Claude.

- **Incremental migration**
  - Maintain the existing TS SDK implementation until the Agent SDK version is stable.
  - Use a configuration flag (env var) to switch implementations.

- **Backwards compatibility**
  - Keep existing APIs and behaviours working for current users and agents.
  - New features (e.g. advanced workflows) can depend on the Agent SDK behind feature flags.

---

### Documents in this Folder

This folder will contain the following docs (high-level, no code):

- `00_AGENT_SDK_OVERVIEW.md` (this file): summary and goals.
- `01_AGENT_SDK_ARCHITECTURE_IMPACT.md`: which modules change, new abstractions, and tool design.
- `02_AGENT_SDK_BUILD_PLAN.md`: phases, steps, and concrete tasks for migration and new tools/MCP servers.
- `03_AGENT_SDK_GITHUB_ISSUES.md`: proposed GitHub issues with titles, labels, and acceptance criteria.
- `04_AGENT_SDK_PHASE_PROMPTS.md`: suggested agent prompts for each phase so an implementation agent knows how to operate.

These docs are intentionally **high-level** and meant to be turned into implementation steps later by an agent, without over-complicating the design.
