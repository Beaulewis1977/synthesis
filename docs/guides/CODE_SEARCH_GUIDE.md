# Code Search Guide

**Your guide to searching code repositories with intelligent context preservation**

---

## 🎯 Overview

Code search in Synthesis is fundamentally different from regular document search. Instead of breaking your code at arbitrary character boundaries, Synthesis uses **AST-based code chunking** to preserve the natural structure of your codebase—functions stay intact, imports are preserved, and related files are automatically linked.

### Code Search vs Document Search

**Regular Document Search:**
- Chunks text every 800 characters
- Might split a function mid-implementation
- No understanding of code structure
- Returns incomplete snippets

**Code Search (Phase 13):**
- ✅ Chunks at function/class boundaries
- ✅ Preserves complete implementations
- ✅ Includes necessary imports
- ✅ Tracks file relationships
- ✅ Returns complete, usable code

**When to use Code Search:**
- Searching through source code repositories
- Finding specific functions or classes
- Exploring API implementations
- Understanding code dependencies
- Navigating large codebases (1000+ files)

**When to use Document Search:**
- Searching markdown documentation
- Finding text in PDFs or Word documents
- General knowledge retrieval

---

## 🔍 How to Search Code Effectively

### Basic Search Queries

**Finding Functions:**
```bash
# Search by function name
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "login function",
    "collection_id": "<your-collection-id>"
  }'

# Search by functionality
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "authentication handler",
    "collection_id": "<your-collection-id>"
  }'
```

**Finding Classes:**
```bash
# Search by class name
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "UserService class",
    "collection_id": "<your-collection-id>"
  }'

# Search by purpose
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "database connection manager",
    "collection_id": "<your-collection-id>"
  }'
```

**Finding Code by File:**
```bash
# Search in specific file
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "file:auth_service.dart",
    "collection_id": "<your-collection-id>"
  }'
```

### Advanced Search Tips

**1. Use Natural Language Descriptions**

Instead of:
```
"function with email password"
```

Try:
```
"function that validates user email and password"
```

Code search understands semantic meaning, so describe what the code **does**, not just what it **contains**.

**2. Combine Function Names with Context**

```bash
# Good: Specific with context
"login function in AuthService"

# Better: Include expected behavior
"login function that returns a User object"
```

**3. Search by Implementation Details**

```bash
# Find code that uses specific APIs
"function that calls http.post"

# Find code with specific patterns
"async function that returns Future<User>"

# Find error handling
"function with try-catch error handling"
```

**4. Use Filters to Narrow Results**

```bash
# Search only TypeScript files
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "authentication middleware",
    "collection_id": "<your-collection-id>",
    "tech_stack": ["typescript"]
  }'

# Search across multiple languages
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "user validation",
    "collection_id": "<your-collection-id>",
    "tech_stack": ["dart", "typescript"]
  }'
```

---

## 📊 Understanding Results

### What Makes Code Results Different

Code search results include **rich metadata** that regular document search doesn't provide:

**Standard Search Result:**
```json
{
  "text": "...code snippet...",
  "similarity": 0.85,
  "metadata": {
    "file_path": "lib/services/auth.dart"
  }
}
```

**Code Search Result:**
```json
{
  "text": "Future<User> login(String email, String password) async { ... }",
  "similarity": 0.92,
  "metadata": {
    "file_path": "lib/services/auth_service.dart",
    "chunk_type": "function",
    "function_name": "login",
    "parameters": ["email", "password"],
    "return_type": "Future<User>",
    "class_name": "AuthService",
    "line_range": [45, 67],
    "imports": [
      "package:http/http.dart as http",
      "../models/user.dart"
    ],
    "language": "dart",
    "tech_stack": ["dart", "flutter"]
  }
}
```

### Key Fields in Code Results

**Function Metadata:**
- `function_name`: The function's identifier
- `parameters`: List of parameter names
- `return_type`: What the function returns
- `line_range`: Where in the file this code lives

**Class Metadata:**
- `class_name`: Parent class (if function is a method)
- `methods`: List of method names (if result is a class)
- `properties`: List of property names
- `extends`: Parent class name
- `implements`: List of implemented interfaces

