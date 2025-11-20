## Phase 15–17 Status & Roadmap Report

**Version:** 1.0  
**Date:** 2025-11-13

---

### Executive Summary

This report summarizes where the Synthesis project currently stands (through Phase 15), how the existing Phase 16 plan fits, and how the new `@new-phases` plans (MCP completion, UI/UX enhancements, persistent chat, autonomous ingestion) should be integrated without conflicting with the existing roadmap.

At a high level:

- The **core v2.0 architecture is complete and strong**: hybrid search, multi-provider embeddings, re-ranking, synthesis, code intelligence, tech stack filtering, and cost tracking are all implemented and documented.
- **Phase 15 work is well underway**:
  - Issue **#67 (Integration Testing)** and **#69 (Frontend Polish)** are effectively complete according to the Day 1 and Day 3 summaries.
  - Issue **#68 (Backend Performance)** appears partially or implicitly done via integration tests, but the explicit profiling/caching/load-testing work is not clearly documented.
  - Issue **#70 (Documentation)** is in progress; many required docs already exist and are largely aligned with v2.0.
- The existing **Phase 16** in `CURRENT_PHASE_STRUCTURE.md` is defined as **Final Testing & v2.0 Release** (End-to-End + Load testing) and has not been executed yet.
- The **new `docs/new-phases` Phase 16/17 plans** represent **post‑v2 feature work** (MCP server completion, chat history, doc lifecycle management, and autonomous ingestion). However, they currently conflict in numbering with the existing "Phase 16" in the main roadmap.

The rest of this document details current status, conflicts, and concrete suggestions for how to reconcile and sequence these phases.

---

### 1. Current System & Phase Status

#### 1.1 Architecture & Capabilities (v2.0 Baseline)

From `docs/02_ARCHITECTURE.md` and the Phase 11–14 docs:

- **Frontend (React + Vite)**
  - Pages for dashboard, collections, upload, chat, and cost monitoring.
  - React Query for server state, a design system now tuned for accessibility and performance (Phase 15 polish).
- **Backend (Fastify)**
  - Core endpoints for collections, documents, ingestion, search, synthesis, and cost summaries.
  - Integration with the Claude Agent SDK and tools for RAG operations.
- **RAG & Intelligence Pipeline**
  - Hybrid search (BM25 + vector + RRF), tech stack filter, multi-provider embeddings (Ollama, OpenAI, Voyage).
  - Re-ranking (Cohere/local BGE), synthesis, contradiction detection, and cost tracking.
  - AST-based code chunking and file relationships for code intelligence (Phase 13 / 13.5).
- **MCP & Agents**
  - MCP server with stdio and HTTP/SSE modes.
  - Claude agent orchestrator with tools for search, ingestion, and web fetching.

**Conclusion:** The architecture already reflects a mature v2.0 system; remaining pre‑release work is about integration confidence, performance hardening, and documentation polish.

#### 1.2 Completed Phases

From `docs/phases/CURRENT_PHASE_STRUCTURE.md` and `PHASES_11-15_SUMMARY.md`:

- **Phases 1–9**: MVP + polish + Docker – **complete**.
- **Phase 11 – Hybrid Search & Multi-Model Embeddings** – **complete**.
- **Phase 12 – Re-ranking & Document Synthesis** – **complete** at the backend, including cost monitoring and synthesis APIs.
- **Phase 13 – Code Intelligence & AST Chunking** – **complete**.
- **Phase 13.5 – Backend Parsing & Tagging** – **complete**.
- **Phase 14 – Tech Stack Filtering** – **complete**, with closure summaries, issues and milestone closed.

The result is a feature-rich system: hybrid search, multi-provider embeddings, re-ranking, synthesis, code intelligence, tech stack filters, and cost monitoring are implemented and wired end-to-end.

#### 1.3 Phase 15 – Integration & Polish

**Scope** (from `phase-15/00_PHASE_15_OVERVIEW.md`, `04_BUILD_PLAN.md`, `PHASE_15_ISSUE_PACK.md`):

