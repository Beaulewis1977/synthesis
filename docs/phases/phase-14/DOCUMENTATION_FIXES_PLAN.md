# Phase 14 Documentation Remediation Plan

**Created:** 2025-11-11  
**Based on:** Critical review by peer agent  
**Status:** Ready to implement

---

## 🔍 Review Analysis: What's Real vs What's Expected

### ✅ VALIDATED: Infrastructure Already Exists (Phase 13.5)

**Good news - The reviewer's concerns about missing infrastructure are INCORRECT:**

1. **tech_stack metadata DOES exist**
   - ✅ Defined in `packages/shared/src/index.ts` line 85: `tech_stack?: string[];`
   - ✅ Being populated in `apps/server/src/pipeline/code-chunker.ts` lines 614-640, 746-775
   - ✅ Controlled by `TECH_STACK_TAGS` feature flag
   - ✅ Uses `detectTechStack()` function from Phase 13.5

2. **The TODO comment is INTENTIONAL**
   - ✅ Line 76 in `apps/server/src/routes/search.ts`: `TODO(Phase14): accept tech_stack[] params`
   - ✅ This is literally what Phase 14 implements - not a bug, it's the task!

### ⚠️ REAL ISSUES: Documentation Gaps

**The reviewer IS correct about these gaps:**

1. **Missing explicit Phase 13.5 prerequisite** - Docs don't clearly state tech_stack is already being populated
2. **API client needs updating** - `performSearch()` doesn't accept `tech_stack` parameter yet
3. **Frontend types incomplete** - No `tech_stack` in request/response types
4. **Some test files don't exist** - `vector.test.ts` is missing (but `search.test.ts` exists)
5. **No error handling examples** - Documentation shows happy path only
6. **Parameter naming not standardized** - Should clarify snake_case

---

## 📋 Fixes Required

### Fix 1: Add Prerequisites Section to Overview

**File:** `docs/phases/phase-14/00_PHASE_14_OVERVIEW.md`

**Add after line 7:**

```markdown
---

### Prerequisites & Infrastructure

**Phase 13.5 MUST be complete before starting Phase 14.**

Phase 13.5 (Backend Parsing & Tagging) already implements:
- ✅ `tech_stack` metadata field in `ChunkMetadata` interface
- ✅ `detectTechStack()` function that populates tech_stack during ingestion
- ✅ `TECH_STACK_TAGS` feature flag to enable/disable tagging
- ✅ Tech stack detection for SQL, YAML, and JSON files

**What Phase 14 adds:**
- Filtering capability in search endpoints
- Frontend UI for tag selection
- Performance optimization guidance

**Verification before starting:**
```bash
# Verify Phase 13.5 is complete
grep "tech_stack" packages/shared/src/index.ts
# Should show: tech_stack?: string[];

# Verify feature flag exists
grep "TECH_STACK_TAGS" apps/server/src/pipeline/code-chunker.ts
# Should find multiple references
```
```

---

### Fix 2: Update phase-14-prompts.md with Infrastructure Notes

**File:** `docs/phases/phase-14/phase-14-prompts.md`

**Add after line 51 (Git Branch section):**

```markdown

---

## 🏗️ Infrastructure Check (BEFORE You Start)

**Phase 13.5 already provides:**
1. ✅ `tech_stack` metadata field - See `packages/shared/src/index.ts:85`
2. ✅ Tech stack detection - See `apps/server/src/services/tech-detector.ts`
3. ✅ Data population during ingestion - See `apps/server/src/pipeline/code-chunker.ts:614-640`
4. ✅ Feature flag `TECH_STACK_TAGS` - Enable in `.env`

**What you'll add in Phase 14:**
1. ⚠️ Search route parameter validation (Issue #96)
2. ⚠️ Filtering logic in vector/hybrid search (Issue #96)
3. ⚠️ Frontend API client update (Issue #97)
4. ⚠️ Frontend types for tech_stack (Issue #97)
5. ⚠️ UI components (Issue #97)

**Verify infrastructure exists:**
```bash
# Check ChunkMetadata interface
cat packages/shared/src/index.ts | grep -A 2 "tech_stack"

# Check existing TODO comment (this is what you'll implement!)
cat apps/server/src/routes/search.ts | grep -n "TODO(Phase14)"
# Should show line 76: TODO(Phase14): accept tech_stack[] params

# Confirm tech_stack is being populated
cat apps/server/src/pipeline/code-chunker.ts | grep -A 2 "tech_stack ="
```

**If any check fails, Phase 13.5 is incomplete. DO NOT proceed with Phase 14.**

```

---

### Fix 3: Add Detailed Task for API Client Update

**File:** `docs/phases/phase-14/phase-14-prompts.md`

**Add after Task 2.3 (line ~287):**

