# Hybrid Search Guide

**Last Updated:** 2025-11-13
**Version:** v2.0.0
**Phase:** 11 (Hybrid Search + RRF)

---

## Overview

Hybrid search combines two powerful search methods to deliver superior result quality:

1. **Vector Search** - Semantic similarity using embeddings (understands meaning)
2. **BM25 Search** - Keyword-based full-text search (matches exact terms)
3. **Reciprocal Rank Fusion (RRF)** - Intelligent merging of results

### Why Hybrid Search?

**Traditional vector-only search problems:**
- Misses exact keyword matches
- Struggles with technical terms and acronyms
- May return semantically similar but contextually wrong results

**BM25-only search problems:**
- No semantic understanding
- Requires exact term matches
- Poor with synonyms and paraphrasing

**Hybrid search benefits:**
- Best of both worlds
- Handles technical terms AND semantic queries
- More robust across different query types
- Sub-600ms query latency (with caching)
- Configurable weighting for your use case

---

## When to Use

### Comparison Matrix

| Search Mode | Best For | Query Examples | Speed | Accuracy |
|-------------|----------|----------------|-------|----------|
| **Vector Only** | Semantic queries, natural language, conceptual searches | "How do I authenticate users?", "Best practices for caching" | Fastest (~200ms) | Good (80-85%) |
| **BM25 Only** | Exact matches, technical terms, specific identifiers | "AuthService.login", "redis SET command", "error code 429" | Fast (~150ms) | Good for exact (75-80%) |
| **Hybrid (RRF)** | Mixed queries, general purpose, unknown query types | "JWT token authentication", "Flutter setState vs Provider", "PostgreSQL connection pool" | Fast (~350ms) | Best (90-95%) |

### Use Hybrid Search When:

1. **Your query contains technical terms** - "How to use Flutter BLoC pattern"
2. **You need both exact and semantic matches** - "Redis caching best practices"
3. **Query intent is unclear** - Let the system figure it out
4. **You want maximum accuracy** - Hybrid consistently outperforms single methods
5. **Your collection has technical documentation** - API docs, code samples, tutorials

### Use Vector Search When:

1. **Queries are purely conceptual** - "How does authentication work?"
2. **Speed is critical** - Need <200ms response time
3. **Collection is semantic-heavy** - Essays, articles, explanations

### Use BM25 Only When:

1. **Searching for exact identifiers** - Function names, error codes
2. **You have pattern-based queries** - "ERROR: connection refused"
3. **Collection has structured technical content** - API references, code snippets

---

## How It Works

### The Three-Stage Process

#### Stage 1: Parallel Search

Both search methods run simultaneously (no added latency):

```typescript
// Vector search: Embed query → Find similar embeddings
const vectorResults = await vectorSearch(db, {
  query: "JWT authentication",
  collectionId: uuid,
  topK: 30  // Fetch 3x final results for fusion
});

// BM25 search: Parse query → Full-text search with ts_rank_cd
const bm25Results = await bm25Search(db, {
  query: "JWT authentication",
  collectionId: uuid,
  topK: 30
});
```

#### Stage 2: Reciprocal Rank Fusion (RRF)

Results are merged using a rank-based scoring algorithm:

**RRF Formula:**
```
fusedScore = Σ(weight / (k + rank + 1))

Where:
- weight = vector weight (0.7) or BM25 weight (0.3)
- k = RRF constant (60, reduces impact of early ranks)
- rank = position in result list (0-indexed)
```

**Example Calculation:**

For a document at rank 5 in vector results and rank 10 in BM25:
```
vectorScore = 0.7 / (60 + 5 + 1) = 0.0106
bm25Score = 0.3 / (60 + 10 + 1) = 0.0042
fusedScore = 0.0106 + 0.0042 = 0.0148
```

**Why RRF Works:**
- Rank-based (not score-based) → avoids scale differences
- k=60 constant → reduces over-weighting of top results
- Additive fusion → results in both lists get boosted
- Handles missing results → documents only in one list still score

#### Stage 3: Ranking & Trust Scoring (Optional)

