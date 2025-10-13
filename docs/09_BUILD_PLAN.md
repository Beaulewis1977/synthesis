# Phase-Based Build Plan
**Version:** 1.0  
**Target:** Working autonomous RAG system  
**Last Updated:** October 6, 2025

---

## 🎯 Build Strategy

### Principles
1. **Build vertically** - Complete one feature end-to-end before moving on
2. **Test as you go** - Don't accumulate integration debt
3. **Keep it simple** - Resist over-engineering
4. **Deploy daily** - Docker up from Day 1

### Success Metrics
- ✅ Can upload and process documents
- ✅ Agent autonomously manages collections
- ✅ Search returns relevant results
- ✅ MCP works from IDE agents
- ✅ Runs with `docker compose up`

---

## 📅 Phased Breakdown

### Phase 0: Setup (2-3 hours, do today)

**Goal:** Development environment ready

**Tasks:**
- [ ] Install Node 22.x via nvm
- [ ] Install pnpm 9.12.x
- [ ] Install Docker Desktop + WSL2 integration
- [ ] Install Ollama: `curl -fsSL https://ollama.ai/install.sh | sh`
- [ ] Pull models:
  ```bash
  ollama pull nomic-embed-text
  ollama pull llama3.2:3b
  ```
- [ ] Test Ollama: `ollama run llama3.2:3b "hello"`
- [ ] Clone repo / create new one
- [ ] `pnpm install`
- [ ] Start Postgres: `docker compose up -d db`
- [ ] Test Anthropic API key:
  ```bash
  curl https://api.anthropic.com/v1/messages \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":100,"messages":[{"role":"user","content":"Hi"}]}'
  ```

**Definition of Done:**
- All tools installed
- Ollama responding
- Postgres running
- API keys verified

---

### Phase 1: Database + Core Pipeline

**Goal:** Upload a PDF, extract text, store in DB

**Morning (4 hours):**
- [ ] Create database schema
  - Write `packages/db/migrations/001_initial_schema.sql`
  - Create migration runner script
  - Apply migration
  - Verify tables exist: `psql $DATABASE_URL -c "\dt"`

- [ ] Set up database client
  - `packages/db/src/client.ts` - Connection pool
  - `packages/db/src/queries.ts` - Basic CRUD
  - Test connection

**Afternoon (4 hours):**
- [ ] Build extraction pipeline
  - Install: `pdf-parse`, `mammoth`, `remark`
  - `apps/server/src/pipeline/extract.ts`
  - Handle PDF, DOCX, Markdown
  - Test with sample files

- [ ] File upload route
  - `/api/ingest` with multipart
  - Save to `./storage/{collection_id}/`
  - Create document record
  - Return doc_id

**Test:**
```bash
# Upload a PDF
curl -F "collection_id=uuid" -F "files=@test.pdf" \
  http://localhost:3333/api/ingest

# Check database
psql $DATABASE_URL -c "SELECT * FROM documents;"
```

**Definition of Done:**
- PDF uploads successfully
- Text extracted
- Document record in DB
- File saved to storage

---

### Phase 2: Chunking + Embeddings

**Goal:** Process uploaded docs into searchable chunks

**Morning (4 hours):**
- [ ] Implement chunking
  - `apps/server/src/pipeline/chunk.ts`
  - Simple 800-char chunks with 150 overlap
  - Split on paragraph boundaries
  - Preserve metadata (page numbers if available)

- [ ] Test chunking
  - Unit test with known text
  - Verify chunk sizes
  - Check overlap correctness

**Afternoon (4 hours):**
- [ ] Ollama embedding integration
  - `apps/server/src/pipeline/embed.ts`
  - Call Ollama API for `nomic-embed-text`
  - Batch processing (10 chunks at a time)
  - Handle errors/retries

- [ ] Upsert to database
  - `apps/server/src/pipeline/ingest.ts`
  - Orchestrate: extract → chunk → embed → upsert
  - Update document status
  - Handle errors gracefully

