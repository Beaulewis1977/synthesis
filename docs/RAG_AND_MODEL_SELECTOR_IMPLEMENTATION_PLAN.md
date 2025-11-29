# RAG & Model Selector Implementation Plan

**Version:** 1.0 | **Created:** November 2025

**Source Documents:** `RAG_SYSTEM_ANALYSIS_REPORT_GPT.MD`, `docs/MODEL_SELECTOR_BUILD_PLAN.md`

---

## 1. Executive Summary

This plan combines **RAG system fixes** and **Model Selector feature** into a phased implementation. Total estimated time: **35-45 days** (14 phases).

### Critical Path
```
Phase 1 (Token Chunking) ─┬─> Phase 5 (Embedding Profiles) ─┬─> Phase 6 (Admin UI)
Phase 2 (BM25 Fix) ───────┤                                 │
Phase 3 (Metadata) ───────┴─> Phase 4 (Config Service) ─────┘
```

---

## 2. GitHub Workflow

### 2.1 Rules

| Rule | Requirement |
|------|-------------|
| Base branch | All features branch from `develop` |
| Commits | **NO commits without human approval** |
| Pushes | **NO pushes without human approval** |
| PRs | All changes via PR to `develop` |
| Naming | Branch: `feature/phase-X-description`, Commit: `feat(scope): description` |

### 2.2 Workflow Per Phase

```bash
# 1. Create branch (WAIT FOR APPROVAL)
git checkout develop && git pull origin develop
git checkout -b feature/phase-X-description

# 2. Implement changes...

# 3. Present changes to human for review

# 4. After APPROVAL: commit
git add -A
git commit -m "feat(scope): description"

# 5. After APPROVAL: push
git push -u origin feature/phase-X-description

# 6. Create PR
gh pr create --base develop --title "Phase X: Description"
```

---

## 3. Phase Overview

| # | Phase | Priority | Days | Dependencies | Branch |
|---|-------|----------|------|--------------|--------|
| 1 | Token-Aware Chunking | P0 | 2-3 | None | `feature/phase-1-token-chunking` |
| 2 | BM25 Query Fix | P0 | 2 | None | `feature/phase-2-bm25-fix` |
| 3 | Metadata Guarantees | P0 | 2-3 | None | `feature/phase-3-metadata` |
| 4 | Model Config Service | P1 | 3-4 | Phase 3 | `feature/phase-4-model-config` |
| 5 | Embedding Profiles | P1 | 3-4 | 1, 3, 4 | `feature/phase-5-embedding-profiles` |
| 6 | Model Selector UI | P1 | 3-4 | 4, 5 | `feature/phase-6-model-selector-ui` |
| 7 | Collection Versioning | P2 | 2-3 | Phase 3 | `feature/phase-7-versioning` |
| 8 | Hybrid Diagnostics | P2 | 1-2 | Phase 2 | `feature/phase-8-hybrid-diagnostics` |
| 9 | Code Chunking Improvements | P2 | 2-3 | Phase 1 | `feature/phase-9-code-chunking` |
| 10 | Import Handling | P3 | 1 | Phase 9 | `feature/phase-10-imports` |
| 11 | Text Chunking Heuristics | P3 | 2 | Phase 1 | `feature/phase-11-text-chunking` |
| 12 | Query Intent Detection | P3 | 3-4 | Phase 2 | `feature/phase-12-query-intent` |
| 13 | Result Diversification (MMR) | P3 | 2-3 | Phase 8 | `feature/phase-13-mmr` |
| 14 | Broader AST Language Support | P3 | 4-5 | Phase 9 | `feature/phase-14-ast-languages` |

---

## 4. Phase 1: Token-Aware Chunking

**Problem:** Chunks may exceed embedding API token limits → silent truncation or errors.

### 4.1 Deliverables
- [x] Token estimator with per-provider limits
- [x] Auto-split for oversized chunks
- [x] Parent-child chunk relationships in metadata

### 4.2 Key Files

| File | Action |
|------|--------|
| `apps/server/src/pipeline/token-estimator.ts` | **CREATE** |
| `apps/server/src/pipeline/chunk-splitter.ts` | **CREATE** |
| `apps/server/src/pipeline/orchestrator.ts` | MODIFY - add validation |
| `apps/server/src/pipeline/store.ts` | MODIFY - accurate token counts |

