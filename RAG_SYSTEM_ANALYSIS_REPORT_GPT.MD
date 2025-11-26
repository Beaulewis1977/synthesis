# RAG System Analysis Report (GPT Review)

## 1. Purpose

This document re-evaluates the earlier `RAG_SYSTEM_ANALYSIS_REPORT.md` against the current Synthesis codebase. It is written as a **starting point for implementation agents**: what is actually true, what is overstated, and which changes to prioritize.

The focus areas are:
- Search stack (vector, BM25, hybrid)
- Chunking pipeline (text and code)
- Performance and token limits

---

## 2. System Reality vs Original Report

This section summarizes which earlier claims are **accurate**, **partially true**, or **incorrect** based on the current code.

### 2.1 Vector Search & Embeddings

**Reality (based on `apps/server/src/services/vector.ts`, `apps/server/src/services/embedding-router.ts`, `apps/server/src/pipeline/embed.ts`, `apps/server/src/services/search.ts`):**

- Vector search uses PostgreSQL `vector` similarity on `chunks.embedding` with a **configurable embedding provider**.
- Embedding providers are supported via `embedding-router`:
  - `ollama` → `nomic-embed-text` (768d)
  - `openai` → `text-embedding-3-large` (1536d)
  - `voyage` → `voyage-code-2` (1024d)
- Provider selection is driven by:
  - Content context (`code` vs `docs` vs `personal`)
  - Env vars (`CODE_EMBEDDING_PROVIDER`, `DOC_EMBEDDING_PROVIDER`, `WRITING_EMBEDDING_PROVIDER`)
  - Collection metadata (via `inferCollectionEmbeddingHint` in `search.ts`).
- Vector search has:
  - `DEFAULT_MIN_SIMILARITY = 0.5`, overrideable per request.
  - Tech stack filtering via `ch.metadata->'tech_stack' ?| $array`.

**Assessment:**
- The earlier report **understates** the flexibility of the embedding system.
- It is **correct** that similarity is thresholded with a mostly static default and that there is **no query expansion** or advanced vector-side semantics.

### 2.2 BM25 / Lexical Search

**Reality (based on `apps/server/src/services/bm25.ts`, `packages/db/migrations/004_hybrid_search.sql`):**

- BM25-style lexical search is implemented using PostgreSQL full-text search (`ts_rank_cd`) on `chunks.text`.
- There is **full-text search infrastructure in place**:
  - Migration `004_hybrid_search.sql` creates a GIN index on `to_tsvector('english', text)` and an additional trigram index.
- Query building:
  - `buildPrefixTsQuery` cleans and prefixes input terms with `:*`.
  - The DB-level `to_tsvector`/`to_tsquery` functions handle stemming/stopwords for the configured language.
- Scoring:
  - Uses `ts_rank_cd(...)` and normalizes by max rank per result list.

**Assessment:**
- Earlier claim that BM25 has **no proper index** is **incorrect** — indexes exist.
- However, BM25 is **effectively non-functional for natural language queries**:
  - In Flutter/Dart evaluation, BM25 returned **zero results for 18/20 queries (90%)**.
  - The `buildPrefixTsQuery` approach with `:*` suffixes is overly restrictive for NL queries.
  - When BM25 does return results, it can **degrade** hybrid's top-1 (see Query 5: vector found correct doc, hybrid picked BM25's wrong result).
  - No per-collection language tuning beyond a single `language` value.
  - No additional lexical signals beyond term matches.

### 2.3 Hybrid Search (RRF)

**Reality (based on `apps/server/src/services/hybrid.ts`, `apps/server/src/services/search.ts`):**

- Hybrid search combines vector and BM25 using **Reciprocal Rank Fusion (RRF)**.
- Defaults:
  - `DEFAULT_WEIGHTS = { vector: 0.7, bm25: 0.3 }`
  - `DEFAULT_RRF_K = 60`
- Weights are **configurable**:
  - Env vars: `HYBRID_VECTOR_WEIGHT`, `HYBRID_BM25_WEIGHT`.
  - Request-level overrides via `HybridSearchParams['weights']` and `resolveHybridWeights`.
- Fusion logic:
  - Results from vector and BM25 are merged by chunk ID.
  - Overlaps are tracked with `source: 'vector' | 'bm25' | 'both'`.
  - Vector/BM25 scores are tracked separately, plus a fused score.

**Assessment:**
- Hybrid search is **operational and structurally reasonable**, not "essentially vector-only" from code alone.
- The system does **not**:
  - Perform query-intent detection.
  - Adapt weights per query type automatically.

