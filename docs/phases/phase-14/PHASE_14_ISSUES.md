# Phase 14 — Issues

Note: Follow existing repo style; numbers are placeholders until created in GitHub.

---

## Issue: Backend — Apply tech_stack filter in search
Description: Wire the validated `tech_stack` array from the route into `smartSearch`, and filter results in vector/hybrid paths.
Files:
- `apps/server/src/routes/search.ts` (pass through to service)
- `apps/server/src/services/search.ts` (plumb parameter; apply in hybrid)
- `apps/server/src/services/vector.ts` (WHERE filter on `metadata.tech_stack`)
Tests:
- Add unit tests for vector/hybrid filtering
- Update integration test to assert narrowed results when tags present
Acceptance:
- Filtering works; no change when tags absent

---

## Issue: Frontend — Optional tech_stack filter UI
Description: Provide multi-select chips for common stacks and persist selections via URL; include tags in POST body.
Files:
- `apps/web/src/pages/SearchPage.tsx`
Tests:
- Request contains `tech_stack[]` when selected
- URL state ↔ UI state roundtrip
Acceptance:
- UI optional; no impact when unused

---

## Issue: DB — JSONB index guidance (docs)
Description: Provide DBA guidance and a migration filename convention for indexing `metadata.tech_stack` (no immediate migration required).
Docs:
- `docs/phases/phase-14/06_INTEGRATION_GUIDE.md` (index note)
- Suggested migration: `packages/db/migrations/007_tech_stack_index.sql`
Acceptance:
- Guidance documented; performance note included

---

## Issue: Docs & Closure
Description: Update Phase 14 docs after implementation and close the parent Epic upon approval.
Files:
- `docs/phases/phase-14/*` (update as implemented)
Acceptance:
- Docs reflect implemented behavior
- Epic closed post-approval


