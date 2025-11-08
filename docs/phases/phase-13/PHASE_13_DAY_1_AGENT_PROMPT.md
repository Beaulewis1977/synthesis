# Phase 13 Day 1 - Agent Prompt

**Task:** Dart AST Parser Implementation

**Status:** Phase 13 starting. Focus on building the core Dart code parser.

---

## 📚 Documentation to Read

**Read these documents IN ORDER:**

1. **docs/phases/phase-13/02_DART_AST_PARSING.md** (PRIMARY - parser implementation)
2. **docs/phases/phase-13/04_BUILD_PLAN.md** (Day 1 section)
3. **docs/phases/phase-13/00_PHASE_13_OVERVIEW.md** (overall context)
4. **docs/phases/phase-13/01_CODE_CHUNKING_ARCHITECTURE.md** (architecture overview)

**Work under:** Issue #62 (Phase 13 Epic)

---

## 🚨 CRITICAL: What to Use and What to Ignore

**ONLY use these sources (in order of authority):**
1. ✅ **This daily prompt** (PRIMARY - your single source of truth)
2. ✅ **Documentation files listed above** (Phase 13 docs)
3. ✅ **Issue #62 BODY ONLY** (for context - updated and correct)
4. ✅ **Existing codebase** (for integration patterns)

**NEVER reference or trust:**
- ❌ **Issue #62 comments** (outdated bot responses, wrong paths, Phase 10 references)
- ❌ **Issue #65** (Frontend issue - still references Phase 10, not updated)
- ❌ **Any "Phase 10" references** (old numbering before renumbering)
- ❌ **Documentation paths with `phase-10`** (don't exist - correct path is `phase-13`)
- ❌ **Bot-generated plans** in issue comments (obsolete)

**If you encounter conflicting information:**
- This prompt overrides everything else
- Documentation in `docs/phases/phase-13/` is authoritative
- Ignore all Phase 10 references (phase was renumbered)
- When in doubt, follow this prompt exactly

**Why this matters:**
Phase 13 was originally called "Phase 10" but was renumbered. GitHub issues have outdated comments and references that will lead you to wrong paths and confusion. Trust only this prompt and the Phase 13 documentation.

---

## 🎯 Main Objectives

### 1. Create Dart AST Parser
- **File:** `apps/server/src/pipeline/dart-analyzer.ts`
- **Implementation:** Regex-based AST extraction (~300 lines)
- **Features:**
  - Extract imports (with prefixes, show/hide clauses)
  - Extract top-level functions
  - Extract classes (with methods and properties)
  - Extract constants
  - Handle doc comments
  - Brace matching for nested structures

### 2. Create Test Fixtures
- **Directory:** `apps/server/src/pipeline/__tests__/fixtures/`
- **Files:**
  - `sample.dart` - Representative Dart code for testing
  - Include: imports, functions, classes, async/await, comments
  
### 3. Write Parser Tests
- **File:** `apps/server/src/pipeline/__tests__/dart-analyzer.test.ts`
- **Coverage:**
  - Import extraction (basic, with prefix, with show/hide)
  - Function extraction (sync and async)
  - Class extraction (methods, properties, inheritance)
  - Edge cases (nested braces, strings with braces, comments)
  - Performance (<300ms for typical files)

### 4. Helper Functions
- Implement `findMatchingBrace()` - handles strings, comments
- Implement `parseParameters()` - extracts function params
- Implement `extractDocComment()` - preserves documentation
- Implement `extractClassName()`, `extractReturnType()`, etc.

---

## ✅ Requirements Checklist

### Parser Implementation
- [ ] Create `apps/server/src/pipeline/dart-analyzer.ts`
- [ ] Define `DartAST` interface with imports, functions, classes, constants
- [ ] Implement `parseDartFile(content, filePath)` main function
- [ ] Implement `extractImports()` - handle all import variations
- [ ] Implement `extractFunctions()` - async/sync, return types, params
- [ ] Implement `extractClasses()` - inheritance, mixins, interfaces
- [ ] Implement `extractMethods()` - static/instance, params, return types
- [ ] Implement `extractProperties()` - static/final, types
- [ ] Implement `extractConstants()` - const/final declarations
- [ ] Implement `findMatchingBrace()` - robust brace matching
- [ ] Implement `parseParameters()` - handle named/positional params
- [ ] Implement `extractDocComment()` - preserve /// comments
- [ ] Handle edge cases: nested classes, generic types, comments in strings

### Test Fixtures
- [ ] Create `apps/server/src/pipeline/__tests__/fixtures/sample.dart`
- [ ] Include: 2+ imports (package + relative)
- [ ] Include: 1+ top-level function (async)
- [ ] Include: 1+ class with multiple methods
- [ ] Include: Constructor, static methods, properties
- [ ] Include: Doc comments (///)
- [ ] Include: Edge cases (nested braces, string literals)

### Unit Tests
- [ ] Create `apps/server/src/pipeline/__tests__/dart-analyzer.test.ts`
- [ ] Test: Extract imports correctly (3+ test cases)
- [ ] Test: Extract functions with async/await
- [ ] Test: Extract classes with inheritance
- [ ] Test: Extract methods (static and instance)
- [ ] Test: Extract properties (final and static)
- [ ] Test: Handle doc comments preservation
- [ ] Test: Brace matching accuracy (nested, in strings, in comments)
- [ ] Test: Performance <300ms for 500-line file
- [ ] Test: Handle malformed code gracefully

### Quality Checks
- [ ] Run: `pnpm --filter @synthesis/server test dart-analyzer`
- [ ] Run: `pnpm --filter @synthesis/server typecheck`
- [ ] Run: `pnpm lint`
- [ ] Verify: All tests passing
- [ ] Verify: No TypeScript errors
- [ ] Verify: Code follows existing patterns

---

## 🔧 Commands to Run

### 1. Create Files
```bash
# Create parser
touch apps/server/src/pipeline/dart-analyzer.ts

# Create test directory
mkdir -p apps/server/src/pipeline/__tests__/fixtures

# Create fixtures
touch apps/server/src/pipeline/__tests__/fixtures/sample.dart

# Create tests
touch apps/server/src/pipeline/__tests__/dart-analyzer.test.ts
```

### 2. Development Loop
```bash
# Run tests in watch mode
pnpm --filter @synthesis/server test:watch dart-analyzer

# Type check
pnpm --filter @synthesis/server typecheck

# Lint
pnpm lint
```

### 3. Test Specific Parser Functions
```bash
# Test imports
pnpm --filter @synthesis/server test dart-analyzer -t "extracts imports"

# Test functions
pnpm --filter @synthesis/server test dart-analyzer -t "extracts functions"

# Test classes
pnpm --filter @synthesis/server test dart-analyzer -t "extracts classes"
```

### 4. Performance Testing
```bash
# Create large test file
cat sample.dart sample.dart sample.dart > fixtures/large.dart

# Time the parser
time pnpm tsx -e "
import { parseDartFile } from './apps/server/src/pipeline/dart-analyzer';
import { readFileSync } from 'fs';
const content = readFileSync('apps/server/src/pipeline/__tests__/fixtures/large.dart', 'utf-8');
console.time('parse');
const ast = await parseDartFile(content);
console.timeEnd('parse');
console.log('Functions:', ast.functions.length);
console.log('Classes:', ast.classes.length);
"
```

---

## 📊 Sample Test Fixture

### `fixtures/sample.dart`

```dart
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../models/user.dart';
import 'utils.dart' show formatDate, parseDate;

/// Authentication service for managing user sessions
class AuthService extends BaseService {
  final http.Client _client;
  static const String API_BASE = 'https://api.example.com';
  
  AuthService(this._client);
  
  /// Authenticates a user with email and password
  Future<User> login(String email, String password) async {
    final response = await _client.post(
      Uri.parse('$API_BASE/login'),
      body: {'email': email, 'password': password},
    );
    
    if (response.statusCode == 200) {
      return User.fromJson(response.body);
    } else {
      throw Exception('Login failed');
    }
  }
  
  /// Logs out the current user
  Future<void> logout() async {
    await _client.post(Uri.parse('$API_BASE/logout'));
  }
  
  static String formatToken(String token) {
    return token.trim().toUpperCase();
  }
}

/// Initializes the application
Future<void> initializeApp() async {
  // Setup code here
  print('App initialized');
}

const int MAX_RETRIES = 3;
final String apiKey = 'secret_key';
```

---

## 📝 Deliverables

### 1. Dart AST Parser
**File:** `apps/server/src/pipeline/dart-analyzer.ts`

**Must include:**
```typescript
export interface DartAST {
  imports: Array<{ uri: string; prefix?: string; show?: string[]; hide?: string[] }>;
  functions: Array<{ name: string; code: string; parameters: string[]; returnType: string; docComment?: string; lineRange: [number, number]; isAsync: boolean }>;
  classes: Array<{ name: string; code: string; methods: Array<...>; properties: Array<...>; superclass?: string; interfaces: string[]; mixins: string[]; lineRange: [number, number]; isAbstract: boolean }>;
  constants: Array<{ name: string; code: string; type: string; value?: string; lineRange: [number, number] }>;
}

export async function parseDartFile(content: string, filePath?: string): Promise<DartAST>;
```

### 2. Test Fixtures
**Files:**
- `fixtures/sample.dart` (100-200 lines)
- Must cover all AST node types
- Include edge cases

### 3. Unit Tests
**File:** `dart-analyzer.test.ts`

**Must have:**
- 10+ test cases covering all features
- Edge case tests
- Performance test
- 80%+ code coverage

### 4. Day 1 Summary
**Post to Issue #62:**

```markdown
# Phase 13 Day 1 - Dart AST Parser Complete

## Implementation Summary
- ✅ Created `dart-analyzer.ts` (~300 lines)
- ✅ All parser functions implemented
- ✅ Test fixtures created
- ✅ Unit tests passing (XX/XX tests)

## Parser Capabilities
- Imports: ✅ Basic, with prefix, with show/hide
- Functions: ✅ Sync, async, parameters, return types
- Classes: ✅ Methods, properties, inheritance, mixins
- Constants: ✅ const/final extraction
- Comments: ✅ Doc comment preservation

## Performance
- Small files (<200 lines): XXms
- Medium files (200-500 lines): XXms
- Large files (500-1000 lines): XXms
- Target: <300ms ✅/❌

## Test Results
- Unit tests: XX/XX passing ✅
- Coverage: XX% ✅
- Edge cases: Handled ✅

## Edge Cases Handled
- ✅ Nested braces (classes in classes)
- ✅ Braces in strings ("class { }")
- ✅ Braces in comments (// { })
- ✅ Generic types (List<Map<String, dynamic>>)
- ✅ Named parameters
- ✅ Async/await

## Files Created
- `apps/server/src/pipeline/dart-analyzer.ts`
- `apps/server/src/pipeline/__tests__/fixtures/sample.dart`
- `apps/server/src/pipeline/__tests__/dart-analyzer.test.ts`

## Next Steps
Day 2: Code Chunker Service (integrate this parser)
```

---

## 🚨 Critical Validation Steps

### Step 1: Verify Import Extraction
```typescript
const code = `
import 'package:flutter/material.dart';
import '../models/user.dart' as user_model;
import 'utils.dart' show formatDate, parseDate;
`;

const ast = await parseDartFile(code);
console.log(ast.imports);
// Expected:
// [
//   { uri: 'package:flutter/material.dart' },
//   { uri: '../models/user.dart', prefix: 'user_model' },
//   { uri: 'utils.dart', show: ['formatDate', 'parseDate'] }
// ]
```

### Step 2: Verify Function Extraction
```typescript
const code = `
Future<User> login(String email, String password) async {
  final response = await api.post('/login');
  return User.fromJson(response);
}
`;

const ast = await parseDartFile(code);
console.log(ast.functions[0]);
// Expected:
// {
//   name: 'login',
//   returnType: 'Future<User>',
//   parameters: ['String email', 'String password'],
//   isAsync: true,
//   code: '...'
// }
```

### Step 3: Verify Class Extraction
```typescript
const code = `
class AuthService extends BaseService with LogMixin implements AuthProvider {
  final ApiClient _client;
  
  Future<void> login() async {
    // implementation
  }
  
  static String formatToken(String token) {
    return token.trim();
  }
}
`;

const ast = await parseDartFile(code);
console.log(ast.classes[0]);
// Expected:
// {
//   name: 'AuthService',
//   superclass: 'BaseService',
//   mixins: ['LogMixin'],
//   interfaces: ['AuthProvider'],
//   methods: [
//     { name: 'login', isStatic: false },
//     { name: 'formatToken', isStatic: true }
//   ],
//   properties: [{ name: '_client', type: 'ApiClient', isFinal: true }]
// }
```

### Step 4: Verify Brace Matching
```typescript
const code = `
class Test {
  String nested() {
    if (true) {
      return "{ not a brace }";
    }
    // { comment brace }
    return "";
  }
}
`;

const ast = await parseDartFile(code);
// Should extract complete class without breaking on braces in strings/comments
expect(ast.classes[0].code).toContain('class Test {');
expect(ast.classes[0].code).toContain('return "";\n}');
```

---

## 🎯 Integration Test Examples

### Test 1: Complete Dart File Parsing
```typescript
describe('Dart AST Parser', () => {
  it('extracts all elements from complete Dart file', async () => {
    const content = await readFile('fixtures/sample.dart', 'utf-8');
    const ast = await parseDartFile(content);
    
    // Verify imports
    expect(ast.imports).toHaveLength(4);
    expect(ast.imports[0].uri).toBe('package:flutter/material.dart');
    expect(ast.imports[1].prefix).toBe('http');
    expect(ast.imports[3].show).toEqual(['formatDate', 'parseDate']);
    
    // Verify classes
    expect(ast.classes).toHaveLength(1);
    expect(ast.classes[0].name).toBe('AuthService');
    expect(ast.classes[0].superclass).toBe('BaseService');
    expect(ast.classes[0].methods).toHaveLength(3);
    expect(ast.classes[0].properties).toHaveLength(2);
    
    // Verify functions
    expect(ast.functions).toHaveLength(1);
    expect(ast.functions[0].name).toBe('initializeApp');
    expect(ast.functions[0].isAsync).toBe(true);
    
    // Verify constants
    expect(ast.constants).toHaveLength(2);
    expect(ast.constants[0].name).toBe('MAX_RETRIES');
  });
});
```

### Test 2: Edge Cases
```typescript
it('handles braces in strings correctly', async () => {
  const code = `
String test() {
  return "{ } not braces";
}
`;
  const ast = await parseDartFile(code);
  expect(ast.functions[0].code).toContain('}');
  expect(ast.functions[0].code).not.toContain('}}'); // Shouldn't break
});

it('handles braces in comments correctly', async () => {
  const code = `
void test() {
  // { comment with braces }
  /* { multi-line comment } */
  print('test');
}
`;
  const ast = await parseDartFile(code);
  expect(ast.functions[0].code).toContain("print('test');");
});
```

### Test 3: Performance
```typescript
it('parses typical file in <300ms', async () => {
  const content = await readFile('fixtures/sample.dart', 'utf-8');
  
  const start = performance.now();
  const ast = await parseDartFile(content);
  const duration = performance.now() - start;
  
  expect(duration).toBeLessThan(300);
  expect(ast.functions.length).toBeGreaterThan(0);
});
```

---

## ⚠️ Important Notes

1. **Use Regex, Not Dart SDK**
   - Don't install Dart SDK (adds complexity)
   - Regex-based parsing is good enough (95%+ accuracy)
   - Fallback to simple chunking on errors

2. **Brace Matching is Critical**
   - Must handle nested braces correctly
   - Must ignore braces in strings
   - Must ignore braces in comments
   - Test with complex nesting

3. **Performance Matters**
   - Target: <300ms for 500-line file
   - Cache nothing (single-pass parsing)
   - Keep regex simple and efficient

4. **Error Handling**
   - Don't crash on malformed code
   - Log warnings, return partial AST
   - Day 2 will add fallback chunking

---

## 🎉 Success Criteria

**Day 1 is complete when:**

- ✅ `dart-analyzer.ts` created (~300 lines)
- ✅ All parser functions implemented
- ✅ Extracts imports (95%+ accuracy)
- ✅ Extracts functions (95%+ accuracy)
- ✅ Extracts classes and methods (95%+ accuracy)
- ✅ Brace matching works correctly
- ✅ Handles edge cases (strings, comments, nesting)
- ✅ Performance <300ms for typical files
- ✅ Test fixtures created
- ✅ 10+ unit tests passing
- ✅ 80%+ code coverage
- ✅ No TypeScript errors
- ✅ No linting errors

**Timeline:** 6 hours

---

## 📞 Handoff

**When complete, post to Issue #62:**

```markdown
✅ Phase 13 Day 1 Complete - Dart AST Parser Ready

Dart parser implemented with full test coverage. Ready for Day 2 integration.

See summary comment above for:
- Parser capabilities
- Performance metrics
- Edge cases handled
- Test results

Files created:
- dart-analyzer.ts
- sample.dart fixture
- dart-analyzer.test.ts

Next: Day 2 - Code Chunker Service
```

---

**Remember:** Focus on regex-based parsing. Don't try to install Dart SDK. Good enough is better than perfect here. The fallback chunking (Day 2) will handle edge cases.