### 2.4 Search Architecture

**Reality (from `search.ts` and surrounding services):**

- There is a `smartSearch` entrypoint that:
  - Supports `vector` or `hybrid` modes.
  - Optionally reranks with a rerank provider and tracks trust scoring.
  - Infers embedding provider/context from collection metadata when missing.
- There is **no**:
  - Query classification/intent detection.
  - Result diversification (MMR or similar) on top of fused results.
  - Dedicated search-result cache layer.
- **Reranker constraint:** `HARD_RERANK_CAP = 10` in `reranker.ts` limits reranking to 10 results regardless of `topK` request.

**Assessment:**
- Earlier report **misses** some existing higher-level logic (provider/context inference, trust scoring, rerank pipeline).
- It is **accurate** that the search stack is missing more advanced IR features (intent detection, diversification, etc.).

### 2.5 Chunking (Text and Code)

**Reality (based on `apps/server/src/pipeline/chunk.ts`, `apps/server/src/pipeline/code-chunker.ts`, `apps/server/src/pipeline/orchestrator.ts`, `apps/server/src/pipeline/store.ts`):**

- Text chunking:
  - Character-based: default `maxSize = 800`, `overlap = 150`.
  - Heuristics: prefer paragraph breaks (regex) then sentence boundaries (regex), then fallback.
- Code chunking:
  - For supported languages (TS/JS, Dart, Kotlin, Swift, Python, SQL, config): AST-based, semantic chunks (functions, classes, tables, sections, etc.).
  - For Java and most other languages: fallback `simpleChunking` of ~50 lines with 10-line overlap.
  - Large classes: split per-method when class exceeds `maxChunkSize` in lines (default 100).
- Imports:
  - When `preserveImports` is enabled, each chunk for a file gets **the full imports list** in its metadata.
- Token handling:
  - No explicit token-limit-aware splitting before embedding.
  - `store.ts` estimates token counts only for metadata (`estimateTokens(text)`), not for safety.

**Assessment:**
- Earlier critique of **token awareness**, **large-class splitting**, and **language coverage gaps** is **accurate**.
- The earlier report simplified code chunking as "lines only"; in reality, semantic AST-based chunking is present for several languages, but there are real issues for large classes and unsupported languages.

### 2.6 Empirical Findings from Flutter/Dart Harness

As of the Phase 21 work, we have implemented and run a concrete evaluation harness against the **Flutter & Dart collection** using 20 curated questions and known-good code snippets as anchors.

**Harness implementation:**
- Config: `apps/server/perf/rag_eval_flutter_dart.json` (collectionId, modes, queries)
- Runner: `apps/server/src/scripts/rag-eval-flutter-dart.ts`
- Summary: `apps/server/src/scripts/rag-eval-flutter-dart-summary.ts`
- Outputs:
  - JSON results: `apps/server/perf/rag_eval_flutter_dart_results_*.json`
  - Markdown summary: `apps/server/perf/rag_eval_flutter_dart_summary_*.md`

**Modes evaluated:**
- `vector` (vector-only via `smartSearch`)
- `bm25` (direct `bm25Search`)
- `hybrid` (RRF fusion of vector + BM25)
- `hybrid+rerank` (hybrid with reranking enabled)

**Key findings on this collection:**
- **Vector vs Hybrid:** For almost all queries, hybrid's top result is identical to vector's top result. Hybrid rarely improves on vector for top-1 retrieval.
- **BM25 behavior:** BM25 returned **zero results for 18/20 queries (90%)**. Only queries 5 (navigation) and 12 (packages) got any BM25 results. When it does return results, it tends to favor generic docs over snippet-heavy chunks and can **degrade** hybrid's top result.
- **Query 5 case study:** Vector correctly found `flutter-navigation-guide.md` (similarity: 0.668). BM25 returned `Flutter Documentation - Flutter`. Hybrid picked BM25's wrong result, demonstrating how broken BM25 actively hurts search quality.
- **Hybrid+rerank:** Reranking on top of hybrid generally preserves hybrid's ordering. In cases where it changes top-1, it does not clearly move results toward the desired code snippets on this dataset.

**Conclusion from this experiment:**
- Vector search is currently the most reliable mode for these Flutter/Dart questions.
- BM25 is **almost completely non-functional** for natural language queries — the 0.3 weight in hybrid contributes nothing 90% of the time.
- When BM25 does return results, it can actively **degrade** hybrid's accuracy.
- **BM25 query building must be fixed before hybrid search can provide value.**
- Future BM25/hybrid/rerank changes should be validated against this harness (and similar configs for other collections) to ensure they actually improve results.

