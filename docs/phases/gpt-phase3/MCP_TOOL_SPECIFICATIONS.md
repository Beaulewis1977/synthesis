# MCP Tool Specifications - GPT Phase 3

This document provides detailed specifications for the 3 NEW MCP tools to be implemented in Phase 3. These tools leverage the knowledge graph infrastructure built in Phase 2 to provide advanced code intelligence capabilities.

---

## Table of Contents

1. [Tool 5: find_symbol_usages](#tool-5-find_symbol_usages)
2. [Tool 6: get_project_tech_stack](#tool-6-get_project_tech_stack)
3. [Tool 7: get_db_schema](#tool-7-get_db_schema)

---

## Tool 5: find_symbol_usages

### Name
`find_symbol_usages`

### Description
Find where symbols (functions, classes, widgets, methods, constants) are defined and used across a codebase. This tool leverages the knowledge graph to trace symbol relationships including definitions, calls, imports, and dependencies.

### When to Use

**Use this tool when:**
- Looking for where a function or method is defined
- Finding all call sites of a specific function
- Tracing widget usage in Flutter/React codebases
- Identifying which files import a specific symbol
- Understanding the impact radius of changing a symbol
- Debugging issues related to function calls
- Refactoring: finding all places that need to be updated when renaming a symbol

**Example scenarios:**
- "Where is the `AuthProvider` class defined and used?"
- "Find all calls to `handleUserLogin` function"
- "Which files import the `UserWidget`?"
- "Show me everywhere the `API_BASE_URL` constant is referenced"

### When NOT to Use

**Do NOT use when:**
- Searching for text content in documentation - use `search_rag` instead
- Looking for code examples or patterns - use `find_code_examples` instead
- Browsing the knowledge graph structure - use `graph_expand_context` instead
- Getting database schema information - use `get_db_schema` instead
- Finding implementation details of a concept - use `search_mobile_docs` instead

### Input Schema

```typescript
const findSymbolUsagesInput = z.object({
  collectionId: z
    .string()
    .uuid()
    .describe('The ID of the collection to search'),

  symbolName: z
    .string()
    .min(1)
    .describe('Name of the symbol to find (function, class, widget, method, constant). Supports partial matching.'),

  symbolKind: z
    .enum(['function', 'class', 'widget', 'method', 'constant'])
    .optional()
    .describe('Filter by symbol kind. If omitted, searches all symbol types.'),

  includeDefinitions: z
    .boolean()
    .default(true)
    .describe('Include locations where the symbol is defined (nodes with outgoing "defines" edges)'),

  includeUsages: z
    .boolean()
    .default(true)
    .describe('Include locations where the symbol is used/called (nodes with "calls" or "imports" edges)'),

  maxResults: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Maximum results to return per category (definitions and usages)'),
}).strict();
```

### Output Schema

```typescript
interface FindSymbolUsagesResponse {
  // The symbol that was searched
  symbol: {
    name: string;
    kind: 'function' | 'class' | 'widget' | 'method' | 'constant' | 'unknown';
    nodeId: string;  // Knowledge graph node ID
  } | null;

  // Locations where the symbol is defined
  definitions: Array<{
    nodeId: string;
    documentId: string;
    documentTitle: string;
    chunkId: number | null;
    chunkText: string | null;
    filePath: string | null;
    lineNumber: number | null;
    metadata: Record<string, unknown>;
  }>;

  // Locations where the symbol is used
  usages: Array<{
    nodeId: string;
    documentId: string;
    documentTitle: string;
    chunkId: number | null;
    chunkText: string | null;
    filePath: string | null;
    lineNumber: number | null;
    edgeType: 'calls' | 'imports' | 'depends_on';
    metadata: Record<string, unknown>;
  }>;

  // Statistics
  stats: {
    totalDefinitions: number;
    totalUsages: number;
    documentsWithUsages: number;
    searchDurationMs: number;
  };
}
```

### HTTP Endpoint Mapping

**Endpoint:** `POST /api/graph/symbols` (NEW)

**Request Body:**
```json
{
  "collection_id": "uuid",
  "symbol_name": "handleUserLogin",
  "symbol_kind": "function",
  "include_definitions": true,
  "include_usages": true,
  "max_results": 20
}
```

**Response:**
```json
{
  "symbol": {
    "name": "handleUserLogin",
    "kind": "function",
    "node_id": "uuid"
  },
  "definitions": [...],
  "usages": [...],
  "stats": {
    "total_definitions": 1,
    "total_usages": 5,
    "documents_with_usages": 3,
    "search_duration_ms": 45
  }
}
```

### Example Usage

**Input:**
```json
{
  "collectionId": "550e8400-e29b-41d4-a716-446655440000",
  "symbolName": "AuthProvider",
  "symbolKind": "class",
  "includeDefinitions": true,
  "includeUsages": true,
  "maxResults": 10
}
```

**Output:**
```json
{
  "symbol": {
    "name": "AuthProvider",
    "kind": "class",
    "nodeId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  },
  "definitions": [
    {
      "nodeId": "d1e2f3g4-h5i6-7890-jklm-no1234567890",
      "documentId": "doc-001",
      "documentTitle": "auth_provider.dart",
      "chunkId": 42,
      "chunkText": "class AuthProvider extends ChangeNotifier {\n  User? _currentUser;\n  ...",
      "filePath": "lib/providers/auth_provider.dart",
      "lineNumber": 15,
      "metadata": { "language": "dart", "framework": "flutter" }
    }
  ],
  "usages": [
    {
      "nodeId": "u1v2w3x4-y5z6-7890-abcd-ef1234567890",
      "documentId": "doc-002",
      "documentTitle": "main.dart",
      "chunkId": 12,
      "chunkText": "ChangeNotifierProvider(create: (_) => AuthProvider()),",
      "filePath": "lib/main.dart",
      "lineNumber": 28,
      "edgeType": "imports",
      "metadata": { "language": "dart" }
    },
    {
      "nodeId": "u2v3w4x5-y6z7-8901-bcde-fg2345678901",
      "documentId": "doc-003",
      "documentTitle": "login_screen.dart",
      "chunkId": 67,
      "chunkText": "final authProvider = Provider.of<AuthProvider>(context);",
      "filePath": "lib/screens/login_screen.dart",
      "lineNumber": 45,
      "edgeType": "calls",
      "metadata": { "language": "dart" }
    }
  ],
  "stats": {
    "totalDefinitions": 1,
    "totalUsages": 2,
    "documentsWithUsages": 2,
    "searchDurationMs": 32
  }
}
```

### Implementation Notes

1. **Symbol Node Lookup:**
   - Query `knowledge_nodes` table for nodes with `node_type = 'symbol'`
   - Filter by `name` using case-insensitive partial matching (ILIKE)
   - If `symbolKind` is provided, filter by `metadata->>'kind'`

2. **Definition Lookup (includeDefinitions=true):**
   - Find edges where the symbol node is the `target_node_id` and `edge_type = 'defines'`
   - The `source_node_id` is the defining location (usually a chunk or document node)
   - Join with `chunks` table to get text content

3. **Usage Lookup (includeUsages=true):**
   - Find edges where the symbol node is the `target_node_id` and `edge_type IN ('calls', 'imports', 'depends_on')`
   - The `source_node_id` is the usage location
   - Join with `chunks` and `documents` tables for context

4. **SQL Query Pattern:**
```sql
-- Find symbol node
SELECT * FROM knowledge_nodes
WHERE collection_id = $1
  AND node_type = 'symbol'
  AND name ILIKE '%' || $2 || '%'
  AND ($3 IS NULL OR metadata->>'kind' = $3)
LIMIT 1;

-- Find definitions (edges pointing TO the symbol with type 'defines')
SELECT
  kn.id as node_id,
  kn.document_id,
  d.title as document_title,
  kn.chunk_id,
  c.text as chunk_text,
  kn.metadata
FROM knowledge_edges ke
JOIN knowledge_nodes kn ON ke.source_node_id = kn.id
LEFT JOIN documents d ON kn.document_id = d.id
LEFT JOIN chunks c ON kn.chunk_id = c.id
WHERE ke.target_node_id = $1  -- symbol node id
  AND ke.edge_type = 'defines'
LIMIT $2;

-- Find usages (edges pointing FROM other nodes TO the symbol)
SELECT
  kn.id as node_id,
  kn.document_id,
  d.title as document_title,
  kn.chunk_id,
  c.text as chunk_text,
  ke.edge_type,
  kn.metadata
FROM knowledge_edges ke
JOIN knowledge_nodes kn ON ke.source_node_id = kn.id
LEFT JOIN documents d ON kn.document_id = d.id
LEFT JOIN chunks c ON kn.chunk_id = c.id
WHERE ke.target_node_id = $1  -- symbol node id
  AND ke.edge_type IN ('calls', 'imports', 'depends_on')
LIMIT $2;
```

5. **Performance Considerations:**
   - Add index: `CREATE INDEX idx_knowledge_nodes_symbol_name ON knowledge_nodes (collection_id, node_type, name) WHERE node_type = 'symbol'`
   - Limit results server-side to prevent large response payloads
   - Consider caching frequently queried symbols

---

## Tool 6: get_project_tech_stack

### Name
`get_project_tech_stack`

### Description
Get the detected technology stack profile for a project/collection. Returns information about the primary language, frameworks, database type, and version constraints. This helps AI agents understand the technical context when generating code or documentation.

### When to Use

**Use this tool when:**
- Starting work on a codebase to understand its tech stack
- Generating code that needs to match the project's conventions
- Filtering search results by framework or language
- Determining which documentation sources are most relevant
- Checking version constraints before suggesting dependencies

**Example scenarios:**
- "What tech stack does this project use?"
- "Is this a Flutter or React Native project?"
- "What database does this project use?"
- "What version of Supabase is this project using?"

### When NOT to Use

**Do NOT use when:**
- Searching for documentation content - use `search_rag` or `search_mobile_docs`
- Looking for code examples - use `find_code_examples`
- Exploring the knowledge graph - use `graph_expand_context`
- Finding symbol definitions - use `find_symbol_usages`
- Getting database schema - use `get_db_schema`

### Input Schema

```typescript
const getProjectTechStackInput = z.object({
  collectionId: z
    .string()
    .uuid()
    .describe('The ID of the collection to get tech stack for'),
}).strict();
```

### Output Schema

```typescript
interface GetProjectTechStackResponse {
  profile: {
    id: string;
    collection_id: string;

    // Primary technology identifiers
    primary_language: string | null;      // e.g., "dart", "typescript", "python"
    primary_framework: string | null;     // e.g., "flutter", "nextjs", "fastapi"
    database_type: string | null;         // e.g., "postgresql", "supabase", "firebase"
    database_version: string | null;      // e.g., "16", "2.0"

    // Additional frameworks/libraries in use
    frameworks: string[];                 // e.g., ["riverpod", "go_router", "freezed"]

    // Version constraints for key dependencies
    version_constraints: Record<string, string>;  // e.g., { "flutter": ">=3.0.0", "supabase": "^2.0.0" }

    // Search preferences
    prefer_official_docs: boolean;
    prefer_code_examples: boolean;
    min_source_quality: string;           // "official" | "verified" | "community"

    // Embedding provider preferences
    code_embedding_provider: string;      // e.g., "voyage"
    doc_embedding_provider: string;       // e.g., "ollama"

    created_at: string;  // ISO timestamp
    updated_at: string;  // ISO timestamp
  } | null;

  // If no profile exists, return helpful suggestions
  suggestions?: {
    message: string;
    availableTemplates: string[];
  };
}
```

### HTTP Endpoint Mapping

**Endpoint:** `GET /api/tech-profiles/:collectionId` (EXISTING)

**Response:**
```json
{
  "profile": {
    "id": "uuid",
    "collection_id": "uuid",
    "primary_language": "dart",
    "primary_framework": "flutter",
    "database_type": "supabase",
    "database_version": null,
    "frameworks": ["riverpod", "go_router"],
    "version_constraints": {
      "flutter": ">=3.0.0",
      "supabase": "^2.0.0"
    },
    "prefer_official_docs": true,
    "prefer_code_examples": true,
    "min_source_quality": "verified",
    "code_embedding_provider": "voyage",
    "doc_embedding_provider": "ollama",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-20T14:45:00Z"
  }
}
```

### Example Usage

**Input:**
```json
{
  "collectionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Output (profile exists):**
```json
{
  "profile": {
    "id": "profile-001",
    "collection_id": "550e8400-e29b-41d4-a716-446655440000",
    "primary_language": "dart",
    "primary_framework": "flutter",
    "database_type": "supabase",
    "database_version": null,
    "frameworks": ["riverpod", "go_router", "freezed"],
    "version_constraints": {
      "flutter": ">=3.19.0",
      "supabase_flutter": "^2.3.0"
    },
    "prefer_official_docs": true,
    "prefer_code_examples": true,
    "min_source_quality": "verified",
    "code_embedding_provider": "voyage",
    "doc_embedding_provider": "ollama",
    "created_at": "2024-11-15T10:30:00Z",
    "updated_at": "2024-11-20T14:45:00Z"
  }
}
```

**Output (no profile):**
```json
{
  "profile": null,
  "suggestions": {
    "message": "No tech stack profile found for this collection. Consider creating one using the /api/tech-profiles endpoint or applying a template.",
    "availableTemplates": [
      "flutter-supabase",
      "flutter-firebase",
      "react-native-supabase",
      "nextjs-prisma",
      "fastapi-postgres"
    ]
  }
}
```

### Implementation Notes

1. **Direct Database Query:**
   - Simple GET request to existing endpoint
   - Queries `collection_tech_profiles` table by `collection_id`

2. **Null Handling:**
   - If no profile exists, return `profile: null` with suggestions
   - Fetch available templates from `tech_stack_templates` table for suggestions

3. **MCP Implementation:**
```typescript
server.registerTool(
  'get_project_tech_stack',
  {
    description: 'Get the detected technology stack for a project/collection. Returns primary language, framework, database type, and version constraints.',
    inputSchema: toInputShape(getProjectTechStackInput),
  },
  async (input: any) => {
    const { collectionId } = getProjectTechStackInput.parse(input);
    try {
      const result = await apiClient.get(`/api/tech-profiles/${collectionId}`);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      // Handle 404 - return null profile with suggestions
      if (error.status === 404) {
        const templates = await apiClient.get('/api/tech-profiles/templates');
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              profile: null,
              suggestions: {
                message: 'No tech stack profile found. Consider creating one.',
                availableTemplates: templates.templates?.map(t => t.name) || []
              }
            }, null, 2)
          }],
        };
      }
      throw error;
    }
  }
);
```

4. **Use Cases for AI Agents:**
   - Code generation: Match language/framework conventions
   - Documentation search: Prioritize relevant framework docs
   - Dependency suggestions: Respect version constraints
   - Example filtering: Prefer examples matching the stack

---

## Tool 7: get_db_schema

### Name
`get_db_schema`

### Description
Extract database schema information from the knowledge graph, including tables, columns, relationships, and foreign key constraints. This tool queries the knowledge graph for nodes of type 'table' and 'column' and their relationships via 'belongs_to' edges.

### When to Use

**Use this tool when:**
- Understanding the database structure of a project
- Writing queries or migrations
- Designing new tables that reference existing ones
- Generating data models or ORMs
- Checking column types before writing code
- Understanding table relationships and foreign keys

**Example scenarios:**
- "What tables exist in this project's database?"
- "What columns does the `users` table have?"
- "What are the relationships between tables?"
- "Show me the schema for all tables related to authentication"

### When NOT to Use

**Do NOT use when:**
- Searching for documentation about database concepts - use `search_rag`
- Looking for code that interacts with the database - use `find_symbol_usages` or `search_rag`
- Getting general project information - use `get_project_tech_stack`
- Exploring the full knowledge graph - use `graph_expand_context`
- The project doesn't use a relational database

### Input Schema

```typescript
const getDbSchemaInput = z.object({
  collectionId: z
    .string()
    .uuid()
    .describe('The ID of the collection to get schema for'),

  tables: z
    .array(z.string())
    .optional()
    .describe('Filter to specific table names. If omitted, returns all tables.'),

  includeRelationships: z
    .boolean()
    .default(true)
    .describe('Include foreign key relationships between tables (edges with type "belongs_to" or "depends_on")'),
}).strict();
```

### Output Schema

```typescript
interface GetDbSchemaResponse {
  // Schema organized by table
  tables: Array<{
    name: string;
    nodeId: string;
    documentId: string | null;
    metadata: {
      description?: string;
      engine?: string;           // e.g., "postgresql", "sqlite"
      schemaName?: string;       // e.g., "public", "auth"
      rowCount?: number;
      [key: string]: unknown;
    };

    // Columns in this table
    columns: Array<{
      name: string;
      nodeId: string;
      dataType: string | null;   // e.g., "uuid", "varchar(255)", "timestamp"
      nullable: boolean;
      defaultValue: string | null;
      isPrimaryKey: boolean;
      isUnique: boolean;
      metadata: Record<string, unknown>;
    }>;
  }>;

