# Synthesis MCP Tool Specifications

This document provides detailed specifications for the mobile-focused MCP tools in the Synthesis RAG system. These tools are designed for AI agents to retrieve contextually relevant documentation with advanced filtering capabilities.

---

## Table of Contents

1. [search_mobile_docs](#tool-1-search_mobile_docs)
2. [find_code_examples](#tool-2-find_code_examples)
3. [get_feature_recipe](#tool-3-get_feature_recipe)
4. [graph_expand_context](#tool-4-graph_expand_context)

---

## Tool 1: search_mobile_docs

### Description

Feature-aware mobile documentation search with optional source quality filtering. Returns documentation chunks filtered by platform, feature tags, framework, and source quality. Supports hybrid search with automatic query intent detection.

### When to Use

- Searching for mobile-specific documentation (Flutter, React Native, Swift, Kotlin)
- Finding platform-specific content (mobile, web, backend, shared)
- Filtering by feature categories (auth, payments, offline, push notifications)
- Restricting results to specific quality tiers (official docs vs community content)
- General documentation lookup with semantic search

### When NOT to Use

- **Looking for code examples** - Use `find_code_examples` instead (biased toward demo/sample content)
- **Finding implementation recipes** - Use `get_feature_recipe` instead (returns curated guides)
- **Expanding context from known chunks** - Use `graph_expand_context` instead
- **General RAG search without mobile focus** - Use `search_rag` instead

### Input Schema

```typescript
const searchMobileDocsInput = z.object({
  collectionId: z
    .string()
    .uuid()
    .describe('The ID of the collection to search'),

  query: z
    .string()
    .min(1)
    .describe('Search query for mobile documentation'),

  featureTags: z
    .array(z.string())
    .optional()
    .describe('Mobile feature tags to filter by (e.g., auth, payments, offline, push, analytics, storage, navigation, state-management)'),

  platform: z
    .enum(['mobile', 'web', 'backend', 'shared'])
    .optional()
    .describe('Content platform filter: mobile=iOS/Android apps, web=browser apps, backend=server/API, shared=cross-platform'),

  framework: z
    .string()
    .optional()
    .describe('Framework name filter (e.g., flutter, react-native, swiftui, jetpack-compose)'),

  sourceQuality: z
    .enum(['official', 'verified', 'community'])
    .optional()
    .describe('Filter by source quality: official=authoritative vendor docs (1.0x weight), verified=reviewed third-party (0.85x), community=user-contributed (0.6x)'),

  top_k: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe('Number of results to return (default: 10)'),
});
```

### Output Schema

```typescript
interface SearchMobileDocsResponse {
  query: string;
  results: Array<{
    id: number;                          // Chunk ID
    snippet: string;                     // Text snippet (truncated)
    similarity: number;                  // Combined relevance score (0-1)
    vector_score?: number | null;        // Pure vector similarity
    bm25_score?: number | null;          // BM25 keyword score
    fused_score?: number | null;         // RRF fusion score (hybrid mode)
    source?: 'vector' | 'bm25' | 'both'; // Which method found this result
    doc_id: string;                      // Parent document UUID
    doc_title: string | null;            // Document title
    source_url: string | null;           // Original source URL
    citation: {
      title: string | null;
      page?: string | number | null;
      section?: string | null;
    };
    metadata: {
      feature_tags?: string[];           // Feature categories
      platform?: string;                 // Content platform
      framework?: string[];              // Associated frameworks
      source_quality?: string;           // Quality tier
      tech_stack?: string[];             // Technology stack
      [key: string]: unknown;
    } | null;
    related_files: unknown | null;       // File relationships (if enabled)
  }>;
  total_results: number;
  search_time_ms: number;
  metadata: {
    search_mode: 'vector' | 'hybrid';
    vector_count?: number | null;
    bm25_count?: number | null;
    fused_count?: number | null;
    embedding_provider?: string | null;
    reranked: boolean;
    rerank_provider: string | null;
    pagination?: {
      page: number;
      page_size: number;
      total_results: number;
      total_pages: number;
    };
    intent?: {
      type: string;
      confidence: number;
      auto_detected: boolean;
      signals: string[];
    } | null;
  };
}
```

### HTTP Endpoint Mapping

| MCP Tool | HTTP Method | Endpoint | Body Transformation |
|----------|-------------|----------|---------------------|
| `search_mobile_docs` | POST | `/api/search` | `{ query, collection_id: collectionId, top_k, feature_tags: featureTags, platform, tech_stack: framework ? [framework] : undefined }` |

### Example Usage

**Input:**
```json
{
  "collectionId": "550e8400-e29b-41d4-a716-446655440000",
  "query": "implement biometric authentication flutter",
  "featureTags": ["auth", "security"],
  "platform": "mobile",
  "framework": "flutter",
  "sourceQuality": "official",
  "top_k": 5
}
```

**Output:**
```json
{
  "query": "implement biometric authentication flutter",
  "results": [
    {
      "id": 1234,
      "snippet": "To implement biometric authentication in Flutter, use the local_auth package. First, add the dependency to pubspec.yaml...",
      "similarity": 0.89,
      "vector_score": 0.87,
      "bm25_score": 0.72,
      "fused_score": 0.89,
      "source": "both",
      "doc_id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
      "doc_title": "Flutter Local Auth Documentation",
      "source_url": "https://pub.dev/packages/local_auth",
      "citation": {
        "title": "Flutter Local Auth Documentation",
        "section": "Getting Started"
      },
      "metadata": {
        "feature_tags": ["auth", "security", "biometrics"],
        "platform": "mobile",
        "framework": ["flutter"],
        "source_quality": "official",
        "tech_stack": ["flutter", "dart"]
      },
      "related_files": null
    }
  ],
  "total_results": 12,
  "search_time_ms": 245,
  "metadata": {
    "search_mode": "hybrid",
    "vector_count": 15,
    "bm25_count": 8,
    "fused_count": 12,
    "embedding_provider": "voyage",
    "reranked": false,
    "rerank_provider": null,
    "intent": {
      "type": "code_symbol",
      "confidence": 0.85,
      "auto_detected": true,
      "signals": ["contains_function_name", "implementation_keyword"]
    }
  }
}
```

---

## Tool 2: find_code_examples

### Description

Find code examples and sample implementations. Results are biased toward example code, demos, and sample projects by filtering on `usage_tier='example'`. Ideal for finding working code snippets and reference implementations.

### When to Use

- Looking for working code samples and snippets
- Finding demo implementations of a feature
- Searching for reference code to copy/adapt
- Learning how to use an API through examples
- Finding sample projects in a specific framework

### When NOT to Use

- **General documentation search** - Use `search_mobile_docs` instead
- **Looking for best practices/guides** - Use `get_feature_recipe` instead (returns curated patterns)
- **Need conceptual explanations** - Use `search_mobile_docs` with a conceptual query
- **Expanding from known code** - Use `graph_expand_context` instead

### Input Schema

```typescript
const findCodeExamplesInput = z.object({
  collectionId: z
    .string()
    .uuid()
    .describe('The ID of the collection to search'),

  query: z
    .string()
    .min(1)
    .describe('Search query for code examples'),

  featureTags: z
    .array(z.string())
    .optional()
    .describe('Mobile feature tags to filter examples (e.g., auth, payments, offline)'),

  framework: z
    .string()
    .optional()
    .describe('Framework name (e.g., flutter, supabase, react-native)'),

  top_k: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(5)
    .describe('Number of examples to return (default: 5)'),
});
```

### Output Schema

Same as `search_mobile_docs` response, but results are filtered to chunks with `usage_tier='example'` in metadata.

```typescript
interface FindCodeExamplesResponse {
  query: string;
  results: Array<{
    id: number;
    snippet: string;                     // Code example snippet
    similarity: number;
    vector_score?: number | null;
    bm25_score?: number | null;
    fused_score?: number | null;
    source?: 'vector' | 'bm25' | 'both';
    doc_id: string;
    doc_title: string | null;
    source_url: string | null;
    citation: {
      title: string | null;
      page?: string | number | null;
      section?: string | null;
    };
    metadata: {
      usage_tier?: 'example';            // Always 'example' for this tool
      language?: string;                 // Programming language
      feature_tags?: string[];
      framework?: string[];
      [key: string]: unknown;
    } | null;
    related_files: unknown | null;
  }>;
  total_results: number;
  search_time_ms: number;
  metadata: {
    search_mode: 'vector' | 'hybrid';
    vector_count?: number | null;
    bm25_count?: number | null;
    embedding_provider?: string | null;
    reranked: boolean;
    rerank_provider: string | null;
  };
}
```

### HTTP Endpoint Mapping

| MCP Tool | HTTP Method | Endpoint | Body Transformation |
|----------|-------------|----------|---------------------|
| `find_code_examples` | POST | `/api/search` | `{ query, collection_id: collectionId, top_k, feature_tags: featureTags, usage_tier: 'example', tech_stack: framework ? [framework] : undefined }` |

### Example Usage

**Input:**
```json
{
  "collectionId": "550e8400-e29b-41d4-a716-446655440000",
  "query": "supabase realtime subscription dart",
  "featureTags": ["realtime", "database"],
  "framework": "flutter",
  "top_k": 3
}
```

**Output:**
```json
{
  "query": "supabase realtime subscription dart",
  "results": [
    {
      "id": 5678,
      "snippet": "```dart\nfinal subscription = supabase\n  .from('messages')\n  .stream(primaryKey: ['id'])\n  .listen((List<Map<String, dynamic>> data) {\n    print('New message: ${data.last}');\n  });\n```",
      "similarity": 0.92,
      "vector_score": 0.91,
      "doc_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "doc_title": "Supabase Flutter Realtime Examples",
      "source_url": "https://supabase.com/docs/guides/realtime/flutter",
      "citation": {
        "title": "Supabase Flutter Realtime Examples",
        "section": "Stream Subscription"
      },
      "metadata": {
        "usage_tier": "example",
        "language": "dart",
        "feature_tags": ["realtime", "database", "supabase"],
        "framework": ["flutter", "supabase"]
      },
      "related_files": null
    }
  ],
  "total_results": 8,
  "search_time_ms": 189,
  "metadata": {
    "search_mode": "vector",
    "vector_count": 8,
    "embedding_provider": "voyage",
    "reranked": false,
    "rerank_provider": null
  }
}
```

---

## Tool 3: get_feature_recipe

### Description

Get curated recipe documentation for mobile features. Returns opinionated guides and patterns for implementing specific features by filtering on `usage_tier='recipe'`. The query is auto-constructed from feature tags to find implementation guides.

### When to Use

- Finding step-by-step implementation guides
- Looking for best practice patterns for a feature
- Getting opinionated recommendations on how to build something
- Finding end-to-end tutorials for complex features
- Need architectural guidance for a feature area

### When NOT to Use

- **Looking for code snippets** - Use `find_code_examples` instead
- **General documentation search** - Use `search_mobile_docs` instead
- **Need raw API reference** - Use `search_mobile_docs` with API-focused query
- **Exploring code structure** - Use `graph_expand_context` instead

### Input Schema

```typescript
const getFeatureRecipeInput = z.object({
  collectionId: z
    .string()
    .uuid()
    .describe('The ID of the collection to search'),

  featureTags: z
    .array(z.string())
    .min(1)
    .describe('Required: Mobile feature tags to find recipes for (e.g., ["auth", "supabase"], ["payments", "stripe"], ["offline", "sync"])'),

  framework: z
    .string()
    .optional()
    .describe('Framework name (e.g., flutter, react-native)'),

  top_k: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .describe('Number of recipes to return (default: 5)'),
});
```

### Output Schema

Same as `search_mobile_docs` response, but:
- Query is auto-generated: `featureTags.join(' ') + ' implementation guide'`
- Results are filtered to chunks with `usage_tier='recipe'` in metadata

```typescript
interface GetFeatureRecipeResponse {
  query: string;                         // Auto-generated from featureTags
  results: Array<{
    id: number;
    snippet: string;                     // Recipe/guide content
    similarity: number;
    vector_score?: number | null;
    bm25_score?: number | null;
    fused_score?: number | null;
    source?: 'vector' | 'bm25' | 'both';
    doc_id: string;
    doc_title: string | null;
    source_url: string | null;
    citation: {
      title: string | null;
      page?: string | number | null;
      section?: string | null;
    };
    metadata: {
      usage_tier?: 'recipe';             // Always 'recipe' for this tool
      feature_tags?: string[];
      framework?: string[];
      difficulty?: 'beginner' | 'intermediate' | 'advanced';
      estimated_time?: string;
      [key: string]: unknown;
    } | null;
    related_files: unknown | null;
  }>;
  total_results: number;
  search_time_ms: number;
  metadata: {
    search_mode: 'vector' | 'hybrid';
    embedding_provider?: string | null;
    reranked: boolean;
    rerank_provider: string | null;
  };
}
```

### HTTP Endpoint Mapping

| MCP Tool | HTTP Method | Endpoint | Body Transformation |
|----------|-------------|----------|---------------------|
| `get_feature_recipe` | POST | `/api/search` | `{ query: featureTags.join(' ') + ' implementation guide', collection_id: collectionId, top_k, feature_tags: featureTags, usage_tier: 'recipe', tech_stack: framework ? [framework] : undefined }` |

### Example Usage

**Input:**
```json
{
  "collectionId": "550e8400-e29b-41d4-a716-446655440000",
  "featureTags": ["auth", "supabase", "magic-link"],
  "framework": "flutter",
  "top_k": 3
}
```

**Output:**
```json
{
  "query": "auth supabase magic-link implementation guide",
  "results": [
    {
      "id": 9012,
      "snippet": "## Magic Link Authentication with Supabase\n\n### Prerequisites\n- Supabase project configured\n- Flutter app with supabase_flutter package\n\n### Step 1: Configure Email Templates\nIn your Supabase dashboard, navigate to Authentication > Email Templates...",
      "similarity": 0.88,
      "doc_id": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
      "doc_title": "Supabase Auth Implementation Guide",
      "source_url": "https://supabase.com/docs/guides/auth/flutter",
      "citation": {
        "title": "Supabase Auth Implementation Guide",
        "section": "Magic Link Flow"
      },
      "metadata": {
        "usage_tier": "recipe",
        "feature_tags": ["auth", "supabase", "magic-link", "email"],
        "framework": ["flutter"],
        "difficulty": "intermediate",
        "estimated_time": "30 minutes"
      },
      "related_files": null
    }
  ],
  "total_results": 5,
  "search_time_ms": 212,
  "metadata": {
    "search_mode": "vector",
    "embedding_provider": "voyage",
    "reranked": false,
    "rerank_provider": null
  }
}
```

---

## Tool 4: graph_expand_context

### Description

Expand context from seed nodes using BFS traversal of the knowledge graph. Returns connected nodes, edges, and associated chunks for end-to-end context retrieval. Useful for understanding code relationships, tracing dependencies, and building comprehensive context windows.

### When to Use

- Starting from search results and need more context
- Understanding code structure and dependencies
- Tracing function calls, imports, or data flow
- Finding related configuration or database schemas
- Building comprehensive context for code generation
- Exploring the knowledge graph visually

### When NOT to Use

- **Initial documentation search** - Use `search_mobile_docs` first
- **Looking for code examples** - Use `find_code_examples` instead
- **Need implementation guides** - Use `get_feature_recipe` instead
- **Simple keyword search** - Use `search_rag` instead

### Input Schema

```typescript
const graphExpandContextInput = z.object({
  collectionId: z
    .string()
    .uuid()
    .describe('The ID of the collection to search'),

  seedChunkIds: z
    .array(z.number().int())
    .optional()
    .describe('Chunk IDs to use as starting points for graph traversal (from previous search results)'),

  seedNodeIds: z
    .array(z.string().uuid())
    .optional()
    .describe('Node IDs to use as starting points for graph traversal'),

  query: z
    .string()
    .min(1)
    .optional()
    .describe('Query to find seed nodes via semantic search (alternative to providing chunk/node IDs)'),

  maxDepth: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(3)
    .describe('Maximum traversal depth from seed nodes (default: 3)'),

  maxNodes: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .describe('Maximum nodes to return (default: 50)'),

  edgeTypes: z
    .array(z.enum([
      'calls',           // Function/method calls
      'defines',         // Symbol definitions
      'belongs_to',      // Containment relationships
      'persists_to',     // Database operations
      'configured_by',   // Configuration relationships
      'documents',       // Documentation links
      'imports',         // Import/export relationships
      'depends_on',      // Dependency relationships
    ]))
    .optional()
    .describe('Filter traversal by edge types'),

  nodeTypes: z
    .array(z.enum([
      'document',        // Source documents
      'chunk',           // Text chunks
      'symbol',          // Code symbols (functions, classes)
      'endpoint',        // API endpoints
      'table',           // Database tables
      'column',          // Database columns
      'config_section',  // Configuration sections
    ]))
    .optional()
    .describe('Filter results by node types'),
});

// Validation: At least one seed type required
// (seedChunkIds, seedNodeIds, or query)
```

### Output Schema

```typescript
interface GraphExpandContextResponse {
  nodes: Array<{
    id: string;                          // Node UUID
    collection_id: string;               // Parent collection
    node_type: 'document' | 'chunk' | 'symbol' | 'endpoint' | 'table' | 'column' | 'config_section';
    name: string;                        // Node identifier/name
    document_id: string | null;          // Associated document
    chunk_id: number | null;             // Associated chunk
    metadata: {
      language?: string;                 // Programming language
      file_path?: string;                // Source file path
      line_start?: number;               // Start line in file
      line_end?: number;                 // End line in file
      symbol_type?: string;              // Function, class, interface, etc.
      [key: string]: unknown;
    };
    created_at: string;                  // ISO timestamp
  }>;

  edges: Array<{
    id: string;                          // Edge UUID
    source_node_id: string;              // Source node
    target_node_id: string;              // Target node
    edge_type: 'calls' | 'defines' | 'belongs_to' | 'persists_to' | 'configured_by' | 'documents' | 'imports' | 'depends_on';
    metadata: {
      call_count?: number;               // For 'calls' edges
      import_path?: string;              // For 'imports' edges
      [key: string]: unknown;
    };
    created_at: string;                  // ISO timestamp
  }>;

  chunks: Array<{
    id: number;                          // Chunk ID
    text: string;                        // Full chunk text
    metadata: Record<string, unknown>;   // Chunk metadata
  }>;

  stats: {
    nodesVisited: number;                // Total nodes in traversal
    edgesTraversed: number;              // Total edges found
    depthReached: number;                // Max depth achieved
    durationMs: number;                  // Traversal time
  };

  graph_expansion_enabled: boolean;      // Feature flag status
}
```

### HTTP Endpoint Mapping

| MCP Tool | HTTP Method | Endpoint | Body Transformation |
|----------|-------------|----------|---------------------|
| `graph_expand_context` | POST | `/api/graph/context` | `{ collection_id: collectionId, seed_chunk_ids: seedChunkIds, seed_node_ids: seedNodeIds, query, max_depth: maxDepth, max_nodes: maxNodes, edge_types: edgeTypes, node_types: nodeTypes }` |

### Example Usage

**Input (from search result chunks):**
```json
{
  "collectionId": "550e8400-e29b-41d4-a716-446655440000",
  "seedChunkIds": [1234, 1235],
  "maxDepth": 2,
  "maxNodes": 30,
  "edgeTypes": ["calls", "imports", "defines"],
  "nodeTypes": ["symbol", "chunk"]
}
```

**Output:**
```json
{
  "nodes": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "collection_id": "550e8400-e29b-41d4-a716-446655440000",
      "node_type": "symbol",
      "name": "authenticateUser",
      "document_id": "doc-uuid-here",
      "chunk_id": 1234,
      "metadata": {
        "language": "dart",
        "file_path": "lib/services/auth_service.dart",
        "line_start": 45,
        "line_end": 78,
        "symbol_type": "function"
      },
      "created_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
      "collection_id": "550e8400-e29b-41d4-a716-446655440000",
      "node_type": "symbol",
      "name": "UserRepository",
      "document_id": "doc-uuid-here",
      "chunk_id": 1235,
      "metadata": {
        "language": "dart",
        "file_path": "lib/repositories/user_repository.dart",
        "symbol_type": "class"
      },
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "edges": [
    {
      "id": "edge-uuid-here",
      "source_node_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "target_node_id": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
      "edge_type": "calls",
      "metadata": {
        "call_count": 3
      },
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "chunks": [
    {
      "id": 1234,
      "text": "Future<User?> authenticateUser(String email, String password) async {\n  final response = await _userRepository.findByEmail(email);\n  if (response == null) return null;\n  ...",
      "metadata": {
        "language": "dart",
        "doc_type": "code_sample"
      }
    }
  ],
  "stats": {
    "nodesVisited": 12,
    "edgesTraversed": 8,
    "depthReached": 2,
    "durationMs": 45
  },
  "graph_expansion_enabled": true
}
```

**Input (using semantic search):**
```json
{
  "collectionId": "550e8400-e29b-41d4-a716-446655440000",
  "query": "user authentication flow supabase",
  "maxDepth": 3,
  "maxNodes": 50
}
```

---

## Tool Comparison Summary

| Tool | Primary Use | Query Type | Filtering | Output Focus |
|------|-------------|------------|-----------|--------------|
| `search_mobile_docs` | General mobile docs | Free-form query | Platform, feature, framework, quality | Documentation chunks |
| `find_code_examples` | Code snippets | Free-form query | Feature, framework | `usage_tier='example'` chunks |
| `get_feature_recipe` | Implementation guides | Auto-generated from tags | Feature tags (required), framework | `usage_tier='recipe'` chunks |
| `graph_expand_context` | Context expansion | Seed IDs or semantic | Edge types, node types | Graph structure + chunks |

## Typical Workflow

1. **Start with `search_mobile_docs`** to find relevant documentation
2. **Use `find_code_examples`** if you need working code samples
3. **Use `get_feature_recipe`** if you need step-by-step guidance
4. **Use `graph_expand_context`** to expand context from promising results using their chunk IDs

---

## Environment Configuration

These tools respect the following environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SEARCH_MODE` | `vector` | Default search mode (`vector` or `hybrid`) |
| `ENABLE_GRAPH_EXPANSION` | `false` | Enable graph expansion in search |
| `GRAPH_MAX_DEPTH` | `3` | Default max depth for graph traversal |
| `GRAPH_MAX_NODES` | `50` | Default max nodes for graph traversal |
| `ENABLE_TRUST_SCORING` | `false` | Enable source quality weighting |
| `HYBRID_VECTOR_WEIGHT` | `0.7` | Vector weight in hybrid search |
| `HYBRID_BM25_WEIGHT` | `0.3` | BM25 weight in hybrid search |

---

## Error Handling

All tools return errors in the following format:

```typescript
interface ErrorResponse {
  content: [{
    type: 'text';
    text: string;  // Error message: "Error: {description}"
  }];
  isError: true;
}
```

Common errors:
- `INVALID_INPUT`: Validation failed (missing required fields, invalid UUID, etc.)
- `SEARCH_ERROR`: Backend search failed
- `GRAPH_SEARCH_FAILED`: Graph traversal failed
- Network/timeout errors from API client
