# Phase 13: Code Intelligence & AST-Based Chunking

**Version:** 1.0  
**Date:** 2025-10-11  
**Status:** Planning  
**Prerequisites:** Phases 11 & 12 Complete

---

## 🎯 Executive Summary

Implement code-aware chunking using AST parsing to preserve code structure and context. This phase ensures 20,000+ code files are searchable with perfect context preservation - functions stay intact, imports are preserved, and related files are linked.

### Why This Phase?

**Current Limitation:** Text chunking breaks code structure
- Functions split mid-implementation
- Imports separated from code that uses them
- Class definitions fragmented
- No understanding of code relationships

**After Phase 13:** Code-aware intelligent chunking
- ✅ Functions chunk as complete units
- ✅ Imports preserved with code
- ✅ Classes stay intact
- ✅ File relationships tracked
- ✅ Can search by function/class name exactly

---

## 📊 Success Metrics

### Quantitative
- **Code search accuracy:** +50% improvement
- **Context preservation:** 95%+ of functions intact
- **Chunking time:** <2x overhead vs simple chunking
- **20,000 files:** Fully indexed with context

### Qualitative
- ✅ Search "login function" finds complete implementation
- ✅ Code examples include necessary imports
- ✅ Related files suggested automatically
- ✅ Can navigate codebase via RAG

---

## 🏗️ Architecture

### Code Chunking Flow

```
Dart/TypeScript File
  ↓
AST Parser
  - dart_analyzer for Dart
  - TypeScript compiler API for TS
  ↓
Extract Structures
  - Functions
  - Classes
  - Imports
  - Constants
  ↓
Create Contextual Chunks
  {
    type: 'function',
    name: 'loginUser',
    code: 'Future<User> loginUser(...) { ... }',
    imports: ['package:http/http.dart', ...],
    file_path: 'lib/services/auth_service.dart',
    class_context: 'AuthService',
    related_files: ['lib/models/user.dart', ...]
  }
  ↓
Embed & Store
  - Use code-specific embedding (Voyage)
  - Store rich metadata
  - Link related chunks
```

---

## 🔧 Core Features

### 1. Dart AST-Based Chunking

**Purpose:** Preserve Dart/Flutter code structure

**Implementation:**
```typescript
// Parse Dart file
const ast = await dartAnalyzer.parse(sourceCode);

// Extract functions
for (const node of ast.functions) {
  const chunk = {
    type: 'function',
    name: node.name,
    code: node.toSource(),
    parameters: node.parameters.map(p => p.name),
    return_type: node.returnType.name,
    doc_comment: node.documentationComment,
    imports: extractRequiredImports(ast, node),
    file_path: filePath,
  };
  
  await indexChunk(chunk);
}

// Extract classes
for (const node of ast.classes) {
  const chunk = {
    type: 'class',
    name: node.name,
    code: node.toSource(),
    methods: node.methods.map(m => m.name),
    properties: node.fields.map(f => f.name),
    extends: node.superclass?.name,
    implements: node.interfaces.map(i => i.name),
    imports: extractRequiredImports(ast, node),
    file_path: filePath,
  };
  
  await indexChunk(chunk);
}
```

**Chunk Types:**
- **Functions:** Complete function implementation
- **Classes:** Full class definition or per-method chunking
- **Imports:** Grouped with dependent code
- **Constants:** Grouped by usage

### 2. Import Tracking

**Purpose:** Preserve code dependencies

**Example:**
```dart
// Source file: lib/services/auth_service.dart
import 'package:http/http.dart' as http;
import '../models/user.dart';

class AuthService {
  Future<User> login(String email, String password) {
    // implementation
  }
}
```

**Stored chunk:**
```json
{
  "type": "function",
  "name": "login",
  "code": "Future<User> login(...) { ... }",
  "imports": [
    "package:http/http.dart",
    "../models/user.dart"
  ],
  "dependencies": {
    "User": "lib/models/user.dart",
    "http": "package:http/http.dart"
  }
}
```

**Search result includes imports:**
```typescript
// When user searches for "login function"
{
  text: "Future<User> login(String email, String password) { ... }",
  imports: [
    "import 'package:http/http.dart' as http;",
    "import '../models/user.dart';"
  ],
  file_path: "lib/services/auth_service.dart"
}
```

### 3. File Relationship Mapping

**Purpose:** Link related code files

**Relationship Types:**
- **Imports:** File A imports File B
- **Usage:** File A uses classes/functions from File B
- **Test:** File A_test.dart tests File A.dart
- **Siblings:** Files in same directory/feature

**Database Schema:**
```sql
CREATE TABLE file_relationships (
  id SERIAL PRIMARY KEY,
  source_file TEXT NOT NULL,
  target_file TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  -- 'import', 'usage', 'test', 'sibling'
  metadata JSONB,
  collection_id UUID REFERENCES collections(id)
);

CREATE INDEX file_relationships_source_idx 
  ON file_relationships(source_file);
```

