# Phase 13 Day 2 - Agent Prompt

**Task:** Code Chunker Service Implementation & Pipeline Integration

**Status:** Day 1 complete (Dart parser ready). Now building the code-aware chunking system.

---

## 📚 Documentation to Read

**Read these documents IN ORDER:**

1. **docs/phases/phase-13/01_CODE_CHUNKING_ARCHITECTURE.md** (PRIMARY - chunker design)
2. **docs/phases/phase-13/04_BUILD_PLAN.md** (Day 2 section)
3. **apps/server/src/pipeline/dart-analyzer.ts** (Day 1 implementation)
4. **apps/server/src/pipeline/orchestrator.ts** (existing pipeline)
5. **apps/server/src/pipeline/chunk.ts** (simple chunking for reference)

**Work under:** Issue #62 (Phase 13 Epic)

---

## 🚨 CRITICAL: What to Use and What to Ignore

**ONLY use these sources (in order of authority):**
1. ✅ **This daily prompt** (PRIMARY - your single source of truth)
2. ✅ **Documentation files listed above** (Phase 13 docs)
3. ✅ **Day 1 implementation** (Dart parser you built)
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

### 1. Create Code Chunker Service
- **File:** `apps/server/src/pipeline/code-chunker.ts`
- **Implementation:** AST-based chunking (~250 lines)
- **Features:**
  - Route by file extension (.dart, .ts, .tsx, .js, .jsx)
  - Use Dart parser for .dart files
  - Chunk functions as complete units
  - Chunk classes (whole or per-method based on size)
  - Preserve imports with code
  - Add rich metadata (function names, parameters, etc.)
  - Fallback to simple chunking on parse errors

### 2. Integrate with Pipeline
- **File:** `apps/server/src/pipeline/orchestrator.ts` (MODIFY)
- **Changes:**
  - Detect code files by extension
  - Use `chunkCodeFile()` for code files when `CODE_CHUNKING=true`
  - Preserve existing `chunkText()` for non-code files
  - Add feature flag check
  - No breaking changes

### 3. Write Chunker Tests
- **File:** `apps/server/src/pipeline/__tests__/code-chunker.test.ts`
- **Coverage:**
  - Dart file chunking (functions, classes, methods)
  - Import preservation when enabled
  - Fallback chunking on parse errors
  - Metadata accuracy
  - Different file types routed correctly

### 4. End-to-End Testing
- Test complete ingestion flow with actual Dart file
- Verify chunks have correct metadata
- Verify imports preserved
- Verify fallback works

---

## ✅ Requirements Checklist

### Code Chunker Implementation
- [ ] Create `apps/server/src/pipeline/code-chunker.ts`
- [ ] Export interface `CodeChunkOptions` (maxChunkSize, preserveImports, trackRelationships)
- [ ] Implement `chunkCodeFile(filePath, content, options)` - main entry point
- [ ] Implement `chunkDartCode()` - uses Day 1 parser
- [ ] Implement `chunkJavaScriptCode()` - placeholder (returns simple chunks)
- [ ] Implement `chunkTypeScriptCode()` - placeholder (Day 4)
- [ ] Implement `simpleChunking()` - fallback function
- [ ] Function chunking: Extract complete functions as chunks
- [ ] Class chunking: Whole class if <100 lines, per-method if larger
- [ ] Method chunking: Include class context in metadata
- [ ] Import preservation: Add imports array to metadata when enabled
- [ ] Metadata enrichment: function_name, class_name, parameters, return_type, line_range
- [ ] Error handling: Catch parse errors, fallback to simple chunking, log warnings

### Pipeline Integration
- [ ] Modify `apps/server/src/pipeline/orchestrator.ts`
- [ ] Import `chunkCodeFile` from code-chunker
- [ ] Add code file detection: `/\.(dart|ts|tsx|js|jsx)$/`
- [ ] Add feature flag check: `process.env.CODE_CHUNKING === 'true'`
- [ ] Route code files to `chunkCodeFile()` when enabled
- [ ] Route non-code files to existing `chunkText()`
- [ ] Pass options: preserveImports, trackRelationships from env
- [ ] Preserve existing behavior when CODE_CHUNKING is false/undefined
- [ ] No breaking changes to API