**Test:**
```typescript
// Full pipeline test
const docId = await uploadDocument('test.pdf', collectionId);
await ingestDocument(docId);
// Check chunks table
const chunks = await db.query('SELECT COUNT(*) FROM chunks WHERE doc_id = $1', [docId]);
console.log(`Created ${chunks.rows[0].count} chunks`);
```

**Definition of Done:**
- Documents chunked correctly
- Embeddings generated (768 dims)
- Chunks stored in database
- Status tracking works

---

### Phase 3: Search + Agent Tools

**Goal:** Search works, agent can use it

**Morning (4 hours):**
- [ ] Implement vector search
  - `apps/server/src/services/search.ts`
  - Embed query with Ollama
  - pgvector cosine similarity query
  - Return top-k with citations

- [ ] `/api/search` endpoint
  - Accept query + collection_id
  - Call search service
  - Format results

- [ ] Test search
  ```bash
  curl -X POST http://localhost:3333/api/search \
    -H "Content-Type: application/json" \
    -d '{"query": "test query", "collection_id": "uuid", "top_k": 5}'
  ```

- **Afternoon (4 hours):**
- [ ] Wire up Claude Messages API loop
  - Use `@anthropic-ai/sdk` directly (no `claude-agent-sdk` dependency)
  - Implement manual tool-use loop in `apps/server/src/agent/agent.ts`
  - Track token usage totals across turns

- [ ] Implement `search_rag` tool
  - `apps/server/src/agent/tools/search.ts`
  - Call search service
  - Format for agent

- [ ] `/api/agent/chat` endpoint
  - Accept message + collection_id
  - Pass to agent
  - Return response

**Test:**
```bash
curl -X POST http://localhost:3333/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is this document about?", "collection_id": "uuid"}'
```

**Definition of Done:**
- Search returns relevant results
- Agent can call search tool
- Agent responds with citations
- `/api/agent/chat` works

---

### Phase 4: Autonomous Web Fetching

**Goal:** Agent can fetch docs from URLs

**Morning (4 hours):**
- [ ] Install Playwright: `pnpm add playwright`
- [ ] `npx playwright install chromium`

- [ ] Implement `fetch_web_content` tool
  - `apps/server/src/agent/tools/fetch-web.ts`
  - Fetch single page
  - Extract main content
  - Convert HTML to Markdown
  - Save and process

- [ ] Test web fetching
  ```typescript
  const result = await fetchWebContent({
    url: 'https://docs.flutter.dev/get-started',
    collection_id: 'uuid',
    mode: 'single'
  });
  ```

**Afternoon (4 hours):**
- [ ] Implement crawling mode
  - Follow links on same domain
  - Max pages limit
  - Avoid duplicates

- [ ] Implement `add_document` tool
  - `apps/server/src/agent/tools/add-doc.ts`
  - Support file paths
  - Support URLs (download first)
  - Trigger ingestion

- [ ] Register tools with agent
  - Update agent.ts with all tools
  - Test multi-step workflows

**Test:**
```bash
curl -X POST http://localhost:3333/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Add docs from https://docs.flutter.dev/get-started", "collection_id": "uuid"}'
```

**Definition of Done:**
- Agent fetches single pages
- Agent can crawl multiple pages
- Web content processed correctly
- Agent completes multi-step workflows

---

### Phase 5: Frontend UI

**Goal:** Basic UI for collections, upload, chat

**Morning (4 hours):**
- [ ] Set up React app
  - Already scaffolded, add routes
  - Install React Router
  - Install Tailwind + Lucide icons
  - Install React Query

- [ ] Create pages
  - `/` - Dashboard (collection list)
  - `/chat/:collectionId` - Chat interface
  - `/upload/:collectionId` - Upload form

- [ ] Dashboard page
  - List collections
  - Show doc counts
  - "Create Collection" button
  - Click to navigate to chat

