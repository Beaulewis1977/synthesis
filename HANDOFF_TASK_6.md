# HANDOFF: Task 6 - Per-Collection MMR Defaults (Functional Implementation)

**Priority:** Medium
**Estimated Effort:** 2-3 hours
**Prerequisite:** PR #140 must be merged to develop first

---

## Overview

Convert the "Coming Soon" MMR placeholder UI into a fully functional feature that allows users to configure default MMR (Maximal Marginal Relevance) settings per collection.

**Current State:** Placeholder UI exists in `apps/web/src/pages/CollectionView.tsx:237-260` showing disabled toggle and slider with "Coming Soon" badge.

**Target State:** Functional toggle and slider that persist to database and are used as defaults when searching that collection.

---

## Read These Files First

1. **`docs/RAG_REMAINING_IMPLEMENTATION.md`** - Section 5.1 has original requirements
2. **`apps/web/src/pages/SearchPage.tsx`** - Reference implementation of MMR toggle + lambda slider (lines ~200-280)
3. **`apps/web/src/pages/CollectionView.tsx`** - Current placeholder UI to replace (lines 237-260)
4. **`apps/server/src/routes/collections.ts`** - Existing collection endpoints pattern
5. **`apps/server/src/routes/search.ts`** - Where to read collection defaults
6. **`packages/db/migrations/`** - Migration file naming pattern

---

## Implementation Steps

### Step 1: Database Migration

**Create:** `packages/db/migrations/017_collection_mmr_defaults.sql`

```sql
-- Add MMR default settings to collections table
ALTER TABLE collections
ADD COLUMN mmr_enabled BOOLEAN DEFAULT false,
ADD COLUMN mmr_lambda DECIMAL(3,2) DEFAULT 0.7
  CHECK (mmr_lambda >= 0.3 AND mmr_lambda <= 1.0);

-- Add comment for documentation
COMMENT ON COLUMN collections.mmr_enabled IS 'Default MMR enabled state for searches in this collection';
COMMENT ON COLUMN collections.mmr_lambda IS 'Default MMR lambda (diversity) value, range 0.3-1.0';
```

**Run migration:** `pnpm --filter @synthesis/db migrate`

### Step 2: Backend - Update Collection Types

**File:** `packages/db/src/types.ts` (or wherever Collection type is defined)

Add to Collection interface:
```typescript
mmr_enabled?: boolean;
mmr_lambda?: number;
```

### Step 3: Backend - Add PATCH Endpoint

**File:** `apps/server/src/routes/collections.ts`

