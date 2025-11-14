# Migration Guide: Upgrading from v1.x to v2.0

**Document Version:** 1.0
**Last Updated:** 2025-11-13
**Target Audience:** Synthesis administrators and developers

---

## Table of Contents

1. [Overview](#overview)
2. [Breaking Changes](#breaking-changes)
3. [New Features in v2.0](#new-features-in-v20)
4. [Environment Variables Migration](#environment-variables-migration)
5. [Database Migrations](#database-migrations)
6. [Upgrade Procedure](#upgrade-procedure)
7. [Configuration Examples](#configuration-examples)
8. [Verification Checklist](#verification-checklist)
9. [Rollback Procedure](#rollback-procedure)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### What's New in v2.0?

Synthesis v2.0 represents a major enhancement to the RAG system, adding enterprise-grade features developed across Phases 11-15:

**Enhanced Search Capabilities:**
- Hybrid search combining semantic (vector) and lexical (BM25) retrieval
- Cross-encoder re-ranking for improved result precision
- Trust scoring and metadata filtering

**Multi-Provider Intelligence:**
- Support for multiple embedding providers (Ollama, OpenAI, Voyage)
- Automatic content-type detection and provider routing
- Code-specialized embeddings for better code search

**Code Intelligence:**
- AST-based code chunking that preserves function/class boundaries
- Import preservation in code snippets
- File relationship tracking (imports, tests, siblings)
- Tech stack tagging and filtering

**Cost Management:**
- Real-time API cost tracking across all providers
- Budget alerts and automatic fallback to free providers
- Per-collection cost attribution

**Performance Optimizations:**
- Search result caching with configurable TTL
- Performance instrumentation and query profiling
- Optimized database indexes for faster queries

### Compatibility Statement

**✅ v2.0 IS FULLY BACKWARDS COMPATIBLE**

- All v1.x collections continue to work without modification
- Default behavior remains identical to v1.x
- All new features are **opt-in** via environment variables
- No data migration required (database migrations are additive only)
- Existing API endpoints unchanged
- MCP server tools maintain compatibility

**Zero downtime upgrade possible** - you can upgrade and selectively enable features.

---

## Breaking Changes

### ✅ NONE

v2.0 introduces **zero breaking changes**. All new features are additive and opt-in.

**Why This Matters:**
- You can upgrade safely without worrying about breaking existing workflows
- Enable new features incrementally at your own pace
- Roll back easily if needed (though new data won't be accessible in v1.x)
- Existing collections continue to work exactly as before

**Future Compatibility:**
- Data created in v2.0 (file relationships, cost tracking) won't be available if you roll back to v1.x
- Collections using new features (code chunking, tech stack tags) will still work in v1.x but won't benefit from those features

---

## New Features in v2.0

All features below are **disabled by default** for backwards compatibility. Enable them via environment variables.

### Phase 11: Hybrid Search & Multi-Model Embeddings

**Hybrid Search** - Combines semantic and keyword search for better accuracy:
- Enable: `SEARCH_MODE=hybrid`
- Benefit: Find both concepts AND exact terms (e.g., "StatefulWidget" finds exact class name)
- Performance: ~800ms (vs ~500ms vector-only)

**Multi-Provider Embeddings** - Use specialized models for different content:
- Ollama (free): General documentation
- Voyage (paid): Code and technical content
- OpenAI (paid): Personal writing and notes
- Automatic routing based on content type detection

**Trust Scoring** - Boost results from official/verified sources:
- Enable: `ENABLE_TRUST_SCORING=true`
- Weights: Official (1.0x), Verified (0.85x), Community (0.6x)
- Includes recency weighting for freshness

### Phase 12: Re-ranking & Document Synthesis

**Cross-Encoder Re-ranking** - Improve result ordering precision:
- Enable: `RERANKER_PROVIDER=bge` (free local) or `cohere` (paid cloud)
- Benefit: +25% improvement in top-5 precision
- Latency: <300ms additional

**Cost Tracking** - Monitor API spending in real-time:
- Enable: `MONTHLY_BUDGET_USD=10` and `ENABLE_COST_ALERTS=true`
- Auto-fallback to free providers when budget reached
- Per-collection cost attribution

**Synthesis & Contradiction Detection** - Compare multiple sources:
- Enable: `ENABLE_SYNTHESIS=true` and `ENABLE_CONTRADICTION_DETECTION=true`
- Identify conflicting information across documents
- Multi-source comparison for better answers

### Phase 13: Code Intelligence

**AST-Based Code Chunking** - Preserve code structure:
- Enable: `CODE_CHUNKING=true`
- Keeps functions/classes intact during indexing
- Enable import preservation: `PRESERVE_IMPORTS=true`

**File Relationship Tracking** - Map code dependencies:
- Enable: `TRACK_RELATIONSHIPS=true`
- Tracks imports, test files, and related code
- Build dependency graphs automatically

**Max Chunk Lines Control**:
- Configure: `CODE_MAX_CHUNK_LINES=100`
- Prevents overly large code chunks

### Phase 13.5: Backend Parsing & Tech Stack Tagging

**Backend-Aware Parsing** - Better SQL/YAML/JSON handling:
- Enable: `BACKEND_PARSING=false` (currently experimental)

**Tech Stack Tagging** - Auto-detect technologies:
- Enable: `TECH_STACK_TAGS=true`
- Detects: Flutter, Supabase, Redis, PostgreSQL, etc.
- Filter search by tech stack

### Phase 15: Performance Optimization

**Search Result Caching**:
- Configure: `SEARCH_CACHE_TTL_SECONDS=1800` (default: 30 minutes)
- Configure: `SEARCH_CACHE_MAX_ITEMS=500`

**Embedding Caching**:
- Configure: `EMBEDDING_CACHE_TTL_MS=900000` (default: 15 minutes)
- Configure: `EMBEDDING_CACHE_MAX_ITEMS=1000`

**Re-ranker Caching**:
- Configure: `RERANK_CACHE_TTL_SECONDS=300` (default: 5 minutes)
- Configure: `RERANK_CACHE_MAX_ITEMS=500`

**Search Optimization**:
- Configure: `SEARCH_SNIPPET_LENGTH=320` (default: 320 chars)
- Configure: `SEARCH_PAGE_SIZE=10`
- Configure: `RERANK_TEXT_LIMIT=200`

**Related Files Caching**:
- Configure: `RELATED_FILES_CACHE_TTL_SECONDS=1800`
- Configure: `RELATED_FILES_CACHE_MAX_ITEMS=1000`

---

## Environment Variables Migration

### Quick Reference Table

| Feature Area | Variable | v1.x Default | v2.0 Default | Notes |
|--------------|----------|--------------|--------------|-------|
| **Search Mode** | `SEARCH_MODE` | `vector` | `vector` | Set to `hybrid` for Phase 11 |
| **Trust Scoring** | `ENABLE_TRUST_SCORING` | N/A | `false` | New in v2.0 |
| **Hybrid Weights** | `HYBRID_VECTOR_WEIGHT` | N/A | `0.7` | Only if hybrid mode |
| **Hybrid Weights** | `HYBRID_BM25_WEIGHT` | N/A | `0.3` | Only if hybrid mode |
| **FTS Language** | `FTS_LANGUAGE` | N/A | `english` | PostgreSQL full-text |
| **Doc Embeddings** | `DOC_EMBEDDING_PROVIDER` | `ollama` | `ollama` | No change needed |
| **Code Embeddings** | `CODE_EMBEDDING_PROVIDER` | N/A | `voyage` | New in v2.0 |
| **Writing Embeddings** | `WRITING_EMBEDDING_PROVIDER` | N/A | `openai` | New in v2.0 |
| **Voyage API Key** | `VOYAGE_API_KEY` | N/A | (empty) | Required if using Voyage |
| **Re-ranker** | `RERANKER_PROVIDER` | N/A | `none` | Options: `none`, `bge`, `cohere` |
| **Cohere API Key** | `COHERE_API_KEY` | N/A | (empty) | Required if using Cohere |
| **Synthesis** | `ENABLE_SYNTHESIS` | N/A | `false` | New in v2.0 |
| **Contradiction Detection** | `ENABLE_CONTRADICTION_DETECTION` | N/A | `false` | New in v2.0 |
| **Budget** | `MONTHLY_BUDGET_USD` | N/A | `10` | Cost monitoring |
| **Cost Alerts** | `ENABLE_COST_ALERTS` | N/A | `true` | Budget notifications |
| **Code Chunking** | `CODE_CHUNKING` | N/A | `false` | AST-based chunking |
| **Preserve Imports** | `PRESERVE_IMPORTS` | N/A | `true` | Keep imports with code |
| **File Relationships** | `TRACK_RELATIONSHIPS` | N/A | `false` | Track code dependencies |
| **Code Max Lines** | `CODE_MAX_CHUNK_LINES` | N/A | `100` | Max lines per chunk |
| **Backend Parsing** | `BACKEND_PARSING` | N/A | `false` | SQL/YAML/JSON parsing |
| **Tech Stack Tags** | `TECH_STACK_TAGS` | N/A | `false` | Auto-detect technologies |
| **Search Cache TTL** | `SEARCH_CACHE_TTL_SECONDS` | N/A | `1800` | 30 minutes |
| **Search Cache Size** | `SEARCH_CACHE_MAX_ITEMS` | N/A | `500` | Max cached queries |
| **Embedding Cache TTL** | `EMBEDDING_CACHE_TTL_MS` | N/A | `900000` | 15 minutes |
| **Embedding Cache Size** | `EMBEDDING_CACHE_MAX_ITEMS` | N/A | `1000` | Max cached embeddings |
| **Rerank Cache TTL** | `RERANK_CACHE_TTL_SECONDS` | N/A | `300` | 5 minutes |
| **Rerank Cache Size** | `RERANK_CACHE_MAX_ITEMS` | N/A | `500` | Max cached reranks |
| **Search Snippet Length** | `SEARCH_SNIPPET_LENGTH` | N/A | `320` | Characters in snippet |
| **Search Page Size** | `SEARCH_PAGE_SIZE` | N/A | `10` | Results per page |
| **Rerank Text Limit** | `RERANK_TEXT_LIMIT` | N/A | `200` | Max chars for reranking |
| **Related Files Cache TTL** | `RELATED_FILES_CACHE_TTL_SECONDS` | N/A | `1800` | 30 minutes |
| **Related Files Cache Size** | `RELATED_FILES_CACHE_MAX_ITEMS` | N/A | `1000` | Max cached relationships |

### Unchanged Variables

These remain the same from v1.x:

```bash
# Core (unchanged)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/synthesis
REDIS_URL=redis://localhost:6379
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
OLLAMA_BASE_URL=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text
STORAGE_PATH=./storage

# Server (unchanged)
NODE_ENV=development
SERVER_PORT=3333
WEB_PORT=5173
MCP_PORT=3334
MCP_MODE=stdio

# LLM Toggle (unchanged)
USE_LOCAL_LLM=false
```

### New Optional Variables

Add these only if you want to enable v2.0 features:

```bash
# Phase 11: Hybrid Search
SEARCH_MODE=vector              # Change to 'hybrid' to enable
ENABLE_TRUST_SCORING=false      # Change to 'true' to enable
HYBRID_VECTOR_WEIGHT=0.7
HYBRID_BM25_WEIGHT=0.3
FTS_LANGUAGE=english

# Phase 11: Multi-Provider Embeddings
CODE_EMBEDDING_PROVIDER=voyage
WRITING_EMBEDDING_PROVIDER=openai
VOYAGE_API_KEY=                 # Add if using Voyage
OPENAI_API_KEY=                 # Add if using OpenAI (may already have)

# Phase 12: Re-ranking
RERANKER_PROVIDER=none          # Options: 'bge' (free) or 'cohere' (paid)
COHERE_API_KEY=                 # Add if using Cohere

# Phase 12: Synthesis
ENABLE_SYNTHESIS=false
ENABLE_CONTRADICTION_DETECTION=false
CONTRADICTION_MODEL=claude-3-haiku-20240307
CONTRADICTION_MAX_PAIRS=6
CONTRADICTION_MIN_SIMILARITY=0.2
CONTRADICTION_MAX_SIMILARITY=0.7

# Phase 12: Cost Monitoring
MONTHLY_BUDGET_USD=10
ENABLE_COST_ALERTS=true

# Phase 13: Code Intelligence
CODE_CHUNKING=false             # Change to 'true' for AST-based chunking
PRESERVE_IMPORTS=true
TRACK_RELATIONSHIPS=false       # Change to 'true' to track code dependencies
CODE_MAX_CHUNK_LINES=100

# Phase 13.5: Backend Parsing
BACKEND_PARSING=false
TECH_STACK_TAGS=false           # Change to 'true' for auto-tagging

# Phase 15: Performance & Caching
SEARCH_CACHE_TTL_SECONDS=1800
SEARCH_CACHE_MAX_ITEMS=500
EMBEDDING_CACHE_TTL_MS=900000
EMBEDDING_CACHE_MAX_ITEMS=1000
RERANK_CACHE_TTL_SECONDS=300
RERANK_CACHE_MAX_ITEMS=500
SEARCH_SNIPPET_LENGTH=320
SEARCH_PAGE_SIZE=10
RERANK_TEXT_LIMIT=200
RELATED_FILES_CACHE_TTL_SECONDS=1800
RELATED_FILES_CACHE_MAX_ITEMS=1000
```

---

## Database Migrations

v2.0 adds **four new migration files** that extend the database schema. All migrations are **non-destructive** and **additive** - they only add new tables, columns, and indexes.

### Migration Files Overview

| Migration | Purpose | Tables Added | Breaking? |
|-----------|---------|--------------|-----------|
| `003_cost_tracking.sql` | API usage and budget monitoring | `api_usage`, `budget_alerts` | ❌ No |
| `004_hybrid_search.sql` | Full-text search indexes | None (adds indexes/columns) | ❌ No |
| `006_file_relationships.sql` | Code dependency tracking | `file_relationships` | ❌ No |
| `007_performance_extensions.sql` | Performance optimization | None (adds indexes/extensions) | ❌ No |

### What Each Migration Does

#### 003_cost_tracking.sql (Phase 12)

**Purpose:** Track API costs and enforce budget limits

**Creates:**
```sql
-- Track all API usage
CREATE TABLE api_usage (
  id SERIAL PRIMARY KEY,
  provider TEXT NOT NULL,           -- 'openai', 'voyage', 'cohere', 'anthropic'
  operation TEXT NOT NULL,          -- 'embed', 'rerank', 'chat'
  tokens_used BIGINT NOT NULL,
  cost_usd DECIMAL(10,4) NOT NULL,
  collection_id UUID REFERENCES collections(id),
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Budget alert tracking
CREATE TABLE budget_alerts (
  id SERIAL PRIMARY KEY,
  alert_type TEXT NOT NULL,         -- 'warning' | 'limit_reached'
  threshold_usd DECIMAL(10,2),
  current_spend_usd DECIMAL(10,4),
  period TEXT NOT NULL,             -- 'daily' | 'monthly'
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT FALSE
);
```

**Indexes:** Provider, created_at, collection_id for efficient queries

**Required for:** Cost tracking, budget alerts, API usage monitoring

#### 004_hybrid_search.sql (Phase 11)

**Purpose:** Enable full-text search and metadata filtering

**Creates:**
```sql
-- Enable PostgreSQL trigram extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Full-text search indexes
CREATE INDEX chunks_text_tsv_idx
  ON chunks USING gin (to_tsvector('english', text));

CREATE INDEX chunks_text_trgm_idx
  ON chunks USING gin (text gin_trgm_ops);

-- Metadata columns for fast filtering
ALTER TABLE documents
  ADD COLUMN source_quality TEXT
    GENERATED ALWAYS AS ((metadata ->> 'source_quality')) STORED,
  ADD COLUMN framework TEXT
    GENERATED ALWAYS AS ((metadata ->> 'framework')) STORED,
  ADD COLUMN framework_version TEXT
    GENERATED ALWAYS AS ((metadata ->> 'framework_version')) STORED;

-- Indexes for metadata filtering
CREATE INDEX documents_source_quality_idx ON documents (source_quality);
CREATE INDEX documents_framework_idx ON documents (framework);
CREATE INDEX documents_framework_version_idx ON documents (framework_version);
```

**Required for:** Hybrid search mode, BM25 full-text search, trust scoring

#### 006_file_relationships.sql (Phase 13)

**Purpose:** Track code dependencies and relationships

**Creates:**
```sql
CREATE TABLE file_relationships (
  id SERIAL PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  source_file TEXT NOT NULL,
  target_file TEXT NOT NULL,
  relationship_type TEXT NOT NULL,  -- 'import', 'usage', 'test', 'sibling', 'parent'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(collection_id, source_file, target_file, relationship_type)
);

-- Indexes for relationship queries
CREATE INDEX file_relationships_collection_idx ON file_relationships(collection_id);
CREATE INDEX file_relationships_source_idx ON file_relationships(source_file);
CREATE INDEX file_relationships_target_idx ON file_relationships(target_file);
CREATE INDEX file_relationships_type_idx ON file_relationships(relationship_type);
CREATE INDEX file_relationships_source_type_idx
  ON file_relationships(source_file, relationship_type);
```

**Required for:** File relationship tracking, code dependency graphs

#### 007_performance_extensions.sql (Phase 15)

**Purpose:** Performance instrumentation and optimization

**Creates:**
```sql
-- Enable PostgreSQL query profiling
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Tech stack filtering optimization
CREATE INDEX chunks_metadata_tech_stack_idx
  ON chunks USING gin ((metadata -> 'tech_stack') jsonb_path_ops);

-- Collection-scoped queries optimization
CREATE INDEX documents_collection_processed_idx
  ON documents (collection_id, processed_at DESC NULLS LAST);

-- Relationship lookups optimization
CREATE INDEX file_relationships_collection_source_idx
  ON file_relationships (collection_id, source_file);

CREATE INDEX file_relationships_collection_target_idx
  ON file_relationships (collection_id, target_file);
```

**Required for:** Performance monitoring, tech stack filtering, optimized queries

### Running Migrations

**Automatic Migration (Recommended):**

```bash
# Navigate to your Synthesis directory
cd /path/to/synthesis

# Run migrations via pnpm
pnpm --filter @synthesis/db migrate
```

**Manual Migration (If Needed):**

```bash
# Connect to PostgreSQL
docker compose exec synthesis-db psql -U postgres -d synthesis

# Run each migration in order
\i packages/db/migrations/003_cost_tracking.sql
\i packages/db/migrations/004_hybrid_search.sql
\i packages/db/migrations/006_file_relationships.sql
\i packages/db/migrations/007_performance_extensions.sql

# Exit
\q
```

### Verifying Migrations

After running migrations, verify they completed successfully:

```bash
# Check applied migrations
docker compose exec synthesis-db psql -U postgres -d synthesis -c "
SELECT * FROM schema_migrations ORDER BY version;
"
```

Expected output should include versions: `003`, `004`, `006`, `007`

**Verify new tables:**

```bash
docker compose exec synthesis-db psql -U postgres -d synthesis -c "
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
"
```

Should include: `api_usage`, `budget_alerts`, `file_relationships`

**Verify extensions:**

```bash
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\dx"
```

Should include: `vector`, `pg_trgm`, `pg_stat_statements`

**Verify indexes:**

```bash
docker compose exec synthesis-db psql -U postgres -d synthesis -c "
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
"
```

Should include new indexes like: `chunks_text_tsv_idx`, `chunks_text_trgm_idx`, `chunks_metadata_tech_stack_idx`

---

## Upgrade Procedure

Follow these steps for a safe, zero-downtime upgrade.

### Prerequisites

Before starting the upgrade:

1. **Backup your data:**
   ```bash
   # Backup PostgreSQL database
   docker compose exec -T synthesis-db pg_dump -U postgres synthesis > backup_v1_$(date +%Y%m%d).sql

   # Backup storage directory
   tar -czf storage_backup_$(date +%Y%m%d).tar.gz storage/
   ```

2. **Check current version:**
   ```bash
   # From git history or package.json
   git log --oneline -1
   ```

3. **Verify system health:**
   ```bash
   # Check backend
   curl http://localhost:3333/health

   # Check database
   docker compose exec synthesis-db psql -U postgres -d synthesis -c "SELECT COUNT(*) FROM collections;"
   ```

4. **Document current environment:**
   ```bash
   # Save current .env
   cp .env .env.v1.backup
   ```

### Step-by-Step Upgrade

#### Step 1: Pull Latest Code

```bash
# Navigate to project directory
cd /path/to/synthesis

# Fetch latest changes (if using git)
git fetch origin

# Switch to v2.0 branch or tag
git checkout v2.0  # Or main/master if that's your v2.0 branch
# OR pull latest
git pull origin main
```

#### Step 2: Update Dependencies

```bash
# Install new dependencies
pnpm install

# This adds new packages: @voyageai/voyageai, cohere-ai (if not already present)
```

#### Step 3: Update Environment Configuration

```bash
# Edit your .env file
nano .env  # or your preferred editor

# IMPORTANT: Do NOT enable new features yet - keep defaults
# Review the "Environment Variables Migration" section above
# Add any new variables with their DEFAULT values only
```

**Minimal changes needed:**
- Add new variables with default values (features disabled)
- Keep all existing variables unchanged
- Add API keys if you plan to use paid providers (can add later)

#### Step 4: Run Database Migrations

```bash
# Make sure database is running
docker compose up -d synthesis-db

# Run migrations
pnpm --filter @synthesis/db migrate

# You should see output like:
# ✓ Applied migration: 003_cost_tracking.sql
# ✓ Applied migration: 004_hybrid_search.sql
# ✓ Applied migration: 006_file_relationships.sql
# ✓ Applied migration: 007_performance_extensions.sql
```

#### Step 5: Verify Database Schema

```bash
# Verify migrations applied
docker compose exec synthesis-db psql -U postgres -d synthesis -c "
SELECT * FROM schema_migrations ORDER BY version;
"

# Check for new tables
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\dt"

# Verify extensions
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\dx"
```

#### Step 6: Restart Services

```bash
# Stop all services
docker compose down

# Start infrastructure (database, Redis, Ollama)
docker compose up -d synthesis-db redis synthesis-ollama

# Rebuild and start application services
pnpm docker:up
# OR start individually:
# pnpm --filter @synthesis/server dev
# pnpm --filter @synthesis/web dev
```

#### Step 7: Verify Services

```bash
# Check backend health
curl http://localhost:3333/health

# Should return: {"status":"ok"}

# Check frontend
curl http://localhost:5173

# Should return HTML

# Test basic search (existing collection)
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"test","collectionId":"your-collection-id","topK":5}'
```

#### Step 8: Test Existing Functionality

**Critical Tests:**
1. List existing collections
2. Perform a search on existing data
3. Upload a document (if possible)
4. Use MCP server tools (if applicable)

```bash
# List collections
curl http://localhost:3333/api/collections

# Test search on existing collection
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"authentication","collectionId":"YOUR_COLLECTION_ID","topK":5}'
```

#### Step 9: Enable New Features (Optional)

Now that the upgrade is verified, you can **selectively enable** v2.0 features:

```bash
# Edit .env
nano .env

# Example: Enable hybrid search
SEARCH_MODE=hybrid

# Example: Enable code chunking for new uploads
CODE_CHUNKING=true
TRACK_RELATIONSHIPS=true

# Example: Enable cost tracking
MONTHLY_BUDGET_USD=10
ENABLE_COST_ALERTS=true

# Restart services to apply
docker compose restart
```

**Recommendation:** Enable features one at a time and verify each works correctly.

#### Step 10: Monitor for Issues

After upgrade, monitor for 24-48 hours:

```bash
# Check server logs
docker compose logs -f synthesis-server

# Check database logs
docker compose logs -f synthesis-db

# Monitor performance
curl http://localhost:3333/health
```

---

## Configuration Examples

Here are common v2.0 configurations for different use cases:

### Example 1: Local-Only (Free, Maximum Privacy)

**Use Case:** Personal use, no external API calls, free operation

```bash
# Core
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/synthesis
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
OLLAMA_BASE_URL=http://localhost:11434
STORAGE_PATH=./storage

# Search: Hybrid mode with trust scoring
SEARCH_MODE=hybrid
ENABLE_TRUST_SCORING=true
HYBRID_VECTOR_WEIGHT=0.7
HYBRID_BM25_WEIGHT=0.3

# Embeddings: All local (Ollama only)
DOC_EMBEDDING_PROVIDER=ollama
CODE_EMBEDDING_PROVIDER=ollama
WRITING_EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text

# Re-ranking: Local BGE (free)
RERANKER_PROVIDER=bge

# Code Intelligence
CODE_CHUNKING=true
PRESERVE_IMPORTS=true
TRACK_RELATIONSHIPS=true
TECH_STACK_TAGS=true

# Performance
SEARCH_CACHE_TTL_SECONDS=1800
EMBEDDING_CACHE_TTL_MS=900000

# Cost: No tracking needed (everything is free)
ENABLE_COST_ALERTS=false
```

**Cost:** $0/month (only uses Claude for agent, which you already pay for)

### Example 2: Balanced (Free + Selective Paid Features)

**Use Case:** General use with paid re-ranking for better accuracy

```bash
# Core
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/synthesis
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
OLLAMA_BASE_URL=http://localhost:11434
STORAGE_PATH=./storage

# Search: Hybrid with trust scoring
SEARCH_MODE=hybrid
ENABLE_TRUST_SCORING=true
HYBRID_VECTOR_WEIGHT=0.7
HYBRID_BM25_WEIGHT=0.3

# Embeddings: Mix free + paid
DOC_EMBEDDING_PROVIDER=ollama         # Free for general docs
CODE_EMBEDDING_PROVIDER=voyage        # Paid for code (better quality)
WRITING_EMBEDDING_PROVIDER=ollama     # Free for personal notes
EMBEDDING_MODEL=nomic-embed-text
VOYAGE_API_KEY=pa-your-key-here

# Re-ranking: Paid Cohere (best quality)
RERANKER_PROVIDER=cohere
COHERE_API_KEY=your-cohere-key

# Code Intelligence
CODE_CHUNKING=true
PRESERVE_IMPORTS=true
TRACK_RELATIONSHIPS=true
TECH_STACK_TAGS=true

# Performance
SEARCH_CACHE_TTL_SECONDS=1800
EMBEDDING_CACHE_TTL_MS=900000
RERANK_CACHE_TTL_SECONDS=300

# Cost Monitoring
MONTHLY_BUDGET_USD=10
ENABLE_COST_ALERTS=true
```

**Estimated Cost:** ~$2-5/month (depends on usage)

### Example 3: Full-Featured (All Premium Features)

**Use Case:** Production use, maximum accuracy, all features enabled

```bash
# Core
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/synthesis
REDIS_URL=redis://localhost:6379
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
OLLAMA_BASE_URL=http://localhost:11434
STORAGE_PATH=./storage

# Search: Hybrid with all features
SEARCH_MODE=hybrid
ENABLE_TRUST_SCORING=true
HYBRID_VECTOR_WEIGHT=0.7
HYBRID_BM25_WEIGHT=0.3
FTS_LANGUAGE=english

# Embeddings: Specialized providers for each content type
DOC_EMBEDDING_PROVIDER=ollama
CODE_EMBEDDING_PROVIDER=voyage
WRITING_EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=nomic-embed-text
VOYAGE_API_KEY=pa-your-voyage-key
OPENAI_API_KEY=sk-your-openai-key

# Re-ranking: Paid Cohere
RERANKER_PROVIDER=cohere
COHERE_API_KEY=your-cohere-key

# Synthesis
ENABLE_SYNTHESIS=true
ENABLE_CONTRADICTION_DETECTION=true
CONTRADICTION_MODEL=claude-3-haiku-20240307

# Code Intelligence (all features)
CODE_CHUNKING=true
PRESERVE_IMPORTS=true
TRACK_RELATIONSHIPS=true
CODE_MAX_CHUNK_LINES=100
BACKEND_PARSING=true
TECH_STACK_TAGS=true

# Performance & Caching (aggressive)
SEARCH_CACHE_TTL_SECONDS=3600
SEARCH_CACHE_MAX_ITEMS=1000
EMBEDDING_CACHE_TTL_MS=1800000
EMBEDDING_CACHE_MAX_ITEMS=2000
RERANK_CACHE_TTL_SECONDS=600
RERANK_CACHE_MAX_ITEMS=1000
RELATED_FILES_CACHE_TTL_SECONDS=3600
RELATED_FILES_CACHE_MAX_ITEMS=2000

# Cost Monitoring (strict)
MONTHLY_BUDGET_USD=50
ENABLE_COST_ALERTS=true
```

**Estimated Cost:** ~$10-20/month (depends on usage volume)

### Example 4: Migrating from v1.x (Conservative)

**Use Case:** Just upgraded, want to test safely before enabling features

```bash
# Keep everything exactly as v1.x
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/synthesis
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
OLLAMA_BASE_URL=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text
STORAGE_PATH=./storage

# All v2.0 features DISABLED (explicitly)
SEARCH_MODE=vector
ENABLE_TRUST_SCORING=false
DOC_EMBEDDING_PROVIDER=ollama
RERANKER_PROVIDER=none
ENABLE_SYNTHESIS=false
ENABLE_CONTRADICTION_DETECTION=false
CODE_CHUNKING=false
TRACK_RELATIONSHIPS=false
TECH_STACK_TAGS=false

# Basic caching only
SEARCH_CACHE_TTL_SECONDS=1800
EMBEDDING_CACHE_TTL_MS=900000

# Cost monitoring (doesn't hurt)
ENABLE_COST_ALERTS=false
```

**Cost:** $0/month (identical to v1.x)

**Migration Path:**
1. Run this configuration after upgrade
2. Verify everything works
3. Enable one feature at a time:
   - Day 1: Enable `SEARCH_MODE=hybrid`
   - Day 2: Enable `CODE_CHUNKING=true` for new uploads
   - Day 3: Enable `RERANKER_PROVIDER=bge` (free)
   - Day 4: Enable `TRACK_RELATIONSHIPS=true`
   - etc.

---

## Verification Checklist

Use this checklist to confirm your upgrade was successful:

### ✅ Pre-Upgrade

- [ ] Created database backup
- [ ] Created storage backup
- [ ] Saved current .env as .env.v1.backup
- [ ] Documented current version
- [ ] Verified system health

### ✅ Installation

- [ ] Pulled v2.0 code successfully
- [ ] `pnpm install` completed without errors
- [ ] Updated .env with new variables (defaults)
- [ ] No syntax errors in .env

### ✅ Database

- [ ] Migrations completed without errors
- [ ] Verified schema_migrations includes versions 003, 004, 006, 007
- [ ] New tables exist: `api_usage`, `budget_alerts`, `file_relationships`
- [ ] Extensions installed: `vector`, `pg_trgm`, `pg_stat_statements`
- [ ] Indexes created successfully (check `\di` in psql)

### ✅ Services

- [ ] Database started: `docker compose ps` shows synthesis-db healthy
- [ ] Backend started: `curl http://localhost:3333/health` returns OK
- [ ] Frontend accessible: `curl http://localhost:5173` returns HTML
- [ ] MCP server running (if used): Check process/logs

### ✅ Existing Data

- [ ] Can list collections: `curl http://localhost:3333/api/collections`
- [ ] Collections show correct count
- [ ] Can search existing collection
- [ ] Search returns expected results
- [ ] Document count unchanged
- [ ] Chunk count unchanged

### ✅ Basic Functionality

- [ ] Can create new collection
- [ ] Can upload document
- [ ] Can search new collection
- [ ] Can use agent tools (if applicable)
- [ ] MCP tools work (if applicable)

### ✅ New Features (If Enabled)

- [ ] Hybrid search returns results (if `SEARCH_MODE=hybrid`)
- [ ] Code chunking preserves functions (if `CODE_CHUNKING=true`)
- [ ] File relationships tracked (if `TRACK_RELATIONSHIPS=true`)
- [ ] Cost tracking records API usage (if enabled)
- [ ] Re-ranking improves results (if `RERANKER_PROVIDER` set)
- [ ] Tech stack tags appear (if `TECH_STACK_TAGS=true`)

### ✅ Performance

- [ ] Search latency acceptable (<600ms for hybrid, <500ms for vector)
- [ ] No memory leaks observed
- [ ] No database connection errors
- [ ] Cache working (check logs for cache hits)

### ✅ Monitoring

- [ ] Server logs show no errors
- [ ] Database logs show no errors
- [ ] No budget alerts (if cost tracking enabled)
- [ ] Ollama responsive (if using local embeddings)

### SQL Verification Queries

Run these to verify database state:

```sql
-- Check migration versions
SELECT * FROM schema_migrations ORDER BY version;

-- Count existing data
SELECT
  (SELECT COUNT(*) FROM collections) as collections,
  (SELECT COUNT(*) FROM documents) as documents,
  (SELECT COUNT(*) FROM chunks) as chunks;

-- Check new tables exist
SELECT COUNT(*) FROM api_usage;        -- Should return 0 initially
SELECT COUNT(*) FROM budget_alerts;    -- Should return 0 initially
SELECT COUNT(*) FROM file_relationships; -- Should return 0 initially

-- Verify indexes
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE '%tech_stack%';

-- Check extensions
SELECT * FROM pg_extension;
```

---

## Rollback Procedure

If you encounter critical issues, you can safely roll back to v1.x. **Note:** Any data created in v2.0 (cost tracking, file relationships) will not be accessible after rollback, but your core collections and documents remain intact.

### When to Rollback

Consider rollback if:
- Critical functionality is broken
- Unacceptable performance degradation
- Data corruption detected
- Need to troubleshoot without time pressure

**Do NOT rollback for:**
- New features not working (disable them instead)
- Planned maintenance windows
- Minor performance issues (tune configuration first)

### Rollback Steps

#### Step 1: Stop Services

```bash
cd /path/to/synthesis
docker compose down
```

#### Step 2: Restore Code

```bash
# Option A: Git checkout previous version
git checkout v1.x  # Or your previous branch/tag

# Option B: Restore from backup
# (if you don't use git)
rm -rf apps packages
tar -xzf synthesis_v1_backup.tar.gz

# Reinstall v1.x dependencies
pnpm install
```

#### Step 3: Restore Environment

```bash
# Restore old .env
cp .env.v1.backup .env
```

#### Step 4: Database Decision

You have **two options** for the database:

**Option A: Keep v2.0 Database (Recommended)**
- v2.0 migrations are backwards compatible
- Your data remains intact
- v1.x will simply ignore new tables
- No data loss

```bash
# Do nothing - just restart services
```

**Option B: Restore v1.x Database**
- Only if you suspect database corruption
- Lose any data created after upgrade
- Takes longer

```bash
# Stop database
docker compose stop synthesis-db

# Restore backup
docker compose exec -T synthesis-db psql -U postgres synthesis < backup_v1_YYYYMMDD.sql

# Or restore volume
docker compose down
docker volume rm synthesis_postgres_data
docker compose up -d synthesis-db
# Then restore SQL backup
```

#### Step 5: Restart Services

```bash
# Start infrastructure
docker compose up -d synthesis-db synthesis-ollama

# Start application
pnpm --filter @synthesis/server dev &
pnpm --filter @synthesis/web dev &

# OR using Docker
pnpm docker:up
```

#### Step 6: Verify Rollback

```bash
# Check health
curl http://localhost:3333/health

# List collections
curl http://localhost:3333/api/collections

# Test search
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"test","collectionId":"YOUR_COLLECTION_ID","topK":5}'
```

#### Step 7: Document Issues

If you rolled back, document what went wrong:

```bash
# Create rollback report
cat > rollback_report.txt << EOF
Date: $(date)
Reason for rollback: [YOUR REASON]
Error messages: [PASTE ERRORS]
Steps attempted before rollback: [LIST STEPS]
Version rolled back from: v2.0
Version rolled back to: v1.x
EOF
```

**Share this report** with the Synthesis team or GitHub issues.

### Re-attempting Upgrade

After fixing issues:

1. Review rollback report
2. Address root cause
3. Test in development environment first
4. Follow upgrade procedure again
5. Monitor more closely

---

## Troubleshooting

Common issues and solutions:

### Issue 1: Migration Fails

**Symptom:**
```
Error: Migration 004_hybrid_search.sql failed
ERROR: extension "pg_trgm" is not available
```

**Solution:**
```bash
# Install PostgreSQL contrib package
docker compose exec synthesis-db bash
apt-get update && apt-get install -y postgresql-contrib
exit

# Retry migration
pnpm --filter @synthesis/db migrate
```

**Prevention:** Use official Postgres 16 image with contrib modules

---

### Issue 2: Search Returns No Results

**Symptom:**
- Searches that worked in v1.x return empty results after upgrade
- No errors in logs

**Solution:**

```bash
# Check if hybrid mode is causing issues
# Edit .env, temporarily disable hybrid:
SEARCH_MODE=vector

# Restart
docker compose restart synthesis-server

# Test search again
```

**Root Cause:** Full-text indexes may not be built yet for existing data

**Permanent Fix:**
```sql
-- Rebuild full-text indexes
REINDEX INDEX chunks_text_tsv_idx;
REINDEX INDEX chunks_text_trgm_idx;
```

---

### Issue 3: High Latency After Upgrade

**Symptom:**
- Searches that were <500ms now take 2-3 seconds
- Timeouts on large collections

**Solution 1: Adjust cache settings**
```bash
# Increase cache TTL in .env
SEARCH_CACHE_TTL_SECONDS=3600
SEARCH_CACHE_MAX_ITEMS=1000
EMBEDDING_CACHE_TTL_MS=1800000

# Restart
docker compose restart synthesis-server
```

**Solution 2: Disable expensive features**
```bash
# If using hybrid mode, check weights
HYBRID_VECTOR_WEIGHT=0.8  # Favor faster vector search
HYBRID_BM25_WEIGHT=0.2

# Disable re-ranking temporarily
RERANKER_PROVIDER=none

# Restart
docker compose restart synthesis-server
```

**Solution 3: Analyze slow queries**
```sql
-- Enable query logging
ALTER DATABASE synthesis SET log_min_duration_statement = 1000;

-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

### Issue 4: "Budget Limit Reached" Despite Having Budget

**Symptom:**
```
Error: Monthly budget limit reached. Switching to free providers.
```

**Solution:**
```bash
# Check current spend
docker compose exec synthesis-db psql -U postgres -d synthesis -c "
SELECT provider, SUM(cost_usd) as total_cost
FROM api_usage
WHERE created_at >= date_trunc('month', CURRENT_DATE)
GROUP BY provider;
"

# If spend is actually under budget, reset alerts
docker compose exec synthesis-db psql -U postgres -d synthesis -c "
UPDATE budget_alerts SET acknowledged = true WHERE period = 'monthly';
"

# Verify budget setting in .env
MONTHLY_BUDGET_USD=10  # Increase if needed

# Restart
docker compose restart synthesis-server
```

---

### Issue 5: Code Chunking Breaks Uploads

**Symptom:**
- Document uploads fail or timeout
- Logs show: `Error parsing AST` or `Chunking failed`

**Solution:**
```bash
# Disable code chunking temporarily
CODE_CHUNKING=false

# Restart
docker compose restart synthesis-server

# Try upload again - should work

# To fix code chunking:
# Check which file is failing
docker compose logs synthesis-server | grep "Error parsing"

# That file may have syntax errors or unsupported language
```

**Workaround:** Disable code chunking for problematic files, use simple chunking

---

### Issue 6: Missing API Keys Error

**Symptom:**
```
Error: VOYAGE_API_KEY is required when CODE_EMBEDDING_PROVIDER=voyage
```

**Solution:**
```bash
# Option 1: Add the API key
VOYAGE_API_KEY=pa-your-key-here

# Option 2: Switch to free provider
CODE_EMBEDDING_PROVIDER=ollama

# Restart
docker compose restart synthesis-server
```

**Prevention:** Review "Configuration Examples" section for your use case

---

### Issue 7: File Relationships Not Appearing

**Symptom:**
- Uploaded code files but no relationships tracked
- `file_relationships` table is empty

**Root Cause:** Feature flag not enabled

**Solution:**
```bash
# Enable relationship tracking
TRACK_RELATIONSHIPS=true

# Restart
docker compose restart synthesis-server

# Re-upload affected documents
# Relationships only tracked on NEW uploads after enabling
```

**Note:** Existing documents won't have relationships retroactively - only new uploads

---

### Issue 8: Database Connection Errors

**Symptom:**
```
Error: Connection to database failed
ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
```bash
# Check database is running
docker compose ps synthesis-db

# If not running, start it
docker compose up -d synthesis-db

# Check logs for errors
docker compose logs synthesis-db

# Verify DATABASE_URL is correct
echo $DATABASE_URL
# Should be: postgresql://postgres:postgres@localhost:5432/synthesis
```

**Common Mistakes:**
- DATABASE_URL points to wrong host (should be `localhost` when running locally)
- PostgreSQL not started
- Port 5432 conflict with existing Postgres installation

---

### Issue 9: Ollama Embeddings Not Working

**Symptom:**
```
Error: Failed to generate embeddings
Connection refused to http://localhost:11434
```

**Solution:**
```bash
# Check Ollama is running
docker compose ps synthesis-ollama

# If not running, start it
docker compose up -d synthesis-ollama

# Verify models are pulled
docker compose exec synthesis-ollama ollama list

# Should show: nomic-embed-text

# If not, pull the model
docker compose exec synthesis-ollama ollama pull nomic-embed-text

# Test manually
curl http://localhost:11434/api/tags
```

---

### Issue 10: Frontend Can't Connect to Backend

**Symptom:**
- Frontend loads but shows "Cannot connect to server"
- API calls fail with CORS errors

**Solution:**
```bash
# Check backend is running
curl http://localhost:3333/health

# Check CORS configuration in backend
# Should allow http://localhost:5173

# Verify ports in .env
SERVER_PORT=3333
WEB_PORT=5173

# Restart both
docker compose restart synthesis-server
pnpm --filter @synthesis/web dev
```

---

### Getting Help

If issues persist:

1. **Check Logs:**
   ```bash
   # Server logs
   docker compose logs -f synthesis-server

   # Database logs
   docker compose logs -f synthesis-db
   ```

2. **Check GitHub Issues:**
   - Search: https://github.com/Beaulewis1977/synthesis/issues
   - Create new issue with:
     - Error messages
     - Steps to reproduce
     - Environment details (OS, Docker version, etc.)
     - Relevant logs

3. **Consult Documentation:**
   - `docs/02_ARCHITECTURE.md` - System architecture
   - `docs/10_ENV_SETUP.md` - Environment configuration
   - `docs/phases/` - Phase-specific documentation

4. **Community Support:**
   - GitHub Discussions
   - Project Discord/Slack (if available)

---

## Summary

**v2.0 Upgrade in Brief:**

1. **Backup** your database and storage
2. **Pull** latest code
3. **Install** new dependencies: `pnpm install`
4. **Migrate** database: `pnpm --filter @synthesis/db migrate`
5. **Configure** .env with default values (features OFF)
6. **Restart** services
7. **Verify** existing functionality works
8. **Enable** new features incrementally
9. **Monitor** for 24-48 hours

**Key Takeaways:**

- ✅ **Zero breaking changes** - v1.x collections work as-is
- ✅ **Opt-in features** - Enable at your own pace
- ✅ **Free by default** - Only pay if you want premium features
- ✅ **Easy rollback** - Can revert safely if needed
- ✅ **Backwards compatible** - Database migrations are additive only

**Recommended First Steps After Upgrade:**

1. Keep all features OFF initially
2. Verify existing functionality works
3. Enable `SEARCH_MODE=hybrid` (free, low risk)
4. Enable `CODE_CHUNKING=true` (free, improves code search)
5. Enable `TRACK_RELATIONSHIPS=true` (free, useful for code)
6. Consider `RERANKER_PROVIDER=bge` (free, better results)
7. Add cost monitoring: `MONTHLY_BUDGET_USD=10`

**Questions?** See the Troubleshooting section or consult project documentation.

---

**Document Revision History:**

- v1.0 (2025-11-13): Initial migration guide for v2.0 release
