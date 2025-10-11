# System Architecture
**Version:** 1.0  
**Last Updated:** October 6, 2025

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
┌─────────────────────────────────────┐
│      RAG Pipeline                   │
│                                     │
│  Extract → Chunk → Embed → Upsert  │
└─────────┬───────────────────────────┘
          │
          ▼
┌─────────────────────────────────────┐
│   Postgres 16 + pgvector 0.7.4      │
│                                     │
│   Tables:                           │
│   • collections                     │
│   • documents                       │
│   • chunks (with vector embeddings) │
│                                     │
│   Index: HNSW (cosine similarity)   │
└─────────────────────────────────────┘
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
│   ├── search.ts         # POST /api/search
│   └── ingest.ts         # POST /api/ingest
├── agent/
│   ├── agent.ts          # Claude Agent SDK setup
│   └── tools/            # Tool implementations
├── pipeline/
│   ├── extract.ts        # PDF/DOCX/MD extraction
│   ├── chunk.ts          # Chunking logic
│   ├── embed.ts          # Ollama/Voyage embeddings
│   └── ingest.ts         # Orchestration
├── services/
│   ├── search.ts         # Vector search logic
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

### 4. RAG Pipeline

**Purpose:** Transform documents into searchable vectors

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

#### 4.2 Chunking
```typescript
// Input: Text
// Output: Array of chunks

const chunks = splitIntoChunks(text, {
  maxSize: 800,      // characters
  overlap: 150,      // characters
  splitOn: '\n\n',   // paragraph boundaries
});
```

#### 4.3 Embedding
```typescript
// Input: Array of chunks
// Output: Array of vectors (768 or 1024 dims)

// Option A: Ollama (local, free)
const embeddings = await ollamaClient.embeddings({
  model: 'nomic-embed-text',
  prompt: chunks,
});

// Option B: Voyage (cloud, higher quality)
const embeddings = await voyageClient.embed({
  model: 'voyage-3.5',
  input: chunks,
});
```

#### 4.4 Upsert
```typescript
// Input: Chunks + embeddings
// Output: Database records

await db.query(`
  INSERT INTO chunks (doc_id, chunk_index, text, embedding, metadata)
  VALUES ($1, $2, $3, $4, $5)
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

### 5. Vector Search Engine

**Purpose:** Find relevant chunks for queries

**Search Algorithm:**
```typescript
async function searchRAG(query: string, collectionId: string, topK: number) {
  // 1. Embed query
  const queryEmbedding = await embed(query);
  
  // 2. Vector similarity search
  const results = await db.query(`
    SELECT 
      c.text,
      c.metadata,
      d.title as doc_title,
      (c.embedding <=> $1::vector) as distance
    FROM chunks c
    JOIN documents d ON d.id = c.doc_id
    WHERE d.collection_id = $2
    ORDER BY c.embedding <=> $1::vector
    LIMIT $3
  `, [queryEmbedding, collectionId, topK]);
  
  // 3. Format results with citations
  return results.rows.map(row => ({
    text: row.text,
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
