# Sub-Phase 5.6: Dynamic Tool Management for Synthesis MCP Server

**Version:** 1.0 · **Created:** December 2025
**Parent:** `docs/gpt/PHASE_3_MCP_TASK_TOOLS_IMPLEMENTATION_PLAN.md`
**Priority:** P0 · **Est. Time:** 3-4 days

---

## Executive Summary

**Goal:** Reduce MCP tool context window footprint from ~15,800 tokens to ~2,000 tokens while maintaining full tool availability on-demand via the MCP TypeScript SDK's first-class dynamic tool management.

**Approach:** Hybrid dynamic tool management leveraging official MCP SDK features with fallback safety:
- 5 always-on gateway tools
- Toolpacks for grouped enablement
- Profiles for startup configuration
- Router with auto-enable for client compatibility
- MCP bridge as last-resort fallback

---

## 1. Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ALWAYS-ON TOOLS (~2,000 tokens)                         │
│  synthesis_discover_tools │ enable_tools │ synthesis_router │               │
│  synthesis_mcp_bridge     │ synthesis_search                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TOOLPACKS & CATEGORIES                              │
│  mobile_core: search_mobile_docs, find_code_examples, get_feature_recipe    │
│  introspection: get_project_tech_stack, get_db_schema, find_symbol_usages   │
│  graphing: graph_expand_context                                             │
│  core: list_collections, list_documents, create_collection, delete_*, etc.  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ON-DEMAND TOOLS (registered but disabled)                │
│  Agent calls enable_tools → tools enabled → notifications/tools/list_changed│
│  Router with auto-enable fallback for clients that ignore updates           │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Runtime Compatibility:** Synthesis MCP is model-agnostic and works with:
- Anthropic Claude Code CLI / Claude Desktop (Windows/WSL2)
- Google Gemini CLI (WSL2)
- GPT Codex CLI (WSL2)
- Any MCP-compliant client

Dynamic features (enable_tools, notifications) are optional optimizations.

---

## 2. Tool Selection Policy (Strict Order)

Agents using Synthesis MCP tools MUST follow this cascading policy:

1. **Prefer native typed tools** currently visible in the tool list
2. **If needed tool isn't visible**, call `synthesis_discover_tools({ task })` to get recommendations
3. **Enable with** `enable_tools({ toolpacks | categories | tools })`
4. **If still not visible** (client may ignore updates), call `synthesis_router({ action, params })`
5. **If router is gated or unsuitable**, use `synthesis_mcp_bridge` to call MCP server tool directly

> **Note:** This policy works with any MCP client. Clients that don't support
> `notifications/tools/list_changed` still function via `synthesis_router` (auto-enable).

---

## 3. Always-On Tools Specification

### 3.1 synthesis_discover_tools

```typescript
const discoverToolsInput = z.object({
  task: z.string().optional().describe('Describe what you want to accomplish - returns recommended tools/toolpacks'),
  list_all: z.boolean().optional().default(false).describe('Return full catalog of all tools and toolpacks'),
}).strict();

// Returns: { recommended: ToolRef[], toolpacks: ToolpackInfo[], categories: CategoryInfo[] }
```

**Behavior:**
- With `task`: Returns semantically matched tools and toolpacks
- With `list_all`: Returns complete catalog for agent to browse

### 3.2 enable_tools

```typescript
const enableToolsInput = z.object({
  tools: z.array(z.string()).optional().describe('Specific tool names to enable'),
  toolpacks: z.array(z.string()).optional().describe('Toolpacks to enable (e.g., "mobile_core", "introspection")'),
  categories: z.array(z.string()).optional().describe('Categories to enable (e.g., "mobile", "graph")'),
}).strict().refine(
  data => data.tools || data.toolpacks || data.categories,
  { message: 'At least one of tools, toolpacks, or categories required' }
);

// Returns: { enabled: string[], already_enabled: string[], message: string }
```

**Behavior:**
- Idempotent - enabling an already-enabled tool is a no-op
- Debounced notifications - multiple enables emit single `notifications/tools/list_changed`
- Returns metadata about what was actually enabled

