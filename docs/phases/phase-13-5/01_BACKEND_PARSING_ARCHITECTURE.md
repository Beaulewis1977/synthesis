## Phase 13.5: Backend Parsing Architecture

---

### Design Goals
- Preserve backend structure similarly to AST-based code parsing:
  - SQL: tables, columns, constraints, indexes, foreign keys, line ranges
  - Configs: sections, nested keys/paths, critical settings
- Low‑risk integration:
  - Feature‑flagged (`BACKEND_PARSING`, `TECH_STACK_TAGS`)
  - Fallback to simple chunking on error
- Minimal cross‑tech links:
  - Hints that relate schema/configs to client code (optional, conservative)

---

### High-Level Flow
```
Code/Docs Files
  ↓
Router (file extension, flags)
  - .sql     → SQL Parser
  - .yaml/.yml/.json → Config Parser
  - others   → Existing logic (Phase 13 code chunker or simple text)
  ↓
Chunk Creation
  - Structured chunks with metadata
  - Optional tech_stack detection
  ↓
Embed & Store (existing pipeline)
  - Preserve metadata
  - No schema changes required
```

---

### Parsers
1) SQL Parser (`apps/server/src/pipeline/sql-analyzer.ts`)
   - Input: SQL DDL/migrations
   - Output: chunks per table or per migration section
     - `metadata`:
       - `chunk_type: 'sql_table' | 'sql_migration'`
       - `table`, `columns: [{name,type,constraints[]}]`
       - `indexes`, `foreign_keys`, `line_range`
       - `tech_stack: ['supabase','postgres']` (if enabled)
   - Strategy:
     - Regex/grammar‑assisted extraction for CREATE/ALTER statements
     - Extract identifiers and constraints robustly
     - Derive line ranges for copy‑pasteability
     - On parse errors: log + fallback to simple chunking

2) Config Parser (`apps/server/src/pipeline/config-analyzer.ts`)
   - Input: YAML/JSON config files
   - Output: chunks per top‑level section or logical group
     - `metadata`:
       - `chunk_type: 'config'`
       - `format: 'yaml' | 'json'`
       - `keys: string[]`, `nested_paths: string[]`
       - `line_range`
       - `tech_stack: [...]` (if enabled)
   - Strategy:
     - Parse via `js-yaml` / `JSON.parse`
     - Capture top‑level keys and critical nested paths
     - Preserve snippets small enough to be actionable

---

### Tech Stack Detection (`apps/server/src/services/tech-detector.ts`)
- Inputs: file path + content
- Heuristics:
  - `flutter` if path includes `lib/` or content includes `package:flutter`
  - `supabase` if path or content references supabase
  - `redis` if file resembles `redis.conf` or includes `redis` keys
- Returns: `string[]` stored in chunk metadata when `TECH_STACK_TAGS=true`

---

### Integration Points
- Router changes (existing chunker orchestration):
  - When `BACKEND_PARSING=true`, route `.sql`, `.yaml/.yml`, `.json` appropriately
  - Otherwise, continue with existing logic
- Storage & embeddings:
  - Reuse existing functions; no DB migration required
- Relationship hints (optional):
  - If Phase 13 relationship service is present, emit minimal edges
  - Otherwise, attach hints in chunk metadata only

---

### Feature Flags
```bash
BACKEND_PARSING=true
TECH_STACK_TAGS=true
```

---

### Error Handling & Fallbacks
- Any parser failure → log and fallback to simple text chunking for that file
- Ensure pipeline never aborts on a single parse error