### 4.3 Token Limits

> **Note:** These token limits should be kept in sync with provider documentation and may need updates as providers change their APIs.

```typescript
const LIMITS = {
  'ollama/nomic-embed-text': 8192,
  'openai/text-embedding-3-large': 8191,
  'openai/text-embedding-3-small': 8191,
  'voyage/voyage-code-2': 16000,
  'google/text-embedding-004': 2048,
  'bge/bge-m3': 8192,
};
```

### 4.4 Acceptance Criteria
- [x] No chunk exceeds provider token limit
- [x] Oversized chunks auto-split with overlap
- [x] All tests pass

---

## 5. Phase 2: BM25 Query Fix

**Problem:** BM25 returns 0 results for 90% of NL queries. Hybrid search is broken.

### 5.1 Deliverables
- [x] Smart query builder (websearch_to_tsquery with OR logic for NL, prefix for code)
- [x] Query type detection
- [x] Metrics logging (via `bm25SearchWithMetadata`)
- [x] Eval harness before/after comparison - **85% success rate achieved**

### 5.2 Key Files

| File | Action |
|------|--------|
| `apps/server/src/services/bm25.ts` | MODIFY - new query builder |

### 5.3 Query Strategy

```typescript
function detectQueryType(query: string): 'natural_language' | 'code_symbol' | 'phrase' {
  if (/^".*"$/.test(query)) return 'phrase';           // "exact phrase"
  if (/[A-Z][a-z]+[A-Z]|_\w|\.\w/.test(query)) return 'code_symbol'; // camelCase, snake_case
  return 'natural_language';                           // Default for questions
}

// NL → websearch_to_tsquery (handles stemming, stop words, robust syntax)
// Code → prefix matching (term:*)
// Phrase → phraseto_tsquery
```

### 5.4 Acceptance Criteria
- [x] BM25 returns results for >50% of NL queries - **Achieved 85%** (17/20 queries)
- [x] Eval harness shows improvement - From 14.3% to 85% success rate
- [x] No regression for code queries

---

## 6. Phase 3: Metadata Guarantees

**Problem:** Inconsistent metadata breaks filtering, versioning, and MODEL_SELECTOR.

### 6.1 Deliverables
- [x] Metadata validation functions
- [x] Required fields enforcement
- [x] DB migration for new columns

### 6.2 Required Fields

**Document-level:**
```typescript
interface RequiredDocMetadata {
  source: string;                    // URL, repo, or path
  source_type: 'url' | 'repo' | 'file';
  languages: string[];               // ['dart', 'typescript']
  ingested_at: string;               // ISO timestamp
  framework_version?: string;        // 'Flutter 3.24.5'
  commit_sha?: string;               // For repos
}
```

**Chunk-level:**
```typescript
interface RequiredChunkMetadata {
  chunk_type: 'code' | 'text' | 'sql' | 'config';
  startOffset: number;
  endOffset: number;
  language?: string;
  file_path?: string;
  // Symbol info when available:
  class_name?: string;
  function_name?: string;
}
```

### 6.3 Key Files

| File | Action |
|------|--------|
| `apps/server/src/services/metadata-validator.ts` | **CREATE** |
| `apps/server/src/services/metadata-builder.ts` | MODIFY |
| `apps/server/src/pipeline/orchestrator.ts` | MODIFY - add validation |
| `packages/db/migrations/XXX_metadata.sql` | **CREATE** |

---

## 7. Phase 4: Model Config Service

**Problem:** Model selection scattered across env vars and hard-coded values.

### 7.1 Deliverables
- [x] `model_configs` DB table
- [x] `ModelConfigService` (env → DB → default precedence)
- [x] Admin API: `GET/PUT /api/admin/models`
- [x] Wire all backend features to use service

### 7.2 Database Schema

```sql
CREATE TABLE model_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature TEXT NOT NULL,      -- 'chat', 'embedding_docs', etc.
  provider TEXT NOT NULL,     -- 'anthropic', 'ollama', etc.
  model TEXT NOT NULL,
  local_only BOOLEAN DEFAULT false,
  enabled BOOLEAN DEFAULT true,
  UNIQUE (feature)
);
```

### 7.3 Config Service API

