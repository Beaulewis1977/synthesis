# RAG Pipeline Capability Brief (Synthesis Monorepo)

## 1) Executive Summary

This repository implements a full-stack, collection-scoped RAG system with ingestion (file upload, repo sync, and an “ingestion agent” that scrapes the web), retrieval (vector, BM25, hybrid RRF fusion, optional reranking + MMR diversification), and an optional synthesis/contradiction layer. It is delivered as a Fastify API server (`apps/server/src/index.ts`) and a Vite/React operator UI (`apps/web/src/App.tsx`) backed by Postgres + pgvector migrations (`packages/db/migrations/*.sql`), plus optional Redis caching (`apps/server/src/services/redis.ts`, `apps/server/src/services/cache/*`).

It is already a strong candidate for a “Codebase Reverse-Engineering → PM Doc Pack Generator” retrieval + orchestration layer, especially because it supports: (a) repo ingestion + code-aware chunking with symbol/line-range metadata, (b) hybrid retrieval + intent-aware knobs, and (c) task/workflow objects in the DB that can store step findings and final outputs. The main gaps for a DocPack generator are: a first-class intermediate representation (IR) store/artifact model, explicit evidence-pointer primitives (file+symbol+line-range) as typed entities rather than ad-hoc JSON metadata, and “run” versioning/diffing for generated doc packs.

What it’s already capable of
- Collection-scoped ingestion for local files via multipart upload (`apps/server/src/routes/ingest.ts` → `ingestDocument()` in `apps/server/src/pipeline/orchestrator.ts`).
- Repository ingestion with incremental sync via git diff (`apps/server/src/routes/repos.ts` → `syncRepository()` in `apps/server/src/services/repo-ingestion.ts`).
- Autonomous web ingestion jobs (topic → search → scrape → ingest) (`apps/server/src/routes/agent-ingestion.ts` → `startIngestionJob()` in `apps/server/src/ingestion-agent/worker.ts`).
- Document extraction for PDFs (with optional vision OCR fallback), DOCX, Markdown, and plain text (`extract()` in `apps/server/src/pipeline/extract.ts`).
- Code-aware chunking with language-specific AST analyzers and rich metadata including file paths and line ranges (`chunkCodeFile()` in `apps/server/src/pipeline/code-chunker.ts`).
- Token-aware chunk splitting with stable “original chunk id” for re-splits (`validateAndSplitChunks()` in `apps/server/src/pipeline/chunk-splitter.ts`).
- Vector search against pgvector (`searchCollection()` in `apps/server/src/services/vector.ts`) and BM25/FTS (`bm25SearchWithMetadata()` in `apps/server/src/services/bm25.ts`).
- Hybrid search with Reciprocal Rank Fusion + diagnostics (`hybridSearch()`/`fuseResults()` in `apps/server/src/services/hybrid.ts`), with optional reranking (`rerankResults()` in `apps/server/src/services/reranker.ts`) and MMR diversification (`applyMMR()` in `apps/server/src/services/mmr.ts`).
- Optional knowledge graph build + graph expansion retrieval (`buildGraphForCollection()` in `apps/server/src/services/graph-builder.ts`; `graphSearch()` in `apps/server/src/services/graph-search.ts`; API in `apps/server/src/routes/graph.ts`).
- Optional synthesis step that clusters sources and runs contradiction detection (`synthesizeResults()` in `apps/server/src/services/synthesis.ts`; `detectContradictions()` in `apps/server/src/services/contradiction-detection.ts`; API in `apps/server/src/routes/synthesis.ts`).
- Multi-provider model routing for chat and embeddings, configured via env or DB (`ModelConfigService` in `apps/server/src/services/model-config-service.ts`; chat provider registry in `apps/server/src/services/chat-providers/index.ts`; embedding router in `apps/server/src/services/embedding-router.ts`).
- Operator UI for collections, upload, search, chat + synthesis, workflows, graph debug, model/provider settings (`apps/web/src/App.tsx` and pages under `apps/web/src/pages/*`).

What’s missing (for DocPack Generator specifically)
- A first-class “Run / Artifact” persistence model for generated outputs (doc packs, IR snapshots) with explicit versioning and diffing between runs (no dedicated tables observed; closest is `workflow_instances.final_output` in `packages/db/migrations/015_agent_workflows.sql`).
- A typed evidence model (file path + symbol + line range + content hash + collection/doc/chunk linkage) rather than relying on flexible JSON metadata and “best effort” chunk metadata (chunk metadata is JSONB; see `chunks.metadata` in `packages/db/migrations/001_initial_schema.sql` and code metadata fields in `apps/server/src/pipeline/code-chunker.ts`).
- A robust, explicit IR generation pipeline (AST → canonical IR) and storage API; current graph + chunk metadata are helpful primitives but not an IR store.
- Embedding dimensionality alignment: the `chunks.embedding` column is `VECTOR(768)` (`packages/db/migrations/001_initial_schema.sql`), while the code supports multiple embedding models and dimensions (`MODEL_DIMENSIONS` in `apps/server/src/services/embedding-router.ts`). Some providers/models cannot emit 768-d vectors, which can block ingestion unless the schema is updated or dimensions are constrained.

Your confidence level (High/Med/Low) and why
- Medium. The retrieval/ingestion/model-routing capabilities are directly evidenced in code and DB migrations. However, a DocPack generator needs explicit IR/run-artifact primitives and the embedding-dimension mismatch is a potentially material limitation until confirmed/configured.

## 2) Architecture Overview

High-level component diagram (Mermaid)
```mermaid
flowchart LR
  UI[Web UI (Vite/React)\napps/web] -->|HTTP| API[Fastify API Server\napps/server/src/index.ts]

  API -->|SQL| PG[(Postgres + pgvector\npackages/db/migrations)]
  API -->|optional| R[(Redis cache)\napps/server/src/services/redis.ts]
  API --> FS[(Local file storage ./storage)\napps/server/src/routes/ingest.ts\napps/server/src/agent/utils/storage.ts]

  API -->|LLM/Embeddings/Rerank| LLMs[(Providers)\nAnthropic/OpenAI/Google/Ollama/Voyage/Cohere/etc.]
  API -->|MCP stdio/http| MCP[(External MCP servers)\napps/server/src/services/mcp-client.ts]

  subgraph Ingestion Paths
    Upload[Multipart Upload\nPOST /api/ingest] --> API
    Repo[Repo Sync\nPOST /api/repos/:id/sync] --> API
    AgentIngest[Ingestion Agent\nPOST /api/ingestion-agent/start] --> API
  end
```

