# Troubleshooting Guide

This guide covers common issues encountered in the Synthesis RAG system across all phases (1-15). Each issue includes symptoms, diagnosis steps, solutions, and verification commands.

---

## Table of Contents

1. [How to Use This Guide](#how-to-use-this-guide)
2. [Search Issues](#search-issues)
3. [Cost Tracking Issues](#cost-tracking-issues)
4. [Code Chunking Issues](#code-chunking-issues)
5. [Re-ranking Issues](#re-ranking-issues)
6. [Synthesis Issues](#synthesis-issues)
7. [Embedding Issues](#embedding-issues)
8. [Database Issues](#database-issues)
9. [Performance Issues](#performance-issues)
10. [Configuration Issues](#configuration-issues)

---

## How to Use This Guide

### Quick Diagnosis

1. **Check logs first**: Most errors provide detailed console output
2. **Verify environment variables**: Many issues stem from missing or incorrect `.env` settings
3. **Test individual components**: Isolate the failing component before debugging the full pipeline
4. **Enable debug mode**: Set `NODE_ENV=development` for verbose logging

### When to File an Issue

File a GitHub issue if:
- The problem persists after following this guide
- You've discovered a bug not covered here
- You have a feature request or enhancement
- You need help with a complex configuration

### Debug Mode

Enable debug logging for detailed output:

```bash
# Server with debug logging
NODE_ENV=development \
DEBUG=synthesis:* \
pnpm --filter @synthesis/server dev
```

---

## Search Issues

### Issue: Hybrid Search Not Working

**Symptom:**
- Search results are identical to vector-only mode
- BM25 scores are all 0 or undefined
- Metadata shows `searchMode: "vector"` when `SEARCH_MODE=hybrid`

**Diagnosis:**

```bash
# 1. Check environment variable
echo $SEARCH_MODE
# Expected: hybrid

# 2. Verify BM25 indexes exist
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE tablename = 'chunks'
    AND indexname LIKE '%tsv%' OR indexname LIKE '%trgm%';"

# 3. Check if pg_trgm extension is enabled
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\dx"
# Should show: pg_trgm | vector | pgcrypto
```

**Solution:**

```bash
# 1. Ensure SEARCH_MODE is set in .env
echo "SEARCH_MODE=hybrid" >> .env

# 2. Run migration 004 if indexes are missing
pnpm --filter @synthesis/db migrate

# 3. Verify migration applied
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT tablename, indexname
  FROM pg_indexes
  WHERE indexname IN ('chunks_text_tsv_idx', 'chunks_text_trgm_idx');"

# 4. Restart server to pick up env changes
pnpm --filter @synthesis/server dev
```

**Verification:**

```bash
# Test hybrid search via API
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "how to configure database",
    "collectionId": "YOUR_COLLECTION_ID",
    "mode": "hybrid"
  }' | jq '.metadata'

# Expected output:
# {
#   "searchMode": "hybrid",
#   "vectorCount": 10,
#   "bm25Count": 8,
#   "fusedCount": 10,
#   "embeddingProvider": "ollama"
# }
```

---

### Issue: No Search Results Returned

**Symptom:**
- Search returns empty results array
- `totalResults: 0` in response
- Error: "No documents found in collection"

**Diagnosis:**

```bash
# 1. Check if collection has documents
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT c.name, COUNT(d.id) as doc_count, COUNT(ch.id) as chunk_count
  FROM collections c
  LEFT JOIN documents d ON c.id = d.collection_id
  LEFT JOIN chunks ch ON d.id = ch.doc_id
  WHERE c.id = 'YOUR_COLLECTION_ID'
  GROUP BY c.name;"

# 2. Check document processing status
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT status, COUNT(*)
  FROM documents
  WHERE collection_id = 'YOUR_COLLECTION_ID'
  GROUP BY status;"

# 3. Check if embeddings exist
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT COUNT(*) as chunks_with_embeddings
  FROM chunks ch
  JOIN documents d ON ch.doc_id = d.id
  WHERE d.collection_id = 'YOUR_COLLECTION_ID'
    AND ch.embedding IS NOT NULL;"
```

**Solution:**

```bash
# If documents exist but status is 'pending' or 'error':
# 1. Check server logs for ingestion errors
docker compose logs synthesis-server | grep -i error

# 2. Re-process failed documents via API
curl -X POST http://localhost:3333/api/documents/{DOCUMENT_ID}/reprocess

# If no documents exist:
# 1. Upload a document
curl -X POST http://localhost:3333/api/ingest \
  -F "file=@path/to/document.pdf" \
  -F "collectionId=YOUR_COLLECTION_ID"

# 2. Wait for processing to complete (check status)
curl http://localhost:3333/api/documents/{DOCUMENT_ID}
```

**Verification:**

```bash
# Verify chunks have embeddings
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT
    d.title,
    COUNT(ch.id) as chunk_count,
    COUNT(ch.embedding) as embedding_count,
    d.status
  FROM documents d
  LEFT JOIN chunks ch ON d.id = ch.doc_id
  WHERE d.collection_id = 'YOUR_COLLECTION_ID'
  GROUP BY d.id, d.title, d.status;"

# Expected: chunk_count = embedding_count, status = 'complete'
```

---

### Issue: BM25 Not Working

**Symptom:**
- Hybrid search works but BM25 scores are always 0
- Only vector results returned
- Error: "function to_tsvector(unknown, text) does not exist"

**Diagnosis:**

```bash
# 1. Check FTS_LANGUAGE setting
echo $FTS_LANGUAGE
# Expected: english (or your language)

# 2. Verify tsvector index exists
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT schemaname, tablename, indexname, indexdef
  FROM pg_indexes
  WHERE tablename = 'chunks' AND indexname = 'chunks_text_tsv_idx';"

# 3. Test tsvector function directly
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT to_tsvector('english', 'test query');"
```

**Solution:**

```bash
# 1. Set FTS_LANGUAGE in .env
echo "FTS_LANGUAGE=english" >> .env

# 2. Drop and recreate index if language changed
docker compose exec synthesis-db psql -U postgres -d synthesis <<EOF
DROP INDEX IF EXISTS chunks_text_tsv_idx;
CREATE INDEX chunks_text_tsv_idx ON chunks
  USING gin (to_tsvector('english', text));
EOF

# 3. Restart server
pnpm --filter @synthesis/server dev
```

**Verification:**

```bash
# Test BM25 search directly
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT
    text,
    ts_rank(to_tsvector('english', text), to_tsquery('english', 'database')) as rank
  FROM chunks
  WHERE to_tsvector('english', text) @@ to_tsquery('english', 'database')
  LIMIT 5;"

# Should return results with non-zero ranks
```

---

### Issue: Tech Stack Filter Not Working

**Symptom:**
- Search results don't filter by tech stack
- `techStack` parameter ignored
- All results returned regardless of tech stack

**Diagnosis:**

```bash
# 1. Check if TECH_STACK_TAGS is enabled
echo $TECH_STACK_TAGS
# Expected: true

# 2. Verify tech stack metadata exists
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT
    metadata->>'tech_stack' as tech_stack,
    COUNT(*) as chunk_count
  FROM chunks ch
  JOIN documents d ON ch.doc_id = d.id
  WHERE d.collection_id = 'YOUR_COLLECTION_ID'
  GROUP BY metadata->>'tech_stack';"

# 3. Check document metadata
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT title, metadata->'tech_stack' as tech_stack
  FROM documents
  WHERE collection_id = 'YOUR_COLLECTION_ID'
  LIMIT 5;"
```

**Solution:**

```bash
# 1. Enable tech stack detection
echo "TECH_STACK_TAGS=true" >> .env
echo "BACKEND_PARSING=true" >> .env

# 2. Re-ingest documents to populate tech_stack metadata
# Option A: Re-upload documents
# Option B: Update metadata manually via SQL
docker compose exec synthesis-db psql -U postgres -d synthesis <<EOF
UPDATE documents
SET metadata = metadata || '{"tech_stack": ["flutter", "supabase"]}'::jsonb
WHERE collection_id = 'YOUR_COLLECTION_ID'
  AND metadata->>'framework' = 'flutter';
EOF

# 3. Restart server
pnpm --filter @synthesis/server dev
```

**Verification:**

```bash
# Test tech stack filtering
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "database configuration",
    "collectionId": "YOUR_COLLECTION_ID",
    "techStack": ["supabase"]
  }' | jq '.results[] | .metadata.tech_stack'

# All results should include "supabase" in tech_stack array
```

---

### Issue: Slow Search Queries (>1s)

**Symptom:**
- Search takes more than 1 second
- `searchTimeMs > 1000` in response
- UI feels sluggish

**Diagnosis:**

```bash
# 1. Check if HNSW index exists
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE tablename = 'chunks' AND indexname LIKE '%hnsw%';"

# 2. Check database connection pool
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT count(*) as active_connections
  FROM pg_stat_activity
  WHERE datname = 'synthesis';"

# 3. Enable query timing
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  EXPLAIN ANALYZE
  SELECT embedding <=> '[0,0,0,...]'::vector
  FROM chunks
  ORDER BY embedding <=> '[0,0,0,...]'::vector
  LIMIT 10;"
```

**Solution:**

```bash
# 1. Recreate HNSW index with better parameters
docker compose exec synthesis-db psql -U postgres -d synthesis <<EOF
DROP INDEX IF EXISTS chunks_embedding_hnsw;
CREATE INDEX chunks_embedding_hnsw ON chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
EOF

# 2. Vacuum and analyze
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  VACUUM ANALYZE chunks;"

# 3. Enable caching if not already enabled
echo "SEARCH_CACHE_TTL_SECONDS=1800" >> .env
echo "SEARCH_CACHE_MAX_ITEMS=500" >> .env

# 4. Restart services
docker compose restart synthesis-server
```

**Verification:**

```bash
# Benchmark search performance
time curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "database configuration",
    "collectionId": "YOUR_COLLECTION_ID"
  }' | jq '.searchTimeMs'

# Expected: <600ms for vector search, <800ms for hybrid
```

---

## Cost Tracking Issues

### Issue: Cost Tracking Inaccurate

**Symptom:**
- Dashboard shows $0.00 cost despite API usage
- Cost breakdown empty
- Monthly spend not updating

**Diagnosis:**

```bash
# 1. Check if api_usage table exists
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT COUNT(*) as usage_records
  FROM api_usage;"

# 2. Verify recent API calls were tracked
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT provider, operation, tokens_used, cost_usd, created_at
  FROM api_usage
  ORDER BY created_at DESC
  LIMIT 10;"

# 3. Check cost tracker initialization
grep -r "CostTracker" apps/server/src/ | grep "track"
```

**Solution:**

```bash
# 1. Run cost tracking migration if missing
docker compose exec synthesis-db psql -U postgres -d synthesis < \
  packages/db/migrations/003_cost_tracking.sql

# 2. Verify table structure
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\d api_usage"

# 3. Test cost tracking manually
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test query",
    "collectionId": "YOUR_COLLECTION_ID",
    "rerank": true,
    "rerankProvider": "cohere"
  }'

# 4. Verify usage was recorded
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT * FROM api_usage ORDER BY created_at DESC LIMIT 1;"
```

**Verification:**

```bash
# Check monthly spend
curl http://localhost:3333/api/cost/monthly | jq

# Expected output:
# {
#   "month": "2025-11",
#   "spend": 0.15,
#   "budget": 10,
#   "breakdown": [...]
# }
```

---

### Issue: Budget Exceeded but No Fallback

**Symptom:**
- Monthly spend exceeds `MONTHLY_BUDGET_USD`
- Still using paid providers (Cohere, Voyage, OpenAI)
- No cost alerts in logs

**Diagnosis:**

```bash
# 1. Check budget settings
echo $MONTHLY_BUDGET_USD
echo $ENABLE_COST_ALERTS
# Expected: numeric value, true

# 2. Check current spend
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT COALESCE(SUM(cost_usd), 0) as total_spend
  FROM api_usage
  WHERE created_at >= date_trunc('month', NOW());"

# 3. Check for budget alerts
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT alert_type, current_spend_usd, threshold_usd, triggered_at
  FROM budget_alerts
  ORDER BY triggered_at DESC
  LIMIT 5;"

# 4. Check environment overrides
echo $EMBEDDING_PROVIDER_OVERRIDE
echo $RERANKER_PROVIDER_OVERRIDE
```

**Solution:**

```bash
# 1. Enable cost alerts
echo "ENABLE_COST_ALERTS=true" >> .env
echo "MONTHLY_BUDGET_USD=10" >> .env

# 2. Manually trigger fallback mode
docker compose exec synthesis-db psql -U postgres -d synthesis <<EOF
INSERT INTO budget_alerts (alert_type, threshold_usd, current_spend_usd, period)
SELECT 'limit_reached', 10, SUM(cost_usd), 'monthly'
FROM api_usage
WHERE created_at >= date_trunc('month', NOW());
EOF

# 3. Force fallback via environment
echo "EMBEDDING_PROVIDER_OVERRIDE=ollama" >> .env
echo "RERANKER_PROVIDER_OVERRIDE=bge" >> .env
echo "DISABLE_CONTRADICTION_DETECTION=true" >> .env

# 4. Restart server
docker compose restart synthesis-server
```

**Verification:**

```bash
# Verify fallback mode active
grep "fallback mode" <(docker compose logs synthesis-server)
# Expected: "Budget limit reached - enabling fallback mode"

# Test search uses free providers
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test",
    "collectionId": "YOUR_COLLECTION_ID",
    "rerank": true
  }' | jq '.metadata'

# Expected: embeddingProvider: "ollama", rerankProvider: "bge"
```

---

### Issue: Cost Tracker Fallback Not Working

**Symptom:**
- Budget exceeded but still using paid APIs
- Environment overrides not applied
- Costs continue to accumulate

**Diagnosis:**

```bash
# 1. Check if overrides are set
env | grep OVERRIDE

# 2. Check active provider in search response
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "collectionId": "YOUR_COLLECTION_ID"}' \
  | jq '.metadata.embeddingProvider'

# 3. Check logs for fallback activation
docker compose logs synthesis-server | grep -i "fallback\|budget"
```

**Solution:**

```bash
# 1. Explicitly set overrides in .env
cat >> .env <<EOF
EMBEDDING_PROVIDER_OVERRIDE=ollama
RERANKER_PROVIDER_OVERRIDE=bge
DISABLE_CONTRADICTION_DETECTION=true
EOF

# 2. Verify ollama is running
curl http://localhost:11434/api/tags

# 3. Restart server to pick up changes
docker compose restart synthesis-server

# 4. Clear any cached provider selections
docker compose exec synthesis-redis redis-cli FLUSHDB
```

**Verification:**

```bash
# Test embedding provider selection
curl -X POST http://localhost:3333/api/ingest \
  -F "file=@test.txt" \
  -F "collectionId=YOUR_COLLECTION_ID" \
  -F "title=Fallback Test"

# Check document metadata for embedding_provider
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT title, metadata->>'embedding_provider' as provider
  FROM documents
  WHERE title = 'Fallback Test';"

# Expected: provider = 'ollama'
```

---

### Issue: Cost Dashboard Not Loading

**Symptom:**
- Frontend cost dashboard shows loading spinner indefinitely
- Network errors in browser console
- 500 error from `/api/cost/*` endpoints

**Diagnosis:**

```bash
# 1. Check if cost endpoints are accessible
curl http://localhost:3333/api/cost/monthly
curl http://localhost:3333/api/cost/breakdown

# 2. Check server logs for errors
docker compose logs synthesis-server | grep -i "cost\|error"

# 3. Verify database connection
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT 1 as connection_test;"
```

**Solution:**

```bash
# If api_usage table missing:
docker compose exec synthesis-db psql -U postgres -d synthesis < \
  packages/db/migrations/003_cost_tracking.sql

# If server errors:
# 1. Check for missing environment variables
echo $DATABASE_URL

# 2. Restart server with debug logging
NODE_ENV=development pnpm --filter @synthesis/server dev

# 3. Check CORS settings if running frontend on different port
```

**Verification:**

```bash
# Test cost API endpoints
curl http://localhost:3333/api/cost/monthly | jq
curl http://localhost:3333/api/cost/breakdown | jq
curl http://localhost:3333/api/cost/alerts | jq

# All should return valid JSON without errors
```

---

## Code Chunking Issues

### Issue: Code Files Not Chunked Properly

**Symptom:**
- Functions split across multiple chunks
- Classes incomplete in search results
- Missing imports or context

**Diagnosis:**

```bash
# 1. Check if CODE_CHUNKING is enabled
echo $CODE_CHUNKING
# Expected: true

# 2. Verify chunk metadata includes code structure
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT
    text,
    metadata->>'chunk_type' as type,
    metadata->>'function_name' as func,
    metadata->>'class_name' as class
  FROM chunks ch
  JOIN documents d ON ch.doc_id = d.id
  WHERE d.file_path LIKE '%.ts'
    AND d.collection_id = 'YOUR_COLLECTION_ID'
  LIMIT 5;"

# 3. Check for AST parsing errors in logs
docker compose logs synthesis-server | grep -i "ast\|parse\|chunk"
```

**Solution:**

```bash
# 1. Enable code chunking
echo "CODE_CHUNKING=true" >> .env
echo "PRESERVE_IMPORTS=true" >> .env
echo "CODE_MAX_CHUNK_LINES=100" >> .env

# 2. Re-ingest code files
# Option A: Delete and re-upload
curl -X DELETE http://localhost:3333/api/documents/{DOCUMENT_ID}
curl -X POST http://localhost:3333/api/ingest \
  -F "file=@path/to/code.ts" \
  -F "collectionId=YOUR_COLLECTION_ID"

# Option B: Reprocess existing
curl -X POST http://localhost:3333/api/documents/{DOCUMENT_ID}/reprocess

# 3. Restart server
pnpm --filter @synthesis/server dev
```

**Verification:**

```bash
# Check chunk structure
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT
    d.title,
    COUNT(ch.id) as total_chunks,
    COUNT(CASE WHEN ch.metadata->>'chunk_type' = 'code' THEN 1 END) as code_chunks,
    COUNT(CASE WHEN ch.metadata ? 'function_name' THEN 1 END) as function_chunks
  FROM documents d
  JOIN chunks ch ON d.id = ch.doc_id
  WHERE d.collection_id = 'YOUR_COLLECTION_ID'
    AND d.file_path LIKE '%.ts'
  GROUP BY d.title;"

# Expected: code_chunks and function_chunks > 0
```

---

### Issue: Imports Missing from Chunks

**Symptom:**
- Code chunks lack import statements
- Context incomplete in search results
- `metadata.imports` is empty or missing

**Diagnosis:**

```bash
# 1. Check PRESERVE_IMPORTS setting
echo $PRESERVE_IMPORTS
# Expected: true

# 2. Verify imports in chunk metadata
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT
    metadata->>'function_name' as function,
    metadata->'imports' as imports
  FROM chunks ch
  JOIN documents d ON ch.doc_id = d.id
  WHERE d.collection_id = 'YOUR_COLLECTION_ID'
    AND metadata ? 'imports'
  LIMIT 3;"

# 3. Check original file has imports
cat path/to/file.ts | head -20
```

**Solution:**

```bash
# 1. Enable import preservation
echo "PRESERVE_IMPORTS=true" >> .env

# 2. Verify imports are being extracted
# Check parser logs during ingestion
tail -f logs/server.log | grep "import"

# 3. Re-ingest file with imports
curl -X POST http://localhost:3333/api/documents/{DOCUMENT_ID}/reprocess

# 4. Check TypeScript parser configuration
# Ensure typescript dependency is installed
pnpm list typescript
```

**Verification:**

```bash
# Query chunks with imports
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT
    text,
    jsonb_array_length(metadata->'imports') as import_count,
    metadata->'imports' as imports
  FROM chunks
  WHERE metadata ? 'imports'
    AND jsonb_array_length(metadata->'imports') > 0
  LIMIT 5;"

# Expected: Non-zero import_count for code chunks
```

---

### Issue: File Relationships Not Tracked

**Symptom:**
- Related files not appearing in search results
- `relatedFiles` is null in response
- Import graph incomplete

**Diagnosis:**

```bash
# 1. Check TRACK_RELATIONSHIPS setting
echo $TRACK_RELATIONSHIPS
# Expected: true

# 2. Verify file_relationships table exists
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT COUNT(*) as relationship_count
  FROM file_relationships;"

# 3. Check specific file relationships
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT source_file, target_file, relationship_type
  FROM file_relationships
  WHERE collection_id = 'YOUR_COLLECTION_ID'
  LIMIT 10;"
```

**Solution:**

```bash
# 1. Enable relationship tracking
echo "TRACK_RELATIONSHIPS=true" >> .env

# 2. Run file relationships migration
docker compose exec synthesis-db psql -U postgres -d synthesis < \
  packages/db/migrations/006_file_relationships.sql

# 3. Re-build relationships for existing collections
curl -X POST http://localhost:3333/api/collections/{COLLECTION_ID}/rebuild-relationships

# 4. Restart server
pnpm --filter @synthesis/server dev
```

**Verification:**

```bash
# Check relationship graph
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT
    source_file,
    COUNT(*) as related_files,
    array_agg(DISTINCT relationship_type) as types
  FROM file_relationships
  WHERE collection_id = 'YOUR_COLLECTION_ID'
  GROUP BY source_file
  ORDER BY related_files DESC
  LIMIT 10;"

# Test related files in search
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "database service",
    "collectionId": "YOUR_COLLECTION_ID",
    "includeRelatedFiles": true
  }' | jq '.results[0].relatedFiles'

# Expected: { imports: [...], tests: [...], siblings: [...] }
```

---

### Issue: AST Parsing Errors

**Symptom:**
- Error: "Failed to parse TypeScript file"
- Error: "Dart analyzer failed"
- Chunks fall back to simple text chunking

**Diagnosis:**

```bash
# 1. Check parser dependencies
pnpm list @typescript-eslint/parser
pnpm list @xenova/transformers

# 2. Check file syntax
npx tsc --noEmit path/to/file.ts

# 3. Check parser logs
docker compose logs synthesis-server | grep -i "parse error\|ast error"

# 4. Test parser directly
node -e "
const { parseTypeScriptFile } = require('./apps/server/src/pipeline/ts-analyzer.ts');
const fs = require('fs');
const content = fs.readFileSync('path/to/file.ts', 'utf8');
parseTypeScriptFile(content, 'test.ts').then(console.log).catch(console.error);
"
```

**Solution:**

```bash
# 1. Fix syntax errors in source file
npx eslint --fix path/to/file.ts

# 2. Update parser dependencies
pnpm update @typescript-eslint/parser

# 3. Handle unsupported syntax
# If file uses experimental features, add to simple chunking
echo "CODE_CHUNKING=false" >> .env  # Temporary fallback

# 4. Check TypeScript version compatibility
# Parser supports TS 4.5+, verify your files match
cat path/to/file.ts | grep -i "tsconfig"
```

**Verification:**

```bash
# Verify successful parsing
curl -X POST http://localhost:3333/api/ingest \
  -F "file=@path/to/file.ts" \
  -F "collectionId=YOUR_COLLECTION_ID" \
  -F "title=Parser Test" \
  -v

# Check document status
curl http://localhost:3333/api/documents/{DOCUMENT_ID} | jq '.status'
# Expected: 'complete' (not 'error')

# Verify chunk metadata
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT metadata->>'chunk_type', COUNT(*)
  FROM chunks ch
  JOIN documents d ON ch.doc_id = d.id
  WHERE d.title = 'Parser Test'
  GROUP BY metadata->>'chunk_type';"

# Expected: chunk_type = 'code'
```

---

## Re-ranking Issues

### Issue: Cohere Reranking Failed Requests

**Symptom:**
- Error: "COHERE_API_KEY is required for Cohere reranking"
- Error: "Cohere API rate limit exceeded"
- 429 or 401 HTTP errors

**Diagnosis:**

```bash
# 1. Check API key
echo $COHERE_API_KEY
# Expected: co-... (starts with 'co-')

# 2. Test Cohere API directly
curl https://api.cohere.ai/v1/rerank \
  -H "Authorization: Bearer $COHERE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test",
    "documents": ["doc1", "doc2"],
    "model": "rerank-english-v3.0"
  }'

# 3. Check rate limits
curl https://api.cohere.ai/v1/check-api-key \
  -H "Authorization: Bearer $COHERE_API_KEY"
```

**Solution:**

```bash
# 1. Set valid API key
echo "COHERE_API_KEY=co-your-key-here" >> .env

# 2. If rate limited, switch to BGE fallback
echo "RERANKER_PROVIDER=bge" >> .env

# 3. Or wait for rate limit to reset (typically 1 minute)
sleep 60

# 4. Restart server
pnpm --filter @synthesis/server dev
```

**Verification:**

```bash
# Test reranking
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "database configuration",
    "collectionId": "YOUR_COLLECTION_ID",
    "rerank": true,
    "rerankProvider": "cohere"
  }' | jq '.metadata.rerankProvider'

# Expected: "cohere"

# Check cost was tracked
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT provider, operation, cost_usd, created_at
  FROM api_usage
  WHERE provider = 'cohere'
  ORDER BY created_at DESC
  LIMIT 1;"
```

---

### Issue: Slow Reranking Performance (>2s)

**Symptom:**
- Reranking adds >2 seconds to search
- BGE reranker very slow
- Timeout errors

**Diagnosis:**

```bash
# 1. Check reranker provider
echo $RERANKER_PROVIDER
# bge is slower than cohere

# 2. Check batch size
echo $RERANK_BATCH_SIZE
# Lower = slower but less memory

# 3. Check candidate count
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test",
    "collectionId": "YOUR_COLLECTION_ID",
    "rerank": true,
    "rerankMaxCandidates": 50
  }' | jq '.searchTimeMs'

# 4. Check system resources
docker stats synthesis-server
```

**Solution:**

```bash
# 1. Reduce candidate count
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test",
    "collectionId": "YOUR_COLLECTION_ID",
    "rerank": true,
    "rerankMaxCandidates": 20,
    "rerankTopK": 10
  }'

# 2. Increase BGE batch size (requires more memory)
echo "RERANK_BATCH_SIZE=16" >> .env

# 3. Switch to Cohere for speed
echo "RERANKER_PROVIDER=cohere" >> .env
echo "COHERE_API_KEY=your-key" >> .env

# 4. Enable rerank caching
echo "RERANK_CACHE_TTL_SECONDS=300" >> .env
echo "RERANK_CACHE_MAX_ITEMS=500" >> .env

# 5. Restart server
docker compose restart synthesis-server
```

**Verification:**

```bash
# Benchmark reranking
for i in {1..5}; do
  time curl -s -X POST http://localhost:3333/api/search \
    -H "Content-Type: application/json" \
    -d '{
      "query": "database config",
      "collectionId": "YOUR_COLLECTION_ID",
      "rerank": true
    }' | jq '.searchTimeMs'
done

# Expected: <1000ms for cohere, <2000ms for bge
# Second request should be faster (cached)
```

---

### Issue: Reranking Budget Exceeded

**Symptom:**
- Reranking stops working mid-month
- Automatic fallback to BGE
- Budget alert in logs

**Diagnosis:**

```bash
# 1. Check monthly Cohere spend
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT
    SUM(cost_usd) as total_cost,
    COUNT(*) as request_count
  FROM api_usage
  WHERE provider = 'cohere'
    AND operation = 'rerank'
    AND created_at >= date_trunc('month', NOW());"

# 2. Check budget settings
echo $MONTHLY_BUDGET_USD

# 3. Check for alerts
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT alert_type, current_spend_usd, threshold_usd
  FROM budget_alerts
  ORDER BY triggered_at DESC
  LIMIT 1;"
```

**Solution:**

```bash
# Option 1: Increase budget
echo "MONTHLY_BUDGET_USD=50" >> .env

# Option 2: Use BGE exclusively (free)
echo "RERANKER_PROVIDER=bge" >> .env
echo "RERANKER_PROVIDER_OVERRIDE=bge" >> .env

# Option 3: Disable reranking
# Remove rerank: true from API calls

# Option 4: Reset monthly spend (new billing period)
# Wait for next month, or manually reset alerts
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  UPDATE budget_alerts SET acknowledged = true;"

# Restart server
docker compose restart synthesis-server
```

**Verification:**

```bash
# Verify BGE fallback active
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test",
    "collectionId": "YOUR_COLLECTION_ID",
    "rerank": true
  }' | jq '.metadata.rerankProvider'

# Expected: "bge" (not "cohere")

# Verify no new Cohere costs
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT MAX(created_at) as last_cohere_call
  FROM api_usage
  WHERE provider = 'cohere';"
```

---

### Issue: BGE Reranker Fallback Not Working

**Symptom:**
- Cohere fails but no BGE fallback
- Error: "Reranking failed"
- Results not reranked

**Diagnosis:**

```bash
# 1. Check if BGE model is available
docker compose exec synthesis-server sh -c "
  ls -la /root/.cache/huggingface/
"

# 2. Check logs for BGE download errors
docker compose logs synthesis-server | grep -i "bge\|transformers\|download"

# 3. Test BGE loading manually
node -e "
const { pipeline } = require('@xenova/transformers');
pipeline('text-classification', 'BAAI/bge-reranker-base')
  .then(() => console.log('BGE loaded successfully'))
  .catch(err => console.error('BGE load failed:', err));
"
```

**Solution:**

```bash
# 1. Pre-download BGE model
docker compose exec synthesis-server sh -c "
  node -e \"
    const { pipeline } = require('@xenova/transformers');
    pipeline('text-classification', 'BAAI/bge-reranker-base')
      .then(() => console.log('Downloaded'))
      .catch(console.error);
  \"
"

# 2. Check disk space (model is ~400MB)
df -h

# 3. Verify @xenova/transformers is installed
docker compose exec synthesis-server sh -c "
  cd /app && pnpm list @xenova/transformers
"

# 4. If missing, install it
pnpm add @xenova/transformers

# 5. Restart server
docker compose restart synthesis-server
```

**Verification:**

```bash
# Force BGE usage
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "database configuration",
    "collectionId": "YOUR_COLLECTION_ID",
    "rerank": true,
    "rerankProvider": "bge"
  }' | jq '.metadata.rerankProvider'

# Expected: "bge"

# Verify rerank scores present
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "database configuration",
    "collectionId": "YOUR_COLLECTION_ID",
    "rerank": true,
    "rerankProvider": "bge"
  }' | jq '.results[0].rerankScore'

# Expected: numeric score > 0
```

---

## Synthesis Issues

### Issue: No Contradictions Detected

**Symptom:**
- Synthesis results show no contradictions
- `contradictions: []` in response
- Expected conflicts not found

**Diagnosis:**

```bash
# 1. Check if synthesis is enabled
echo $ENABLE_SYNTHESIS
echo $ENABLE_CONTRADICTION_DETECTION
# Expected: true, true

# 2. Check Anthropic API key
echo $ANTHROPIC_API_KEY | cut -c1-10
# Expected: sk-ant-api...

# 3. Check similarity thresholds
echo $CONTRADICTION_MIN_SIMILARITY
echo $CONTRADICTION_MAX_SIMILARITY
# Expected: 0.2, 0.7

# 4. Verify results have sufficient diversity
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "how to configure database",
    "collectionId": "YOUR_COLLECTION_ID",
    "topK": 20
  }' | jq '.results | length'
```

**Solution:**

```bash
# 1. Enable contradiction detection
echo "ENABLE_SYNTHESIS=true" >> .env
echo "ENABLE_CONTRADICTION_DETECTION=true" >> .env

# 2. Adjust similarity thresholds to catch more pairs
echo "CONTRADICTION_MIN_SIMILARITY=0.1" >> .env
echo "CONTRADICTION_MAX_SIMILARITY=0.8" >> .env

# 3. Increase max pairs checked
echo "CONTRADICTION_MAX_PAIRS=10" >> .env

# 4. Use faster model if timeouts occur
echo "CONTRADICTION_MODEL=claude-3-haiku-20240307" >> .env

# 5. Restart server
pnpm --filter @synthesis/server dev
```

**Verification:**

```bash
# Test synthesis with known contradictory documents
# Upload two docs with conflicting info, then search
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "database configuration",
    "collectionId": "YOUR_COLLECTION_ID",
    "synthesize": true,
    "topK": 20
  }' | jq '.synthesis'

# Expected output includes:
# {
#   "summary": "...",
#   "contradictions": [
#     {
#       "docA": "...",
#       "docB": "...",
#       "conflict": "...",
#       "severity": "high"
#     }
#   ]
# }
```

---

### Issue: Poor Quality Synthesis Results

**Symptom:**
- Synthesis summary is generic or unhelpful
- Missing key information
- Contradictions not well explained

**Diagnosis:**

```bash
# 1. Check model used
echo $CONTRADICTION_MODEL
# haiku is faster but less detailed than sonnet

# 2. Check input result quality
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "your query",
    "collectionId": "YOUR_COLLECTION_ID",
    "topK": 20
  }' | jq '.results[] | .similarity'
# Low similarities (<0.5) may indicate poor matches

# 3. Check logs for synthesis errors
docker compose logs synthesis-server | grep -i "synthesis\|contradiction"
```

**Solution:**

```bash
# 1. Use more powerful model
echo "CONTRADICTION_MODEL=claude-3-5-sonnet-20241022" >> .env

# 2. Increase topK for more context
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "your query",
    "collectionId": "YOUR_COLLECTION_ID",
    "topK": 30,
    "synthesize": true
  }'

# 3. Use hybrid search for better retrieval
echo "SEARCH_MODE=hybrid" >> .env

# 4. Enable reranking for quality results
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "your query",
    "collectionId": "YOUR_COLLECTION_ID",
    "rerank": true,
    "rerankTopK": 20,
    "synthesize": true
  }'

# 5. Restart server
docker compose restart synthesis-server
```

**Verification:**

```bash
# Compare synthesis quality
# Before: haiku, 10 results
# After: sonnet, 20 reranked results
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "database configuration best practices",
    "collectionId": "YOUR_COLLECTION_ID",
    "topK": 20,
    "rerank": true,
    "synthesize": true
  }' | jq '.synthesis.summary' | wc -w

# Expected: >100 words for comprehensive summary
```

---

### Issue: High Synthesis API Costs

**Symptom:**
- Monthly costs exceed budget
- Every search triggers synthesis
- Costs dominated by Anthropic usage

**Diagnosis:**

```bash
# 1. Check Anthropic spending
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT
    SUM(cost_usd) as total,
    COUNT(*) as requests,
    AVG(tokens_used) as avg_tokens
  FROM api_usage
  WHERE provider = 'anthropic'
    AND created_at >= date_trunc('month', NOW());"

# 2. Check which operations trigger synthesis
docker compose logs synthesis-server | grep "synthesis" | tail -20

# 3. Check model costs
# haiku: $0.00025 per 1K input tokens
# sonnet: $0.003 per 1K input tokens
echo $CONTRADICTION_MODEL
```

**Solution:**

```bash
# 1. Use cheaper model
echo "CONTRADICTION_MODEL=claude-3-haiku-20240307" >> .env

# 2. Make synthesis opt-in (not default)
# Remove synthesize: true from default API calls
# Only add when user explicitly requests it

# 3. Reduce max pairs checked
echo "CONTRADICTION_MAX_PAIRS=3" >> .env

# 4. Set budget limit
echo "MONTHLY_BUDGET_USD=10" >> .env
echo "ENABLE_COST_ALERTS=true" >> .env

# 5. Disable synthesis when budget exceeded
# This happens automatically via cost tracker

# 6. Restart server
docker compose restart synthesis-server
```

**Verification:**

```bash
# Check cost reduction
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT
    DATE(created_at) as date,
    SUM(cost_usd) as daily_cost
  FROM api_usage
  WHERE provider = 'anthropic'
  GROUP BY DATE(created_at)
  ORDER BY date DESC
  LIMIT 7;"

# Monitor budget status
curl http://localhost:3333/api/cost/monthly | jq
```

---

### Issue: Synthesis Disabled by Cost Tracker

**Symptom:**
- Synthesis stopped working mid-month
- `DISABLE_CONTRADICTION_DETECTION=true` appears in logs
- No synthesis results returned

**Diagnosis:**

```bash
# 1. Check environment override
echo $DISABLE_CONTRADICTION_DETECTION
# Expected: true (if budget exceeded)

# 2. Check budget status
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT
    COALESCE(SUM(cost_usd), 0) as spent,
    (SELECT threshold_usd FROM budget_alerts
     ORDER BY triggered_at DESC LIMIT 1) as budget
  FROM api_usage
  WHERE created_at >= date_trunc('month', NOW());"

# 3. Check budget alerts
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT alert_type, current_spend_usd, threshold_usd, triggered_at
  FROM budget_alerts
  WHERE alert_type = 'limit_reached'
  ORDER BY triggered_at DESC
  LIMIT 1;"
```

**Solution:**

```bash
# Option 1: Increase budget
echo "MONTHLY_BUDGET_USD=50" >> .env
# Remove override
sed -i '/DISABLE_CONTRADICTION_DETECTION/d' .env
docker compose restart synthesis-server

# Option 2: Wait for next billing period
# Override will clear on month rollover

# Option 3: Manually re-enable (not recommended)
echo "DISABLE_CONTRADICTION_DETECTION=false" >> .env
docker compose restart synthesis-server

# Option 4: Acknowledge alert to suppress warnings
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  UPDATE budget_alerts SET acknowledged = true
  WHERE alert_type = 'limit_reached';"
```

**Verification:**

```bash
# Test synthesis after re-enabling
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test synthesis",
    "collectionId": "YOUR_COLLECTION_ID",
    "synthesize": true
  }' | jq '.synthesis'

# Expected: Non-null synthesis object

# Monitor costs
watch -n 60 'curl -s http://localhost:3333/api/cost/monthly | jq'
```

---

## Embedding Issues

### Issue: Provider Connection Errors

**Symptom:**
- Error: "Ollama not responding"
- Error: "OpenAI API key invalid"
- Error: "Voyage API error"
- Ingestion fails at embedding step

**Diagnosis:**

```bash
# Test Ollama
curl http://localhost:11434/api/tags
# Expected: JSON list of models

# Test OpenAI
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" | jq '.data[0].id'
# Expected: model name

# Test Voyage
curl https://api.voyageai.com/v1/embeddings \
  -H "Authorization: Bearer $VOYAGE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input": ["test"], "model": "voyage-code-2"}' | jq

# Check environment variables
env | grep -E "(OLLAMA|OPENAI|VOYAGE)"
```

**Solution:**

```bash
# For Ollama errors:
# 1. Check if Ollama is running
docker compose ps synthesis-ollama

# 2. Start if stopped
docker compose up -d synthesis-ollama

# 3. Verify model is pulled
docker compose exec synthesis-ollama ollama list
# If nomic-embed-text missing:
docker compose exec synthesis-ollama ollama pull nomic-embed-text

# For OpenAI errors:
# 1. Verify API key format (starts with 'sk-')
echo $OPENAI_API_KEY | cut -c1-3
# Expected: sk-

# 2. Update API key
echo "OPENAI_API_KEY=sk-your-key" >> .env

# For Voyage errors:
# 1. Verify API key format (starts with 'pa-')
echo $VOYAGE_API_KEY | cut -c1-3
# Expected: pa-

# 2. Update API key
echo "VOYAGE_API_KEY=pa-your-key" >> .env

# Restart server
docker compose restart synthesis-server
```

**Verification:**

```bash
# Test embedding via API
curl -X POST http://localhost:3333/api/ingest \
  -F "file=@test.txt" \
  -F "collectionId=YOUR_COLLECTION_ID" \
  -F "title=Embedding Test"

# Check document status
curl http://localhost:3333/api/documents/{DOCUMENT_ID} | jq '.status'
# Expected: 'complete'

# Verify embedding provider
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT metadata->>'embedding_provider' as provider
  FROM documents
  WHERE title = 'Embedding Test';"
```

---

### Issue: Dimension Mismatch Error

**Symptom:**
- Error: "dimension of vector does not match index"
- Error: "expected 768 dimensions, got 1536"
- Search fails after changing providers

**Diagnosis:**

```bash
# 1. Check embedding dimensions in database
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT
    d.metadata->>'embedding_provider' as provider,
    array_length(ch.embedding, 1) as dimensions,
    COUNT(*) as chunk_count
  FROM chunks ch
  JOIN documents d ON ch.doc_id = d.id
  WHERE d.collection_id = 'YOUR_COLLECTION_ID'
  GROUP BY provider, dimensions;"

# 2. Check index definition
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT indexdef
  FROM pg_indexes
  WHERE indexname = 'chunks_embedding_hnsw';"

# 3. Check current provider config
echo $DOC_EMBEDDING_PROVIDER
echo $CODE_EMBEDDING_PROVIDER
echo $WRITING_EMBEDDING_PROVIDER
```

**Solution:**

```bash
# Option 1: Stick to one provider per collection
# Don't mix ollama (768), openai (1536), voyage (1024)

# Option 2: Use multiple indexes for multi-provider
# (Advanced, not recommended for most use cases)

# Option 3: Re-embed all documents with consistent provider
# 1. Delete existing chunks
docker compose exec synthesis-db psql -U postgres -d synthesis <<EOF
DELETE FROM chunks
WHERE doc_id IN (
  SELECT id FROM documents WHERE collection_id = 'YOUR_COLLECTION_ID'
);
UPDATE documents
SET status = 'pending'
WHERE collection_id = 'YOUR_COLLECTION_ID';
EOF

# 2. Set single provider
echo "DOC_EMBEDDING_PROVIDER=ollama" >> .env
echo "CODE_EMBEDDING_PROVIDER=ollama" >> .env
echo "WRITING_EMBEDDING_PROVIDER=ollama" >> .env

# 3. Reprocess documents
curl -X POST http://localhost:3333/api/collections/{COLLECTION_ID}/reprocess

# 4. Restart server
docker compose restart synthesis-server
```

**Verification:**

```bash
# Verify uniform dimensions
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT
    array_length(embedding, 1) as dimensions,
    COUNT(*) as count
  FROM chunks ch
  JOIN documents d ON ch.doc_id = d.id
  WHERE d.collection_id = 'YOUR_COLLECTION_ID'
  GROUP BY dimensions;"

# Expected: Single dimension value (768, 1024, or 1536)

# Test search works
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test",
    "collectionId": "YOUR_COLLECTION_ID"
  }' | jq '.totalResults'

# Expected: > 0
```

---

### Issue: Ollama Not Responding

**Symptom:**
- Error: "connect ECONNREFUSED 127.0.0.1:11434"
- Embedding timeout
- Ollama container stopped

**Diagnosis:**

```bash
# 1. Check if Ollama container is running
docker compose ps synthesis-ollama

# 2. Check Ollama logs
docker compose logs synthesis-ollama | tail -50

# 3. Test Ollama API
curl http://localhost:11434/api/tags

# 4. Check port binding
netstat -tuln | grep 11434
```

**Solution:**

```bash
# 1. Start Ollama container
docker compose up -d synthesis-ollama

# 2. Wait for startup (can take 30s)
sleep 30

# 3. Verify models are available
docker compose exec synthesis-ollama ollama list

# 4. Pull required model if missing
docker compose exec synthesis-ollama ollama pull nomic-embed-text

# 5. Test embedding generation
curl http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed-text",
    "prompt": "test text"
  }' | jq '.embedding | length'

# Expected: 768 (dimension count)

# 6. Restart server to reconnect
docker compose restart synthesis-server
```

**Verification:**

```bash
# Test embedding via server
curl -X POST http://localhost:3333/api/ingest \
  -F "file=@test.txt" \
  -F "collectionId=YOUR_COLLECTION_ID" \
  -F "title=Ollama Test"

# Check processing succeeded
curl http://localhost:3333/api/documents/{DOCUMENT_ID} | jq '.status'
# Expected: 'complete'

# Verify Ollama was used
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT metadata->>'embedding_provider'
  FROM documents
  WHERE title = 'Ollama Test';"
# Expected: 'ollama'
```

---

### Issue: Mixed Providers in Same Collection

**Symptom:**
- Some chunks have 768 dims, others 1536
- Inconsistent search results
- Provider auto-selection not working

**Diagnosis:**

```bash
# Check provider distribution
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT
    d.metadata->>'embedding_provider' as provider,
    array_length(ch.embedding, 1) as dimensions,
    COUNT(*) as chunks
  FROM chunks ch
  JOIN documents d ON ch.doc_id = d.id
  WHERE d.collection_id = 'YOUR_COLLECTION_ID'
  GROUP BY provider, dimensions
  ORDER BY chunks DESC;"

# Check if documents have different types
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT
    metadata->>'doc_type' as type,
    metadata->>'embedding_provider' as provider,
    COUNT(*)
  FROM documents
  WHERE collection_id = 'YOUR_COLLECTION_ID'
  GROUP BY type, provider;"
```

**Solution:**

```bash
# This is actually expected behavior for multi-content collections
# The system automatically selects:
# - ollama for docs
# - voyage for code
# - openai for personal writing

# If you want uniform provider:
# 1. Force single provider for all content
echo "DOC_EMBEDDING_PROVIDER=ollama" >> .env
echo "CODE_EMBEDDING_PROVIDER=ollama" >> .env
echo "WRITING_EMBEDDING_PROVIDER=ollama" >> .env

# 2. Re-embed existing documents
# See "Dimension Mismatch Error" solution above

# If multi-provider is desired:
# Ensure search uses provider inference (automatic)
# The system detects provider from collection metadata
# No action needed
```

**Verification:**

```bash
# Verify provider inference works
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test query",
    "collectionId": "YOUR_COLLECTION_ID"
  }' | jq '.metadata.embeddingProvider'

# Should match the most recent document's provider

# Test search returns results
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test query",
    "collectionId": "YOUR_COLLECTION_ID"
  }' | jq '.totalResults'

# Expected: > 0
```

---

## Database Issues

### Issue: Connection Pool Exhausted

**Symptom:**
- Error: "remaining connection slots are reserved"
- Error: "sorry, too many clients already"
- Server hangs on requests

**Diagnosis:**

```bash
# 1. Check active connections
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT
    count(*) as active,
    max_connections::int as max
  FROM pg_stat_activity, (SELECT setting FROM pg_settings WHERE name = 'max_connections') AS s(max_connections)
  WHERE datname = 'synthesis'
  GROUP BY max_connections;"

# 2. Check connection by state
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT state, count(*)
  FROM pg_stat_activity
  WHERE datname = 'synthesis'
  GROUP BY state;"

# 3. Check for long-running queries
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT pid, now() - pg_stat_activity.query_start AS duration, state, query
  FROM pg_stat_activity
  WHERE state != 'idle'
    AND now() - pg_stat_activity.query_start > interval '1 minute'
  ORDER BY duration DESC;"
```

**Solution:**

```bash
# 1. Kill idle connections
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = 'synthesis'
    AND state = 'idle'
    AND state_change < now() - interval '10 minutes';"

# 2. Increase max_connections (requires restart)
docker compose exec synthesis-db psql -U postgres -c "\
  ALTER SYSTEM SET max_connections = 200;"
docker compose restart synthesis-db

# 3. Configure connection pooling in application
# Edit packages/db/src/index.ts
# Set max pool size: max: 20

# 4. Restart server
docker compose restart synthesis-server
```

**Verification:**

```bash
# Monitor connections over time
watch -n 5 'docker compose exec -T synthesis-db psql -U postgres -d synthesis -c "
  SELECT count(*) as connections
  FROM pg_stat_activity
  WHERE datname = '\''synthesis'\'';" | grep -E "^\s+[0-9]"'

# Test concurrent requests
for i in {1..10}; do
  curl -X POST http://localhost:3333/api/search \
    -H "Content-Type: application/json" \
    -d '{"query": "test", "collectionId": "YOUR_COLLECTION_ID"}' &
done
wait

# All should succeed without connection errors
```

---

### Issue: pgvector Extension Not Found

**Symptom:**
- Error: "extension 'vector' does not exist"
- Error: "type 'vector' does not exist"
- Migration 001 fails

**Diagnosis:**

```bash
# 1. Check PostgreSQL version
docker compose exec synthesis-db psql -U postgres -c "SELECT version();"
# Expected: PostgreSQL 16.x

# 2. Check if extension is installed (not enabled)
docker compose exec synthesis-db psql -U postgres -c "\
  SELECT * FROM pg_available_extensions WHERE name = 'vector';"

# 3. Check if extension is enabled
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\dx"
```

**Solution:**

```bash
# 1. If extension not available, rebuild with pgvector
# Edit docker-compose.yml to use image with pgvector
# image: pgvector/pgvector:pg16

# 2. Recreate database container
docker compose down synthesis-db
docker volume rm synthesis_postgres_data  # WARNING: deletes data
docker compose up -d synthesis-db

# 3. Wait for startup
sleep 10

# 4. Run migrations
pnpm --filter @synthesis/db migrate

# 5. Verify extension enabled
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"
```

**Verification:**

```bash
# Test vector operations
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT '[1,2,3]'::vector <=> '[4,5,6]'::vector as distance;"

# Expected: numeric distance value

# Verify HNSW index exists
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT indexname FROM pg_indexes WHERE tablename = 'chunks' AND indexname LIKE '%hnsw%';"

# Expected: chunks_embedding_hnsw
```

---

### Issue: Migration Failures

**Symptom:**
- Error during `pnpm --filter @synthesis/db migrate`
- "relation already exists"
- "column already exists"
- Migrations applied out of order

**Diagnosis:**

```bash
# 1. Check migrations table
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT * FROM schema_migrations ORDER BY version;"

# 2. Check actual schema
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  \dt
  \di"

# 3. Check for errors in last migration
docker compose logs synthesis-server | grep -i migration
```

**Solution:**

```bash
# 1. Reset migrations (DESTRUCTIVE - for development only)
docker compose exec synthesis-db psql -U postgres -d synthesis <<EOF
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
EOF

# 2. Re-run all migrations
pnpm --filter @synthesis/db migrate

# 3. Verify all tables exist
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT tablename FROM pg_tables WHERE schemaname = 'public';"

# Expected: collections, documents, chunks, api_usage, budget_alerts, file_relationships

# For production, use forward-only migrations:
# 4. Add new migration file instead of modifying existing
# 5. Use IF NOT EXISTS / IF EXISTS for idempotency
```

**Verification:**

```bash
# Verify schema is correct
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, ordinal_position;"

# Verify extensions
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\dx"
# Expected: vector, pgcrypto, pg_trgm

# Test basic operations
pnpm --filter @synthesis/server dev
curl http://localhost:3333/health
# Expected: {"status":"ok"}
```

---

### Issue: Index Missing or Corrupted

**Symptom:**
- Slow queries (>2s)
- Query planner uses Seq Scan instead of Index Scan
- HNSW index not used

**Diagnosis:**

```bash
# 1. List all indexes
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT tablename, indexname, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
  ORDER BY tablename, indexname;"

# 2. Check HNSW index specifically
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as size
  FROM pg_indexes
  WHERE indexname = 'chunks_embedding_hnsw';"

# 3. Test query plan
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  EXPLAIN ANALYZE
  SELECT * FROM chunks
  ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
  LIMIT 10;"
# Should show: "Index Scan using chunks_embedding_hnsw"
```

**Solution:**

```bash
# 1. Rebuild HNSW index
docker compose exec synthesis-db psql -U postgres -d synthesis <<EOF
DROP INDEX IF EXISTS chunks_embedding_hnsw;
CREATE INDEX chunks_embedding_hnsw ON chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
EOF

# 2. Rebuild text search indexes
docker compose exec synthesis-db psql -U postgres -d synthesis <<EOF
DROP INDEX IF EXISTS chunks_text_tsv_idx;
DROP INDEX IF EXISTS chunks_text_trgm_idx;
CREATE INDEX chunks_text_tsv_idx ON chunks USING gin (to_tsvector('english', text));
CREATE INDEX chunks_text_trgm_idx ON chunks USING gin (text gin_trgm_ops);
EOF

# 3. Vacuum and analyze
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  VACUUM ANALYZE chunks;"

# 4. Update statistics
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  ANALYZE chunks;"
```

**Verification:**

```bash
# Verify index usage
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read
  FROM pg_stat_user_indexes
  WHERE schemaname = 'public'
  ORDER BY idx_scan DESC;"

# Benchmark search performance
time curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "database configuration",
    "collectionId": "YOUR_COLLECTION_ID"
  }' | jq '.searchTimeMs'

# Expected: <600ms
```

---

## Performance Issues

### Issue: Slow Document Ingestion

**Symptom:**
- File upload takes >1 minute per document
- Ingestion pipeline times out
- Status stuck at 'chunking' or 'embedding'

**Diagnosis:**

```bash
# 1. Check document status
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT
    status,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) as avg_duration_sec
  FROM documents
  GROUP BY status;"

# 2. Check pipeline logs
docker compose logs synthesis-server | grep -E "extract|chunk|embed"

# 3. Profile slow operations
# Add timing logs to pipeline/orchestrator.ts

# 4. Check system resources
docker stats synthesis-server synthesis-ollama
```

**Solution:**

```bash
# 1. Optimize chunking parameters
echo "CODE_MAX_CHUNK_LINES=150" >> .env  # Larger chunks = fewer embeds

# 2. Enable embedding caching
echo "EMBEDDING_CACHE_TTL_MS=900000" >> .env
echo "EMBEDDING_CACHE_MAX_ITEMS=1000" >> .env

# 3. Use faster embedding provider
echo "DOC_EMBEDDING_PROVIDER=ollama" >> .env  # Fastest (local)

# 4. Increase batch size for embeddings
# Edit apps/server/src/pipeline/embed.ts
# Increase batch size from 10 to 50

# 5. Add more memory to Ollama container
# Edit docker-compose.yml
# deploy:
#   resources:
#     limits:
#       memory: 4G  # Increase from 2G

# 6. Restart services
docker compose up -d
```

**Verification:**

```bash
# Benchmark ingestion
time curl -X POST http://localhost:3333/api/ingest \
  -F "file=@large-document.pdf" \
  -F "collectionId=YOUR_COLLECTION_ID" \
  -F "title=Performance Test"

# Expected: <30s for 10-page PDF

# Monitor processing
watch -n 1 'curl -s http://localhost:3333/api/documents/{DOCUMENT_ID} | jq ".status"'

# Check chunk generation speed
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT
    COUNT(*) as chunks,
    MAX(created_at) - MIN(created_at) as duration
  FROM chunks
  WHERE doc_id = 'DOCUMENT_ID';"
```

---

### Issue: High Memory Usage

**Symptom:**
- Server consumes >4GB RAM
- Out of memory errors
- Container restarts

**Diagnosis:**

```bash
# 1. Check container memory usage
docker stats --no-stream

# 2. Check Node.js heap usage
# Add to server startup: node --max-old-space-size=2048

# 3. Profile memory leaks
# Use clinic.js or node --inspect
docker compose exec synthesis-server sh -c "
  node --expose-gc --inspect=0.0.0.0:9229 dist/index.js
"

# 4. Check for unclosed connections
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT count(*) FROM pg_stat_activity WHERE datname = 'synthesis';"
```

**Solution:**

```bash
# 1. Set memory limits in docker-compose.yml
cat >> docker-compose.yml <<EOF
  synthesis-server:
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
EOF

# 2. Reduce cache sizes
echo "SEARCH_CACHE_MAX_ITEMS=100" >> .env
echo "EMBEDDING_CACHE_MAX_ITEMS=500" >> .env
echo "RERANK_CACHE_MAX_ITEMS=200" >> .env

# 3. Enable garbage collection
# Add to package.json script:
# "dev": "node --expose-gc --max-old-space-size=2048 dist/index.js"

# 4. Limit connection pool
# Edit packages/db/src/index.ts
# max: 10  # Down from 20

# 5. Restart with limits
docker compose up -d
```

**Verification:**

```bash
# Monitor memory over time
watch -n 5 'docker stats --no-stream synthesis-server synthesis-ollama'

# Load test
for i in {1..100}; do
  curl -X POST http://localhost:3333/api/search \
    -H "Content-Type: application/json" \
    -d '{"query": "test $i", "collectionId": "YOUR_COLLECTION_ID"}' &
done
wait

# Check for memory leaks
# Memory should stabilize after GC, not continuously grow
```

---

### Issue: Slow Search with Large Collections

**Symptom:**
- Search >2s with >10,000 chunks
- Performance degrades as collection grows
- Index not scaling

**Diagnosis:**

```bash
# 1. Check collection size
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT
    c.name,
    COUNT(DISTINCT d.id) as docs,
    COUNT(ch.id) as chunks,
    pg_size_pretty(pg_total_relation_size('chunks')) as table_size,
    pg_size_pretty(pg_relation_size('chunks_embedding_hnsw')) as index_size
  FROM collections c
  LEFT JOIN documents d ON c.id = d.collection_id
  LEFT JOIN chunks ch ON d.id = ch.doc_id
  WHERE c.id = 'YOUR_COLLECTION_ID'
  GROUP BY c.name;"

# 2. Check query performance
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  EXPLAIN (ANALYZE, BUFFERS)
  SELECT * FROM chunks
  WHERE doc_id IN (SELECT id FROM documents WHERE collection_id = 'YOUR_COLLECTION_ID')
  ORDER BY embedding <=> '[0.1,0.2,...]'::vector
  LIMIT 10;"

# 3. Check index parameters
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT * FROM pg_index_column_has_property('chunks_embedding_hnsw'::regclass, 1, 'is_hnsw');"
```

**Solution:**

```bash
# 1. Tune HNSW parameters for larger datasets
docker compose exec synthesis-db psql -U postgres -d synthesis <<EOF
DROP INDEX chunks_embedding_hnsw;
CREATE INDEX chunks_embedding_hnsw ON chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 32, ef_construction = 128);  -- Higher values for larger datasets
EOF

# 2. Partition chunks table by collection (advanced)
# See PostgreSQL partitioning docs

# 3. Enable parallel queries
docker compose exec synthesis-db psql -U postgres -c "\
  ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
  ALTER SYSTEM SET max_worker_processes = 8;"
docker compose restart synthesis-db

# 4. Use collection-level caching
echo "SEARCH_CACHE_TTL_SECONDS=3600" >> .env

# 5. Restart services
docker compose restart synthesis-server
```

**Verification:**

```bash
# Benchmark search at different scales
for topK in 10 20 50; do
  echo "Testing topK=$topK"
  time curl -X POST http://localhost:3333/api/search \
    -H "Content-Type: application/json" \
    -d "{
      \"query\": \"test\",
      \"collectionId\": \"YOUR_COLLECTION_ID\",
      \"topK\": $topK
    }" | jq '.searchTimeMs'
done

# Expected: Linear scaling, <1000ms for topK=50
```

---

## Configuration Issues

### Issue: Environment Variables Not Loading

**Symptom:**
- Features not working despite setting env vars
- Default values used instead of custom config
- `.env` changes not applied

**Diagnosis:**

```bash
# 1. Verify .env file exists and is readable
ls -la .env
cat .env | grep -v "^#" | grep -v "^$"

# 2. Check if env vars are available in shell
env | grep -E "(SEARCH_MODE|RERANKER|EMBEDDING)"

# 3. Check if Docker Compose loads .env
docker compose config | grep -A 5 "environment"

# 4. Check runtime environment in container
docker compose exec synthesis-server env | grep SEARCH_MODE
```

**Solution:**

```bash
# 1. Ensure .env is in project root (not apps/server/)
mv apps/server/.env ./.env

# 2. Restart containers to pick up changes
docker compose down
docker compose up -d

# 3. For local development without Docker:
export $(cat .env | grep -v "^#" | xargs)
pnpm --filter @synthesis/server dev

# 4. Verify vars are set
docker compose exec synthesis-server sh -c "echo \$SEARCH_MODE"

# 5. Check for typos in variable names
# Correct: SEARCH_MODE
# Wrong: SEARCHMODE, SEARCH_MODE_
```

**Verification:**

```bash
# Test that config is applied
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test",
    "collectionId": "YOUR_COLLECTION_ID"
  }' | jq '.metadata'

# Expected values should match .env settings
# e.g., if SEARCH_MODE=hybrid, metadata.searchMode should be "hybrid"
```

---

### Issue: Feature Flags Not Working

**Symptom:**
- `CODE_CHUNKING=true` but still using simple chunking
- `ENABLE_SYNTHESIS=true` but no synthesis in results
- Feature toggles ignored

**Diagnosis:**

```bash
# 1. Check feature flag values
echo $CODE_CHUNKING
echo $ENABLE_SYNTHESIS
echo $TECH_STACK_TAGS
echo $BACKEND_PARSING

# 2. Check how flags are read in code
grep -r "process.env.CODE_CHUNKING" apps/server/src/

# 3. Test flag at runtime
docker compose exec synthesis-server sh -c "
  node -e \"console.log('CODE_CHUNKING:', process.env.CODE_CHUNKING)\"
"

# 4. Check for string comparison issues
# 'true' vs true vs 1
```

**Solution:**

```bash
# 1. Use correct boolean string format
cat >> .env <<EOF
CODE_CHUNKING=true
ENABLE_SYNTHESIS=true
TECH_STACK_TAGS=true
BACKEND_PARSING=true
TRACK_RELATIONSHIPS=true
EOF

# 2. Restart to apply
docker compose restart synthesis-server

# 3. For sensitive features, verify they're enabled
curl http://localhost:3333/api/config | jq

# 4. Check server logs for feature activation
docker compose logs synthesis-server | grep -iE "(enabled|disabled|feature)"
```

**Verification:**

```bash
# Test code chunking
curl -X POST http://localhost:3333/api/ingest \
  -F "file=@test.ts" \
  -F "collectionId=YOUR_COLLECTION_ID"

# Verify chunk metadata
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT metadata->>'chunk_type', COUNT(*)
  FROM chunks ch
  JOIN documents d ON ch.doc_id = d.id
  WHERE d.title = 'test.ts'
  GROUP BY metadata->>'chunk_type';"
# Expected: chunk_type = 'code' (not null or 'text')

# Test synthesis
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test",
    "collectionId": "YOUR_COLLECTION_ID",
    "synthesize": true
  }' | jq '.synthesis'
# Expected: Non-null synthesis object
```

---

### Issue: API Key Errors

**Symptom:**
- "Invalid API key"
- "Authentication failed"
- 401 Unauthorized errors

**Diagnosis:**

```bash
# 1. Check which API keys are set
env | grep -E "(ANTHROPIC|COHERE|OPENAI|VOYAGE)_API_KEY" | cut -d= -f1

# 2. Verify key format (redacted)
echo $ANTHROPIC_API_KEY | cut -c1-10
# Expected: sk-ant-api...

echo $COHERE_API_KEY | cut -c1-3
# Expected: co-...

echo $OPENAI_API_KEY | cut -c1-3
# Expected: sk-...

echo $VOYAGE_API_KEY | cut -c1-3
# Expected: pa-...

# 3. Test keys directly
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-3-haiku-20240307","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'
# Should not return 401
```

**Solution:**

```bash
# 1. Update API keys in .env
cat >> .env <<EOF
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key
COHERE_API_KEY=co-your-actual-key
OPENAI_API_KEY=sk-your-actual-key
VOYAGE_API_KEY=pa-your-actual-key
EOF

# 2. Remove quotes around keys (common mistake)
# Wrong: ANTHROPIC_API_KEY="sk-ant-..."
# Right: ANTHROPIC_API_KEY=sk-ant-...

# 3. Check for whitespace
sed -i 's/ *= */=/g' .env

# 4. Restart services
docker compose restart synthesis-server

# 5. Verify keys are loaded
docker compose exec synthesis-server sh -c "echo \$ANTHROPIC_API_KEY | cut -c1-15"
```

**Verification:**

```bash
# Test each provider
# Anthropic (synthesis)
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"test","collectionId":"YOUR_COLLECTION_ID","synthesize":true}' \
  | jq '.synthesis'

# Cohere (reranking)
curl -X POST http://localhost:3333/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"test","collectionId":"YOUR_COLLECTION_ID","rerank":true,"rerankProvider":"cohere"}' \
  | jq '.metadata.rerankProvider'

# OpenAI (embeddings)
curl -X POST http://localhost:3333/api/ingest \
  -F "file=@personal-note.txt" \
  -F "collectionId=PERSONAL_COLLECTION_ID"
# Check metadata->embedding_provider = 'openai'

# All should succeed without auth errors
```

---

## Additional Resources

### Logs and Debugging

```bash
# View all logs
docker compose logs -f

# Filter by service
docker compose logs -f synthesis-server
docker compose logs -f synthesis-db
docker compose logs -f synthesis-ollama

# Search for errors
docker compose logs | grep -i error

# Export logs to file
docker compose logs > synthesis-debug.log
```

### Health Checks

```bash
# Server health
curl http://localhost:3333/health

# Database health
docker compose exec synthesis-db pg_isready -U postgres

# Ollama health
curl http://localhost:11434/api/tags

# Frontend health
curl http://localhost:5173

# Redis health (if using)
docker compose exec synthesis-redis redis-cli ping
```

### Performance Monitoring

```bash
# Watch system resources
watch -n 2 'docker stats --no-stream'

# Monitor query performance
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\
  SELECT query, calls, mean_exec_time, max_exec_time
  FROM pg_stat_statements
  WHERE query LIKE '%chunks%'
  ORDER BY mean_exec_time DESC
  LIMIT 10;"

# Check cache hit rates
curl http://localhost:3333/api/metrics | jq
```

### Support Channels

- **GitHub Issues**: https://github.com/Beaulewis1977/synthesis/issues
- **Documentation**: `/home/kngpnn/dev/synthesis/docs/`
- **Phase-specific docs**: `/home/kngpnn/dev/synthesis/docs/phases/phase-X/`

---

**Last Updated:** 2025-11-13
**Covers:** Phases 1-15 (through performance optimization)