### Unit Tests
- [ ] Create `apps/server/src/pipeline/__tests__/code-chunker.test.ts`
- [ ] Test: Chunks Dart file into functions (3+ chunks)
- [ ] Test: Chunks Dart class (whole or per-method based on size)
- [ ] Test: Preserves imports when enabled
- [ ] Test: Metadata includes function_name, parameters, return_type
- [ ] Test: Metadata includes line_range, file_path
- [ ] Test: Falls back to simple chunking on parse error
- [ ] Test: Routes .dart files correctly
- [ ] Test: Routes .ts files correctly (placeholder for Day 4)
- [ ] Test: Unsupported extensions use simple chunking

### Integration Tests
- [ ] Create `apps/server/src/pipeline/__tests__/integration-code.test.ts`
- [ ] Test: End-to-end Dart file ingestion
- [ ] Test: Chunks stored in database with metadata
- [ ] Test: CODE_CHUNKING=false uses simple chunking
- [ ] Test: CODE_CHUNKING=true uses AST chunking
- [ ] Test: Parse error doesn't break ingestion

### Quality Checks
- [ ] Run: `pnpm --filter @synthesis/server test code-chunker`
- [ ] Run: `pnpm --filter @synthesis/server test integration-code`
- [ ] Run: `pnpm --filter @synthesis/server typecheck`
- [ ] Run: `pnpm lint`
- [ ] Verify: All tests passing
- [ ] Verify: No TypeScript errors
- [ ] Verify: Existing tests still pass (no regressions)

---

## 🔧 Commands to Run

### 1. Create Files
```bash
# Create chunker
touch apps/server/src/pipeline/code-chunker.ts

# Create tests
touch apps/server/src/pipeline/__tests__/code-chunker.test.ts
touch apps/server/src/pipeline/__tests__/integration-code.test.ts
```

### 2. Development Loop
```bash
# Run tests in watch mode
pnpm --filter @synthesis/server test:watch code-chunker

# Run integration tests
pnpm --filter @synthesis/server test integration-code

# Type check
pnpm --filter @synthesis/server typecheck
```

### 3. Test Pipeline Integration
```bash
# Start server with code chunking enabled
CODE_CHUNKING=true PRESERVE_IMPORTS=true pnpm --filter @synthesis/server dev

# In another terminal, ingest a Dart file
curl -X POST http://localhost:3333/api/ingest \
  -F "file=@apps/server/src/pipeline/__tests__/fixtures/sample.dart" \
  -F "collection_id=test-collection" \
  -F "title=Sample Dart File"

# Check chunks in database
psql $DATABASE_URL -c "
  SELECT 
    id,
    text_preview(text, 50) as preview,
    metadata->>'chunk_type' as type,
    metadata->>'function_name' as function,
    metadata->>'class_name' as class
  FROM chunks 
  WHERE document_id = (SELECT id FROM documents ORDER BY created_at DESC LIMIT 1)
  ORDER BY chunk_index;
"
```

### 4. Test Fallback Behavior
```bash
# Create intentionally broken Dart file
echo "class { invalid dart }" > /tmp/broken.dart

# Ingest it
CODE_CHUNKING=true curl -X POST http://localhost:3333/api/ingest \
  -F "file=@/tmp/broken.dart" \
  -F "collection_id=test-collection" \
  -F "title=Broken Dart File"

# Verify it fell back to simple chunking (should succeed, not crash)
```

---

## 📊 Code Chunker Implementation Structure

### Main Interface
```typescript
import type { DocumentChunk } from '@synthesis/shared';
import { parseDartFile } from './dart-analyzer.js';

export interface CodeChunkOptions {
  maxChunkSize?: number;      // Max lines per chunk (default: 100)
  preserveImports?: boolean;   // Include imports in chunks
  trackRelationships?: boolean; // Build file dependency graph (Day 3)
}

export async function chunkCodeFile(
  filePath: string,
  content: string,
  options: CodeChunkOptions = {}
): Promise<DocumentChunk[]> {
  const extension = filePath.split('.').pop()?.toLowerCase();
  
  try {
    switch (extension) {
      case 'dart':
        return await chunkDartCode(filePath, content, options);
      case 'ts':
      case 'tsx':
        return await chunkTypeScriptCode(filePath, content, options); // Day 4
      case 'js':
      case 'jsx':
        return await chunkJavaScriptCode(filePath, content, options); // Fallback
      default:
        console.warn(`Unsupported file type: ${extension}, using simple chunking`);
        return simpleChunking(content);
    }
  } catch (error) {
    console.error(`AST parsing failed for ${filePath}, falling back to simple chunking`, error);
    return simpleChunking(content);
  }
}
```

