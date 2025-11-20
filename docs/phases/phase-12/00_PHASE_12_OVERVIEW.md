# Phase 12: Re-ranking & Document Synthesis

**Version:** 1.0  
**Date:** 2025-10-11  
**Status:** Planning  
**Prerequisites:** Phase 11 (Hybrid Search) Complete

---

## 🎯 Executive Summary

Enhance retrieval quality with cross-encoder re-ranking and add intelligent document synthesis capabilities. This phase enables multi-source comparison, contradiction detection, and cost monitoring for API usage.

### Why This Phase?

**Current Limitation:** Hybrid search returns top candidates, but ordering could be better
- Top 10 results contain relevant info, but not always in best order
- Can't compare multiple sources automatically
- No way to detect contradictions between docs
- API costs not tracked

**After Phase 12:** Intelligent re-ranking + synthesis
- ✅ Cross-encoder re-ranks top results for better precision
- ✅ Multi-source comparison shows different approaches
- ✅ Contradiction detection highlights conflicts
- ✅ Cost monitoring prevents budget overruns
- ✅ Synthesis API for doc rewriting

---

## 📊 Success Metrics

### Quantitative
- **Top-5 precision:** +25% improvement (measured on test queries)
- **Re-ranking latency:** <300ms additional
- **API cost tracking:** 100% accurate
- **Contradiction detection:** 85% accuracy

### Qualitative
- ✅ "Best" answer is actually at position 1
- ✅ Can compare 3+ sources automatically
- ✅ Detects conflicting recommendations
- ✅ Cost alerts prevent overspending

---

## 🏗️ Architecture

### High-Level Flow

```
Query
  ↓
Hybrid Search (Phase 11) → Top 50 candidates
  ↓
Cross-Encoder Re-rank
  - Cohere Rerank API (if available)
  - Local BGE-reranker (fallback)
  - Scores each candidate against query
  ↓
Top 15 highest relevance
  ↓
Synthesis Engine
  - Group by topic/approach
  - Detect contradictions (LLM analysis)
  - Compare sources
  ↓
Structured Response
  {
    top_results: [...],
    approaches: [
      {method: "A", sources: [...], consensus: 0.8},
      {method: "B", sources: [...], consensus: 0.6}
    ],
    conflicts: [
      {topic: "auth", source_a: ..., source_b: ..., difference: "..."}
    ]
  }
```

---

## 🔧 Core Features

### 1. Cross-Encoder Re-ranking

**Purpose:** Improve result ordering precision

**How it works:**
```
Hybrid search returns: [doc1, doc2, doc3, ..., doc50]
  ↓
For each doc:
  score = cross_encoder(query, doc.text)
  # More accurate than cosine similarity
  ↓
Re-sort by new scores
  ↓
Return top K (default 15)
```

**Providers:**
- **Cohere Rerank** (paid, best quality)
  - $1/1000 requests
  - Handles 100 docs per request
  - < 200ms latency
  
- **Local BGE-reranker** (free, good quality)
  - Runs on your machine
  - ~300ms for 50 docs
  - 80% as good as Cohere

### 2. Multi-Source Comparison

**Purpose:** Compare different approaches across sources

**Example:**
```typescript
const synthesis = await synthesizeResults({
  query: "Flutter authentication methods",
  results: top15Results,
});

// Output:
{
  approaches: [
    {
      method: "Firebase Authentication",
      sources: [
        {title: "Flutter.dev Guide", quality: "official"},
        {title: "Firebase Docs", quality: "official"}
      ],
      consensus_score: 0.9,  // High agreement
      summary: "Official recommendation for simple auth"
    },
    {
      method: "Supabase Auth",
      sources: [
        {title: "Supabase Guide", quality: "official"},
        {title: "Community Tutorial", quality: "community"}
      ],
      consensus_score: 0.7,
      summary: "Good for PostgreSQL projects"
    }
  ]
}
```

### 3. Contradiction Detection

**Purpose:** Highlight conflicting information

**Example:**
```typescript
{
  conflicts: [
    {
      topic: "Navigator usage",
      source_a: {
        title: "Flutter 3.0 Docs",
        statement: "Use Navigator 2.0 for all routing"
      },
      source_b: {
        title: "Flutter 3.24 Docs",
        statement: "GoRouter is now recommended over Navigator 2.0"
      },
      severity: "high",
      recommendation: "Use source_b (more recent)"
    }
  ]
}
```

