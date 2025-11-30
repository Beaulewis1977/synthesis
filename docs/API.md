# Synthesis API Documentation

Base URL: `http://localhost:3333`

## Search API

### POST /api/search

Search within a collection using vector, hybrid, or BM25 search with automatic query intent detection and optional MMR diversification.

#### Request Body

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | Yes | - | Search query text (min 1 char) |
| `collection_id` | string (UUID) | Yes | - | Collection to search within |
| `top_k` | number | No | 10 | Max results to return (1-50) |
| `search_mode` | string | No | `"vector"` | `"vector"` or `"hybrid"` |
| `intent` | string | No | auto-detect | Override intent detection (see Intent Types) |
| `mmr_enabled` | boolean | No | `false` | Enable MMR result diversification |
| `mmr_lambda` | number | No | `0.7` | Balance relevance (1.0) vs diversity (0.0) |
| `tech_stack` | string[] | No | - | Filter results by tech stack tags |
| `rerank` | boolean | No | `false` | Enable result reranking |
| `rerank_provider` | string | No | `"none"` | `"cohere"`, `"bge"`, or `"none"` |
| `min_similarity` | number | No | - | Minimum similarity threshold (0-1) |
| `page` | number | No | `1` | Page number for pagination |
| `page_size` | number | No | `10` | Results per page (1-50) |
| `include_related_files` | boolean | No | `false` | Include file relationship data |
| `auto_intent` | boolean | No | `true` | Enable automatic intent detection |

> **Note:** Both snake_case and camelCase parameter names are accepted (e.g., `collection_id` or `collectionId`).

#### Intent Types

The system automatically detects query intent and optimizes search configuration:

| Intent | Description | Search Mode | Vector Weight | BM25 Weight | Rerank |
|--------|-------------|-------------|---------------|-------------|--------|
| `code_symbol` | Code identifiers, function names | hybrid | 0.5 | 0.5 | Yes |
| `natural_language` | Questions, explanations | hybrid | 0.8 | 0.2 | Yes |
| `error_message` | Stack traces, error codes | hybrid | 0.4 | 0.6 | No |
| `api_lookup` | API references, method docs | vector | 1.0 | 0.0 | Yes |
| `conceptual` | "What is...", concept explanations | vector | 1.0 | 0.0 | Yes |
| `comparison` | "X vs Y", trade-off questions | hybrid | 0.9 | 0.1 | Yes |

#### Response

```json
{
  "query": "how to use hooks",
  "results": [
    {
      "id": 123,
      "snippet": "React hooks let you use state...",
      "similarity": 0.87,
      "vector_score": 0.87,
      "bm25_score": null,
      "fused_score": null,
      "source": "vector",
      "doc_id": "550e8400-e29b-41d4-a716-446655440000",
      "doc_title": "React Documentation",
      "source_url": "https://react.dev/hooks",
      "citation": {
        "title": "React Documentation",
        "page": null,
        "section": "Hooks Overview"
      },
      "metadata": { "language": "typescript" }
    }
  ],
  "total_results": 42,
  "search_time_ms": 127,
  "metadata": {
    "search_mode": "hybrid",
    "vector_count": 10,
    "bm25_count": 8,
    "fused_count": 10,
    "embedding_provider": "ollama",
    "reranked": false,
    "pagination": {
      "page": 1,
      "page_size": 10,
      "total_results": 42,
      "total_pages": 5
    },
    "intent": {
      "type": "natural_language",
      "confidence": 0.85,
      "auto_detected": true,
      "signals": ["question_start", "how_pattern"]
    },
    "mmr": {
      "enabled": true,
      "lambda": 0.7,
      "avg_pairwise_similarity": 0.42,
      "duplicates_removed": 2,
      "near_duplicates_filtered": 1
    },
    "diagnostics": {
      "weights": { "vector": 0.8, "bm25": 0.2 },
      "rrf_k": 60,
      "timing": {
        "vector_ms": 45,
        "bm25_ms": 32,
        "fusion_ms": 5,
        "total_ms": 127
      }
    }
  }
}
```

#### Error Responses

**400 Bad Request** - Invalid input:
```json
{
  "error": "INVALID_INPUT",
  "details": [
    { "path": ["query"], "message": "Required" }
  ]
}
```

**500 Internal Server Error** - Search failure:
```json
{
  "error": "SEARCH_ERROR",
  "message": "Failed to execute search"
}
```

#### Examples

**Basic search:**
```bash
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "authentication middleware",
    "collection_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

**Search with MMR diversification:**
```bash
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "database connection",
    "collection_id": "550e8400-e29b-41d4-a716-446655440000",
    "mmr_enabled": true,
    "mmr_lambda": 0.5,
    "top_k": 20
  }'
```

**Search with intent override:**
```bash
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "useState",
    "collection_id": "550e8400-e29b-41d4-a716-446655440000",
    "intent": "code_symbol"
  }'
```

**Hybrid search with tech stack filter:**
```bash
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "how to handle errors",
    "collection_id": "550e8400-e29b-41d4-a716-446655440000",
    "search_mode": "hybrid",
    "tech_stack": ["react", "typescript"]
  }'
```

**Search with reranking:**
```bash
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "best practices for API design",
    "collection_id": "550e8400-e29b-41d4-a716-446655440000",
    "rerank": true,
    "rerank_provider": "cohere"
  }'
