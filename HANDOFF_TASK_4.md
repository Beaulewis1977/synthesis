# HANDOFF: RAG UI Implementation - Task 4 (API Documentation)

**Branch:** `feature/rag-ui-completion` (already checked out)
**Last Commit:** `9167c61` - Task 3 complete (3 commits ahead of develop)

---

## Read These Files First

1. **`docs/RAG_UI_IMPLEMENTATION_PROGRESS.md`** - Progress tracker (shows completed tasks)
2. **`/home/kngpnn/.claude/plans/purrfect-dazzling-nest.md`** - Full implementation plan
3. **`docs/RAG_REMAINING_IMPLEMENTATION.md`** - Original requirements (Section 4)
4. **`apps/server/src/routes/search.ts`** - Search API route implementation
5. **`apps/server/src/routes/collections.ts`** - Collections API routes

---

## Your Task: Implement Task 4 (API Documentation)

Create `docs/API.md` documenting the Search API.

### Task 4.1: Document Search Endpoint

**Create:** `docs/API.md`

**Content to Document:**

```markdown
# Synthesis API Documentation

## Search API

### POST /api/search

Search within a collection using vector, hybrid, or BM25 search.

#### Request Body

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| query | string | Yes | - | Search query text |
| collection_id | string | Yes | - | Collection UUID |
| top_k | number | No | 10 | Max results (1-50) |
| search_mode | string | No | "hybrid" | "vector" or "hybrid" |
| tech_stack | string[] | No | - | Filter by frameworks |
| mmr_enabled | boolean | No | false | Enable result diversity |
| mmr_lambda | number | No | 0.7 | Diversity level (0.3-1.0) |
| intent | string | No | auto | Override intent detection |
| rerank | boolean | No | false | Enable reranking |

#### Intent Types
- `code_symbol` - Code identifiers, function names
- `natural_language` - Questions, explanations
- `error_message` - Stack traces, errors
- `api_lookup` - Documentation queries
- `conceptual` - "What is..." questions
- `comparison` - "X vs Y" queries

#### Response Format
Document the response structure including:
- results array
- total_results count
- search_time_ms
- metadata (search_mode, intent, mmr, diagnostics)

#### Example Request/Response
Add curl examples and JSON response samples.
```

### Task 4.2: Document Additional Endpoints (Optional)

If time permits, also document:
- `GET /api/collections` - List collections
- `GET /api/collections/:id` - Get collection details
- `GET /api/collections/:id/language-stats` - Language statistics
- `POST /api/ingest` - Upload documents

---

## Implementation Guidelines

- Read the actual route files to get accurate parameter names and types
- Include curl examples that can be copy-pasted
- Document error responses (400, 404, 500)
- Keep documentation concise but complete

---

## Tools & Resources

### Subagents to Use

Use **Explore** subagent (up to 3 in parallel) to:
1. Search `apps/server/src/routes/search.ts` for search endpoint implementation
2. Search `apps/server/src/services/search.ts` for search logic and parameters
3. Search for existing API documentation patterns in the codebase

### Skills Available

- **`doc-writer`** - Use for generating well-structured documentation
- **`backend-development`** - Reference for API documentation patterns

### MCP Servers

- **Context7** (`mcp__context7__resolve-library-id` + `mcp__context7__get-library-docs`) - Look up OpenAPI/Swagger documentation patterns if needed
- **Chrome DevTools** (`mcp__chrome-devtools__*`) - Can test the API live if server is running

---

## After Completing Task 4

1. Run `pnpm typecheck` to verify (should still pass)
2. Commit with message:
   ```
   docs: add API documentation for search endpoints

   - Document POST /api/search request/response format
   - Document intent types and MMR options
   - Add curl examples for common use cases
   ```
3. Update `docs/RAG_UI_IMPLEMENTATION_PROGRESS.md`:
   - Mark Task 4 as ✅ COMPLETE with commit hash
   - Add Task 4 section under "Completed Work"
4. **DO NOT PUSH** - commits only, user will push

---

## Git Workflow Reminders

- Branch is already checked out with 3 commits ahead of develop
- Amend commits if pre-commit hooks modify files
- Check `git log -1 --format='%an %ae'` before amending
- Use HEREDOC format for commit messages:
  ```bash
  git commit -m "$(cat <<'EOF'
  docs: add API documentation for search endpoints

  - Document POST /api/search request/response format
  - Document intent types and MMR options
  - Add curl examples for common use cases

  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  Co-Authored-By: Claude <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Current Git Status

```
On branch feature/rag-ui-completion
3 commits ahead of develop
9167c61 fix(web): improve form accessibility and keyboard navigation
b517ad3 feat: integrate language support badges into collections
9f82cce feat(web): add query intent UI with badge, mode indicator, and override
```

---

## After Task 4: Task 5 Preview

**Task 5: MMR Placeholder UI** (final task)
- Add "Coming Soon" UI for per-collection MMR defaults
- Location: `apps/web/src/pages/CollectionView.tsx`
- Simple disabled UI showing future feature
