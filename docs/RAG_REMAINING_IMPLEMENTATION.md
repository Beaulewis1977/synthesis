# RAG Implementation - Remaining Work

**Version:** 1.0  
**Created:** November 2025  
**Parent Document:** `docs/RAG_AND_MODEL_SELECTOR_IMPLEMENTATION_PLAN.md`  
**Status:** Ready for Implementation

---

## Overview

This document contains all remaining work from the RAG & Model Selector Implementation Plan. The backend implementation for Phases 1-14 is **complete and working**. The remaining work is primarily **UI components** and **accessibility improvements**.

**Before starting**, read the parent document `docs/RAG_AND_MODEL_SELECTOR_IMPLEMENTATION_PLAN.md` for full context on:
- GitHub workflow (Section 2)
- Design system and component patterns (Section 21)
- Existing implementations that these features build upon

---

## Quick Reference: What's Done vs. Remaining

| Area | Done | Remaining |
|------|------|-----------|
| Phase 12 (Query Intent) | Backend: `query-intent.ts`, 78 tests, search integration | **UI: intent badge, mode indicator, override settings** |
| Phase 13 (MMR) | Backend + UI toggle + lambda slider + diversity indicator | Per-collection defaults (deferred) |
| Phase 14 (AST Languages) | All analyzers (Python, Java, Go, Rust, C/C++), registry | **UI: language badges on collections** |
| Accessibility | Basic structure | **aria-describedby, focus states audit** |

---

## Task 1: Query Intent UI Components (Phase 12)

**Reference:** Parent doc Section 15.5

**Backend Already Provides:**
- `apps/server/src/services/query-intent.ts` - Intent detection with 6 types
- Search API returns `intent` field in response metadata
- Intent types: `code_symbol`, `natural_language`, `error_message`, `api_lookup`, `conceptual`, `comparison`

### 1.1 Intent Badge in Search Results Header

**Location:** `apps/web/src/pages/SearchPage.tsx`

Add an intent badge that displays the detected query intent after search results load.

**Requirements:**
- Display intent type with appropriate icon
- Show only when search has results
- Use existing design tokens

**Mockup:**
```
┌─ Search Results ─────────────────────────────────────────────┐
│ Query: "How do I navigate between screens in Flutter?"      │
│ Intent: 🔍 natural_language  |  Mode: hybrid (0.8 vector)   │
├──────────────────────────────────────────────────────────────┤
```

**Implementation Guide:**

```tsx
// Intent icons mapping
const INTENT_ICONS: Record<QueryIntent, { icon: LucideIcon; label: string; color: string }> = {
  code_symbol: { icon: Code2, label: 'Code Symbol', color: 'text-blue-500' },
  natural_language: { icon: Search, label: 'Natural Language', color: 'text-green-500' },
  error_message: { icon: AlertCircle, label: 'Error Message', color: 'text-red-500' },
  api_lookup: { icon: FileText, label: 'API Lookup', color: 'text-purple-500' },
  conceptual: { icon: Lightbulb, label: 'Conceptual', color: 'text-yellow-500' },
  comparison: { icon: GitCompare, label: 'Comparison', color: 'text-orange-500' },
};

// Add to SearchPage.tsx after the results count display
{data?.metadata?.intent && (
  <div className="flex items-center gap-xs text-sm text-text-secondary mt-xs">
    <IntentIcon intent={data.metadata.intent.type} />
    <span>{INTENT_ICONS[data.metadata.intent.type].label}</span>
    <span className="text-text-tertiary">|</span>
    <span>Mode: {data.metadata.search_mode}</span>
    {data.metadata.diagnostics?.weights && (
      <span className="text-text-tertiary">
        ({(data.metadata.diagnostics.weights.vector * 100).toFixed(0)}% vector)
      </span>
    )}
  </div>
)}
```

**Files to Modify:**
- `apps/web/src/pages/SearchPage.tsx` - Add intent display
- `apps/web/src/types/index.ts` - Add QueryIntent type if not present

