# Phase 11: Build Plan

**4-day implementation schedule**

---

## 📅 Day-by-Day Breakdown

### Day 1: Database & BM25 Search (6 hours)

**Morning (3 hours): Database Setup**

```bash
# 1. Create migration file
touch packages/db/migrations/004_hybrid_search.sql
```

```sql
-- packages/db/migrations/004_hybrid_search.sql

-- Enable full-text search extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add GIN index for full-text search
CREATE INDEX CONCURRENTLY chunks_text_gin_idx ON chunks 
  USING gin(to_tsvector('english', text));

-- Optional: trigram index for fuzzy matching
CREATE INDEX CONCURRENTLY chunks_text_trgm_idx ON chunks 
  USING gin(text gin_trgm_ops);

-- Add optional metadata columns (for query optimization)
-- These are GENERATED columns, so no data migration needed
ALTER TABLE documents 
  ADD COLUMN IF NOT EXISTS source_quality TEXT 
    GENERATED ALWAYS AS (metadata->>'source_quality') STORED,
  ADD COLUMN IF NOT EXISTS framework TEXT
    GENERATED ALWAYS AS (metadata->>'framework') STORED,
  ADD COLUMN IF NOT EXISTS framework_version TEXT
    GENERATED ALWAYS AS (metadata->>'framework_version') STORED;

-- Indexes on generated columns
CREATE INDEX documents_source_quality_idx ON documents(source_quality);
CREATE INDEX documents_framework_idx ON documents(framework);
```

```bash
# 2. Run migration
pnpm --filter @synthesis/db migrate
```

**Afternoon (3 hours): BM25 Implementation**

```bash
# 1. Create BM25 service
touch apps/server/src/services/bm25.ts
```

Implement as per `01_HYBRID_SEARCH_ARCHITECTURE.md` (~150 lines)

```bash
# 2. Write tests
touch apps/server/src/services/bm25.test.ts
```

```typescript
describe('bm25Search', () => {
  it('finds exact keyword matches', async () => {
    // Test implementation
  });
});
```

```bash
# 3. Test manually
pnpm --filter @synthesis/server test bm25
```

**End of Day 1 Checklist:**
- [ ] Migration applied successfully
- [ ] Indexes created
- [ ] BM25 service implemented
- [ ] Unit tests passing
- [ ] Can query BM25 independently

---

### Day 2: Hybrid Search Fusion (6 hours)

**Morning (3 hours): RRF Implementation**

```bash
# 1. Create hybrid service
touch apps/server/src/services/hybrid.ts
```

Implement as per `01_HYBRID_SEARCH_ARCHITECTURE.md` (~200 lines)

Key functions:
- `hybridSearch()`
- `reciprocalRankFusion()`

```bash
# 2. Write tests
touch apps/server/src/services/hybrid.test.ts
```

```typescript
describe('hybridSearch', () => {
  it('combines vector and BM25 results', async () => {
    const results = await hybridSearch(db, {
      query: 'StatefulWidget lifecycle',
      collectionId: 'test',
    });
    
    expect(results[0].source).toBe('both'); // Found in both
    expect(results[0].fusedScore).toBeGreaterThan(0);
  });
});
```

**Afternoon (3 hours): Search Service Integration**

```bash
# 1. Update search service
# Modify: apps/server/src/services/search.ts
```

Add `smartSearch()` wrapper that routes to hybrid or vector based on config.

```bash
# 2. Update search route
# Modify: apps/server/src/routes/search.ts
```

```typescript
// Use smartSearch instead of searchCollection
const results = await smartSearch(db, {
  query: body.query,
  collectionId: body.collection_id,
  topK: body.top_k,
});
```

```bash
# 3. Update agent tool
# Modify: apps/server/src/agent/tools.ts
```

Ensure `search_rag` tool uses `smartSearch`.

**End of Day 2 Checklist:**
- [ ] Hybrid search implemented
- [ ] RRF fusion working
- [ ] Integration tests passing
- [ ] Search route updated
- [ ] Agent tool uses hybrid search

