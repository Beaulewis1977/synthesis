# Phase 2: RAG & Agent Modernization

## Objective
Transform the RAG system into a flexible, model-agnostic intelligence layer. This phase focuses on migrating the agent to the Vercel AI SDK to support multiple providers (Anthropic, OpenAI, Ollama) and optimizing the ingestion pipeline.

## 1. Agent SDK Migration
**Current State**: Hardcoded `Anthropic` SDK in `apps/server/src/agent/agent.ts`.
**Target State**: **Vercel AI SDK (Core)**.

### Implementation Steps
1.  **Dependencies**: Install `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, and `@ai-sdk/ollama`.
2.  **Provider Factory**: Create `src/agent/providers.ts` to instantiate the correct model based on configuration strings (e.g., `anthropic:claude-3-5-sonnet`, `ollama:llama3`).
3.  **Tool Refactor**: Rewrite `src/agent/tools.ts` to export tools compatible with Vercel AI SDK's `tool()` helper. Use Zod schemas directly.
4.  **Agent Logic**: Rewrite `runAgentChat` in `agent.ts` to use `generateText` (or `streamText`).
    - Pass the selected model from the factory.
    - Pass the refactored tools.
    - Handle the standardized response format.
5.  **Frontend Update**: Ensure the chat UI correctly handles the new response structure (if changed) or map the backend response to match the existing contract.

## 2. Ingestion Optimization
**Current State**: Full document deletion and re-insertion on every update.
**Target State**: Delta updates and efficient chunking.

### Implementation Steps
1.  **Checksums**: Store a hash (MD5/SHA256) of the file content upon ingestion.
2.  **Delta Check**: When re-ingesting, compare the new hash with the stored hash. If identical, skip processing.
3.  **Smart Re-chunking**: For partial updates (if feasible), only re-process changed sections. (Note: This is complex; "Delta Check" is the MVP win).

## 3. Automated Evaluation (Ragas)
**Current State**: Manual testing only.
**Target State**: Automated RAG quality metrics.

### Implementation Steps
1.  **Test Dataset**: Create a "Golden Dataset" of questions and expected answers (ground truth) for a sample collection.
2.  **Integration**: Create a script `scripts/evaluate-rag.ts` that uses **Ragas** (or a similar library) to run the questions against the RAG pipeline.
3.  **Metrics**: Measure and log:
    - **Context Precision**: Is the retrieved context relevant?
    - **Faithfulness**: Is the answer derived from the context?
    - **Answer Relevance**: Does the answer address the query?

## Success Criteria
- [ ] Users can switch between OpenAI, Anthropic, and Ollama in Settings, and the Agent respects this choice.
- [ ] Re-uploading the same file does not trigger a wasteful re-ingestion process.
- [ ] A baseline evaluation score is established for the RAG pipeline.