**Afternoon (4 hours):**
- [ ] Upload page
  - Drag & drop zone
  - File list with progress
  - Upload to `/api/ingest`
  - Show processing status

- [ ] Chat page
  - Message input
  - Message list
  - Send to `/api/agent/chat`
  - Display tool calls
  - Show citations

**Test:**
- Open http://localhost:5173
- Create collection
- Upload document
- Chat with agent
- Verify responses have citations

**Definition of Done:**
- UI loads and looks decent
- Can create collections
- Can upload files
- Can chat with agent
- Citations displayed

---

### Phase 6: MCP Server

**Goal:** External agents can access the full capabilities of the RAG system.

**Morning (4 hours):**
- [ ] Create MCP package in `apps/mcp/`.
- [ ] Install `@modelcontext/server` and `dotenv`.
- [ ] Implement a simple API client to communicate with the `apps/server` backend, configurable via `BACKEND_API_URL`.
- [ ] Define and implement the full MCP toolset:
  - `search_rag`
  - `list_collections`
  - `list_documents`
  - `create_collection`
  - `fetch_and_add_document_from_url`
  - `delete_document`
  - `delete_collection`

**Afternoon (4 hours):**
- [ ] Implement `stdio` transport for IDE agents.
- [ ] Implement `SSE` transport on a separate port (e.g., 3334) for clients like Claude Desktop.
- [ ] Test `stdio` mode from the command line.
  ```bash
  echo '{"method":"tools/list"}' | node apps/mcp/dist/index.js
  ```
- [ ] Test `SSE` mode with `curl`.
- [ ] Perform end-to-end tests for `search_rag` and `fetch_and_add_document_from_url` to ensure they work through the MCP server.

**Definition of Done:**
- External agents can discover and call all 7 tools.
- Both `stdio` and `SSE` modes are functional and connect to the same backend logic.
- The server is configurable and ready for the Docker phase.

---

### Phase 7: Docker + Testing

**Goal:** Everything runs in Docker, end-to-end tested

**Morning (4 hours):**
- [ ] Complete docker-compose.yml
  - Add server service
  - Add web service
  - Add mcp service
  - Add ollama with GPU support
  - Link networks

- [ ] Create Dockerfiles
  - `apps/server/Dockerfile`
  - `apps/web/Dockerfile`
  - `apps/mcp/Dockerfile`

- [ ] Test Docker build
  ```bash
  docker compose build
  docker compose up
  ```

**Afternoon (4 hours):**
- [ ] End-to-end testing
  - Upload 10 documents
  - Chat and verify citations
  - Test IDE agent via MCP
  - Test Claude Desktop via MCP
  - Toggle between Claude/Ollama

- [ ] Fix bugs found in testing

- [ ] Document any issues

**Definition of Done:**
- `docker compose up` works
- All services healthy
- Can upload, search, chat
- MCP accessible from both modes
- Documentation updated

---

### Phase 11: Polish + Documentation

**Goal:** Production-ready MVP

**Morning (4 hours):**
- [ ] Error handling
  - Add try/catch everywhere
  - User-friendly error messages
  - Log errors properly

- [ ] UI polish
  - Loading states
  - Error states
  - Empty states
  - Responsive layout

- [ ] Collection management
  - Create collection UI
  - Delete collection (with confirmation)
  - Switch active collection

**Afternoon (4 hours):**
- [ ] Write README.md
  - Quick start guide
  - Environment setup
  - Common issues
  - API examples

- [ ] Update docs
  - Verify all docs match implementation
  - Add troubleshooting section
  - Document known limitations

- [ ] Create demo video/screenshots

**Definition of Done:**
- Error messages helpful
- UI feels polished
- README is accurate
- Documentation complete

---

### Phase 12: Final Testing + Buffer

**Goal:** Fix remaining issues, prepare for use

