# Flutter SaaS RAG System Design

## Status: IN PROGRESS - Phase 1 Complete, Ready for Doc Review

## Goal

Build a comprehensive RAG system so a coding agent (Claude Code) can help build a full-stack Flutter SaaS mobile app capable of handling millions of users.

---

## The Big Picture: What I'm Trying To Do

### My Situation
I have a **working Next.js web app** (Recipe Slot Machine) that works for 1 person. I need to turn it into a **Flutter mobile app** that can work as a SaaS (Software as a Service) for many users with subscriptions, payments, etc.

I'm **not an experienced developer** - I'm learning as I go. I need AI coding assistants (like Claude Code) to help me build this professionally. This app is important because **it will help me feed my family**.

### The Problem I'm Solving
When I use Claude Code to help me build, it:
- Doesn't know about my existing webapp code
- Doesn't know the official Flutter/Supabase/etc documentation
- Has a limited context window that fills up fast
- Can't search through my build docs and architecture decisions

### The Solution: Synthesis RAG
**Synthesis** is a RAG (Retrieval-Augmented Generation) system that will:
1. **Store all my code and docs** in a searchable vector database
2. **Let my coding agent search** for relevant info without filling up context
3. **Include official documentation** (Flutter, Supabase, Stripe, etc.)
4. **Give accurate, relevant answers** to help build my app professionally

### What I Want To Happen
```
Me: "How should I implement RevenueCat subscriptions in my Flutter app?"

Claude Code: *searches Synthesis RAG*
           → Finds my SAAS_TECHNICAL_SPECIFICATIONS.md (my architecture decisions)
           → Finds RevenueCat official docs
           → Finds similar patterns in my existing webapp
           → Gives me a professional, accurate answer that fits MY project
```

### My Tech Stack (Target)
- **Frontend**: Flutter 3.24.5 (mobile app for iOS & Android)
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, Edge Functions)
- **Payments**: RevenueCat + Stripe
- **Cache**: Redis via Upstash
- **Analytics**: Firebase, Sentry, PostHog
- **Push**: OneSignal
- **AI**: OpenAI GPT-4o-mini (for in-app chatbot)

### What I Have Now
- ✅ Working Next.js webapp (single-user, not SaaS)
- ✅ Lots of documentation (but some outdated)
- ✅ Architecture decisions documented
- ⚠️ Partially built Flutter app (needs work)
- ❌ No way for my coding agent to search my docs

---

## User Context Summary

- **Experience level**: New to development, learning as I go
- **Goal**: Convert working webapp MVP → Flutter SaaS mobile app
- **Why it matters**: Critical project - feeding family depends on it
- **Target platform**: Flutter (NOT React Native, despite some old docs mentioning it)
- **Budget**: Limited - prefer free/cheap options
- **Documentation state**: Extensive but some outdated - needs review before ingesting

---

## Tech Stack (from user's architecture doc)

### Core Infrastructure
- **Flutter**: 3.24.5 (or possibly React Native - TBD)
- **Dart**: 3.5.4
- **Supabase**: 2.46.1 (PostgreSQL 16.4, Auth, Realtime, Storage, Edge Functions)
- **Redis**: 7.4.1 (via Upstash serverless)
- **Node.js**: 20.18.0 LTS
- **Deno**: 2.0.4 (Supabase Edge Functions)

### Mobile SDKs
- supabase_flutter: 2.6.0
- RevenueCat Flutter SDK: 9.0.0
- Firebase Analytics: 11.3.0
- Sentry Flutter: 8.9.0
- OneSignal Flutter: 5.2.5
- Branch Flutter SDK: 7.1.0

### Payments & Monetization
- RevenueCat (Apple StoreKit 2.0, Google Play Billing 7.0.0)
- Stripe API 2024-11-20.acacia

### AI/Vector
- OpenAI GPT-4o-mini (chatbot)
- pgvector 0.7.4 (embeddings)

### Infrastructure
- Cloudflare CDN/Workers (translation proxy, caching)
- Firebase Analytics
- Sentry error tracking
- PostHog product analytics
- OneSignal push notifications
- Branch.io deep linking

---

## File Types Synthesis Must Support

### Currently NOT supported (MUST ADD):
- `.xml` - AndroidManifest, layouts, configs
- `.swift` - iOS native code
- `.kt` / `.java` - Android native code
- `.gradle` / `.gradle.kts` - Build configs
- `.plist` - iOS configs
- `.sql` - Database migrations (CRITICAL)
- `.hcl` - Terraform IaC
- `.yaml` / `.yml` - pubspec, CI configs, docker-compose
- `.toml` - Config files
- `.tsx` / `.jsx` - React/Next.js components

### Need verification:
- `.dart` - Flutter (likely works)
- `.ts` / `.js` - Node/Deno (likely works)
- `.json` - Configs (likely works)
- `.md` - Documentation (works)

---

## RAG Data Sources

