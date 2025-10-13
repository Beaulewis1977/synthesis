# Phase Renumbering Fix Plan & Checklists (Phases 9–14)

**Date:** 2025-10-13
**Owner:** Project Maintainer / Docs Agent
**Objective:** Eliminate confusion from renumbering, align all docs/issues, and ensure planning docs for phases 9–14 are complete and agent-safe.

---

## Decisions & Scope

- **Historical issues:** Keep closed MVP issues with their original phase numbers to preserve history. Do not rename/relabel closed items.
- **Clarifying comments:** Add a standard comment to closed issues that are likely to be referenced by agents, explaining the renumbering and pointing to new docs.
- **Planning completeness (9–14):**
  - Phase 9 (MVP Final Testing): remains in `docs/09_BUILD_PLAN.md` and related MVP docs. Ensure unchanged.
  - Phases 11–13 (v2.0 advanced features): docs are present and mostly complete.
  - Phase 14 (Integration & Polish): create new planning docs (missing).

---

## A) Documentation Fixes (Checklists)

### A1. Overview prerequisites/enables
- [ ] Update `docs/phases/phase-12/00_PHASE_12_OVERVIEW.md`
  - **Change:** `Prerequisites: Phase 8 (Hybrid Search) Complete` → `Prerequisites: Phase 11 (Hybrid Search) Complete`
  - **Confirm:** "Enables: Phase 13" is stated as the next dependent phase.
- [ ] Update `docs/phases/phase-13/00_PHASE_13_OVERVIEW.md`
  - **Change:** `Prerequisites: Phase 8 & 9 Complete` → `Prerequisites: Phases 11 & 12 Complete`

### A2. Summary / index documents
- [ ] `docs/phases/PHASES_11-15_SUMMARY.md`
  - **Fix paths:** Replace `docs/phases/phase-9/` → `docs/phases/phase-12/`; `docs/phases/phase-10/` → `docs/phases/phase-13/`.
  - **Consistency:** Ensure the status section matches directory reality (Phases 11–13 are complete).
- [ ] `docs/phases/README.md`
  - **Title/refs:** Replace `PHASES_8-10_SUMMARY.md` → `PHASES_11-15_SUMMARY.md`.
  - **Links:** Replace `00_PHASE_8/9/10_OVERVIEW.md` → `00_PHASE_11/12/13_OVERVIEW.md`.
  - **Disclaimer:** Add a short note that MVP Phase 9 remains unchanged; advanced phases are 11–15.
- [ ] `docs/phases/DOCUMENTATION_COMPLETE.md`
  - **File name refs:** Replace `PHASES_8-10_SUMMARY.md` → `PHASES_11-15_SUMMARY.md`.
  - **Overview files:** Replace `00_PHASE_8/9/10_OVERVIEW.md` → `00_PHASE_11/12/13_OVERVIEW.md`.
  - **Guidance:** Ensure it says "Complete Phases 11 & 12 first" where relevant.
- [ ] `docs/phases/IMPLEMENTATION_ROADMAP.md`
  - **Title:** `Phases 8-10` → `Phases 11-13`.
  - **Cross-refs:** `Foundation for Phases 9 & 10` → `Foundation for Phases 12 & 13`.
- [ ] `docs/phases/DETAILED_DOCS_REFERENCE.md`
  - **Header:** `Phase 11-10` → `Phase 11-15`.
  - **Filenames:** Replace `00_PHASE_8/9/10_OVERVIEW.md` → `00_PHASE_11/12/13_OVERVIEW.md`.
  - **Guidance:** `Complete Phases 8 & 9 first` → `Complete Phases 11 & 12 first`.

### A3. Frontend updates doc cross-refs
- [ ] `docs/phases/phase-11/09_FRONTEND_UPDATES.md`
  - **Internal ref:** Any `00_PHASE_8_OVERVIEW.md` mention → `00_PHASE_11_OVERVIEW.md`.

### A4. Cleanup/archival (non-destructive)
- [ ] Archive (not delete) `docs/PHASE_RENUMBERING_PLAN.md` to `docs/archive/` when all changes complete.
- [ ] Remove `PHASE_DOCS_UPDATE_PLAN.md` after confirming it’s executed/obsolete.
- [ ] Remove `SUMMARY_DOCS_UPDATE_PLAN.md` once A1–A3 are verified.
- [ ] Rename or archive root `PHASE_8_SUMMARY.md` → `PHASE_11_SUMMARY.md`.
- [ ] Verify MVP docs unchanged:
  - `docs/09_BUILD_PLAN.md` still contains MVP Phase 8–9 as originally planned.

---

## B) GitHub Issues Alignment (Checklists)

### B1. Fix links in open issues (labels/milestones already OK)
- [ ] `#61` (Phase 12 epic): link to `docs/phases/phase-12/00_PHASE_12_OVERVIEW.md` (was `phase-9/00_PHASE_9_OVERVIEW.md`).
- [ ] `#64` (Phase 12 frontend): link to `docs/phases/phase-12/08_FRONTEND_UPDATES.md` (was `phase-9/08_FRONTEND_UPDATES.md`).
- [ ] `#62` (Phase 13 epic): link to `docs/phases/phase-13/00_PHASE_13_OVERVIEW.md` (was `phase-10/00_PHASE_10_OVERVIEW.md`).
- [ ] `#65` (Phase 13 frontend): link to `docs/phases/phase-13/06_FRONTEND_UPDATES.md` (was `phase-10/06_FRONTEND_UPDATES.md`).
- [ ] Optional: `#63` (Phase 11 frontend, closed) → consider comment noting doc moved to `phase-11/09_FRONTEND_UPDATES.md`.

