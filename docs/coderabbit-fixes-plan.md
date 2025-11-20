# CodeRabbit Fixes Plan – PR #56 (Commit 9cf6e9c)

## Overview
CodeRabbit highlighted a mix of functional bugs, robustness gaps, and documentation polish items that remain outstanding after commit `9cf6e9c`. This document groups the findings by priority and records the concrete fix approach we will take. Status for every item is currently `Pending`.

---

## 🔴 Critical Priority

### 1. Align MCP tool schemas with runtime validation
**Files**: `apps/mcp/src/index.ts`, `docs/07_MCP_SERVER.md`  
**Why it matters**: The JSON schema exposed through MCP discovery advertises defaults and integer types, but the Zod schema still marks `top_k`, `min_similarity`, and crawl parameters as optional without defaults. Clients that trust the schema can send decimals or omit values and hit validation errors.  
**Plan**:
- Update `searchRagSchema`/`fetchDocumentSchema` to use `.default(...)` so parsed input receives defaults automatically.
- Ensure JSON schema entries mirror those defaults (`default: 5`, `default: 0.5`, `default: 'single'`, etc).  
- Refresh the documentation snippet in `docs/07_MCP_SERVER.md` so it matches the corrected shape.
**Status**: ✅ Completed (JSON schema helper + `_meta.jsonSchema` wired up in `apps/mcp/src/index.ts`; documentation excerpt updated.)

### 2. Harden MCP API client request handling
**File**: `apps/mcp/src/api.ts`  
**Why it matters**: For GET/DELETE requests we currently send `Content-Type: application/json`, which can break some servers. Error handling also only surfaces raw text, missing structured backend errors.  
**Plan**:
- Only set the JSON content-type header when a request body exists.
- Mirror the web client logic: attempt to parse JSON error bodies, expose backend `error`/`message` fields, and attach the HTTP status to the thrown error object so tools surface actionable failure reasons.
**Status**: ✅ Completed (conditional header + structured error parsing now mirror web client.)

---

## 🟠 High Priority

### 3. Use typed errors for document deletion
**Files**: `apps/server/src/services/documentOperations.ts`, `apps/server/src/routes/agent.ts`  
**Why it matters**: The route looks for `"not found"` substrings in generic error messages. That is brittle and risks false positives when upstream wording changes.  
**Plan**:
- Introduce a `DocumentNotFoundError` class in the service layer and throw it when the document lookup misses.
- Update the route handler to branch on `instanceof DocumentNotFoundError`, guaranteeing stable 404 handling while keeping a clean 500 path for everything else.
**Status**: ✅ Completed (custom error exported from `documentOperations.ts`; route performs `instanceof` check.)

### 4. Remove duplicate error status updates during ingestion
**File**: `apps/server/src/routes/ingest.ts`  
**Why it matters**: The ingestion route catches failures from `ingestDocument` and immediately issues its own `updateDocumentStatus('error', ...)`, duplicating the work already done inside the orchestrator’s catch handler. The double update adds log noise and increases the likelihood of conflicting DB writes.  
**Plan**: Let the orchestrator own status management—retain the log statement but drop the manual status update block.
**Status**: ✅ Completed (current route delegates error transitions to orchestrator; no redundant status update remains.)

---

## 🟡 Medium Priority

### 5. Make the MCP verify script safer and shellcheck-clean
**File**: `scripts/verify-mcp-tools.sh`  
**Why it matters**: Several shellcheck SC2155 warnings indicate we mask exit codes; the script also kills whatever process happens to use the backend port with `kill -9`, and it assumes tool text payloads are plain objects rather than JSON strings. These issues can break local environments and hide failures.  
**Plan**:
- Add `command -v lsof` guard and fall back gracefully when it is absent. When present, attempt `kill` before escalating to `kill -9`, with a short pause in between.
- Convert every `local var=$(...)` into separate declare + assignment to satisfy ShellCheck.
- Parse MCP tool text payloads via `jq 'fromjson | …'` before digging into fields to avoid silent parse errors.
**Status**: ✅ Completed (script now guards `lsof`, soft-kills before `-9`, and parses tool payloads via `extract_json_payload`.)

