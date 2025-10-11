# Phase 10: Build Plan

**5-day implementation schedule for code intelligence**

---

## 📅 Day-by-Day Breakdown

### Day 1: Dart AST Parser (6 hours)

**Morning (3 hours): Parser Setup**

```bash
# 1. Research Dart analyzer options
# Option A: dart analyze CLI
# Option B: analysis_server protocol
# Option C: Regex-based parsing (simpler, good enough)

# Decision: Start with Option C (regex), upgrade to A/B if needed

# 2. Create Dart analyzer
touch apps/server/src/pipeline/dart-analyzer.ts
```

Implement regex-based Dart parser (~300 lines):
- Import extraction
- Function extraction
- Class extraction
- Method extraction
- Property extraction
- Helper functions (brace matching, parameter parsing)

**Afternoon (3 hours): Testing & Refinement**

```bash
# 1. Create test files
mkdir -p apps/server/src/pipeline/__tests__/fixtures
touch apps/server/src/pipeline/__tests__/fixtures/sample.dart
```

Sample Dart file for testing:
```dart
import 'package:flutter/material.dart';
import '../models/user.dart';

class AuthService {
  final ApiClient _client;
  
  AuthService(this._client);
  
  Future<User> login(String email, String password) async {
    final response = await _client.post('/login', {
      'email': email,
      'password': password,
    });
    
    return User.fromJson(response.data);
  }
  
  Future<void> logout() async {
    await _client.post('/logout');
  }
}

Future<void> initializeApp() async {
  // Initialization code
}
```

```bash
# 2. Write parser tests
touch apps/server/src/pipeline/dart-analyzer.test.ts
```

```typescript
describe('Dart AST Parser', () => {
  it('extracts imports', async () => {
    const content = await readFile('fixtures/sample.dart', 'utf-8');
    const ast = await parseDartFile(content);
    
    expect(ast.imports).toContainEqual({
      uri: 'package:flutter/material.dart',
    });
    expect(ast.imports).toContainEqual({
      uri: '../models/user.dart',
    });
  });
  
  it('extracts classes', async () => {
    const content = await readFile('fixtures/sample.dart', 'utf-8');
    const ast = await parseDartFile(content);
    
    expect(ast.classes).toHaveLength(1);
    expect(ast.classes[0].name).toBe('AuthService');
    expect(ast.classes[0].methods).toHaveLength(2);
  });
  
  it('extracts functions', async () => {
    const content = await readFile('fixtures/sample.dart', 'utf-8');
    const ast = await parseDartFile(content);
    
    expect(ast.functions).toContainEqual(
      expect.objectContaining({ name: 'initializeApp' })
    );
  });
});
```

```bash
# 3. Run tests
pnpm --filter @synthesis/server test dart-analyzer

# 4. Iterate on parser until tests pass
```

**End of Day 1 Checklist:**
- [ ] Dart parser extracts imports correctly
- [ ] Dart parser extracts classes and methods
- [ ] Dart parser extracts top-level functions
- [ ] Tests passing
- [ ] Performance acceptable (<300ms for typical files)

---

### Day 2: Code Chunker (6 hours)

**Morning (3 hours): Core Chunker**

```bash
# 1. Create code chunker service
touch apps/server/src/pipeline/code-chunker.ts
```

Implement as per `01_CODE_CHUNKING_ARCHITECTURE.md` (~250 lines):
- Main `chunkCodeFile()` function
- Dart chunking logic
- Fallback simple chunking
- Metadata enrichment

```bash
# 2. Write chunker tests
touch apps/server/src/pipeline/code-chunker.test.ts
```

