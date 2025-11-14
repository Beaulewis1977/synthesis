# Phase 16: Build Plan

**Focus:** MCP Server Completion, UI/UX Enhancements, Persistent Chat History

---

## Part 1 — MCP Server Completion & Hardening

**Goal:** Implement all planned MCP tools and secure the server.

### 1.1: Implement Missing Management Tools (4-5 hours)

**File to Modify:** `apps/mcp/src/index.ts`

For each tool below, implement the `server.registerTool` function, create a Zod schema for input validation, and connect it to the corresponding backend API endpoint using the `apiClient`.

1.  **`list_collections`**
    *   **Description:** Lists all available document collections.
    *   **Input:** None.
    *   **Action:** Call `apiClient.get('/api/collections')`.

2.  **`list_documents`**
    *   **Description:** Lists all documents within a given collection.
    *   **Input:** `z.object({ collectionId: z.string().uuid() })`
    *   **Action:** Call `apiClient.get("/api/collections/${collectionId}/documents")`.

3.  **`create_collection`**
    *   **Description:** Creates a new, empty collection.
    *   **Input:** `z.object({ name: z.string().min(1), description: z.string().optional() })`
    *   **Action:** Call `apiClient.post('/api/collections', { name, description })`.

4.  **`fetch_and_add_document_from_url`**
    *   **Description:** Fetches content from a URL and ingests it.
    *   **Input:** `z.object({ collectionId: z.string().uuid(), url: z.string().url() })`
    *   **Action:** Call `apiClient.post('/api/documents/add-from-url', { collectionId, url })`.

5.  **`delete_document`**
    *   **Description:** Deletes a single document.
    *   **Input:** `z.object({ documentId: z.string().uuid(), confirm: z.literal(true) })`
    *   **Action:** Call `apiClient.delete("/api/documents/${documentId}")`.

6.  **`delete_collection`**
    *   **Description:** Deletes an entire collection and all its documents.
    *   **Input:** `z.object({ collectionId: z.string().uuid(), confirm: z.literal(true) })`
    *   **Action:** Call `apiClient.delete("/api/collections/${collectionId}")`.

### 1.2: MCP Server Security Hardening (2-3 hours)

1.  **Add Rate Limiting:** Implement a token-bucket limiter at the HTTP transport layer with a default refill rate of 100 tokens/minute and a burst capacity of 200 tokens. Persist limiter state in an in-memory `Map` keyed by canonical client IP, where each entry tracks `tokens` + `lastRefill`. Resolve the IP by trusting the first public value in `X-Forwarded-For` when `trustProxy=true`, otherwise fall back to `req.ip`; document how to configure the trusted proxy list. Run a GC pass every 10 minutes to evict keys idle for 30 minutes so the map cannot grow unbounded. Provide a bypass list for requests that carry a valid `Authorization` header (authenticated users) and for internal service CIDRs, both configurable per environment. Expose knobs for refill rate, burst size, and bypass CIDRs via env or config. Call out that the in-memory option only works for single-instance deployments; for clustered deployments, recommend wiring up `express-rate-limit` or `rate-limiter-flexible` with Redis/Postgres storage so state, cleanup, and distributed coordination are handled automatically.
2.  **Authentication (Future-proofing):** While not yet implemented in the backend, add placeholder logic in the MCP server to check for an `Authorization` header and pass it through to the `apiClient`. This makes it easier to secure later.
3.  **Dependency Security Scan:** Run `pnpm audit` within the `apps/mcp` directory and report any high or critical vulnerabilities. Create a plan to mitigate them.
4.  **Input Validation Review:** Ensure every tool uses a `.strict()` Zod schema to prevent any extra, unexpected parameters from being passed.

---

## Part 2 — UI/UX Enhancements

**Goal:** Improve user workflow by adding key management features to the frontend.

### 2.1: "Add New Collection" Feature (3-4 hours)