  // Relationships between tables (if includeRelationships=true)
  relationships: Array<{
    edgeId: string;
    sourceTable: string;
    sourceColumn: string | null;
    targetTable: string;
    targetColumn: string | null;
    relationshipType: 'foreign_key' | 'reference' | 'belongs_to';
    metadata: Record<string, unknown>;
  }>;

  // Statistics
  stats: {
    totalTables: number;
    totalColumns: number;
    totalRelationships: number;
    searchDurationMs: number;
  };
}
```

### HTTP Endpoint Mapping

**Endpoint:** `GET /api/graph/schema/:collectionId` (NEW)

**Query Parameters:**
- `tables` (optional): Comma-separated list of table names to filter
- `include_relationships` (optional): Boolean, default true

**Request Example:**
```
GET /api/graph/schema/550e8400-e29b-41d4-a716-446655440000?tables=users,posts&include_relationships=true
```

**Response:**
```json
{
  "tables": [
    {
      "name": "users",
      "node_id": "uuid",
      "document_id": "uuid",
      "metadata": {
        "schema_name": "public",
        "description": "User accounts table"
      },
      "columns": [
        {
          "name": "id",
          "node_id": "uuid",
          "data_type": "uuid",
          "nullable": false,
          "default_value": "gen_random_uuid()",
          "is_primary_key": true,
          "is_unique": true,
          "metadata": {}
        }
      ]
    }
  ],
  "relationships": [
    {
      "edge_id": "uuid",
      "source_table": "posts",
      "source_column": "user_id",
      "target_table": "users",
      "target_column": "id",
      "relationship_type": "foreign_key",
      "metadata": { "on_delete": "CASCADE" }
    }
  ],
  "stats": {
    "total_tables": 2,
    "total_columns": 15,
    "total_relationships": 3,
    "search_duration_ms": 28
  }
}
```

### Example Usage

**Input (all tables):**
```json
{
  "collectionId": "550e8400-e29b-41d4-a716-446655440000",
  "includeRelationships": true
}
```

**Input (specific tables):**
```json
{
  "collectionId": "550e8400-e29b-41d4-a716-446655440000",
  "tables": ["users", "profiles", "sessions"],
  "includeRelationships": true
}
```

**Output:**
```json
{
  "tables": [
    {
      "name": "users",
      "nodeId": "t1-uuid",
      "documentId": "doc-001",
      "metadata": {
        "schemaName": "auth",
        "description": "Supabase auth users table"
      },
      "columns": [
        {
          "name": "id",
          "nodeId": "c1-uuid",
          "dataType": "uuid",
          "nullable": false,
          "defaultValue": "gen_random_uuid()",
          "isPrimaryKey": true,
          "isUnique": true,
          "metadata": {}
        },
        {
          "name": "email",
          "nodeId": "c2-uuid",
          "dataType": "varchar(255)",
          "nullable": false,
          "defaultValue": null,
          "isPrimaryKey": false,
          "isUnique": true,
          "metadata": {}
        },
        {
          "name": "created_at",
          "nodeId": "c3-uuid",
          "dataType": "timestamptz",
          "nullable": false,
          "defaultValue": "now()",
          "isPrimaryKey": false,
          "isUnique": false,
          "metadata": {}
        }
      ]
    },
    {
      "name": "profiles",
      "nodeId": "t2-uuid",
      "documentId": "doc-002",
      "metadata": {
        "schemaName": "public",
        "description": "User profile information"
      },
      "columns": [
        {
          "name": "id",
          "nodeId": "c4-uuid",
          "dataType": "uuid",
          "nullable": false,
          "defaultValue": null,
          "isPrimaryKey": true,
          "isUnique": true,
          "metadata": { "references": "auth.users.id" }
        },
        {
          "name": "display_name",
          "nodeId": "c5-uuid",
          "dataType": "varchar(100)",
          "nullable": true,
          "defaultValue": null,
          "isPrimaryKey": false,
          "isUnique": false,
          "metadata": {}
        }
      ]
    }
  ],
  "relationships": [
    {
      "edgeId": "e1-uuid",
      "sourceTable": "profiles",
      "sourceColumn": "id",
      "targetTable": "users",
      "targetColumn": "id",
      "relationshipType": "foreign_key",
      "metadata": {
        "onDelete": "CASCADE",
        "onUpdate": "CASCADE"
      }
    }
  ],
  "stats": {
    "totalTables": 2,
    "totalColumns": 5,
    "totalRelationships": 1,
    "searchDurationMs": 18
  }
}
```

### Implementation Notes

1. **Knowledge Graph Query Strategy:**
   - Tables: Query `knowledge_nodes` where `node_type = 'table'`
   - Columns: Query `knowledge_nodes` where `node_type = 'column'`
   - Column-to-Table relationships: Find edges with `edge_type = 'belongs_to'` where column node -> table node
   - Table-to-Table relationships: Find edges with `edge_type IN ('belongs_to', 'depends_on')` between table nodes

2. **SQL Queries:**

```sql
-- Get all tables in collection
SELECT
  id, name, document_id, metadata