```markdown

---

#### Task 2.3.1: Update API Client Method

**File:** `apps/web/src/lib/api.ts`

**What to do:**
1. Update `performSearch` method signature to accept optional `tech_stack` parameter
2. Include `tech_stack` in request body when provided

**Before:**
```typescript
async performSearch(query: string, collectionId: string, topK = 10): Promise<SearchResponse> {
  return this.request<SearchResponse>('/api/search', {
    method: 'POST',
    body: JSON.stringify({
      query,
      collection_id: collectionId,
      top_k: topK,
    }),
  });
}
```

**After:**
```typescript
async performSearch(
  query: string, 
  collectionId: string, 
  topK = 10,
  techStack?: string[]
): Promise<SearchResponse> {
  return this.request<SearchResponse>('/api/search', {
    method: 'POST',
    body: JSON.stringify({
      query,
      collection_id: collectionId,
      top_k: topK,
      ...(techStack && techStack.length > 0 && { tech_stack: techStack }),
    }),
  });
}
```

**Validation:**
- Method accepts 4th parameter (optional)
- tech_stack only included when provided and non-empty
- TypeScript compilation succeeds

```

---

### Fix 4: Add Frontend Type Definitions Task

**File:** `docs/phases/phase-14/phase-14-prompts.md`

**Add after Task 2.3.1:**

```markdown

---

#### Task 2.3.2: Update Frontend Types

**File:** `apps/web/src/types/index.ts`

**What to do:**
Add `tech_stack` to SearchResult metadata for future use (not required for Phase 14 but good practice)

**Optional enhancement:**
```typescript
export interface SearchResultMetadata {
  source_quality?: 'official' | 'verified' | 'community' | string | null;
  last_verified?: string | Date | null;
  tech_stack?: string[];  // Add this line
  [key: string]: unknown;
}
```

**Note:** This is optional. The API will already filter results by tech_stack. This just makes the field available in the response type for display purposes.

```

---

### Fix 5: Add Test File Creation Guidance

**File:** `docs/phases/phase-14/phase-14-prompts.md`

**Update Task 1.4 section (around line 140) to include:**

```markdown

#### Task 1.4: Write Tests

**Files to create/update:**
- `apps/server/src/services/__tests__/vector.test.ts` (CREATE NEW if doesn't exist)
- `apps/server/src/services/__tests__/search.test.ts` (UPDATE existing)
- `apps/server/src/routes/__tests__/search.integration.test.ts` (CREATE NEW if doesn't exist)

**Test Setup (if creating new test files):**

Create `apps/server/src/services/__tests__/vector.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Pool } from 'pg';
import { vectorSearch } from '../vector.js';

// Mock pool setup
let pool: Pool;

beforeEach(() => {
  // Setup test database connection
  pool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL,
  });
});

afterEach(async () => {
  await pool.end();
});

describe('Vector Search with tech_stack filtering', () => {
  it('should filter results when tech_stack provided', async () => {
    // Test implementation here
  });

  it('should return all results when tech_stack not provided', async () => {
    // Test implementation here
  });
});
```

**Unit Tests to Add:**
1. ✅ Vector search WITH tech_stack - should narrow results
2. ✅ Vector search WITHOUT tech_stack - should return baseline
3. ✅ Hybrid search WITH tech_stack - should narrow results
4. ✅ Hybrid search WITHOUT tech_stack - should return baseline
5. ✅ Empty tech_stack array - should behave like no filter
6. ✅ tech_stack with no matches - should return empty results

**Integration Test:**
Create or update `apps/server/src/routes/__tests__/search.integration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createTestServer } from '../../test-utils.js';

describe('POST /api/search with tech_stack', () => {
  it('should accept tech_stack parameter', async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: 'POST',
      url: '/api/search',
      payload: {
        query: 'database schema',
        collection_id: 'test-uuid',
        tech_stack: ['postgres', 'supabase'],
      },
    });
    
    expect(response.statusCode).toBe(200);
    // Add result assertions
  });

  it('should work without tech_stack (backward compatible)', async () => {
    const server = await createTestServer();
    const response = await server.inject({
      method: 'POST',
      url: '/api/search',
      payload: {
        query: 'database schema',
        collection_id: 'test-uuid',
        // No tech_stack provided
      },
    });
    
    expect(response.statusCode).toBe(200);
    // Add result assertions
  });
});
```

```

---

### Fix 6: Add Error Handling Section

**File:** `docs/phases/phase-14/phase-14-prompts.md`

**Add new section after Task 1.2 (around line 115):**