**API Response Format (already implemented):**
```json
{
  "metadata": {
    "intent": {
      "type": "natural_language",
      "confidence": 0.85,
      "signals": ["question_word", "how_pattern"]
    },
    "search_mode": "hybrid",
    "diagnostics": {
      "weights": { "vector": 0.8, "bm25": 0.2 }
    }
  }
}
```

### 1.2 Mode/Weight Indicator (Collapsible)

**Location:** `apps/web/src/pages/SearchPage.tsx`

Expand the existing "Advanced Settings" section or create a collapsible details panel.

**Requirements:**
- Show current search mode (vector/hybrid)
- Display weight configuration (vector weight, BM25 weight)
- Collapsible to not clutter UI

**Implementation:**
Add to the existing `showAdvanced` section in SearchPage.tsx:

```tsx
{/* Search Configuration Details */}
{data?.metadata?.diagnostics && (
  <div className="mt-sm p-3 bg-bg-tertiary rounded-lg text-xs">
    <div className="grid grid-cols-2 gap-sm">
      <div>
        <span className="text-text-secondary">Mode:</span>
        <span className="ml-xs font-medium">{data.metadata.search_mode}</span>
      </div>
      <div>
        <span className="text-text-secondary">Intent:</span>
        <span className="ml-xs font-medium">{data.metadata.intent?.type || 'auto'}</span>
      </div>
      <div>
        <span className="text-text-secondary">Vector Weight:</span>
        <span className="ml-xs font-medium">{data.metadata.diagnostics.weights?.vector}</span>
      </div>
      <div>
        <span className="text-text-secondary">BM25 Weight:</span>
        <span className="ml-xs font-medium">{data.metadata.diagnostics.weights?.bm25}</span>
      </div>
    </div>
  </div>
)}
```

### 1.3 Intent Override Settings

**Location:** `apps/web/src/pages/SearchPage.tsx`

Add ability for user to manually set intent when auto-detection is wrong.

**Requirements:**
- Dropdown to select intent type
- "Auto" option (default) uses backend detection
- Override persists in URL params

**Implementation:**

```tsx
// Add to Advanced Settings section
<div className="flex items-center justify-between">
  <div>
    <label htmlFor="intent-override" className="font-medium text-text-primary">
      Query Intent
    </label>
    <p className="text-xs text-text-secondary mt-0.5">
      Override automatic intent detection
    </p>
  </div>
  <select
    id="intent-override"
    value={intentOverride || 'auto'}
    onChange={(e) => handleIntentChange(e.target.value)}
    className="px-3 py-1.5 border border-border rounded-lg text-sm bg-bg-primary"
  >
    <option value="auto">Auto-detect</option>
    <option value="code_symbol">Code Symbol</option>
    <option value="natural_language">Natural Language</option>
    <option value="error_message">Error Message</option>
    <option value="api_lookup">API Lookup</option>
    <option value="conceptual">Conceptual</option>
    <option value="comparison">Comparison</option>
  </select>
</div>
```

**API Integration:**
The search API already accepts `intent` as a query parameter:
```typescript
// In apiClient.performSearch(), add intent parameter
performSearch(query, collectionId, limit, techStack, mmrOptions, intentOverride)
```

---

## Task 2: Language Support Badges (Phase 14)

**Reference:** Parent doc Section 17.5

**Backend Already Provides:**
- `apps/server/src/pipeline/analyzers/registry.ts` - Registry with language metadata
- All analyzers registered with capabilities metadata
- `LanguageSupportBadge.tsx` component **already created** but not integrated

### 2.1 Integrate LanguageSupportBadge into Collection Views

**Existing Component:** `apps/web/src/components/LanguageSupportBadge.tsx`

This component is fully implemented but NOT imported anywhere. It provides:
- `LanguageSupportBadge` - Single language badge with parser type icon
- `CollectionLanguageSummary` - Aggregated view for multiple languages

