# Phase 14 - Agent Prompt

Task: Implement tech stack filtering end-to-end and optional frontend filter UI. Keep changes small and fully backward-compatible.

Read in order:
1. `docs/phases/phase-14/00_PHASE_14_OVERVIEW.md`
2. `docs/phases/phase-14/04_BUILD_PLAN.md`
3. `docs/phases/phase-14/05_ACCEPTANCE_CRITERIA.md`
4. `docs/phases/phase-14/06_INTEGRATION_GUIDE.md`
5. `docs/phases/phase-13-5/ROADMAP_PHASE_14_PLUS.md` (context only; do NOT implement roadmap items)

---

Objectives
- Backend: Apply `tech_stack` filter in search service (vector + hybrid paths).
- Frontend (optional): Add filter chips in `SearchPage`, persist in URL, send to API.
- Docs: Update integration guide and acceptance.

---

Requirements Checklist
- [ ] Pass `tech_stack` from route schema → `smartSearch(...)`
- [ ] Filter vector/hybrid paths by `metadata.tech_stack` (intersection)
- [ ] Keep behavior unchanged without tags
- [ ] Tests: unit + integration
- [ ] Docs updated; prompt and build plan followed

---

Commands
```bash
pnpm --filter @synthesis/server test
pnpm typecheck
pnpm --filter @synthesis/web test
```

---

Success Criteria
- Filtering works when tags present; baseline unchanged otherwise
- Tests pass; typecheck clean
- Documentation updated


