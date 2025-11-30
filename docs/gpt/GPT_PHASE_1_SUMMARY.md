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
| 4.4 | UI & MCP Exposure | ⬜ Pending | |
| 4.5 | Evaluation & Golden Tasks | ⬜ Pending | |

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

**Status:** ⬜ Pending

*Summary will be added upon completion.*

---

## Sub-Phase 4.5: Evaluation & Golden Tasks

**Status:** ⬜ Pending

*Summary will be added upon completion.*

---

## Phase 1 Completion Checklist

- [ ] All sub-phases complete
- [ ] All tests passing
- [ ] Documentation updated
- [ ] PR created and reviewed
- [ ] Merged to develop