**API:**
```typescript
// Get related files
const related = await getRelatedFiles('lib/services/auth_service.dart');

// Returns:
{
  imports: ['lib/models/user.dart', 'package:http/http.dart'],
  imported_by: ['lib/screens/login_screen.dart'],
  tests: ['test/services/auth_service_test.dart'],
  siblings: ['lib/services/user_service.dart']
}
```

### 4. Metadata Enhancement

**Code chunk metadata:**
```typescript
interface CodeChunkMetadata extends ChunkMetadata {
  // Function metadata
  function_name?: string;
  parameters?: string[];
  return_type?: string;
  
  // Class metadata
  class_name?: string;
  methods?: string[];
  properties?: string[];
  extends?: string;
  implements?: string[];
  
  // File context
  file_path: string;
  line_range: [number, number];
  imports: string[];
  dependencies: Record<string, string>;
  
  // Categorization
  is_widget?: boolean;  // Flutter-specific
  is_stateful?: boolean;
  is_service?: boolean;
  is_model?: boolean;
}
```

---

## 🎯 Deliverables

### Code Artifacts
- [ ] `apps/server/src/pipeline/code-chunker.ts` - AST-based chunking
- [ ] `apps/server/src/pipeline/dart-analyzer.ts` - Dart parsing
- [ ] `apps/server/src/pipeline/ts-analyzer.ts` - TypeScript parsing
- [ ] `apps/server/src/services/file-relationships.ts` - Relationship tracking
- [ ] `packages/db/migrations/006_code_intelligence.sql` - File relationships table

### Configuration
- [ ] `CODE_CHUNKING=true` - Enable code-aware chunking
- [ ] `PRESERVE_IMPORTS=true` - Include imports in chunks
- [ ] `TRACK_RELATIONSHIPS=true` - Build file dependency graph

---

## ⏱️ Timeline

**Total Duration:** 4-5 days

**Day 1-2:** Dart AST Parsing (10 hours)
- Integrate dart_analyzer
- Function extraction
- Class extraction
- Import tracking
- Testing

**Day 3:** Code Chunker (6 hours)
- Chunking strategy
- Metadata enhancement
- Integration with pipeline
- Testing

**Day 4:** File Relationships (4 hours)
- Relationship detection
- Graph building
- API endpoints
- Testing

**Day 5:** TypeScript Support (4 hours)
- TS AST parsing
- Function/class extraction
- Testing
- Documentation

---

## 🚨 Risks & Mitigations

### Risk 1: AST Parsing Too Slow
**Mitigation:**
- Cache parsed ASTs
- Parse in background
- Only re-parse on file changes
- Target: <500ms per file

### Risk 2: Complex Code Structures
**Mitigation:**
- Fall back to simple chunking if AST fails
- Handle nested functions gracefully
- Test on real Flutter projects

### Risk 3: Dart Analyzer Dependency
**Mitigation:**
- Use official Dart SDK tools
- Version lock analyzer
- Provide TypeScript alternative

---

## 📚 Related Phases

**Prerequisites:**
- Phase 11: Hybrid search finds code efficiently
- Phase 12: Re-ranking improves code result quality

**Enables:**
- Better code search for 20k+ file projects
- Context-aware code suggestions
- Automated code documentation

---

## ✅ Acceptance Criteria

### Must Have
- [ ] Dart functions chunk as complete units
- [ ] Imports preserved with code snippets
- [ ] Can search by function name and find it
- [ ] File relationships tracked in database
- [ ] TypeScript chunking works (basic)

### Should Have
- [ ] Class methods can chunk separately
- [ ] Related files suggested in search results
- [ ] 20,000 files indexed successfully
- [ ] Chunking <2x slower than simple splitting

### Nice to Have
- [ ] Widget type detection
- [ ] Test file linking
- [ ] Code complexity metrics

---

## 💰 Cost Estimate

**No additional API costs** - all processing is local

**Compute costs:**
- AST parsing: CPU-bound, ~500ms per file
- 20,000 files × 500ms = ~2.8 hours one-time
- Storage: ~10% increase (metadata)

**Total: FREE** (just CPU time)

---

## 🔍 Example Use Case

**Your 20,000 File Flutter App:**

**Before Phase 13:**
```
Query: "login authentication"
→ Returns text chunks that might split functions
→ No imports, no context
→ Hard to use the code
```

**After Phase 13:**
```
Query: "login authentication"
→ Returns complete login function
→ Includes all necessary imports
→ Shows related files (User model, LoginScreen)
→ Can copy-paste and it works!
```

---

**Next:** See `01_CODE_CHUNKING_ARCHITECTURE.md` for implementation details