Major services/processes
- Web UI: routing + operator controls (`apps/web/src/App.tsx`, pages in `apps/web/src/pages/*`).
- API Server: Fastify instance + route registry (`apps/server/src/index.ts`).
- Postgres: core persistence + pgvector/HNSW + FTS indexes (see migrations: `packages/db/migrations/001_initial_schema.sql`, `packages/db/migrations/004_hybrid_search.sql`).
- Optional Redis: caching for search/rerank/related-files (`apps/server/src/services/cache/search-cache.ts`, `apps/server/src/services/cache/rerank-cache.ts`, `apps/server/src/services/cache/related-files-cache.ts`).
- File storage: local filesystem under `STORAGE_PATH`/`./storage` (upload route in `apps/server/src/routes/ingest.ts`, storage utils in `apps/server/src/agent/utils/storage.ts`).
- Background jobs:
  - Stale-check scheduler started at boot (`startStaleCheckScheduler()` in `apps/server/src/services/stale-check-job.ts` called from `apps/server/src/index.ts`).
  - Ingestion agent job loop (`processJob()` in `apps/server/src/ingestion-agent/worker.ts`).
  - Repo sync runs async after endpoint returns (`syncRepository()` in `apps/server/src/services/repo-ingestion.ts`, triggered from `apps/server/src/routes/repos.ts`).
- Knowledge graph build + graph retrieval (`buildGraphForCollection()`/`buildGraphForDocument()` in `apps/server/src/services/graph-builder.ts`; `graphSearch()` in `apps/server/src/services/graph-search.ts`).
- Observability: Prometheus metrics endpoint (`registerMetricsRoute()` in `apps/server/src/services/metrics.ts` exposed at `GET /metrics` in `apps/server/src/index.ts`).

How requests flow through the system end-to-end
- Upload ingestion:
  - UI uploads files (`apps/web/src/components/UploadZone.tsx` → `POST /api/ingest`).
  - Server stores the file under `STORAGE_PATH` and creates a `documents` row (`apps/server/src/routes/ingest.ts` → `createDocument()` from `@synthesis/db`), then triggers `ingestDocument(document.id)` (`apps/server/src/pipeline/orchestrator.ts`).
  - Orchestrator reads the stored file (`fs.readFile(document.file_path)` in `ingestDocument()`), extracts text (`extract()` in `apps/server/src/pipeline/extract.ts`), chunks (code-aware via `chunkCodeFile()` or plain via `chunkText()`), validates/splits for token limits (`validateAndSplitChunks()`), embeds (`embedBatch()` in `apps/server/src/pipeline/embed.ts`), then persists chunks/vectors (`storeChunks()` in `apps/server/src/pipeline/store.ts` → `upsertChunk()` in `packages/db/src/queries.ts`).
- Retrieval:
  - UI calls `POST /api/search` (`apps/web/src/lib/api.ts`).
  - Route validates query and applies caching/pagination (`apps/server/src/routes/search.ts`).
  - Core retrieval runs in `smartSearch()` (`apps/server/src/services/search.ts`) selecting vector or hybrid mode; hybrid runs `hybridSearch()` (`apps/server/src/services/hybrid.ts`) which calls both `searchCollection()` (`apps/server/src/services/vector.ts`) and `bm25SearchWithMetadata()` (`apps/server/src/services/bm25.ts`) and fuses via RRF (`fuseResults()`).
  - Optional reranking (`rerankResults()` in `apps/server/src/services/reranker.ts`), optional MMR diversification (`applyMMR()` in `apps/server/src/services/mmr.ts`), optional graph expansion (`graphSearch()` in `apps/server/src/services/graph-search.ts`).
- Chat/agent:
  - UI calls agent chat endpoints (`/api/agent/chat` or `/api/agent/chat/stream`; see `apps/web/src/lib/api.ts`, `apps/web/src/hooks/useStreamingChat.ts`).
  - Server resolves provider/model using per-chat persistence and global defaults (`resolveChatModel()` in `apps/server/src/routes/agent.ts`) and runs the agent orchestrator (`runAgentChat()` in `apps/server/src/agent/agent.ts`), which uses the chat provider registry (`getConfiguredChatProviderWithOverride()` in `apps/server/src/services/chat-providers/index.ts`) and tool definitions (`buildAgentTools()` in `apps/server/src/agent/tools.ts`).

## 3) Data Model & Persistence

DB used + schema/migrations
- Postgres with `vector` (pgvector) extension (`CREATE EXTENSION IF NOT EXISTS vector;` in `packages/db/migrations/001_initial_schema.sql`).
- Migrations live under `packages/db/migrations/*.sql` and are applied via `pnpm --filter @synthesis/db migrate` (`packages/db/src/migrate.ts`).

Collections
- Stored in `collections` table (`packages/db/migrations/001_initial_schema.sql`).
- CRUD accessors in db package (`listCollections()`, `getCollection()`, `createCollection()` in `packages/db/src/queries.ts`), exposed via API (`apps/server/src/routes/collections.ts`).

Documents/chunks
- `documents` table (`packages/db/migrations/001_initial_schema.sql`) stores title, file path, content type, optional `source_url`, status, and arbitrary JSONB `metadata`.
- `chunks` table (`packages/db/migrations/001_initial_schema.sql`) stores per-document chunk text, `chunk_index`, optional `token_count`, JSONB `metadata`, and `embedding_model`.
- Chunk persistence uses `upsertChunk()` and `deleteDocumentChunks()` (`packages/db/src/queries.ts`), orchestrated by `storeChunks()` (`apps/server/src/pipeline/store.ts`).

