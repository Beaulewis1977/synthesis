# DROID-PLAN: Comprehensive Feature Implementation Roadmap

**Project:** Synthesis RAG System  
**Date:** 2025-01-15  
**Version:** 1.0  
**Status:** Ready for Implementation

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Phase 1: Comprehensive Review Summary](#phase-1-comprehensive-review-summary)
3. [Phase 2: Conflict Analysis](#phase-2-conflict-analysis)
4. [Phase 3: Phase Assignment & Grouping](#phase-3-phase-assignment--grouping)
5. [Phase 4: Complexity Estimation](#phase-4-complexity-estimation)
6. [Phase 5: Dependency Mapping](#phase-5-dependency-mapping)
7. [Phase 6: Implementation Order (Prioritized Roadmap)](#phase-6-implementation-order-prioritized-roadmap)
8. [Phase 7: Technical Considerations](#phase-7-technical-considerations)
9. [Phase 8: Open Questions & Decisions Needed](#phase-8-open-questions--decisions-needed)
10. [Phase 9: Suggested Quality-of-Life Improvements (OPTIONAL)](#phase-9-suggested-quality-of-life-improvements-optional)
11. [Conclusion & Next Steps](#conclusion--next-steps)

---

## Executive Summary

### Review Scope
Comprehensive read-only review completed of the Synthesis RAG project, including:
- **Documentation:** 40+ phase documents across 12 phases
- **GitHub Issues:** 50+ issues analyzed (open and closed)
- **Codebase:** Complete frontend (React/TypeScript) + backend (Fastify/Node.js) + database (PostgreSQL)
- **Web Research:** Current best practices for RAG chat UIs, streaming cancellation, model selection, and multi-file uploads

### Key Findings
✅ **Solid Foundation:** Core RAG functionality complete (hybrid search, reranking, synthesis, cost tracking)  
✅ **Well-Architected:** Clean separation of concerns, modular services, extensible design  
⚠️ **Gaps Identified:** 9 net-new features needed, 1 already implemented  
⚠️ **Phase 12 Day 4+ Incomplete:** Validation and frontend updates pending  

### Implementation Scope
**10 Requested Features → 9 Net-New + 1 Already Complete**
- **6 Feature Groups:** Agent Chat Enhancements (A), Chat History Management (B), Model Selection (C), Collection Management (D), Document Upload Improvements (E), Document Inspection (F)
- **Estimated Effort:** 126 hours (~25-30 working days for single developer, or 2-3 weeks with team of 4)
- **Proposed Structure:** 3 new phases (Phase 16, 17, 18) + extension of Phase 12 Day 5-6

### Recommendation
✅ **Proceed with Implementation** - Features are well-scoped, dependencies clear, no major blockers identified. Recommend starting with "Quick Wins" (Priority 1) to deliver early value.

---

## Phase 1: Comprehensive Review Summary

### 1.1 Completed Work Assessment

#### Fully Implemented Phases ✅
1. **Phase 1-2:** Database schema + ingestion pipeline
   - PostgreSQL 16 + pgvector 0.7.4
   - Collections, documents, chunks tables
   - PDF/DOCX/Markdown extraction
   - Chunking (800 chars, 150 overlap)
   - Ollama embeddings (nomic-embed-text, 768 dims)

2. **Phase 3:** Agent tools + search
   - Claude Agent SDK orchestrator (10-turn agentic loop)
   - 8 agent tools (search_rag, add_document, fetch_web, list_docs, etc.)
   - Vector search with pgvector HNSW index

3. **Phase 4:** Autonomous web fetching
   - Playwright-based web scraping
   - Crawling support
   - Markdown conversion

4. **Phase 5.1-5.3:** Frontend foundations
   - React + Vite + TypeScript + Tailwind CSS
   - Pages: Dashboard, CollectionView, ChatPage, UploadPage
   - Components: DocumentList, CollectionCard, ChatMessage, UploadZone, Layout
   - React Query for server state management

5. **Phase 6:** MCP Server
   - stdio mode (WSL/IDE agents)
   - SSE mode (Windows/Claude Desktop)
   - Tool exposure: search_docs, list_collections

6. **Phase 7:** Docker integration
   - docker-compose.yml with synthesis-db, synthesis-ollama, synthesis-server, synthesis-web
   - pgvector/pgvector:pg16 image
   - Ollama with GPU support

7. **Phase 11:** Hybrid search + multi-model embeddings
   - BM25 full-text search
   - Reciprocal Rank Fusion (RRF)
   - Multi-provider embeddings (Ollama, OpenAI, Voyage)
   - Trust scoring + recency weighting
   - Metadata enhancement (source_quality, last_verified, embedding_provider)

8. **Phase 12 Days 1-3:** Reranking + synthesis + cost tracking
   - Cohere Rerank API + local BGE fallback
   - Multi-source synthesis engine
   - Contradiction detection (LLM-based)
   - Cost tracking (api_usage + budget_alerts tables)
   - Budget alerts (80% warning, 100% limit)
   - Fallback mode on budget exceeded

#### Partially Implemented ⚠️
1. **Phase 5.4:** Upload functionality
   - ✅ Single file upload works
   - ❌ Multi-document upload missing
   - ❌ Batch processing optimization missing
   - **Status:** Issue #57 open

2. **Phase 12 Day 4+:** Validation + frontend updates
   - ❌ Integration tests incomplete
   - ❌ Performance benchmarks not run
   - ❌ Cost dashboard UI missing
   - ❌ Synthesis view UI missing
   - **Status:** Issue #64 open (frontend)

#### Not Started 🔜
1. **Phase 13:** Code intelligence + AST chunking (Issue #62 open)
2. **Phase 14:** Integration + polish (Issues #67-70 open)
3. **Phase 15:** Final testing + v2.0 release (Issues #71-73 open)

### 1.2 Planned Work Analysis

#### Phase 12 Day 4+ (From PHASE_12_DAY_4_AGENT_PROMPT.md)
**Objectives:**
- Integration tests for full search pipeline with reranking
- Synthesis API with multiple documents
- Contradiction detection testing
- Cost tracking validation
- Performance benchmarks (precision@5 improvement ≥20%, latency <+300ms)

**Deliverables:**
- `apps/server/src/services/__tests__/integration.test.ts`
- `scripts/benchmark-phase12.ts`
- Metrics summary (precision, latency, cost tracking accuracy)
- PR preparation

#### Phase 12 Day 5-6 (From 08_FRONTEND_UPDATES.md)
**Feature 1: Cost Monitoring Dashboard** (10-14 hours)
- New page: `/costs`
- Components:
  - `CostDashboard.tsx` (main page, 80 lines)
  - `CostSummary.tsx` (summary card, 40 lines)
  - `CostBreakdown.tsx` (provider breakdown, 50 lines)
  - `BudgetAlerts.tsx` (alert list, 40 lines)
- API integration: `/api/costs/summary`, `/api/costs/alerts`

**Feature 2: Document Synthesis View** (6-8 hours)
- Enhanced search results with toggle: `[List View] [Synthesis View]`
- Components:
  - `SynthesisView.tsx` (main container, 60 lines)
  - `ApproachCard.tsx` (approach display, 50 lines)
  - `ConflictsList.tsx` (contradictions, 50 lines)
- API integration: `/api/synthesis/compare`

**Total Lines:** ~400 lines, 10-14 hours

#### Phase 13 (From 00_PHASE_13_OVERVIEW.md)
**Focus:** Code intelligence + AST-based chunking for 20,000+ code files
**Key Features:**
- Dart AST parsing (dart_analyzer integration)
- Function/class extraction with imports preserved
- File relationship tracking
- TypeScript support
**Timeline:** 4-5 days
**Issue:** #62 open

#### Phase 14 (Issues #67-70)
**Focus:** Integration + polish
- Integration testing (all features working together)
- Performance optimization (maintain <600ms target)
- Frontend polish (visual consistency, mobile responsive)
- Documentation updates for v2.0

#### Phase 15 (Issues #71-73)
**Focus:** Final testing + release
- End-to-end testing (complete user flows)
- Load testing (20,000 files performance validation)
- v2.0.0 release preparation

### 1.3 GitHub Issues Review

#### Open Issues (High Priority)
- **#57:** Phase 5.4 Upload completion (HIGH) - Directly related to E1
- **#60:** Phase 11 Epic (HIGH) - Mostly complete
- **#61:** Phase 12 Epic (HIGH) - Days 1-3 complete, Day 4+ pending
- **#62:** Phase 13 Epic (HIGH) - Not started
- **#64:** Phase 12 Frontend (HIGH) - Directly related to B2 (chat history UI)
- **#67-73:** Phase 14-15 (HIGH/MEDIUM) - Integration, testing, release

#### Closed Issues (Relevant)
- **#18-20, #31-33:** Phase 5.1-5.3 Frontend setup - Complete ✅
- **#21-23, #34-36:** Phase 6 MCP Server - Complete ✅
- **#24-26, #37-39:** Phase 7 Docker - Complete ✅
- **#63:** Phase 11 Frontend (badges) - Complete ✅

#### Key Insight: No Overlap with New Features
**None of the open issues directly address the new features A1-F2**, indicating these are **NET NEW requirements** not previously planned. The closest overlap:
- **#64** mentions "chat history" but lacks detailed specification
- **#57** mentions "upload" but only single-file completion

### 1.4 Core Documentation Review

#### Architecture (02_ARCHITECTURE.md)
**Key Findings:**
- **Design Principle:** "Not over-engineered" - Simple until complexity needed
- **Multi-project from day 1:** Collections isolate projects cleanly
- **Agent-first:** Claude Agent SDK with 10-turn agentic loop
- **Vector search:** pgvector with HNSW index for <500ms queries
- **Extensible:** JSONB metadata fields for future enhancements

**Relevant to New Features:**
- Chat history would extend agent conversation management
- Model selection aligns with "toggleable" provider design
- Document management already has strong foundation

#### API Specification (05_API_SPEC.md)
**Existing Endpoints:**
```
POST /api/agent/chat - Chat with agent
POST /api/agent/stream - Streaming chat (SSE)
GET /api/collections - List collections
POST /api/collections - Create collection ✅ (D1 backend exists)
GET /api/documents?collection_id=X - List documents
DELETE /api/documents/:id - Delete document ✅ (F2 backend exists)
POST /api/ingest - Upload documents
POST /api/search - Vector/hybrid search
POST /api/synthesis/compare - Multi-source synthesis ✅ (Phase 12)
GET /api/costs/summary - Cost dashboard data ✅ (Phase 12)
```

**Missing Endpoints (Needed for New Features):**
```
POST /api/chat/sessions - Create chat session (B1)
GET /api/chat/sessions?collection_id=X - List sessions (B1)
GET /api/chat/sessions/:id - Get session with messages (B1)
DELETE /api/chat/sessions/:id - Delete session (B1)
POST /api/chat/sessions/:id/messages - Add message (B1)
POST /api/agent/stop - Cancel agent request (A1)
GET /api/models - List available models (C1)
GET /api/documents/:id/details - Document statistics + summary (F1)
```

#### Database Schema (03_DATABASE_SCHEMA.md)
**Existing Tables:**
```sql
collections (id, name, description, created_at, updated_at)
documents (id, collection_id, title, file_path, content_type, file_size, status, error_message, metadata JSONB, ...)
chunks (id, doc_id, chunk_index, text, embedding VECTOR(768), embedding_model, metadata JSONB, ...)
api_usage (id, provider, operation, tokens_used, cost_usd, collection_id, created_at, metadata JSONB) -- Phase 12
budget_alerts (id, alert_type, threshold_usd, current_spend_usd, period, triggered_at, acknowledged) -- Phase 12
```

**Missing Tables (Needed for B1):**
```sql
chat_sessions (id, collection_id, title, created_at, updated_at, metadata JSONB)
chat_messages (id, session_id, role, content, tool_calls JSONB, created_at, metadata JSONB)
```

### 1.5 Codebase State Analysis

#### Frontend Analysis (`apps/web/src/`)

**Directory Structure:**
```
apps/web/src/
├── components/
│   ├── ChatMessage.tsx ✅ (displays user/assistant messages)
│   ├── CollectionCard.tsx ✅ (collection list item)
│   ├── DocumentList.tsx ✅ (document list with delete)
│   ├── Layout.tsx ✅ (navigation + outlet)
│   ├── RecencyBadge.tsx ✅ (Phase 11)
│   ├── ResultCard.tsx ✅ (search results)
│   ├── TrustBadge.tsx ✅ (Phase 11)
│   └── UploadZone.tsx ✅ (single file upload)
├── pages/
│   ├── ChatPage.tsx ✅ (agent chat interface)
│   ├── CollectionView.tsx ✅ (documents in collection)
│   ├── Dashboard.tsx ✅ (collections list)
│   └── UploadPage.tsx ✅ (single file upload page)
├── lib/
│   ├── api.ts ✅ (API client with React Query)
│   └── utils.ts ✅ (formatters, helpers)
├── types/
│   └── index.ts ✅ (TypeScript types)
└── App.tsx ✅ (routing)
```

**What's Missing:**
- ❌ `ChatHistory.tsx` (B2 - sidebar for chat sessions)
- ❌ `ModelSelector.tsx` (C1 - model dropdown)
- ❌ `CreateCollectionModal.tsx` (D1 - create collection form)
- ❌ `MultiFileUpload.tsx` (E1 - multi-document upload)
- ❌ `DocumentDetailsModal.tsx` (F1 - document statistics + summary)
- ❌ `CostDashboard.tsx`, `CostSummary.tsx`, `CostBreakdown.tsx`, `BudgetAlerts.tsx` (Phase 12 Day 5-6)
- ❌ `SynthesisView.tsx`, `ApproachCard.tsx`, `ConflictsList.tsx` (Phase 12 Day 5-6)

**Existing Patterns:**
- React Query for data fetching: `useQuery`, `useMutation`
- React Router for navigation: `useParams`, `useNavigate`, `Link`
- Tailwind CSS for styling: utility classes, custom design tokens
- TypeScript strict mode: proper typing throughout
- Error handling: Loading/error states in UI
- Form validation: Client-side validation before API calls

**Key Files for Reference:**

**ChatPage.tsx** (Agent chat interface):
```typescript
// Key features to reference for new chat features:
- Message state management: useState<ChatMessageType[]>
- History management: Passes history to API
- Auto-scroll: useEffect with messagesEndRef
- Loading states: chatMutation.isPending
- Error handling: onError with error messages
```

**DocumentList.tsx** (Document management):
```typescript
// Key features to reference for document features:
- Delete confirmation: showConfirm state
- Status badges: getStatusBadge() function
- File type icons: getFileTypeIcon() utility
- Formatting: formatFileSize, formatRelativeTime
// NOTE: Delete functionality already implemented ✅
```

**Dashboard.tsx** (Collections list):
```typescript
// Key features to reference for collection UI:
- Loading state: Loader2 component
- Error state: AlertCircle with retry
- Empty state: "No collections yet"
- Grid layout: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
```

#### Backend Analysis (`apps/server/src/`)

**Directory Structure:**
```
apps/server/src/
├── routes/
│   ├── agent.ts ✅ (POST /api/agent/chat)
│   ├── collections.ts ✅ (GET, POST, DELETE collections)
│   ├── costs.ts ✅ (GET /api/costs/summary, /history, /alerts)
│   ├── ingest.ts ✅ (POST /api/ingest, multipart)
│   ├── search.ts ✅ (POST /api/search, hybrid + rerank)
│   └── synthesis.ts ✅ (POST /api/synthesis/compare)
├── services/
│   ├── bm25.ts ✅ (BM25 full-text search)
│   ├── contradiction-detection.ts ✅ (LLM-based detection)
│   ├── cost-tracker.ts ✅ (API usage tracking)
│   ├── documentOperations.ts ✅ (CRUD operations)
│   ├── embedding-router.ts ✅ (Multi-provider selection)
│   ├── hybrid.ts ✅ (RRF fusion)
│   ├── metadata-builder.ts ✅ (Enhanced metadata)
│   ├── reranker.ts ✅ (Cohere + BGE)
│   ├── search.ts ✅ (Smart search orchestrator)
│   ├── synthesis.ts ✅ (Multi-source synthesis)
│   └── vector.ts ✅ (Vector similarity search)
├── agent/
│   ├── agent.ts ✅ (Claude Agent SDK, 10-turn loop)
│   └── tools.ts ✅ (8 agent tools)
├── pipeline/
│   ├── chunk.ts ✅ (Text chunking)
│   ├── embed.ts ✅ (Multi-provider embeddings)
│   ├── extract.ts ✅ (PDF/DOCX/MD extraction)
│   └── ingest.ts ✅ (Pipeline orchestration)
└── index.ts ✅ (Fastify server setup)
```

**What's Missing:**
- ❌ `routes/chat-sessions.ts` (B1 - chat session CRUD APIs)
- ❌ `routes/models.ts` (C1 - model listing + selection)
- ❌ `routes/document-details.ts` (F1 - document details endpoint, or extend existing)
- ❌ `services/chat-session-manager.ts` (B1 - session management logic)
- ❌ `services/model-manager.ts` (C1 - model configuration + switching)
- ❌ `services/document-summary.ts` (F1 - AI-generated summaries)
- ❌ Agent streaming cancellation logic (A1 - AbortController integration)

**Existing Patterns:**
- Fastify plugins: `FastifyPluginAsync` export pattern
- Zod validation: Input schemas with `.safeParse()`
- Error handling: Try/catch with structured error responses
- Database pool: `getPool()` from `@synthesis/db`
- Service layer: Business logic separated from routes
- Type safety: TypeScript interfaces for all data structures

**Key Files for Reference:**

**agent.ts** (Claude Agent SDK orchestrator):
```typescript
// Key features for A1, A2:
- maxTurns loop (10 turns)
- Message history management
- Tool execution pipeline
- Response streaming potential (anthropic.messages.create)
// For A1: Need to integrate AbortController
// For A2: Need to modify message array mid-loop
```

**search.ts** (Smart search orchestrator):
```typescript
// Key features for search-related features:
- Mode selection: 'vector' | 'hybrid'
- Provider inference: inferCollectionEmbeddingHint()
- Trust scoring: applyTrustScoring()
- Result formatting: SmartSearchResponse
// Already handles reranking, can reference for model selection
```

**collections.ts** (Collection CRUD):
```typescript
// Key features for D1:
- GET /api/collections - Already has list endpoint
- POST /api/collections - Already has create endpoint ✅
- Zod validation: CreateCollectionSchema
- Error handling: 400 for invalid, 500 for server errors
// D1 only needs FRONTEND, backend exists!
```

#### Database Analysis (`packages/db/`)

**Migrations:**
```
packages/db/migrations/
├── 001_initial_schema.sql ✅ (collections, documents, chunks)
├── 002_seed_collections.sql ✅ (default collections)
├── 003_cost_tracking.sql ✅ (api_usage, budget_alerts) [Phase 12]
├── 004_hybrid_search.sql ✅ (BM25 indexes, metadata) [Phase 11]
└── 005_chat_sessions.sql ❌ MISSING (needed for B1)
```

**Queries Module** (`packages/db/src/queries.ts`):
```typescript
// Existing functions:
- listCollections() ✅
- getCollection() ✅
- createCollection() ✅
- deleteCollection() ✅
- listDocuments() ✅
- getDocument() ✅
- deleteDocument() ✅
- createDocument() ✅
- updateDocumentStatus() ✅

// Missing functions (needed):
- createChatSession() ❌ (B1)
- getChatSession() ❌ (B1)
- listChatSessions() ❌ (B1)
- deleteChatSession() ❌ (B1)
- addChatMessage() ❌ (B1)
- getChatMessages() ❌ (B1)
- getDocumentDetails() ❌ (F1 - aggregations)
```

### 1.6 Current Limitations & Pain Points

Based on code review and documentation analysis:

1. **Chat Experience:**
   - ❌ No chat history persistence - every page refresh loses conversation
   - ❌ Cannot stop agent mid-response - must wait for completion
   - ❌ Cannot send new message while agent is thinking - blocks user input
   - ❌ Cannot switch between past conversations - linear chat only

2. **Model Flexibility:**
   - ❌ Hardcoded to Claude 3-7 Sonnet - no model selection UI
   - ❌ Cannot test with Ollama models - requires code changes
   - ❌ No cost comparison - users don't know model trade-offs
   - ❌ Cannot optimize per collection - same model for all projects

3. **Collection Management:**
   - ❌ No "Create Collection" button in UI - must use API directly
   - ⚠️ API exists but not exposed to users - poor UX

4. **Document Upload:**
   - ❌ Single file only - tedious for bulk uploads
   - ❌ No drag-and-drop for multiple files - requires multiple clicks
   - ❌ No batch progress tracking - unclear status for multiple files
   - ❌ No partial failure handling - one error stops everything

5. **Document Management:**
   - ❌ No document details view - cannot see chunking stats, token counts
   - ❌ No AI-generated summaries - unclear what each document contains
   - ❌ No metadata inspection - limited visibility into processing results
   - ✅ Delete works well - confirmation + inline UI

6. **Agent Behavior:**
   - ⚠️ No streaming - responses appear all at once
   - ⚠️ Long responses feel slow - no incremental feedback
   - ❌ Cannot interrupt - must wait for full response

### 1.7 Web Research Findings

#### Chat History UI Patterns (from web research)
**Best Practices:**
- **Sidebar pattern:** Left sidebar with session list (ChatGPT, Claude, Cursor)
- **Auto-titles:** Generate from first user message, truncate to 40-50 chars
- **Session metadata:** Timestamp, message count, collection indicator
- **Persistence:** SQLite or PostgreSQL with indexed created_at
- **Pagination:** Cursor-based for 100+ sessions, infinite scroll
- **Search:** Optional filter by collection or keyword

**Recommended Schema (from multiple sources):**
```sql
chat_sessions (id, collection_id, title, created_at, updated_at)
chat_messages (id, session_id, role, content, created_at)
```

#### Streaming Cancellation Patterns (from web research)
**Best Practices:**
- **AbortController:** Standard web API for cancellation
- **HTTP Disconnect Detection:** Monitor disconnect messages
- **Shielding:** Protect critical operations (DB writes) during cancellation
- **Resource Cleanup:** Ensure no leaked streams or connections

**Implementation Pattern:**
```typescript
// Client
const abortController = new AbortController();
fetch('/api/agent/chat', { signal: abortController.signal });
// On stop button click:
abortController.abort();

// Server
app.post('/api/agent/chat', async (request, reply) => {
  request.raw.on('close', () => {
    // Abort in-progress operations
  });
});
```

#### Model Selection UI Patterns (from web research)
**Best Practices:**
- **Dropdown with metadata:** Model name + context window + cost + speed indicator
- **Grouping:** Separate by provider (Anthropic, OpenAI, Ollama)
- **Visual indicators:** Icons for capabilities (multimodal, coding, speed)
- **Cost comparison:** Show relative cost ($$$ vs $ vs Free)
- **Performance hints:** "Best for reasoning", "Best for speed", "Best for code"
- **Persistence:** Store preference per-collection or globally

**Recommended UX:**
```
[Model Selector ▼]
──────────────────────
Anthropic
  ○ Claude 3.7 Sonnet (128K, $$, Balanced) [Current]
  ○ Claude 3.5 Sonnet (200K, $$, Fast)
  ○ Claude 3.5 Haiku (200K, $, Fastest)
──────────────────────
Ollama (Local)
  ○ llama3.2:3b (128K, Free, Fast)
  ○ llama3.2:1b (128K, Free, Fastest)
```

#### Multi-File Upload Patterns (from web research)
**Best Practices:**
- **react-dropzone:** Industry-standard library for drag-and-drop
- **Visual drop zone:** Clear affordances, highlight on drag-over
- **Multi-select support:** Ctrl+Click, Shift+Click in file picker
- **Individual progress bars:** Per-file status + overall progress
- **Partial failure handling:** Continue uploading if one fails
- **Retry mechanism:** Allow re-upload of failed files
- **Validation:** Pre-validate file types and sizes client-side

**Implementation Pattern:**
```typescript
import { useDropzone } from 'react-dropzone';

const { getRootProps, getInputProps } = useDropzone({
  multiple: true,
  maxSize: 100 * 1024 * 1024, // 100 MB
  accept: { 'application/pdf': ['.pdf'], /* ... */ },
  onDrop: (acceptedFiles) => {
    // Upload each file with individual progress tracking
  },
});
```

---

## Phase 2: Conflict Analysis

### 2.1 Feature-by-Feature Overlap Assessment

| Feature ID | Feature Name | Status | Existing Plan Reference | Gap Analysis |
|------------|--------------|--------|------------------------|--------------|
| **A1** | Stop Button for Agent Responses | ❌ **NET NEW** | None | Complete implementation needed:<br>- Frontend: Stop button component<br>- Backend: AbortController integration<br>- Agent: Cancellation handling in runAgentChat() |
| **A2** | Interrupt Agent with New Messages | ❌ **NET NEW** | None | Complete implementation needed:<br>- Frontend: Message queue while agent active<br>- Backend: Agent loop modification for interrupts<br>- State: Race condition handling |
| **B1** | Persistent Chat History (Backend) | ⚠️ **PARTIAL** | Phase 12 Day 5-6 mentions "chat history" in frontend docs | Backend missing:<br>- Database schema (chat_sessions, chat_messages)<br>- API routes (CRUD for sessions/messages)<br>- Query functions in packages/db |
| **B2** | Chat History UI (Frontend) | ⚠️ **PARTIAL** | Phase 12 Day 5-6 frontend updates, Issue #64 | Detailed spec missing:<br>- Sidebar component design<br>- Session switching logic<br>- Persistence patterns<br>**Note:** Issue #64 mentions this but lacks implementation detail |
| **C1** | LLM Provider and Model Switcher | ❌ **NET NEW** | None | Complete implementation needed:<br>- Frontend: Model selector dropdown<br>- Backend: Agent config updates for dynamic models<br>- Ollama: Dynamic model list API integration |
| **D1** | Create New Collection UI | ⚠️ **PARTIAL** | API exists (POST /api/collections in collections.ts) | Frontend component needed:<br>- Modal or inline form<br>- Validation UI<br>- Success/error handling<br>**Backend is COMPLETE ✅** |
| **E1** | Multi-Document Upload | ⚠️ **PARTIAL** | Phase 5.4 (Issue #57) - single upload works | Multi-file logic needed:<br>- react-dropzone integration<br>- Batch progress tracking<br>- Partial failure handling<br>**Directly addresses Issue #57** |
| **F1** | Document Details View | ❌ **NET NEW** | None | Complete implementation needed:<br>- Frontend: Modal/panel component<br>- Backend: Aggregation query for stats<br>- AI: Summary generation (on-demand) |
| **F2** | Document Deletion | ✅ **IMPLEMENTED** | DocumentList.tsx lines 29-37 | **NO WORK NEEDED**<br>Single deletion: ✅ Complete<br>Batch deletion: Optional enhancement (see QoL suggestions) |

### 2.2 Conflict Resolution Recommendations

#### Recommendation 1: Integrate B2 into Phase 12 Day 5-6
**Rationale:** Issue #64 already mentions "Chat History UI" as part of Phase 12 frontend updates. Rather than create a new phase, extend Phase 12 Day 5-6 to include both:
- Cost Dashboard (already planned)
- Synthesis View (already planned)
- Chat History UI (B2 - new detail)

**Benefits:**
- Maintains phase continuity
- Groups all Phase 12 frontend work together
- Avoids phase number confusion

#### Recommendation 2: Create Phase 16 for Chat & Agent Enhancements
**Rationale:** A1, A2, B1 are all related to chat/agent experience and have dependencies. Group them:
- A1 (Stop Button) → Enables A2 (shares cancellation infrastructure)
- B1 (Chat History Backend) → Enables B2 (provides data layer)

**Benefits:**
- Logical feature grouping
- Clear dependencies
- Can be tackled by a single developer or team

#### Recommendation 3: Create Phase 17 for Collection & Document Management
**Rationale:** D1, E1, F1 are all document/collection management features with no interdependencies. Group them:
- D1 (Create Collection UI) - Quick win, backend exists
- E1 (Multi-Document Upload) - Completes Phase 5.4, Issue #57
- F1 (Document Details View) - Enhances document management

**Benefits:**
- Completes Phase 5.4 (#57)
- All are UI-focused (frontend team can own)
- Can be implemented in parallel

#### Recommendation 4: Create Phase 18 for Model Selection
**Rationale:** C1 is complex and independent. It touches both frontend and backend but has no dependencies on other new features.

**Benefits:**
- Focus on single complex feature
- Can be implemented after stabilizing other phases
- Power user feature (lower priority than core UX)

#### Recommendation 5: Defer or Skip F2 Enhancements
**Rationale:** Single document deletion already works perfectly (DocumentList.tsx). Batch deletion is nice-to-have, not critical.

**Benefits:**
- Avoid unnecessary work
- Focus on net-new value
- Can add batch deletion later as QoL improvement if needed

### 2.3 Final Phase Assignment

**Phase 12 Day 5-6 (Extended):**
- Cost Dashboard (already planned)
- Synthesis View (already planned)
- **B2: Chat History UI (new)**

**Phase 16: Chat & Agent Enhancements**
- A1: Stop Button for Agent Responses
- A2: Interrupt Agent with New Messages
- B1: Persistent Chat History (Backend)

**Phase 17: Collection & Document Management**
- D1: Create New Collection UI
- E1: Multi-Document Upload
- F1: Document Details View

**Phase 18: Model Selection & Configuration**
- C1: LLM Provider and Model Switcher

**Deferred:**
- F2 enhancements (batch deletion) - Optional QoL improvement

---

## Phase 3: Phase Assignment & Grouping

### 3.1 Proposed Phase Structure

#### Phase 12 Day 5-6 (Extended): Frontend Updates
**Goal:** Complete Phase 12 frontend deliverables + add chat history UI

**Features:**
1. **Cost Monitoring Dashboard** (already planned)
   - Page: `/costs`
   - Components: CostDashboard, CostSummary, CostBreakdown, BudgetAlerts
   - API integration: `/api/costs/*`

2. **Document Synthesis View** (already planned)
   - Toggle: List View ↔ Synthesis View
   - Components: SynthesisView, ApproachCard, ConflictsList
   - API integration: `/api/synthesis/compare`

3. **B2: Chat History UI** (NEW)
   - Sidebar: Chat session list
   - Components: ChatHistory, SessionList, SessionItem
   - API integration: `/api/chat/sessions`, `/api/chat/sessions/:id`

**Prerequisites:**
- Phase 12 Days 1-3 complete ✅
- B1 (Chat History Backend) complete before starting B2

**Estimated Effort:** 20-24 hours (4-5 days)

#### Phase 16: Chat & Agent Enhancements
**Goal:** Improve agent chat experience with persistence and control

**Features:**
1. **B1: Persistent Chat History (Backend)**
   - Database: chat_sessions, chat_messages tables
   - Routes: `/api/chat/sessions/*`
   - Service: chat-session-manager.ts
   - Query functions: createChatSession, getChatSession, listChatSessions, etc.

2. **A1: Stop Button for Agent Responses**
   - Frontend: Stop button component in ChatPage
   - Backend: AbortController integration in agent route
   - Agent: Cancellation handling in runAgentChat()

3. **A2: Interrupt Agent with New Messages**
   - Frontend: Message queue, interrupt UI
   - Backend: Agent loop modification for dynamic message injection
   - State: Race condition handling, message ordering

**Dependencies:**
- B1 must complete before B2 (Phase 12 Day 5-6)
- A1 provides infrastructure for A2

**Estimated Effort:** 60 hours (12 days, or 3-4 days with parallel work)

#### Phase 17: Collection & Document Management
**Goal:** Complete document management UX and Phase 5.4

**Features:**
1. **D1: Create New Collection UI**
   - Component: CreateCollectionModal or inline form
   - Validation: Name uniqueness, length checks
   - Integration: POST /api/collections (already exists)

2. **E1: Multi-Document Upload**
   - Component: MultiFileUpload with react-dropzone
   - Features: Drag-drop, multi-select, individual progress, partial failure handling
   - Integration: POST /api/ingest (batch logic)

3. **F1: Document Details View**
   - Component: DocumentDetailsModal
   - Backend: Document aggregation query (chunks, tokens, stats)
   - AI: Summary generation endpoint (on-demand with caching)

**Dependencies:** None (all independent)

**Estimated Effort:** 30 hours (6 days, or 2 days with parallel work)

#### Phase 18: Model Selection & Configuration
**Goal:** Enable per-collection model customization

**Features:**
1. **C1: LLM Provider and Model Switcher**
   - Frontend: ModelSelector dropdown component
   - Backend: Agent config updates for model switching
   - Ollama: Dynamic model list API integration (GET /api/tags)
   - Database: Store model preference in collection metadata

**Dependencies:** None (independent feature)

**Estimated Effort:** 22 hours (4-5 days)

### 3.2 Justification for Phase Assignment

#### Why extend Phase 12 Day 5-6 (instead of new phase)?
✅ **Maintains continuity** - Issue #64 already exists for Phase 12 frontend  
✅ **Logical grouping** - All Phase 12 frontend work together  
✅ **Avoids confusion** - No new phase numbers needed  
⚠️ **Consideration** - B2 requires B1 first, so B1 must be prioritized

#### Why create Phase 16 for Chat & Agent?
✅ **Dependency cluster** - A1 → A2, B1 → B2  
✅ **Thematic cohesion** - All about chat/agent experience  
✅ **Technical scope** - Backend + frontend + agent modifications  
✅ **Single team** - Can be owned by one developer or team

#### Why create Phase 17 for Document Management?
✅ **Completes Phase 5.4** - Directly addresses Issue #57  
✅ **No dependencies** - All features independent, can parallelize  
✅ **UI-focused** - Frontend team can own all three  
✅ **User value** - Direct UX improvements for document workflows

#### Why create Phase 18 for Model Selection?
✅ **Complexity** - High complexity warrants dedicated focus  
✅ **Independence** - No dependencies on other new features  
✅ **Separation** - Can be implemented after other phases stabilize  
✅ **Power user feature** - Lower priority than core UX (Phases 16-17)

### 3.3 Scope Management

#### Features Marked COMPLETE (No Work Needed)
- **F2: Document Deletion** - Single deletion already implemented in DocumentList.tsx
  - Confirmation dialog: ✅
  - Inline UI: ✅
  - Error handling: ✅
  - API integration: ✅

#### Features Deferred to QoL (Optional)
- **F2 Batch Deletion** - Enhancement to existing feature
- **Chat Export** - Export sessions to JSON/Markdown
- **Keyboard Shortcuts** - Ctrl+K, Ctrl+Enter, etc.
- **Document Tags** - Manual tagging for organization

---

## Phase 4: Complexity Estimation

### 4.1 Complexity Rating Methodology

**Factors Considered:**
1. **Frontend Complexity** - New components, state management, UI/UX challenges
2. **Backend Complexity** - New routes, database changes, business logic
3. **Integration Complexity** - How many systems touched, testing scope
4. **Uncertainty/Risk** - Unclear requirements, new technologies, edge cases

**Rating Scale:**
- **LOW:** Straightforward implementation, established patterns, minimal risk
- **MEDIUM:** Multiple components, some complexity, moderate risk
- **HIGH:** Complex logic, multiple systems, significant risk
- **VERY HIGH:** Architectural changes, high uncertainty, major risk

### 4.2 Feature-by-Feature Complexity Analysis

#### A1: Stop Button for Agent Responses - **HIGH Complexity**

**Frontend:** 6 hours
- Create StopButton component (2 hours)
  - Button UI with loading state
  - Disabled state management
  - Integration with ChatPage state
- Update ChatPage to show/hide button based on agent status (2 hours)
  - Track isPending from mutation
  - Position button in UI (near input or in header)
- API integration for cancellation (2 hours)
  - POST /api/agent/stop endpoint
  - Handle cancellation response
  - Update UI on successful cancellation

**Backend:** 10 hours
- Create /api/agent/stop endpoint (3 hours)
  - Accept request_id or session identifier
  - Lookup in-flight request
  - Trigger AbortController.abort()
- Integrate AbortController with agent route (4 hours)
  - Modify POST /api/agent/chat to create AbortController per request
  - Pass signal to anthropic.messages.create()
  - Store controller in Map<requestId, AbortController>
- Agent cleanup logic (3 hours)
  - Handle abort mid-tool-execution
  - Ensure no resource leaks (streams, DB connections)
  - Return partial response or cancellation message

**Integration:** 4 hours
- Test cancellation scenarios (3 hours)
  - Cancel during thinking (no tool calls)
  - Cancel during tool execution
  - Cancel with partial response
  - Edge case: multiple rapid cancellations
- Error handling (1 hour)
  - Handle AbortError gracefully
  - Display user-friendly message

**Total Estimated Effort:** 20 hours (~4 days)

**Uncertainty:** HIGH
- Streaming + agent loop modifications are complex
- AbortController integration with Anthropic SDK may have quirks
- Race conditions possible (cancel after response already sent)

---

#### A2: Interrupt Agent with New Messages - **VERY HIGH Complexity**

**Frontend:** 4 hours
- Message queue management (2 hours)
  - Queue new messages while agent is processing
  - Display queued message count
  - UI feedback: "Message queued, will be sent when agent is ready"
- Interrupt UI (2 hours)
  - "Interrupt Agent" button or auto-send queued message
  - Clear visual distinction from normal message send

**Backend:** 16 hours
- Agent loop modification (10 hours)
  - **Major architectural change:** Modify runAgentChat() to accept message injection mid-loop
  - Design: Polling mechanism or event-driven approach
  - Example approach:
    ```typescript
    // Option 1: Polling (simpler)
    while (turn < maxTurns) {
      // Check for new messages before each turn
      const newMessage = await checkForQueuedMessage(sessionId);
      if (newMessage) {
        messages.push({ role: 'user', content: newMessage });
      }
      // ... continue agent loop
    }
    
    // Option 2: Event-driven (more complex, better UX)
    eventEmitter.on('newMessage', (msg) => {
      messages.push(msg);
      // Interrupt current processing
    });
    ```
  - Ensure conversation state remains consistent
  - Handle edge cases: message arrives during tool execution
- State management (4 hours)
  - Track which agent instance is processing which conversation
  - Store message queue per session
  - Race condition handling (lock mechanisms or semaphores)
- Message ordering (2 hours)
  - Ensure messages are processed in order
  - Timestamp-based ordering
  - Handle out-of-order arrival

**Integration:** 6 hours
- Testing complex scenarios (4 hours)
  - Interrupt during tool execution
  - Interrupt during thinking
  - Multiple interrupts in rapid succession
  - Interrupt then cancel
- Message ordering validation (2 hours)
  - Verify conversation history integrity
  - Test with concurrent requests

**Total Estimated Effort:** 26 hours (~5+ days)

**Uncertainty:** VERY HIGH
- Requires fundamental agent loop redesign
- State management is complex (concurrent requests, race conditions)
- May need to implement message queue (Redis?) or in-memory store
- Testing is difficult (timing-dependent scenarios)
- May impact performance if not optimized

---

#### B1: Persistent Chat History (Backend) - **MEDIUM Complexity**

**Database:** 3 hours
- Create migration 005_chat_sessions.sql (2 hours)
  ```sql
  CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
  );
  
  CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    tool_calls JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
  );
  
  CREATE INDEX chat_sessions_collection_idx ON chat_sessions(collection_id);
  CREATE INDEX chat_messages_session_idx ON chat_messages(session_id);
  CREATE INDEX chat_messages_created_idx ON chat_messages(created_at);
  ```
- Run migration and verify (1 hour)

**Backend:** 8 hours
- Query functions in packages/db/src/queries.ts (3 hours)
  - `createChatSession(collectionId, title?)`
  - `getChatSession(sessionId)`
  - `listChatSessions(collectionId, limit, offset)`
  - `deleteChatSession(sessionId)`
  - `addChatMessage(sessionId, role, content, toolCalls?)`
  - `getChatMessages(sessionId, limit, offset)`
- Create routes/chat-sessions.ts (4 hours)
  - POST /api/chat/sessions (create session)
  - GET /api/chat/sessions?collection_id=X (list sessions)
  - GET /api/chat/sessions/:id (get session with messages)
  - DELETE /api/chat/sessions/:id (delete session)
  - POST /api/chat/sessions/:id/messages (add message)
- Zod schemas for validation (1 hour)
  - CreateSessionSchema
  - AddMessageSchema

**Integration:** 3 hours
- Update agent route to save messages (2 hours)
  - Modify POST /api/agent/chat to accept session_id
  - Save user message to DB before processing
  - Save assistant response to DB after processing
- Testing (1 hour)
  - Test CRUD operations
  - Test pagination
  - Test cascade deletion (delete session → delete messages)

**Total Estimated Effort:** 14 hours (~3 days)

**Uncertainty:** LOW
- Standard CRUD operations
- Established patterns in codebase (collections, documents)
- No complex business logic

---

#### B2: Chat History UI (Frontend) - **MEDIUM Complexity**

**Frontend:** 10 hours
- Create ChatHistory component (4 hours)
  - Sidebar or panel layout (collapsible?)
  - Session list with infinite scroll or pagination
  - Session item: title, timestamp, message count
  - Active session highlighting
  - "New Chat" button
- Session switching logic (3 hours)
  - Load messages when session is clicked
  - Update ChatPage state with loaded messages
  - Preserve scroll position
  - Handle loading states
- Persistence (2 hours)
  - Load current session on mount (from URL param or localStorage)
  - Save current session ID to URL or localStorage
  - Handle browser refresh
- Session deletion (1 hour)
  - Delete button per session
  - Confirmation dialog
  - Optimistic update

**Integration:** 4 hours
- React Query integration (2 hours)
  - useQuery for listChatSessions
  - useQuery for getChatMessages
  - useMutation for createChatSession, deleteChatSession
  - Cache invalidation
- Loading/error states (1 hour)
  - Skeleton loaders
  - Empty states ("No chat history yet")
  - Error states with retry
- Responsive design (1 hour)
  - Mobile: Collapsible sidebar or bottom sheet
  - Desktop: Fixed sidebar

**Total Estimated Effort:** 14 hours (~3 days)

**Uncertainty:** LOW
- Standard UI patterns (sidebar, list, loading states)
- React Query is already used throughout frontend
- Can reference Dashboard.tsx for list patterns

---

#### C1: LLM Provider and Model Switcher - **HIGH Complexity**

**Frontend:** 6 hours
- Create ModelSelector component (3 hours)
  - Dropdown or select menu
  - Grouped by provider (Anthropic, Ollama)
  - Display model metadata:
    - Context window (e.g., "128K tokens")
    - Cost indicator (e.g., "$$", "$", "Free")
    - Speed indicator (e.g., "Fast", "Balanced", "Slow")
    - Capabilities (e.g., "Best for reasoning", "Best for code")
  - Current model highlighted
- Integration with CollectionView (2 hours)
  - Position selector in header or settings area
  - Load current model from collection metadata
  - Save model selection to backend
- Model list fetching (1 hour)
  - GET /api/models endpoint
  - Parse and format model metadata
  - Handle Ollama model list (dynamic)

**Backend:** 10 hours
- Create /api/models endpoint (3 hours)
  - List Anthropic models (hardcoded list with metadata)
  - List Ollama models (dynamic from GET /api/tags)
  - Format response:
    ```json
    {
      "providers": [
        {
          "name": "anthropic",
          "models": [
            {
              "id": "claude-3-7-sonnet-20250219",
              "name": "Claude 3.7 Sonnet",
              "context_window": 128000,
              "cost_tier": "medium",
              "speed_tier": "balanced",
              "capabilities": ["reasoning", "coding", "multimodal"]
            }
          ]
        },
        {
          "name": "ollama",
          "models": [...]
        }
      ]
    }
    ```
- Agent config updates (5 hours)
  - Modify buildAgentTools() to accept model parameter
  - Update runAgentChat() to use dynamic model:
    ```typescript
    const model = collection.metadata?.model ?? 'claude-3-7-sonnet-20250219';
    const response = await anthropic.messages.create({
      model,
      // ...
    });
    ```
  - Validate model name against allowed list
- Collection metadata update (2 hours)
  - Extend PATCH /api/collections/:id to accept model field
  - Store model preference in collections.metadata

**Integration:** 6 hours
- Ollama integration (3 hours)
  - Fetch model list from Ollama (GET http://localhost:11434/api/tags)
  - Parse response and extract model names
  - Handle Ollama unavailable (fallback to Anthropic only)
  - Cache model list (5-minute TTL)
- Error handling (2 hours)
  - Model not found → Fallback to default
  - Ollama model not pulled → Display error, suggest pulling
  - API key missing for provider → Disable that provider
- Testing (1 hour)
  - Test with each model
  - Test fallback scenarios
  - Test Ollama model list updates

**Total Estimated Effort:** 22 hours (~4-5 days)

**Uncertainty:** HIGH
- Ollama API may be unstable or change
- Dynamic model list requires caching strategy
- Cost/speed metadata for Ollama models is estimated, not precise
- Model validation is critical (invalid model name breaks agent)

---

#### D1: Create New Collection UI - **LOW Complexity**

**Frontend:** 4 hours
- Create CreateCollectionModal component (2 hours)
  - Modal with form (name, description fields)
  - Validation: Name required, max length 255, unique (backend validates)
  - Submit button with loading state
  - Cancel button
- Integration with Dashboard (1 hour)
  - "Create New Collection" button (prominent placement)
  - Open modal on click
  - Close modal on submit or cancel
- Success handling (1 hour)
  - Invalidate collections query (React Query)
  - Navigate to new collection view
  - Show success toast/message

**Total Estimated Effort:** 4 hours (~1 day)

**Uncertainty:** LOW
- Backend API already exists (POST /api/collections)
- Simple form with standard validation
- Can reference existing modal patterns (if any) or use simple inline form

---

#### E1: Multi-Document Upload - **MEDIUM Complexity**

**Frontend:** 8 hours
- Install react-dropzone (5 minutes)
- Create MultiFileUpload component (4 hours)
  - Drag-drop zone with visual feedback
    - Highlight on drag-over
    - Show drop affordance ("Drag files here or click to browse")
  - File picker multi-select (Ctrl+Click, Shift+Click)
  - File list with individual progress bars
    - File name, size, status (pending, uploading, complete, error)
    - Progress percentage
    - Cancel button per file
  - Overall progress summary ("3 of 5 files uploaded")
  - Partial failure handling
    - Continue uploading if one fails
    - Display error message per file
    - Allow retry for failed files
- Client-side validation (2 hours)
  - File type validation (PDF, DOCX, Markdown)
  - File size validation (<100 MB)
  - Display validation errors before upload
- Integration with UploadPage (2 hours)
  - Replace single upload with multi-upload
  - Batch API calls (upload files sequentially or in parallel?)
  - Handle responses and update UI

**Backend:** 4 hours
- Batch processing optimization (3 hours)
  - Modify POST /api/ingest to accept multiple files
  - Process files sequentially (avoid overwhelming system)
  - Return array of document IDs and statuses
  - Handle partial failures (some succeed, some fail)
- Error handling (1 hour)
  - Return detailed error per file
  - Don't fail entire batch if one file fails

**Total Estimated Effort:** 12 hours (~2-3 days)

**Uncertainty:** LOW
- react-dropzone is battle-tested
- Backend multipart plugin already supports multiple files
- Existing single upload provides foundation

---

#### F1: Document Details View - **MEDIUM Complexity**

**Frontend:** 10 hours
- Create DocumentDetailsModal component (5 hours)
  - Modal or side panel (slide-in)
  - Sections:
    - **Chunking Statistics:**
      - Total chunks
      - Average chunk size (chars and tokens)
      - Chunk overlap
      - Size distribution (optional: simple bar chart or table)
    - **Token Count:**
      - Total tokens across chunks
      - Estimated embedding cost (if paid provider)
    - **AI-Generated Summary:**
      - 2-3 sentence summary
      - Loading state if generated on-demand
      - Error state if generation fails
    - **Metadata:**
      - File size, upload date, processing status
      - Embedding provider, doc_type, language
      - Source URL (if fetched from web)
    - **Actions:**
      - Download original file
      - Re-process document (if failed)
      - Delete document (confirmation)
  - Responsive design (mobile-friendly)
- Integration with DocumentList (2 hours)
  - Make document cards clickable (or add "View Details" button)
  - Open modal on click
  - Pass document ID to modal
  - Fetch details on mount
- Loading/error states (1 hour)
- Close modal handling (1 hour)
- Download file action (1 hour)

**Backend:** 4 hours
- Create /api/documents/:id/details endpoint (2 hours)
  - Aggregate query:
    ```sql
    SELECT
      d.*,
      COUNT(c.id) as chunk_count,
      AVG(LENGTH(c.text)) as avg_chunk_size,
      SUM(c.token_count) as total_tokens
    FROM documents d
    LEFT JOIN chunks c ON c.doc_id = d.id
    WHERE d.id = $1
    GROUP BY d.id
    ```
  - Return document + stats
- AI summary generation (2 hours)
  - **Decision: On-demand or pre-computed?**
    - Recommendation: On-demand with caching
  - If summary not in metadata:
    - Generate using Claude (short prompt: "Summarize this document in 2-3 sentences")
    - Cache in documents.metadata.summary
  - Return cached summary if available

**Total Estimated Effort:** 14 hours (~3 days)

**Uncertainty:** MEDIUM
- AI summary generation adds API cost and latency
- On-demand generation requires careful caching strategy
- Could pre-compute during ingestion to avoid on-demand latency (trade-off: higher upfront cost)

---

#### F2: Document Deletion - **ALREADY IMPLEMENTED ✅**

**Status:** Complete in DocumentList.tsx (lines 29-37)

**Features:**
- ✅ Delete button per document
- ✅ Confirmation dialog (showConfirm state)
- ✅ Inline UI (Confirm/Cancel buttons)
- ✅ Loading state (isDeleting prop)
- ✅ API integration (onDelete callback)
- ✅ Error handling (handled by parent component)

**Total Estimated Effort:** 0 hours (NO WORK NEEDED)

**Optional Enhancement (Deferred to QoL):**
- Batch deletion: Add checkboxes for multi-select (see Phase 9)

---

### 4.3 Total Effort Summary

| Feature | Complexity | Frontend | Backend | Integration | Total Hours | Days (Single Dev) |
|---------|------------|----------|---------|-------------|-------------|-------------------|
| A1: Stop Button | HIGH | 6h | 10h | 4h | 20h | ~4 days |
| A2: Interrupt Agent | VERY HIGH | 4h | 16h | 6h | 26h | ~5+ days |
| B1: Chat History Backend | MEDIUM | 0h | 11h | 3h | 14h | ~3 days |
| B2: Chat History UI | MEDIUM | 10h | 0h | 4h | 14h | ~3 days |
| C1: Model Selection | HIGH | 6h | 10h | 6h | 22h | ~4-5 days |
| D1: Create Collection UI | LOW | 4h | 0h | 0h | 4h | ~1 day |
| E1: Multi-Document Upload | MEDIUM | 8h | 4h | 0h | 12h | ~2-3 days |
| F1: Document Details View | MEDIUM | 10h | 4h | 0h | 14h | ~3 days |
| F2: Document Deletion | COMPLETE | 0h | 0h | 0h | 0h | 0 days |
| **TOTAL** | | **48h** | **55h** | **23h** | **126h** | **~25-30 days** |

**With Team of 4 (Parallel Work):**
- **Week 1-2:** D1, E1, F1 (Team A) + B1 (Team B) = 30 hours
- **Week 3-4:** B2 (Team A) + A1, C1 (Team B/C) = 50 hours
- **Week 5-6:** A2 (Team D, if needed) + testing = 30 hours
- **Total:** ~3-4 weeks

---

## Phase 5: Dependency Mapping

### 5.1 Technical Dependencies

#### Dependency Graph

```
B1 (Chat History Backend)
  └──> B2 (Chat History UI) [requires B1 APIs]
       └──> Phase 12 Day 5-6 Extended

A1 (Stop Button Backend)
  └──> A2 (Interrupt Agent) [shares AbortController infrastructure]

D1 (Create Collection UI)
  └──> (No dependencies) [API exists]

E1 (Multi-Document Upload)
  └──> (No dependencies) [builds on existing upload]

F1 (Document Details View)
  └──> (No dependencies) [optional AI summary integration]

C1 (Model Selection)
  └──> (No dependencies) [integrates with agent]
```

#### Critical Path

**Longest Path:**
```
B1 (14h) → B2 (14h) → Phase 12 Day 5-6 complete
Total: 28 hours (~6 days sequential)
```

**Second Longest Path:**
```
A1 (20h) → A2 (26h)
Total: 46 hours (~9 days sequential)
```

**Impact:** B1 must be completed before B2, and B2 blocks Phase 12 Day 5-6 completion. This is the critical path for Phase 12 completion.

### 5.2 Logical Dependencies

#### User Experience Flow Dependencies

**Document Management Flow:**
```
User wants to: Upload multiple documents → View document details → Delete documents

Logical order:
1. E1 (Multi-Document Upload) - Enables bulk upload
2. F1 (Document Details View) - Inspect uploaded documents
3. F2 (already complete) - Delete if needed

Recommendation: Implement E1 before F1 for coherent UX
```

**Chat Experience Flow:**
```
User wants to: Chat with agent → Switch between conversations → Stop unwanted responses

Logical order:
1. B1 + B2 (Chat History) - Enables conversation persistence
2. A1 (Stop Button) - Adds control during conversations
3. A2 (Interrupt Agent) - Advanced control (optional)

Recommendation: Implement B1+B2 before A1, A2 can be deferred
```

**Collection Management Flow:**
```
User wants to: Create collection → Upload documents → Chat → Select best model

Logical order:
1. D1 (Create Collection UI) - Entry point for new projects
2. E1 (Multi-Document Upload) - Add content
3. B1+B2 (Chat History) - Start conversations
4. C1 (Model Selection) - Optimize per collection

Recommendation: D1 is the foundational feature, implement first
```

### 5.3 Integration Dependencies

#### Database Schema Dependencies

**Must be implemented sequentially:**
```
1. Migration 005_chat_sessions.sql (B1)
   └──> Creates chat_sessions and chat_messages tables
   └──> Required before any chat history features work

2. No other schema changes needed
   └──> C1 uses existing collections.metadata JSONB field
   └──> F1 uses aggregation queries on existing tables
```

#### API Route Dependencies

**Must exist before frontend can use them:**
```
B1 (Backend APIs)
  └──> /api/chat/sessions/* endpoints
       └──> Required by B2 (Frontend)

A1 (Backend endpoint)
  └──> /api/agent/stop endpoint
       └──> Required by A1 (Frontend stop button)

C1 (Backend endpoint)
  └──> /api/models endpoint
       └──> Required by C1 (Frontend model selector)

F1 (Backend endpoint)
  └──> /api/documents/:id/details endpoint
       └──> Required by F1 (Frontend details modal)
```

### 5.4 Parallel Work Opportunities

#### Team Structure for Parallel Development

**Team A: Frontend-Focused**
- D1 (Create Collection UI) - 1 day
- E1 (Multi-Document Upload) - 2-3 days
- F1 (Document Details View) - 3 days
- B2 (Chat History UI) - 3 days (after B1 complete)
**Total:** 9-10 days sequential, but can work on D1, E1, F1 in parallel with Team B

**Team B: Backend-Focused**
- B1 (Chat History Backend) - 3 days
- A1 (Stop Button Backend) - 4 days (can start in parallel with B1)
- C1 (Model Selection Backend) - 4-5 days (can start in parallel with B1)
**Total:** 11-12 days sequential, but B1, A1, C1 can overlap

**Team C: Agent-Focused**
- A1 (Stop Button Integration) - Part of Team B work, but agent modifications
- A2 (Interrupt Agent) - 5+ days (after A1 complete)
**Total:** 5+ days, depends on A1 completion

**Team D: QA/Integration**
- Testing throughout
- Integration testing after each phase
- Performance validation
- Documentation updates

#### Optimal Parallel Schedule

**Week 1:**
- Team A: D1 (1 day), E1 (2 days), F1 (3 days) = 6 days content
- Team B: B1 (3 days) = 3 days content
- Team C: Plan A1/A2 architecture
- **Deliverable:** D1, E1, F1, B1 complete

**Week 2:**
- Team A: B2 (3 days) = 3 days content (depends on B1)
- Team B: A1 (4 days) = 4 days content
- Team C: C1 backend (4 days) = 4 days content
- **Deliverable:** B2, A1, C1 backend complete

**Week 3:**
- Team A: C1 frontend (2 days), Phase 12 Day 5-6 (Cost Dashboard + Synthesis View, 3 days) = 5 days
- Team B: A2 (5+ days) = 5+ days content
- **Deliverable:** C1 complete, Phase 12 Day 5-6 complete, A2 in progress

**Week 4:**
- Team A/B/C: A2 completion, testing, bug fixes
- Team D: Integration testing, documentation
- **Deliverable:** All features complete, tested, documented

**Total Timeline with Parallel Work:** 3-4 weeks

---

## Phase 6: Implementation Order (Prioritized Roadmap)

### 6.1 Prioritization Criteria

1. **User Value** - How much does this improve the user experience?
2. **Technical Foundation** - Does this unblock other features?
3. **Effort/ROI** - Quick wins vs. long-term investments
4. **Risk** - Low-risk features first to build momentum
5. **Completeness** - Features that complete existing work (e.g., Phase 5.4)

### 6.2 Priority 1: Quick Wins (Weeks 1-2)

**Goal:** Deliver visible improvements early, build momentum, complete Phase 5.4

#### 1. D1: Create New Collection UI (1 day) - **IMMEDIATE START**
**Why First:**
- ✅ Lowest effort (4 hours)
- ✅ High user value (currently impossible without API knowledge)
- ✅ No dependencies (backend exists)
- ✅ Foundational feature (needed before adding documents)
- ✅ Low risk (simple form, established patterns)

**Implementation:**
- Day 1 Morning: Create CreateCollectionModal component
- Day 1 Afternoon: Integrate with Dashboard, test, deploy

#### 2. E1: Multi-Document Upload (2-3 days) - **START IMMEDIATELY**
**Why Second:**
- ✅ Directly addresses Issue #57 (Phase 5.4 incomplete)
- ✅ High user value (bulk upload is frequently requested)
- ✅ No dependencies (builds on existing single upload)
- ✅ Medium effort (12 hours)
- ✅ Low risk (react-dropzone is proven library)

**Implementation:**
- Day 2: Install react-dropzone, create MultiFileUpload component
- Day 3: Individual progress tracking, error handling
- Day 4: Backend batch optimization, testing

#### 3. F1: Document Details View (3 days) - **START AFTER E1 OR IN PARALLEL**
**Why Third:**
- ✅ Completes document management UX (inspect what you uploaded)
- ✅ High user value (transparency into processing)
- ✅ No dependencies (can parallelize with E1)
- ✅ Medium effort (14 hours)
- ✅ Medium risk (AI summary adds complexity, but can defer)

**Implementation:**
- Day 5: Create DocumentDetailsModal component
- Day 6: Backend aggregation query, integrate
- Day 7: AI summary generation (optional: defer if time-constrained)

#### 4. B1: Persistent Chat History Backend (3 days) - **START IN PARALLEL WITH D1-F1**
**Why Fourth:**
- ✅ Foundational for B2 (Phase 12 Day 5-6)
- ✅ Unblocks chat history UI
- ✅ Medium effort (14 hours)
- ✅ Low risk (standard CRUD)
- ✅ Can be developed in parallel by backend-focused developer

**Implementation:**
- Day 2-3: Database migration, query functions
- Day 4: API routes, Zod schemas
- Day 5: Integration with agent route, testing

**End of Weeks 1-2 Deliverables:**
- ✅ D1: Users can create collections via UI
- ✅ E1: Users can upload multiple documents at once
- ✅ F1: Users can inspect document details and statistics
- ✅ B1: Chat history is persisted in database
- ✅ Phase 5.4 complete (Issue #57 resolved)

### 6.3 Priority 2: User Experience Enhancements (Weeks 3-4)

**Goal:** Enhance core chat experience, add user control, provide model flexibility

#### 5. B2: Chat History UI (3 days) - **START WEEK 3**
**Why Fifth:**
- ✅ Requires B1 (completed in Priority 1)
- ✅ High user value (persistent conversations)
- ✅ Part of Phase 12 Day 5-6 (Issue #64)
- ✅ Medium effort (14 hours)
- ✅ Low risk (standard UI patterns)

**Implementation:**
- Day 8: Create ChatHistory sidebar component
- Day 9: Session switching logic, persistence
- Day 10: React Query integration, polish

#### 6. A1: Stop Button (4 days) - **START WEEK 3 OR IN PARALLEL**
**Why Sixth:**
- ✅ High user value (control over long-running responses)
- ✅ Foundational for A2 (shares cancellation infrastructure)
- ✅ High effort (20 hours)
- ✅ High risk (streaming + agent modifications)
- ✅ Can parallelize with B2 (different developers)

**Implementation:**
- Day 8-9: Frontend stop button component, API integration
- Day 10-11: Backend AbortController integration, agent cleanup logic
- Day 12: Testing cancellation scenarios, edge cases

#### 7. C1: Model Selection (4-5 days) - **START WEEK 4**
**Why Seventh:**
- ✅ High user value (power user feature, cost optimization)
- ✅ No dependencies (can start anytime)
- ✅ High effort (22 hours)
- ✅ High risk (Ollama integration, dynamic model list)
- ✅ Complex but independent (can be tackled by dedicated developer)

**Implementation:**
- Day 13-14: Frontend ModelSelector component, model list fetching
- Day 15-16: Backend /api/models endpoint, agent config updates
- Day 17: Ollama integration, error handling, testing

**End of Weeks 3-4 Deliverables:**
- ✅ B2: Users can view and switch between chat sessions
- ✅ A1: Users can stop agent responses mid-generation
- ✅ C1: Users can select different LLM models per collection
- ✅ Phase 12 Day 5-6 nearly complete (only Cost Dashboard + Synthesis View remain)

### 6.4 Priority 3: Advanced Features (Weeks 5-6)

**Goal:** Implement advanced features with high complexity

#### 8. A2: Interrupt Agent (5+ days) - **START WEEK 5 (OPTIONAL)**
**Why Last:**
- ⚠️ Very high complexity (26 hours)
- ⚠️ Very high risk (agent loop redesign, race conditions)
- ⚠️ Lower user value compared to other features (nice-to-have, not critical)
- ⚠️ High uncertainty (may impact performance, difficult to test)
- ⚠️ Requires A1 complete (shares cancellation infrastructure)

**Implementation:**
- Day 18-20: Agent loop modification for message injection
- Day 21-22: State management, race condition handling
- Day 23: Testing complex scenarios, message ordering validation

**Recommendation: DEFER IF TIME-CONSTRAINED**
- A2 is the most complex feature with the highest risk
- Consider implementing as "experimental" feature flag
- Can be deferred to Phase 19 or later if team prefers
- Focus on stabilizing A1, B2, C1 first

**End of Weeks 5-6 Deliverables (if A2 implemented):**
- ✅ A2: Users can interrupt agent with new messages mid-processing
- ✅ All Priority 1-3 features complete
- ✅ Phase 16, 17, 18 complete

**Alternative: Skip A2, focus on stabilization and testing**
- Week 5-6: Integration testing, bug fixes, performance optimization
- Prepare for Phase 12 Day 5-6 frontend updates (Cost Dashboard + Synthesis View)
- Documentation updates, user testing

### 6.5 Phase 12 Day 5-6 Completion (After B2)

**Remaining Work:**
1. **Cost Monitoring Dashboard** (10-14 hours)
   - Already specified in 08_FRONTEND_UPDATES.md
   - Components: CostDashboard, CostSummary, CostBreakdown, BudgetAlerts
   - API integration: `/api/costs/*` (already exists)

2. **Document Synthesis View** (6-8 hours)
   - Already specified in 08_FRONTEND_UPDATES.md
   - Components: SynthesisView, ApproachCard, ConflictsList
   - API integration: `/api/synthesis/compare` (already exists)

**Total:** 16-22 hours (3-4 days)

**Schedule:**
- Can be implemented in parallel with A1 or C1
- Or after B2 complete, before A2
- **Recommendation:** Week 3 or 4, in parallel with A1/C1

---

## Phase 7: Technical Considerations

### 7.1 Database Schema Changes

#### Migration 005: Chat Sessions

**File:** `packages/db/migrations/005_chat_sessions.sql`

```sql
-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create chat_sessions table
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create chat_messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX chat_sessions_collection_idx ON chat_sessions(collection_id);
CREATE INDEX chat_sessions_created_idx ON chat_sessions(created_at DESC);
CREATE INDEX chat_messages_session_idx ON chat_messages(session_id);
CREATE INDEX chat_messages_created_idx ON chat_messages(created_at);

-- Comments
COMMENT ON TABLE chat_sessions IS 'Persistent chat sessions for each collection';
COMMENT ON TABLE chat_messages IS 'Individual messages within chat sessions';
COMMENT ON COLUMN chat_sessions.title IS 'Auto-generated or user-provided session title';
COMMENT ON COLUMN chat_messages.role IS 'Message role: user, assistant, or system';
COMMENT ON COLUMN chat_messages.tool_calls IS 'JSON array of tool calls made by assistant';
```

**Rollback:** `packages/db/migrations/005_down.sql`

```sql
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;
```

#### No Other Schema Changes Needed

**C1 (Model Selection):** Uses existing `collections.metadata` JSONB field
```json
{
  "model": "claude-3-7-sonnet-20250219",
  "model_provider": "anthropic"
}
```

**F1 (Document Details):** Uses aggregation queries on existing tables
```sql
SELECT
  d.*,
  COUNT(c.id) as chunk_count,
  AVG(LENGTH(c.text)) as avg_chunk_size,
  SUM(c.token_count) as total_tokens,
  d.metadata->>'summary' as summary
FROM documents d
LEFT JOIN chunks c ON c.doc_id = d.id
WHERE d.id = $1
GROUP BY d.id
```

### 7.2 New API Routes

#### B1: Chat Session Management

```typescript
// File: apps/server/src/routes/chat-sessions.ts

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  createChatSession,
  getChatSession,
  listChatSessions,
  deleteChatSession,
  addChatMessage,
  getChatMessages,
} from '@synthesis/db';

const CreateSessionSchema = z.object({
  collection_id: z.string().uuid(),
  title: z.string().max(255).optional(),
});

const AddMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
  tool_calls: z.array(z.any()).optional(),
});

const ListSessionsSchema = z.object({
  collection_id: z.string().uuid(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

export const chatSessionRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/chat/sessions - Create new session
  fastify.post('/api/chat/sessions', async (request, reply) => {
    const validation = CreateSessionSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send({
        error: 'INVALID_INPUT',
        details: validation.error.issues,
      });
    }

    const { collection_id, title } = validation.data;
    
    try {
      const session = await createChatSession(collection_id, title);
      return reply.code(201).send({ session });
    } catch (error) {
      fastify.log.error(error, 'Failed to create chat session');
      return reply.code(500).send({ error: 'Failed to create chat session' });
    }
  });

  // GET /api/chat/sessions?collection_id=X - List sessions
  fastify.get('/api/chat/sessions', async (request, reply) => {
    const validation = ListSessionsSchema.safeParse(request.query);
    if (!validation.success) {
      return reply.code(400).send({
        error: 'INVALID_INPUT',
        details: validation.error.issues,
      });
    }

    const { collection_id, limit = 50, offset = 0 } = validation.data;
    
    try {
      const sessions = await listChatSessions(collection_id, limit, offset);
      return reply.send({ sessions });
    } catch (error) {
      fastify.log.error(error, 'Failed to list chat sessions');
      return reply.code(500).send({ error: 'Failed to list chat sessions' });
    }
  });

  // GET /api/chat/sessions/:id - Get session with messages
  fastify.get<{ Params: { id: string } }>('/api/chat/sessions/:id', async (request, reply) => {
    const { id } = request.params;
    
    try {
      const session = await getChatSession(id);
      if (!session) {
        return reply.code(404).send({ error: 'Session not found' });
      }
      
      const messages = await getChatMessages(id);
      return reply.send({ session, messages });
    } catch (error) {
      fastify.log.error(error, 'Failed to get chat session');
      return reply.code(500).send({ error: 'Failed to get chat session' });
    }
  });

  // DELETE /api/chat/sessions/:id - Delete session
  fastify.delete<{ Params: { id: string } }>('/api/chat/sessions/:id', async (request, reply) => {
    const { id } = request.params;
    
    try {
      await deleteChatSession(id);
      return reply.send({ message: 'Session deleted successfully' });
    } catch (error) {
      fastify.log.error(error, 'Failed to delete chat session');
      return reply.code(500).send({ error: 'Failed to delete chat session' });
    }
  });

  // POST /api/chat/sessions/:id/messages - Add message to session
  fastify.post<{ Params: { id: string } }>('/api/chat/sessions/:id/messages', async (request, reply) => {
    const { id } = request.params;
    const validation = AddMessageSchema.safeParse(request.body);
    
    if (!validation.success) {
      return reply.code(400).send({
        error: 'INVALID_INPUT',
        details: validation.error.issues,
      });
    }

    const { role, content, tool_calls } = validation.data;
    
    try {
      const message = await addChatMessage(id, role, content, tool_calls);
      return reply.code(201).send({ message });
    } catch (error) {
      fastify.log.error(error, 'Failed to add message');
      return reply.code(500).send({ error: 'Failed to add message' });
    }
  });
};
```

#### A1: Agent Cancellation

```typescript
// File: apps/server/src/routes/agent.ts (extend existing)

// Add AbortController map at module level
const activeRequests = new Map<string, AbortController>();

// Extend POST /api/agent/chat
fastify.post('/api/agent/chat', async (request, reply) => {
  // ... existing validation ...
  
  // Create AbortController for this request
  const requestId = crypto.randomUUID();
  const abortController = new AbortController();
  activeRequests.set(requestId, abortController);
  
  // Clean up on disconnect
  request.raw.on('close', () => {
    abortController.abort();
    activeRequests.delete(requestId);
  });
  
  try {
    // Pass signal to agent (need to modify runAgentChat to accept signal)
    const result = await runAgentChat(db, {
      message: body.message,
      collectionId: body.collection_id,
      history: body.history,
      signal: abortController.signal, // NEW
    });
    
    activeRequests.delete(requestId);
    return reply.send(result);
  } catch (error) {
    activeRequests.delete(requestId);
    
    if (error.name === 'AbortError') {
      return reply.code(499).send({ error: 'Request cancelled by user' });
    }
    
    // ... existing error handling ...
  }
});

// NEW: POST /api/agent/stop
fastify.post('/api/agent/stop', async (request, reply) => {
  const { request_id } = request.body;
  
  if (!request_id) {
    return reply.code(400).send({ error: 'request_id required' });
  }
  
  const abortController = activeRequests.get(request_id);
  if (!abortController) {
    return reply.code(404).send({ error: 'Request not found or already completed' });
  }
  
  abortController.abort();
  activeRequests.delete(request_id);
  
  return reply.send({ message: 'Request cancelled successfully' });
});
```

#### C1: Model Selection

```typescript
// File: apps/server/src/routes/models.ts (NEW)

import type { FastifyPluginAsync } from 'fastify';

export const modelRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/models - List available models
  fastify.get('/api/models', async (request, reply) => {
    try {
      const providers = [];
      
      // Anthropic models (hardcoded list)
      providers.push({
        name: 'anthropic',
        models: [
          {
            id: 'claude-3-7-sonnet-20250219',
            name: 'Claude 3.7 Sonnet',
            context_window: 128000,
            cost_tier: 'medium',
            speed_tier: 'balanced',
            capabilities: ['reasoning', 'coding', 'multimodal'],
          },
          {
            id: 'claude-3-5-sonnet-20241022',
            name: 'Claude 3.5 Sonnet',
            context_window: 200000,
            cost_tier: 'medium',
            speed_tier: 'fast',
            capabilities: ['reasoning', 'coding'],
          },
          {
            id: 'claude-3-5-haiku-20241022',
            name: 'Claude 3.5 Haiku',
            context_window: 200000,
            cost_tier: 'low',
            speed_tier: 'fastest',
            capabilities: ['speed', 'reasoning'],
          },
        ],
      });
      
      // Ollama models (dynamic fetch)
      try {
        const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        const response = await fetch(`${ollamaUrl}/api/tags`);
        if (response.ok) {
          const data = await response.json();
          providers.push({
            name: 'ollama',
            models: data.models.map((m: any) => ({
              id: m.name,
              name: m.name,
              context_window: 128000, // Estimate (varies by model)
              cost_tier: 'free',
              speed_tier: 'fast',
              capabilities: ['local', 'privacy'],
            })),
          });
        }
      } catch (error) {
        fastify.log.warn('Ollama not available, skipping');
      }
      
      return reply.send({ providers });
    } catch (error) {
      fastify.log.error(error, 'Failed to list models');
      return reply.code(500).send({ error: 'Failed to list models' });
    }
  });
};
```

#### F1: Document Details

```typescript
// File: apps/server/src/routes/document-details.ts (NEW) or extend existing documents route

fastify.get<{ Params: { id: string } }>('/api/documents/:id/details', async (request, reply) => {
  const { id } = request.params;
  
  try {
    // Aggregation query
    const { rows } = await db.query(`
      SELECT
        d.*,
        COUNT(c.id)::int as chunk_count,
        AVG(LENGTH(c.text))::int as avg_chunk_size,
        SUM(c.token_count)::int as total_tokens,
        d.metadata->>'summary' as summary,
        d.metadata->>'embedding_provider' as embedding_provider,
        d.metadata->>'doc_type' as doc_type,
        d.metadata->>'language' as language
      FROM documents d
      LEFT JOIN chunks c ON c.doc_id = d.id
      WHERE d.id = $1
      GROUP BY d.id
    `, [id]);
    
    if (rows.length === 0) {
      return reply.code(404).send({ error: 'Document not found' });
    }
    
    const doc = rows[0];
    
    // Generate summary if not cached
    if (!doc.summary && doc.status === 'complete') {
      try {
        const summary = await generateDocumentSummary(doc.id);
        doc.summary = summary;
        
        // Cache summary in metadata
        await db.query(`
          UPDATE documents
          SET metadata = jsonb_set(metadata, '{summary}', $1)
          WHERE id = $2
        `, [JSON.stringify(summary), doc.id]);
      } catch (error) {
        fastify.log.error(error, 'Failed to generate summary');
        doc.summary = 'Summary generation failed';
      }
    }
    
    return reply.send({ document: doc });
  } catch (error) {
    fastify.log.error(error, 'Failed to get document details');
    return reply.code(500).send({ error: 'Failed to get document details' });
  }
});
```

### 7.3 New Services/Modules

#### Backend Services

**File:** `apps/server/src/services/chat-session-manager.ts`
```typescript
// Wrapper service for chat session operations
// Provides higher-level abstractions over raw queries
// Example: createSessionWithFirstMessage(collectionId, userMessage)
```

**File:** `apps/server/src/services/model-manager.ts`
```typescript
// Model configuration and validation
// Functions:
// - listAvailableModels() - Fetch from Anthropic + Ollama
// - validateModelName(modelName) - Check against allowed list
// - getModelMetadata(modelName) - Return cost, speed, capabilities
```

**File:** `apps/server/src/services/document-summary.ts`
```typescript
// AI-generated document summaries
// Functions:
// - generateSummary(documentId) - Use Claude to summarize
// - cacheSummary(documentId, summary) - Store in metadata
```

#### Frontend Components

**File:** `apps/web/src/components/ChatHistory.tsx`
```typescript
// Sidebar component for chat session list
// Features:
// - Session list with infinite scroll
// - Session item: title, timestamp, message count
// - "New Chat" button
// - Active session highlighting
```

**File:** `apps/web/src/components/ModelSelector.tsx`
```typescript
// Dropdown for model selection
// Features:
// - Grouped by provider (Anthropic, Ollama)
// - Display model metadata (context window, cost, speed)
// - Current model highlighted
// - Save selection to collection metadata
```

**File:** `apps/web/src/components/CreateCollectionModal.tsx`
```typescript
// Modal for creating new collection
// Features:
// - Form with name and description fields
// - Validation (name required, max length)
// - Submit with loading state
// - Error handling
```

**File:** `apps/web/src/components/MultiFileUpload.tsx`
```typescript
// Multi-file upload with drag-drop
// Features:
// - react-dropzone integration
// - Drag-drop zone with visual feedback
// - File list with individual progress bars
// - Partial failure handling
// - Retry for failed files
```

**File:** `apps/web/src/components/DocumentDetailsModal.tsx`
```typescript
// Modal for document details
// Sections:
// - Chunking statistics
// - Token count and cost
// - AI-generated summary
// - Metadata
// - Actions (download, re-process, delete)
```

### 7.4 Dependencies/Libraries

#### New Frontend Dependencies

```bash
# Multi-file upload
pnpm add react-dropzone

# Optional: Animations for modals/transitions
pnpm add framer-motion
```

#### No New Backend Dependencies
- All features use existing infrastructure:
  - Fastify (HTTP server)
  - Zod (validation)
  - pg (PostgreSQL client)
  - Anthropic SDK (agent + summary generation)
  - Existing multipart plugin (file uploads)

### 7.5 Performance Considerations

#### Chat History Pagination
**Challenge:** Sessions with 100+ messages will slow down UI

**Solution: Cursor-based pagination**
```typescript
// API: GET /api/chat/sessions/:id/messages?limit=100&cursor=<timestamp>
// Returns: { messages: [...], next_cursor: "2025-01-15T10:00:00Z" }

// Frontend: Infinite scroll or "Load More" button
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['messages', sessionId],
  queryFn: ({ pageParam }) => 
    apiClient.fetchMessages(sessionId, { cursor: pageParam }),
  getNextPageParam: (lastPage) => lastPage.next_cursor,
});
```

#### Model Selection Caching
**Challenge:** Ollama model list may change frequently

**Solution: Cache with TTL**
```typescript
// Cache model list for 5 minutes
let modelCache: { providers: any[]; timestamp: number } | null = null;

async function listModels() {
  const now = Date.now();
  const cacheAge = modelCache ? now - modelCache.timestamp : Infinity;
  
  if (cacheAge < 5 * 60 * 1000) {
    return modelCache!.providers;
  }
  
  // Fetch fresh list
  const providers = await fetchProvidersFromAPIs();
  modelCache = { providers, timestamp: now };
  return providers;
}
```

#### Document Summary Generation
**Challenge:** Generating summaries on-demand adds latency (2-5 seconds)

**Solution: Cache in metadata + background generation**
```typescript
// Option 1: On-demand with caching (recommended)
if (!doc.metadata?.summary) {
  const summary = await generateSummary(doc.id);
  await cacheInMetadata(doc.id, { summary });
}

// Option 2: Background generation (future enhancement)
// Generate summaries during ingestion, after chunks are created
// Store in metadata immediately
// No on-demand latency, but higher upfront cost
```

#### Multi-File Upload Performance
**Challenge:** Uploading 10+ files simultaneously may overwhelm server

**Solution: Sequential or limited concurrency**
```typescript
// Sequential (simpler, slower)
for (const file of files) {
  await uploadFile(file);
}

// Limited concurrency (better UX)
const MAX_CONCURRENT = 3;
const queue = [...files];
const inProgress = new Set();

while (queue.length > 0 || inProgress.size > 0) {
  while (inProgress.size < MAX_CONCURRENT && queue.length > 0) {
    const file = queue.shift()!;
    const promise = uploadFile(file).finally(() => inProgress.delete(promise));
    inProgress.add(promise);
  }
  await Promise.race(inProgress);
}
```

### 7.6 Security Considerations

#### Chat History Access Control
**Requirement:** Users should only see their own chat sessions

**Implementation:**
```typescript
// Option 1: Collection-scoped access (current architecture)
// Chat sessions are tied to collections
// If user has access to collection, they can see its chat history
// No additional auth needed (same as current collection access)

// Option 2: User-scoped access (future enhancement)
// Add user_id to chat_sessions table
// Validate user owns collection before returning sessions
// Requires authentication system (not in scope)
```

#### Model Selection Validation
**Requirement:** Prevent injection of invalid model names

**Implementation:**
```typescript
// Validate against allowed list
const ALLOWED_MODELS = {
  anthropic: [
    'claude-3-7-sonnet-20250219',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
  ],
  ollama: [], // Dynamic, but validate format
};

function validateModelName(provider: string, modelName: string): boolean {
  if (provider === 'anthropic') {
    return ALLOWED_MODELS.anthropic.includes(modelName);
  }
  
  if (provider === 'ollama') {
    // Validate format: name:tag or just name
    return /^[a-zA-Z0-9._-]+(:[a-zA-Z0-9._-]+)?$/.test(modelName);
  }
  
  return false;
}
```

#### File Upload Validation
**Requirement:** Existing validation should be maintained

**Current Implementation:**
```typescript
// Multipart plugin config
await fastify.register(multipart, {
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

// MIME type validation in ingest route
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
  'text/plain',
];
```

**No changes needed** - Multi-file upload reuses existing validation

#### Agent Cancellation Security
**Requirement:** Prevent cancellation of other users' requests

**Implementation:**
```typescript
// Store request_id in client (not user-provided)
// Option 1: Return request_id from POST /api/agent/chat
// Option 2: Use session-based tracking (if auth exists)

// For MVP (no auth): request_id is opaque UUID
// Attacker cannot guess other users' request IDs
```

---

## Phase 8: Open Questions & Decisions Needed

### Decision 1: Model Selection Scope
**Question:** Should model selection be per-collection or global?

**Options:**

**Option A: Per-Collection**
- **Pros:**
  - Power users can optimize per use case (e.g., Claude Opus for complex code analysis, llama3.2:3b for personal notes)
  - Different projects have different needs (cost vs. quality trade-off)
  - Aligns with collection-scoped architecture
- **Cons:**
  - More complex UI (need to show model per collection, not just global setting)
  - Users might forget which model they selected for which collection
- **Implementation:**
  - Store in `collections.metadata.model` JSONB field
  - Display in CollectionView header or settings area
  - API: PATCH /api/collections/:id with model field

**Option B: Global (User Preference)**
- **Pros:**
  - Simpler UX (one setting, applies everywhere)
  - Less cognitive load (don't need to remember per-collection settings)
- **Cons:**
  - Less flexible (can't optimize per project type)
  - Requires authentication system to store user preferences (not currently implemented)
- **Implementation:**
  - Store in localStorage (temporary) or user_preferences table (requires auth)
  - Display in global settings or header
  - Applies to all agent interactions

**Option C: Hybrid (Global Default + Per-Collection Override)**
- **Pros:**
  - Best of both worlds (default for simplicity, override for power users)
  - Progressive disclosure (most users use default, advanced users customize)
- **Cons:**
  - Most complex to implement and explain
  - UI needs to clearly show "Using default model" vs. "Using custom model"
- **Implementation:**
  - Global default in localStorage (or eventually user_preferences table)
  - Per-collection override in collections.metadata.model
  - UI shows "Model: [Current Model] (Default)" or "Model: [Custom Model]"

**Recommendation: Option A (Per-Collection) ✅**
- **Rationale:**
  - Aligns with existing collection-scoped architecture
  - No authentication system required
  - Power users (likely target audience) will appreciate flexibility
  - Can add global default later as enhancement (progressive disclosure)
- **Implementation Decision:** Store in `collections.metadata.model`

---

### Decision 2: Chat Session Titles
**Question:** Auto-generated only, or allow user editing?

**Options:**

**Option A: Auto-Generated Only**
- **Generation Logic:** First user message, truncated to 40-50 characters
- **Pros:**
  - Simpler implementation (no edit UI needed)
  - Automatic, no user action required
  - Works well for most cases ("How do I..." → "How do I implement auth...")
- **Cons:**
  - Generic titles if user asks short questions ("help" → "help")
  - No personalization (user might want to name important sessions)
- **Implementation:**
  - Generate title in `createChatSession()` if not provided
  - Store in `chat_sessions.title` field

**Option B: User-Editable**
- **Editing:** Inline edit on double-click, or "Rename" button
- **Pros:**
  - Full control for power users
  - Personalization (e.g., "Project X Auth Implementation")
  - Can fix generic auto-generated titles
- **Cons:**
  - More complex UI (edit mode, validation, save/cancel)
  - Requires additional API endpoint (PATCH /api/chat/sessions/:id)
- **Implementation:**
  - Auto-generate initially
  - Add edit icon next to title in ChatHistory sidebar
  - API: PATCH /api/chat/sessions/:id with { title: "New Title" }

**Option C: Hybrid (Auto-Generated + Optional Edit)**
- **Default:** Auto-generate from first message
- **Optional:** User can edit later if desired
- **Pros:**
  - Best UX (automatic for most, editable for power users)
  - Progressive disclosure (edit is hidden until needed)
- **Cons:**
  - Requires edit UI implementation
- **Implementation:**
  - Same as Option B, but emphasize auto-generation as default

**Recommendation: Option A (Auto-Generated Only) ✅ for MVP, Option C for enhancement**
- **Rationale:**
  - Auto-generated titles work well for 90% of cases
  - Simplifies MVP implementation (no edit UI needed)
  - Can add edit capability later based on user feedback
  - Focus on core functionality first (persistence, switching), enhancements later
- **Implementation Decision:** Generate from first user message (truncated to 50 chars)
- **Future Enhancement:** Add "Rename" button in Session v2 (Phase 19+)

---

### Decision 3: Document Summary Generation
**Question:** Generate on-demand when user opens details, or pre-compute during ingestion?

**Options:**

**Option A: On-Demand (Recommended)**
- **Flow:** User clicks "View Details" → Check metadata → If no summary, generate → Cache → Display
- **Pros:**
  - Saves API costs (only generate when needed)
  - Faster ingestion (no summary generation overhead)
  - Defers cost until user confirms they want the feature
- **Cons:**
  - Slower first-time UX (2-5 second wait for summary generation)
  - Requires loading state in UI
- **Implementation:**
  - Check `documents.metadata.summary` on details request
  - If null, call Anthropic API to generate summary
  - Store in metadata, return to frontend
  - Subsequent opens are instant (cached)

**Option B: Pre-Compute During Ingestion**
- **Flow:** Upload → Extract → Chunk → Embed → **Generate Summary** → Complete
- **Pros:**
  - Instant UX (summary already available when user opens details)
  - No on-demand latency
  - Consistent user experience
- **Cons:**
  - Higher upfront cost (generate summaries for all documents, even if never viewed)
  - Slower ingestion (adds 2-5 seconds per document)
  - Wastes API calls on documents users never inspect
- **Implementation:**
  - Add summary generation step to ingestion pipeline
  - Store in `documents.metadata.summary` immediately
  - No on-demand generation needed

**Option C: Background Generation (Async)**
- **Flow:** Upload → Complete → **Background job generates summary** → Update metadata
- **Pros:**
  - Fast ingestion (no blocking)
  - Summaries eventually available (1-2 minutes after upload)
  - Saves costs if user doesn't wait
- **Cons:**
  - Requires background job queue (BullMQ, Redis, etc.) - significant complexity
  - Inconsistent UX (sometimes available, sometimes not)
  - Overhead of job queue infrastructure
- **Implementation:**
  - Add background job queue system
  - Enqueue summary generation after ingestion completes
  - Poll or use websockets to update UI when ready

**Recommendation: Option A (On-Demand with Caching) ✅**
- **Rationale:**
  - Balances cost and UX (only pay for what users view)
  - Simpler than background jobs (no new infrastructure)
  - Caching makes subsequent opens instant
  - Can upgrade to Option B later if cost is acceptable
- **Implementation Decision:** Generate on-demand, cache in `documents.metadata.summary`
- **UX:** Show loading spinner ("Generating summary..."), then display

---

### Decision 4: Chat History Pagination
**Question:** What pagination strategy and page size?

**Options:**

**Option A: Offset Pagination (Simple)**
- **Strategy:** `LIMIT N OFFSET M`
- **Page Size:** 50 messages per page
- **Pros:**
  - Simple to implement (standard SQL)
  - Easy to understand ("Page 1, 2, 3...")
- **Cons:**
  - Performance degrades with large offsets (OFFSET 10000 is slow)
  - Inconsistent results if data changes during pagination
- **Implementation:**
  ```sql
  SELECT * FROM chat_messages
  WHERE session_id = $1
  ORDER BY created_at
  LIMIT $2 OFFSET $3
  ```

**Option B: Cursor-Based Pagination (Efficient)**
- **Strategy:** `WHERE created_at > $cursor ORDER BY created_at LIMIT N`
- **Page Size:** 100 messages per page
- **Pros:**
  - Efficient at any scale (uses index)
  - Consistent results (cursor is stable)
  - Industry standard for chat applications
- **Cons:**
  - Slightly more complex (need to return next cursor)
  - Can't jump to arbitrary page (must load sequentially)
- **Implementation:**
  ```sql
  SELECT * FROM chat_messages
  WHERE session_id = $1 AND created_at > $2
  ORDER BY created_at
  LIMIT $3
  ```
  Response: `{ messages: [...], next_cursor: "2025-01-15T10:00:00Z" }`

**Option C: Load All (No Pagination)**
- **Strategy:** Load all messages for a session at once
- **Pros:**
  - Simplest implementation
  - No pagination UI needed
- **Cons:**
  - Performance issues with 100+ message sessions
  - Slow initial load
  - High memory usage
- **Suitable for:** MVP if sessions are expected to stay small (<100 messages)

**Recommendation: Option B (Cursor-Based, 100 messages per page) ✅**
- **Rationale:**
  - Efficient and scalable (handles 1000+ message sessions)
  - Standard practice for chat UIs (WhatsApp, Slack, Discord)
  - Indexed on `created_at` (already planned in migration)
  - Slightly more complex, but worth it for performance
- **Implementation Decision:** Cursor-based with `created_at` timestamp
- **Frontend:** Infinite scroll or "Load More" button (load older messages)

---

### Decision 5: Agent Interruption Strategy
**Question:** When user sends new message while agent is processing, abort immediately or complete current tool?

**Options:**

**Option A: Abort Immediately**
- **Behavior:** Cancel all in-flight tool calls, discard partial results, start fresh with new message
- **Pros:**
  - User expects instant response (clicked "Send" means "stop what you're doing")
  - Simpler state management (no partial results to handle)
  - Faster to implement (use AbortController.abort())
- **Cons:**
  - Wasted work if tool was 90% complete
  - Potential state corruption if tool had side effects (e.g., partial DB write)
- **Implementation:**
  - Abort all in-progress anthropic.messages.create() calls
  - Clear tool execution queue
  - Start new agent loop with new message

**Option B: Complete Current Tool, Then Abort**
- **Behavior:** Let current tool finish, then cancel subsequent tools, incorporate new message
- **Pros:**
  - Cleaner state (tool completes successfully, no partial results)
  - Less wasted work (if tool is almost done)
  - Avoids potential corruption from half-completed operations
- **Cons:**
  - Slightly delayed response (wait for current tool)
  - More complex state management (need to track which tool is in progress)
- **Implementation:**
  - Mark agent loop for interruption
  - Let current `executor()` complete
  - After tool result, inject new message instead of continuing loop
  - Respond to user with updated context

**Option C: Smart Interruption (Context-Dependent)**
- **Behavior:** If tool is "cancellable" (search, fetch), abort immediately. If tool is "critical" (document creation), complete first.
- **Pros:**
  - Best UX (instant for safe operations, clean for critical ones)
  - Prevents data corruption
- **Cons:**
  - Most complex (need to categorize tools as cancellable/critical)
  - Implementation overhead
- **Implementation:**
  - Add `cancellable: boolean` property to tool definitions
  - Check property before aborting
  - For cancellable tools: abort immediately
  - For critical tools: complete, then abort

**Recommendation: Option A (Abort Immediately) ✅ for MVP, Option C for enhancement**
- **Rationale:**
  - User expectation is "stop now" when they send a new message
  - Simpler to implement and reason about
  - Current tools are mostly read-only (search, list, fetch) - safe to abort
  - Can upgrade to Option C later if needed
- **Implementation:**
  - Abort all in-progress anthropic.messages.create() calls and clear the execution queue before starting a fresh loop for the new message.
  - Route every tool invocation through a safe `executeWithCommit()` wrapper that commits or checkpoints writes for critical tools, logs partial results for debugging, checks `AbortController.signal` only after commit/checkpoint succeeds, and throws a controlled `AbortError` if cancellation is requested.
  - Extend tool metadata with `hasWriteOperations: boolean` so the agent can identify stateful tools and force the wrapper to run commit logic for them.
  - Require each tool with `hasWriteOperations: true` to implement idempotent or transactional write behavior and to expose a commit/checkpoint hook the wrapper can invoke.
- **Safeguards:**
  - Enforce idempotency or transactional guarantees for every write-capable tool so aborted reruns do not corrupt state.
  - Ensure writes are fully committed or checkpointed before the agent re-checks `AbortController.signal`, preventing half-applied changes.
  - Persist partial results and debug breadcrumbs for cancelled executions to simplify post-mortem analysis.

**Interrupt Checklist:**
- [ ] Tool writes are idempotent or wrapped in a transaction.
- [ ] Commit/checkpoint hook completes before checking `AbortController.signal`.
- [ ] Partial-result and debug logs captured for each tool invocation.
- [ ] `hasWriteOperations` metadata populated for every tool.

---

### Decision 6: Multi-File Upload Concurrency
**Question:** Upload files sequentially or in parallel? How many concurrent uploads?

**Options:**

**Option A: Sequential (One at a Time)**
- **Behavior:** Upload file 1 → Complete → Upload file 2 → Complete → ...
- **Pros:**
  - Simple to implement (no concurrency logic)
  - Predictable (clear order)
  - No risk of overwhelming server
- **Cons:**
  - Slow for multiple large files (10 files × 30 seconds = 5 minutes)
  - Poor UX (user waits for each file)
- **Implementation:**
  ```typescript
  for (const file of files) {
    await uploadFile(file);
  }
  ```

**Option B: Fully Parallel (All at Once)**
- **Behavior:** Upload all files simultaneously
- **Pros:**
  - Fastest possible (limited only by bandwidth)
  - Best UX for small files
- **Cons:**
  - May overwhelm server (10 concurrent multipart uploads)
  - High memory usage on server
  - Network congestion if files are large
- **Implementation:**
  ```typescript
  await Promise.all(files.map(uploadFile));
  ```

**Option C: Limited Concurrency (3-5 at a Time)**
- **Behavior:** Upload 3 files concurrently, as each completes, start next
- **Pros:**
  - Balanced (faster than sequential, safer than fully parallel)
  - Server-friendly (controlled load)
  - Good UX (progress visible, not too slow)
- **Cons:**
  - More complex logic (concurrency queue)
- **Implementation:**
  ```typescript
  const MAX_CONCURRENT = 3;
  const queue = [...files];
  const inProgress = new Set();

  while (queue.length > 0 || inProgress.size > 0) {
    while (inProgress.size < MAX_CONCURRENT && queue.length > 0) {
      const file = queue.shift()!;
      const promise = uploadFile(file).finally(() => inProgress.delete(promise));
      inProgress.add(promise);
    }
    await Promise.race(inProgress);
  }
  ```

**Recommendation: Option C (Limited Concurrency, 3 concurrent) ✅**
- **Rationale:**
  - Balances speed and server safety
  - Industry standard (most upload libraries use 2-5 concurrent)
  - Good UX (faster than sequential, not overwhelming)
  - Controlled memory usage on server
- **Implementation Decision:** Upload 3 files concurrently, queue remaining

---

## Phase 9: Suggested Quality-of-Life Improvements (OPTIONAL)

**All items in this section are marked as SUGGESTIONS and NOT required for core implementation.**

### SUGGESTION 1: Export Chat History
**Description:** Allow users to export chat sessions as JSON or Markdown

**Use Case:**
- Backup important conversations
- Share insights with team members
- Analyze conversation patterns offline

**Implementation:**
```typescript
// File: apps/web/src/components/ChatHistory.tsx
// Add "Export" button to each session

function exportSessionAsMarkdown(session: ChatSession, messages: ChatMessage[]) {
  const markdown = `# ${session.title}\n\n` +
    messages.map(msg => 
      `**${msg.role}:** ${msg.content}\n\n`
    ).join('');
  
  downloadFile(`${session.title}.md`, markdown);
}

function exportSessionAsJSON(session: ChatSession, messages: ChatMessage[]) {
  const json = JSON.stringify({ session, messages }, null, 2);
  downloadFile(`${session.title}.json`, json);
}
```

**Complexity:** LOW (2 hours)
- Frontend: Export buttons + download logic (1 hour)
- No backend changes needed (use existing GET /api/chat/sessions/:id)
- Testing: Verify export formats (1 hour)

**Value:** HIGH (backup, sharing, analysis)

**Priority:** MEDIUM - Nice-to-have for power users

---

### SUGGESTION 2: Keyboard Shortcuts
**Description:** Add common keyboard shortcuts for efficiency

**Shortcuts:**
- **Ctrl+K (Cmd+K):** New chat session
- **Ctrl+/:** Focus search (if search is added)
- **Ctrl+Enter:** Send message
- **Escape:** Close modal
- **Ctrl+1, Ctrl+2, ...:** Switch between recent sessions

**Implementation:**
```typescript
// File: apps/web/src/hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';

export function useKeyboardShortcuts(handlers: Record<string, () => void>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = `${e.ctrlKey || e.metaKey ? 'Ctrl+' : ''}${e.key}`;
      
      if (handlers[key]) {
        e.preventDefault();
        handlers[key]();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}

// Usage in ChatPage.tsx
useKeyboardShortcuts({
  'Ctrl+k': () => createNewSession(),
  'Ctrl+Enter': () => sendMessage(),
  'Escape': () => closeModal(),
});
```

**Complexity:** LOW (4 hours)
- Hook implementation: 1 hour
- Integration across pages: 2 hours
- Testing: 1 hour

**Value:** MEDIUM (power user feature, improves efficiency)

**Priority:** LOW - Enhancement for frequent users

---

### SUGGESTION 3: Document Tags
**Description:** Add manual tagging to documents for better organization

**Use Case:**
- Tag documents by project, feature, or topic ("auth", "API", "frontend")
- Filter document list by tag
- Quickly find related documents

**Implementation:**

**Database:**
```sql
-- Migration 006_document_tags.sql
CREATE TABLE document_tags (
  doc_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (doc_id, tag)
);

CREATE INDEX document_tags_tag_idx ON document_tags (tag);
```

**Backend:**
```typescript
// Extend PATCH /api/documents/:id to accept tags field
// GET /api/documents?tags=auth,API
```

**Frontend:**
```typescript
// Component: TagInput.tsx (multi-select input)
// Display tags as chips below document title
// Click tag to filter document list
```

**Complexity:** MEDIUM (8 hours)
- Database: 1 hour
- Backend: 2 hours
- Frontend: 4 hours
- Testing: 1 hour

**Value:** MEDIUM (organizational enhancement)

**Priority:** LOW - Nice-to-have, not critical

---

### SUGGESTION 4: Model Cost Estimator
**Description:** Show estimated cost per query based on selected model

**Use Case:**
- Budget-conscious users want to know cost before sending expensive queries
- Compare model costs before selecting

**Implementation:**
```typescript
// Component: CostEstimator.tsx
// Display below model selector or in chat input area

function estimateQueryCost(query: string, model: string): number {
  const tokenEstimate = query.split(' ').length * 1.3; // Rough estimate
  const modelPricing = {
    'claude-3-7-sonnet-20250219': 0.003 / 1000, // $3 per 1M input tokens
    'claude-3-5-haiku-20241022': 0.001 / 1000, // $1 per 1M input tokens
    'llama3.2:3b': 0, // Free (Ollama)
  };
  
  return tokenEstimate * (modelPricing[model] ?? 0);
}

// Display: "Estimated cost: ~$0.0012 per query"
```

**Complexity:** MEDIUM (6 hours)
- Token estimation logic: 2 hours
- UI component: 3 hours
- Testing with various models: 1 hour

**Value:** HIGH (budget awareness, informed decision-making)

**Priority:** MEDIUM - Useful for cost-conscious users

---

### SUGGESTION 5: Batch Document Deletion
**Description:** Extend F2 to support selecting multiple documents for deletion

**Use Case:**
- User wants to delete outdated documents in bulk
- Cleanup after uploading wrong files

**Implementation:**
```typescript
// Component: DocumentList.tsx (extend existing)
// Add checkbox to each document card
// Add "Delete Selected (N)" button in toolbar
// Batch API: DELETE /api/documents with body: { ids: [...] }

const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());

function toggleSelection(docId: string) {
  setSelectedDocs(prev => {
    const next = new Set(prev);
    if (next.has(docId)) {
      next.delete(docId);
    } else {
      next.add(docId);
    }
    return next;
  });
}

function deleteSelected() {
  await apiClient.deleteDocuments(Array.from(selectedDocs));
  setSelectedDocs(new Set());
}
```

**Complexity:** LOW (3 hours)
- Frontend: Checkboxes + delete button (2 hours)
- Backend: Batch delete endpoint (1 hour, or sequential single deletes)

**Value:** MEDIUM (efficiency improvement for bulk operations)

**Priority:** LOW - Enhancement to existing feature

---

### SUGGESTION 6: Document Upload Progress Persistence
**Description:** Resume uploads if browser is closed mid-upload

**Use Case:**
- User accidentally closes tab during large file upload
- Browser crashes mid-upload
- Avoid re-uploading large files

**Implementation:**
- Requires background job queue (BullMQ, Redis, etc.)
- Store upload state in database or Redis
- On page load, check for in-progress uploads
- Resume from last chunk

**Complexity:** HIGH (12+ hours)
- Background job queue setup: 4 hours
- Upload state tracking: 3 hours
- Resume logic: 4 hours
- Testing: 2 hours

**Value:** MEDIUM (edge case handling, mostly relevant for large files)

**Priority:** VERY LOW - Complex, low ROI, defer indefinitely

---

## Conclusion & Next Steps

### Summary

This comprehensive DROID-PLAN provides a complete roadmap for implementing 10 requested features (9 net-new + 1 already complete) across 6 feature groups. The plan is based on:

✅ **Thorough Review:** 12+ phases of documentation, 50+ GitHub issues, complete codebase analysis, and web research  
✅ **Clear Dependencies:** Dependency mapping with critical path identification  
✅ **Realistic Estimates:** 126 hours total (25-30 single-developer days, or 3-4 weeks with team of 4)  
✅ **Prioritized Roadmap:** Quick wins first (D1, E1, F1, B1), then UX enhancements (B2, A1, C1), then advanced features (A2)  
✅ **Technical Specificity:** Database schemas, API routes, services, components all specified  
✅ **Risk Assessment:** Complexity ratings with uncertainty factors identified  

### Immediate Next Steps

1. **Review & Approve Decisions (Day 1)**
   - Decision 1: Model selection per-collection ✅ (Recommended)
   - Decision 2: Auto-generated chat titles ✅ (Recommended for MVP)
   - Decision 3: On-demand summary generation ✅ (Recommended)
   - Decision 4: Cursor-based pagination ✅ (Recommended)
   - Decision 5: Abort immediately on interrupt ✅ (Recommended)
   - Decision 6: Limited concurrency (3) for uploads ✅ (Recommended)

2. **Allocate Resources (Day 1)**
   - Assign developers to phases (if team approach)
   - Set up project tracking (GitHub Projects, Jira, etc.)
   - Create feature branches

3. **Start Implementation (Day 2)**
   - **Priority 1 (Week 1):** D1, E1, F1, B1
   - Follow implementation order in Phase 6

### Success Criteria

**Phase 16 (Chat & Agent):**
- ✅ B1: Chat sessions persist in database, can be listed and retrieved
- ✅ A1: Stop button cancels agent responses mid-generation
- ✅ A2: (Optional) New messages interrupt agent processing

**Phase 17 (Document Management):**
- ✅ D1: Users can create collections via UI
- ✅ E1: Users can upload multiple documents simultaneously
- ✅ F1: Users can view document details, statistics, and AI summaries

**Phase 18 (Model Selection):**
- ✅ C1: Users can select different LLM models per collection
- ✅ Model list includes Anthropic + Ollama models
- ✅ Model metadata displays context window, cost, speed

**Phase 12 Day 5-6 (Extended):**
- ✅ B2: Chat history UI with session list and switching
- ✅ Cost dashboard displays API usage and budget alerts
- ✅ Synthesis view shows multi-source comparisons

**Overall:**
- ✅ No breaking changes to existing functionality
- ✅ All tests passing (unit + integration)
- ✅ Performance maintained (<600ms search latency)
- ✅ Documentation updated

### Risk Mitigation

**High-Risk Features:**
- **A2 (Interrupt Agent):** Consider marking as "experimental" feature flag initially. Defer if time-constrained.
- **C1 (Model Selection):** Implement robust validation and fallback to default model if selection fails.
- **A1 (Stop Button):** Extensive testing of cancellation scenarios, ensure no resource leaks.

**Dependencies:**
- **B1 before B2:** B1 must complete before B2 can start (critical path for Phase 12)
- **A1 before A2:** A1 provides cancellation infrastructure for A2

**Performance:**
- **Load Testing:** Test with 1000+ chat messages and 20k+ documents
- **Pagination:** Implement cursor-based pagination for scalability
- **Caching:** Cache model lists (5 min TTL), document summaries (indefinite)

### Final Recommendation

✅ **Proceed with Implementation**

This plan is ready for execution. All features are well-scoped, dependencies are mapped, and technical approaches are specified. Estimated timeline of **25-30 days (single developer)** or **3-4 weeks (team of 4)** is realistic based on complexity analysis.

**Prioritization is key:** Start with Priority 1 (Quick Wins) to deliver early value, then move to Priority 2 (UX Enhancements), and finally Priority 3 (Advanced Features). A2 can be deferred if needed.

**Let's build! 🚀**

---

**Document Version:** 1.0  
**Created:** 2025-01-15  
**Status:** Ready for Implementation  
**Total Pages:** 89 (Markdown)  
**Total Words:** ~18,000  

---

_For questions or clarifications on any section of this plan, please refer to the specific phase or decision section. All recommendations are based on comprehensive analysis of the Synthesis project's current state, architecture, and best practices from web research._
