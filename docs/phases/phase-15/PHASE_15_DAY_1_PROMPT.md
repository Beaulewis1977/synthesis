# Phase 15 Day 1 - Integration Testing Prompt

**Task:** Implement integration testing for Phase 15 Day 1  
**GitHub Issue:** [#67 - Integration Testing - All Features Working Together](https://github.com/Beaulewis1977/synthesis/issues/67)  
**Time Estimate:** 6-8 hours  
**Priority:** HIGH

---

## 📚 Required Reading (Read First)

1. `docs/phases/phase-15/PHASE_15_AGENT_PROMPT.md` - **Quick start overview** (context and warnings)
2. `docs/phases/phase-15/00_PHASE_15_OVERVIEW.md` - Phase scope
3. `docs/phases/phase-15/04_BUILD_PLAN.md` - **Day 1 section** (lines 9-60)
4. `docs/phases/phase-15/05_ACCEPTANCE_CRITERIA.md` - **Issue #67 section**
5. GitHub Issue #67: https://github.com/Beaulewis1977/synthesis/issues/67

---

## 🎯 Day 1 Objectives

Create integration test suite to verify all Phase 11-14 features work together without conflicts.

---

## ✅ Tasks

### Morning: Test Infrastructure Setup (2 hours)
- [ ] Create `apps/server/src/services/__tests__/integration.test.ts`
- [ ] Set up test database with sample data (code files, docs, various tech stacks)
- [ ] Mock external APIs (Voyage, Cohere) for consistent tests
- [ ] Create test helpers for common scenarios

### Afternoon: Write Integration Tests (2-3 hours)
- [ ] Test hybrid search + re-ranking combination
- [ ] Test hybrid search + code intelligence combination
- [ ] Test re-ranking + code intelligence combination
- [ ] Test all three together + tech stack filtering
- [ ] Test graceful degradation (one feature fails, others continue)
- [ ] Test error handling across features

### Evening: Manual Testing & Fixes (1-2 hours)
- [ ] Run test scenarios from issue #67:
  - Code search with all features
  - Multi-source synthesis
  - Large scale integration (20k files simulation)
- [ ] Fix any discovered issues
- [ ] Verify all tests pass

---

## 🔍 Commands

```bash
# Run integration tests
pnpm --filter @synthesis/server test:integration

# Run all tests
pnpm test

# Typecheck
pnpm typecheck
```

---

## ✨ Success Criteria

- ✅ Integration test suite created
- ✅ All feature combinations tested
- ✅ Performance maintained (<600ms)
- ✅ Cost tracking accurate
- ✅ Error handling graceful
- ✅ All tests passing

---

## 📖 Reference Documentation

- Issue #67 body: Detailed test scenarios
- Phase 11-14 docs: Feature implementation details
- Existing test patterns: `apps/server/src/services/__tests__/`

---

**Start with test infrastructure setup, then write tests, then validate. See `04_BUILD_PLAN.md` Day 1 section for detailed breakdown.**

