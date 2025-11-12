# Phase 15 - Quick Start Agent Prompt

**Task:** Complete integration testing, performance optimization, frontend polish, and documentation updates for v2.0 release preparation.

**GitHub Issues:** [#67](https://github.com/Beaulewis1977/synthesis/issues/67), [#68](https://github.com/Beaulewis1977/synthesis/issues/68), [#69](https://github.com/Beaulewis1977/synthesis/issues/69), [#70](https://github.com/Beaulewis1977/synthesis/issues/70)  
**Milestone:** [Phase 15: Integration & Polish](https://github.com/Beaulewis1977/synthesis/milestone/6)  
**Detailed Guide:** `docs/phases/phase-15/04_BUILD_PLAN.md` (READ THIS FOR DAY-BY-DAY INSTRUCTIONS)

---

## 📚 Read in Order (BEFORE Starting)

### MUST READ (Required):
1. `docs/phases/phase-15/00_PHASE_15_OVERVIEW.md` - Scope and objectives
2. `docs/phases/phase-15/04_BUILD_PLAN.md` - **DETAILED DAY-BY-DAY GUIDE** ⭐
3. `docs/phases/phase-15/05_ACCEPTANCE_CRITERIA.md` - Success criteria
4. `docs/phases/phase-15/PHASE_15_ISSUES.md` - Issue summaries

### Context Only (DO NOT IMPLEMENT):
- `docs/phases/phase-13-5/ROADMAP_PHASE_14_PLUS.md` - Future roadmap items
- `docs/phases/phase-16/` - Phase 16 scope (do not start yet)

### Reference Documentation (Read as Needed):
- Phase 11 docs: `docs/phases/phase-11/` - Hybrid search implementation
- Phase 12 docs: `docs/phases/phase-12/` - Re-ranking and synthesis
- Phase 13 docs: `docs/phases/phase-13/` - Code intelligence
- Phase 14 docs: `docs/phases/phase-14/` - Tech stack filtering

---

## 🎯 Objectives

**Day 1 - Integration Testing (#67):** Test all Phase 11-14 features working together  
**Day 2 - Performance Optimization (#68):** Maintain <600ms latency with all features  
**Day 3 - Frontend Polish (#69):** Visual consistency, mobile responsive, accessible  
**Day 4 - Documentation Updates (#70):** Update all docs for v2.0

---

## ✅ Requirements Checklist

### Day 1 - Integration Testing (#67):
- [ ] Create integration test suite (`apps/server/src/services/__tests__/integration.test.ts`)
- [ ] Test hybrid search + re-ranking combination
- [ ] Test hybrid search + code intelligence combination
- [ ] Test re-ranking + code intelligence combination
- [ ] Test all three together + tech stack filtering
- [ ] Test graceful degradation (one feature fails, others continue)
- [ ] Test error handling across features
- [ ] Run manual test scenarios from issue #67
- [ ] Fix any discovered issues

### Day 2 - Performance Optimization (#68):
- [ ] Set up performance monitoring and profiling
- [ ] Establish baseline metrics
- [ ] Optimize database queries (add indexes, optimize hybrid search)
- [ ] Implement Redis caching for popular queries
- [ ] Optimize embedding provider calls (cache, batch API)
- [ ] Optimize re-ranking (limit results, cache responses)
- [ ] Optimize code intelligence (pre-compute relationships, lazy-load)
- [ ] Optimize API responses (compression, pagination)
- [ ] Run load tests and verify <600ms latency (p95)

### Day 3 - Frontend Polish (#69):
- [ ] Polish Phase 11 components (trust badges, recency indicators)
- [ ] Polish Phase 12 components (cost dashboard, synthesis view)
- [ ] Polish Phase 13 components (related files panel)
- [ ] Polish Phase 14 components (tech stack filter)
- [ ] Ensure design system consistency (colors, typography, spacing)
- [ ] Mobile responsive testing (320px width)
- [ ] Accessibility testing (keyboard nav, ARIA labels, contrast)
- [ ] Add loading states everywhere (skeletons, spinners)
- [ ] Add error boundaries and toast notifications

### Day 4 - Documentation Updates (#70):
- [ ] Update README.md with v2.0 features
- [ ] Update API documentation (all new endpoints)
- [ ] Update architecture documentation (diagrams, pipeline)
- [ ] Create user guides (hybrid search, cost management, code search, synthesis)
- [ ] Create migration guide (v1 to v2)
- [ ] Update configuration documentation (env variables)
- [ ] Create troubleshooting guide
- [ ] Review and test all code examples
- [ ] Verify all links work

---

## 🔍 Commands

```bash
# Run integration tests
pnpm --filter @synthesis/server test:integration

# Run all tests
pnpm test

# Type checking
pnpm typecheck

# Lint
pnpm lint

# Full validation
pnpm test && pnpm typecheck && pnpm lint

# Performance profiling
node --inspect server.js
# Or use clinic.js
clinic doctor -- node server.js

# Load testing
artillery run load-test.yml

# Lighthouse audit (for frontend polish)
lighthouse http://localhost:3000
```

---

## ✨ Success Criteria

### Integration Testing (#67):
- ✅ All Phase 11-14 features work together without conflicts
- ✅ Performance maintained (<600ms)
- ✅ Cost tracking accurate
- ✅ Error handling graceful

### Performance Optimization (#68):
- ✅ Search latency <600ms (p95) with all features active
- ✅ Cost per search <$0.01
- ✅ Memory usage <2GB
- ✅ Supports 100 concurrent users

### Frontend Polish (#69):
- ✅ Lighthouse score >90
- ✅ Mobile responsive (320px width)
- ✅ WCAG AA compliant
- ✅ Visual consistency achieved

### Documentation Updates (#70):
- ✅ All features documented
- ✅ Migration guide complete
- ✅ User guides created
- ✅ Examples tested and working

### Overall:
- ✅ All tests passing (unit + integration)
- ✅ Typecheck clean
- ✅ Lint clean
- ✅ All GitHub issues closed (#67, #68, #69, #70)
- ✅ Ready to proceed to Phase 16

---

## 📖 For Detailed Instructions

**See:** `docs/phases/phase-15/04_BUILD_PLAN.md`

This file contains:
- Hour-by-hour breakdown for each day
- Specific tasks and file locations
- Code examples where helpful
- Validation steps
- Common pitfalls to avoid
- Help section with references

---

## ⚠️ Important Notes

1. **Do NOT start Phase 16 work** - Phase 16 (Final Testing & v2.0 Release) comes after Phase 15
2. **Do NOT implement Phase 14+ roadmap items** - See `docs/phases/phase-13-5/ROADMAP_PHASE_14_PLUS.md` for deferred items
3. **Verify Phase 14 is complete** - All Phase 14 issues must be closed before starting
4. **Focus on polish, not new features** - This phase is about integration and polish, not new development
5. **Documentation is critical** - Phase 15 documentation updates are essential for v2.0 release

---

## 🆘 Help & References

**If stuck on integration testing:**
- See issue #67 body for detailed test scenarios
- Check Phase 11-14 docs for feature implementation details
- Review existing test patterns in `apps/server/src/services/__tests__/`

**If stuck on performance:**
- See issue #68 body for optimization targets
- Use profiling tools (clinic.js, node --inspect)
- Check database query plans (EXPLAIN ANALYZE)

**If stuck on frontend polish:**
- See issue #69 body for specific polish requirements
- Check design system in existing components
- Use Lighthouse for automated accessibility checks

**If stuck on documentation:**
- See issue #70 body for documentation checklist
- Reference Phase 11-14 docs for technical details
- Check existing docs for formatting patterns

---

**Ready to start?**

1. **Read this file first** (`PHASE_15_AGENT_PROMPT.md`) - Get context and warnings
2. **Then read the specific day prompt:**
   - Day 1: `docs/phases/phase-15/PHASE_15_DAY_1_PROMPT.md`
   - Day 2: `docs/phases/phase-15/PHASE_15_DAY_2_PROMPT.md`
   - Day 3: `docs/phases/phase-15/PHASE_15_DAY_3_PROMPT.md`
   - Day 4: `docs/phases/phase-15/PHASE_15_DAY_4_PROMPT.md`
3. **Follow the day prompt** - It references the detailed build plan sections

**Begin with Day 1 - Integration Testing. Read `PHASE_15_DAY_1_PROMPT.md` for Day 1 instructions.**