### 3.3 synthesis_router

```typescript
const routerInput = z.object({
  action: z.string().describe('Tool name to execute'),
  params: z.record(z.unknown()).describe('Tool parameters (validated server-side via Zod)'),
}).strict();

// Returns: ToolResult | { error, gated: boolean, requires_enable?: string[], requires_profile?: string }
```

**Behavior (auto-enable on first use):**
- If tool is disabled, auto-enables it idempotently, then executes
- Emits `notifications/tools/list_changed` for clients that listen
- Returns metadata: `{ enabled_now: boolean, visible_to_client: boolean, tool_version: string }`
- Respects `ROUTER_SENSITIVE_ENFORCE=true` for gated tools

**Router Policy Knobs (env vars):**
- `ROUTER_MODE=auto` (default): Auto-enable on first use
- `ROUTER_MODE=respect`: Only execute enabled tools, fail otherwise
- `ROUTER_MODE=bypass`: Execute any tool without enabling (no notifications)
- `ROUTER_SENSITIVE_ENFORCE=true`: Forbid auto-enable for sensitive tools (db_schema, delete_*)

### 3.4 synthesis_mcp_bridge

```typescript
const bridgeInput = z.object({
  server: z.literal('synthesis').describe('MCP server name'),
  tool: z.string().describe('MCP tool name to call'),
  params: z.record(z.unknown()).describe('Tool parameters'),
}).strict();

// Returns: MCP tool result or error
```

**Use cases:**
- Client visibility is stale and tool isn't appearing
- Direct MCP call needed bypassing local tool registration
- Last resort when router and native tools fail

### 3.5 synthesis_search

```typescript
// Existing search_rag logic, renamed for consistency
const searchInput = z.object({
  collectionId: z.string().uuid().describe('Collection to search'),
  query: z.string().min(1).describe('Search query'),
  top_k: z.number().int().min(1).max(50).default(5),
  min_similarity: z.number().min(0).max(1).default(0.5),
}).strict();
```

**Purpose:** Always-available general search fallback.

---

## 4. Toolpacks Definition

```typescript
const TOOLPACKS = {
  mobile_core: {
    description: 'Mobile development: docs, examples, recipes',
    tools: ['search_mobile_docs', 'find_code_examples', 'get_feature_recipe'],
    default_profile: 'mobile',
  },
  introspection: {
    description: 'Project analysis: tech stack, symbols, schema',
    tools: ['get_project_tech_stack', 'get_db_schema', 'find_symbol_usages'],
    sensitive: ['get_db_schema'], // May be gated
    default_profile: 'full',
  },
  graphing: {
    description: 'Knowledge graph traversal and context expansion',
    tools: ['graph_expand_context'],
    default_profile: 'full',
  },
  core: {
    description: 'Basic RAG operations: collections, documents, repos',
    tools: [
      'list_collections', 'list_documents', 'create_collection',
      'fetch_and_add_document_from_url', 'delete_document', 'delete_collection',
      'add_repo_to_collection', 'sync_repo', 'list_repos'
    ],
    sensitive: ['delete_document', 'delete_collection'],
    default_profile: 'minimal',
  },
};
```

---

## 5. Profile System

```typescript
const PROFILES = {
  minimal: {
    description: 'Only always-on tools + basic collections',
    toolpacks: ['core'],
    tools: ['list_collections'], // Just read-only core
  },
  mobile: {
    description: 'Mobile development focused',
    toolpacks: ['mobile_core', 'core'],
    tools: [], // All tools from toolpacks
  },
  full: {
    description: 'All tools enabled',
    toolpacks: Object.keys(TOOLPACKS),
    tools: [], // Everything
  },
};

// Startup: const profile = process.env.MCP_TOOL_PROFILE || 'minimal';
```

---

## 6. Implementation Details

### 6.1 Server Initialization

```typescript
// apps/mcp/src/index.ts

const server = new McpServer(
  {
    name: 'synthesis-rag',
    version: '2.0.0', // Bump for dynamic tool support
  },
  {
    capabilities: {
      tools: { listChanged: true },
    },
    debouncedNotificationMethods: [
      'notifications/tools/list_changed',
    ],
  }
);
```

