# Phase 1: Mobile Feature Recipes & Examples – Implementation Plan

**Version:** 2.0 · **Created:** November 2025 · **Updated:** November 2025  
**Branch:** `feature/gpt-phase1-mobile-recipes`  
**PR Title:** GPT Phase 1: Mobile Feature Recipes & Metadata

---

## Prerequisites

- [ ] None - This phase can be implemented independently
- [ ] `develop` branch is up to date
- [ ] All existing tests pass (`pnpm test`)

---

## Related Documentation

- `docs/RAG_AND_MODEL_SELECTOR_IMPLEMENTATION_PLAN.md` (Phases 1, 3, 5, 13, 13.5)  
- `docs/01_TECH_STACK.md`  
- `docs/CONFIGURATION.md`
- `docs/guides/HYBRID_SEARCH_GUIDE.md`  
- `docs/guides/CODE_SEARCH_GUIDE.md`

---

## 1. Executive Summary

**Goal:** Turn Synthesis into a **mobile feature recipe library** for agents building mobile SaaS apps.

This phase makes it easy for an MCP‑driven agent to:

- Find **official docs**, **high‑quality examples**, and **your own recipes** for common mobile features:
  - Authentication, onboarding, billing/payments, push notifications, offline sync, navigation, state management, etc.
- Understand which docs are:
  - Official vs community vs your curated notes.
  - Flutter vs Kotlin/Android vs Swift/iOS vs backend (Supabase/Firebase/Stripe).
  - For which SDK/framework versions.
- Retrieve **feature‑tagged chunks** with good citations for code generation and planning.

This plan layers on top of existing metadata, tech‑stack detection, and code intelligence introduced in earlier phases. It does not replace the RAG pipeline; it **adds a mobile‑focused taxonomy and curated content layer.**

---

## 2. GitHub Workflow

**Single branch for entire phase:** `feature/gpt-phase1-mobile-recipes`

```bash
# 1. Create branch (WAIT FOR APPROVAL)
git checkout develop && git pull origin develop
git checkout -b feature/gpt-phase1-mobile-recipes

# 2. Implement all sub-phases (4.1 through 4.5) in order

# 3. Run tests and lint
pnpm test
pnpm lint

# 4. Present ALL changes for human review

# 5. After APPROVAL: commit
git add -A
git commit -m "feat(gpt-phase1): implement mobile feature recipes and metadata

- Add platform, feature_tags, usage_tier to metadata types
- Create feature-detector service
- Add feature-aware search filtering
- Create recipe document template
- Add database migration for metadata indexes
- Add unit tests"

# 6. After APPROVAL: push
git push -u origin feature/gpt-phase1-mobile-recipes

# 7. Create PR
gh pr create --base develop --title "GPT Phase 1: Mobile Feature Recipes & Metadata"
```

Follow rules in `docs/gpt/MASTER_PLAN.md` Section 2 and `agents.md`.

---

## 3. Phase Overview

**All sub-phases go into ONE branch and ONE PR.**

| # | Sub-Phase | Priority | Est. Time | Commit Scope |
|---|-----------|----------|-----------|---------------|
| 4.1 | Mobile Metadata Taxonomy | P0 | 2–3 days | `feat(gpt-phase1): add mobile metadata types and feature detector` |
| 4.2 | Curated Recipe Docs & Collections | P0 | 3–5 days | `feat(gpt-phase1): add recipe template and example recipes` |
| 4.3 | Feature-Aware Retrieval | P1 | 3–4 days | `feat(gpt-phase1): add feature-aware search filtering` |
| 4.4 | UI & MCP Exposure | P2 | 2–4 days | `feat(gpt-phase1): add UI components and MCP tool updates` |
| 4.5 | Evaluation & Golden Tasks | P2 | 2–3 days | `feat(gpt-phase1): add evaluation harness and golden tasks` |

### Commit Strategy

```bash
# Work on single branch
git checkout -b feature/gpt-phase1-mobile-recipes

# Commit after completing each sub-phase:
git commit -m "feat(gpt-phase1): add mobile metadata types and feature detector"
git commit -m "feat(gpt-phase1): add recipe template and example recipes"
git commit -m "feat(gpt-phase1): add feature-aware search filtering"
git commit -m "feat(gpt-phase1): add UI components and MCP tool updates"
git commit -m "feat(gpt-phase1): add evaluation harness and golden tasks"

# One PR at the end with all commits
git push -u origin feature/gpt-phase1-mobile-recipes
gh pr create --base develop --title "GPT Phase 1: Mobile Feature Recipes & Metadata"
```

