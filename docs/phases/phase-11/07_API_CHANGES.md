# Phase 11: API Changes

**New endpoints and parameters for hybrid search**

---

## 🎯 Overview

Phase 11 extends existing APIs with **optional parameters** for hybrid search, multi-provider embeddings, and trust filtering. All changes are **backwards compatible** - existing API calls continue to work without modification.

---

## 🔄 Updated Endpoints

### POST /api/search (Enhanced)

**New optional parameters:**

```typescript
interface SearchRequest {
  // Existing parameters (unchanged)
  query: string;
  collection_id: string;
  top_k?: number; // Default: 10
  
  // NEW: Phase 11 parameters
  search_mode?: 'vector' | 'hybrid'; // Default: 'vector'
  embedding_provider?: 'ollama' | 'openai' | 'voyage'; // Auto-selected
  trust_levels?: ('official' | 'verified' | 'community')[]; // Filter
  min_trust_score?: number; // 0.0 - 1.0
  
  // NEW: Hybrid search weights
  vector_weight?: number; // Default: 0.7
  bm25_weight?: number; // Default: 0.3
}
```

**Enhanced response:**

```typescript
interface SearchResponse {
  results: Array<{
    // Existing fields (unchanged)
    id: string;
    chunk_id: string;
    text: string;
    similarity: number;
    
    // NEW: Phase 11 metadata
    search_method?: 'vector' | 'bm25' | 'hybrid';
    vector_score?: number;
    bm25_score?: number;
    final_score: number;
    
    // NEW: Trust scoring
    source_quality?: 'official' | 'verified' | 'community';
    trust_score?: number;
    
    // NEW: Embedding provider info
    embedding_provider?: string;
    embedding_model?: string;
  }>;
  
  // NEW: Search metadata
  search_metadata: {
    mode: 'vector' | 'hybrid';
    total_candidates: number;
    vector_results: number;
    bm25_results: number;
    latency_ms: number;
  };
}
```

**Example: Basic search (unchanged behavior)**

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Flutter state management",
    "collection_id": "flutter_docs",
    "top_k": 10
  }'

# Response: Same as Phase 7 (vector search)
```

**Example: Hybrid search (new)**

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "StatefulWidget",
    "collection_id": "flutter_docs",
    "search_mode": "hybrid",
    "top_k": 10
  }'

# Response includes both vector and BM25 scores
{
  "results": [
    {
      "id": "doc123",
      "text": "StatefulWidget is a widget that...",
      "vector_score": 0.85,
      "bm25_score": 0.92,
      "final_score": 0.87,
      "source_quality": "official",
      "search_method": "hybrid"
    }
  ],
  "search_metadata": {
    "mode": "hybrid",
    "vector_results": 50,
    "bm25_results": 50,
    "latency_ms": 320
  }
}
```

**Example: Trust filtering (new)**

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "authentication",
    "collection_id": "flutter_docs",
    "trust_levels": ["official", "verified"]
  }'

# Only returns official and verified sources
```

---

## 📤 POST /api/documents/upload (Enhanced)

**New optional metadata:**

```typescript
interface UploadRequest {
  // Existing parameters (unchanged)
  file: File;
  collection_id: string;
  
  // NEW: Phase 11 metadata
  source_quality?: 'official' | 'verified' | 'community';
  framework_version?: string; // e.g., "Flutter 3.24"
  embedding_provider?: 'ollama' | 'openai' | 'voyage';
  
  // NEW: Custom metadata
  custom_metadata?: {
    author?: string;
    publish_date?: string;
    tags?: string[];
  };
}
```

**Example: Upload with trust level**

```bash
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@flutter_guide.pdf" \
  -F "collection_id=flutter_docs" \
  -F "source_quality=official" \
  -F "framework_version=3.24"
```

---

## 🆕 New Endpoints

### GET /api/embeddings/providers

List available embedding providers:

```bash
curl http://localhost:3000/api/embeddings/providers