### 1. User's Own Code & Docs (INGEST)
- Next.js webapp repo (source to copy from)
- Flutter app (as it's built)
- Build docs / architecture decisions
- Supabase migrations
- Edge functions
- Wireframes/images (if supported)

### 2. Official Documentation
**Tier 1 - Critical (daily use):**
- Flutter/Dart docs
- Supabase docs (Auth, DB, Edge Functions, Realtime, Storage)
- RevenueCat docs
- Stripe docs

**Tier 2 - Important (weekly use):**
- PostgreSQL docs (pgvector, RLS, functions)
- Redis/Upstash docs
- Cloudflare Workers docs
- Deno docs

**Tier 3 - Reference (occasional):**
- Firebase Analytics docs
- Sentry docs
- OneSignal docs
- Branch.io docs
- OpenAI API docs
- Terraform docs

**Strategy**: Use Context7 MCP for official docs (always fresh) + ingest user's own code

### 3. Quality Reference Code
- Open source Flutter SaaS examples
- Supabase starter templates
- Best practice patterns

---

## Architecture Diagram

```
Coding Agent (Claude Code)
         │
         ▼
    Synthesis MCP Server
         │
         ├── User's Code & Docs ────────────────┐
         │   • Next.js webapp (copy from)       │
         │   • Flutter app (building)           │  Ingested into
         │   • Build docs / architecture        │  Synthesis RAG
         │   • Supabase migrations              │  (pgvector)
         │   • Edge functions                   │
         │                                      │
         ├── Official Docs ─────────────────────┤
         │   • Flutter, Supabase, RevenueCat    │  Context7 MCP
         │   • Stripe, Redis, PostgreSQL        │  (on-demand)
         │                                      │
         └── Quality Reference Code ────────────┘
             • OSS Flutter SaaS examples         Ingested
             • Supabase templates
```

---

## Implementation Tasks

### Phase 1: Fix Synthesis Ingestion ✅ DONE (2025-12-12)
- [x] Add XML support (AndroidManifest, layouts)
- [x] Add Swift support
- [x] Add Kotlin/Java support
- [x] Add Gradle support
- [x] Add plist support
- [x] Add SQL support (migrations) - was already supported
- [x] Add YAML/YML support - was already supported
- [x] Add TSX/JSX support - was already supported
- [x] Add HCL support (Terraform)
- [x] Verify Dart support works correctly - was already supported
- [x] Add HTML/CSS/SCSS support
- [x] Add Vue/Svelte support
- [x] Add extensionless files (Dockerfile, Makefile, Podfile, etc.)

**See:** `docs/plans/2025-12-12-synthesis-file-type-update.md`

### Phase 2: Better Evaluation
- [ ] Create larger, more diverse eval dataset (50-100 queries)
- [ ] Include cross-file queries
- [ ] Include architectural queries
- [ ] Test with real Flutter SaaS codebase

### Phase 3: Ingest User's Code
- [ ] Ingest Next.js webapp repo
- [ ] Set up incremental sync
- [ ] Create collection per project/concern

### Phase 4: Official Docs Strategy
- [ ] Evaluate Context7 vs ingestion for each doc source
- [ ] Set up Context7 MCP integration
- [ ] Consider hybrid approach

### Phase 5: Reference Code
- [ ] Find quality Flutter SaaS open source repos
- [ ] Find Supabase starter templates
- [ ] Ingest best examples

---

## Evaluation Results So Far (Lifer Flutter Repo)

### Pass 1A (Embeddings) - voyage-code-3 WINNER
- MRR: 0.867, Hit Rate: 93.3%, Zero Hits: 1/15
- OpenAI/Ollama failed (API key issues, crashes)

### Pass 2 (Chunking) - All tied
- 400/50, 600/100, 800/100 all performed identically
- Dataset too small to differentiate

### Pass 3 (Rerankers) - NO RERANKER won
- No reranker: MRR 0.867
- BGE reranker: MRR 0.776 (WORSE)
- Voyage reranker: MRR 0.776 (WORSE)
- Rerankers hurt code retrieval with voyage-code-3

### Key Finding
- 15 queries is too small for reliable evaluation
- Need 50-100+ diverse queries
- Need cross-file and architectural queries

---

## Next Steps

1. **Save this context** ✅
2. **User shares webapp repo URL**
3. **Explore repo structure** (use subagent to avoid context bloat)
4. **Design ingestion plan** for that specific codebase
5. **Implement file type support** for missing types
6. **Create better evaluation dataset**

---

## User's Webapp Repo

**Location:** `/mnt/d/dev/recipe-for-flutter/recipe_slot_app`

**Structure:**
- Next.js 14 webapp in `/app/` - WORKING (99 TS/TSX files)
- Flutter app in `/lib/` - EXISTS but needs update (18 Dart files)
- 21 markdown documentation files - NEEDS REVIEW (some outdated)

**See:** `docs/plans/recipe-webapp-analysis.md` for full breakdown

---

## NEXT STEP: Review Documentation for Ingestion

**WARNING:** User noted many docs are outdated (references to React Native, old tech).
Need to review each doc before ingesting to avoid polluting RAG with incorrect info.

### Docs to Review (in /mnt/d/dev/recipe-for-flutter/recipe_slot_app/):

| Doc | Size | Likely Status | Action Needed |
|-----|------|---------------|---------------|
| SAAS_TECHNICAL_SPECIFICATIONS.md | 1781 lines | Review needed | Check if Flutter-focused |
| FEATURE_PORTING_SPECIFICATIONS.md | 1586 lines | Review needed | May have RN references |
| WEB_TO_MOBILE_MAPPING.md | 26925 bytes | Review needed | Check target platform |
| MOBILE_PARITY_MASTER_PLAN.md | 520 lines | Review needed | Check if current |
| FLUTTER_PROJECT_GUIDE.md | 9338 bytes | Likely good | Flutter-specific |
| README.md | 524 lines | Likely good | General overview |
| TODO.md | 12291 bytes | Review needed | May be outdated |

**Decision needed:** Which docs to ingest vs skip vs update first.

---

## Notes

- User is new to RAG tooling - need clear, step-by-step instructions
- Critical project - professional quality required (feeding family)
- Budget-conscious - use free/cheap options where possible
- Offline capability important (can't always rely on internet)
- Target: Flutter SaaS (not React Native, despite some docs mentioning RN)
- Some documentation is outdated - must review before ingesting
