# Phase 15: Build Plan

**Duration:** 3-4 days  
**Focus:** Integration testing, performance optimization, frontend polish, documentation updates  
**Issues:** [#67](https://github.com/Beaulewis1977/synthesis/issues/67), [#68](https://github.com/Beaulewis1977/synthesis/issues/68), [#69](https://github.com/Beaulewis1977/synthesis/issues/69), [#70](https://github.com/Beaulewis1977/synthesis/issues/70)

---

## Day 1 — Integration Testing

**GitHub Issue:** [#67 - Integration Testing - All Features Working Together](https://github.com/Beaulewis1977/synthesis/issues/67)  
**Time:** 6-8 hours  
**Priority:** HIGH

### Morning: Test Infrastructure Setup (2 hours)

1) **Create Integration Test Suite**
   - File: `apps/server/src/services/__tests__/integration.test.ts`
   - Set up test database with sample data (code files, docs, various tech stacks)
   - Mock external APIs (Voyage, Cohere) for consistent tests
   - Create test helpers for common scenarios

2) **Test Scenarios Planning**
   - Document test scenarios from issue #67:
     - Hybrid Search + Re-ranking
     - Hybrid Search + Code Intelligence
     - Re-ranking + Code Intelligence
     - All three together
     - Tech stack filtering with all features

### Afternoon: Write Integration Tests (2-3 hours)

3) **Feature Combination Tests**
   - Test hybrid search + re-ranking pipeline
   - Test code intelligence + hybrid search
   - Test synthesis engine with code results
   - Test tech stack filtering with all features
   - Verify cost tracking captures all operations

4) **Error Handling Tests**
   - Test graceful degradation (one feature fails, others continue)
   - Test error messages are clear
   - Test retry logic across features

### Evening: Manual Testing & Fixes (1-2 hours)

5) **Manual Test Scenarios**
   - Run scenarios from issue #67:
     - Code search with all features
     - Multi-source synthesis
     - Large scale integration (20k files simulation)
   - Document any issues found

6) **Fix Discovered Issues**
   - Address any conflicts or bugs found
   - Update tests if needed
   - Verify all tests pass

---

## Day 2 — Performance Optimization

**GitHub Issue:** [#68 - Performance Optimization - Maintain <600ms Target](https://github.com/Beaulewis1977/synthesis/issues/68)  
**Time:** 8-10 hours  
**Priority:** HIGH

### Morning: Profiling & Baseline (2 hours)

1) **Set Up Performance Monitoring**
   - Add performance metrics collection
   - Set up query profiling (pg_stat_statements)
   - Establish baseline metrics (current latency, memory, cost)

2) **Identify Bottlenecks**
   - Profile database queries (EXPLAIN ANALYZE)
   - Profile API calls (embedding, re-ranking)
   - Identify slow operations

### Afternoon: Database Optimization (3 hours)

3) **Optimize Database Queries**
   - Add missing indexes (check query plans)
   - Optimize hybrid search query (combine or parallelize)
   - Implement Redis caching for popular queries (30min TTL)
   - Optimize connection pooling

4) **Optimize Embedding Provider Calls**
   - Implement embedding cache (hash query → embedding)
   - Use Voyage batch API when possible
   - Add fallback to local embeddings if Voyage slow

### Evening: API & Feature Optimization (2-3 hours)

5) **Optimize Re-ranking**
   - Limit re-ranking to top 10 results (not 15)
   - Send only title + first 200 chars to Cohere
   - Cache re-ranked results (5min TTL)

6) **Optimize Code Intelligence**
   - Pre-compute file relationships during ingestion
   - Lazy-load related files (only when user expands)
   - Cache file relationships (30min TTL)

7) **Optimize API Responses**
   - Send only required fields (not full chunk text)
   - Enable gzip compression
   - Implement pagination for large result sets

### Validation: Load Testing (1 hour)

8) **Run Load Tests**
   - Test with 100 concurrent users
   - Verify latency <600ms (p95)
   - Verify memory usage <2GB
   - Verify cost per search <$0.01

---

## Day 3 — Frontend Polish

**GitHub Issue:** [#69 - Frontend Polish - Visual Consistency & Mobile Responsive](https://github.com/Beaulewis1977/synthesis/issues/69)  
**Time:** 6-8 hours  
**Priority:** MEDIUM

### Morning: Phase 11-12 UI Polish (3-4 hours)

1) **Phase 11 Components (Trust Badges)**
   - Standardize badge sizing and colors
   - Add hover tooltips
   - Mobile responsive (stack badges vertically)
   - Add smooth fade-in animations

2) **Phase 12 Components (Cost Dashboard & Synthesis View)**
   - Responsive layout (sidebar collapses on mobile)
   - Animate progress bars smoothly
   - Chart labels readable on small screens
   - Loading skeletons for async data
   - Toggle button clear active state
   - Approach cards consistent spacing
   - Contradiction boxes stand out (yellow background)

### Afternoon: Phase 13-14 UI Polish (2-3 hours)

3) **Phase 13 Components (Related Files Panel)**
   - Smooth slide animation for panel
   - File links have hover state
   - Icons consistent (📦 imports, 📝 tests)
   - Mobile layout fixes
   - Long file paths truncate with ellipsis

