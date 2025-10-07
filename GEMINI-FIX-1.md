# GEMINI-FIX-1: Agent Prompt Audit and Correction Plan

**Date:** October 7, 2025  
**Author:** Gemini Agent

## 1. Overview

This document provides an audit of the agent prompts in `docs/15_AGENT_PROMPTS.md`. It identifies several issues that could lead to inconsistent agent performance, incomplete features, or code quality problems.

This document contains:
1.  A summary of the problems found in the prompts.
2.  Corrected versions of the prompts for Phases 1-4.
3.  A detailed plan to break down the oversized Phase 5 (UI) into smaller phases.
4.  An executable plan to update the corresponding GitHub Issues and Milestones using the `gh` CLI.

---

## 2. Summary of Prompt Issues

The audit revealed four categories of problems with the current prompts:

1.  **Incomplete Scope:** The prompts, especially for Phase 1, do not fully describe the required work. The agent had to correctly infer the need for additional API endpoints, database seeding, and health checks, which were missing from the instructions.
2.  **Inaccurate Dependencies:** Prompts are missing key packages (e.g., `pg`) and use risky versioning strategies (e.g., `"latest"`), which can cause build failures.
3.  **Inconsistent Detail:** The prompts for later phases (4, 5, 8-9) become significantly more vague than the initial prompts, increasing the risk of incorrect implementation.
4.  **Unrealistic Scope:** Phase 5, as currently defined, is far too large for a single work unit and needs to be broken down.

---

## 3. Corrected Agent Prompts

Below are the rewritten prompts for Phases 1-4. They are more accurate and complete, reflecting the actual work required.

### Corrected Phase 1 Prompt: Database + Core Pipeline

```
# Phase 1: Database Setup and Core Pipeline

## Phase Overview

**Duration:** Day 1 (8 hours)
**Goal:** Implement the complete database schema and a core ingestion pipeline that can upload a document, extract its text, and create corresponding database records.
**Documentation:** `docs/09_BUILD_PLAN.md#day-1`

## What You're Building

### Morning (4 hours):
1.  **Database Schema & Migrations**
    - Create 3 tables (`collections`, `documents`, `chunks`) as specified in `docs/03_DATABASE_SCHEMA.md`.
    - Ensure the `vector` and `pgcrypto` extensions are enabled in the initial migration.
    - Implement an HNSW index on the `chunks.embedding` column for vector search.
    - Create a second migration file to seed the database with default `collections` for testing.

2.  **Database Client (`@synthesis/db` package)**
    - Implement a connection pool for PostgreSQL.
    - Create type-safe query functions for all CRUD operations on the three tables.
    - Create a script to run the migrations.

### Afternoon (4 hours):
3.  **Extraction Pipeline**
    - Implement functions to extract text from PDF (`pdf-parse`), DOCX (`mammoth`), and Markdown (`remark`) files.
    - Include a fallback for plain text files.
    - The extraction function should handle errors gracefully.

4.  **Server & API Endpoints**
    - Set up a Fastify server with structured logging (`pino`) and CORS support.
    - Implement a `GET /health` endpoint for health checks.
    - Implement a full suite of collection management endpoints:
        - `GET /api/collections`
        - `POST /api/collections`
        - `GET /api/collections/:id`
        - `GET /api/collections/:id/documents`
    - Implement the file upload route `POST /api/ingest` which accepts multipart file uploads, saves the file to `./storage`, and creates a `document` record in the database.

## Dependencies to Install

```json
{
  "pg": "^8.12.0",
  "pdf-parse": "^2.1.10",
  "mammoth": "^1.6.0",
  "unified": "^11.0.4",
  "remark": "^15.0.1",
  "fastify": "^4.28.1",
  "@fastify/multipart": "^8.3.0",
  "@fastify/cors": "^9.0.1",
  "zod": "^3.23.8",
  "pino": "^9.4.0"
}
```

## Files to Create

```
packages/db/
├── migrations/
│   ├── 001_initial_schema.sql
│   └── 002_seed_collections.sql
├── src/
│   ├── client.ts
│   ├── queries.ts
│   └── migrate.ts
└── package.json

apps/server/src/
├── pipeline/
│   └── extract.ts
├── routes/
│   ├── collections.ts
│   └── ingest.ts
└── index.ts (update)
```

## Acceptance Criteria
- [x] All database tables and indexes created by migrations.
- [x] `GET /health` returns 200.
- [x] `GET /api/collections` returns the 3 seeded collections.
- [x] `POST /api/ingest` accepts a file, saves it to storage, and creates a document record.
- [x] `GET /api/collections/:id/documents` shows the newly uploaded document.
- [x] Extraction works for PDF, DOCX, and Markdown.
```

### Corrected Phase 2 Prompt: Chunking + Embeddings

```
# Phase 2: Chunking and Embeddings

## Phase Overview

**Duration:** Day 2 (8 hours)
**Goal:** Extend the ingestion pipeline to process extracted text into vector-embedded chunks.
**Documentation:** `docs/09_BUILD_PLAN.md#day-2`, `docs/06_PIPELINE.md`

## What You're Building

