# Autonomous RAG System - Planning Package
**Created:** October 6, 2025  
**Status:** Ready for Implementation  
**Timeline:** 7-9 days to working MVP

---

## 📚 What's In This Package

Complete specifications for building an **autonomous RAG system** powered by Claude Agent SDK with multi-project support, local embeddings, and MCP integration.

### Documentation Files

1. **`00_START_HERE.md`** ← Read this first
   - Overview and quick navigation
   - Success criteria
   - High-level architecture

2. **`01_TECH_STACK.md`**
   - All technologies and versions
   - Dependencies with rationale
   - Installation checklist

3. **`02_ARCHITECTURE.md`**
   - System design and components
   - Data flow diagrams
   - Docker architecture

4. **`03_DATABASE_SCHEMA.md`**
   - Complete schema with migrations
   - Key queries
   - Performance tuning

5. **`04_AGENT_TOOLS.md`**
   - Claude Agent SDK tool specifications
   - Implementation examples
   - Conversation patterns

6. **`05_API_SPEC.md`**
   - All REST endpoints
   - Request/response formats
   - Error handling

7. **`09_BUILD_PLAN.md`** ← Your roadmap
   - Day-by-day tasks
   - Acceptance criteria
   - Risk mitigation

8. **`10_ENV_SETUP.md`**
   - Complete setup guide
   - Docker configuration
   - Troubleshooting

9. **`11_GIT_WORKFLOW.md`**
   - Branch strategy (main/develop/feature)
   - Commit conventions
   - PR process

10. **`12_CICD_PLAN.md`**
   - GitHub Actions workflows
   - Linting and testing
   - Docker builds

11. **`13_REPO_SETUP.md`**
   - GitHub repository creation
   - Branch protection
   - Secrets configuration

12. **`14_GITHUB_ISSUES.md`**
   - Issue templates (epics and stories)
   - All issues for Phases 1-9
   - Quick creation scripts

13. **`15_AGENT_PROMPTS.md`** ⭐ IMPORTANT
   - Copy-paste prompts for agents
   - Project kickoff prompt
   - Per-phase prompts
   - Between-phase prompts

14. **`agents.md`**
   - Agent collaboration workflow
   - Review process
   - MCP server usage

15. **`PHASE_SUMMARY_TEMPLATE.md`**
   - Template for phase summaries

16. **`.coderabbit.yml`**
   - CodeRabbit configuration

17. **`FINAL_CHECKLIST.md`**
   - Pre-build checklist

18. **`SUMMARY_FOR_USER.md`**
   - Complete package summary

---

## 🎯 What You're Building

An autonomous agent that:

✅ **Manages documentation** across multiple projects  
✅ **Autonomously fetches** docs from the web  
✅ **Processes everything** (PDF, DOCX, Markdown)  
✅ **Searches semantically** with vector similarity  
✅ **Chats naturally** with citations  
✅ **Accessible via MCP** for IDE agents  

### Key Features

**Multi-Project Collections**
- Separate collections per project (Flutter, Supabase, etc.)
- Easy switching in UI
- Isolated search contexts

**Autonomous Agent (Claude SDK)**
- Natural conversation
- Multi-step workflows
- Web crawling
- Proactive suggestions

**Local-First Architecture**
- Ollama for free embeddings (your GPU)
- Toggle to Claude for chat
- Everything runs on your PC
- Docker-ready for deployment

**MCP Integration**
- stdio mode for IDE agents (Cursor, Windsurf)
- SSE mode for Claude Desktop (Windows)
- Same backend, different entry points

---

## ⚡ Quick Summary

### Tech Stack
- **Backend:** Fastify + TypeScript
- **Frontend:** React + Vite + Tailwind
- **Database:** Postgres 16 + pgvector
- **Embeddings:** Ollama (nomic-embed-text)
- **Agent:** Claude 3.5 Sonnet with Agent SDK
- **Deployment:** Docker Compose

### Timeline
- **Day 0:** Setup (2-3 hours)
- **Days 1-2:** Database + ingestion pipeline
- **Days 3-4:** Search + autonomous agent
- **Day 5:** Basic UI
- **Day 6:** MCP server (both modes)
- **Day 7:** Docker integration
- **Days 8-9:** Polish + testing

### Cost
- **Development:** ~$50-100 (Claude API)
- **Monthly usage:** ~$200-300 (Claude) + $0 (Ollama)
- **Infrastructure:** $0 (local/Docker)

---

## 🚀 Getting Started

### 1. Read the Docs
Start with `00_START_HERE.md` and read in order through `10_ENV_SETUP.md`.

### 2. Set Up Environment
Follow `10_ENV_SETUP.md` to install:
- Node 22.x + pnpm
- Docker + WSL2 (if Windows)
- Ollama + models
- Postgres with pgvector

### 3. Follow Build Plan
Work through `09_BUILD_PLAN.md` day by day:
- Each day has clear goals
- Test as you build
- Don't skip ahead

