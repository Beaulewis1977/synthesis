# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Synthesis** is an autonomous RAG (Retrieval-Augmented Generation) system powered by Claude Agent SDK for multi-project documentation management. The system enables developers to manage multiple documentation collections, search semantically using pgvector, and interact via a chat UI, MCP server, or external AI agents.

**Tech Stack:**
- Backend: Node.js 22, Fastify, TypeScript
- Frontend: React, Vite, Tailwind CSS
- Database: PostgreSQL 16 + pgvector 0.7.4
- AI: Claude Agent SDK (Claude Opus 4 Sonnet), Ollama (local fallback)
- Embeddings: Multi-provider support (Ollama, OpenAI, Voyage)
- Search: Hybrid search with Reciprocal Rank Fusion (RRF)
- Deployment: Docker Compose
- Monorepo: pnpm workspaces + Turbo

## Development Commands

### Initial Setup
```bash
# Install dependencies
pnpm install

# Copy environment file and configure API keys
cp .env.example .env
# Edit .env with ANTHROPIC_API_KEY and other settings

# Start infrastructure services (PostgreSQL + Ollama)
pnpm docker:dev
# OR: docker compose up -d synthesis-db synthesis-ollama

# Apply database migrations
pnpm --filter @synthesis/db migrate

# Pull Ollama models (required for embeddings)
ollama pull nomic-embed-text
ollama pull llama3.2:3b  # optional for local chat
```

### Development Workflow
```bash
# Start backend server (port 3333)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/synthesis" \
ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
OLLAMA_BASE_URL="http://localhost:11434" \
STORAGE_PATH="/home/kngpnn/dev/synthesis/storage" \
pnpm --filter @synthesis/server dev

# Start frontend (port 5173)
pnpm --filter @synthesis/web dev

# Start MCP server (optional, for external agents)
pnpm --filter @synthesis/mcp dev
```

### Testing & Quality
```bash
# Run all tests across workspace
pnpm test

# Run tests in watch mode
pnpm test:watch

# Type checking
pnpm typecheck

# Type check specific workspace
pnpm --filter @synthesis/server typecheck
pnpm typecheck:server  # shortcut

# Lint & format (uses Biome)
pnpm lint
pnpm lint:fix
pnpm format

# Test coverage
pnpm test:coverage
```

### Docker Operations
```bash
# Start only infrastructure (db + ollama)
pnpm docker:dev

# Start all services including app
pnpm docker:up
# OR: docker compose --profile app up -d

# Stop all services
pnpm docker:down

# View logs
pnpm docker:logs
```

### Database Operations
```bash
# Run migrations
pnpm --filter @synthesis/db migrate

# Connect to database
docker compose exec synthesis-db psql -U postgres -d synthesis

# Verify pgvector extension
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\dx"
```

### Verification & Health Checks
```bash
# Check backend health
curl http://localhost:3333/health

# Test MCP tools
pnpm verify:mcp

# Check Ollama
curl http://localhost:11434/api/tags
```

## Architecture Overview

### Monorepo Structure
```
synthesis/
├── apps/
│   ├── server/          # Fastify backend API
│   ├── web/            # React frontend (Vite)
│   └── mcp/            # MCP server (Model Context Protocol)
├── packages/
│   ├── db/             # Database client, migrations, queries
│   └── shared/         # Shared types and utilities
└── docs/               # Comprehensive planning & phase docs
```

### Key Backend Components (`apps/server/src/`)
```
├── agent/
│   ├── agent.ts        # Claude Agent SDK orchestrator (10-turn agentic loop)
│   └── tools.ts        # Agent tool definitions & executors
├── routes/
│   ├── agent.ts        # POST /api/agent/chat (chat with agent)
│   ├── collections.ts  # CRUD for collections
│   ├── search.ts       # POST /api/search (vector search)
│   └── ingest.ts       # POST /api/ingest (file upload)
├── pipeline/
│   ├── extract.ts      # PDF/DOCX/MD extraction
│   ├── chunk.ts        # Text chunking (800 chars, 150 overlap)
│   ├── embed.ts        # Multi-provider embedding orchestration
│   └── ingest.ts       # Pipeline orchestration
├── services/
│   ├── search.ts       # Smart search orchestrator (hybrid/vector modes)
│   ├── hybrid.ts       # Hybrid search with RRF fusion
│   ├── vector.ts       # Pure vector similarity search
│   ├── bm25.ts         # BM25 full-text search
│   ├── embedding-router.ts  # Provider selection logic
│   ├── ollama.ts       # Ollama embedding client
│   ├── openai.ts       # OpenAI embedding client
│   ├── voyage.ts       # Voyage embedding client
│   └── scraper.ts      # Web fetching (Playwright)
└── db/
    └── queries.ts      # SQL queries for collections/docs/chunks
```

