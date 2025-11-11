## Phase 14: Tech Stack Search Filter & Post-13.5 Enhancements

Status: Planning  
Scope: 1-2 days (focused follow-up to Phase 13.5)  
Pre-reqs: Phase 13.5 complete; feature flags stable

---

### Executive Summary
Wire the backend tech stack filter end-to-end and provide an optional frontend filter UI. This completes the only known limitation left from Phase 13.5 while keeping changes small, fully backward-compatible, and feature-flag friendly. Larger roadmap items remain in Phase 14+ (see `docs/phases/phase-13-5/ROADMAP_PHASE_14_PLUS.md`).

---

### Objectives
- Backend: Apply `tech_stack` filtering in search service.
- Frontend: Optional multi-select UI for tech stack chips; persist via URL.
- Performance: Add JSONB index guidance for `tech_stack` if needed.
- Documentation: Update API usage and user flow.
- Close Epic parent after verification.

---

### What We’re Not Doing (defer to Phase 14+)
- Multi-source ingestion and worker queueing
- Visual dependency graphs
- Advanced evaluation dashboards and multimodal ingestion

---

### Deliverables
- Backend: Filter support in `smartSearch` (and underlying search), tests
- Frontend: Filter UI and URL integration, tests
- Docs: Build plan, integration guide, acceptance criteria, agent prompt
- Optional: DB index migration file instructions (only if needed)

---

### Success Criteria (High-level)
- Passing `tech_stack` filters search results server-side
- UI can send and persist `tech_stack` filters
- All existing behavior unchanged when filters are not provided
- Tests passing; typecheck clean; no perf regressions


