# Code Chunking Guide

**Phase 13 Feature**: AST-based code chunking that preserves code structure

---

## Overview

Code chunking is an intelligent document processing feature that preserves code structure when ingesting source files. Instead of breaking code at arbitrary character counts, it uses Abstract Syntax Tree (AST) parsing to chunk code at natural boundaries (functions, classes, methods).

### Why Code Chunking?

**Traditional text chunking problems:**
- Functions split mid-way through
- Imports separated from code
- Context lost across chunks
- Search returns incomplete code snippets

**Code chunking benefits:**
- ✅ Functions remain intact
- ✅ Imports preserved with code
- ✅ Classes chunked intelligently
- ✅ Search returns complete, usable code
- ✅ File relationships tracked

---

## Supported Languages

| Language | Status | Parser Type | Accuracy |
|----------|--------|-------------|----------|
| **Dart** | ✅ Stable | Regex-based AST | 95%+ |
| **TypeScript** | ✅ Stable | TS Compiler API | 90%+ |
| **JavaScript** | ✅ Stable | TS Compiler API | 90%+ |
| **JSX/TSX** | ✅ Stable | TS Compiler API | 90%+ |

**Other languages:** Automatically fall back to simple text chunking

---

## How to Enable

### Environment Variables

Add to your `.env` file:

```bash
# Enable code-aware chunking
CODE_CHUNKING=true
# Preserve import blocks for better context linking
PRESERVE_IMPORTS=true
# Disable relationship tracking if you only need chunk timing data
TRACK_RELATIONSHIPS=false
# Safe default for maximum lines per code chunk
CODE_MAX_CHUNK_LINES=100
```

---

## Quickstart (Local Dev)

1) Start infrastructure and run migrations
```bash
cd /home/kngpnn/dev/synthesis
pnpm install
pnpm docker:down || true
pnpm docker:dev
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/synthesis"
pnpm --filter @synthesis/db migrate
```

2) Start backend and (optional) frontend
```bash
# Backend (Fastify on 3333)
pnpm --filter @synthesis/server dev
# Health: http://localhost:3333/health

# Frontend (Vite on 5173)
pnpm --filter @synthesis/web dev
# Open: http://localhost:5173
```

