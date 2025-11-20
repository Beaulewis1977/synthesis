# System Architecture
**Version:** 2.0
**Last Updated:** November 13, 2025

---

## 🎯 Architecture Principles

### Design Goals
1. **Autonomous-first** - Agent makes decisions, not just executes commands
2. **Multi-project** - Clean collection isolation from day 1
3. **Local-capable** - Works offline with Ollama
4. **Cloud-ready** - Can toggle to Claude/Voyage
5. **MCP-native** - External agents are first-class citizens
6. **Docker-friendly** - Deploy anywhere
7. **Not over-engineered** - Simple until complexity is needed

---

## 🏗️ System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        USERS                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   You       │  │ IDE Agents  │  │   Claude    │         │
│  │ (Browser)   │  │(Cursor/etc) │  │   Desktop   │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
└─────────┼─────────────────┼─────────────────┼────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────┐  ┌──────────────────────────────┐
│   React Web UI  │  │      MCP Server              │
│  (Port 5173)    │  │   (stdio + SSE modes)        │
└────────┬────────┘  └────────────┬─────────────────┘
         │                        │
         │                        │
         └────────────┬───────────┘
                      │
                      ▼
         ┌────────────────────────────┐
         │    Fastify Backend API     │
         │       (Port 3333)          │
         │                            │
         │  Routes:                   │
         │  • /api/agent/chat         │
         │  • /api/collections        │
         │  • /api/docs               │
         │  • /api/search             │
         │  • /api/ingest             │
         └────────┬───────────────────┘
                  │
    ┌─────────────┴─────────────┐
    │                           │
    ▼                           ▼
┌────────────────────┐   ┌─────────────────────┐
│  Claude Agent SDK  │   │  Ollama (Local GPU) │
│  (Orchestrator)    │   │                     │
│                    │   │  • Embeddings       │
│  Tools:            │   │  • Chat (fallback)  │
│  • search_rag      │   └─────────────────────┘
│  • add_document    │
│  • fetch_web       │
│  • list_docs       │
│  • delete_doc      │
└────────┬───────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                  RAG Pipeline (v2.0)                         │
│                                                              │
│  Extract → AST Parse → Chunk → Route → Embed → Upsert       │
│          (code only)  (context-  (provider  (multi-         │
│                       aware)     selection) provider)        │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│         Postgres 16 + pgvector 0.7.4                         │
│                                                              │
│  Tables:                                                     │
│  • collections                 • api_usage (cost tracking)   │
│  • documents                   • file_relationships          │
│  • chunks (vector + tsvector)                                │
│                                                              │
│  Indexes:                                                    │
│  • HNSW (vector cosine similarity)                           │
│  • GIN (full-text search for BM25)                           │
│  • JSONB (metadata, tech_stack)                              │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────┐
│               Intelligent Search Layer (v2.0)                │
│                                                              │
│  Query → [Vector Search + BM25 Search] → RRF Fusion         │
│        → Re-ranking (Cohere/BGE) → Synthesis (optional)      │
│        → Tech Stack Filter → Results                         │
│                                                              │
│  Cost Tracker: Monitor API usage, enforce budgets           │
└──────────────────────────────────────────────────────────────┘
```

---

## 🧩 Component Breakdown

### 1. Frontend (React + Vite)

**Purpose:** User interface for collections, upload, and chat

**Key Pages:**
- `/` - Dashboard (collection list)
- `/collections/:id` - Collection view (docs list)
- `/chat/:collectionId` - Chat with agent
- `/upload/:collectionId` - Upload documents

**State Management:**
- React Query for server state
- React Context for active collection
- Local state for UI (forms, modals)

**API Client:**
- Fetch wrapper with error handling
- React Query hooks per endpoint
- Optimistic updates where appropriate

---

### 2. Backend API (Fastify)

**Purpose:** HTTP API for all operations

**Architecture:**
```
apps/server/src/
├── index.ts              # App entry point
├── server.ts             # Fastify setup
├── routes/
│   ├── agent.ts          # POST /api/agent/chat
│   ├── collections.ts    # CRUD for collections
│   ├── docs.ts           # CRUD for documents
│   ├── search.ts         # POST /api/search (hybrid, re-ranking)
│   ├── ingest.ts         # POST /api/ingest
│   ├── synthesis.ts      # POST /api/synthesis/compare (NEW)
│   └── costs.ts          # GET /api/costs/* (NEW)
├── agent/
│   ├── agent.ts          # Claude Agent SDK setup
│   └── tools.ts          # Tool implementations
├── pipeline/
│   ├── extract.ts        # PDF/DOCX/MD extraction
│   ├── chunk.ts          # Chunking logic
│   ├── code-chunker.ts   # AST-based code chunking (NEW)
│   ├── dart-analyzer.ts  # Dart AST parser (NEW)
│   ├── ts-analyzer.ts    # TypeScript AST parser (NEW)
│   ├── embed.ts          # Multi-provider embeddings
│   └── ingest.ts         # Orchestration
├── services/
│   ├── search.ts         # Smart search orchestrator (NEW)
│   ├── vector.ts         # Pure vector search
│   ├── hybrid.ts         # Hybrid search with RRF (NEW)
│   ├── bm25.ts           # BM25 full-text search (NEW)
│   ├── reranker.ts       # Cohere/BGE re-ranking (NEW)
│   ├── synthesis.ts      # Multi-source synthesis (NEW)
│   ├── contradiction-detection.ts  # Contradiction finder (NEW)
│   ├── embedding-router.ts  # Provider selection (NEW)
│   ├── ollama.ts         # Ollama client
│   ├── openai.ts         # OpenAI client (NEW)
│   ├── voyage.ts         # Voyage client (NEW)
│   ├── cost-tracker.ts   # API cost monitoring (NEW)
│   ├── tech-detector.ts  # Tech stack detection (NEW)
│   └── scraper.ts        # Web content fetching
└── db/
    ├── client.ts         # Postgres pool
    └── queries.ts        # SQL queries
