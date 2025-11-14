## Extended Tech Stack & Repo Ingestion Roadmap

**Version:** 1.0  
**Date:** 2025-11-13

---

### 1. Goals

This document defines additional capabilities for Synthesis beyond the current v2.0 and `@new-phases` plans, focused on:

- **Multi-stack support** for:
  - Flutter/Dart (already strong but can be extended)
  - Native Android (Kotlin/Java)
  - iOS (Swift), with room for Objective‑C if needed
  - React Native
  - Web stacks (React, Next.js)
  - Backend stacks (Node/TypeScript, Python)
  - Data & infra stacks (Supabase/PostgreSQL/pgvector, Redis, Firebase, etc.)
- **Repo‑level ingestion and sync** for GitHub and other git remotes.
- **Tech‑stack aware collection profiles** tuned to concrete project stacks and versions.
- **Feedback, observability, and multi‑user foundations** to support both your own agents and eventually other users.

This is **not** a full phase breakdown yet; it is a roadmap/specification so a planning agent can later turn it into concrete phases, build plans, and GitHub issues.

---

### 2. Target Tech Stacks

This section lists the tech families Synthesis should explicitly support for code intelligence, search, and ingestion.

#### 2.1 Flutter & Dart (Current Primary Stack)

**Example app stack (first app):**

- **Flutter:** 3.24.5 (stable)
- **Dart:** 3.5.4
- **Supabase:** 2.46.1 (PostgreSQL 16.4, PostgREST 12.2.3, Realtime 2.30.34, Storage API 1.11.13, GoTrue 2.158.1)
- **Redis:** 7.4.1 (Upstash serverless)
- **Node.js:** 20.18.0 LTS (tooling)
- **Deno:** 2.0.4 (Supabase Edge Functions)
- **Mobile SDKs:** `supabase_flutter`, RevenueCat, Firebase Analytics, Sentry, OneSignal, Branch, etc.

**Goal for Synthesis:**

- Ingest and index:
  - Official Flutter and Dart docs.
  - Supabase docs (core product + Postgres, PostgREST, Realtime, Storage, GoTrue).
  - pgvector/pg_cron/PostGIS/pg_stat_statements/uuid‑ossp docs and examples.
  - SDK/third‑party docs (RevenueCat, Firebase, Sentry, OneSignal, Branch) at least at the guide/API level.
  - Your Flutter app repos (with AST chunking and file relationships already in place).
- Provide search/synthesis that:
  - Understands Flutter project structure (`lib/`, `test/`, `pubspec.yaml`).
  - Links business logic to Supabase schema, Edge functions, and DB migrations.
  - Can answer questions like “how do I track subscription state with Supabase + RevenueCat in Flutter 3.24.5?”.

#### 2.2 Native Android (Kotlin/Java)

**Goal:**

- Support ingestion and code‑aware search over:
  - Android app repos (Gradle, Android Studio structure).
  - Official Android/Jetpack docs.
  - Kotlin and Java language references, plus common libraries used in your apps.
- Provide file‑aware search for:
  - Activities/fragments, ViewModels, Compose components.
  - Gradle build files and manifest configs.

#### 2.3 iOS (Swift)

**Goal:**

- Support ingestion and code-aware search over:
  - Swift and iOS projects (Xcode structure, `*.swift`, `*.xcodeproj`, `Package.swift`).
  - Apple developer docs (UIKit, SwiftUI, Combine, etc.) relevant to your apps.
- Provide chunking and relationships for:
  - View controllers, SwiftUI views, services, URLSession/Alamofire networking, etc.

#### 2.4 React Native

**Goal:**

- Handle hybrid stacks mixing:
  - JS/TS code (React Native components, hooks).
  - Native modules (Kotlin/Java/Swift) bridged into the app.
- Understand project structure:
  - `android/`, `ios/`, `app.json`, Metro bundler config.
- Ingest and index React Native docs and library docs (e.g. navigation, AsyncStorage, analytics SDKs).

#### 2.5 Web: React & Next.js

**Goal:**

- Ingest and index:
  - Official React and Next.js docs (including latest app-router concepts).
  - Common ecosystem libs (React Query/TanStack Query, Tailwind, NextAuth, etc.).
- Provide code‑aware search for:
  - Components, hooks, API routes (`pages/api` or `app/api`).
  - Data fetching patterns (SSR/ISR/CSR) and associated backend calls.

#### 2.6 Backends: Node/TypeScript & Python

**Goal:**

- Node/TypeScript:
  - Support typical frameworks: Express, Fastify, NestJS, Next.js API routes.
  - Understand project structure (`src/`, `routes/`, `controllers/`, `services/`, `prisma/`, etc.).