Embeddings (support for multiple embedding models)
- Code supports multiple embedding providers/models and dimensions (`EmbeddingProvider` and `MODEL_DIMENSIONS` in `apps/server/src/services/embedding-router.ts`; embedding generation in `embedText()`/`embedBatch()` in `apps/server/src/pipeline/embed.ts`).
- DB schema currently hard-codes `chunks.embedding VECTOR(768)` (`packages/db/migrations/001_initial_schema.sql`), which constrains stored embeddings to 768 dimensions unless the schema is changed. OpenAI and Cohere calls can request specific output dimensions (`dimensions` in `embedWithOpenAI()` and `outputDimension` in `embedWithCohere()` in `apps/server/src/pipeline/embed.ts`), but Voyage embeddings are returned at model-native dimensions (`embedWithVoyage()` in `apps/server/src/pipeline/embed.ts`).
- Per-collection embedding profile configuration exists (`embedding_profiles` + `collections.embedding_profile_id` in `packages/db/migrations/019_embedding_profiles.sql`) and is used in ingestion (`getProfileForCollection()` in `apps/server/src/services/embedding-profile-service.ts`, called from `ingestDocument()` in `apps/server/src/pipeline/orchestrator.ts`).

Graph edges (what graph means here)
- Knowledge graph tables: `knowledge_nodes` and `knowledge_edges` (`packages/db/migrations/0024_knowledge_graph.sql`).
- Graph retrieval uses BFS traversal over these edges (`graphSearch()` in `apps/server/src/services/graph-search.ts`), and graph is built from documents (`buildGraphForDocument()` / `buildGraphForCollection()` in `apps/server/src/services/graph-builder.ts`).
- The “graph” represents extracted entities (node types like `symbol`, `endpoint`, `table`, etc.) and relationships (edge types like `calls`, `imports`, etc.) as declared in the API schema (`NodeTypeEnum`/`EdgeTypeEnum` in `apps/server/src/routes/graph.ts`).

Chats / conversations
- `chat_sessions` and `chat_messages` tables (`packages/db/migrations/008_chat_history.sql`) and additional per-chat model overrides (`ALTER TABLE chat_sessions ADD COLUMN provider/model` in `packages/db/migrations/025_chat_session_models.sql`).
- API routes in `apps/server/src/routes/chat.ts` persist and retrieve sessions/messages using db functions like `createChatSession()` and `addChatMessage()` (`packages/db/src/queries.ts`).

Runs / jobs / tasks (if any)
- Autonomous ingestion jobs and per-URL status tracking:
  - `ingestion_jobs` and `ingestion_job_urls` tables (`packages/db/migrations/009_ingestion_agent.sql`).
  - API endpoints in `apps/server/src/routes/agent-ingestion.ts` and worker loop in `apps/server/src/ingestion-agent/worker.ts`.
- Task-oriented workflows:
  - `workflow_templates`, `workflow_instances`, `task_queries`, `code_contexts` tables (`packages/db/migrations/015_agent_workflows.sql`).
  - API endpoints in `apps/server/src/routes/workflows.ts`.
  - Note: workflow execution is currently “step bookkeeping”; no server-side execution engine is implemented in the route itself (see `POST /api/workflows/:id/step` logic in `apps/server/src/routes/workflows.ts`).

Settings / user preferences
- System-wide settings: `system_settings` table (`packages/db/migrations/027_system_settings.sql`) used for defaults like “default embedding profile”.
- Provider-specific settings: `provider_settings` table (`packages/db/migrations/026_provider_settings.sql`) exposed via admin API (`apps/server/src/routes/admin/provider-settings.ts`).
- API keys: `provider_api_keys` table (`packages/db/migrations/020_api_keys.sql`) managed via `ApiKeyService` (`apps/server/src/services/api-key-service.ts`) and admin routes (`apps/server/src/routes/admin/api-keys.ts`).
- Custom LLM providers: `custom_providers` table (created in `packages/db/migrations/028_custom_providers.sql`) managed via admin routes (`apps/server/src/routes/admin/custom-providers.ts`) and used by the chat provider registry (`getCustomChatProvider()` in `apps/server/src/services/chat-providers/index.ts`).

Any object storage usage
- Local filesystem storage under `STORAGE_PATH`/`./storage` (upload route uses `const STORAGE_PATH = process.env.STORAGE_PATH || './storage'` in `apps/server/src/routes/ingest.ts`; helper functions in `apps/server/src/agent/utils/storage.ts`). No S3/GCS integration was observed in the inspected code paths.

## 4) Ingestion & Chunking

Supported ingestion sources and file types
- Manual file upload: multipart upload endpoint (`POST /api/ingest` in `apps/server/src/routes/ingest.ts`).
- Repo ingestion: git clone/pull + incremental sync (`syncRepository()` in `apps/server/src/services/repo-ingestion.ts`, triggered by `POST /api/repos/:id/sync` in `apps/server/src/routes/repos.ts`).
- Web ingestion agent: topic search + scrape + ingest (`startIngestionJob()`/`processJob()` in `apps/server/src/ingestion-agent/worker.ts`, triggered by `POST /api/ingestion-agent/start` in `apps/server/src/routes/agent-ingestion.ts`).
- Extracted file types:
  - PDF (`extractPDF()` in `apps/server/src/pipeline/extract.ts`) with optional Vision OCR fallback (`extractTextWithVision()` in `apps/server/src/pipeline/vision-ocr.ts`, triggered within `extractPDF()` when `isVisionOCREnabled()` is true).
  - DOCX (`extractDOCX()` in `apps/server/src/pipeline/extract.ts`).
  - Markdown (`extractMarkdown()` in `apps/server/src/pipeline/extract.ts`).
  - Plain text fallback (`extractPlainText()` in `apps/server/src/pipeline/extract.ts`).

How chunking works (including AST chunking)
- Plain text chunking:
  - `chunkText()` in `apps/server/src/pipeline/chunk.ts` splits into overlapping character-based chunks, preferring paragraph breaks and sentence boundaries (via sentence splitter helpers in `apps/server/src/pipeline/sentence-splitter.ts`).
  - It sets `metadata.startOffset`/`endOffset` and infers `metadata.chunk_type` (via `inferChunkType()` in `apps/server/src/services/metadata-validator.ts`, called by `chunkText()`).