### 6.2 Tool Registry Structure

```typescript
// apps/mcp/src/tool-registry.ts

interface ToolDefinition {
  name: string;
  toolpack: string;
  category: 'core' | 'mobile' | 'graph' | 'introspection' | 'gateway';
  description: string;
  inputSchema: z.ZodObject<any>;
  handler: (input: any) => Promise<ToolResult>;
  sensitive?: boolean;
  version?: string;
}

// Map of tool name -> mutable tool handle
const toolHandles: Map<string, ReturnType<typeof server.registerTool>> = new Map();

// Track enabled state for router metadata
const enabledTools: Set<string> = new Set();
```

### 6.3 Router Implementation with Auto-Enable

```typescript
// apps/mcp/src/tools/router.ts

const ROUTER_MODE = process.env.ROUTER_MODE || 'auto';
const ROUTER_SENSITIVE_ENFORCE = process.env.ROUTER_SENSITIVE_ENFORCE === 'true';

async function executeViaRouter(action: string, params: unknown) {
  const toolDef = getToolDefinition(action);
  if (!toolDef) {
    return { error: `Unknown tool: ${action}`, available_actions: getAllToolNames() };
  }

  const isEnabled = enabledTools.has(action);
  const isSensitive = toolDef.sensitive || false;

  // Check router mode
  if (ROUTER_MODE === 'respect' && !isEnabled) {
    return {
      error: `Tool '${action}' is not enabled`,
      gated: true,
      requires_enable: [action],
    };
  }

  // Check sensitive enforcement
  if (ROUTER_MODE === 'auto' && isSensitive && ROUTER_SENSITIVE_ENFORCE && !isEnabled) {
    return {
      error: `Tool '${action}' is sensitive and requires explicit enable`,
      gated: true,
      requires_enable: [action],
      requires_profile: toolDef.toolpack === 'introspection' ? 'full' : undefined,
    };
  }

  // Auto-enable if mode allows
  let enabledNow = false;
  if (ROUTER_MODE === 'auto' && !isEnabled) {
    const handle = toolHandles.get(action);
    if (handle) {
      handle.enable(); // Triggers notifications/tools/list_changed
      enabledTools.add(action);
      enabledNow = true;
    }
  }

  // Validate and execute
  try {
    const validatedParams = toolDef.inputSchema.parse(params);
    const result = await toolDef.handler(validatedParams);

    // Add router metadata
    return {
      ...result,
      _router_metadata: {
        enabled_now: enabledNow,
        visible_to_client: enabledTools.has(action),
        tool_version: toolDef.version || '1.0.0',
      },
    };
  } catch (error) {
    return {
      error: `Validation error: ${error.message}`,
      schema: zodToJsonSchema(toolDef.inputSchema),
    };
  }
}
```

### 6.4 MCP Bridge Implementation

```typescript
// apps/mcp/src/tools/bridge.ts

import { Client } from '@modelcontextprotocol/sdk/client/index.js';

// For direct MCP calls when local visibility is stale
async function executeMcpBridge(server: string, tool: string, params: unknown) {
  if (server !== 'synthesis') {
    return { error: `Unknown MCP server: ${server}` };
  }

  // Option 1: Call the local handler directly (bypasses enable/disable)
  const toolDef = getToolDefinition(tool);
  if (toolDef) {
    const validated = toolDef.inputSchema.parse(params);
    return await toolDef.handler(validated);
  }

  // Option 2: If we had external MCP servers, we'd call them via Client
  return { error: `Tool '${tool}' not found in MCP server '${server}'` };
}
```

---

## 7. File Changes Summary