- Python:
  - Support frameworks like FastAPI and Django.
  - Index API routes, models, serializers, management commands.

#### 2.7 Data & Infra: Supabase, PostgreSQL, Redis, Firebase

**Goal:**

- Supabase/Postgres:
  - Ingest Supabase docs + related Postgres extensions you use.
  - Index schema migrations, SQL functions, triggers, and pgvector usage from your repos.
- Redis (Upstash or self‑hosted):
  - Ingest docs and pattern guides (caching, queues, rate limiting, pub/sub).
  - Map where Redis is used in each backend.
- Firebase:
  - Ingest docs for Analytics, Auth, Firestore/RTDB, Functions.
  - Connect them to usage sites in your apps (Flutter, React Native, React web).

---

### 3. Feature Areas & Workstreams

This section translates the earlier suggestions into concrete workstreams. Each workstream can later become one or more phases.

#### 3.1 Multi-Language Code Intelligence

**Objective:** Extend AST‑style or structure‑aware chunking beyond Dart/TypeScript to other project languages.

**Languages/targets:** Kotlin, Java, Swift, Python (for backends), plus better heuristics for JavaScript (React/Next.js) where AST support may be lighter-weight.

**Key tasks:**

- **Language detection & metadata**
  - Ensure file type detection handles `.kt`, `.java`, `.swift`, `.py`, standard JS/TS patterns (`.tsx`, `.jsx`, route/file conventions).
  - Extend metadata schema to capture:
    - `language`, `framework`, `layer` (UI, domain, data, infra), `platform` (mobile/web/backend).

- **Project-structure aware chunking**
  - Kotlin/Java (Android): detect modules, Gradle root/module structure, and group tests with their sources.
  - Swift (iOS): detect modules from Xcode project, map view controllers/SwiftUI views and services.
  - React/Next.js: chunk by component/route boundaries, keep associated hooks and CSS/Styled components together.

- **Function/class-level chunking**
  - For each supported language, target chunks that keep functions/classes intact, approximating how Dart/TS are handled now.

- **File relationship tracking**
  - Extend existing file relationships to include:
    - Android: module dependencies, DI graphs (e.g. Hilt), navigation graphs.
    - iOS: storyboards/SwiftUI views linked to view models/services.
    - React/Next.js: component trees, route relationships, API routes → data layer.

**Outcome:** Synthesis can answer questions like "where is the login flow implemented across Android, iOS, and React web?" with high‑quality code navigation.

#### 3.2 GitHub Repo Ingestion & Sync

**Objective:** Move beyond single‑file/URL ingestion to full repo-level ingestion, with incremental updates.

**Key tasks:**

- **Repo ingest pipeline**
  - Add an ingestion mode for git repositories:
    - Clone a repo (read‑only) to a local or temp directory.
    - Walk the tree with language‑aware filters to include/exclude files.
    - Feed files into the existing extraction/chunking pipeline.
  - Allow configuration of:
    - Default branch(es) to index.
    - Ignored paths (e.g. `node_modules/`, build artifacts).

- **Incremental sync**
  - Store repo metadata in the DB:
    - `repo_url`, `default_branch`, `last_ingested_commit`, `last_synced_at`.
  - When re-syncing:
    - `git fetch` + `git diff` to find changed/added/deleted files.
    - Only re-extract and re-embed changed files.

- **Mapping to collections**
  - Design a clear mapping:
    - One repo → one collection, or
    - One project → multiple collections (e.g. docs vs app code vs infra).

- **MCP tools & UI hooks**
  - MCP tool(s) to:
    - `add_repo_to_collection` (given repo URL + collectionId).
    - `sync_repo` to pull latest changes.
  - UI elements:
    - "Add repo" form in the collection view.
    - Status display for last sync and commit.

**Outcome:** Agents can say "sync the main app repo" or "add this new backend repo" and have Synthesis keep them indexed over time.

#### 3.3 Tech-Stack-Aware Collection Profiles

**Objective:** Make each collection explicitly aware of its tech stack, versions, and standards, so retrieval and synthesis can be tuned to that stack.

**Key tasks:**

- **Collection manifest**
  - Extend `collections` metadata to store:
    - `primary_languages` (e.g. `['dart', 'typescript']`).
    - `frameworks` (e.g. `['flutter', 'supabase', 'supabase_flutter', 'redis', 'firebase']`).
    - Version info where important (e.g. Flutter 3.24.5, Supabase 2.46.1, Redis 7.4.1).

- **Tech-stack detection & confirmation**
  - Use existing tech detector heuristics for initial guess.
  - Allow manual overrides: wizard in the UI to confirm stack for a new collection.

