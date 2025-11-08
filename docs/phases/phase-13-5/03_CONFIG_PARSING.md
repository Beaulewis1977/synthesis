## Config Parsing – YAML/JSON

---

### Objectives
- Extract actionable config snippets from YAML/JSON:
  - Top-level sections
  - Nested key paths for critical runtime settings
- Preserve enough structure to be copy‑pasteable and understandable

---

### Supported Inputs
- YAML: Supabase config, Docker Compose, service configs
- JSON: package.json, tsconfig.json, app settings

---

### Extraction Strategy
- Parse with `js-yaml` / `JSON.parse`
- Identify:
  - Top‑level keys
  - For known services, capture critical nested paths (e.g., `redis.host`, `database.url`)
- Chunking:
  - One chunk per top‑level section or logical group
  - Include minimal inline context for readability
- Metadata:
  - `chunk_type: 'config'`
  - `format: 'yaml'|'json'`
  - `keys: string[]`, `nested_paths: string[]`
  - optional `tech_stack`

---

### Example – YAML
```yaml
redis:
  host: localhost
  port: 6379
database:
  url: postgresql://user:pass@localhost:5432/db
auth:
  jwt_secret: example
```

Extracted metadata:
```json
{
  "chunk_type": "config",
  "format": "yaml",
  "keys": ["redis","database","auth"],
  "nested_paths": ["redis.host","redis.port","database.url","auth.jwt_secret"],
  "tech_stack": ["redis","supabase"]
}
```

---

### Edge Cases
- Large files → prefer grouping by section
- Arrays of objects → flatten just the paths, not full content
- Secrets → do not log values; include keys only in metadata

---

### Testing
- Fixtures:
  - Compose‑like YAML
  - Supabase config (subset)
  - JSON configs with nested structures
- Assertions:
  - Top‑level keys detected
  - Nested key paths captured
  - Chunks remain readable and small


