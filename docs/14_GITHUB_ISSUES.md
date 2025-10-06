# GitHub Issues Setup Guide
**Version:** 1.0  
**Last Updated:** October 6, 2025

---

## 🎯 Purpose

Create GitHub issues upfront for clear backlog and progress tracking.

---

## 📋 Issue Structure

### Issue Hierarchy
```
Epic (Phase) → Stories (Features) → Tasks (Implementation)
```

**For this project:**
- **Epics** = Days from build plan (Day 1, Day 2, etc.)
- **Stories** = Major features within each day
- **Tasks** = Checkboxes within each story

---

## 🏷️ Labels to Use

From `13_REPO_SETUP.md`, you already have:
- `phase-1` through `phase-9`
- `feature`, `bugfix`, `docs`, `refactor`, `test`
- `priority:low`, `priority:medium`, `priority:high`, `priority:critical`

---

## 📝 Issue Templates

### Epic Template (Phase)

```markdown
**Title:** Phase X: [Phase Name]

**Labels:** phase-X, epic

**Description:**

## Overview
[Brief description of this phase from 09_BUILD_PLAN.md]

## Duration
[X hours/days]

## Documentation
- Build Plan: `docs/09_BUILD_PLAN.md#day-X`
- Related Specs: [List relevant docs]

## Features (Stories)
- [ ] #[issue-number] - Story 1
- [ ] #[issue-number] - Story 2
- [ ] #[issue-number] - Story 3

## Acceptance Criteria
From build plan:
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Dependencies
- Depends on: #[previous-phase-issue]
- Required for: #[next-phase-issue]

## Definition of Done
- [ ] All stories complete
- [ ] All tests passing
- [ ] Phase summary created
- [ ] Review agent approved
- [ ] PR merged to develop

## Notes
[Any additional context]
```

### Story Template (Feature)

```markdown
**Title:** [Feature Name]

**Labels:** phase-X, feature, priority:medium

**Description:**

## Context
Part of Phase X: [Link to epic issue]

## What to Build
[Detailed description from planning docs]

## Technical Specs
- Documentation: `docs/[relevant-doc].md`
- Files to create/modify:
  - `path/to/file1.ts`
  - `path/to/file2.ts`

## Implementation Tasks
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3
- [ ] Write tests
- [ ] Update documentation

## Acceptance Criteria
- [ ] Feature works as specified
- [ ] Tests pass
- [ ] No console errors
- [ ] Code reviewed

## Testing
How to verify:
```bash
# Commands to test this feature
```

## Related
- Epic: #[epic-issue]
- Depends on: #[dependency-issue] (if any)
- Related docs: [links]
```

---

## 📊 All Issues to Create

### Phase 1: Database + Core Pipeline (Day 1)

#### Epic Issue
```bash
gh issue create \
  --title "Phase 1: Database Setup and Core Pipeline" \
  --label "phase-1,epic,priority:high" \
  --body-file templates/phase-1-epic.md
```

#### Stories
```bash
# Story 1.1
gh issue create \
  --title "Create database schema and migrations" \
  --label "phase-1,feature,priority:high" \
  --body "## Context
Part of Phase 1: Database Setup

## What to Build
Create initial database schema with 3 tables:
- collections
- documents  
- chunks

## Technical Specs
- Documentation: docs/03_DATABASE_SCHEMA.md
- Files to create:
  - packages/db/migrations/001_initial_schema.sql
  - packages/db/src/client.ts
  - packages/db/src/migrate.ts

## Tasks
- [ ] Write migration SQL
- [ ] Create migration runner
- [ ] Apply migration
- [ ] Verify tables exist
- [ ] Test connection pool

## Acceptance Criteria
- [ ] All 3 tables created
- [ ] Indexes created
- [ ] Foreign keys work
- [ ] Migration runner works
- [ ] Can connect from Node