```typescript
class ModelConfigService {
  getChatModelConfig(): Promise<ModelConfig>;
  getSummaryModelConfig(): Promise<ModelConfig>;
  getOCRModelConfig(): Promise<ModelConfig>;
  getContradictionModelConfig(): Promise<ModelConfig>;
  getEmbeddingConfig(type: 'docs' | 'code' | 'writing'): Promise<ModelConfig>;
  getRerankerConfig(): Promise<ModelConfig>;
}
```

### 7.4 Backend Integration Points

| File | Replace |
|------|---------|
| `apps/server/src/agent/agent.ts` | Hard-coded model → `getChatModelConfig()` |
| `apps/server/src/agent/tools.ts` | Literal model → `getSummaryModelConfig()` |
| `apps/server/src/pipeline/vision-ocr.ts` | Env read → `getOCRModelConfig()` |
| `apps/server/src/services/embedding-router.ts` | Env reads → `getEmbeddingConfig()` |
| `apps/server/src/services/reranker.ts` | Env read → `getRerankerConfig()` |

---

## 8. Phase 5: Embedding Profiles

**Problem:** No way to configure chunking + embedding per collection.

### 8.1 Deliverables
- [x] Profile presets: *fast/cheap*, *balanced*, *high-accuracy*
- [x] `embedding_profiles` DB table
- [x] Per-collection profile override
- [x] Integration with token chunking

### 8.2 Profile Presets

| Profile | Provider | Model | Chunk Size | Code-Aware | Cost |
|---------|----------|-------|------------|------------|------|
| fast-cheap | ollama | nomic-embed-text | 1000 | No | Free |
| balanced | openai | text-embedding-3-small | 800 | Yes | Low |
| high-accuracy | voyage | voyage-code-2 | 600 | Yes | Medium |

### 8.3 Key Files

| File | Action |
|------|--------|
| `packages/db/migrations/019_embedding_profiles.sql` | **CREATED** |
| `packages/shared/src/embedding-profiles.ts` | **CREATED** |
| `apps/server/src/services/embedding-profile-service.ts` | **CREATED** |
| `apps/server/src/routes/admin/profiles.ts` | **CREATED** |
| `apps/server/src/pipeline/orchestrator.ts` | MODIFIED - uses profiles |

### 8.4 Acceptance Criteria
- [x] 3 system profiles seeded on migration
- [x] Collections can have a profile assigned
- [x] Profile settings applied during ingestion
- [x] Admin API for CRUD operations
- [x] System profiles cannot be deleted

---

## 9. Phase 6: Model Selector Admin UI

**Problem:** No UI for runtime model configuration.

### 9.1 Deliverables
- [x] `/settings/models` page
- [x] Feature config cards (Chat, Embeddings, Reranker, etc.)
- [x] Provider/model dropdowns
- [x] Local-only toggle
- [x] Validation error display
- [x] Embedding profile selector

### 9.2 UI Components

```
/settings/models
├── Header: "Models & Providers"
├── Section: LLM Models
│   ├── Card: Chat Agent
│   │   ├── Provider dropdown (Anthropic, OpenAI, Ollama, Google)
│   │   ├── Model dropdown (filtered by provider)
│   │   └── Local-only toggle
│   ├── Card: Summarization
│   └── Card: Vision OCR
├── Section: Embeddings
│   ├── Card: Documents (with profile selector)
│   ├── Card: Code
│   └── Card: Writing/Personal
├── Section: Search
│   └── Card: Reranker (none, bge, cohere)
└── Save button (with validation feedback)
```

### 9.3 Key Files

| File | Action |
|------|--------|
| `apps/web/src/pages/settings/models.tsx` | **CREATE** |
| `apps/web/src/components/settings/ModelConfigCard.tsx` | **CREATE** |
| `apps/web/src/components/settings/EmbeddingProfileSelect.tsx` | **CREATE** |
| `apps/web/src/hooks/useModelConfig.ts` | **CREATE** |
| `apps/web/src/lib/api/model-config.ts` | **CREATE** |

### 9.4 UX Requirements

- [x] Show current source (env/DB/default) for each setting
- [x] Disable cloud providers when local-only is on
- [x] Show warning if API key missing for selected provider
- [x] Optimistic updates with error rollback
- [x] Confirmation dialog for changes affecting existing embeddings
- [x] Loading states for all async operations

---

## 10. Phase 7: Collection Versioning

**Problem:** No way to track document versions or manage lifecycle.

