# Phase 16 Multi-Provider Chat - Implementation Summary

## Overview

This document tracks the implementation progress of Phase 16: Multi-Provider Chat & UI Improvements.

**Status:** Phases 16A-16E MERGED, Phase 16F IN PROGRESS

---

## Phase 16A: Claude Agent SDK Migration - MERGED

**Status:** MERGED
**Branch:** `feature/phase-16-multi-provider-chat`
**Date:** 2025-12-06

### Commits

1. **38bbb3b** - `feat(phase-16a): add ChatProvider interface and test SDK workaround`
   - Tested Claude Agent SDK with `pathToClaudeCodeExecutable` workaround
   - Created ChatProvider interface and types
   - Added tool format adapters
   - Created provider registry pattern

2. **90b9ee1** - `feat(phase-16a): migrate agent to Claude Agent SDK query()`
   - Replaced manual Anthropic SDK 10-turn loop with SDK's `query()` function
   - Added `buildAgentMcpServer()` with 9 MCP tools
   - Kept legacy `buildAgentTools()` for backward compatibility
   - Updated tests with SDK mocks and MCP format validation

3. **cca2125** - `fix(phase-16a): use injected db pool in summarize_document MCP tool`

### Files Modified

| File | Changes |
|------|---------|
| `apps/server/src/agent/agent.ts` | Replaced Anthropic SDK with Claude Agent SDK `query()` |
| `apps/server/src/agent/tools.ts` | Added MCP tool format (`buildAgentMcpServer()`, 9 tools) |
| `apps/server/src/agent/__tests__/agent.test.ts` | Updated mocks for Claude Agent SDK |
| `apps/server/src/agent/__tests__/tools.test.ts` | Added MCP server format tests |
| `apps/server/src/services/chat-providers/types.ts` | ChatProvider interface and types |
| `apps/server/src/services/chat-providers/adapters.ts` | Tool format adapters |
| `apps/server/src/services/chat-providers/index.ts` | Provider registry |

### Key Changes

#### Before (Manual Anthropic SDK)
```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();
let turn = 0;
while (turn < maxTurns) {
  const response = await anthropic.messages.create({...});
  // Manual tool handling
  turn++;
}
```

#### After (Claude Agent SDK)
```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
import { buildAgentMcpServer, MCP_SERVER_NAME, MCP_TOOL_NAMES } from './tools.js';

const mcpServer = buildAgentMcpServer(db, { collectionId });
const response = query({
  prompt,
  options: {
    pathToClaudeCodeExecutable: CLAUDE_CLI_PATH,
    systemPrompt,
    model: chatConfig.model,
    mcpServers: { [MCP_SERVER_NAME]: mcpServer },
    allowedTools: [...MCP_TOOL_NAMES],
    permissionMode: 'bypassPermissions',
    maxTurns: 10,
  },
});

for await (const message of response) {
  // Handle: system, assistant, user (tool_use/tool_result), result
}
```

### MCP Tool Format

**Server name:** `synthesis-rag-tools`

**Tools (9 total):**
- `mcp__synthesis-rag-tools__search_rag`
- `mcp__synthesis-rag-tools__add_document`
- `mcp__synthesis-rag-tools__fetch_web_content`
- `mcp__synthesis-rag-tools__list_collections`
- `mcp__synthesis-rag-tools__list_documents`
- `mcp__synthesis-rag-tools__get_document_status`
- `mcp__synthesis-rag-tools__delete_document`
- `mcp__synthesis-rag-tools__restart_ingest`
- `mcp__synthesis-rag-tools__summarize_document`

### Verification

| Check | Status |
|-------|--------|
| `pnpm typecheck:server` | PASS |
| Agent tests (19 tests) | PASS |
| Tools tests (14 tests) | PASS |
| Manual integration test | PASS |

### WSL2 Workaround

The Claude Agent SDK binary crashes on WSL2. The workaround uses the npm/pnpm-installed Claude Code CLI:

```typescript
const CLAUDE_CLI_PATH = process.env.CLAUDE_CLI_PATH || 'claude';
```

**WSL2 users:** Set `CLAUDE_CLI_PATH=/home/<username>/.local/share/pnpm/claude`

