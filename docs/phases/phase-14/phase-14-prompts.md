# Phase 14: Day-by-Day Agent Prompts (Master Guide)

**Duration:** 1-2 days  
**Status:** Ready to implement  
**GitHub Milestone:** [Phase 14: Tech Stack Filtering](https://github.com/Beaulewis1977/synthesis/milestone/8)

---

## 📚 Required Reading (Read BEFORE Starting)

**Read in this exact order:**
1. `docs/phases/phase-14/00_PHASE_14_OVERVIEW.md` - Understand scope and objectives
2. `docs/phases/phase-14/04_BUILD_PLAN.md` - Day-by-day implementation plan
3. `docs/phases/phase-14/05_ACCEPTANCE_CRITERIA.md` - What "done" looks like
4. `docs/phases/phase-14/06_INTEGRATION_GUIDE.md` - API integration details
5. `docs/phases/phase-13-5/ROADMAP_PHASE_14_PLUS.md` - **Context only; do NOT implement these items**

---

## 🚫 Critical: Do NOT Implement (Phase 14+ Roadmap)

The following are explicitly OUT OF SCOPE for Phase 14:
- ❌ Multi-source ingestion with worker queues
- ❌ Redis hot/cold caching
- ❌ Evaluation dashboards
- ❌ Agentic self-critique workflows
- ❌ Multimodal embeddings (images/diagrams)

**If you see these mentioned anywhere, skip them. They belong to Phase 15+.**

---

## 🎯 Phase 14 Goals Summary

**What we're building:**
- Backend tech_stack filtering (vector + hybrid search paths)
- Optional frontend filter UI with URL persistence
- JSONB index guidance documentation
- Complete testing and documentation

**Why it matters:**
- Enables users to filter search results by technology stack
- Completes the Phase 13.5 backend parsing work
- Keeps system backward compatible (filtering is optional)

---

## Git Branch
```bash
git checkout -b feature/phase-14-tech-stack
```

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
grep "tech_stack" packages/shared/src/index.ts
# Should show: tech_stack?: string[];

# Check existing TODO comment (this is what you'll implement!)
grep -n "TODO(Phase14)" apps/server/src/routes/search.ts
# Should show line 76: TODO(Phase14): accept tech_stack[] params

# Confirm tech_stack is being populated
grep "metadata.tech_stack = techStack" apps/server/src/pipeline/code-chunker.ts
# Should find where tech_stack is assigned
```

**If any check fails, Phase 13.5 is incomplete. DO NOT proceed with Phase 14.**

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

---

## 📋 Day 1: Backend Filtering Implementation

**GitHub Issue:** [#96 - Backend: Apply tech_stack filtering (vector + hybrid)](https://github.com/Beaulewis1977/synthesis/issues/96)  
**Estimated Time:** 4-6 hours  
**Priority:** HIGH - Core functionality

### Morning Session (2-3 hours)

#### Task 1.1: Wire tech_stack Through API Route
**File:** `apps/server/src/routes/search.ts`

**What to do:**
1. Add `tech_stack` (or `techStack` for camelCase) to the route schema validation
2. Make it optional (array of strings)
3. Pass the validated parameter to `smartSearch(...)` function
4. Ensure backward compatibility (parameter can be undefined/null/empty)

**Example:**
```typescript
// In route schema
tech_stack: z.array(z.string()).optional(),

// Pass to service
const results = await smartSearch({
  query,
  collectionId,
  topK,
  tech_stack, // Pass through
});
```

**Validation:**
- Route accepts `tech_stack` parameter
- Route works without `tech_stack` (backward compatible)
- TypeScript compilation succeeds

---

#### Task 1.2: Apply Filtering in Vector Search Path
**File:** `apps/server/src/services/vector.ts`

**What to do:**
1. Accept `tech_stack` parameter in vector search function
2. Add WHERE clause to SQL query: filter by `metadata->'tech_stack'` (JSONB)
3. Use PostgreSQL JSONB operators for array intersection
4. Only apply filter when `tech_stack` is present and non-empty

**SQL Example:**
```sql
WHERE (
  $5::text[] IS NULL 
  OR metadata->'tech_stack' ?| $5::text[]
)
```

**Validation:**
- Query returns filtered results when `tech_stack` provided
- Query returns all results when `tech_stack` is null/empty
- No SQL errors or performance degradation

---

### Afternoon Session (2-3 hours)

#### Task 1.3: Apply Filtering in Hybrid Search Path
**File:** `apps/server/src/services/search.ts`

**What to do:**
1. In `smartSearch` function, pass `tech_stack` to both vector and BM25 calls
2. For hybrid path: apply filter to candidates BEFORE fusion/rerank
3. Maintain same filter logic (intersection with metadata.tech_stack)
4. Ensure behavior unchanged when tags absent

**Implementation notes:**
- Filter should be applied consistently across vector and BM25 results
- Fusion/rerank should only operate on filtered candidates
- Performance should remain within target (<600ms p95)

**Validation:**
- Hybrid search respects tech_stack filter
- Fusion/rerank works correctly with filtered results
- Performance targets maintained

---

#### Task 1.4: Write Tests
**Files:** 
- `apps/server/src/services/__tests__/vector.test.ts` (CREATE NEW)
- `apps/server/src/services/__tests__/search.test.ts` (EXTEND EXISTING)
- `apps/server/src/routes/__tests__/search.test.ts` (EXTEND EXISTING)

**Testing Framework:**
- Backend uses **Vitest** (NOT Jest!) - See `apps/server/package.json:10`
- Test files use `.test.ts` suffix
- Place test files in `__tests__` directories
- Import from `vitest` (not jest)

**IMPORTANT:** `search.test.ts` files ALREADY EXIST in both `services/__tests__` and `routes/__tests__`. You should EXTEND them with new test cases for tech_stack filtering, not recreate them.

**1. CREATE NEW: `apps/server/src/services/__tests__/vector.test.ts`:**
```typescript
import type { Pool } from 'pg';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { vectorSearch } from '../vector.js';

// Mock the database
vi.mock('@synthesis/db', () => ({
  getPool: vi.fn(() => ({})),
}));

describe('vectorSearch with tech_stack filtering', () => {
  let db: Pick<Pool, 'query'>;

  beforeEach(() => {
    db = {
      query: vi.fn(),
    } as unknown as Pick<Pool, 'query'>;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should filter results by tech_stack when provided', async () => {
    const mockRows = [
      {
        id: 1,
        content: 'PostgreSQL query',
        metadata: { tech_stack: ['postgres', 'sql'] },
        distance: 0.2,
      },
    ];

    (db.query as vi.MockedFunction<Pool['query']>).mockResolvedValue({
      rows: mockRows,
    } as any);

    const results = await vectorSearch(db as Pool, {
      embedding: [0.1, 0.2, 0.3],
      collectionId: 'test-collection',
      topK: 10,
      tech_stack: ['postgres'],
    });
    
    // Assert: all results have 'postgres' in metadata.tech_stack
    expect(results.length).toBeGreaterThan(0);
    results.forEach(result => {
      expect(result.metadata.tech_stack).toContain('postgres');
    });
  });

  it('should return baseline results when tech_stack omitted', async () => {
    const mockRows = [
      {
        id: 1,
        content: 'Some content',
        metadata: {},
        distance: 0.2,
      },
    ];

    (db.query as vi.MockedFunction<Pool['query']>).mockResolvedValue({
      rows: mockRows,
    } as any);

    const results = await vectorSearch(db as Pool, {
      embedding: [0.1, 0.2, 0.3],
      collectionId: 'test-collection',
      topK: 10,
    });
    
    // Assert: results are not filtered
    expect(results.length).toBeGreaterThan(0);
  });
});
```

**2. EXTEND EXISTING: `apps/server/src/services/__tests__/search.test.ts`:**
Add these test cases to the existing file:
```typescript
// Add to existing describe block or create new one
describe('smartSearch with tech_stack filtering', () => {
  it('should apply tech_stack filter in vector mode', async () => {
    (smartSearch as vi.Mock).mockResolvedValue({
      query: 'test',
      results: [
        {
          id: 1,
          text: 'PostgreSQL content',
          metadata: { tech_stack: ['postgres'] },
          similarity: 0.9,
        },
      ],
      totalResults: 1,
      searchTimeMs: 42,
      metadata: { searchMode: 'vector' },
    });

    const results = await smartSearch(db as Pool, {
      query: 'database query',
      collectionId: 'test-collection',
      topK: 10,
      tech_stack: ['postgres', 'supabase'],
    });
    
    // Assert: smartSearch was called with tech_stack
    expect(smartSearch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tech_stack: ['postgres', 'supabase'],
      })
    );
  });
});
```

**3. EXTEND EXISTING: `apps/server/src/routes/__tests__/search.test.ts`:**
Add these test cases to the existing file:
```typescript
// Add to existing describe('POST /api/search route') block
it('should accept tech_stack parameter and filter results', async () => {
  (smartSearch as vi.Mock).mockResolvedValue({
    query: 'test',
    results: [
      {
        id: 1,
        text: 'PostgreSQL content',
        metadata: { tech_stack: ['postgres'] },
        similarity: 0.9,
        docId: 'doc-1',
        docTitle: 'Doc',
        sourceUrl: null,
        citation: { title: 'Doc' },
      },
    ],
    totalResults: 1,
    searchTimeMs: 42,
    metadata: { searchMode: 'vector' },
  });

  const response = await fastify.inject({
    method: 'POST',
    url: '/api/search',
    payload: {
      query: 'database connection',
      collection_id: '11111111-1111-4111-8111-111111111111',
      tech_stack: ['postgres'],
    },
  });
  
  expect(response.statusCode).toBe(200);
  const body = JSON.parse(response.payload);
  expect(body.results).toBeDefined();
  expect(smartSearch).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      tech_stack: ['postgres'],
    })
  );
});

