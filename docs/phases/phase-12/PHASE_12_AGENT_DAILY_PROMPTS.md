# Phase 12 – Agent Daily Prompts (Backend + Frontend)

Use these copy/paste prompts to run Phase 12 in safe, reviewable slices. Source of truth is the Phase 12 docs; do not modify planning docs.

- Docs to read first for every day:
  - `docs/phases/phase-12/00_PHASE_12_OVERVIEW.md`
  - `docs/phases/phase-12/06_BUILD_PLAN.md`
  - `docs/phases/phase-12/07_ACCEPTANCE_CRITERIA.md`
- Deep dives (as needed):
  - Reranking: `docs/phases/phase-12/01_RERANKING_ARCHITECTURE.md`
  - Synthesis: `docs/phases/phase-12/03_SYNTHESIS_ENGINE.md`
  - Contradictions: `docs/phases/phase-12/04_CONTRADICTION_DETECTION.md`
  - Cost tracking: `docs/phases/phase-12/05_COST_MONITORING.md`
  - Frontend: `docs/phases/phase-12/08_FRONTEND_UPDATES.md`
- GitHub issues to work under:
  - Backend Epic: #61
  - Frontend: #64

Guardrails for all days:
- Implement features behind flags; defaults unchanged.
- Backwards compatible endpoints; additive only.
- Use Phase 12 paths (not Phase 9). Measure and post metrics to #61.
- Use `docs/15_AGENT_PROMPTS.md` for handoffs ("Phase [X] Complete").

---

## Day 1 – Re-ranking (backend)

```markdown
Task: Implement cross-encoder re-ranking and optional rerank in POST /api/search.

Read:
- docs/phases/phase-12/01_RERANKING_ARCHITECTURE.md
- docs/phases/phase-12/06_BUILD_PLAN.md (Day 1 section)

Work under:
- Issue #61 (Phase 12 Epic)

Requirements:
- Create service `apps/server/src/services/reranker.ts` supporting providers: Cohere (cloud), BGE (local via @xenova/transformers). Lazy-load BGE.
- Enhance `POST /api/search` to optionally rerank top 50 hybrid results (Phase 11) when enabled.
- Add env/config: `RERANKER_PROVIDER`, `COHERE_API_KEY` to `.env.example` (do not break current behavior).
- Feature flags default OFF; leave baseline behavior unchanged.

Deliverables:
- Code + unit tests for reranker selection, rerank scores, and graceful fallback.
- Brief before/after baseline for 5-10 canned queries: precision@5 and added latency (local notes acceptable today).
- Short implementation notes posted to #61.

Acceptance (partial for Day 1):
- Reranker integrates; added latency target trajectory < +300ms.
- Defaults unchanged; rerank can be toggled per request or config (as designed).
```

---

## Day 2 – Synthesis & Contradictions (backend)

```markdown
Task: Implement POST /api/synthesis/compare with grouping, consensus, and contradiction detection.

Read:
- docs/phases/phase-12/03_SYNTHESIS_ENGINE.md
- docs/phases/phase-12/04_CONTRADICTION_DETECTION.md
- docs/phases/phase-12/06_BUILD_PLAN.md (Day 2 section)

Work under:
- Issue #61 (Phase 12 Epic)

Requirements:
- Create `apps/server/src/services/synthesis.ts` orchestration:
  - Group top results by approach/topic, compute consensus (weight by source_quality).
  - Detect contradictions (pairwise + LLM verification) using existing Anthropic SDK patterns.
  - Return structured `SynthesisResponse` (query, approaches[], conflicts[]).
- Add endpoint: `POST /api/synthesis/compare`.
- Feature-flag synthesis; default OFF.

Deliverables:
- Code + unit tests for grouping/consensus shape and contradiction pipeline (mock LLM acceptable).
- Post an example response payload in #61.

Acceptance (partial for Day 2):
- Endpoint returns structured response; handles edge cases (single approach, no conflicts).
```

---

## Day 3 – Cost tracking (backend)

