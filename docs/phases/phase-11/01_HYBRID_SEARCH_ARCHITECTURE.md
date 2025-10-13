# Phase 11: Hybrid Search Architecture

**Technical Deep-Dive**

---

## 🎯 Design Goals

1. **Combine semantic + lexical retrieval** for best-of-both-worlds
2. **Minimal latency overhead** (<200ms additional)
3. **Simple score fusion** (RRF algorithm)
4. **Backwards compatible** (opt-in per collection)
5. **Debuggable** (expose intermediate scores)

---

## 🏗️ Architecture Overview

### System Diagram

```
┌─────────────────────────────────────────────────────┐
│                  Search Request                     │
│  { query, collection_id, top_k, search_mode }     │
└──────────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│            Hybrid Search Coordinator                │
│  • Detect search mode (hybrid vs vector-only)      │
│  • Embed query with selected provider              │
│  • Route to appropriate search paths               │
└──────────────────────┬─────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │ Parallel Execution        │
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│  Vector Search  │         │   BM25 Search   │
│  (pgvector)     │         │   (pg_trgm)     │
│                 │         │                 │
│  • Cosine sim   │         │  • Keyword match│
│  • HNSW index   │         │  • GIN index    │
│  • Top 30       │         │  • Top 30       │
└────────┬────────┘         └────────┬────────┘
         │                           │
         └─────────────┬─────────────┘
                       ▼
         ┌──────────────────────────┐
         │   Score Fusion (RRF)     │
         │  • Merge result sets     │
         │  • Normalize ranks       │
         │  • Combine scores        │
         └──────────┬───────────────┘
                    ▼
         ┌──────────────────────────┐
         │   Metadata Filtering     │
         │  • Version constraints   │
         │  • Source quality        │
         │  • Freshness             │
         └──────────┬───────────────┘
                    ▼
         ┌──────────────────────────┐
         │    Trust Scoring         │
         │  • Official: 1.0         │
         │  • Verified: 0.85        │
         │  • Community: 0.6        │
         └──────────┬───────────────┘
                    ▼
         ┌──────────────────────────┐
         │   Top K Selection        │
         │  • Sort by final score   │
         │  • Return top K results  │
         └──────────┬───────────────┘
                    ▼
              ┌──────────┐
              │ Response │
              └──────────┘
```

---

## 📦 Component Specifications

### 1. BM25 Service

**File:** `apps/server/src/services/bm25.ts`

**Purpose:** Full-text search using PostgreSQL's text search capabilities

**Implementation:**

```typescript
import type { Pool } from 'pg';

export interface BM25Params {
  query: string;
  collectionId: string;
  topK?: number;
  language?: string; // default: 'english'
}

export interface BM25Result {
  chunkId: number;
  text: string;
  rank: number; // BM25 rank (lower is better)
  score: number; // Normalized to 0-1
  docId: string;
  docTitle: string | null;
}

/**
 * BM25 full-text search using PostgreSQL ts_rank_cd
 */
export async function bm25Search(
  db: Pool,
  params: BM25Params
): Promise<BM25Result[]> {
  const topK = params.topK ?? 30;
  const language = params.language ?? 'english';
  
  // Convert query to tsquery
  const tsquery = toTsQuery(params.query);
  
  const { rows } = await db.query(
    `
      SELECT
        ch.id as chunk_id,
        ch.text,
        ch.doc_id,
        d.title as doc_title,
        ts_rank_cd(
          to_tsvector($1::regconfig, ch.text),
          to_tsquery($1::regconfig, $2)
        ) as rank
      FROM chunks ch
      JOIN documents d ON d.id = ch.doc_id
      WHERE d.collection_id = $3
        AND to_tsvector($1::regconfig, ch.text) @@ to_tsquery($1::regconfig, $2)
      ORDER BY rank DESC
      LIMIT $4
    `,
    [language, tsquery, params.collectionId, topK]
  );
  
  // Normalize ranks to 0-1 scores
  const maxRank = rows[0]?.rank ?? 1;
  
  return rows.map((row, index) => ({
    chunkId: row.chunk_id,
    text: row.text,
    rank: index + 1,
    score: row.rank / maxRank,
    docId: row.doc_id,
    docTitle: row.doc_title,
  }));
}

/**
 * Convert user query to PostgreSQL tsquery
 * Current implementation: whitespace tokens with prefix matching (no boolean parsing yet)
 */
function toTsQuery(query: string): string {
  // Simple implementation: space-separated terms with AND
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(t => t.length > 0)
    .map(t => `${t}:*`) // Prefix matching
    .join(' & ');
  
  return terms || 'empty:*';
}
```

**Database Requirements:**

```sql
-- Add GIN index for full-text search
CREATE INDEX chunks_text_gin_idx ON chunks 
  USING gin(to_tsvector('english', text));

-- Optional: Add pg_trgm for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX chunks_text_trgm_idx ON chunks 
  USING gin(text gin_trgm_ops);
```

---