See: [Issue #20](https://github.com/anthropics/claude-agent-sdk-typescript/issues/20), [Issue #5823](https://github.com/anthropics/claude-code/issues/5823)

---

## Phase 16B+D: Multi-Provider Chat with Tool Support - MERGED

**Status:** MERGED
**Branch:** `feature/phase-16-multi-provider-chat`
**Date:** 2025-12-06
**PR:** [#150](https://github.com/Beaulewis1977/synthesis/pull/150) (merged)

### Commits

1. **34d89c3** - `feat(phase-16b+d): implement multi-provider chat (Anthropic, OpenAI, Ollama)`
   - Created AnthropicChatProvider using Claude Agent SDK with MCP tools
   - Created OpenAIChatProvider with manual 10-turn tool execution loop
   - Created OllamaChatProvider for basic local chat (no tool support)
   - Updated ChatProvider interface with ToolContext
   - Refactored agent.ts to use ChatProvider abstraction
   - Added graceful fallback warning for non-tool providers

2. **9ff418a** - `test(phase-16b): add multi-provider chat tests`
   - anthropic.test.ts: 14 tests (SDK integration, tool calls, error handling)
   - openai.test.ts: 25 tests (tool execution loop, max turns, stop reasons)
   - ollama.test.ts: 16 tests (basic chat, message conversion, configuration)
   - Total: 55 tests, all passing

3. **cc76258** - `fix(phase-16b): address CodeRabbit review feedback`

### Files Created/Modified

| File | Changes |
|------|---------|
| `apps/server/src/services/chat-providers/types.ts` | Added ToolContext interface, updated ChatProviderFactory signature |
| `apps/server/src/services/chat-providers/anthropic.ts` | NEW: Anthropic provider using Claude Agent SDK `query()` |
| `apps/server/src/services/chat-providers/openai.ts` | NEW: OpenAI provider with manual tool execution loop |
| `apps/server/src/services/chat-providers/ollama.ts` | NEW: Ollama provider for local models |
| `apps/server/src/services/chat-providers/index.ts` | Updated registry with db/context, registered all providers |
| `apps/server/src/agent/agent.ts` | Refactored to use ChatProvider abstraction |
| `apps/server/src/services/chat-providers/__tests__/anthropic.test.ts` | NEW: 14 tests |
| `apps/server/src/services/chat-providers/__tests__/openai.test.ts` | NEW: 25 tests |
| `apps/server/src/services/chat-providers/__tests__/ollama.test.ts` | NEW: 16 tests |

### Provider Capabilities

| Provider | Tool Support | Streaming | Vision | Max Context |
|----------|--------------|-----------|--------|-------------|
| Anthropic | ✅ MCP tools via SDK | ✅ | ✅ | 200K |
| OpenAI | ✅ Manual 10-turn loop | ✅ | ✅ | 128K |
| Ollama | ❌ (graceful fallback) | ✅ | ❌ | 8K |

### Architecture

#### ChatProvider Interface
```typescript
interface ChatProvider {
  readonly name: ChatProviderType;
  readonly capabilities: ProviderCapabilities;
  chat(params: ChatParams): Promise<ChatResponse>;
  isConfigured(): Promise<boolean>;
}
```

#### ToolContext (for scoped operations)
```typescript
interface ToolContext {
  collectionId: string;
}
```

#### Provider Factory Pattern
```typescript
type ChatProviderFactory = (db: Pool, context: ToolContext) => ChatProvider;

// Registry
registerChatProvider('anthropic', createAnthropicProvider);
registerChatProvider('openai', createOpenAIProvider);
registerChatProvider('ollama', createOllamaProvider);
```

#### OpenAI Tool Execution Loop
```typescript
// Manual 10-turn loop for OpenAI tool calling
const MAX_TURNS = 10;
while (turnCount < MAX_TURNS) {
  const response = await client.chat.completions.create({...});
  if (!response.choices[0].message.tool_calls) break;

  // Execute tools using buildAgentTools() executors
  for (const toolCall of toolCalls) {
    const result = await toolExecutors[toolCall.name](toolCall.input);
    messages.push({ role: 'tool', content: result, tool_call_id: toolCall.id });
  }
}
```

### Verification

| Check | Status |
|-------|--------|
| `pnpm typecheck` | ✅ PASS |
| anthropic.test.ts (14 tests) | ✅ PASS |
| openai.test.ts (25 tests) | ✅ PASS |
| ollama.test.ts (16 tests) | ✅ PASS |
| Total: 55 tests | ✅ PASS |

---

## Phase 16C: Streaming & UI - MERGED

**Status:** MERGED
**Branch:** `feature/phase-16-multi-provider-chat`
**Date:** 2025-12-06
**PR:** [#151](https://github.com/Beaulewis1977/synthesis/pull/151) (merged)

### Commits

1. **c0d16be** - `feat(phase-16c): implement SSE streaming for real-time chat responses`
   - Added `streamChat()` to all providers (Anthropic, OpenAI, Ollama)
   - Refactored `chat()` to delegate to `streamChat()` internally
   - Created SSE endpoint `/api/agent/chat/stream`
   - Created `useStreamingChat` hook for SSE consumption
   - Created `StreamingMessage` component with cursor animation
   - Updated ChatPage to use streaming by default

2. **0a52d1e** - `fix(phase-16c): address PR #151 review feedback`
   - `adapters.ts`: Changed `content: ''` to `content: null` for assistant tool_calls (OpenAI spec)
   - `useStreamingChat.ts`: Removed duplicate `onComplete` call, fixed dependency array

3. **f8fa387** - `fix(phase-16c): address additional PR #151 review feedback`
   - `agent-stream.ts`: Don't persist partial messages on stream error
   - `agent-stream.ts`: Remove unused `_fullContent` parameter
   - `agent-stream.ts`: Convert dynamic import to static import
   - `ChatPage.tsx`: Include current user message in history
   - `useStreamingChat.ts`: Defensive tool matching
   - `StreamingMessage.tsx`: Accessibility improvements (aria-live, aria-hidden, aria-labels)

4. **1196160** - `fix(phase-16c): add reply.hijack() and remove duplicate end() call`
   - Added `reply.hijack()` for proper Fastify SSE handling
   - Removed duplicate `reply.raw.end()` call

5. **460e85a** - `fix(phase-16c): address remaining PR #151 review feedback`
   - `useStreamingChat.ts`: Add useEffect cleanup on unmount
   - `useStreamingChat.ts`: Use optionsRef to avoid re-renders
   - `useStreamingChat.ts`: Clear abortControllerRef after abort
   - `useStreamingChat.ts`: Pass toolCalls to onComplete (avoid stale closure)
   - `ChatPage.tsx`: Use toolCalls parameter from onComplete
   - `agent-stream.ts`: Rename `tc` to `toolCall` for consistency
   - `agent-stream.ts`: Remove redundant `streamSuccess` variable
   - `openai.ts`: Track emitted tool_start events to avoid duplicates

6. **5347e39** - `fix(phase-16c): fix openai.ts tool call input and stopReason bugs`
   - Include parsed `input` in `tool_end` events
   - Add `tool_end` handler in `chat()` to update tool call inputs
   - Fix `stopReason` from `'max_tokens'` to `'end_turn'` when max turns reached

### Implementation

1. **Backend: Provider `streamChat()` methods**
   - All providers now implement `streamChat()` as async generators
   - `chat()` methods refactored to internally call `streamChat()` and accumulate results
   - Single source of truth for streaming logic per provider

2. **Backend: SSE endpoint `/api/agent/chat/stream`**
   - New route in `apps/server/src/routes/agent-stream.ts`
   - Uses `reply.hijack()` for proper Fastify SSE handling
   - Streams `ChatStreamChunk` events as SSE
   - Event types: `token`, `tool_start`, `tool_end`, `done`, `error`
   - Session persistence on stream completion (only on success)

3. **Frontend: Streaming hook and components**
   - `useStreamingChat` hook for SSE consumption with proper cleanup
   - `StreamingMessage` component with cursor animation and tool progress
   - Accessibility: aria-live, aria-hidden, aria-labels
   - ChatPage updated to use streaming by default

### Files Created/Modified

| File | Changes |
|------|---------|
| `apps/server/src/services/chat-providers/anthropic.ts` | Added `streamChat()`, refactored `chat()` |
| `apps/server/src/services/chat-providers/openai.ts` | Added `streamChat()` with streaming tool loop, tool input in events |
| `apps/server/src/services/chat-providers/ollama.ts` | Added `streamChat()` |
| `apps/server/src/services/chat-providers/adapters.ts` | Fixed `content: null` for assistant tool_calls |
| `apps/server/src/routes/agent-stream.ts` | NEW: SSE streaming endpoint with `reply.hijack()` |
| `apps/server/src/index.ts` | Registered `agentStreamRoutes` |
| `apps/web/src/hooks/useStreamingChat.ts` | NEW: SSE client hook with cleanup and optionsRef |
| `apps/web/src/components/StreamingMessage.tsx` | NEW: Streaming message UI with accessibility |
| `apps/web/src/pages/ChatPage.tsx` | Updated to use streaming with toolCalls parameter |

### SSE Event Format

```
event: token
data: {"content": "Hello"}

event: tool_start
data: {"tool": "search_rag", "input": {...}}

event: tool_end
data: {"tool": "search_rag"}

event: done
data: {"usage": {...}, "stopReason": "end_turn"}

event: error
data: {"message": "..."}
```

### Architecture

```typescript
// Provider interface with streaming
interface ChatProvider {
  chat(params: ChatParams): Promise<ChatResponse>;
  streamChat?(params: ChatParams): AsyncGenerator<ChatStreamChunk, void, unknown>;
}

// chat() now delegates to streamChat()
async chat(params: ChatParams): Promise<ChatResponse> {
  let content = '';
  for await (const chunk of this.streamChat(params)) {
    if (chunk.type === 'text') content += chunk.text;
    // ...accumulate
  }
  return { content, ... };
}
```

### Verification

| Check | Status |
|-------|--------|
| `pnpm typecheck` | ✅ PASS |
| `pnpm typecheck:server` | ✅ PASS |
| `pnpm --filter @synthesis/web typecheck` | ✅ PASS |

---

## Phase 16E: Additional Providers - MERGED

**Status:** MERGED
**Branch:** `feature/phase-16e-additional-providers`
**PR:** [#152](https://github.com/Beaulewis1977/synthesis/pull/152) (merged)
**Date:** 2025-12-06

### Overview

Added three new chat providers: Google Gemini, Z.AI (Zhipu GLM-4), and Moonshot (Kimi K2).

### Files Created

| File | Description |
|------|-------------|
| `apps/server/src/services/chat-providers/google.ts` | Google Gemini provider with native SDK |
| `apps/server/src/services/chat-providers/zhipu.ts` | Z.AI GLM-4 provider (OpenAI-compatible) |
| `apps/server/src/services/chat-providers/moonshot.ts` | Moonshot Kimi provider with thinking mode |
| `apps/server/src/services/chat-providers/openai-compatible.ts` | Base utilities for OpenAI-compatible providers |
| `apps/server/src/services/chat-providers/__tests__/google.test.ts` | 30 tests |
| `apps/server/src/services/chat-providers/__tests__/zhipu.test.ts` | 26 tests |
| `apps/server/src/services/chat-providers/__tests__/moonshot.test.ts` | 29 tests |

### Files Modified

| File | Changes |
|------|---------|
| `apps/server/src/services/chat-providers/index.ts` | Added imports and registration for Google, Zhipu, Moonshot |
| `apps/server/package.json` | Added `@google/generative-ai` dependency |

### Provider Capabilities

| Provider | Tool Support | Streaming | Vision | Max Context | Base URL |
|----------|--------------|-----------|--------|-------------|----------|
| Google | ✅ Manual loop | ✅ | ✅ | 1M | Native SDK |
| Z.AI (Zhipu) | ✅ Manual loop | ✅ | ❌ | 128K | `api.z.ai/api/paas/v4` |
| Moonshot | ✅ Manual loop | ✅ | ❌ | 256K | `api.moonshot.cn/v1` |

### Models Supported

**Google Gemini:**
- gemini-3-pro-preview
- gemini-2.5-flash
- gemini-2.5-flash-lite
- gemini-2.5-pro
- gemini-3-pro-image-preview

**Z.AI (Zhipu):**
- GLM-4.6
- GLM-4.5-Air

**Moonshot (Kimi):**
- kimi-k2-0905-preview
- kimi-k2-thinking (with thinking mode)
- kimi-k2-thinking-turbo (with thinking mode)

### Implementation Details

#### Google Provider
- Uses native `@google/generative-ai` SDK
- Converts JSON Schema types to Google `SchemaType` enum
- System prompts via `systemInstruction` parameter
- Function calls use `functionDeclarations` format

#### Z.AI Provider
- OpenAI-compatible API at `https://api.z.ai/api/paas/v4`
- Uses standard OpenAI SDK with custom `baseURL`
- Manual 10-turn tool execution loop

#### Moonshot Provider
- OpenAI-compatible API at `https://api.moonshot.cn/v1`
- Special **thinking mode** for reasoning models
- Enabled via `extra_body: { thinking: { type: "enabled", max_tokens: 4096 } }`
- Auto-detected from model name containing "thinking"

### Environment Variables

| Variable | Provider | Purpose |
|----------|----------|---------|
| `GOOGLE_API_KEY` | Google | Gemini API key |
| `ZHIPU_API_KEY` | Z.AI | GLM API key |
| `MOONSHOT_API_KEY` | Moonshot | Kimi API key |

### Verification

| Check | Status |
|-------|--------|
| `pnpm --filter @synthesis/server typecheck` | ✅ PASS |
| google.test.ts (30 tests) | ✅ PASS |
| zhipu.test.ts (26 tests) | ✅ PASS |
| moonshot.test.ts (29 tests) | ✅ PASS |
| **Total: 85 new tests** | ✅ ALL PASS |

### Dependencies Added

- `@google/generative-ai` - Google Generative AI SDK for Gemini models

---

## Phase 16F: Dynamic Tool Registry & Advanced Toolpacks - IN PROGRESS

**Status:** IN PROGRESS
**Branch:** `feature/phase-16f-dynamic-tools`
**Date:** 2025-12-06

### Overview

Implementing a unified tool definition system and dynamic tool registry to restore full tool parity (22+ tools) and optimize context usage by porting the dynamic registry pattern from the MCP server to the ChatProvider architecture.

### Files Created

| File | Description |
|------|-------------|
| `apps/server/src/agent/tool-definitions/types.ts` | Core types: UnifiedToolDefinition, ToolMetadata, ToolpackName, ProfileName |
| `apps/server/src/agent/tool-definitions/adapters.ts` | Format converters: zodToJsonSchema, toMcpSdkTool, toChatTool |
| `apps/server/src/agent/tool-definitions/toolpacks.ts` | Toolpack and profile definitions (minimal, core, full) |
| `apps/server/src/agent/tool-definitions/index.ts` | Main exports and factory functions |
| `apps/server/src/agent/tool-definitions/core/*.ts` | 9 core tools in unified format |
| `apps/server/src/agent/tool-definitions/gateway/*.ts` | Gateway tools (discover_tools, enable_tools) |
| `apps/server/src/services/tool-registry.ts` | DynamicToolRegistry with session management |
| `apps/server/src/services/__tests__/tool-registry.test.ts` | 22 tests |

### Files Modified

| File | Changes |
|------|---------|
| `docs/phases/phase-16/00_PHASE_16_OVERVIEW.md` | Updated Phase 16F specification |

### Architecture

#### UnifiedToolDefinition (Single Source of Truth)
```typescript
interface UnifiedToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  metadata: ToolMetadata;
  createExecutor: (db: Pool, context: ToolContext) => ToolExecutor;
}

interface ToolMetadata {
  toolpack: ToolpackName;  // 'core' | 'gateway' | 'mobile_core' | 'introspection' | 'graphing'
  category: CategoryName;
  sensitive: boolean;
  version: string;
}
```

#### DynamicToolRegistry
```typescript
class DynamicToolRegistry {
  registerTool(definition: UnifiedToolDefinition): void;
  getOrCreateSession(sessionId: string): SessionToolState;
  enableTool(sessionId: string, toolName: string): EnableDisableResult;
  disableTool(sessionId: string, toolName: string): EnableDisableResult;
  applyProfile(sessionId: string, profileName: ProfileName): void;
  onToolStateChange(callback: ToolStateChangeCallback): () => void;
}
```

#### Toolpacks & Profiles
```typescript
// Toolpacks group related tools
const TOOLPACKS = {
  core: { tools: ['search_rag', 'add_document', ...], sensitiveTools: [] },
  gateway: { tools: ['discover_tools', 'enable_tools'], sensitiveTools: [] },
  // mobile_core, introspection, graphing (to be ported)
};

// Profiles define default tool sets
const PROFILES = {
  minimal: { toolpacks: ['gateway'] },           // Only gateway tools
  core: { toolpacks: ['gateway', 'core'] },      // Default
  full: { toolpacks: ['gateway', 'core', ...] }, // All toolpacks
};
```

#### Gateway Tools
- `discover_tools`: List available toolpacks (low token cost)
- `enable_tools`: Dynamically enable/disable tools, toolpacks, or apply profiles
- Gateway tools are **always enabled** and cannot be disabled

### Core Tools Ported (9 total)

| Tool | Description |
|------|-------------|
| `search_rag` | Search the RAG knowledge base |
| `add_document` | Add document to collection |
| `fetch_web_content` | Fetch and summarize web content |
| `list_collections` | List available collections |
| `list_documents` | List documents in collection |
| `get_document_status` | Check document processing status |
| `delete_document` | Delete a document |
| `restart_ingest` | Restart failed document ingestion |
| `summarize_document` | Summarize document using Claude |

### Verification

| Check | Status |
|-------|--------|
| `pnpm --filter @synthesis/server typecheck` | ✅ PASS |
| tool-registry.test.ts (22 tests) | ✅ PASS |

### Commits

1. **aeafabb** - `feat(phase-16f): add unified tool definitions and dynamic registry` ✅
   - UnifiedToolDefinition type and adapters
   - DynamicToolRegistry with session management
   - 9 core tools + 2 gateway tools ported
   - 22 tests passing

2. **bdd9827** - `feat(phase-16f): integrate dynamic tools with ChatProvider` ✅
   - Registry bridge for session-aware tool filtering
   - All 6 providers updated (Anthropic, OpenAI, Google, Zhipu, Moonshot, Ollama)
   - Routes pass sessionId through context

3. Session management included in commit 1 (30-min auto-cleanup)

4. `test(phase-16f): add dynamic tool flow tests` - PENDING

### Remaining Work

- [x] Integrate registry with ChatProvider (complete)
- [ ] Port mobile-core, introspection, graphing toolpacks (future phase)
- [ ] Add integration tests for dynamic tool flows
- [ ] Optional: Redis persistence for session state

---

## All Dependencies Added

- `@anthropic-ai/claude-agent-sdk` - Claude Agent SDK for agentic workflows
- `@google/generative-ai` - Google Generative AI SDK for Gemini models

---

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `CLAUDE_CLI_PATH` | Path to Claude Code CLI (WSL2 workaround) | `'claude'` |
| `ANTHROPIC_API_KEY` | Anthropic API key | Required |

---

## Next Steps

1. ~~Commit the pending Phase 16A changes~~ ✅ MERGED
2. ~~Create PR for Phase 16A~~ ✅ MERGED
3. ~~Begin Phase 16B: Multi-Provider Chat implementation~~ ✅ MERGED
4. ~~Implement Phase 16D: Tool Adapters~~ ✅ MERGED (with 16B)
5. ~~Merge PR #150 to develop~~ ✅ MERGED
6. ~~Phase 16C: Streaming & UI~~ ✅ MERGED (PR #151)
7. ~~Phase 16E: Additional Providers (Google, GLM, Kimi)~~ ✅ MERGED (PR #152)
8. Phase 16F: Dynamic Tool Registry & Advanced Toolpacks - IN PROGRESS
   - [ ] Commit unified tool definitions and registry
   - [ ] Integrate with ChatProvider
   - [ ] Add session management
   - [ ] Add integration tests
   - [ ] Create PR and merge to develop