it('should work without tech_stack (backward compatible)', async () => {
  (smartSearch as vi.Mock).mockResolvedValue({
    query: 'test',
    results: [],
    totalResults: 0,
    searchTimeMs: 10,
    metadata: { searchMode: 'vector' },
  });

  const response = await fastify.inject({
    method: 'POST',
    url: '/api/search',
    payload: {
      query: 'database connection',
      collection_id: '11111111-1111-4111-8111-111111111111',
    },
  });
  
  expect(response.statusCode).toBe(200);
});
```

**Commands:**
```bash
# Run all tests (Vitest)
pnpm --filter @synthesis/server test

# Run specific test file
pnpm --filter @synthesis/server test vector.test

# Watch mode (re-run on file changes)
pnpm --filter @synthesis/server test:watch

# Run with coverage
pnpm --filter @synthesis/server test --coverage

# Typecheck
pnpm typecheck
```

**Vitest Tips:**
- Use `vi.fn()` for mocks (not `jest.fn()`)
- Use `vi.mock()` for module mocks (not `jest.mock()`)
- Import pattern: `fastify.inject()` for route testing (uses Fastify's built-in test injection)
- No need for supertest - Fastify has native test support

**Validation:**
- All tests pass (new + existing)
- Code coverage maintained or improved
- No TypeScript errors
- Tests verify both filtered and unfiltered cases

---

### End of Day 1 Checklist

- [ ] Route accepts and validates `tech_stack` parameter
- [ ] Vector search filtering implemented and tested
- [ ] Hybrid search filtering implemented and tested
- [ ] Unit tests written and passing
- [ ] Integration test written and passing
- [ ] Typecheck clean
- [ ] Backward compatibility verified (works without tech_stack)
- [ ] Error handling implemented (see below)
- [ ] Commit and push to `feature/phase-14-tech-stack` branch

**If blocked:** Reference `docs/phases/phase-14/06_INTEGRATION_GUIDE.md` for API examples

---

## 🚨 Error Handling (Critical!)

**DO NOT skip error handling.** Add these checks to your implementation:

### Backend Error Handling

**1. Route Validation Errors**
**File:** `apps/server/src/routes/search.ts`

```typescript
const SearchBodySchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  collection_id: z.string(),
  top_k: z.number().int().positive().optional(),
  tech_stack: z.array(z.string()).optional(),
  // ... other fields
});

