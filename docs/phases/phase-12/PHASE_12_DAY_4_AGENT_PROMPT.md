# Phase 12 Day 4 - Agent Prompt

**Task:** Integration tests, performance validation, metrics collection, and PR preparation

**Status:** Days 1-3 complete. Now validating everything works together.

---

## 📚 Documentation to Read

**Read these documents IN ORDER:**

1. **docs/phases/phase-12/07_ACCEPTANCE_CRITERIA.md** (PRIMARY - validation checklist)
2. **docs/phases/phase-12/06_BUILD_PLAN.md** (Day 4 section for context)
3. **docs/phases/phase-12/PHASE_12_AGENT_DAILY_PROMPTS.md** (Day 4 section)
4. **docs/phases/phase-12/00_PHASE_12_OVERVIEW.md** (overall context)

**Work under:** Issue #61 (Phase 12 Epic)

---

## 🎯 Main Objectives

### 1. Create Integration Tests
- **File:** `apps/server/src/services/__tests__/integration.test.ts`
- **Tests:**
  - Full search pipeline with reranking enabled
  - Synthesis API with multiple documents
  - Contradiction detection with conflicting sources
  - Cost tracking records API calls
  - Budget alerts trigger at thresholds
  - Feature flags work correctly

### 2. Run Performance Benchmarks
- **File:** `scripts/benchmark-phase12.ts` (create if doesn't exist)
- **What to measure:**
  - **Baseline:** Run 50+ test queries WITHOUT reranking
  - **With reranking:** Run same queries WITH reranking enabled
  - Record precision@5, precision@10, MRR for both
  - Calculate improvement percentage
  - Measure latency (p50, p95, p99)
  - Document which queries improved most

### 3. Validate Cost Tracking
- Query database to verify costs are being recorded
- Check all providers (OpenAI, Voyage, Cohere, Anthropic)
- Verify budget alert system works
- Test fallback mode triggers correctly

### 4. Prepare PR
- Ensure all feature flags OFF by default
- Write metrics summary for issue #61
- Create acceptance criteria checklist
- Update documentation if needed

---

## ✅ Requirements Checklist

### Integration Tests
- [ ] Create `apps/server/src/services/__tests__/integration.test.ts`
- [ ] Test: Search with reranking returns reranked results
- [ ] Test: Synthesis groups approaches correctly
- [ ] Test: Contradiction detection identifies conflicts
- [ ] Test: Cost tracking records usage in database
- [ ] Test: Budget alerts trigger at 80% and 100%
- [ ] Test: Feature flags disable features when OFF
- [ ] Test: All defaults work without breaking changes

### Performance Benchmarks
- [ ] Create/run `scripts/benchmark-phase12.ts`
- [ ] **Baseline measurement:** Run searches WITHOUT reranking, record precision@5
- [ ] **Reranking measurement:** Run same queries WITH reranking enabled
- [ ] **Calculate improvement:** `(reranked - baseline) / baseline * 100`
- [ ] Verify: Precision@5 improvement ≥ 20%
- [ ] Verify: Added latency < +300ms (p95)
- [ ] Document: Which queries improved most
- [ ] Document: Test set used and methodology

### Cost Tracking Validation
- [ ] Query: `SELECT * FROM api_usage ORDER BY created_at DESC LIMIT 10`
- [ ] Verify: OpenAI embeddings tracked correctly
- [ ] Verify: Voyage embeddings tracked correctly
- [ ] Verify: Cohere reranking tracked correctly
- [ ] Verify: Anthropic synthesis tracked correctly
- [ ] Verify: Cost calculations accurate (± 1%)
- [ ] Test: Budget alert triggers at 80%
- [ ] Test: Budget alert triggers at 100%
- [ ] Verify: Fallback mode activates at 100%

### Quality Checks
- [ ] Run: `pnpm test` (all tests passing)
- [ ] Run: `pnpm lint` (no errors)
- [ ] Run: `pnpm build` (builds successfully)
- [ ] Run: `pnpm --filter @synthesis/server typecheck` (no TypeScript errors)
- [ ] Verify: No console errors in logs
- [ ] Verify: Defaults unchanged (features OFF by default)

### PR Preparation
- [ ] Feature flags OFF by default in all services
- [ ] Metrics summary created (precision, latency, cost tracking)
- [ ] Acceptance criteria checklist filled out
- [ ] Implementation notes updated
- [ ] README updated with new env vars (if needed)
- [ ] PR description includes: metrics, breaking changes, testing instructions

---

## 🔧 Commands to Run

### 1. Integration Tests
```bash
# Run integration tests
pnpm --filter @synthesis/server test integration

# Run all tests
pnpm test
```

### 2. Performance Benchmarks
```bash
# Run benchmark script
pnpm tsx scripts/benchmark-phase12.ts

# Save results
pnpm tsx scripts/benchmark-phase12.ts > docs/phases/phase-12/day4-benchmark-results.md
```

### 3. Cost Tracking Verification
```bash
# Check database for cost records
psql $DATABASE_URL -c "SELECT * FROM api_usage ORDER BY created_at DESC LIMIT 10;"

# Check budget alerts
psql $DATABASE_URL -c "SELECT * FROM budget_alerts ORDER BY triggered_at DESC LIMIT 5;"

# Check monthly spend
curl http://localhost:3333/api/costs/summary | jq

# Check cost history
curl http://localhost:3333/api/costs/history | jq

# Check alerts
curl http://localhost:3333/api/costs/alerts | jq
```

### 4. Quality Checks
```bash
# Linting
pnpm lint

# Type checking
pnpm --filter @synthesis/server typecheck

# Build
pnpm build

# Full test suite
pnpm test
```

---

## 📊 Metrics to Collect

### Performance Metrics

**Create a table like this:**

```markdown
| Metric | Baseline (No Rerank) | With Reranking | Improvement |
|--------|---------------------|----------------|-------------|
| Precision@5 | X.XX | X.XX | +XX% |
| Precision@10 | X.XX | X.XX | +XX% |
| MRR | X.XX | X.XX | +XX% |
| Latency (p50) | XXXms | XXXms | +XXms |
| Latency (p95) | XXXms | XXXms | +XXms |
| Latency (p99) | XXXms | XXXms | +XXms |
```

**Requirements:**
- Precision@5 improvement must be ≥ 20%
- Latency increase must be < +300ms (p95)

### Cost Tracking Metrics

**Create a table like this:**

```markdown
| Provider | Operation | Request Count | Total Cost | Avg Cost/Request |
|----------|-----------|---------------|------------|------------------|
| OpenAI | embed | XXX | $X.XX | $X.XXXX |
| Voyage | embed | XXX | $X.XX | $X.XXXX |
| Cohere | rerank | XXX | $X.XX | $X.XXXX |
| Anthropic | synthesis | XXX | $X.XX | $X.XXXX |
```

**Verify:**
- All costs recorded accurately (± 1%)
- Budget alerts trigger at 80% and 100%
- Monthly spend tracked correctly

---

## 📝 Deliverables

### 1. Integration Tests
**File:** `apps/server/src/services/__tests__/integration.test.ts`

**Must test:**
- Complete search flow with reranking
- Synthesis with multiple approaches
- Contradiction detection
- Cost tracking accuracy
- Budget alert triggering
- Feature flag behavior

### 2. Benchmark Results
**File:** `docs/phases/phase-12/day4-benchmark-results.md`

**Must include:**
- Test methodology
- Baseline vs reranked metrics
- Improvement percentages
- Latency measurements
- Example queries that improved most
- Queries that didn't improve (edge cases)

### 3. Metrics Summary
**Post to Issue #61**

**Template:**
```markdown
# Phase 12 Day 4 - Validation Complete

## Performance Metrics
[Insert table from above]

**Key Findings:**
- Precision@5 improved by XX% (target: ≥20%) ✅/❌
- Added latency: +XXXms p95 (target: <300ms) ✅/❌
- Top performing queries: [list]
- Edge cases: [list]

## Cost Tracking Validation
[Insert cost table from above]

**Verification:**
- ✅ All providers tracked correctly
- ✅ Cost calculations accurate (±1%)
- ✅ Budget alerts trigger at 80% and 100%
- ✅ Monthly spend: $XX.XX

## Test Results
- Integration tests: XX/XX passing ✅
- Unit tests: XXX/XXX passing ✅
- Coverage: XX% ✅
- Linting: No errors ✅
- Build: Success ✅

## Acceptance Criteria
[Check off items from 07_ACCEPTANCE_CRITERIA.md]

## Next Steps
- [ ] Frontend implementation (Days 5-6)
- [ ] Final review and merge
```

### 4. PR Ready
**PR Description should include:**
- Link to issue #61
- Metrics summary (performance + costs)
- Acceptance criteria checklist
- Breaking changes: None (all behind feature flags)
- Testing instructions
- How to enable features safely

---

## 🚨 Critical Validation Steps

### Baseline Measurement Process

**Step 1: Run WITHOUT Reranking**
```bash
# Set feature flags OFF
export ENABLE_RERANKING=false

# Restart server
pnpm --filter @synthesis/server dev

# Run test queries
pnpm tsx scripts/benchmark-phase12.ts --no-rerank

# Record results: precision@5, latency
```

**Step 2: Run WITH Reranking**
```bash
# Set feature flags ON
export ENABLE_RERANKING=true
export RERANKER_PROVIDER=cohere

# Restart server
pnpm --filter @synthesis/server dev

# Run same test queries
pnpm tsx scripts/benchmark-phase12.ts --with-rerank

# Record results: precision@5, latency
```

**Step 3: Calculate Improvement**
```
improvement = (reranked_precision - baseline_precision) / baseline_precision * 100
```

**Must be ≥ 20% to pass acceptance criteria.**

---

## 🎯 Integration Test Examples

### Test 1: Search with Reranking
```typescript
it('reranks search results and improves relevance', async () => {
  const query = 'Flutter authentication with Firebase';
  
  // Search without reranking
  const baseline = await search(query, { rerank: false });
  
  // Search with reranking
  const reranked = await search(query, { rerank: true });
  
  // Verify reranked results have scores
  expect(reranked[0].rerankScore).toBeGreaterThan(0);
  
  // Verify top result changed (improved)
  expect(reranked[0].id).not.toBe(baseline[0].id);
});
```

### Test 2: Cost Tracking Integration
```typescript
it('tracks API costs in database', async () => {
  const before = await db.query('SELECT COUNT(*) FROM api_usage');
  
  // Trigger API calls
  await search('test query', { rerank: true });
  await synthesize('test query', results);
  
  const after = await db.query('SELECT COUNT(*) FROM api_usage');
  
  // Verify new records created
  expect(after.rows[0].count).toBeGreaterThan(before.rows[0].count);
});
```

### Test 3: Budget Alert Triggering
```typescript
it('triggers budget alert at 80% threshold', async () => {
  // Set low budget
  process.env.MONTHLY_BUDGET_USD = '1';
  
  // Generate enough usage to hit 80%
  // ... trigger API calls ...
  
  // Check alert created
  const alerts = await db.query(
    'SELECT * FROM budget_alerts WHERE alert_type = $1',
    ['warning']
  );
  
  expect(alerts.rows.length).toBeGreaterThan(0);
});
```

---

## ⚠️ Important Notes

1. **Feature Flags OFF by Default**
   - All new features must be behind flags
   - Default behavior must be unchanged
   - No breaking changes to existing API

2. **Cost Tracking Non-Blocking**
   - All cost tracking is async
   - Failures don't break requests
   - Use `.catch()` for error handling

3. **Benchmark Test Set**
   - Use real sample documents (Flutter guides)
   - Create diverse queries (50+)
   - Include edge cases (short/long queries)
   - Document methodology

4. **Verification Note**
   - Write clear instructions for enabling features
   - Document which flags to use
   - Explain safe rollout strategy
   - Include rollback plan

---

## 🎉 Success Criteria

**Day 4 is complete when:**

- ✅ Integration tests created and passing
- ✅ Benchmarks show ≥20% precision improvement
- ✅ Added latency <300ms (p95)
- ✅ Cost tracking validated (±1% accuracy)
- ✅ Budget alerts working
- ✅ All quality checks passing (tests, lint, build)
- ✅ Metrics summary posted to #61
- ✅ PR ready with complete description
- ✅ Acceptance criteria checklist complete

**Timeline:** 6-8 hours

---

## 📞 Handoff

**When complete, post to Issue #61:**

```markdown
Phase 12 Backend Complete - Ready for Review

Day 4 validation complete. See metrics summary above.

All acceptance criteria met:
- ✅ Precision improvement: +XX%
- ✅ Latency impact: +XXXms
- ✅ Cost tracking: Accurate
- ✅ All tests passing

PR: #XXX
Branch: phase-12-backend

Next: Frontend implementation (Days 5-6) tracked in #64
```

**Then use handoff template from `docs/15_AGENT_PROMPTS.md`**

---

**Remember:** This is validation day. Focus on proving everything works correctly, not adding new features.
