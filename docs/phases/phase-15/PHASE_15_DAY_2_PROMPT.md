# Phase 15 Day 2 - Performance Optimization Prompt

**Task:** Optimize performance to maintain <600ms latency with all Phase 11-14 features active  
**GitHub Issue:** [#68 - Performance Optimization - Maintain <600ms Target](https://github.com/Beaulewis1977/synthesis/issues/68)  
**Time Estimate:** 8-10 hours  
**Priority:** HIGH

---

## 📚 Required Reading (Read First)

1. `docs/phases/phase-15/PHASE_15_AGENT_PROMPT.md` - **Quick start overview** (context and warnings)
2. `docs/phases/phase-15/00_PHASE_15_OVERVIEW.md` - Phase scope
3. `docs/phases/phase-15/04_BUILD_PLAN.md` - **Day 2 section** (lines 61-116)
4. `docs/phases/phase-15/05_ACCEPTANCE_CRITERIA.md` - **Issue #68 section**
5. GitHub Issue #68: https://github.com/Beaulewis1977/synthesis/issues/68

---

## 🎯 Day 2 Objectives

Optimize system performance to maintain <600ms search latency (p95) with all features active, while keeping costs <$0.01 per search.

---

## ✅ Tasks

### Morning: Profiling & Baseline (2 hours)
- [ ] Set up performance monitoring (metrics collection)
- [ ] Set up query profiling (pg_stat_statements)
- [ ] Establish baseline metrics (current latency, memory, cost)
- [ ] Profile database queries (EXPLAIN ANALYZE)
- [ ] Profile API calls (embedding, re-ranking)
- [ ] Identify slow operations and bottlenecks

### Afternoon: Database Optimization (3 hours)
- [ ] Add missing indexes (check query plans)
- [ ] Optimize hybrid search query (combine or parallelize vector + BM25)
- [ ] Implement Redis caching for popular queries (30min TTL)
- [ ] Optimize connection pooling
- [ ] Implement embedding cache (hash query → embedding)
- [ ] Use Voyage batch API when possible
- [ ] Add fallback to local embeddings if Voyage slow (>200ms)

### Evening: API & Feature Optimization (2-3 hours)
- [ ] Optimize re-ranking:
  - Limit to top 10 results (not 15)
  - Send only title + first 200 chars to Cohere
  - Cache re-ranked results (5min TTL)
- [ ] Optimize code intelligence:
  - Pre-compute file relationships during ingestion
  - Lazy-load related files (only when user expands)
  - Cache file relationships (30min TTL)
- [ ] Optimize API responses:
  - Send only required fields (not full chunk text)
  - Enable gzip compression
  - Implement pagination for large result sets

### Validation: Load Testing (1 hour)
- [ ] Run load tests with 100 concurrent users
- [ ] Verify latency <600ms (p95)
- [ ] Verify memory usage <2GB
- [ ] Verify cost per search <$0.01
- [ ] Document performance improvements

---

## 🔍 Commands

```bash
# Performance profiling
node --inspect server.js
# Or use clinic.js
clinic doctor -- node server.js

# Database query profiling
# Enable in PostgreSQL:
ALTER DATABASE synthesis SET log_statement = 'all';
# Analyze slow queries:
SELECT query, calls, mean_exec_time 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

# Load testing
artillery run load-test.yml

# Run tests to verify no regressions
pnpm test
pnpm typecheck
```

---

## ✨ Success Criteria

- ✅ Search latency <600ms (p95) with all features active
- ✅ Cost per search <$0.01
- ✅ Memory usage <2GB per server instance
- ✅ Supports 100 concurrent users
- ✅ Database query time <100ms
- ✅ Re-ranking adds <150ms overhead
- ✅ Cache hit rate >60% for popular queries
- ✅ All optimizations tested and validated

---

## 📖 Reference Documentation

- Issue #68 body: Detailed optimization targets and strategies
- Phase 11-14 docs: Feature implementation details for optimization
- Performance monitoring tools: clinic.js, pg_stat_statements
- Load testing: Artillery configuration

---

## ⚠️ Important Notes

- **Dependencies:** Day 1 (Integration Testing) should be complete to identify bottlenecks
- **Measure before optimizing:** Establish baseline metrics first
- **Test after each optimization:** Verify improvements and no regressions
- **Cache strategically:** Use Redis for queries, in-memory for embeddings/relationships
- **Monitor costs:** Ensure optimizations don't increase API costs

---

**Start with profiling to identify bottlenecks, then optimize systematically. See `04_BUILD_PLAN.md` Day 2 section for detailed breakdown.**