// In route handler
try {
  const body = SearchBodySchema.parse(req.body);
  // ... proceed with search
} catch (error) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.errors,
    });
  }
  throw error;
}
```

**2. Service-Level Errors**
**File:** `apps/server/src/services/search.ts`

```typescript
export async function smartSearch(pool: Pool, params: SearchParams) {
  try {
    // Validate tech_stack is array if provided
    if (params.tech_stack && !Array.isArray(params.tech_stack)) {
      throw new Error('tech_stack must be an array');
    }

    // Validate tech_stack values are strings
    if (params.tech_stack?.some(tag => typeof tag !== 'string')) {
      throw new Error('tech_stack must contain only strings');
    }

    // ... proceed with search logic
  } catch (error) {
    console.error('[smartSearch] Error:', error);
    throw error; // Re-throw to be handled by route
  }
}
```

**3. Database Query Errors**
**File:** `apps/server/src/services/vector.ts`

```typescript
export async function vectorSearch(pool: Pool, params: VectorSearchParams) {
  try {
    let query = `
      SELECT id, content, metadata, embedding <=> $1 AS distance
      FROM chunks
      WHERE collection_id = $2
    `;
    
    const queryParams: any[] = [params.embedding, params.collectionId];

    if (params.tech_stack && params.tech_stack.length > 0) {
      // Ensure metadata->tech_stack is valid JSONB array
      query += ` AND metadata->'tech_stack' ?| $3`;
      queryParams.push(params.tech_stack);
    }

    query += ` ORDER BY distance LIMIT $${queryParams.length + 1}`;
    queryParams.push(params.topK);

    const result = await pool.query(query, queryParams);
    return result.rows;
  } catch (error) {
    console.error('[vectorSearch] Database error:', error);
    throw new Error(`Vector search failed: ${error.message}`);
  }
}
```

### Frontend Error Handling

**File:** `apps/web/src/lib/api.ts`

```typescript
async performSearch(
  query: string, 
  collectionId: string, 
  topK = 10,
  techStack?: string[]
): Promise<SearchResponse> {
  try {
    const body: Record<string, unknown> = {
      query,
      collection_id: collectionId,
      top_k: topK,
    };

    if (techStack && techStack.length > 0) {
      body.tech_stack = techStack;
    }

    return await this.request<SearchResponse>('/api/search', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error('[performSearch] Error:', error);
    // Re-throw with user-friendly message
    throw new Error('Search failed. Please try again.');
  }
}
```

**File:** `apps/web/src/pages/SearchPage.tsx`

```tsx
const handleSearch = async () => {
  try {
    setLoading(true);
    setError(null);
    
    const results = await apiClient.performSearch(
      query,
      collectionId,
      topK,
      selectedTechStack
    );
    
    setResults(results);
  } catch (error) {
    console.error('Search error:', error);
    setError(error instanceof Error ? error.message : 'Search failed');
  } finally {
    setLoading(false);
  }
};
```

### Common Error Scenarios to Handle

1. **Empty tech_stack array**: Should be treated as "no filter" (not an error)
2. **Invalid tech_stack values**: Return 400 with clear message
3. **tech_stack is not an array**: Return 400 with clear message
4. **Database query failure**: Return 500 with generic message (don't expose DB details)
5. **No results found**: Return empty array (not an error)
6. **Network timeout**: Frontend should show retry option

**Test your error handling:**
```bash
# Test invalid input
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "collection_id": "123", "tech_stack": "not-an-array"}'
# Should return 400 error

