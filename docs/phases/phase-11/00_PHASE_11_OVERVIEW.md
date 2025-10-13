# Phase 11: Hybrid Search & Multi-Model Embeddings

**Version:** 1.0  
**Date:** 2025-10-11  
**Status:** Planning  
**Prerequisites:** Phase 7 (Docker) Complete

---

## 🎯 Executive Summary

Enhance the Synthesis RAG system with hybrid search (semantic + lexical), multi-provider embedding support, and intelligent metadata-based routing. This phase transforms the system from basic vector search into a production-grade retrieval engine capable of handling diverse content types (code, documentation, personal writings) with optimal accuracy.

### Why This Phase?

**Current Limitation:** Pure vector search misses exact matches
- Query: "StatefulWidget lifecycle" → misses exact class name matches
- 20,000+ files require both semantic AND keyword matching
- Different content types need specialized embedding models

**After Phase 11:** Hybrid intelligence + flexible embedding providers
- ✅ Find both concepts AND exact terms
- ✅ Use free models for docs, paid models for code
- ✅ Route queries intelligently based on content
- ✅ Track metadata for version-specific filtering

---

## 📊 Success Metrics

### Quantitative
- **Retrieval accuracy:** +40% (measured on test queries)
- **Exact match recall:** 95%+ for API/class names
- **Search latency:** <600ms (hybrid + reranking)
- **API cost:** <$10/month for typical usage
- **Backwards compatibility:** 100% (no breaking changes)

### Qualitative
- ✅ Agents find exact Flutter widget names
- ✅ Code searches return working examples with imports
- ✅ Version filtering works ("Flutter 3.24+ only")
- ✅ Personal writing style preserved in metadata
- ✅ Zero breaking changes to existing collections

---

## 🏗️ Architecture Changes

### High-Level Flow

```text
BEFORE (Phase 1-7):
Query → Embed (Ollama) → Vector Search → Top 5

AFTER (Phase 11):
Query → {
  Auto-detect content type
    ↓
  Select embedding provider (Ollama/OpenAI/Voyage)
    ↓
  Parallel execution:
    - Vector Search (pgvector) → Top 30
    - BM25 Full-Text (pg_trgm) → Top 30
    ↓
  Merge with RRF (Reciprocal Rank Fusion) → Top 50
    ↓
  Filter by metadata (version, quality, freshness)
    ↓
  Return Top 10 with hybrid scores
}
```

### Component Additions

**New Services:**
- `apps/server/src/services/bm25.ts` - Full-text search
- `apps/server/src/services/hybrid.ts` - Score fusion
- `apps/server/src/services/embedding-router.ts` - Provider selection

**Enhanced Services:**
- `apps/server/src/services/search.ts` - Wrapper for hybrid
- `apps/server/src/pipeline/embed.ts` - Multi-provider support

**New Database Objects:**
- Full-text search indexes (GIN)
- Metadata columns for tracking
- Migration scripts

---

## 🔧 Core Features

### 1. Hybrid Search

**Vector Search (Semantic):**
- Understands concepts and context
- "authentication flow" finds auth-related content
- HNSW index on pgvector embeddings

**BM25 Search (Lexical):**
- Exact keyword matching
- "StatefulWidget" finds exact class names
- GIN index on text columns

**Fusion Strategy:**
```typescript
// Reciprocal Rank Fusion (RRF)
score = Σ(1 / (k + rank_i))

// Where:
// k = 60 (constant)
// rank_i = position in each result list
```

### 2. Multi-Provider Embeddings

**Provider Matrix:**

| Content Type | Provider | Model | Dimensions | Cost |
|--------------|----------|-------|------------|------|
| General Docs | Ollama | nomic-embed-text | 768 | FREE |
| Code Snippets | Voyage | voyage-code-2 | 1024 | $0.12/1M |
| Personal Writings | OpenAI | text-embedding-3-large | 1536 | $0.13/1M |

**Routing Logic:**
```typescript
function selectProvider(content: string, collection: Collection) {
  // 1. Check collection preference
  if (collection.metadata.embedding_provider) {
    return collection.metadata.embedding_provider;
  }
  
  // 2. Auto-detect content type
  if (isCode(content)) return 'voyage-code-2';
  if (isPersonalWriting(content)) return 'openai';
  
  // 3. Default to free
  return 'ollama';
}
```

### 3. Enhanced Metadata Schema

**Document Metadata:**
```typescript
interface DocumentMetadata {
  // Source tracking
  doc_type: 'official_doc' | 'code_sample' | 'repo' | 'tutorial' | 'personal_writing';
  source_url?: string;
  source_quality: 'official' | 'verified' | 'community';
  
  // Version tracking (critical for Flutter)
  framework?: 'flutter' | 'dart' | 'fastify' | 'postgres';
  framework_version?: string; // "3.24.3"
  sdk_constraints?: string; // ">=3.22.0 <4.0.0"
  
  // Code context
  language?: 'dart' | 'typescript' | 'yaml' | 'sql';
  file_path?: string;
  repo_name?: string;
  
  // Embedding tracking
  embedding_model: 'nomic-embed-text' | 'voyage-code-2' | 'text-embedding-3-large';
  embedding_dimensions: 768 | 1024 | 1536;
  
  // Freshness
  last_verified?: Date;
  created_at: Date;
}
```

