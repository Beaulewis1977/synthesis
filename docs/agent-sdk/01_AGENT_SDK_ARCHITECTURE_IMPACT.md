## Agent SDK Architecture Impact

**Version:** 1.0  
**Date:** 2025-11-13

---

### 1. Current Architecture (Relevant Parts)

This section focuses on the parts of Synthesis that will be affected by migrating to the Agent SDK.

#### 1.1 Agent Layer (Server)

- **File:** `apps/server/src/agent/agent.ts`
  - Contains `runAgentChat(db, params)` which:
    - Instantiates `new Anthropic({ apiKey })` from `@anthropic-ai/sdk`.
    - Builds a `system` prompt and `messages` (history + new user message).
    - Calls `anthropic.messages.create` in a loop.
    - Processes `tool_use` blocks and executes local tools via `buildAgentTools`.
    - Adds `tool_result` blocks back into the conversation.
    - Returns `AgentChatResult` (assistant message, toolCalls, history, usage).

- **File:** `apps/server/src/agent/tools.ts` (not shown here, but referenced)
  - Exposes `buildAgentTools(db, { collectionId })`:
    - Returns `tools` (definitions) and `toolExecutors` (functions) for operations like search, ingest, etc.

- **File:** `apps/server/src/routes/agent.ts`
  - Defines HTTP routes:
    - `POST /api/agent/chat` → calls `runAgentChat(getPool(), { ... })`.
    - `POST /api/agent/fetch-web-content` → uses `fetchWebContent` service.
    - `POST /api/agent/delete-document` → uses `deleteDocumentById`.

#### 1.2 MCP Server(s)

- **File:** `apps/mcp/src/index.ts` (not shown here, but referenced in docs)
  - Implements the MCP server for Synthesis.
  - Currently uses an API client to call the Synthesis HTTP API endpoints.
  - Tools (MCP) map to backend operations (search, list collections/docs, ingest, etc.).

#### 1.3 RAG & Services (Unchanged)

- Search, ingest, synthesis, cost tracking, and code intelligence services under `apps/server/src/services/` and the DB package `packages/db` **do not need to change** for Agent SDK migration:
  - The Agent SDK will call these operations via tools; their internal implementations remain as they are.

---

### 2. Target Architecture with Agent SDK

We want to introduce the **Agent SDK** while keeping the rest of the system mostly intact.

#### 2.1 New “Agent Runner” Abstraction

Introduce an internal interface (not implemented yet, just design):

```ts
interface AgentRunner {
  runChat(params: {
    message: string;
    collectionId: string;
    history?: { role: 'user' | 'assistant'; content: string }[];
    // optional extended context (e.g. user id, MCP server configs)
    context?: Record<string, unknown>;
  }): Promise<{
    message: string;
    toolCalls: AgentToolCall[];
    history: AgentConversationMessage[];
    usage?: Record<string, unknown>;
  }>;
}
```

Two implementations:

- `MessagesApiAgentRunner` (existing behaviour):
  - Wraps the current `runAgentChat` logic using `@anthropic-ai/sdk`.
  - Used as default during migration.

- `AgentSdkAgentRunner` (new):
  - Uses the Claude Agent SDK to:
    - Define tools.
    - Run an agent with your existing `system` prompt and history.
    - Let the Agent SDK handle tool selection, loops, and state.

`apps/server/src/routes/agent.ts` would depend only on the `AgentRunner` interface, not on `@anthropic-ai/sdk` directly.

#### 2.2 Tool Definition Layer

Today, `buildAgentTools` returns:

- `tools`: definitions compatible with `messages.create`.
- `toolExecutors`: local functions.

With the Agent SDK, tools will also be registered in the Agent SDK format. To avoid duplication:

- Introduce a **single source of truth** for tool definitions and executors, e.g.:

```ts
interface AgentToolDefinition {
  name: string;
  description: string;
  inputSchema: unknown; // zod schema or JSON schema
  executor: (input: unknown, ctx: ToolContext) => Promise<unknown>;
}

interface ToolContext {
  db: Pool;
  collectionId?: string;
  // potential MCP clients, settings, etc.
}
```

- Provide **adapters**:
  - For the TypeScript SDK:
    - Convert `AgentToolDefinition` into the Messages API `tools` format and map executors as today.
  - For the Agent SDK:
    - Register these tools directly with the Agent SDK using its native tool registration APIs.