### Dart Chunking
```typescript
async function chunkDartCode(
  filePath: string,
  content: string,
  options: CodeChunkOptions
): Promise<DocumentChunk[]> {
  const ast = await parseDartFile(content, filePath);
  const chunks: DocumentChunk[] = [];
  const imports = ast.imports.map(i => i.uri);
  
  // Chunk top-level functions
  for (const func of ast.functions) {
    chunks.push({
      text: func.code,
      metadata: {
        chunk_type: 'function',
        function_name: func.name,
        parameters: func.parameters,
        return_type: func.returnType,
        doc_comment: func.docComment,
        imports: options.preserveImports ? imports : undefined,
        file_path: filePath,
        line_range: func.lineRange,
        language: 'dart',
      },
    });
  }
  
  // Chunk classes
  for (const cls of ast.classes) {
    const lineCount = cls.code.split('\n').length;
    
    if (lineCount < (options.maxChunkSize || 100)) {
      // Small class: chunk as whole
      chunks.push({
        text: cls.code,
        metadata: {
          chunk_type: 'class',
          class_name: cls.name,
          methods: cls.methods.map(m => m.name),
          properties: cls.properties.map(p => p.name),
          extends: cls.superclass,
          implements: cls.interfaces,
          imports: options.preserveImports ? imports : undefined,
          file_path: filePath,
          line_range: cls.lineRange,
          language: 'dart',
          is_widget: cls.superclass?.includes('Widget') || cls.superclass?.includes('State'),
          is_stateful: cls.superclass === 'StatefulWidget',
        },
      });
    } else {
      // Large class: chunk per method
      for (const method of cls.methods) {
        chunks.push({
          text: method.code,
          metadata: {
            chunk_type: 'method',
            function_name: method.name,
            class_context: cls.name,
            parameters: method.parameters,
            return_type: method.returnType,
            imports: options.preserveImports ? imports : undefined,
            file_path: filePath,
            line_range: method.lineRange,
            language: 'dart',
          },
        });
      }
    }
  }
  
  return chunks;
}
```

### Fallback Chunking
```typescript
function simpleChunking(content: string): DocumentChunk[] {
  const lines = content.split('\n');
  const chunkSize = 50;
  const overlap = 10;
  const chunks: DocumentChunk[] = [];
  
  for (let i = 0; i < lines.length; i += chunkSize - overlap) {
    const chunkLines = lines.slice(i, i + chunkSize);
    chunks.push({
      text: chunkLines.join('\n'),
      metadata: {
        chunk_type: 'text',
        line_range: [i + 1, i + chunkLines.length],
      },
    });
  }
  
  return chunks;
}
```

### Pipeline Integration
```typescript
// In orchestrator.ts, modify ingestDocument():

const text = await extractText(file, document.content_type);

// NEW: Check if this is a code file
const isCodeFile = document.file_path?.match(/\.(dart|ts|tsx|js|jsx)$/);

let chunks: Chunk[];

if (isCodeFile && process.env.CODE_CHUNKING === 'true') {
  // Use code-aware chunking
  console.log(`Using code-aware chunking for ${document.file_path}`);
  chunks = await chunkCodeFile(
    document.file_path!,
    text,
    {
      preserveImports: process.env.PRESERVE_IMPORTS === 'true',
      trackRelationships: process.env.TRACK_RELATIONSHIPS === 'true',
    }
  );
} else {
  // Use simple text chunking
  chunks = chunkText(text, options.chunk, {
    ...extraction.metadata,
    documentId,
  });
}
```

---

## 📝 Deliverables

### 1. Code Chunker Service
**File:** `apps/server/src/pipeline/code-chunker.ts`

**Must export:**
- `CodeChunkOptions` interface
- `chunkCodeFile()` function
- Internal functions for Dart, TS, JS chunking

**Must handle:**
- All file extensions specified
- Import preservation
- Metadata enrichment
- Fallback on errors

### 2. Modified Pipeline
**File:** `apps/server/src/pipeline/orchestrator.ts`

**Changes:**
- Import code chunker
- Add code file detection
- Add feature flag check
- Route appropriately
- No breaking changes

### 3. Unit Tests
**File:** `code-chunker.test.ts`

**Must have:**
- 8+ test cases
- All chunking modes tested
- Metadata validation
- Error handling tests

### 4. Integration Tests
**File:** `integration-code.test.ts`

