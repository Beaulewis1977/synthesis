# Phase 14 — Issues Pack (Create-Ready)

Purpose: Single source for all Phase 14 issues. Each entry includes a title, full body, labels, and milestone. Hand this to your issue-creation agent. Do not pull Phase 14+ roadmap items into Phase 14.

Milestone: Phase 14
Labels used: phase:14, backend, frontend, docs

Pre-checks for the agent
- Ensure milestone “Phase 14” exists (create if needed).
- Ensure labels exist: phase:14, backend, frontend, docs.
- If an issue already exists with the same scope (e.g., #73 Docs & Closure), update instead of creating duplicate.

Do NOT implement (belongs to Phase 14+)
- Multi-source ingestion, Redis cache, evaluation dashboards, agentic workflows, multimodal (see docs/phases/phase-13-5/ROADMAP_PHASE_14_PLUS.md).

References for all issues
- docs/phases/phase-14/00_PHASE_14_OVERVIEW.md
- docs/phases/phase-14/04_BUILD_PLAN.md
- docs/phases/phase-14/05_ACCEPTANCE_CRITERIA.md
- docs/phases/phase-14/06_INTEGRATION_GUIDE.md
- docs/phases/phase-14/phase-14-prompts.md

---

Issue 1
Title
Phase 14: Backend — Apply tech_stack filtering (vector + hybrid)

Labels
- phase:14
- backend

Milestone
Phase 14

Body
Apply tech_stack filtering end-to-end in the backend.

Scope
- Route layer: pass validated tech_stack/techStack array to smartSearch(...).
- Vector path: filter chunks by intersection with metadata.tech_stack (apply only when tags present).
- Hybrid path: apply the same filter to candidates before fusion/rerank; behavior unchanged when tags are absent.
- Tests: add unit tests for vector/hybrid filters; add integration test that asserts narrowed results when tech_stack is provided, and baseline unchanged when it is not.

Non‑Goals
- Do not add roadmap items (queueing, caching, dashboards, multimodal).

Acceptance
- See docs/phases/phase-14/05_ACCEPTANCE_CRITERIA.md (Functional + Quality sections for backend).

Performance
- Add a note in Integration Guide for optional JSONB GIN index (no default migration in this issue).

References
- docs/phases/phase-14/00_PHASE_14_OVERVIEW.md
- docs/phases/phase-14/04_BUILD_PLAN.md
- docs/phases/phase-14/05_ACCEPTANCE_CRITERIA.md
- docs/phases/phase-14/06_INTEGRATION_GUIDE.md
- docs/phases/phase-14/phase-14-prompts.md

Tasks
- [ ] Route: plumb tech_stack to smartSearch(...)
- [ ] Vector path filter
- [ ] Hybrid path filter
- [ ] Unit tests (vector + hybrid)
- [ ] Integration test (with/without tags)

---

Issue 2
Title
Phase 14: Frontend — Optional tech_stack filter UI with URL persistence

Labels
- phase:14
- frontend

Milestone
Phase 14

Body
Provide an optional UI in SearchPage to choose tech stack filters and persist them into URL and request body.

Scope
- UI: minimal multi-select chips for common stacks (postgres, supabase, redis). A static list is sufficient.
- URL: persist tags as &tech_stack=value (allow repeats for multiple values).
- API: include tech_stack[] in POST /api/search body when any are selected.
- Tests: ensure request payload contains tags when selected; ensure URL ↔ UI state roundtrip on reload.

Non‑Goals
- Do not implement advanced filter UX (server-side filtering exists already).

Acceptance
- See docs/phases/phase-14/05_ACCEPTANCE_CRITERIA.md (Functional + Quality sections for frontend).

References
- docs/phases/phase-14/00_PHASE_14_OVERVIEW.md
- docs/phases/phase-14/04_BUILD_PLAN.md
- docs/phases/phase-14/05_ACCEPTANCE_CRITERIA.md
- docs/phases/phase-14/06_INTEGRATION_GUIDE.md
- docs/phases/phase-14/phase-14-prompts.md

Tasks
- [ ] Chips UI (SearchPage)
- [ ] URL sync (add/remove &tech_stack)
- [ ] Include tags in POST body
- [ ] Component tests

---

Issue 3
Title
Phase 14: DB/Docs — JSONB index guidance for tech_stack

Labels
- phase:14
- docs

Milestone
Phase 14

Body
Document DBA guidance for optimizing tech_stack filtering using JSONB indexes. Do not ship a default migration in this issue.

Scope
- Integration Guide: add a section describing optional JSONB GIN index for metadata.tech_stack.
- Suggest a migration filename only (e.g., packages/db/migrations/007_tech_stack_index.sql) with example index strategy; do not create/commit the migration in this issue.

Acceptance
- Integration Guide updated with clear index recommendation, caveats, and when to apply.

References
- docs/phases/phase-14/06_INTEGRATION_GUIDE.md
- docs/phases/phase-14/04_BUILD_PLAN.md

Tasks
- [ ] Write index guidance
- [ ] Example SQL snippet
- [ ] Note: apply only for large datasets or perf regressions

---

Issue 4
Title
Phase 14: Docs & Closure — Update docs and close Epic

Labels
- phase:14
- docs

Milestone
Phase 14

Body
Finalize Phase 14 documentation and close the parent Epic after acceptance. Do not expand scope beyond the tech_stack filter objectives.

Scope
- Verify Acceptance Criteria across backend/frontend tasks.
- Update Phase 14 docs if small deltas were required during implementation.
- Close the Phase 14 Epic once validated and approved.

Acceptance
- All Phase 14 AC pass; documentation updated; Epic closed.

References
- docs/phases/phase-14/00_PHASE_14_OVERVIEW.md
- docs/phases/phase-14/04_BUILD_PLAN.md
- docs/phases/phase-14/05_ACCEPTANCE_CRITERIA.md
- docs/phases/phase-14/06_INTEGRATION_GUIDE.md
- docs/phases/phase-14/phase-14-prompts.md

Tasks
- [ ] Validate AC (backend/frontend)
- [ ] Update docs if needed
- [ ] Close Epic after approval

---

Agent notes
- If any issue already exists (e.g., a prior #73 for Docs & Closure), update the existing issue title/body/labels/milestone instead of creating duplicates.
- Keep all Phase 14 issues tightly scoped to tech_stack filter work. Defer anything else to Phase 14+.
*** End Patch