### 2.7 Priority Tech Stacks and Languages

This report is aligned with the broader tech stack roadmap in `docs/new-phases/07_EXTENDED_TECH_STACK_AND_REPO_INGESTION_PLAN.md`. In practice, the **first-class stacks** Synthesis should support with strong, code-aware search and AST/structure-aware chunking are:

- **Flutter/Dart + Supabase/PostgreSQL + Redis** (primary mobile app stack)
- **Node/TypeScript backends** (Express, Fastify, NestJS, Next.js API routes)
- **Data & infra:** Supabase/Postgres/pgvector, Redis (caching/queues), Firebase (Analytics/Auth/Firestore/Functions)
- **Web/React/Next.js** using TypeScript

The fixes and plans in Sections 3–5 should therefore be interpreted as:
- Ensuring **AST- or structure-aware chunking** for the code in these stacks (Dart, TypeScript/JavaScript, SQL/Postgres, and eventually Python/Kotlin/Swift as the roadmap specifies).
- Ensuring **search (vector, BM25, hybrid, rerank)** is tuned and evaluated per collection/profile that corresponds to these stacks.
- Using the evaluation harness pattern (Section 5) to stand up **per-stack harnesses** (e.g., Flutter/Dart, Node/TS, Supabase/Postgres) so changes can be validated on the languages you actually work with.

---

## 3. Ranked Fixes (Impact vs Effort)

This section ranks potential changes by **Impact (user-visible quality, safety)** and **Effort (estimated)**, with notes for implementation agents.

### 3.1 Tier 1 – Critical / High-Impact

#### 3.1.1 Token-Aware Chunking & Embedding Limits

- **Problem:** Chunks are sized by characters/lines with **no guarantee** they fit provider token limits. Large chunks may be truncated or rejected by embedding APIs.
- **Impact:**
  - Prevents silent failures and 400/413 errors from providers.
  - Improves embedding quality by keeping inputs within optimal window sizes.
- **Effort:** Medium.

**Implementation Notes (Agent-facing):**
- Relevant files:
  - `apps/server/src/pipeline/chunk.ts`
  - `apps/server/src/pipeline/code-chunker.ts`
  - `apps/server/src/pipeline/orchestrator.ts`
  - `apps/server/src/services/embedding-router.ts`
  - `apps/server/src/pipeline/embed.ts`
- Steps:
  1. Introduce a simple token estimator (e.g., chars → tokens heuristic) that is **consistent** with `store.ts`/embedding providers.
  2. Add per-provider token limit constants (or env-driven) for embedding inputs:
     - `ollama/nomic-embed-text`: 8192 tokens
     - `openai/text-embedding-3-large`: 8191 tokens
     - `openai/text-embedding-3-small`: 8191 tokens
     - `voyage/voyage-code-2`: 16000 tokens
     - `google/text-embedding-004`: 2048 tokens
     - Local `bge-m3`: 8192 tokens
  3. Before calling `embedBatch`, validate each chunk's estimated token length.
  4. When a chunk is too large, split it into smaller subchunks (preserving metadata lineage: parent document ID, offsets, maybe parent chunk ID).
  5. Update `storeChunks` to use more accurate token counts if feasible.
  6. Must integrate with embedding profiles (3.1.6) — different profiles may use different models with different limits.

#### 3.1.2 Improve Code Chunking for Large Classes & Unsupported Languages

- **Problem:**
  - Large classes are split strictly per-method; class-level structure is lost.
  - Non-AST languages (Java, C/C++, Go, Rust, etc.) use coarse line-based `simpleChunking`.
- **Impact:**
  - Directly improves code retrieval quality and context for answers.
- **Effort:** Medium–High (depending on how much you invest per language).

**Implementation Notes:**
- Relevant files:
  - `apps/server/src/pipeline/code-chunker.ts`
  - `apps/server/src/pipeline/orchestrator.ts`
- Near-term improvements:
  1. For large classes in TS/JS/Dart/etc., add **hierarchical chunks**:
     - One "class overview" chunk that includes full class (or large portions), plus method-level chunks referencing that overview via metadata (`parent_chunk_id`, `class_name`).
  2. For `simpleChunking`, refine defaults:
     - Consider language detection on file extension to adjust line `chunkSize`.
     - Optionally, implement minimal structural awareness (e.g., keep function blocks intact if detected by simple regex).
  3. Ensure metadata across these chunks links back to class/file in a consistent way.