FROM knowledge_nodes
WHERE collection_id = $1
  AND node_type = 'table'
  AND ($2::text[] IS NULL OR name = ANY($2))
ORDER BY name;

-- Get columns for a table (via belongs_to edges)
SELECT
  kn.id, kn.name, kn.metadata
FROM knowledge_nodes kn
JOIN knowledge_edges ke ON kn.id = ke.source_node_id
WHERE ke.target_node_id = $1  -- table node id
  AND ke.edge_type = 'belongs_to'
  AND kn.node_type = 'column'
ORDER BY kn.metadata->>'ordinal_position', kn.name;

-- Get table-to-table relationships
SELECT
  ke.id as edge_id,
  source_table.name as source_table,
  ke.metadata->>'source_column' as source_column,
  target_table.name as target_table,
  ke.metadata->>'target_column' as target_column,
  ke.edge_type,
  ke.metadata
FROM knowledge_edges ke
JOIN knowledge_nodes source_table ON ke.source_node_id = source_table.id
JOIN knowledge_nodes target_table ON ke.target_node_id = target_table.id
WHERE ke.collection_id = $1
  AND source_table.node_type = 'table'
  AND target_table.node_type = 'table'
  AND ke.edge_type IN ('belongs_to', 'depends_on');
```

3. **Column Metadata Extraction:**
   - Parse column metadata for: `data_type`, `nullable`, `default_value`, `is_primary_key`, `is_unique`
   - These should be populated during graph building from migration files, schema definitions, or Supabase introspection

4. **Relationship Detection:**
   - Foreign key relationships stored as edges between column nodes or table nodes
   - Metadata should include: `on_delete`, `on_update`, `constraint_name`

5. **Performance Optimizations:**
   - Batch fetch all tables, then batch fetch columns for all tables
   - Use CTEs to reduce round trips
   - Consider caching schema for frequently accessed collections

6. **Route Implementation:**

```typescript
// apps/server/src/routes/graph.ts - NEW endpoint
fastify.get<{
  Params: { collectionId: string };
  Querystring: { tables?: string; include_relationships?: string };
}>('/api/graph/schema/:collectionId', async (request, reply) => {
  const { collectionId } = request.params;
  const tables = request.query.tables?.split(',').filter(Boolean);
  const includeRelationships = request.query.include_relationships !== 'false';

  // Validate UUID
  if (!uuidRegex.test(collectionId)) {
    return reply.code(400).send({ error: 'Invalid collectionId' });
  }

  try {
    const result = await getDbSchema(db, {
      collectionId,
      tables,
      includeRelationships,
    });
    return reply.send(result);
  } catch (error) {
    fastify.log.error(error, 'Failed to get DB schema');
    return reply.code(500).send({ error: 'SCHEMA_FETCH_FAILED' });
  }
});
```

7. **Edge Cases:**
   - Empty schema: Return empty arrays with zero counts
   - No table/column nodes: May indicate schema wasn't extracted during ingestion
   - Circular relationships: Handle gracefully in relationship output

---

## Summary

| Tool | Endpoint | Status | Primary Use Case |
|------|----------|--------|------------------|
| `find_symbol_usages` | POST /api/graph/symbols | NEW | Find where functions/classes are defined and used |
| `get_project_tech_stack` | GET /api/tech-profiles/:collectionId | EXISTING | Get project's language, framework, database info |
| `get_db_schema` | GET /api/graph/schema/:collectionId | NEW | Extract database tables, columns, relationships |

### Dependencies

All three tools depend on:
- Knowledge graph infrastructure (Phase 2)
- `knowledge_nodes` table with proper `node_type` values
- `knowledge_edges` table with relationship edges
- Graph builder populating symbol/table/column nodes during ingestion

### Recommended Implementation Order

1. **get_project_tech_stack** - Uses existing endpoint, simplest to implement
2. **get_db_schema** - Requires new endpoint but simpler query logic
3. **find_symbol_usages** - Most complex, requires careful edge traversal
