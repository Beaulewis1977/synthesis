## SQL Parsing – Postgres/Supabase

---

### Objectives
- Extract meaningful structures from SQL DDL/migrations:
  - Tables, columns (name/type), constraints (PK/UNIQUE/CHECK), foreign keys, indexes
  - Preserve line ranges for copy‑pasteability
- Be robust to common migration styles (multiple statements, comments, semicolon placement)

---

### Input Examples
```sql
-- 001_init.sql
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX users_email_idx ON public.users (email);

ALTER TABLE public.users
  ADD CONSTRAINT users_email_chk CHECK (email <> '');
```

```sql
-- 002_profiles.sql
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES public.users(id),
  display_name text,
  updated_at timestamptz
);
```

---

### Extraction Strategy
- Tokenize by statements (split on semicolons with awareness of strings/comments)
- Recognize:
  - `CREATE TABLE` blocks → capture table name and column list
  - Column lines → `name`, `type`, inline constraints (e.g., `NOT NULL`, `UNIQUE`, defaults)
  - Table constraints → `PRIMARY KEY (...)`, `UNIQUE (...)`, `CHECK (...)`
  - `ALTER TABLE` additions → attach constraints/indexes to existing table
  - `CREATE INDEX` → record index name/columns
- Derive line ranges for each chunk from original file
- On ambiguity, record what’s certain; never fail ingestion

---

### Metadata Shape (examples)
```json
{
  "chunk_type": "sql_table",
  "schema": "public",
  "table": "users",
  "columns": [
    { "name": "id", "type": "uuid", "constraints": ["PRIMARY KEY", "DEFAULT gen_random_uuid()"] },
    { "name": "email", "type": "text", "constraints": ["UNIQUE", "NOT NULL"] },
    { "name": "created_at", "type": "timestamptz", "constraints": ["NOT NULL", "DEFAULT now()"] }
  ],
  "indexes": ["users_email_idx"],
  "checks": ["users_email_chk"],
  "foreign_keys": [],
  "line_range": [1, 10],
  "tech_stack": ["supabase","postgres"]
}
```

```json
{
  "chunk_type": "sql_migration",
  "statements": [
    "CREATE INDEX users_email_idx ...",
    "ALTER TABLE public.users ADD CONSTRAINT ..."
  ],
  "table": "users",
  "line_range": [12, 20],
  "tech_stack": ["supabase","postgres"]
}
```

---

### Edge Cases
- Mixed schema qualifiers (e.g., `public.users` vs `users`)
- Inline vs table-level constraints
- Multi‑line column definitions
- Comments inside statements
- Multiple tables per file

---

### Testing
- Fixtures:
  - Single table with PK/UNIQUE/CHECK/DEFAULT
  - Multiple tables + indexes + FKs
  - ALTER statements separated from CREATE
  - Supabase‑style migrations
- Assertions:
  - Correct table/column extraction
  - Indexes/constraints present and associated to correct table
  - Accurate line ranges
  - Fallback behavior on malformed SQL


