## Phase 13.5: Acceptance Criteria

---

### Functional
- SQL
  - Extracts table name, columns (name/type), constraints (PK/UNIQUE/CHECK), foreign keys, indexes from representative migrations
  - Accurate line ranges on chunks; copy‑pasteable
- Configs
  - Extracts top‑level keys; captures critical nested paths
  - Chunks remain readable and small
- Tech Stack
  - `tech_stack` tagging enabled via flag; accuracy ≥ 90% on curated fixtures
- Integration
  - Flags default off; with flags off, behavior identical to pre‑13.5
  - On parser error, fallback to simple chunking without aborting ingestion

---

### Performance
- Typical parse < 300ms/file
- No meaningful regression in ingest throughput

---

### Quality
- Unit tests cover:
  - SQL table extraction, constraints, indexes, FKs
  - Config top‑level and nested keys
  - Tech stack detector heuristics
  - Fallback behavior on malformed inputs
- Integration tests:
  - End‑to‑end ingest+search on a small corpus (schemas + configs + Flutter client)
  - Tagged search by `tech_stack` works
- Lint/typecheck: clean

---

### Safety
- Feature flags documented; disabled by default
- Logs on parser errors without leaking secrets


