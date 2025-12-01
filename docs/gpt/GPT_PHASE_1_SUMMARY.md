# GPT Phase 1 Summary: Mobile Feature Recipes & Metadata

**Branch:** `feature/gpt-phase1-mobile-recipes`
**PR Title:** GPT Phase 1: Mobile Feature Recipes & Metadata
**Status:** In Progress

---

## Overview

This phase makes Synthesis a **mobile feature recipe library** for agents building mobile SaaS apps. It adds:
- Mobile-focused metadata taxonomy (platform, feature tags, usage tier)
- Curated recipe documentation
- Feature-aware retrieval
- UI and MCP tool exposure
- Evaluation harness for quality assurance

---

## Sub-Phase Progress

| # | Sub-Phase | Status | Commit |
|---|-----------|--------|--------|
| 4.1 | Mobile Metadata Taxonomy | ✅ Complete | `feat(gpt-phase1): add mobile metadata types and feature detector` |
| 4.2 | Curated Recipe Docs & Collections | ✅ Complete | `feat(gpt-phase1): add recipe docs and ingestion scripts` |
| 4.3 | Feature-Aware Retrieval | ✅ Complete | `feat(gpt-phase1): add feature-aware search filtering` |
| 4.4 | UI & MCP Exposure | ✅ Complete | `feat(gpt-phase1): add UI components and MCP tool updates` |
| 4.5 | Evaluation & Golden Tasks | ✅ Complete | `feat(gpt-phase1): add evaluation harness and golden tasks` |

---

## Sub-Phase 4.1: Mobile Metadata Taxonomy

**Completed:** November 2025
**Commit:** `feat(gpt-phase1): add mobile metadata types and feature detector`

### Purpose

Add mobile-focused metadata types and a feature detector service to enable agents to find and filter documentation by platform, feature tags, and usage tier.

### Files Created

| File | Purpose |
|------|---------|
| `packages/db/migrations/0023_mobile_metadata.sql` | GIN indexes for feature_tags, platform, and usage_tier JSONB queries |
| `apps/server/src/services/feature-detector.ts` | Service to detect mobile features, platforms, and usage tiers from content |
| `apps/server/src/services/__tests__/feature-detector.test.ts` | 63 unit tests covering all detection functions |

### Files Modified

| File | Changes |
|------|---------|
| `packages/shared/src/index.ts` | Added `ContentPlatform`, `UsageTier`, `MobileFeatureTag` types; Extended `DocumentMetadata` and `ChunkMetadata` interfaces |
| `apps/server/src/services/metadata-validator.ts` | Added Zod schemas: `ContentPlatformSchema`, `UsageTierSchema`, `MobileFeatureTagSchema` |

### New Types

```typescript
// Content platform classification
type ContentPlatform = 'mobile' | 'web' | 'backend' | 'shared';

// Usage tier for source quality
type UsageTier = 'official' | 'reference' | 'example' | 'recipe';

// Mobile feature tags (24 total across 6 categories)
type MobileFeatureTag =
  // Authentication & Identity
  | 'auth' | 'onboarding' | 'social_auth'
  // Payments & Monetization
  | 'billing' | 'payments' | 'subscriptions'
  // Communication & Notifications
  | 'push_notifications' | 'chat' | 'realtime'
  // Data & Storage
  | 'offline' | 'sync' | 'caching' | 'search'
  // Navigation & UI
  | 'navigation' | 'state_management' | 'forms' | 'theming' | 'localization'
  // Device Features
  | 'camera' | 'file_upload' | 'location' | 'maps'
  // Analytics & Monitoring
  | 'analytics' | 'deep_linking';
```

### New Functions (feature-detector.ts)

| Function | Signature | Description |
|----------|-----------|-------------|
| `detectFeatures` | `(text: string) => MobileFeatureTag[]` | Detects mobile features using regex patterns |
| `detectPlatform` | `(text: string) => ContentPlatform \| undefined` | Detects content platform (mobile/web/backend) |
| `detectUsageTier` | `(source: string) => UsageTier` | Detects source quality tier from URL/path |
| `detectMobileMetadata` | `(text: string, source?: string) => {...}` | Combined detection helper |