**Context Metadata:**
- `imports`: Required import statements
- `dependencies`: Map of symbols to source files
- `file_path`: Full path to the source file
- `language`: Programming language (dart, typescript, etc.)
- `tech_stack`: Technologies used (flutter, react, etc.)

**Categorization Flags:**
- `is_widget`: True if this is a UI widget (Flutter)
- `is_stateful`: True if stateful widget
- `is_service`: True if service/business logic
- `is_model`: True if data model class

---

## 🔗 Related Files View

### Accessing Related Files

Every code file in Synthesis can have relationships to other files. To view these relationships:

```bash
# Get related files for a document
curl http://localhost:3333/api/documents/{document_id}/related-files
```

**Response:**
```json
{
  "file_path": "lib/services/auth_service.dart",
  "related_files": {
    "imports": [
      "lib/models/user.dart",
      "package:http/http.dart"
    ],
    "imported_by": [
      "lib/screens/login_screen.dart",
      "lib/screens/signup_screen.dart"
    ],
    "tests": [
      "test/services/auth_service_test.dart"
    ],
    "siblings": [
      "lib/services/user_service.dart",
      "lib/services/api_service.dart"
    ]
  }
}
```

### Including Related Files in Search Results

You can automatically include related files in your search results:

```bash
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "login function",
    "collection_id": "<your-collection-id>",
    "include_related_files": true
  }'
```

Each result will now include a `related_files` field with full relationship data.

---

## 🗺️ Navigating Relationships

### Relationship Types Explained

**1. Imports** 📦
- **What:** Files that this file imports
- **Use case:** "What dependencies does this file have?"
- **Example:** `auth_service.dart` imports `user.dart`

```json
{
  "imports": [
    "lib/models/user.dart",
    "package:http/http.dart"
  ]
}
```

**2. Imported By** 🔗
- **What:** Files that import this file
- **Use case:** "What code uses this file?"
- **Example:** `login_screen.dart` imports `auth_service.dart`

```json
{
  "imported_by": [
    "lib/screens/login_screen.dart",
    "lib/screens/signup_screen.dart"
  ]
}
```

**3. Tests** 📝
- **What:** Test files associated with this source file
- **Use case:** "Where are the tests for this code?"
- **Example:** `auth_service_test.dart` tests `auth_service.dart`

```json
{
  "tests": [
    "test/services/auth_service_test.dart"
  ]
}
```

**4. Siblings** 👥
- **What:** Other files in the same directory
- **Use case:** "What related code lives nearby?"
- **Example:** Files in `lib/services/`

```json
{
  "siblings": [
    "lib/services/user_service.dart",
    "lib/services/api_service.dart",
    "lib/services/storage_service.dart"
  ]
}
```

### Following Relationship Chains

Once you have a search result, you can navigate the codebase by following relationships:

**Step 1: Find the entry point**
```bash
# Search for main functionality
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "user authentication",
    "collection_id": "<collection-id>"
  }'
# Returns: auth_service.dart
```

**Step 2: Explore dependencies**
```bash
# Get related files
curl http://localhost:3333/api/documents/{auth_service_doc_id}/related-files

# Shows:
# - imports: [user.dart, token.dart]
# - imported_by: [login_screen.dart, signup_screen.dart]
# - tests: [auth_service_test.dart]
```

**Step 3: Dive into related code**
```bash
# Search for specific related file
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "file:user.dart User model",
    "collection_id": "<collection-id>"
  }'
```

**Step 4: Check usage**
```bash
# Find where auth_service is used
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "file:login_screen.dart AuthService",
    "collection_id": "<collection-id>"
  }'
```

This workflow allows you to navigate your codebase semantically, following the natural structure of your application.

---

## 🏷️ Tech Stack Filtering

### Searching by Language or Framework

Tech stack filtering allows you to narrow your search to specific programming languages or frameworks. This is especially useful in polyglot projects.

**Supported Languages:**
- `dart`
- `typescript`
- `tsx`
- `javascript`
- `jsx`
- `python`
- `java`
- `yaml`
- `sql`
- `json`
- `markdown`

**Supported Frameworks:**
- `flutter`
- `react`
- `fastify`
- `postgres`
- `supabase`
- `firebase`

### Single Language Search