### 10.1 Deliverables
- [x] Version fields on documents (`framework_version`, `doc_version`)
- [x] Repo tracking (`commit_sha`, `branch`)
- [x] Archive/supersede old docs
- [x] Cascade delete for collections (already existed via FK constraints)
- [x] UI: Version filter, active versions display

### 10.2 Key Files

| File | Action |
|------|--------|
| `packages/db/migrations/021_collection_versioning.sql` | **CREATED** |
| `apps/server/src/services/collection-lifecycle.ts` | **CREATED** |
| `apps/server/src/routes/collections.ts` | MODIFIED |
| `apps/web/src/components/collections/VersionFilter.tsx` | **CREATED** |
| `apps/web/src/components/collections/LifecycleBadge.tsx` | **CREATED** |
| `apps/web/src/components/collections/DocumentActions.tsx` | **CREATED** |

---

## 11. Phase 8: Hybrid Search Diagnostics

**Problem:** No visibility into BM25 vs vector contributions in hybrid search.

### 11.1 Deliverables
- [x] Extended search metadata (BM25 count, avg/max/min scores, timing breakdown)
- [x] Per-request weight configuration with normalization
- [x] Diagnostic logging (structured JSON, env-controlled)
- [x] BM25 query type and tsquery function exposed in diagnostics

### 11.2 Key Files

| File | Action |
|------|--------|
| `apps/server/src/services/hybrid.ts` | MODIFIED - Added HybridDiagnostics, ScoreStats, HybridTiming interfaces |
| `apps/server/src/services/search.ts` | MODIFIED - Added SearchDiagnostics, mapDiagnostics function |
| `apps/server/src/routes/search.ts` | MODIFIED - Exposed diagnostics in API response |
| `apps/server/src/services/__tests__/hybrid.test.ts` | MODIFIED - Added diagnostics tests |

### 11.3 API Response Enhancement

The search API now includes diagnostics in hybrid mode:

```json
{
  "metadata": {
    "search_mode": "hybrid",
    "diagnostics": {
      "vector_scores": { "avg": 0.72, "max": 0.91, "min": 0.45 },
      "bm25_scores": { "avg": 0.65, "max": 0.88, "min": 0.32 },
      "both_source_count": 5,
      "timing": { "vector_ms": 45, "bm25_ms": 12, "fusion_ms": 2, "total_ms": 59 },
      "bm25_query_type": "natural_language",
      "bm25_ts_function": "websearch_to_tsquery",
      "weights": { "vector": 0.7, "bm25": 0.3 },
      "rrf_k": 60
    }
  }
}
```

### 11.4 Acceptance Criteria
- [x] Diagnostics included in hybrid search response
- [x] Score statistics (avg/max/min) for both vector and BM25
- [x] Timing breakdown shows vector vs BM25 latency
- [x] BM25 query type from Phase 2 exposed
- [x] Structured logging via `HYBRID_DIAGNOSTICS_LOG=true`
- [x] All tests pass

---

## 12. Phase 9: Code Chunking Improvements

**Problem:** Large classes split per-method lose context; non-AST languages use coarse line-based chunking.

### 12.1 Deliverables
- [x] Hierarchical chunks (class overview + method chunks)
- [x] Improved `simpleChunking` with language-aware defaults
- [x] Parent-child chunk relationships
- [x] Metadata linking (class_name, parent_chunk_id)

### 12.2 Key Files

| File | Action |
|------|--------|
| `packages/shared/src/index.ts` | MODIFIED - Added ChunkHierarchy type and metadata fields |
| `apps/server/src/pipeline/hierarchical-chunker.ts` | **CREATED** - Hierarchical chunking module |
| `apps/server/src/pipeline/code-chunker.ts` | MODIFIED - Integrated hierarchical chunking |
| `apps/server/src/pipeline/__tests__/hierarchical-chunker.test.ts` | **CREATED** - Unit tests |
| `apps/server/src/pipeline/__tests__/code-chunker.test.ts` | MODIFIED - Phase 9 tests |

### 12.3 Acceptance Criteria
- [x] Large classes have overview + method chunks
- [x] Chunks reference parent via metadata
- [x] Line-based chunking respects function boundaries when detectable

---

## 13. Phase 10: Import Handling

**Problem:** `PRESERVE_IMPORTS=true` duplicates full imports in every chunk metadata.