Results are sorted by fused score. If `ENABLE_TRUST_SCORING=true`, apply quality multipliers:

**Trust Weights:**
- Official sources: 1.0x (no penalty)
- Verified sources: 0.85x
- Community sources: 0.6x
- Unknown sources: 0.5x

**Recency Weights:**
- <6 months old: 1.0x
- 6-12 months old: 0.9x
- >12 months old: 0.7x

**Combined Multiplier:**
```typescript
finalScore = fusedScore * trustWeight * recencyWeight
```

---

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Search Mode
# Options: 'vector' (default) | 'hybrid'
SEARCH_MODE=hybrid

# Trust Scoring (optional quality boost)
# Options: 'true' | 'false' (default)
ENABLE_TRUST_SCORING=false

# Hybrid Fusion Weights (must sum to 1.0)
# Higher vector weight = favor semantic similarity
# Higher BM25 weight = favor keyword matches
HYBRID_VECTOR_WEIGHT=0.7
HYBRID_BM25_WEIGHT=0.3

# Full-Text Search Language
# Options: 'english' (default), 'simple', 'spanish', etc.
# See PostgreSQL text search documentation for full list
FTS_LANGUAGE=english

# Embedding Providers (affects vector search)
DOC_EMBEDDING_PROVIDER=ollama
CODE_EMBEDDING_PROVIDER=voyage
WRITING_EMBEDDING_PROVIDER=openai
```

### Configuration Profiles

#### Profile 1: Balanced (Recommended Default)
```bash
SEARCH_MODE=hybrid
HYBRID_VECTOR_WEIGHT=0.7
HYBRID_BM25_WEIGHT=0.3
ENABLE_TRUST_SCORING=false
```
**Use for:** General purpose, technical documentation, mixed content

#### Profile 2: Keyword-Heavy (Technical)
```bash
SEARCH_MODE=hybrid
HYBRID_VECTOR_WEIGHT=0.5
HYBRID_BM25_WEIGHT=0.5
ENABLE_TRUST_SCORING=false
```
**Use for:** API docs, command references, code-heavy collections

#### Profile 3: Semantic-Heavy (Conceptual)
```bash
SEARCH_MODE=hybrid
HYBRID_VECTOR_WEIGHT=0.85
HYBRID_BM25_WEIGHT=0.15
ENABLE_TRUST_SCORING=false
```
**Use for:** Tutorials, conceptual guides, explanatory content

#### Profile 4: Quality-First (Curated)
```bash
SEARCH_MODE=hybrid
HYBRID_VECTOR_WEIGHT=0.7
HYBRID_BM25_WEIGHT=0.3
ENABLE_TRUST_SCORING=true
```
**Use for:** Collections with source quality metadata, official docs

---

## Step-by-Step Tutorial

### 1. Setup & Configuration

```bash
# Navigate to project
cd /home/kngpnn/dev/synthesis

# Update .env
echo "SEARCH_MODE=hybrid" >> .env
echo "HYBRID_VECTOR_WEIGHT=0.7" >> .env
echo "HYBRID_BM25_WEIGHT=0.3" >> .env

# Restart server to apply changes
pnpm --filter @synthesis/server dev
```

### 2. Create Test Collection

```bash
# Create collection
COLLECTION_JSON=$(curl -s -X POST http://localhost:3333/api/collections \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Hybrid Search Test",
    "description": "Testing hybrid search capabilities"
  }')

COLLECTION_ID=$(echo "$COLLECTION_JSON" | jq -r '.collection.id')
echo "Collection ID: $COLLECTION_ID"
```

### 3. Ingest Test Documents

```bash
# Ingest sample documents
curl -X POST http://localhost:3333/api/ingest \
  -F "file=@/path/to/technical-guide.pdf" \
  -F "collection_id=$COLLECTION_ID"

