# Database Schema & Migrations
**Version:** 1.0  
**Last Updated:** October 6, 2025

---

## 🎯 Schema Design Principles

1. **Multi-project from day 1** - Collections isolate projects
2. **Vector-ready** - pgvector dimensionless support
3. **Status tracking** - Know where documents are in pipeline
4. **Extensible** - JSONB metadata for future fields
5. **Simple** - No over-normalization

---

## 📊 Database: PostgreSQL 16.4

### Extensions Required
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

---

## 📦 Tables

### 1. collections
**Purpose:** Isolate different projects/contexts

```sql
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for listing
CREATE INDEX collections_created_at_idx ON collections (created_at DESC);
```

**Sample Data:**
```sql
INSERT INTO collections (name, description) VALUES
  ('Flutter Projects', 'All Flutter and Dart documentation'),
  ('Supabase Stack', 'Supabase, Postgres, and backend docs'),
  ('Personal Notes', 'Project plans and personal documentation');
```

---

### 2. documents
**Purpose:** Track uploaded/fetched documents

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  
  -- File info
  title TEXT NOT NULL,
  file_path TEXT,  -- Local storage path or URL
  content_type TEXT,  -- application/pdf, text/markdown, etc
  file_size BIGINT,  -- Bytes
  source_url TEXT,  -- If fetched from web
  
  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending',
  -- Values: pending | extracting | chunking | embedding | complete | error
  error_message TEXT,
  
  -- Metadata (extensible)
  metadata JSONB DEFAULT '{}'::jsonb,
  -- Example: {"author": "...", "date": "...", "tags": [...]}
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX documents_collection_id_idx ON documents (collection_id);
CREATE INDEX documents_status_idx ON documents (status);
CREATE INDEX documents_created_at_idx ON documents (created_at DESC);
```

**Status Flow:**
```
pending → extracting → chunking → embedding → complete
                                              ↘ error
```

---

### 3. chunks
**Purpose:** Store document fragments with vector embeddings

```sql
CREATE TABLE chunks (
  id BIGSERIAL PRIMARY KEY,
  doc_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  
  -- Chunk info
  chunk_index INT NOT NULL,  -- 0-based position in document
  text TEXT NOT NULL,  -- The actual content
  token_count INT,  -- Approximate tokens
  
  -- Vector embedding
  embedding VECTOR(768),  -- Dimensionless, but nomic-embed-text is 768
  -- Change to VECTOR(1024) if using Voyage
  embedding_model TEXT DEFAULT 'nomic-embed-text',
  
  -- Metadata (extensible)
  metadata JSONB DEFAULT '{}'::jsonb,
  -- Example: {"page": 5, "heading": "Setup Guide", "section": "2.1"}
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure no duplicate chunks per document
  UNIQUE(doc_id, chunk_index)
);

-- Vector search index (HNSW for speed)
CREATE INDEX chunks_embedding_hnsw ON chunks 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
-- m = max connections per layer, ef_construction = build-time search depth

-- Foreign key index
CREATE INDEX chunks_doc_id_idx ON chunks (doc_id);

-- Full text search (optional, Phase 2)
-- CREATE INDEX chunks_text_fts ON chunks USING gin(to_tsvector('english', text));
```

**Vector Index Tuning:**
- `m = 16` - Good balance of speed/accuracy
- `ef_construction = 64` - Build quality
- For Phase 2, increase if search quality insufficient

---

## 🔄 Migrations

### Migration Strategy
- Plain SQL files
- Numbered sequentially
- Rollback scripts included

### Directory Structure
```
packages/db/migrations/
├── 001_initial_schema.sql
├── 001_down.sql
├── 002_add_indexes.sql
├── 002_down.sql
└── 003_seed_collections.sql
```

---

### Migration 001: Initial Schema

**File:** `packages/db/migrations/001_initial_schema.sql`

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Collections table
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX collections_created_at_idx ON collections (created_at DESC);

-- Documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_path TEXT,
  content_type TEXT,
  file_size BIGINT,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX documents_collection_id_idx ON documents (collection_id);
CREATE INDEX documents_status_idx ON documents (status);
CREATE INDEX documents_created_at_idx ON documents (created_at DESC);

-- Chunks table
CREATE TABLE chunks (
  id BIGSERIAL PRIMARY KEY,
  doc_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  text TEXT NOT NULL,
  token_count INT,
  embedding VECTOR(768),
  embedding_model TEXT DEFAULT 'nomic-embed-text',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(doc_id, chunk_index)
);

CREATE INDEX chunks_embedding_hnsw ON chunks 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX chunks_doc_id_idx ON chunks (doc_id);
```