---

## 4. Sub-Phase 4.1: Mobile Metadata Taxonomy

**Problem:** Existing metadata does not model **features** (auth, billing) or **platform concerns** for mobile SaaS agents.

### 4.1.1 TypeScript Types to Add

**File:** `packages/shared/src/index.ts`

```typescript
// GPT Phase 1: Mobile Feature Types
export type ContentPlatform = 'mobile' | 'web' | 'backend' | 'shared';
export type UsageTier = 'official' | 'reference' | 'example' | 'recipe';
export type MobileFeatureTag =
  | 'auth' | 'onboarding' | 'billing' | 'payments' | 'subscriptions'
  | 'push_notifications' | 'offline' | 'sync' | 'navigation'
  | 'state_management' | 'forms' | 'analytics' | 'deep_linking'
  | 'social_auth' | 'file_upload' | 'camera' | 'location' | 'maps'
  | 'chat' | 'realtime' | 'search' | 'caching' | 'theming' | 'localization';
```

Extend existing `DocumentMetadata` and `ChunkMetadata` interfaces:

```typescript
export interface DocumentMetadata {
  // ... existing fields ...
  
  // GPT Phase 1 additions
  platform?: ContentPlatform;
  feature_tags?: MobileFeatureTag[];
  usage_tier?: UsageTier;
  recommended?: boolean;
}

export interface ChunkMetadata {
  // ... existing fields ...
  
  // GPT Phase 1 additions
  platform?: ContentPlatform;
  feature_tags?: MobileFeatureTag[];
  is_example?: boolean;
  is_recipe?: boolean;
}
```

### 4.1.2 Database Migration

**File:** `packages/db/migrations/0030_mobile_metadata.sql`

```sql
-- GPT Phase 1: Mobile Feature Metadata Indexes
CREATE INDEX IF NOT EXISTS idx_documents_feature_tags 
  ON documents USING GIN ((metadata->'feature_tags'));

CREATE INDEX IF NOT EXISTS idx_chunks_feature_tags 
  ON chunks USING GIN ((metadata->'feature_tags'));

CREATE INDEX IF NOT EXISTS idx_documents_platform 
  ON documents ((metadata->>'platform'))
  WHERE metadata->>'platform' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_usage_tier 
  ON documents ((metadata->>'usage_tier'))
  WHERE metadata->>'usage_tier' IS NOT NULL;
```

### 4.1.3 Feature Detector Service

**File:** `apps/server/src/services/feature-detector.ts` (NEW)

Create a service that detects features from content:

```typescript
import type { MobileFeatureTag, ContentPlatform, UsageTier } from '@synthesis/shared';

/**
 * Feature detection patterns for all MobileFeatureTag values.
 * Each feature has an array of regex patterns that indicate its presence.
 */
const FEATURE_PATTERNS: Record<MobileFeatureTag, RegExp[]> = {
  // Authentication & Identity
  auth: [
    /\b(auth|authentication|login|logout|signin|signout|signup|register)\b/i,
    /\b(jwt|oauth|oauth2|oidc|saml|credentials)\b/i,
    /\b(firebase[_-]?auth|supabase[_-]?auth|auth0|cognito)\b/i,
  ],
  onboarding: [
    /\b(onboarding|welcome|intro|tutorial|walkthrough|first[_-]?run)\b/i,
    /\b(getting[_-]?started|setup[_-]?wizard|initial[_-]?setup)\b/i,
  ],
  social_auth: [
    /\b(social[_-]?auth|social[_-]?login|google[_-]?sign[_-]?in)\b/i,
    /\b(apple[_-]?sign[_-]?in|facebook[_-]?login|twitter[_-]?auth)\b/i,
    /\b(github[_-]?auth|oauth[_-]?provider)\b/i,
  ],

  // Payments & Monetization
  billing: [
    /\b(billing|invoice|subscription[_-]?management)\b/i,
    /\b(revenue[_-]?cat|app[_-]?store[_-]?connect)\b/i,
  ],
  payments: [
    /\b(payment|pay|checkout|transaction|purchase)\b/i,
    /\b(stripe|paypal|square|braintree|razorpay)\b/i,
  ],
  subscriptions: [
    /\b(subscription|subscribe|recurring|plan|tier|premium)\b/i,
    /\b(in[_-]?app[_-]?purchase|iap|store[_-]?kit)\b/i,
  ],

  // Communication & Notifications
  push_notifications: [
    /\b(push[_-]?notification|remote[_-]?notification)\b/i,
    /\b(fcm|firebase[_-]?messaging|apns|onesignal)\b/i,
    /\b(notification[_-]?service|notification[_-]?handler)\b/i,
  ],
  chat: [
    /\b(chat|messaging|conversation|direct[_-]?message)\b/i,
    /\b(stream[_-]?chat|sendbird|pusher|socket[_-]?chat)\b/i,
  ],
  realtime: [
    /\b(realtime|real[_-]?time|live[_-]?update|websocket)\b/i,
    /\b(socket\.io|supabase[_-]?realtime|firebase[_-]?realtime)\b/i,
    /\b(presence|broadcast|channel[_-]?subscription)\b/i,
  ],

  // Data & Storage
  offline: [
    /\b(offline|offline[_-]?first|local[_-]?storage|local[_-]?database)\b/i,
    /\b(hive|isar|sqflite|realm|objectbox)\b/i,
    /\b(cached[_-]?data|persistent[_-]?storage)\b/i,
  ],
  sync: [
    /\b(sync|synchronize|data[_-]?sync|background[_-]?sync)\b/i,
    /\b(conflict[_-]?resolution|merge[_-]?strategy)\b/i,
  ],
  caching: [
    /\b(cache|caching|cached|memory[_-]?cache)\b/i,
    /\b(redis|memcache|image[_-]?cache|http[_-]?cache)\b/i,
  ],
  search: [
    /\b(search|full[_-]?text[_-]?search|search[_-]?bar)\b/i,
    /\b(algolia|elasticsearch|meilisearch|typesense)\b/i,
  ],

  // Navigation & UI
  navigation: [
    /\b(navigation|router|route|navigate|go[_-]?router)\b/i,
    /\b(auto[_-]?route|navigator|page[_-]?transition|deep[_-]?link)\b/i,
    /\b(bottom[_-]?nav|tab[_-]?bar|drawer)\b/i,
  ],
  state_management: [
    /\b(state[_-]?management|state[_-]?manager)\b/i,
    /\b(provider|bloc|riverpod|redux|mobx|getx|cubit)\b/i,
    /\b(notifier|controller|view[_-]?model)\b/i,
  ],
  forms: [
    /\b(form|form[_-]?field|text[_-]?field|input[_-]?field)\b/i,
    /\b(form[_-]?validation|reactive[_-]?forms|form[_-]?builder)\b/i,
  ],
  theming: [
    /\b(theme|theming|dark[_-]?mode|light[_-]?mode)\b/i,
    /\b(material[_-]?theme|cupertino[_-]?theme|color[_-]?scheme)\b/i,
  ],
  localization: [
    /\b(localization|i18n|l10n|translation|locale)\b/i,
    /\b(intl|arb|multi[_-]?language|internationalization)\b/i,
  ],

  // Device Features
  camera: [
    /\b(camera|photo[_-]?capture|video[_-]?capture)\b/i,
    /\b(qr[_-]?code|barcode|scanner|image[_-]?capture)\b/i,
  ],
  file_upload: [
    /\b(file[_-]?upload|upload[_-]?file|multipart)\b/i,
    /\b(file[_-]?picker|document[_-]?picker|storage[_-]?upload)\b/i,
  ],
  location: [
    /\b(location|gps|geolocation|geolocator)\b/i,
    /\b(coordinates|latitude|longitude|geocoding)\b/i,
  ],
  maps: [
    /\b(map|google[_-]?maps|mapbox|leaflet|apple[_-]?maps)\b/i,
    /\b(marker|polyline|geofence|map[_-]?view)\b/i,
  ],

  // Analytics & Monitoring
  analytics: [
    /\b(analytics|tracking|event[_-]?tracking)\b/i,
    /\b(firebase[_-]?analytics|mixpanel|amplitude|segment)\b/i,
    /\b(user[_-]?analytics|app[_-]?analytics)\b/i,
  ],
  deep_linking: [
    /\b(deep[_-]?link|universal[_-]?link|app[_-]?link)\b/i,
    /\b(dynamic[_-]?link|branch\.io|deferred[_-]?deep[_-]?link)\b/i,
  ],
};

export function detectFeatures(text: string): MobileFeatureTag[] {
  const detected: MobileFeatureTag[] = [];
  for (const [feature, patterns] of Object.entries(FEATURE_PATTERNS)) {
    if (patterns.some(p => p.test(text))) {
      detected.push(feature as MobileFeatureTag);
    }
  }
  return detected;
}

export function detectPlatform(text: string): ContentPlatform | undefined {
  if (/\b(flutter|dart|android|ios|swift|kotlin|react[_-]?native|expo)\b/i.test(text)) return 'mobile';
  if (/\b(react|vue|angular|nextjs|svelte|browser)\b/i.test(text)) return 'web';
  if (/\b(node|express|fastify|nestjs|postgresql|supabase|firebase)\b/i.test(text)) return 'backend';
  return undefined;
}

export function detectUsageTier(source: string): UsageTier | undefined {
  if (/docs\.(flutter|supabase|firebase|stripe)\.dev/i.test(source)) return 'official';
  if (/developer\.(apple|android|google)\.com/i.test(source)) return 'official';
  if (/pub\.dev|npmjs\.com/i.test(source)) return 'reference';
  if (/example|sample|demo|starter|template/i.test(source)) return 'example';
  if (/recipe|cookbook|guide|tutorial|how[_-]?to/i.test(source)) return 'recipe';
  return 'reference';
}
```

