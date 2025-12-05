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
| Provider | API Type | Tool Calling | Priority |
|----------|----------|--------------|----------|
| Anthropic | Native SDK | Yes | P0 |
| OpenAI | OpenAI SDK | Yes | P0 |
| Ollama | OpenAI-compatible | Limited | P0 |
| Google | Google AI SDK | Yes | P1 |
| GLM 4 (Z.AI) | OpenAI-compatible | TBD | P2 |
| Kimi (Moonshot) | OpenAI-compatible | TBD | P2 |

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
| Ollama | Limited (depends on model) |

---

## Implementation Phases

### Phase 16A: Foundation (Docker + SDK Test)
1. Test Claude Agent SDK workaround
2. If fails, create Docker service config for server
3. Verify SDK works in Docker
4. Create provider abstraction interface

### Phase 16B: Multi-Provider Chat
1. Implement ChatProvider interface
2. Add AnthropicChatProvider (migrate existing)
3. Add OpenAIChatProvider
4. Add OllamaChatProvider
5. Wire up model selector to provider selection

### Phase 16C: Streaming & UI
1. Add SSE endpoint for streaming responses
2. Implement optimistic message display
3. Add loading/typing indicators
4. Token-by-token rendering
5. Progress for tool execution

### Phase 16D: Tool Adapters
1. Create tool format converter for OpenAI
2. Create tool format converter for Google
3. Test tool calling across providers
4. Graceful fallback for non-tool providers

### Phase 16E: Additional Providers
1. Add Google AI provider
2. Add OpenAI-compatible provider base
3. Add GLM 4 (Z.AI) support
4. Add Kimi (Moonshot) support

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

## Reference Links

- Claude Agent SDK WSL2 issue: <https://github.com/anthropics/claude-agent-sdk-typescript/issues/20>
- Docker root user fix: <https://github.com/anthropics/claude-agent-sdk-typescript/issues/74>
- Current agent code: `apps/server/src/agent/agent.ts`
- Model config service: `apps/server/src/services/model-config-service.ts`
- Settings UI: `apps/web/src/pages/settings/ModelsPage.tsx`
