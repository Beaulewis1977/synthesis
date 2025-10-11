# Phase 5.4: UI - Upload Functionality (Completion)

**Date:** 2025-10-10  
**Agent:** [Your Name]  
**Duration:** 2-4 hours  
**Branch:** Create `feature/phase-5.4-upload` from `develop`

---

## 🎯 Context: What Happened?

Phase 5 was split into 3 sub-phases:
- ✅ **Phase 5.1** - UI setup and layout (COMPLETE)
- ✅ **Phase 5.2** - Dashboard and collection pages (COMPLETE)
- ⚠️ **Phase 5.3** - Chat interface (COMPLETE) + Upload functionality (MISSING)

**Phase 5.3 only delivered 50% of the requirements:**
- ✅ Chat interface implemented
- ❌ Upload functionality completely skipped

**Your job:** Complete the missing upload functionality to finish Phase 5.

---

## 📚 Required Reading (IN ORDER)

### 1. **Start Here - Understand the Project**
```bash
docs/00_START_HERE.md          # Project overview
docs/15_AGENT_PROMPTS.md       # Your workflow guide (READ CAREFULLY!)
```

### 2. **Understand What Was Built (Phase 5.1-5.3)**
```bash
PHASE_5.1_SUMMARY.md           # UI scaffolding
PHASE_5.2_SUMMARY.md           # Dashboard & collections (NOTE: Line 98-104 about upload button)
PHASE_5.3_SUMMARY.md           # Chat interface only
```

### 3. **Understand What You're Building**
```bash
docs/08_UI_SPEC.md             # UI specifications (CRITICAL)
docs/09_BUILD_PLAN.md          # Day 5 (lines 265-300) - Upload requirements
docs/05_API_SPEC.md            # POST /api/ingest endpoint
```

### 4. **Check GitHub Issues**
```bash
docs/14_GITHUB_ISSUES.md       # Lines 500-512: Story 5.3 tasks
```

**Story 5.3 Tasks (from GitHub Issues):**
- [ ] Create UploadZone component       ← NOT DONE (YOU DO THIS)
- [ ] Create Upload page                ← NOT DONE (YOU DO THIS)  
- [x] Create ChatMessage component      ← Already done
- [x] Create Chat page                  ← Already done
- [x] Wire to /api/agent/chat           ← Already done

### 5. **Review Git Workflow**
```bash
docs/11_GIT_WORKFLOW.md        # How to commit and create PRs
```

---

## 🎯 What You're Building

### **Missing Components:**

1. **UploadZone Component** (`apps/web/src/components/UploadZone.tsx`)
   - Drag & drop file upload
   - File picker fallback
   - Multiple file support
   - File type validation (PDF, DOCX, MD, TXT)
   - Upload progress indicators
   - Error handling per file

2. **Upload Page** (`apps/web/src/pages/UploadPage.tsx`)
   - Use UploadZone component
   - Display list of files to upload
   - Show upload progress
   - Handle `/api/ingest` endpoint
   - Display success/error states
   - Navigate back after upload

3. **Wire Upload Button** (Update `apps/web/src/pages/CollectionView.tsx`)
   - Currently the Upload button does nothing (line 56-58)
   - Make it navigate to `/upload/:collectionId`

4. **Add Upload Route** (Update `apps/web/src/App.tsx`)
   - Add route: `/upload/:collectionId`
   - Wire to UploadPage component

5. **API Integration** (Update `apps/web/src/lib/api.ts`)
   - Add `uploadDocument()` function
   - Use FormData for multipart upload
   - Handle progress callbacks

---

## 🔧 Technical Specifications

### API Endpoint (Already exists in backend)
```typescript
POST /api/ingest
Content-Type: multipart/form-data

Body:
- collection_id: string (UUID)
- files: File[] (one or more files)

Response:
{
  "documents": [
    {
      "doc_id": "uuid",
      "title": "filename.pdf",
      "status": "pending"
    }
  ]
}
```