**Must have:**
- End-to-end ingestion test
- Database verification
- Feature flag tests
- Fallback verification

### 5. Day 2 Summary
**Post to Issue #62:**

```markdown
# Phase 13 Day 2 - Code Chunker Complete

## Implementation Summary
- ✅ Created `code-chunker.ts` (~250 lines)
- ✅ Integrated with pipeline orchestrator
- ✅ Feature flag controlled (CODE_CHUNKING env var)
- ✅ Fallback chunking implemented
- ✅ Unit tests passing (XX/XX tests)
- ✅ Integration tests passing (XX/XX tests)

## Chunking Capabilities
- Dart Functions: ✅ Complete units preserved
- Dart Classes: ✅ Whole or per-method based on size
- Imports: ✅ Preserved when PRESERVE_IMPORTS=true
- Metadata: ✅ function_name, class_name, parameters, return_type, line_range
- Fallback: ✅ Simple chunking on parse errors
- File Routing: ✅ .dart, .ts, .tsx, .js, .jsx

## Pipeline Integration
- ✅ Code files detected by extension
- ✅ Feature flag check (CODE_CHUNKING=true)
- ✅ No breaking changes (backward compatible)
- ✅ Existing simple chunking preserved

## Test Results
- Unit tests: XX/XX passing ✅
- Integration tests: XX/XX passing ✅
- Regression tests: All passing ✅
- Coverage: XX% ✅

## Example Chunks Generated
From `sample.dart`:
- 1 function chunk (initializeApp)
- 3 method chunks (login, logout, formatToken)
- 1 class overview chunk (AuthService)
- All with imports preserved
- All with rich metadata

## Files Modified
- `apps/server/src/pipeline/code-chunker.ts` (NEW)
- `apps/server/src/pipeline/orchestrator.ts` (MODIFIED)
- `apps/server/src/pipeline/__tests__/code-chunker.test.ts` (NEW)
- `apps/server/src/pipeline/__tests__/integration-code.test.ts` (NEW)

## Environment Variables Added
```bash
CODE_CHUNKING=true              # Enable AST-based chunking
PRESERVE_IMPORTS=true           # Include imports in chunks
TRACK_RELATIONSHIPS=false       # Day 3 feature
```

## Next Steps
Day 3: File Relationships Service
```

---

## 🚨 Critical Validation Steps

### Step 1: Verify Dart File Chunks Correctly
```bash
# Ingest sample.dart
curl -X POST http://localhost:3333/api/ingest \
  -F "file=@apps/server/src/pipeline/__tests__/fixtures/sample.dart" \
  -F "collection_id=test" \
  -F "title=Sample Dart"

# Get document ID
DOC_ID=$(curl -s http://localhost:3333/api/collections/test/documents | jq -r '.documents[0].id')

# Get chunks
curl -s "http://localhost:3333/api/documents/$DOC_ID/chunks" | jq '.chunks[] | {
  type: .metadata.chunk_type,
  name: (.metadata.function_name // .metadata.class_name),
  has_imports: (.metadata.imports != null)
}'

# Expected output:
# { "type": "function", "name": "initializeApp", "has_imports": true }
# { "type": "method", "name": "login", "has_imports": true }
# { "type": "method", "name": "logout", "has_imports": true }
# { "type": "method", "name": "formatToken", "has_imports": true }
```

### Step 2: Verify Feature Flag Works
```bash
# Test with CODE_CHUNKING=false (default)
CODE_CHUNKING=false curl -X POST http://localhost:3333/api/ingest \
  -F "file=@sample.dart" \
  -F "collection_id=test-simple"

# Verify: Should use simple text chunking
# Chunks will have chunk_type='text', no function_name

# Test with CODE_CHUNKING=true
CODE_CHUNKING=true curl -X POST http://localhost:3333/api/ingest \
  -F "file=@sample.dart" \
  -F "collection_id=test-code"

# Verify: Should use code chunking
# Chunks will have chunk_type='function'/'class', with function_name
```

### Step 3: Verify Fallback Works
```bash
# Create broken Dart file
echo "class { malformed dart syntax }" > /tmp/broken.dart

# Ingest with CODE_CHUNKING=true
CODE_CHUNKING=true curl -X POST http://localhost:3333/api/ingest \
  -F "file=@/tmp/broken.dart" \
  -F "collection_id=test"

# Should succeed (not crash)
# Should log: "AST parsing failed... falling back to simple chunking"
# Check logs for the warning message
```