### 13.1 Deliverables
- [x] Store imports once per file in document metadata
- [x] Remove per-chunk import duplication
- [x] Add import reference in first chunk only

### 13.2 Key Files

| File | Action |
|------|--------|
| `apps/server/src/pipeline/code-chunker.ts` | MODIFY |

---

## 14. Phase 11: Text Chunking Heuristics

**Problem:** Sentence/paragraph detection uses fragile regex that fails on abbreviations, decimals, embedded code.

### 14.1 Deliverables
- [x] Improved regex patterns for sentence boundaries
- [x] Optional NLP-based sentence segmentation (via library)
- [x] Configuration flag to switch between modes
- [x] Benchmark suite for chunking quality

### 14.2 Key Files

| File | Action |
|------|--------|
| `apps/server/src/pipeline/chunk.ts` | MODIFIED - integrated sentence splitter |
| `apps/server/src/pipeline/sentence-splitter.ts` | **CREATED** - new sentence boundary module |
| `apps/server/src/pipeline/__tests__/sentence-splitter.test.ts` | **CREATED** - 50 tests |
| `scripts/benchmark-phase11.ts` | **CREATED** - benchmark suite |

### 14.3 Sentence Boundary Improvements

```typescript
// Legacy (fragile):
const SENTENCE_END = /[.!?]\s+/;

// Improved (Phase 11):
// - Comprehensive abbreviation detection (~100 abbreviations)
// - Protected patterns: URLs, versions, decimals, code blocks
// - Three modes: 'regex' (improved), 'nlp' (optional), 'legacy'

// Usage:
chunkText(text, { sentenceSplitMode: 'regex' }); // Default: improved
chunkText(text, { sentenceSplitMode: 'legacy' }); // Backwards compatible
chunkText(text, { customAbbreviations: ['Ref', 'Fig'] }); // Custom
```

### 14.4 Acceptance Criteria
- [x] No splits on common abbreviations (Mr., Dr., etc.)
- [x] No splits on version numbers (3.24.5)
- [x] Embedded code blocks preserved
- [x] Performance within 10% of current

---

## 15. Phase 12: Query Intent Detection

**Problem:** All queries treated identically; no adaptation for code lookups vs conceptual questions vs error messages.

### 15.1 Deliverables
- [x] Query classifier module
- [x] Intent-based search mode selection
- [x] Intent-based weight adjustment for hybrid
- [x] Logging/metrics for intent distribution

### 15.2 Query Intent Types

```typescript
type QueryIntent = 
  | 'code_symbol'      // "Navigator.push", "useState hook"
  | 'natural_language' // "How do I implement..."
  | 'error_message'    // Stack traces, error codes
  | 'api_lookup'       // "Flutter Text widget properties"
  | 'conceptual'       // "What is state management"
  | 'comparison';      // "difference between X and Y"
```

### 15.3 Intent → Search Behavior

| Intent | Mode | BM25 Weight | Rerank | Notes |
|--------|------|-------------|--------|-------|
| code_symbol | hybrid | 0.5 | Yes | Prefix matching important |
| natural_language | hybrid | 0.2 | Yes | Vector dominant |
| error_message | hybrid | 0.6 | No | Exact match helps |
| api_lookup | vector | 0.0 | Yes | Semantic similarity |
| conceptual | vector | 0.0 | Yes | Pure semantic |
| comparison | vector | 0.1 | Yes | Needs diverse results |

### 15.4 Key Files

| File | Action |
|------|--------|
| `apps/server/src/services/query-intent.ts` | **CREATED** - 6 intent types, pattern-based classifier |
| `apps/server/src/services/__tests__/query-intent.test.ts` | **CREATED** - 78 unit tests |
| `apps/server/src/services/search.ts` | MODIFIED - integrated intent detection |
| `apps/server/src/routes/search.ts` | MODIFIED - exposed intent params and response fields |

### 15.5 UI/UX Integration

Add intent indicator to search results UI:

```
┌─ Search Results ─────────────────────────────────────────────┐
│ Query: "How do I navigate between screens in Flutter?"      │
│ Intent: natural_language 🔍  Mode: hybrid (vector: 0.8)     │
├──────────────────────────────────────────────────────────────┤
│ 1. Flutter Navigation Guide (0.87)                          │
│ 2. Navigator.push Documentation (0.82)                      │
└──────────────────────────────────────────────────────────────┘
```