- Issue **#67** – Integration Testing – All Features Working Together (Day 1)
- Issue **#68** – Performance Optimization – Maintain <600ms Target (Day 2, backend)
- Issue **#69** – Frontend Polish – Visual Consistency & Mobile Responsive (Day 3)
- Issue **#70** – Update Documentation for v2.0 Features (Day 4)

**Status by issue:**

- **#67 – Integration Testing** (**Effectively done**)
  - `PHASE_15_DAY_1_SUMMARY.md` describes 23 new integration tests (1,053 LOC) added to `apps/server/src/services/__tests__/integration.test.ts`.
  - All Phase 11–14 feature combinations are covered (hybrid + re-ranking + code intelligence + tech stack).
  - Tests validate:
    - All features can be enabled together.
    - p95 latency <600ms in the integration test environment.
    - Correct propagation of metadata, trust scores, file relationships, and cost tracking.
  - Known caveat: “graceful degradation” is tested via alternate code paths rather than true runtime fallback.

- **#69 – Frontend Polish** (**Effectively done**)
  - `PHASE_15_DAY_3_SUMMARY.md` shows:
    - All color-contrast issues fixed to WCAG AA.
    - All critical buttons now meet 44x44 CSS pixel touch target requirements.
    - Accessibility coverage via Playwright tests (keyboard navigation, focus states, ARIA, semantic landmarks).
    - Design system consistency: typography and spacing largely standardized; tech stack, trust badges, cost dashboard, synthesis view, related files, and filters all polished.
    - Frontend performance optimized with React.lazy routing, vendor chunking, and meta hints, achieving Lighthouse Performance 99/100.
  - Remaining gaps are mostly **manual QA** (screen reader on real devices, Lighthouse on additional pages), not structural work.

- **#68 – Backend Performance Optimization** (**Documented but still needs headroom work**)
  - The new `PHASE_15_DAY_2_SUMMARY.md` plus perf artifacts capture the caching/indexing/profiling work and the 120-VU load test.
  - Artillery run (120 VUs, 20,480 docs) held p95 at 552 ms with Redis-backed caches (search cache TTL 5 min, embedding TTL 60 min, rerank TTL 10 min).
  - Remaining follow-ups: Voyage embedding batching + re-run at 200 VUs to prove more headroom before Phase 16.

##### Phase 15 Day 2 – Backend Performance Summary (Issue #68)

- **Instrumentation & Monitoring:** Prometheus histograms + cache counters exposed via `apps/server/src/services/metrics.ts`, scraped during load (see `logs/perf/phase15_day2_artillery.md`). Gzip + structured logging already enabled.
- **Caching Strategy:**
  - Search-response cache (`apps/server/src/services/cache/search-cache.ts`): Redis + in-memory LRU, TTL=5 min, keys derived from query + filters.
  - Embedding cache (`apps/server/src/services/embedding-cache.ts`): TTL=60 min with provider+model signature.
  - Reranker cache (`apps/server/src/services/cache/rerank-cache.ts`): TTL=10 min, signatures include candidate IDs, prevents duplicate Cohere/BGE calls.
  - Related-files cache (`apps/server/src/services/cache/related-files-cache.ts`): TTL=15 min with invalidation hooks tied to relationship mutations.
