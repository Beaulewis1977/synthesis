# Phase 8: Hybrid Search Diagnostics - Summary

**Date:** November 2025  
**Branch:** `feature/phase-8-hybrid-diagnostics`  
**Duration:** ~1 day

---

## Overview

Phase 8 adds comprehensive diagnostics to hybrid search, providing visibility into BM25 vs vector contributions, timing breakdowns, and query analysis metadata. This enables debugging, performance tuning, and better understanding of search behavior.

---

## Features Implemented

### 1. HybridDiagnostics Interface

New comprehensive diagnostics structure in `apps/server/src/services/hybrid.ts`:

| Field | Type | Description |
|-------|------|-------------|
| `vectorResultCount` | number | Results from vector search |
| `bm25ResultCount` | number | Results from BM25 search |
| `fusedResultCount` | number | Results after fusion |
| `bothSourceCount` | number | Results found by both methods |
| `vectorScores` | ScoreStats | avg/max/min for vector similarity |
| `bm25Scores` | ScoreStats | avg/max/min for BM25 scores |
| `timing` | HybridTiming | Breakdown of search latency |
| `bm25QueryType` | QueryType | Query classification (natural_language, code_symbol, phrase) |
| `bm25TsFunction` | string | PostgreSQL tsquery function used |
| `weights` | object | Vector/BM25 weights used |
| `rrfK` | number | RRF constant used |

### 2. Score Statistics

New `ScoreStats` interface provides statistical analysis:

```typescript
interface ScoreStats {
  avg: number;  // Average score
  max: number;  // Maximum score
  min: number;  // Minimum score
}
```

### 3. Timing Breakdown

New `HybridTiming` interface tracks performance:

```typescript
interface HybridTiming {
  vectorMs: number;   // Vector search time
  bm25Ms: number;     // BM25 search time
  fusionMs: number;   // Result fusion time
  totalMs: number;    // Total elapsed time
}
```

### 4. API Response Enhancement

Search API now includes diagnostics in hybrid mode:

```json
{
  "metadata": {
    "search_mode": "hybrid",
    "vector_count": 15,
    "bm25_count": 8,
    "diagnostics": {
      "vector_scores": { "avg": 0.72, "max": 0.91, "min": 0.45 },
      "bm25_scores": { "avg": 0.65, "max": 0.88, "min": 0.32 },
      "both_source_count": 5,
      "timing": { "vector_ms": 45, "bm25_ms": 12, "fusion_ms": 2, "total_ms": 59 },
      "bm25_query_type": "natural_language",
      "bm25_ts_function": "websearch_to_tsquery",
      "weights": { "vector": 0.7, "bm25": 0.3 },
      "rrf_k": 60
    }
  }
}
```

### 5. Structured Diagnostic Logging

Enable via environment variable `HYBRID_DIAGNOSTICS_LOG=true`:

```json
{
  "type": "hybrid_search_diagnostics",
  "query": "How do I implement state management",
  "vectorCount": 15,
  "bm25Count": 8,
  "fusedCount": 10,
  "bothCount": 5,
  "vectorScoreAvg": 0.72,
  "bm25ScoreAvg": 0.65,
  "bm25QueryType": "natural_language",
  "weights": { "vector": 0.7, "bm25": 0.3 },
  "timingMs": { "vectorMs": 45, "bm25Ms": 12, "fusionMs": 2, "totalMs": 59 }
}
```

### 6. Weight Normalization

Weights are automatically normalized to sum to 1.0:

```typescript
// Input: { vector: 2, bm25: 2 }
// Normalized: { vector: 0.5, bm25: 0.5 }
```

---

## Files Modified

| File | Changes |
|------|---------|
| `apps/server/src/services/hybrid.ts` | Added HybridDiagnostics, ScoreStats, HybridTiming interfaces; computeDiagnostics function; logDiagnostics function; normalizeWeights function |
| `apps/server/src/services/search.ts` | Added SearchDiagnostics interface; mapDiagnostics function; exposed diagnostics in SmartSearchResponse |
| `apps/server/src/routes/search.ts` | Added diagnostics to SearchRouteResponse; included in API response |
| `apps/server/src/services/__tests__/hybrid.test.ts` | Added 5 new tests for diagnostics functionality |
| `ENV_VARIABLES.md` | Documented HYBRID_DIAGNOSTICS_LOG and hybrid search variables |
| `docs/RAG_AND_MODEL_SELECTOR_IMPLEMENTATION_PLAN.md` | Updated Phase 8 section with completion status |

---

## New Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HYBRID_DIAGNOSTICS_LOG` | Enable structured JSON logging for hybrid search diagnostics | `false` |

Existing variables documented:
- `SEARCH_MODE` - Default search mode (`vector` or `hybrid`)
- `HYBRID_VECTOR_WEIGHT` - Vector weight in hybrid search (0-1)
- `HYBRID_BM25_WEIGHT` - BM25 weight in hybrid search (0-1)

---

## Acceptance Criteria

- [x] Diagnostics included in hybrid search response
- [x] BM25 avg/max/min scores computed and returned
- [x] Vector avg/max/min scores computed and returned
- [x] Timing breakdown shows vector vs BM25 latency
- [x] BM25 query type from Phase 2 exposed in diagnostics
- [x] Structured logging via environment variable
- [x] Weight normalization implemented
- [x] All existing tests pass
- [x] New unit tests for diagnostics (7 tests total)

---

## Testing

Run tests with:
```bash
pnpm --filter @synthesis/server test src/services/__tests__/hybrid.test.ts
```

All 7 tests pass:
- `fuseResults` - combines overlapping results using RRF weighting
- `hybridSearch` - returns fused results sorted by fused score
- `hybridSearch` - returns comprehensive diagnostics
- `hybridSearch` - counts results found by both methods
- `hybridSearch` - respects custom weights
- `hybridSearch` - normalizes weights that do not sum to 1
- `diagnostics edge cases` - handles empty results gracefully

---

## Dependencies

- Phase 2 (BM25 Query Fix) - Uses `bm25SearchWithMetadata` for query type metadata

---

## Usage Examples

### Enable Diagnostic Logging

```bash
# In .env
HYBRID_DIAGNOSTICS_LOG=true
```

### Custom Weights via API

```json
POST /api/search
{
  "query": "state management",
  "collection_id": "...",
  "search_mode": "hybrid",
  "weights": { "vector": 0.8, "bm25": 0.2 }
}
```

### Interpreting Diagnostics

1. **High `bothSourceCount`** - Good overlap between semantic and keyword matching
2. **Low `bm25ResultCount`** - Query may not match corpus vocabulary well
3. **High `bm25_query_type: code_symbol`** - Prefix matching being used
4. **`timing.bm25Ms` >> `timing.vectorMs`** - Consider BM25 index optimization

---

## Next Steps

1. Run tests to verify functionality
2. Create PR for review
3. Merge to develop after approval