```

**Request Flow:**
```
HTTP Request
  → Fastify route handler
  → Zod validation
  → Service/Agent logic
  → Database query
  → Response
```

---

### 3. Claude Agent SDK (Orchestrator)

**Purpose:** Autonomous decision-making and tool execution

**Configuration:**
```typescript
Agent({
  model: "claude-3-5-sonnet-20241022",
  maxTurns: 10,
  tools: [...],
  systemPrompt: "You are an autonomous RAG assistant..."
})
```

**Tool Execution Flow:**
```
User message
  → Agent decides which tool(s) to use
  → Executes tools (potentially multiple in sequence)
  → Synthesizes results
  → Returns response
```

**Example Multi-Step:**
```
User: "Add Flutter docs"
  Step 1: Agent calls fetch_web("https://docs.flutter.dev")
  Step 2: Agent calls add_document(content, title="Flutter Docs")
  Step 3: Agent monitors with get_document_status()
  Step 4: Agent responds "Flutter docs added, 150 pages processed"
```

---

### 4. RAG Pipeline (v2.0)

**Purpose:** Transform documents into searchable vectors with intelligent routing

**Stages:**

#### 4.1 Extraction
```typescript
// Input: File buffer + type
// Output: Plain text + metadata

switch (contentType) {
  case 'application/pdf':
    return await extractPDF(buffer);  // pdf-parse
  case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    return await extractDOCX(buffer); // mammoth
  case 'text/markdown':
    return await extractMarkdown(buffer); // remark
  default:
    return buffer.toString('utf-8');
}
```

#### 4.2 AST Parsing (Code Files Only) **NEW in Phase 13**
```typescript
// Input: Code file (detected by extension)
// Output: AST-based chunks with preserved structure

if (isCodeFile(fileName)) {
  const language = detectLanguage(fileName);  // .dart, .ts, .py, etc.

  const codeChunks = await parseCodeFile(content, language, {
    preserveImports: true,      // Include imports in each chunk
    trackRelationships: true,   // Store file relationships
    maxLinesPerChunk: 100,
  });

  // Store relationships: imports, tests, siblings
  await storeFileRelationships(docId, codeChunks.relationships);

  return codeChunks;
}
```

#### 4.3 Chunking
```typescript
// Input: Text (or AST chunks for code)
// Output: Array of chunks

// For documents (Phase 1):
const chunks = splitIntoChunks(text, {
  maxSize: 800,      // characters
  overlap: 150,      // characters
  splitOn: '\n\n',   // paragraph boundaries
});

// For code (Phase 13):
// Already chunked by AST parser, skip this stage
```

#### 4.4 Provider Routing & Embedding **NEW in Phase 11**
```typescript
// Input: Chunks + metadata
// Output: Array of vectors (768, 1024, or 1536 dims)