3) Minimal ingest (UUID collection_id; use text/* for code or rely on extractor fallback)
```bash
# Create collection
COLLECTION_JSON=$(curl -s -X POST http://localhost:3333/api/collections \
  -H 'Content-Type: application/json' \
  -d '{"name":"quickstart","description":"local test"}')
COLLECTION_ID=$(echo "$COLLECTION_JSON" | jq -r '.collection.id')

# Ingest code file (text/* MIME ensures extractor accepts it)
curl -s -X POST http://localhost:3333/api/ingest \
  -F "file=@apps/server/src/pipeline/__tests__/fixtures/sample.ts;type=text/plain" \
  -F "collection_id=$COLLECTION_ID"
```

4) Verify with SQL (doc_id, not document_id)
```bash
psql "$DATABASE_URL" -c "
  SELECT id, title, status, error_message
  FROM documents
  WHERE collection_id = '$COLLECTION_ID'
  ORDER BY created_at DESC
  LIMIT 5;
"

DOC_ID=$(psql "$DATABASE_URL" -t -A -c "
  SELECT id FROM documents
  WHERE collection_id = '$COLLECTION_ID'
  ORDER BY created_at DESC
  LIMIT 1;")

psql "$DATABASE_URL" -c "
  SELECT COUNT(*) AS chunk_count
  FROM chunks
  WHERE doc_id = '$DOC_ID';
"
```

---

## Chat Setup (Agent)

- Provide one LLM provider key and restart the server:
  - Anthropic:
    ```bash
    # .env
    ANTHROPIC_API_KEY=sk-ant-...
    ```
  - OpenAI:
    ```bash
    # .env
    OPENAI_API_KEY=sk-...
    ```
  - Local Ollama (no external API key):
    ```bash
    # .env
    OLLAMA_BASE_URL=http://localhost:11434
    # pull a chat model once:
    ollama pull llama3.1:8b
    ```
- After updating .env, restart: `pnpm --filter @synthesis/server dev`
- If chat shows `AGENT_ERROR`, check server logs for missing key/model and fix accordingly.

---

## Troubleshooting Quick Reference

- “Unsupported content type” on code files
  - Upload with `text/*` MIME (`.ts → text/plain`, `.js → text/javascript`, `.jsx → text/jsx`), or rely on the extractor fallback (added for `.ts/.tsx/.js/.jsx/.dart`).

- “current transaction is aborted”
  - Restart DB container (`docker compose restart synthesis-db`), re-run the failed ingests. Capture and fix the first real error that triggered the abort.

- Nothing persists after successful API responses
  - Ensure the server and your shell share the same `DATABASE_URL`. If you added it to `~/.bashrc`, start a new terminal or `source ~/.bashrc`.
  - Always run migrations before the server on a fresh DB.
  - Query `chunks` with `doc_id` column.

- Port 3333 already in use
  - `lsof -i:3333 -t | xargs -r kill -9` or run `SERVER_PORT=3334 pnpm --filter @synthesis/server dev`.

- Slow/empty results for large files
  - Verify `CODE_MAX_CHUNK_LINES` and feature flags. For very large classes, per-method chunking reduces chunk size.


# Include imports in chunks (recommended)
PRESERVE_IMPORTS=true

# Track file relationships (optional)
TRACK_RELATIONSHIPS=false

# Max lines per chunk (default: 100)
CODE_MAX_CHUNK_LINES=100
```

### Quick Start

```bash
# 1. Update .env
CODE_CHUNKING=true
PRESERVE_IMPORTS=true

# 2. Restart server
pnpm --filter @synthesis/server dev

# 3. Ingest code files
curl -X POST http://localhost:3333/api/ingest \
  -F "file=@auth_service.dart" \
  -F "collection_id=<uuid>"
```

---

## Feature Flags

### CODE_CHUNKING

**Default:** `false`

When enabled, uses AST parsing to chunk code files. When disabled or for unsupported languages, falls back to simple text chunking.

**Example:**
```bash
# Enable code chunking
CODE_CHUNKING=true

# Disable (use simple chunking)
CODE_CHUNKING=false
```

### PRESERVE_IMPORTS

**Default:** `true`

Includes import statements in chunk metadata. This ensures code chunks have context about their dependencies.

**Chunk metadata with imports:**
```json
{
  "chunk_type": "function",
  "function_name": "login",
  "imports": [
    "package:flutter/material.dart",
    "../models/user.dart"
  ]
}
```

### TRACK_RELATIONSHIPS

**Default:** `false`

Builds a file relationship graph tracking imports, test files, and siblings. Useful for large codebases.

**Query relationships:**
```bash
curl http://localhost:3333/api/documents/{id}/related-files
```

**Response:**
```json
{
  "file_path": "lib/services/auth.dart",
  "related_files": {
    "imports": ["lib/models/user.dart"],
    "imported_by": ["lib/screens/login.dart"],
    "tests": ["test/services/auth_test.dart"],
    "siblings": ["lib/services/api.dart"]
  }
}
```

### CODE_MAX_CHUNK_LINES

**Default:** `100`

Maximum number of lines per chunk. Large functions/classes exceeding this limit are split at method boundaries.

```bash
# Allow larger chunks (more context)
CODE_MAX_CHUNK_LINES=200

# Smaller chunks (faster embedding)
CODE_MAX_CHUNK_LINES=50
```

---

## Examples

### Example 1: Ingest Dart File

```bash
# Create collection
COLLECTION_ID=$(curl -s -X POST http://localhost:3333/api/collections \
  -H 'Content-Type: application/json' \
  -d '{"name":"flutter-app","description":"My Flutter app"}' \
  | jq -r '.collection.id')

# Ingest Dart file with text/plain MIME type
curl -X POST http://localhost:3333/api/ingest \
  -F "file=@lib/services/auth_service.dart;type=text/plain" \
  -F "collection_id=$COLLECTION_ID"

# Result: Functions chunked separately with imports preserved
```

### Example 2: Ingest TypeScript Project

```bash
# Ingest multiple TypeScript files
for file in src/**/*.ts; do
  curl -X POST http://localhost:3333/api/ingest \
    -F "file=@$file;type=text/plain" \
    -F "collection_id=$COLLECTION_ID"
done
```

### Example 3: Search for Code

```bash
# Search finds complete functions
curl -X POST http://localhost:3333/api/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "authentication function",
    "collection_id": "'$COLLECTION_ID'"
  }' | jq '.results[0]'