4) **Phase 14 Components (Tech Stack Filter)**
   - Filter chips mobile responsive
   - Touch targets ≥44px
   - Clear visual feedback when selected

### Evening: Cross-Cutting Polish (1 hour)

5) **Design System Consistency**
   - Verify all components use same color palette
   - Typography consistent (font sizes, weights)
   - Spacing follows 8px grid
   - Loading states everywhere (skeletons/spinners)
   - Error boundaries and toast notifications

6) **Accessibility**
   - Keyboard navigation (Tab, Enter, Escape)
   - Focus indicators visible
   - ARIA labels on icon-only buttons
   - Color contrast ≥4.5:1 (WCAG AA)
   - Screen reader tested

---

## Day 4 — Documentation Updates

**GitHub Issue:** [#70 - Update Documentation for v2.0 Features](https://github.com/Beaulewis1977/synthesis/issues/70)  
**Time:** 4-6 hours  
**Priority:** MEDIUM

### Morning: Core Documentation (2 hours)

1) **Update README.md**
   - Add "What's New in v2.0" section
   - Update feature list (hybrid search, re-ranking, code intelligence, etc.)
   - Update screenshots showing new UI components
   - Add v2.0 highlights

2) **Update API Documentation**
   - Document new endpoints:
     - POST /api/search (updated parameters)
     - POST /api/synthesis/compare
     - GET /api/documents/:id/related-files
     - GET /api/costs/summary
     - GET /api/costs/alerts
   - Add request/response examples
   - Document error codes and rate limits

3) **Update Architecture Documentation**
   - Update architecture diagram (BM25, multi-provider, re-ranking, synthesis, AST parser)
   - Update pipeline stages
   - Add data flow diagrams
   - Document performance characteristics

### Afternoon: User Guides & Migration (2 hours)

4) **Create New User Guides**
   - `docs/guides/HYBRID_SEARCH_GUIDE.md` - What is hybrid search, when to use
   - `docs/guides/COST_MANAGEMENT_GUIDE.md` - Understanding API costs, budget limits
   - `docs/guides/CODE_SEARCH_GUIDE.md` - How code chunking works, finding related files
   - `docs/guides/SYNTHESIS_GUIDE.md` - Multi-source comparison, contradiction detection

5) **Create Migration Guide**
   - `docs/MIGRATION_v1_to_v2.md`
   - Breaking changes (none expected)
   - New features and how to enable
   - Configuration changes (env variables)
   - Upgrade steps
   - Rollback procedure

### Evening: Supporting Documentation (1 hour)

6) **Update Configuration Documentation**
   - Document new environment variables:
     - ENABLE_HYBRID_SEARCH
     - DEFAULT_EMBEDDING_PROVIDER
     - VOYAGE_API_KEY
     - COHERE_API_KEY
     - ENABLE_RERANKING
     - MONTHLY_BUDGET_USD
     - ENABLE_CODE_CHUNKING
   - Document defaults, valid options, required vs optional

7) **Create Troubleshooting Guide**
   - `docs/TROUBLESHOOTING.md`
   - Common issues and solutions
   - "Hybrid search not working" → Check ENABLE_HYBRID_SEARCH
   - "Re-ranking failed" → Verify COHERE_API_KEY
   - "Code files not chunked properly" → Check file extensions
   - "Related files not showing" → Run file relationship migration

8) **Review & Polish**
   - Proofread all updated docs
   - Test all code examples
   - Verify all links work
   - Ensure consistent formatting

---

## Commands

```bash
# Run integration tests
pnpm --filter @synthesis/server test:integration

# Run all tests
pnpm test

# Typecheck
pnpm typecheck

# Lint
pnpm lint

# Performance profiling
node --inspect server.js
# Or use clinic.js
clinic doctor -- node server.js

# Load testing
artillery run load-test.yml
```

---

## Risks & Mitigations

**Integration Conflicts:**
- Risk: Features may conflict when used together
- Mitigation: Comprehensive integration tests, graceful degradation

**Performance Degradation:**
- Risk: Adding features may slow down system
- Mitigation: Profiling, optimization, caching, load testing

**UI Inconsistencies:**
- Risk: Components may look inconsistent
- Mitigation: Design system checklist, visual regression testing

**Documentation Gaps:**
- Risk: New features not documented
- Mitigation: Documentation checklist, peer review

---

## Success Metrics

**Integration Testing:**
- ✅ All Phase 11-14 features work together
- ✅ No conflicts or mutual exclusions
- ✅ Performance maintained (<600ms)
- ✅ Cost tracking accurate

**Performance Optimization:**
- ✅ Search latency <600ms (p95)
- ✅ Cost per search <$0.01
- ✅ Memory usage <2GB
- ✅ Supports 100 concurrent users

**Frontend Polish:**
- ✅ Lighthouse score >90
- ✅ Mobile usability 100%
- ✅ WCAG AA compliant
- ✅ Visual consistency achieved

**Documentation:**
- ✅ All features documented
- ✅ Migration guide complete
- ✅ User guides created
- ✅ Examples tested and working

