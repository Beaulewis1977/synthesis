# Synthesis RAG

[![CI](https://github.com/beaulewis1977/synthesis/workflows/CI/badge.svg)](https://github.com/beaulewis1977/synthesis/actions)

Autonomous RAG system powered by Claude Agent SDK for multi-project documentation management.

## 🎉 What's New in v2.0

**Version 2.0.0** brings production-ready features for enterprise RAG workflows:

- **🔍 Hybrid Search** - Combine BM25 + vector search with intelligent RRF fusion
- **🧠 Multi-Provider Embeddings** - Route content to optimal providers (Voyage for code, OpenAI for writing, Ollama for docs)
- **⚡ Intelligent Re-ranking** - Post-process results with Cohere or local BGE models
- **📊 Document Synthesis** - Compare multiple sources, detect contradictions, generate consensus
- **💻 Code Intelligence** - AST-based chunking preserves function boundaries and imports
- **🔗 File Relationships** - Track imports, tests, and related files automatically
- **💰 Cost Monitoring** - Real-time budget tracking with automatic fallbacks
- **🏷️ Tech Stack Filtering** - Search by technology (Dart, TypeScript, Python, etc.)

**Migration:** See [docs/MIGRATION_v1_to_v2.md](docs/MIGRATION_v1_to_v2.md) for upgrade instructions.

## 📚 Documentation

- **[Getting Started](docs/00_START_HERE.md)** - Quick introduction
- **[Configuration Guide](docs/CONFIGURATION.md)** - All environment variables
- **[API Specification](docs/05_API_SPEC.md)** - REST API reference
- **[User Guides](docs/guides/)** - Feature-specific tutorials
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions

## 🚀 Quick Start

```bash
# 1. Clone and install
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY

# 3. Start infrastructure (PostgreSQL + Ollama)
pnpm docker:dev

# 4. Run migrations
pnpm --filter @synthesis/db migrate

# 5. Pull Ollama models
ollama pull nomic-embed-text

# 6. Start backend (port 3333)
pnpm --filter @synthesis/server dev

# 7. Start frontend (port 5173)
pnpm --filter @synthesis/web dev
```

Visit http://localhost:5173 to access the UI.

## 🎯 Status

✅ **v2.0.0 Released** - Production-ready with Phase 11-14 features complete

## 📋 Tech Stack

- **Backend:** Node.js 22, Fastify, TypeScript
- **Frontend:** React, Vite, Tailwind CSS
- **Database:** PostgreSQL 16 + pgvector 0.7.4
- **AI Models:**
  - Claude Opus 4 Sonnet (Agent SDK)
  - Ollama (nomic-embed-text, llama3.2)
  - Voyage AI (voyage-code-2)
  - OpenAI (text-embedding-3-large)
  - Cohere (rerank-english-v3.0)
- **Search:** Hybrid (pgvector + BM25 with RRF fusion)
- **Deployment:** Docker Compose
- **Monorepo:** pnpm workspaces + Turborepo

## ✨ Key Features

### 🔍 Intelligent Search

**Hybrid Search Engine:**
- BM25 keyword search + vector similarity
- Reciprocal Rank Fusion (RRF) for result merging
- Trust scoring based on source quality
- Recency weighting for up-to-date results
- Sub-600ms query latency

**Multi-Provider Embeddings:**
- Automatic content-based routing
- Voyage AI for code documentation
- OpenAI for personal writing/notes
- Ollama for general documentation (free)

📖 **Guide:** [docs/guides/HYBRID_SEARCH_GUIDE.md](docs/guides/HYBRID_SEARCH_GUIDE.md)

### 💻 Code Intelligence

**AST-Based Chunking:**
- Functions/classes preserved intact
- Imports automatically included
- Supports Dart, TypeScript, JavaScript, Python, Java
- Related file tracking (imports, tests, siblings)

**Code Search:**
- Find functions across your codebase
- Navigate file relationships
- Tech stack filtering (search by language/framework)

📖 **Guides:** [Code Chunking](docs/CODE_CHUNKING_GUIDE.md) | [Code Search](docs/guides/CODE_SEARCH_GUIDE.md)

### ⚡ Re-ranking & Synthesis

**Result Re-ranking:**
- Cross-encoder models (Cohere, BGE)
- Improves relevance by 15-30%
- Optional per-query (cost-aware)

**Multi-Source Synthesis:**
- Compare answers from multiple documents
- Detect contradictions automatically
- Generate consensus summaries
- Confidence scoring

📖 **Guide:** [docs/guides/SYNTHESIS_GUIDE.md](docs/guides/SYNTHESIS_GUIDE.md)

### 💰 Cost Management

**Real-time Tracking:**
- Monitor API costs per provider
- Set monthly budget limits
- Automatic fallback to free providers
- Cost alerts at configurable thresholds

**Provider Costs:**
- Ollama: Free (local)
- Voyage: $0.00012/1K tokens
- Cohere: $0.002/search
- OpenAI: $0.00013/1K tokens

📖 **Guide:** [docs/guides/COST_MANAGEMENT_GUIDE.md](docs/guides/COST_MANAGEMENT_GUIDE.md)

### 🤖 Autonomous Agent

**Claude Agent SDK Integration:**
- 10-turn agentic loop for complex queries
- Tool use: search, ingest, web scraping
- Context-aware conversation
- Multi-step reasoning

## 📖 Planning Docs

All planning documentation is in the [docs/](docs/) directory.
