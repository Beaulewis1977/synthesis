# Phase 14 - Quick Start Agent Prompt

**Task:** Implement tech_stack filtering end-to-end and optional frontend filter UI. Keep changes small and fully backward-compatible.

**GitHub Issues:** [#96](https://github.com/Beaulewis1977/synthesis/issues/96), [#97](https://github.com/Beaulewis1977/synthesis/issues/97), [#98](https://github.com/Beaulewis1977/synthesis/issues/98), [#73](https://github.com/Beaulewis1977/synthesis/issues/73)  
**Milestone:** [Phase 14: Tech Stack Filtering](https://github.com/Beaulewis1977/synthesis/milestone/8)  
**Detailed Guide:** `docs/phases/phase-14/phase-14-prompts.md` (READ THIS FOR DAY-BY-DAY INSTRUCTIONS)

---

## 📚 Read in Order (BEFORE Starting)

1. `docs/phases/phase-14/00_PHASE_14_OVERVIEW.md` - Scope and objectives
2. `docs/phases/phase-14/04_BUILD_PLAN.md` - High-level plan
3. `docs/phases/phase-14/05_ACCEPTANCE_CRITERIA.md` - Success criteria
4. `docs/phases/phase-14/06_INTEGRATION_GUIDE.md` - API integration
5. **`docs/phases/phase-14/phase-14-prompts.md`** - **DETAILED DAY-BY-DAY GUIDE** ⭐
6. `docs/phases/phase-13-5/ROADMAP_PHASE_14_PLUS.md` - Context only (do NOT implement)

---

## ⚠️ CRITICAL: Parameter Naming Standard

**USE `tech_stack` (snake_case) EVERYWHERE IN BACKEND CODE**

The codebase uses **snake_case** for all parameters and database fields:
- ✅ Database: `metadata.tech_stack` (JSONB field)
- ✅ Backend API: `tech_stack` in request body and function parameters
- ✅ TypeScript interfaces: `tech_stack?: string[]`
- ✅ SQL queries: `metadata->'tech_stack'`

**Frontend can use camelCase locally, but MUST send snake_case to API:**
```typescript
// Frontend component (camelCase is fine internally)
const [selectedTechStack, setSelectedTechStack] = useState<string[]>([]);

// But API request MUST use snake_case
const body = {
  query: 'test',
  collection_id: collectionId,
  tech_stack: selectedTechStack,  // ← snake_case for API
};
```

**Why this matters:**
- Database field is `metadata.tech_stack` (already exists from Phase 13.5)
- Backend service layer uses `tech_stack` parameter
- Using `techStack` (camelCase) in backend will cause mismatches

**Verify before starting:**
```bash
# Confirm database field name
grep "tech_stack" packages/shared/src/index.ts
# Should show: tech_stack?: string[];

# Confirm Phase 13.5 uses snake_case
grep "metadata.tech_stack" apps/server/src/pipeline/code-chunker.ts
# Should find assignments to tech_stack
```

**If you see `techStack` in documentation, mentally translate to `tech_stack` for implementation.**

---

## 🎯 Objectives

**Backend (#96):** Apply `tech_stack` filter in search service (vector + hybrid paths).  
**Frontend (#97):** Add filter chips in `SearchPage`, persist in URL, send to API.  
**Docs (#98):** Add JSONB index guidance to Integration Guide.  
**Closure (#73):** Validate acceptance criteria and close Epic.

---

## ✅ Requirements Checklist

**Day 1 - Backend:**
- [ ] Pass `tech_stack` from route schema → `smartSearch(...)`
- [ ] Filter vector path by `metadata.tech_stack` (intersection)
- [ ] Filter hybrid path by `metadata.tech_stack` (before fusion/rerank)
- [ ] Keep behavior unchanged without tags
- [ ] Unit tests for vector/hybrid filtering
- [ ] Integration test (with/without tech_stack)

**Day 2 - Frontend (Optional):**
- [ ] Add multi-select chips UI in SearchPage
- [ ] Persist tags to URL (`?tech_stack=postgres&tech_stack=redis`)
- [ ] Include `tech_stack[]` in POST /api/search body
- [ ] Component tests for UI and API integration

**Day 2 - Docs:**
- [ ] Add index guidance to `06_INTEGRATION_GUIDE.md`
- [ ] Document when to apply index (>10k docs)
- [ ] Provide example SQL for GIN index
- [ ] Explain trade-offs

**Closure:**
- [ ] All acceptance criteria met
- [ ] Documentation updated
- [ ] All tests passing
- [ ] Typecheck clean

---

## 🔍 Commands

```bash
# Backend tests
pnpm --filter @synthesis/server test

# Frontend tests
pnpm --filter @synthesis/web test

# Type checking
pnpm typecheck

# Full validation
pnpm test && pnpm typecheck
```

---

## ✨ Success Criteria

- ✅ Filtering works when tags present; baseline unchanged otherwise
- ✅ Tests pass (unit + integration); typecheck clean
- ✅ Frontend UI persists tags in URL (if implemented)
- ✅ Documentation updated with index guidance
- ✅ All GitHub issues closed

---

## 📖 For Detailed Instructions

**See:** `docs/phases/phase-14/phase-14-prompts.md`

This file contains:
- Hour-by-hour breakdown
- Code examples for each task
- Validation steps
- Common pitfalls to avoid
- Help section with references