### File Type Support
- PDF (`.pdf`)
- Word Documents (`.docx`)
- Markdown (`.md`)
- Plain Text (`.txt`)

### Upload Flow
1. User clicks "Upload" button in CollectionView
2. Navigates to `/upload/:collectionId`
3. User drags files or clicks to select
4. Files are validated (type, size)
5. Upload starts with progress indicator
6. Success: Shows confirmation, navigates back
7. Error: Shows error message, allows retry

---

## 📁 Files to Create

```
apps/web/src/
├── components/
│   └── UploadZone.tsx        # NEW - Drag & drop component
├── pages/
│   └── UploadPage.tsx        # NEW - Upload page
└── (updates to existing files below)
```

---

## 📝 Files to Modify

### 1. `apps/web/src/App.tsx`
Add upload route:
```typescript
<Route path="upload/:collectionId" element={<UploadPage />} />
```

### 2. `apps/web/src/pages/CollectionView.tsx`
Line 56-58, change from:
```typescript
<button type="button" className="btn btn-secondary">
  Upload
</button>
```

To:
```typescript
<button 
  type="button" 
  className="btn btn-secondary"
  onClick={() => navigate(`/upload/${id}`)}
>
  Upload
</button>
```

### 3. `apps/web/src/lib/api.ts`
Add method:
```typescript
async uploadDocument(
  collectionId: string, 
  files: File[], 
  onProgress?: (progress: number) => void
): Promise<UploadResponse>
```

### 4. `apps/web/src/types/index.ts`
Add types:
```typescript
export interface UploadResponse {
  documents: {
    doc_id: string;
    title: string;
    status: string;
  }[];
}
```

---

## 🎨 UI Design Requirements (from docs/08_UI_SPEC.md)

### UploadZone Component
- Dashed border when not dragging
- Highlighted border when dragging over
- Upload icon
- "Drag files here or click to browse"
- List of selected files with:
  - File name
  - File size (formatted: KB, MB)
  - File type icon
  - Remove button (X)
- Upload progress bars per file
- Error states per file

### UploadPage Layout
- Page title: "Upload Documents"
- Collection name display
- UploadZone component
- "Back to Collection" link
- "Upload All" button (disabled until files selected)
- Loading spinner during upload
- Success message after upload

---

## ✅ Acceptance Criteria

- [ ] UploadZone component renders with drag & drop
- [ ] Can select files via file picker
- [ ] Can select multiple files at once
- [ ] File validation works (type and size)
- [ ] Upload progress shows for each file
- [ ] Successfully uploads files to `/api/ingest`
- [ ] Success state shows after upload
- [ ] Error handling works (network errors, file errors)
- [ ] Upload button in CollectionView navigates to upload page
- [ ] Can navigate back to collection after upload
- [ ] Documents appear in collection after successful upload
- [ ] TypeScript compiles with no errors
- [ ] No console errors in browser

---

## 🧪 Testing Checklist

### Manual Testing
1. **Navigation Test:**
   - Go to any collection
   - Click "Upload" button
   - Should navigate to `/upload/:collectionId`

2. **File Selection Test:**
   - Click "browse" or drag files
   - Select multiple files (PDF, DOCX, MD, TXT)
   - Files should appear in list

3. **Upload Test:**
   - Click "Upload All"
   - Progress bars should appear
   - Success message after completion
   - Navigate back to collection
   - New documents should appear

4. **Error Test:**
   - Try uploading unsupported file type
   - Should show validation error
   - Try uploading with backend stopped
   - Should show network error

5. **Edge Cases:**
   - Upload single file
   - Upload 10 files at once
   - Remove file before uploading
   - Navigate away during upload

---

## 🔄 Git Workflow Strategy

**CRITICAL:** You MUST follow the detailed git instructions in `GIT_WORKFLOW_PHASE_5.4.md`.

That document contains vital information about the project's branch history and the correct strategy for this task.

**Summary of the correct workflow:**
1.  You will **NOT** work on the `feature/phase-5-ui` branch.
2.  You will create a **NEW** branch named `feature/phase-5.4-upload` from the `develop` branch.
3.  All your commits for this task will be on the `feature/phase-5.4-upload` branch.