### 4.1.4 Unit Tests

**File:** `apps/server/src/services/__tests__/feature-detector.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { detectFeatures, detectPlatform, detectUsageTier } from '../feature-detector.js';

describe('feature-detector', () => {
  it('detects auth features', () => {
    expect(detectFeatures('User authentication with Supabase')).toContain('auth');
  });

  it('detects mobile platform', () => {
    expect(detectPlatform('Flutter widget for iOS')).toBe('mobile');
  });

  it('detects official usage tier', () => {
    expect(detectUsageTier('https://docs.flutter.dev/guide')).toBe('official');
  });
});
```

### 4.1.5 Key Files Summary

| File | Action |
|------|--------|
| `packages/shared/src/index.ts` | ADD types |
| `packages/db/migrations/0030_mobile_metadata.sql` | CREATE |
| `apps/server/src/services/feature-detector.ts` | CREATE |
| `apps/server/src/services/__tests__/feature-detector.test.ts` | CREATE |
| `apps/server/src/services/metadata-validator.ts` | MODIFY to call feature detector |

### 4.1.6 Acceptance Criteria

- [ ] TypeScript types compile without errors
- [ ] Migration runs successfully
- [ ] Feature detector tests pass (aim for 90%+ coverage)
- [ ] New documents get `feature_tags` populated
- [ ] No breaking changes to existing APIs

---

## 5. Phase 2: Curated Recipe Docs & Collections

**Problem:** Even with better metadata, agents still need **high‑leverage, opinionated recipes** that combine official docs, examples, and your experience.

### 4.1 Deliverables

- New “recipes” documentation under `docs/recipes/mobile/` with:
  - High‑level patterns for core features (per framework).
  - Links/citations to official docs and curated example repos.
  - Notes on pitfalls, trade‑offs, and version‑specific guidance.
- Dedicated **collections** in Synthesis for:
  - `mobile-recipes` (your docs).
  - `mobile-official-docs` (Flutter, Supabase, Firebase, Stripe, etc.).
  - `mobile-example-repos` (curated GitHub repos).
- Ingestion scripts or agent prompts that:
  - Fetch and ingest these sources.
  - Apply the mobile metadata taxonomy from Phase 1.

### 4.2 Content Guidelines (for recipe docs)

Each recipe doc (e.g., `flutter_auth_supabase.md`) should:

- Start with a **summary** of the recommended approach.
- Include:
  - Tech stack assumptions (Flutter version, Supabase SDK, backend).
  - Step‑by‑step outline.
  - Links to official docs and example code (with URLs).
- Explicitly describe:
  - “Preferred” patterns vs alternatives.
  - Common failure modes and how to detect/fix them.

These docs are ingested like any other Markdown but tagged with:
- `platform = 'mobile'`
- `feature_tags = ['auth', 'supabase', 'flutter']`
- `usage_tier = 'recipe'`

### 4.3 Key Files / Scripts

| File | Action |
|------|--------|
| `docs/recipes/mobile/*.md` | CREATE curated recipe docs (manual content + agent assistance) |
| `scripts/ingest-mobile-recipes.ts` | CREATE helper script to ingest recipe docs with correct metadata |
| `scripts/ingest-mobile-official.ts` | CREATE helper for official docs + example repos (uses existing `fetchWebContent` / repo tools) |

### 4.4 Acceptance Criteria

