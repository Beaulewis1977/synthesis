# Document Synthesis Guide

**Phase 12 Feature**: Multi-source document comparison with automatic contradiction detection

---

## Overview

Document synthesis is an advanced RAG feature that compares multiple documentation sources to identify different approaches, detect contradictions, and provide consensus-based recommendations. Instead of returning a flat list of search results, synthesis organizes results into distinct methodologies and highlights conflicts between sources.

### Why Document Synthesis?

**Traditional search problems:**
- Results from different sources conflict
- Hard to compare different approaches
- No guidance on which source to trust
- Users must manually reconcile contradictions

**Document synthesis benefits:**
- ✅ Groups results by approach/methodology
- ✅ Automatically detects contradictions
- ✅ Provides consensus scores for agreement levels
- ✅ Recommends the best approach based on quality and freshness
- ✅ Highlights conflicts with severity levels

---

## When to Use Synthesis vs Regular Search

### Use Regular Search When:
- You need a simple answer
- Speed is critical (<100ms response time)
- You trust all sources equally
- You're searching within a single authoritative source

### Use Synthesis When:
- Comparing multiple documentation sources (e.g., "authentication best practices" across different frameworks)
- Sources may contradict each other (old vs new recommendations)
- You need to understand different methodologies (e.g., "state management" has multiple valid approaches)
- Source quality and freshness matter
- You want AI-powered conflict detection

---

## How It Works

### Multi-Source Comparison Algorithm

The synthesis engine uses a multi-stage pipeline:

```
1. Hybrid Search + Reranking (retrieve top N results, default 15)
   ↓
2. Semantic Clustering (group similar results using k-means on embeddings)
   ↓
3. Approach Extraction (identify distinct methodologies from each cluster)
   ↓
4. Consensus Scoring (calculate agreement level within each approach)
   ↓
5. Contradiction Detection (Claude Haiku analyzes pairs of approaches)
   ↓
6. Recommendation Selection (choose best approach based on consensus and conflicts)
```

### Technical Details

**Based on:** `apps/server/src/services/synthesis.ts`

**Clustering:** K-means clustering (max 3 clusters) on first 600 characters of each result's embedding

**Consensus Score Calculation:**
```typescript
consensus_score = (quality_score * 0.4) + (similarity_score * 0.4) + (freshness_score * 0.2)
```

Where:
- **Quality Score**: Average source quality (official=1.0, verified=0.85, community=0.6, unknown=0.5)
- **Similarity Score**: Average cosine similarity to cluster centroid (measures agreement)
- **Freshness Score**: Recency weighting (<6mo=1.0, 6-12mo=0.85, 12-24mo=0.7, >24mo=0.5)

**Max Approaches**: Up to 3 distinct approaches per synthesis

**Max Sources**: Analyzes up to 15 results (configurable via `top_k`)

---

## Contradiction Detection

### How Contradictions Are Found

**Based on:** `apps/server/src/services/contradiction-detection.ts`

The contradiction detector uses a two-phase process:

#### Phase 1: Candidate Selection
1. Calculate lexical overlap between approach summaries (Jaccard similarity)
2. Filter pairs with overlap between 0.2 and 0.7 (too similar = agreement, too different = unrelated topics)
3. Consider consensus score gap (large gaps indicate potential conflicts)
4. Select top N pairs (default: 6) for LLM verification

#### Phase 2: LLM Verification
1. Send each pair to Claude Haiku for analysis
2. Prompt asks: "Are these contradictory?" and "What should be preferred?"
3. Parse structured JSON response with severity, difference, and recommendation
4. Track cost per comparison (approx $0.0002)

### Severity Levels

**High Severity:**
- Incompatible approaches (e.g., Provider vs Riverpod in Flutter)
- Directly contradictory statements (e.g., "use X" vs "don't use X")
- Penalty: -0.3 to consensus score

**Medium Severity:**
- Different but valid approaches (e.g., Firebase vs Supabase)
- Version-based differences (old vs new recommendations)
- Penalty: -0.15 to consensus score