1.  **Chunking Logic (`apps/server/src/pipeline/chunk.ts`)**
    - Create a function to split text into ~800 character chunks with a ~150 character overlap.
    - Attempt to split on paragraph boundaries first before falling back to hard character limits.

2.  **Embedding Logic (`apps/server/src/pipeline/embed.ts`)**
    - Create a function to connect to Ollama and generate embeddings for text chunks using the `nomic-embed-text` model.
    - Implement batching to send multiple chunks to Ollama at once.

3.  **Database Logic (`packages/db/src/queries.ts`)**
    - Add an `upsertChunk` function to the existing `queries.ts` file to insert or update chunks in the database.

4.  **Pipeline Orchestration (`apps/server/src/pipeline/orchestrator.ts`)**
    - Create a new orchestrator file to manage the full ingestion flow.
    - **Refactor the existing `/api/ingest` route:** After a file is uploaded, it should now call the orchestrator to trigger the full `extract -> chunk -> embed -> store` pipeline asynchronously.
    - Update the document's `status` field in the database as it moves through each stage (`extracting`, `chunking`, `embedding`, `complete`, `error`).

## Dependencies to Install

```json
{
  "ollama": "^0.5.0"
}
```

## Files to Create / Update

```
# Create these new files
apps/server/src/pipeline/chunk.ts
apps/server/src/pipeline/embed.ts
apps/server/src/pipeline/orchestrator.ts

# Update these existing files
packages/db/src/queries.ts      # Add upsertChunk function
apps/server/src/routes/ingest.ts # Update to call the new orchestrator
```

## Acceptance Criteria
- [x] After a PDF is uploaded, it is processed completely.
- [x] The `documents` table shows the status changing from `pending` to `complete`.
- [x] The `chunks` table is populated with text chunks and 768-dimension vector embeddings.
- [x] The process handles errors gracefully, setting the document status to `error`.
```

### Corrected Phase 3 Prompt: Search + Agent Tools

```
# Phase 3: Search and Agent Tools

## Phase Overview

**Duration:** Day 3 (8 hours)
**Goal:** Implement vector search and integrate it into a Claude agent as a tool.
**Documentation:** `docs/09_BUILD_PLAN.md#day-3`, `docs/04_AGENT_TOOLS.md`

## What You're Building

1.  **Vector Search Service (`apps/server/src/services/search.ts`)**
    - Embed the user's query using the same Ollama model (`nomic-embed-text`).
    - Perform a cosine similarity search against the `chunks.embedding` column in the database.
    - Return the top 5 most relevant chunks, including the original text and document metadata for citations.

2.  **Search API Endpoint (`apps/server/src/routes/search.ts`)**
    - Create a `POST /api/search` endpoint that takes a query and returns the search results from the service.

3.  **Claude Agent Integration (`apps/server/src/agent/`)**
    - Install and configure the `@anthropic-ai/claude-agent-sdk`.
    - Define a `search_rag` tool that calls the vector search service.
    - Create a `POST /api/agent/chat` endpoint that forwards the user's message to the agent and returns the response. The agent should automatically use the `search_rag` tool when needed.

## Dependencies to Install

```json
{
  "@anthropic-ai/claude-agent-sdk": "^0.1.7",
  "@anthropic-ai/sdk": "^0.27.0"
}
```

## Files to Create

```
apps/server/src/
├── services/
│   └── search.ts
├── agent/
│   ├── agent.ts
│   └── tools.ts
└── routes/
    ├── search.ts
    └── agent.ts
```

## Acceptance Criteria
- [x] `POST /api/search` returns relevant chunks for a given query.
- [x] `POST /api/agent/chat` with a question like "What is pgvector?" triggers the `search_rag` tool.
- [x] The agent's final response includes information from the retrieved documents and cites the sources.
```

### Corrected Phase 4 Prompt: Web Fetching

```
# Phase 4: Autonomous Web Fetching

**Goal:** Give the agent tools to autonomously fetch content from URLs and manage documents in the RAG system.
**Docs:** `docs/09_BUILD_PLAN.md#day-4`, `docs/04_AGENT_TOOLS.md`

## What to Build

1.  **Web Content Fetching Tool**
    - Install Playwright.
    - Create a new tool named `fetch_and_add_document_from_url`.
    - This tool should accept a `url` and a `collection_id`.
    - It will use Playwright to navigate to the URL, extract the main content of the page, and then call the existing ingestion pipeline to add it as a new document.

2.  **Document Management Tools**
    - Implement and register the following tools for the agent to use:
      - `list_collections()`: Returns a list of all available collections.
      - `list_documents(collection_id: string)`: Returns a list of documents in a specific collection.
      - `delete_document(document_id: string)`: Deletes a document and its associated chunks.

3.  **Test a Multi-Step Workflow**
    - Manually test an agent interaction that requires multiple steps, e.g., "List the available collections, then fetch the pgvector GitHub page and add it to the 'Getting Started' collection."

## Dependencies to Install

```json
{
  "playwright": "^1.40.0"
}
```