**Rollback:** `packages/db/migrations/001_down.sql`

```sql
DROP TABLE IF EXISTS chunks CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS collections CASCADE;
DROP EXTENSION IF EXISTS vector;
```

---

### Migration 002: Seed Data

**File:** `packages/db/migrations/002_seed_collections.sql`

```sql
-- Create default collections
INSERT INTO collections (id, name, description) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Getting Started', 'Tutorial and setup documentation'),
  ('00000000-0000-0000-0000-000000000002', 'Flutter & Dart', 'Mobile development documentation'),
  ('00000000-0000-0000-0000-000000000003', 'Supabase Stack', 'Backend and database documentation')
ON CONFLICT DO NOTHING;
```

**Rollback:** `packages/db/migrations/002_down.sql`

```sql
DELETE FROM collections WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
);
```

---

## 🔍 Key Queries

### Get Collections with Doc Counts
```sql
SELECT 
  c.id,
  c.name,
  c.description,
  COUNT(d.id) as doc_count,
  c.created_at
FROM collections c
LEFT JOIN documents d ON d.collection_id = c.id
GROUP BY c.id
ORDER BY c.created_at DESC;
```

### Get Documents in Collection
```sql
SELECT 
  d.id,
  d.title,
  d.content_type,
  d.file_size,
  d.status,
  d.created_at,
  COUNT(ch.id) as chunk_count
FROM documents d
LEFT JOIN chunks ch ON ch.doc_id = d.id
WHERE d.collection_id = $1
GROUP BY d.id
ORDER BY d.created_at DESC;
```

### Vector Search
```sql
SELECT 
  ch.id,
  ch.text,
  ch.metadata,
  d.id as doc_id,
  d.title as doc_title,
  (ch.embedding <=> $1::vector) as distance,
  (1 - (ch.embedding <=> $1::vector)) as similarity
FROM chunks ch
JOIN documents d ON d.id = ch.doc_id
WHERE d.collection_id = $2
ORDER BY ch.embedding <=> $1::vector
LIMIT $3;
```
**Parameters:**
- `$1` = query embedding vector
- `$2` = collection_id (UUID)
- `$3` = top_k (INT)

**Note:** `<=>` is cosine distance operator from pgvector

---

### Get Document Processing Status
```sql
SELECT 
  d.id,
  d.title,
  d.status,
  d.error_message,
  d.created_at,
  d.processed_at,
  COUNT(ch.id) as chunks_processed
FROM documents d
LEFT JOIN chunks ch ON ch.doc_id = d.id
WHERE d.id = $1
GROUP BY d.id;
```

---

## 📈 Database Statistics

### Typical Sizes (estimates)

| Item | Count | Size |
|------|-------|------|
| **Collections** | 5-10 | ~10 KB |
| **Documents** | 100-500 per collection | ~50 KB |
| **Chunks** | 50-200 per document | ~1-2 MB per doc |
| **Embeddings** | 768 floats × 4 bytes | ~3 KB per chunk |

**Total for 500 docs:**
- Documents: 25 MB
- Chunks (text): 500-1000 MB
- Embeddings: 150-300 MB
- **Total DB size: ~1.5 GB**

---

## 🎯 Performance Tuning

### Analyze Queries
```sql
-- Run after bulk inserts
ANALYZE chunks;
ANALYZE documents;
ANALYZE collections;
```

