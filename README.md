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

### One-Command Startup (Recommended)

```bash
# 1. Clone and install
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY

# 3. Setup Ollama (first time only)
ollama signin              # Login to Ollama (optional, for model access)
ollama pull nomic-embed-text

# 4. Start everything!
pnpm dev:all
```

This starts all infrastructure (PostgreSQL, Ollama, Redis) in Docker and runs the server + web frontend locally with hot reload.

**Services:**
- 🌐 **Web UI:** <http://localhost:5173>
- 🔧 **Backend API:** <http://localhost:3333>
- 🤖 **Ollama:** <http://localhost:11434>

### Alternative: Docker Mode (Production-like)

Run everything in Docker containers:

```bash
pnpm docker:all
```

Options:
- `pnpm docker:all --build` - Rebuild containers
- `pnpm docker:all --logs` - Follow logs after starting
- `pnpm docker:stop` - Stop all containers

### Manual Startup (Step-by-Step)

```bash
# Start infrastructure
pnpm dev:infra

# Run migrations
pnpm dev:migrate

# Build packages (after code changes)
pnpm dev:build

# Start services (in separate terminals)
pnpm dev:server   # Backend (port 3333)
pnpm dev:web      # Frontend (port 5173)
pnpm dev:mcp      # MCP server (port 3334)
pnpm dev:desktop  # Desktop app (Tauri)
```

### Shell Scripts

The scripts are located in `scripts/` and can be run directly:

| Script | Description |
|--------|-------------|
| `./scripts/dev.sh` | Start dev environment (infra in Docker, apps local) |
| `./scripts/dev.sh --skip-infra` | Skip Docker startup (already running) |
| `./scripts/dev.sh --skip-build` | Skip package builds |
| `./scripts/dev.sh --server-only` | Only start backend server |
| `./scripts/docker-all.sh` | Start everything in Docker |
| `./scripts/docker-all.sh --build` | Rebuild and start containers |
| `./scripts/docker-all.sh --clean` | Clean rebuild (removes volumes) |
| `./scripts/docker-all.sh --stop` | Stop all containers |

**Note:** Run scripts from the project root directory.

## 🎯 Status

✅ **v2.0.0 Released** - Production-ready with Phase 11-14 features complete

## 📋 Tech Stack

- **Backend:** Node.js 22, Fastify, TypeScript
- **Frontend:** React, Vite, Tailwind CSS
- **Database:** PostgreSQL 16 + pgvector 0.7.4
- **Chat Providers:**
  - Anthropic Claude (Agent SDK with MCP tools)
  - OpenAI GPT-4o/GPT-5 (tool support)
  - Google Gemini (1M context)
  - Z.AI GLM-4.6 (Coding Plan supported)
  - Moonshot Kimi K2 (thinking mode)
  - Ollama (local models)
- **Embeddings:**
  - Ollama (nomic-embed-text)
  - Voyage AI (voyage-code-2)
  - OpenAI (text-embedding-3-large)
- **Re-ranking:** Cohere (rerank-english-v3.0)
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
- 25-turn agentic loop for complex queries
- MCP tools with dynamic lazy loading
- Context-aware conversation
- Multi-step reasoning with subagent delegation

## 🛠️ Agent Tools & MCP Server

Synthesis exposes **28 tools** across **7 toolpacks** via MCP (Model Context Protocol). Tools are **lazy-loaded** using a gateway pattern to optimize context window usage.

### Gateway Pattern (Lazy Loading)

The agent starts with minimal tools and discovers/enables more on demand:

```
Session Start (default: "core" profile)
├── Gateway tools always enabled: discover_tools, enable_tools
├── Core tools enabled: search_rag, add_document, list_collections, etc.
└── Advanced toolpacks disabled: web, orchestration, mobile_core, introspection, graphing

Agent needs web search?
├── Calls discover_tools → sees available toolpacks
├── Calls enable_tools(toolpacks: ['web'])
└── Now has access to web_search tool

Next request uses newly enabled tools automatically
```

