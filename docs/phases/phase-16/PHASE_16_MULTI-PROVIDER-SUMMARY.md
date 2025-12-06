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

## Phase 16B: Multi-Provider Chat - NOT STARTED

**Planned work:**
1. Implement ChatProvider interface for each provider
2. Add AnthropicChatProvider (uses Claude Agent SDK)
3. Add OpenAIChatProvider
4. Add OllamaChatProvider
5. Wire up model selector to provider selection

---

## Phase 16C: Streaming & UI - NOT STARTED

**Planned work:**
1. Add SSE endpoint for streaming responses
2. Implement optimistic message display
3. Add loading/typing indicators
4. Token-by-token rendering
5. Progress for tool execution

---

## Phase 16D: Tool Adapters - NOT STARTED

**Planned work:**
1. Create tool format converter for OpenAI
2. Create tool format converter for Google
3. Test tool calling across providers
4. Graceful fallback for non-tool providers

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

1. Commit the pending Phase 16A changes
2. Create PR for Phase 16A
3. Begin Phase 16B: Multi-Provider Chat implementation