# Test empty array (should work)
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "collection_id": "123", "tech_stack": []}'
# Should return 200 with unfiltered results
```

---

## 📋 Day 2 Morning: Frontend UI (Optional)

**GitHub Issue:** [#97 - Frontend: Optional tech_stack filter UI with URL persistence](https://github.com/Beaulewis1977/synthesis/issues/97)  
**Estimated Time:** 2-3 hours  
**Priority:** MEDIUM - Optional but recommended

### Task 2.0: Update API Client (PREREQUISITE)
**File:** `apps/web/src/lib/api.ts`

**What to do:**
1. Update `performSearch` method signature to accept optional `tech_stack` parameter
2. Add tech_stack to request body when present
3. Ensure backward compatibility (parameter is optional)

**Current code (lines ~47-57):**
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

**Updated code:**
```typescript
async performSearch(
  query: string, 
  collectionId: string, 
  topK = 10,
  techStack?: string[]  // NEW: optional tech_stack parameter
): Promise<SearchResponse> {
  const body: Record<string, unknown> = {
    query,
    collection_id: collectionId,
    top_k: topK,
  };

  // Add tech_stack only if provided
  if (techStack && techStack.length > 0) {
    body.tech_stack = techStack;
  }

  return this.request<SearchResponse>('/api/search', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
```

**Validation:**
- Method signature updated with optional `techStack?: string[]` parameter
- Backend receives `tech_stack` in request body when provided
- Method still works without tech_stack (backward compatible)
- TypeScript typecheck passes

**Why this comes first:**
The UI components (Task 2.1-2.3) will call this updated method. Complete this task before building the UI.

---

### Task 2.1: Add Filter Chips UI
**File:** `apps/web/src/pages/SearchPage.tsx`

**What to do:**
1. Add multi-select chips component above search results
2. Static list of common tech stacks: `['postgres', 'supabase', 'redis', 'flutter', 'typescript']`
3. Clicking a chip toggles selection (visual feedback)
4. Store selected tags in component state

**UI Example:**
```tsx
<div className="flex gap-2 mb-4">
  <span className="text-sm text-gray-600">Filter by tech stack:</span>
  {TECH_STACKS.map(tag => (
    <button
      key={tag}
      onClick={() => toggleTag(tag)}
      className={`px-3 py-1 rounded-full text-sm ${
        selectedTags.includes(tag)
          ? 'bg-blue-500 text-white'
          : 'bg-gray-200 text-gray-700'
      }`}
    >
      {tag}
    </button>
  ))}
</div>
```

**Validation:**
- Chips render and are clickable
- Selection state updates on click
- Visual feedback shows selected/unselected state

---

### Task 2.2: URL Persistence
**File:** `apps/web/src/pages/SearchPage.tsx`

**What to do:**
1. Read `tech_stack` params from URL on component mount
2. Initialize selected tags from URL params
3. Update URL when tags are selected/deselected
4. Use repeated query params: `?tech_stack=postgres&tech_stack=redis`

**Implementation:**
```tsx
// Read from URL
const searchParams = new URLSearchParams(location.search);
const tagsFromUrl = searchParams.getAll('tech_stack');

// Update URL
const updateUrl = (tags: string[]) => {
  const params = new URLSearchParams(location.search);
  params.delete('tech_stack');
  tags.forEach(tag => params.append('tech_stack', tag));
  navigate(`?${params.toString()}`, { replace: true });
};
```

**Validation:**
- URL updates when tags selected
- Page reload preserves selected tags
- Back/forward navigation works correctly

---

### Task 2.3: Include Tags in API Request
**File:** `apps/web/src/pages/SearchPage.tsx` or API client

**What to do:**
1. Include `tech_stack` array in POST /api/search body
2. Only include when tags are selected (omit if empty)
3. Handle API errors gracefully

**Request Example:**
```typescript
const response = await fetch('/api/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query,
    collection_id: collectionId,
    top_k: topK,
    ...(selectedTags.length > 0 && { tech_stack: selectedTags }),
  }),
});
```

**Validation:**
- Request includes `tech_stack` when tags selected
- Request omits `tech_stack` when no tags selected
- Search results reflect filtering

---

### Task 2.3.5: Add Frontend Type Definitions (If Not Exists)
**File:** `apps/web/src/types/index.ts`

**What to do:**
1. Verify that frontend types include `tech_stack` in search request/response
2. Add or update types as needed for type safety

**Current types to check:**
```typescript
// Search request body
export interface SearchRequest {
  query: string;
  collection_id: string;
  top_k?: number;
  tech_stack?: string[];  // ADD THIS if not present
}