```bash
# Search only TypeScript code
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "authentication middleware",
    "collection_id": "<your-collection-id>",
    "tech_stack": ["typescript"]
  }'
```

### Multi-Language Search

```bash
# Search Dart and TypeScript code
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "user validation function",
    "collection_id": "<your-collection-id>",
    "tech_stack": ["dart", "typescript"]
  }'
```

### Framework-Specific Search

```bash
# Find Flutter widgets only
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "login screen widget",
    "collection_id": "<your-collection-id>",
    "tech_stack": ["flutter"]
  }'

# Find React components
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "user profile component",
    "collection_id": "<your-collection-id>",
    "tech_stack": ["react"]
  }'
```

### Combining Filters with Other Parameters

```bash
# TypeScript + high similarity threshold + related files
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "API route handler",
    "collection_id": "<your-collection-id>",
    "tech_stack": ["typescript"],
    "min_similarity": 0.8,
    "include_related_files": true,
    "top_k": 10
  }'
```

### How Tech Stack Filtering Works

The `tech_stack` filter matches against chunk metadata that's automatically extracted during ingestion:

1. **Language detection** from file extension (`.ts` → `typescript`)
2. **Framework detection** from imports and patterns
3. **Tech tags** stored in `metadata.tech_stack` array

**Example metadata:**
```json
{
  "language": "typescript",
  "tech_stack": ["typescript", "fastify", "postgres"],
  "file_path": "apps/server/src/routes/auth.ts"
}
```

The filter performs **case-insensitive matching**, so `["TypeScript"]` and `["typescript"]` work the same way.

---

## 🎯 Best Practices

### Ingesting Code Collections

**1. Create a Dedicated Code Collection**

```bash
# Create collection for your codebase
curl -X POST http://localhost:3333/api/collections \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "My Flutter App",
    "description": "20,000+ files from my production Flutter codebase"
  }'
```

**2. Enable Code Chunking (if not already enabled)**

Add to your `.env`:
```bash
# Enable code-aware chunking
CODE_CHUNKING=true

# Include imports with code
PRESERVE_IMPORTS=true

# Track file relationships (optional, adds ~50ms per file)
TRACK_RELATIONSHIPS=true

# Maximum lines per chunk (default: 100)
CODE_MAX_CHUNK_LINES=100
```

Restart the server after changing `.env`:
```bash
pnpm --filter @synthesis/server dev
```

**3. Ingest Your Code**

```bash
# Get collection ID from previous step
COLLECTION_ID="<your-collection-id>"

# Ingest single file
curl -X POST http://localhost:3333/api/ingest \
  -F "file=@lib/services/auth_service.dart;type=text/plain" \
  -F "collection_id=$COLLECTION_ID"

# Ingest entire directory (bash)
for file in lib/**/*.dart; do
  curl -X POST http://localhost:3333/api/ingest \
    -F "file=@$file;type=text/plain" \
    -F "collection_id=$COLLECTION_ID"
done

# Or use the agent to fetch from a Git repository
curl -X POST http://localhost:3333/api/agent/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "Clone and ingest https://github.com/myuser/myrepo",
    "collection_id": "'$COLLECTION_ID'"
  }'
```

**4. Wait for Processing**

Ingestion is asynchronous. Check status:
```bash
# Check document status
curl http://localhost:3333/api/collections/$COLLECTION_ID/documents

# Status values: pending → extracting → chunking → embedding → complete
```

### Organizing Code Collections

**Strategy 1: Monorepo Approach**
- One collection for entire codebase
- Use tech_stack filters to narrow searches
- Good for: Small-to-medium projects (<10,000 files)

**Strategy 2: Multi-Collection Approach**
- Separate collections per microservice or module
- Cleaner organization, faster searches
- Good for: Large projects with distinct modules

**Strategy 3: Hybrid Approach**
- Main collection for core code
- Separate collections for tests, docs, examples
- Good for: Balanced organization and search speed

### Query Tips for Better Results

**DO:**
- ✅ Describe the functionality you're looking for
- ✅ Include expected return types or parameters
- ✅ Use class/file names if you know them
- ✅ Combine natural language with specific terms
- ✅ Use tech_stack filters to narrow results