```typescript
describe('Code Chunker', () => {
  it('chunks Dart file into functions', async () => {
    const content = await readFile('fixtures/sample.dart', 'utf-8');
    const chunks = await chunkCodeFile('sample.dart', content);
    
    // Should have: 2 methods + 1 function + 1 class = 4 chunks
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    
    // Check function chunk
    const loginChunk = chunks.find(c => 
      c.metadata?.function_name === 'login'
    );
    expect(loginChunk).toBeDefined();
    expect(loginChunk!.text).toContain('Future<User>');
    expect(loginChunk!.text).toContain('async');
  });
  
  it('preserves imports when enabled', async () => {
    const content = await readFile('fixtures/sample.dart', 'utf-8');
    const chunks = await chunkCodeFile('sample.dart', content, {
      preserveImports: true,
    });
    
    const loginChunk = chunks.find(c => 
      c.metadata?.function_name === 'login'
    );
    
    expect(loginChunk!.metadata?.imports).toContainEqual(
      'package:flutter/material.dart'
    );
  });
  
  it('falls back to simple chunking on error', async () => {
    const invalidDart = 'this is not valid dart code { }';
    const chunks = await chunkCodeFile('invalid.dart', invalidDart);
    
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].metadata?.chunk_type).toBe('text');
  });
});
```

**Afternoon (3 hours): Integration**

```bash
# 1. Update ingestion pipeline
# Modify: apps/server/src/pipeline/ingest.ts
```

Add code file detection and code chunker integration:

```typescript
// In processDocument()

const isCodeFile = document.file_path?.match(/\.(dart|ts|tsx|js|jsx)$/);

if (isCodeFile && process.env.CODE_CHUNKING === 'true') {
  chunks = await chunkCodeFile(document.file_path!, text, {
    preserveImports: process.env.PRESERVE_IMPORTS === 'true',
  });
} else {
  chunks = splitIntoChunks(text, { maxSize: 800, overlap: 150 });
}
```

```bash
# 2. Test integration
# Upload a Dart file and verify chunks are code-aware

curl -X POST http://localhost:3333/api/ingest \
  -F "file=@sample.dart" \
  -F "collection_id=test" \
  -F "title=Sample Dart File"

# 3. Query chunks to verify
curl http://localhost:3333/api/documents/{doc_id}/chunks
```

**End of Day 2 Checklist:**
- [ ] Code chunker implemented
- [ ] Dart files chunk by function/class
- [ ] Imports preserved when enabled
- [ ] Fallback chunking works
- [ ] Integration with pipeline working
- [ ] Tests passing

---

### Day 3: File Relationships (4 hours)

**Morning (2 hours): Relationship Detection**

```bash
# 1. Create migration
touch packages/db/migrations/006_file_relationships.sql
```

```sql
CREATE TABLE file_relationships (
  id SERIAL PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  source_file TEXT NOT NULL,
  target_file TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  -- 'import', 'usage', 'test', 'sibling'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX file_relationships_collection_idx 
  ON file_relationships(collection_id);
CREATE INDEX file_relationships_source_idx 
  ON file_relationships(source_file);
CREATE INDEX file_relationships_target_idx 
  ON file_relationships(target_file);
CREATE INDEX file_relationships_type_idx 
  ON file_relationships(relationship_type);
```

```bash
# 2. Run migration
pnpm --filter @synthesis/db migrate
```

```bash
# 3. Create relationship service
touch apps/server/src/services/file-relationships.ts
```

```typescript
export async function trackFileRelationship(
  db: Pool,
  relationship: {
    collectionId: string;
    sourceFile: string;
    targetFile: string;
    type: 'import' | 'usage' | 'test' | 'sibling';
    metadata?: any;
  }
): Promise<void> {
  await db.query(
    `INSERT INTO file_relationships
     (collection_id, source_file, target_file, relationship_type, metadata)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING`,
    [
      relationship.collectionId,
      relationship.sourceFile,
      relationship.targetFile,
      relationship.type,
      JSON.stringify(relationship.metadata || {}),
    ]
  );
}

export async function getRelatedFiles(
  db: Pool,
  filePath: string,
  collectionId: string
): Promise<{
  imports: string[];
  imported_by: string[];
  tests: string[];
  siblings: string[];
}> {
  const { rows } = await db.query(
    `
    SELECT
      target_file,
      relationship_type
    FROM file_relationships
    WHERE source_file = $1
      AND collection_id = $2
    `,
    [filePath, collectionId]
  );
  
  const related = {
    imports: [],
    imported_by: [],
    tests: [],
    siblings: [],
  };
  
  for (const row of rows) {
    if (row.relationship_type === 'import') {
      related.imports.push(row.target_file);
    }
    // ... handle other types
  }
  
  return related;
}
```