### Vacuum (periodic maintenance)
```sql
-- Weekly or after large deletes
VACUUM ANALYZE chunks;
```

### Monitor Index Usage
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

---

## 🔧 Database Client (TypeScript)

**File:** `packages/db/src/client.ts`

```typescript
import { Pool } from 'pg';

let pool: Pool | undefined;

export function getPool(connectionString: string) {
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 20,  // Max connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    // Handle errors
    pool.on('error', (err) => {
      console.error('Unexpected database error', err);
    });
  }
  
  return pool;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
```

---

## 🔒 Security Considerations

### Connection String
```bash
# Development
DATABASE_URL=postgres://postgres:postgres@localhost:5432/synthesis

# Production (use stronger password)
DATABASE_URL=postgres://synthesis_user:STRONG_PASSWORD@db:5432/synthesis
```

### Access Control (Phase 2)
```sql
-- Create read-only user for analytics
CREATE USER synthesis_readonly WITH PASSWORD '...';
GRANT CONNECT ON DATABASE synthesis TO synthesis_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO synthesis_readonly;
```

---

## 📊 Monitoring

### Key Metrics to Track

```sql
-- Database size
SELECT pg_size_pretty(pg_database_size('synthesis'));

-- Table sizes
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(tablename::regclass))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::regclass) DESC;

-- Active connections
SELECT count(*) FROM pg_stat_activity 
WHERE datname = 'synthesis';

-- Slow queries (enable pg_stat_statements extension)
SELECT 
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## 🚀 Migration Runner

**File:** `packages/db/src/migrate.ts`

```typescript
import fs from 'fs';
import path from 'path';
import { getPool } from './client';

export async function runMigrations(connectionString: string) {
  const pool = getPool(connectionString);
  const migrationsDir = path.join(__dirname, '../migrations');
  
  // Create migrations table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  
  // Get applied migrations
  const { rows: applied } = await pool.query(
    'SELECT name FROM migrations ORDER BY id'
  );
  const appliedSet = new Set(applied.map(r => r.name));
  
  // Get migration files
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.endsWith('_down.sql'))
    .sort();
  
  // Apply pending migrations
  for (const file of files) {
    if (appliedSet.has(file)) continue;
    
    console.log(`Applying migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query(
        'INSERT INTO migrations (name) VALUES ($1)',
        [file]
      );
      await pool.query('COMMIT');
      console.log(`✓ Applied ${file}`);
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error(`✗ Failed to apply ${file}:`, error);
      throw error;
    }
  }
}
```

**Usage:**
```bash
pnpm --filter @synthesis/db migrate
```

---

## 🎯 Future Enhancements (Post-MVP)

### Phase 2 Additions

#### 1. Document Versions
```sql
ALTER TABLE documents ADD COLUMN version INT DEFAULT 1;
ALTER TABLE documents ADD COLUMN parent_doc_id UUID REFERENCES documents(id);
```

#### 2. Tags
```sql
CREATE TABLE document_tags (
  doc_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (doc_id, tag)
);

CREATE INDEX document_tags_tag_idx ON document_tags (tag);
```

#### 3. User Activity Log
```sql
CREATE TABLE activity_log (
  id BIGSERIAL PRIMARY KEY,
  collection_id UUID REFERENCES collections(id),
  action TEXT NOT NULL,  -- 'search', 'upload', 'delete', etc
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4. Full-Text Search (Hybrid)
```sql
-- Add GIN index for keyword search
CREATE INDEX chunks_text_gin ON chunks 
  USING gin(to_tsvector('english', text));

-- Combined vector + keyword search (Phase 2)
```

---

## ✅ Schema Validation Checklist

Before going live:

- [ ] All extensions installed
- [ ] All tables created
- [ ] All indexes created
- [ ] Foreign keys enforced
- [ ] Seed data loaded
- [ ] Connection pool configured
- [ ] Migration runner tested
- [ ] Backup strategy defined
- [ ] Performance tested with 1000+ chunks

---

**This schema is simple, extensible, and ready for your autonomous RAG system.**