**Low Severity:**
- Minor preference differences (e.g., style choices)
- Implementation details that don't affect core approach
- Penalty: -0.05 to consensus score

### Example Contradiction

```json
{
  "topic": "state management",
  "source_a": {
    "title": "Flutter State Management 2020",
    "statement": "Use Provider for state management in Flutter apps...",
    "quality": "official",
    "date": "2020-03-01"
  },
  "source_b": {
    "title": "Flutter State Management 2024",
    "statement": "Riverpod is now recommended over Provider...",
    "quality": "official",
    "date": "2024-10-01"
  },
  "severity": "medium",
  "difference": "Provider was previously recommended, but Riverpod is now the official recommendation",
  "recommendation": "Prefer Flutter State Management 2024 (more recent). Riverpod offers better performance and type safety.",
  "confidence": 0.95
}
```

---

## Interpreting Results

### Understanding Consensus Scores

**Score Range:** 0.0 to 1.0

**Interpretation:**
- **0.9-1.0**: Very strong consensus (all official sources agree, recent dates, high similarity)
- **0.7-0.89**: Strong consensus (mostly high-quality sources, good agreement)
- **0.5-0.69**: Moderate consensus (mixed quality sources or moderate disagreement)
- **0.3-0.49**: Weak consensus (significant disagreement or low-quality sources)
- **0.0-0.29**: Very weak consensus (contradictory or unreliable sources)

**Example:**
```json
{
  "method": "Riverpod state management",
  "topic": "state management",
  "consensusScore": 0.87,
  "sources": [
    {
      "docTitle": "Flutter Official Docs",
      "metadata": { "source_quality": "official", "last_verified": "2024-10-15" }
    },
    {
      "docTitle": "Riverpod Package Docs",
      "metadata": { "source_quality": "official", "last_verified": "2024-09-20" }
    }
  ]
}
```
This approach has high consensus (0.87) because both sources are official and recent.

### Understanding Agreement Scores

Agreement score is the **similarity_score** component of consensus, measuring how semantically similar the sources are within an approach.

**Calculation:** Average cosine similarity of each source's embedding to the cluster centroid

**Interpretation:**
- **>0.8**: Sources say essentially the same thing (strong agreement)
- **0.6-0.8**: Sources generally align with minor differences
- **0.4-0.6**: Sources cover the topic differently but not contradictory
- **<0.4**: Sources diverge significantly (potential conflict)

### Understanding the Recommended Approach

The synthesis engine selects the recommended approach by:

1. Starting with consensus scores
2. Applying penalties for conflicts involving each approach's sources
3. Selecting the approach with the highest adjusted score

**Example:**
```json
{
  "recommended": {
    "method": "Riverpod",
    "consensusScore": 0.87,
    "sources": [...]
  }
}
```

If an approach is recommended, it means:
- It has the highest consensus score after conflict penalties
- Its sources are not heavily involved in high-severity conflicts
- It represents the most reliable and agreed-upon methodology

---

## API Usage

### Endpoint

```
POST /api/synthesis/compare
```

### Feature Flag

Synthesis is **disabled by default**. Enable it:

```bash
# .env
ENABLE_SYNTHESIS=true
```

### Request Schema

```typescript
{
  "query": string,              // Search query
  "collection_id": uuid,        // Collection to search
  "top_k": number,             // Optional, max results to analyze (default: 15, max: 50)
  "rerank_provider": "cohere" | "bge" | "none"  // Optional reranker
}
```

### Response Schema

