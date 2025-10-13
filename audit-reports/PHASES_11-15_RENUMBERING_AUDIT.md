# Phases 11–15 Renumbering Audit (for Agents working next phases)

**Date:** 2025-10-13
**Scope:** Validate renumbering and planning consistency so agents do not get confused or break workflows.

---

## Context & Mapping

- MVP phases remain: Phase 1–7 core, Phase 8 = Polish + Docs, Phase 9 = Final Testing.
- Advanced features renumbered to: Phase 11–15.
  - Old advanced 8 → 11 (Hybrid Search)
  - Old advanced 9 → 12 (Re-ranking & Synthesis)
  - Old advanced 10 → 13 (Code Intelligence)
  - New: 14 (Integration & Polish), 15 (Final Testing & v2.0)
- Goal: Ensure planning docs for “phases 9–14” are complete without ambiguity:
  - MVP Phase 9 remains as-is (unchanged).
  - Advanced v2.0 phases to validate: 11, 12, 13, and create 14.

---

## High-Risk Confusion Points

- **[prereq-mismatch]** Wrong prerequisites inside overviews:
  - `docs/phases/phase-12/00_PHASE_12_OVERVIEW.md` → shows "Prerequisites: Phase 8"; should be Phase 11.
  - `docs/phases/phase-13/00_PHASE_13_OVERVIEW.md` → shows "Prerequisites: Phase 8 & 9"; should be Phases 11 & 12.

- **[summary-outdated]** Summary/index docs still reference old phase numbers, directories, or filenames:
  - `docs/phases/PHASES_11-15_SUMMARY.md` → lists Phase 12 under `docs/phases/phase-9/` and Phase 13 under `docs/phases/phase-10/`.
  - `docs/phases/README.md` → titled "Phases 8-10 Documentation Index" and references `PHASES_8-10_SUMMARY.md` + old `00_PHASE_8/9/10_OVERVIEW.md` names.
  - `docs/phases/DOCUMENTATION_COMPLETE.md` → references `PHASES_8-10_SUMMARY.md` and old overview filenames.
  - `docs/phases/IMPLEMENTATION_ROADMAP.md` → mixed usage: title "Phases 8-10" and text "Foundation for Phases 9 & 10" while other sections correctly use 11/12/13.
  - `docs/phases/DETAILED_DOCS_REFERENCE.md` → intro says "Phase 11-10"; references old `00_PHASE_8/9/10_OVERVIEW.md` and says "Complete Phases 8 & 9 first" for starting Phase 13.

- **[issue-links]** GitHub issue bodies point to old doc paths:
  - `#61` (Phase 12 epic) → links `docs/phases/phase-9/00_PHASE_9_OVERVIEW.md` (should be `phase-12/00_PHASE_12_OVERVIEW.md`).
  - `#64` (Phase 12 frontend) → links `docs/phases/phase-9/08_FRONTEND_UPDATES.md` (should be `phase-12/08_FRONTEND_UPDATES.md`).
  - `#62` (Phase 13 epic) → links `docs/phases/phase-10/00_PHASE_10_OVERVIEW.md` (should be `phase-13/00_PHASE_13_OVERVIEW.md`).
  - `#65` (Phase 13 frontend) → links `docs/phases/phase-10/06_FRONTEND_UPDATES.md` (should be `phase-13/06_FRONTEND_UPDATES.md`).
  - `#63` (Phase 11 frontend, closed) → links `docs/phases/phase-8/09_FRONTEND_UPDATES.md` (should be `phase-11/09_FRONTEND_UPDATES.md`).

- **[artifact-cleanup]** Outdated planning artifacts:
  - `PHASE_DOCS_UPDATE_PLAN.md` → appears completed; safe to archive/delete after confirming.
  - `SUMMARY_DOCS_UPDATE_PLAN.md` → describes pending summary updates (still needed).
  - `docs/PHASE_RENUMBERING_PLAN.md` → can be archived for history after completion.
  - Root `PHASE_8_SUMMARY.md` → recommended to rename to `PHASE_11_SUMMARY.md` or archive to avoid confusion.

- **[phase-14-missing]** Phase 14 planning docs not present:
  - No `docs/phases/phase-14/` directory yet. Renumbering plan expects 14 (Integration & Polish) + 15 (Final Testing) to be created later.

---

## What Is Already Consistent

- `docs/phases/phase-12/` and `docs/phases/phase-13/` contents are internally consistent (no stray "Phase 9" or "Phase 10" inside those directories).
- `docs/phases/phase-11/` exists and is complete for Hybrid Search.
- GitHub labels and milestone for issues 61–65 align with phases 11–13.

---

## Recommendation for Closed Historical Issues

- Keep closed MVP issues with their original numbers to preserve history.
- Add a single clarifying comment on relevant closed issues referencing the renumbering mapping and the new doc locations.
- Maintain a central renumbering note in `docs/phases/README.md` and/or a dedicated `docs/RENUMBERING_README.md` section.

---

## Agent-Safety Notes (to prevent confusion)

- Treat `PHASES_11-15_SUMMARY.md` as the authoritative index after it’s corrected.
- Overviews must have correct prerequisites/enables:
  - Phase 12 prereq = Phase 11; Phase 12 enables Phase 13.
  - Phase 13 prereq = Phases 11 & 12.
- Frontend updates docs should match their phase directories (e.g., `phase-12/08_FRONTEND_UPDATES.md`, `phase-13/06_FRONTEND_UPDATES.md`).
- Ensure a prominent disclaimer in `docs/phases/README.md` that MVP Phase 9 remains unchanged; advanced features are 11–15.