# Response:
{
  "providers": [
    {
      "name": "ollama",
      "type": "local",
      "models": ["nomic-embed-text"],
      "cost": 0,
      "available": true
    },
    {
      "name": "voyage",
      "type": "api",
      "models": ["voyage-code-2", "voyage-large-2"],
      "cost": 0.0001,
      "available": true,
      "requires_key": true
    },
    {
      "name": "openai",
      "type": "api",
      "models": ["text-embedding-3-small"],
      "cost": 0.00002,
      "available": false,
      "reason": "API key not configured"
    }
  ],
  "default": "ollama"
}
```

### GET /api/collections/:id/stats

Get collection statistics with trust breakdown:

```bash
curl http://localhost:3000/api/collections/flutter_docs/stats

# Response:
{
  "collection_id": "flutter_docs",
  "total_documents": 1250,
  "total_chunks": 15680,
  "embedding_providers": {
    "ollama": 1000,
    "voyage": 250
  },
  "trust_distribution": {
    "official": 450,
    "verified": 300,
    "community": 500
  },
  "average_chunk_size": 650,
  "last_updated": "2024-10-13T10:00:00Z"
}
```

### POST /api/search/compare

Compare vector vs hybrid search side-by-side:

```bash
curl -X POST http://localhost:3000/api/search/compare \
  -H "Content-Type: application/json" \
  -d '{
    "query": "StatefulWidget",
    "collection_id": "flutter_docs",
    "top_k": 5
  }'

# Response:
{
  "vector_results": [...],   // Top 5 from vector search
  "hybrid_results": [...],   // Top 5 from hybrid search
  "comparison": {
    "overlap": 3,            // 3 results in both
    "vector_unique": 2,
    "hybrid_unique": 2,
    "avg_score_diff": 0.12
  }
}
```

---

## 🔧 Configuration Endpoints

### GET /api/config/search

Get current search configuration:

```bash
curl http://localhost:3000/api/config/search

# Response:
{
  "search_mode": "hybrid",
  "vector_weight": 0.7,
  "bm25_weight": 0.3,
  "default_embedding_provider": "ollama",
  "trust_boost_enabled": true,
  "trust_boost_factor": 0.1
}
```

### PUT /api/config/search (Admin only)

Update search configuration:

```bash
curl -X PUT http://localhost:3000/api/config/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer admin-token" \
  -d '{
    "search_mode": "hybrid",
    "vector_weight": 0.8,
    "bm25_weight": 0.2
  }'
```

---

## 🔐 Authentication

No changes to authentication. All Phase 11 endpoints use existing auth:

```bash
# Bearer token (unchanged)
curl -H "Authorization: Bearer your-token-here" \
  http://localhost:3000/api/search

# API key (unchanged)
curl -H "X-API-Key: your-api-key" \
  http://localhost:3000/api/search
```

---

## 🚨 Error Handling

### New Error Codes

```typescript
// 400: Invalid search_mode
{
  "error": "InvalidSearchMode",
  "message": "search_mode must be 'vector' or 'hybrid'",
  "code": 400
}

// 400: Invalid trust_level
{
  "error": "InvalidTrustLevel",
  "message": "trust_levels must be array of: official, verified, community",
  "code": 400
}

// 503: Embedding provider unavailable
{
  "error": "ProviderUnavailable",
  "message": "Voyage API unavailable, falling back to Ollama",
  "code": 503,
  "fallback_used": true
}

// 402: API quota exceeded (if using paid providers)
{
  "error": "QuotaExceeded",
  "message": "Monthly embedding quota exceeded",
  "code": 402,
  "quota_limit": 1000000,
  "quota_used": 1000000
}
```

---

## 📊 Rate Limiting

Phase 11 introduces rate limiting for expensive operations:

```typescript
// Rate limits (per user, per minute)
const rateLimits = {
  'POST /api/search (vector)': 60,      // Unchanged
  'POST /api/search (hybrid)': 40,      // Slower, lower limit
  'POST /api/search/compare': 10,       // Expensive
  'POST /api/documents/upload': 10,     // Unchanged
};