// Search response (if you want to show tech_stack in results)
export interface ChunkResult {
  id: string;
  content: string;
  metadata?: {
    tech_stack?: string[];  // ADD THIS if not present
    [key: string]: unknown;
  };
  similarity?: number;
}
```

**What to add if missing:**
```typescript
// In apps/web/src/types/index.ts

export interface SearchRequest {
  query: string;
  collection_id: string;
  top_k?: number;
  min_similarity?: number;
  tech_stack?: string[];  // NEW: tech stack filtering
}

export interface ChunkMetadata {
  file_path?: string;
  language?: string;
  tech_stack?: string[];  // NEW: tech stack tags
  [key: string]: unknown;
}

export interface ChunkResult {
  id: string;
  content: string;
  metadata?: ChunkMetadata;
  similarity?: number;
}
```

**Validation:**
- TypeScript recognizes `tech_stack` in request bodies
- No type errors when passing `tech_stack` to `apiClient.performSearch()`
- `pnpm typecheck` passes in `apps/web`

**Why this matters:**
Frontend type definitions ensure type safety when calling the API client and handling responses. Without these types, TypeScript may flag errors when you use `tech_stack`.

---

### Task 2.4: Frontend Tests
**File:** `apps/web/src/pages/__tests__/SearchPage.test.tsx`

**What to test:**
1. Chips render correctly
2. Clicking chip toggles selection
3. URL updates when tags selected
4. Tags load from URL on mount
5. API request includes tags when selected

**Commands:**
```bash
pnpm --filter @synthesis/web test
pnpm typecheck
```

**Validation:**
- All component tests pass
- TypeScript errors resolved
- UI behaves as expected

---

## 📋 Day 2 Afternoon: Documentation & Closure

### Task 3: DB/Docs - JSONB Index Guidance

**GitHub Issue:** [#98 - DB/Docs: JSONB index guidance for tech_stack](https://github.com/Beaulewis1977/synthesis/issues/98)  
**Estimated Time:** 1 hour  
**Priority:** LOW - Documentation only

**File:** `docs/phases/phase-14/06_INTEGRATION_GUIDE.md`

**What to add:**

Add a "Performance Optimization (Optional)" section with:

1. **When to apply index:**
   - Dataset size >10,000 documents
   - Frequent use of tech_stack filtering (>30% of queries)
   - p95 latency regression >100ms

2. **Example SQL:**
```sql
-- Optional: Only create if filtering performance regresses
-- Recommended for datasets >10,000 documents