### 4. Cost Monitoring

**Purpose:** Track and control API spending

**Features:**
- Real-time cost tracking per provider
- Budget alerts (email/log when 80% spent)
- Auto-fallback to free providers on limit
- Monthly/daily cost reports
- Per-collection cost attribution

**Database:**
```sql
CREATE TABLE api_usage (
  id SERIAL PRIMARY KEY,
  provider TEXT,  -- 'openai', 'voyage', 'cohere'
  operation TEXT, -- 'embed', 'rerank', 'chat'
  tokens_used BIGINT,
  cost_usd DECIMAL(10,4),
  collection_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🎯 Deliverables

### Code Artifacts
- [ ] `apps/server/src/services/reranker.ts` - Cross-encoder re-ranking
- [ ] `apps/server/src/services/synthesis.ts` - Multi-source comparison
- [ ] `apps/server/src/services/cost-tracker.ts` - API cost monitoring
- [ ] `packages/db/migrations/005_cost_tracking.sql` - Cost tracking schema

### API Endpoints
- [ ] `POST /api/search/rerank` - Re-rank existing results
- [ ] `POST /api/synthesis/compare` - Compare multiple sources
- [ ] `GET /api/costs/summary` - Cost dashboard data

### Configuration
- [ ] Environment variables for re-ranker provider
- [ ] Budget limit configuration
- [ ] Alert thresholds

---

## ⏱️ Timeline

**Total Duration:** 3-4 days

**Day 1:** Re-ranking Implementation (6 hours)
- Cohere integration
- Local BGE fallback
- Provider selection logic
- Testing

**Day 2:** Synthesis Engine (6 hours)
- Multi-source grouping
- Contradiction detection (LLM)
- API endpoint
- Testing

**Day 3:** Cost Monitoring (5 hours)
- Database schema
- Cost tracking service
- Budget alerts
- Dashboard API

**Day 4:** Testing & Integration (3 hours)
- End-to-end testing
- Performance validation
- Documentation

---

## 🚨 Risks & Mitigations

### Risk 1: Re-ranking Too Slow
**Mitigation:**
- Limit to top 50 candidates (not all results)
- Use local BGE by default (faster)
- Cohere only for critical queries
- Target: <300ms additional latency

### Risk 2: LLM Contradiction Detection Expensive
**Mitigation:**
- Cache common contradictions
- Only run on explicit user request
- Use Claude with short prompts
- Batch multiple comparisons

### Risk 3: Cost Tracking Adds Overhead
**Mitigation:**
- Async writes to cost table
- Batch inserts every 10 requests
- No blocking on cost writes
- Fallback if cost DB unavailable

---

## 📚 Related Phases

**Prerequisites:**
- Phase 11: Hybrid search provides candidates for re-ranking

**Enables:**
- Phase 13: Code intelligence benefits from better ranking
- Future: Multi-agent synthesis workflows

---

## ✅ Acceptance Criteria

### Must Have
- [ ] Re-ranking improves top-5 precision by 20%+
- [ ] Can compare 3+ sources and group by approach
- [ ] Contradiction detection works on test cases
- [ ] Cost tracking shows real-time API usage
- [ ] Budget alerts trigger before limit
- [ ] Local BGE re-ranker works offline

### Should Have
- [ ] Synthesis API returns structured comparisons
- [ ] Can export cost reports (CSV/JSON)
- [ ] Per-collection cost breakdown
- [ ] Re-ranking <300ms additional latency

### Nice to Have
- [ ] Visual dashboard for costs
- [ ] Email alerts for budget limits
- [ ] Automatic contradiction caching

---

## 💰 Cost Estimate

**With Cohere Re-ranking:**
- 1,000 queries/month
- Re-rank top 50 results each
- $1 per 1,000 requests
- **Total: ~$1/month**

**With Local BGE:**
- FREE
- Slightly slower (~300ms vs 200ms)
- 80% as good as Cohere

**Contradiction Detection:**
- 100 synthesis requests/month
- Claude API: ~500 tokens/request
- $3/1M input tokens
- **Total: ~$0.15/month**

**Total Phase 12 Cost: ~$1-2/month** (Cohere) or **$0.15/month** (free re-ranker)

---

**Next:** See `01_RERANKING_ARCHITECTURE.md` for technical implementation