- Code-aware chunking:
  - `chunkCodeFile()` in `apps/server/src/pipeline/code-chunker.ts` routes by extension and calls language-specific parsers (e.g., `parseDartFile()` from `apps/server/src/pipeline/dart-analyzer.ts`, `parseTypeScriptFile()` from `apps/server/src/pipeline/ts-analyzer.ts`, etc.).
  - It emits chunks with metadata such as `file_path`, `language`, and `line_range` (see `ChunkMetadata` objects built in `chunkDartCode()` and similar functions in `apps/server/src/pipeline/code-chunker.ts`).
  - Optional hierarchical chunking for large classes is supported (`chunkClassHierarchically()` in `apps/server/src/pipeline/hierarchical-chunker.ts`, called from the Dart chunking path).
  - Optional relationship tracking can be enabled (`trackRelationships` option leading to `buildFileRelationships()` usage; declared in `CodeChunkOptions` in `apps/server/src/pipeline/code-chunker.ts` and backed by the `file_relationships` table in `packages/db/migrations/006_file_relationships.sql`).

Chunk identity strategy (stable IDs? hashing? versioning?)
- DB identity:
  - `chunks.id` is a DB-generated `BIGSERIAL` primary key (`packages/db/migrations/001_initial_schema.sql`).
  - `(doc_id, chunk_index)` is unique (`UNIQUE(doc_id, chunk_index)` in `packages/db/migrations/001_initial_schema.sql`).
- Ingestion behavior:
  - `storeChunks()` deletes existing chunks for the document then re-upserts all chunks with their (recomputed) `chunk_index` (`deleteDocumentChunks()` then `upsertChunk()` in `apps/server/src/pipeline/store.ts`), so chunk indices are not stable across re-ingestion if chunk counts change.
- Oversized-chunk splitting:
  - When token splitting occurs, split chunks include `metadata.parent_chunk_id`, `split_index`, `total_splits`, and a stable `metadata.original_chunk_id` to represent the original unsplit chunk group (`splitOversizedChunk()` in `apps/server/src/pipeline/chunk-splitter.ts`).

Metadata stored per chunk (path, symbol, language, etc.)
- Plain text chunks include offsets and inferred chunk type (`chunkText()` in `apps/server/src/pipeline/chunk.ts`).
- Code chunks include file path + language + line ranges and optionally symbol/class/function names, imports, etc. depending on language analyzer (`apps/server/src/pipeline/code-chunker.ts`).
- Stored as JSONB in `chunks.metadata` (`packages/db/migrations/001_initial_schema.sql`).

## 5) Retrieval System

Retrieval modes and how to call them

Vector search
- API surface: `POST /api/search` (`apps/server/src/routes/search.ts`) with `search_mode: "vector"` (or default via env/config); vector implementation is `searchCollection()` in `apps/server/src/services/vector.ts`.
- Inputs:
  - Required: `query`, `collection_id` (`SearchBodySchema` in `apps/server/src/routes/search.ts`).
  - Optional: `top_k`, `min_similarity`, filters (`tech_stack`, `feature_tags`, `platform`, `usage_tier`, `source_quality`), MMR (`mmr_enabled`, `mmr_lambda`), related-files (`include_related_files`), intent controls (`auto_intent`, `intent`), graph expansion flags (`expand_with_graph`, `graph_max_depth`, `graph_max_nodes`).
- Outputs: list of chunk hits with `similarity`, chunk metadata, doc_id/title/source_url (`SearchRouteResponse` in `apps/server/src/routes/search.ts`; response mapping in `mapToRouteResponse()`).
- Ranking: SQL `ORDER BY ch.embedding <=> $1::vector` and similarity computed as `(1 - (ch.embedding <=> $1::vector))` (`searchCollection()` in `apps/server/src/services/vector.ts`).

BM25 / keyword search
- Internal API surface: `bm25SearchWithMetadata()` (`apps/server/src/services/bm25.ts`), used by hybrid search (`apps/server/src/services/hybrid.ts`).
- Query typing: `detectQueryType()` and `buildSmartTsQuery()` select between `websearch_to_tsquery`, `to_tsquery`, and `phraseto_tsquery` based on query patterns (`apps/server/src/services/bm25.ts`).
- Persistence prerequisites: FTS indexes on `chunks.text` (`packages/db/migrations/004_hybrid_search.sql` adds `chunks_text_tsv_idx` and `chunks_text_trgm_idx`).

Hybrid fusion (RRF)
- Internal API surface: `hybridSearch()` (`apps/server/src/services/hybrid.ts`), used when `smartSearch()` chooses hybrid mode (`apps/server/src/services/search.ts`).
- Fusion: Reciprocal Rank Fusion in `fuseResults()` (`apps/server/src/services/hybrid.ts`) combining vector rank and BM25 rank with configurable weights and `rrfK`.
- Diagnostics: `HybridDiagnostics` computed and mapped to API `SearchDiagnostics` (`computeDiagnostics()`/`mapDiagnostics()` in `apps/server/src/services/hybrid.ts` and `apps/server/src/services/search.ts`), surfaced via `/api/search` response `metadata.diagnostics` (`apps/server/src/routes/search.ts`).

Graph traversal / graph retrieval
- API surface: `POST /api/graph/context` (`apps/server/src/routes/graph.ts`) which calls `graphSearch()` (`apps/server/src/services/graph-search.ts`).
- Inputs: `collection_id` plus one seed mechanism: `seed_chunk_ids`, `seed_node_ids`, or `query` (`GraphContextSchema` in `apps/server/src/routes/graph.ts`).
- Outputs: nodes, edges, and associated chunks with hop distance (`GraphContextResult` in `apps/server/src/services/graph-search.ts`).
- Integration into `/api/search`: optional expansion step `expandWithGraphContext()` in `apps/server/src/services/search.ts` uses top-N search hits as seed chunk IDs.

Reranking models
- Internal API surface: `rerankResults()` (`apps/server/src/services/reranker.ts`), invoked from `smartSearch()` when reranking requested or intent config requires it (`apps/server/src/services/search.ts` and `apps/server/src/services/query-intent.ts`).
- Providers supported: `bge` (local via `@xenova/transformers`), `cohere`, `voyage`, `none` (`RerankerProvider` in `apps/server/src/services/reranker.ts`).