Add endpoint to update MMR defaults:
```typescript
// PATCH /api/collections/:id/mmr-defaults
fastify.patch<{
  Params: { id: string };
  Body: { mmr_enabled?: boolean; mmr_lambda?: number };
}>('/:id/mmr-defaults', async (request, reply) => {
  const { id } = request.params;
  const { mmr_enabled, mmr_lambda } = request.body;

  // Validate lambda range if provided
  if (mmr_lambda !== undefined && (mmr_lambda < 0.3 || mmr_lambda > 1.0)) {
    return reply.status(400).send({ error: 'mmr_lambda must be between 0.3 and 1.0' });
  }

  const result = await pool.query(
    `UPDATE collections
     SET mmr_enabled = COALESCE($1, mmr_enabled),
         mmr_lambda = COALESCE($2, mmr_lambda),
         updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [mmr_enabled, mmr_lambda, id]
  );

  if (result.rowCount === 0) {
    return reply.status(404).send({ error: 'Collection not found' });
  }

  return result.rows[0];
});
```

Also update the GET endpoint to return mmr_enabled and mmr_lambda fields.

### Step 4: Backend - Search Uses Collection Defaults

**File:** `apps/server/src/routes/search.ts`

When processing search request, if `mmr_enabled` or `mmr_lambda` not provided in request body, fetch collection defaults:

```typescript
// If MMR options not specified in request, use collection defaults
if (body.mmr_enabled === undefined || body.mmr_lambda === undefined) {
  const collection = await pool.query(
    'SELECT mmr_enabled, mmr_lambda FROM collections WHERE id = $1',
    [body.collection_id]
  );

  if (collection.rows[0]) {
    body.mmr_enabled = body.mmr_enabled ?? collection.rows[0].mmr_enabled;
    body.mmr_lambda = body.mmr_lambda ?? collection.rows[0].mmr_lambda;
  }
}
```

### Step 5: Frontend - API Client

**File:** `apps/web/src/lib/api.ts`

Add method:
```typescript
async updateCollectionMMRDefaults(
  collectionId: string,
  settings: { mmr_enabled?: boolean; mmr_lambda?: number }
): Promise<Collection> {
  const response = await fetch(`${this.baseUrl}/api/collections/${collectionId}/mmr-defaults`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!response.ok) throw new Error('Failed to update MMR defaults');
  return response.json();
}
```

### Step 6: Frontend - Replace Placeholder UI

**File:** `apps/web/src/pages/CollectionView.tsx`

Replace lines 237-260 (the placeholder) with functional components.

**Reference:** Copy the MMR toggle and slider pattern from `SearchPage.tsx` but wire it to:
1. Fetch collection's current MMR settings (add to existing collection query or separate query)
2. Use mutation to call `updateCollectionMMRDefaults` on change
3. Show loading/saving state
4. Invalidate queries on success

**Key changes:**
- Remove `opacity-60` and `pointer-events-none` classes
- Remove "Coming Soon" badge
- Add actual toggle switch (can use same pattern as SearchPage)
- Add actual slider (same 0.3-1.0 range as SearchPage)
- Add useMutation hook for saving

---

## Skills & Tools to Use

### Recommended Skills
- `superpowers:brainstorming` - If implementation approach is unclear
- `backend-development` - For API endpoint patterns
- `frontend-development` - For React component patterns

### Subagents
- `Explore` - To find existing patterns in codebase
- `Plan` - If you need to break down the work further

### MCP Servers
- `context7` - For React Query mutation patterns if needed
- `shadcn` - If you need UI component examples

---

## Git Workflow

### Branch Creation
```bash
git checkout develop
git pull origin develop
git checkout -b feature/collection-mmr-defaults
```

### Single Commit
After all implementation is complete and tests pass:
```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add per-collection MMR default settings

- Add mmr_enabled and mmr_lambda columns to collections table
- Add PATCH /api/collections/:id/mmr-defaults endpoint
- Search API uses collection defaults when not overridden
- Replace placeholder UI with functional toggle and slider

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### Push and PR
```bash
git push -u origin feature/collection-mmr-defaults

gh pr create --base develop --title "feat: Per-collection MMR default settings" --body "$(cat <<'EOF'
## Summary

Implements functional per-collection MMR (Maximal Marginal Relevance) default settings, replacing the placeholder UI added in PR #140.

## Changes

### Database
- Added `mmr_enabled` and `mmr_lambda` columns to collections table

### Backend
- Added `PATCH /api/collections/:id/mmr-defaults` endpoint
- Search API reads collection defaults when request doesn't specify MMR options

### Frontend
- Replaced "Coming Soon" placeholder with functional toggle and slider
- Added mutation for saving MMR defaults
- Settings persist and are used as search defaults

## Testing

- [ ] Migration runs successfully
- [ ] PATCH endpoint updates collection MMR settings
- [ ] Search uses collection defaults when not overridden
- [ ] UI toggle and slider work correctly
- [ ] Settings persist after page reload
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Verification Checklist

After implementation:

- [ ] Migration creates columns with correct defaults and constraints
- [ ] GET collection endpoint returns mmr_enabled and mmr_lambda
- [ ] PATCH endpoint validates lambda range (0.3-1.0)
- [ ] Search uses collection defaults when not specified in request
- [ ] Search request params override collection defaults
- [ ] UI toggle enables/disables MMR
- [ ] UI slider adjusts lambda value
- [ ] Changes save to database
- [ ] UI reflects saved state on page reload
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

---

## Notes

- The SearchPage already has working MMR toggle + slider - use it as reference
- Lambda range is 0.3 to 1.0 (not 0 to 1)
- Default lambda is 0.7
- MMR is disabled by default for new collections
- DO NOT PUSH until PR #140 is merged to develop