# Wait for processing (check status)
curl http://localhost:3333/api/documents?collection_id=$COLLECTION_ID | jq '.documents[] | {title, status}'
```

### 4. Test Vector-Only Search

```bash
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "JWT authentication best practices",
    "collection_id": "'$COLLECTION_ID'",
    "top_k": 5,
    "search_mode": "vector"
  }' | jq '{
    search_time_ms,
    metadata: .metadata.search_mode,
    results: .results[] | {similarity, doc_title, snippet}
  }'
```

### 5. Test Hybrid Search

```bash
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "JWT authentication best practices",
    "collection_id": "'$COLLECTION_ID'",
    "top_k": 5,
    "search_mode": "hybrid"
  }' | jq '{
    search_time_ms,
    metadata,
    results: .results[] | {
      fused_score,
      vector_score,
      bm25_score,
      source,
      doc_title,
      snippet
    }
  }'
```

### 6. Compare Results

```bash
# Compare: Vector vs Hybrid side-by-side
echo "Vector Results:"
curl -s -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "Redis connection pool configuration",
    "collection_id": "'$COLLECTION_ID'",
    "top_k": 3,
    "search_mode": "vector"
  }' | jq '.results[] | .doc_title'

echo "\nHybrid Results:"
curl -s -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "Redis connection pool configuration",
    "collection_id": "'$COLLECTION_ID'",
    "top_k": 3,
    "search_mode": "hybrid"
  }' | jq '.results[] | .doc_title'
```

---

## Code Examples

### Basic Hybrid Search

```bash
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "How to handle authentication in Flutter",
    "collection_id": "550e8400-e29b-41d4-a716-446655440000",
    "top_k": 10,
    "search_mode": "hybrid"
  }'
```

**Response:**
```json
{
  "query": "How to handle authentication in Flutter",
  "results": [
    {
      "id": 12345,
      "snippet": "To handle authentication in Flutter, use the firebase_auth...",
      "similarity": 0.89,
      "vector_score": 0.87,
      "bm25_score": 0.92,
      "fused_score": 0.0152,
      "source": "both",
      "doc_id": "uuid",
      "doc_title": "Flutter Authentication Guide",
      "citation": {
        "title": "Flutter Authentication Guide",
        "page": 12,
        "section": "Firebase Setup"
      }
    }
  ],
  "total_results": 10,
  "search_time_ms": 345,
  "metadata": {
    "search_mode": "hybrid",
    "vector_count": 28,
    "bm25_count": 24,
    "fused_count": 10,
    "embedding_provider": "voyage",
    "reranked": false
  }
}
```

### Hybrid Search with Custom Weights

Override default weights per-request:

```bash
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "PostgreSQL VACUUM command",
    "collection_id": "uuid",
    "search_mode": "hybrid",
    "weights": {
      "vector": 0.5,
      "bm25": 0.5
    }
  }'
```

### Hybrid Search with Re-ranking

Combine hybrid search with re-ranking for maximum accuracy:

```bash
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "difference between setState and Provider in Flutter",
    "collection_id": "uuid",
    "search_mode": "hybrid",
    "rerank": true,
    "rerank_provider": "cohere",
    "rerank_top_k": 10,
    "rerank_max_candidates": 30
  }'
```

### Tech Stack Filtering

Filter hybrid results by technology stack:

```bash
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "authentication implementation",
    "collection_id": "uuid",
    "search_mode": "hybrid",
    "tech_stack": ["typescript", "node", "postgresql"]
  }'
```

### Pagination

Handle large result sets:

```bash
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "user authentication",
    "collection_id": "uuid",
    "search_mode": "hybrid",
    "page": 2,
    "page_size": 10
  }'