**UI Components to add:**
- [ ] Intent badge in search results header
- [ ] Mode/weight indicator (collapsible detail)
- [ ] Settings option to override auto-detection

### 15.6 Acceptance Criteria
- [x] Intent correctly classified for 80%+ of queries (78 tests pass)
- [x] Search quality improves via intent-based configuration
- [x] Intent visible in API response (UI deferred)
- [x] Metrics logged for analysis (QUERY_INTENT_LOG env var)

---

## 16. Phase 13: Result Diversification (MMR)

**Problem:** Top-k results often contain near-duplicates from same document or overlapping chunks.

### 16.1 Deliverables
- [x] Maximal Marginal Relevance (MMR) implementation
- [x] Configurable diversity parameter (lambda)
- [x] Per-request configuration (per-collection deferred to UI phase)
- [x] Diversity metrics in response

### 16.2 MMR Algorithm

```typescript
interface MMROptions {
  lambda: number;      // 0.0 = max diversity, 1.0 = max relevance (default: 0.7)
  enabled: boolean;
  minSimilarityDiff: number; // Threshold to consider "too similar" (default: 0.1)
}

function applyMMR(results: SearchResult[], query: string, options: MMROptions): SearchResult[] {
  // 1. Start with highest relevance result
  // 2. For each next slot, pick result that maximizes:
  //    λ * relevance(result) - (1-λ) * max_similarity(result, selected)
  // 3. Continue until topK reached
}
```

### 16.3 Key Files

| File | Action |
|------|--------|
| `apps/server/src/services/mmr.ts` | **CREATED** - Core MMR algorithm |
| `apps/server/src/services/__tests__/mmr.test.ts` | **CREATED** - 47 unit tests |
| `apps/server/src/services/search.ts` | MODIFIED - integrated MMR diversification |
| `apps/server/src/routes/search.ts` | MODIFIED - exposed mmr_enabled, mmr_lambda params |

### 16.4 UI/UX Integration

Add diversity controls to advanced search settings:

```
┌─ Advanced Search Settings ───────────────────────────────────┐
│                                                              │
│ Result Diversity                                             │
│ ├─ [✓] Enable diversification                               │
│ ├─ Diversity level: [──●────] (0.7 balanced)                │
│ │   ← More relevant        More diverse →                   │
│ └─ Show diversity score in results                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**UI Components to add:**
- [x] Diversity toggle in search settings
- [x] Lambda slider (0.3 - 1.0 range, default 0.7)
- [x] Diversity indicator on results (shows duplicates removed)
- [ ] Per-collection default in collection settings (deferred)

### 16.5 Acceptance Criteria
- [x] Near-duplicate results reduced by 50%+ (via MMR algorithm)
- [x] Relevance of top-1 not degraded (always selects most relevant first)
- [x] Lambda configurable per-request
- [x] UI controls functional

---

## 17. Phase 14: Broader AST Language Support

**Problem:** Many languages (Java, Python, Go, Rust, C/C++) use coarse `simpleChunking` instead of AST-aware chunking.

### 17.1 Deliverables
- [ ] Language analyzer registry
- [ ] Python AST analyzer (FastAPI/Django aware)
- [ ] Java AST analyzer
- [ ] Go AST analyzer (optional)
- [ ] Language support status in UI

### 17.2 Priority Languages

| Language | Framework Focus | Parser | Priority |
|----------|-----------------|--------|----------|
| Python | FastAPI, Django | tree-sitter-python | High |
| Java | Android, Spring | tree-sitter-java | Medium |
| Go | APIs, CLI tools | tree-sitter-go | Low |
| Rust | Systems, WASM | tree-sitter-rust | Low |
| C/C++ | Native modules | tree-sitter-c | Low |

### 17.3 Analyzer Interface

```typescript
interface LanguageAnalyzer {
  language: string;
  extensions: string[];
  
  analyze(code: string, filePath: string): AnalysisResult;
  chunk(code: string, options: ChunkOptions): CodeChunk[];
  
  // Framework-specific detection
  detectFramework?(code: string): string | null;
}