```

**Result includes:**
- Complete function code
- Import statements
- Line numbers
- File path

---

## How It Works

### 1. File Detection

When a file is uploaded, the system checks:
- File extension (`.dart`, `.ts`, `.tsx`, `.js`, `.jsx`)
- `CODE_CHUNKING` environment variable

### 2. AST Parsing

**Dart:** Regex-based parser extracts:
- Imports
- Top-level functions
- Classes and methods
- Constants

**TypeScript/JavaScript:** TS Compiler API extracts:
- Imports/exports
- Functions (regular, arrow, async)
- Classes and methods
- Interfaces and types

### 3. Chunking

**Small items:** Kept whole if under `CODE_MAX_CHUNK_LINES`

**Large classes:** Split at method boundaries

**Functions:** Always kept intact (never split mid-function)

### 4. Metadata Enrichment

Each chunk includes:
```json
{
  "chunk_type": "function",
  "function_name": "login",
  "class_name": "AuthService",
  "parameters": ["email", "password"],
  "return_type": "Future<User>",
  "line_range": [15, 28],
  "imports": ["..."]
}
```

### 5. Fallback Behavior

If parsing fails (invalid syntax, unsupported features):
- ✅ Logs warning
- ✅ Falls back to simple text chunking
- ✅ Document still processes successfully
- ✅ No data loss

---

## Performance

### Benchmarks (Phase 13 Day 5)

| Metric | Dart | TypeScript | Status |
|--------|------|------------|--------|
| Average parse time | 2ms | 3ms | ✅ Excellent |
| P90 parse time | 2ms | 7ms | ✅ Well under 500ms target |
| Success rate | 100% | 100% | ✅ All files parsed |

**Tested on:** Node.js v22, test fixtures + real project files

### Performance Characteristics

- **Parse overhead:** ~2-3ms per file (negligible)
- **Chunking overhead:** ~2-3x simple chunking
- **Memory:** No significant increase
- **Scalability:** Handles 1000+ files without issues

---

## Troubleshooting

### Code Chunking Not Working

**Check environment variables:**
```bash
# In server logs, should see:
Using code-aware chunking for lib/services/auth.dart
```

**If not:**
1. Verify `CODE_CHUNKING=true` in `.env`
2. Restart server
3. Check file extension is supported

### Parse Errors

**Symptom:** Logs show "falling back to simple chunking"

**Cause:** Invalid syntax or unsupported language features

**Solution:**
- ✅ File still processes (fallback works)
- Check syntax validity in source file
- Report edge cases as issues

### Import Preservation Not Working

**Check:**
```bash
# Query a chunk
curl http://localhost:3333/api/documents/{id}/chunks | \
  jq '.chunks[0].metadata.imports'

# Should return array of imports
# If null, check PRESERVE_IMPORTS=true
```

### Relationship Tracking Not Working

**Check:**
```bash
# Verify flag enabled
echo $TRACK_RELATIONSHIPS  # Should be "true"

# Check database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM file_relationships;"
```

### Performance Issues

**If parsing is slow (>500ms per file):**

1. **Check file size:**
   ```bash
   wc -l <file>  # Should be <5000 lines
   ```

2. **Reduce CODE_MAX_CHUNK_LINES:**
   ```bash
   CODE_MAX_CHUNK_LINES=50
   ```

3. **Check system resources:**
   ```bash
   top  # CPU usage
   ```

---

## Advanced Usage

### Custom Chunking Parameters

```typescript
// In code (if extending the system)
const chunks = await chunkCodeFile(filePath, content, {
  maxChunkSize: 150,
  preserveImports: true,
  trackRelationships: true,
  db: pool,
  collectionId: uuid,
});
```

### Querying Chunks by Type

```sql
-- Find all function chunks
SELECT * FROM chunks 
WHERE metadata->>'chunk_type' = 'function'
LIMIT 10;

-- Find chunks with imports
SELECT * FROM chunks
WHERE metadata->'imports' IS NOT NULL;