---

### Day 3: Multi-Provider Embeddings (5 hours)

**Morning (3 hours): Provider Setup**

```bash
# 1. Install dependencies
pnpm add openai @voyageai/voyageai
```

```bash
# 2. Create embedding router
touch apps/server/src/services/embedding-router.ts
```

Implement as per `02_EMBEDDING_PROVIDERS.md` (~100 lines)

```bash
# 3. Update embed service
# Modify: apps/server/src/pipeline/embed.ts
```

Add support for OpenAI and Voyage (~150 lines of additions)

```bash
# 4. Environment variables
cp .env.example .env.local
```

Add to `.env.local`:
```bash
# Embedding Providers
DOC_EMBEDDING_PROVIDER=ollama
CODE_EMBEDDING_PROVIDER=voyage-code-2
WRITING_EMBEDDING_PROVIDER=openai

# API Keys (optional)
OPENAI_API_KEY=sk-...
VOYAGE_API_KEY=vo-...
```

**Afternoon (2 hours): Metadata & Testing**

```bash
# 1. Create metadata builder
touch apps/server/src/services/metadata-builder.ts
```

Implement as per `03_METADATA_SCHEMA.md` (~200 lines)

```bash
# 2. Update ingestion pipeline
# Modify: apps/server/src/pipeline/ingest.ts
```

Store embedding metadata with chunks.

```bash
# 3. Test embedding providers
pnpm --filter @synthesis/server test embed
```

**End of Day 3 Checklist:**
- [ ] OpenAI integration working
- [ ] Voyage integration working
- [ ] Embedding router selects correct provider
- [ ] Metadata builder creates valid metadata
- [ ] Ingestion stores embedding metadata
- [ ] Tests passing for all three providers

---

### Day 4: Trust Scoring & Testing (3 hours)

**Morning (2 hours): Trust Scoring**

```bash
# 1. Add trust scoring to search
# Modify: apps/server/src/services/search.ts
```

```typescript
// Apply trust scoring
finalScore = similarity * trustWeight * recencyWeight;

function getTrustWeight(metadata: DocumentMetadata): number {
  switch (metadata.source_quality) {
    case 'official': return 1.0;
    case 'verified': return 0.85;
    case 'community': return 0.6;
    default: return 0.5;
  }
}

function getRecencyWeight(metadata: DocumentMetadata): number {
  if (!metadata.last_verified) return 0.7;
  
  const monthsOld = dayjs().diff(metadata.last_verified, 'months');
  
  if (monthsOld < 6) return 1.0;
  if (monthsOld < 12) return 0.9;
  return 0.7;
}
```

**Afternoon (1 hour): Final Testing & Documentation**

```bash
# 1. Run full test suite
pnpm test

# 2. Test backwards compatibility
# Set SEARCH_MODE=vector and verify old collections work

# 3. Test hybrid mode
# Set SEARCH_MODE=hybrid and verify new features work

# 4. Performance benchmark
touch scripts/benchmark-search.ts
```

```typescript
// Compare latency: vector vs hybrid
const queries = ['StatefulWidget', 'authentication', 'StreamBuilder'];

for (const query of queries) {
  const vectorTime = await benchmark(() => searchCollection(db, { query }));
  const hybridTime = await benchmark(() => hybridSearch(db, { query }));
  
  console.log(`Query: ${query}`);
  console.log(`  Vector: ${vectorTime}ms`);
  console.log(`  Hybrid: ${hybridTime}ms`);
}
```

```bash
# 5. Update documentation
# Update README with new environment variables
# Document search modes
```

**End of Day 4 Checklist:**
- [ ] Trust scoring implemented
- [ ] All tests passing
- [ ] Backwards compatibility verified
- [ ] Performance benchmarks run
- [ ] Documentation updated
- [ ] Ready for PR

---

## 🎯 Acceptance Criteria

### Must Pass Before Merging:

**Functional:**
- [ ] Hybrid search returns combined vector + BM25 results
- [ ] Can configure embedding provider per collection
- [ ] Metadata tracks source quality, version, embedding model
- [ ] Trust scoring affects result ranking
- [ ] Old collections work without changes (SEARCH_MODE=vector)
- [ ] New collections can use hybrid (SEARCH_MODE=hybrid)

**Performance:**
- [ ] Hybrid search completes in <600ms
- [ ] No regressions in vector-only mode
- [ ] Indexes improve BM25 query time

**Quality:**
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Backwards compatibility tests pass
- [ ] No TypeScript errors
- [ ] No linting errors

**MCP:**
- [ ] MCP tools continue to work
- [ ] `search_rag` uses new hybrid search
- [ ] External agents see improved results

---

## 🔧 Commands Reference

```bash
# Development
pnpm dev                          # Start dev server
pnpm --filter @synthesis/server test  # Run tests

# Migration
pnpm --filter @synthesis/db migrate    # Apply migrations

# Build
pnpm build                        # Build all packages

# Testing
pnpm test                         # All tests
pnpm test:integration             # Integration tests
pnpm benchmark                    # Performance tests

# Environment
cp .env.example .env.local        # Setup env vars
```

---

## 📦 Files Created/Modified

### New Files (~750 lines):
- `packages/db/migrations/004_hybrid_search.sql` (~50 lines)
- `apps/server/src/services/bm25.ts` (~150 lines)
- `apps/server/src/services/hybrid.ts` (~200 lines)
- `apps/server/src/services/embedding-router.ts` (~100 lines)
- `apps/server/src/services/metadata-builder.ts` (~200 lines)
- Test files (~200 lines)

### Modified Files (~200 lines):
- `apps/server/src/pipeline/embed.ts` (+150 lines)
- `apps/server/src/services/search.ts` (+50 lines)
- `apps/server/src/routes/search.ts` (+20 lines)
- `apps/server/src/agent/tools.ts` (+10 lines)
- `.env.example` (+10 lines)

**Total: ~950 lines of code**

---

## 🐛 Troubleshooting

### Issue: Migration Fails

```bash
# Check if pg_trgm extension exists
psql $DATABASE_URL -c "SELECT * FROM pg_extension WHERE extname = 'pg_trgm';"

# If not, install manually:
psql $DATABASE_URL -c "CREATE EXTENSION pg_trgm;"
```

### Issue: BM25 Returns No Results

```sql
-- Verify GIN index exists
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'chunks' 
  AND indexname LIKE '%gin%';

-- If missing, create manually:
CREATE INDEX chunks_text_gin_idx ON chunks 
  USING gin(to_tsvector('english', text));
```

### Issue: Hybrid Search Slower Than Expected

```bash
# Check if indexes are being used
EXPLAIN ANALYZE 
SELECT ... FROM chunks 
WHERE to_tsvector('english', text) @@ to_tsquery('english', 'test');

# Should show "Bitmap Index Scan on chunks_text_gin_idx"
```

### Issue: Provider API Errors

```bash
# Verify API keys
echo $OPENAI_API_KEY
echo $VOYAGE_API_KEY

# Test providers independently
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

---

## ✅ Sign-Off

**Before marking Phase 11 complete:**

1. **Demo hybrid search:**
   ```bash
   # Query that shows improvement
   curl -X POST http://localhost:3333/api/search \
     -H "Content-Type: application/json" \
     -d '{
       "query": "StatefulWidget lifecycle methods",
       "collection_id": "flutter-docs",
       "top_k": 5
     }'
   
   # Should show both exact "StatefulWidget" matches AND semantic "lifecycle" concepts
   ```

2. **Verify MCP still works:**
   ```bash
   echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_rag","arguments":{"query":"test","collection_id":"test"}}}' | \
     node apps/mcp/dist/index.js
   ```

3. **Check performance:**
   ```bash
   pnpm benchmark
   # Verify hybrid <600ms
   ```

4. **Tag release:**
   ```bash
   git tag v1.1.0-phase-11
   git push --tags
   ```

---

**Phase 11 Complete!** Ready for Phase 9 (Re-ranking) 🚀
