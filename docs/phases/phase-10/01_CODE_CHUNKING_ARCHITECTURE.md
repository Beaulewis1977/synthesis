# Phase 10: Code-Aware Chunking Architecture

**AST-based intelligent code chunking for perfect context preservation**

---

## 🎯 Design Goals

1. **Preserve code structure** (functions/classes stay intact)
2. **Include context** (imports with code that uses them)
3. **Fast parsing** (<500ms per file)
4. **Language support** (Dart + TypeScript initially)
5. **Fallback gracefully** (simple chunking if AST fails)

---

## 🏗️ Architecture Overview

### Chunking Pipeline

```
Code File (Dart/TypeScript)
  ↓
Language Detection
  - .dart → Dart analyzer
  - .ts/.tsx → TS compiler API
  - .js → JavaScript parser
  - Unknown → Simple text chunking
  ↓
AST Parsing
  - Parse file into Abstract Syntax Tree
  - Extract top-level declarations
  - Track imports and dependencies
  ↓
Structure Extraction
  - Functions
  - Classes
  - Methods
  - Constants
  - Imports
  ↓
Contextual Chunking
  - Group related code
  - Preserve boundaries
  - Include necessary imports
  - Add metadata
  ↓
Chunk Creation
  [
    {
      type: 'function',
      code: 'Future<User> login(...) { ... }',
      imports: ['package:http/http.dart'],
      metadata: {function_name: 'login', ...}
    },
    ...
  ]
  ↓
Embedding & Storage
  - Use code-specific embedding (Voyage)
  - Store with rich metadata
  - Link related chunks
```

---

## 📦 Implementation

### 1. Code Chunker Service

**File:** `apps/server/src/pipeline/code-chunker.ts`

