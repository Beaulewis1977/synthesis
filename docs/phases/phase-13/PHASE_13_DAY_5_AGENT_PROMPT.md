# Phase 13 Day 5 - Agent Prompt

## OVERRIDE (read first)
- Primary: `docs/phases/phase-13/PHASE_13_DAY_5_AUDIT_FIXES.md`
- If anything below conflicts with the override, follow the override.
- Use UUID `collection_id` (create a collection first); remove `title` field in ingests.
- Run benchmarks only after TS parser/chunker is implemented; fix P90 calculation and ensure dependencies (e.g., `glob`) are present.
- Use related-files route in `apps/server/src/routes/collections.ts`; implement `GET /api/documents/:id/chunks` or skip those calls.
- Wire `CODE_MAX_CHUNK_LINES` in `orchestrator.ts` or omit it from docs.

**Task:** Integration Testing, Performance Validation, Documentation & Polish

**Status:** Days 1-4 complete (Dart parser, TS parser, chunker, relationships). Now validating everything works.

---

## 📚 Documentation to Read

**Read these documents IN ORDER:**

1. **docs/phases/phase-13/05_ACCEPTANCE_CRITERIA.md** (PRIMARY - validation checklist)
2. **docs/phases/phase-13/04_BUILD_PLAN.md** (Day 5 section)
3. **docs/phases/phase-13/00_PHASE_13_OVERVIEW.md** (success metrics)
4. **GitHub Issue #62** (check all deliverables)

**Work under:** Issue #62 (Phase 13 Epic)

---

## 🚨 CRITICAL: What to Use and What to Ignore

**ONLY use these sources (in order of authority):**
1. ✅ **This daily prompt** (PRIMARY - your single source of truth)
2. ✅ **Acceptance criteria document** (Phase 13 validation checklist)
3. ✅ **Day 1-4 implementations** (Complete backend you built)
4. ✅ **Existing codebase** (for integration patterns)