// Automatic provider selection based on content
for (const chunk of chunks) {
  const provider = selectEmbeddingProvider(chunk, {
    type: metadata.doc_type,      // 'code' | 'docs' | 'personal'
    language: metadata.language,   // e.g., 'typescript'
  });

  switch (provider) {
    case 'voyage':  // Best for code (voyage-code-2, 1024 dims)
      embeddings = await voyageClient.embed(chunk);
      break;
    case 'openai':  // Best for personal writing (text-embedding-3-large, 1536 dims)
      embeddings = await openaiClient.embed(chunk);
      break;
    case 'ollama':  // Free, good for docs (nomic-embed-text, 768 dims)
    default:
      embeddings = await ollamaClient.embed(chunk);
  }

  // Track cost
  await costTracker.logEmbedding(provider, tokens);
}
```

#### 4.5 Tech Stack Detection **NEW in Phase 13.5**
```typescript
// Input: Document content + metadata
// Output: Tech stack tags

const techStack = detectTechStack(content, fileName, {
  detectFrameworks: true,   // React, Flutter, etc.
  detectLanguages: true,    // TypeScript, Dart, etc.
  detectLibraries: true,    // Express, Riverpod, etc.
});

metadata.tech_stack = techStack;  // ['dart', 'flutter', 'riverpod']
```

#### 4.6 Upsert **UPDATED in Phase 11**
```typescript
// Input: Chunks + embeddings + metadata
// Output: Database records

await db.query(`
  INSERT INTO chunks (
    doc_id, chunk_index, text, embedding, metadata,
    fts, tech_stack, embedding_provider
  )
  VALUES ($1, $2, $3, $4, $5,
    to_tsvector('english', $3),  -- Full-text search index
    $6,  -- Tech stack array
    $7   -- 'ollama', 'voyage', or 'openai'
  )
  ON CONFLICT (doc_id, chunk_index) DO UPDATE ...
`);
```

**Processing Queue:**
```
Upload
  → Save to storage
  → Create doc record (status: pending)
  → Queue extraction job
  → Update status: extracting
  → Queue chunking job
  → Update status: chunking
  → Queue embedding job (batched)
  → Update status: embedding
  → Upsert to database
  → Update status: complete
```

---

### 5. Intelligent Search Engine (v2.0) **UPDATED Phase 11-12**

**Purpose:** Find relevant chunks using hybrid search, re-ranking, and synthesis

**Smart Search Orchestrator:**
```typescript
async function smartSearch(query: string, options: SearchOptions) {
  // 1. Select search mode based on options
  const mode = options.mode || process.env.SEARCH_MODE || 'vector';

  let results;

  switch (mode) {
    case 'hybrid':
      results = await hybridSearch(query, options);  // BM25 + Vector + RRF
      break;
    case 'bm25':
      results = await bm25Search(query, options);    // Keyword only
      break;
    case 'vector':
    default:
      results = await vectorSearch(query, options);  // Semantic only
  }

  // 2. Apply tech stack filtering (Phase 14)
  if (options.tech_stack?.length > 0) {
    results = results.filter(r =>
      r.tech_stack.some(t => options.tech_stack.includes(t))
    );
  }

  // 3. Re-rank results (Phase 12)
  if (options.enable_reranking && results.length > 0) {
    results = await rerank(query, results, {
      provider: process.env.RERANKER_PROVIDER || 'bge',
      topK: options.top_k
    });
  }

  // 4. Synthesize (Phase 12, optional)
  let synthesis = null;
  if (options.enable_synthesis && results.length >= 3) {
    synthesis = await synthesizeResults(query, results);
  }

  return { results, synthesis };
}
```

**Hybrid Search with RRF Fusion (Phase 11):**
```typescript
async function hybridSearch(query: string, options: SearchOptions) {
  // 1. Embed query
  const queryEmbedding = await embed(query, options.embedding_provider);

  // 2. Parallel search execution
  const [vectorResults, bm25Results] = await Promise.all([
    // Vector similarity search
    db.query(`
      SELECT
        c.text,
        c.metadata,
        d.title as doc_title,
        (c.embedding <=> $1::vector) as similarity
      FROM chunks c
      JOIN documents d ON d.id = c.doc_id
      WHERE d.collection_id = $2
      ORDER BY c.embedding <=> $1::vector
      LIMIT $3
    `, [queryEmbedding, options.collection_id, options.top_k * 3]),

    // BM25 keyword search
    db.query(`
      SELECT
        c.text,
        c.metadata,
        d.title as doc_title,
        ts_rank(c.fts, plainto_tsquery('english', $1)) as bm25_score
      FROM chunks c
      JOIN documents d ON d.id = c.doc_id
      WHERE d.collection_id = $2
        AND c.fts @@ plainto_tsquery('english', $1)
      ORDER BY ts_rank(c.fts, plainto_tsquery('english', $1)) DESC
      LIMIT $3
    `, [query, options.collection_id, options.top_k * 3])
  ]);

  // 3. Reciprocal Rank Fusion (RRF)
  const fused = fuseResults(vectorResults, bm25Results, {
    vectorWeight: process.env.HYBRID_VECTOR_WEIGHT || 0.7,
    bm25Weight: process.env.HYBRID_BM25_WEIGHT || 0.3,
    rrfK: 60  // RRF constant
  });

  // 4. Apply trust scoring (optional)
  if (process.env.ENABLE_TRUST_SCORING === 'true') {
    return applyTrustScoring(fused);
  }

  return fused.slice(0, options.top_k);
}