```markdown

---

#### Task 1.2.1: Add Defensive Error Handling

**IMPORTANT:** Add null checks and validation to prevent runtime errors.

**In vector search function:**
```typescript
// Add defensive checks
if (tech_stack && tech_stack.length > 0) {
  // Validate array
  if (!Array.isArray(tech_stack)) {
    throw new Error('tech_stack must be an array');
  }
  
  // Filter only
 non-empty strings
  const validTags = tech_stack.filter(tag => typeof tag === 'string' && tag.trim().length > 0);
  
  if (validTags.length > 0) {
    // Add WHERE clause with proper NULL handling
    whereConditions.push(`(
      metadata IS NOT NULL 
      AND metadata->'tech_stack' IS NOT NULL
      AND metadata->'tech_stack' ?| $${paramIndex}::text[]
    )`);
    queryParams.push(validTags);
    paramIndex++;
  }
}
```

**Error cases to handle:**
1. ✅ `metadata` is NULL
2. ✅ `metadata.tech_stack` is NULL
3. ✅ `metadata.tech_stack` is not an array
4. ✅ `tech_stack` parameter contains non-string values
5. ✅ `tech_stack` parameter is empty array
6. ✅ Database connection failures

```

---

### Fix 7: Clarify Parameter Naming Standard

**File:** `docs/phases/phase-14/PHASE_14_AGENT_PROMPT.md`

**Add after line 7:**

```markdown

**Parameter Naming:** Use `tech_stack` (snake_case) consistently. The codebase uses snake_case for all API parameters (`collection_id`, `top_k`, `min_similarity`, etc.). Do NOT use `techStack` (camelCase).

```

---

### Fix 8: Add Data Verification Section

**File:** `docs/phases/phase-14/phase-14-prompts.md`

**Add before Day 1 section (around line 55):**

```markdown

---

## 🔍 Data Verification (Optional but Recommended)

Before implementing filtering, verify that tech_stack data exists in your database:

```sql
-- Check if any chunks have tech_stack metadata
SELECT 
  COUNT(*) as total_chunks,
  COUNT(CASE WHEN metadata->'tech_stack' IS NOT NULL THEN 1 END) as chunks_with_tech_stack,
  jsonb_agg(DISTINCT metadata->'tech_stack') FILTER (WHERE metadata->'tech_stack' IS NOT NULL) as example_tech_stacks
FROM chunks
LIMIT 100;
```

**Expected output:**
- If Phase 13.5 is working: Some chunks should have tech_stack metadata
- If no chunks have tech_stack: Check that `TECH_STACK_TAGS=true` in `.env`

**Sample tech_stack values (from Phase 13.5):**
- SQL files: `["postgres", "postgresql", "supabase"]`
- Redis configs: `["redis"]`
- Supabase configs: `["supabase", "postgres"]`

**If no data exists:**
1. Set `TECH_STACK_TAGS=true` in `.env`
2. Re-ingest some documents
3. Run verification query again

```

---

## ✅ Summary of Fixes

| Fix | File | Type | Impact |
|-----|------|------|--------|
| 1 | 00_PHASE_14_OVERVIEW.md | Add section | HIGH - Clarifies prerequisites |
| 2 | phase-14-prompts.md | Add section | HIGH - Infrastructure verification |
| 3 | phase-14-prompts.md | Add task | HIGH - API client update guidance |
| 4 | phase-14-prompts.md | Add task | MEDIUM - Type definitions |
| 5 | phase-14-prompts.md | Update task | HIGH - Test file creation |
| 6 | phase-14-prompts.md | Add section | HIGH - Error handling |
| 7 | PHASE_14_AGENT_PROMPT.md | Add note | MEDIUM - Naming standard |
| 8 | phase-14-prompts.md | Add section | MEDIUM - Data verification |

---

## 🎯 Reviewer's Assessment: Corrected

### What Reviewer Got Wrong:
- ❌ "tech_stack metadata doesn't exist" - It DOES exist (Phase 13.5)
- ❌ "No data population strategy" - Phase 13.5 DOES populate it
- ❌ "TODO is a gap" - TODO is INTENTIONAL (it's the Phase 14 task!)

### What Reviewer Got Right:
- ✅ API client needs updating (missing parameter)
- ✅ Frontend types incomplete
- ✅ Some test files missing
- ✅ No error handling examples
- ✅ Parameter naming should be standardized
- ✅ Documentation should be more explicit about prerequisites

---

## 📊 Readiness Assessment: UPDATED

**After fixes:**
- Infrastructure: ✅ EXISTS (Phase 13.5)
- Documentation: ⚠️ NEEDS CLARIFICATION (8 fixes above)
- Coding Agent Readiness: ✅ READY after documentation fixes (2-3 hours)

**Critical insight:** The infrastructure is already there. The documentation just needs to be more explicit about what exists vs what Phase 14 adds.

---

**Next step:** Apply the 8 fixes above to Phase 14 documentation.

