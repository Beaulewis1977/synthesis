# Phase 16: Proposed GitHub Issues

This document outlines the GitHub issues that should be created to track the work planned in Phase 16.

---

### Epic

-   **Title:** `Epic: Phase 16 - Feature Completion & Hardening`
-   **Body:** "This epic tracks the three main goals of Phase 16: completing the MCP server, adding critical UI/UX enhancements, and implementing persistent chat history. See the build plan in `docs/new-phases/01_BUILD_PLAN.md` for full details."
-   **Labels:** `epic`, `phase-16`

---

### Part 1: MCP Server Completion

-   **Title:** `feat(mcp): Implement Remaining Management Tools`
-   **Body:**
    ```markdown
    **Task:** Implement the 6 missing management tools in the MCP server as defined in `docs/07_MCP_SERVER.md`.

    **File to Modify:** `apps/mcp/src/index.ts`

    **Acceptance Criteria:**
    - [ ] `list_collections` tool is implemented and tested.
    - [ ] `list_documents` tool is implemented and tested.
    - [ ] `create_collection` tool is implemented and tested.
    - [ ] `fetch_and_add_document_from_url` tool is implemented and tested.
    - [ ] `delete_document` tool is implemented and tested.
    - [ ] `delete_collection` tool is implemented and tested.
    ```
-   **Labels:** `feature`, `phase-16`, `mcp-server`

-   **Title:** `chore(mcp): Harden MCP Server Security`
-   **Body:**
    ```markdown
    **Task:** Perform a security review and hardening pass on the MCP server.

    **Acceptance Criteria:**
    - [ ] A simple in-memory rate limiter is added to the HTTP transport.
    - [ ] Placeholder logic for passing Authorization headers is added.
    - [ ] `pnpm audit` has been run and critical vulnerabilities are addressed.
    - [ ] All Zod schemas for tool inputs use `.strict()`.
    ```
-   **Labels:** `chore`, `security`, `phase-16`, `mcp-server`

---

### Part 2: UI/UX Enhancements

-   **Title:** `feat(ui): Implement "Add New Collection" Feature`
-   **Body:**
    ```markdown
    **Task:** Allow users to create new RAG collections from the web interface.

    **Acceptance Criteria:**
    - [ ] An "Add Collection" button is present in the UI.
    - [ ] A modal form appears to collect the new collection's name and description.
    - [ ] Submitting the form calls the `POST /api/collections` endpoint.
    - [ ] The collection list automatically refreshes to show the new collection upon success.
    ```
-   **Labels:** `feature`, `phase-16`, `ui`

-   **Title:** `feat(api, ui): Implement Batch Document Deletion`
-   **Body:**
    ```markdown
    **Task:** Allow users to delete multiple documents at once.

    **Acceptance Criteria:**
    - [ ] A new backend endpoint `DELETE /api/documents/batch` is created and functional.
    - [ ] The UI displays checkboxes next to documents in the list view.
    - [ ] A "Delete Selected" button appears when items are selected.
    - [ ] A confirmation dialog prevents accidental deletion.
    - [ ] On success, the document list is refreshed.
    ```
-   **Labels:** `feature`, `phase-16`, `api`, `ui`

---

### Part 3: Persistent Chat History

-   **Title:** `feat(db): Create Schema for Persistent Chat History`
-   **Body:**
    ```markdown
    **Task:** Add tables to the database to support saving chat sessions.

    **Acceptance Criteria:**
    - [ ] A `chat_sessions` table is created.
    - [ ] A `chat_messages` table is created with a foreign key to `chat_sessions`.
    - [ ] Migrations are generated and checked in.
    ```
-   **Labels:** `feature`, `phase-16`, `database`

-   **Title:** `feat(api): Build Endpoints for Chat History`
-   **Body:**
    ```markdown
    **Task:** Create the backend API endpoints required to manage chat history.

    **Acceptance Criteria:**
    - [ ] `GET /api/chats` is implemented.
    - [ ] `POST /api/chats` is implemented.
    - [ ] `GET /api/chats/:id/messages` is implemented.
    - [ ] The core chat/search logic is updated to save messages to the database.
    ```
-   **Labels:** `feature`, `phase-16`, `api`

-   **Title:** `feat(ui): Implement Chat History UI and State Management`
-   **Body:**
    ```markdown
    **Task:** Build the frontend components to display and interact with chat history.

    **Acceptance Criteria:**
    - [ ] A collapsible sidebar displays the list of past chat sessions.
    - [ ] Users can load a past session by clicking on it.
    - [ ] Users can start a new chat.
    - [ ] The UI is driven by data from the new chat APIs, not local state.
    - [ ] The URL is updated to reflect the current chat session (e.g., `/chat/:id`).
    ```
-   **Labels:** `feature`, `phase-16`, `ui`

---

### Part 4: Document Lifecycle Management

-   **Title:** `feat(db, backend): Implement Document Versioning and Update Detection`
-   **Body:**
    ```markdown
    **Task:** Add backend and database support for detecting when documents from a URL source are stale.

    **Acceptance Criteria:**
    - [ ] The `documents` table is updated with `version`, `source_url_hash`, and `last_checked_at` columns.
    - [ ] A background service is created that periodically checks documents for updates.
    - [ ] Documents with changed content are correctly marked as "stale".
    ```
-   **Labels:** `feature`, `phase-16`, `database`, `backend`

-   **Title:** `feat(api, ui): Implement Document Re-Ingestion`
-   **Body:**
    ```markdown
    **Task:** Allow users to refresh/update a stale document.

    **Acceptance Criteria:**
    - [ ] A new backend endpoint `POST /api/documents/:id/refresh` is created.
    - [ ] The endpoint correctly re-imports the document, replaces the old chunks, and increments the version.
    - [ ] The UI shows an "Update" button for stale documents that calls this endpoint.
    ```
-   **Labels:** `feature`, `phase-16`, `api`, `ui`

-   **Title:** `feat(ui): Implement Document Detail, View, and Edit Page`
-   **Body:**
    ```markdown
    **Task:** Create a UI for users to view the chunks of an ingested document and edit them.

    **Acceptance Criteria:**
    - [ ] A new page exists to view a document's chunks.
    - [ ] Users can edit the text content of a chunk and save it.
    - [ ] Saving an edit updates the chunk and its embedding.
    - [ ] Users can edit the document's top-level metadata (title, etc.).
    ```
-   **Labels:** `feature`, `phase-16`, `ui`