# Phase 5.4 Recovery Plan (Codex)

Single source plan for completing the missing Phase 5 frontend upload work and fixing the mismatched GitHub issue states. No code changes should be attempted until this plan is approved.

---

## 1. Situation Overview
- Phase 5 frontend epic (#30) and story issues (#31, #33) were closed although upload functionality, collection creation UI, and the `/upload/:collectionId` route were never delivered (`GITHUB_ISSUES_AUDIT.md`).
- Duplicate issue copies (#16, #18, #19, #20) and later-phase duplicates clutter tracking and hide the real completion state.
- Documentation already outlines the intended upload UX and the backlog corrections required (`PHASE_5.4_README.md`, `PHASE_5.4_UPLOAD_PROMPT.md`).

Key Goal: deliver the upload experience and reconcile GitHub issue statuses without touching feature code yet.

---

## 2. Required References Before Implementation
- `PHASE_5.4_README.md` — high-level recap of missing pieces and Definition of Done.
- `PHASE_5.4_UPLOAD_PROMPT.md` — detailed agent instructions, API references, testing checklist.
- Phase summaries: `PHASE_5.1_SUMMARY.md`, `PHASE_5.2_SUMMARY.md`, `PHASE_5.3_SUMMARY.md`.
- `docs/08_UI_SPEC.md` — UI flows for upload/chat pages.
- `docs/09_BUILD_PLAN.md` (lines 265-300) — Phase 5 day plan.
- `docs/05_API_SPEC.md` — especially the `POST /api/ingest` endpoint.
- `docs/14_GITHUB_ISSUES.md` (lines 500-512) — story 5.3 task list.
- Audit log: `GITHUB_ISSUES_AUDIT.md`.

---

## 3. GitHub Issues to Inspect First
- #30 — Phase 5 epic (closed prematurely).
- #31 — Setup React app with routing (missing `/upload/:collectionId`).
- #33 — Build Upload and Chat pages (chat delivered, upload missing).
- #16/#18/#19/#20 — duplicates of the above that need closure comments.
- Optional cross-check: #32 (dashboard), #34+ for later phases to ensure no further dependencies.

Review timeline/comment history for each to gather closure reasoning before reopening or updating.

---

## 4. Workstreams & Steps

### A. Issue Hygiene & Tracking Cleanup
1. Draft reopening comments summarising remaining acceptance criteria for #30, #31, #33.
2. Reopen the three canonical issues; link them to a new clean-up ticket (see Workstream B).
3. For each duplicate (#16, #18, #19, #20), add a closure comment referencing the canonical issue and explaining the duplication, then keep them closed.
4. Create a new issue “Phase 5.4 – Complete Upload Functionality” that:
   - References audit findings.
   - Lists the missing tasks (mirroring Section 5 below).
   - Blocks the reopened issues until completed.
5. Adopt an issue-closing checklist template (comment or form) to prevent premature closures going forward.

### B. Phase 5.4 Upload Implementation Plan (No coding yet)
1. Confirm design specs and API behavior using the references in Section 2.
2. Prepare task breakdown for:
   - `UploadZone.tsx` drag/drop + picker UI with progress indicators.
   - `UploadPage.tsx` composition, state management, and navigation guard.
   - Route addition in `App.tsx` for `/upload/:collectionId`.
   - Wiring `CollectionView` upload CTA to navigate to the new page.
   - API client method `uploadDocument` (including progress handling) and supporting TypeScript types.
3. Define testing steps:
   - Manual scenario walkthrough (navigation, picker, drag/drop, progress success/error).
   - Any unit/component tests deemed necessary.
4. Outline rollout tasks:
   - Create implementation branch off `develop` per `GIT_WORKFLOW_PHASE_5.4.md`.
   - Execute coding, linting, and manual verification.
   - Document results in `PHASE_5.4_SUMMARY.md`.
   - Prepare PR with evidence (screenshots or video recommended).

### C. Communication & Sign-off
1. Share this plan for approval with stakeholders.
2. Once approved, schedule implementation window and assign ownership (who handles coding vs. GitHub admin updates).
3. During implementation, provide progress updates referencing reopened issues.

---

## 5. Detailed Task Checklist for Phase 5.4 Issue

The single source of truth for all implementation tasks, including file names, code changes, acceptance criteria, and testing checklists, is located in the main agent prompt:
- **`PHASE_5.4_UPLOAD_PROMPT.md`**

This `PLAN_CODEX` serves as the strategic overview, while the prompt contains the direct, actionable instructions for the development agent.

---

## 6. Risks & Mitigations
- **Unclear backend expectations** → Mitigation: review `docs/05_API_SPEC.md` and confirm any backend assumptions before coding.
- **Regression in existing UI** → Mitigation: reuse existing design tokens/components; run smoke tests on dashboard/chat.
- **Issue tracking relapse** → Mitigation: enforce new closure checklist and regular audit of milestone burndown.

---

## 7. Out of Scope for Phase 5.4
- Backend API changes beyond what the upload client already assumes.
- Phase 6/7 tasks (MCP, Docker) and their duplicate cleanups unless they block Phase 5.4.
- Any refactors unrelated to enabling upload page functionality.

---

**Next Step:** Await approval or requested revisions to this document. Once confirmed, proceed with Workstream A (issue hygiene) followed by scheduling Workstream B implementation.