### Agent System
The Claude Agent SDK orchestrator (`apps/server/src/agent/agent.ts`) implements a **10-turn agentic loop** with:
- **Model**: `claude-3-7-sonnet-20250219` (Claude Opus 4 Sonnet)
- **Max Tokens**: 4096
- **Tools**: search_rag, add_document, fetch_web_content, list_documents, get_document, delete_document, list_collections, get_collection
- **Multi-step workflows**: Agent autonomously chains tool calls to complete complex tasks
- **Context-aware**: Reviews conversation history to avoid repeating metadata

### Database Schema
```sql
collections (id, name, description, created_at, updated_at)
documents (id, collection_id, title, file_path, status, metadata JSONB, ...)
chunks (id, doc_id, chunk_index, text, embedding VECTOR(768|1024|1536), metadata JSONB)
```
- **Vector index**: HNSW for cosine similarity search
- **Full-text search**: tsvector column with GIN index for BM25
- **Cascade deletes**: Collections → Documents → Chunks
- **Variable dimensions**: Supports 768 (Ollama), 1024 (Voyage), 1536 (OpenAI)

### Search Architecture (Phase 8)

**Smart Search** (`services/search.ts`) automatically routes to the best search strategy:

#### Vector-Only Mode (default)
```
Query → Embed → pgvector cosine similarity → Top-K results
```

#### Hybrid Mode (SEARCH_MODE=hybrid)
```
Query → [Vector Search + BM25 Search] → Reciprocal Rank Fusion → Top-K results
```

**Reciprocal Rank Fusion (RRF):**
- Combines vector and BM25 rankings
- Formula: `score = Σ(weight / (k + rank))`
- Default k=60, weights: vector=0.7, bm25=0.3
- Configurable via `HYBRID_VECTOR_WEIGHT` and `HYBRID_BM25_WEIGHT`

**Trust Scoring** (optional, `ENABLE_TRUST_SCORING=true`):
- Boosts results based on source quality:
  - Official: 1.0x
  - Verified: 0.85x
  - Community: 0.6x
  - Unknown: 0.5x
- Applies recency weighting:
  - <6 months: 1.0x
  - 6-12 months: 0.9x
  - >12 months: 0.7x

### Multi-Provider Embeddings (Phase 8)

**Provider Selection** (`services/embedding-router.ts`):
- **Ollama** (nomic-embed-text, 768 dims): Free local embeddings, good for general docs
- **OpenAI** (text-embedding-3-large, 1536 dims): Best for personal writing/notes
- **Voyage** (voyage-code-2, 1024 dims): Optimized for code documentation

**Automatic Content Detection:**
```typescript
// Code content → Voyage (CODE_EMBEDDING_PROVIDER)
if (hasCodePatterns(text) || metadata.doc_type === 'code_sample') {
  provider = 'voyage';
}

// Personal writing → OpenAI (WRITING_EMBEDDING_PROVIDER)
if (metadata.doc_type === 'personal_writing') {
  provider = 'openai';
}

// Documentation → Ollama (DOC_EMBEDDING_PROVIDER, default)
else {
  provider = 'ollama';
}
```

**Code Pattern Detection:**
- Looks for `import/export`, `class/interface`, `function`, JSX syntax
- Language hints (Dart, TypeScript, Python, etc.)
- Automatically routes to code-specialized embeddings

### RAG Pipeline Flow
```
Upload → Extract (PDF/DOCX/MD) → Chunk (800 chars, 150 overlap)
      → Provider Selection → Embed (Ollama/OpenAI/Voyage) → Upsert to pgvector
```

**Metadata Tracking:**
- `embedding_provider`: Which provider was used (ollama/openai/voyage)
- `doc_type`: Content type (code_sample, personal_writing, etc.)
- `source_quality`: Trust level (official, verified, community)
- `last_verified`: ISO timestamp for recency scoring

### MCP Server
Exposes RAG capabilities to external AI agents (Cursor, Windsurf, Claude Desktop):
- **stdio mode**: For WSL/IDE agents (JSON-RPC over stdin/stdout)
- **SSE mode**: For Windows Claude Desktop (Server-Sent Events)

## Important Implementation Details

### Environment Variables (Phase 8 Updates)