- **Retrieval tuning**
  - When searching within a collection:
    - Prefer docs/examples that match the collection’s tech stack and major versions.
    - Down-weight snippets that obviously target incompatible versions or stacks.

- **Profile templates**
  - Define templates for common stacks:
    - "Flutter + Supabase + RevenueCat + Firebase Analytics + Sentry + OneSignal + Branch".
    - "React Native + Supabase + Firebase".
    - "Next.js + Supabase + Redis".
  - These templates can preconfigure ingestion sources (official docs, guides, starter repos) and environment parameters.

**Outcome:** New collections can be configured quickly for your stack, and Synthesis can avoid mixing irrelevant tech in its answers.

#### 3.4 Feedback & Evaluation Loop

**Objective:** Add a simple but powerful feedback channel to improve retrieval and synthesis quality over time.

**Key tasks:**

- **Feedback schema**
  - Add a `feedback` table keyed by search/query or synthesis result:
    - `id`, `collection_id`, `query`, `result_ids`, `rating` (up/down/score), `comments`, `created_at`, `source` (`user` vs `agent`).

- **UI hooks**
  - Optional thumbs up/down on search results and synthesis answers.
  - “Mark as a good example” for particular code snippets.

- **MCP tools**
  - Tool for agents to record whether a retrieval/synthesis was helpful for a task.

- **Offline analysis**
  - Later, use this to:
    - Spot bad snippets.
    - Adjust scoring heuristics.
    - Identify missing docs/repos to ingest.

**Outcome:** Over time, your particular workflows (and later, other users’) can tune the system beyond the default ranking.

#### 3.5 Observability & Multi-User Foundations

**Objective:** Prepare Synthesis for use by other coders, not just you.

**Key tasks:**

- **Metrics & logging**
  - Structured logs for search, ingestion, synthesis, MCP calls.
  - Metrics for latency, error rates, provider usage per collection and (eventually) per user.

- **Basic auth & tenancy (future)**
  - Add a user model and simple auth (even just token-based to start).
  - Map collections and usage to users/teams.

- **Quotas & protections**
  - Rate limiting on key endpoints.
  - Soft quotas per user/team for provider usage and storage.

**Outcome:** When you decide to open Synthesis to others, you won’t need a full re-architecture; the hooks will exist for access control and monitoring.

#### 3.6 Agent Workflows Beyond RAG

**Objective:** Make it easier for coding agents to use Synthesis not only to retrieve docs, but to drive actual feature development.

**Key tasks:**

- **Task-oriented MCP tools**
  - Tools that:
    - Given a feature request, fetch a minimal context pack from Synthesis (docs + code) for that feature.
    - Summarize relevant parts of the schema/code for a particular change.

- **Integration with repo ingestion**
  - When a repo has been ingested, allow agents to:
    - Ask for “the smallest context needed to implement X” (e.g., existing widgets, blocs, services, DB tables).

- **Planning support**
  - Generate structured “implementation plans” from Synthesis knowledge that can be fed back into agents as prompts.

**Outcome:** Synthesis becomes an **active collaborator** for your coding agents, not just a doc search engine.

---

### 4. Suggested Phasing (High Level)

This section outlines a rough phase grouping for a future planning agent. Names and numbers are placeholders and should be reconciled with the main roadmap when you’re ready.

- **Phase A – Multi-Language Code Intelligence**
  - Kotlin/Java Android support, Swift iOS support, better JS/TS heuristics, extended file relationships.

- **Phase B – GitHub Repo Ingestion & Sync**
  - Repo ingest pipeline, incremental sync, mapping to collections, MCP tools and UI.

- **Phase C – Tech-Stack Profiles for Collections**
  - Collection manifest, detection/confirmation flow, retrieval tuning, predefined templates for your primary stacks (starting with your Flutter/Supabase example).

- **Phase D – Feedback & Observability**
  - Feedback schema + UI + MCP tools; core logging and metrics.

- **Phase E – Multi-User & Operational Foundations (Optional, for public use)**
  - Basic auth, tenancy, quotas, stronger observability.

- **Phase F – Agent Workflow Integrations**
  - Task-oriented MCP tools and planners built on top of Synthesis.

Each of these phases can be split further into build plans and GitHub issues later. The key is that this roadmap captures **all the extra capabilities** needed to:

- Support your broader tech stacks (Flutter, native mobile, React/Next.js, Node/Python backends, Supabase/Postgres/Redis/Firebase).
- Ingest and keep large repos in sync.
- Evolve Synthesis into a platform that both your own agents and other coders can rely on for serious app development.
