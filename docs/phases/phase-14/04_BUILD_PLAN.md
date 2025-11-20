# Phase 14: Build Plan

**Duration:** 1–2 days  
**Focus:** Backend tech_stack filtering + optional frontend filter UI  
**Note:** Keep consistent with Phase 13/13.5 docs and defer Phase 14+ items to roadmap  
**Issues:** [#96](https://github.com/Beaulewis1977/synthesis/issues/96), [#97](https://github.com/Beaulewis1977/synthesis/issues/97), [#98](https://github.com/Beaulewis1977/synthesis/issues/98), [#73](https://github.com/Beaulewis1977/synthesis/issues/73)

---

## Day 1 — Backend (Filtering & Tests)

**GitHub Issue:** [#96 - Backend: Apply tech_stack filtering (vector + hybrid)](https://github.com/Beaulewis1977/synthesis/issues/96)  
**Time:** 4-6 hours  
**Priority:** HIGH

1) Search API wiring  
- File: `apps/server/src/routes/search.ts`  
- Pass validated `tech_stack`/`techStack` to `smartSearch(...)`.

2) Search service filter  
- File: `apps/server/src/services/search.ts` (smartSearch + vector/hybrid path)  
- Add optional filter step so only chunks with `metadata->'tech_stack'` containing any of the provided tags are considered.  
- Hybrid path: apply filter when fetching candidates or immediately after, before fusion/rerank.

3) SQL filter (vector path)  
- File: `apps/server/src/services/vector.ts`  
- Add WHERE clause to filter by `ch.metadata->'tech_stack'` (JSONB).  
- Example approach (pseudo): `WHERE ($5 IS NULL OR ch.metadata ?| $5)` using an array parameter OR use `jsonb_exists_any(ch.metadata->'tech_stack', $5::text[])`. Ensure safety and compatibility with current schema.

4) Performance guidance  
- Add DBA note to create an index for `tech_stack` lookup when needed:
  - Migration (suggested): `packages/db/migrations/007_tech_stack_index.sql`
  - Example index (document-only in this phase): GIN index on `metadata` or a computed index on `metadata->'tech_stack'`.

5) Tests  
- Unit tests: filtering logic (vector/hybrid).  
- Integration: pass `tech_stack` and assert narrowed results.

---

## Day 2 — Frontend (Optional Filter UI) & Docs

### Morning: Frontend UI (Optional but Recommended)

**GitHub Issue:** [#97 - Frontend: Optional tech_stack filter UI with URL persistence](https://github.com/Beaulewis1977/synthesis/issues/97)  
**Time:** 2-3 hours  
**Priority:** MEDIUM

1) Frontend UI  
- File: `apps/web/src/pages/SearchPage.tsx`  
- Add minimal multi-select chips (e.g., postgres, supabase, redis).  
- Persist selected tags to URL (`&tech_stack=postgres&tech_stack=redis`).  
- Include `tech_stack` array in search POST body when present.

2) Frontend tests  
- Ensure request payload includes tags when selected.  
- Verify URL state → UI state on reload.

### Afternoon: Documentation & Closure

**GitHub Issue:** [#98 - DB/Docs: JSONB index guidance for tech_stack](https://github.com/Beaulewis1977/synthesis/issues/98)  
**Time:** 1 hour  
**Priority:** LOW

3) Documentation  
- Update Integration Guide (this phase) with JSONB index guidance.  
- Add example SQL for GIN index creation.  
- Document when to apply (>10k documents).  
- Explain trade-offs (write performance vs read performance).

**GitHub Issue:** [#73 - Docs & Closure: Update docs and close Epic](https://github.com/Beaulewis1977/synthesis/issues/73)  
**Time:** <1 hour  
**Priority:** HIGH

4) Final Validation  
- Verify all acceptance criteria met.  
- Update any documentation deltas found during implementation.  
- Close Phase 14 Epic after approval.

---

## Commands

```bash
# Run server tests
pnpm --filter @synthesis/server test

# Typecheck
pnpm typecheck

# Web tests (if filter UI added)
pnpm --filter @synthesis/web test
```

---

## Risks & Mitigations
- JSONB filtering performance: mitigate with GIN index if necessary.
- Backward compatibility: filter applied only when param provided.
- UI complexity: keep optional and minimal; use chips and querystring.


