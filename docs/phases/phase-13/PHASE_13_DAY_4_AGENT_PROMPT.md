# Phase 13 Day 4 - Agent Prompt

## OVERRIDE (read first)
- Primary: `docs/phases/phase-13/PHASE_13_DAY_4_AUDIT_FIXES.md`
- If anything below conflicts with the override, follow the override.
- Do not create `apps/server/src/pipeline/ingest.ts`; use `apps/server/src/pipeline/orchestrator.ts` for integration.
- Do not call `POST /api/ingest/directory` or `GET /api/documents/:id/chunks` unless implemented; use the commands in the override doc.

**Task:** TypeScript Parser Implementation

**Status:** Days 1-3 complete (Dart parser, chunker, relationships ready). Now adding TypeScript support.

---

## 📚 Documentation to Read

**Read these documents IN ORDER:**

1. **docs/phases/phase-13/04_BUILD_PLAN.md** (Day 4 section - PRIMARY)
2. **docs/phases/phase-13/01_CODE_CHUNKING_ARCHITECTURE.md** (TypeScript section)
3. **apps/server/src/pipeline/dart-analyzer.ts** (Day 1 - use as reference)
4. **apps/server/src/pipeline/code-chunker.ts** (Day 2 - update this)

**Work under:** Issue #62 (Phase 13 Epic)

---

## 🚨 CRITICAL: What to Use and What to Ignore

**ONLY use these sources (in order of authority):**
1. ✅ **This daily prompt** (PRIMARY - your single source of truth)
2. ✅ **Documentation files listed above** (Phase 13 docs)
3. ✅ **Day 1-3 implementations** (Parser, chunker, relationships you built)
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

### 1. Create TypeScript AST Parser
- **File:** `apps/server/src/pipeline/ts-analyzer.ts`
- **Implementation:** Use TypeScript Compiler API (~200 lines)
- **Features:**
  - Extract imports (ES6 import statements)
  - Extract functions (regular and arrow functions)
  - Extract classes (methods, properties, interfaces)
  - Extract constants/exports
  - Handle async/await, decorators, generics

### 2. Update Code Chunker
- **File:** `apps/server/src/pipeline/code-chunker.ts` (MODIFY)
- **Changes:**
  - Implement `chunkTypeScriptCode()` using new parser
  - Route .ts and .tsx files correctly
  - Test with actual TypeScript files

### 3. Create Test Fixtures
- **Files:**
  - `sample.ts` - Representative TypeScript code
  - `sample-react.tsx` - React/JSX code
  - Include: imports, functions, classes, interfaces, decorators

### 4. Write Parser Tests
- **File:** `apps/server/src/pipeline/__tests__/ts-analyzer.test.ts`
- **Coverage:**
  - Import extraction (named, default, namespace)
  - Function extraction (regular, arrow, async)
  - Class extraction (methods, properties, decorators)
  - Interface/type extraction
  - React component handling

---

## ✅ Requirements Checklist

### TypeScript Parser Implementation
- [ ] Install dependency: `typescript` package (if not already installed)
- [ ] Create `apps/server/src/pipeline/ts-analyzer.ts`
- [ ] Reuse `DartAST` interface structure (compatible format)
- [ ] Implement `parseTypeScriptFile(content, filePath)` main function
- [ ] Use `ts.createSourceFile()` to parse
- [ ] Extract imports: named, default, namespace imports
- [ ] Extract functions: regular functions, arrow functions, async
- [ ] Extract classes: methods, properties, decorators
- [ ] Extract interfaces and type aliases
- [ ] Extract constants and exports
- [ ] Handle JSX/TSX syntax
- [ ] Include line ranges and metadata
- [ ] Handle parse errors gracefully