How results are merged, deduped, ranked
- Hybrid merging: `fuseResults()` merges by chunk ID and labels source as `vector`, `bm25`, or `both` (`apps/server/src/services/hybrid.ts`).
- Graph expansion dedupe: `expandWithGraphContext()` removes graph-derived chunks whose IDs already exist in results (`existingChunkIds` set in `apps/server/src/services/search.ts`).
- MMR diversification: after fetching more candidates, `applyMMR()` selects a diversified top-K (`apps/server/src/services/mmr.ts`, invoked from `smartSearch()` in `apps/server/src/services/search.ts`).
- Caching: `/api/search` cache key includes query + filters + knobs and stores responses in LRU + optional Redis (`createSearchCacheKey()` in `apps/server/src/services/cache/search-cache.ts`; used in `apps/server/src/routes/search.ts`).

## 6) Model Routing / Multi-LLM Support

Providers supported (OpenAI, Anthropic, Gemini, local)
- Chat/LLM providers are abstracted behind `ChatProvider` factories and a registry (`getChatProvider()` and `getConfiguredChatProviderWithOverride()` in `apps/server/src/services/chat-providers/index.ts`).
- Built-in providers present in code: Anthropic, OpenAI, Google, Ollama, Zhipu, Moonshot (`apps/server/src/services/chat-providers/*` and `CHAT_PROVIDERS` list in `apps/web/src/components/ChatModelSelector.tsx`).
- Custom OpenAI-compatible providers supported via `custom:uuid` (`getCustomChatProvider()` in `apps/server/src/services/chat-providers/index.ts`) and managed in UI/admin routes (`apps/server/src/routes/admin/custom-providers.ts`, `apps/web/src/pages/settings/ModelsPage.tsx`).
- Embedding providers supported by the embedding router: `ollama`, `openai`, `voyage`, `cohere`, `google` (`EmbeddingProvider` in `apps/server/src/services/embedding-router.ts`).

How model selection is configured (per-chat, per-collection, per-task)
- Global defaults and feature-specific configs:
  - `ModelConfigService` resolves config with precedence env → DB → default (`ModelConfigService.resolveConfig()` in `apps/server/src/services/model-config-service.ts`).
  - DB table `model_configs` defines per-feature provider/model (`packages/db/migrations/018_model_configs.sql`).
  - Admin APIs to manage these configs: `apps/server/src/routes/admin/models.ts`; UI: `apps/web/src/pages/settings/ModelsPage.tsx`.
- Per-chat model overrides:
  - Stored on `chat_sessions.provider`/`chat_sessions.model` (`packages/db/migrations/025_chat_session_models.sql`).
  - Used by `resolveChatModel()` (`apps/server/src/routes/agent.ts`) and updated via `PATCH /api/chats/:id/model` (`apps/server/src/routes/chat.ts`).
  - UI uses `ChatModelSelector` (`apps/web/src/components/ChatModelSelector.tsx`) to persist overrides.
- Per-collection embedding profiles:
  - `embedding_profiles` + `collections.embedding_profile_id` (`packages/db/migrations/019_embedding_profiles.sql`).
  - Applied during ingestion (`getProfileForCollection()` used in `ingestDocument()` in `apps/server/src/pipeline/orchestrator.ts`).
- Per-task/workflow:
  - Workflows have `task_context` and can be linked to sessions (`workflow_instances.session_id` in `packages/db/migrations/015_agent_workflows.sql`), but there is no explicit “model per workflow step” field observed.

Any tool calling / function calling support
- The agent chat orchestrator builds tool definitions and passes them to providers that support tools (`buildChatTools()` and tool wiring in `runAgentChat()` in `apps/server/src/agent/agent.ts`).
- Dynamic tool enable/disable exists at the server level (`DynamicToolRegistry` in `apps/server/src/services/tool-registry.ts`).
- External MCP servers are configurable and can be attached to the Anthropic SDK as stdio servers (`McpClientManager.getEnabledMcpServersForSdk()` in `apps/server/src/services/mcp-client.ts`; CRUD routes in `apps/server/src/routes/admin/mcp-servers.ts` backed by `mcp_server_configs` migration `packages/db/migrations/035_mcp_server_configs.sql`).

Safety limits, retries, circuit breakers
- Embedding generation includes retry/backoff (`RETRY_DELAYS` and wrapper logic in `apps/server/src/pipeline/embed.ts`) and provider health tracking (`providerHealthStats` in `apps/server/src/pipeline/embed.ts`).
- Search caching reduces repeated load (`apps/server/src/services/cache/search-cache.ts`).
- API key presence is validated for chat providers before use (`provider.isConfigured()` checks in `getConfiguredChatProviderWithOverride()` in `apps/server/src/services/chat-providers/index.ts`).
- No general-purpose job queue/circuit-breaker framework was observed; long-running tasks are “fire-and-forget” async promises.

Token/cost accounting (if present)
- Cost tracking tables exist (`api_usage`, `budget_alerts` in `packages/db/migrations/003_cost_tracking.sql`) and server routes expose summaries (`/api/costs/*` in `apps/server/src/routes/costs.ts`).
- Reranker cost uses `getCostTracker()` integration (`apps/server/src/services/reranker.ts`).
- Contradiction detection tracks cost using Anthropic token counts (`trackContradictionCost()` called from `detectContradictions()` in `apps/server/src/services/contradiction-detection.ts`).

## 7) Contradiction Detection & Synthesis

Document synthesis workflow
- API surface: `POST /api/synthesis/compare` (`apps/server/src/routes/synthesis.ts`), gated behind `ENABLE_SYNTHESIS` (`synthesisEnabled()` in same file).
- Flow:
  - Runs `smartSearch()` in hybrid + rerank mode (`apps/server/src/routes/synthesis.ts`).
  - Clusters top results into “approaches” using embeddings (`synthesizeResults()` in `apps/server/src/services/synthesis.ts` → `generateEmbeddings()` uses `embedBatch()`).
  - Builds per-approach summaries and consensus scores (helpers inside `apps/server/src/services/synthesis.ts`).