1.  **Create Button:** In `apps/web/src/pages/CollectionView.tsx`, add a new "Add Collection" button to the UI.
2.  **Create Modal:** Build a new reusable `Modal` component and a specific `AddCollectionModal.tsx` component. The modal should contain a form with "Name" and "Description" fields.
3.  **API Integration:** On form submission, call a new backend endpoint `POST /api/collections` with the form data. Use React Query for mutation handling to automatically refetch the collections list on success.

### 2.2: Batch Document Deletion (3-4 hours)

1.  **Backend API Endpoint:**
    *   Create a new endpoint: `DELETE /api/documents/batch`.
    *   It should accept a body with an array of document IDs: `{ documentIds: [...] }`.
    *   Implement the logic in `apps/server` to delete multiple documents in a single transaction.
2.  **Frontend UI:**
    *   In the document list view (`apps/web/src/pages/DocumentView.tsx`), add checkboxes next to each document.
    *   When one or more documents are selected, show a "Delete Selected" button.
    *   On click, show a confirmation dialog.
    *   On confirmation, call the new `DELETE /api/documents/batch` endpoint and refetch the document list.

---

## Part 3 — Persistent Chat History

**Goal:** Allow users to save and resume their chat sessions.

### 3.1: Backend - Database & API (4-5 hours)

1.  **Database Schema (`packages/db`):**
    *   Create a `chat_sessions` table (`id`, `user_id`, `title`, `created_at`).
    *   Create a `chat_messages` table (`id`, `session_id`, `role` ('user' or 'assistant'), `content`, `timestamp`).
2.  **API Endpoints (`apps/server`):**
    *   `GET /api/chats`: List all chat sessions for the current user.
    *   `POST /api/chats`: Create a new chat session.
    *   `GET /api/chats/:id/messages`: Get all messages for a specific chat session.
    *   Modify the existing `/api/search` or a new `/api/chats/:id/message` endpoint to automatically save the user's prompt and the AI's response to the database.

### 3.2: Frontend - UI & State Management (5-6 hours)

1.  **Chat History Panel:**
    *   Create a new collapsible sidebar component in `apps/web/src/pages/ChatPage.tsx`.
    *   Fetch and display the list of past chat sessions from `GET /api/chats`.
    *   Allow users to click a session to load it, or click a "New Chat" button.
2.  **State Management:**
    *   Use React Query to fetch and cache chat history.
    *   When a user sends a message, use a mutation to save the message and the response.
    *   The chat interface should be driven by the data from the API, not just local state.
3.  **Routing:**
    *   Update the routing to support URLs like `/chat/:id` to link directly to a specific chat session. If no ID is present, it can be a new chat.

---

## Part 4 — Document Lifecycle Management

**Goal:** Add features to view, edit, and update existing documents to ensure the knowledge base remains current.

### 4.1: Document Versioning & Update Detection (4-5 hours)

1.  **Database Schema:**
    *   In the `documents` table, add a `version` column (integer, default 1), a `source_url_hash` column (string), and a `last_checked_at` timestamp.
