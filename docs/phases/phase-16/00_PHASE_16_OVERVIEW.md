# Synthesis Phase 16: Multi-Provider Chat & UI Improvements

## Overview

This document outlines the planned enhancements to Synthesis for multi-provider LLM chat support, Claude Agent SDK integration, and chat UI improvements.

## Current State

### Working Features
- Anthropic SDK chat (not Claude Agent SDK) with RAG tools
- Model selector UI at `/settings/models`
- `ModelConfigService` with multi-provider config support
- Ollama/OpenAI/Voyage embedding providers
- Database schema for model configs
- Chat session persistence

### Known Issues
1. **Claude Agent SDK WSL2 incompatibility** - Binary crashes on WSL2 (GitHub issue #20)
2. **No streaming** - Chat blocks until full response
3. **No loading indicators** - User doesn't know if chat is working
4. **Single provider** - Only Anthropic for chat, despite UI suggesting multi-provider

### Environment
- Claude Code CLI: v2.0.59 at `/home/kngpnn/.local/share/pnpm/claude`
- WSL2 Ubuntu on Windows
- Docker Compose for services

---

## Planned Features

### 1. Multi-Provider Chat System

**Goal:** Use same chat UI with switchable LLM providers

**Providers to support:**
| Provider | Base URL | Models | Tool Support | Priority |
|----------|----------|--------|--------------|----------|
| Anthropic | `https://api.anthropic.com/v1` | claude-sonnet-4-5-20250929, claude-haiku-4-5-20251001, claude-opus-4-5-20251101, claude-3-5-haiku-latest | Yes | P0 |
| OpenAI | `https://api.openai.com/v1` | gpt-4.1-nano, gpt-5-mini, gpt-5-nano, gpt-5.1-codex-mini | Yes | P0 |
| Ollama | `http://localhost:11434/v1` | llama3.2, mistral, codellama, phi3, gpt-oss-20b | Limited | P0 |
| Google | `https://generativelanguage.googleapis.com/v1beta` | gemini-3-pro-preview, gemini-2.5-flash, gemini-2.5-flash-lite, gemini-2.5-pro | Yes | P1 |
| Z.AI (Zhipu) | `https://api.z.ai/api/paas/v4` | GLM-4.6, GLM-4.5-Air | Yes | P2 |
| Moonshot | `https://api.moonshot.cn/v1` | kimi-k2-0905-preview, kimi-k2-thinking, kimi-k2-thinking-turbo | Yes | P2 |

**Note:** Z.AI also has a coding-specific endpoint: `https://api.z.ai/api/coding/paas/v4`

**Architecture:**

```text
ChatProvider Interface
├── AnthropicChatProvider (with tools)
├── OpenAIChatProvider (with tools)
├── GoogleChatProvider (with tools)
├── OllamaChatProvider (simple chat)
└── OpenAICompatibleProvider (GLM, Kimi - simple chat)
```

**Key files to modify:**
- `apps/server/src/agent/agent.ts` - Abstract provider selection
- `apps/server/src/services/chat-providers/` - New provider implementations
- `apps/server/src/routes/agent.ts` - Route to selected provider

### 2. Claude Agent SDK Integration

**Goal:** Use agentic features when Anthropic is selected

**Approach options (in order of preference):**

1. **Docker deployment** (most reliable)
   - Run server in Linux container
   - Avoids WSL2 binary issues
   - Already have docker-compose infrastructure

2. **pathToClaudeCodeExecutable workaround**
   - Point SDK to existing CLI: `/home/kngpnn/.local/share/pnpm/claude`
   - May or may not work - needs testing

3. **Windows native** (fallback)
   - Run server on Windows instead of WSL2
   - More complex setup

**Test plan:**
1. Create isolated test script (not touching main code)
2. Try workaround with existing Claude CLI path
3. If fails, proceed with Docker approach

### 3. Streaming & UI Improvements

**Goal:** Real-time feedback during chat

**Features:**
- SSE (Server-Sent Events) for token streaming
- Optimistic UI - show user message immediately
- Loading indicator during response
- Progress for multi-turn tool execution
- Token count display

**Key files to modify:**
- `apps/server/src/routes/agent.ts` - Add SSE endpoint
- `apps/web/src/pages/ChatPage.tsx` - Handle streaming
- `apps/web/src/components/ChatMessage.tsx` - Streaming text display
- `apps/web/src/lib/api.ts` - SSE client

### 4. Tool Calling Across Providers

**Goal:** RAG tools work with providers that support function calling

**Supported tools:**
- search_rag
- add_document
- fetch_web_content
- list_documents
- get_document
- delete_document
- list_collections
- get_collection
- summarize_document

**Provider tool format adapters:**
| Provider | Format |
|----------|--------|
| Anthropic | Native tool_use blocks |
| OpenAI | function_call / tools |
| Google | functionDeclarations |
| Z.AI (Zhipu) | OpenAI-compatible tools |
| Moonshot | OpenAI-compatible tools |
| Ollama | Limited (depends on model) |

---

## Implementation Phases

### Phase 16A: Foundation (SDK Swap)
**Status:** SDK workaround test PASSED ✅ - No Docker fallback needed!

**Commits:**
1. ✅ `feat(phase-16a): test Claude Agent SDK workaround` - DONE
2. `feat(phase-16a): replace Anthropic SDK with Claude Agent SDK`

**Remaining Tasks:**
1. Replace `@anthropic-ai/sdk` with `@anthropic-ai/claude-code` in agent.ts
2. Use `query()` with `pathToClaudeCodeExecutable: '/home/kngpnn/.local/share/pnpm/claude'`
3. Remove manual 10-turn agentic loop (SDK handles tool execution internally)
4. Adapt tool definitions for Claude Agent SDK format if needed
5. Update response parsing for new SDK structure
6. Test with existing RAG tools (search_rag, add_document, etc.)
7. Create ChatProvider interface and types in `services/chat-providers/`

**Key Change:**
```typescript
// FROM: Manual Anthropic SDK + 10-turn loop
import Anthropic from '@anthropic-ai/sdk';
const response = await anthropic.messages.create({...});
while (turn < maxTurns) { /* manual tool handling */ }

// TO: Claude Agent SDK (handles loop internally)
import { query } from '@anthropic-ai/claude-code';
const result = await query({
  prompt: userMessage,
  options: { pathToClaudeCodeExecutable: '/home/kngpnn/.local/share/pnpm/claude' }
});
```

**Files to modify:**
- `apps/server/src/agent/agent.ts` - Main SDK swap
- `apps/server/src/agent/tools.ts` - May need format changes
- `apps/server/package.json` - Add `@anthropic-ai/claude-code` dependency

**Skills:** `synthesis-architecture`, `llm-provider-integration`, `backend-development`
**Subagents:** `Explore` (find existing agent patterns), `Plan` (design interface)

### Phase 16B: Multi-Provider Chat
1. Implement ChatProvider interface
2. Add AnthropicChatProvider (migrate existing)
3. Add OpenAIChatProvider
4. Add OllamaChatProvider
5. Wire up model selector to provider selection

**Skills:** `synthesis-architecture`, `llm-provider-integration`
**Subagents:** `Explore` (research patterns), `test-writer` (provider tests), `code-reviewer` (after implementation)

### Phase 16C: Streaming & UI
1. Add SSE endpoint for streaming responses
2. Implement optimistic message display
3. Add loading/typing indicators
4. Token-by-token rendering
5. Progress for tool execution

**Skills:** `sse-streaming`, `frontend-design`, `synthesis-architecture`
**Subagents:** `frontend-ui-architect` (streaming UI), `Explore` (find React patterns), `test-writer` (E2E tests)

### Phase 16D: Tool Adapters
1. Create tool format converter for OpenAI
2. Create tool format converter for Google
3. Test tool calling across providers
4. Graceful fallback for non-tool providers

**Skills:** `llm-provider-integration`, `synthesis-architecture`
**Subagents:** `Explore` (tool format research), `test-writer` (tool calling tests), `code-reviewer`

### Phase 16E: Additional Providers
1. Add Google AI provider
2. Add OpenAI-compatible provider base
3. Add GLM 4 (Z.AI) support
4. Add Kimi (Moonshot) support

**Skills:** `llm-provider-integration` (see references/google.md, zhipu.md, moonshot.md)
**Subagents:** `context7-docs-fetcher` (latest SDK docs), `test-writer`, `code-reviewer`

### Phase 16F: Dynamic Tool Registry & Advanced Toolpacks
**Goal:** Restore full tool parity (22+ tools) and optimize context usage by porting the dynamic registry pattern to the new `ChatProvider` architecture.

**Context:** The old MCP server (Phase 6) had 20+ tools organized in packs (Mobile, Introspection, Graphing) but only exposed a small set of "Gateway" tools initially to save context tokens. The new `claude-agent-sdk` implementation in Phase 16A exposes only the 9 Core tools and lacks this dynamic capability.

**Plan:**
1.  **Port Advanced Toolpacks**: Move logic from `apps/mcp` to `apps/server/src/agent/tools/`:
    -   `mobile-core/`: `search_mobile_docs`, `find_code_examples`, `get_feature_recipe`
    -   `introspection/`: `get_project_tech_stack`, `get_db_schema`, `find_symbol_usages`
    -   `graphing/`: `graph_expand_context`
2.  **Implement Server-Side Dynamic Registry**: Create `apps/server/src/services/tool-registry.ts` to manage tool visibility based on session state.
3.  **Implement Gateway Tools**:
    -   `discover_tools`: Lists available toolpacks (low token cost).
    -   `enable_tools`: Dynamically updates the session's enabled tool list.
4.  **Update Chat Logic**: Refactor `agent.ts` to re-generate the `tools` array passed to the provider whenever `enable_tools` is called, allowing the agent to "expand" its capabilities mid-conversation.

**Skills:** `synthesis-architecture`, `backend-development`, `agentic-design`
**Subagents:** `Plan` (registry design), `test-writer` (dynamic flow tests)

### Cross-Phase Resources
**Throughout all phases:**
- `git-github-workflow-manager` - PR creation and management
- `doc-writer` - Update docs after each phase
- `brainstorming` - Design decisions when multiple approaches exist
- `planning` - Break down complex tasks

---

## Technical Details

### Provider Interface (Draft)

```typescript
interface ChatProvider {
  name: string;
  supportsTools: boolean;
  supportsStreaming: boolean;

  chat(params: ChatParams): Promise<ChatResponse>;
  streamChat(params: ChatParams): AsyncGenerator<ChatChunk>;
}

interface ChatParams {
  messages: Message[];
  model: string;
  tools?: Tool[];
  maxTokens?: number;
  temperature?: number;
}

interface ChatResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
  model: string;
  provider: string;
}
```

### SSE Streaming Format

```text
event: token
data: {"content": "Hello"}

event: tool_start
data: {"tool": "search_rag", "input": {...}}

event: tool_end
data: {"tool": "search_rag", "output": {...}}

event: done
data: {"usage": {...}}
```

### Config Integration

The `ModelConfigService` already supports:
- Provider selection per feature (chat, embedding, etc.)
- API key storage
- Model selection per provider

We'll use `getConfig('chat')` to get the active chat provider.

---

## Files to Create

```text
apps/server/src/
├── services/
│   └── chat-providers/
│       ├── index.ts           # Provider registry
│       ├── types.ts           # Interfaces
│       ├── anthropic.ts       # Anthropic provider
│       ├── openai.ts          # OpenAI provider
│       ├── ollama.ts          # Ollama provider
│       ├── google.ts          # Google AI provider
│       └── openai-compatible.ts # Base for GLM, Kimi
├── routes/
│   └── agent-stream.ts        # SSE streaming endpoint

apps/web/src/
├── hooks/
│   └── useStreamingChat.ts    # SSE client hook
├── components/
│   └── StreamingMessage.tsx   # Token-by-token display
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Claude SDK WSL2 still fails | Medium | Medium | Docker fallback ready |
| Tool format incompatibility | Low | Medium | Graceful degradation to simple chat |
| Streaming complexity | Low | Low | Can ship non-streaming first |
| GLM/Kimi API differences | Medium | Low | They're P2, can skip if problematic |

---

## Success Criteria

1. Can switch between Ollama/Anthropic/OpenAI in UI and chat works
2. Messages appear immediately with loading indicator
3. Streaming tokens display in real-time
4. RAG tools work with Anthropic and OpenAI
5. Existing functionality unchanged

---

## GitHub Workflow

### Branch Strategy
- **Base branch:** `develop`
- **Feature branch:** `feature/phase-16-multi-provider-chat`
- All PRs target `develop`, merge to `main` only for stable releases

### Commit Strategy
Each sub-phase (16A, 16B, etc.) gets its own commits. Group related changes:

| Phase | Commits | PR Strategy |
|-------|---------|-------------|
| 16A: Foundation | 1-2 commits (SDK test + provider interface) | Single PR |
| 16B: Multi-Provider | 3-4 commits (interface + each provider) | Single PR |
| 16C: Streaming & UI | 2-3 commits (backend SSE + frontend) | Single PR |
| 16D: Tool Adapters | 1-2 commits (adapters + tests) | Single PR |
| 16E: Additional Providers | 1 commit per provider | Single PR |
| 16F: Dynamic Tools | 3-4 commits (registry + gateway tools) | Single PR |

### Workflow Steps

1. **Start work on a sub-phase:**
   ```bash
   git checkout develop && git pull
   git checkout -b feature/phase-16-multi-provider-chat
   ```

2. **Commit logical units of work:**
   ```bash
   # After completing provider interface
   git add -A && git commit -m "feat(phase-16a): add ChatProvider interface and types"

   # After completing Anthropic provider
   git add -A && git commit -m "feat(phase-16b): implement AnthropicChatProvider"
   ```

3. **Push and create PR when sub-phase complete:**
   ```bash
   git push -u origin feature/phase-16-multi-provider-chat
   gh pr create --base develop --title "feat(phase-16a): foundation and provider interface"
   ```

4. **After PR merge, continue on same branch or create new:**
   ```bash
   git checkout develop && git pull
   # Continue on same branch for related work, or create new branch
   ```

### Commit Message Format
```text
feat(phase-16X): short description

- Detail 1
- Detail 2

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Reference Links

- Claude Agent SDK WSL2 issue: <https://github.com/anthropics/claude-agent-sdk-typescript/issues/20>
- Docker root user fix: <https://github.com/anthropics/claude-agent-sdk-typescript/issues/74>
- Current agent code: `apps/server/src/agent/agent.ts`
- Model config service: `apps/server/src/services/model-config-service.ts`
- Settings UI: `apps/web/src/pages/settings/ModelsPage.tsx`

---

## Notes

### WSL2 Claude CLI Path Workaround (Phase 16A)

**Issue:** The Claude Agent SDK uses a pre-compiled binary that crashes on WSL2 due to glibc/syscall incompatibilities ([Issue #20](https://github.com/anthropics/claude-agent-sdk-typescript/issues/20), [Issue #5823](https://github.com/anthropics/claude-code/issues/5823)).

**Workaround:** Use `pathToClaudeCodeExecutable` pointing to the npm/pnpm-installed Claude Code CLI (JavaScript-based), not the native binary.

**Current Implementation:**
```typescript
const CLAUDE_CLI_PATH = process.env.CLAUDE_CLI_PATH || 'claude';
```

**For WSL2 users:** Set `CLAUDE_CLI_PATH` environment variable to the pnpm-installed path:
```bash
export CLAUDE_CLI_PATH="/home/<username>/.local/share/pnpm/claude"
```

**For non-WSL2 users:** The default `'claude'` (in PATH) works if Claude Code is installed via npm/pnpm globally.

**CodeRabbit Review Note:** The hardcoded path was flagged and changed to use env var with `'claude'` fallback. WSL2 users must set `CLAUDE_CLI_PATH` explicitly. This is documented but not enforced at runtime to avoid breaking non-WSL2 deployments.