- At least 3–5 recipes per category:
  - Auth, onboarding, billing, notifications, offline/persistence, navigation.
- Collections created and populated with:
  - Official docs, example repos, recipes.
- Metadata confirms:
  - `platform='mobile'`, `feature_tags` filled, `usage_tier` set.

---

## 6. Phase 3: Feature-Aware Retrieval

**Problem:** Current `smartSearch` is tech‑aware but not **feature‑aware**. Agents need to ask for “Flutter auth with Supabase” and reliably get the right mix of official docs, examples, and recipes.

### 5.1 Deliverables

- Extend `smartSearch` (Phase 11) to support:
  - Filtering and boosting by `feature_tags`, `platform`, `usage_tier`, `source_quality`.
  - Explicit “official‑first” vs “example‑first” modes.
- New search configuration and request parameters:
  - `feature_tags: string[]`
  - `platform: 'mobile' | 'web' | 'backend' | 'shared'`
  - `usage_tier_preference: 'official' | 'balanced' | 'examples' | 'recipes-first'`

### 5.2 Integration Points

- **Search service:** `apps/server/src/services/search.ts`
  - Incorporate `feature_tags` and `platform` into BM25 and vector metadata.
  - Use existing trust scoring (`ENABLE_TRUST_SCORING`) in combination with `usage_tier`.
- **Search route:** `apps/server/src/routes/search.ts`
  - Extend request schema (Zod) with new optional fields.
  - Pass through to `smartSearch`.

### 5.3 Acceptance Criteria

- Test queries (mobile‑focused) retrieve:
  - At least one official doc chunk (when available).
  - At least one example chunk.
  - Recipes when requested via `usage_tier_preference`.
- Diagnostics confirm:
  - Feature filters and boosts are applied without breaking general search.

---

## 7. Phase 4: UI & MCP Exposure

**Problem:** Without clear UI and MCP tools, the new capabilities remain hidden from both you and the agent.

### 6.1 Deliverables

- Web UI:
  - Add **feature filters** and mobile badges in:
    - Search page (`apps/web/src/pages/SearchPage.tsx`).
    - Result cards (`apps/web/src/components/ResultCard.tsx`).
  - Show tags: `platform`, `feature_tags`, `usage_tier`, `source_quality`.
- MCP tools (detailed in Phase 3 plan, but surfaced here):
  - `search_mobile_docs` – feature + framework aware search.
  - `find_code_examples` – bias toward `is_example` chunks and example repos.
  - `get_feature_recipe` – retrieve curated recipe docs and summaries.

UI changes should remain minimal and consistent with existing design, but enough for you to manually verify behavior when not using an MCP agent.

### 6.2 Acceptance Criteria

- UI shows mobile feature tags for relevant results.
- MCP tools can be called with:
  - `framework`, `framework_version`, `feature`, `preference` (official/examples/recipes).
- Tools return JSON payloads that include:
  - Citations with file paths, headings, line ranges, and metadata.

---

## 8. Phase 5: Evaluation & Golden Tasks

**Problem:** It’s hard to know whether the recipes and retrieval are actually good enough for an autonomous agent.

### 7.1 Deliverables

- Define a **golden task set** for mobile SaaS:
  - “Implement email/password auth in Flutter using Supabase.”
  - “Add subscription billing with Stripe to Flutter app.”
  - “Add push notifications for Android/iOS using Firebase.”
  - “Implement offline caching for feed screen.”
- Create a small evaluation harness (similar to Phase 12 RAG eval):
  - For each task:
    - Specify expected frameworks, SDK versions, and docs that should appear.
    - Have scripts call `search_mobile_docs`, `find_code_examples`, `get_feature_recipe`.
    - Log whether the returned sources match expectations.

### 7.2 Key Files

| File | Action |
|------|--------|
| `apps/server/perf/mobile_eval_tasks.json` | DEFINE golden tasks and expected anchors |
| `apps/server/perf/mobile_eval_runner.mjs` | RUN evaluation using new search/MCP endpoints |

### 7.3 Acceptance Criteria

- For each golden task:
  - At least one official doc chunk, one example, and one recipe appear in top‑K.
  - Metadata (framework, version, feature tags) is correct for those chunks.
- Eval harness produces a simple report summarizing coverage and gaps.

Once this phase is complete, agents will have a structured, high‑quality foundation of mobile feature patterns to build on, which later phases (Graph Retrieval and MCP Task Tools) can exploit for more complex workflows.