**Required:**
- `DATABASE_URL`: PostgreSQL connection string
- `ANTHROPIC_API_KEY`: Required for Claude Agent SDK
- `OLLAMA_BASE_URL`: Local Ollama endpoint (default: http://localhost:11434)

**Search Configuration:**
- `SEARCH_MODE`: `vector` (default) or `hybrid`
- `ENABLE_TRUST_SCORING`: `false` (default) or `true`
- `HYBRID_VECTOR_WEIGHT`: Default 0.7
- `HYBRID_BM25_WEIGHT`: Default 0.3
- `FTS_LANGUAGE`: PostgreSQL full-text search language (default: english)

**Embedding Providers:**
- `DOC_EMBEDDING_PROVIDER`: Default provider for docs (default: ollama)
- `CODE_EMBEDDING_PROVIDER`: Provider for code (default: voyage)
- `WRITING_EMBEDDING_PROVIDER`: Provider for personal notes (default: openai)
- `EMBEDDING_MODEL`: Ollama model name (default: nomic-embed-text)
- `OPENAI_API_KEY`: Required if using OpenAI provider
- `VOYAGE_API_KEY`: Required if using Voyage provider

**Other:**
- `STORAGE_PATH`: Local file storage for uploaded documents
- `SERVER_PORT`, `WEB_PORT`, `MCP_PORT`: Service ports

### Hybrid Search Implementation

**Key file:** `apps/server/src/services/hybrid.ts`

Hybrid search runs vector and BM25 searches in parallel, then fuses results:
```typescript
const [vectorResults, bm25Results] = await Promise.all([
  searchCollection(db, { query, collectionId, topK: expandedTopK }),
  bm25Search(db, { query, collectionId, topK: expandedTopK })
]);

const fused = fuseResults(vectorResults, bm25Results, weights, rrfK);
```

**RRF Fusion Logic:**
1. Fetch 3x topK results from each method
2. Compute RRF score: `1 / (k + rank + 1)` per result per method
3. Weight scores: `vectorScore * 0.7 + bm25Score * 0.3`
4. Sort by fused score, return topK

### Embedding Provider Selection

**Key file:** `apps/server/src/services/embedding-router.ts`

Provider selection happens at embedding time:
```typescript
const config = selectEmbeddingProvider(content, {
  type: metadata.doc_type,      // 'code' | 'docs' | 'personal'
  language: metadata.language,   // e.g., 'typescript'
  isPersonalCollection: true     // personal notes collection flag
});

// Returns: { provider: 'voyage', model: 'voyage-code-2', dimensions: 1024 }
```

**Important:** Mixed-provider collections work because search infers the provider from collection metadata and uses the same provider for query embedding.

### Agent Tool Execution
When implementing or modifying agent tools:
1. Tool definitions go in `buildAgentTools()` in `apps/server/src/agent/tools.ts`
2. Each tool has a Zod schema for input validation
3. Executors are async functions that receive validated input
4. Return structured results that Claude can parse (prefer JSON strings)
5. Context (`collectionId`) is passed via tool context

### Vector Search
Vector similarity search uses pgvector's cosine distance operator (`<=>`):
```sql
SELECT text, embedding <=> $1::vector AS distance
FROM chunks
WHERE doc_id IN (SELECT id FROM documents WHERE collection_id = $2)
ORDER BY embedding <=> $1::vector
LIMIT $3
```

**Provider Inference:** Search automatically detects which embedding provider was used for a collection and uses the same provider for query embedding to ensure dimension compatibility.

### File Processing
- Supported formats: PDF, DOCX, Markdown
- Max upload size: 100MB (configured in multipart plugin)
- Storage: Files saved to `${STORAGE_PATH}/${collectionId}/${docId}.*`
- Status tracking: pending → extracting → chunking → embedding → complete
- Metadata enrichment: Provider, doc_type, language auto-detected

### Testing Strategy
- Unit tests using Vitest
- Tests located alongside source files in `__tests__/` directories
- Coverage target: Critical paths (agent tools, pipeline, search)
- Mock Anthropic SDK and database in tests

## Common Development Patterns

### Adding a New Agent Tool
1. Define tool schema and executor in `apps/server/src/agent/tools.ts`
2. Add to `buildAgentTools()` return value
3. Update system prompt in `apps/server/src/agent/agent.ts` if needed
4. Write unit tests in `apps/server/src/agent/__tests__/tools.test.ts`

### Adding a New Embedding Provider
1. Create client module in `apps/server/src/services/` (see `openai.ts`, `voyage.ts`)
2. Implement `embed()` function with signature: `(texts: string[]) => Promise<number[][]>`
3. Add provider config to `PROVIDER_CONFIGS` in `embedding-router.ts`
4. Update `isEmbeddingProvider()` type guard
5. Update `.env.example` with new provider config

### Switching Search Modes
```bash
# Vector-only (default, fastest)
SEARCH_MODE=vector

# Hybrid with RRF fusion (better recall)
SEARCH_MODE=hybrid

# Enable trust scoring (boosts official sources)
ENABLE_TRUST_SCORING=true

# Adjust hybrid weights (must sum to 1.0)
HYBRID_VECTOR_WEIGHT=0.8
HYBRID_BM25_WEIGHT=0.2
```

### Database Queries
- Use parameterized queries ($1, $2) to prevent SQL injection
- Connection pooling via `@synthesis/db` package
- Always await `pool.query()` calls
- Handle errors gracefully with try/catch

### Frontend State Management
- React Query for server state caching
- React Context for active collection
- Local state for UI (forms, modals)
- API client in `apps/web/src/lib/api.ts`

### Adding New Routes
1. Create route file in `apps/server/src/routes/`
2. Register with Fastify in `apps/server/src/index.ts`
3. Use Zod schemas for request validation
4. Return typed responses with proper error handling

## Development Notes

### Phase Progression
The project has been developed in phases (see `docs/phases/`):
- **Phase 1-2**: Database + ingestion pipeline
- **Phase 3**: Agent tools + search
- **Phase 4**: Autonomous web crawling
- **Phase 5**: Frontend UI + collections
- **Phase 6**: MCP server
- **Phase 7**: Docker integration
- **Phase 8**: Hybrid search + multi-model embeddings (COMPLETED)
- **Phase 9**: Reranking + synthesis engine (planned)
- **Phase 10**: Code chunking (planned)

### Current Branch Strategy
- Feature branches: `feature/phase-X-description`
- Main development on `feature/phase-8-hybrid-search-multi-model`
- No explicit main branch configured (local development focused)

### Performance Considerations
- Ollama embeddings: ~50 chunks/sec with GPU
- OpenAI embeddings: ~100 chunks/sec (API limit dependent)
- Voyage embeddings: ~80 chunks/sec (API limit dependent)
- Vector search: <500ms with HNSW index
- Hybrid search: ~800ms (parallel vector + BM25)
- Agent multi-step: <10 seconds for 3-step workflows
- Consider batch embedding for large documents (all providers support batching)

### Known Limitations (Current)
- No authentication (local use only)
- No background job queue (synchronous processing)
- No query caching (Redis planned for Phase 2+)
- Single Postgres/Ollama instance
- BM25 requires PostgreSQL full-text search setup (applied via migrations)

### Troubleshooting

**Ollama not responding:**
```bash
systemctl status ollama
systemctl restart ollama
```

**Database connection failed:**
```bash
docker compose ps
docker compose logs synthesis-db
```

**pgvector errors:**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
\dx
```

**Port conflicts:**
```bash
lsof -i :PORT
kill -9 <PID>
```

**Mixed provider dimension errors:**
- Ensure query uses same provider as collection documents
- Check `embedding_provider` in document metadata
- Smart search automatically handles this via `inferCollectionEmbeddingHint()`

**BM25 not working:**
```sql
-- Verify tsvector column exists
\d chunks

-- Check if GIN index exists
\di chunks_fts_idx
```

## Key Documentation Files

For deeper understanding of specific areas:
- Architecture: `docs/02_ARCHITECTURE.md`
- Database schema: `docs/03_DATABASE_SCHEMA.md`
- Agent tools specification: `docs/04_AGENT_TOOLS.md`
- API specification: `docs/05_API_SPEC.md`
- RAG pipeline: `docs/06_PIPELINE.md`
- Environment setup: `docs/10_ENV_SETUP.md`
- Phase 8 overview: `docs/phases/phase-8/00_PHASE_8_OVERVIEW.md`
- Hybrid search architecture: `docs/phases/phase-8/01_HYBRID_SEARCH_ARCHITECTURE.md`
- Embedding providers: `docs/phases/phase-8/02_EMBEDDING_PROVIDERS.md`
- Trust scoring: `docs/phases/phase-8/04_TRUST_SCORING.md`
- Phase details: `docs/phases/`

## Critical Code Locations

- Agent orchestrator: `apps/server/src/agent/agent.ts:94` (runAgentChat function)
- Tool definitions: `apps/server/src/agent/tools.ts`
- Smart search orchestrator: `apps/server/src/services/search.ts:42` (smartSearch function)
- Hybrid search with RRF: `apps/server/src/services/hybrid.ts:26` (hybridSearch function)
- RRF fusion logic: `apps/server/src/services/hybrid.ts:72` (fuseResults function)
- Provider selection: `apps/server/src/services/embedding-router.ts:45` (selectEmbeddingProvider)
- Code detection: `apps/server/src/services/embedding-router.ts:83` (isCodeContent)
- Trust scoring: `apps/server/src/services/search.ts:202` (applyTrustScoring)
- Vector search logic: `apps/server/src/services/vector.ts`
- Database pool initialization: `apps/server/src/index.ts:22-27`
- RAG pipeline: `apps/server/src/pipeline/ingest.ts`
- Migration runner: `packages/db/src/migrate.ts`
