# Plan: Add Cohere Command A (Chat) and Rerank Models

## Overview

Add Cohere's Command A chat model and Rerank models to Synthesis model selectors. This is independent of the 1024-dimension embedding reset.

**Estimated effort**: 15-25k tokens, ~20-30 min execution time

---

## New Models to Add

### Chat Models

| Model | Context | Params | Strengths |
|-------|---------|--------|-----------|
| `command-a-03-2025` | 256K tokens | 111B | Tool use, RAG, agents, multilingual (23 langs), code. 1.75x faster than GPT-4o |

### Rerank Models

| Model | Context | Description |
|-------|---------|-------------|
| `rerank-v3.5` | 4096 tokens | Multilingual (100+ langs), quality optimized |
| `rerank-v3.0` | 4096 tokens | English-focused, stable |

---

## Implementation Tasks

### 1. Add Cohere to ChatProvider Type
**File**: `packages/shared/src/index.ts`

```typescript
// Before
export type ChatProvider = 'anthropic' | 'openai' | 'ollama' | 'google' | 'zhipu' | 'moonshot';

// After
export type ChatProvider = 'anthropic' | 'openai' | 'ollama' | 'google' | 'zhipu' | 'moonshot' | 'cohere';
```

### 2. Add Cohere to PROVIDER_INFO
**File**: `packages/shared/src/index.ts`

Add Cohere entry to `PROVIDER_INFO`:

```typescript
cohere: {
  id: 'cohere',
  name: 'Cohere',
  description: 'Enterprise AI with Command A and Rerank models',
  website: 'https://cohere.com',
  features: [ModelFeature.CHAT, ModelFeature.TOOLS, ModelFeature.RERANK],
  models: {
    chat: ['command-a-03-2025'],
    rerank: ['rerank-v3.5', 'rerank-v3.0'],
  },
  defaultModel: 'command-a-03-2025',
  requiresApiKey: true,
  apiKeyEnvVar: 'COHERE_API_KEY',
},
```

### 3. Add Cohere Chat Implementation
**File**: `apps/server/src/services/llm-providers/cohere.ts` (NEW)

```typescript
import { CohereClientV2 } from 'cohere-ai';

export async function createCohereChat(apiKey: string) {
  const cohere = new CohereClientV2({ token: apiKey });

  return {
    async chat(messages: Message[], options?: ChatOptions) {
      const response = await cohere.chat({
        model: options?.model ?? 'command-a-03-2025',
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      });

      return {
        content: response.message.content[0].text,
        usage: {
          promptTokens: response.usage?.billedUnits?.inputTokens,
          completionTokens: response.usage?.billedUnits?.outputTokens,
        },
      };
    },

    async *chatStream(messages: Message[], options?: ChatOptions) {
      const stream = await cohere.chatStream({
        model: options?.model ?? 'command-a-03-2025',
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      });

      for await (const event of stream) {
        if (event.type === 'content-delta') {
          yield { content: event.delta.message.content.text };
        }
      }
    },
  };
}
```

### 4. Update Reranker Service
**File**: `apps/server/src/services/reranker.ts`

Add/update Cohere reranker models:

```typescript
const COHERE_RERANK_MODELS = ['rerank-v3.5', 'rerank-v3.0'];

async function cohereRerank(
  query: string,
  documents: string[],
  model: string = 'rerank-v3.5',
  topK?: number
) {
  const cohere = new CohereClientV2({ token: process.env.COHERE_API_KEY });

  const response = await cohere.rerank({
    model,
    query,
    documents,
    topN: topK,
  });

  return response.results.map(r => ({
    index: r.index,
    relevanceScore: r.relevanceScore,
  }));
}
```

### 5. Update Model Config UI
**File**: `apps/web/src/components/settings/ModelSettings.tsx`

- Add Cohere to provider dropdown for chat
- Add Command A model option
- Add Cohere reranker options in reranker settings

### 6. Add Cohere API Key Field
**File**: `apps/web/src/components/settings/ApiKeySettings.tsx`

Add input field for `COHERE_API_KEY` (may already exist for embeddings).

---

## Files to Modify Summary

| File | Change |
|------|--------|
| `packages/shared/src/index.ts` | Add 'cohere' to ChatProvider, update PROVIDER_INFO |
| `apps/server/src/services/llm-providers/cohere.ts` | NEW - Cohere chat implementation |
| `apps/server/src/services/llm-providers/index.ts` | Export Cohere provider |
| `apps/server/src/services/reranker.ts` | Update Cohere rerank models |
| `apps/web/src/components/settings/ModelSettings.tsx` | Add Cohere chat option |
| `apps/web/src/components/settings/ApiKeySettings.tsx` | Ensure Cohere API key field exists |

---

## Testing Checklist

1. **Chat with Command A**
   - [ ] Set Cohere as chat provider in settings
   - [ ] Enter Cohere API key
   - [ ] Create new chat session
   - [ ] Verify responses work
   - [ ] Verify streaming works

2. **Rerank with Cohere**
   - [ ] Set rerank-v3.5 as reranker
   - [ ] Run search with reranking enabled
   - [ ] Verify results are reranked

3. **UI**
   - [ ] Cohere appears in chat provider dropdown
   - [ ] Command A model appears when Cohere selected
   - [ ] Reranker dropdown shows Cohere models

---

## Dependencies

- `cohere-ai` npm package (likely already installed for embeddings)
- `COHERE_API_KEY` environment variable

---

## Notes

- This is **independent** of the 1024-dimension embedding reset
- Can be done before, after, or in parallel with the embedding migration
- Command A has excellent tool use capabilities - consider leveraging for agent features
