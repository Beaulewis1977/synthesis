## Phase 14: Tech Stack Search Filter & Post-13.5 Enhancements

**Status:** Ready to implement  
**Scope:** 1-2 days (focused follow-up to Phase 13.5)  
**Pre-reqs:** Phase 13.5 complete; feature flags stable  
**GitHub Issues:** [#96](https://github.com/Beaulewis1977/synthesis/issues/96), [#97](https://github.com/Beaulewis1977/synthesis/issues/97), [#98](https://github.com/Beaulewis1977/synthesis/issues/98), [#73](https://github.com/Beaulewis1977/synthesis/issues/73)  
**Milestone:** [Phase 14: Tech Stack Filtering](https://github.com/Beaulewis1977/synthesis/milestone/8)

---

### Prerequisites & Infrastructure

**Phase 13.5 MUST be complete before starting Phase 14.**

Phase 13.5 (Backend Parsing & Tagging) already implements:
- ✅ `tech_stack` metadata field in `ChunkMetadata` interface (`packages/shared/src/index.ts:85`)
- ✅ `detectTechStack()` function that populates tech_stack during ingestion
- ✅ `TECH_STACK_TAGS` feature flag to enable/disable tagging
- ✅ Tech stack detection for SQL, YAML, and JSON files

**What Phase 14 adds:**
- Filtering capability in search endpoints (vector + hybrid)
- Frontend UI for tag selection
- Performance optimization guidance

**Verification before starting:**
```bash
# Verify Phase 13.5 is complete
grep "tech_stack" packages/shared/src/index.ts
# Should show: tech_stack?: string[];

# Verify feature flag exists
grep "TECH_STACK_TAGS" apps/server/src/pipeline/code-chunker.ts
# Should find multiple references

# Verify detectTechStack function exists
grep "detectTechStack" apps/server/src/services/tech-detector.ts
# Should find the function definition
```

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