// Response headers
{
  'X-RateLimit-Limit': '40',
  'X-RateLimit-Remaining': '35',
  'X-RateLimit-Reset': '1634123456'
}
```

---

## 🔗 Webhook Updates (Optional)

If webhooks enabled, new events:

```typescript
// Search completed
{
  "event": "search.completed",
  "data": {
    "query": "StatefulWidget",
    "search_mode": "hybrid",
    "results_count": 10,
    "latency_ms": 320,
    "embedding_provider": "ollama"
  }
}

// Document ingested with new metadata
{
  "event": "document.ingested",
  "data": {
    "document_id": "doc123",
    "source_quality": "official",
    "embedding_provider": "voyage",
    "chunks_created": 25
  }
}
```

---

## 📚 SDK Updates

### JavaScript/TypeScript Client

```typescript
// Install updated SDK
npm install @synthesis/client@2.0.0

// Use new parameters
import { SynthesisClient } from '@synthesis/client';

const client = new SynthesisClient({ apiKey: 'your-key' });

// Hybrid search
const results = await client.search({
  query: 'StatefulWidget',
  collectionId: 'flutter_docs',
  searchMode: 'hybrid',
  trustLevels: ['official', 'verified']
});

// Check embedding providers
const providers = await client.getEmbeddingProviders();
```

### Python Client

```python
# Install updated SDK
pip install synthesis-client==2.0.0

from synthesis import Client

client = Client(api_key='your-key')

# Hybrid search
results = client.search(
    query='StatefulWidget',
    collection_id='flutter_docs',
    search_mode='hybrid',
    trust_levels=['official', 'verified']
)

# Compare search modes
comparison = client.compare_search(
    query='StatefulWidget',
    collection_id='flutter_docs'
)
```

---

## 🧪 Testing

### API Test Suite

```bash
# Run Phase 11 API tests
npm run test:api:phase11

# Tests include:
# ✓ Backwards compatibility (existing calls work)
# ✓ Hybrid search returns results
# ✓ Trust filtering works correctly
# ✓ Invalid parameters rejected
# ✓ Fallback to vector if hybrid fails
```

---

## 📖 OpenAPI Spec

Updated OpenAPI 3.0 specification:

```yaml
/api/search:
  post:
    summary: Search documents
    requestBody:
      content:
        application/json:
          schema:
            type: object
            required:
              - query
              - collection_id
            properties:
              query:
                type: string
              collection_id:
                type: string
              search_mode:
                type: string
                enum: [vector, hybrid]
                default: vector
              trust_levels:
                type: array
                items:
                  type: string
                  enum: [official, verified, community]
    responses:
      '200':
        description: Search results
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SearchResponse'
```

Full spec: `docs/api/openapi-phase11.yaml`

---

## ✅ Backwards Compatibility Guarantee

**All Phase 7 API calls work identically in Phase 11:**

```bash
# This Phase 7 call:
curl -X POST /api/search -d '{"query": "test", "collection_id": "id"}'

# Returns the same response in Phase 11 (vector search by default)
```

**No breaking changes!** 🎉

---

## 📈 Performance

**API Latency Targets:**
- Vector search: 250ms (unchanged)
- Hybrid search: 350ms (+100ms acceptable)
- Trust filtering: +10ms overhead
- Multi-provider routing: +50ms overhead

---

## 🚀 Migration Path

1. **Deploy Phase 11** - All existing API calls work
2. **Update clients** - Gradually add new parameters
3. **Enable hybrid search** - Set `search_mode: 'hybrid'`
4. **Monitor performance** - Ensure latency targets met
5. **Add trust filtering** - Improve result quality

---

**API Version:** v2 (backwards compatible with v1)  
**Breaking Changes:** None ✅  
**New Endpoints:** 3  
**Enhanced Endpoints:** 2
