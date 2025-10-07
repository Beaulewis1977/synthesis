# Agent Prompts - Copy & Paste
**Version:** 1.2
**Last Updated:** October 7, 2025

---

## 🎯 Purpose

Perfect prompts to give your AI agents for each phase. Just copy and paste!

---

## 🚀 Project Kickoff Prompt

**When to use:** Starting the project for the first time

**Copy this:**

```
# Synthesis RAG - Project Kickoff

I need you to help me build an autonomous RAG system using the comprehensive planning documentation provided.

## Project Overview

**What we're building:**
- Autonomous RAG system with Claude Agent SDK
- Multi-project document collections  
- Local embeddings (Ollama) + cloud toggle
- MCP server for IDE agents
- Full stack: Fastify backend + React frontend
- Docker deployment ready

**Timeline:** 7-9 days (9 phases)

**Location:** /home/kngpnn/dev/synthesis

## Your Role

You are the **Builder Agent**. Your responsibilities:
1. Implement features according to planning docs
2. Write clean, tested code
3. Follow git workflow (feature branches, conventional commits)
4. Create phase summaries after each phase
5. Submit work for review before merging

## Planning Documentation

All planning docs are in: `docs/` directory

**Start by reading:**
1. `docs/00_START_HERE.md` - Overview
2. `docs/agents.md` - Your workflow guide (IMPORTANT!)
3. `docs/09_BUILD_PLAN.md` - Day-by-day tasks

**Key references:**
- Architecture: `docs/02_ARCHITECTURE.md`
- Tech stack: `docs/01_TECH_STACK.md`
- Database: `docs/03_DATABASE_SCHEMA.md`
- Agent tools: `docs/04_AGENT_TOOLS.md`
- API spec: `docs/05_API_SPEC.md`
- Pipeline: `docs/06_PIPELINE.md`

## Optional IDE MCP Servers (for you)

These IDE MCP servers assist with searching docs and the web while building. They are distinct from the RAG MCP server you will implement in Phase 6.

**Context7 (or similar):** Search planning docs when unclear
```
@context7 search "database schema"
```

**Perplexity:** Search web for technical solutions
```
@perplexity "pgvector HNSW index configuration"
```

**Sequential Thinking:** For complex problems
- Use when planning multi-step implementations

Note: Use these only if installed in your IDE; otherwise skip.

## Git Workflow

**Branches:**
- `main` - Empty until MVP (protected)
- `develop` - Active development (default, protected)
- `feature/phase-X-name` - Your work branches

**Commits:** Conventional commits format
```
feat(scope): description
fix(scope): description
docs(scope): description
```

**PR Process:**
1. Create feature branch
2. Implement and test
3. Create phase summary (use template in `docs/PHASE_SUMMARY_TEMPLATE.md`)
4. Push and create PR to develop
5. Wait for Review Agent approval
6. Wait for CodeRabbit approval
7. Merge

## First Steps

1. **Read documentation** (1 hour)
   - Read `docs/00_START_HERE.md`
   - Read `docs/agents.md` thoroughly
   - Skim `docs/01_TECH_STACK.md` through `docs/13_REPO_SETUP.md`

2. **Confirm understanding**
   - Summarize what we're building
   - Confirm you understand your workflow
   - Ask any clarifying questions

3. **Ready for Day 1?**
   - Once you confirm understanding, I'll give you Phase 1 prompt

## Questions?

Before we start, do you:
- Understand the project scope?
- Understand your role and workflow?
- Know how to use MCP servers for help?
- Understand the git workflow?
- Have access to all planning docs?

If yes to all, say "READY FOR PHASE 1" and I'll provide the Phase 1 prompt.
```

---

## 📋 Phase 1 Prompt: Database + Core Pipeline

**When to use:** After agent confirms ready

**Copy this:**

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

---

## 📋 Phase 2 Prompt: Chunking + Embeddings

**Copy this:**

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

---

## 📋 Phase 3 Prompt: Search + Agent Tools

**Copy this:**

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

---

## 📋 Phase 4 Prompt: Web Fetching

**Copy this:**

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

## 📋 Phase 5.1 Prompt: UI - Project Setup and Layout

**Copy this:**

```
# Phase 5.1: UI - Project Setup and Layout

**Goal:** Initialize the React frontend project and build the static application shell.
**Docs:** `docs/09_BUILD_PLAN.md#day-5`, `docs/08_UI_SPEC.md`

## What to Build
1.  Use Vite to scaffold a new React+TypeScript project in `apps/web`.
2.  Install and configure Tailwind CSS.
3.  Install `react-router-dom` and set up routes for `/`, `/collections/:id`, and `/chat`.
4.  Create the main application layout (e.g., a sidebar for navigation and a main content area).
5.  Create empty placeholder components for the `Dashboard`, `CollectionView`, and `ChatPage`.

## Acceptance Criteria
- [x] A runnable Vite development server that displays the basic app layout with navigation links that switch between empty pages.
```

---

## 📋 Phase 5.2 Prompt: UI - Collections and Document Management

**Copy this:**

```
# Phase 5.2: UI - Collections and Document Management