**DON'T:**
- ❌ Search for variable names (too specific)
- ❌ Include full file paths (use `file:` prefix instead)
- ❌ Search for single keywords without context
- ❌ Expect exact code matches (semantic search, not regex)
- ❌ Search for comments (search for functionality instead)

### Performance Tips

**For Large Codebases (10,000+ files):**

```bash
# Disable relationship tracking to speed up ingestion
TRACK_RELATIONSHIPS=false

# Use smaller chunks for faster embedding
CODE_MAX_CHUNK_LINES=75

# Consider batching ingestion (100 files at a time)
```

**For Maximum Accuracy:**

```bash
# Enable all features
CODE_CHUNKING=true
PRESERVE_IMPORTS=true
TRACK_RELATIONSHIPS=true

# Use larger chunks for more context
CODE_MAX_CHUNK_LINES=150
```

**For Fastest Search:**

```bash
# Use tech_stack filters to narrow scope
# Increase min_similarity to get fewer, better results
# Reduce top_k to return fewer results
```

---

## 💡 Examples

### Example 1: Find All Authentication Functions

**Scenario:** You need to audit all authentication-related code in your TypeScript backend.

```bash
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "authentication and authorization functions",
    "collection_id": "<collection-id>",
    "tech_stack": ["typescript"],
    "top_k": 20,
    "include_related_files": true
  }' | jq '.results[] | {
    function: .metadata.function_name,
    file: .metadata.file_path,
    line: .metadata.line_range,
    imports: .metadata.imports
  }'
```

**Expected Results:**
```json
[
  {
    "function": "authenticate",
    "file": "apps/server/src/middleware/auth.ts",
    "line": [15, 42],
    "imports": ["jsonwebtoken", "../config/auth"]
  },
  {
    "function": "validateToken",
    "file": "apps/server/src/services/token.ts",
    "line": [30, 55],
    "imports": ["jsonwebtoken"]
  }
]
```

### Example 2: Explore a Specific File

**Scenario:** You want to see all functions and classes in a specific service file.

```bash
# Search for the file
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "file:user_service.dart",
    "collection_id": "<collection-id>",
    "top_k": 50
  }'

# Get document ID from results, then fetch related files
curl http://localhost:3333/api/documents/{document_id}/related-files
```

**Use Case:** Understanding a new file before making changes.

### Example 3: Find Widget Hierarchy (Flutter)

**Scenario:** You need to understand how login UI components are structured.

```bash
# Find main login widget
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "LoginScreen StatefulWidget",
    "collection_id": "<collection-id>",
    "tech_stack": ["flutter"]
  }'

# Get related files to see child widgets
curl http://localhost:3333/api/documents/{login_screen_doc_id}/related-files

# Search for child widgets
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "file:login_form.dart EmailInput PasswordInput widgets",
    "collection_id": "<collection-id>"
  }'
```

### Example 4: Track API Changes

**Scenario:** An API endpoint changed, and you need to find all code that calls it.

```bash
# Find the API endpoint definition
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "POST /api/users endpoint handler",
    "collection_id": "<collection-id>",
    "tech_stack": ["typescript"]
  }'

# Get files that import the API module
curl http://localhost:3333/api/documents/{api_doc_id}/related-files

# Search for usage in client code
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "http.post users API call",
    "collection_id": "<collection-id>",
    "tech_stack": ["dart"]
  }'
```

### Example 5: Find Test Coverage

**Scenario:** Identify which services have tests and which don't.

```bash
# Get all service files
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "file:services class",
    "collection_id": "<collection-id>",
    "include_related_files": true,
    "top_k": 100
  }' | jq '.results[] | select(.related_files.tests == []) | .metadata.file_path'
```

This returns all service files without associated test files.

### Example 6: Search Across Frontend and Backend

**Scenario:** Find where a specific data model is defined and used.

```bash
# Find model definition
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "User model class with email and password fields",
    "collection_id": "<collection-id>",
    "tech_stack": ["dart", "typescript"]
  }'

# Find usage in TypeScript backend
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "function that creates or validates User object",
    "collection_id": "<collection-id>",
    "tech_stack": ["typescript"]
  }'

# Find usage in Dart frontend
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "User fromJson or toJson serialization",
    "collection_id": "<collection-id>",
    "tech_stack": ["dart"]
  }'
```

---

## 🔧 Troubleshooting