**Files to Modify:**

1. **Collection Detail Page** - `apps/web/src/pages/CollectionPage.tsx` (or similar)
   
   Add language summary showing detected languages in the collection:
   
   ```tsx
   import { CollectionLanguageSummary } from '../components/LanguageSupportBadge';
   
   // In the collection header area
   {collection.languageStats && (
     <div className="mt-md">
       <h4 className="text-sm font-medium text-text-secondary mb-xs">Languages</h4>
       <CollectionLanguageSummary languages={collection.languageStats} />
     </div>
   )}
   ```

2. **Collection Card** - `apps/web/src/components/CollectionCard.tsx`
   
   Add compact language badges:
   
   ```tsx
   import { CollectionLanguageSummary } from './LanguageSupportBadge';
   
   // After description, before action buttons
   {collection.languages && collection.languages.length > 0 && (
     <div className="mb-md">
       <CollectionLanguageSummary 
         languages={collection.languages} 
         maxDisplay={3} 
       />
     </div>
   )}
   ```

### 2.2 API Endpoint for Language Stats

**Need to verify/create:** Backend endpoint to return language statistics per collection.

Check if this exists:
```bash
grep -r "languageStats\|language_stats" apps/server/src/routes/
```

If not, create endpoint:

**File:** `apps/server/src/routes/collections.ts`

```typescript
// GET /api/collections/:id/languages
router.get('/:id/languages', async (req, res) => {
  const { id } = req.params;
  
  // Query documents in collection, aggregate by language
  const stats = await getCollectionLanguageStats(id);
  
  // Returns array of LanguageSupportStatus objects
  res.json(stats);
});
```

**Service Function:** `apps/server/src/services/collection-service.ts`

```typescript
import { analyzerRegistry, getLanguageFromPath } from '../pipeline/analyzers/registry.js';

export async function getCollectionLanguageStats(collectionId: string): Promise<LanguageSupportStatus[]> {
  // 1. Get all documents in collection with file_path metadata
  // 2. Extract file extensions
  // 3. Group by language
  // 4. Return LanguageSupportStatus for each language with file count
}
```

### 2.3 Chunking Quality Indicator

**Reference:** Parent doc Section 17.5 mockup showing quality bar

**Location:** Collection detail page

```tsx
// Chunking Quality indicator
{collection.chunkingQuality !== undefined && (
  <div className="mt-md">
    <div className="flex items-center gap-sm">
      <span className="text-sm text-text-secondary">Chunking Quality:</span>
      <div className="flex-1 max-w-xs h-2 bg-bg-tertiary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${
            collection.chunkingQuality >= 80 ? 'bg-success' :
            collection.chunkingQuality >= 50 ? 'bg-warning' : 'bg-error'
          }`}
          style={{ width: `${collection.chunkingQuality}%` }}
        />
      </div>
      <span className="text-sm font-medium">{collection.chunkingQuality}%</span>
    </div>
  </div>
)}
```

**Quality Calculation:** Already implemented in registry.ts as `calculateChunkingQuality()`.

---

## Task 3: Accessibility Improvements

**Reference:** Parent doc Section 21.6

### 3.1 Add aria-describedby for Error Messages

**Files to Audit:**
- `apps/web/src/components/settings/ModelConfigCard.tsx`
- `apps/web/src/components/settings/ApiKeyManager.tsx`
- `apps/web/src/pages/SearchPage.tsx`
- Any form components

**Pattern to Implement:**

```tsx
// Before (typical pattern without accessibility)
<input
  type="text"
  value={value}
  onChange={handleChange}
  className={error ? 'border-error' : 'border-border'}
/>
{error && <p className="text-error text-sm">{error}</p>}

// After (with aria-describedby)
<input
  type="text"
  id="api-key-input"
  value={value}
  onChange={handleChange}
  aria-invalid={!!error}
  aria-describedby={error ? 'api-key-error' : undefined}
  className={error ? 'border-error' : 'border-border'}
