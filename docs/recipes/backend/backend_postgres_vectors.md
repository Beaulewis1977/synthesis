---
title: "Postgres & Vector Search (pgvector)"
platform: backend
framework: postgres
feature_tags:
  - database
  - vectors
usage_tier: recipe
framework_version: "16"
tech_stack:
  - postgres
  - pgvector
difficulty: intermediate
last_updated: 2025-12-08
recommended: true
---

# Postgres & Vector Search (pgvector)

> **Summary:** Manage Supabase/Postgres schemas and implement efficient vector similarity search using `pgvector`.

## Prerequisites

- [ ] PostgreSQL 16+
- [ ] `vector` extension enabled

## Tech Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| pgvector | 0.7.x | Vector extension |
| node-postgres (pg) | ^8.x | Driver |

## Implementation

### 1. Enable Extension & Create Table

```sql
-- Enable extension
create extension if not exists vector;

-- Create table with embedding column (example: 768 dimensions for nomic-embed-text)
create table documents (
  id bigserial primary key,
  content text,
  embedding vector(768)
);

-- Create HNSW index for fast search
create index on documents using hnsw (embedding vector_cosine_ops);
```

### 2. Vector Search Query

Querying for similar documents using cosine distance (`<=>` operator).

```typescript
// apps/server/src/services/search.ts
import { Pool } from 'pg';

export async function searchDocuments(db: Pool, queryEmbedding: number[], limit = 5) {
  // Input validation - prevent injection and ensure correct dimensions
  if (!Array.isArray(queryEmbedding) || queryEmbedding.length !== 768) {
    throw new Error('Invalid embedding: must be array of 768 numbers');
  }
  if (!queryEmbedding.every(n => typeof n === 'number' && isFinite(n))) {
    throw new Error('Invalid embedding: all elements must be finite numbers');
  }
  if (limit < 1 || limit > 100) {
    throw new Error('Limit must be between 1 and 100');
  }

  // Convert JS array to Postgres vector format string: "[0.1, 0.2, ...]"
  const vectorStr = JSON.stringify(queryEmbedding);

  const query = `
    SELECT id, content, 
           1 - (embedding <=> $1) as similarity
    FROM documents
    WHERE 1 - (embedding <=> $1) > 0.7  -- Threshold
    ORDER BY embedding <=> $1
    LIMIT $2
  `;

  const result = await db.query(query, [vectorStr, limit]);
  return result.rows;
}
```

### 3. Migrations

In Synthesis, we use raw SQL migrations.

`packages/db/migrations/005_add_vectors.sql`:
```sql
BEGIN;

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create documents table with 768-dim embedding (for Nomic)
CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(768),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS documents_embedding_idx 
ON documents 
USING hnsw (embedding vector_cosine_ops);

COMMIT;
```

## Common Pitfalls

### 1. Wrong Dimensions

**Problem:** `different vector dimensions 768 vs 1536` error.

**Solution:** Ensure the column definition (`vector(768)`) matches your embedding model output (Nomic = 768, OpenAI v3 = 1536).

### 2. Index Build Time

**Problem:** Creating HNSW index locks the table on huge datasets.

**Solution:** For existing large tables, use `CREATE INDEX CONCURRENTLY`.
