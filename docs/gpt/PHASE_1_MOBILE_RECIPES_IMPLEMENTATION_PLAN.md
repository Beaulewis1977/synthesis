# Phase 1: Mobile Feature Recipes & Examples – Implementation Plan

**Version:** 1.0 · **Created:** November 2025  
**Related Docs:**  
- `docs/RAG_AND_MODEL_SELECTOR_IMPLEMENTATION_PLAN.md` (Phases 1, 3, 5, 13, 13.5)  
- `docs/01_TECH_STACK.md`  
- `docs/CONFIGURATION.md` (Code Intelligence & Tech Stack sections)  
- `docs/guides/HYBRID_SEARCH_GUIDE.md`  
- `docs/guides/CODE_SEARCH_GUIDE.md`  
- `docs/guides/SYNTHESIS_GUIDE.md`  
- `docs/new-phases/06_PHASE_15_17_STATUS_REPORT.md`

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

For all work in this phase:

- Branches MUST be created from `develop`.
- Branch names MUST be descriptive and include the GPT phase and scope, for example:
  - `feature/gpt-phase1-mobile-metadata`
  - `feature/gpt-phase1-mobile-recipes`
  - `feature/gpt-phase1-mobile-retrieval`
  - `feature/gpt-phase1-mobile-ui-mcp`
  - `feature/gpt-phase1-mobile-eval`
- Agents MUST NOT commit or push without explicit human approval.
- Every push MUST be followed by a pull request into `develop`.

### 2.1 Workflow Per Phase

```bash
# 1. Create branch (WAIT FOR APPROVAL)
git checkout develop && git pull origin develop
git checkout -b feature/gpt-phase1-mobile-scope

# 2. Implement changes...

# 3. Present changes to human for review

# 4. After APPROVAL: commit
git add -A
git commit -m "feat(phase1-mobile): description"

# 5. After APPROVAL: push
git push -u origin feature/gpt-phase1-mobile-scope

# 6. Create PR
gh pr create --base develop --title "GPT Phase 1: Mobile Feature Recipes – Scope"
```

Adapt `feature/gpt-phase1-mobile-scope` and the PR title for each sub‑phase (metadata, recipes, retrieval, UI/MCP, eval). Also follow the rules in `docs/RAG_AND_MODEL_SELECTOR_IMPLEMENTATION_PLAN.md` §2 and `agents.md`.

---

## 3. Phase Overview

| # | Phase | Priority | Days | Branch (suggested) |
|---|-------|----------|------|--------------------|
| 1 | Mobile Metadata Taxonomy | P0 | 2–3 | `feature/gpt-phase1-mobile-metadata` |
| 2 | Curated Recipe Docs & Collections | P0 | 3–5 | `feature/gpt-phase1-mobile-recipes` |
| 3 | Feature-Aware Retrieval | P1 | 3–4 | `feature/gpt-phase1-mobile-retrieval` |
| 4 | UI & MCP Exposure | P2 | 2–4 | `feature/gpt-phase1-mobile-ui-mcp` |
| 5 | Evaluation & Golden Tasks | P2 | 2–3 | `feature/gpt-phase1-mobile-eval` |

---

## 4. Phase 1: Mobile Metadata Taxonomy

**Problem:** Existing metadata and tech detection (Phases 3, 13, 13.5) do not explicitly model **features** (auth, billing, notifications) or **platform‑level concerns** needed for mobile SaaS agents.

### 3.1 Deliverables

- Extended metadata types for mobile feature tagging:
  - At document level: `platform`, `feature_tags`, `usage_tier`, `recommended?`.
  - At chunk level: `is_example`, `is_recipe`, `feature_tags`, `platform`.
- Ingestion‑time inference utilities for:
  - Mapping docs/repo paths and content to mobile features.
  - Mapping to specific frameworks/SDK versions.
- Migrations to persist this metadata in `documents.metadata` and `chunks.metadata`.

### 3.2 Key Design Points

- Reuse and extend **existing types** in `packages/shared/src/index.ts`:
  - `DocumentMetadata`, `ChunkMetadata`, `DocumentFramework`, `DocumentLanguage`, `DocumentContentCategory`.
- Add **non‑breaking fields** such as:
  - `platform?: 'mobile' | 'web' | 'backend' | 'shared';`
  - `feature_tags?: string[];` (e.g., `['auth', 'billing', 'notifications', 'offline']`)
  - `usage_tier?: 'official' | 'reference' | 'example' | 'recipe';`
  - On chunks: `is_example?: boolean; is_recipe?: boolean; feature_tags?: string[];`.
- Extend `detectTechStack` (`apps/server/src/services/tech-detector.ts`) with:
  - Signals for **Android**, **iOS/Swift**, **React Native** if needed later.
  - Stronger Flutter/Supabase/Firebase detection feeding into `feature_tags`.

### 3.3 Key Files

| File | Action |
|------|--------|
| `packages/shared/src/index.ts` | ADD optional `platform`, `feature_tags`, `usage_tier`, `is_recipe`, `is_example` fields |
| `apps/server/src/services/metadata-validator.ts` | UPDATE schemas/inference to support new fields (no stricter requirements) |
| `apps/server/src/services/tech-detector.ts` | EXTEND to emit richer `tech_stack` tags usable as `feature_tags` seeds |
| `packages/db/migrations/0XX_mobile_metadata.sql` | CREATE migration to backfill or index new metadata fields as needed |

### 3.4 Acceptance Criteria

- All newly ingested documents and chunks have:
  - `platform` where inferable.
  - `feature_tags` when a feature can be confidently detected.
  - `usage_tier` consistently set (`official`/`reference`/`example`/`recipe`).
- Existing ingestion paths continue to work with default/empty values.
- No breaking changes to existing API responses.

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
