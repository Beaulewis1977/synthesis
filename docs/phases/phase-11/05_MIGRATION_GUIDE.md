# Phase 11: Migration Guide

**Upgrading from Phase 7 to Phase 11 (Hybrid Search)**

---

## 🎯 Overview

This guide helps you migrate from Phase 7 (basic vector search) to Phase 11 (hybrid search with multi-provider embeddings) with **zero breaking changes**.

**Key Promise:** All existing collections continue to work without modification.

---

## ✅ Prerequisites

Before starting migration:

- [ ] Phase 7 (Docker) is complete and stable
- [ ] All existing documents are searchable
- [ ] Database backup created
- [ ] Test environment available for validation

---

## 📋 Migration Steps

### Step 1: Database Migration (5 minutes)

Run the Phase 11 database migration:

```bash
# Backup first!
pg_dump synthesis > backup_pre_phase11.sql

# Run migration
npm run migrate:up

# Verify migration
npm run migrate:status
# Should show: ✓ 004_hybrid_search.sql
```

**What the migration does:**
```sql
-- Adds full-text search support
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX chunks_text_gin_idx ON chunks 
  USING gin(to_tsvector('english', text));

-- Adds metadata columns (nullable, backwards compatible)
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS source_quality TEXT DEFAULT 'community',
  ADD COLUMN IF NOT EXISTS framework_version TEXT;

-- No data modification, purely additive
```

**Impact:** <1 minute downtime for index creation

---

### Step 2: Update Environment Variables (2 minutes)

Add new configuration to `.env`:

```bash
# Phase 11: Hybrid Search
SEARCH_MODE=vector  # Start with 'vector' (same as Phase 7)
HYBRID_VECTOR_WEIGHT=0.7
HYBRID_BM25_WEIGHT=0.3

# Phase 11: Multi-Provider Embeddings
DEFAULT_EMBEDDING_PROVIDER=ollama  # Free, no API key needed
DOC_EMBEDDING_PROVIDER=ollama
CODE_EMBEDDING_PROVIDER=ollama

# Optional: Add API keys later
# OPENAI_API_KEY=sk-...
# VOYAGE_API_KEY=vo-...
```

**Important:** Start with `SEARCH_MODE=vector` to maintain Phase 7 behavior.

---

### Step 3: Deploy Phase 11 Code (5 minutes)

```bash
# Pull latest code
git checkout main
git pull origin main

# Install dependencies
npm install

# Build
npm run build

# Restart services
docker-compose restart server
```

**Verification:**
```bash
# Check server logs
docker-compose logs -f server

# Should see:
# ✓ Search mode: vector
# ✓ Embedding provider: ollama
# ✓ Hybrid search available: true
```

---

### Step 4: Validate Existing Collections (10 minutes)

Test that existing collections still work:

```bash
# Test search on existing collection
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test query",
    "collection_id": "existing_collection_id",
    "top_k": 10
  }'

# Should return results (same as Phase 7)
```

**Expected:** All searches work identically to Phase 7.

---

### Step 5: Gradually Enable Hybrid Search (15 minutes)

Once validated, enable hybrid search:

**Option A: Global (all collections)**
```bash
# Update .env
SEARCH_MODE=hybrid

# Restart
docker-compose restart server
```

**Option B: Per-collection (safer)**
```typescript
// Test on one collection first
await searchDocuments({
  query: "test",
  collection_id: "test_collection",
  search_mode: "hybrid" // Override global setting
});
```

**Compare results:**
```bash
# Vector search (Phase 7 behavior)
curl -X POST http://localhost:3000/api/search \
  -d '{"query": "StatefulWidget", "search_mode": "vector"}'

# Hybrid search (Phase 11)
curl -X POST http://localhost:3000/api/search \
  -d '{"query": "StatefulWidget", "search_mode": "hybrid"}'

# Hybrid should find both semantic matches AND exact keyword matches
```

---

### Step 6: Add Trust Scoring (Optional, 30 minutes)

Backfill trust scores for existing documents:

```sql
-- Mark official Flutter docs
UPDATE documents
SET source_quality = 'official'
WHERE url LIKE '%docs.flutter.dev%'
   OR url LIKE '%dart.dev%';

-- Mark verified sources
UPDATE documents
SET source_quality = 'verified'
WHERE url LIKE '%github.com/flutter%'
   OR url LIKE '%medium.com/flutter%';

-- Everything else stays 'community' (default)
```

**UI Update:** Trust badges will now appear in search results.

---

### Step 7: Switch to Paid Embeddings (Optional)

If you want better code search, add Voyage API:

```bash
# Get API key from https://www.voyageai.com/
VOYAGE_API_KEY=vo-your-key-here

# Configure routing
CODE_EMBEDDING_PROVIDER=voyage-code-2
DOC_EMBEDDING_PROVIDER=ollama  # Keep docs free
```

**Cost Impact:** ~$2-5/month for 20k code files.

---

## 🔄 Rollback Plan

If issues arise, rollback is simple:

### Quick Rollback (30 seconds)
```bash
# Revert to vector-only search
SEARCH_MODE=vector

# Restart
docker-compose restart server
```

**Impact:** System reverts to Phase 7 behavior instantly.

### Full Rollback (5 minutes)
```bash
# Revert code
git checkout phase-7-tag

# Revert database (if needed)
psql synthesis < backup_pre_phase11.sql

# Restart
docker-compose down
docker-compose up -d
```

---

## 🧪 Testing Strategy

### Test Checklist

**Before enabling hybrid search:**
- [ ] All existing searches work with `SEARCH_MODE=vector`
- [ ] No performance degradation
- [ ] No errors in logs
- [ ] Database migration successful

**After enabling hybrid search:**
- [ ] Search results improved (better relevance)
- [ ] Latency stays <600ms
- [ ] Exact keyword matches found
- [ ] No regression on semantic search

**Test queries:**
```typescript
const testQueries = [
  // Exact matches (hybrid should excel)
  "StatefulWidget",
  "BuildContext",
  "Navigator.push",
  
  // Semantic (both should work)
  "how to navigate between screens",
  "state management patterns",
  
  // Mixed (hybrid advantage)
  "Flutter authentication with Firebase"
];
```

---

## 📊 Expected Improvements

### Retrieval Accuracy

| Query Type | Phase 7 (Vector) | Phase 11 (Hybrid) | Improvement |
|------------|------------------|-------------------|-------------|
| Exact API names | 60% recall | 95% recall | +58% |
| Semantic concepts | 75% | 80% | +7% |
| Mixed queries | 65% | 85% | +31% |

### Latency

| Operation | Phase 7 | Phase 11 | Change |
|-----------|---------|----------|--------|
| Vector search | 250ms | 250ms | No change |
| Hybrid search | N/A | 350ms | +100ms |

**Note:** Hybrid search is slightly slower but much more accurate.

---

## 🚨 Common Issues

### Issue 1: BM25 Index Not Created

**Symptom:** Hybrid search falls back to vector-only

**Solution:**
```sql
-- Manually create index
CREATE INDEX chunks_text_gin_idx ON chunks 
  USING gin(to_tsvector('english', text));
```

### Issue 2: Performance Degradation

**Symptom:** Search >1 second with hybrid mode

**Solution:**
```bash
# Reduce BM25 weight (less accurate but faster)
HYBRID_BM25_WEIGHT=0.1
HYBRID_VECTOR_WEIGHT=0.9
```

### Issue 3: API Key Errors

**Symptom:** "Voyage API key invalid"

**Solution:**
```bash
# Fallback to Ollama
CODE_EMBEDDING_PROVIDER=ollama

# Or fix API key
VOYAGE_API_KEY=vo-correct-key
```

---

## 📈 Monitoring

### Metrics to Track

**After migration:**
- Search latency (p95 should stay <600ms)
- Search accuracy (user feedback)
- API costs (if using paid embeddings)
- Error rate (should be <0.1%)

**Grafana queries:**
```promql
# Search latency
histogram_quantile(0.95, rate(search_duration_seconds_bucket[5m]))

# Hybrid vs vector usage
sum(rate(search_total{mode="hybrid"}[5m]))
sum(rate(search_total{mode="vector"}[5m]))
```

---

## 🎓 User Communication

### Announce to Users

**Subject:** Search Improvements - Hybrid Search Now Live

**Message:**
> We've upgraded our search engine with hybrid search technology:
>
> **What's New:**
> - Better results for exact API names (e.g., "StatefulWidget")
> - Improved accuracy for code search
> - Trust badges showing official vs community sources
>
> **What Hasn't Changed:**
> - All your existing collections work as before
> - No action needed on your part
> - Search speed remains fast (<600ms)
>
> Try searching for "Navigator.push" to see the difference!

---

## ✅ Post-Migration Checklist

- [ ] All existing collections searched successfully
- [ ] Hybrid search enabled and tested
- [ ] Trust badges visible in UI
- [ ] Performance metrics within targets
- [ ] No increase in error rate
- [ ] API costs tracked (if using paid providers)
- [ ] Documentation updated
- [ ] Users notified of improvements
- [ ] Rollback plan documented
- [ ] Team trained on new features

---

## 🚀 Next Steps

After Phase 11 migration is stable:

1. **Optimize weights:** Tune `HYBRID_VECTOR_WEIGHT` and `HYBRID_BM25_WEIGHT` for your use case
2. **Add paid embeddings:** Consider Voyage for code, OpenAI for personal writings
3. **Proceed to Phase 12:** Re-ranking & document synthesis
4. **Monitor cost:** Track API usage if using paid providers

---

## 📞 Support

**If issues occur:**
1. Check logs: `docker-compose logs -f server`
2. Verify environment: `npm run check:env`
3. Test with vector mode: `SEARCH_MODE=vector`
4. Rollback if needed: See "Rollback Plan" above

---

**Migration Time:** 30-45 minutes  
**Downtime:** <5 minutes (optional, for index creation)  
**Breaking Changes:** None ✅  
**Rollback Time:** <1 minute
