# 7-9 Day Build Plan
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

## 📅 Daily Breakdown

### Day 0: Setup (2-3 hours, do today)

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

### Day 1: Database + Core Pipeline

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

### Day 2: Chunking + Embeddings

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

### Day 3: Search + Agent Tools

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

### Day 4: Autonomous Web Fetching

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

### Day 5: Frontend UI

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

### Day 6: MCP Server

**Goal:** External agents can access RAG

**Morning (4 hours):**
- [ ] Create MCP package
  - `apps/mcp/` directory
  - Install `@modelcontextprotocol/sdk`
  - Create `server.ts`

- [ ] Implement stdio mode (WSL/IDE)
  - Register `search_docs` tool
  - Register `list_collections` tool
  - Call backend API internally

- [ ] Test from command line
  ```bash
  echo '{"method":"tools/list"}' | node apps/mcp/dist/server.js
  ```

**Afternoon (4 hours):**
- [ ] Implement SSE mode (Windows/Claude Desktop)
  - Add HTTP server with SSE transport
  - Same tools, different transport
  - Listen on port 3334

- [ ] Create MCP config for Claude Desktop
  ```json
  {
    "mcpServers": {
      "synthesis-rag": {
        "url": "http://localhost:3334/sse"
      }
    }
  }
  ```

- [ ] Test from Claude Desktop (Windows)
  - Add config
  - Restart Claude Desktop
  - Ask: "Search my docs for X"
  - Verify it calls your MCP server

**Definition of Done:**
- stdio mode works for IDE agents
- SSE mode works for Claude Desktop
- Both modes access same backend
- External agents can search RAG

---

### Day 7: Docker + Testing

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

### Day 8: Polish + Documentation

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

### Day 9: Final Testing + Buffer

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

## 🚨 Risk Mitigation

### If Behind Schedule

**Day 3-4 Issues:**
- Skip web crawling, focus on single-page fetch
- Use simpler chunking (just split on character count)

**Day 5-6 Issues:**
- Simplify UI to bare minimum (no fancy styles)
- Skip SSE mode, just stdio for MCP

**Day 7 Issues:**
- Skip full Docker, just run locally
- Add Docker in week 2

---

## 🎯 Daily Checklist

Each day ends with:
- [ ] Code committed to git
- [ ] Tests passing
- [ ] Demo to yourself works
- [ ] Tomorrow's plan reviewed

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

Update daily:

| Day | Goal | Status | Blocker | Notes |
|-----|------|--------|---------|-------|
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

Status: ⬜ Not Started | 🟡 In Progress | ✅ Done | ❌ Blocked

---

## 💬 Daily Standup Template

**What I did yesterday:**
- ...

**What I'm doing today:**
- ...

**Blockers:**
- ...

**Demo:** [link to working feature]

---

**Follow this plan and you'll have a working autonomous RAG system in 7-9 days!**
