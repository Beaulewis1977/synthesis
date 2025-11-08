## Phase 13.5: Build Plan

Feature‑flagged follow‑on to Phase 13. Ship safely without touching existing flows.

---

### Prereqs
- Phase 13 complete and validated on real repos
- Flags default off

---

### Tasks
1) Scaffolding
   - Create parsers: `sql-analyzer.ts`, `config-analyzer.ts`
   - Create `tech-detector.ts`
   - Wire flags: `BACKEND_PARSING`, `TECH_STACK_TAGS`

2) Router Integration
   - Update chunker orchestration to route:
     - `.sql` → SQL parser (when enabled)
     - `.yaml/.yml/.json` → Config parser (when enabled)
     - Others → existing logic
   - On error → fallback to simple chunking

3) SQL Parser Implementation
   - Extract tables/columns/constraints/indexes/FKs
   - Compute line ranges and human‑readable chunks

4) Config Parser Implementation
   - Extract top‑level sections and nested key paths
   - Create section‑sized chunks

5) Tech Stack Tagging
   - Heuristics for flutter/supabase/redis
   - Attach to chunk metadata when enabled

6) Light Cross‑Tech Links (optional)
   - If Phase 13 relationships exist, emit minimal edges
   - Else store hints in metadata only

7) Tests & Validation
   - Unit tests on fixtures
   - E2E ingest+search on small combined corpus:
     - Supabase schema
     - Config files
     - Flutter client
   - Verify flags off → no behavior change

---

### Commands (illustrative)
```bash
# run server tests
pnpm --filter @synthesis/server test

# typecheck, lint
pnpm --filter @synthesis/server typecheck
pnpm lint
```

---

### Acceptance Gates
- See 05_ACCEPTANCE_CRITERIA.md