```typescript
{
  "query": string,
  "approaches": [
    {
      "method": string,           // Approach name/methodology
      "topic": string,            // Topic being addressed
      "summary": string,          // Summary of this approach (max 360 chars)
      "consensusScore": number,   // 0-1, higher = more agreement
      "sources": [
        {
          "docId": uuid,
          "docTitle": string | null,
          "sourceUrl": string | null,
          "snippet": string,      // Max 420 chars
          "metadata": {
            "source_quality": "official" | "verified" | "community",
            "last_verified": string,  // ISO date
            // ... other metadata
          }
        }
      ]
    }
  ],
  "conflicts": [
    {
      "topic": string,
      "source_a": { title, statement, quality, date, url },
      "source_b": { title, statement, quality, date, url },
      "severity": "high" | "medium" | "low",
      "difference": string,       // Explanation of contradiction
      "recommendation": string,   // Which source to prefer and why
      "confidence": number        // 0-1, LLM confidence in analysis
    }
  ],
  "recommended": Approach | null,  // Best approach (or null if no results)
  "metadata": {
    "total_sources": number,       // Number of search results analyzed
    "approaches_found": number,    // Number of distinct approaches
    "conflicts_found": number,     // Number of contradictions detected
    "synthesis_time_ms": number    // Total processing time
  }
}
```

### Example: Compare Authentication Approaches

```bash
# Create a collection with multiple auth docs
COLLECTION_ID="12345678-1234-1234-1234-123456789abc"

# Compare authentication approaches
curl -X POST http://localhost:3333/api/synthesis/compare \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "user authentication best practices",
    "collection_id": "'$COLLECTION_ID'",
    "top_k": 15,
    "rerank_provider": "cohere"
  }' | jq '.'
```

### Example Response

```json
{
  "query": "user authentication best practices",
  "approaches": [
    {
      "method": "Firebase Authentication",
      "topic": "user authentication",
      "summary": "Firebase Authentication provides built-in OAuth providers, email/password auth, and phone authentication with minimal setup...",
      "consensusScore": 0.82,
      "sources": [
        {
          "docId": "abc-123",
          "docTitle": "Firebase Auth Guide",
          "snippet": "Firebase Authentication handles user sign-in...",
          "metadata": {
            "source_quality": "official",
            "last_verified": "2024-09-15"
          }
        }
      ]
    },
    {
      "method": "Supabase Authentication",
      "topic": "user authentication",
      "summary": "Supabase Auth integrates with PostgreSQL Row Level Security, supports social auth, magic links, and offers full control over user data...",
      "consensusScore": 0.79,
      "sources": [...]
    }
  ],
  "conflicts": [
    {
      "topic": "authentication approach",
      "source_a": {
        "title": "Firebase Auth Guide",
        "statement": "Firebase Authentication is the easiest way...",
        "quality": "official",
        "date": "2024-09-15"
      },
      "source_b": {
        "title": "Supabase Auth Guide",
        "statement": "Supabase offers more control and integrates with PostgreSQL...",
        "quality": "official",
        "date": "2024-10-01"
      },
      "severity": "low",
      "difference": "Different authentication providers optimized for different use cases",
      "recommendation": "Both approaches are valid. Choose Firebase for simplicity and Google ecosystem integration, or Supabase for PostgreSQL integration and more control.",
      "confidence": 0.88
    }
  ],
  "recommended": {
    "method": "Firebase Authentication",
    "consensusScore": 0.82,
    "sources": [...]
  },
  "metadata": {
    "total_sources": 12,
    "approaches_found": 2,
    "conflicts_found": 1,
    "synthesis_time_ms": 1847
  }
}
```

---

## Best Practices

### When to Enable Synthesis

✅ **Enable for:**
- Multi-framework comparisons (React vs Vue vs Angular)
- Rapidly evolving technologies (tooling, state management)
- Collections with mixed source quality (official + community docs)
- When users ask "what's the best way to..."