### Database Migration (0023_mobile_metadata.sql)

```sql
-- GIN indexes for feature_tags array queries
CREATE INDEX idx_documents_feature_tags ON documents USING GIN ((metadata->'feature_tags') jsonb_path_ops);
CREATE INDEX idx_chunks_feature_tags ON chunks USING GIN ((metadata->'feature_tags') jsonb_path_ops);

-- Expression indexes for platform and usage_tier
CREATE INDEX idx_documents_platform ON documents ((metadata->>'platform')) WHERE metadata->>'platform' IS NOT NULL;
CREATE INDEX idx_documents_usage_tier ON documents ((metadata->>'usage_tier')) WHERE metadata->>'usage_tier' IS NOT NULL;
CREATE INDEX idx_chunks_platform ON chunks ((metadata->>'platform')) WHERE metadata->>'platform' IS NOT NULL;
```

### Test Results

- ✅ 63 feature-detector tests pass
- ✅ 58 metadata-validator tests pass
- ✅ TypeScript compiles without errors
- ✅ No breaking changes to existing APIs

### Acceptance Criteria

- [x] TypeScript types compile without errors (`pnpm typecheck`)
- [x] Migration created successfully
- [x] Feature detector tests pass with 90%+ coverage
- [x] No breaking changes to existing APIs

---

## Sub-Phase 4.2: Curated Recipe Docs & Collections

**Completed:** November 2025
**Commit:** `feat(gpt-phase1): add recipe docs and ingestion scripts`

### Purpose

Create curated Flutter/mobile recipe documentation with YAML frontmatter metadata, and build ingestion scripts to populate the RAG system with both local recipes and official documentation from provider websites.

### Files Created

| File | Purpose |
|------|---------|
| `docs/recipes/mobile/TEMPLATE.md` | Recipe template with standardized frontmatter schema |
| `docs/recipes/mobile/flutter_auth_supabase.md` | Supabase authentication recipe |
| `docs/recipes/mobile/flutter_auth_firebase.md` | Firebase authentication recipe |
| `docs/recipes/mobile/flutter_stripe_payments.md` | Stripe payments recipe |
| `docs/recipes/mobile/flutter_revenuecat_subscriptions.md` | RevenueCat subscriptions recipe |
| `docs/recipes/mobile/flutter_push_notifications_fcm.md` | FCM push notifications recipe |
| `docs/recipes/mobile/flutter_offline_isar.md` | Offline-first with Isar recipe |
| `apps/server/src/scripts/ingest-mobile-recipes.ts` | Script to ingest local recipe markdown files |
| `apps/server/src/scripts/ingest-mobile-official.ts` | Script to scrape and ingest official provider docs |
| `apps/server/src/scripts/__tests__/ingest-mobile-recipes.test.ts` | 15 tests for recipe parsing/validation |

### Files Modified

| File | Changes |
|------|---------|
| `packages/shared/src/index.ts` | Added `recipe` to `DocumentType`, `web` to `SourceType`, `local_storage` to `MobileFeatureTag` |
| `apps/server/src/services/metadata-builder.ts` | Added `setPlatform()`, `setFeatureTags()`, `addFeatureTags()`, `setUsageTier()`, `setRecommended()` methods |
| `apps/server/src/services/feature-detector.ts` | Added `local_storage` patterns to FEATURE_PATTERNS |
| `apps/server/src/services/__tests__/metadata-builder.test.ts` | Added 9 tests for mobile metadata builder methods |
| `apps/server/src/services/__tests__/feature-detector.test.ts` | Added `local_storage` detection tests |

### Recipe Frontmatter Schema