**NEVER reference or trust:**
- ❌ **Issue #62 comments** (outdated, wrong paths, Phase 10 references)
- ❌ **Issue #65** (Frontend issue - still references Phase 10)
- ❌ **Any "Phase 10" references** (old numbering)
- ❌ **Documentation paths with `phase-10`** (don't exist)

**If you encounter conflicting information:**
- This prompt overrides everything else
- Follow Phase 13 documentation only
- Ignore Phase 10 references completely

---

## 🎯 Main Objectives

### 1. Large-Scale Testing
- Test on real Flutter project (100+ files)
- Test on real TypeScript project (50+ files)
- Verify: No crashes, reasonable performance
- Document: Success rates, edge cases

### 2. Performance Benchmarking
- Measure: Parse time for different file sizes
- Measure: Chunking overhead vs simple chunking
- Verify: Targets met (<500ms per file average)
- Compare: Dart vs TypeScript performance

### 3. Acceptance Criteria Validation
- Run through complete checklist
- Verify: All "Must Have" items working
- Test: Fallback chunking on errors
- Verify: Feature flags work correctly

### 4. Documentation Updates
- Update README with Phase 13 features
- Document environment variables
- Create troubleshooting guide
- Write usage examples

---

## ✅ Requirements Checklist

### Large-Scale Testing
- [ ] Clone sample Flutter project (flutter/samples)
- [ ] Ingest 100+ Dart files
- [ ] Monitor: Success rate, errors, warnings
- [ ] Document: Parse failures, edge cases
- [ ] Clone sample TypeScript project
- [ ] Ingest 50+ TypeScript files
- [ ] Verify: Both languages work at scale
- [ ] Measure: Total ingestion time

### Performance Benchmarking
- [ ] Create benchmark script: `scripts/benchmark-phase13.ts`
- [ ] Measure Dart parsing: 10 files (small, medium, large)
- [ ] Measure TypeScript parsing: 10 files
- [ ] Measure chunking overhead vs simple chunking
- [ ] Calculate average parse time
- [ ] Verify: <500ms per file (90th percentile)
- [ ] Document: Performance characteristics
- [ ] Create performance table in summary

### Acceptance Criteria Validation
- [ ] Test: Dart functions chunk as complete units (95%+)
- [ ] Test: TypeScript functions chunk as complete units (90%+)
- [ ] Test: Imports preserved when enabled
- [ ] Test: File relationships tracked correctly
- [ ] Test: Fallback chunking on parse errors
- [ ] Test: Feature flags (CODE_CHUNKING, PRESERVE_IMPORTS, TRACK_RELATIONSHIPS)
- [ ] Test: Search finds functions by name
- [ ] Test: Related files API works
- [ ] Test: No breaking changes (existing tests pass)

### Documentation Updates
- [ ] Update main README.md (Phase 13 features)
- [ ] Create `docs/CODE_CHUNKING_GUIDE.md`
- [ ] Update `.env.example` with Phase 13 vars
- [ ] Document troubleshooting steps
- [ ] Add usage examples
- [ ] Update API documentation (related-files endpoint)

### Quality Checks
- [ ] Run: Full test suite `pnpm test`
- [ ] Run: `pnpm lint` (no errors)
- [ ] Run: `pnpm build` (successful)
- [ ] Run: `pnpm typecheck` (no errors)
- [ ] Verify: Code coverage >80%
- [ ] Verify: All Phase 13 tests passing
- [ ] Verify: No regressions in existing tests

### PR Preparation
- [ ] Create metrics summary
- [ ] Fill out acceptance criteria checklist
- [ ] Document breaking changes: NONE
- [ ] Write PR description
- [ ] Test instructions included
- [ ] Screenshot/examples if applicable

---

## 🔧 Commands to Run

### 1. Large-Scale Testing

```bash
# Clone Flutter samples
git clone https://github.com/flutter/samples.git /tmp/flutter-samples

# Ingest Flutter samples (selective - not all 2000+ files)
find /tmp/flutter-samples -name "*.dart" -type f | head -n 100 | while read file; do
  echo "Ingesting: $file"
  curl -X POST http://localhost:3333/api/ingest \
    -F "file=@$file" \
    -F "collection_id=flutter-test" \
    -F "title=$(basename $file)" \
    2>&1 | tee -a ingest.log
done

# Check logs for errors
grep -i "error\|fail" ingest.log

# Clone TypeScript samples
git clone https://github.com/microsoft/TypeScript-Node-Starter.git /tmp/ts-samples

# Ingest TypeScript files
find /tmp/ts-samples/src -name "*.ts" -type f | while read file; do
  curl -X POST http://localhost:3333/api/ingest \
    -F "file=@$file" \
    -F "collection_id=ts-test"
done
```

### 2. Performance Benchmarking

```bash
# Create benchmark script
cat > scripts/benchmark-phase13.ts << 'EOF'
import { readFileSync } from 'fs';
import { parseDartFile } from '../apps/server/src/pipeline/dart-analyzer';
import { parseTypeScriptFile } from '../apps/server/src/pipeline/ts-analyzer';
import { chunkCodeFile } from '../apps/server/src/pipeline/code-chunker';
import { glob } from 'glob';

async function benchmarkDart() {
  const files = glob.sync('test-samples/**/*.dart').slice(0, 10);
  const times: number[] = [];
  
  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const start = performance.now();
    await parseDartFile(content, file);
    times.push(performance.now() - start);
  }
  
  console.log('Dart parsing:');
  console.log('  Average:', times.reduce((a,b) => a+b) / times.length, 'ms');
  console.log('  P90:', times.sort()[Math.floor(times.length * 0.9)], 'ms');
}

await benchmarkDart();
EOF

# Run benchmark
pnpm tsx scripts/benchmark-phase13.ts > docs/phases/phase-13/PHASE_13_BENCHMARK_RESULTS.md
```

### 3. Validate Acceptance Criteria

```bash
# Test function extraction accuracy
psql $DATABASE_URL -c "
  SELECT 
    COUNT(*) FILTER (WHERE metadata->>'chunk_type' = 'function') as function_chunks,
    COUNT(*) FILTER (WHERE metadata->>'chunk_type' = 'class') as class_chunks,
    COUNT(*) FILTER (WHERE metadata->>'chunk_type' = 'text') as text_chunks,
    COUNT(*) as total_chunks
  FROM chunks
  WHERE document_id IN (
    SELECT id FROM documents WHERE collection_id = (
      SELECT id FROM collections WHERE name = 'flutter-test'
    )
  );
"

# Expected: function_chunks > 80% of total (95% target)

# Test imports preserved
psql $DATABASE_URL -c "
  SELECT 
    COUNT(*) FILTER (WHERE metadata->'imports' IS NOT NULL) as with_imports,
    COUNT(*) as total
  FROM chunks
  WHERE metadata->>'chunk_type' IN ('function', 'class', 'method');
"

# Expected: with_imports ~= total (when PRESERVE_IMPORTS=true)
```

### 4. Feature Flag Testing

```bash
# Test CODE_CHUNKING=false (default/fallback)
CODE_CHUNKING=false curl -X POST http://localhost:3333/api/ingest \
  -F "file=@sample.dart" \
  -F "collection_id=test-simple"

# Verify: Uses simple chunking (chunk_type='text')

# Test CODE_CHUNKING=true
CODE_CHUNKING=true curl -X POST http://localhost:3333/api/ingest \
  -F "file=@sample.dart" \
  -F "collection_id=test-code"

# Verify: Uses AST chunking (chunk_type='function')

# Test PRESERVE_IMPORTS=false
CODE_CHUNKING=true PRESERVE_IMPORTS=false curl -X POST http://localhost:3333/api/ingest \
  -F "file=@sample.dart" \
  -F "collection_id=test-no-imports"

# Verify: No imports in metadata

# Test TRACK_RELATIONSHIPS=false
CODE_CHUNKING=true TRACK_RELATIONSHIPS=false curl -X POST http://localhost:3333/api/ingest \
  -F "file=@sample.dart" \
  -F "collection_id=test-no-rels"

# Verify: No relationships stored
```

### 5. Quality Checks

```bash
# Full test suite
pnpm test

# Lint
pnpm lint

# Build
pnpm build

# Type check
pnpm typecheck

# Coverage report
pnpm test:coverage
```

---

## 📊 Metrics to Collect

### Performance Metrics

**Create table like this:**

```markdown
| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Dart parse (small <200 lines) | <100ms | XXms | ✅/❌ |
| Dart parse (medium 200-1000) | <300ms | XXms | ✅/❌ |
| Dart parse (large 1000-5000) | <500ms | XXms | ✅/❌ |
| TypeScript parse (small) | <100ms | XXms | ✅/❌ |
| TypeScript parse (medium) | <300ms | XXms | ✅/❌ |
| TypeScript parse (large) | <500ms | XXms | ✅/❌ |
| Chunking overhead | <2x simple | X.Xx | ✅/❌ |
| 100 files ingestion | <60s | XXs | ✅/❌ |
```

### Accuracy Metrics

```markdown
| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Dart function preservation | >95% | XX% | ✅/❌ |
| TS function preservation | >90% | XX% | ✅/❌ |
| Import accuracy | >95% | XX% | ✅/❌ |
| Fallback success rate | 100% | XX% | ✅/❌ |
| Relationship accuracy | >90% | XX% | ✅/❌ |
```

### Scale Testing

```markdown
| Test | Files | Success | Failures | Time |
|------|-------|---------|----------|------|
| Flutter samples | 100 | XX | XX | XXs |
| TypeScript project | 50 | XX | XX | XXs |
| Mixed (Dart+TS) | 150 | XX | XX | XXs |
```

---

## 📝 Deliverables

### 1. Benchmark Results
**File:** `docs/phases/phase-13/PHASE_13_BENCHMARK_RESULTS.md`

**Must include:**
- Performance metrics table
- Accuracy metrics table
- Scale testing results
- Methodology description
- Edge cases discovered
- Comparison: AST vs simple chunking

### 2. Code Chunking Guide
**File:** `docs/CODE_CHUNKING_GUIDE.md`

**Must include:**
- What code chunking is
- How to enable it
- Environment variables
- Supported languages
- Limitations
- Troubleshooting

### 3. Updated README
**File:** `README.md`

**Add section:**
```markdown
### Code Intelligence (Phase 13)

**AST-based code chunking** preserves code structure:
- Functions stay intact (no mid-function breaks)
- Imports preserved with code
- File relationships tracked
- Supports Dart and TypeScript

Enable with:
```bash
CODE_CHUNKING=true
PRESERVE_IMPORTS=true
TRACK_RELATIONSHIPS=true
```

See [Code Chunking Guide](docs/CODE_CHUNKING_GUIDE.md) for details.
```

### 4. Environment Variables
**File:** `.env.example`

**Add:**
```bash
# Phase 13: Code Intelligence
CODE_CHUNKING=false              # Enable AST-based code chunking
PRESERVE_IMPORTS=true            # Include imports in chunks
TRACK_RELATIONSHIPS=false        # Track file dependencies
CODE_MAX_CHUNK_LINES=100        # Max lines per chunk
```

### 5. Day 5 Summary & Final Report
**Post to Issue #62:**

```markdown
# Phase 13 Complete - Code Intelligence Ready 🎉

## Final Summary

Phase 13 implementation complete. AST-based code chunking working for Dart and TypeScript with full relationship tracking.

## Performance Metrics

[Insert table from benchmarks]

**Key Results:**
- Average parse time: XXXms ✅
- Function preservation: XX% (target: 95%) ✅
- 100 files processed in XXs ✅
- All targets met ✅

## Accuracy Metrics

[Insert accuracy table]

**Key Results:**
- Dart accuracy: XX% ✅
- TypeScript accuracy: XX% ✅
- Import preservation: XX% ✅
- Fallback: 100% success ✅

## Scale Testing

Tested on:
- ✅ 100 Flutter/Dart files (flutter/samples)
- ✅ 50 TypeScript files
- ✅ Mixed projects
- ✅ Edge cases (malformed code, nested structures)

**Success Rate:** XX% (target: >95%)

## Features Delivered

### Code Chunking
- ✅ Dart AST parser (regex-based)
- ✅ TypeScript AST parser (TS Compiler API)
- ✅ Functions chunk as complete units
- ✅ Classes chunk intelligently
- ✅ Imports preserved with code
- ✅ Fallback to simple chunking on errors

### File Relationships
- ✅ Database migration applied
- ✅ Tracks import relationships
- ✅ Detects test files
- ✅ Finds sibling files
- ✅ API endpoint: GET /api/documents/:id/related-files

### Integration
- ✅ Pipeline integration complete
- ✅ Feature flags working
- ✅ Backward compatible (no breaking changes)
- ✅ All existing tests passing

## Test Results

- Unit tests: XXX/XXX passing ✅
- Integration tests: XX/XX passing ✅
- Benchmark tests: All passing ✅
- Code coverage: XX% (target: >80%) ✅
- Linting: No errors ✅
- TypeScript: No errors ✅
- Build: Success ✅

## Files Created (Total: XX files)

**Backend:**
- `apps/server/src/pipeline/dart-analyzer.ts` (300 lines)
- `apps/server/src/pipeline/ts-analyzer.ts` (200 lines)
- `apps/server/src/pipeline/code-chunker.ts` (250 lines)
- `apps/server/src/services/file-relationships.ts` (350 lines)
- `packages/db/migrations/006_file_relationships.sql`

**Tests:**
- `dart-analyzer.test.ts` (XX tests)
- `ts-analyzer.test.ts` (XX tests)
- `code-chunker.test.ts` (XX tests)
- `file-relationships.test.ts` (XX tests)
- `integration-code.test.ts` (XX tests)

**Documentation:**
- `docs/CODE_CHUNKING_GUIDE.md`
- `docs/phases/phase-13/PHASE_13_BENCHMARK_RESULTS.md`
- Updated: README.md, .env.example

**Modified:**
- `apps/server/src/pipeline/orchestrator.ts`
- `apps/server/src/routes/docs.ts`

## Environment Variables

```bash
# Enable code intelligence
CODE_CHUNKING=true              # AST-based chunking
PRESERVE_IMPORTS=true           # Include imports
TRACK_RELATIONSHIPS=true        # File dependencies
CODE_MAX_CHUNK_LINES=100       # Max chunk size
```

## API Changes

**New Endpoint:**
```
GET /api/documents/:id/related-files
```

Returns:
```json
{
  "file_path": "lib/services/auth.dart",
  "related_files": {
    "imports": [...],
    "imported_by": [...],
    "tests": [...],
    "siblings": [...]
  }
}
```

## Breaking Changes

**None.** All features are opt-in via environment variables. Default behavior unchanged.

## Known Limitations

1. **Dart parsing** is regex-based (not full AST)
   - 95% accuracy on well-formed code
   - Fallback chunking handles edge cases
   
2. **Relationship tracking** is basic
   - Import relationships: Full support
   - Usage relationships: Placeholder (future)
   - Test file detection: Pattern-based
   
3. **Languages supported:** Dart, TypeScript only
   - Other languages use simple chunking
   - Can add more languages in future

## Usage Example

```bash
# Enable code chunking
CODE_CHUNKING=true PRESERVE_IMPORTS=true pnpm --filter @synthesis/server dev

# Ingest Dart file
curl -X POST http://localhost:3333/api/ingest \
  -F "file=@auth_service.dart" \
  -F "collection_id=flutter-app"

# Get related files
curl http://localhost:3333/api/documents/{id}/related-files
```

## Next Steps

**Phase 13 is COMPLETE.** Ready for:
- ✅ Production deployment
- ✅ Frontend integration (Phase 13 Day 6 - optional)
- ✅ Phase 14-15: Integration & v2.0 release

## Acceptance Criteria

All "Must Have" criteria met:
- ✅ Dart functions chunk as complete units (95%+)
- ✅ TypeScript functions chunk correctly (90%+)
- ✅ Imports preserved with code
- ✅ File relationships tracked
- ✅ Performance <500ms per file
- ✅ Fallback works on errors
- ✅ Can handle large projects (100+ files)
- ✅ No breaking changes

**Phase 13: APPROVED FOR MERGE** ✅
```

---

## 🚨 Critical Validation Steps

### Step 1: Verify All Acceptance Criteria

Go through `05_ACCEPTANCE_CRITERIA.md` line by line:
- [ ] All "Must Have" items checked
- [ ] All "Should Have" items checked (or documented why not)
- [ ] Quality metrics met
- [ ] Performance targets met
- [ ] No stop conditions triggered

### Step 2: Test Demo Script

Run the demo from acceptance criteria:
```bash
# Show code-aware chunking
curl -X POST http://localhost:3333/api/ingest \
  -F "file=@auth_service.dart" \
  -F "collection_id=demo"

# Show chunks with functions intact
curl http://localhost:3333/api/documents/{id}/chunks | \
  jq '.chunks[] | select(.metadata.chunk_type == "function")'

# Show imports preserved
curl http://localhost:3333/api/documents/{id}/chunks | \
  jq '.chunks[0].metadata.imports'

# Show related files
curl http://localhost:3333/api/documents/{id}/related-files

# Show search finds functions
curl -X POST http://localhost:3333/api/search \
  -d '{"query":"login function","collection_id":"demo"}' | \
  jq '.results[0]'
```

All should work correctly.

### Step 3: No Regressions

```bash
# Run ALL tests (not just Phase 13)
pnpm test

# All should pass - no breaking changes
```

### Step 4: Documentation Complete

Check:
- [ ] README updated
- [ ] .env.example updated
- [ ] Code Chunking Guide created
- [ ] Benchmark results documented
- [ ] API docs updated
- [ ] Troubleshooting guide included

---

## ⚠️ Important Notes

1. **Performance Targets**
   - If not meeting targets, document actual performance
   - Explain any deviations
   - Propose optimizations for future

2. **Edge Cases**
   - Document all edge cases discovered
   - Explain how they're handled
   - Add to troubleshooting guide

3. **Known Issues**
   - Be honest about limitations
   - Document workarounds
   - Create issues for future improvements

4. **Backward Compatibility**
   - Verify: All existing functionality works
   - Verify: Default behavior unchanged
   - Verify: Feature flags required for new features

---

## 🎉 Success Criteria

**Day 5 is complete when:**

- ✅ Large-scale testing complete (100+ files)
- ✅ Performance benchmarks collected
- ✅ All acceptance criteria validated
- ✅ All "Must Have" items working
- ✅ All "Should Have" items complete
- ✅ Documentation updated (README, guides, .env)
- ✅ Metrics summary posted
- ✅ All tests passing (100% of test suite)
- ✅ No regressions
- ✅ Code coverage >80%
- ✅ Ready for PR/merge

**Timeline:** 6-8 hours

---

## 📞 Final Handoff

**When complete, post to Issue #62:**

```markdown
🎉 Phase 13 COMPLETE - Ready for Production

All implementation, testing, and documentation complete. Phase 13 approved for merge.

See final summary above for:
- Performance metrics (all targets met)
- Accuracy metrics (95%+ function preservation)
- Scale testing results (100+ files successful)
- Complete test results
- Documentation updates
- Usage examples

**Status: APPROVED FOR MERGE** ✅

Branch: phase-13-code-intelligence
PR: #XXX

Next: Phase 14-15 (Integration & v2.0 Release)
```

**Tag release:**
```bash
git tag v1.3.0-phase-13
git push --tags
```

---

**Remember:** This is validation day. Be thorough, document everything, and ensure Phase 13 is production-ready. Quality over speed!
