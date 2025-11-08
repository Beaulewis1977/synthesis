## Integration Guide – Phase 13.5

---

### Feature Flags
```bash
# default off
BACKEND_PARSING=true
TECH_STACK_TAGS=true
```

---

### File Routing (orchestrator/chunker)
- When `BACKEND_PARSING=true`:
  - `.sql` → `sql-analyzer.ts`
  - `.yaml/.yml/.json` → `config-analyzer.ts`
  - others → existing logic (Phase 13 code chunker or simple chunking)
- On parser error:
  - Log warning
  - Fallback to simple chunking

---

### Chunk Metadata Conventions
- SQL:
  - `chunk_type: 'sql_table' | 'sql_migration'`
  - `schema`, `table`, `columns[]`, `indexes[]`, `foreign_keys[]`, `line_range`
- Config:
  - `chunk_type: 'config'`, `format: 'yaml'|'json'`
  - `keys[]`, `nested_paths[]`, optional `line_range`
- Tech stack (optional):
  - `tech_stack: string[]` (e.g., ["supabase","postgres","redis"])

---

### Cross‑Tech Links (optional)
- If Phase 13 relationship service exists:
  - Emit minimal edges only when highly confident
- Otherwise:
  - Store hints in chunk metadata for later use

---

### Validation Checklist
- Flags off → no behavior change
- Flags on → router dispatches SQL/Config files to parsers
- E2E: ingest+search small corpus (schemas + configs + Flutter client)


