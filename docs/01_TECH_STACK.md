# Tech Stack & Dependencies
**Version:** 1.0  
**Last Updated:** October 6, 2025

---

## 🎯 Technology Decisions

### Core Principles
- ✅ Local-first with cloud options
- ✅ Docker-ready from day 1
- ✅ Modern TypeScript throughout
- ✅ Proven technologies over bleeding edge

---

## 🖥️ Development Environment

### Required
- **OS:** Windows 11 + WSL2 (Ubuntu 24.04) OR Linux/macOS
- **Node.js:** 22.x LTS
- **Package Manager:** pnpm 9.12.x
- **Docker:** Desktop 4.33+ (with WSL2 integration on Windows)
- **GPU:** NVIDIA with 16GB VRAM (for Ollama)

### Recommended
- **Terminal:** Windows Terminal 1.20+
- **Editor:** VS Code, Cursor, or Windsurf
- **Git:** 2.40+

---

## 🏗️ Backend Stack

### Runtime & Framework
```json
{
  "node": "22.8.x",
  "typescript": "^5.6.2",
  "fastify": "^4.28.1",
  "fastify-plugin": "^4.5.1",
  "@fastify/cors": "^10.0.1",
  "@fastify/multipart": "^8.3.0"
}
```

### Database & Vector Store
```json
{
  "pg": "^8.12.0",
  "@types/pg": "^8.11.6",
  "pgvector": "^0.2.0"
}
```

**Database:** PostgreSQL 16.4  
**Extension:** pgvector 0.7.4  
**Index:** HNSW (cosine similarity)

### Agent & AI
```json
{
  "@anthropic-ai/agent-sdk": "^0.4.0",
  "@anthropic-ai/sdk": "^0.27.0"
}
```

**Model:** claude-3-5-sonnet-20241022  
**Purpose:** Autonomous orchestration, tool calling, web crawling

### Document Processing
```json
{
  "pdf-parse": "^1.1.1",
  "mammoth": "^1.6.0",
  "unified": "^11.0.4",
  "remark": "^15.0.1",
  "remark-parse": "^11.0.0",
  "remark-frontmatter": "^5.0.0",
  "remark-gfm": "^4.0.0"
}
```

### Web Scraping (Agent-Driven)
```json
{
  "cheerio": "^1.0.0-rc.12",
  "playwright": "^1.40.0"
}
```

**Note:** Claude Agent SDK handles crawling logic

### Utilities
```json
{
  "dotenv": "^16.4.5",
  "zod": "^3.23.8",
  "pino": "^9.4.0",
  "undici": "^6.19.8"
}
```

---

## 🎨 Frontend Stack

### Core
```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "^6.26.2"
}
```

### Build & Dev
```json
{
  "vite": "^5.4.8",
  "@vitejs/plugin-react": "^4.3.2",
  "typescript": "^5.6.2"
}
```

### UI & Styling
```json
{
  "tailwindcss": "^3.4.13",
  "autoprefixer": "^10.4.20",
  "postcss": "^8.4.47",
  "lucide-react": "^0.445.0"
}
```

**Icons:** Lucide React (modern, tree-shakeable)

### State Management
```json
{
  "@tanstack/react-query": "^5.56.2"
}
```

**Pattern:** Server state with React Query, local state with hooks

---

## 🔌 MCP Integration

### MCP Server
```json
{
  "@modelcontextprotocol/sdk": "^1.0.0"
}
```

**Protocols:** stdio (WSL/IDE), SSE (Windows/Claude Desktop)

---

## 🤖 Local LLM (Ollama)

### Installation
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

### Models
```bash
ollama pull nomic-embed-text    # Embeddings (768 dims, 270MB)
ollama pull llama3.2:3b          # Chat fallback (2GB)
ollama pull qwen2.5-coder:3b     # Code-focused (2GB)
```

### Client
```json
{
  "ollama": "^0.5.8"
}
```

**Base URL:** http://localhost:11434

---

## 🐳 Docker Services

### Core Services (docker-compose.yml)
```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    # Postgres with pgvector extension
    
  server:
    build: ./apps/server
    # Fastify backend
    
  web:
    build: ./apps/web
    # React frontend
    
  mcp:
    build: ./apps/mcp
    # MCP server
    
  ollama:
    image: ollama/ollama:latest
    # Local LLM runtime
```

---

## 📦 Monorepo Structure

### Package Manager
**pnpm** with workspaces

### Layout
```
synthesis/
├── apps/
│   ├── server/      # Fastify backend
│   ├── web/         # React frontend
│   └── mcp/         # MCP server
├── packages/
│   ├── db/          # Database client & migrations
│   └── shared/      # Shared types & utilities
└── docker/          # Dockerfiles
```

---

## 🔐 Environment Variables

### Required
```bash
# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/synthesis

# Claude
ANTHROPIC_API_KEY=sk-ant-...

# Ollama (local)
OLLAMA_HOST=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text

# Server
SERVER_PORT=3333
WEB_PORT=5173

# Storage
STORAGE_PATH=./storage
```

### Optional
```bash
# Voyage (if not using Ollama)
VOYAGE_API_KEY=pa-...

# MCP
MCP_PORT=3334

# Toggle LLM
USE_LOCAL_LLM=false  # false = Claude, true = Ollama
```

---

## 🧪 Testing & Quality

### Testing
```json
{
  "vitest": "^2.1.4",
  "@testing-library/react": "^16.0.1",
  "@testing-library/jest-dom": "^6.5.0"
}
```