// Registry
const ANALYZERS: Record<string, LanguageAnalyzer> = {
  'dart': dartAnalyzer,
  'typescript': tsAnalyzer,
  'javascript': tsAnalyzer,
  'python': pythonAnalyzer,  // NEW
  'java': javaAnalyzer,      // NEW
  // ...
};
```

### 17.4 Key Files

| File | Action |
|------|--------|
| `apps/server/src/pipeline/analyzers/registry.ts` | **CREATE** |
| `apps/server/src/pipeline/analyzers/python-analyzer.ts` | **CREATE** |
| `apps/server/src/pipeline/analyzers/java-analyzer.ts` | **CREATE** |
| `apps/server/src/pipeline/code-chunker.ts` | MODIFY - use registry |

### 17.5 UI/UX Integration

Show language support status in collection/document views:

```
┌─ Collection: My Python Project ──────────────────────────────┐
│                                                              │
│ Language Support                                             │
│ ├─ Python     ✅ AST-aware (FastAPI detected)               │
│ ├─ SQL        ✅ AST-aware                                   │
│ ├─ YAML       ⚠️ Config-aware                                │
│ └─ Dockerfile 📄 Line-based                                  │
│                                                              │
│ Chunking Quality: ████████░░ 80%                            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**UI Components to add:**
- [ ] Language support badges on collections
- [ ] Chunking quality indicator
- [ ] Analyzer status in admin/debug view
- [ ] "Re-chunk with new analyzer" action when analyzer added

### 17.6 Acceptance Criteria
- [ ] Python files use AST chunking
- [ ] FastAPI routes detected and chunked semantically
- [ ] Java classes/methods chunked properly
- [ ] Registry correctly routes by file extension
- [ ] UI shows language support status

---

## 18. Validation & Testing

### 18.1 Per-Phase Testing

| Phase | Test Requirements |
|-------|-------------------|
| 1 | Token estimation accuracy, split preserves content |
| 2 | Query type detection, **run eval harness before/after** |
| 3 | Validation catches missing fields |
| 4 | Config precedence (env → DB → default) |
| 5 | Profile settings applied to chunking |
| 6 | UI renders, API calls work, validation errors shown |
| 7 | Cascade delete works, version filter works |
| 8 | Diagnostics included in response |
| 9 | Hierarchical chunks created, parent references work |
| 10 | Imports stored once per file, not per chunk |
| 11 | Sentence splits correct on edge cases (abbreviations, versions) |
| 12 | Intent detection accuracy >80%, **run eval harness** |
| 13 | MMR reduces duplicates, top-1 relevance preserved |
| 14 | Python/Java files chunked via AST, registry routes correctly |

### 18.2 Eval Harness Commands

```bash
# Run before and after Phase 2 (BM25 fix)
pnpm --filter @synthesis/server exec tsx src/scripts/rag-eval-flutter-dart.ts
pnpm --filter @synthesis/server exec tsx src/scripts/rag-eval-flutter-dart-summary.ts
```

---

## 19. Documentation Updates

After each phase, update:
- [ ] `ENV_VARIABLES.md` — New env vars
- [ ] `docs/CONFIGURATION.md` — Config service docs
- [ ] `PHASE_XX_SUMMARY.md` — Phase completion summary
- [ ] API docs if routes added

---

## 20. Rollback Plan

If any phase causes issues:

```bash
# Revert the merge commit
git revert -m 1 <merge-commit-sha>

# Or reset develop to before merge
git checkout develop
git reset --hard <pre-merge-sha>
git push --force-with-lease origin develop
```

---

## 21. UI/UX Specifications (Phase 6 Detail)

### 21.1 Design System

Use existing Synthesis design tokens:
- **Framework:** React + TypeScript
- **Styling:** TailwindCSS
- **Components:** shadcn/ui
- **Icons:** Lucide React
- **Forms:** React Hook Form + Zod validation