### Code Chunker Updates
- [ ] Modify `apps/server/src/pipeline/code-chunker.ts`
- [ ] Import TypeScript parser
- [ ] Implement `chunkTypeScriptCode()` function
- [ ] Handle both .ts and .tsx files
- [ ] Use same chunking strategy as Dart (functions, classes)
- [ ] Preserve imports when enabled
- [ ] Add TypeScript-specific metadata (decorators, interfaces)
- [ ] Remove placeholder implementation

### Test Fixtures
- [ ] Create `apps/server/src/pipeline/__tests__/fixtures/sample.ts`
- [ ] Include: ES6 imports (named, default)
- [ ] Include: Regular functions and arrow functions
- [ ] Include: Class with methods and properties
- [ ] Include: Interface definitions
- [ ] Include: Async/await functions
- [ ] Include: Decorators (if applicable)
- [ ] Create `apps/server/src/pipeline/__tests__/fixtures/sample-react.tsx`
- [ ] Include: React component (functional)
- [ ] Include: JSX syntax
- [ ] Include: Props interface

### Unit Tests
- [ ] Create `apps/server/src/pipeline/__tests__/ts-analyzer.test.ts`
- [ ] Test: Extract imports (named, default, namespace)
- [ ] Test: Extract functions (regular and arrow)
- [ ] Test: Extract async functions
- [ ] Test: Extract classes with methods
- [ ] Test: Extract interfaces
- [ ] Test: Handle decorators
- [ ] Test: Handle JSX/TSX syntax
- [ ] Test: Performance <300ms for typical files
- [ ] Test: Handle malformed code gracefully

### Integration Tests
- [ ] Add to `apps/server/src/pipeline/__tests__/integration-code.test.ts`
- [ ] Test: Ingest TypeScript file end-to-end
- [ ] Test: Chunks have correct metadata
- [ ] Test: Imports preserved
- [ ] Test: Function names extracted

### Quality Checks
- [ ] Run: `pnpm --filter @synthesis/server test ts-analyzer`
- [ ] Run: `pnpm --filter @synthesis/server test code-chunker`
- [ ] Run: `pnpm --filter @synthesis/server test integration-code`
- [ ] Run: `pnpm --filter @synthesis/server typecheck`
- [ ] Run: `pnpm lint`
- [ ] Verify: All tests passing
- [ ] Verify: TypeScript and Dart both work

---

## 🔧 Commands to Run

### 1. Install TypeScript Package
```bash
# Check if TypeScript is installed
pnpm list typescript -r

# Install if needed (usually already installed in monorepo)
pnpm add -w -D typescript
```

### 2. Create Files
```bash
# Create parser
touch apps/server/src/pipeline/ts-analyzer.ts

# Create fixtures
touch apps/server/src/pipeline/__tests__/fixtures/sample.ts
touch apps/server/src/pipeline/__tests__/fixtures/sample-react.tsx

# Create tests
touch apps/server/src/pipeline/__tests__/ts-analyzer.test.ts
```

### 3. Development Loop
```bash
# Run tests in watch mode
pnpm --filter @synthesis/server test:watch ts-analyzer

# Test chunker with TypeScript
pnpm --filter @synthesis/server test:watch code-chunker
```

### 4. Test End-to-End
```bash
# Start server
CODE_CHUNKING=true PRESERVE_IMPORTS=true pnpm --filter @synthesis/server dev

# Ingest TypeScript file
curl -X POST http://localhost:3333/api/ingest \
  -F "file=@apps/server/src/pipeline/__tests__/fixtures/sample.ts" \
  -F "collection_id=test-ts" \
  -F "title=Sample TypeScript"

# Get chunks
DOC_ID=$(curl -s http://localhost:3333/api/collections/test-ts/documents | jq -r '.documents[0].id')
curl -s "http://localhost:3333/api/documents/$DOC_ID/chunks" | jq '.chunks[] | {
  type: .metadata.chunk_type,
  name: (.metadata.function_name // .metadata.class_name),
  language: .metadata.language
}'
```