### Linting
```json
{
  "@biomejs/biome": "^1.9.3"
}
```

**Config:** Biome for fast linting and formatting

### Type Safety
- Strict TypeScript mode
- Zod for runtime validation
- tRPC for type-safe API (optional, Phase 2)

---

## 📊 Vector Embeddings

### Primary: Ollama (Local)
- **Model:** nomic-embed-text
- **Dimensions:** 768
- **Cost:** FREE (your GPU)
- **Speed:** ~50 docs/sec on 16GB VRAM
- **Pros:** Free, private, fast
- **Cons:** Slightly lower quality than cloud

### Fallback: Voyage AI (Cloud)
- **Model:** voyage-3.5
- **Dimensions:** 1024
- **Cost:** $0.06 per 1M tokens
- **Speed:** Rate limited
- **Pros:** Higher quality
- **Cons:** Costs money, requires internet

**Default:** Ollama (toggle-able)

---

## 🔍 Search Strategy

### Vector Search
- **Index:** HNSW (pgvector)
- **Similarity:** Cosine
- **Top-K:** Configurable (default 10)

### Hybrid Search (Phase 2)
- **Option:** Add BM25 for keyword matching
- **Not MVP:** Keep simple for now

---

## 🎯 Chunking Strategy

### MVP Approach
- **Size:** 800 characters per chunk
- **Overlap:** 150 characters
- **Method:** Simple split on paragraph boundaries

### Phase 2 Enhancements
- Semantic chunking (sentence-transformers)
- Code-aware chunking
- Table/figure extraction

---

## 📝 Migrations

### Tool
**Plain SQL migrations** (no ORM initially)

### Structure
```
packages/db/migrations/
├── 001_initial_schema.sql
├── 002_add_collections.sql
└── 003_add_indexes.sql
```

### Execution
```bash
pnpm migrate        # Apply all
pnpm migrate:down   # Rollback last
```

**Future:** Consider Drizzle if schema gets complex

---

## 🔄 API Communication

### HTTP Client (Frontend)
- **Fetch API** with React Query
- **Alternative:** Axios (if needed)

### WebSockets (Future)
- For streaming agent responses
- For real-time processing updates

---

## 🚀 Build Tools

### Backend
```json
{
  "tsup": "^8.3.0",
  "tsx": "^4.19.1"
}
```

**Dev:** tsx watch  
**Build:** tsup for production bundles

### Frontend
**Vite** with React plugin

---

## 📊 Observability (Minimal MVP)

### Logging
- **pino** for structured logs
- Log to stdout (Docker captures)

### Metrics (Future)
- Prometheus export
- Search latency tracking
- Embedding throughput

---

## 🔧 Development Tools

### Git Hooks
```json
{
  "husky": "^9.1.6"
}
```

**Hooks:**
- pre-commit: lint + format
- pre-push: tests

---

## 🌐 Browser Support

### Targets
- Chrome/Edge 120+
- Firefox 120+
- Safari 17+

**No IE11** support needed

---

## 📦 Bundle Sizes (Target)

### Frontend
- **Initial:** < 200KB (gzipped)
- **React + Router:** ~130KB
- **TanStack Query:** ~15KB
- **App code:** ~50KB

### Backend
- **Docker image:** < 500MB
- **Node + deps:** ~400MB
- **App code:** ~50MB

---

## 🔐 Security Considerations

### API
- CORS configured for local dev
- Optional API key for production
- Rate limiting (Phase 2)

### Data
- All docs stored locally by default
- Embeddings never leave your PC (Ollama)
- Claude API calls encrypted (HTTPS)

### Docker
- Non-root user
- Health checks
- Resource limits

---

## 📚 Documentation Tools

### In-Code
- TSDoc comments for complex logic
- README per package

### API Docs
- OpenAPI spec (generated from Zod schemas)
- Served at `/api/docs`

---

## 🎯 Version Matrix

| Component | Version | Notes |
|-----------|---------|-------|
| Node.js | 22.8.x | LTS |
| pnpm | 9.12.x | Workspaces |
| TypeScript | 5.6.x | Strict mode |
| Fastify | 4.28.x | HTTP server |
| React | 18.3.x | UI framework |
| Postgres | 16.4 | Database |
| pgvector | 0.7.4 | Vector extension |
| Ollama | Latest | Local LLM |
| Claude | 3.5 Sonnet | Agent orchestration |

---

## 🔄 Upgrade Path

### When to Upgrade
- **Node:** When 24.x is LTS
- **React:** When 19 is stable
- **Postgres:** Test 17.x in Phase 2
- **pgvector:** 0.8.x when available

### Breaking Changes to Watch
- Agent SDK API changes
- pgvector index format changes
- React 19 new hooks

---

## ✅ Installation Checklist

### Day 0 Setup
- [ ] Install Node 22.x (via nvm)
- [ ] Install pnpm 9.12.x
- [ ] Install Docker Desktop
- [ ] Install Ollama + models
- [ ] Clone repo
- [ ] `pnpm install`
- [ ] `docker compose up -d db`
- [ ] Test Ollama: `ollama run llama3.2:3b "hello"`
- [ ] Test Anthropic API key
- [ ] Apply migrations
- [ ] Start dev servers

---

**This stack is proven, not bleeding-edge, and gets you to working MVP fast.**


### Tooling updates
- Husky hooks now execute pnpm scripts directly without legacy shims.