```

---

## Performance

### Expected Latency

**Phase 11 Benchmarks (November 2025):**

| Search Mode | Mean | P50 | P90 | P99 |
|-------------|------|-----|-----|-----|
| Vector Only | 187ms | 165ms | 245ms | 412ms |
| BM25 Only | 142ms | 128ms | 198ms | 351ms |
| **Hybrid (RRF)** | **341ms** | **312ms** | **487ms** | **723ms** |

**With caching enabled:**
- Cache hit: <10ms
- Cache TTL: 30 minutes (configurable via `SEARCH_CACHE_TTL_SECONDS`)

### Accuracy Improvements

**Phase 11 Testing Results:**

| Query Type | Vector Only | Hybrid | Improvement |
|------------|-------------|--------|-------------|
| Technical terms | 78% | 94% | +16% |
| Natural language | 87% | 91% | +4% |
| Mixed queries | 73% | 92% | +19% |
| Exact matches | 65% | 96% | +31% |

**Overall:** Hybrid search provides 15-20% average accuracy improvement while maintaining sub-500ms P90 latency.

### Performance Tuning

**For maximum speed:**
```bash
# Use vector-only mode
SEARCH_MODE=vector

# Lower topK values
top_k: 5  # instead of 10
```

**For maximum accuracy:**
```bash
# Use hybrid with re-ranking
search_mode: "hybrid"
rerank: true
rerank_provider: "cohere"

# Higher topK for more fusion candidates
top_k: 15
```

**For balanced performance:**
```bash
# Hybrid with caching (default)
SEARCH_MODE=hybrid
SEARCH_CACHE_TTL_SECONDS=1800  # 30 min
```

---

## Best Practices

### 1. Start with Hybrid Mode

Use hybrid as your default search mode unless you have specific requirements for vector-only or BM25-only.

### 2. Adjust Weights Based on Content

**Technical/API documentation:**
```bash
HYBRID_VECTOR_WEIGHT=0.6
HYBRID_BM25_WEIGHT=0.4
```

**Conceptual/tutorial content:**
```bash
HYBRID_VECTOR_WEIGHT=0.8
HYBRID_BM25_WEIGHT=0.2
```

### 3. Enable Caching for Production

```bash
# .env
SEARCH_CACHE_TTL_SECONDS=1800
SEARCH_CACHE_MAX_ITEMS=500
REDIS_URL=redis://localhost:6379
```

### 4. Use Trust Scoring for Curated Collections

If your collection has source quality metadata:
```bash
ENABLE_TRUST_SCORING=true
```

Add metadata during ingestion:
```json
{
  "source_quality": "official",
  "last_verified": "2025-11-13T00:00:00Z"
}
```

### 5. Monitor Performance

Check search latency in response metadata:
```bash
curl -X POST http://localhost:3333/api/search ... | jq '.search_time_ms'
```

Set up alerts for slow queries (>1000ms).

### 6. Combine with Re-ranking for Critical Searches

For user-facing search where accuracy is paramount:
```javascript
{
  search_mode: "hybrid",
  rerank: true,
  rerank_provider: "cohere",
  rerank_top_k: 10,
  rerank_max_candidates: 30
}
```

### 7. Use Tech Stack Filtering

When you know the technology context:
```javascript
{
  query: "authentication setup",
  tech_stack: ["flutter", "dart", "firebase"]
}
```

### 8. Optimize FTS Language

Set `FTS_LANGUAGE` to match your content's primary language:
```bash
# For English content (default)
FTS_LANGUAGE=english

# For multilingual/technical content
FTS_LANGUAGE=simple