```yaml
---
title: "Recipe Title"
platform: mobile                    # ContentPlatform
framework: flutter
framework_version: "3.24.x"
feature_tags:                       # MobileFeatureTag[]
  - auth
  - social_auth
usage_tier: recipe                  # UsageTier
tech_stack:                         # String[]
  - supabase
  - flutter
difficulty: intermediate           # beginner | intermediate | advanced
last_updated: 2025-11-30
recommended: true
sdk_constraints: ">=3.0.0 <4.0.0"
tested_versions:
  - "Flutter 3.24.5"
  - "supabase_flutter 2.8.0"
---
```

### New MetadataBuilder Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `setPlatform` | `(platform: ContentPlatform) => this` | Sets content platform |
| `setFeatureTags` | `(tags: MobileFeatureTag[]) => this` | Sets feature tags (replaces existing) |
| `addFeatureTags` | `(...tags: MobileFeatureTag[]) => this` | Adds to existing feature tags |
| `setUsageTier` | `(tier: UsageTier) => this` | Sets usage tier |
| `setRecommended` | `(recommended: boolean) => this` | Sets recommended flag |

### Ingestion Scripts

**ingest-mobile-recipes.ts:**
- Parses YAML frontmatter using `gray-matter`
- Validates required fields (title, platform, framework, feature_tags, usage_tier, tech_stack)
- Creates `mobile-recipes` collection
- Copies recipe files to storage with proper metadata
- Runs full ingestion pipeline (extract, chunk, embed)
- Supports `--dry-run` and `--skip-existing` flags

**ingest-mobile-official.ts:**
- Scrapes official docs from Supabase, Firebase, Stripe, RevenueCat, Isar
- Uses existing Playwright scraper (`scraper.ts`)
- Creates `mobile-official-docs` collection
- Applies feature tags based on provider and URL
- Supports `--provider=X` filtering, `--dry-run`, `--skip-existing`
- Rate-limited to 1.5s between requests

### Official Documentation Sources

| Provider | URLs | Feature Tags |
|----------|------|--------------|
| Supabase | Flutter quickstart, auth, realtime, Dart reference | auth, social_auth, realtime, sync |
| Firebase | Setup, auth, FCM client, FCM receive | auth, push_notifications |
| Stripe | Accept payment, flutter_stripe package | payments |
| RevenueCat | Installation, purchases, subscription offers | subscriptions, billing, payments |
| Isar | Quickstart, queries, transactions | offline, local_storage, sync |

### Test Results

- ✅ 15 recipe parsing tests pass
- ✅ 16 metadata builder tests pass (9 new for mobile methods)
- ✅ 64 feature detector tests pass (1 new for local_storage)
- ✅ TypeScript compiles without errors
- ✅ 95 total tests passing

### Acceptance Criteria

- [x] Recipe template with frontmatter schema created
- [x] 6 curated Flutter recipes created (auth x2, payments x2, notifications, offline)
- [x] MetadataBuilder extended with mobile metadata methods
- [x] Recipe ingestion script parses frontmatter and applies metadata
- [x] Official docs ingestion script scrapes and ingests provider documentation
- [x] Unit tests for frontmatter parsing pass
- [x] TypeScript compiles without errors (`pnpm typecheck`)

---

## Sub-Phase 4.3: Feature-Aware Retrieval

**Completed:** November 2025
**Commit:** `feat(gpt-phase1): add feature-aware search filtering`

### Purpose

Extend the `smartSearch` function and all underlying search methods (vector, BM25, hybrid) to support filtering by `feature_tags`, `platform`, and `usage_tier` metadata fields. This enables agents to query recipes and documentation filtered by mobile features, platform type, and source quality tier.

### Files Modified

