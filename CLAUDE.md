# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Synthesis** is an autonomous RAG (Retrieval-Augmented Generation) system for multi-project documentation management. The system enables developers to manage multiple documentation collections, search semantically using pgvector, and interact via a chat UI, MCP server, or external AI agents.

**Tech Stack:**
- Backend: Node.js 22, Fastify, TypeScript
- Frontend: React, Vite, Tailwind CSS
- Database: PostgreSQL 16 + pgvector 0.7.4
- AI: Anthropic SDK (Claude models), Ollama (local fallback)
- Embeddings: Multi-provider (Ollama, OpenAI, Voyage)
- Search: Hybrid search with Reciprocal Rank Fusion (RRF)
- Caching: Redis for search/rerank caching
- Deployment: Docker Compose
- Monorepo: pnpm workspaces + Turbo

## Development Commands

### Initial Setup
```bash
pnpm install
cp .env.example .env  # Configure ANTHROPIC_API_KEY

# Start infrastructure (PostgreSQL + Ollama + Redis)
pnpm docker:dev
# OR: docker compose up -d synthesis-db synthesis-ollama synthesis-redis

# Apply migrations
pnpm --filter @synthesis/db migrate

# Pull Ollama models
ollama pull nomic-embed-text
ollama pull llama3.2:3b  # optional for local chat
```

### Development Workflow
```bash
# Backend (port 3333)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/synthesis" \
ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
OLLAMA_BASE_URL="http://localhost:11434" \
STORAGE_PATH="/home/kngpnn/dev/synthesis/storage" \
pnpm --filter @synthesis/server dev

# Frontend (port 5173)
pnpm --filter @synthesis/web dev

# Desktop app (Tauri)
pnpm --filter @synthesis/desktop dev

# MCP server (optional)
pnpm --filter @synthesis/mcp dev
```

### Testing & Quality
```bash
pnpm test              # All tests
pnpm test:watch        # Watch mode
pnpm typecheck         # Type checking
pnpm typecheck:server  # Server only
pnpm lint && pnpm format
```

### Docker Operations
```bash
pnpm docker:dev   # Infrastructure only (db + ollama + redis)
pnpm docker:up    # All services
pnpm docker:down  # Stop all
pnpm docker:logs  # View logs
```

### Database Operations
```bash
pnpm --filter @synthesis/db migrate
docker compose exec synthesis-db psql -U postgres -d synthesis
```

### Health Checks
```bash
curl http://localhost:3333/health
curl http://localhost:11434/api/tags
```

## Architecture Overview

### Monorepo Structure
```
synthesis/
├── apps/
│   ├── server/     # Fastify backend API
│   ├── web/        # React frontend (Vite)
│   ├── desktop/    # Desktop app (Tauri)
│   └── mcp/        # MCP server
├── packages/
│   ├── db/         # Database client, migrations, queries
│   └── shared/     # Shared types and utilities
└── docs/           # Planning & phase docs
```

### Key Backend Components (`apps/server/src/`)
```
├── agent/          # Agent orchestrator & tools
├── routes/         # HTTP endpoints (collections, search, ingest, chat)
├── pipeline/       # Extract → Chunk → Embed pipeline
├── services/       # Search, embeddings, reranking, synthesis
└── db/             # Server-specific queries
```

### Database Schema
```sql
collections (id, name, description, created_at, updated_at)
documents (id, collection_id, title, file_path, status, metadata JSONB)
chunks (id, doc_id, chunk_index, text, embedding VECTOR(768|1024|1536), metadata JSONB)
```
- **Vector index**: HNSW for cosine similarity
- **Full-text search**: tsvector with GIN index for BM25
- **Variable dimensions**: 768 (Ollama), 1024 (Voyage), 1536 (OpenAI)

### Search Architecture
- **Vector mode** (default): Query → Embed → pgvector cosine → Top-K
- **Hybrid mode**: Vector + BM25 → Reciprocal Rank Fusion
- **Trust scoring** (optional): Boosts by source quality and recency

