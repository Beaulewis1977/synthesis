# Agent Setup Instructions - Synthesis RAG Project

## 🎯 What We're Building

**Project:** Synthesis RAG  
**Description:** Autonomous RAG (Retrieval-Augmented Generation) system powered by Claude Agent SDK

### Core Features
- Upload PDFs, DOCX, Markdown documents
- Automatic chunking and vector embeddings (Ollama)
- Semantic search with pgvector
- Autonomous agent that manages documentation collections
- Agent can fetch web content autonomously
- Web UI for chat and document management
- MCP server for external agent access (IDE agents, Claude Desktop)
- Full Docker deployment

### Tech Stack
- **Backend:** Node.js 22, Fastify, TypeScript
- **Frontend:** React, Vite, Tailwind CSS
- **Database:** PostgreSQL + pgvector
- **AI:** Claude Agent SDK (Anthropic), Ollama (embeddings)
- **Deployment:** Docker Compose

---

## 📋 Your Mission

You are tasked with:
1. **Setup the GitHub repository** (repo, branches, labels, milestones, issues)
2. **Execute the build plan** (9 phases over 7-9 days)
3. **Follow TDD principles** (write tests first)
4. **Create detailed PRs** with phase summaries
5. **Build a production-ready MVP**

---

## 🚀 Phase 1: Repository Setup (Do This Now)

### Current Status
- ✅ Directory exists: `/home/kngpnn/dev/synthesis/`
- ✅ Planning docs exist: `docs/` (21 markdown files)
- ✅ Setup scripts exist: 8 shell scripts ready to run
- ❌ Git not initialized yet
- ❌ GitHub repo exists but empty: `beaulewis1977/synthesis`
- ❌ Issues not created yet

### Step 1: Initialize Repository

**Run these commands:**

```bash
cd /home/kngpnn/dev/synthesis

# Make scripts executable
chmod +x *.sh

# 1. Initialize git, create branches, push to GitHub
./setup-repo.sh

# Expected output:
# - Creates .gitignore, README.md, pnpm-workspace.yaml
# - Commits to git
# - Pushes to GitHub (main branch)
# - Creates develop branch
# - Pushes develop branch
```

**What this does:**
- Initializes git repository
- Creates initial files (.gitignore, README, workspace config)
- Creates `main` and `develop` branches
- Force pushes to clean the existing GitHub repo
- Sets up remote tracking

### Step 2: Configure GitHub

```bash
# 2. Configure GitHub settings and labels
./setup-github.sh

# Expected output:
# - Sets develop as default branch
# - Creates 25+ labels (phase-1 through phase-9, priorities, types, etc.)
# - Prints instructions for branch protection (manual step)
```

**What this does:**
- Sets `develop` as the default branch
- Creates comprehensive label system:
  - Phase labels (phase-1 through phase-9)
  - Type labels (epic, feature, bugfix, docs, refactor, test)
  - Priority labels (low, medium, high, critical)
  - Status labels (needs-review, changes-requested, approved)
  - Size labels (xs, small, medium, large, xl)

### Step 3: Create All Issues

```bash
# 3. Create milestones and all GitHub issues
./create-all-issues.sh

# Expected output:
# - Creates 4 milestones
# - Creates 9 epic issues (one per phase)
# - Creates ~23 story issues (detailed implementation tasks)
# - Total: ~32 issues
# 
# This will take 3-5 minutes
```

**What this does:**
- Creates 4 milestones (grouped phases with due dates)
- Creates detailed issues with:
  - Full context and goals
  - Documentation references
  - Exact file paths to create
  - Dependencies and code snippets
  - Acceptance criteria (10+ per issue)
  - Testing instructions
  - Related issues/dependencies

### Step 4: Verify Setup

```bash
# Check git status
git status
git branch -a

# Check GitHub
gh repo view beaulewis1977/synthesis

# Check issues
gh issue list --repo beaulewis1977/synthesis --limit 10

# Check milestones
gh api repos/beaulewis1977/synthesis/milestones | jq '.[] | {title, open_issues}'
```

**Expected results:**
- ✅ On `develop` branch
- ✅ `main` and `develop` branches exist
- ✅ Remote tracking set up
- ✅ ~32 issues created
- ✅ 4 milestones created
- ✅ All labels created

---

## 📖 Phase 2: Understand the Architecture

### Read These First (30 mins)