| File | Changes |
|------|---------|
| `apps/server/src/services/vector.ts` | Added `featureTags`, `platform`, `usageTier` to `SearchParams`; Extended SQL query with JSONB filter clauses |
| `apps/server/src/services/bm25.ts` | Added `featureTags`, `platform`, `usageTier` to `BM25Params`; Extended SQL query with JSONB filter clauses |
| `apps/server/src/services/hybrid.ts` | Pass-through of new filter parameters to vector and BM25 searches |
| `apps/server/src/services/search.ts` | Pass-through in `smartSearch` function to hybrid/vector searches |
| `apps/server/src/routes/search.ts` | Added Zod schema fields (`feature_tags`/`featureTags`, `platform`, `usage_tier`/`usageTier`); Normalization logic |
| `apps/server/src/services/cache/search-cache.ts` | Added `featureTags`, `platform`, `usageTier` to `SearchCacheKeyInput`; Updated cache key generation |
| `apps/server/src/services/__tests__/vector.test.ts` | Added 6 feature-aware filtering tests |
| `apps/server/src/services/__tests__/bm25.test.ts` | Added 5 feature-aware filtering tests |
| `apps/server/src/services/__tests__/search.test.ts` | Updated parameter expectations for new filter fields |

### New SearchParams Fields

```typescript
// apps/server/src/services/vector.ts
export interface SearchParams {
  // ... existing fields
  // GPT Phase 1: Feature-aware filtering
  featureTags?: string[];   // Filter by mobile feature tags (OR logic)
  platform?: string;        // Filter by content platform (exact match)
  usageTier?: string;       // Filter by usage tier (exact match)
}
```

### SQL Filter Implementation

```sql
-- Feature tags (array overlap using ?| operator)
AND (
  $6::text[] IS NULL
  OR ch.metadata->'feature_tags' ?| $6::text[]
)
-- Platform (exact match)
AND (
  $7::text IS NULL
  OR ch.metadata->>'platform' = $7::text
)
-- Usage tier (exact match)
AND (
  $8::text IS NULL
  OR ch.metadata->>'usage_tier' = $8::text
)
```

### API Request Schema

```typescript
// Zod schema additions (snake_case + camelCase variants)
feature_tags: z.array(z.string()).optional(),
featureTags: z.array(z.string()).optional(),
platform: z.enum(['mobile', 'web', 'backend', 'shared']).optional(),
usage_tier: z.enum(['official', 'reference', 'example', 'recipe']).optional(),
usageTier: z.enum(['official', 'reference', 'example', 'recipe']).optional(),
```

### Cache Key Updates

```typescript
// SearchCacheKeyInput additions
featureTags?: string[] | null;
platform?: string | null;
usageTier?: string | null;

// Feature tags are sorted for consistent cache keys
const sortableFeatureTags = input.featureTags ? [...input.featureTags].sort() : null;
```

### Filter Behavior

| Filter | Operator | Behavior |
|--------|----------|----------|
| `featureTags` | `?|` (JSONB overlap) | OR logic - matches if ANY tag is present |
| `platform` | `=` (exact match) | Filters to single platform value |
| `usageTier` | `=` (exact match) | Filters to single tier value |
| Empty array | Converted to `null` | No filtering applied |
| `undefined` | Passed as `null` | No filtering applied |

### Test Results

- ✅ 11 vector search tests pass (6 new feature-aware tests)
- ✅ 35 BM25 search tests pass (5 new feature-aware tests)
- ✅ 7 hybrid search tests pass
- ✅ 7 search route tests pass
- ✅ 4 search.test.ts tests pass (parameter updates)
- ✅ **64 total search-related tests pass**
- ✅ TypeScript compiles without errors

### Example API Usage

```bash
# Filter by feature tags (OR logic)
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "authentication",
    "collection_id": "...",
    "feature_tags": ["auth", "social_auth"]
  }'

# Filter by platform and usage tier
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "flutter widget",
    "collection_id": "...",
    "platform": "mobile",
    "usage_tier": "recipe"
  }'

# Combined filters
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "push notifications",
    "collection_id": "...",
    "feature_tags": ["push_notifications"],
    "platform": "mobile",
    "usage_tier": "official"
  }'
```

### Acceptance Criteria