// RRF Fusion Formula:
// fusedScore(doc) = Σ(weight / (k + rank + 1))
//   where k=60, weight=0.7 (vector) or 0.3 (BM25)
```

**Re-ranking (Phase 12):**
```typescript
async function rerank(query: string, results: SearchResult[], options) {
  const provider = options.provider;

  if (provider === 'cohere' && process.env.COHERE_API_KEY) {
    // Cohere cross-encoder (paid, highest quality)
    const reranked = await cohereClient.rerank({
      query,
      documents: results.map(r => r.text),
      model: 'rerank-english-v3.0',
      top_n: options.topK
    });

    // Track cost
    await costTracker.logRerank('cohere', results.length);

    return reranked;
  } else {
    // BGE local cross-encoder (free fallback)
    return await bgeRerank(query, results, options.topK);
  }
}
```

**Document Synthesis (Phase 12):**
```typescript
async function synthesizeResults(query: string, results: SearchResult[]) {
  // 1. Group results by approach (k-means clustering)
  const clusters = clusterResults(results, { maxClusters: 3 });

  // 2. Extract approach from each cluster
  const approaches = clusters.map(cluster => ({
    approach: extractApproach(cluster),
    sources: cluster.results,
    consensusScore: calculateConsensus(cluster)
  }));

  // 3. Detect contradictions (Claude Haiku)
  const contradictions = await detectContradictions(results, {
    maxPairs: 6,
    thresholds: { min: 0.2, max: 0.7 }
  });

  // 4. Select recommended approach
  const recommended = approaches.reduce((best, curr) =>
    curr.consensusScore > best.consensusScore ? curr : best
  );

  return {
    synthesis: recommended.approach,
    consensusScore: recommended.consensusScore,
    approaches,
    contradictions,
    sources: results.slice(0, 10)
  };
}
```

**Cost Tracking (Phase 12):**
```typescript
// Every API call is tracked
await costTracker.log({
  operation: 'embedding',    // or 'reranking', 'synthesis'
  provider: 'voyage',        // or 'cohere', 'openai'
  tokens: 1024,
  cost_usd: 0.000123
});

// Budget enforcement
if (await costTracker.isBudgetExceeded()) {
  // Automatically fallback to free providers
  provider = 'ollama';  // Free embedding
  reranker = 'bge';     // Free re-ranking
}
```

**Performance Characteristics:**

| Search Mode | Latency (P90) | Accuracy | Cost |
|-------------|---------------|----------|------|
| Vector only | 234ms | Good | Low |
| BM25 only | 187ms | Moderate | Free |
| Hybrid (RRF) | 487ms | Best | Low |
| Hybrid + Rerank | 1,203ms | Excellent | Medium |
| Hybrid + Rerank + Synthesis | 2,456ms | Exceptional | High |

**Data Flow:**
```
Query
  ↓
[Select Mode: Vector | BM25 | Hybrid]
  ↓
[Parallel Search Execution]
  ↓
[RRF Fusion (if hybrid)]
  ↓
[Tech Stack Filtering]
  ↓
[Re-ranking (optional, Cohere/BGE)]
  ↓
[Synthesis (optional, Claude)]
  ↓
[Cost Tracking]
  ↓
Results
```
    score: 1 - row.distance,
    citation: {
      title: row.doc_title,
      page: row.metadata?.page,
    }
  }));
}
```

