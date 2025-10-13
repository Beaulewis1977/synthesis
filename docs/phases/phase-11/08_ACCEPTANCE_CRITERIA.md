# Phase 11: Acceptance Criteria

**Validation checklist before marking complete**

---

## ✅ Functional Requirements

### Core Features

- [ ] **Hybrid Search Works**
  - Can execute hybrid search combining vector + BM25
  - Returns results with `source` field ('vector', 'bm25', or 'both')
  - Results ranked by fused score (RRF algorithm)
  
- [ ] **Multi-Provider Embeddings**
  - Can embed with Ollama (nomic-embed-text, 768d)
  - Can embed with OpenAI (text-embedding-3-large, 1536d)
  - Can embed with Voyage (voyage-code-2, 1024d)
  - Provider auto-selection works based on content type
  
- [ ] **Metadata Tracking**
  - Documents store: source_quality, framework, framework_version
  - Chunks store: embedding_model, embedding_provider, embedding_dimensions
  - Can query documents by metadata fields
  
- [ ] **Trust Scoring**
  - Official sources weighted at 1.0
  - Verified sources weighted at 0.85
  - Community sources weighted at 0.6
  - Scores affect final ranking

### Backwards Compatibility

- [ ] **Zero Breaking Changes**
  - Existing collections work without modification
  - Old search API continues to function
  - MCP tools work without changes
  - Agent tools work without changes
  - Frontend doesn't break

- [ ] **Gradual Adoption**
  - Can set `SEARCH_MODE=vector` (old behavior)
  - Can set `SEARCH_MODE=hybrid` (new behavior)
  - Per-collection override via metadata
  - Defaults to vector mode if env not set

---

## 🧪 Testing Requirements

### Unit Tests

- [ ] **BM25 Service**
  - `bm25Search()` returns exact keyword matches
  - Handles empty queries gracefully
  - Respects topK parameter
  - Normalizes scores to 0-1 range

- [ ] **Hybrid Search**
  - `hybridSearch()` combines vector + BM25 results
  - RRF fusion algorithm correct
  - Handles cases where only vector returns results
  - Handles cases where only BM25 returns results
  - Handles overlap correctly (same chunk in both)

- [ ] **Embedding Router**
  - `selectEmbeddingProvider()` detects code content
  - Auto-selects Voyage for code
  - Auto-selects OpenAI for personal writings
  - Defaults to Ollama for general docs
  - Respects collection metadata override

- [ ] **Metadata Builder**
  - Creates valid metadata objects
  - Auto-detects source quality from URL
  - Auto-detects language from file extension
  - Sets defaults for required fields

### Integration Tests

- [ ] **End-to-End Search**
  - Insert test document → Embed → Search → Find it
  - Hybrid search finds both semantic and exact matches
  - Trust scoring affects ranking order
  - Version filtering works

- [ ] **MCP Integration**
  - `search_rag` tool returns hybrid results
  - External agents see improved accuracy
  - No errors in MCP communication

### Performance Tests

- [ ] **Latency Benchmarks**
  - Vector-only search: <200ms
  - BM25-only search: <100ms
  - Hybrid search: <600ms
  - No regressions in vector-only mode

- [ ] **Load Tests**
  - Can handle 100 concurrent searches
  - Database indexes used correctly
  - No memory leaks

---

## 📊 Quality Metrics

### Retrieval Accuracy

- [ ] **Improvement Measured**
  - Test on 50+ queries
  - Hybrid beats vector-only by 20%+ (measured on relevant test set)
  - Exact match recall: >95%
  - No decrease in semantic relevance

### Code Quality

- [ ] **Clean Implementation**
  - No TypeScript errors
  - No linting errors
  - Follows existing code style
  - Functions <50 lines where possible
  - Clear variable names
  - Adequate comments

- [ ] **Test Coverage**
  - New code: >80% coverage
  - Critical paths: 100% coverage
  - Edge cases handled

---

## 🔒 Security & Stability

### API Key Management

- [ ] **Safe Storage**
  - API keys in .env, not code
  - .env.example documents required keys
  - No keys committed to git

- [ ] **Fallback Behavior**
  - System works without OpenAI key (uses Ollama)
  - System works without Voyage key (uses Ollama)
  - Error messages don't expose keys

### Error Handling

- [ ] **Graceful Degradation**
  - API failures fall back to Ollama
  - BM25 errors don't break hybrid search
  - Invalid metadata doesn't crash queries
  - Malformed queries return 400, not 500