- [x] `smartSearch` supports `featureTags`, `platform`, `usageTier` filters
- [x] Vector search filters by all three new fields
- [x] BM25 search filters by all three new fields
- [x] Hybrid search passes filters to both underlying searches
- [x] Search route validates and normalizes filter inputs
- [x] Cache key includes new filter fields for proper cache separation
- [x] Empty arrays treated as "no filter" (converted to null)
- [x] All 64 search-related tests pass
- [x] TypeScript compiles without errors (`pnpm typecheck`)

---

## Sub-Phase 4.4: UI & MCP Exposure

**Completed:** November 2025
**Commit:** `feat(gpt-phase1): add UI components and MCP tool updates`

### Purpose

Expose mobile feature-aware retrieval to users through the web UI (feature filters and badges) and to AI agents through three new MCP tools (`search_mobile_docs`, `find_code_examples`, `get_feature_recipe`).

### Files Created

| File | Purpose |
|------|---------|
| `apps/web/src/components/PlatformBadge.tsx` | Badge displaying content platform (mobile/web/backend/shared) |
| `apps/web/src/components/UsageTierBadge.tsx` | Badge displaying usage tier (official/reference/example/recipe) |
| `apps/web/src/components/FeatureTagBadges.tsx` | Component displaying feature tags as chips |
| `apps/web/src/components/MobileFeatureFilter.tsx` | Filter UI with platform, usage tier, and grouped feature tag selection |
| `apps/web/src/components/__tests__/PlatformBadge.test.tsx` | 15 unit tests |
| `apps/web/src/components/__tests__/UsageTierBadge.test.tsx` | 15 unit tests |
| `apps/web/src/components/__tests__/FeatureTagBadges.test.tsx` | 16 unit tests |
| `apps/web/src/components/__tests__/MobileFeatureFilter.test.tsx` | 28 unit tests |
| `apps/mcp/src/__tests__/mobile-tools.test.ts` | 57 unit tests for MCP tool schemas |

### Files Modified

| File | Changes |
|------|---------|
| `apps/web/src/components/ResultCard.tsx` | Added PlatformBadge, UsageTierBadge, FeatureTagBadges to search results |
| `apps/web/src/pages/SearchPage.tsx` | Added MobileFeatureFilter to Advanced Settings; URL params for platform/usage_tier/feature_tags |
| `apps/web/src/lib/api.ts` | Added `mobileFilters` param to `performSearch()` with featureTags/platform/usageTier |
| `apps/mcp/src/index.ts` | Added 3 MCP tools: search_mobile_docs, find_code_examples, get_feature_recipe |

### New UI Components

#### PlatformBadge
- Color-coded badges: mobile (green), web (blue), backend (purple), shared (gray)
- Icons: 📱 Mobile, 🌐 Web, ⚙️ Backend, 🔗 Shared
- Graceful handling of unknown values

#### UsageTierBadge
- Color-coded badges: official (green), reference (blue), example (amber), recipe (purple)
- Icons: 📗 Official, 📚 Reference, 💡 Example, 🍳 Recipe
- Graceful handling of unknown values

#### FeatureTagBadges
- Displays all feature tags with flex-wrap
- Converts snake_case to Title Case (e.g., `push_notifications` → `Push Notifications`)
- Neutral slate styling to avoid visual noise

#### MobileFeatureFilter
- **Platform dropdown**: Single-select (All, Mobile, Web, Backend, Shared)
- **Usage tier dropdown**: Single-select (All, Official, Reference, Example, Recipe)
- **Feature tags**: Grouped by 7 categories with collapsible sections:
  - Auth & Identity: auth, onboarding, social_auth
  - Payments: billing, payments, subscriptions
  - Communication: push_notifications, chat, realtime
  - Data & Storage: offline, local_storage, sync, caching, search
  - Navigation & UI: navigation, state_management, forms, theming, localization
  - Device Features: camera, file_upload, location, maps
  - Analytics: analytics, deep_linking
- Active filter count badges per category
- Clear all filters button

### New MCP Tools

#### search_mobile_docs
Search mobile documentation with feature-aware filtering.