This keeps tools defined once and usable by either agent runner implementation.

#### 2.3 MCP Servers & External Tools

We want multiple MCP servers and external tools to be first-class in the Agent SDK:

- **Synthesis MCP** (existing):
  - Exposes core Synthesis operations (search, ingest, list/manage collections/docs) to external agents.

- **New MCP servers** (planned):
  - `@new-phases` MCP: exposes planning docs and roadmaps.
  - Context7-like MCP: exposes external library/framework docs via the Context7 platform (or similar) so the agent can pull library-specific context.

**Agent SDK integration:**

- The Agent runner can expose tools that internally call MCP servers:
  - For example, a `context7_search_docs` tool that calls the Context7 MCP server.
  - A `new_phases_plan_lookup` tool that queries the `@new-phases` MCP server for build plans.
- These tools are just **functions** from the Agent SDK’s perspective; MCP is an implementation detail inside the tool executor.

---

### 3. Minimal Changes by Layer

#### 3.1 HTTP Layer (`apps/server/src/routes/agent.ts`)

Minimal changes:

- Replace direct calls to `runAgentChat` with a call to a configured `AgentRunner` instance.
- Optionally add support for new parameters (e.g. agent profile, tools toggle) via non-breaking additions to the request schema.

#### 3.2 Agent Layer (`apps/server/src/agent/agent.ts`)

Refactoring steps (conceptual):

1. Extract the `BASE_SYSTEM_PROMPT` and history handling into a shared `AgentConfig` module.
2. Turn `runAgentChat` into a wrapper behind `AgentRunner`.
3. Implement the `AgentSdkAgentRunner` using the Agent SDK’s recommended usage:
   - Instantiate an Agent with:
     - `system` (existing base prompt, possibly updated for new tools).
     - Tools from the unified tool registry.
   - Use the Agent SDK’s multi-turn interaction to process a single `/api/agent/chat` request, using the provided history.

#### 3.3 Tool Layer (`apps/server/src/agent/tools.ts` and services)

- Define tools in a **framework-neutral** shape (see `AgentToolDefinition` above).
- Maintain a mapping from tool name → executor and schema, reusing existing services:
  - Search RAG (hybrid/BM25/embedding).
  - Ingest from file/URL.
  - Collection & document management.
  - Doc lifecycle (refresh, mark stale, etc.).
  - Repo ingestion and sync (planned in extended roadmap).
  - External MCP calls (Context7, `@new-phases`, etc.).

#### 3.4 MCP Layer (`apps/mcp`)

- No major architecture changes required:
  - Continue to offer MCP tools that call Synthesis HTTP endpoints.
- For the Agent SDK migration, treat MCP servers as **downstream resources** the agent can call via tools.

---

### 4. Configuration and Environment

To keep the migration safe and flexible:

- Introduce configuration flags:

```bash
# Use the legacy messages-based agent runner
AGENT_IMPLEMENTATION=messages

# Switch to Agent SDK based runner
AGENT_IMPLEMENTATION=agent-sdk
```

- Keep `ANTHROPIC_API_KEY` as the single source of truth for authentication for both implementations.
- Add optional config for MCP servers used by tools:

```bash
# Example
CONTEXT7_MCP_SERVER_URL=...
NEW_PHASES_MCP_SERVER_URL=...
SYNTHESIS_MCP_SERVER_URL=...
```

---

### 5. Non-Goals (to avoid over-engineering)

- Do **not**:
  - Build a generic plugin system for agents.
  - Introduce multiple competing agent frameworks at the same time.
  - Create a separate microservice just to host the agent logic.

- Do instead:
  - Keep the agent implementation inside the existing server app.
  - Use a simple `AgentRunner` interface and two concrete implementations.
  - Use tool definitions as the main extension point.

---

### 6. Summary

- The migration is mostly **localised** to:
  - `apps/server/src/agent/agent.ts` (agent loop)
  - `apps/server/src/agent/tools.ts` (tool definitions)
  - `apps/server/src/routes/agent.ts` (HTTP entrypoint)
- RAG services, DB schema, MCP server, and frontend remain largely unchanged.
- Introducing a clean `AgentRunner` abstraction and a unified tool registry allows Synthesis to:
  - Keep the existing messages-based implementation.
  - Gradually adopt the Claude Agent SDK.
  - Add richer tools and MCP integrations (Context7, new-phases) without over-engineering.