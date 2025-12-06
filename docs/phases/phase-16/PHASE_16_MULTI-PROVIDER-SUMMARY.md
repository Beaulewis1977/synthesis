# Phase 16 Multi-Provider Chat - Implementation Summary

## Overview

This document tracks the implementation progress of Phase 16: Multi-Provider Chat & UI Improvements.

---

## Phase 16A: Claude Agent SDK Migration - COMPLETED

**Status:** COMPLETED
**Branch:** `feature/phase-16-multi-provider-chat`
**Date:** 2025-12-06

### Commits

1. **38bbb3b** - `feat(phase-16a): add ChatProvider interface and test SDK workaround`
   - Tested Claude Agent SDK with `pathToClaudeCodeExecutable` workaround
   - Created ChatProvider interface and types
   - Added tool format adapters
   - Created provider registry pattern

2. **Pending commit** - `feat(phase-16a): migrate agent to Claude Agent SDK query()`
   - Replaced manual Anthropic SDK 10-turn loop with SDK's `query()` function
   - Added `buildAgentMcpServer()` with 9 MCP tools
   - Kept legacy `buildAgentTools()` for backward compatibility
   - Updated tests with SDK mocks and MCP format validation

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

## Phase 16B+D: Multi-Provider Chat with Tool Support - COMPLETED

**Status:** COMPLETED
**Branch:** `feature/phase-16-multi-provider-chat`
**Date:** 2025-12-06
**PR:** [#150](https://github.com/Beaulewis1977/synthesis/pull/150)

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

## Phase 16C: Streaming & UI - COMPLETED

**Status:** COMPLETED
**Branch:** `feature/phase-16-multi-provider-chat`
**Date:** 2025-12-06

### Implementation

1. **Backend: Provider `streamChat()` methods**
   - All providers now implement `streamChat()` as async generators
   - `chat()` methods refactored to internally call `streamChat()` and accumulate results
   - Single source of truth for streaming logic per provider

2. **Backend: SSE endpoint `/api/agent/chat/stream`**
   - New route in `apps/server/src/routes/agent-stream.ts`
   - Streams `ChatStreamChunk` events as SSE
   - Event types: `token`, `tool_start`, `tool_end`, `done`, `error`
   - Session persistence on stream completion

3. **Frontend: Streaming hook and components**
   - `useStreamingChat` hook for SSE consumption
   - `StreamingMessage` component with cursor animation and tool progress
   - ChatPage updated to use streaming by default

### Files Created/Modified

| File | Changes |
|------|---------|
| `apps/server/src/services/chat-providers/anthropic.ts` | Added `streamChat()`, refactored `chat()` |
| `apps/server/src/services/chat-providers/openai.ts` | Added `streamChat()` with streaming tool loop |
| `apps/server/src/services/chat-providers/ollama.ts` | Added `streamChat()` |
| `apps/server/src/routes/agent-stream.ts` | NEW: SSE streaming endpoint |
| `apps/server/src/index.ts` | Registered `agentStreamRoutes` |
| `apps/web/src/hooks/useStreamingChat.ts` | NEW: SSE client hook |
| `apps/web/src/components/StreamingMessage.tsx` | NEW: Streaming message UI |
| `apps/web/src/pages/ChatPage.tsx` | Updated to use streaming |

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

## Phase 16E: Additional Providers - NOT STARTED

**Planned work:**
1. Add Google AI provider
2. Add OpenAI-compatible provider base
3. Add GLM 4 (Z.AI) support
4. Add Kimi (Moonshot) support

---

## Dependencies Added

- `@anthropic-ai/claude-agent-sdk` - Claude Agent SDK for agentic workflows

---

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `CLAUDE_CLI_PATH` | Path to Claude Code CLI (WSL2 workaround) | `'claude'` |
| `ANTHROPIC_API_KEY` | Anthropic API key | Required |

---

## Next Steps

1. ~~Commit the pending Phase 16A changes~~ ✅ DONE
2. ~~Create PR for Phase 16A~~ ✅ DONE
3. ~~Begin Phase 16B: Multi-Provider Chat implementation~~ ✅ DONE
4. ~~Implement Phase 16D: Tool Adapters~~ ✅ DONE (merged with 16B)
5. Merge PR #150 to develop
6. ~~Phase 16C: Streaming & UI~~ ✅ DONE
7. Begin Phase 16E: Additional Providers (Google, GLM, Kimi)