```typescript
import type { DocumentChunk } from '@synthesis/shared';
import { parseDartFile } from './dart-analyzer.js';
import { parseTypeScriptFile } from './ts-analyzer.js';

export interface CodeChunkOptions {
  maxChunkSize?: number;      // Max lines per chunk
  preserveImports?: boolean;   // Include imports in chunks
  trackRelationships?: boolean; // Build file dependency graph
}

/**
 * Main entry point for code-aware chunking
 */
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
        return await chunkTypeScriptCode(filePath, content, options);
      
      case 'js':
      case 'jsx':
        return await chunkJavaScriptCode(filePath, content, options);
      
      default:
        // Fallback to simple chunking
        console.warn(`Unsupported file type: ${extension}, using simple chunking`);
        return simpleChunking(content);
    }
  } catch (error) {
    console.error(`AST parsing failed for ${filePath}, falling back to simple chunking`, error);
    return simpleChunking(content);
  }
}

/**
 * Chunk Dart code using AST
 */
async function chunkDartCode(
  filePath: string,
  content: string,
  options: CodeChunkOptions
): Promise<DocumentChunk[]> {
  // Parse Dart file
  const ast = await parseDartFile(content, filePath);
  
  const chunks: DocumentChunk[] = [];
  const imports = ast.imports.map(i => i.uri);
  
  // Extract functions
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
  
  // Extract classes
  for (const cls of ast.classes) {
    // Option 1: Chunk entire class
    if (cls.code.split('\n').length < (options.maxChunkSize || 100)) {
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
          
          // Flutter-specific
          is_widget: cls.superclass?.includes('Widget') || cls.superclass?.includes('State'),
          is_stateful: cls.superclass === 'StatefulWidget',
        },
      });
    } else {
      // Option 2: Chunk per method (large class)
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
  
  // Constants/variables
  for (const constant of ast.constants) {
    chunks.push({
      text: constant.code,
      metadata: {
        chunk_type: 'constant',
        constant_name: constant.name,
        constant_type: constant.type,
        file_path: filePath,
        line_range: constant.lineRange,
        language: 'dart',
      },
    });
  }
  
  return chunks;
}

/**
 * Fallback: Simple text chunking
 */
function simpleChunking(content: string): DocumentChunk[] {
  const lines = content.split('\n');
  const chunkSize = 50; // lines
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

---

### 2. Dart Analyzer Integration

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
  }>;
  functions: Array<{
    name: string;
    code: string;
    parameters: string[];
    returnType: string;
    docComment?: string;
    lineRange: [number, number];
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
    }>;
    properties: Array<{
      name: string;
      type: string;
    }>;
    superclass?: string;
    interfaces: string[];
    lineRange: [number, number];
  }>;
  constants: Array<{
    name: string;
    code: string;
    type: string;
    lineRange: [number, number];
  }>;
}

/**
 * Parse Dart file using dart analyze
 */
export async function parseDartFile(
  content: string,
  filePath?: string
): Promise<DartAST> {
  // Write to temp file for analysis
  const tempFile = path.join(os.tmpdir(), `temp_${Date.now()}.dart`);
  await writeFile(tempFile, content);
  
  try {
    // Use dart analyze with JSON output
    const { stdout } = await execAsync(
      `dart analyze --format=json ${tempFile}`,
      { timeout: 5000 }
    );
    
    // Parse output
    const analysis = JSON.parse(stdout);
    
    // Extract AST using custom parser
    // (Since dart analyze doesn't directly give us AST, we parse the source)
    const ast = extractDartAST(content);
    
    return ast;
  } finally {
    // Cleanup temp file
    await unlink(tempFile).catch(() => {});
  }
}

/**
 * Extract Dart AST by parsing source code
 * (Simplified regex-based approach)
 */
function extractDartAST(content: string): DartAST {
  const lines = content.split('\n');
  const ast: DartAST = {
    imports: [],
    functions: [],
    classes: [],
    constants: [],
  };
  
  // Extract imports
  const importRegex = /^import\s+'([^']+)'\s*(?:as\s+(\w+))?;/gm;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    ast.imports.push({
      uri: match[1],
      prefix: match[2],
    });
  }
  
  // Extract top-level functions
  const functionRegex = /^(?:Future<\w+>|\w+)\s+(\w+)\s*\([^)]*\)\s*\{/gm;
  let funcMatch;
  while ((funcMatch = functionRegex.exec(content)) !== null) {
    const startIndex = funcMatch.index;
    const endIndex = findMatchingBrace(content, startIndex);
    const funcCode = content.substring(startIndex, endIndex);
    const funcLines = content.substring(0, startIndex).split('\n').length;
    
    ast.functions.push({
      name: funcMatch[1],
      code: funcCode,
      parameters: extractParameters(funcCode),
      returnType: extractReturnType(funcCode),
      lineRange: [funcLines, funcLines + funcCode.split('\n').length],
    });
  }
  
  // Extract classes
  const classRegex = /^class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*\{/gm;
  let classMatch;
  while ((classMatch = classRegex.exec(content)) !== null) {
    const startIndex = classMatch.index;
    const endIndex = findMatchingBrace(content, startIndex);
    const classCode = content.substring(startIndex, endIndex);
    const classLines = content.substring(0, startIndex).split('\n').length;
    
    ast.classes.push({
      name: classMatch[1],
      code: classCode,
      methods: extractMethods(classCode),
      properties: extractProperties(classCode),
      superclass: classMatch[2],
      interfaces: classMatch[3] ? classMatch[3].split(',').map(i => i.trim()) : [],
      lineRange: [classLines, classLines + classCode.split('\n').length],
    });
  }
  
  // Extract constants
  const constRegex = /^const\s+(\w+)\s*=\s*([^;]+);/gm;
  let constMatch;
  while ((constMatch = constRegex.exec(content)) !== null) {
    const constLines = content.substring(0, constMatch.index).split('\n').length;
    
    ast.constants.push({
      name: constMatch[1],
      code: constMatch[0],
      type: 'const',
      lineRange: [constLines, constLines],
    });
  }
  
  return ast;
}

/**
 * Find matching closing brace
 */
function findMatchingBrace(content: string, startIndex: number): number {
  let braceCount = 0;
  let inString = false;
  let stringChar = '';
  
  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];
    const prevChar = i > 0 ? content[i - 1] : '';
    
    // Handle strings
    if ((char === '"' || char === "'") && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }
    
    if (!inString) {
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
 * Extract function parameters
 */
function extractParameters(funcCode: string): string[] {
  const paramMatch = funcCode.match(/\(([^)]*)\)/);
  if (!paramMatch) return [];
  
  return paramMatch[1]
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

/**
 * Extract return type
 */
function extractReturnType(funcCode: string): string {
  const returnMatch = funcCode.match(/^(Future<\w+>|\w+)\s+\w+/);
  return returnMatch ? returnMatch[1] : 'void';
}

/**
 * Extract class methods
 */
function extractMethods(classCode: string): Array<{
  name: string;
  code: string;
  parameters: string[];
  returnType: string;
  lineRange: [number, number];
}> {
  const methods: any[] = [];
  const methodRegex = /(?:Future<\w+>|\w+)\s+(\w+)\s*\([^)]*\)\s*\{/g;
  
  let match;
  while ((match = methodRegex.exec(classCode)) !== null) {
    const startIndex = match.index;
    const endIndex = findMatchingBrace(classCode, startIndex);
    const methodCode = classCode.substring(startIndex, endIndex);
    const methodLines = classCode.substring(0, startIndex).split('\n').length;
    
    methods.push({
      name: match[1],
      code: methodCode,
      parameters: extractParameters(methodCode),
      returnType: extractReturnType(methodCode),
      lineRange: [methodLines, methodLines + methodCode.split('\n').length],
    });
  }
  
  return methods;
}

/**
 * Extract class properties
 */
function extractProperties(classCode: string): Array<{
  name: string;
  type: string;
}> {
  const properties: any[] = [];
  const propertyRegex = /^\s*(?:final\s+)?(\w+)\s+(\w+);/gm;
  
  let match;
  while ((match = propertyRegex.exec(classCode)) !== null) {
    properties.push({
      type: match[1],
      name: match[2],
    });
  }
  
  return properties;
}
```