### 2. Hybrid Search Service

**File:** `apps/server/src/services/hybrid.ts`

**Purpose:** Combine vector and BM25 results using Reciprocal Rank Fusion

**Implementation:**

```typescript
import type { Pool } from 'pg';
import { searchCollection, type SearchResult } from './search.js';
import { bm25Search, type BM25Result } from './bm25.js';

export interface HybridSearchParams {
  query: string;
  collectionId: string;
  topK?: number;
  minSimilarity?: number;
  weights?: {
    vector: number; // default: 0.7
    bm25: number;   // default: 0.3
  };
}

export interface HybridSearchResult extends SearchResult {
  vectorScore: number;
  bm25Score: number;
  fusedScore: number;
  source: 'vector' | 'bm25' | 'both';
}

/**
 * Hybrid search combining vector similarity and BM25 ranking
 * Uses Reciprocal Rank Fusion (RRF) algorithm
 */
export async function hybridSearch(
  db: Pool,
  params: HybridSearchParams
): Promise<HybridSearchResult[]> {
  const topK = params.topK ?? 10;
  const weights = params.weights ?? { vector: 0.7, bm25: 0.3 };
  
  // Execute both searches in parallel
  const [vectorResults, bm25Results] = await Promise.all([
    searchCollection(db, {
      query: params.query,
      collectionId: params.collectionId,
      topK: 30, // Fetch more candidates
      minSimilarity: params.minSimilarity,
    }),
    bm25Search(db, {
      query: params.query,
      collectionId: params.collectionId,
      topK: 30,
    }),
  ]);
  
  // Apply Reciprocal Rank Fusion
  const fused = reciprocalRankFusion(
    vectorResults,
    bm25Results,
    weights
  );
  
  // Sort by fused score and return top K
  return fused
    .sort((a, b) => b.fusedScore - a.fusedScore)
    .slice(0, topK);
}

/**
 * Reciprocal Rank Fusion (RRF)
 * Formula: RRF(d) = Σ(1 / (k + rank_i))
 * Where k=60 is a constant, rank_i is position in result list i
 */
function reciprocalRankFusion(
  vectorResults: SearchResult[],
  bm25Results: BM25Result[],
  weights: { vector: number; bm25: number }
): HybridSearchResult[] {
  const k = 60; // RRF constant
  const scoreMap = new Map<number, HybridSearchResult>();
  
  // Process vector results
  for (let i = 0; i < vectorResults.length; i++) {
    const result = vectorResults[i];
    const rrfScore = 1 / (k + i + 1);
    
    scoreMap.set(result.id, {
      ...result,
      vectorScore: result.similarity,
      bm25Score: 0,
      fusedScore: rrfScore * weights.vector,
      source: 'vector',
    });
  }
  
  // Process BM25 results and merge
  for (let i = 0; i < bm25Results.length; i++) {
    const result = bm25Results[i];
    const rrfScore = 1 / (k + i + 1);
    
    const existing = scoreMap.get(result.chunkId);
    
    if (existing) {
      // Chunk appears in both results
      existing.bm25Score = result.score;
      existing.fusedScore += rrfScore * weights.bm25;
      existing.source = 'both';
    } else {
      // BM25-only result (convert BM25Result to HybridSearchResult)
      scoreMap.set(result.chunkId, {
        id: result.chunkId,
        text: result.text,
        similarity: 0,
        docId: result.docId,
        docTitle: result.docTitle,
        sourceUrl: null,
        metadata: null,
        citation: {
          title: result.docTitle,
        },
        vectorScore: 0,
        bm25Score: result.score,
        fusedScore: rrfScore * weights.bm25,
        source: 'bm25',
      });
    }
  }
  
  return Array.from(scoreMap.values());
}
```

---

### 3. Enhanced Search Service

**File:** `apps/server/src/services/search.ts` (modifications)

**Add wrapper function:**

```typescript
import { hybridSearch } from './hybrid.js';

/**
 * Smart search that routes to vector-only or hybrid based on config
 */
export async function smartSearch(
  db: Pool,
  params: SearchParams
): Promise<SearchResult[]> {
  const searchMode = process.env.SEARCH_MODE ?? 'vector';
  
  if (searchMode === 'hybrid') {
    const hybridResults = await hybridSearch(db, params);
    // Convert HybridSearchResult[] to SearchResult[]
    return hybridResults.map(r => ({
      id: r.id,
      text: r.text,
      similarity: r.fusedScore, // Use fused score
      docId: r.docId,
      docTitle: r.docTitle,
      sourceUrl: r.sourceUrl,
      metadata: r.metadata,
      citation: r.citation,
    }));
  }
  
  // Default: pure vector search
  return searchCollection(db, params);
}
```

---

## 🎛️ Configuration

### Environment Variables

```bash
# Search Mode
SEARCH_MODE=hybrid  # or 'vector' (default)

# Hybrid Search Tuning
HYBRID_VECTOR_WEIGHT=0.7  # Semantic weight
HYBRID_BM25_WEIGHT=0.3    # Lexical weight
HYBRID_RRF_K=60           # RRF constant

# Full-Text Search
FTS_LANGUAGE=english      # PostgreSQL text search language
```