| File | Action |
|------|--------|
| `apps/mcp/src/index.ts` | MAJOR refactor - dynamic tool management, new capabilities |
| `apps/mcp/src/tool-registry.ts` | CREATE - tool definitions, toolpacks, handles |
| `apps/mcp/src/tools/discover.ts` | CREATE - synthesis_discover_tools implementation |
| `apps/mcp/src/tools/enable.ts` | CREATE - enable_tools implementation |
| `apps/mcp/src/tools/router.ts` | CREATE - synthesis_router with auto-enable |
| `apps/mcp/src/tools/bridge.ts` | CREATE - synthesis_mcp_bridge implementation |
| `apps/mcp/src/tools/search.ts` | CREATE - synthesis_search (refactored from search_rag) |
| `apps/mcp/src/toolpacks.ts` | CREATE - toolpack definitions |
| `apps/mcp/src/profiles.ts` | CREATE - profile definitions and startup logic |
| `apps/mcp/src/__tests__/dynamic-tools.test.ts` | CREATE - enable/disable tests |
| `apps/mcp/src/__tests__/router.test.ts` | CREATE - router policy tests |
| `apps/mcp/src/__tests__/bridge.test.ts` | CREATE - bridge tests |

---

## 8. Environment Variables

```bash
# Profile at startup (default: minimal)
MCP_TOOL_PROFILE=minimal|mobile|full

# Router behavior (default: auto)
ROUTER_MODE=auto|respect|bypass

# Enforce explicit enable for sensitive tools (default: false)
ROUTER_SENSITIVE_ENFORCE=true|false

# Existing
MCP_MODE=stdio|http
MCP_PORT=3334
BACKEND_API_URL=http://localhost:3333
```

---

## 9. Token Impact

| State | Tools Visible | Est. Tokens |
|-------|--------------|-------------|
| Minimal profile (startup) | 5 always-on | ~2,000 |
| After enabling mobile_core | 8 | ~3,500 |
| After enabling introspection | 11 | ~5,000 |
| Full profile | 20+ | ~16,000 |
| **Savings at startup** | | **~87%** |

---

## 10. Agent Prompt Integration

Add to `docs/agent-sdk/04_AGENT_SDK_PHASE_PROMPTS.md`:

```markdown
## Synthesis MCP Tool Selection Policy

The Synthesis MCP server uses dynamic tool management. Follow this strict order:

1. **Prefer native typed tools** currently visible in your tool list
2. **If needed tool isn't visible**, call `synthesis_discover_tools({ task: "..." })`
3. **Enable with** `enable_tools({ toolpacks: ["mobile_core"] })`
4. **If still not visible**, call `synthesis_router({ action: "tool_name", params: {...} })`
5. **If router is gated**, use `synthesis_mcp_bridge` as last resort

### Router Behavior
- Auto-enables disabled tools on first use (ROUTER_MODE=auto)
- Sensitive tools (get_db_schema, delete_*) may require explicit enable
- Returns metadata: `{ enabled_now, visible_to_client, tool_version }`

### Example: Find Flutter Auth Examples

```text
1. Try: find_code_examples (if visible)
2. If not: synthesis_discover_tools({ task: "Find Flutter auth examples with Supabase" })
3. Then: enable_tools({ toolpacks: ["mobile_core"] })
4. Then: find_code_examples({ collectionId, query: "auth", framework: "flutter" })
5. Fallback: synthesis_router({ action: "find_code_examples", params: {...} })
```

---

## 11. Acceptance Criteria

- [ ] Server starts with only 5 always-on tools visible
- [ ] `synthesis_discover_tools` returns recommendations based on task
- [ ] `enable_tools` enables tools and emits `notifications/tools/list_changed`
- [ ] Enabled tools appear in subsequent `tools/list` requests
- [ ] `synthesis_router` auto-enables disabled tools (ROUTER_MODE=auto)
- [ ] `synthesis_router` respects `ROUTER_SENSITIVE_ENFORCE` for gated tools
- [ ] `synthesis_mcp_bridge` executes tools bypassing enable state
- [ ] `MCP_TOOL_PROFILE=full` enables all tools at startup
- [ ] All tools remain callable (via native, router, or bridge)
- [ ] Token reduction verified with `tiktoken` measurement
- [ ] Server uses MCP TypeScript SDK dynamic tool APIs (enable/disable/update)
- [ ] Default profile (`minimal`) is fully usable by generic MCP clients
- [ ] No Anthropic-specific fields or protocol extensions in MCP messages
- [ ] All tools callable without client support for `tools/list_changed`

---

## 12. Testing Checklist

- [ ] Unit tests for each gateway tool
- [ ] Integration test: discover → enable → call flow
- [ ] Integration test: router auto-enable flow
- [ ] Integration test: sensitive tool gating
- [ ] Integration test: bridge fallback
- [ ] Profile startup tests (minimal, mobile, full)
- [ ] Client compatibility: Claude Desktop (HTTP)
- [ ] Client compatibility: Cursor (stdio)
- [ ] Notification debouncing verification

---

## 13. Sub-Phase Breakdown

### 5.6.0: Pre-Flight Contracts
**Scope:** Define TypeScript interfaces and type contracts before implementation

**Files:**
- CREATE `apps/mcp/src/types/tool-registry.ts` — ToolDefinition, ToolHandle, ToolpackDef interfaces
- CREATE `apps/mcp/src/types/gateway.ts` — DiscoverResult, EnableResult, RouterResult types

**Deliverables:**
- [ ] ToolDefinition interface with toolpack, category, sensitive, version fields
- [ ] ToolHandle type for enable/disable operations
- [ ] Response types for all gateway tools
- [ ] Zod schemas for runtime validation

**Tests:** Type-level tests via tsc, schema validation tests
**Commit:** `feat(gpt-phase3): add dynamic tool management type contracts`

---

### 5.6.1: Tool Registry Foundation
**Scope:** Registry infrastructure, refactor existing tools to registry pattern

**Files:**
- CREATE `apps/mcp/src/tool-registry.ts` — Registry class, handles map, enabled set
- CREATE `apps/mcp/src/toolpacks.ts` — TOOLPACKS constant
- CREATE `apps/mcp/src/profiles.ts` — PROFILES constant, startup logic
- EDIT `apps/mcp/src/index.ts` — `listChanged: true` capability, debouncedNotificationMethods

**Deliverables:**
- [ ] Tool registry can register tools with metadata
- [ ] Tools can be enabled/disabled via handles
- [ ] Profile-based startup (minimal/mobile/full)
- [ ] Existing tools function unchanged

**Tests:** `apps/mcp/src/__tests__/tool-registry.test.ts` — register, enable, disable, profile startup
**Commit:** `feat(gpt-phase3): add tool registry and profile system`

---

### 5.6.2: Gateway Tools - Discovery & Enable
**Scope:** synthesis_discover_tools and enable_tools

**Files:**
- CREATE `apps/mcp/src/tools/discover.ts`
- CREATE `apps/mcp/src/tools/enable.ts`
- EDIT `apps/mcp/src/index.ts` — Register as always-on

**Deliverables:**
- [ ] `synthesis_discover_tools({ task })` returns recommendations
- [ ] `synthesis_discover_tools({ list_all: true })` returns catalog
- [ ] `enable_tools({ toolpacks })` enables tools
- [ ] `notifications/tools/list_changed` emitted
- [ ] Debouncing for rapid enables

**Tests:** `apps/mcp/src/__tests__/discover.test.ts`, `apps/mcp/src/__tests__/enable.test.ts`
**Commit:** `feat(gpt-phase3): add discovery and enable gateway tools`

---

### 5.6.3: Gateway Tools - Router & Bridge
**Scope:** synthesis_router and synthesis_mcp_bridge

**Files:**
- CREATE `apps/mcp/src/tools/router.ts` — Auto-enable logic
- CREATE `apps/mcp/src/tools/bridge.ts`
- CREATE `apps/mcp/src/tools/search.ts` — Refactor from search_rag

**Deliverables:**
- [ ] `synthesis_router` auto-enables (ROUTER_MODE=auto)
- [ ] `synthesis_router` respects ROUTER_SENSITIVE_ENFORCE
- [ ] `synthesis_router` returns metadata
- [ ] `synthesis_mcp_bridge` bypasses enable state
- [ ] `synthesis_search` always-on fallback

**Tests:** `apps/mcp/src/__tests__/router.test.ts`, `apps/mcp/src/__tests__/bridge.test.ts`
**Commit:** `feat(gpt-phase3): add router and bridge gateway tools`

---

### 5.6.4: Integration Tests & Token Verification
**Scope:** End-to-end flows, client compatibility, token measurement

**Files:**
- CREATE `apps/mcp/src/__tests__/gateway-integration.test.ts`
- CREATE `apps/mcp/perf/token-measurement.ts`

**Deliverables:**
- [ ] Integration: discover → enable → call flow
- [ ] Integration: router auto-enable flow
- [ ] Integration: sensitive tool gating
- [ ] Profile startup tests (all 3 profiles)
- [ ] Token measurement with tiktoken
- [ ] Client compatibility: Claude Desktop (HTTP), Cursor (stdio)

**Commit:** `feat(gpt-phase3): add dynamic tool management integration tests`

---

## 14. GitHub Workflow

```bash
# Start fresh from latest develop
git checkout develop
git pull origin develop

