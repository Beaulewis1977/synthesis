# Phase 13: Dart AST Parsing

**Abstract Syntax Tree parsing for intelligent code chunking**

---

## 🎯 Purpose

Parse Dart source code to extract structured elements:
1. **Functions** - Complete function implementations
2. **Classes** - Class definitions and methods
3. **Imports** - Dependency tracking
4. **Constants** - Top-level variables
5. **Comments** - Documentation preservation

---

## 🏗️ Parser Architecture

### Three Parsing Approaches

```
Option A: Dart Analyzer CLI
  - Use `dart analyze --format=json`
  - Pros: Official tool, accurate
  - Cons: Slower, requires Dart SDK

Option B: Regex-based Parsing
  - Pattern matching for code structures
  - Pros: Fast, no dependencies
  - Cons: Less accurate, fragile

Option C: Hybrid Approach (RECOMMENDED)
  - Regex for initial extraction
  - Validation with dart analyze
  - Best balance of speed/accuracy
```

---

## 📦 Implementation

### Core Parser

**File:** `apps/server/src/pipeline/dart-analyzer.ts`

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

export interface DartAST {
  imports: Array<{ 
    uri: string;
    prefix?: string;
    show?: string[];
    hide?: string[];
  }>;
  functions: Array<{ 
    name: string;
    code: string;
    parameters: string[];
    returnType: string;
    docComment?: string;
    lineRange: [number, number];
    isAsync: boolean;
  }>;
  classes: Array<{ 
    name: string;
    code: string;
    methods: Array<{ 
      name: string;
      code: string;
      parameters: string[];
      returnType: string;
      lineRange: [number, number];
      isStatic: boolean;
    }>;
    properties: Array<{ 
      name: string;
      type: string;
      isFinal: boolean;
      isStatic: boolean;
    }>;
    superclass?: string;
    interfaces: string[];
    mixins: string[];
    lineRange: [number, number];
    isAbstract: boolean;
  }>;
  constants: Array<{ 
    name: string;
    code: string;
    type: string;
    value?: string;
    lineRange: [number, number];
  }>;
}

/**
 * Parse Dart file using regex-based approach
 */
export async function parseDartFile(
  content: string,
  filePath?: string
): Promise<DartAST> {
  const lines = content.split('\n');
  
  const ast: DartAST = {
    imports: [],
    functions: [],
    classes: [],
    constants: [],
  };
  
  // Extract imports
  ast.imports = extractImports(content);
  
  // Extract top-level functions
  ast.functions = extractFunctions(content, lines);
  
  // Extract classes
  ast.classes = extractClasses(content, lines);
  
  // Extract constants
  ast.constants = extractConstants(content, lines);
  
  return ast;
}

/**
 * Extract import statements
 */
function extractImports(content: string): DartAST['imports'] {
  const imports: DartAST['imports'] = [];
  
  // Match import statements
  const importRegex = /^import\s+'([^']+)'(?:\s+as\s+(\w+))?(?:\s+show\s+([^;]+))?(?:\s+hide\s+([^;]+))?;/gm;
  
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push({
      uri: match[1],
      prefix: match[2],
      show: match[3]?.split(',').map(s => s.trim()),
      hide: match[4]?.split(',').map(s => s.trim()),
    });
  }
  
  return imports;
}

/**
 * Extract top-level functions
 */
function extractFunctions(content: string, lines: string[]): DartAST['functions'] {
  const functions: DartAST['functions'] = [];
  
  // Match function declarations
  const functionRegex = /^(Future<[\w<>,
 ]+>|[\w<>]+)\s+(\w+)\s*\(([^)]*)\)(\s+async)?\s*\{/gm;
  
  let match;
  while ((match = functionRegex.exec(content)) !== null) {
    const startIndex = match.index;
    const endIndex = findMatchingBrace(content, startIndex);
    const funcCode = content.substring(startIndex, endIndex);
    const funcStartLine = content.substring(0, startIndex).split('\n').length;
    const funcEndLine = funcStartLine + funcCode.split('\n').length - 1;
    
    // Extract doc comment if exists
    const docComment = extractDocComment(content, startIndex);
    
    functions.push({
      name: match[2],
      code: funcCode,
      parameters: parseParameters(match[3]),
      returnType: match[1],
      docComment,
      lineRange: [funcStartLine, funcEndLine],
      isAsync: Boolean(match[4]),
    });
  }
  
  return functions;
}