2.  **Update Detection Service:**
    *   Scheduler: add a cron-driven background job that defaults to running once per day at 02:00 UTC (`0 2 * * *`) with an env override for teams that need different cadences. Each run records `started_at`, `ended_at`, document counts, and success/failure stats in a `document_update_jobs` table.
    *   Concurrency model: pull documents in paginated batches of 500 ordered by `last_checked_at`, enqueue them into a worker pool with a configurable parallelism limit (default 5 concurrent workers) and per-worker fetch batch size of 50 URLs. Workers obey an outbound rate limit of 5 requests/second/host to avoid being throttled. Batching ensures the job can comfortably scan ~20k docs in ≈2–3 hours assuming 250–300 ms per fetch; scale horizontally by spinning up additional workers with a distributed queue if needed.
    *   Hashing & dedup: fetch each document's normalized content (trim whitespace, lowercase headers, remove tracking query params) and compute a SHA-256 hash over `normalized_headers + '\n' + normalized_body`. Skip reprocessing if the computed hash matches `source_url_hash`. Store both the new hash and the fetch `etag/last-modified` (when available) so multiple documents that point to the same URL can deduplicate via hash comparison.
    *   Error handling: classify failures as transient (network errors, DNS, 5xx) vs permanent (4xx other than 429/408, explicit "gone"). Retries use exponential backoff with default delays of 1 min, 5 min, and 15 min for transient failures before surfacing an alert. Permanent failures mark the document as `source_status='invalid'` with the HTTP status captured and no further retries until a manual reset. Each attempt stores timestamps, outcome, and error payload in a `document_update_attempts` table to aid auditing.
    *   Scaling and performance: design the worker to be stateless so it can be horizontally replicated; use the DB's `FOR UPDATE SKIP LOCKED` (or equivalent) when selecting work to prevent duplicate processing. Add configuration for `batch_size`, `max_parallel_workers`, outbound timeout (default 10s), and `max_runtime_minutes` fail-safe that aborts the run to avoid overlapping executions. Add optional per-run rate-limiter tokens so the job can throttle itself when upstream services push back.
    *   Monitoring & alerting: emit metrics (`update_job_success_total`, `update_job_failure_total`, `update_job_duration_seconds`, `documents_marked_stale_total`, `documents_still_stale_gauge`) to Prometheus (or the team's metrics sink) coupled with logs for each retry. Configure alerts when failure rate exceeds 5% over an hour, when stale count grows for >24h, or when a job hasn't finished within the expected runtime window. Provide a dashboard slice that plots throughput vs. backlog so ops can validate the ~20k document target.

### 4.2: Document Re-Ingestion (3-4 hours)

1.  **Backend API Endpoint:**
    *   Create a new endpoint: `POST /api/documents/:id/refresh`.
    *   This endpoint will trigger a re-ingestion process: it refetches the content from the document's `source_url`, deletes all old chunks associated with the document, creates new chunks, and increments the `version` number.
2.  **UI Integration:**
    *   In the document list view, add an "Update" button for documents that are marked as "stale".
    *   Clicking the button calls the new `/api/documents/:id/refresh` endpoint.

### 4.3: View and Edit Documents (4-5 hours)

1.  **Document Detail View:**
    *   Create a new page that displays the content of an ingested document, showing the individual chunks it was broken into.
2.  **Chunk Editor:**
    *   On the document detail view, allow users to edit the text of each chunk.
    *   Saving an edit will update the chunk's content and its embedding in the database. This is useful for correcting OCR or extraction errors.
3.  **Metadata Editor:**
    *   Allow users to view and edit the metadata associated with a document (e.g., title, source).

---

## Part 5 — Testing & Documentation

**Goal:** Ensure the Phase 16 work is fully validated, documented, and ready for hand-off.

1.  **Unit Tests (8–12 hours):** Expand coverage for new MCP tools, rate limiting, and document lifecycle services. Focus on schema validation, authorization plumbing, and worker logic, aiming for >85% coverage in the touched modules.
2.  **Integration Tests (8–12 hours):** Exercise API endpoints end-to-end using the real database schema (collections CRUD, batch deletion, chat persistence, document refresh). Include token-bucket behavior under concurrent load and persistence of chat sessions.
3.  **End-to-End Tests (12–16 hours):** Automate critical UI flows (creating collections, deleting documents, resuming chats, editing chunks) via Playwright/Cypress. Cover authenticated vs. bypassed rate-limiting paths and verify stale indicators update after the background job runs in a staging environment.
4.  **Documentation (4–8 hours):** Update API reference, user guide (collection/document workflows), deployment runbooks (rate limiter configuration, background job scheduling), and include the new monitoring/alerting dashboards. Deliver concise upgrade notes for operators.
5.  **Review & Iteration Buffer (8–12 hours):** Allocate time for code reviews, addressing QA findings, and polishing UX copy or telemetry gaps discovered late in the cycle.

**Overall Phase 16 Duration:** Accounting for build, hardening, and the above QA/documentation work, budget roughly 2–3 weeks of focused engineering time (≈80–120 engineer-hours) so downstream teams can plan staging and release windows with confidence.