Contradiction detection pipeline
- Implemented by `detectContradictions()` (`apps/server/src/services/contradiction-detection.ts`), gated by `ENABLE_CONTRADICTION_DETECTION` (`isDetectionEnabled()`).
- Uses Anthropic Messages API (`client.messages.create` in `analyzePair()` in `apps/server/src/services/contradiction-detection.ts`) with a “strict JSON” response contract.

Where outputs are stored/returned
- Synthesis results are returned directly from `/api/synthesis/compare` (`apps/server/src/routes/synthesis.ts`).
- No dedicated persistence for synthesis outputs was observed; storing synthesis as artifacts would require new tables or reusing workflow fields (e.g., `workflow_instances.findings/final_output`).

## 8) UI & Operator Controls

Localhost UI surface
- Client-side routing is defined in `apps/web/src/App.tsx`:
  - `/` collections dashboard
  - `/collections/:id` collection view
  - `/upload/:id` upload
  - `/search/:collectionId` search
  - `/chat/:collectionId` chat + synthesis view
  - `/workflows/:collectionId` workflows
  - `/graph` knowledge graph debug
  - `/settings/models` model/provider configuration
  - `/costs` cost dashboard

What can be configured
- Model configs and provider selection (`apps/web/src/pages/settings/ModelsPage.tsx` + `/api/admin/models` in `apps/server/src/routes/admin/models.ts`).
- API keys (`ApiKeyManager` used in `apps/web/src/pages/settings/ModelsPage.tsx` + `/api/admin/api-keys` in `apps/server/src/routes/admin/api-keys.ts`).
- Embedding profiles and default embedding profile selection (`EmbeddingProfileSelect` usage in `apps/web/src/pages/settings/ModelsPage.tsx`; DB migration `packages/db/migrations/019_embedding_profiles.sql` and system setting `packages/db/migrations/027_system_settings.sql`).
- Custom providers and model curation (starred models, tool support flags) (`CustomProviderForm`/`ModelCurationModal` in `apps/web/src/pages/settings/ModelsPage.tsx`; server routes in `apps/server/src/routes/admin/custom-providers.ts`).
- MCP server configs (`McpServerModal` in `apps/web/src/pages/settings/ModelsPage.tsx`; server routes in `apps/server/src/routes/admin/mcp-servers.ts`).
- Per-chat provider/model override in chat UI (`ChatModelSelector` in `apps/web/src/components/ChatModelSelector.tsx` and `PATCH /api/chats/:id/model` in `apps/server/src/routes/chat.ts`).
- Collection-level MMR defaults and toolpack configuration (`apps/web/src/pages/CollectionView.tsx` calling collection endpoints; server routes in `apps/server/src/routes/collections.ts` and toolpack endpoints via `getCollectionToolpacks()`/`updateCollectionToolpacks()` from `@synthesis/db` used in `apps/server/src/routes/collections.ts`).

What entities exist in UI
- Collections (`apps/web/src/pages/Dashboard.tsx`, `apps/web/src/pages/CollectionView.tsx`).
- Documents and chunks (document list in `apps/web/src/pages/CollectionView.tsx`; chunk editor in `apps/web/src/pages/DocumentEditorPage.tsx` calling `/api/documents/:id/chunks` and `/api/documents/:id/chunks/:chunkIndex`).
- Chat sessions/messages (chat UI in `apps/web/src/pages/ChatPage.tsx` calling `/api/chats/*` and `/api/agent/chat`).
- Search results + filters (search UI in `apps/web/src/pages/SearchPage.tsx`, integrating intent override + MMR toggles + feature filters).
- Workflows and templates (workflows UI in `apps/web/src/pages/WorkflowsPage.tsx` calling `/api/workflows/*`).
- Knowledge graph debug (graph UI in `apps/web/src/pages/GraphDebugPage.tsx` calling `/api/graph/*`).
- Cost monitoring (cost dashboard in `apps/web/src/pages/CostDashboard.tsx` calling `/api/costs/*`).

Export/import capabilities
- No explicit collection export/import endpoints or UI actions were observed in the inspected code (Open Question: whether “export knowledge base” exists elsewhere).

Observability shown (logs, costs, traces)
- Costs are shown in UI (`apps/web/src/pages/CostDashboard.tsx`) backed by server cost routes (`apps/server/src/routes/costs.ts`) and DB cost tables (`packages/db/migrations/003_cost_tracking.sql`).
- A Prometheus metrics endpoint exists (`GET /metrics` via `registerMetricsRoute()` in `apps/server/src/services/metrics.ts`), but no dedicated UI for metrics was observed.
- Server logs use Fastify logger (`apps/server/src/index.ts`) and write to stdout; repo includes `apps/server/logs/` but log routing specifics are not enforced in code.

## 9) Job Orchestration & Scaling

Is there a job queue / workers?
- No external job queue library was observed. Long-running operations are handled via background async promises started from HTTP handlers:
  - Repo sync returns 202 and continues in background (`apps/server/src/routes/repos.ts` triggers `syncRepository()` without awaiting).
  - Ingestion agent starts a job and processes URLs in a loop (`startIngestionJob()`/`processJob()` in `apps/server/src/ingestion-agent/worker.ts`).
  - Stale-check job can be started in background (`POST /api/documents/stale-check` in `apps/server/src/routes/documents.ts` starts `runStaleCheckJob()` without awaiting).

Concurrency model
- Ingestion chunk storage is parallelized with bounded concurrency (`storeChunks()` uses worker pool with `DEFAULT_MAX_CONCURRENT_UPSERTS` in `apps/server/src/pipeline/store.ts`).
- Embedding batching exists (`DEFAULT_BATCH_SIZE` in `apps/server/src/pipeline/embed.ts`) and includes retries/backoff.
- Repo sync processes file changes in batches with `Promise.all` over chunks of files (see loop and `Promise.all` in `syncRepository()` in `apps/server/src/services/repo-ingestion.ts`).
- Search can hit Redis/memory caches and uses single SQL queries per retrieval mode; hybrid mode runs vector+BM25 in parallel (`Promise.all` in `hybridSearch()` in `apps/server/src/services/hybrid.ts`).

