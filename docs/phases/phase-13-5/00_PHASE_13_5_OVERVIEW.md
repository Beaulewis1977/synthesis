## Phase 13.5: Backend Parsing & Tagging — Overview

Version: 1.0  
Status: Planning (feature-flagged)  
Prerequisites: Phase 13 complete and validated

---

### Executive Summary
Add backend-aware parsing and tagging so retrieval works end-to-end for Flutter + Supabase/Postgres + Redis SaaS stacks. This extends code intelligence beyond Dart/TypeScript to SQL migrations/schemas and YAML/JSON configs, improving precision and “ready-to-use” snippets, while remaining fully backward compatible via feature flags.

---

### Goals
- Precisely extract backend structures:
  - SQL DDL: tables, columns, constraints, indexes, foreign keys
  - Configs (YAML/JSON): top-level sections, nested keys, critical runtime settings
- Add `tech_stack` metadata tags (e.g., ["flutter","supabase","redis"]) for filtered retrieval
- Create light cross‑tech links (e.g., table ↔ model) with minimal heuristics
- Keep simple chunking as fallback; never destabilize existing flows

---

### Success Metrics
- Retrieval quality
  - Query success for schema/config questions improves (qualitative manual checks)
  - Exact-match precision for table/column/config key lookups increases
- Usability
  - Copy‑pasteable SQL/Config chunks with accurate line ranges
  - Filtered searches by `tech_stack` return correct scopes
- Safety & performance
  - Feature flags default off; no regressions when disabled
  - Typical parse time < 300ms per file; ingest stability unchanged

---

### Non-Goals
- Web crawling/queues (/ingest-batch) — deferred to Phase 14
- Redis hot/cold caching — add only if metrics justify (Phase 14)
- Agentic self‑critique or multimodal embeddings — future phases

---

### Deliverables
- SQL parser (Postgres/Supabase) and Config parser (YAML/JSON)
- `tech_stack` auto‑detector
- Optional minimal cross‑tech links or chunk metadata hints
- Feature flags:
  - `BACKEND_PARSING=true`
  - `TECH_STACK_TAGS=true`

---

### Risks & Mitigations
- Parser fragility → robust fixtures; fallback on parse errors
- Mapping accuracy (schema ↔ client) → conservative heuristics; store hints in metadata
- Backwards compatibility → flags default off; keep simple chunking intact

---

### Definition of Done
- SQL/YAML/JSON files parsed into meaningful, copy‑pasteable chunks with accurate metadata
- `tech_stack` tagging works and is queryable
- Feature‑flagged, disabled by default; no regressions when off
- Unit + integration tests pass on curated fixtures and a small real corpus