---

## 📖 Documentation

- [ ] **Code Documentation**
  - Public functions have JSDoc comments
  - Complex algorithms explained (RRF)
  - README updated with new env vars

- [ ] **User Documentation**
  - How to enable hybrid search
  - How to configure providers
  - How to use metadata filtering
  - Migration guide for existing collections

- [ ] **API Documentation**
  - Search endpoint documents hybrid mode
  - New metadata fields documented
  - Examples provided

---

## 🎯 Business Value

### Use Case Validation

- [ ] **20,000 Files Searchable**
  - Can index large Flutter project
  - Search performance acceptable
  - Finds relevant code snippets

- [ ] **Version Tracking**
  - Can filter by Flutter SDK version
  - Can query: "show me 3.24+ examples"
  - Version metadata accurate

- [ ] **Multi-Source Docs**
  - Can mix official + community docs
  - Trust scoring prefers official
  - Different embedding models per collection

- [ ] **Agent Workflow**
  - MCP agents get better results
  - No workflow disruption
  - Improved accuracy measurable

---

## 💰 Cost Control

- [ ] **Budget Compliance**
  - Monthly API costs <$10 for typical usage
  - Cost estimation accurate
  - Monitoring shows actual spend

- [ ] **Fallback Works**
  - Auto-falls back to Ollama on budget limit
  - Warning logged when approaching limit
  - No service interruption

---

## 🔧 Operational Readiness

### Deployment

- [ ] **Migration Safe**
  - Can roll out to production without downtime
  - Rollback plan documented
  - Database migration tested on staging

- [ ] **Monitoring**
  - Can track hybrid search usage
  - Can measure performance
  - Can detect errors

### Debugging

- [ ] **Observability**
  - Debug mode shows score breakdown
  - Logs include provider selection
  - Can trace query through pipeline

---

## ✋ Stop Conditions

**Do NOT mark Phase 11 complete if:**

- ❌ Any breaking changes to existing collections
- ❌ MCP tools don't work
- ❌ Hybrid search >1 second latency
- ❌ Test coverage <70%
- ❌ TypeScript errors present
- ❌ API costs >$20/month in testing

---

## ✅ Sign-Off Checklist

### Before Merging:

- [ ] All functional requirements met
- [ ] All tests passing (unit + integration)
- [ ] Performance benchmarks acceptable
- [ ] Documentation complete
- [ ] Code reviewed
- [ ] Backwards compatibility verified
- [ ] MCP tested with external agents
- [ ] Demo prepared

### Demo Script:

```bash
# 1. Show hybrid search improvement
curl -X POST http://localhost:3333/api/search \
  -d '{"query":"StatefulWidget","collection_id":"flutter-docs"}'
# Verify: finds exact matches

# 2. Show multi-provider routing
# Check logs to see which provider was used
tail -f logs/server.log | grep "Embedding provider selected"

# 3. Show metadata filtering
curl -X POST http://localhost:3333/api/search \
  -d '{
    "query":"authentication",
    "collection_id":"flutter-docs",
    "filters":{"framework":"flutter","framework_version":">=3.24.0"}
  }'

# 4. Show trust scoring
# Official docs should rank higher than community
curl -X POST http://localhost:3333/api/search \
  -d '{"query":"best practices","collection_id":"flutter-docs"}'

# 5. Test MCP integration
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_rag","arguments":{"query":"StatefulWidget","collection_id":"flutter-docs"}}}' | \
  node apps/mcp/dist/index.js
```

### Approval Required From:

- [ ] Technical lead (architecture review)
- [ ] You (feature validation)
- [ ] Test results (automated checks pass)

---

## 📝 Completion Criteria Summary

**Phase 11 is DONE when:**

1. ✅ Hybrid search works and is faster than 600ms
2. ✅ Multi-provider embeddings work (Ollama + OpenAI + Voyage)
3. ✅ Metadata tracks versions, quality, embedding model
4. ✅ Trust scoring affects rankings
5. ✅ Zero breaking changes (backwards compatible)
6. ✅ All tests pass (>80% coverage)
7. ✅ MCP tools work perfectly
8. ✅ Documentation complete
9. ✅ Cost <$10/month
10. ✅ Demo successful

**Tag as `v1.1.0-phase-11` and proceed to Phase 9** 🚀