❌ **Disable for:**
- Single authoritative source collections
- Cost-sensitive deployments (synthesis uses Claude API)
- Speed-critical use cases (adds 1-2 seconds latency)
- Small result sets (<3 results won't benefit from clustering)

### Optimal Source Count

**Recommended:** 10-15 sources per synthesis

**Too few (<5):**
- Not enough data for meaningful clustering
- Contradictions unlikely to surface
- Better to use regular search

**Too many (>25):**
- Slower processing (>3 seconds)
- Higher API costs
- Diminishing returns on quality

**Configuration:**
```bash
# Balance between quality and cost/speed
top_k=15  # Default, recommended
top_k=10  # Faster, lower cost
top_k=25  # More thorough, slower
```

### Improving Consensus Scores

To get higher-quality synthesis results:

1. **Document Quality:** Add `source_quality` metadata during ingestion
   ```json
   {
     "source_quality": "official",  // or "verified", "community"
     "last_verified": "2024-10-15"
   }
   ```

2. **Keep Docs Fresh:** Update `last_verified` dates when re-ingesting
   ```bash
   # Re-ingest docs annually to maintain freshness scores
   ```

3. **Use Reranking:** Cohere reranking improves top-K result quality
   ```json
   { "rerank_provider": "cohere" }
   ```

4. **Enable Hybrid Search:** Better retrieval = better clustering
   ```bash
   SEARCH_MODE=hybrid
   ```

### Contradiction Detection Tuning

Control contradiction detection behavior via environment variables:

```bash
# Enable/disable contradiction detection (default: false)
ENABLE_CONTRADICTION_DETECTION=true

# Model for analysis (default: claude-3-haiku-20240307)
CONTRADICTION_MODEL=claude-3-haiku-20240307

# Max pairs to analyze (default: 6, controls cost)
CONTRADICTION_MAX_PAIRS=6

# Similarity thresholds for candidate selection
CONTRADICTION_MIN_SIMILARITY=0.2  # Below this = too different (unrelated)
CONTRADICTION_MAX_SIMILARITY=0.7  # Above this = too similar (agree)
```

---

## Cost Considerations

### Synthesis vs Regular Search

**Regular Search Cost:**
- Embedding query: ~$0.00001 (Ollama: free)
- Reranking (optional): ~$0.001 per request
- **Total: ~$0.001/request**

**Synthesis Cost:**
- Embedding query: ~$0.00001
- Reranking (recommended): ~$0.001
- Embedding 15 results for clustering: ~$0.00015
- Contradiction detection (6 pairs): ~$0.0012 (Claude Haiku)
- **Total: ~$0.0024/request**

### Cost Breakdown by Component

**Clustering (embeddings):**
- Provider: Same as collection (Ollama free, OpenAI/Voyage paid)
- Tokens: 600 chars × 15 results = 9000 chars ≈ 2250 tokens
- Cost: $0.00015 (OpenAI) or $0 (Ollama)

**Contradiction Detection (Claude Haiku):**
- Model: `claude-3-haiku-20240307`
- Input tokens per comparison: ~500 tokens (two approach summaries + prompt)
- Output tokens per comparison: ~200 tokens (JSON response)
- Cost per comparison: ~$0.0002 (Haiku: $0.25/1M input, $1.25/1M output)
- 6 comparisons: ~$0.0012

**Monthly Estimates:**

```
Light usage (10 synthesis/day):
  10 req/day × 30 days × $0.0024 = $0.72/month

Moderate usage (50 synthesis/day):
  50 req/day × 30 days × $0.0024 = $3.60/month

Heavy usage (200 synthesis/day):
  200 req/day × 30 days × $0.0024 = $14.40/month
```

### Cost Optimization

**Reduce synthesis frequency:**
```bash
# Use regular search by default, synthesis only when needed
# E.g., add a "Compare Sources" button in UI
```

**Lower max pairs:**
```bash
# Analyze fewer contradiction pairs (less thorough but cheaper)
CONTRADICTION_MAX_PAIRS=3  # $0.0006 vs $0.0012
```

**Use free embeddings:**
```bash
# Ollama for clustering (no cost)
DOC_EMBEDDING_PROVIDER=ollama
```

**Disable contradiction detection:**
```bash
# Still get approach clustering and consensus scores
ENABLE_CONTRADICTION_DETECTION=false  # Saves ~$0.0012/request
```

### Budget Monitoring

Synthesis costs are tracked by the cost tracker:

**View synthesis costs:**
```bash
curl http://localhost:3333/api/costs/breakdown | jq '
  .breakdown[] |
  select(.operation == "chat" and .provider == "anthropic")
'
```

**Set budget alerts:**
```bash
# .env
MONTHLY_BUDGET_USD=10.00
ENABLE_COST_ALERTS=true
```

When budget is reached, the system automatically disables contradiction detection and falls back to free providers.

---

## Limitations

### What Synthesis Can't Do

1. **Not a replacement for search**
   - Synthesis requires search results as input
   - Always starts with hybrid search + reranking

2. **Requires multiple sources**
   - Needs at least 3 results for meaningful clustering
   - Best with 10-15 diverse sources

3. **Claude API dependency**
   - Contradiction detection requires Anthropic API key
   - Falls back gracefully if unavailable (no contradictions reported)

4. **Processing time**
   - Adds 1-2 seconds latency vs regular search
   - Not suitable for real-time autocomplete

5. **Language limitations**
   - Claude Haiku is English-optimized
   - May miss nuances in non-English docs

### Known Edge Cases

**Single cluster:**
- If all results are very similar, only one approach is returned
- This is correct behavior (high consensus, no alternatives)

**Contradictions not detected:**
- LLM may miss subtle contradictions
- Check `confidence` scores (low confidence = uncertain)

**High consensus with conflicts:**
- Possible if conflict is low severity
- Review `conflicts[]` array to understand disagreements

**Empty recommended approach:**
- Occurs when no results found
- `approaches[]` will be empty, `recommended` will be null

---

## Troubleshooting

### Synthesis Not Working

**Symptom:** API returns 404 "Synthesis disabled"

**Solution:**
```bash
# Enable feature flag
ENABLE_SYNTHESIS=true

# Restart server
pnpm --filter @synthesis/server dev
```

### No Contradictions Detected

**Possible causes:**

1. **Contradiction detection disabled:**
   ```bash
   ENABLE_CONTRADICTION_DETECTION=true  # Check this is set
   ```

2. **Missing Anthropic API key:**
   ```bash
   ANTHROPIC_API_KEY=sk-ant-...  # Required for Claude Haiku
   ```

3. **Results too similar or too different:**
   - Adjust thresholds:
   ```bash
   CONTRADICTION_MIN_SIMILARITY=0.15  # Lower to catch more differences
   CONTRADICTION_MAX_SIMILARITY=0.75  # Higher to catch subtle conflicts
   ```

4. **Max pairs too low:**
   ```bash
   CONTRADICTION_MAX_PAIRS=10  # Analyze more pairs
   ```

### Poor Quality Results

**Low consensus scores across all approaches:**

1. **Check source quality metadata:**
   ```sql
   SELECT metadata->>'source_quality', COUNT(*)
   FROM chunks
   WHERE doc_id IN (SELECT id FROM documents WHERE collection_id = '...')
   GROUP BY metadata->>'source_quality';
   ```

2. **Verify last_verified dates:**
   ```sql
   SELECT metadata->>'last_verified', COUNT(*)
   FROM chunks
   WHERE doc_id IN (...)
   GROUP BY metadata->>'last_verified'
   ORDER BY metadata->>'last_verified' DESC;
   ```

3. **Use reranking:**
   ```json
   { "rerank_provider": "cohere" }
   ```

**Single approach when expecting multiple:**

- Results may genuinely agree (high similarity)
- Try increasing `top_k` to get more diverse results
- Check if collection has diverse sources

### Performance Issues

**Synthesis taking >3 seconds:**

1. **Check result count:**
   ```bash
   # Lower top_k for faster synthesis
   { "top_k": 10 }
   ```

2. **Disable contradiction detection:**
   ```bash
   ENABLE_CONTRADICTION_DETECTION=false  # Saves ~500ms
   ```

3. **Check embedding provider:**
   ```bash
   # Ollama may be slow without GPU
   # Use OpenAI for faster embeddings
   DOC_EMBEDDING_PROVIDER=openai
   ```

4. **Review server resources:**
   ```bash
   # Check CPU/memory usage
   top
   ```

### High API Costs

**Budget alerts triggering frequently:**

1. **Monitor usage:**
   ```bash
   curl http://localhost:3333/api/costs/breakdown | jq '.'
   ```

2. **Reduce contradiction pairs:**
   ```bash
   CONTRADICTION_MAX_PAIRS=3  # Halves Claude API cost
   ```

3. **Use free embeddings:**
   ```bash
   DOC_EMBEDDING_PROVIDER=ollama
   ```

4. **Set stricter budget:**
   ```bash
   MONTHLY_BUDGET_USD=5.00  # Triggers fallback earlier
   ```

---

## Advanced Usage

### Custom Synthesis Parameters

While not exposed via API, you can call synthesis programmatically:

```typescript
import { synthesizeResults } from './services/synthesis.js';
import { smartSearch } from './services/search.js';

// Custom synthesis
const searchResults = await smartSearch(db, {
  query: 'authentication',
  collectionId: uuid,
  mode: 'hybrid',
  rerank: true,
  topK: 20,
});

const synthesis = await synthesizeResults(
  'authentication',
  searchResults.results,
  {
    maxResults: 20,  // Analyze more results
    signal: abortController.signal,  // Cancellation support
  }
);
```

### Analyzing Synthesis Metadata

**Query consensus scores by collection:**
```sql
-- Requires logging synthesis results (not implemented by default)
-- This is a conceptual example
SELECT
  collection_id,
  AVG(consensus_score) as avg_consensus,
  COUNT(*) as synthesis_count
FROM synthesis_log
GROUP BY collection_id
ORDER BY avg_consensus DESC;
```

### Integration with Agent

The agent can use synthesis via the `search_rag` tool:

```typescript
// Agent internally calls synthesis when enabled
const response = await agent.chat({
  message: "Compare authentication approaches in my collection",
  context: { collectionId: uuid }
});
```

---

## FAQ

### Q: Should synthesis be enabled by default?

**A:** No. Synthesis is opt-in due to:
- Higher latency (1-2 seconds vs <100ms)
- API costs (Claude Haiku for contradictions)
- Not needed for simple lookups

Enable it for use cases requiring source comparison.

### Q: Does synthesis work without contradiction detection?

**A:** Yes! With `ENABLE_CONTRADICTION_DETECTION=false`:
- Approach clustering still works
- Consensus scores still calculated
- `conflicts[]` will be empty
- Recommended approach still selected

### Q: Can synthesis handle more than 3 approaches?

**A:** No, maximum is 3 approaches (hardcoded `MAX_APPROACHES = 3`). This is intentional:
- More approaches = harder to compare
- 3 is optimal for human comprehension
- Reduces API costs

### Q: What if Claude API is down?

**A:** Graceful degradation:
- Clustering and consensus scoring still work
- Contradiction detection fails silently
- `conflicts[]` will be empty
- Recommended approach selected without conflict penalties

### Q: Does synthesis work with MCP?

**A:** Not yet. Synthesis is a backend-only feature currently. Future work could expose it via MCP tools.

### Q: How accurate is contradiction detection?

**A:** Based on Phase 12 testing:
- High severity: ~90% accuracy (clear contradictions)
- Medium severity: ~75% accuracy (nuanced differences)
- Low severity: ~60% accuracy (subjective preferences)

Always review `confidence` scores and verify critical conflicts manually.

### Q: Can I use a different model for contradictions?

**A:** Yes, set `CONTRADICTION_MODEL`:
```bash
# Use Claude Opus for better accuracy (higher cost)
CONTRADICTION_MODEL=claude-3-opus-20240229

# Use Claude Haiku for lower cost (default)
CONTRADICTION_MODEL=claude-3-haiku-20240307
```

---

## Related Documentation

- [Phase 12 Overview](../phases/phase-12/00_PHASE_12_OVERVIEW.md)
- [Synthesis Engine Architecture](../phases/phase-12/03_SYNTHESIS_ENGINE.md)
- [Contradiction Detection](../phases/phase-12/04_CONTRADICTION_DETECTION.md)
- [Cost Monitoring](../phases/phase-12/05_COST_MONITORING.md)
- [Reranking Architecture](../phases/phase-12/01_RERANKING_ARCHITECTURE.md)

---

**Phase 12: Document Synthesis** ✅
*Multi-source comparison with AI-powered conflict detection*