### 4. Start Building!
```bash
# Setup
cp .env.example .env
docker compose up -d
pnpm install
pnpm --filter @synthesis/db migrate

# Develop
pnpm --filter @synthesis/server dev
pnpm --filter @synthesis/web dev
```

---

## 🎯 Success Criteria

Your MVP is done when:

✅ Upload 20+ documents (PDF, DOCX, MD) across 3 collections  
✅ Agent autonomously fetches docs from URLs  
✅ Search returns relevant results with citations  
✅ Chat with agent works smoothly  
✅ IDE agents can access via MCP  
✅ Claude Desktop can access via MCP  
✅ Toggle between Claude and Ollama works  
✅ Everything runs with `docker compose up`  

---

## 📊 What This ISN'T

**Not included in MVP (add later if needed):**
- Multi-user authentication
- Billing/licensing
- Advanced UI (your mockups are Phase 2)
- Reranking
- Full-text search hybrid
- Scheduled doc updates
- Export conversations
- SaaS deployment

**Why?** Focus on **working** first, **beautiful** second.

---

## 🤔 Questions Answered

### Why Claude Agent SDK?
**True autonomy.** The agent makes decisions, executes multi-step workflows, and manages your knowledge base proactively. Worth the $200-300/month.

### Why Ollama for embeddings?
**Free + private.** Your 16GB GPU handles embeddings locally. No API costs, no data leaving your PC. Quality is good enough for personal use.

### Why collections from day 1?
You said you have 2-3 projects. Collections isolate contexts so searches don't mix Flutter and Supabase docs inappropriately.

### Why both MCP modes?
- **stdio:** For IDE agents in WSL (Cursor, Windsurf, etc.)
- **SSE:** For Claude Desktop on Windows
- Same backend, just different communication protocols

### Why Docker?
You asked for it. Also makes deployment consistent and easy to share with team later if needed.

### Can I skip features?
Yes! The plan is prioritized. Core is Days 1-5. MCP and Docker can be deferred if time-constrained.

---

## 🚨 Common Pitfalls

**Over-engineering**
- Stick to the plan
- Don't add "nice to have" features yet
- Optimize AFTER it works

**Integration debt**
- Test after each feature
- Don't accumulate bugs
- Fix issues immediately

**Scope creep**
- MVP means minimum
- Beautiful UI comes later
- Focus on function over form

---

## 💡 Tips for Success

1. **Build vertically** - Complete features end-to-end
2. **Test constantly** - Don't wait for "integration day"
3. **Use the agent** - Let Claude help you build (use your RAG once it works!)
4. **Keep notes** - Track blockers and solutions
5. **Take breaks** - This is a sprint, not a marathon

---

## 🔄 After MVP

Once you have a working system:

**Phase 2 (Weeks 2-3):**
- Implement your beautiful UI mockups
- Add collection management features
- Better chunking strategies
- Reranking

**Phase 3 (Months 2-3):**
- Multi-user support
- Team features
- Advanced search
- Export/import

**SaaS Transition (Future):**
- Authentication
- Billing
- Hosted deployment
- Marketing site

---

## 📞 Support

### Questions During Build?
- Re-read the relevant doc
- Check troubleshooting in `10_ENV_SETUP.md`
- Test each component independently
- Check Docker logs: `docker compose logs -f`

### Stuck?
- Don't guess - test systematically
- Isolate the problem
- Check your assumptions
- Sometimes you just need a break

---

## ✅ Pre-Build Checklist

Before Day 1:

- [ ] Read all docs (00-10)
- [ ] Understand the architecture
- [ ] Have API keys ready
- [ ] Development environment set up
- [ ] Docker running
- [ ] Ollama installed with models
- [ ] Clear 7-9 days in your schedule
- [ ] Ready to build!

---

## 🎬 Final Words

**This plan is:**
- ✅ Complete but not over-engineered
- ✅ Realistic for 7-9 days
- ✅ Focused on YOUR needs (not SaaS)
- ✅ Built for autonomy (agent-first)
- ✅ Local-first with cloud options
- ✅ Extensible for future growth

**You have everything you need to build a working autonomous RAG system.**

Now go build it! 🚀

---

## 📂 File Structure Reference

```
NEW-RAG-PLAN/
├── 00_START_HERE.md          ← Read first
├── 01_TECH_STACK.md           ← Technologies
├── 02_ARCHITECTURE.md         ← System design
├── 03_DATABASE_SCHEMA.md      ← DB structure
├── 04_AGENT_TOOLS.md          ← Agent capabilities
├── 05_API_SPEC.md             ← REST endpoints
├── 09_BUILD_PLAN.md           ← Day-by-day roadmap
├── 10_ENV_SETUP.md            ← Setup guide
└── README.md                  ← This file
```

**All files included!** Complete planning package with 21 documents total.

---

**Ready to start Day 0? Go to `10_ENV_SETUP.md` and begin!**
