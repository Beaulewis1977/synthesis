# Phase 17: Proposed GitHub Issues

This document outlines the GitHub issues that should be created to track the work planned in Phase 17.

---

## Proposed Issues

### Epic

-   **Title:** `Epic: Phase 17 - Autonomous Ingestion & Batch Processing`
-   **Body:** "This epic tracks the implementation of a self-ingesting agent and a batch document upload feature. See the build plan in `docs/new-phases/04_PHASE_17_BUILD_PLAN.md` for full details."
-   **Labels:** `epic`, `phase-17`

---

### Part 1: Batch Document Upload

-   **Title:** `feat(api): Create Endpoint for Batch Document Uploads`
-   **Body:**
    ```markdown
    **Task:** Implement a new backend endpoint to handle the upload of multiple documents at once.

    **Acceptance Criteria:**
    - [ ] A new endpoint `POST /api/documents/batch-upload` is created.
    - [ ] The endpoint accepts `multipart/form-data`.
    - [ ] The endpoint correctly processes each file and triggers the standard ingestion pipeline.
    - [ ] Server configuration is updated to handle larger request sizes for file uploads.
    ```
-   **Labels:** `feature`, `phase-17`, `api`

-   **Title:** `feat(ui): Implement Batch Document Upload UI`
-   **Body:**
    ```markdown
    **Task:** Build a frontend interface for users to upload multiple documents at once.

    **Acceptance Criteria:**
    - [ ] A new UI component with a drag-and-drop file input is created.
    - [ ] The component calls the `POST /api/documents/batch-upload` endpoint on file submission.
    - [ ] The UI displays upload progress and provides clear success or error feedback to the user.
    ```
-   **Labels:** `feature`, `phase-17`, `ui`

---

### Part 2: Self-Ingesting Agent

-   **Title:** `chore(agent): Scaffold Self-Ingesting Agent Service and Tooling`
-   **Body:**
    ```markdown
    **Task:** Set up the new `ingestion-agent` service and integrate its necessary tools.

    **Acceptance Criteria:**
    - [ ] A new application is created at `apps/ingestion-agent`.
    - [ ] The agent service has a web search tool integrated.
    - [ ] The agent service has a web scraping tool integrated.
    - [ ] The agent service has a client for communicating with the Synthesis API.
    ```
-   **Labels:** `chore`, `feature`, `phase-17`, `agent`

-   **Title:** `feat(agent): Implement Core Logic for Self-Ingesting Agent`
-   **Body:**
    ```markdown
    **Task:** Build the main orchestration flow for the ingestion agent.

    **Acceptance Criteria:**
    - [ ] The agent can receive a topic and target collection.
    - [ ] The agent successfully uses its tools to find, filter, and prioritize URLs.
    - [ ] The agent loops through prioritized URLs and calls the Synthesis API to ingest their content.
    - [ ] The agent tracks its own state (processed URLs, failures, etc.).
    ```
-   **Labels:** `feature`, `phase-17`, `agent`

-   **Title:** `feat(api, ui): Create UI and API for Controlling the Ingestion Agent`
-   **Body:**
    ```markdown
    **Task:** Build the necessary API endpoints and frontend components to allow users to start and monitor the ingestion agent.

    **Acceptance Criteria:**
    - [ ] API endpoints `POST /api/ingestion-agent/start` and `GET /api/ingestion-agent/status/:jobId` are created.
    - [ ] A new UI section allows users to provide a topic and start an ingestion job.
    - [ ] The UI polls the status endpoint and displays the agent's progress to the user in real-time.
    ```
-   **Labels:** `feature`, `phase-17`, `api`, `ui`