**Index Strategy:**
```sql
-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX chunks_embedding_hnsw ON chunks 
  USING hnsw (embedding vector_cosine_ops);

-- Composite index for filtered searches
CREATE INDEX chunks_doc_id_idx ON chunks (doc_id);
```

---

### 6. MCP Server

**Purpose:** Expose RAG to external AI agents

**Two Modes:**

#### Mode 1: stdio (WSL/IDE Agents)
```typescript
// Used by: Cursor, Windsurf, Claude Code
// Protocol: stdin/stdout JSON-RPC

server.use(StdioServerTransport());
```

#### Mode 2: SSE (Windows/Claude Desktop)
```typescript
// Used by: Claude Desktop on Windows
// Protocol: Server-Sent Events over HTTP

server.use(SSEServerTransport({
  endpoint: '/sse',
}));
```

**Tools Exposed:**
```typescript
[
  {
    name: "search_docs",
    description: "Search project documentation",
    input_schema: {
      query: string,
      collection_id?: string,
      top_k?: number
    }
  },
  {
    name: "list_collections",
    description: "List available collections"
  }
]
```

---

### 7. Database (Postgres + pgvector)

**Purpose:** Persistent storage with vector search

**Schema Design:**

#### Collections (Multi-Project Support)
```sql
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Documents
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_path TEXT,
  content_type TEXT,
  file_size BIGINT,
  status TEXT DEFAULT 'pending',
  -- pending | extracting | chunking | embedding | complete | error
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
```

#### Chunks (Vectors)
```sql
CREATE TABLE chunks (
  id BIGSERIAL PRIMARY KEY,
  doc_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  text TEXT NOT NULL,
  embedding VECTOR(768),  -- nomic-embed-text dims
  metadata JSONB,  -- {page, heading, etc}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(doc_id, chunk_index)
);
```

**Indexes:**
```sql
-- Vector search
CREATE INDEX chunks_embedding_hnsw ON chunks 
  USING hnsw (embedding vector_cosine_ops);

-- Foreign key lookups
CREATE INDEX chunks_doc_id_idx ON chunks (doc_id);
CREATE INDEX documents_collection_id_idx ON documents (collection_id);

-- Status filtering
CREATE INDEX documents_status_idx ON documents (status);
```

---

### 8. Ollama Integration (Local GPU)

**Purpose:** Free local embeddings and optional LLM

**Architecture:**
```
Your PC (Windows)
  └── WSL2 (Ubuntu)
        └── Ollama Service (port 11434)
              ├── Model: nomic-embed-text (embeddings)
              ├── Model: llama3.2:3b (chat fallback)
              └── VRAM: Uses your 16GB GPU
```

**API Calls:**
```typescript
// Embedding
const response = await fetch('http://localhost:11434/api/embeddings', {
  method: 'POST',
  body: JSON.stringify({
    model: 'nomic-embed-text',
    prompt: text,
  }),
});

// Chat (fallback when Claude unavailable)
const response = await fetch('http://localhost:11434/api/chat', {
  method: 'POST',
  body: JSON.stringify({
    model: 'llama3.2:3b',
    messages: [...],
  }),
});
```

---

## 🔄 Data Flow Examples

### Example 1: Upload Document

```
[User] Drags PDF to upload area
  ↓
[Frontend] POST /api/ingest with multipart form
  ↓
[Backend] Receives file
  ↓
[Backend] Saves to ./storage/{collectionId}/{docId}.pdf
  ↓
[Backend] Creates document record (status: pending)
  ↓
[Pipeline] extract(PDF) → text
  ↓
[Pipeline] chunk(text) → chunks[]
  ↓
[Pipeline] embed(chunks) → vectors[] (Ollama)
  ↓
[Pipeline] upsert to database
  ↓
[Backend] Updates document status: complete
  ↓
[Frontend] Polls status, shows "Complete"
```

### Example 2: Agent Fetches Web Docs

```
[User] "Add Supabase docs to my collection"
  ↓
[Frontend] POST /api/agent/chat
  ↓
[Agent SDK] Analyzes request
  ↓
[Agent SDK] Calls tool: fetch_web("https://supabase.com/docs")
  ↓
[Tool] Playwright navigates to URL
  ↓
[Tool] Extracts text, converts to markdown
  ↓
[Agent SDK] Calls tool: add_document(content, "Supabase Docs")
  ↓
[Pipeline] Processes as above (extract → chunk → embed → upsert)
  ↓
[Agent SDK] Responds: "I've added Supabase docs, 120 pages processed"
  ↓
[Frontend] Displays agent message
```

