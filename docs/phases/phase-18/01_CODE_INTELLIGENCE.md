# Phase 18.1: Code Intelligence Pack

## Overview
The **Code Intelligence Pack** provides the agent with "sensory" capabilities for the codebase and live data. This allows the agent to answer questions like "How many active users do we have?" or "Where is `UserFactory` defined in the repo?" without needing full shell access.

**Risk Profile:** Low (Read-Only access)

---

## 1. Database Query Tool

### Usage
- **Tool Name:** `db_query_readonly`
- **Description:** Execute READ-ONLY SQL queries against the local database to analyze data.
- **Input:** `query` (string) - SQL query. Must start with `SELECT`.

### Implementation Details
- **Connection:** Create a dedicated `read_only` Postgres user or connection pool that explicitly disallows `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`.
- **Safety:**
  - Parse SQL to ensure it starts with `SELECT`.
  - Set a strict `LIMIT 100` if not present.
  - Set a `statement_timeout` (e.g., 2000ms) to prevent DOS.
- **Location:** `apps/server/src/agent/tool-definitions/intelligence/db-query.ts`

### Example
**User:** "Show me the metadata structure for the last uploaded document."
**Agent:** `db_query_readonly("SELECT metadata FROM documents ORDER BY created_at DESC LIMIT 1")`

---

## 2. Code Search (GitHub / Greptile)

### Usage
- **Tool Name:** `search_github_code`
- **Description:** Search across all organization repositories on GitHub for code patterns or usage examples.
- **Input:** `query` (string), `org` (string, default: configured org), `language` (string, optional).

### Implementation Details
- **Provider:** GitHub REST API (`/search/code`) or Greptile API (semantically wiser).
- **Auth:** Requires `GITHUB_TOKEN` in `.env`.
- **Value:** Allows the agent to find how a utility is used in *other* projects, not just the current one.
- **Location:** `apps/server/src/agent/tool-definitions/intelligence/github-search.ts`

---

## 3. Log Analyzer

### Usage
- **Tool Name:** `fetch_server_logs`
- **Description:** Fetch recent logs from cloud providers to debug runtime errors.
- **Input:** `service` (enum: ['worker', 'edge_function', 'app_server']), `limit` (number, default: 50).

### Implementation Details
- **Providers:**
  - **Cloudflare:** Use Cloudflare API to fetch worker logs (if Analytics Engine is enabled).
  - **Supabase:** Management API for Edge Function logs.
  - **Local:** Read from local pino log files (if running locally).
- **Location:** `apps/server/src/agent/tool-definitions/intelligence/fetch-logs.ts`

---

## Toolpack Configuration

Create a new toolpack definition in `apps/server/src/agent/tool-definitions/toolpacks.ts`:

```typescript
export const INTELLIGENCE_TOOLPACK: ToolpackDefinition = {
  name: 'intelligence',
  description: 'Read-only access to live database, logs, and external code search.',
  defaultCategory: 'core',
  tools: ['db_query_readonly', 'search_github_code', 'fetch_server_logs'],
  sensitiveTools: [], // Read-only is generally considered safe, but query content might be sensitive.
};
```
