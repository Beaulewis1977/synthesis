# Synthesis RAG

[![CI](https://github.com/beaulewis1977/synthesis/workflows/CI/badge.svg)](https://github.com/beaulewis1977/synthesis/actions)

Autonomous RAG system powered by Claude Agent SDK for multi-project documentation management.

## 📚 Documentation

See [docs/00_START_HERE.md](docs/00_START_HERE.md) to begin.

## 🚀 Quick Start

1. **Setup Environment:** Follow [docs/10_ENV_SETUP.md](docs/10_ENV_SETUP.md)
2. **Start Building:** See [docs/09_BUILD_PLAN.md](docs/09_BUILD_PLAN.md)
3. **Agent Workflow:** Read [docs/agents.md](docs/agents.md)

## 🎯 Status

🚧 **Under Active Development** - Starting Phase 1

## 📋 Tech Stack

- **Backend:** Node.js 22, Fastify, TypeScript
- **Frontend:** React, Vite, Tailwind CSS
- **Database:** PostgreSQL + pgvector
- **AI:** Claude Agent SDK, Ollama
- **Deployment:** Docker Compose

## ✨ Key Features

### Code Intelligence (Phase 13)

**AST-based code chunking** that preserves code structure:
- ✅ Functions stay intact (no mid-function breaks)
- ✅ Imports preserved with code chunks
- ✅ File relationships tracked
- ✅ Supports Dart, TypeScript, JavaScript

**Enable code intelligence:**
```bash
CODE_CHUNKING=true
PRESERVE_IMPORTS=true
TRACK_RELATIONSHIPS=true
```

**Result:** Search returns complete, usable code snippets instead of fragmented text.

See [Code Chunking Guide](docs/CODE_CHUNKING_GUIDE.md) for full documentation.

### Hybrid Search (Phase 8)

**Smart search** with multiple modes:
- Vector-only (fast, semantic)
- Hybrid with RRF fusion (better recall)
- Multi-provider embeddings (Ollama, OpenAI, Voyage)
- Trust scoring for source quality

### Re-ranking & Synthesis (Phase 12)

**Post-processing** for better results:
- Re-rank results with BGE or Cohere
- Synthesize answers from multiple sources
- Detect contradictions
- Cost tracking and budget management

## 📖 Planning Docs

All planning documentation is in the [docs/](docs/) directory.