### Multi-Provider Embeddings
- **Ollama** (nomic-embed-text): Free local, general docs
- **Voyage** (voyage-code-3): Code documentation ⭐ **Best for code**
- **OpenAI** (text-embedding-3-large): Personal writing
- Auto-detection routes content to appropriate provider

### RAG Pipeline
```
Upload → Extract (PDF/DOCX/MD) → Chunk (800 chars) → Provider Selection → Embed → pgvector
```

---

## Search Best Practices

**Optimal settings for code:** `voyage-code-3` + `vector` mode + no reranker + graph off = **MRR 1.000**

| Setting | Code Repos | Documentation |
|---------|------------|---------------|
| Embedding | **voyage-code-3** (2x better) | nomic-embed-text |
| Search mode | vector | vector |
| Reranker | none (hurts code!) | none |
| Graph | off (unless cross-file) | off |

**Key findings:**
- voyage-code-3 provides **2x better MRR** than nomic for code
- Rerankers **hurt** code search (-10% MRR)
- Graph expansion only helps cross-file queries ("what imports X?")
- Use 5-10 word queries with specific terms

## Ingestion Best Practices

```bash
# Ingest file
curl -X POST "http://localhost:3333/api/ingest" \
  -F "collection_id=${COLLECTION_ID}" -F "file=@/path/to/file.md"

# Re-embed with voyage-code-3 (recommended for code)
pnpm re-embed --collection <uuid> --provider voyage --model voyage-code-3

# Build knowledge graph
curl -X POST "http://localhost:3333/api/graph/build/${COLLECTION_ID}"
```

**Metadata for filtering:**
```json
{ "tech_stack": ["flutter"], "feature_tags": ["auth"], "platform": ["mobile"] }
```

## Evaluation

```bash
# Regenerate ground truth BEFORE eval (critical!)
node perf/regenerate-ground-truth.mjs perf/eval_datasets/your-dataset.json

# Run evaluation
pnpm eval:retrieval --eval-mode=doc --search-mode=vector
```

**Targets:** MRR >0.9, Hit Rate 100%, Recall@10 >90%, Latency <10ms

---

### MCP Server
Exposes RAG to external agents (Cursor, Windsurf, Claude Desktop):
- **stdio**: WSL/IDE agents
- **SSE**: Windows Claude Desktop

## Environment Variables