**Priority 1 - Must Read:**
1. `docs/00_START_HERE.md` - Overview and navigation
2. `docs/agents.md` - YOUR workflow and responsibilities
3. `docs/09_BUILD_PLAN.md` - Day-by-day plan (7-9 days)
4. `docs/15_AGENT_PROMPTS.md` - Prompts for each phase

**Priority 2 - Reference as Needed:**
5. `docs/02_ARCHITECTURE.md` - System architecture
6. `docs/03_DATABASE_SCHEMA.md` - Database design
7. `docs/04_AGENT_TOOLS.md` - 7 agent tools to build
8. `docs/05_API_SPEC.md` - API endpoints
9. `docs/06_PIPELINE.md` - Ingestion pipeline
10. `docs/07_MCP_SERVER.md` - MCP implementation
11. `docs/08_UI_SPEC.md` - UI pages and components

### Key Concepts

**9 Phases = 7-9 Days of Work:**
- **Phase 1 (Day 1):** Database + Core Pipeline
- **Phase 2 (Day 2):** Chunking + Embeddings  
- **Phase 3 (Day 3):** Search + Agent Tools
- **Phase 4 (Day 4):** Autonomous Web Fetching
- **Phase 5 (Day 5):** Frontend UI
- **Phase 6 (Day 6):** MCP Server
- **Phase 7 (Day 7):** Docker Integration
- **Phase 8 (Day 8):** Polish + Error Handling
- **Phase 9 (Day 9):** Final Testing + Documentation

**Monorepo Structure:**
```
synthesis/
├── apps/
│   ├── server/      # Fastify backend (Phase 1-4)
│   ├── web/         # React frontend (Phase 5)
│   └── mcp/         # MCP server (Phase 6)
├── packages/
│   ├── db/          # Database client (Phase 1)
│   └── shared/      # Shared types/utils (as needed)
├── docs/            # Planning documentation (already exists)
└── storage/         # Uploaded files
```

---

## 🔄 Your Workflow

### Git Branching Strategy

```bash
# main - protected, empty until MVP
# develop - default branch, active development

# For each phase:
git checkout develop
git pull origin develop
git checkout -b feature/phase-N-description

# Work, commit, test
git add .
git commit -m "feat(scope): description"

# Push and create PR
git push origin feature/phase-N-description
gh pr create --base develop --title "Phase N: Description" --body "..."
```

### Commit Convention

Use conventional commits:
```
feat(db): add database schema and migrations
feat(pipeline): implement PDF extraction
fix(search): handle empty query gracefully
docs(readme): update quick start guide
test(chunk): add unit tests for chunking
```

### PR Process

**For each phase:**

1. **Create feature branch:** `feature/phase-N-description`
2. **Implement all stories** in that phase
3. **Write tests** (TDD - tests first!)
4. **Verify acceptance criteria** (from GitHub issues)
5. **Create phase summary** (use `docs/PHASE_SUMMARY_TEMPLATE.md`)
6. **Create PR to develop**
7. **Wait for review** (human will approve)
8. **Merge to develop**

### Daily Checklist

At the end of each day:
- [ ] All code committed to feature branch
- [ ] All tests passing (`pnpm test`)
- [ ] Demo works (manual test)
- [ ] Phase summary created (if phase complete)
- [ ] PR created (if phase complete)

---

## 🧪 Testing Requirements (TDD)

### You MUST Write Tests First

**For every feature:**

1. **Write failing test** - Define expected behavior
2. **Run test** - Verify it fails
3. **Implement feature** - Write minimal code to pass
4. **Run test** - Verify it passes
5. **Refactor** - Clean up code
6. **Run test** - Verify still passes

### Test Types

**Unit Tests:** Every function/module
```typescript
// Example: apps/server/src/pipeline/__tests__/chunk.test.ts
describe('chunkText', () => {
  it('creates chunks of max size', () => {
    // Test implementation
  });
});
```

**Integration Tests:** Database, API, pipeline
```typescript
// Example: apps/server/src/__tests__/ingest.integration.test.ts
describe('ingestDocument', () => {
  it('processes document end-to-end', async () => {
    // Test with real database
  });
});
```

**E2E Tests:** Full workflows (Phase 9)

