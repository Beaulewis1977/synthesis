# Phase 17: Build Plan

**Focus:** Autonomous Ingestion, Batch Document Upload

---

## Part 1 — Batch Document Upload

**Goal:** Implement a full-stack feature for uploading multiple documents simultaneously.

### 1.1: Backend API Endpoint (3-4 hours)

1.  **File Upload Endpoint:**
    *   In `apps/server`, create a new endpoint: `POST /api/documents/batch-upload`.
    *   This endpoint must be configured to handle `multipart/form-data` requests containing multiple files.
2.  **Processing Logic:**
    *   For each file in the request, the endpoint should stream it to a temporary location.
    *   Trigger the existing single-document ingestion pipeline for each uploaded file.
    *   The endpoint should return a summary of the operation (e.g., number of files succeeded, number failed).
3.  **Configuration:**
    *   Update server configuration to allow for larger request body sizes suitable for file uploads.

### 1.2: Frontend UI (4-5 hours)

1.  **UI Component:**
    *   In `apps/web`, create a new page or a modal for batch uploading.
    *   Implement a drag-and-drop file input area that accepts multiple files (`.pdf`, `.txt`, `.md`, etc.).
2.  **Upload Logic:**
    *   On file selection, construct a `FormData` object.
    *   Make a `POST` request to the new `/api/documents/batch-upload` endpoint.
3.  **Progress & Feedback:**
    *   Display the upload progress for each file individually or as a total.
    *   Show a success message with a summary upon completion.
    *   Display detailed error messages for any files that failed to ingest.

---

## Part 2 — Self-Ingesting Agent

**Goal:** Create an autonomous agent within Synthesis that can build a knowledge base from a simple topic prompt.

### 2.1: Agent Scaffolding & Tooling (3-4 hours)

1.  **Agent Service:**
    *   Create a new directory `apps/ingestion-agent`.
    *   Set up a new Node.js/TypeScript service. This will be a long-running process, separate from the main `server` and `mcp` apps.
2.  **Tool Integration:**
    *   The agent needs a toolset to perform its tasks. This will involve integrating:
        *   **Web Search Tool:** A tool to search the web for URLs based on a query (e.g., using the Google Search API).
        *   **Web Scraper Tool:** A tool to extract the main content from a given URL, stripping out boilerplate like navbars and footers.
        *   **Synthesis API Client:** A client to communicate with the Synthesis server's API (e.g., to call `POST /api/documents/add-from-url`).

### 2.2: Core Agent Logic (5-6 hours)

1.  **Orchestration Flow:**
    *   The agent's primary logic will be an orchestration flow:
        1.  **Receive Topic:** Get a topic and a target `collectionId` as input.
        2.  **Search:** Use the web search tool to find the top 10-20 most relevant URLs for the topic.
        3.  **Filter & Prioritize:** Analyze the URLs to prioritize official documentation, tutorials, and high-quality sources. Discard irrelevant links (e.g., forums, social media).
        4.  **Scrape & Ingest:** For each prioritized URL, use the scraper tool to get the content, then use the Synthesis API client to ingest that content into the specified collection.
2.  **State Management:**
    *   **Chosen approach:** persist state in the primary database so long-running, multi-step jobs survive process restarts, can be resumed after deploys, and support horizontal workers. In-memory tracking is explicitly out of scope except for local prototyping.
    *   **Tradeoffs:** Database storage provides durability, coordinated concurrency control (`SELECT ... FOR UPDATE SKIP LOCKED`), and queryable progress metrics at the cost of modest write amplification and schema maintenance. In-memory options are cheaper but lose all progress on crash and cannot coordinate across replicas; therefore we only use DB-backed queues in prod/staging. To control cost and performance, enable row-level retention policies (auto-delete completed jobs after 30 days), add indexes on `job_id`, `status`, and `next_attempt_at`, and cap batch sizes so polling endpoints remain snappy (<100 ms typical). Horizontal scaling is achieved by allowing multiple workers to claim pending URLs while the DB enforces locking.
    *   **Implementation notes:** Create tables such as `ingestion_jobs` (`id`, `topic`, `collection_id`, `status`, `created_at`, `updated_at`, `started_at`, `completed_at`, `error_summary`) and `ingestion_job_urls` (`id`, `job_id`, `url`, `status`, `failure_count`, `last_attempt_at`, `content_hash`, `retry_after`, `notes`). Each worker claims rows where `status='pending'` and `next_attempt_at <= now`. Store retry metadata so we can enforce exponential backoff and a max retry count (default 5). The `/status/:jobId` endpoint should aggregate counts (`pending`, `processing`, `completed`, `failed`) directly from these tables to show progress and allow operators to query specific URLs or rerun failed subsets.

### 2.3: API and UI for Agent Control (3-4 hours)

1.  **Control Endpoints:**
    *   In `apps/server`, create endpoints to manage the ingestion agent:
        *   `POST /api/ingestion-agent/start`: Starts a new ingestion job with a given topic and `collectionId`.
        *   `GET /api/ingestion-agent/status/:jobId`: Gets the status and progress of an ongoing job.
2.  **Frontend UI:**
    *   In the `apps/web` UI, create a new section.
    *   Add a simple form where the user can enter a topic (e.g., "Flutter State Management") and select a target collection.
    *   A "Start Ingestion" button will call the `/api/ingestion-agent/start` endpoint.
    *   The UI should then poll the `/status` endpoint to display the agent's progress in real-time (e.g., "Found 15 URLs...", "Ingesting flutter.dev/docs...", "Complete!").