-- Find large chunks
SELECT 
  metadata->>'function_name',
  LENGTH(text) as size
FROM chunks
WHERE metadata->>'chunk_type' = 'function'
ORDER BY size DESC
LIMIT 10;
```

### Analyzing Relationships

```sql
-- Top imported files
SELECT 
  target_file,
  COUNT(*) as import_count
FROM file_relationships
WHERE relationship_type = 'import'
GROUP BY target_file
ORDER BY import_count DESC
LIMIT 10;
```

---

## Limitations

### Current Limitations

1. **Dart parsing is regex-based**
   - Not a full AST parser
   - May miss complex nested structures
   - 95% accuracy on well-formed code

2. **Relationship tracking is basic**
   - Import relationships: ✅ Full support
   - Usage relationships: ⚠️ Placeholder (future)
   - Test detection: ⚠️ Pattern-based

3. **Languages supported**
   - Only Dart and TypeScript/JavaScript
   - Other languages use simple chunking
   - Can add more languages in future

### Known Edge Cases

**Dart:**
- Complex nested classes may not chunk optimally
- Dynamic `import()` not tracked
- Part files not linked to main file

**TypeScript:**
- Decorators parsed but not fully analyzed
- Complex generics may affect chunking
- Dynamic imports tracked as strings

---

## FAQ

### Q: Should I enable code chunking for all collections?

**A:** Enable for code-heavy collections (repositories, tutorials with code examples). Disable for documentation-only collections.

### Q: Does code chunking work with existing collections?

**A:** No, chunking happens at ingestion time. Re-ingest documents to apply code chunking.

### Q: Can I mix code chunking and simple chunking?

**A:** Yes! Toggle `CODE_CHUNKING` per ingestion session. Collections can contain both types.

### Q: What happens if parsing fails?

**A:** Automatic fallback to simple text chunking. No data loss, no failed ingestions.

### Q: Does this work with the MCP server?

**A:** Yes! MCP tools return code with preserved structure and imports.

### Q: How do I know if code chunking is working?

**A:** Check server logs for "Using code-aware chunking" or query chunk metadata:
```bash
curl http://localhost:3333/api/documents/{id}/chunks | \
  jq '.chunks[0].metadata.chunk_type'
# Should return "function", "class", or "method"
```

---

## Migration Guide

### From Simple Chunking to Code Chunking

1. **Enable feature flags:**
   ```bash
   CODE_CHUNKING=true
   PRESERVE_IMPORTS=true
   ```

2. **Restart server**

3. **Re-ingest code files:**
   - Delete old documents or create new collection
   - Upload files again with code chunking enabled

4. **Verify:**
   ```bash
   # Check chunk types
   curl http://localhost:3333/api/documents/{id}/chunks | \
     jq '.chunks[] | .metadata.chunk_type' | sort | uniq -c
   ```

### Reverting to Simple Chunking

```bash
# Disable code chunking
CODE_CHUNKING=false

# Restart server
# New ingestions will use simple chunking
```

---

## Performance Tuning

### For Large Codebases (1000+ files)

```bash
# Disable relationship tracking (faster ingestion)
TRACK_RELATIONSHIPS=false

# Use smaller chunks (faster embedding)
CODE_MAX_CHUNK_LINES=75

# Consider batching ingestion
# (ingest 100 files, wait, ingest next 100)
```

### For Maximum Accuracy

```bash
# Enable all features
CODE_CHUNKING=true
PRESERVE_IMPORTS=true
TRACK_RELATIONSHIPS=true

# Larger chunks (more context)
CODE_MAX_CHUNK_LINES=150
```

---

## Support

**Issues:** GitHub Issues  
**Docs:** `docs/phases/phase-13/`  
**Tests:** `apps/server/src/pipeline/__tests__/`

**Related Documentation:**
- [Phase 13 Overview](./phases/phase-13/00_PHASE_13_OVERVIEW.md)
- [Architecture](./phases/phase-13/01_CODE_CHUNKING_ARCHITECTURE.md)
- [Benchmark Results](./phases/phase-13/PHASE_13_BENCHMARK_RESULTS.md)

---

**Phase 13: Code Intelligence** ✅  
*Making code searchable, usable, and contextual*
