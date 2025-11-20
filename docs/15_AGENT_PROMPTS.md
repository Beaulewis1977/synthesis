# Agent Prompts - Copy & Paste
**Version:** 1.0  
**Last Updated:** October 6, 2025

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

## MCP Servers You Must Use

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
**Goal:** Upload a PDF, extract text, store in database
**Documentation:** `docs/09_BUILD_PLAN.md#day-1`

## What You're Building

### Morning (4 hours):
1. **Database Schema**
   - 3 tables: collections, documents, chunks
   - pgvector extension
   - HNSW index
   - Migrations system

2. **Database Client**
   - Connection pool
   - Basic queries
   - Migration runner

### Afternoon (4 hours):
3. **Extraction Pipeline**
   - PDF extraction (pdf-parse)
   - DOCX extraction (mammoth)
   - Markdown extraction (remark)

4. **File Upload Route**
   - POST /api/ingest
   - Multipart upload
   - Save to storage
   - Create document record

## Detailed Specifications

**Database Schema:** `docs/03_DATABASE_SCHEMA.md`
- See migration 001_initial_schema.sql
- 3 tables with specific columns
- Indexes and foreign keys

**Pipeline:** `docs/06_PIPELINE.md#stage-1-extraction`
- Extract functions for each file type
- Preserve metadata
- Error handling

**API:** `docs/05_API_SPEC.md#post-apiingest`
- Multipart form data
- Return doc_id
- Handle errors

## Dependencies to Install

```json
{
  "pdf-parse": "^1.1.1",
  "mammoth": "^1.6.0",
  "unified": "^11.0.4",
  "remark": "^15.0.1",
  "remark-parse": "^11.0.0",
  "@fastify/multipart": "^8.3.0"
}
```

## Files to Create

```
packages/db/
├── migrations/
│   └── 001_initial_schema.sql
├── src/
│   ├── client.ts
│   ├── queries.ts
│   └── migrate.ts
└── package.json

apps/server/src/
├── pipeline/
│   └── extract.ts
├── routes/
│   └── ingest.ts
└── index.ts (update)
```

## Acceptance Criteria

- [ ] Database tables created with correct schema
- [ ] Migration runner works
- [ ] Can connect to database from Node
- [ ] PDF extraction returns text
- [ ] DOCX extraction returns text
- [ ] Markdown extraction returns text
- [ ] POST /api/ingest accepts files
- [ ] File saved to storage/
- [ ] Document record created in DB
- [ ] All tests pass

## Testing

```bash
# Test database
docker compose exec db psql -U postgres -d synthesis -c "\dt"

# Test upload
curl -F "collection_id=<uuid>" -F "files=@test.pdf" \
  http://localhost:3333/api/ingest

# Check database
docker compose exec db psql -U postgres -d synthesis \
  -c "SELECT * FROM documents;"
```

## Git Workflow

1. Create branch: `git checkout -b feature/phase-1-database`
2. Implement features
3. Commit often with conventional commits
4. When done, create phase summary using `docs/PHASE_SUMMARY_TEMPLATE.md`
5. Push branch
6. Create PR to develop

## MCP Usage

- Search docs: `@context7 search "database schema"`
- Web help: `@perplexity "pgvector HNSW index setup"`
- Break down complex tasks with sequential thinking

## Need Help?

- Database schema unclear? Check `docs/03_DATABASE_SCHEMA.md`
- Pipeline details? Check `docs/06_PIPELINE.md`
- API format? Check `docs/05_API_SPEC.md`
- Workflow unclear? Check `docs/agents.md`

## Start Building!

1. Read the referenced docs
2. Create the database migration
3. Implement extraction
4. Implement upload route
5. Test end-to-end
6. Create phase summary
7. Submit for review

Questions before starting Phase 1?
```

---

## 📋 Phase 2 Prompt: Chunking + Embeddings

**Copy this:**

```
# Phase 2: Chunking and Embeddings

## Phase Overview

**Duration:** Day 2 (8 hours)
**Goal:** Process uploaded docs into searchable chunks
**Documentation:** `docs/09_BUILD_PLAN.md#day-2`

## What You're Building

### Morning (4 hours):
1. **Chunking Logic**
   - 800 char chunks with 150 overlap
   - Split on paragraph boundaries
   - Preserve metadata

