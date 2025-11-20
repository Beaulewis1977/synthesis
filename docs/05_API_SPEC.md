# Backend API Specification
**Version:** 2.0
**Last Updated:** November 13, 2025

---

## 🎯 API Design Principles

1. **RESTful** where it makes sense
2. **JSON** for all requests/responses
3. **Clear error messages** with actionable info
4. **Consistent status codes**
5. **Optional pagination** for large lists

---

## 🌐 Base Configuration

**Base URL:** `http://localhost:3333/api`

**Headers:**
```
Content-Type: application/json
Accept: application/json
```

**Authentication:** None for MVP (local use)

---

## 📋 Endpoints

### Agent

#### POST `/api/agent/chat`
**Purpose:** Chat with the autonomous agent

**Request:**
```json
{
  "message": "Add the Flutter documentation to my collection",
  "collection_id": "uuid",
  "history": [
    { "role": "user", "content": "previous message" },
    { "role": "assistant", "content": "previous response" }
  ]
}
```

**Response:**
```json
{
  "message": "I've started fetching the Flutter documentation...",
  "tool_calls": [
    {
      "tool": "fetch_web_content",
      "input": { "url": "https://docs.flutter.dev", "..." },
      "result": "Successfully processed 50 pages"
    }
  ],
  "history": [/* updated conversation history */]
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid request
- `500` - Server error

---

#### POST `/api/agent/stream`
**Purpose:** Streaming chat responses (SSE)

**Request:** Same as `/chat`

**Response:** Server-Sent Events stream
```
data: {"type": "thinking", "content": "Analyzing your request..."}

data: {"type": "tool_call", "tool": "search_rag", "status": "started"}

data: {"type": "tool_result", "tool": "search_rag", "result": {...}}

data: {"type": "message", "content": "Based on the documentation..."}

