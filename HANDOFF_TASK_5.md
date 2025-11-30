# HANDOFF: RAG UI Implementation - Task 5 (MMR Placeholder UI)

**Branch:** `feature/rag-ui-completion` (already checked out)
**Last Commit:** `19a7854` - Task 4 complete (4 commits ahead of develop)

---

## Read These Files First

1. **`docs/RAG_UI_IMPLEMENTATION_PROGRESS.md`** - Progress tracker (shows completed tasks)
2. **`docs/RAG_REMAINING_IMPLEMENTATION.md`** - Original requirements (Section 5.1)
3. **`apps/web/src/pages/CollectionView.tsx`** - Where to add the placeholder UI

---

## Your Task: Implement Task 5 (MMR Placeholder UI - FINAL TASK)

Add a "Coming Soon" UI for per-collection MMR defaults. This is a simple placeholder indicating future functionality.

### Location

**File:** `apps/web/src/pages/CollectionView.tsx`

### What to Add

A disabled/placeholder section showing that per-collection MMR defaults are planned:

```tsx
{/* MMR Collection Defaults - Coming Soon */}
<div className="mt-lg p-4 bg-bg-secondary rounded-lg border border-border opacity-60">
  <div className="flex items-center justify-between">
    <div>
      <h4 className="font-medium text-text-primary">MMR Defaults</h4>
      <p className="text-sm text-text-secondary mt-1">
        Configure default diversity settings for this collection
      </p>
    </div>
    <span className="px-2 py-1 text-xs bg-bg-tertiary text-text-tertiary rounded">
      Coming Soon
    </span>
  </div>
  <div className="mt-3 flex gap-4 pointer-events-none">
    <div className="flex items-center gap-2">
      <div className="w-8 h-4 bg-bg-tertiary rounded-full" />
      <span className="text-sm text-text-tertiary">Enable MMR</span>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-sm text-text-tertiary">Lambda: 0.7</span>
      <div className="w-24 h-2 bg-bg-tertiary rounded-full" />
    </div>
  </div>
</div>
```

### Requirements

- Visually disabled (opacity, pointer-events-none)
- Shows "Coming Soon" badge
- Displays placeholder toggle and slider (non-functional)
- Brief description of what it will do
- Place after the existing collection info sections

---

## Implementation Guidelines

- Keep it simple - this is just a placeholder
- Use existing design tokens from the codebase
- No backend changes needed
- No new state or API calls

---

## After Completing Task 5

1. Run `pnpm typecheck` to verify
2. Commit with message:
   ```
   feat(web): add MMR collection defaults placeholder UI

   - Add "Coming Soon" section for per-collection MMR settings
   - Display disabled toggle and lambda slider placeholder
   ```
3. Update `docs/RAG_UI_IMPLEMENTATION_PROGRESS.md`:
   - Mark Task 5 as ✅ COMPLETE with commit hash
   - Update git status section
4. **DO NOT PUSH** - commits only, user will push

---

## Git Workflow Reminders

- Branch is already checked out with 4 commits ahead of develop
- Use HEREDOC format for commit messages:
  ```bash
  git commit -m "$(cat <<'EOF'
  feat(web): add MMR collection defaults placeholder UI

  - Add "Coming Soon" section for per-collection MMR settings
  - Display disabled toggle and lambda slider placeholder

  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  Co-Authored-By: Claude <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Current Git Status

```
On branch feature/rag-ui-completion
4 commits ahead of develop
19a7854 docs: add API documentation for search endpoints
9167c61 fix(web): improve form accessibility and keyboard navigation
b517ad3 feat: integrate language support badges into collections
9f82cce feat(web): add query intent UI with badge, mode indicator, and override
```

---

## After Task 5: All Tasks Complete!

Once Task 5 is committed, all tasks from `docs/RAG_REMAINING_IMPLEMENTATION.md` are done:

| Task | Status |
|------|--------|
| Task 1: Query Intent UI | ✅ |
| Task 2: Language Badges | ✅ |
| Task 3: Accessibility | ✅ |
| Task 4: API Docs | ✅ |
| Task 5: MMR Placeholder | (this task) |

The branch will be ready for PR review and merge to develop.