## Acceptance Criteria
- [x] Agent can successfully add a document from a URL.
- [x] Agent can list collections and documents.
- [x] Agent can delete a document.
- [x] The multi-step workflow test completes successfully.
```

---

## 4. Plan to Refactor Phase 5 (UI)

The current Phase 5 is too large. It should be broken into three smaller, sequential phases.

### New Phase 5.1: UI - Project Setup and Layout

*   **Goal:** Initialize the React frontend project and build the static application shell.
*   **Tasks:**
    1.  Use Vite to scaffold a new React+TypeScript project in `apps/web`.
    2.  Install and configure Tailwind CSS.
    3.  Install `react-router-dom` and set up routes for `/`, `/collections/:id`, and `/chat`.
    4.  Create the main application layout (e.g., a sidebar for navigation and a main content area).
    5.  Create empty placeholder components for the `Dashboard`, `CollectionView`, and `ChatPage`.
*   **Acceptance Criteria:** A runnable Vite development server that displays the basic app layout with navigation links that switch between empty pages.

### New Phase 5.2: UI - Collections and Document Management

*   **Goal:** Build the UI for viewing collections, listing documents, and uploading new files.
*   **Tasks:**
    1.  Install `@tanstack/react-query`.
    2.  Use `react-query` to fetch and display the list of collections on the dashboard.
    3.  Create the `CollectionView` page to fetch and display the list of documents for a given collection.
    4.  Implement a file upload component (e.g., using `react-dropzone`) that calls the `/api/ingest` endpoint.
    5.  Provide user feedback for loading states, errors, and successful uploads.
*   **Acceptance Criteria:** Users can see all collections, view the documents within each, and upload a new document.

### New Phase 5.3: UI - Chat Interface

*   **Goal:** Build the interactive chat interface for communicating with the RAG agent.
*   **Tasks:**
    1.  Create a `ChatPage` component with a message display area and a text input form.
    2.  Implement the logic to send user messages to the `POST /api/agent/chat` endpoint.
    3.  Display the agent's streaming response in the message area.
    4.  Parse and display document citations that are included in the agent's response.
*   **Acceptance Criteria:** Users can have a full conversation with the agent and see the sources for its answers.

---

## 5. Plan to Update GitHub Issues & Milestones

Here is an executable plan to update your GitHub repository to reflect these changes. Run these commands from your project root.

**Step 1: Fetch Existing Issues (to get their numbers)**
*First, get a list of all open issues to identify the numbers for the ones you need to edit or close.*
```bash
gh issue list
```

**Step 2: Update Prompts for Phases 1-4**
*For each phase from 1 to 4, use the issue number you found above and run `gh issue edit` to replace the old prompt in the issue body. You will need to copy and paste the corrected prompts from this document into the editor that opens.*
```bash
# Example for Phase 1 issue (replace 11 with the correct issue number)
gh issue edit 11 

# Repeat for Phase 2, 3, and 4 issues...
```

**Step 3: Close the Old Phase 5 Issue**
*Find the issue number for the original, oversized "Phase 5" and close it.*
```bash
# Replace 15 with the correct issue number for Phase 5
gh issue close 15 --comment "Closing this issue as it is too large. It is being replaced by three smaller, more focused issues for the UI implementation (Phases 5.1, 5.2, 5.3)."
```

**Step 4: Create New Issues for the Refactored UI Phases**
*Now, create three new issues with the new, smaller scopes. You will need to copy/paste the goals from the plan above into the `--body` of each command.*
```bash
# Create Phase 5.1
gh issue create --title "Phase 5.1: UI - Project Setup and Layout" --body "Goal: Initialize the React frontend project and build the static application shell. Tasks: 1. Use Vite to scaffold a new React+TypeScript project in apps/web. 2. Install and configure Tailwind CSS. 3. Install react-router-dom and set up routes. 4. Create the main application layout. 5. Create empty placeholder components for pages."

# Create Phase 5.2
gh issue create --title "Phase 5.2: UI - Collections and Document Management" --body "Goal: Build the UI for viewing collections, listing documents, and uploading new files. Tasks: 1. Install @tanstack/react-query. 2. Fetch and display collections. 3. Create CollectionView page to list documents. 4. Implement file upload component. 5. Provide user feedback for loading/error states."

# Create Phase 5.3
gh issue create --title "Phase 5.3: UI - Chat Interface" --body "Goal: Build the interactive chat interface. Tasks: 1. Create ChatPage component. 2. Implement logic to send messages to the /api/agent/chat endpoint. 3. Display the agent's streaming response. 4. Parse and display document citations."
```

**Step 5: Adjust Milestones**
*This step assumes you have milestones named "Phase 1", "Phase 2", etc. You may need to create new ones for the UI phases.*
```bash
# First, create the new milestones
gh milestone create "Phase 5.1"
gh milestone create "Phase 5.2"
gh milestone create "Phase 5.3"

# Then, find the numbers for the new issues you just created
gh issue list

# Finally, assign the new issues to the new milestones
# (Replace ## with the correct issue numbers)
gh issue edit ## --milestone "Phase 5.1"
gh issue edit ## --milestone "Phase 5.2"
gh issue edit ## --milestone "Phase 5.3"
```