# For other languages
FTS_LANGUAGE=spanish  # french, german, etc.
```

---

## Troubleshooting

### Issue: Hybrid Search Slower Than Expected

**Symptom:** Queries taking >1000ms

**Solutions:**

1. **Check BM25 index:**
   ```sql
   -- Connect to database
   psql $DATABASE_URL

   -- Verify GIN index exists
   \di chunks_fts_idx

   -- If missing, create it:
   CREATE INDEX IF NOT EXISTS chunks_fts_idx
   ON chunks USING GIN (to_tsvector('english', text));
   ```

2. **Check vector index:**
   ```sql
   -- Verify HNSW index exists
   \di chunks_embedding_idx

   -- If missing, create it:
   CREATE INDEX IF NOT EXISTS chunks_embedding_idx
   ON chunks USING hnsw (embedding vector_cosine_ops);
   ```

3. **Reduce candidate pool:**
   ```bash
   # In search request, reduce top_k
   "top_k": 5  # instead of 10 or 15
   ```

4. **Enable caching:**
   ```bash
   REDIS_URL=redis://localhost:6379
   SEARCH_CACHE_TTL_SECONDS=1800
   ```

### Issue: Results Not Diverse Enough

**Symptom:** All results from vector or all from BM25

**Solutions:**

1. **Check fusion weights:**
   ```bash
   # Ensure weights are balanced
   HYBRID_VECTOR_WEIGHT=0.7
   HYBRID_BM25_WEIGHT=0.3
   ```

2. **Verify both searches return results:**
   ```bash
   # Check metadata in response
   curl -X POST ... | jq '.metadata | {vector_count, bm25_count}'
   ```

3. **Check query format:**
   - Ensure query has both semantic and keyword components
   - Example: "JWT authentication" (keyword + concept)

### Issue: BM25 Results Empty

**Symptom:** `bm25_count: 0` in metadata

**Solutions:**

1. **Verify full-text search column exists:**
   ```sql
   SELECT COUNT(*) FROM chunks WHERE to_tsvector('english', text) @@ to_tsquery('english', 'test');
   ```

2. **Check FTS_LANGUAGE setting:**
   ```bash
   # Ensure it matches your content
   FTS_LANGUAGE=english
   ```

3. **Test BM25 directly:**
   ```bash
   curl -X POST http://localhost:3333/api/search \
     -H 'Content-Type: application/json' \
     -d '{"query": "test", "collection_id": "uuid", "search_mode": "vector"}'
   ```

### Issue: Vector Results Empty

**Symptom:** `vector_count: 0` in metadata

**Solutions:**

1. **Check embedding provider:**
   ```bash
   # Ensure Ollama is running
   curl http://localhost:11434/api/tags

   # Or check other provider API keys
   echo $VOYAGE_API_KEY
   echo $OPENAI_API_KEY
   ```

2. **Verify embeddings exist:**
   ```sql
   SELECT COUNT(*) FROM chunks WHERE embedding IS NOT NULL;
   ```

3. **Check collection has documents:**
   ```bash
   curl http://localhost:3333/api/documents?collection_id=$COLLECTION_ID
   ```

### Issue: Inconsistent Result Quality

**Symptom:** Some queries work great, others poorly

**Solutions:**

1. **Analyze query patterns:**
   - Technical queries → Increase BM25 weight
   - Conceptual queries → Increase vector weight

2. **Enable trust scoring:**
   ```bash
   ENABLE_TRUST_SCORING=true
   ```

3. **Add re-ranking:**
   ```javascript
   {
     search_mode: "hybrid",
     rerank: true,
     rerank_provider: "cohere"
   }
   ```

### Issue: "Transaction Aborted" Errors

**Symptom:** Database errors during search

**Solutions:**

1. **Restart database:**
   ```bash
   docker compose restart synthesis-db
   ```

2. **Check connection pool:**
   ```bash
   # Verify DATABASE_URL in .env
   echo $DATABASE_URL
   ```

3. **Review server logs:**
   ```bash
   pnpm --filter @synthesis/server dev
   # Check for SQL errors
   ```

---

## See Also

### Documentation
- [API Specification](../05_API_SPEC.md) - Full API reference
- [Architecture Overview](../02_ARCHITECTURE.md) - System design
- [Configuration Guide](../10_ENV_SETUP.md) - Environment setup

### Phase Documentation
- [Phase 11 Overview](../phases/phase-11/00_PHASE_11_OVERVIEW.md) - Hybrid search design
- [Phase 12 Overview](../phases/phase-12/00_PHASE_12_OVERVIEW.md) - Re-ranking integration

### Related Features
- [Code Chunking Guide](../CODE_CHUNKING_GUIDE.md) - Improve code search
- [Reranking Guide](./RERANKING_GUIDE.md) - Boost accuracy further
- [Embedding Providers](../phases/phase-8/02_EMBEDDING_PROVIDERS.md) - Multi-provider setup

---

**Phase 11: Hybrid Search + RRF Fusion** ✅
*Combining semantic and keyword search for superior accuracy*
