# Phase 12 · Day 1 — Implementation Notes (Draft for Issue #61)

- Added `apps/server/src/services/reranker.ts` implementing provider selection, lazy BGE loading, Cohere integration, and graceful fallback. Defaults to no rerank unless a request opts in.
- Extended `smartSearch`/`POST /api/search` to accept `rerank`, `rerank_top_k`, `rerank_max_candidates`, and `rerank_provider`. Hybrid mode automatically expands to 50 candidates when rerank is requested, applies rerank scores as the primary similarity, and preserves trust scoring.
- Environment updates: `.env.example` and `apps/server/.env.example` now include `RERANKER_PROVIDER` (default `none`) and `COHERE_API_KEY` placeholders, plus optional tuning knobs in the server example file.
- Added `apps/server/src/services/__tests__/reranker.test.ts` covering provider fallback logic, BGE scoring order, and Cohere → BGE fallback behaviour.
- Dependencies: installed `cohere-ai` and `@xenova/transformers` for provider support (`pnpm --filter @synthesis/server add ...`).
- Metrics recorded in `docs/phases/phase-12/day1-metrics.md` using a synthetic “Phase12 Eval” corpus (5 relevant guides + 5 keyword-heavy decoys). Results show rerank parity on this toy dataset; expect larger precision gains once the full hybrid candidate set is restored.