#### 3.1.3 Safer and Clearer Import Handling

- **Problem:** With `PRESERVE_IMPORTS=true`, every code chunk stores the full imports list, duplicating data and adding noise.
- **Impact:**
  - Can bloat metadata and might bias embeddings if imports are repeatedly present.
- **Effort:** Low–Medium.

**Implementation Notes:**
- Relevant files:
  - `apps/server/src/pipeline/code-chunker.ts`
  - `apps/server/src/pipeline/orchestrator.ts`
- Options:
  1. Store imports **once per file** in document metadata instead of per chunk.
  2. Or: store imports only on a subset of chunks (e.g., first chunk per file or class-level chunks) and rely on metadata linkage for query-time usage.

#### 3.1.4 Fix BM25 Query Building (Critical for Hybrid Search)

- **Problem:** BM25 returns **zero results for 90% of natural language queries**. The `buildPrefixTsQuery` approach with `:*` suffixes is too restrictive. Hybrid search is effectively vector-only.
- **Impact:**
  - Without this fix, hybrid search provides no benefit over vector-only.
  - When BM25 does return results, it can actively degrade accuracy.
- **Effort:** Medium.

**Implementation Notes:**
- Relevant files:
  - `apps/server/src/services/bm25.ts`
  - `packages/db/migrations/004_hybrid_search.sql`
- Steps:
  1. Replace aggressive `:*` prefix on all terms with smarter query building:
     - Use `plainto_tsquery` for natural language queries.
     - Use `phraseto_tsquery` for quoted phrases.
     - Only apply `:*` prefix to the last term (autocomplete-style) or terms under 4 characters.
  2. Add query-type detection: if query looks like NL question, use `plainto_tsquery`; if it looks like code symbol, use prefix matching.
  3. Add per-collection language overrides via metadata/env.
  4. Add metrics/logging: track BM25 result counts per query to monitor fix effectiveness.
  5. **Validate with eval harness** before and after changes.

#### 3.1.5 Document & Chunk Metadata Guarantees

- **Problem:** Metadata is inconsistently populated. Some documents lack version info, some chunks lack symbol-level metadata. This breaks filtering, versioning, and code intelligence features.
- **Impact:**
  - Required for embedding profiles, collection versioning, and reliable search filtering.
  - Prerequisite for MODEL_SELECTOR feature.
- **Effort:** Medium.

**Implementation Notes:**
- Relevant files:
  - `apps/server/src/pipeline/orchestrator.ts`
  - `apps/server/src/pipeline/code-chunker.ts`
  - `apps/server/src/services/metadata-builder.ts`
- **Document-level MUST have:**
  - Collection ID and source (URL, repo, or local path).
  - Language(s) and frameworks (e.g. `dart`, `typescript`, `supabase`, `postgres`).
  - Version or release tags (e.g. `framework_version: "Flutter 3.24.5"`).
  - Ingestion timestamps; for repos: `commit_sha`, `branch`.
- **Chunk-level MUST have:**
  - Document ID, file path, language, chunk type (`code`/`text`/`sql`/`config`).
  - Symbol-level info where available (class name, function name, table name, route path).
  - Line ranges and character offsets for source linking.
- Treat these as **hard requirements** — chunking/embedding cannot proceed without minimum metadata.

#### 3.1.6 Embedding Profiles Support

- **Problem:** No way to configure chunking + embedding strategies per use-case. Users cannot choose between fast/cheap vs high-accuracy without editing env vars.
- **Impact:**
  - Enables MODEL_SELECTOR feature.
  - Allows per-collection optimization (Flutter/Dart vs Node/TS vs Supabase/Postgres).
- **Effort:** Medium–High.

**Implementation Notes:**
- Relevant files:
  - `apps/server/src/services/embedding-router.ts`
  - `apps/server/src/pipeline/orchestrator.ts`
  - New: `apps/server/src/services/model-config.ts` (from MODEL_SELECTOR plan)
- Steps:
  1. Define profile presets: *fast/cheap*, *balanced*, *high-accuracy*.
  2. Each profile bundles:
     - Embedding provider + model (e.g. `ollama/nomic-embed-text`, `openai/text-embedding-3-large`, `voyage/voyage-code-2`, local `bge-m3`).
     - Chunk size/overlap parameters.
     - Stack-specific chunking heuristics (code-aware vs plain text).
  3. Store profiles in DB config table (see MODEL_SELECTOR plan).
  4. Allow per-collection profile overrides.
  5. Token-aware chunking must respect profile's model token limits.