### Per-Collection Override

```typescript
// Collection metadata can override global settings
interface Collection {
  metadata: {
    search_mode?: 'vector' | 'hybrid';
    hybrid_weights?: { vector: number; bm25: number };
  };
}
```

---

## 📊 Performance Characteristics

### Latency Breakdown

| Operation | Latency | Notes |
|-----------|---------|-------|
| Query embedding | 100ms | Ollama (local) |
| Vector search | 200ms | HNSW index |
| BM25 search | 100ms | GIN index (parallel with vector) |
| Score fusion | 5ms | In-memory computation |
| **Total** | **~300ms** | <600ms target |

### Index Sizes

| Index Type | Size Multiplier | Notes |
|------------|-----------------|-------|
| HNSW (vector) | ~1.5x | Already exists |
| GIN (full-text) | ~0.2x | New in Phase 11 |
| **Total** | **~1.7x** | Of raw text size |

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
// Test BM25 search
describe('bm25Search', () => {
  it('returns exact keyword matches', async () => {
    const results = await bm25Search(db, {
      query: 'StatefulWidget',
      collectionId: 'test-collection',
    });
    
    expect(results[0].text).toContain('StatefulWidget');
  });
});

// Test RRF fusion
describe('reciprocalRankFusion', () => {
  it('combines scores correctly', () => {
    const vectorResults = [{ id: 1, similarity: 0.9 }];
    const bm25Results = [{ chunkId: 1, score: 0.8 }];
    
    const fused = reciprocalRankFusion(
      vectorResults,
      bm25Results,
      { vector: 0.7, bm25: 0.3 }
    );
    
    expect(fused[0].source).toBe('both');
    expect(fused[0].fusedScore).toBeGreaterThan(0);
  });
});
```

### Integration Tests

```typescript
describe('hybridSearch integration', () => {
  it('finds both semantic and exact matches', async () => {
    // Insert test data
    await insertChunk({
      text: 'StatefulWidget is a widget that has mutable state',
      collectionId: 'test',
    });
    
    // Query with both semantic and keyword components
    const results = await hybridSearch(db, {
      query: 'StatefulWidget lifecycle',
      collectionId: 'test',
    });
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source).toBe('both'); // Found in both searches
  });
});
```

### Benchmarks

```typescript
// Compare vector-only vs hybrid
const testQueries = [
  'How to use StatefulWidget?',
  'authentication in Flutter',
  'StreamBuilder example',
  // ... 50+ test queries
];

for (const query of testQueries) {
  const vectorResults = await searchCollection(db, { query });
  const hybridResults = await hybridSearch(db, { query });
  
  // Measure:
  // - Precision@5
  // - Recall@10
  // - Latency
  // - User preference (manual evaluation)
}
```

---

## 🐛 Debugging

### Debug Mode

```typescript
export async function hybridSearchDebug(
  db: Pool,
  params: HybridSearchParams
) {
  const weights = params.weights ?? { vector: 0.7, bm25: 0.3 };
  const [vectorResults, bm25Results] = await Promise.all([
    searchCollection(db, { ...params, topK: 30 }),
    bm25Search(db, { ...params, topK: 30 }),
  ]);
  
  const fused = reciprocalRankFusion(vectorResults, bm25Results, weights);
  
  return {
    query: params.query,
    vector: {
      count: vectorResults.length,
      top3: vectorResults.slice(0, 3),
    },
    bm25: {
      count: bm25Results.length,
      top3: bm25Results.slice(0, 3),
    },
    fused: {
      count: fused.length,
      top3: fused.slice(0, 3).map(r => ({
        id: r.id,
        text: r.text.slice(0, 100),
        vectorScore: r.vectorScore,
        bm25Score: r.bm25Score,
        fusedScore: r.fusedScore,
        source: r.source,
      })),
    },
  };
}
```

---

## ✅ Validation

### Acceptance Tests

**Test 1: Exact Match**
```typescript
const results = await hybridSearch(db, {
  query: 'StatefulWidget',
  collectionId: 'flutter-docs',
});

expect(results[0].text).toContain('StatefulWidget');
expect(results[0].source).toBe('both'); // Found in vector AND BM25
```

**Test 2: Semantic Match**
```typescript
const results = await hybridSearch(db, {
  query: 'widget with mutable state',
  collectionId: 'flutter-docs',
});

expect(results[0].text).toContain('StatefulWidget'); // Found semantically
```

**Test 3: Backwards Compatibility**
```typescript
// Old collections should still work
process.env.SEARCH_MODE = 'vector';

const oldResults = await smartSearch(db, {
  query: 'test',
  collectionId: 'old-collection',
});

expect(oldResults).toBeDefined();
```

---

**Next:** See `02_EMBEDDING_PROVIDERS.md` for multi-model setup
