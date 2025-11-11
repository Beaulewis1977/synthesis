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

---

## Performance Optimization (Optional)

**Note:** This section will be completed as part of issue [#98 - DB/Docs: JSONB index guidance](https://github.com/Beaulewis1977/synthesis/issues/98).

### When to Apply JSONB Index

Only create an index if you experience performance issues with tech_stack filtering:

**Recommended when:**
- Dataset size >10,000 documents
- Frequent use of tech_stack filtering (>30% of queries)
- p95 latency regression >100ms when filtering
- Otherwise, skip the index (unnecessary overhead)

### Example Index Creation

```sql
-- Optional: Only create if filtering performance regresses
-- Recommended for datasets >10,000 documents

CREATE INDEX IF NOT EXISTS idx_chunks_metadata_tech_stack 
  ON chunks USING gin ((metadata->'tech_stack'));

-- Alternative: Full metadata GIN index
CREATE INDEX IF NOT EXISTS idx_chunks_metadata_gin 
  ON chunks USING gin (metadata);
```

**Suggested migration file:** `packages/db/migrations/007_tech_stack_index.sql`

### Trade-offs

**Pros:**
- Faster JSONB filtering queries (can be 10-100x faster on large datasets)
- Scales well to large corpora
- Supports array intersection operations efficiently

**Cons:**
- Slower writes (inserts/updates add ~5-10% overhead)
- Additional storage (~5-10% of table size)
- Index maintenance overhead during vacuuming

### Testing Performance

Before creating the index:
```bash
EXPLAIN ANALYZE 
SELECT * FROM chunks 
WHERE metadata->'tech_stack' ?| ARRAY['postgres', 'supabase']::text[]
LIMIT 10;
```

After creating the index, run the same query and compare execution time.