**Tasks:**
- [ ] Test with YOUR actual docs
  - Upload Flutter docs
  - Upload Supabase docs
  - Upload your project plans
  - Verify search quality

- [ ] Performance testing
  - Upload 100 documents
  - Measure search latency
  - Check embedding speed

- [ ] Security review
  - No secrets in logs
  - Files stored safely
  - No XSS vulnerabilities

- [ ] Backup strategy
  - Document how to backup DB
  - Document how to export collections

- [ ] Create runbook for common tasks

**Definition of Done:**
- Works with real docs
- Performance acceptable
- Security reviewed
- Ready to use daily

---
### Phase 13: CI/CD Pipeline

**Goal:** Automate testing and deployment

**Tasks:**
- [ ] Create a GitHub Actions workflow
- [ ] Configure a matrix build for different environments
- [ ] Add steps for linting, testing, and building
- [ ] (Optional) Add a step for deploying to a staging environment

**Definition of Done:**
- CI pipeline runs on every push to `develop`
- All tests are executed automatically
- Build artifacts are created

---

## 🚨 Risk Mitigation

### If Behind Schedule

**Phase 3-4 Issues:**
- Skip web crawling, focus on single-page fetch
- Use simpler chunking (just split on character count)

**Phase 5-6 Issues:**
- Simplify UI to bare minimum (no fancy styles)
- Skip SSE mode, just stdio for MCP

**Phase 7 Issues:**
- Skip full Docker, just run locally
- Add Docker in week 2

---

## 🎯 Phase Checklist

Each phase ends with:
- [ ] Code committed to git
- [ ] Tests passing
- [ ] Demo to yourself works
- [ ] Next phase's plan reviewed

---

## ✅ MVP Acceptance Criteria

Before calling it "done":

1. **Upload & Process**
   - [ ] Upload 5+ PDFs successfully
   - [ ] Upload 5+ DOCX successfully
   - [ ] Upload 5+ Markdown files successfully
   - [ ] All process without errors

2. **Collections**
   - [ ] Create 3 collections
   - [ ] Switch between them in UI
   - [ ] Each isolated (searches don't cross)

3. **Agent Autonomy**
   - [ ] Agent can search docs
   - [ ] Agent can fetch from URLs
   - [ ] Agent completes multi-step tasks
   - [ ] Agent provides citations

4. **Search Quality**
   - [ ] Semantic search works (finds concepts, not just keywords)
   - [ ] Results have citations
   - [ ] Top results are relevant

5. **MCP Integration**
   - [ ] IDE agent (Cursor) can search docs
   - [ ] Claude Desktop can search docs
   - [ ] Results match chat UI

6. **Docker**
   - [ ] `docker compose up` works
   - [ ] All services start healthy
   - [ ] Persists data across restarts

7. **Documentation**
   - [ ] README has working quick start
   - [ ] Environment setup documented
   - [ ] API examples work

---

## 📊 Progress Tracking

Update after each phase:

| Phase | Goal | Status | Blocker | Notes |
|-------|------|--------|---------|-------|
| 0 | Setup | ⬜ | | |
| 1 | DB + Extraction | ⬜ | | |
| 2 | Chunking + Embedding | ⬜ | | |
| 3 | Search + Agent | ⬜ | | |
| 4 | Web Fetching | ⬜ | | |
| 5 | UI | ⬜ | | |
| 6 | MCP | ⬜ | | |
| 7 | Docker | ⬜ | | |
| 8 | Polish | ⬜ | | |
| 9 | Final Test | ⬜ | | |
| 10 | CI/CD | ⬜ | | |

Status: ⬜ Not Started | 🟡 In Progress | ✅ Done | ❌ Blocked

---

## 💬 Phase Summary Template

**What I did this phase:**
- ...

**What I'm doing next phase:**
- ...

**Blockers:**
- ...

**Demo:** [link to working feature]

---

**Follow this plan and you'll have a working autonomous RAG system in 7-9 days!**