Timeouts and backpressure
- Upload route streams to disk to avoid memory blowups (`pipeline(part.file, createWriteStream(tempPath))` in `apps/server/src/routes/ingest.ts`).
- Stale-check job has per-request timeouts and per-host rate limiting (`fetchWithTimeout()` and `waitForRateLimit()` in `apps/server/src/services/stale-check-job.ts`).
- No explicit “global backpressure” mechanism (e.g., queue depth limits) was observed beyond per-operation concurrency caps and provider-level limits.

How it would scale for large repos
- Strengths:
  - Repo sync is incremental via commit diff (`getChangedFiles()` in `apps/server/src/services/repo-ingestion.ts`).
  - Chunk upserts are concurrency-limited (`apps/server/src/pipeline/store.ts`).
  - Retrieval is database-native (pgvector + FTS) and indexed (`chunks_embedding_hnsw` in `packages/db/migrations/001_initial_schema.sql`; FTS indexes in `packages/db/migrations/004_hybrid_search.sql`).
- Constraints / likely bottlenecks:
  - The system stores one embedding vector per chunk in a single `VECTOR(768)` column; large repos will create very large `chunks` tables.
  - No dedicated worker queue means ingestion throughput is limited by the API server process.
  - Embedding dimension mismatch risk can force rework of schema/config before scaling across multiple embedding providers/models.

## 10) Integration Fit for DocPack Generator

### 10.1) Can it support “Codebase → Intermediate Representation (IR) → Doc Pack”?

What’s already there that supports this
- Codebase ingestion:
  - Repo clone + incremental sync (`syncRepository()` in `apps/server/src/services/repo-ingestion.ts`).
  - Code-aware chunking that extracts structured metadata for symbols/classes/functions (e.g., `chunkCodeFile()` in `apps/server/src/pipeline/code-chunker.ts` and language analyzers under `apps/server/src/pipeline/*-analyzer.ts`).
- Retrieval primitives:
  - Hybrid + intent-aware search for robust evidence retrieval (`smartSearch()` in `apps/server/src/services/search.ts`, `analyzeQuery()` and intent configs in `apps/server/src/services/query-intent.ts`).
  - Graph builder/retrieval for context expansion (tables `knowledge_nodes`/`knowledge_edges` in `packages/db/migrations/0024_knowledge_graph.sql`; API `apps/server/src/routes/graph.ts`).
- Workflow/task scaffolding:
  - Workflow instances can store “findings” and “final output” (`workflow_instances.findings` and `workflow_instances.final_output` in `packages/db/migrations/015_agent_workflows.sql`; API in `apps/server/src/routes/workflows.ts`).

What must be added
- An explicit IR schema and generator:
  - A deterministic IR format (e.g., JSON) representing repo structure: files, symbols, call graph, endpoints, data models, dependencies.
  - A pipeline stage that emits IR from code analyzers and stores it as a first-class artifact (new tables or object storage).
- A doc pack compiler:
  - Multi-stage generation that consumes IR + retrieved evidence and produces structured PM documents (PRD, architecture, risks, milestones, etc.).
  - Verification/critic loops and consistent citation/evidence output format.

### 10.2) Evidence Tracking Support

Can it store file+symbol+line-range evidence pointers?
- Partially, via chunk metadata:
  - Code chunk metadata includes `file_path` and `line_range` in several language chunkers (e.g., Dart function metadata in `chunkDartCode()` inside `apps/server/src/pipeline/code-chunker.ts`).
  - Chunk offsets (`startOffset`/`endOffset`) exist for plain chunks (`chunkText()` in `apps/server/src/pipeline/chunk.ts`) and for some code analyzers.
- Knowledge graph nodes can link to documents and specific chunks (`knowledge_nodes.document_id` and `knowledge_nodes.chunk_id` in `packages/db/migrations/0024_knowledge_graph.sql`).

If not, where would that be added?
- Add a dedicated `evidence_pointers` table (or extend `knowledge_nodes` metadata) that stores:
  - collection_id, document_id, chunk_id, file_path, symbol, line_start/line_end, commit hash, content hash, and “evidence type”.
  - This would formalize what is currently “best-effort JSONB metadata” in `chunks.metadata`.

### 10.3) Run Artifacts & Diffing

Can it store run outputs and compare versions?
- There is some versioning for documents:
  - `documents.version`, `source_url_hash`, `last_checked_at` (`packages/db/migrations/010_document_versioning.sql`).
  - Collection/document lifecycle/versioning features exist (`packages/db/migrations/021_collection_versioning.sql`) and server lifecycle operations are implemented in `apps/server/src/services/collection-lifecycle.ts` (used by collection routes).
- For generated doc packs, there is no explicit “run artifact” schema observed. The closest existing structure is `workflow_instances.final_output` and `workflow_instances.findings` (`packages/db/migrations/015_agent_workflows.sql`), but it does not provide structured artifact versioning/diffing or per-run storage.

### 10.4) Suggested Minimal Additions

Smallest set of additions to turn this into a platform for DocPack generation
- Code ingestion adapter: reuse `syncRepository()` + existing analyzers, but add a “DocPack Run” entrypoint that ingests (or references existing ingested code) and triggers a deterministic IR build step.
- IR store format (json): define an `ir_snapshots` table (or file-based store) keyed by collection_id + repo_source_id + commit hash, with schema versioning.
- Doc pack compiler pipeline stages:
  - Stage A: IR build (from analyzers + graph builder).
  - Stage B: Evidence retrieval for each doc section (using `smartSearch()` + graph expansion).
  - Stage C: Draft generation (LLM).
  - Stage D: Verifier/critic stage (LLM + deterministic checks on evidence coverage).
- Verifier/critic stage: add a feature that validates every claim has evidence pointers and detects contradictions/outdatedness (can reuse `detectContradictions()` patterns plus a stricter evidence contract).

## 11) Key File/Module Map