### Step 4: Verify No Regressions
```bash
# Run all existing tests
pnpm test

# All should pass - no breaking changes
```

---

## 🎯 Integration Test Example

```typescript
describe('Code Chunking Integration', () => {
  it('ingests Dart file with code-aware chunking', async () => {
    // Setup
    process.env.CODE_CHUNKING = 'true';
    process.env.PRESERVE_IMPORTS = 'true';
    
    const content = await readFile('fixtures/sample.dart', 'utf-8');
    const document = await createDocument({
      title: 'Sample Dart',
      file_path: 'sample.dart',
      content_type: 'text/plain',
    });
    
    // Ingest
    await ingestDocument(document.id);
    
    // Verify chunks
    const chunks = await getChunks(document.id);
    
    // Should have function chunks
    const functionChunks = chunks.filter(c => c.metadata.chunk_type === 'function');
    expect(functionChunks.length).toBeGreaterThan(0);
    
    // Should have method chunks
    const methodChunks = chunks.filter(c => c.metadata.chunk_type === 'method');
    expect(methodChunks.length).toBeGreaterThan(0);
    
    // Should preserve imports
    expect(functionChunks[0].metadata.imports).toBeDefined();
    expect(functionChunks[0].metadata.imports).toContain('package:flutter/material.dart');
    
    // Should have rich metadata
    expect(functionChunks[0].metadata.function_name).toBeDefined();
    expect(functionChunks[0].metadata.line_range).toBeDefined();
    expect(functionChunks[0].metadata.file_path).toBe('sample.dart');
  });
  
  it('falls back to simple chunking on parse error', async () => {
    process.env.CODE_CHUNKING = 'true';
    
    const document = await createDocument({
      title: 'Broken Dart',
      file_path: 'broken.dart',
      content_type: 'text/plain',
    });
    
    await writeFile(document.file_path, 'class { invalid }');
    
    // Should not throw
    await expect(ingestDocument(document.id)).resolves.not.toThrow();
    
    // Should create chunks (simple chunking fallback)
    const chunks = await getChunks(document.id);
    expect(chunks.length).toBeGreaterThan(0);
    
    // Chunks should be simple text chunks
    expect(chunks[0].metadata.chunk_type).toBe('text');
  });
});
```

---

## ⚠️ Important Notes

1. **Backward Compatibility**
   - Default: CODE_CHUNKING=false (uses existing simple chunking)
   - No changes to existing documents
   - No changes to API responses
   - Feature is opt-in

2. **Error Handling**
   - Always catch parse errors
   - Always fall back to simple chunking
   - Never crash ingestion pipeline
   - Log warnings for debugging

3. **Metadata Enrichment**
   - Add metadata, don't replace
   - Preserve all existing metadata fields
   - Use optional chaining for safety
   - Follow shared types schema

4. **Performance**
   - Code chunking may be 20-30% slower
   - This is acceptable for one-time ingestion
   - Monitor in production
   - Can optimize later if needed

---

## 🎉 Success Criteria

**Day 2 is complete when:**

- ✅ `code-chunker.ts` created and tested
- ✅ Pipeline integration complete
- ✅ Dart files chunk by function/class
- ✅ Imports preserved when enabled
- ✅ Rich metadata added to chunks
- ✅ Fallback chunking works on errors
- ✅ Feature flag controls behavior
- ✅ No breaking changes to existing functionality
- ✅ All unit tests passing (8+ tests)
- ✅ All integration tests passing (2+ tests)
- ✅ All existing tests still passing
- ✅ No TypeScript errors
- ✅ No linting errors
- ✅ End-to-end test successful

**Timeline:** 6 hours

---

## 📞 Handoff

**When complete, post to Issue #62:**

```markdown
✅ Phase 13 Day 2 Complete - Code Chunker Integrated

Code-aware chunking implemented and integrated with pipeline. Backward compatible with feature flag.

See summary comment above for:
- Chunking capabilities
- Pipeline integration details
- Test results
- Example chunks

Files created/modified:
- code-chunker.ts (NEW)
- orchestrator.ts (MODIFIED)
- code-chunker.test.ts (NEW)
- integration-code.test.ts (NEW)

Next: Day 3 - File Relationships
```

---

**Remember:** Focus on clean integration. The pipeline should work exactly as before when CODE_CHUNKING=false. All new behavior is opt-in.
