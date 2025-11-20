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
  - Return structured `SynthesisResponse` (query, approaches[], conflicts[], recommended).
- Add endpoint: `POST /api/synthesis/compare`.
- Feature-flag synthesis; default OFF.

Deliverables:
- Code + unit tests for grouping/consensus shape and contradiction pipeline (mock LLM acceptable).
- Post an example response payload (including `recommended`) in #61.

Acceptance (partial for Day 2):
- Endpoint returns structured response; handles edge cases (single approach, no conflicts).
 - Accepts `top_k` parameter; backend defaults to 50 when omitted.
```

---

## Day 3 – Cost tracking (backend)

```markdown
Task: Implement cost tracking service, supporting endpoints, AND integrate into existing API calls.

Read:
- docs/phases/phase-12/05_COST_MONITORING.md
- docs/phases/phase-12/06_BUILD_PLAN.md (Day 3 section)
- docs/phases/phase-12/DAY_3_FIX_PLAN.md (complete implementation guide)

Work under:
- Issue #61 (Phase 12 Epic)

Requirements:
- Add migration in `packages/db/migrations/` for BOTH tables:
  - `api_usage` (provider, operation, tokens_used, cost_usd, collection_id, user_id, created_at, metadata JSONB)
  - `budget_alerts` (alert_type, threshold_usd, current_spend_usd, period, triggered_at, acknowledged BOOLEAN)
  - Include all indexes for efficient querying
- Implement `apps/server/src/services/cost-tracker.ts` using factory pattern `getCostTracker(db)`
  - Async tracking (non-blocking)
  - Budget checks (80% warning, 100% limit with auto-fallback)
  - Pricing for OpenAI, Voyage, Cohere, Anthropic
- Add endpoints in `apps/server/src/routes/costs.ts`:
  - `GET /api/costs/summary`
  - `GET /api/costs/history`
  - `GET /api/costs/alerts`
  - Register in `apps/server/src/index.ts`
- **CRITICAL: Integrate cost tracking into 3 locations:**
  - `apps/server/src/pipeline/embed.ts` - Track OpenAI/Voyage embeddings after successful call
  - `apps/server/src/services/reranker.ts` - Track Cohere reranking after API call
  - `apps/server/src/services/contradiction-detection.ts` - Track Anthropic calls using response.usage
- Update `.env.example`: Document `MONTHLY_BUDGET_USD` and fallback override variables

Deliverables:
- Migration (both tables) + service + endpoints + integration + tests
- Note expected monthly cost (~$0.90 typical usage)
- Document how fallback is triggered (auto-switches to Ollama/BGE at budget limit)
- Post implementation notes to #61

Commands to run:
- Migration: `pnpm --filter @synthesis/db migrate`
- Tests: `pnpm --filter @synthesis/server test cost-tracker`
- Verification: `curl http://localhost:3333/api/costs/summary`

Acceptance (partial for Day 3):
- Both database tables created with all fields
- Cost tracking integrated and actually tracking costs (not just service created)
- Budget alerts trigger at 80% and 100%
- Fallback mode activates automatically
- Tests passing (18+ tests)
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
- Create integration tests in `apps/server/src/services/__tests__/integration.test.ts`
- Run performance benchmarks using `scripts/benchmark-phase12.ts`
- Validate:
  - Precision@5 improvement ≥ 20% with reranking ON vs OFF (document queries and results)
  - Baseline measurement: Run searches WITHOUT reranking, record precision@5
  - With reranking: Run same queries WITH reranking enabled
  - Calculate improvement: (reranked - baseline) / baseline * 100
  - Added latency < +300ms p95
  - Cost tracking logs and budget alerts function
- Ensure defaults remain unchanged when features OFF
- Verify cost tracking: Query database, trigger budget alert test
- Write verification note with metrics, flags used, and how to enable safely

Commands to run:
- Integration tests: `pnpm --filter @synthesis/server test integration`
- Benchmarks: `pnpm tsx scripts/benchmark-phase12.ts`
- Full test suite: `pnpm test`
- Linting: `pnpm lint`
- Build: `pnpm build`
- Check costs: `psql $DATABASE_URL -c "SELECT * FROM api_usage ORDER BY created_at DESC LIMIT 10;"`

