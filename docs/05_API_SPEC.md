# Backend API Specification
**Version:** 1.0  
**Last Updated:** October 6, 2025

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
**Purpose:** Vector search (internal use by agent, but also directly accessible)

**Request:**
```json
{
  "query": "How to set up authentication",
  "collection_id": "uuid",
  "top_k": 10,
  "min_similarity": 0.5
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "chunk-id",
      "text": "To set up authentication...",
      "similarity": 0.87,
      "doc_id": "uuid",
      "doc_title": "Supabase Auth Guide",
      "source_url": "https://...",
      "citation": {
        "title": "Supabase Auth Guide",
        "page": 12,
        "section": "Setup"
      },
      "metadata": {
        "page": 12,
        "heading": "Setup"
      }
    }
  ],
  "query": "How to set up authentication",
  "total_results": 10,
  "search_time_ms": 234
}
```

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

### Search
```bash
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "authentication setup",
    "collection_id": "uuid-here",
    "top_k": 5
  }'
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