**Required:**
- `DATABASE_URL`: PostgreSQL connection
- `ANTHROPIC_API_KEY`: For Anthropic SDK
- `OLLAMA_BASE_URL`: Local Ollama (default: http://localhost:11434)

**Search:**
- `SEARCH_MODE`: `vector` (default) or `hybrid`
- `ENABLE_TRUST_SCORING`: `false` (default) or `true`
- `HYBRID_VECTOR_WEIGHT`/`HYBRID_BM25_WEIGHT`: Default 0.7/0.3

**Embeddings:**
- `DOC_EMBEDDING_PROVIDER`: Default ollama
- `CODE_EMBEDDING_PROVIDER`: Default voyage
- `WRITING_EMBEDDING_PROVIDER`: Default openai
- `OPENAI_API_KEY`/`VOYAGE_API_KEY`: If using those providers

**Other:**
- `STORAGE_PATH`: File storage location
- `REDIS_URL`: Redis for caching (optional)

## Skills & Patterns

**Project skills** (`.claude/skills/`):
- `synthesis-architecture` - Routes, services, agent tools, db patterns
- `llm-provider-integration` - Multi-provider LLM (OpenAI, Anthropic, Google, Ollama, Zhipu, Moonshot)
- `sse-streaming` - Server-Sent Events for Fastify + React streaming

**Global skills** (useful for this project):
- `backend-development` - Node.js/Fastify patterns, API design
- `frontend-design` - React UI components and patterns
- `gh` - GitHub CLI for PRs and issues
- `planning` - Breaking down implementation tasks
- `brainstorming` - Design decisions and alternatives
- `creating-subagents` - Custom subagents for context efficiency

### Import Patterns
```typescript
// From apps/server
import { getPool, query } from '@synthesis/db';
import { PROVIDER_INFO, ModelFeature } from '@synthesis/shared';
import { smartSearch } from './services/search.js';
```

### Key API Endpoints
- `POST /api/agent/chat` - Chat with RAG agent
- `POST /api/search` - Vector/hybrid search
- `POST /api/ingest` - Upload documents
- `GET/POST /api/collections` - CRUD collections
- `GET/POST /api/documents` - CRUD documents

## Implementation Notes

### Agent System
The chat agent (`apps/server/src/agent/agent.ts`) implements a 10-turn agentic loop:
- Tools: search_rag, add_document, fetch_web_content, list_documents, etc.
- Multi-step workflows with autonomous tool chaining

### Agent Tools
See `synthesis-architecture` skill for full patterns. Key points:
- Definitions in `buildAgentTools()` in `tools.ts`
- Zod schemas for validation
- Return JSON strings for Claude parsing

### ModelConfigService
Singleton for model configuration with 60s cache:
```typescript
import { getModelConfigService } from './services/model-config-service.js';
const configService = getModelConfigService(db);
const chatConfig = await configService.getConfig('chat');
// Returns: { provider: 'anthropic', model: 'claude-...', source: 'db' }
```

### Vector Search
```sql
SELECT text, embedding <=> $1::vector AS distance FROM chunks ...
```
Provider auto-inferred from collection metadata for dimension compatibility.

### File Processing
- Formats: PDF, DOCX, Markdown
- Max: 100MB
- Status: pending → extracting → chunking → embedding → complete

### Testing
- Vitest with tests in `__tests__/` directories
- Mock Anthropic SDK and database

## Development Notes

### Phase Progression
- **Phase 1-7**: Foundation (DB, pipeline, agent, crawling, UI, MCP, Docker)
- **Phase 8**: Hybrid search + multi-model embeddings
- **Phase 9**: Reranking + synthesis engine
- **Phase 10**: Code chunking
- **Phase 11**: Trust & Recency Badges
- **Phase 12**: Cost Dashboard & Synthesis View
- **Phase 13**: Code Intelligence & File Relationships
- **Phase 14**: Tech Stack Filtering
- **Phase 15**: Integration & Polish (COMPLETED)
- **Phase 16**: Multi-Provider Chat & UI Improvements (IN PROGRESS)

### Branch Strategy
- Feature branches: `feature/phase-X-description`
- Integration branch: `develop`
- All work branches off `develop`

### Current Status
- **Active Branch**: `feature/phase-16-multi-provider-chat`
- **Focus**: Multi-provider chat (Anthropic, OpenAI, Ollama, Google, GLM, Kimi), SSE streaming, UI improvements

### Performance
- Ollama embeddings: ~50 chunks/sec (GPU)
- Vector search: <500ms (HNSW)
- Hybrid search: ~800ms (parallel)
- Agent multi-step: <10s for 3-step workflows

### Known Limitations
- No authentication (local use only)
- No background job queue (synchronous)
- Single Postgres/Ollama instance

## Troubleshooting

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
```

**Port conflicts:**
```bash
lsof -i :PORT
kill -9 <PID>
```

**Mixed provider dimension errors:**
- Check `embedding_provider` in document metadata
- Smart search handles this via `inferCollectionEmbeddingHint()`

**BM25 not working:**
```sql
\d chunks  -- Verify tsvector column
\di chunks_fts_idx  -- Check GIN index
```
- all branches must be off of develop and all pr's will be to develop for merging after i review them
- don't commit or push without my permission, ever
- always look for specialized subagents or create subagents with the subagent skill to save on context window bloat
- be sure to use context7 mcp server when needed
- when having trouble- stop, take a deep breath and then research, web search, plan, then fix