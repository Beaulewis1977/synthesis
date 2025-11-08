# Phase 5.4: Remediation and Verification Plan

**Date:** 2025-10-22
**Objective:** Address the architectural inconsistencies, testing gaps, and project management errors from the initial implementation of Phase 5.4 to bring it to 100% completion.

---

## 1. Context & Overview

The initial implementation of Phase 5.4 successfully delivered the core UI for file uploads, fixing a major gap from Phase 5.3.

However, a deep analysis revealed three areas of concern:
1.  **Architectural Deviation:** The implementation did not follow the established pattern of centralizing API calls.
2.  **Incomplete Testing:** The UI functionality was not tested in a browser, leaving its correctness unverified.
3.  **Incorrect Issue Tracking:** The parent epic (#30) and several related issues on GitHub were left in an incorrect state.

This document provides an actionable plan to remediate these issues.

---

## 2. Task Breakdown & Execution Plan

### **Task 1: Architectural Refactoring**

**Problem:** The file upload logic was placed directly inside the `UploadZone.tsx` component instead of the central `api.ts` client, breaking the project's architectural pattern.

**File to Modify:** `apps/web/src/lib/api.ts`
- **Action:** Add the `uploadDocument` method to the `ApiClient` class as originally planned in issue #57.
- **Specification:**
  - The method should accept `collectionId: string` and `files: File[]`.
  - It must create a `FormData` object and append the `collection_id` and all files.
  - It should use the existing `private async request<T>()` helper for the `fetch` call.
  - The endpoint is `POST /api/ingest`.
  - Ensure the `Content-Type` header is **not** set manually, so the browser can correctly set it for `multipart/form-data`.

**File to Modify:** `apps/web/src/components/UploadZone.tsx`
- **Action:** Refactor the component to use the new, centralized API method.
- **Specification:**
  - Remove the hardcoded `fetch('/api/ingest', ...)` call.
  - Import the `apiClient` from `../lib/api`.
  - In the `uploadFiles` function, call the new `apiClient.uploadDocument(collectionId, files)` method.
  - Ensure the component's state management (pending, uploading, complete, error) works correctly with the refactored API call.

---

### **Task 2: Complete Browser Testing**

**Problem:** The UI has not been tested in a live browser environment. The agent that built it was unable to perform this verification.

**Action:** Manually execute the following end-to-end test plan in a browser.

**Test Plan:**
1.  **Navigate:** Go to a collection and click the "Upload" button. Verify it navigates to `/upload/:id`.
2.  **File Picker:** Click the upload zone to open the file picker. Select multiple valid files (PDF, DOCX, MD, TXT). Verify they appear in the "Files Selected" list.
3.  **Drag & Drop:** Drag and drop a valid file onto the zone. Verify it is added to the list.
4.  **Validation (Invalid Type):** Attempt to upload an unsupported file type (e.g., a `.zip` or `.exe`). Verify the file shows an "Invalid file type" error and cannot be uploaded.
5.  **Validation (Invalid Size):** Attempt to upload a file larger than 50MB. Verify it shows a "File too large" error.
6.  **Remove File:** Add several files to the list, then click the "X" icon on one of them. Verify it is removed.
7.  **Successful Upload:**
    - Upload one or more valid files.
    - Verify that progress indicators appear and update.
    - Verify a "Uploaded successfully" message appears.
    - Verify the page automatically navigates back to the collection view after a short delay.
    - Verify the newly uploaded documents now appear in the document list.
8.  **Network Error:**
    - Stop the backend server.
    - Attempt to upload a file.
    - Verify a network-related error message appears for the file(s).
9.  **Console Check:** Open the browser's developer tools and ensure no errors are logged to the console during any of these steps.

---

### **Task 3: Correct GitHub Issues**

**Problem:** The GitHub issues related to this work are in an inconsistent or incorrect state.

**Action:** Use the `gh` CLI to update the issues and reflect the true state of the project.

**Commands to Execute:**
1.  **Reopen the Epic:**
    ```bash
    gh issue reopen 30 --comment="Reopening this epic. It was closed prematurely before all child issues (specifically the upload functionality in #33) were complete. It will be closed again once #57 is complete and verified."
    ```
2.  **Mark the Duplicate:**
    ```bash
    gh issue comment 20 --body="Closing as a duplicate of #33."
    ```
3.  **Close Tracking Issue (AFTER code and testing are done):**
    ```bash
    gh issue close 57 --comment="Remediation complete. The architecture has been refactored to use the central API client and full browser testing has been performed and passed. All work for Phase 5.4 is now finished."
    ```
4.  **Close the Epic (Final Step):**
    ```bash
    gh issue close 30 --comment="All child issues, including the remediated upload functionality tracked in #57, are now complete and verified. Closing the epic."
    ```

---

## 3. Definition of Done

To consider this remediation complete, all of the following must be true:

- [ ] `uploadDocument` method has been created in `apps/web/src/lib/api.ts`.
- [ ] `UploadZone.tsx` has been refactored to use the new `apiClient.uploadDocument` method.
- [ ] All scenarios in the browser testing plan have passed without errors.
- [ ] GitHub Epic #30 has been reopened.
- [ ] GitHub Issue #20 has been commented on as a duplicate.
- [ ] GitHub Issue #57 is closed with a summary of the fixes.
- [ ] GitHub Epic #30 is re-closed with a final summary comment.