**Benefits:**
- Only enabled tools sent to LLM (saves tokens)
- Session-scoped isolation (concurrent sessions don't interfere)
- Agents autonomously discover and enable tools as needed

### Tool Profiles

| Profile | Tools | Use Case |
|---------|-------|----------|
| **minimal** | 2 | Gateway only - discover and enable tools as needed |
| **core** (default) | 16 | General RAG workflows |
| **full** | 28 | Maximum capability |

### Complete Tool Inventory

#### 🔧 Core Toolpack (14 tools)
| Tool | Description |
|------|-------------|
| `search_rag` | Search knowledge base with vector/hybrid modes |
| `list_collections` | List collections with document counts |
| `list_documents` | List documents with status filtering |
| `get_document_status` | Check document processing status |
| `create_collection` | Create new document collection |
| `delete_collection` | Delete collection (requires confirm) |
| `add_document` | Add document from file path or URL |
| `fetch_web_content` | Crawl and ingest web pages (up to 200) |
| `delete_document` | Delete document (requires confirm) |
| `restart_ingest` | Retry failed document ingestion |
| `summarize_document` | Summarize document using Claude |
| `add_repo_to_collection` | Add GitHub/Git repository |
| `sync_repo` | Trigger repository sync |
| `list_repos` | List repository sources |

#### 🌐 Gateway Toolpack (2 tools) - Always Enabled
| Tool | Description |
|------|-------------|
| `discover_tools` | Discover available toolpacks and tools |
| `enable_tools` | Enable/disable tools dynamically |

#### 🔍 Web Toolpack (1 tool)
| Tool | Description |
|------|-------------|
| `web_search` | Search web via Perplexity AI (quick/reason/deep_research modes) |

#### 🎭 Orchestration Toolpack (4 tools)
| Tool | Description |
|------|-------------|
| `spawn_subagent` | Spawn Claude subagent (explore/plan/code-reviewer/test-writer/doc-writer) |
| `get_subagent_status` | Check background subagent task status |
| `invoke_skill` | Load specialized skill for domain knowledge |
| `list_skills` | List available skills |

#### 📱 Mobile Core Toolpack (3 tools)
| Tool | Description |
|------|-------------|
| `search_mobile_docs` | Search mobile docs with feature/platform filters |
| `find_code_examples` | Find working code examples |
| `get_feature_recipe` | Get step-by-step implementation recipes |

#### 🔬 Introspection Toolpack (3 tools)
| Tool | Description |
|------|-------------|
| `get_project_tech_stack` | Analyze collection's tech stack |
| `get_db_schema` | Extract database schema |
| `find_symbol_usages` | Find symbol definitions and usages |

#### 🕸️ Graphing Toolpack (1 tool)
| Tool | Description |
|------|-------------|
| `graph_expand_context` | Traverse knowledge graph for related context |

### MCP Server Integration

The MCP server exposes all tools to external AI agents (Cursor, Windsurf, Claude Desktop):

```bash
# Start MCP server
pnpm dev:mcp

# Modes
MCP_MODE=stdio   # WSL/IDE agents (default)
MCP_MODE=sse     # Windows Claude Desktop
```

**MCP Tool Names:** `mcp__synthesis-rag-tools__<tool_name>`

## 🧠 Skills System

Skills are markdown-based domain knowledge that agents can discover and invoke on demand.

### Available Skills

| Skill | Description |
|-------|-------------|
| `synthesis-architecture` | Routes, services, agent tools, ModelConfigService patterns |
| `llm-provider-integration` | Multi-provider LLM integration (OpenAI, Anthropic, Google, Ollama, Z.AI, Moonshot) |
| `sse-streaming` | Server-Sent Events for Fastify + React |

### How Skills Work

```
Agent needs domain knowledge
├── Calls list_skills → sees available skills
├── Calls invoke_skill(skill: "synthesis-architecture")
└── Receives full markdown content with patterns, examples, checklists

Agent uses skill knowledge to generate better responses
```

### Adding New Skills

Create a skill file at `.claude/skills/{name}/SKILL.md`:

```markdown
---
name: my-skill
description: What this skill provides
---

# Skill Content

Your markdown content with patterns, examples, etc.
```

## 🔐 Security Configuration

### Subagent Permissions

By default, subagents run with `--dangerously-skip-permissions` for autonomous operation. For production:

```bash
# .env - Require permission prompts (disables autonomous subagent operation)
SUBAGENT_REQUIRE_PERMISSIONS=true
```

### SDK Hooks

The Anthropic provider includes safety hooks:
- **PreToolUse**: Logs all tool calls, blocks dangerous Bash commands
- **PostToolUse**: Logs tool completion

## 📖 Planning Docs

All planning documentation is in the [docs/](docs/) directory.