# Create new branch for Sub-Phase 5.6
git checkout -b feature/gpt-phase3-dynamic-tool-management

# 5.6.0 - Pre-flight contracts
# ... implement changes ...
git add -A && git commit -m "feat(gpt-phase3): add dynamic tool management type contracts"

# 5.6.1 - Registry
# ... implement changes ...
git add -A && git commit -m "feat(gpt-phase3): add tool registry and profile system"

# 5.6.2 - Discovery & Enable
# ... implement changes ...
git add -A && git commit -m "feat(gpt-phase3): add discovery and enable gateway tools"

# 5.6.3 - Router & Bridge
# ... implement changes ...
git add -A && git commit -m "feat(gpt-phase3): add router and bridge gateway tools"

# 5.6.4 - Integration
# ... implement changes ...
git add -A && git commit -m "feat(gpt-phase3): add dynamic tool management integration tests"

# Push branch and create PR
git push -u origin feature/gpt-phase3-dynamic-tool-management
gh pr create --base develop --title "GPT Phase 3.5.6: Dynamic Tool Management" --body "## Summary
- Implements Sub-Phase 5.6: Dynamic Tool Management
- Reduces MCP tool context from ~15.8k to ~2k tokens
- Adds gateway tools: discover, enable, router, bridge, search
- Profile system: minimal, mobile, full

## Sub-phases
- 5.6.0: Type contracts
- 5.6.1: Tool registry and profiles
- 5.6.2: Discovery and enable tools
- 5.6.3: Router and bridge tools
- 5.6.4: Integration tests

## Test Plan
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Token measurement verified
- [ ] Client compatibility tested (Claude Desktop, Cursor)"
```

---

## 15. Agent Execution Guidance

See MCP resource: `mcp://synthesis/guidance/phase-5.6-execution`

**Quick Reference:**
- Skills: `backend-development`, `mcp-server-architect`
- MCP: `context7` for SDK docs
- Subagents: `mcp-server-architect` (parallel), `test-writer` (per sub-phase), `code-standards-reviewer` (final)

---

## 16. Advanced Client Integration Patterns

Synthesis features map to advanced agent capabilities without embedding client-specific logic:

| Advanced Feature | Synthesis Equivalent | Notes |
|------------------|---------------------|-------|
| Tool Search Tool | `synthesis_discover_tools` | Semantic discovery via toolpacks |
| defer_loading | `enable_tools` | Lazy-load tool definitions |
| Programmatic Tool Calling | `synthesis_router` | Single orchestration entry point |
| Code Mode (MCP) | TS wrapper library | Future: `servers/synthesis/*.ts` |

**Server remains model-agnostic.** These integrations live in client configs/wrappers.

**Future Work (out of scope for 5.6):**
- TS wrapper library for Code Mode
- Example Agent Skills using Synthesis tools

---

## Sources

- [MCP Specification 2025-06-18 - Tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [MCP TypeScript SDK - Dynamic Tool Management](https://github.com/modelcontextprotocol/typescript-sdk)
- [Spring AI Dynamic Tool Updates](https://spring.io/blog/2025/05/04/spring-ai-dynamic-tool-updates-with-mcp/)