### 4. Trust Scoring

**Formula:**
```typescript
final_score = similarity * trust_weight * recency_weight

Where:
- Official docs: trust_weight = 1.0
- Verified repos (1k+ stars): trust_weight = 0.85
- Community content: trust_weight = 0.6
- Personal writings: trust_weight = 1.0 (in personal collections)

- Last 6 months: recency_weight = 1.0
- 6-12 months: recency_weight = 0.9
- 1+ years: recency_weight = 0.7
```

---

## 🔄 Migration Strategy

### Backwards Compatibility

**Guarantee:** Zero breaking changes

**Strategy:**
1. Add new columns/indexes (non-destructive)
2. Existing collections continue to work
3. New features opt-in via collection metadata
4. Old search API remains functional

**Feature Flags:**
```bash
# .env
SEARCH_MODE=hybrid  # or 'vector' (default for old collections)
ENABLE_TRUST_SCORING=true
ENABLE_AUTO_ROUTING=true
```

### Existing Data

**No re-embedding required:**
- Old chunks keep existing embeddings
- Add `embedding_model: 'nomic-embed-text'` metadata
- System knows which model was used per chunk
- Can selectively re-embed high-value collections later

---

## 📦 Dependencies

### New Packages

```json
{
  "@voyageai/voyageai": "^1.2.0",
  "openai": "^4.20.0"
}
```

### Database Extensions

```sql
-- Already have pgvector
-- Add full-text search support
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

---

## 🎯 Deliverables

### Code Artifacts
- [ ] `apps/server/src/services/bm25.ts` - Full-text search implementation
- [ ] `apps/server/src/services/hybrid.ts` - Score fusion logic
- [ ] `apps/server/src/services/embedding-router.ts` - Provider selection
- [ ] `apps/server/src/pipeline/embed.ts` - Multi-provider support
- [ ] `packages/db/migrations/004_hybrid_search.sql` - Database changes

### Configuration
- [ ] Environment variable documentation
- [ ] Provider API key setup guide
- [ ] Cost estimation calculator

### Testing
- [ ] Hybrid search unit tests
- [ ] Provider routing tests
- [ ] Backwards compatibility tests
- [ ] Performance benchmarks (before/after)

### Documentation
- [ ] Architecture diagrams
- [ ] Migration guide
- [ ] API changes documentation
- [ ] Troubleshooting guide

---

## ⏱️ Timeline

**Total Duration:** 3-4 days

**Day 1:** BM25 + Hybrid Search (6 hours)
- Database migration
- BM25 service implementation
- Hybrid fusion logic
- Basic testing

**Day 2:** Multi-Provider Embeddings (6 hours)
- OpenAI integration
- Voyage integration
- Routing logic
- Provider fallbacks

**Day 3:** Metadata & Trust Scoring (5 hours)
- Enhanced metadata schema
- Trust score calculation
- Filtering logic
- Integration testing

**Day 4:** Testing & Documentation (3 hours)
- Performance benchmarks
- Backwards compatibility verification
- Documentation updates
- Acceptance criteria validation

---

## 🚨 Risks & Mitigations

### Risk 1: API Cost Overruns
**Mitigation:**
- Default to free Ollama
- Budget limits in code
- Auto-fallback to local models
- Cost monitoring (Phase 9)

### Risk 2: Query Latency Increase
**Mitigation:**
- Run vector + BM25 in parallel
- Cache frequent queries
- Limit fusion to top candidates
- Target: <600ms total

### Risk 3: Score Fusion Complexity
**Mitigation:**
- Use proven RRF algorithm
- Provide debug mode to inspect scores
- A/B test against pure vector
- Tunable weights per collection

### Risk 4: Backwards Compatibility Break
**Mitigation:**
- Feature flags for all new features
- Keep old search path functional
- Extensive compatibility tests
- Gradual rollout per collection

---

## 📚 Related Phases

**Prerequisites:**
- Phase 7: Docker deployment must be complete

**Enables:**
- Phase 12: Re-ranking (needs hybrid search output)
- Phase 13: Code intelligence (needs multi-provider embeddings)

**Future Enhancements:**
- Query expansion
- Semantic caching
- Embedding compression

---

## ✅ Acceptance Criteria

### Must Have
- [ ] Hybrid search returns results combining vector + BM25
- [ ] Can configure different embedding providers per collection
- [ ] Metadata schema supports version tracking
- [ ] Trust scoring weights results appropriately
- [ ] Zero breaking changes to existing collections
- [ ] Search latency <600ms for hybrid queries
- [ ] All existing MCP tools continue to work

### Should Have
- [ ] Auto-routing selects optimal embedding provider
- [ ] Cost stays under $10/month for typical usage
- [ ] Debug mode shows score breakdown
- [ ] Simple benchmarks show accuracy improvement

### Nice to Have
- [ ] Visual dashboard for provider usage
- [ ] Automatic provider fallback on errors
- [ ] Query performance analytics

---

**Next:** See `01_HYBRID_SEARCH_ARCHITECTURE.md` for technical deep-dive