**Afternoon (2 hours): Integration & API**

```bash
# 1. Update code chunker to track relationships
# Modify: apps/server/src/pipeline/code-chunker.ts
```

Add relationship tracking during chunking:

```typescript
// After parsing imports
for (const importUri of ast.imports) {
  await trackFileRelationship(db, {
    collectionId: document.collection_id,
    sourceFile: filePath,
    targetFile: resolveImportPath(importUri, filePath),
    type: 'import',
  });
}
```

```bash
# 2. Create API endpoint
# Modify: apps/server/src/routes/docs.ts
```

```typescript
app.get('/api/documents/:id/related-files', async (request, reply) => {
  const { id } = request.params;
  
  // Get document
  const doc = await getDocument(db, id);
  
  // Get related files
  const related = await getRelatedFiles(
    db,
    doc.file_path,
    doc.collection_id
  );
  
  return { related_files: related };
});
```

**End of Day 3 Checklist:**
- [ ] File relationships table created
- [ ] Relationship tracking service implemented
- [ ] Import relationships detected and stored
- [ ] API endpoint returns related files
- [ ] Tests passing

---

### Day 4: TypeScript Support (4 hours)

**Morning (2 hours): TS Parser**

```bash
# 1. Install TypeScript compiler
pnpm add -D typescript

# 2. Create TS analyzer
touch apps/server/src/pipeline/ts-analyzer.ts
```

```typescript
import ts from 'typescript';

export async function parseTypeScriptFile(
  content: string,
  filePath: string
): Promise<DartAST> {  // Reuse same AST interface
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );
  
  const ast: DartAST = {
    imports: [],
    functions: [],
    classes: [],
    constants: [],
  };
  
  // Visit AST nodes
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isImportDeclaration(node)) {
      // Extract import
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        ast.imports.push({
          uri: moduleSpecifier.text,
        });
      }
    }
    
    if (ts.isFunctionDeclaration(node) && node.name) {
      // Extract function
      const funcText = content.substring(node.pos, node.end);
      ast.functions.push({
        name: node.name.text,
        code: funcText.trim(),
        parameters: node.parameters.map(p => p.name.getText()),
        returnType: node.type?.getText() || 'any',
        lineRange: [
          sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1,
          sourceFile.getLineAndCharacterOfPosition(node.end).line + 1,
        ],
      });
    }
    
    if (ts.isClassDeclaration(node) && node.name) {
      // Extract class
      const classText = content.substring(node.pos, node.end);
      const methods = node.members
        .filter(ts.isMethodDeclaration)
        .map(method => ({
          name: method.name.getText(),
          code: content.substring(method.pos, method.end).trim(),
          parameters: method.parameters.map(p => p.name.getText()),
          returnType: method.type?.getText() || 'any',
          lineRange: [
            sourceFile.getLineAndCharacterOfPosition(method.pos).line + 1,
            sourceFile.getLineAndCharacterOfPosition(method.end).line + 1,
          ],
        }));
      
      ast.classes.push({
        name: node.name.text,
        code: classText.trim(),
        methods: methods,
        properties: [],
        interfaces: [],
        lineRange: [
          sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1,
          sourceFile.getLineAndCharacterOfPosition(node.end).line + 1,
        ],
      });
    }
  });
  
  return ast;
}
```

**Afternoon (2 hours): Integration & Testing**

```bash
# 1. Update code chunker to support TS
# Already done in chunkCodeFile() switch statement

# 2. Test with TypeScript files
touch apps/server/src/pipeline/__tests__/fixtures/sample.ts
```