## Testing
\`\`\`bash
docker compose exec db psql -U postgres -d synthesis -c \"\\dt\"
\`\`\`"

# Story 1.2
gh issue create \
  --title "Implement PDF/DOCX/MD extraction" \
  --label "phase-1,feature,priority:high" \
  --body "## Context
Part of Phase 1: Core Pipeline

## What to Build
Extract text from uploaded documents.

## Technical Specs
- Documentation: docs/06_PIPELINE.md#stage-1-extraction
- Files to create:
  - apps/server/src/pipeline/extract.ts
- Dependencies: pdf-parse, mammoth, remark

## Tasks
- [ ] Install dependencies
- [ ] Implement extractPDF()
- [ ] Implement extractDOCX()
- [ ] Implement extractMarkdown()
- [ ] Write unit tests
- [ ] Test with real files

## Acceptance Criteria
- [ ] PDF extraction works
- [ ] DOCX extraction works
- [ ] Markdown extraction works
- [ ] Metadata preserved
- [ ] Tests pass"

# Story 1.3
gh issue create \
  --title "Implement file upload endpoint" \
  --label "phase-1,feature,priority:high" \
  --body "## Context
Part of Phase 1: Core Pipeline

## What to Build
POST /api/ingest endpoint with multipart upload.

## Technical Specs
- Documentation: docs/05_API_SPEC.md#post-apiingest
- Files to create:
  - apps/server/src/routes/ingest.ts
- Dependencies: @fastify/multipart

## Tasks
- [ ] Install @fastify/multipart
- [ ] Create /api/ingest route
- [ ] Handle file upload
- [ ] Save to storage
- [ ] Create document record
- [ ] Return doc_id
- [ ] Write tests

## Acceptance Criteria
- [ ] Can upload PDF via curl
- [ ] File saved to storage/
- [ ] Document record in DB
- [ ] Returns valid doc_id
- [ ] Error handling works"
```

---

### Phase 2: Chunking + Embeddings (Day 2)

```bash
# Epic
gh issue create \
  --title "Phase 2: Chunking and Embeddings" \
  --label "phase-2,epic,priority:high" \
  --body "See docs/09_BUILD_PLAN.md#day-2"

# Story 2.1
gh issue create \
  --title "Implement text chunking with overlap" \
  --label "phase-2,feature,priority:high" \
  --body "## Context
Part of Phase 2: Pipeline

## Technical Specs
- Documentation: docs/06_PIPELINE.md#stage-2-chunking
- Files to create:
  - apps/server/src/pipeline/chunk.ts
- Parameters: 800 chars, 150 overlap

## Tasks
- [ ] Implement chunkText()
- [ ] Handle paragraph boundaries
- [ ] Add overlap logic
- [ ] Extract metadata
- [ ] Write unit tests
- [ ] Verify chunk sizes"

# Story 2.2
gh issue create \
  --title "Integrate Ollama embeddings" \
  --label "phase-2,feature,priority:high" \
  --body "## Context
Part of Phase 2: Pipeline

## Technical Specs
- Documentation: docs/06_PIPELINE.md#stage-3-embedding
- Files to create:
  - apps/server/src/pipeline/embed.ts
- Model: nomic-embed-text (768 dims)

## Tasks
- [ ] Create Ollama client
- [ ] Implement embedText()
- [ ] Implement batch embedding
- [ ] Add error handling
- [ ] Write tests
- [ ] Verify 768 dimensions"

# Story 2.3
gh issue create \
  --title "Implement full ingestion orchestrator" \
  --label "phase-2,feature,priority:high" \
  --body "## Context
Part of Phase 2: Pipeline

## Technical Specs
- Documentation: docs/06_PIPELINE.md#pipeline-orchestrator
- Files to create:
  - apps/server/src/pipeline/ingest.ts
  - apps/server/src/pipeline/store.ts

## Tasks
- [ ] Create ingestDocument() function
- [ ] Orchestrate: extract → chunk → embed → store
- [ ] Update document status
- [ ] Add progress tracking
- [ ] Error handling
- [ ] Write integration tests"
```

---

### Phase 3: Search + Agent Tools (Day 3)

```bash
# Epic
gh issue create \
  --title "Phase 3: Search and Agent Tools" \
  --label "phase-3,epic,priority:high" \
  --body "See docs/09_BUILD_PLAN.md#day-3"

# Story 3.1
gh issue create \
  --title "Implement vector search with pgvector" \
  --label "phase-3,feature,priority:high" \
  --body "## Technical Specs
- Documentation: docs/02_ARCHITECTURE.md#vector-search-engine
- Files to create:
  - apps/server/src/services/search.ts
  - apps/server/src/routes/search.ts

## Tasks
- [ ] Implement searchRAG()
- [ ] Embed query with Ollama
- [ ] Execute cosine similarity query
- [ ] Format results with citations
- [ ] Create /api/search endpoint
- [ ] Write tests"

# Story 3.2
gh issue create \
  --title "Setup Claude Agent SDK" \
  --label "phase-3,feature,priority:high" \
  --body "## Technical Specs
- Documentation: docs/04_AGENT_TOOLS.md
- Dependencies: @anthropic-ai/agent-sdk, @anthropic-ai/sdk

## Tasks
- [ ] Install Agent SDK
- [ ] Create agent.ts
- [ ] Configure system prompt
- [ ] Register tools
- [ ] Test basic agent response"

# Story 3.3
gh issue create \
  --title "Implement search_rag agent tool" \
  --label "phase-3,feature,priority:high" \
  --body "## Technical Specs
- Documentation: docs/04_AGENT_TOOLS.md#1-search_rag
- Files to create:
  - apps/server/src/agent/tools/search.ts

## Tasks
- [ ] Define tool schema
- [ ] Implement execute() function
- [ ] Call search service
- [ ] Format for agent
- [ ] Register with agent
- [ ] Test tool calling"

# Story 3.4
gh issue create \
  --title "Create /api/agent/chat endpoint" \
  --label "phase-3,feature,priority:high" \
  --body "## Technical Specs
- Documentation: docs/05_API_SPEC.md#post-apiagentchat
- Files to create:
  - apps/server/src/routes/agent.ts

## Tasks
- [ ] Create POST /api/agent/chat
- [ ] Accept message + collection_id
- [ ] Pass to agent
- [ ] Return response
- [ ] Handle tool calls
- [ ] Write tests"
```