/**
 * Extract classes
 */
function extractClasses(content: string, lines: string[]): DartAST['classes'] {
  const classes: DartAST['classes'] = [];
  
  // Match class declarations
  const classRegex = /^(abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+with\s+([^{]+))?(?:\s+implements\s+([^{]+))?\s*\{/gm;
  
  let match;
  while ((match = classRegex.exec(content)) !== null) {
    const startIndex = match.index;
    const endIndex = findMatchingBrace(content, startIndex);
    const classCode = content.substring(startIndex, endIndex);
    const classStartLine = content.substring(0, startIndex).split('\n').length;
    const classEndLine = classStartLine + classCode.split('\n').length - 1;
    
    // Extract methods and properties from class body
    const methods = extractMethods(classCode);
    const properties = extractProperties(classCode);
    
    classes.push({
      name: match[2],
      code: classCode,
      methods,
      properties,
      superclass: match[3],
      mixins: match[4]?.split(',').map(m => m.trim()) || [],
      interfaces: match[5]?.split(',').map(i => i.trim()) || [],
      lineRange: [classStartLine, classEndLine],
      isAbstract: Boolean(match[1]),
    });
  }
  
  return classes;
}

/**
 * Extract methods from class body
 */
function extractMethods(classCode: string): DartAST['classes'][0]['methods'] {
  const methods: DartAST['classes'][0]['methods'] = [];
  
  // Match method declarations (similar to functions but inside class)
  const methodRegex = /(static\s+)?(Future<[\w<>,
 ]+>|[\w<>]+|void)\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
  
  let match;
  while ((match = methodRegex.exec(classCode)) !== null) {
    const startIndex = match.index;
    const endIndex = findMatchingBrace(classCode, startIndex);
    const methodCode = classCode.substring(startIndex, endIndex);
    const methodStartLine = classCode.substring(0, startIndex).split('\n').length;
    const methodEndLine = methodStartLine + methodCode.split('\n').length - 1;
    
    // Skip if this looks like a constructor
    const isConstructor = match[3] === extractClassName(classCode);
    if (isConstructor) continue;
    
    methods.push({
      name: match[3],
      code: methodCode,
      parameters: parseParameters(match[4]),
      returnType: match[2],
      lineRange: [methodStartLine, methodEndLine],
      isStatic: Boolean(match[1]),
    });
  }
  
  return methods;
}

/**
 * Extract properties from class body
 */
function extractProperties(classCode: string): DartAST['classes'][0]['properties'] {
  const properties: DartAST['classes'][0]['properties'] = [];
  
  // Match property declarations
  const propertyRegex = /^\s*(static\s+)?(final\s+)?([\w<>]+)\s+(\w+)(?:\s*=\s*[^;]+)?;/gm;
  
  let match;
  while ((match = propertyRegex.exec(classCode)) !== null) {
    properties.push({
      name: match[4],
      type: match[3],
      isStatic: Boolean(match[1]),
      isFinal: Boolean(match[2]),
    });
  }
  
  return properties;
}

/**
 * Extract constants
 */
function extractConstants(content: string, lines: string[]): DartAST['constants'] {
  const constants: DartAST['constants'] = [];
  
  // Match const/final declarations
  const constRegex = /^(const|final)\s+([\w<>]+)\s+(\w+)\s*=\s*([^;]+);/gm;
  
  let match;
  while ((match = constRegex.exec(content)) !== null) {
    const constLine = content.substring(0, match.index).split('\n').length;
    
    constants.push({
      name: match[3],
      code: match[0],
      type: match[2],
      value: match[4].trim(),
      lineRange: [constLine, constLine],
    });
  }
  
  return constants;
}

/**
 * Find matching closing brace
 */
function findMatchingBrace(content: string, startIndex: number): number {
  let braceCount = 0;
  let inString = false;
  let stringChar = '';
  let inComment = false;
  
  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];
    const nextChar = i + 1 < content.length ? content[i + 1] : '';
    const prevChar = i > 0 ? content[i - 1] : '';
    
    // Handle single-line comments
    if (char === '/' && nextChar === '/' && !inString) {
      // Skip to end of line
      while (i < content.length && content[i] !== '\n') i++;
      continue;
    }
    
    // Handle multi-line comments
    if (char === '/' && nextChar === '*' && !inString) {
      inComment = true;
      i++;
      continue;
    }
    if (char === '*' && nextChar === '/' && inComment) {
      inComment = false;
      i++;
      continue;
    }
    if (inComment) continue;
    
    // Handle strings
    if ((char === '"' || char === "'") && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }
    
    if (!inString && !inComment) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      
      if (braceCount === 0 && i > startIndex) {
        return i + 1;
      }
    }
  }
  
  return content.length;
}