**Goal:** Build the UI for viewing collections, listing documents, and uploading new files.
**Docs:** `docs/09_BUILD_PLAN.md#day-5`, `docs/08_UI_SPEC.md`

## What to Build
1.  Install `@tanstack/react-query`.
2.  Use `react-query` to fetch and display the list of collections on the dashboard.
3.  Create the `CollectionView` page to fetch and display the list of documents for a given collection.
4.  Implement a file upload component (e.g., using `react-dropzone`) that calls the `/api/ingest` endpoint.
5.  Provide user feedback for loading states, errors, and successful uploads.

## Acceptance Criteria
- [x] Users can see all collections, view the documents within each, and upload a new document.
```

---

## 📋 Phase 5.3 Prompt: UI - Chat Interface

**Copy this:**

```
# Phase 5.3: UI - Chat Interface

**Goal:** Build the interactive chat interface for communicating with the RAG agent.
**Docs:** `docs/09_BUILD_PLAN.md#day-5`, `docs/08_UI_SPEC.md`

## What to Build
1.  Create a `ChatPage` component with a message display area and a text input form.
2.  Implement the logic to send user messages to the `POST /api/agent/chat` endpoint.
3.  Display the agent's streaming response in the message area.
4.  Parse and display document citations that are included in the agent's response.

## Acceptance Criteria
- [x] Users can have a full conversation with the agent and see the sources for its answers.
```

---

## 📋 Phases 6-9: Quick Prompts

### Phase 6: MCP Server
```
# Phase 6: MCP Server

**Goal:** External agents can access RAG
**Docs:** `docs/09_BUILD_PLAN.md#day-6`, `docs/07_MCP_SERVER.md`

## What to Build:
1. Create apps/mcp package
2. Implement server with search_docs tool
3. Implement stdio mode (WSL/IDE)
4. Implement SSE mode (Windows/Claude Desktop)
5. Test from both Cursor and Claude Desktop

Questions?
```

### Phase 7: Docker
```
# Phase 7: Docker Integration

**Goal:** Everything runs in Docker
**Docs:** `docs/09_BUILD_PLAN.md#day-7`, `docs/10_ENV_SETUP.md`

## What to Build:
1. Create Dockerfiles for server, web, mcp
2. Create docker-compose.yml with clear container names
3. Test `docker compose up`
4. Verify all services healthy

**Container names:**
- synthesis-db
- synthesis-ollama
- synthesis-server
- synthesis-web
- synthesis-mcp

Questions?
```

### Phase 8-9: Polish + Testing
```
# Phase 8-9: Polish and Final Testing

**Goal:** Production-ready MVP
**Docs:** `docs/09_BUILD_PLAN.md#day-8-9`

## What to Do:
1. Add error handling everywhere
2. Polish UI (loading/error/empty states)
3. Test with 20+ real documents
4. Test all MCP modes
5. Verify all acceptance criteria
6. Create comprehensive README
7. Document any issues

Questions?
```

---

## 🔄 Between-Phase Prompt

**When to use:** After completing each phase, before starting next

**Copy this:**

```
# Phase [X] Complete - Ready for Review

I've completed Phase [X]: [Name]

## What I've Done

[Brief summary]

## Phase Summary

I've created a phase summary using the template. Here's where it is:
[Path to summary file]

## Next Steps

1. Please review my phase summary
2. Review the code changes
3. Let me know if approved or changes needed
4. Once approved, I'll create the PR

## Questions

[Any questions or concerns]

Ready for your review!
```

---

## ✅ Review Approval Prompt

**When human/review agent approves:**

```
APPROVED - Proceed with PR

Create your feature branch, commit your work, and create a PR to develop following the git workflow in `docs/11_GIT_WORKFLOW.md`.

After PR is merged, let me know and I'll provide the next phase prompt.
```

---

## 🚀 Next Phase Prompt

**When ready for next phase:**

```
Phase [X] merged successfully! 

Ready for Phase [X+1]? Say "YES" and I'll provide the Phase [X+1] prompt.
```

---

## 💬 Usage Guide

### For You (Human)

1. **Project Start:** Copy "Project Kickoff Prompt" → Paste to agent
2. **Agent Confirms Ready:** Copy "Phase 1 Prompt" → Paste to agent
3. **Phase 1 Complete:** Agent creates summary → Review → Approve
4. **Approved:** Agent creates PR → Merges
5. **Repeat:** Copy next phase prompt → Paste to agent
6. **Continue** until all 9 phases done

### For Agent

1. Receive prompt
2. Read referenced documentation
3. Ask clarifying questions
4. Implement features
5. Test thoroughly
6. Create phase summary
7. Submit for review
8. Create PR after approval
9. Wait for next phase prompt

---

## 📊 Prompt Checklist

- [x] Project kickoff prompt (comprehensive)
- [x] Phase 1 prompt (detailed)
- [x] Phase 2 prompt (detailed)
- [x] Phase 3 prompt (detailed)
- [x] Phase 4-9 prompts (quick reference)
- [x] Between-phase prompt
- [x] Review approval prompt
- [x] Next phase prompt

---

**These prompts ensure consistent, high-quality work from your AI agents!**