### 5. Compare Dart vs TypeScript
```bash
# Ingest both
curl -X POST http://localhost:3333/api/ingest \
  -F "file=@fixtures/sample.dart" \
  -F "collection_id=comparison"

curl -X POST http://localhost:3333/api/ingest \
  -F "file=@fixtures/sample.ts" \
  -F "collection_id=comparison"

# Query to see chunks side by side
psql $DATABASE_URL -c "
  SELECT 
    d.title,
    c.metadata->>'language' as lang,
    c.metadata->>'chunk_type' as type,
    c.metadata->>'function_name' as func,
    c.metadata->>'class_name' as class
  FROM chunks c
  JOIN documents d ON c.document_id = d.id
  WHERE d.collection_id = (SELECT id FROM collections WHERE name = 'comparison')
  ORDER BY d.title, c.chunk_index;
"
```

---

## 📊 TypeScript Parser Implementation

### Main Structure

```typescript
import ts from 'typescript';
import type { DartAST } from './dart-analyzer.js';

/**
 * Parse TypeScript file using TS Compiler API
 * Returns DartAST format for compatibility
 */
export async function parseTypeScriptFile(
  content: string,
  filePath: string
): Promise<DartAST> {
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
      extractImport(node, ast, sourceFile);
    } else if (ts.isFunctionDeclaration(node)) {
      extractFunction(node, ast, content, sourceFile);
    } else if (ts.isClassDeclaration(node)) {
      extractClass(node, ast, content, sourceFile);
    } else if (ts.isVariableStatement(node)) {
      extractVariable(node, ast, content, sourceFile);
    }
  });

  return ast;
}
```

### Extract Imports

```typescript
function extractImport(
  node: ts.ImportDeclaration,
  ast: DartAST,
  sourceFile: ts.SourceFile
): void {
  const moduleSpecifier = node.moduleSpecifier;
  
  if (ts.isStringLiteral(moduleSpecifier)) {
    const uri = moduleSpecifier.text;
    
    // Handle named imports: import { a, b } from 'module'
    // Handle default imports: import defaultExport from 'module'
    // Handle namespace imports: import * as name from 'module'
    
    ast.imports.push({ uri });
  }
}
```

### Extract Functions

```typescript
function extractFunction(
  node: ts.FunctionDeclaration,
  ast: DartAST,
  content: string,
  sourceFile: ts.SourceFile
): void {
  if (!node.name) return;
  
  const funcText = content.substring(node.pos, node.end).trim();
  const startLine = sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1;
  const endLine = sourceFile.getLineAndCharacterOfPosition(node.end).line + 1;
  
  ast.functions.push({
    name: node.name.text,
    code: funcText,
    parameters: node.parameters.map(p => p.name.getText()),
    returnType: node.type?.getText() || 'any',
    lineRange: [startLine, endLine],
    isAsync: Boolean(node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)),
  });
}
```

### Extract Classes

```typescript
function extractClass(
  node: ts.ClassDeclaration,
  ast: DartAST,
  content: string,
  sourceFile: ts.SourceFile
): void {
  if (!node.name) return;
  
  const classText = content.substring(node.pos, node.end).trim();
  const startLine = sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1;
  const endLine = sourceFile.getLineAndCharacterOfPosition(node.end).line + 1;
  
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
      isStatic: Boolean(method.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword)),
    }));
  
  const properties = node.members
    .filter(ts.isPropertyDeclaration)
    .map(prop => ({
      name: prop.name.getText(),
      type: prop.type?.getText() || 'any',
      isStatic: Boolean(prop.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword)),
      isFinal: Boolean(prop.modifiers?.some(m => m.kind === ts.SyntaxKind.ReadonlyKeyword)),
    }));
  
  ast.classes.push({
    name: node.name.text,
    code: classText,
    methods,
    properties,
    superclass: node.heritageClauses
      ?.find(c => c.token === ts.SyntaxKind.ExtendsKeyword)
      ?.types[0]?.expression.getText(),
    interfaces: node.heritageClauses
      ?.find(c => c.token === ts.SyntaxKind.ImplementsKeyword)
      ?.types.map(t => t.expression.getText()) || [],
    mixins: [], // TypeScript doesn't have mixins
    lineRange: [startLine, endLine],
    isAbstract: Boolean(node.modifiers?.some(m => m.kind === ts.SyntaxKind.AbstractKeyword)),
  });
}
```