/>
{error && (
  <p id="api-key-error" className="text-error text-sm" role="alert">
    {error}
  </p>
)}
```

### 3.2 Focus Visible States Audit

**Ensure all interactive elements have visible focus:**

```css
/* In global CSS or tailwind config */
.focus-visible:focus {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* Or use Tailwind classes */
className="focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
```

**Components to check:**
- All buttons
- All links
- All form inputs
- Custom toggle switches (like MMR toggle)
- Dropdown menus

### 3.3 Complete Accessibility Checklist

| Requirement | Files to Check | Action |
|-------------|---------------|--------|
| Form labels | All form components | Ensure `<label htmlFor>` or `aria-label` |
| Error linking | ModelConfigCard, ApiKeyManager, forms | Add `aria-describedby` |
| Focus visible | All interactive elements | Add focus-visible ring |
| Color + icon | Status indicators | Ensure icon/text accompanies color |
| Tab navigation | Modals, dropdowns | Test with keyboard |

---

## Task 4: Documentation

### 4.1 API Documentation

**Create:** `docs/API.md` or `docs/api/` folder

Document the following routes (already implemented):

```markdown
# Search API

## POST /api/search
Search within a collection.

### Request Body
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| query | string | Yes | Search query |
| collection_id | string | Yes | Collection UUID |
| limit | number | No | Max results (default: 10) |
| tech_stack | string[] | No | Filter by frameworks |
| mmr_enabled | boolean | No | Enable diversity |
| mmr_lambda | number | No | Diversity level (0.3-1.0) |
| intent | string | No | Override intent detection |

### Response
| Field | Type | Description |
|-------|------|-------------|
| results | Result[] | Search results |
| total_results | number | Total matches |
| search_time_ms | number | Execution time |
| metadata | object | Diagnostics, intent, MMR info |
```

---

## Implementation Order

**Recommended sequence:**

1. **Task 1.1** - Intent badge (quick win, visible improvement)
2. **Task 2.1** - Language badges integration (component already exists)
3. **Task 1.2** - Mode/weight indicator (expands existing section)
4. **Task 3.1-3.3** - Accessibility improvements (audit and fix)
5. **Task 1.3** - Intent override (more complex, needs API param)
6. **Task 2.2** - Language stats API (if not exists)
7. **Task 2.3** - Chunking quality indicator
8. **Task 4** - Documentation

---

## Future Work / Deferred Items

These items were identified but intentionally deferred. Include if time permits or save for a future phase.

### 5.1 Per-Collection MMR Defaults

**Reference:** Parent doc Section 16.4

Allow collections to have default MMR settings that apply when searching that collection.

**Implementation:**
- Add `mmr_enabled` and `mmr_lambda` columns to `collections` table
- Add UI in collection settings to configure defaults
- Search API reads collection defaults when no override provided

**Files:**
- `packages/db/migrations/XXX_collection_mmr_defaults.sql`
- `apps/web/src/pages/CollectionSettingsPage.tsx` (or similar)
- `apps/server/src/routes/search.ts` - Read collection defaults

### 5.2 Re-chunk with New Analyzer Action

**Reference:** Parent doc Section 17.5

When a new language analyzer is added (e.g., Python), allow users to re-process existing documents to get better chunking.

**Implementation:**
- Add "Re-chunk Documents" button on collection detail page
- Backend endpoint to queue re-chunking job
- Show progress indicator during re-chunking
- Preserve document metadata, only regenerate chunks

**Files:**
- `apps/web/src/components/collections/RechunkButton.tsx` - New component
- `apps/server/src/routes/collections.ts` - Add rechunk endpoint
- `apps/server/src/jobs/rechunk-job.ts` - Background job

**UI Mockup:**
```
┌─ Collection Actions ─────────────────────────────────────────┐
│ [Re-chunk Documents]  ⚠️ 3 files have improved analyzers    │
│                                                              │
│ Languages with better support available:                     │
│ • Python (5 files) - Now has FastAPI detection              │
│ • Java (2 files) - Now has Spring detection                 │
└──────────────────────────────────────────────────────────────┘
```

### 5.3 Analyzer Status in Admin/Debug View

**Reference:** Parent doc Section 17.5

Show which analyzers are registered and their capabilities in an admin panel.

**Implementation:**
- Create `/settings/analyzers` or `/admin/debug` page
- Display table of all registered analyzers
- Show capabilities (AST, framework detection, hierarchical chunking)
- Useful for debugging and understanding system capabilities

**Files:**
- `apps/web/src/pages/settings/AnalyzersPage.tsx` - New page
- `apps/server/src/routes/admin/analyzers.ts` - API endpoint
- Use `analyzerRegistry.getAll()` from `apps/server/src/pipeline/analyzers/registry.ts`

**UI Mockup:**
```
┌─ Language Analyzers ─────────────────────────────────────────┐
│                                                              │
│ Language   │ Parser │ Frameworks              │ Hierarchical │
│────────────┼────────┼─────────────────────────┼──────────────│
│ Dart       │ Regex  │ Flutter, Supabase...    │ ✓            │
│ TypeScript │ AST    │ React, React Native...  │ ✓            │
│ JavaScript │ AST    │ Express, React Native...│ ✓            │
│ Python     │ Regex  │ FastAPI, Django...      │ ✓            │
│ Java       │ Regex  │ Spring, Android         │ ✓            │
│ Go         │ Regex  │ Gin, Echo               │ ✓            │
│ Rust       │ Regex  │ Actix, Tokio            │ ✓            │
│ C/C++      │ Regex  │ -                       │ ✓            │
│ SQL        │ AST    │ Postgres, Supabase      │ ✗            │
│ YAML/JSON  │ Config │ Supabase, Firebase      │ ✗            │
└──────────────────────────────────────────────────────────────┘

Frameworks detected: Flutter, Dart, React, React Native, Next.js, Express, 
NestJS, Fastify, FastAPI, Django, Flask, Spring, Android, Gin, Echo, Actix, 
Tokio, Supabase, Firebase, Redis, PostgreSQL, PyTorch, TensorFlow
```

---

## Testing Checklist

After implementation, verify:

- [ ] Intent badge shows correct type with icon
- [ ] Intent badge updates on new searches
- [ ] Mode/weight details display correctly
- [ ] Intent override dropdown works and affects search
- [ ] Language badges appear on collection cards
- [ ] Language badges appear on collection detail page
- [ ] All forms have proper labels
- [ ] Error messages linked with aria-describedby
- [ ] Tab navigation works through all interactive elements
- [ ] Focus ring visible on all buttons/inputs
- [ ] No accessibility warnings in browser console

---

## GitHub Workflow

### Initial Setup (Preserve Current Work & Create Branch)

```bash
# 1. First, stash any uncommitted changes to preserve current work
git stash push -m "WIP before rag-ui-completion branch"

# 2. Ensure you're on develop and it's up to date
git checkout develop
git pull origin develop

# 3. Create and switch to the feature branch
git checkout -b feature/rag-ui-completion

# 4. If you had stashed changes that belong on this branch, restore them
git stash pop
# (Skip step 4 if the stashed changes were unrelated)
```

### Commit Structure (One Commit Per Task)

Complete each task, then commit before moving to the next. This creates a clean history.

```bash
# ═══════════════════════════════════════════════════════════════════
# COMMIT 1: Query Intent Badge & Mode Indicator (Task 1.1 + 1.2)
# ═══════════════════════════════════════════════════════════════════
# After completing Task 1.1 and 1.2:
git add -A
git commit -m "feat(web): add query intent badge and mode indicator

- Add intent type badge with icons to search results header
- Display search mode and weight configuration
- Show intent confidence and signals in collapsible details"

# ═══════════════════════════════════════════════════════════════════
# COMMIT 2: Language Support Badges (Task 2)
# ═══════════════════════════════════════════════════════════════════
# After completing Task 2.1, 2.2, 2.3:
git add -A
git commit -m "feat(web): integrate language support badges into collections

- Add CollectionLanguageSummary to collection cards
- Add language stats to collection detail page
- Add chunking quality indicator
- Create API endpoint for collection language stats"

# ═══════════════════════════════════════════════════════════════════
# COMMIT 3: Intent Override Settings (Task 1.3)
# ═══════════════════════════════════════════════════════════════════
# After completing Task 1.3:
git add -A
git commit -m "feat(web): add intent override settings

- Add intent override dropdown in advanced search settings
- Pass intent parameter to search API
- Persist override selection in URL params"

# ═══════════════════════════════════════════════════════════════════
# COMMIT 4: Accessibility Improvements (Task 3)
# ═══════════════════════════════════════════════════════════════════
# After completing Task 3.1, 3.2, 3.3:
git add -A
git commit -m "fix(web): improve accessibility with aria-describedby and focus states

- Add aria-describedby to link error messages to form fields
- Add aria-invalid for error states
- Ensure focus-visible ring on all interactive elements
- Audit and fix form labels"

# ═══════════════════════════════════════════════════════════════════
# COMMIT 5: API Documentation (Task 4 - if needed)
# ═══════════════════════════════════════════════════════════════════
# After completing Task 4:
git add -A
git commit -m "docs: add API documentation for search endpoints

- Document search API request/response format
- Document intent, MMR, and diagnostics fields
- Add examples for common use cases"
```

### Push and Create PR

```bash
# Push all commits to remote
git push -u origin feature/rag-ui-completion

# Create PR targeting develop
gh pr create --base develop --title "Complete RAG UI Components" --body "## Summary

Completes remaining UI components from the RAG & Model Selector Implementation Plan.

## Changes

### Query Intent UI (Phase 12)
- Intent badge showing detected query type with icon
- Mode/weight indicator in search results
- Intent override dropdown in advanced settings

### Language Support Badges (Phase 14)
- Language badges on collection cards
- Language stats on collection detail page
- Chunking quality indicator

### Accessibility
- aria-describedby for error messages
- focus-visible states on all interactive elements
- Form label audit and fixes

### Documentation
- API documentation for search endpoints

## Testing
- [ ] Intent badge displays correctly
- [ ] Language badges appear on collections
- [ ] Accessibility audit passes
- [ ] All existing tests pass

## Related
- Implements remaining items from \`docs/RAG_AND_MODEL_SELECTOR_IMPLEMENTATION_PLAN.md\`
- Follows \`docs/RAG_REMAINING_IMPLEMENTATION.md\`"
```

### If You Need to Recover

```bash
# If something goes wrong and you need to see your stashes:
git stash list

# To recover a specific stash:
git stash apply stash@{0}

# To see what's in a stash before applying:
git stash show -p stash@{0}
```

---

## Reference Files

**Parent Document:** `docs/RAG_AND_MODEL_SELECTOR_IMPLEMENTATION_PLAN.md`

**Key Existing Files:**
- `apps/web/src/pages/SearchPage.tsx` - Main search UI (has MMR controls)
- `apps/web/src/components/LanguageSupportBadge.tsx` - Ready to use
- `apps/server/src/services/query-intent.ts` - Intent detection
- `apps/server/src/pipeline/analyzers/registry.ts` - Language registry
- `apps/web/src/components/settings/ModelConfigCard.tsx` - Settings pattern

**Phase Summaries for Context:**
- `PHASE_12_SUMMARY.md` - Query intent implementation details
- `PHASE_13_SUMMARY.md` - MMR implementation details  
- `PHASE_14_SUMMARY.md` - Language analyzer implementation details