CREATE INDEX IF NOT EXISTS idx_chunks_metadata_tech_stack 
  ON chunks USING gin ((metadata->'tech_stack'));
```

3. **Trade-offs:**
   - Pro: Faster JSONB filtering queries
   - Pro: Scales to large corpora
   - Con: Slower writes (inserts/updates)
   - Con: Additional storage (~5-10%)

4. **Migration filename suggestion:**
   - `packages/db/migrations/007_tech_stack_index.sql`

**DO NOT create the migration file** - just document the guidance.

**Validation:**
- Documentation is clear and actionable
- Examples are correct
- Guidance explains when/why to apply index

---

### Task 4: Docs & Closure

**GitHub Issue:** [#73 - Docs & Closure: Update docs and close Epic](https://github.com/Beaulewis1977/synthesis/issues/73)  
**Estimated Time:** <1 hour  
**Priority:** HIGH - Final validation

**What to do:**

1. **Verify Acceptance Criteria (from `05_ACCEPTANCE_CRITERIA.md`):**
   - [ ] Backend applies `tech_stack` filter when provided
   - [ ] Vector path narrows results by `metadata.tech_stack`
   - [ ] Hybrid path narrows candidates before fusion/rerank
   - [ ] Frontend sends `tech_stack[]` and persists tags in URL (if implemented)
   - [ ] Behavior unchanged when no tags provided
   - [ ] Unit tests for service filtering pass
   - [ ] Integration test proves end-to-end filtering works
   - [ ] Typecheck clean
   - [ ] Lint clean
   - [ ] Integration guide updated with examples

2. **Update documentation if needed:**
   - Fix any minor discrepancies found during implementation
   - Update Integration Guide with actual implementation details
   - Ensure all file paths are correct

3. **Final validation:**
```bash
# Run all tests
pnpm --filter @synthesis/server test
pnpm --filter @synthesis/web test