---

## 📝 Test Fixtures

### `sample.ts`

```typescript
import { User } from './models/User';
import { ApiClient } from './api';
import * as utils from './utils';

/**
 * Authentication service for user management
 */
export class AuthService {
  private client: ApiClient;
  readonly baseUrl: string = 'https://api.example.com';

  constructor(client: ApiClient) {
    this.client = client;
  }

  /**
   * Authenticates a user with email and password
   */
  async login(email: string, password: string): Promise<User> {
    const response = await this.client.post('/login', {
      email,
      password,
    });

    return User.fromJSON(response.data);
  }

  async logout(): Promise<void> {
    await this.client.post('/logout');
  }

  static formatToken(token: string): string {
    return token.trim().toUpperCase();
  }
}

export async function initializeApp(): Promise<void> {
  console.log('App initialized');
}

export const MAX_RETRIES = 3;
export const API_VERSION = 'v1';
```

### `sample-react.tsx`

```tsx
import React, { useState, useEffect } from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ label, onClick, disabled = false }) => {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
};

export function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);

  return <div>{user?.name}</div>;
}
```

---

## 📝 Deliverables

### 1. TypeScript Parser
**File:** `apps/server/src/pipeline/ts-analyzer.ts`

**Must export:**
- `parseTypeScriptFile()` function
- Returns `DartAST` format for compatibility

### 2. Updated Code Chunker
**File:** `apps/server/src/pipeline/code-chunker.ts`

**Changes:**
- Import TypeScript parser
- Implement `chunkTypeScriptCode()`
- Remove placeholder

### 3. Test Fixtures
**Files:**
- `sample.ts` (100-150 lines)
- `sample-react.tsx` (50-75 lines)

### 4. Unit Tests
**File:** `ts-analyzer.test.ts`

**Must have:**
- 8+ test cases
- All features tested
- Edge cases covered

### 5. Day 4 Summary
**Post to Issue #62:**

```markdown
# Phase 13 Day 4 - TypeScript Parser Complete

## Implementation Summary
- ✅ Created `ts-analyzer.ts` (~200 lines)
- ✅ Updated code-chunker.ts
- ✅ TypeScript Compiler API integrated
- ✅ Test fixtures created (sample.ts, sample-react.tsx)
- ✅ Unit tests passing (XX/XX tests)
- ✅ Integration tests passing

## Parser Capabilities
- Imports: ✅ Named, default, namespace
- Functions: ✅ Regular, arrow, async
- Classes: ✅ Methods, properties, decorators
- Interfaces: ✅ Extracted
- TypeScript: ✅ Generics, types
- JSX/TSX: ✅ React components supported

## Language Support Matrix
| Language | Parser | Chunking | Status |
|----------|--------|----------|--------|
| Dart | Regex-based | ✅ Functions, classes | Complete |
| TypeScript | TS Compiler API | ✅ Functions, classes | Complete |
| JavaScript | Fallback | ⚠️ Simple chunks | Day 4 |
| Other | N/A | ⚠️ Simple chunks | Fallback |

## Performance
- TypeScript parsing: XXms average
- Comparable to Dart parser
- <300ms for typical files ✅

## Test Results
- Unit tests: XX/XX passing ✅
- Integration tests: XX/XX passing ✅
- Both Dart and TS working ✅
- Coverage: XX% ✅

## Example Chunks (TypeScript)
From `sample.ts`:
- 1 class chunk (AuthService)
- 3 method chunks (login, logout, formatToken)
- 1 function chunk (initializeApp)
- 2 constant chunks (MAX_RETRIES, API_VERSION)
- All with imports preserved

## Files Created/Modified
- `apps/server/src/pipeline/ts-analyzer.ts` (NEW)
- `apps/server/src/pipeline/code-chunker.ts` (MODIFIED)
- `apps/server/src/pipeline/__tests__/fixtures/sample.ts` (NEW)
- `apps/server/src/pipeline/__tests__/fixtures/sample-react.tsx` (NEW)
- `apps/server/src/pipeline/__tests__/ts-analyzer.test.ts` (NEW)

## Next Steps
Day 5: Integration Testing, Performance Validation, Documentation
```