Sample TS file:
```typescript
import { User } from './models/User';
import { ApiClient } from './api';

export class AuthService {
  private client: ApiClient;
  
  constructor(client: ApiClient) {
    this.client = client;
  }
  
  async login(email: string, password: string): Promise<User> {
    const response = await this.client.post('/login', {
      email,
      password,
    });
    
    return User.fromJSON(response.data);
  }
}
```

```bash
# 3. Test TS chunking
pnpm --filter @synthesis/server test ts-analyzer

# 4. Verify end-to-end
# Upload TS file and verify chunks
```

**End of Day 4 Checklist:**
- [ ] TypeScript parser implemented
- [ ] TS files chunk by function/class
- [ ] TS imports tracked
- [ ] Tests passing for TS
- [ ] Both Dart and TS working

---

### Day 5: Polish & Documentation (4 hours)

**Morning (2 hours): Large-Scale Testing**

```bash
# 1. Test on real Flutter project
# Clone a sample Flutter project
git clone https://github.com/flutter/samples.git test-samples

# 2. Ingest entire directory
curl -X POST http://localhost:3333/api/ingest/directory \
  -d '{
    "directory": "test-samples/lib",
    "collection_id": "flutter-samples"
  }'

# 3. Monitor processing
tail -f logs/server.log | grep "code-aware chunking"

# 4. Verify results
curl http://localhost:3333/api/collections/flutter-samples/stats

# Expected output:
{
  "total_documents": 150,
  "total_chunks": 800,
  "code_chunks": 600,
  "text_chunks": 200,
  "avg_chunk_size": 450
}
```

**Performance Benchmarking:**

```typescript
// Test 100 files
const files = glob.sync('test-samples/**/*.dart').slice(0, 100);

for (const file of files) {
  const content = await readFile(file, 'utf-8');
  const start = performance.now();
  const chunks = await chunkCodeFile(file, content);
  const time = performance.now() - start;
  
  console.log(`${file}: ${time.toFixed(0)}ms, ${chunks.length} chunks`);
}

// Average should be <500ms per file
```

**Afternoon (2 hours): Documentation & Cleanup**

```bash
# 1. Update README
# Document CODE_CHUNKING, PRESERVE_IMPORTS env vars

# 2. Add troubleshooting guide
# Common issues:
# - Dart analyzer not found
# - Large files timeout
# - Parse errors fallback

# 3. Update API docs
# Document file relationships endpoint

# 4. Run full test suite
pnpm test

# 5. Check coverage
pnpm test:coverage

# 6. Build all packages
pnpm build
```

**End of Day 5 Checklist:**
- [ ] Tested on 100+ real files
- [ ] Performance acceptable (<500ms avg)
- [ ] 20,000 files benchmark (if possible)
- [ ] Documentation complete
- [ ] All tests passing
- [ ] Ready for PR

---

## 🎯 Acceptance Criteria Validation

- [ ] Dart functions chunk as complete units (95%+)
- [ ] TypeScript functions chunk as complete units (90%+)
- [ ] Imports preserved with code chunks
- [ ] File relationships tracked and queryable
- [ ] Performance <500ms per file average
- [ ] Fallback works on parse errors
- [ ] Can handle 20,000 files
- [ ] Tests passing (>80% coverage)

---

## ✅ Sign-Off

**Demo:**

```bash
# 1. Show code-aware chunking
curl -X POST http://localhost:3333/api/ingest \
  -F "file=@auth_service.dart" \
  -F "collection_id=test"

# 2. Show chunks with imports preserved
curl http://localhost:3333/api/documents/{id}/chunks

# 3. Show file relationships
curl http://localhost:3333/api/documents/{id}/related-files

# 4. Show search finds exact functions
curl -X POST http://localhost:3333/api/search \
  -d '{"query":"login function","collection_id":"test"}'
```

**Tag release:**
```bash
git tag v1.3.0-phase-10
git push --tags
```

---

**Phase 10 Complete!** All phases 8-10 finished! 🎉
