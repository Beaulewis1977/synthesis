# Phase Summary: Phase 3 – Search & Agent Tools

**Date:** 2025-10-08  
**Agent:** Codex (Builder)  
**Duration:** 2 days

---

## 📋 Overview

Implemented production-ready semantic search and integrated the Claude Messages API agent loop. Added a full MCP-style tool suite (search, ingestion, web crawl, management, summaries), refactored the agent off the buggy SDK, and refreshed supporting docs/issue templates. Prior SDK-based implementation is archived in git stash for future comparison once the upstream bug is fixed. End-to-end RAG workflows (fetch → ingest → embed → search → answer) were validated after installing Playwright’s headless Chromium bundle.

---

## ✅ Features Implemented

- [x] Vector search service with cosine similarity and citations (`searchCollection`)
- [x] `/api/search` endpoint returning top-k chunk matches
- [x] Claude Messages API agent loop with nine tools and `/api/agent/chat`
- [x] Documentation & issue template updates covering new agent architecture

---

## 📁 Files Changed

### Added
- `apps/server/src/agent/utils/storage.ts` – Helpers for downloading, inferring MIME/extension, and writing document files
- `apps/server/src/agent/__tests__/agent.test.ts` – Unit tests for the manual Messages API loop
- `apps/server/src/agent/__tests__/tools.test.ts` – Unit tests covering each tool executor

### Modified (highlights)
- `apps/server/src/agent/agent.ts` – Replaced SDK Agent wrapper with custom Messages API loop, tool execution, and usage tracking
- `apps/server/src/agent/tools.ts` – Converted tools to `{definition, executor}` pairs, added fetch/add/list/delete/restart/summarize implementations
- `apps/server/src/routes/agent.ts` – Wired POST `/api/agent/chat` into the new agent runner
- `apps/server/src/routes/search.ts` / `apps/server/src/services/search.ts` – Vector search endpoint and service
- `docs/04_AGENT_TOOLS.md`, `docs/09_BUILD_PLAN.md`, `docs/14_GITHUB_ISSUES.md`, `docs/15_AGENT_PROMPTS.md` – Updated architecture guidance, plans, and issues to reflect Messages API usage and expanded tool set
- `apps/server/package.json` / `pnpm-lock.yaml` – Removed `@anthropic-ai/claude-agent-sdk`, pinned `@anthropic-ai/sdk@^0.65.0`

### Deleted
- n/a

---

## 🧪 Tests Added

### Unit Tests
- `apps/server/src/agent/__tests__/agent.test.ts` – Validates multi-turn tool loop with mocked Anthropic responses
- `apps/server/src/agent/__tests__/tools.test.ts` – Covers every tool executor, mocks storage/Playwright/Anthropic
- `apps/server/src/routes/__tests__/search.test.ts` / `apps/server/src/services/__tests__/search.test.ts` – Ensure search API/service behaviour

### Test Results
```
pnpm --filter @synthesis/server typecheck
pnpm --filter @synthesis/server exec -- vitest run --pool=vmThreads
✓ All suites passing (28 tests)
```

### Manual End-to-End Validation
- Playwright browser installed via `pnpm --filter @synthesis/server exec -- npx playwright install chromium`
- `fetch_web_content` scraped https://example.com, queued ingestion, and kicked off the pipeline
- `get_document_status` and `restart_ingest` monitored/replayed processing
- `search_rag` retrieved vector matches and the agent synthesized a citation-rich answer

---

## 🎯 Acceptance Criteria

- [x] **Vector search service** returns relevant chunks with citations – ✅ Complete
- [x] **POST /api/search** returns top-k matches scoped by collection – ✅ Complete
- [x] **Agent uses search tool automatically** via `/api/agent/chat` – ✅ Complete
- [x] **Agent responses cite sources** and leverage retrieved documents – ✅ Complete

---

## ⚠️ Known Issues

### Issue 1: Anthropic Claude Agent SDK binary crash on WSL2
- **Severity:** Medium
- **Description:** Upstream SDK bundles native binaries incompatible with our WSL2 environment, triggering RuntimeException on load.
- **Impact:** Prevents us from using the SDK’s automation helpers; necessitated refactor to direct Messages API.
- **Workaround:** Custom Messages API loop implemented; prior SDK-based code preserved in git stash for easy reintroduction once fixed.
- **Tracked:** Upstream issue pending; local note for Phase 4 follow-up.
- **Plan:** Periodically retry SDK once Anthropic releases a compatible build.

---

## 💥 Breaking Changes

### None
✅ No breaking changes in this phase.

---

## 📦 Dependencies Added/Updated

### Removed Dependencies
```json
{
  "@anthropic-ai/claude-agent-sdk": "removed"
}
```
**Reason:** Binary incompatibility under WSL2 forced migration to direct Messages API.

### Updated Dependencies
```json
{
  "@anthropic-ai/sdk": "^0.27.0 → ^0.65.0"
}
```
**Reason:** Needed streaming + tool support available in latest SDK.

---

## 🔗 Dependencies for Next Phase

1. **Playwright tooling** already configured for web crawling; Phase 4 can build on the `fetch_web_content` executor.
2. **Ingestion pipeline** ready for retry/resume via `restart_ingest` – usable by autonomy enhancements.
3. **Search API** now stable; front-end/UI work can rely on `/api/search` without further backend changes.

---

## 📊 Metrics

### Testing
- Tests added: 7 suites (28 assertions)
- Test execution time: ~2s via Vitest

### Code Quality
- LOC delta: ≈ +1,200 / −400 (tools + tests + docs)
- Lint/typecheck: ✅ `pnpm --filter @synthesis/server typecheck`

### Performance (qualitative)
- Vector search response time unchanged (server-side DB query only)
- Agent loop adds ≤1 extra network roundtrip per tool call; acceptable for Phase 3

---

## 🔍 Review Checklist

### Code Quality
- [x] TypeScript best practices (strict mode, typed executors)
- [x] Focused, testable functions (tool executors, agent loop helpers)
- [x] Descriptive naming; magic values abstracted (constants for tool names)
- [x] Structured error handling with friendly tool messages
- [x] No stray console.log (server logging uses Fastify logger)

### Testing
- [x] Unit tests for new logic
- [x] Edge/error cases (missing docs, confirm flag, no chunks)
- [x] External dependencies mocked (Playwright, Anthropic, DB)
- [x] Total runtime <5s

### Security & Performance
- [x] Parameterized queries via pg client
- [x] Input validation with Zod
- [x] No N+1 behaviour (single queries per tool)

### Documentation
- [x] Docs/plan/issue templates updated to reflect Messages API loop
- [x] Environment requirements clarified (`ANTHROPIC_API_KEY`, etc.)

---

## 📝 Notes for Reviewers

- Prior Claude Agent SDK implementation has been stashed (`git stash show --stat` for details) for easy reapply once Anthropic ships a fixed build.
- Ensure `ANTHROPIC_API_KEY`, database, Ollama, and storage env vars are set before manual E2E testing.
- Tool executors return Markdown-formatted strings; caller handles JSON serialization.

### Testing Instructions
```bash
pnpm --filter @synthesis/server typecheck
pnpm --filter @synthesis/server exec -- vitest run --pool=vmThreads
```