### 6. Provide dual-format exports for the MCP package
**File**: `apps/mcp/package.json`  
**Why it matters**: Consumers (and tooling) benefit from explicit `module`, `exports`, and `engines` declarations. CodeRabbit flagged the missing exports map.  
**Plan**: Add `module`, `exports` entries for ESM/CJS, and require Node `>=18`. Confirm `tsup` emits ESM & CJS artifacts plus `.d.ts` files.
**Status**: ✅ Completed (package.json exposes ESM/CJS/typing entrypoints and Node ≥18 engine.)

### 7. Improve CORS configuration fallback
**File**: `apps/server/src/index.ts`  
**Why it matters**: If `CORS_ALLOWED_ORIGINS` is set to commas/whitespace only, the current logic returns `[]`, effectively blocking all origins but without warning.  
**Plan**: After trimming/filtering, return `false` when the resulting array is empty, matching the bot’s recommendation.
**Status**: ✅ Completed (empty origin list now collapses to `false` so Fastify falls back to default behaviour.)

---

## 🟢 Low Priority (Polish & Docs)

### 8. Documentation lint fixes
**Files**: `PHASE_6_SUMMARY.md`, `PHASE_6_MCP_VERIFICATION.md`  
**Issues**: Missing language specifiers on fenced blocks and a bare URL trigger markdownlint failures.  
**Plan**:
- Mark result and architecture blocks with `bash`/`text` as appropriate.
- Wrap `https://example.com` in angle brackets.
**Status**: ✅ Completed (markdown fences updated with languages; bare URL wrapped.)

### 9. Optional robustness follow-ups
**Items**:
- **Streaming uploads**: Switch from `file.toBuffer()` to streaming writes to cut peak memory usage. (apps/server/src/routes/ingest.ts)
- **Configurable crawl pacing**: Promote the 1s delay & 30s timeout in `documentOperations.ts` to configurable options passed through the MCP tool.
- **Robots.txt awareness**: Evaluate respecting `robots.txt` before enabling crawl mode in production.  
These are not required for CodeRabbit sign-off but worth scheduling once higher-priority fixes land.

---

## Status Tracking
| Area | Owner | Status |
| --- | --- | --- |
| Align MCP schemas & docs | _unassigned_ | Completed |
| MCP API client error handling | _unassigned_ | Completed |
| Typed deletion errors | _unassigned_ | Completed |
| Ingestion double-update removal | _unassigned_ | Completed |
| Verify script safeguards | _unassigned_ | Completed |
| MCP package exports/engines | _unassigned_ | Completed |
| CORS fallback refinement | _unassigned_ | Completed |
| Markdown lint fixes | _unassigned_ | Completed |
| Optional follow-ups | _unassigned_ | Backlog |

---

_Last updated:_ Review follow-up through commit `dca27c2`.

1. **Make timeouts configurable** via environment variables:
```typescript
const CRAWL_DELAY_MS = Number(process.env.CRAWL_DELAY_MS || '1000');
const NAVIGATION_TIMEOUT_MS = Number(process.env.NAVIGATION_TIMEOUT_MS || '30000');

// Line 73:
await new Promise((resolve) => setTimeout(resolve, CRAWL_DELAY_MS));

// Line 76:
await page.goto(normalizedUrl, { waitUntil: 'networkidle', timeout: NAVIGATION_TIMEOUT_MS });
```

2. **Add robots.txt note** in comments:
```typescript
// Note: This crawler does not currently respect robots.txt.
// Consider adding robots.txt parsing for production crawling.
if (mode === 'crawl') {
  // ... existing crawl logic
}
```

3. **Optional: Add rate limiting note**:
```typescript
// Current implementation uses a simple fixed delay between requests.
// For production, consider implementing exponential backoff or
// respecting Retry-After headers.
```

---

## Summary

### Changes Required
✅ **All Critical / High / Medium items** are now resolved  
✅ **Documentation & script polish** landed with language fences and safer parsing  
🔵 **Optional follow-ups** (streaming uploads, robots.txt awareness, configurable crawl pacing) remain backlog

### Action Items

**Required**:
- _None — all blocker items implemented._

**Optional (Nice-to-Have)**:
1. Make crawl timeouts configurable via environment variables
2. Add comments about robots.txt and rate limiting considerations

### Verification
Latest local verification: `pnpm --filter @synthesis/mcp type-check`