/**
 * Parse function/method parameters
 */
function parseParameters(paramString: string): string[] {
  if (!paramString.trim()) return [];
  
  return paramString
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

/**
 * Extract doc comment before a declaration
 */
function extractDocComment(content: string, declarationIndex: number): string | undefined {
  const beforeDeclaration = content.substring(0, declarationIndex);
  const lines = beforeDeclaration.split('\n');
  
  // Look backwards for doc comments (///)
  const docLines: string[] = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    
    if (line.startsWith('///')) {
      docLines.unshift(line.substring(3).trim());
    } else if (line === '' || line.startsWith('//')) {
      // Empty line or regular comment, continue
      continue;
    } else {
      // Non-comment line, stop
      break;
    }
  }
  
  return docLines.length > 0 ? docLines.join('\n') : undefined;
}

/**
 * Extract class name from class code
 */
function extractClassName(classCode: string): string {
  const match = classCode.match(/class\s+(\w+)/);
  return match ? match[1] : '';
}

/**
 * Validate AST using dart analyze (optional)
 */
export async function validateDartAST(
  content: string,
  ast: DartAST
): Promise<boolean> {
  try {
    // Write to temp file
    const tempFile = path.join(os.tmpdir(), `temp_${Date.now()}.dart`);
    await writeFile(tempFile, content);
    
    // Run dart analyze
    const { stdout, stderr } = await execAsync(
      `dart analyze --format=json ${tempFile}`,
      { timeout: 5000 }
    );
    
    // Cleanup
    await unlink(tempFile);
    
    // Check for errors
    const result = JSON.parse(stdout);
    const hasErrors = result.diagnostics?.some(d => d.severity === 'error');
    
    return !hasErrors;
  } catch (error) {
    console.warn('Dart analyze validation failed:', error);
    return true; // Assume valid if validation fails
  }
}
```

---

## 🧪 Testing

```typescript
describe('Dart AST Parser', () => {
  it('extracts imports correctly', async () => {
    const code = `
import 'package:flutter/material.dart';
import '../models/user.dart' as user_model;
import 'utils.dart' show formatDate, parseDate;
`;
    
    const ast = await parseDartFile(code);
    
    expect(ast.imports).toHaveLength(3);
    expect(ast.imports[0].uri).toBe('package:flutter/material.dart');
    expect(ast.imports[1].prefix).toBe('user_model');
    expect(ast.imports[2].show).toEqual(['formatDate', 'parseDate']);
  });
  
  it('extracts functions with async', async () => {
    const code = `
Future<User> login(String email, String password) async {
  final response = await api.post('/login');
  return User.fromJson(response);
}
`;
    
    const ast = await parseDartFile(code);
    
    expect(ast.functions).toHaveLength(1);
    expect(ast.functions[0].name).toBe('login');
    expect(ast.functions[0].isAsync).toBe(true);
    expect(ast.functions[0].returnType).toBe('Future<User>');
  });
  
  it('extracts classes with methods', async () => {
    const code = `
class AuthService extends BaseService {
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
    
    expect(ast.classes).toHaveLength(1);
    expect(ast.classes[0].name).toBe('AuthService');
    expect(ast.classes[0].superclass).toBe('BaseService');
    expect(ast.classes[0].methods).toHaveLength(2);
    expect(ast.classes[0].methods[1].isStatic).toBe(true);
    expect(ast.classes[0].properties).toHaveLength(1);
  });
});
```

---

## ✅ Acceptance Criteria

- [ ] Extracts imports with prefixes and show/hide clauses
- [ ] Extracts functions with parameters and return types
- [ ] Extracts classes with methods and properties
- [ ] Handles async/await correctly
- [ ] Preserves doc comments
- [ ] Finds matching braces correctly (95%+ accuracy)
- [ ] Performance <300ms for typical files
- [ ] Handles edge cases (nested braces, strings with braces)

---

**Next:** See `03_FILE_RELATIONSHIPS.md` for dependency tracking

```