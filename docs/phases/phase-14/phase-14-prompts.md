# Phase 14 Agent Prompts (Single Source of Truth)

Goal: Implement tech_stack filtering end-to-end (backend) and an optional frontend filter UI, without expanding scope beyond Phase 14. Larger items remain in Phase 14+ roadmap.

Read in order
1) docs/phases/phase-14/00_PHASE_14_OVERVIEW.md
2) docs/phases/phase-14/04_BUILD_PLAN.md
3) docs/phases/phase-14/05_ACCEPTANCE_CRITERIA.md
4) docs/phases/phase-14/06_INTEGRATION_GUIDE.md
5) docs/phases/phase-13-5/ROADMAP_PHASE_14_PLUS.md (context only; do NOT implement)

Do NOT implement
- Multi-source ingestion, Redis cache, evaluation dashboards, agentic workflows, multimodal (see Phase 14+ roadmap).

Branch
- feature/phase-14-tech-stack

Backend tasks (must)
1) Wire tech_stack through API
   - File: apps/server/src/routes/search.ts
   - Pass validated tech_stack/techStack to smartSearch(...)
2) Apply filtering in service
   - File: apps/server/src/services/search.ts
   - Hybrid path: restrict candidates/results to chunks whose metadata.tech_stack intersects the provided tags (before fusion/rerank)
3) Apply filtering in vector path
   - File: apps/server/src/services/vector.ts
   - Add WHERE clause filtering on metadata.tech_stack (JSONB), only when tags present
4) Tests
   - Add unit tests for vector + hybrid filters
   - Integration test: include tech_stack, assert narrowed results; no filter → unchanged

Frontend tasks (optional but recommended)
1) SearchPage filter chips
   - File: apps/web/src/pages/SearchPage.tsx
   - Add minimal multi-select chips: postgres, supabase, redis (static list is fine)
   - Persist to URL: &tech_stack=postgres&tech_stack=redis
   - Include tech_stack[] in search POST body when selected
2) Tests
   - Assert payload contains tags when selected
   - URL ↔ UI state roundtrip

Performance & DBA notes
- Provide guidance (docs only) for a JSONB GIN index on metadata.tech_stack
- Do NOT add a migration by default; document a suggested filename only (packages/db/migrations/007_tech_stack_index.sql)

Verification checklist (must pass)
- Filtering works when tags present; baseline unchanged otherwise
- Unit + integration tests pass (server); typecheck clean; lint clean
- Optional UI: tags persist in URL and POST body

Commands
```bash
pnpm --filter @synthesis/server test
pnpm typecheck
pnpm --filter @synthesis/web test
```

PR template bullets
- Implemented backend tech_stack filtering (vector + hybrid)
- Optional frontend filter UI with URL persistence
- No changes when tags not supplied
- Tests updated; typecheck/lint clean
- Docs updated (integration guide, acceptance criteria)

Safeguards
- Keep scope to tech_stack filter only
- Avoid modifying Phase 14+ roadmap items
- Maintain backward compatibility (filter only when tags provided)


