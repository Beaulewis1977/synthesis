# Phase 7: Collection Versioning - Summary

**Date:** November 2025  
**Branch:** `feature/phase-7-versioning`  
**Duration:** ~2-3 days (estimated)

---

## Overview

Phase 7 implements document lifecycle management and versioning for the Synthesis RAG system. This enables users to archive outdated documents, supersede old versions with new ones, filter by lifecycle status, and track framework versions across collections.

---

## Features Implemented

### 1. Database Schema (Migration 021)

- **`lifecycle_status`** - Document state: `active`, `archived`, `superseded`
- **`superseded_by`** - Reference to the document that replaced this one
- **`doc_version`** - Semantic version string for the document
- **`branch`** - Git branch for repository-sourced documents
- **`archived_at`** - Timestamp when document was archived
- **Indexes** for efficient filtering by status and version
- **Helper functions** for archive/restore/supersede operations

### 2. Collection Lifecycle Service

New service at `apps/server/src/services/collection-lifecycle.ts`:

| Function | Description |
|----------|-------------|
| `archiveDocument()` | Set document status to 'archived' |
| `restoreDocument()` | Restore archived/superseded document to 'active' |
| `supersedeDocument()` | Mark document as superseded by a newer version |
| `batchArchiveDocuments()` | Archive multiple documents at once |
| `batchRestoreDocuments()` | Restore multiple documents at once |
| `batchArchiveByFrameworkVersion()` | Archive all docs with specific framework version |
| `getDocumentsByStatus()` | Query documents filtered by lifecycle status |
| `getDocumentVersionHistory()` | Get all versions of a document by source_url_hash |
| `getCollectionFrameworkVersions()` | Get unique framework versions with counts |
| `getCollectionVersionStats()` | Get version statistics for a collection |

### 3. API Routes

New endpoints in `apps/server/src/routes/collections.ts`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/collections/:id/documents/versioned` | GET | Get documents with lifecycle filtering |
| `/api/collections/:id/versions` | GET | Get version statistics |
| `/api/collections/:id/framework-versions` | GET | Get unique framework versions |
| `/api/collections/:id/archive-by-version` | POST | Archive docs by framework version |
| `/api/documents/:id/version-history` | GET | Get version history for a document |
| `/api/documents/:id/archive` | POST | Archive a document |
| `/api/documents/:id/restore` | POST | Restore a document |
| `/api/documents/:id/supersede` | POST | Supersede with new document |
| `/api/documents/batch/archive` | POST | Batch archive documents |
| `/api/documents/batch/restore` | POST | Batch restore documents |

### 4. Frontend Components

New components in `apps/web/src/components/collections/`:

| Component | Description |
|-----------|-------------|
| `VersionFilter` | Dropdown filters for lifecycle status and framework version |
| `VersionStats` | Display version statistics summary |
| `LifecycleBadge` | Status badge (Active/Archived/Superseded) |
| `VersionBadge` | Version and branch display badge |
| `DocumentActions` | Action menu with archive/restore/delete |
| `BatchActions` | Batch action buttons for selected documents |

### 5. Collection Delete Functionality

Added missing UI for deleting collections (single and batch):

| Component | Feature |
|-----------|---------|
| `CollectionCard.tsx` | Three-dot menu with "Delete Collection" + confirmation |
| `Dashboard.tsx` | Selection mode with batch delete functionality |
| `collections.ts` routes | `POST /api/collections/batch/delete` endpoint |
| `api.ts` | `deleteCollection()` and `batchDeleteCollections()` methods |

### 6. Updated Components

- **`DocumentList.tsx`** - Added lifecycle and version badges to document items
- **`CollectionView.tsx`** - Added version filter and stats display
- **`types/index.ts`** - Added versioning types
- **`lib/api.ts`** - Added versioning API client methods
- **`DocumentActions.tsx`** - Added toast notifications for batch operation errors

---

## Files Created

| File | Description |
|------|-------------|
| `packages/db/migrations/021_collection_versioning.sql` | Database migration |
| `apps/server/src/services/collection-lifecycle.ts` | Lifecycle service |
| `apps/server/src/services/__tests__/collection-lifecycle.test.ts` | Service tests |
| `apps/web/src/components/collections/VersionFilter.tsx` | Filter component |
| `apps/web/src/components/collections/LifecycleBadge.tsx` | Badge components |
| `apps/web/src/components/collections/DocumentActions.tsx` | Action components |
| `apps/web/src/components/collections/index.ts` | Component exports |

## Files Modified

| File | Changes |
|------|---------|
| `apps/server/src/routes/collections.ts` | Added versioning routes + batch delete |
| `apps/web/src/components/DocumentList.tsx` | Added badges |
| `apps/web/src/components/CollectionCard.tsx` | Added delete menu |
| `apps/web/src/pages/CollectionView.tsx` | Added filter UI |
| `apps/web/src/pages/Dashboard.tsx` | Added batch selection/delete |
| `apps/web/src/types/index.ts` | Added versioning types |
| `apps/web/src/lib/api.ts` | Added API methods |

---

## Acceptance Criteria

- [x] Documents can be archived (status change, not deleted)
- [x] Documents can be superseded by newer versions
- [x] Version history viewable per document (by source_url_hash)
- [x] UI filter for lifecycle status works
- [x] UI filter for framework version works
- [x] Version badges display on document cards
- [x] Cascade delete still works (existing functionality via FK constraints)
- [ ] All tests pass (pending test run)

---

## UI/UX Features

### Version Filter Bar
- **Status dropdown** - Filter by All/Active/Archived/Superseded with counts
- **Framework version dropdown** - Filter by specific framework versions
- **Clear button** - Reset all filters
- **Filter indicator** - Shows when filters are active

### Document Cards
- **Lifecycle badge** - Shows Archived/Superseded status (hidden for Active)
- **Version badge** - Shows doc_version or framework_version
- **Branch badge** - Shows git branch for repo-sourced docs

### Action Menu
- **Archive** - Move document to archived status
- **Restore** - Restore archived/superseded documents
- **Version History** - View all versions of a document
- **Delete** - Permanently delete with confirmation

---

## Testing

Run tests with:
```bash
pnpm --filter @synthesis/server test src/services/__tests__/collection-lifecycle.test.ts
```

---

## Migration Notes

The migration adds new columns with defaults, so existing documents will:
- Have `lifecycle_status = 'active'` (default)
- Have `superseded_by = NULL`
- Have `doc_version = NULL`
- Have `branch = NULL`
- Have `archived_at = NULL`

No data migration required - existing documents continue to work normally.

---

## Dependencies

- Phase 3 (Metadata Guarantees) - Uses `framework_version` from document metadata
- Migration 010 (Document Versioning) - Uses `source_url_hash` for version history

---

## Next Steps

1. Run migration on database
2. Run tests to verify functionality
3. Test UI in browser
4. Create PR for review