---

### Phase 4: Web Fetching (Day 4)

```bash
# Epic
gh issue create \
  --title "Phase 4: Autonomous Web Fetching" \
  --label "phase-4,epic,priority:high" \
  --body "See docs/09_BUILD_PLAN.md#day-4"

# Story 4.1
gh issue create \
  --title "Implement fetch_web_content tool" \
  --label "phase-4,feature,priority:high" \
  --body "## Technical Specs
- Documentation: docs/04_AGENT_TOOLS.md#3-fetch_web_content
- Dependencies: playwright

## Tasks
- [ ] Install Playwright
- [ ] Implement single page fetch
- [ ] Convert HTML to Markdown
- [ ] Save and process content
- [ ] Write tests"

# Story 4.2
gh issue create \
  --title "Implement web crawling mode" \
  --label "phase-4,feature,priority:medium" \
  --body "## Technical Specs
- Documentation: docs/04_AGENT_TOOLS.md#3-fetch_web_content
- Files to modify:
  - apps/server/src/agent/tools/fetch-web.ts

## Tasks
- [ ] Follow links on same domain
- [ ] Respect max_pages limit
- [ ] Avoid duplicates
- [ ] Test with real doc site"

# Story 4.3
gh issue create \
  --title "Implement add_document and remaining tools" \
  --label "phase-4,feature,priority:high" \
  --body "## Technical Specs
- Documentation: docs/04_AGENT_TOOLS.md

## Tasks
- [ ] Implement add_document tool
- [ ] Implement list_collections tool
- [ ] Implement list_documents tool
- [ ] Implement delete_document tool
- [ ] Implement get_document_status tool
- [ ] Register all with agent
- [ ] Test multi-step workflows"
```

---

### Phase 5: UI (Day 5)

```bash
# Epic
gh issue create \
  --title "Phase 5: Frontend UI" \
  --label "phase-5,epic,priority:high" \
  --body "See docs/09_BUILD_PLAN.md#day-5"

# Story 5.1
gh issue create \
  --title "Setup React app with routing" \
  --label "phase-5,feature,priority:high" \
  --body "## Technical Specs
- Documentation: docs/08_UI_SPEC.md
- Dependencies: react-router-dom, @tanstack/react-query

## Tasks
- [ ] Setup routes
- [ ] Create App shell
- [ ] Install Tailwind
- [ ] Install React Query
- [ ] Create basic layout"

# Story 5.2
gh issue create \
  --title "Build Dashboard and Collection pages" \
  --label "phase-5,feature,priority:high" \
  --body "## Technical Specs
- Documentation: docs/08_UI_SPEC.md

## Tasks
- [ ] Create Dashboard page
- [ ] Create CollectionCard component
- [ ] Create CollectionView page
- [ ] Create DocumentList component
- [ ] Wire to API"

# Story 5.3
gh issue create \
  --title "Build Upload and Chat pages" \
  --label "phase-5,feature,priority:high" \
  --body "## Technical Specs
- Documentation: docs/08_UI_SPEC.md

## Tasks
- [ ] Create UploadZone component
- [ ] Create Upload page
- [ ] Create ChatMessage component
- [ ] Create Chat page
- [ ] Wire to /api/agent/chat"
```

---

### Phase 6: MCP Server (Day 6)

