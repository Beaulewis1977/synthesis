# Configuration Reference Guide

**Version:** v2.0
**Last Updated:** 2025-11-13

## Overview

This guide provides a comprehensive reference for all environment variables available in the Synthesis RAG system. Configuration options are organized by feature area and phase implementation, allowing you to customize behavior, manage costs, optimize performance, and enable advanced capabilities.

**Configuration File:** All settings are defined in a `.env` file at the project root. Copy `.env.example` to `.env` and customize as needed.

---

## Table of Contents

1. [Core Settings](#1-core-settings)
2. [Search Configuration (Phase 11)](#2-search-configuration-phase-11)
3. [Embedding Providers (Phase 11)](#3-embedding-providers-phase-11)
4. [Re-ranking & Synthesis (Phase 12)](#4-re-ranking--synthesis-phase-12)
5. [Cost Management (Phase 12)](#5-cost-management-phase-12)
6. [Code Intelligence (Phase 13)](#6-code-intelligence-phase-13)
7. [Tech Stack Filtering (Phase 13.5)](#7-tech-stack-filtering-phase-135)
8. [Performance & Caching (Phase 15)](#8-performance--caching-phase-15)
9. [Common Configuration Profiles](#9-common-configuration-profiles)
10. [API Key Setup](#10-api-key-setup)
11. [Security Considerations](#11-security-considerations)

---

## 1. Core Settings

Essential configuration required for basic system operation.

### DATABASE_URL
- **Description:** PostgreSQL connection string with pgvector extension
- **Required:** Yes
- **Default:** None
- **Example:** `postgresql://postgres:postgres@localhost:5432/synthesis`
- **Notes:** Must point to a PostgreSQL 16+ database with pgvector 0.7.4 extension enabled

### ANTHROPIC_API_KEY
- **Description:** API key for Claude Agent SDK (required for autonomous agent features)
- **Required:** Yes
- **Default:** None
- **Example:** `sk-ant-api03-your-key-here`
- **Notes:** Get your key at [console.anthropic.com](https://console.anthropic.com)

### OLLAMA_BASE_URL
- **Description:** Base URL for local Ollama instance (embeddings and optional chat)
- **Required:** No
- **Default:** `http://localhost:11434`
- **Example:** `http://localhost:11434`
- **Notes:** Ollama provides free local embeddings (nomic-embed-text model required)

### STORAGE_PATH
- **Description:** Local directory path for uploaded document storage
- **Required:** No
- **Default:** `./storage`
- **Example:** `/home/user/synthesis/storage`
- **Notes:** Ensure the directory is writable by the server process

### SERVER_PORT
- **Description:** HTTP port for Fastify backend server
- **Required:** No
- **Default:** `3333`
- **Example:** `3333`

### WEB_PORT
- **Description:** HTTP port for React frontend (Vite dev server)
- **Required:** No
- **Default:** `5173`
- **Example:** `5173`

### MCP_PORT
- **Description:** Port for MCP server (Model Context Protocol)
- **Required:** No
- **Default:** `3334`
- **Example:** `3334`

### MCP_MODE
- **Description:** MCP server communication mode
- **Required:** No
- **Default:** `stdio`
- **Valid Options:** `stdio`, `sse`
- **Notes:** Use `stdio` for WSL/IDE agents, `sse` for Windows Claude Desktop

### REDIS_URL
- **Description:** Redis connection URL for caching layer
- **Required:** No (falls back to in-memory cache)
- **Default:** `redis://localhost:6379`
- **Example:** `redis://localhost:6379`
- **Notes:** Phase 15 introduced Redis-based caching for improved performance

### NODE_ENV
- **Description:** Application environment mode
- **Required:** No
- **Default:** `development`
- **Valid Options:** `development`, `production`, `test`

### HOST
- **Description:** Network interface to bind the server
- **Required:** No
- **Default:** `0.0.0.0`
- **Example:** `0.0.0.0`

### LOG_LEVEL
- **Description:** Logging verbosity level
- **Required:** No
- **Default:** `info`
- **Valid Options:** `trace`, `debug`, `info`, `warn`, `error`, `fatal`

### CORS_ALLOWED_ORIGINS
- **Description:** Comma-separated list of allowed CORS origins (production only)
- **Required:** No (development allows all)
- **Default:** None
- **Example:** `https://app.example.com,https://admin.example.com`

### CHROMIUM_PATH
- **Description:** Custom Chromium executable path for Playwright scraping
- **Required:** No
- **Default:** System default
- **Example:** `/usr/bin/chromium-browser`

### USE_LOCAL_LLM
- **Description:** Toggle between Claude and Ollama for agent chat
- **Required:** No
- **Default:** `false`
- **Valid Options:** `true` (Ollama), `false` (Claude)
- **Notes:** Experimental feature; Claude provides better quality responses

---

## 2. Search Configuration (Phase 11)

Controls search strategy and hybrid search behavior.

### SEARCH_MODE
- **Description:** Primary search strategy for query execution
- **Required:** No
- **Default:** `vector`
- **Valid Options:**
  - `vector`: Pure vector similarity search (fastest, semantic)
  - `hybrid`: Hybrid search combining vector + BM25 with RRF fusion (better recall)
- **Example:** `hybrid`
- **Notes:** Hybrid mode runs vector and BM25 in parallel, then fuses results using Reciprocal Rank Fusion

### ENABLE_TRUST_SCORING
- **Description:** Apply quality-based boosting to search results
- **Required:** No
- **Default:** `false`
- **Valid Options:** `true`, `false`
- **Notes:** Boosts results based on `source_quality` metadata (official, verified, community) and recency

### HYBRID_VECTOR_WEIGHT
- **Description:** Weight for vector search component in hybrid mode
- **Required:** No
- **Default:** `0.7`
- **Valid Range:** 0.0 - 1.0
- **Example:** `0.8`
- **Notes:** Must sum with `HYBRID_BM25_WEIGHT` to 1.0; higher values favor semantic similarity

### HYBRID_BM25_WEIGHT
- **Description:** Weight for BM25 search component in hybrid mode
- **Required:** No
- **Default:** `0.3`
- **Valid Range:** 0.0 - 1.0
- **Example:** `0.2`
- **Notes:** Must sum with `HYBRID_VECTOR_WEIGHT` to 1.0; higher values favor keyword matching

### FTS_LANGUAGE
- **Description:** PostgreSQL full-text search language configuration
- **Required:** No
- **Default:** `english`
- **Valid Options:** `simple`, `english`, `spanish`, `french`, `german`, etc.
- **Example:** `english`
- **Notes:** Affects stemming and stop-word handling in BM25 search; see PostgreSQL text search configs

---

## 3. Embedding Providers (Phase 11)

Multi-provider embedding configuration for content-aware embedding selection.

### DOC_EMBEDDING_PROVIDER
- **Description:** Default embedding provider for documentation content
- **Required:** No
- **Default:** `ollama`
- **Valid Options:** `ollama`, `openai`, `voyage`
- **Example:** `ollama`
- **Notes:** Free local embeddings with nomic-embed-text (768 dimensions)

### CODE_EMBEDDING_PROVIDER
- **Description:** Embedding provider for code content (auto-detected via code patterns)
- **Required:** No
- **Default:** `voyage`
- **Valid Options:** `ollama`, `openai`, `voyage`
- **Example:** `voyage`
- **Notes:** Voyage's voyage-code-2 is optimized for code semantics (1024 dimensions)

### WRITING_EMBEDDING_PROVIDER
- **Description:** Embedding provider for personal writing and notes
- **Required:** No
- **Default:** `openai`
- **Valid Options:** `ollama`, `openai`, `voyage`
- **Example:** `openai`
- **Notes:** OpenAI's text-embedding-3-large excels at personal content (1536 dimensions)

### EMBEDDING_MODEL
- **Description:** Ollama embedding model name
- **Required:** No
- **Default:** `nomic-embed-text`
- **Example:** `nomic-embed-text`
- **Notes:** Must be pulled via `ollama pull nomic-embed-text` before use

### OPENAI_API_KEY
- **Description:** OpenAI API key for text-embedding-3-large embeddings
- **Required:** No (if using OpenAI provider)
- **Default:** None
- **Example:** `sk-proj-...`
- **Notes:** Required when `DOC_EMBEDDING_PROVIDER`, `CODE_EMBEDDING_PROVIDER`, or `WRITING_EMBEDDING_PROVIDER` is set to `openai`

### VOYAGE_API_KEY
- **Description:** Voyage AI API key for voyage-code-2 embeddings
- **Required:** No (if using Voyage provider)
- **Default:** None
- **Example:** `pa-your-key-here`
- **Notes:** Required when `CODE_EMBEDDING_PROVIDER` or other provider is set to `voyage`

---

## 4. Re-ranking & Synthesis (Phase 12)

Advanced result refinement and contradiction detection.

### RERANKER_PROVIDER
- **Description:** Re-ranking provider for search result refinement
- **Required:** No
- **Default:** `none`
- **Valid Options:**
  - `none`: Disable re-ranking (use raw similarity scores)
  - `bge`: Local BGE reranker (BAAI/bge-reranker-base, free)
  - `cohere`: Cohere rerank-english-v3.0 (paid, highest quality)
- **Example:** `cohere`
- **Notes:** Re-ranking improves relevance ordering; BGE runs locally with CPU/GPU, Cohere requires API key

### COHERE_API_KEY
- **Description:** Cohere API key for Cohere re-ranking
- **Required:** No (if using Cohere reranker)
- **Default:** None
- **Example:** `your-cohere-api-key`
- **Notes:** Required when `RERANKER_PROVIDER=cohere`; get key at [cohere.com](https://cohere.com)

### RERANK_MAX_CANDIDATES
- **Description:** Maximum number of results to consider for re-ranking
- **Required:** No
- **Default:** `50`
- **Valid Range:** 1 - 50
- **Example:** `30`
- **Notes:** Higher values increase latency; capped at 50 for performance

### RERANK_DEFAULT_TOP_K
- **Description:** Default number of re-ranked results to return
- **Required:** No
- **Default:** `10`
- **Valid Range:** 1 - 50
- **Example:** `15`
- **Notes:** Capped at 10 for consistency; can be overridden per-request

### RERANK_BATCH_SIZE
- **Description:** Batch size for BGE reranker processing
- **Required:** No
- **Default:** `8`
- **Valid Range:** 1 - 50
- **Example:** `16`
- **Notes:** Larger batches may improve GPU throughput but increase memory usage

### RERANK_TEXT_LIMIT
- **Description:** Maximum characters per document text sent to reranker
- **Required:** No
- **Default:** `200`
- **Valid Range:** 50 - 1000
- **Example:** `300`
- **Notes:** Limits input size to reranker; text is truncated if longer

### ENABLE_SYNTHESIS
- **Description:** Enable multi-perspective synthesis from search results
- **Required:** No
- **Default:** `false`
- **Valid Options:** `true`, `false`
- **Notes:** Groups results into approaches/topics for comprehensive answers; experimental feature

### ENABLE_CONTRADICTION_DETECTION
- **Description:** Enable contradiction detection across search results
- **Required:** No
- **Default:** `false`
- **Valid Options:** `true`, `false`
- **Notes:** Uses Claude Haiku to identify conflicting information; incurs API costs

### CONTRADICTION_MODEL
- **Description:** Claude model for contradiction analysis
- **Required:** No
- **Default:** `claude-3-haiku-20240307`
- **Example:** `claude-3-haiku-20240307`
- **Notes:** Haiku provides good balance of speed and accuracy

### CONTRADICTION_MAX_PAIRS
- **Description:** Maximum number of approach pairs to compare for contradictions
- **Required:** No
- **Default:** `6`
- **Valid Range:** 1 - 20
- **Example:** `10`
- **Notes:** Higher values increase latency and API costs

### CONTRADICTION_MIN_SIMILARITY
- **Description:** Minimum similarity threshold for contradiction comparison
- **Required:** No
- **Default:** `0.2`
- **Valid Range:** 0.0 - 1.0
- **Example:** `0.3`
- **Notes:** Results below this similarity are not compared (too dissimilar to contradict)

### CONTRADICTION_MAX_SIMILARITY
- **Description:** Maximum similarity threshold for contradiction comparison
- **Required:** No
- **Default:** `0.7`
- **Valid Range:** 0.0 - 1.0
- **Example:** `0.8`
- **Notes:** Results above this similarity are not compared (too similar to contradict)

---

## 5. Cost Management (Phase 12)

Budget tracking and automatic fallback to free providers.

### MONTHLY_BUDGET_USD
- **Description:** Monthly API spending budget threshold (USD)
- **Required:** No
- **Default:** `10`
- **Example:** `50`
- **Notes:** Triggers cost alerts and automatic fallback to free providers when exceeded

### ENABLE_COST_ALERTS
- **Description:** Enable budget alert monitoring
- **Required:** No
- **Default:** `true`
- **Valid Options:** `true`, `false`
- **Notes:** Sends console warnings at 80% budget and enables fallback mode at 100%

### Automatic Overrides (System-Managed)

When budget limit is reached, the cost tracker automatically sets these environment variables:

- **EMBEDDING_PROVIDER_OVERRIDE:** `ollama` (switches to free local embeddings)
- **RERANKER_PROVIDER_OVERRIDE:** `bge` (switches to free local reranker)
- **DISABLE_CONTRADICTION_DETECTION:** `true` (disables paid Claude Haiku calls)

**Warning:** These overrides are managed automatically by the cost tracker. Do not manually set them in your `.env` file unless overriding fallback behavior.

---

## 6. Code Intelligence (Phase 13)

AST-based code chunking and relationship tracking.

### CODE_CHUNKING
- **Description:** Enable AST-based code chunking that preserves function/class boundaries
- **Required:** No
- **Default:** `false`
- **Valid Options:** `true`, `false`
- **Notes:** When enabled, code files are chunked at semantic boundaries (functions, classes) rather than arbitrary line counts

### PRESERVE_IMPORTS
- **Description:** Include import statements in chunk metadata for context
- **Required:** No
- **Default:** `true`
- **Valid Options:** `true`, `false`
- **Notes:** Helps maintain code context when searching chunks; minimal storage overhead

### TRACK_RELATIONSHIPS
- **Description:** Build and track file relationship graph (imports, tests, siblings)
- **Required:** No
- **Default:** `false`
- **Valid Options:** `true`, `false`
- **Notes:** Enables "related files" features; adds processing overhead and database storage

### CODE_MAX_CHUNK_LINES
- **Description:** Maximum lines per code chunk when CODE_CHUNKING is enabled
- **Required:** No
- **Default:** `100`
- **Valid Range:** 20 - 500
- **Example:** `150`
- **Notes:** Chunker attempts to respect this limit while preserving semantic boundaries

### Supported Languages

Code chunking automatically detects and processes the following languages:
- **TypeScript/JavaScript:** `.ts`, `.tsx`, `.js`, `.jsx`
- **Dart:** `.dart`
- **SQL:** `.sql`
- **YAML/JSON:** `.yaml`, `.yml`, `.json` (Phase 13.5)

---

## 7. Tech Stack Filtering (Phase 13.5)

Backend file parsing and automatic tech stack tagging.

### BACKEND_PARSING
- **Description:** Enable backend-aware parsing for SQL, YAML, and JSON files
- **Required:** No
- **Default:** `false`
- **Valid Options:** `true`, `false`
- **Notes:** Extracts structured metadata from backend configuration files (e.g., database schemas, API configs)

### TECH_STACK_TAGS
- **Description:** Enable automatic tech stack detection and tagging
- **Required:** No
- **Default:** `false`
- **Valid Options:** `true`, `false`
- **Notes:** Tags documents with detected technologies (flutter, supabase, redis, fastify, etc.) for filtering

### Detected Tech Stacks

When `TECH_STACK_TAGS=true`, the system automatically detects:
- **Frontend:** Flutter, React, Vue, Angular
- **Backend:** Fastify, Express, Supabase, Firebase
- **Database:** PostgreSQL, Redis, MongoDB
- **Tools:** Docker, Kubernetes, GitHub Actions

---

## 8. Performance & Caching (Phase 15)

Redis-based caching and performance tuning.

### SEARCH_CACHE_TTL_SECONDS
- **Description:** Time-to-live for search result cache entries
- **Required:** No
- **Default:** `1800` (30 minutes)
- **Example:** `3600`
- **Notes:** Caches search results by query hash; set to 0 to disable caching

### SEARCH_CACHE_MAX_ITEMS
- **Description:** Maximum number of cached search results
- **Required:** No
- **Default:** `500`
- **Example:** `1000`
- **Notes:** LRU eviction when limit exceeded

### SEARCH_CACHE_NAMESPACE
- **Description:** Redis namespace for search cache keys
- **Required:** No
- **Default:** `search:v1`
- **Example:** `search:v2`
- **Notes:** Change to invalidate all cached searches

### EMBEDDING_CACHE_TTL_MS
- **Description:** Time-to-live for embedding cache entries (milliseconds)
- **Required:** No
- **Default:** `900000` (15 minutes)
- **Example:** `1800000`
- **Notes:** Caches embeddings by text hash to avoid redundant API calls

### EMBEDDING_CACHE_MAX_ITEMS
- **Description:** Maximum number of cached embeddings
- **Required:** No
- **Default:** `1000`
- **Example:** `2000`
- **Notes:** In-memory LRU cache; increase for large-scale ingestion

### SEARCH_SNIPPET_LENGTH
- **Description:** Maximum character length for search result snippets
- **Required:** No
- **Default:** `320`
- **Example:** `500`
- **Notes:** Snippets are extracted around query matches

### SEARCH_PAGE_SIZE
- **Description:** Default number of results per search page
- **Required:** No
- **Default:** `10`
- **Example:** `20`
- **Notes:** Can be overridden per-request via API

### RERANK_CACHE_TTL_SECONDS
- **Description:** Time-to-live for re-rank result cache entries
- **Required:** No
- **Default:** `300` (5 minutes)
- **Example:** `600`
- **Notes:** Caches re-ranked results by query + documents hash

### RERANK_CACHE_MAX_ITEMS
- **Description:** Maximum number of cached re-rank results
- **Required:** No
- **Default:** `500`
- **Example:** `1000`
- **Notes:** LRU eviction when limit exceeded

### RERANK_CACHE_NAMESPACE
- **Description:** Redis namespace for re-rank cache keys
- **Required:** No
- **Default:** `rerank:v1`
- **Example:** `rerank:v2`

### RELATED_FILES_CACHE_TTL_SECONDS
- **Description:** Time-to-live for related files cache entries
- **Required:** No
- **Default:** `1800` (30 minutes)
- **Example:** `3600`

### RELATED_FILES_CACHE_MAX_ITEMS
- **Description:** Maximum number of cached related file lookups
- **Required:** No
- **Default:** `1000`
- **Example:** `2000`

### RELATED_FILES_CACHE_NAMESPACE
- **Description:** Redis namespace for related files cache keys
- **Required:** No
- **Default:** `related-files:v1`
- **Example:** `related-files:v2`

---

## 9. Common Configuration Profiles

Pre-configured `.env` examples for common use cases.

### Local-Only (Zero Cost)

Fully local operation with no external API calls.

```bash
# Core
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/synthesis
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
OLLAMA_BASE_URL=http://localhost:11434
REDIS_URL=redis://localhost:6379
STORAGE_PATH=./storage

# Embeddings (local only)
DOC_EMBEDDING_PROVIDER=ollama
CODE_EMBEDDING_PROVIDER=ollama
WRITING_EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text

# Search (vector only, no hybrid)
SEARCH_MODE=vector
ENABLE_TRUST_SCORING=false

# Re-ranking (local BGE)
RERANKER_PROVIDER=bge

# Synthesis & Cost Management
ENABLE_SYNTHESIS=false
ENABLE_CONTRADICTION_DETECTION=false
ENABLE_COST_ALERTS=false

# Code Intelligence
CODE_CHUNKING=true
PRESERVE_IMPORTS=true
TRACK_RELATIONSHIPS=false
CODE_MAX_CHUNK_LINES=100

# Backend Parsing
BACKEND_PARSING=true
TECH_STACK_TAGS=true
```

### Cloud-Hybrid (Balanced Cost/Quality)

Mix of local and cloud services for optimal balance.

```bash
# Core
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/synthesis
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
OLLAMA_BASE_URL=http://localhost:11434
REDIS_URL=redis://localhost:6379
STORAGE_PATH=./storage

# Embeddings (content-aware)
DOC_EMBEDDING_PROVIDER=ollama          # Free for docs
CODE_EMBEDDING_PROVIDER=voyage         # Paid for code
WRITING_EMBEDDING_PROVIDER=openai     # Paid for personal notes
EMBEDDING_MODEL=nomic-embed-text
VOYAGE_API_KEY=pa-your-key-here
OPENAI_API_KEY=sk-proj-your-key-here

# Search (hybrid for better recall)
SEARCH_MODE=hybrid
ENABLE_TRUST_SCORING=true
HYBRID_VECTOR_WEIGHT=0.7
HYBRID_BM25_WEIGHT=0.3

# Re-ranking (local BGE)
RERANKER_PROVIDER=bge

# Synthesis & Cost Management
ENABLE_SYNTHESIS=false
ENABLE_CONTRADICTION_DETECTION=false
MONTHLY_BUDGET_USD=25
ENABLE_COST_ALERTS=true

# Code Intelligence
CODE_CHUNKING=true
PRESERVE_IMPORTS=true
TRACK_RELATIONSHIPS=true
CODE_MAX_CHUNK_LINES=100

# Backend Parsing
BACKEND_PARSING=true
TECH_STACK_TAGS=true
```

### Full-Featured (Premium Quality)

All features enabled with cloud providers.

```bash
# Core
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/synthesis
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
OLLAMA_BASE_URL=http://localhost:11434
REDIS_URL=redis://localhost:6379
STORAGE_PATH=./storage

# Embeddings (best quality providers)
DOC_EMBEDDING_PROVIDER=openai
CODE_EMBEDDING_PROVIDER=voyage
WRITING_EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=nomic-embed-text
VOYAGE_API_KEY=pa-your-key-here
OPENAI_API_KEY=sk-proj-your-key-here

# Search (hybrid + trust scoring)
SEARCH_MODE=hybrid
ENABLE_TRUST_SCORING=true
HYBRID_VECTOR_WEIGHT=0.7
HYBRID_BM25_WEIGHT=0.3

# Re-ranking (Cohere for best quality)
RERANKER_PROVIDER=cohere
COHERE_API_KEY=your-cohere-api-key
RERANK_MAX_CANDIDATES=50
RERANK_DEFAULT_TOP_K=10

# Synthesis & Contradiction Detection
ENABLE_SYNTHESIS=true
ENABLE_CONTRADICTION_DETECTION=true
CONTRADICTION_MODEL=claude-3-haiku-20240307
CONTRADICTION_MAX_PAIRS=10

# Cost Management
MONTHLY_BUDGET_USD=100
ENABLE_COST_ALERTS=true

# Code Intelligence
CODE_CHUNKING=true
PRESERVE_IMPORTS=true
TRACK_RELATIONSHIPS=true
CODE_MAX_CHUNK_LINES=150

# Backend Parsing
BACKEND_PARSING=true
TECH_STACK_TAGS=true

# Performance Tuning
SEARCH_CACHE_TTL_SECONDS=3600
SEARCH_CACHE_MAX_ITEMS=1000
EMBEDDING_CACHE_TTL_MS=1800000
EMBEDDING_CACHE_MAX_ITEMS=2000
```

### Development (Fast Iteration)

Optimized for development with aggressive caching.

```bash
# Core
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/synthesis
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
OLLAMA_BASE_URL=http://localhost:11434
REDIS_URL=redis://localhost:6379
STORAGE_PATH=./storage
NODE_ENV=development
LOG_LEVEL=debug

# Embeddings (fast local)
DOC_EMBEDDING_PROVIDER=ollama
CODE_EMBEDDING_PROVIDER=ollama
WRITING_EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text

# Search (fast vector-only)
SEARCH_MODE=vector
ENABLE_TRUST_SCORING=false

# Re-ranking (disabled for speed)
RERANKER_PROVIDER=none

# Synthesis (disabled for speed)
ENABLE_SYNTHESIS=false
ENABLE_CONTRADICTION_DETECTION=false

# Code Intelligence
CODE_CHUNKING=true
PRESERVE_IMPORTS=true
TRACK_RELATIONSHIPS=false
CODE_MAX_CHUNK_LINES=100

# Backend Parsing
BACKEND_PARSING=true
TECH_STACK_TAGS=true

# Aggressive caching
SEARCH_CACHE_TTL_SECONDS=7200
SEARCH_CACHE_MAX_ITEMS=1000
EMBEDDING_CACHE_TTL_MS=3600000
EMBEDDING_CACHE_MAX_ITEMS=2000
```

---

## 10. API Key Setup

### Anthropic (Claude)
- **Required:** Yes (for agent features)
- **Signup:** [console.anthropic.com](https://console.anthropic.com)
- **Pricing:** Pay-as-you-go; Claude Opus 4 Sonnet ~$3 per 1M input tokens
- **Usage:** Agent orchestration, contradiction detection
- **Environment Variable:** `ANTHROPIC_API_KEY`

### OpenAI
- **Required:** No (optional for embeddings)
- **Signup:** [platform.openai.com](https://platform.openai.com)
- **Pricing:** text-embedding-3-large: $0.13 per 1M tokens
- **Usage:** Personal writing embeddings, high-quality general embeddings
- **Environment Variable:** `OPENAI_API_KEY`

### Voyage AI
- **Required:** No (optional for code embeddings)
- **Signup:** [voyageai.com](https://voyageai.com)
- **Pricing:** voyage-code-2: $0.12 per 1M tokens
- **Usage:** Code-optimized embeddings for technical documentation
- **Environment Variable:** `VOYAGE_API_KEY`

### Cohere
- **Required:** No (optional for re-ranking)
- **Signup:** [cohere.com](https://cohere.com)
- **Pricing:** rerank-english-v3.0: $0.001 per request
- **Usage:** High-quality result re-ranking
- **Environment Variable:** `COHERE_API_KEY`

### Google AI (Gemini)
- **Required:** No (optional chat provider)
- **Signup:** [aistudio.google.com](https://aistudio.google.com)
- **Pricing:** Gemini 2.5 Flash: $0.075 per 1M input tokens
- **Usage:** Alternative chat provider with 1M context window
- **Environment Variable:** `GOOGLE_API_KEY`

### Z.AI (Zhipu GLM)
- **Required:** No (optional chat provider)
- **Signup:** [z.ai/model-api](https://z.ai/model-api)
- **Pricing:**
  - Pay-per-use API: Credit-based
  - Coding Plan subscription: $3-$60/month (prompts per 5hr cycle)
- **Usage:** GLM-4.6 chat with 128K context, tool support
- **Environment Variable:** `ZHIPU_API_KEY`
- **Settings:** Toggle "Use Coding Plan Endpoint" in Settings > API Keys to use subscription

### Moonshot (Kimi)
- **Required:** No (optional chat provider)
- **Signup:** [platform.moonshot.ai](https://platform.moonshot.ai) (international) or [platform.moonshot.cn](https://platform.moonshot.cn) (China)
- **Pricing:** Credit-based
- **Usage:** Kimi K2 chat with 256K context, thinking mode support
- **Environment Variable:** `MOONSHOT_API_KEY`

### Ollama (Local)
- **Required:** No (local embeddings and chat)
- **Installation:** [ollama.com](https://ollama.com)
- **Pricing:** Free (local compute)
- **Usage:** nomic-embed-text embeddings (768 dims), optional llama3.2 chat
- **Setup:**
  ```bash
  # Install Ollama
  curl -fsSL https://ollama.com/install.sh | sh

  # Pull embedding model
  ollama pull nomic-embed-text

  # Optional: pull chat model
  ollama pull llama3.2:3b
  ```

---

## 11. Security Considerations

### API Key Management

**Best Practices:**
1. **Never commit `.env` files:** Add `.env` to `.gitignore` (already configured)
2. **Use `.env.local` for local overrides:** Create `.env.local` for personal API keys (not tracked in git)
3. **Rotate keys regularly:** Regenerate API keys every 3-6 months
4. **Restrict key permissions:** Use read-only keys where possible
5. **Monitor usage:** Enable `ENABLE_COST_ALERTS` to detect anomalous API usage

### Environment Variables Priority

The system loads environment variables in this order (later overrides earlier):
1. System environment variables
2. `.env` file (shared defaults)
3. `.env.local` file (personal overrides)
4. Runtime overrides (e.g., cost tracker fallback mode)

### Production Deployment

**Required for Production:**
1. Set `NODE_ENV=production`
2. Configure `CORS_ALLOWED_ORIGINS` to restrict access
3. Use strong PostgreSQL credentials
4. Enable Redis for caching (`REDIS_URL`)
5. Set reasonable budget limits (`MONTHLY_BUDGET_USD`)
6. Disable debug logging (`LOG_LEVEL=warn` or `error`)

**Example Production Config:**
```bash
NODE_ENV=production
LOG_LEVEL=warn
CORS_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
DATABASE_URL=postgresql://synthesis_user:strong_password@db.example.com:5432/synthesis_prod
REDIS_URL=redis://redis.example.com:6379
MONTHLY_BUDGET_USD=500
ENABLE_COST_ALERTS=true
```

### Secret Redaction

The system automatically redacts sensitive data in logs:
- API keys (detected by prefixes: `sk-`, `pa-`, etc.)
- Database passwords (from connection strings)
- Authentication tokens
- Credit card numbers (if present in uploaded docs)

**Note:** This protection applies to server logs but not to `.env` files. Always protect your `.env` file permissions:

```bash
chmod 600 .env
```

---

## Appendix: Variable Quick Reference

| Variable | Type | Default | Phase |
|----------|------|---------|-------|
| DATABASE_URL | string | - | Core |
| ANTHROPIC_API_KEY | string | - | Core |
| OLLAMA_BASE_URL | string | http://localhost:11434 | Core |
| STORAGE_PATH | string | ./storage | Core |
| REDIS_URL | string | redis://localhost:6379 | Phase 15 |
| SEARCH_MODE | enum | vector | Phase 11 |
| ENABLE_TRUST_SCORING | boolean | false | Phase 11 |
| HYBRID_VECTOR_WEIGHT | float | 0.7 | Phase 11 |
| HYBRID_BM25_WEIGHT | float | 0.3 | Phase 11 |
| FTS_LANGUAGE | string | english | Phase 11 |
| DOC_EMBEDDING_PROVIDER | enum | ollama | Phase 11 |
| CODE_EMBEDDING_PROVIDER | enum | voyage | Phase 11 |
| WRITING_EMBEDDING_PROVIDER | enum | openai | Phase 11 |
| OPENAI_API_KEY | string | - | Phase 11 |
| VOYAGE_API_KEY | string | - | Phase 11 |
| RERANKER_PROVIDER | enum | none | Phase 12 |
| COHERE_API_KEY | string | - | Phase 12 |
| ENABLE_SYNTHESIS | boolean | false | Phase 12 |
| ENABLE_CONTRADICTION_DETECTION | boolean | false | Phase 12 |
| MONTHLY_BUDGET_USD | float | 10 | Phase 12 |
| ENABLE_COST_ALERTS | boolean | true | Phase 12 |
| CODE_CHUNKING | boolean | false | Phase 13 |
| PRESERVE_IMPORTS | boolean | true | Phase 13 |
| TRACK_RELATIONSHIPS | boolean | false | Phase 13 |
| CODE_MAX_CHUNK_LINES | integer | 100 | Phase 13 |
| BACKEND_PARSING | boolean | false | Phase 13.5 |
| TECH_STACK_TAGS | boolean | false | Phase 13.5 |
| SEARCH_CACHE_TTL_SECONDS | integer | 1800 | Phase 15 |
| EMBEDDING_CACHE_TTL_MS | integer | 900000 | Phase 15 |

---

**Document Status:** Complete
**Source:** Based on `.env.example` and codebase analysis as of 2025-11-13
**Related Documentation:**
- [Environment Setup Guide](./10_ENV_SETUP.md)
- [Phase 11 Overview](./phases/phase-11/00_PHASE_11_OVERVIEW.md) (Hybrid Search)
- [Phase 12 Overview](./phases/phase-12/00_PHASE_12_OVERVIEW.md) (Re-ranking & Cost Management)
- [Phase 13 Overview](./phases/phase-13/00_PHASE_13_OVERVIEW.md) (Code Intelligence)
- [Phase 15 Overview](./phases/phase-15/00_PHASE_15_OVERVIEW.md) (Performance & Caching)