---

### 3.2 Tier 2 – Important but Not Blocking

#### 3.2.1 Collection Versioning & Lifecycle

- **Problem:** No way to track document versions, archive superseded docs, or manage collection lifecycle.
- **Impact:**
  - Users cannot update Flutter 3.24 docs to 3.25 without manual cleanup.
  - No audit trail of what was ingested when.
- **Effort:** Medium.

**Implementation Notes:**
- Steps:
  1. Add document-level version fields: `framework_version`, `doc_version`, `ingested_at`.
  2. For repos: track `repo_url`, `branch`, `commit_sha` per ingest run.
  3. Support marking older docs as `archived` or `superseded` (excluded from search by default).
  4. Add cascade delete: collection delete removes all documents, chunks, embeddings, relationships.
  5. UI: filter by version, see active versions per collection.

#### 3.2.2 Hybrid Weight Tuning & Diagnostics

- **Problem:** Hybrid weights are configurable but not guided; no visibility into BM25 vs vector contributions.
- **Impact:**
  - Makes hybrid search more interpretable and tunable per collection.
- **Effort:** Low–Medium.

**Implementation Notes:**
- Relevant files:
  - `apps/server/src/services/hybrid.ts`
  - `apps/server/src/services/search.ts`
- Steps:
  1. Expose hybrid weight configuration clearly via API & env docs.
  2. Extend metadata in `smartSearch` responses to include more diagnostics:
     - Average `vectorScore`, `bm25Score`, and fraction of results from each source.
     - BM25 result count (to detect when BM25 returned nothing).
  3. Add per-collection weight configuration (ties into embedding profiles).
  4. Optionally log per-collection metrics to support offline tuning.
  5. **Note:** This becomes more valuable after BM25 query building is fixed (3.1.4).

#### 3.2.3 Better Text Chunking Heuristics

- **Problem:** Sentence and paragraph detection are regex-based and can fail on abbreviations, embedded code, decimals, etc.
- **Impact:**
  - Improves coherence of text chunks, especially technical docs.
- **Effort:** Medium.

**Implementation Notes:**
- Relevant file:
  - `apps/server/src/pipeline/chunk.ts`
- Steps:
  1. Keep the current structure but refine regex patterns.
  2. Optionally add lightweight NLP-based sentence segmentation (via a small JS library) when enabled by env flag, with regex as fallback.
  3. Ensure chunking remains deterministic and performant for large documents.

---

### 3.3 Tier 3 – Advanced Enhancements / Nice-to-Have

#### 3.3.1 Query Intent & Search Mode Selection

- **Problem:** All queries are treated similarly; no classification into e.g. code lookup, conceptual question, error troubleshooting.
- **Impact:**
  - Could significantly improve retrieval quality in some workloads, but not strictly required for correctness.
- **Effort:** High.

**Implementation Notes:**
- Relevant files:
  - `apps/server/src/services/search.ts`
  - Potential new module for query analysis.
- Ideas:
  1. Add a query-analysis step that labels queries: `code_symbol`, `natural_language`, `error_message`, etc.
  2. Use those labels to:
     - Adjust hybrid weights.
     - Choose BM25 vs vector priority.
     - Enable/disable reranking.

#### 3.3.2 Result Diversification (MMR or Similar)

- **Problem:** No explicit mechanism to avoid near-duplicate results in top-k.
- **Impact:**
  - Improves user experience when many very similar chunks exist.
- **Effort:** Medium–High.

**Implementation Notes:**
- Relevant files:
  - `apps/server/src/services/search.ts`
- Steps:
  1. After vector/hybrid/rerank, add an optional diversification step (e.g. MMR) before returning results.
  2. Make diversification configurable per-request or per-collection via params/env.

#### 3.3.3 Broader AST-Based Language Support

- **Problem:** Many important stacks beyond Dart/TypeScript still fall back to simple line-based chunking or partial heuristics (e.g. Node/TS backends, Python, Kotlin/Java Android, Swift iOS, SQL/Postgres DDL/functions, and Redis-related code paths).
- **Impact:**
  - Improves retrieval in multi-language repos and across your real app stacks (Flutter/Dart, Node/TS, Supabase/Postgres, Redis, Firebase, etc.).
- **Effort:** High (per-language/parser integration and testing work).

