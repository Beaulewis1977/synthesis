## Phase 14: Integration Guide — Tech Stack Filters

### Backend
Endpoint: `POST /api/search`

Request body (new fields are optional):
```json
{
  "query": "users table schema",
  "collection_id": "UUID",
  "tech_stack": ["postgres", "supabase"]
}
```

Behavior:
- When `tech_stack` is present and non-empty, the server restricts results to chunks where `metadata.tech_stack` intersects with the provided tags.
- When absent or empty, search behaves exactly as before.

Performance (optional DBA task):
- Create a JSONB GIN index to optimize filters on `metadata.tech_stack`.
- Suggested migration file name: `packages/db/migrations/007_tech_stack_index.sql`
- Example approach: GIN index on `chunks(metadata)` (or a computed path index if preferred by DBA).

### Frontend (Optional)
- Add simple multi-select chips (postgres, supabase, redis…).
- Persist selected tags as repeated query params, e.g. `?q=...&tech_stack=postgres&tech_stack=redis`.
- Include `tech_stack` array in the POST body.

### Feature Flags
- No new flags required beyond Phase 13.5.  
- Keep `BACKEND_PARSING` and `TECH_STACK_TAGS` as-is; filters operate on stored metadata.

### Testing
- Unit: service-level filter functions.
- Integration: send `tech_stack` and assert results narrow; empty tags → baseline unchanged.