| Area | File path(s) | What it does | Key functions/classes |
|---|---|---|---|
| API server entry | `apps/server/src/index.ts` | Fastify bootstrap, route registration, metrics, scheduler | `fastify.register(...)`, `registerMetricsRoute()`, `startStaleCheckScheduler()` |
| Upload ingestion | `apps/server/src/routes/ingest.ts` | Multipart upload → store → create doc → trigger ingestion | `POST /api/ingest` handler |
| Ingestion orchestrator | `apps/server/src/pipeline/orchestrator.ts` | Extract → chunk → split → embed → store (+ optional graph build, metadata) | `ingestDocument()` |
| Extractors | `apps/server/src/pipeline/extract.ts` | PDF/DOCX/MD/TXT extraction + PDF OCR fallback | `extract()`, `extractPDF()`, `extractDOCX()`, `extractMarkdown()` |
| Chunking | `apps/server/src/pipeline/chunk.ts` | Overlapping text chunking with boundary heuristics | `chunkText()` |
| Token-aware splitting | `apps/server/src/pipeline/chunk-splitter.ts` | Split oversized chunks with parent/child tracking | `validateAndSplitChunks()`, `splitOversizedChunk()` |
| Code chunking | `apps/server/src/pipeline/code-chunker.ts` | AST-based chunking across languages + metadata | `chunkCodeFile()` |
| Embeddings | `apps/server/src/pipeline/embed.ts` | Multi-provider embeddings, retries, caching hooks | `embedText()`, `embedBatch()` |
| Storage (DB) | `apps/server/src/pipeline/store.ts` | Transactional chunk delete + upsert with concurrency | `storeChunks()` |
| Vector search | `apps/server/src/services/vector.ts` | pgvector query with filters | `searchCollection()` |
| BM25 search | `apps/server/src/services/bm25.ts` | Postgres FTS BM25 search with query typing | `bm25SearchWithMetadata()`, `detectQueryType()` |
| Hybrid search | `apps/server/src/services/hybrid.ts` | Parallel vector+BM25 + RRF fusion + diagnostics | `hybridSearch()`, `fuseResults()` |
| Smart search orchestrator | `apps/server/src/services/search.ts` | Mode selection, rerank, MMR, graph expansion, caching integration | `smartSearch()` |
| Reranker | `apps/server/src/services/reranker.ts` | Rerank with Cohere/Voyage/BGE, cache results | `rerankResults()` |
| Knowledge graph | `apps/server/src/services/graph-builder.ts`, `apps/server/src/services/graph-search.ts`, `apps/server/src/routes/graph.ts` | Build graph and retrieve BFS context | `buildGraphForCollection()`, `graphSearch()`, `POST /api/graph/context` |
| Synthesis | `apps/server/src/services/synthesis.ts`, `apps/server/src/routes/synthesis.ts` | Cluster sources into approaches and detect conflicts | `synthesizeResults()`, `POST /api/synthesis/compare` |
| Contradiction detection | `apps/server/src/services/contradiction-detection.ts` | LLM-based contradiction detection | `detectContradictions()` |
| Model config | `apps/server/src/services/model-config-service.ts`, `apps/server/src/routes/admin/models.ts` | Feature-level provider/model selection | `ModelConfigService`, `GET/PUT /api/admin/models/:feature` |
| API keys | `apps/server/src/services/api-key-service.ts`, `apps/server/src/routes/admin/api-keys.ts` | Encrypted API key storage + testing | `ApiKeyService` |
| Repo ingestion | `apps/server/src/services/repo-ingestion.ts`, `apps/server/src/routes/repos.ts` | Clone/pull + incremental sync + ingestion trigger | `syncRepository()`, `POST /api/repos/:id/sync` |
| Ingestion agent | `apps/server/src/ingestion-agent/worker.ts`, `apps/server/src/routes/agent-ingestion.ts` | Topic-based web scrape ingestion | `startIngestionJob()`, `processJob()` |
| UI routing | `apps/web/src/App.tsx` | UI route map | `Routes` |
| UI: Search | `apps/web/src/pages/SearchPage.tsx` | Search controls (intent/MMR/filters) | React component `SearchPage` |
| UI: Chat | `apps/web/src/pages/ChatPage.tsx` | Chat sessions + model selector + synthesis tab | React component `ChatPage`, `ChatModelSelector` |
| UI: Settings | `apps/web/src/pages/settings/ModelsPage.tsx` | Model/provider/API key/MCP/custom provider management | React component `ModelsPage` |

## 12) Open Questions / Risks

- Embedding dimension mismatch risk: DB schema fixes `chunks.embedding VECTOR(768)` (`packages/db/migrations/001_initial_schema.sql`), while default embedding configs include 1024/1536-d models (`MODEL_DIMENSIONS` in `apps/server/src/services/embedding-router.ts`). Confirm what production configuration uses and whether a migration exists/should exist to support multiple dimensions (or separate per-model vector columns).
- Evidence pointer completeness: code chunkers emit `file_path` and `line_range` for some languages, but not all chunk types guarantee symbol+line metadata. For DocPack generation, determine a required evidence schema and enforce it at ingestion time.
- Workflow execution engine: workflows exist as persisted templates/instances (`packages/db/migrations/015_agent_workflows.sql` and `apps/server/src/routes/workflows.ts`) but step execution appears to be bookkeeping only; confirm whether there is an uninspected worker that performs actual tool execution per step.
- Export/import: no clear collection export/import endpoints were found in the inspected routes. If DocPack requires portability, add snapshot export for documents/chunks/graph and the new IR/artifacts.
- Security/privacy: ingestion agent scrapes the web (`apps/server/src/ingestion-agent/worker.ts`) and stores content; confirm compliance expectations (robots.txt, PII, licensing). Repo ingestion clones arbitrary URLs (`apps/server/src/services/repo-ingestion.ts`); confirm sandboxing and authentication needs for private repos.
- Scaling: long-running tasks run inside the API process; for multi-tenant or high-throughput use, a proper job queue/worker pool would be needed.

## Extra: Quick Commands & How to Run (if applicable)

- Install: `pnpm install` (root `package.json`).
- Start infra (DB/Ollama/Redis): `pnpm dev:infra` (root `package.json` script).
- Run migrations: `pnpm dev:migrate` (root `package.json` script → `@synthesis/db` migrate).
- Start server: `pnpm dev:server` (root `package.json` script; server entry `apps/server/src/index.ts`).
- Start web UI: `pnpm dev:web` (root `package.json`; Vite app in `apps/web`).
- Run tests: `pnpm test` (Turbo), or per-package (`pnpm --filter @synthesis/server test`, `pnpm --filter @synthesis/web test`).

Ready for ChatGPT review: YES

