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

**Goal:** Restore full tool parity (22+ tools) and optimize context usage by porting the dynamic registry pattern to the ChatProvider architecture.

**Status:** COMPLETE ✅

---

### Phase 16G: Per-Chat Model Persistence & Selection

**Goal:** Enable per-chat model/provider selection with persistence, allowing users to override global defaults for specific conversations.

**Context:**
Currently, the chat uses the global default model configured in Settings. Users want to switch models (e.g., use Claude 3.5 Sonnet for coding, GPT-4o for reasoning) within specific chats and have that choice remembered.

**Plan:**

1.  **Database Schema Update**
    *   Add `provider` and `model` columns to `chat_sessions` table.
    *   Migration: `packages/db/migrations/025_chat_session_models.sql`.

2.  **API Updates**
    *   Update `POST /api/agent/chat`: Accept `provider` and `model` in body.
    *   Logic:
        *   If params provided: Update session record in DB.
        *   Resolution Priority: Request Params > DB Session Value > Global Default.
    *   Update `GET /api/agent/sessions/:id` (or history endpoint): Return stored `provider` and `model`.

3.  **UI Implementation**
    *   **Header**: Add `ModelSelector` dropdown to `ChatPage` header (reuse existing component).
    *   **State**: Sync selector with active chat session.
    *   **Flow**:
        *   New Chat: Use Global Default.
        *   Change Selector: Updates local state, sends new model on next message.
        *   Load Chat: Restore selector from session data.

**Files to Modify:**
*   `packages/db/migrations/` (New SQL)
*   `apps/server/src/routes/agent.ts` (Handle params, persist to DB)
*   `apps/server/src/services/chat-history.ts` (DB accessors)
*   `apps/web/src/pages/ChatPage.tsx` (Add selector)
*   `apps/web/src/hooks/useChatSession.ts` (Load/save model state)

**Estimated Commits:**
1.  `feat(phase-16g): add provider/model columns to chat_sessions table`
2.  `feat(phase-16g): update chat API to persist and use session-specific models`
3.  `feat(phase-16g): add model selector to chat UI with persistence`

**Subagents:** `backend-dev` (Schema/API), `frontend-dev` (UI State)

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
| 16G: Model Persistence | 2-3 commits (schema + api + ui) | Single PR |

### Workflow Steps

1. **Start work on a sub-phase:**
   ```bash
   git checkout develop && git pull
   git checkout -b feature/phase-16g-model-persistence
   ```

2. **Commit logical units of work:**
   ```bash
   # After completing schema
   git add -A && git commit -m "feat(phase-16g): add provider/model columns to chat_sessions table"

   # After completing API
   git add -A && git commit -m "feat(phase-16g): update chat API to persist and use session-specific models"
   ```

3. **Push and create PR when sub-phase complete:**
   ```bash
   git push -u origin feature/phase-16g-model-persistence
   gh pr create --base develop --title "feat(phase-16g): per-chat model persistence and selection"
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