### Test Commands

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm test chunk.test.ts
```

---

## 📝 What to Do Next

### Immediate Actions (Now)

1. ✅ **Run the 3 setup scripts** (see Phase 1 above)
2. ✅ **Verify 32 issues created** on GitHub
3. ✅ **Read priority docs** (agents.md, BUILD_PLAN.md)

### Start Building (After Setup)

1. **Open Phase 1 Epic Issue** on GitHub
2. **Read `docs/15_AGENT_PROMPTS.md`** - Copy Phase 1 prompt
3. **Create feature branch:** `git checkout -b feature/phase-1-database`
4. **Start with tests:**
   - Create `packages/db/src/__tests__/client.test.ts`
   - Write failing test for database connection
   - Implement until test passes
5. **Follow the build plan** day by day
6. **Close issues** as you complete them

---

## 📚 Key Documents Reference

| Document | Purpose | When to Read |
|----------|---------|--------------|
| `00_START_HERE.md` | Navigation guide | First |
| `agents.md` | Your workflow | First |
| `09_BUILD_PLAN.md` | Day-by-day plan | First |
| `15_AGENT_PROMPTS.md` | Phase prompts | Before each phase |
| `02_ARCHITECTURE.md` | System design | Reference |
| `03_DATABASE_SCHEMA.md` | DB schema | Phase 1 |
| `04_AGENT_TOOLS.md` | Agent tools specs | Phase 3-4 |
| `05_API_SPEC.md` | API endpoints | As needed |
| `06_PIPELINE.md` | Ingestion flow | Phase 1-2 |
| `07_MCP_SERVER.md` | MCP implementation | Phase 6 |
| `08_UI_SPEC.md` | UI pages | Phase 5 |
| `10_ENV_SETUP.md` | Environment setup | Phase 0 (Day 0) |
| `11_TESTING.md` | Testing strategy | All phases |
| `12_CODE_STANDARDS.md` | Code style | All phases |
| `13_REPO_SETUP.md` | Repo structure | Reference |
| `14_GITHUB_ISSUES.md` | Issue templates | Reference |

---

## ✅ Success Criteria

You're successful when:

- [ ] All 32 GitHub issues closed
- [ ] All 9 phases complete
- [ ] Can upload 20+ documents successfully
- [ ] Agent autonomously manages collections
- [ ] Search returns relevant results with citations
- [ ] MCP works from IDE and Claude Desktop
- [ ] UI allows chat and document management
- [ ] `docker compose up` runs everything
- [ ] All tests passing (>80% coverage)
- [ ] Documentation complete and accurate

---

## 🚨 Important Notes

### DO:
- ✅ Follow TDD - write tests first
- ✅ Read issue acceptance criteria carefully
- ✅ Create phase summaries
- ✅ Ask for clarification if requirements unclear
- ✅ Test manually before marking complete
- ✅ Commit frequently with good messages
- ✅ Update docs if implementation differs from plan

### DON'T:
- ❌ Skip tests "I'll add them later"
- ❌ Merge without all acceptance criteria met
- ❌ Change architecture without discussing
- ❌ Commit secrets or API keys
- ❌ Delete or significantly change planning docs
- ❌ Work on multiple phases simultaneously

---

## 📞 Getting Help

### If Stuck:
1. Re-read the relevant planning doc
2. Check the GitHub issue acceptance criteria
3. Review the agent prompt for that phase
4. Ask the human for clarification

### If Requirements Unclear:
- Check `docs/15_AGENT_PROMPTS.md` for that phase
- Review related planning docs
- Ask specific questions with context

### If Architecture Needs Change:
- Document why current approach won't work
- Propose alternative with trade-offs
- Wait for human approval
- Update relevant docs after approval

---

## 🎯 Summary

**What you need to do RIGHT NOW:**

```bash
cd /home/kngpnn/dev/synthesis
chmod +x *.sh
./setup-repo.sh
./setup-github.sh
./create-all-issues.sh
```

**Then:**
1. Read `docs/agents.md` and `docs/09_BUILD_PLAN.md`
2. Copy Phase 1 prompt from `docs/15_AGENT_PROMPTS.md`
3. Start building with TDD!

**You have everything you need:**
- ✅ Complete planning documentation (21 docs)
- ✅ Detailed GitHub issues (32 issues)
- ✅ Clear 9-phase build plan
- ✅ Agent prompts with all context
- ✅ Testing strategy defined
- ✅ Code standards established

**Let's build an amazing autonomous RAG system! 🚀**