### "No results found"

**Possible causes:**
1. Code not indexed yet (check ingestion status)
2. Query too specific (try broader terms)
3. Wrong collection selected
4. Tech stack filter too restrictive

**Solutions:**
```bash
# Check document status
curl http://localhost:3333/api/collections/<collection-id>/documents

# Try broader query without filters
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "login",
    "collection_id": "<collection-id>"
  }'

# Remove tech_stack filter
```

### "Results don't include imports"

**Cause:** `PRESERVE_IMPORTS` is disabled or code wasn't chunked with code chunking enabled.

**Solution:**
```bash
# Enable in .env
PRESERVE_IMPORTS=true

# Restart server
pnpm --filter @synthesis/server dev

# Re-ingest files
```

### "Related files not showing"

**Possible causes:**
1. `TRACK_RELATIONSHIPS` disabled during ingestion
2. Files ingested before relationship tracking was enabled
3. `include_related_files: false` in search request

**Solutions:**
```bash
# Enable relationship tracking
TRACK_RELATIONSHIPS=true

# Restart server
pnpm --filter @synthesis/server dev

# Re-ingest files
# OR: Include in search request
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "login function",
    "collection_id": "<collection-id>",
    "include_related_files": true
  }'
```

### "Tech stack filter not working"

**Cause:** Metadata not set during ingestion or wrong tag names.

**Solution:**
```bash
# Check chunk metadata
curl http://localhost:3333/api/documents/<doc-id>/chunks | \
  jq '.chunks[0].metadata.tech_stack'

# Should return: ["dart", "flutter"] or similar

# If null, code was ingested before Phase 13
# Re-ingest to get proper metadata
```

### "Search is slow"

**Possible causes:**
1. Large collection (50,000+ chunks)
2. No tech_stack filtering
3. Low min_similarity (returns too many results)
4. Including related files for large result sets

**Solutions:**
```bash
# Use tech_stack filter to reduce search space
"tech_stack": ["typescript"]

# Increase min_similarity
"min_similarity": 0.75

# Reduce top_k
"top_k": 10

# Disable related files if not needed
"include_related_files": false
```

### "Code chunking not applied"

**Symptom:** Functions are split across multiple chunks.

**Cause:** `CODE_CHUNKING` was disabled during ingestion.

**Solution:**
```bash
# Check environment
echo $CODE_CHUNKING  # Should be "true"

# If false, enable it
CODE_CHUNKING=true

# Restart server
pnpm --filter @synthesis/server dev

# Re-ingest files
```

### "Unsupported content type" errors

**Cause:** Code files uploaded without proper MIME type.

**Solution:**
```bash
# Use text/plain MIME type for code files
curl -X POST http://localhost:3333/api/ingest \
  -F "file=@app.ts;type=text/plain" \
  -F "collection_id=$COLLECTION_ID"

# Or rely on automatic fallback (works for .ts, .tsx, .js, .jsx, .dart)
```

---

## 📚 Related Documentation

**Technical Implementation:**
- [Code Chunking Guide](../CODE_CHUNKING_GUIDE.md) - How AST chunking works
- [Phase 13 Overview](../phases/phase-13/00_PHASE_13_OVERVIEW.md) - Feature design and architecture
- [File Relationships](../phases/phase-13/03_FILE_RELATIONSHIPS.md) - Relationship tracking details

**API Reference:**
- [API Specification](../05_API_SPEC.md) - Complete API documentation
- [Search API](../05_API_SPEC.md#search) - Search endpoint parameters

**Setup & Configuration:**
- [Environment Setup](../10_ENV_SETUP.md) - Configuration guide
- [CLAUDE.md](../../CLAUDE.md) - Development workflow

---

## 🚀 Next Steps

**After mastering code search:**
1. **Phase 14:** Advanced reranking for even better results
2. **Phase 15:** Performance optimizations for 100,000+ file codebases
3. **Frontend UI:** Use the web interface for visual code exploration

**Get Help:**
- GitHub Issues: Report bugs or request features
- Documentation: Check `/docs/` for detailed guides
- Examples: See `apps/server/src/pipeline/__tests__/fixtures/` for sample code

---

**Phase 13: Code Intelligence** ✅
*Making code searchable, usable, and contextual*