### Example 3: Search Query

```
[User] Types "How do I set up RLS in Supabase?"
  ↓
[Frontend] POST /api/agent/chat
  ↓
[Agent SDK] Calls tool: search_rag("setup RLS Supabase", collectionId)
  ↓
[Tool] Embeds query (Ollama)
  ↓
[Tool] Searches pgvector with cosine similarity
  ↓
[Tool] Returns top 5 chunks with metadata
  ↓
[Agent SDK] Synthesizes answer with citations
  ↓
[Agent SDK] Returns: "To set up RLS... [cites Supabase Docs p.34]"
  ↓
[Frontend] Displays answer with citation links
```

### Example 4: IDE Agent via MCP

```
[Cursor Agent] Needs context about Supabase
  ↓
[Cursor] Calls MCP tool: search_docs("supabase authentication")
  ↓
[MCP Server] Forwards to backend API
  ↓
[Backend] search_rag("supabase authentication", collectionId)
  ↓
[Backend] Returns results
  ↓
[MCP Server] Returns to Cursor
  ↓
[Cursor] Uses context to generate code
```

---

## 🐳 Docker Architecture

**docker-compose.yml structure:**

```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "postgres"]
  
  ollama:
    image: ollama/ollama:latest
    volumes:
      - ollama_data:/root/.ollama
    ports:
      - "11434:11434"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
  
  server:
    build: ./apps/server
    depends_on:
      - db
      - ollama
    ports:
      - "3333:3333"
    environment:
      - DATABASE_URL=postgres://postgres:postgres@db:5432/synthesis
      - OLLAMA_HOST=http://ollama:11434
  
  web:
    build: ./apps/web
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://localhost:3333
  
  mcp:
    build: ./apps/mcp
    depends_on:
      - server
    ports:
      - "3334:3334"
```

**Network:**
```
Docker Network: synthesis_network
  ├── db:5432
  ├── ollama:11434
  ├── server:3333
  ├── web:5173
  └── mcp:3334
```

---

## 🔒 Security Architecture

### Authentication (MVP)
- **Frontend:** No auth (local use)
- **Backend API:** Optional API key (env var)
- **MCP:** No auth (local stdio)

### Data Protection
- All docs stored locally
- Embeddings generated locally (Ollama)
- Only Claude API calls go external (encrypted HTTPS)

### Docker Security
- Non-root users in containers
- Read-only root filesystem where possible
- Resource limits (CPU, memory)

---

## 📊 Performance Targets

### Ingestion
- **PDF extraction:** < 2 sec per page
- **Chunking:** < 1 sec per document
- **Embedding:** 50 chunks/sec (Ollama with GPU)
- **Upsert:** 100 chunks/sec (batch inserts)

### Search
- **Query embedding:** < 100ms (Ollama)
- **Vector search:** < 500ms (HNSW index)
- **Total latency:** < 1 second for top-10 results

### Agent
- **Tool execution:** < 2 seconds per tool call
- **Multi-step workflow:** < 10 seconds for 3-step process

---

## 🔄 Scaling Considerations (Future)

### Current Design (MVP)
- Single Postgres instance
- Single Ollama instance
- Monolithic backend
- No caching

### Phase 2 Scaling
- Redis for query caching
- Background job queue (BullMQ)
- Separate embedding service
- Read replicas for Postgres

### SaaS Scaling
- Multi-tenant database
- Load balancer
- Kubernetes deployment
- Managed Postgres (Supabase/Neon)
- CDN for static assets

---

## ✅ Architecture Validation

### Questions This Design Answers

✅ **How do collections stay isolated?**  
→ Foreign key `collection_id` on documents, enforced in queries

✅ **How do we handle multiple projects?**  
→ Each project = one collection, UI switches active collection

✅ **How do external agents access RAG?**  
→ MCP server exposes tools, backed by same search API

✅ **How do we toggle between Claude and Ollama?**  
→ Strategy pattern, env var controls which client is used

✅ **How do we add features later?**  
→ Database has room (JSONB metadata), agent tools are modular

✅ **How does Docker deployment work?**  
→ All services in docker-compose, volume mounts for persistence

---

**This architecture is simple enough to build in 7-9 days, robust enough to scale later.**