---

### 3. Integration with Ingestion Pipeline

**Update:** `apps/server/src/pipeline/ingest.ts`

```typescript
import { chunkCodeFile } from './code-chunker.js';

export async function processDocument(
  document: Document,
  file: Buffer
): Promise<void> {
  // ... existing extraction code ...
  
  const text = await extractText(file, document.content_type);
  
  // Check if this is a code file
  const isCodeFile = document.file_path?.match(/\.(dart|ts|tsx|js|jsx)$/);
  
  let chunks: DocumentChunk[];
  
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
    chunks = splitIntoChunks(text, {
      maxSize: 800,
      overlap: 150,
    });
  }
  
  // ... rest of ingestion ...
}
```

---

## 🎛️ Configuration

```bash
# Enable code-aware chunking
CODE_CHUNKING=true

# Include imports in chunks
PRESERVE_IMPORTS=true

# Build file dependency graph
TRACK_RELATIONSHIPS=true

# Max lines per chunk (for large classes)
CODE_MAX_CHUNK_LINES=100
```

---

## 📊 Performance Characteristics

| File Size | Parse Time | Chunks Created |
|-----------|------------|----------------|
| Small (< 200 lines) | <100ms | 1-5 chunks |
| Medium (200-1000 lines) | 100-300ms | 5-20 chunks |
| Large (1000-5000 lines) | 300-500ms | 20-100 chunks |
| Very Large (>5000 lines) | 500ms+ | 100+ chunks |

**Optimization:** Cache parsed ASTs, only re-parse on file changes

---

## ✅ Acceptance Criteria

- [ ] Dart functions chunk as complete units (95%+ success rate)
- [ ] Imports preserved with code when enabled
- [ ] Classes chunk intelligently (whole class or per-method)
- [ ] Fallback to simple chunking on parse errors
- [ ] Performance <500ms per file (average)
- [ ] TypeScript chunking works (basic support)
- [ ] Metadata includes all relevant code context

---

**Next:** See `02_DART_AST_PARSING.md` for detailed Dart analyzer usage