# Typecheck
pnpm typecheck

# Lint
pnpm lint
```

4. **Close Phase 14:**
   - Mark all issues as complete
   - Close the Phase 14 milestone
   - Create PR for review

---

## 🔍 Verification Commands

Run these throughout implementation:

```bash
# Backend tests
pnpm --filter @synthesis/server test

# Frontend tests
pnpm --filter @synthesis/web test

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Full validation
pnpm test && pnpm typecheck && pnpm lint
```

---

## ✅ Phase 14 Complete Checklist

**Backend (#96):**
- [ ] Route accepts `tech_stack` parameter
- [ ] Vector search filtering implemented
- [ ] Hybrid search filtering implemented
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Backward compatibility verified

**Frontend (#97) - Optional:**
- [ ] Filter chips UI implemented
- [ ] URL persistence working
- [ ] API requests include tags
- [ ] Component tests passing

**Documentation (#98):**
- [ ] Integration Guide updated with index guidance
- [ ] Performance considerations documented
- [ ] Migration strategy clear

**Closure (#73):**
- [ ] All acceptance criteria met
- [ ] Documentation accurate
- [ ] All tests passing
- [ ] PR created and ready for review

---

## 🚨 Common Pitfalls to Avoid

1. **Don't modify Phase 14+ features** - Stick to tech_stack filtering only
2. **Don't create the index migration** - Document guidance only
3. **Don't break backward compatibility** - Filter must be optional
4. **Don't skip tests** - Both unit and integration tests required
5. **Don't forget URL persistence** - Frontend state must survive reload

---

## 📞 Need Help?

**If stuck:**
1. Re-read the relevant section in `docs/phases/phase-14/06_INTEGRATION_GUIDE.md`
2. Check existing code for similar patterns (e.g., other filter implementations)
3. Verify you're following the build plan in `04_BUILD_PLAN.md`
4. Ensure you haven't accidentally included Phase 14+ roadmap items

**Reference Issues:**
- [#96 - Backend filtering](https://github.com/Beaulewis1977/synthesis/issues/96)
- [#97 - Frontend UI](https://github.com/Beaulewis1977/synthesis/issues/97)
- [#98 - DB/Docs](https://github.com/Beaulewis1977/synthesis/issues/98)
- [#73 - Closure](https://github.com/Beaulewis1977/synthesis/issues/73)

---

**Happy coding! Remember: Small, focused changes. Backward compatible. Well tested.**


