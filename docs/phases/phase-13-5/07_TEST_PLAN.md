## Test Plan – Phase 13.5

---

### Unit Tests
1) SQL Parser
   - CREATE TABLE with PK/UNIQUE/CHECK/DEFAULT
   - Multiple tables + indexes + foreign keys
   - ALTER TABLE adding constraints
   - Malformed SQL → fallback path

2) Config Parser (YAML/JSON)
   - Top‑level keys extraction
   - Nested key paths for critical settings
   - Arrays/objects
   - Malformed YAML/JSON → fallback path

3) Tech Detector
   - flutter/supabase/redis detection by path/content
   - Negative cases (no tags)

---

### Integration Tests
- Corpus:
  - Supabase‑style schema (2–3 tables, indexes, FKs)
  - Config files (YAML/JSON) with redis/database/auth sections
  - Minimal Flutter client code using the schema
- Assertions:
  - Ingest completes without errors
  - Search returns expected SQL/config chunks
  - Filter by `tech_stack` narrows results appropriately
  - With flags off, results identical to pre‑13.5 baseline

---

### Performance Checks
- Parse typical files < 300ms
- Ingest throughput comparable to baseline

---

### Tooling
```bash
pnpm --filter @synthesis/server test
pnpm --filter @synthesis/server typecheck
pnpm lint
```