---

## 🚨 Critical Validation Steps

### Step 1: Verify TypeScript Parsing
```bash
# Test parser directly
pnpm tsx -e "
import { parseTypeScriptFile } from './apps/server/src/pipeline/ts-analyzer.js';
import { readFileSync } from 'fs';

const content = readFileSync('apps/server/src/pipeline/__tests__/fixtures/sample.ts', 'utf-8');
const ast = await parseTypeScriptFile(content, 'sample.ts');

console.log('Imports:', ast.imports.length);
console.log('Functions:', ast.functions.length);
console.log('Classes:', ast.classes.length);
console.log('Classes[0]:', ast.classes[0].name, 'methods:', ast.classes[0].methods.length);
"
```

### Step 2: Verify Both Languages Work
```bash
# Ingest Dart
curl -X POST http://localhost:3333/api/ingest -F "file=@sample.dart" -F "collection_id=test"

# Ingest TypeScript
curl -X POST http://localhost:3333/api/ingest -F "file=@sample.ts" -F "collection_id=test"

# Both should succeed and create similar chunk structures
```

### Step 3: Verify JSX/TSX Handling
```bash
# Ingest React component
curl -X POST http://localhost:3333/api/ingest -F "file=@sample-react.tsx" -F "collection_id=test"

# Should extract Button and UserProfile components
```

---

## ⚠️ Important Notes

1. **TypeScript Compiler API**
   - Already installed in monorepo (usually)
   - Use `ts.createSourceFile()` for parsing
   - No need to run `tsc` - just parse

2. **DartAST Compatibility**
   - Reuse same interface for consistency
   - Makes chunker code simpler
   - Both languages chunk the same way

3. **JSX/TSX Support**
   - TypeScript compiler handles JSX automatically
   - No special configuration needed
   - React components are just functions

4. **Performance**
   - TS Compiler API is fast
   - Should match Dart parser speed
   - <300ms target is achievable

---

## 🎉 Success Criteria

**Day 4 is complete when:**

- ✅ `ts-analyzer.ts` created (~200 lines)
- ✅ TypeScript Compiler API integrated
- ✅ Extracts imports, functions, classes
- ✅ Handles JSX/TSX syntax
- ✅ Code chunker updated (TypeScript support)
- ✅ Test fixtures created (sample.ts, sample-react.tsx)
- ✅ 8+ unit tests passing
- ✅ Integration tests passing
- ✅ Both Dart and TypeScript working
- ✅ Performance <300ms
- ✅ No TypeScript errors
- ✅ No linting errors

**Timeline:** 4 hours

---

## 📞 Handoff

**When complete, post to Issue #62:**

```markdown
✅ Phase 13 Day 4 Complete - TypeScript Support Added

TypeScript parser implemented using TS Compiler API. Both Dart and TypeScript now supported.

See summary comment above for:
- Parser capabilities
- Language support matrix
- Performance metrics
- Test results

Files created/modified:
- ts-analyzer.ts (NEW)
- code-chunker.ts (MODIFIED)
- sample.ts, sample-react.tsx (NEW fixtures)
- ts-analyzer.test.ts (NEW)

Next: Day 5 - Testing, Performance, Documentation
```

---

**Remember:** Reuse the DartAST interface for consistency. The chunker should treat both languages the same way.