data: {"type": "done"}
```

---

### Collections

#### GET `/api/collections`
**Purpose:** List all collections

**Response:**
```json
{
  "collections": [
    {
      "id": "uuid",
      "name": "Flutter Projects",
      "description": "Mobile dev docs",
      "doc_count": 45,
      "created_at": "2025-10-01T10:00:00Z"
    }
  ]
}
```

---

#### POST `/api/collections`
**Purpose:** Create new collection

**Request:**
```json
{
  "name": "New Project",
  "description": "Optional description"
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "New Project",
  "description": "Optional description",
  "created_at": "2025-10-06T14:00:00Z"
}
```

**Status Codes:**
- `201` - Created
- `400` - Invalid input

---

#### GET `/api/collections/:id`
**Purpose:** Get collection details

**Response:**
```json
{
  "id": "uuid",
  "name": "Flutter Projects",
  "description": "...",
  "doc_count": 45,
  "total_chunks": 2300,
  "created_at": "2025-10-01T10:00:00Z",
  "updated_at": "2025-10-06T14:00:00Z"
}
```

---

#### DELETE `/api/collections/:id`
**Purpose:** Delete collection and all its documents

**Response:**
```json
{
  "success": true,
  "message": "Collection and 45 documents deleted"
}
```

**Status Codes:**
- `200` - Deleted
- `404` - Not found

---

### Documents

#### GET `/api/documents?collection_id=uuid`
**Purpose:** List documents in collection

**Query Parameters:**
- `collection_id` (required)
- `status` (optional): `pending`, `complete`, `error`, `all`
- `limit` (optional, default: 50)
- `offset` (optional, default: 0)

**Response:**
```json
{
  "documents": [
    {
      "id": "uuid",
      "title": "Flutter Widget Basics",
      "content_type": "application/pdf",
      "file_size": 1024000,
      "status": "complete",
      "source_url": "https://docs.flutter.dev/...",
      "chunk_count": 52,
      "created_at": "2025-10-05T10:00:00Z",
      "processed_at": "2025-10-05T10:05:30Z"
    }
  ],
  "total": 45,
  "limit": 50,
  "offset": 0
}
```

---

#### GET `/api/documents/:id`
**Purpose:** Get document details

**Response:**
```json
{
  "id": "uuid",
  "collection_id": "uuid",
  "collection_name": "Flutter Projects",
  "title": "Flutter Widget Basics",
  "content_type": "application/pdf",
  "file_size": 1024000,
  "file_path": "/storage/...",
  "source_url": "https://...",
  "status": "complete",
  "error_message": null,
  "chunk_count": 52,
  "total_tokens": 45000,
  "metadata": {
    "author": "...",
    "date": "..."
  },
  "created_at": "2025-10-05T10:00:00Z",
  "processed_at": "2025-10-05T10:05:30Z"
}
```

---

#### DELETE `/api/documents/:id`
**Purpose:** Delete document

**Response:**
```json
{
  "success": true,
  "message": "Document 'Flutter Widget Basics' deleted"
}
```

---

### Ingestion

#### POST `/api/ingest`
**Purpose:** Upload and process documents

**Request:** `multipart/form-data`
```
collection_id: uuid
files: [File, File, ...]
```

**Response:**
```json
{
  "success": true,
  "documents": [
    {
      "id": "uuid",
      "title": "guide.pdf",
      "status": "pending"
    }
  ],
  "message": "2 documents queued for processing"
}
```

**Status Codes:**
- `202` - Accepted (processing started)
- `400` - Invalid files
- `413` - File too large

---

#### GET `/api/ingest/status/:doc_id`
**Purpose:** Check processing status

**Response:**
```json
{
  "doc_id": "uuid",
  "title": "Flutter Guide",
  "status": "embedding",
  "progress": {
    "current_step": "embedding",
    "chunks_processed": 30,
    "total_chunks": 52,
    "percent": 58
  },
  "error": null,
  "created_at": "2025-10-06T14:00:00Z",
  "estimated_completion": "2025-10-06T14:02:00Z"
}
```

---

### Search

#### POST `/api/search`
**Purpose:** Intelligent search with hybrid mode, re-ranking, and synthesis support

**Request:**
```json
{
  "query": "How to set up authentication",
  "collection_id": "uuid",
  "top_k": 10,
  "min_similarity": 0.5,
  "mode": "hybrid",
  "embedding_provider": "voyage",
  "enable_reranking": true,
  "enable_synthesis": false,
  "tech_stack": ["typescript", "react"]
}
```

**Parameters:**
- `query` (string, required): Search query
- `collection_id` (string, required): UUID of collection to search
- `top_k` (number, optional, default: 10): Number of results to return
- `min_similarity` (number, optional, default: 0.5): Minimum similarity threshold (0-1)
- `mode` (string, optional, default: "vector"): Search mode - "vector", "hybrid", or "bm25"
- `embedding_provider` (string, optional): Override provider - "ollama", "voyage", or "openai"
- `enable_reranking` (boolean, optional, default: false): Re-rank results with Cohere/BGE
- `enable_synthesis` (boolean, optional, default: false): Enable multi-source synthesis
- `tech_stack` (array, optional): Filter by tech stack tags (e.g., ["dart", "flutter"])

**Response:**
```json
{
  "results": [
    {
      "id": "chunk-id",
      "text": "To set up authentication...",
      "similarity": 0.87,
      "rerank_score": 0.92,
      "doc_id": "uuid",
      "doc_title": "Supabase Auth Guide",
      "source_url": "https://...",
      "tech_stack": ["typescript", "node"],
      "citation": {
        "title": "Supabase Auth Guide",
        "page": 12,
        "section": "Setup"
      },
      "metadata": {
        "page": 12,
        "heading": "Setup",
        "embedding_provider": "voyage",
        "trust_score": 0.95
      }
    }
  ],
  "query": "How to set up authentication",
  "total_results": 10,
  "search_time_ms": 456,
  "mode": "hybrid",
  "reranked": true,
  "cost_usd": 0.0024
}
```

---

### Synthesis

#### POST `/api/synthesis/compare`
**Purpose:** Compare multiple documents and detect contradictions

**Request:**
```json
{
  "query": "What is the recommended authentication method?",
  "collection_id": "uuid",
  "document_ids": ["doc-uuid-1", "doc-uuid-2", "doc-uuid-3"],
  "detect_contradictions": true
}
```

**Parameters:**
- `query` (string, required): Question to synthesize across documents
- `collection_id` (string, required): Collection UUID
- `document_ids` (array, optional): Specific documents to compare (if omitted, uses top search results)
- `detect_contradictions` (boolean, optional, default: true): Enable contradiction detection

**Response:**
```json
{
  "query": "What is the recommended authentication method?",
  "synthesis": "The recommended authentication method varies by use case. For web applications, OAuth 2.0 with JWT tokens is preferred (3 sources). Mobile apps should use device-based authentication (2 sources).",
  "consensus_score": 0.78,
  "sources": [
    {
      "doc_id": "uuid-1",
      "doc_title": "Web Auth Guide",
      "snippet": "OAuth 2.0 is the industry standard...",
      "agreement_score": 0.92
    },
    {
      "doc_id": "uuid-2",
      "doc_title": "Mobile Security",
      "snippet": "Device-based authentication provides...",
      "agreement_score": 0.85
    }
  ],
  "contradictions": [
    {
      "topic": "Session duration",
      "conflicting_sources": [
        {
          "doc_id": "uuid-1",
          "claim": "Sessions should last 24 hours",
          "confidence": 0.88
        },
        {
          "doc_id": "uuid-3",
          "claim": "Sessions should expire after 1 hour",
          "confidence": 0.82
        }
      ],
      "severity": "medium"
    }
  ],
  "cost_usd": 0.0156
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid request
- `429` - Budget exceeded (falls back to free synthesis if available)

---

### Related Files

#### GET `/api/documents/:id/related-files`
**Purpose:** Get files related to a document through imports, tests, or sibling relationships

**Query Parameters:**
- `relationship_type` (optional): Filter by type - "import", "test", "sibling", "all" (default)
- `depth` (number, optional, default: 1): Relationship depth (1-3)

**Response:**
```json
{
  "document_id": "uuid",
  "document_title": "auth_service.dart",
  "relationships": {
    "imports": [
      {
        "doc_id": "uuid-2",
        "doc_title": "user_model.dart",
        "relationship_type": "import",
        "confidence": 0.95,
        "metadata": {
          "import_path": "../models/user_model.dart",
          "line_number": 3
        }
      }
    ],
    "imported_by": [
      {
        "doc_id": "uuid-3",
        "doc_title": "login_page.dart",
        "relationship_type": "imported_by",
        "confidence": 0.95
      }
    ],
    "tests": [
      {
        "doc_id": "uuid-4",
        "doc_title": "auth_service_test.dart",
        "relationship_type": "test",
        "confidence": 0.98,
        "metadata": {
          "test_type": "unit"
        }
      }
    ],
    "siblings": [
      {
        "doc_id": "uuid-5",
        "doc_title": "token_service.dart",
        "relationship_type": "sibling",
        "confidence": 0.75,
        "metadata": {
          "shared_directory": "services/"
        }
      }
    ]
  },
  "total_relationships": 12
}
```

**Status Codes:**
- `200` - Success
- `404` - Document not found

---

### Cost Tracking

#### GET `/api/costs/summary`
**Purpose:** Get cost summary and budget status

**Query Parameters:**
- `period` (optional): "daily", "weekly", "monthly" (default), "all"
- `provider` (optional): Filter by provider - "voyage", "cohere", "openai", "all" (default)

**Response:**
```json
{
  "period": "monthly",
  "current_month": "2025-11",
  "total_cost_usd": 8.47,
  "budget_limit_usd": 10.00,
  "budget_remaining_usd": 1.53,
  "budget_used_percent": 84.7,
  "alert_threshold": 0.8,
  "alert_triggered": true,
  "by_provider": {
    "voyage": {
      "cost_usd": 3.24,
      "requests": 2743,
      "tokens": 2700000
    },
    "cohere": {
      "cost_usd": 4.56,
      "requests": 2280
    },
    "openai": {
      "cost_usd": 0.67,
      "requests": 543,
      "tokens": 515000
    }
  },
  "by_operation": {
    "embedding": 3.91,
    "reranking": 4.56,
    "synthesis": 0.00
  },
  "daily_breakdown": [
    {
      "date": "2025-11-13",
      "cost_usd": 1.23,
      "requests": 456
    }
  ]
}
```

**Status Codes:**
- `200` - Success

---

#### GET `/api/costs/alerts`
**Purpose:** Get active cost alerts

**Response:**
```json
{
  "alerts": [
    {
      "id": "alert-uuid",
      "type": "budget_threshold",
      "severity": "warning",
      "message": "Monthly budget at 84.7% (threshold: 80%)",
      "triggered_at": "2025-11-13T08:23:15Z",
      "current_cost_usd": 8.47,
      "budget_limit_usd": 10.00,
      "actions_taken": [
        "Disabled Cohere re-ranking (using free BGE fallback)",
        "Switched to Ollama embeddings for non-code documents"
      ]
    }
  ],
  "has_active_alerts": true,
  "budget_exceeded": false
}
```

**Status Codes:**
- `200` - Success

---

## 🔍 Error Responses

**Standard Error Format:**
```json
{
  "error": "Invalid collection_id",
  "code": "INVALID_COLLECTION",
  "details": {
    "field": "collection_id",
    "value": "not-a-uuid"
  },
  "timestamp": "2025-10-06T14:00:00Z"
}
```

**Error Codes:**

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_INPUT` | 400 | Request validation failed |
| `COLLECTION_NOT_FOUND` | 404 | Collection doesn't exist |
| `DOCUMENT_NOT_FOUND` | 404 | Document doesn't exist |
| `FILE_TOO_LARGE` | 413 | File exceeds size limit |
| `UNSUPPORTED_TYPE` | 400 | File type not supported |
| `PROCESSING_ERROR` | 500 | Document processing failed |
| `EMBEDDING_ERROR` | 500 | Embedding service failed |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `RERANKING_ERROR` | 500 | Re-ranking service failed |
| `SYNTHESIS_ERROR` | 500 | Synthesis generation failed |
| `BUDGET_EXCEEDED` | 429 | Monthly budget limit reached |
| `PROVIDER_UNAVAILABLE` | 503 | External provider unavailable |
| `INVALID_TECH_STACK` | 400 | Invalid tech stack filter |
| `RELATIONSHIP_NOT_FOUND` | 404 | No relationships found |

---

## 📊 Rate Limiting (Future)

**Not implemented in MVP**, but designed for:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1696608000
```

---

## 🔒 Security

### CORS
```typescript
// Development
cors({ origin: 'http://localhost:5173' })

// Production
cors({ origin: process.env.WEB_URL })
```

### File Upload Limits
```typescript
{
  limits: {
    fileSize: 50 * 1024 * 1024,  // 50 MB
    files: 10  // Max 10 files per request
  }
}
```

### Allowed MIME Types
```typescript
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
  'text/plain',
];
```

---

## 📝 Request Validation (Zod)

**Example Schema:**
```typescript
// apps/server/src/schemas/agent.ts
import { z } from 'zod';

export const AgentChatRequestSchema = z.object({
  message: z.string().min(1).max(5000),
  collection_id: z.string().uuid(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
});

export type AgentChatRequest = z.infer<typeof AgentChatRequestSchema>;
```

**Usage in Route:**
```typescript
app.post('/api/agent/chat', async (request, reply) => {
  const body = AgentChatRequestSchema.parse(request.body);
  // ... handle request
});
```

---

## 🧪 Example cURL Requests

### Create Collection
```bash
curl -X POST http://localhost:3333/api/collections \
  -H "Content-Type: application/json" \
  -d '{"name": "My Project", "description": "Documentation for my app"}'
```

### Upload Document
```bash
curl -X POST http://localhost:3333/api/ingest \
  -F "collection_id=uuid-here" \
  -F "files=@/path/to/doc.pdf"
```

### Chat with Agent
```bash
curl -X POST http://localhost:3333/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I handle authentication?",
    "collection_id": "uuid-here"
  }'
```

### Search (Vector Only)
```bash
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "authentication setup",
    "collection_id": "uuid-here",
    "top_k": 5
  }'
```

### Search (Hybrid with Re-ranking)
```bash
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "authentication setup",
    "collection_id": "uuid-here",
    "top_k": 10,
    "mode": "hybrid",
    "enable_reranking": true,
    "embedding_provider": "voyage",
    "tech_stack": ["typescript", "node"]
  }'
```

### Synthesize Documents
```bash
curl -X POST http://localhost:3333/api/synthesis/compare \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the recommended authentication approach?",
    "collection_id": "uuid-here",
    "detect_contradictions": true
  }'
```

### Get Related Files
```bash
curl http://localhost:3333/api/documents/uuid-here/related-files?relationship_type=all&depth=1
```

### Get Cost Summary
```bash
curl http://localhost:3333/api/costs/summary?period=monthly&provider=all
```

### Get Cost Alerts
```bash
curl http://localhost:3333/api/costs/alerts
```

---

## 📦 Response Wrappers

### Success Response Helper
```typescript
// apps/server/src/utils/response.ts
export function success<T>(data: T, meta?: object) {
  return {
    ...data,
    ...meta,
    timestamp: new Date().toISOString(),
  };
}
```

### Error Response Helper
```typescript
export function error(
  message: string,
  code: string,
  details?: object
) {
  return {
    error: message,
    code,
    details,
    timestamp: new Date().toISOString(),
  };
}
```

---

## ✅ API Checklist

Before deployment:

- [ ] All endpoints return consistent JSON
- [ ] Error handling on all routes
- [ ] Input validation with Zod
- [ ] CORS configured
- [ ] File upload limits set
- [ ] Status codes correct
- [ ] Documentation matches implementation
- [ ] Example requests tested
- [ ] Error scenarios handled

---

**This API is simple, consistent, and ready for the autonomous agent to use.**