Deliverables:
- Integration tests created and passing
- Benchmark results showing precision improvement
- Metrics summary posted in #61 (tables or bullet list)
- PR ready with feature flags OFF by default
- PR links to #61, includes metrics, acceptance criteria checklist
- Handoff comment using `docs/15_AGENT_PROMPTS.md` ("Phase 12 Complete - Ready for Review")
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
- Integration point: Synthesis is primarily a chat-centric experience, so implement it inside `ChatPage.tsx` when the feature expands on the current conversation, needs persistent chat state, or surfaces follow-up insights for the active thread. Create a dedicated `SearchPage.tsx` only when synthesis operates statelessly on global search/query results or when you must reuse an existing standalone discovery/search UX.
- List/Synthesis toggle placement: put the toggle inside the page toolbar of `ChatPage.tsx` whenever synthesis is chat-scoped; otherwise render it in the header of `SearchPage.tsx` when using the search-scoped flow.
- Add a toggle: [List View] / [Synthesis View] (prefer implementing in `ChatPage.tsx` first unless you explicitly need the standalone search page pattern).
- Components to create in `apps/web/src/components/`:
  - `SynthesisView.tsx` (main container)
  - `ApproachCard.tsx` (individual approach display)
  - `ConflictsList.tsx` (contradictions list)
- Update API client (`apps/web/src/lib/api.ts`):
  - Add `synthesizeResults(query, collectionId, topK)` method
  - Add type definitions for SynthesisResponse
- Integrate `POST /api/synthesis/compare`
- Collection ID from URL params (useParams hook)
- Use `top_k: 15` for UI performance (backend defaults to 50)
- Render approaches, consensus (⭐), conflicts (⚠️) with recommendations
- Expandable sources per approach
- Respect feature flags and handle loading/error/empty gracefully
- Responsive and accessible design

Testing:
- Component tests: `SynthesisView.test.tsx`, `ApproachCard.test.tsx`, `ConflictsList.test.tsx`
- Test loading/error/empty states
- Test expand/collapse functionality

Commands to run:
- Dev server: `pnpm --filter @synthesis/web dev`
- Tests: `pnpm --filter @synthesis/web test`
- Type check: `pnpm --filter @synthesis/web typecheck`
- Build: `pnpm --filter @synthesis/web build`

Deliverables:
- UI components created
- API client updated with synthesis methods
- Component tests passing
- Screenshots and notes posted in #64

Acceptance:
- Toggle works; synthesis renders grouped approaches, consensus, and conflicts
- Loading/error/empty states handled gracefully
- Responsive on mobile and desktop
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
- Router updates in `apps/web/src/App.tsx`:
  - Import CostDashboard
  - Add route: `<Route path="/costs" element={<CostDashboard />} />`
- Sidebar updates in `apps/web/src/components/Layout.tsx`:
  - Add nav link: `<Link to="/costs">💰 Costs</Link>`
- Components to create in `apps/web/src/pages/` and `apps/web/src/components/`:
  - `CostDashboard.tsx` (main page)
  - `CostSummary.tsx` (summary card)
  - `CostBreakdown.tsx` (provider breakdown)
  - `BudgetAlerts.tsx` (alerts list)
- Update API client (`apps/web/src/lib/api.ts`):
  - Add `getCostSummary()` method
  - Add `getCostHistory(startDate?, endDate?)` method
  - Add `getCostAlerts()` method
  - Add type definitions for cost responses
- Integrate endpoints: `GET /api/costs/summary`, `GET /api/costs/history`, `GET /api/costs/alerts`
- Display: Current month total vs budget, provider breakdown, alerts (80% warn, 100% limit)
- Optional polling: Add `refetchInterval: 30000` to useQuery for auto-refresh
- Responsive design; simple visuals (progress bars sufficient)
- Handle loading states with skeletons or spinners

Testing:
- Component tests for each component
- Test loading/error states
- Test alert display

Commands to run:
- Dev server: `pnpm --filter @synthesis/web dev`
- Tests: `pnpm --filter @synthesis/web test`
- Type check: `pnpm --filter @synthesis/web typecheck`
- Build: `pnpm --filter @synthesis/web build`

Deliverables:
- Cost dashboard page created
- Route and nav link added
- API client updated with cost methods
- Component tests passing
- Screenshots and notes posted in #64

Acceptance:
- Dashboard accessible at `/costs`
- Shows spend vs budget with progress bar
- Provider breakdown displays correctly
- Alerts show when budget thresholds reached
- Updates on refresh (polling optional)
```

---

## Final notes
- Keep all changes additive and behind flags until metrics are reviewed.
- Post daily status to the relevant issue (#61 backend, #64 frontend).
- Use `docs/15_AGENT_PROMPTS.md` for consistent review handoffs.