```bash
# Epic
gh issue create \
  --title "Phase 6: MCP Server" \
  --label "phase-6,epic,priority:high" \
  --body "See docs/09_BUILD_PLAN.md#day-6"

# Story 6.1
gh issue create \
  --title "Create MCP server with stdio mode" \
  --label "phase-6,feature,priority:high" \
  --body "## Technical Specs
- Documentation: docs/07_MCP_SERVER.md

## Tasks
- [ ] Create apps/mcp package
- [ ] Install MCP SDK
- [ ] Implement server.ts
- [ ] Implement search_docs tool
- [ ] Implement list_collections tool
- [ ] Create stdio.ts
- [ ] Test from command line"

# Story 6.2
gh issue create \
  --title "Add SSE mode for Claude Desktop" \
  --label "phase-6,feature,priority:high" \
  --body "## Technical Specs
- Documentation: docs/07_MCP_SERVER.md#sse-mode

## Tasks
- [ ] Create sse.ts
- [ ] Add Express server
- [ ] Implement SSE transport
- [ ] Test from Claude Desktop (Windows)
- [ ] Document configuration"
```

---

### Phase 7: Docker (Day 7)

```bash
# Epic
gh issue create \
  --title "Phase 7: Docker Integration" \
  --label "phase-7,epic,priority:high" \
  --body "See docs/09_BUILD_PLAN.md#day-7"

# Story 7.1
gh issue create \
  --title "Create Dockerfiles for all services" \
  --label "phase-7,feature,priority:high" \
  --body "## Technical Specs
- Documentation: docs/10_ENV_SETUP.md

## Tasks
- [ ] Create apps/server/Dockerfile
- [ ] Create apps/web/Dockerfile
- [ ] Create apps/mcp/Dockerfile
- [ ] Test builds locally"

# Story 7.2
gh issue create \
  --title "Create docker-compose configuration" \
  --label "phase-7,feature,priority:high" \
  --body "## Technical Specs
- Documentation: docs/02_ARCHITECTURE.md#docker-architecture

## Tasks
- [ ] Create docker-compose.yml
- [ ] Add all services with clear names
- [ ] Configure networks
- [ ] Test docker compose up
- [ ] Verify all services healthy"
```

---

### Phase 8-9: Polish + Testing (Days 8-9)

```bash
# Epic
gh issue create \
  --title "Phase 8-9: Polish and Final Testing" \
  --label "phase-8,phase-9,epic,priority:medium" \
  --body "See docs/09_BUILD_PLAN.md#day-8-9"

# Story 8.1
gh issue create \
  --title "Add error handling and polish" \
  --label "phase-8,feature,priority:medium" \
  --body "## Tasks
- [ ] Add try/catch everywhere
- [ ] User-friendly error messages
- [ ] Loading states in UI
- [ ] Error states in UI
- [ ] Empty states in UI"

# Story 8.2
gh issue create \
  --title "End-to-end testing with real docs" \
  --label "phase-9,test,priority:high" \
  --body "## Tasks
- [ ] Upload 20+ real documents
- [ ] Test agent conversations
- [ ] Test MCP from IDE
- [ ] Test MCP from Claude Desktop
- [ ] Verify all acceptance criteria
- [ ] Document any issues"

# Story 8.3
gh issue create \
  --title "Create documentation and README" \
  --label "phase-8,docs,priority:medium" \
  --body "## Tasks
- [ ] Write main README
- [ ] Document environment setup
- [ ] Add troubleshooting guide
- [ ] Create demo screenshots
- [ ] Update all docs to match implementation"
```

---

## 🚀 Quick Creation Script

Create all issues at once:

```bash
#!/bin/bash
# create-all-issues.sh

# Phase 1
gh issue create --title "Phase 1: Database Setup and Core Pipeline" --label "phase-1,epic,priority:high" --body "..."
gh issue create --title "Create database schema and migrations" --label "phase-1,feature,priority:high" --body "..."
# ... (all other issues)

echo "✅ All issues created!"
```

---

## 📊 Issue Management

### Milestones

Create milestones for phases:

```bash
gh api repos/OWNER/REPO/milestones -X POST \
  -f title="Phase 1: Database + Pipeline" \
  -f description="Day 1-2: Core infrastructure" \
  -f due_on="2025-10-15T00:00:00Z"
```

### Project Board

Add issues to project board:

```bash
gh project item-add PROJECT_NUMBER --owner OWNER --url ISSUE_URL
```

---

## ✅ Checklist

- [ ] Create all epic issues (Phases 1-9)
- [ ] Create all story issues (~30 issues)
- [ ] Link stories to epics (in epic description)
- [ ] Create milestones
- [ ] Add to project board
- [ ] Label appropriately
- [ ] Set priorities

---

**With all issues created, agents have a clear backlog to work from!**