### 21.2 Page Layout: `/settings/models`

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Settings          Models & Providers                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ LLM Models ──────────────────────────────────────────────┐ │
│  │                                                            │ │
│  │  ┌─ Chat Agent ─────────────────────────────────────────┐ │ │
│  │  │  Provider: [Anthropic ▾]  Model: [claude-3-5-haiku ▾]│ │ │
│  │  │  ☐ Local only            Source: env ℹ️               │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                                                            │ │
│  │  ┌─ Summarization ──────────────────────────────────────┐ │ │
│  │  │  Provider: [Anthropic ▾]  Model: [Same as Chat ▾]    │ │ │
│  │  │  ☐ Local only            Source: default ℹ️           │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                                                            │ │
│  │  ┌─ Vision OCR ─────────────────────────────────────────┐ │ │
│  │  │  Provider: [Anthropic ▾]  Model: [claude-3-5-haiku ▾]│ │ │
│  │  │  ☐ Local only            Source: db ✓                 │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ Embeddings ──────────────────────────────────────────────┐ │
│  │                                                            │ │
│  │  Profile: [● Balanced ▾]  (Applies to new ingestions)    │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │ 📄 Documents  │ 💻 Code      │ ✏️ Writing            │ │ │
│  │  ├──────────────────────────────────────────────────────┤ │ │
│  │  │ ollama       │ voyage       │ openai                 │ │ │
│  │  │ nomic-embed  │ voyage-code-2│ text-embed-3-large     │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                                                            │ │
│  │  ⚙️ Custom Settings (override profile)                    │ │
│  │  Chunk size: [800] chars   Overlap: [150] chars          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ Search ──────────────────────────────────────────────────┐ │
│  │                                                            │ │
│  │  Reranker: [○ None  ● BGE (local)  ○ Cohere (cloud)]     │ │
│  │  ⚠️ Cohere requires COHERE_API_KEY                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  [Reset to Defaults]                    [Save Changes ✓]  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 21.3 Component Specifications

#### ModelConfigCard

```tsx
interface ModelConfigCardProps {
  title: string;
  feature: Feature;
  currentConfig: ModelConfig;
  providers: ProviderOption[];
  models: ModelOption[];
  onUpdate: (config: Partial<ModelConfig>) => void;
  isLoading?: boolean;
  error?: string;
}

// Visual states:
// - Default: neutral border
// - Modified (unsaved): yellow border + dot indicator
// - Error: red border + error message below
// - Saving: spinner on save button
// - Success: brief green checkmark animation
```

#### EmbeddingProfileSelect

```tsx
interface EmbeddingProfileSelectProps {
  profiles: EmbeddingProfile[];
  selectedId: string;
  onSelect: (profileId: string) => void;
  showDetails?: boolean;
}

// Each profile option shows:
// - Name (Fast & Cheap, Balanced, High Accuracy)
// - Cost badge (Free, $, $$)
// - Brief description on hover
```

#### ProviderSelect

```tsx
// Dropdown with provider logos/icons
// Disabled options show reason (e.g., "Requires API key")
// Local-only mode filters to: ollama, bge
```

### 21.4 UX Behaviors

| Interaction | Behavior |
|-------------|----------|
| Change any setting | Mark card as "modified", enable Save button |
| Save | POST to API, show spinner, on success show ✓ |
| Validation error | Show inline error, highlight field |
| Missing API key | Show warning banner, disable cloud provider |
| Local-only toggle ON | Filter providers to local options only |
| Reset to Defaults | Confirmation dialog → DELETE DB overrides |
| Navigate away unsaved | "Unsaved changes" confirmation dialog |

### 21.5 Responsive Design

- **Desktop (>1024px):** 2-column layout for cards
- **Tablet (768-1024px):** Single column, full-width cards
- **Mobile (<768px):** Stacked layout, collapsible sections

### 21.6 Accessibility

- [ ] All form controls have labels
- [ ] Tab navigation works correctly
- [ ] Error messages linked to fields via aria-describedby
- [ ] Color not sole indicator of state (icons + text)
- [ ] Focus visible on all interactive elements

---

## 22. Success Criteria

### Phase 1-3 (Critical Fixes)
- [ ] No embedding API errors from oversized chunks
- [ ] BM25 returns results for >50% of NL queries
- [ ] All new documents have required metadata

### Phase 4-6 (Model Selector)
- [ ] Admin can change models via UI without editing `.env`
- [ ] Settings persist across restarts
- [ ] Invalid configs rejected with clear errors
- [ ] UI is responsive and accessible

### Phase 7-10 (Enhancements)
- [ ] Can update doc versions without manual cleanup
- [ ] Can see BM25 contribution in search results
- [ ] Large classes have hierarchical chunks
- [ ] Imports not duplicated per chunk

### Phase 11-14 (Advanced)
- [ ] Text chunking handles abbreviations/versions correctly
- [ ] Query intent detected and used for search tuning
- [ ] Near-duplicate results reduced via MMR
- [ ] Python and Java files use AST-aware chunking
- [ ] UI shows intent, diversity controls, language support status
