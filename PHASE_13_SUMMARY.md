# Phase 13 Summary: Result Diversification (MMR)

**Branch:** `feature/phase-13-mmr`  
**Status:** Complete  
**Date:** November 2025

---

## Overview

Phase 13 implements **Maximal Marginal Relevance (MMR)** to diversify search results by reducing near-duplicates while maintaining relevance. MMR iteratively selects results that are both relevant to the query and dissimilar to already-selected results.

## Features Implemented

### 1. MMR Algorithm (`mmr.ts`)

A production-ready MMR implementation with:

| Feature | Description |
|---------|-------------|
| **Cosine Similarity** | Efficient pairwise similarity computation for embeddings |
| **Iterative Selection** | Greedy algorithm selecting results with highest MMR score |
| **Lambda Parameter** | Configurable trade-off between relevance (1.0) and diversity (0.0) |
| **Diversity Metrics** | Average pairwise similarity, duplicates removed, position changes |

**MMR Formula:**
```
MMR(d) = λ * relevance(d) - (1-λ) * max_similarity(d, selected)
```

### 2. Search Integration

MMR is integrated into both search modes:

| Mode | Integration Point |
|------|-------------------|
| **Hybrid** | After fusion/reranking, before returning results |
| **Vector** | After trust scoring, before returning results |

When MMR is enabled, the search fetches 2x candidates to allow for effective diversification.

### 3. API Parameters

**New Request Parameters:**
```typescript
{
  // Enable MMR diversification (default: false, or env MMR_DEFAULT_ENABLED)
  mmr_enabled?: boolean;
  mmrEnabled?: boolean;
  
  // Lambda: 0.0 = max diversity, 1.0 = max relevance (default: 0.7)
  mmr_lambda?: number;
  mmrLambda?: number;
}
```

**New Response Fields:**
```json
{
  "metadata": {
    "mmr": {
      "enabled": true,
      "lambda": 0.7,
      "avg_pairwise_similarity": 0.42,
      "duplicates_removed": 3
    }
  }
}
```

### 4. Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MMR_DEFAULT_ENABLED` | Enable MMR by default | `false` |
| `MMR_DEFAULT_LAMBDA` | Default lambda value | `0.7` |
| `MMR_LOG` | Enable MMR diagnostic logging | `false` |

## Files Changed

### Created
| File | Description |
|------|-------------|
| `apps/server/src/services/mmr.ts` | Core MMR algorithm (~350 lines) |
| `apps/server/src/services/__tests__/mmr.test.ts` | 47 comprehensive tests |

### Modified
| File | Description |
|------|-------------|
| `apps/server/src/services/search.ts` | Integrated MMR diversification |
| `apps/server/src/routes/search.ts` | Added MMR params and response fields |

## Tests Added

- **47 unit tests** covering:
  - Cosine similarity computation (10 tests)
  - MMR algorithm basic functionality (6 tests)
  - Diversification behavior (4 tests)
  - Edge cases (9 tests)
  - Metrics accuracy (2 tests)
  - Options resolution (8 tests)
  - Logging (3 tests)
  - Constants validation (3 tests)
  - Real-world scenarios (2 tests)

## Algorithm Details

### How MMR Works

1. **Select first result**: Always the most relevant (highest score)
2. **For each subsequent slot**:
   - Compute MMR score for all remaining candidates
   - MMR = λ × relevance - (1-λ) × max_similarity_to_selected
   - Select candidate with highest MMR score
3. **Repeat** until topK results selected

### Lambda Tuning Guide

| Lambda | Use Case | Behavior |
|--------|----------|----------|
| 0.9-1.0 | Precision search | Pure relevance, no diversity |
| 0.7 | Balanced (default) | Good relevance with some diversity |
| 0.5 | Exploration | Equal weight to relevance and diversity |
| 0.3-0.4 | Discovery | Emphasize diversity for broad coverage |

### Performance Considerations

- Embeddings fetched in single batch query
- O(n²) pairwise similarity (acceptable for typical topK ≤ 50)
- 2x candidate expansion when MMR enabled
- Minimal overhead when MMR disabled

## API Changes

### Request Example

```bash
curl -X POST /api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "React hooks",
    "collection_id": "...",
    "mmr_enabled": true,
    "mmr_lambda": 0.6
  }'
```

### Response Example

```json
{
  "query": "React hooks",
  "results": [...],
  "metadata": {
    "search_mode": "hybrid",
    "mmr": {
      "enabled": true,
      "lambda": 0.6,
      "avg_pairwise_similarity": 0.38,
      "duplicates_removed": 2
    }
  }
}
```

## Acceptance Criteria

- [x] MMR algorithm correctly implemented
- [x] Near-duplicate results deprioritized based on lambda
- [x] Top-1 relevance preserved (always most relevant first)
- [x] Lambda configurable per-request (0.0-1.0)
- [x] Diversity metrics in response
- [x] All tests pass (47 tests)
- [x] No regression in existing search functionality

## Known Issues

None.

## Breaking Changes

None. MMR is disabled by default and opt-in via `mmr_enabled` parameter.

## Dependencies for Next Phase

Phase 13 provides foundation for:
- **UI**: Diversity slider in advanced search settings
- **Per-collection defaults**: Store MMR preferences per collection
- **Intent-based MMR**: Adjust lambda based on query intent (e.g., comparison queries benefit from higher diversity)

## Review Checklist

- [x] Code follows style guide (biome check passed)
- [x] Tests are comprehensive (47 tests)
- [x] No security issues
- [x] Performance is acceptable
- [x] Documentation is updated
- [x] TypeScript compiles without errors

## Notes

### Why MMR?

Traditional search returns results ranked purely by relevance. This often leads to:
- Multiple results from the same document
- Near-duplicate content (e.g., similar code snippets)
- Redundant information that doesn't help the user

MMR solves this by balancing relevance with diversity, ensuring each result adds new information.

### Implementation Decisions

1. **Cosine similarity**: Chosen over Euclidean distance because embeddings are typically normalized
2. **Greedy selection**: O(n²) but simple and effective for typical result sizes
3. **Batch embedding fetch**: Single DB query for all chunk embeddings
4. **2x candidate expansion**: Ensures enough candidates for meaningful diversification
5. **Graceful degradation**: Falls back to relevance order if embeddings unavailable