Refer to `GIT_WORKFLOW_PHASE_5.4.md` for the exact commands. Do not deviate from that guide.

---

## 📋 Phase Summary Template

After completing, create `PHASE_5.4_SUMMARY.md` using this structure:

```markdown
# Phase Summary: Phase 5.4 – Upload Functionality

**Date:** 2025-10-10
**Agent:** [Your Name]  
**Duration:** [X] hours

## Overview
Completed the missing upload functionality from Phase 5.3, implementing
drag & drop file upload and document management UI.

## Features Implemented
- [x] UploadZone component with drag & drop
- [x] UploadPage for document uploads
- [x] Upload button wired in CollectionView
- [x] API client uploadDocument method
- [x] File validation and progress tracking

## Files Changed

### Added
- apps/web/src/components/UploadZone.tsx
- apps/web/src/pages/UploadPage.tsx

### Modified
- apps/web/src/App.tsx
- apps/web/src/pages/CollectionView.tsx
- apps/web/src/lib/api.ts
- apps/web/src/types/index.ts

## Acceptance Criteria
- [x] All criteria met (see main section)

## Final Status
**Phase Status:** ✅ Complete
**Ready for PR:** Yes (to be merged with Phase 5.1-5.3)
**Next Phase:** Phase 6 already in progress

---
```

---

## 🚨 Important Notes

### DO NOT:
- ❌ Merge anything to `main` (it's protected)
- ❌ Commit Phase 6 changes (they're on separate branch)
- ❌ Create new environment variables (use existing)
- ❌ Change backend API (just use what exists)
- ❌ Skip error handling
- ❌ Skip TypeScript types

### DO:
- ✅ Work on your `feature/phase-5.4-upload` branch (do not use `feature/phase-5-ui`)
- ✅ Follow conventional commit format
- ✅ Test thoroughly before committing
- ✅ Create comprehensive phase summary
- ✅ Handle loading/error/empty states
- ✅ Use existing UI design tokens from Tailwind config
- ✅ Follow React best practices
- ✅ Use React Query for mutations

---

## 💡 Implementation Tips

### UploadZone Component
- Use native HTML5 drag & drop events
- Use `<input type="file" multiple />` for file picker
- Use React state to track selected files
- Use `react-query` useMutation for upload
- Show individual progress per file (if possible)
- Allow removing files before upload

### Error Handling
- Network errors (backend down)
- Validation errors (wrong file type)
- Size limits (>100MB warning)
- Timeout errors
- User feedback for each error type

### Progress Tracking
- Use XMLHttpRequest or Fetch with progress
- Show percentage per file
- Overall progress indicator
- Disable upload button during upload
- Allow cancellation (bonus)

---

## 🔗 Helpful Code References

### Existing Components to Learn From
```bash
apps/web/src/components/CollectionCard.tsx    # Component structure
apps/web/src/components/DocumentList.tsx      # List handling
apps/web/src/pages/ChatPage.tsx               # Page structure, React Query
apps/web/src/lib/api.ts                       # API client patterns
```

### Similar Patterns in Codebase
- File operations: `apps/server/src/routes/ingest.ts`
- React Query mutations: `apps/web/src/pages/CollectionView.tsx` (delete mutation)
- Error handling: All existing pages have examples

---

## ❓ Questions?

Before starting, make sure you understand:
- [ ] Why Phase 5.3 is incomplete?
- [ ] What files you need to create?
- [ ] What the upload flow should be?
- [ ] How to use the `/api/ingest` endpoint?
- [ ] Which git branch to use?
- [ ] How to test your changes?

If you have ANY questions, ask before starting implementation!

---

## ✅ Ready to Start?

Once you've:
1. Read all required documentation
2. Understand the git workflow
3. Reviewed existing code
4. Have no more questions

Say: **"READY TO IMPLEMENT PHASE 5.4"** and begin!

---

**Good luck! This is the final piece to complete Phase 5! 🚀**