```

---

## Collections API

### GET /api/collections

List all collections.

#### Response

```json
{
  "collections": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "React Docs",
      "description": "Official React documentation",
      "created_at": "2025-01-15T10:30:00.000Z",
      "updated_at": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

#### Example

```bash
curl http://localhost:3333/api/collections
```

---

### GET /api/collections/:id

Get collection details by ID.

#### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | Collection ID |

#### Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "React Docs",
  "description": "Official React documentation",
  "created_at": "2025-01-15T10:30:00.000Z",
  "updated_at": "2025-01-15T10:30:00.000Z"
}
```

#### Error Responses

**404 Not Found:**
```json
{
  "error": "Collection not found"
}
```

#### Example

```bash
curl http://localhost:3333/api/collections/550e8400-e29b-41d4-a716-446655440000
```

---

### POST /api/collections

Create a new collection.

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Collection name (1-255 chars) |
| `description` | string | No | Collection description |

#### Response (201 Created)

```json
{
  "collection": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Flutter Docs",
    "description": "Flutter framework documentation",
    "created_at": "2025-01-15T10:30:00.000Z",
    "updated_at": "2025-01-15T10:30:00.000Z"
  }
}
```

#### Example

```bash
curl -X POST http://localhost:3333/api/collections \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Flutter Docs",
    "description": "Flutter framework documentation"
  }'
```

---

### DELETE /api/collections/:id

Delete a collection and all its documents.

#### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | Collection ID |

#### Response

```json
{
  "message": "Collection deleted successfully",
  "collection_id": "550e8400-e29b-41d4-a716-446655440000",
  "collection_name": "Flutter Docs"
}
```

#### Example

```bash
curl -X DELETE http://localhost:3333/api/collections/550e8400-e29b-41d4-a716-446655440000
```

---

### GET /api/collections/:id/documents

List all documents in a collection.

#### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | Collection ID |

#### Response

```json
{
  "documents": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "collection_id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Getting Started",
      "file_path": "/storage/550e8400/660e8400.pdf",
      "status": "complete",
      "metadata": { "pages": 12, "language": "en" },
      "created_at": "2025-01-15T10:30:00.000Z",
      "updated_at": "2025-01-15T10:35:00.000Z"
    }
  ]
}
```

**Document Status Values:**
- `pending` - Queued for processing
- `extracting` - Text extraction in progress
- `chunking` - Splitting into chunks
- `embedding` - Generating embeddings
- `complete` - Ready for search
- `failed` - Processing failed

#### Example

```bash
curl http://localhost:3333/api/collections/550e8400-e29b-41d4-a716-446655440000/documents
```

---

### GET /api/collections/:id/language-stats

Get language support statistics for a collection.

#### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | Collection ID |

#### Response

```json
{
  "languages": [
    {
      "extension": ".ts",
      "fileCount": 45,
      "name": "TypeScript",
      "supported": true,
      "chunkingQuality": "excellent",
      "features": {
        "semanticChunking": true,
        "syntaxAware": true,
        "astParsing": true,
        "testExtraction": true
      }
    },
    {
      "extension": ".py",
      "fileCount": 12,
      "name": "Python",
      "supported": true,
      "chunkingQuality": "good",
      "features": {
        "semanticChunking": true,
        "syntaxAware": true,
        "astParsing": false,
        "testExtraction": true
      }
    }
  ]
}
```

**Chunking Quality Levels:**
- `excellent` - AST parsing with full semantic understanding
- `good` - Syntax-aware chunking with framework detection
- `fair` - Basic regex-based chunking
- `limited` - Generic text chunking only

#### Example

```bash
curl http://localhost:3333/api/collections/550e8400-e29b-41d4-a716-446655440000/language-stats
```

---

## Ingest API

### POST /api/ingest

Upload a document to a collection for processing.

#### Request

Multipart form data with:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Document file (PDF, DOCX, MD, or code files) |
| `collection_id` | string | Yes | Target collection UUID |
| `title` | string | No | Document title (defaults to filename) |

**Supported File Types:**
- PDF (`.pdf`)
- Word Documents (`.docx`)
- Markdown (`.md`)
- Code files (`.ts`, `.js`, `.py`, `.dart`, `.go`, `.rs`, `.java`, `.c`, `.cpp`, `.h`)

**Max File Size:** 100MB

#### Response (201 Created)

```json
{
  "document": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "collection_id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "API Guide.pdf",
    "status": "pending",
    "created_at": "2025-01-15T10:30:00.000Z"
  },
  "message": "Document queued for processing"
}
```

#### Example

```bash
curl -X POST http://localhost:3333/api/ingest \
  -F "file=@/path/to/document.pdf" \
  -F "collection_id=550e8400-e29b-41d4-a716-446655440000" \
  -F "title=API Guide"
```

---

## Health Check

### GET /health

Check API server health.

#### Response

```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

#### Example

```bash
curl http://localhost:3333/health
```

---

## Response Headers

The search endpoint includes caching headers:

| Header | Values | Description |
|--------|--------|-------------|
| `x-cache` | `HIT` or `MISS` | Whether response was served from cache |

---

## Environment Configuration

Key environment variables that affect API behavior:

| Variable | Default | Description |
|----------|---------|-------------|
| `SEARCH_MODE` | `vector` | Default search mode (`vector` or `hybrid`) |
| `MMR_DEFAULT_ENABLED` | `false` | Enable MMR by default |
| `HYBRID_VECTOR_WEIGHT` | `0.7` | Vector weight in hybrid search |
| `HYBRID_BM25_WEIGHT` | `0.3` | BM25 weight in hybrid search |
| `SEARCH_PAGE_SIZE` | `10` | Default page size |
| `ENABLE_TRUST_SCORING` | `false` | Enable source quality scoring |