```markdown
Task: Implement cost tracking service and supporting endpoints.

Read:
- docs/phases/phase-12/05_COST_MONITORING.md
- docs/phases/phase-12/06_BUILD_PLAN.md (Day 3 section)

Work under:
- Issue #61 (Phase 12 Epic)

Requirements:
- Add migration in `packages/db/migrations/` for `api_usage` (provider, operation, tokens_used, cost_usd, collection_id, created_at) with indexes.
- Implement `apps/server/src/services/cost-tracker.ts` for async tracking, budget checks, and fallback enablement when budget exceeded (`MONTHLY_BUDGET_USD`).
- Add endpoints:
  - `GET /api/costs/summary`
  - `GET /api/costs/history`
  - `GET /api/costs/alerts`
- Update `.env.example`: `MONTHLY_BUDGET_USD` and any needed toggles.

Deliverables:
- Migration + service + endpoints + minimal tests for summary/alerts.
- Note expected monthly cost for typical usage and how fallback is triggered.
- Post notes in #61.

Acceptance (partial for Day 3):
- Costs captured; summary and alerts respond with realistic sample data.
```

---

## Day 4 – Integration, metrics & PR

```markdown
Task: Validate acceptance criteria, collect metrics, and prepare PR.

Read:
- docs/phases/phase-12/07_ACCEPTANCE_CRITERIA.md

Work under:
- Issue #61 (Phase 12 Epic)

Requirements:
- Validate:
  - Precision@5 improvement ≥ 20% with reranking ON vs OFF (document queries and results).
  - Added latency < +300ms p95.
  - Cost tracking logs and budget alerts function.
- Ensure defaults remain unchanged when features OFF.
- Write a short verification note with metrics, flags used, and how to enable safely.

Deliverables:
- Metrics summary posted in #61 (tables or bullet list).
- PR ready with feature flags OFF by default.
- Handoff comment using `docs/15_AGENT_PROMPTS.md` ("Phase 12 Complete - Ready for Review").
```

---

## Day 5 – Frontend: Synthesis View

```markdown
Task: Implement Synthesis View and toggle from List View on search page.

Read:
- docs/phases/phase-12/08_FRONTEND_UPDATES.md (Synthesis View section)

Work under:
- Issue #64 (Phase 12 Frontend)

Requirements:
- Add a toggle: [List View] / [Synthesis View].
- Components (suggested): `SynthesisView.tsx`, `ApproachCard.tsx`, `ConflictsList.tsx`.
- Integrate `POST /api/synthesis/compare`; render approaches, consensus (⭐), conflicts (⚠️) with recommendations; expandable sources.
- Respect feature flags and handle loading/error/empty gracefully; responsive and accessible.

Deliverables:
- UI components + typed API client.
- Screenshots and notes posted in #64.

Acceptance:
- Toggle works; synthesis renders grouped approaches, consensus, and conflicts per doc.
```

---

## Day 6 – Frontend: Cost Dashboard

```markdown
Task: Implement /costs page with spend, provider breakdown, and alerts.

Read:
- docs/phases/phase-12/08_FRONTEND_UPDATES.md (Cost Dashboard section)

Work under:
- Issue #64 (Phase 12 Frontend)

Requirements:
- New route `/costs` and sidebar link.
- Components (suggested): `CostDashboard.tsx`, `CostSummary.tsx`, `CostBreakdown.tsx`, `BudgetAlerts.tsx`.
- Integrate `GET /api/costs/{summary,history,alerts}`; show current month total vs budget, provider breakdown, alerts (80% warn, 100% limit).
- Responsive design; simple visuals (progress bars sufficient).

Deliverables:
- UI components + typed API client.
- Screenshots and notes posted in #64.

Acceptance:
- Dashboard shows spend vs budget, breakdown, and alerts; updates on refresh or polling.
```

---

## Final notes
- Keep all changes additive and behind flags until metrics are reviewed.
- Post daily status to the relevant issue (#61 backend, #64 frontend).
- Use `docs/15_AGENT_PROMPTS.md` for consistent review handoffs.
