# Autonomous RAG System - Complete Plan
**Created:** October 6, 2025  
**Timeline:** 7-9 days to working MVP  
**Type:** Multi-project autonomous RAG with Claude Agent SDK

---

## 🎯 What You're Building

An **autonomous RAG system** where a Claude-powered agent helps you manage and search multiple project documentation collections. The agent can:

- ✅ Upload and process docs (PDF, DOCX, Markdown)
- ✅ Autonomously fetch and scrape web documentation
- ✅ Manage multiple project collections
- ✅ Search semantically with vector similarity
- ✅ Answer questions with citations
- ✅ Accessible via chat UI and MCP (for other AI agents)

---

## 📚 Documentation Index

**Read in this order:**

1. **`01_TECH_STACK.md`** - Technologies, versions, dependencies
2. **`02_ARCHITECTURE.md`** - System design, components, data flow
3. **`03_DATABASE_SCHEMA.md`** - Tables, indexes, migrations
4. **`04_AGENT_TOOLS.md`** - Claude Agent SDK tools specification
5. **`05_API_SPEC.md`** - Backend API endpoints
6. **`06_PIPELINE.md`** - Ingestion and RAG pipeline details
7. **`07_MCP_SERVER.md`** - MCP integration for external agents
8. **`08_UI_SPEC.md`** - Frontend pages and components
9. **`09_BUILD_PLAN.md`** - Day-by-day implementation roadmap
10. **`10_ENV_SETUP.md`** - Environment setup and Docker

---

## 🚀 Quick Start (After Build)

```bash
# 1. Setup environment
cp .env.example .env
# Edit .env with your API keys

# 2. Start services
docker compose up -d

# 3. Run migrations
pnpm migrate

# 4. Start backend
pnpm --filter @synthesis/server dev

# 5. Start frontend
pnpm --filter @synthesis/web dev

# 6. Start MCP server (optional)
pnpm --filter @synthesis/mcp start
```

Visit http://localhost:5173

---

## 🎯 Key Features (MVP Scope)

### Core Capabilities
- ✅ Multi-project collections with easy switching
- ✅ Upload PDF/DOCX/Markdown files
- ✅ Autonomous web crawling (agent fetches docs from URLs)
- ✅ Full RAG pipeline (extract → chunk → embed → vectorize → search)
- ✅ Semantic + vector search with pgvector
- ✅ Chat with agent about your docs
- ✅ Agent autonomously manages knowledge base
- ✅ MCP server for IDE agents (Cursor, Windsurf, etc.)
- ✅ MCP server for Claude Desktop (Windows)

### LLM Flexibility
- Claude Agent SDK (autonomy, web crawling)
- Ollama fallback (cost savings, local)
- Toggle between them

### Deployment
- Local development
- Docker Compose production
- Room for future cloud deployment

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────┐
│              You (User)                     │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│        Chat UI (Collection Switcher)         │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│      Claude Agent SDK (Orchestrator)         │
│  Tools: search, add_doc, fetch_web,          │
│         list_docs, delete_doc                │
└──────────┬───────────────────────────────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
┌─────────┐  ┌──────────────┐
│   MCP   │  │  Fastify API │
│ Server  │  │   Backend    │
└─────────┘  └──────┬───────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  Postgres + pgvector  │
        │  (Semantic search)    │
        └───────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  Ollama (Local GPU)   │
        │  (Embeddings)         │
        └───────────────────────┘
```

---

## ⏱️ Build Timeline

**Day 1-2:** Database + ingestion pipeline  
**Day 3:** Agent tools + basic search  
**Day 4:** Autonomous web crawling  
**Day 5:** Collections UI + chat  
**Day 6:** MCP server (WSL + Windows)  
**Day 7:** Docker setup + testing  
**Days 8-9:** Polish + documentation  

---

## 💰 Cost Estimate

**Development:**
- Ollama embeddings: FREE (your GPU)
- Postgres: FREE (Docker)
- Claude API (dev): ~$50-100 for build phase

**Monthly Usage (YOU only):**
- Claude Agent SDK: ~$200-300/month
- Ollama: FREE
- Infrastructure: FREE (local/Docker)

**Total: ~$200-300/month for autonomous RAG**

---

## 🎯 Success Criteria

### Must Work:
1. Create 3 project collections (Flutter, Supabase, Personal)
2. Upload 20+ docs across collections
3. Agent autonomously fetches docs from URLs
4. Switch between collections in UI
5. Chat with agent, get answers with citations
6. Search works with semantic similarity
7. IDE agents access via MCP
8. Claude Desktop accesses via MCP (Windows)
9. Toggle between Claude and Ollama
10. Runs with `docker compose up`

### Future Enhancements (Post-MVP):
- Beautiful UI (your mockups)
- Advanced chunking strategies
- Reranking
- Export conversations
- Scheduled doc updates
- Multi-user (if SaaS)

---

## 📖 Next Steps

1. **Read the docs** in order (01 through 10)
2. **Ask questions** if anything unclear
3. **Review the build plan** (09_BUILD_PLAN.md)
4. **When ready**, start Day 1 implementation

---

## 🚨 Important Notes

### Not Over-Engineered
- Simple but complete
- Room to grow
- Focus on working > perfect

### Autonomous-First
- Agent makes decisions
- Multi-step workflows
- Proactive suggestions

### Multi-Project Ready
- Collections from day 1
- Easy switching
- Isolated contexts

### MCP Dual-Mode
- WSL for IDE agents
- Windows for Claude Desktop
- Same backend, different entry points

---

Let's build your autonomous RAG system! 🚀
