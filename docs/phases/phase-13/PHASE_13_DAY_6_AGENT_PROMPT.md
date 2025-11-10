# Phase 13 Day 6 - Agent Prompt

**Task:** Final Fixes & Frontend Implementation

**Status:** Phase 13 is nearly complete. This final day addresses remaining gaps in the backend and implements the frontend components.

---

## 📚 Documentation to Read

**Read these documents IN ORDER:**

1.  **GitHub Issue #65:** Read the main description carefully. **WARNING:** The comments section is confusing and contains outdated plans. Trust the `06_FRONTEND_UPDATES.md` document as the source of truth for the implementation plan.
2.  **GitHub Issue #62:** Read the main description. Again, **ignore the comments** and refer to the `00_PHASE_13_OVERVIEW.md` for the required metadata fields.
3.  **docs/phases/phase-13/06_FRONTEND_UPDATES.md** (PRIMARY for Frontend work)
4.  **docs/phases/phase-13/00_PHASE_13_OVERVIEW.md** (for `ChunkMetadata` fields)
5.  **Your previous work** from Days 1-5 for context.

---

## 🎯 Main Objectives

### 1. Finish Issue #62 (Backend)
-   **File:** `packages/shared/src/index.ts`
-   **Task:** Update the `ChunkMetadata` interface to include all the code intelligence fields from the plan.

### 2. Implement Issue #65 (Frontend)
-   **Task:** Create the "Related Files Panel" and search functionality as detailed in `06_FRONTEND_UPDATES.md`.
-   **Files to Create:**
    -   `apps/web/src/pages/SearchPage.tsx`
    -   `apps/web/src/components/RelatedFilesPanel.tsx`
    -   `apps/web/src/components/FileRelationshipSection.tsx`
    -   `apps/web/src/components/FileLink.tsx`
    -   `apps/web/src/components/FilePathBreadcrumbs.tsx` (Optional but recommended)
-   **Files to Modify:**
    -   `apps/web/src/components/ResultCard.tsx`
    -   `apps/web/src/App.tsx`
    -   `apps/web/src/pages/CollectionView.tsx`
    -   `apps/web/src/lib/api.ts`
    -   `apps/web/src/lib/utils.ts`
    -   `apps/web/src/types/index.ts`

---

## ✅ Requirements Checklist

### Backend Fix (Issue #62)
- [ ] Modify `packages/shared/src/index.ts`.
- [ ] Extend the `ChunkMetadata` interface to include all fields from the `CodeChunkMetadata` example in `00_PHASE_13_OVERVIEW.md`.
- [ ] Ensure all new fields are optional to maintain backward compatibility.
- [ ] Run `pnpm typecheck` to ensure no new errors are introduced.

### Frontend Implementation (Issue #65)
- [ ] Create all new files as listed above.
- [ ] Implement the `SearchPage` with search input, results display, and loading/error states.
- [ ] Modify `ResultCard` to include the "Related Files" toggle and render the `RelatedFilesPanel`.
- [ ] Implement the `RelatedFilesPanel` to fetch and display related files using the `/api/documents/:id/related-files` endpoint.
- [ ] Implement `FileRelationshipSection` to display a category of related files with expand/collapse functionality.
- [ ] Implement `FileLink` to be a clickable link that navigates to a search for that file.
- [ ] Modify `App.tsx` to include the new `/search/:collectionId` route.
- [ ] Modify `CollectionView.tsx` to add a "Search" button.
- [ ] Update `api.ts`, `utils.ts`, and `types/index.ts` with the necessary helper functions and types.
- [ ] Write unit or integration tests for the new frontend components.

---

## 🔧 Commands to Run

### Backend
```bash
# After modifying packages/shared/src/index.ts
pnpm typecheck
```

### Frontend
```bash
# Create frontend files
touch apps/web/src/pages/SearchPage.tsx
touch apps/web/src/components/RelatedFilesPanel.tsx
touch apps/web/src/components/FileRelationshipSection.tsx
touch apps/web/src/components/FileLink.tsx
touch apps/web/src/components/FilePathBreadcrumbs.tsx

# Run frontend dev server
pnpm --filter @synthesis/web dev

# Run frontend tests
pnpm --filter @synthesis/web test
```

---

## 📝 Deliverables

### Code
-   Modified `packages/shared/src/index.ts`.
-   All new and modified frontend files.

### Summary
-   A "Day 6 Summary" document (`PHASE_13_DAY_6_SUMMARY.md`) detailing the work done, tests passed, and final status of the phase.
-   An update to `docs/phases/phase-13/04_BUILD_PLAN.md` to include Day 6.

---

## 🚨 Critical Validation Steps

1.  **Verify Backend Fix:** After updating `packages/shared/src/index.ts`, run a full build (`pnpm build`) and typecheck (`pnpm typecheck`) to ensure no regressions.
2.  **Verify Frontend Implementation:**
    *   Navigate to a collection and click the new "Search" button.
    *   Perform a search and see results.
    *   For a code result, toggle the "Related Files" panel.
    *   Verify that the panel loads and displays related files.
    -   Click on a related file link and verify that it navigates to a new search for that file.

---

## 🎉 Success Criteria

**Day 6 is complete when:**

-   ✅ The `ChunkMetadata` interface in `packages/shared/src/index.ts` is fully updated.
-   ✅ The "Related Files" panel is implemented and functional on the frontend.
-   ✅ The search page is implemented and functional.
-   ✅ All new and existing tests are passing.
-   ✅ The application builds and runs without errors.
-   ✅ A final summary for Phase 13 is written, confirming all work is complete.