### Afternoon (4 hours):
2. **Ollama Integration**
   - Embed chunks with nomic-embed-text
   - Batch processing (10 at a time)
   - Error handling

3. **Full Pipeline**
   - Orchestrate: extract → chunk → embed → upsert
   - Status tracking
   - Progress updates

## Detailed Specifications

**Chunking:** `docs/06_PIPELINE.md#stage-2-chunking`
**Embedding:** `docs/06_PIPELINE.md#stage-3-embedding`
**Storage:** `docs/06_PIPELINE.md#stage-4-storage`

## Files to Create

```
apps/server/src/pipeline/
├── chunk.ts      # Chunking logic
├── embed.ts      # Ollama client
├── ingest.ts     # Orchestrator
└── store.ts      # Database upsert
```

## Prerequisites

Phase 1 must be complete:
- Database tables exist
- File upload works
- Extraction works

## Acceptance Criteria

- [ ] Text chunked into 800 char pieces
- [ ] Chunks have 150 char overlap
- [ ] Embeddings are 768 dimensions
- [ ] Chunks stored in database
- [ ] Status updates work
- [ ] Full pipeline processes a PDF end-to-end
- [ ] Tests pass

## Testing

```typescript
const docId = await uploadDocument('test.pdf', collectionId);
await ingestDocument(docId);
const chunks = await db.query('SELECT COUNT(*) FROM chunks WHERE doc_id = $1', [docId]);
console.log(`Created ${chunks.rows[0].count} chunks`);
```

Questions before starting Phase 2?
```

---

## 📋 Phase 3 Prompt: Search + Agent Tools

**Copy this:**

```
# Phase 3: Search and Agent Tools

## Phase Overview

**Duration:** Day 3 (8 hours)
**Goal:** Search works, agent can use it
**Documentation:** `docs/09_BUILD_PLAN.md#day-3`

## What You're Building

### Morning (4 hours):
1. **Vector Search**
   - Embed query with Ollama
   - pgvector cosine similarity
   - Return top-k with citations
   - POST /api/search endpoint

### Afternoon (4 hours):
2. **Claude Agent SDK Setup**
   - Install agent SDK
   - Configure system prompt
   - Register search_rag tool

3. **Agent Chat Endpoint**
   - POST /api/agent/chat
   - Pass to agent
   - Return responses with tool calls

## Detailed Specifications

**Search:** `docs/02_ARCHITECTURE.md#vector-search-engine`
**Agent:** `docs/04_AGENT_TOOLS.md`
**API:** `docs/05_API_SPEC.md#post-apiagentchat`

## Dependencies

```json
{
  "@anthropic-ai/agent-sdk": "^0.4.0",
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
│   └── tools/
│       └── search.ts
└── routes/
    ├── search.ts
    └── agent.ts
```

## Acceptance Criteria

- [ ] Vector search returns relevant results
- [ ] Results include citations
- [ ] Agent SDK configured
- [ ] search_rag tool works
- [ ] POST /api/agent/chat works
- [ ] Agent responds with citations
- [ ] Tests pass

Questions before starting Phase 3?
```

---

## 📋 Phases 4-9: Quick Prompts

### Phase 4: Web Fetching
```
# Phase 4: Autonomous Web Fetching

**Goal:** Agent can fetch docs from URLs
**Docs:** `docs/09_BUILD_PLAN.md#day-4`, `docs/04_AGENT_TOOLS.md#3-fetch_web_content`

## What to Build:
1. Install Playwright
2. Implement fetch_web_content tool (single page)
3. Implement crawling mode (multiple pages)
4. Implement remaining tools (add_document, list_*, delete_document)
5. Test multi-step workflows

Questions?
```

### Phase 5: UI
```
# Phase 5: Frontend UI

**Goal:** Basic UI for collections, upload, chat
**Docs:** `docs/09_BUILD_PLAN.md#day-5`, `docs/08_UI_SPEC.md`

## What to Build:
1. Setup React with routing, Tailwind, React Query
2. Dashboard page (collection list)
3. Collection view (document list)
4. Upload page (drag & drop)
5. Chat page (message list + input)

Questions?
```

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