### B2. Comment template for closed MVP issues
Add this comment to any closed issues that may be referenced by agents:
```
📝 Phase Renumbering Note

The advanced feature phases have been renumbered to avoid conflicts with MVP phases:
- Phase 8 → Phase 11 (Hybrid Search)
- Phase 9 → Phase 12 (Re-ranking & Synthesis)
- Phase 10 → Phase 13 (Code Intelligence)

MVP phases remain: Phase 8 = Polish + Documentation, Phase 9 = Final Testing.
See updated docs in `docs/phases/` and the renumbering audit.
```

---

## C) Create Phase 14 Planning Docs (New)

Create `docs/phases/phase-14/` with:
- [ ] `00_PHASE_14_OVERVIEW.md` — Goals, metrics, integration scope (Phases 11–13 working together)
- [ ] `01_INTEGRATION_TESTING.md` — E2E interactions with hybrid + rerank + code intelligence
- [ ] `02_PERFORMANCE_OPTIMIZATION.md` — <600ms end-to-end targets at full scale
- [ ] `03_UI_UPDATES.md` — Expose trust badges, synthesis view, related files polish
- [ ] `04_BUILD_PLAN.md` — 2–3 day plan, dependencies, risks
- [ ] `05_ACCEPTANCE_CRITERIA.md` — Production readiness checklist

Optional: add `phase-15/` after 14 completes.

---

## D) Verification (Agent-Safe)

After the fixes:
- [ ] Search for old phase numbers in advanced docs (`phase-11`..`phase-13`), excluding MVP references:
  - `grep -r "Phase 8:\|Phase 9:\|Phase 10:" docs/phases/phase-1[1-5]/`
- [ ] Confirm summary docs use `PHASES_11-15_SUMMARY.md` and correct overview filenames.
- [ ] Confirm `docs/phases/PHASES_11-15_SUMMARY.md` paths point to `phase-11/12/13`.
- [ ] Confirm `docs/09_BUILD_PLAN.md` unchanged.
- [ ] Confirm GitHub issues #61/#62/#64/#65 bodies link to `phase-12/` and `phase-13/`.

---

## E) Rollout Strategy

1) Apply documentation fixes (A1–A3).
2) Update GitHub issues links and add clarifying comments (B1–B2).
3) Create Phase 14 planning docs (C).
4) Perform verification (D).
5) Archive/cleanup artifacts (A4).

---

## F) Effort & Ownership

- Docs fixes: ~30–45 mins.
- GitHub issues updates: ~10–15 mins.
- Phase 14 docs scaffolding: ~30–45 mins (skeletons; full content 1–2 hrs).

---

## G) Risks & Mitigation

- **Risk:** Missed stale references in non-phase docs.
  - **Mitigation:** Repo-wide search for `phase-9/` & `phase-10/` paths; review root README if phases are mentioned.
- **Risk:** Agents reading closed issues get confused.
  - **Mitigation:** Add clarifying comments and ensure `docs/phases/README.md` carries the renumbering disclaimer.

---

## H) Approvals

- Proceed with executing A–D after owner approval.
- Archive in A4 only after verification completes.

---

## I) Quick Execution Script (Optional, for maintainers)

These are suggested commands (do not run automatically):
```bash
# Fix summary/index occurrences (examples; verify before running)
sed -i 's/PHASES_8-10_SUMMARY/PHASES_11-15_SUMMARY/g' docs/phases/README.md docs/phases/DOCUMENTATION_COMPLETE.md
sed -i 's/00_PHASE_8_OVERVIEW/00_PHASE_11_OVERVIEW/g' docs/phases/*.md
sed -i 's/00_PHASE_9_OVERVIEW/00_PHASE_12_OVERVIEW/g' docs/phases/*.md
sed -i 's/00_PHASE_10_OVERVIEW/00_PHASE_13_OVERVIEW/g' docs/phases/*.md
sed -i 's#docs/phases/phase-9/#docs/phases/phase-12/#g' docs/phases/PHASES_11-15_SUMMARY.md
sed -i 's#docs/phases/phase-10/#docs/phases/phase-13/#g' docs/phases/PHASES_11-15_SUMMARY.md

# Targeted overview prerequisite fixes
sed -i 's/Prerequisites: Phase 8/Prerequisites: Phase 11/' docs/phases/phase-12/00_PHASE_12_OVERVIEW.md
sed -i 's/Prerequisites: Phase 8 \& 9/Prerequisites: Phases 11 \& 12/' docs/phases/phase-13/00_PHASE_13_OVERVIEW.md
```

---

## J) References

- Renumbering plan: `docs/PHASE_RENUMBERING_PLAN.md`
- Audit (problems): `audit-reports/PHASES_11-15_RENUMBERING_AUDIT.md`
- This plan (fixes): `audit-reports/PHASES_11-15_RENUMBERING_FIX_PLAN.md`