```typescript
// Schema
{
  collectionId: string (UUID, required),
  query: string (required),
  featureTags: string[] (optional),
  platform: 'mobile' | 'web' | 'backend' | 'shared' (optional),
  framework: string (optional),
  top_k: number (1-50, default: 10)
}
```

#### find_code_examples
Find code examples and sample implementations (biased toward example usage tier).

```typescript
// Schema
{
  collectionId: string (UUID, required),
  query: string (required),
  featureTags: string[] (optional),
  framework: string (optional),
  top_k: number (1-50, default: 5)
}
// Note: Hardcoded usage_tier: 'example'
```

#### get_feature_recipe
Get curated recipe documents for implementing mobile features.

```typescript
// Schema
{
  collectionId: string (UUID, required),
  featureTags: string[] (min: 1, required),
  framework: string (optional),
  top_k: number (1-20, default: 5)
}
// Note: Hardcoded usage_tier: 'recipe'
// Query constructed from: featureTags.join(' ') + ' implementation guide'
```

### API Client Update

```typescript
// apps/web/src/lib/api.ts - performSearch() signature
async performSearch(
  query: string,
  collectionId: string,
  topK = 10,
  techStack?: string[],
  mmrOptions?: { enabled?: boolean; lambda?: number },
  intentOverride?: string | null,
  // GPT Phase 1: Mobile feature filters
  mobileFilters?: {
    featureTags?: string[];
    platform?: string;
    usageTier?: string;
  }
): Promise<SearchResponse>
```

### Test Results

| Test Suite | Tests | Status |
|------------|-------|--------|
| PlatformBadge.test.tsx | 15 | ✅ PASS |
| UsageTierBadge.test.tsx | 15 | ✅ PASS |
| FeatureTagBadges.test.tsx | 16 | ✅ PASS |
| MobileFeatureFilter.test.tsx | 28 | ✅ PASS |
| mobile-tools.test.ts (MCP) | 57 | ✅ PASS |
| **Total** | **131** | **✅ ALL PASS** |

### Build Verification

- ✅ TypeScript compiles without errors (`pnpm typecheck`)
- ✅ Vite build succeeds (SearchPage-DVlBcVol.js: 33.00 kB gzipped: 9.28 kB)
- ✅ All 131 new tests pass
- ✅ MCP server now has 13 tools (was 10)

### Edge Cases Covered

**Badge Components:**
- Null/undefined/empty string inputs return null
- Unknown values render with gray fallback styling
- Case-insensitive handling (MOBILE, Mobile, mobile)
- Custom className prop support

**Filter Component:**
- Categories collapsed by default
- Proper ARIA attributes for accessibility
- Clear button only shows when filters active
- URL params sync with filter state

**MCP Tools:**
- Strict schema validation (no extra fields)
- UUID format validation
- Empty featureTags array rejection for get_feature_recipe
- Proper default values for top_k

### Acceptance Criteria

- [x] PlatformBadge renders correctly for all 4 platforms
- [x] UsageTierBadge renders correctly for all 4 tiers
- [x] FeatureTagBadges displays all tags with flex-wrap
- [x] ResultCard shows mobile badges when metadata present
- [x] MobileFeatureFilter supports platform, usage tier, and feature tag selection
- [x] Feature tags grouped by 7 categories with collapsible sections
- [x] SearchPage integrates filters in Advanced Settings with URL params
- [x] API client passes all filter parameters
- [x] MCP search_mobile_docs tool works with feature filters
- [x] MCP find_code_examples tool returns example-biased results
- [x] MCP get_feature_recipe tool retrieves recipe documents
- [x] All 131 new tests pass
- [x] TypeScript compiles without errors (`pnpm typecheck`)

---

## Sub-Phase 4.5: Evaluation & Golden Tasks

**Completed:** November 2025
**Commit:** `feat(gpt-phase1): add evaluation harness and golden tasks`

### Purpose

Create an evaluation harness and golden task set to verify that the mobile feature recipes and retrieval system correctly returns relevant documentation for common mobile development scenarios. This provides quality assurance for the entire Phase 1 implementation.