- **Indexes & Query Rewrites:** `packages/db/migrations/007_performance_extensions.sql` enables `pg_stat_statements`, adds `document_chunks_collection_id_tech_stack_idx`, and rewrites relationship queries to use covering indexes. Query plans captured in `logs/perf/phase15_day2_query_plans.txt` show 5.1 ms execution with all buffers served from cache.
- **Load Test Evidence:** Artillery scenario `apps/server/perf/load-test.yml` ramped 20→120 VUs (95 req/s sustained) against a 20,480-document corpus. Results (`test-results/perf/phase15_day2_artillery.json` + narrative report) recorded p50 318 ms, **p95 552 ms**, p99 683 ms, error rate 0.6% (warm-up 429s only). Resource telemetry logged in `test-results/perf/phase15_day2_grafana.md` (Fastify CPU 64–71%, RSS 4.4 GB, Postgres CPU 52%, Redis memory 180 MB).
- **Profiling & Query Plans:** Flamegraph + profiler notes live in `logs/perf/phase15_day2_profiler.md` / `.csv` with top hot paths (rerank scoring 22%, embedding fetch 18%). Postgres EXPLAIN dumps stored in `logs/perf/phase15_day2_query_plans.txt`.
- **Outstanding Risks:** Headroom beyond 120 VUs and Voyage batching remain open (tracked in issue #68). Section 4.1 below outlines the plan to land batching and rerun at 200 VUs before kicking off current-roadmap Phase 16.

- **#70 – Documentation for v2.0** (**In progress, many pieces done**)
  - Required artefacts largely exist:
    - `README.md` (being updated for v2.0),
    - `02_ARCHITECTURE.md` (explicitly versioned 2.0),
    - `05_API_SPEC.md`, `06_PIPELINE.md`, `04_AGENT_TOOLS.md`,
    - Guides: `HYBRID_SEARCH_GUIDE.md`, `COST_MANAGEMENT_GUIDE.md`, `CODE_SEARCH_GUIDE.md`, `SYNTHESIS_GUIDE.md`,
    - `MIGRATION_v1_to_v2.md`, `CONFIGURATION.md`, `TROUBLESHOOTING.md`.
  - Day 4 is largely about **alignment and gap-filling**: ensuring all docs match the current implementation and cross-link correctly.

**Summary:** Phase 15 is **late‑stage**. Two issues (#67, #69) are essentially complete. #70 is active and mostly about consistency. #68 now has a documented baseline but still needs Voyage batching + a 200 VU rerun before the Phase 16 gate.

#### 1.4 Existing Phase 16 – Final Testing & Release

From `CURRENT_PHASE_STRUCTURE.md`:

- **Phase 16: Final Testing & v2.0 Release** (planned)
  - Issues:
    - **#71** – End-to-End Testing – Complete user flows.
    - **#72** – Load Testing – 20,000 file performance validation.
  - Status: planned, not yet executed.

This is the final validation and release phase in the **current roadmap**. It assumes Phase 15’s integration, performance, frontend polish, and docs are complete.

---

### 2. New `@new-phases` Plans (Post‑v2 Features)

The `docs/new-phases` folder defines a different “Phase 16” and “Phase 17” that are not the same as the existing Final Testing Phase 16.

#### 2.1 New-Phases “Phase 16”: Feature Completion & Hardening

From `00_PHASE_16_OVERVIEW.md` and `01_BUILD_PLAN.md`:

**Goals:**

1. **MCP Server Completion & Hardening**
   - Complete management tools in `apps/mcp/src/index.ts`:
     - `list_collections`, `list_documents`, `create_collection`, `fetch_and_add_document_from_url`, `delete_document`, `delete_collection`.
   - Basic security and robustness:
     - Rate limiting on the MCP HTTP transport.
     - Pass-through `Authorization` header for future backend auth.
     - Strict Zod schemas for all tool inputs.
   - Run `pnpm audit` in `apps/mcp` and document/plan mitigation for high/critical vulnerabilities.

2. **UI/UX Enhancements**
   - "Add New Collection" from the web UI:
     - New button + modal (`AddCollectionModal`) to create collections via `POST /api/collections`.
     - React Query mutation and optimistic refresh.
   - **Batch document deletion**:
     - Backend: `DELETE /api/documents/batch` accepting `{ documentIds: [...] }` and deleting them in a single transaction.
     - Frontend: checkboxes in document list + "Delete Selected" + confirmation dialog + React Query mutation.

3. **Persistent Chat History**
   - **Backend**:
     - Tables: `chat_sessions` and `chat_messages`.
     - APIs: `GET/POST /api/chats`, `GET /api/chats/:id/messages` and integration with the existing chat/search endpoint to save messages.
   - **Frontend**:
     - Chat history sidebar in `ChatPage`, driven by React Query.
     - Route `/chat/:id` to load specific sessions.

4. **Document Lifecycle Management**
   - Versioning and update detection:
     - Add `version`, `source_url_hash`, `last_checked_at` fields to documents.
     - A daily background job to detect stale URL-based docs.
   - Re-ingestion & editing:
     - Endpoint `POST /api/documents/:id/refresh` to re-ingest a stale doc.
     - Document detail UI showing chunks, with the ability to edit chunk text and metadata (and re-embed on save).

These are **incremental quality-of-life and robustness features** that make the app more sustainable and MCP-friendly once v2.0 is out.

#### 2.2 New-Phases “Phase 17”: Autonomous Ingestion & Batch Processing

From `03_PHASE_17_OVERVIEW.md`, `04_PHASE_17_BUILD_PLAN.md`, and `05_PHASE_17_ISSUES.md`:

**Goals:**

1. **Batch Document Upload**
   - Backend:
     - `POST /api/documents/batch-upload` (multipart) to accept multiple files and stream them into the existing ingestion pipeline.
     - Return a summary of success/failure per file.
   - Frontend:
     - Drag-and-drop multi-file upload UI.
     - Progress and error feedback per file.

2. **Self-Ingesting Agent** (`apps/ingestion-agent`)
   - A new long-running Node/TypeScript service:
     - Input: topic + `collectionId`.
     - Tools: web search, web scraping, client for Synthesis API.
     - Orchestration:
       - Search web for relevant URLs.
       - Filter to high-quality docs (official docs, serious tutorials, etc.).
       - Scrape main content and ingest using `/api/documents/add-from-url`.
   - Server & UI integration:
     - APIs: `POST /api/ingestion-agent/start`, `GET /api/ingestion-agent/status/:jobId`.
     - UI form in web app to start a job and monitor its progress.

These features significantly enhance **data ingestion velocity and autonomy**, allowing the system to build collections from a simple topic prompt.

---

### 3. Conflicts & Inconsistencies

#### 3.1 Phase Numbering Conflict

- **Main roadmap** (from `CURRENT_PHASE_STRUCTURE.md`):
  - Phase 14 – Tech Stack Filtering (done)
  - Phase 15 – Integration & Polish (current)
  - Phase 16 – Final Testing & v2.0 Release (E2E + load testing)
- **New `docs/new-phases`**:
  - Define their own **Phase 16** (MCP/UX/chat/doc lifecycle) and **Phase 17** (autonomous ingestion/batch upload).

**Result:** The label "Phase 16" now refers to two completely different things:

- In the main docs and GitHub milestones: **Final Testing & Release** (issues #71–72).
- In `docs/new-phases`: **Post‑v2 feature completion & hardening**.

If the new Phase 16/17 plans are implemented as-is, there will be **confusion for both humans and agents**, especially where labels, milestones, and MCP prompts depend on phase naming.

#### 3.2 Outdated Strategic Docs

- `DROID-PLAN.md` describes an older phase layout where:
  - Phase 14 = Integration & Polish.
  - Phase 15 = Final Testing & Release.
- This contradicts `CURRENT_PHASE_STRUCTURE.md`, which moved Integration & Polish to Phase 15 and Final Testing to Phase 16, while using Phase 14 for Tech Stack Filtering.

**Implication:** Anyone reading DROID-PLAN without context may misinterpret which work belongs to which phase. The content is still useful for understanding feature groups and priorities, but the **phase numbers are stale**.

#### 3.3 Phase 15 Docs vs Reality

- `PHASE_15_AUDIT_REPORT.md` accurately identified missing Phase 15 docs at the time (January), but is now partially obsolete:
  - Phase 15 directory and core docs now exist.
- `PHASE_15_ISSUES.md` and the issue pack still describe **all four issues as open**, even though:
  - #67 and #69 are effectively complete based on Day 1 and Day 3 summaries.
  - Documentation work for #70 is well underway.

**Implication:** There is drift between:

- GitHub issue states,
- phase documents, and
- the actual implementation status.

#### 3.4 Backend Performance Documentation Gap

- Integration tests show the full pipeline meeting the <600ms target under controlled conditions.
- The new `PHASE_15_DAY_2_SUMMARY.md` + perf artifacts (see Section 1.3 above) document the caching/indexing work, profiling output, and 120-VU load test results.
- Still pending: Voyage batching + 200-VU rerun to create the headroom Phase 16 requires.

**Implication:** Documentation gap is closed, but the team must complete the remaining scaling items (batching + 200 VU validation) before declaring #68 done; otherwise the upcoming E2E + load testing phase (issues #71–72) could stall.

#### 3.5 Minor Naming Issues

- `PHASES_11-15_SUMMARY.md` is titled "Phases 11–16" and actually covers Phase 16, but the filename stops at `11-15`.
- Several archived docs refer to pre-renumbering plans; they’re fine historically but can confuse agents if treated as current.

---

### 4. Recommendations & Suggested Sequencing

The most important design choice is **when** to execute the new `@new-phases` work relative to the existing roadmap, and **how** to avoid phase-number confusion.

#### 4.1 Short-Term: Close Out Phase 15 Cleanly

1. **Treat #67 and #69 as functionally complete**
   - Use the existing Day 1 and Day 3 summaries as evidence.
   - When you’re ready to modify GitHub, close #67 and #69 with links to those summary docs.

2. **Explicitly address #68 – Backend Performance**
   - Treat `PHASE_15_DAY_2_SUMMARY.md` + perf artifacts as the baseline record.
   - Next actions: land Voyage embedding batching, rerun the Artillery scenario at 200 VUs (targeting the 20k-file dataset), and update the same doc with the new metrics (p95, CPU/RSS, cache hit rates) so Phase 16 can reference them without spelunking logs.

3. **Finish #70 – Documentation Alignment**
   - Use the Day 4 checklist to:
     - Ensure `README`, `02_ARCHITECTURE`, `05_API_SPEC`, guides, migration, configuration, and troubleshooting all match the current system.
     - Add a clear "What’s new in v2.0" section.
     - Check links and examples.
   - Once this is done, you have a coherent documentation story for v2.0.

#### 4.2 Branch Strategy for Agent SDK Work

To avoid divergence and keep maintenance manageable as you introduce the Claude Agent SDK:

- Keep the **`main` branch** as “current Synthesis” using the Messages API–based agent (the v2.0 line).
- Create an **`agent-sdk` (or `develop`) branch** where you implement the Agent SDK migration and new agent tooling.
- Treat both as **different builds of the same app**, not different products:
  - Both branches can run end-to-end (server, web, MCP, etc.).
  - Regularly merge `main` into `agent-sdk` to pick up bug fixes and features.
- At runtime, use a simple env flag like `AGENT_IMPLEMENTATION=messages|agent-sdk` so you can ship both implementations in a single codebase if needed.

This keeps maintenance sane: one repo, one product, multiple branches/flags for the agent engine.

#### 4.2 Next: Execute Existing Phase 16 (Final Testing & Release)

Before taking on new features, it is cleaner to:

1. **Run end-to-end testing (#71)**
   - Use the existing shared test infrastructure:
     - Backend integration tests from Phase 15 Day 1.
     - Playwright E2E tests from Day 3.
   - Design user-flow focused E2E tests (upload → ingest → search → synthesize → cost dashboard → tech stack filter → chat) and capture results.

2. **Run load testing (#72)**
   - Populate a 20k-file collection (or simulate it) and run search under realistic concurrency.
   - Confirm or refine your performance assumptions before building more features on top.

3. **Tag and document the v2.0 release**
   - Once issues #71–72 are satisfied, you can tag a v2.0.0 release and treat the current system as the baseline for the new `@new-phases` work.

#### 4.3 Renaming & Incorporating `docs/new-phases`

To avoid naming conflicts while preserving the thought that these are **post‑v2 phases**, consider:

1. **Rename the new phases conceptually** (no code changes required yet):
   - Current main roadmap Phase 16: **"Phase 16 – Final Testing & v2.0 Release"** (keep as-is).
   - New `docs/new-phases` plans:
     - Rename in your mental model and future docs to something like:
       - **"Phase 17 – Feature Completion & Hardening"** (existing new-phase 16 content).
       - **"Phase 18 – Autonomous Ingestion & Batch Processing"** (existing new-phase 17 content).
     - Alternatively, switch to a new naming scheme, e.g., **"Post‑v2 Phase A"**, **"Post‑v2 Phase B"**, to clearly distinguish them from v2.0.

2. **When you’re ready to edit docs**, update:
   - The titles inside `00_PHASE_16_OVERVIEW.md`, `01_BUILD_PLAN.md`, `02_GITHUB_ISSUES.md`, `03_PHASE_17_OVERVIEW.md`, `04_PHASE_17_BUILD_PLAN.md`, `05_PHASE_17_ISSUES.md` to reflect the new phase IDs.
   - Any GitHub issue templates or labels you create from `02_GITHUB_ISSUES.md` / `05_PHASE_17_ISSUES.md` should use the updated phase numbers.

3. **Keep `docs/new-phases` explicitly marked as “post‑v2”**
   - Add a short note at the top of each new-phase doc once you start editing: e.g., “This phase applies after v2.0 has shipped; see CURRENT_PHASE_STRUCTURE.md for the v2.0 roadmap.”

#### 4.4 Strategic Alignment for `@new-phases` MCP Server

The new phases are oriented around **MCP and agent UX**, which is exactly what you want after shipping v2.0. Some strategic suggestions:

- **Do `Feature Completion & Hardening` before `Autonomous Ingestion`**
  - MCP server completion, chat history, and doc lifecycle management make the system more usable day-to-day and give agents the tools they need to manage long-lived collections.
  - Autonomous ingestion (self-ingesting agent, batch uploads) then sits on top of a more mature platform.

- **Tie MCP tools directly to new-phase work**
  - When you implement `list_collections`, `list_documents`, `create_collection`, etc., design them to support both human workflows and future agent automation (e.g., your `@new-phases` MCP agent).
  - Persistent chat history and document lifecycle features should be exposed to MCP so that agents can reason over prior conversations and stale documents.

- **Budget for testing and docs inside these phases**
  - The new-phase build plans already include issues/guidance; when you instantiate them as real phases, explicitly add:
    - E2E tests for new UI flows.
    - MCP integration tests that exercise the new tools.
    - Documentation updates for `02_ARCHITECTURE`, `05_API_SPEC`, and guides, so the v2.1+ story stays coherent.

---

### 5. Summary & Key Takeaways

- **Current status**
  - v2.0 architecture is complete and implemented through Phase 14.
  - Phase 15 is nearly complete: integration tests and frontend polish are done; backend performance needs explicit confirmation; docs are being aligned.
  - Existing Phase 16 (Final Testing & Release) remains to be executed.

- **New `@new-phases` work**
  - Defines high-value post‑v2 features for MCP completion, UX enhancements, persistent chat, doc lifecycle, batch upload, and autonomous ingestion.
  - Currently reuses Phase 16/17 names that conflict with the existing roadmap.

- **Recommended path**
  1. Finish Phase 15 (#68, #70) and then run the current Phase 16 (E2E + load testing) to ship a clean v2.0.
  2. Once v2.0 is tagged, treat `docs/new-phases` as the specification for **Phase 17/18** (or “Post‑v2 Phase A/B”).
  3. When you’re ready to edit docs, rename those phases and wire up real GitHub issues from `02_GITHUB_ISSUES.md` and `05_PHASE_17_ISSUES.md` using the updated numbering.

This sequencing keeps the existing roadmap coherent, avoids phase-number confusion, and gives you a clear, agent-friendly path to expand the system with the `@new-phases` MCP work after the current application is “done.”