**Implementation Notes:**
- Relevant file:
  - `apps/server/src/pipeline/code-chunker.ts`
- Approach:
  1. Incrementally add language- and framework-specific analyzers **in the order that matches your roadmap**:
     - Solidify and extend existing Dart/TS/JS analyzers for Flutter, React/Next.js, and Node API code.
     - Add or refine analyzers for SQL/Postgres (schema migrations, functions, triggers) that already exist via `sql-analyzer`.
     - Add analyzers for Python backends (FastAPI/Django) and, later, Kotlin/Java Android and Swift iOS as described in the extended tech stack plan.
  2. Reuse the existing AST-driven chunking patterns used for TS/JS, Dart, Kotlin, Swift wherever possible so behavior is consistent across languages.
  3. Maintain a simple registry/config of **supported languages and their analyzers** so agents and search tooling know exactly which languages have code-aware/AST chunking and which still rely on `simpleChunking`.

---

## 4. Suggested Implementation Order for Agents

For a new agent joining this project, the following order balances risk, impact, and complexity:

### Phase A – Critical Fixes (Tier 1)

1. **Implement token-aware chunking & embedding limits** (3.1.1).
   - Prevents silent failures and API errors from oversized chunks.
2. **Fix BM25 query building** (3.1.4).
   - Currently 90% broken; must fix before hybrid search provides any value.
   - Validate with eval harness before/after.
3. **Enforce document & chunk metadata guarantees** (3.1.5).
   - Prerequisite for embedding profiles and collection versioning.
4. **Implement embedding profiles support** (3.1.6).
   - Enables MODEL_SELECTOR feature and per-collection optimization.
5. **Improve code chunking for large classes** (3.1.2).
6. **Refine import handling** (3.1.3).

### Phase B – Important Enhancements (Tier 2)

7. **Collection versioning & lifecycle** (3.2.1).
8. **Hybrid diagnostics and per-collection weight tuning** (3.2.2).
9. **Tighten text chunking heuristics** (3.2.3).

### Phase C – Advanced Features (Tier 3)

10. **Query intent & search mode selection** (3.3.1).
11. **Result diversification (MMR)** (3.3.2).
12. **Broader AST-based language support** (3.3.3).

Each step should ideally be implemented as a separate phase/PR with:
- Unit tests for new behavior.
- Configuration documented in `ENV_VARIABLES.md` or similar.
- Notes in the relevant PHASE summary files.
- **For search changes:** Run eval harness before/after and include results in PR.

---

## 5. Evaluation Harness & How to Use It

The evaluation harness described earlier has been implemented and used against the Flutter & Dart collection. Future agents should **reuse and extend this harness** rather than reinventing it.

**Current implementation (Flutter/Dart example):**
- Config: `apps/server/perf/rag_eval_flutter_dart.json`
  - Fields: `collectionId`, `topK`, `modes` (`vector`, `bm25`, `hybrid`, `hybrid_rerank`), and a list of queries.
- Runner script: `apps/server/src/scripts/rag-eval-flutter-dart.ts`
- Summary script: `apps/server/src/scripts/rag-eval-flutter-dart-summary.ts`
- Outputs:
  - JSON: `apps/server/perf/rag_eval_flutter_dart_results_*.json`
  - Markdown: `apps/server/perf/rag_eval_flutter_dart_summary_*.md`

**How to run (from repo root):**

```bash
pnpm --filter @synthesis/server exec tsx src/scripts/rag-eval-flutter-dart.ts
pnpm --filter @synthesis/server exec tsx src/scripts/rag-eval-flutter-dart-summary.ts
```

**How to extend for other collections/languages:**
- Copy `rag_eval_flutter_dart.json` to a new config (e.g. `rag_eval_node_ts.json`) and update:
  - `collectionId` to the target collection.
  - `queries` to a curated set of questions for that stack.
  - Optionally adjust `modes` (e.g. disable `hybrid_rerank` if reranking is not configured).
- Extend `EXPECTED_SNIPPET_ANCHORS` in `rag-eval-flutter-dart-summary.ts` (or a generalized summary script) with code anchors relevant to that stack.
- Re-run the two commands above with the new config wired into the runner.

**When to use the harness:**
- Before and after changes to **BM25 query-building** or weights.
- Before and after changes to **hybrid fusion** or **reranking** behavior.
- After significant updates to **AST-based chunking** or new language analyzers.

Using this harness as a standard tool will make BM25/hybrid/rerank changes safer and ensure that search quality actually improves for the programming languages and stacks you care about.