### Files Created

| File | Purpose |
|------|---------|
| `apps/server/perf/mobile_eval_tasks.json` | Golden task definitions covering 10 evaluation scenarios |
| `apps/server/perf/mobile_eval_runner.mjs` | Node.js ES module script to run evaluations and generate reports |
| `apps/server/perf/__tests__/mobile-eval.test.ts` | 33 unit tests for validation logic and schema |

### Golden Task Categories

| Category | Tasks | MCP Tools Used |
|----------|-------|----------------|
| Authentication | 3 tasks | search_mobile_docs, find_code_examples |
| Payments | 1 task | search_mobile_docs |
| Subscriptions | 1 task | get_feature_recipe |
| Push Notifications | 1 task | search_mobile_docs |
| Offline/Sync | 2 tasks | get_feature_recipe, search_mobile_docs |
| Edge Cases | 2 tasks | search_mobile_docs |

### Golden Tasks Defined

| ID | Description | Expected Outcome |
|----|-------------|------------------|
| auth-001 | Email/password auth with Supabase | Supabase recipe found |
| auth-002 | Social auth (Google/Apple) | Auth examples found |
| auth-003 | Firebase authentication setup | Firebase docs + recipe |
| payments-001 | Stripe payments integration | Stripe recipe found |
| subscriptions-001 | RevenueCat in-app subscriptions | RevenueCat recipe found |
| notifications-001 | FCM push notifications | Firebase + recipe found |
| offline-001 | Offline caching with Isar | Isar recipe found |
| offline-002 | Data sync with conflict resolution | Sync docs found |
| edge-001 | Non-matching query | Empty results accepted |
| edge-002 | Ambiguous multi-feature query | Results with metadata |

### Evaluation Runner Features

```bash
# Usage
node apps/server/perf/mobile_eval_runner.mjs [options]

# Options
--collection-id <uuid>  # Override collection ID
--base-url <url>        # Override API base URL (default: http://localhost:3333)
--dry-run               # Print tasks without executing
--output <file>         # Custom output file path
--verbose               # Include full result details
--help                  # Show help
```

### Validation Checks

| Check | Description |
|-------|-------------|
| `minResults` | Minimum number of results required |
| `allowEmptyResults` | Accept zero results (for edge cases) |
| `requiredUsageTiers` | At least one result with specified tier (OR logic) |
| `requiredFeatureTags` | At least one result with specified tag (OR logic) |
| `expectedDocPatterns` | Case-insensitive patterns in doc titles/text (50%+ match) |
| `verifyMetadataPresent` | All results have non-empty metadata |

### Report Output

The runner generates a markdown report with:
- Summary table (total, passed, failed, errors, pass rate)
- Results grouped by category
- Detailed failure information with check-by-check breakdown
- Error details for any API failures

### Test Results

| Test Suite | Tests | Status |
|------------|-------|--------|
| Schema validation | 8 | ✅ PASS |
| minResults check | 3 | ✅ PASS |
| allowEmptyResults check | 2 | ✅ PASS |
| requiredUsageTiers check | 2 | ✅ PASS |
| requiredFeatureTags check | 3 | ✅ PASS |
| expectedDocPatterns check | 3 | ✅ PASS |
| verifyMetadataPresent check | 2 | ✅ PASS |
| Score calculation | 2 | ✅ PASS |
| buildSearchParams | 5 | ✅ PASS |
| Edge cases | 3 | ✅ PASS |
| **Total** | **33** | **✅ ALL PASS** |

### Execution Validation

The evaluation harness was executed against real data:

1. **Recipe ingestion**: 6 Flutter recipes ingested into `mobile-recipes` collection
2. **Metadata propagation**: All chunks updated with `usage_tier`, `feature_tags`, `platform`
3. **Evaluation run**: 10/10 golden tasks passed (100% pass rate)

```
Overall: 10/10 passed (100.0%)
```

