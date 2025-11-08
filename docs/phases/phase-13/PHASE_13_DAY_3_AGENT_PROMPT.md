# Phase 13 Day 3 - Agent Prompt

**Task:** File Relationships Service & Database Migration

**Status:** Days 1-2 complete (Parser + Chunker ready). Now building file dependency tracking.

---

## 📚 Documentation to Read

**Read these documents IN ORDER:**

1. **docs/phases/phase-13/03_FILE_RELATIONSHIPS.md** (PRIMARY - relationship system)
2. **docs/phases/phase-13/04_BUILD_PLAN.md** (Day 3 section)
3. **apps/server/src/pipeline/code-chunker.ts** (Day 2 implementation)
4. **packages/db/migrations/004_hybrid_search.sql** (migration example)

**Work under:** Issue #62 (Phase 13 Epic)

---

## 🚨 CRITICAL: What to Use and What to Ignore

**ONLY use these sources (in order of authority):**
1. ✅ **This daily prompt** (PRIMARY - your single source of truth)
2. ✅ **Documentation files listed above** (Phase 13 docs)
3. ✅ **Day 1-2 implementations** (Parser and chunker you built)
4. ✅ **Existing codebase** (for integration patterns)

**NEVER reference or trust:**
- ❌ **Issue #62 comments** (outdated, wrong paths, Phase 10 references)
- ❌ **Issue #65** (Frontend issue - still references Phase 10)
- ❌ **Any "Phase 10" references** (old numbering)
- ❌ **Documentation paths with `phase-10`** (don't exist)

**If you encounter conflicting information:**
- This prompt overrides everything else
- Follow Phase 13 documentation only
- Ignore Phase 10 references completely

---

## 🎯 Main Objectives

### 1. Create Database Migration
- **File:** `packages/db/migrations/006_file_relationships.sql`
- **Creates:** `file_relationships` table with indexes
- **Features:**
  - Tracks import/usage/test/sibling relationships
  - Indexed for fast queries
  - CASCADE delete on collection removal

### 2. Create Relationship Service
- **File:** `apps/server/src/services/file-relationships.ts`
- **Functions:**
  - `trackFileRelationship()` - Store relationship
  - `getRelatedFiles()` - Query relationships
  - `buildFileRelationships()` - Extract from AST
  - Helper functions for path resolution

### 3. Integrate with Code Chunker
- **File:** `apps/server/src/pipeline/code-chunker.ts` (MODIFY)
- **Add:** Call `buildFileRelationships()` after chunking
- **Feature flag:** Only when `TRACK_RELATIONSHIPS=true`

### 4. Create API Endpoint
- **File:** `apps/server/src/routes/docs.ts` (MODIFY)
- **Add:** `GET /api/documents/:id/related-files`
- **Returns:** All relationships for a file

---

## ✅ Requirements Checklist

### Database Migration
- [ ] Create `packages/db/migrations/006_file_relationships.sql`
- [ ] Create `file_relationships` table with all columns
- [ ] Add UNIQUE constraint on (collection_id, source_file, target_file, relationship_type)
- [ ] Add foreign key: collection_id REFERENCES collections(id) ON DELETE CASCADE
- [ ] Create index: collection_id
- [ ] Create index: source_file
- [ ] Create index: target_file
- [ ] Create index: relationship_type
- [ ] Create composite index: (source_file, relationship_type)
- [ ] Test migration: Apply and rollback successfully

### Relationship Service
- [ ] Create `apps/server/src/services/file-relationships.ts`
- [ ] Export type: `RelationshipType = 'import' | 'usage' | 'test' | 'sibling' | 'parent'`
- [ ] Export interface: `FileRelationship` (sourceFile, targetFile, type, metadata)
- [ ] Export interface: `RelatedFiles` (imports, imported_by, tests, siblings, etc.)
- [ ] Implement `trackFileRelationship(db, collectionId, relationship)`
- [ ] Implement `getRelatedFiles(db, filePath, collectionId)`
- [ ] Implement `buildFileRelationships(db, collectionId, filePath, ast)`
- [ ] Implement `resolveImportPath()` - package/relative/absolute imports
- [ ] Implement `isTestFile()` - detects _test.dart files
- [ ] Implement `getSourceFileForTest()` - maps test to source
- [ ] Implement `findSiblingFiles()` - queries same directory
- [ ] Handle circular dependencies gracefully

### Code Chunker Integration
- [ ] Modify `apps/server/src/pipeline/code-chunker.ts`
- [ ] Import file-relationships service
- [ ] After chunking Dart file, call `buildFileRelationships()`
- [ ] Pass AST, file path, collection ID
- [ ] Only when `process.env.TRACK_RELATIONSHIPS === 'true'`
- [ ] Catch errors (don't break chunking if relationship tracking fails)

### API Endpoint
- [ ] Modify `apps/server/src/routes/docs.ts`
- [ ] Add `GET /api/documents/:id/related-files` route
- [ ] Query document to get file_path and collection_id
- [ ] Call `getRelatedFiles(db, filePath, collectionId)`
- [ ] Return JSON: { file_path, related_files }
- [ ] Handle missing file_path gracefully
- [ ] Add error handling

### Unit Tests
- [ ] Create `apps/server/src/services/__tests__/file-relationships.test.ts`
- [ ] Test: Track import relationship
- [ ] Test: Query related files (imports, imported_by)
- [ ] Test: Detect test files correctly
- [ ] Test: Map test to source file
- [ ] Test: Find sibling files
- [ ] Test: Resolve import paths (package, relative, absolute)
- [ ] Test: Handle circular dependencies

### Integration Tests
- [ ] Add to `apps/server/src/pipeline/__tests__/integration-code.test.ts`
- [ ] Test: Ingest Dart file with TRACK_RELATIONSHIPS=true
- [ ] Test: Verify relationships stored in database
- [ ] Test: Query relationships via API
- [ ] Test: Test file linked to source file

### Quality Checks
- [ ] Run: `pnpm --filter @synthesis/db migrate` (apply migration)
- [ ] Run: `pnpm --filter @synthesis/server test file-relationships`
- [ ] Run: `pnpm --filter @synthesis/server test integration-code`
- [ ] Run: `pnpm --filter @synthesis/server typecheck`
- [ ] Run: `pnpm lint`
- [ ] Verify: Migration applied successfully
- [ ] Verify: All tests passing
- [ ] Verify: No TypeScript errors

---

## 🔧 Commands to Run

### 1. Create Migration
```bash
# Create migration file
touch packages/db/migrations/006_file_relationships.sql

# Apply migration
pnpm --filter @synthesis/db migrate

# Verify table created
psql $DATABASE_URL -c "\d file_relationships"

# Check indexes
psql $DATABASE_URL -c "\di file_relationships*"
```

### 2. Test Migration Rollback
```bash
# Create rollback script
cat > packages/db/migrations/006_file_relationships_rollback.sql << 'EOF'
DROP INDEX IF EXISTS file_relationships_source_type_idx;
DROP INDEX IF EXISTS file_relationships_type_idx;
DROP INDEX IF EXISTS file_relationships_target_idx;
DROP INDEX IF EXISTS file_relationships_source_idx;
DROP INDEX IF EXISTS file_relationships_collection_idx;
DROP TABLE IF EXISTS file_relationships;
EOF

# Test rollback
psql $DATABASE_URL -f packages/db/migrations/006_file_relationships_rollback.sql

# Re-apply
pnpm --filter @synthesis/db migrate
```

### 3. Development Loop
```bash
# Run tests in watch mode
pnpm --filter @synthesis/server test:watch file-relationships

# Type check
pnpm --filter @synthesis/server typecheck
```

### 4. Test API Endpoint
```bash
# Start server with relationship tracking
TRACK_RELATIONSHIPS=true pnpm --filter @synthesis/server dev

# Ingest a Dart file
curl -X POST http://localhost:3333/api/ingest \
  -F "file=@apps/server/src/pipeline/__tests__/fixtures/sample.dart" \
  -F "collection_id=test" \
  -F "title=Sample Dart"

# Get document ID
DOC_ID=$(curl -s http://localhost:3333/api/collections/test/documents | jq -r '.documents[0].id')

# Get related files
curl -s "http://localhost:3333/api/documents/$DOC_ID/related-files" | jq

# Expected output:
# {
#   "file_path": "sample.dart",
#   "related_files": {
#     "imports": [
#       "package:flutter/material.dart",
#       "package:http/http.dart",
#       "../models/user.dart",
#       "utils.dart"
#     ],
#     "imported_by": [],
#     "tests": [],
#     "siblings": []
#   }
# }
```

### 5. Query Database Directly
```bash
# Check relationships stored
psql $DATABASE_URL -c "
  SELECT 
    source_file,
    target_file,
    relationship_type,
    metadata
  FROM file_relationships
  ORDER BY created_at DESC
  LIMIT 10;
"

# Count relationships by type
psql $DATABASE_URL -c "
  SELECT 
    relationship_type,
    COUNT(*) as count
  FROM file_relationships
  GROUP BY relationship_type;
"
```

---

## 📊 Database Migration

### `006_file_relationships.sql`

```sql
-- Phase 13: File relationship tracking for code intelligence

CREATE TABLE file_relationships (
  id SERIAL PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  source_file TEXT NOT NULL,
  target_file TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  -- Types: 'import', 'usage', 'test', 'sibling', 'parent'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicates
  UNIQUE(collection_id, source_file, target_file, relationship_type)
);

-- Indexes for efficient queries
CREATE INDEX file_relationships_collection_idx 
  ON file_relationships(collection_id);

CREATE INDEX file_relationships_source_idx 
  ON file_relationships(source_file);

CREATE INDEX file_relationships_target_idx 
  ON file_relationships(target_file);

CREATE INDEX file_relationships_type_idx 
  ON file_relationships(relationship_type);

-- Composite index for common queries
CREATE INDEX file_relationships_source_type_idx 
  ON file_relationships(source_file, relationship_type);

COMMENT ON TABLE file_relationships IS 
  'Tracks relationships between code files (imports, usage, tests, etc.)';

COMMENT ON COLUMN file_relationships.relationship_type IS 
  'Type of relationship: import, usage, test, sibling, parent';

COMMENT ON COLUMN file_relationships.metadata IS 
  'Additional data: import alias, symbols used, etc.';
```

---

**Timeline:** 6 hours

**Success:** Migration applied, relationships tracked, API endpoint working

See complete checklist above for all deliverables.