Sample passing tasks:
- auth-001: Supabase authentication → Found recipe with correct metadata
- payments-001: Stripe payments → Found payments recipe
- notifications-001: FCM push notifications → Found push_notifications recipe
- offline-001: Isar offline caching → Found offline recipe
- edge-001: Non-matching query → Correctly returned 0 results

### Acceptance Criteria

- [x] Golden task definitions cover all 4 core categories (auth, payments, notifications, offline)
- [x] Tasks use MCP tools (search_mobile_docs, get_feature_recipe)
- [x] Edge cases included (no matches, ambiguous queries)
- [x] Evaluation runner executes tasks and validates expectations
- [x] Runner generates markdown report with pass/fail status
- [x] Unit tests verify validation logic (33 tests passing)
- [x] TypeScript compiles without errors (`pnpm typecheck`)
- [x] **Execution validation passed (10/10 golden tasks)**

---

## Bonus Fix: Web Content Ingestion Quality

**Completed:** December 2025
**Commit:** `fix(agent): auto-detect HTML URLs and use fetch_web_content`

### Issue

When the Synthesis chat agent ingested web documentation (e.g., Supabase docs), it was using `add_document` which downloads raw HTML with JavaScript/CSS instead of extracting readable content. This resulted in chunks containing `<script>` tags and build artifacts rather than documentation text.

### Root Cause

The `add_document` tool used simple `fetch()` to download URLs, while `fetch_web_content` uses Playwright + Turndown to properly:
1. Wait for JavaScript to render (`networkidle`)
2. Extract content from semantic elements (`main`, `article`, `.content`)
3. Convert HTML to clean markdown

### Solution

**1. Updated Agent System Prompt** (`apps/server/src/agent/agent.ts:52-56`)

Added explicit guidance for tool selection:
```
IMPORTANT - Tool Selection for Web Content:
- For WEB PAGES (HTML documentation sites): ALWAYS use `fetch_web_content`
- For RAW FILES (PDFs, markdown, code files): Use `add_document`
- NEVER use `add_document` for HTML web pages
```

**2. Smart URL Detection in `add_document`** (`apps/server/src/agent/tools.ts:173-214`)

Added automatic detection that redirects HTML URLs to `fetch_web_content`:
- Detects raw file extensions (`.pdf`, `.md`, `.dart`, `.ts`, `.py`, etc.)
- Detects raw GitHub URLs (`raw.githubusercontent.com`, `/raw/`)
- If URL doesn't match raw file patterns → automatically uses `fetch_web_content`

```typescript
const isRawFile =
  pathname.endsWith('.pdf') ||
  pathname.endsWith('.md') ||
  // ... more extensions
  url.hostname === 'raw.githubusercontent.com' ||
  url.hostname.includes('raw.') ||
  url.pathname.includes('/raw/');

if (!isRawFile) {
  // Redirect to fetch_web_content for proper HTML extraction
  const result = await fetchWebContent(db, { url: source, collectionId, mode: 'single' });
  return createToolResponse('Detected web page URL. Used fetch_web_content...', result);
}
```

### Verification

Tested with Supabase auth docs (`https://supabase.com/docs/guides/auth`):
- Agent correctly chose `fetch_web_content` with `mode: 'crawl'`
- Successfully fetched 20 pages with clean markdown content
- All chunks contain readable documentation text (not raw HTML/JS)

### Files Modified

| File | Changes |
|------|---------|
| `apps/server/src/agent/agent.ts` | Added web content tool selection guidance to system prompt |
| `apps/server/src/agent/tools.ts` | Added URL detection to auto-redirect HTML pages to `fetch_web_content` |

### Test Results

- ✅ 11 agent tools tests pass
- ✅ TypeScript compiles without errors
- ✅ Manual verification: Supabase docs ingested as clean markdown

---

## Phase 1 Completion Checklist

- [x] All sub-phases complete (4.1-4.5)
- [x] All tests passing
- [x] Documentation updated
- [x] Web content ingestion quality fix applied
- [ ] PR created and reviewed
- [ ] Merged to develop
