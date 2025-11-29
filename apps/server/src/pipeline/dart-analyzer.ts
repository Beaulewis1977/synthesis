/**
 * Dart AST Parser - Regex-based extraction for Dart source files (Phase 14 Enhanced)
 *
 * Extracts imports, functions, classes, and constants from Dart code.
 * Includes framework detection for Flutter, Supabase, Firebase.
 *
 * @module pipeline/dart-analyzer
 */

import type { AnalyzerCapabilities, DocumentFramework, FrameworkInfo } from '@synthesis/shared';
import { type LanguageAnalyzer, analyzerRegistry } from './analyzers/registry.js';

// =============================================================================
// Framework Detection (Phase 14)
// =============================================================================

/**
 * Dart-specific framework patterns with enhanced detection
 */
const DART_FRAMEWORK_PATTERNS: Record<
  string,
  { patterns: RegExp[]; framework: DocumentFramework }
> = {
  flutter: {
    framework: 'flutter',
    patterns: [
      /import\s+['"]package:flutter\//,
      /extends\s+(?:Stateless|Stateful)Widget/,
      /MaterialApp|CupertinoApp|WidgetsApp/,
      /BuildContext\s+context/,
      /Widget\s+build\s*\(/,
      /setState\s*\(\s*\(\s*\)/,
      /Navigator\.(?:push|pop|pushNamed)/,
      /Scaffold|AppBar|Container|Column|Row/,
      /TextEditingController|FocusNode/,
      /@override/,
    ],
  },
  dart: {
    framework: 'dart',
    patterns: [
      /import\s+['"]dart:/,
      /void\s+main\s*\(\s*\)/,
      /Future<|Stream<|async\s+/,
      /\.then\s*\(|\.catchError\s*\(/,
    ],
  },
  supabase: {
    framework: 'supabase',
    patterns: [
      /import\s+['"]package:supabase/,
      /import\s+['"]package:supabase_flutter/,
      /Supabase\.instance/,
      /SupabaseClient/,
      /\.from\s*\(\s*['"]/,
      /supabase\.auth/,
      /supabase\.storage/,
      /SUPABASE_URL|SUPABASE_ANON_KEY/,
    ],
  },
  firebase: {
    framework: 'firebase',
    patterns: [
      /import\s+['"]package:firebase/,
      /import\s+['"]package:cloud_firestore/,
      /import\s+['"]package:firebase_auth/,
      /FirebaseFirestore\.instance/,
      /FirebaseAuth\.instance/,
      /Firebase\.initializeApp/,
      /CollectionReference|DocumentReference/,
    ],
  },
  redis: {
    framework: 'redis',
    patterns: [
      /import\s+['"]package:redis/,
      /RedisConnection/,
      /\.set\s*\(|\.get\s*\(/,
      /REDIS_URL|REDIS_HOST/,
    ],
  },
  postgres: {
    framework: 'postgres',
    patterns: [
      /import\s+['"]package:postgres/,
      /PostgreSQLConnection/,
      /\.query\s*\(/,
      /\.execute\s*\(/,
      /DATABASE_URL|PG_HOST/,
    ],
  },
};

/**
 * Detect Dart frameworks from code
 */
export function detectDartFrameworks(code: string, _filePath: string): FrameworkInfo[] {
  const results: FrameworkInfo[] = [];

  for (const [, config] of Object.entries(DART_FRAMEWORK_PATTERNS)) {
    const indicators: string[] = [];
    let matchCount = 0;

    for (const pattern of config.patterns) {
      const match = code.match(pattern);
      if (match) {
        matchCount++;
        indicators.push(match[0].substring(0, 60).trim());
      }
    }

    if (matchCount > 0) {
      const confidence = Math.min((matchCount / config.patterns.length) * 1.5, 1);
      results.push({
        name: config.framework,
        confidence,
        indicators: indicators.slice(0, 5),
      });
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Dart analyzer capabilities
 */
export const DART_ANALYZER_CAPABILITIES: AnalyzerCapabilities = {
  hierarchicalChunking: true,
  frameworkDetection: true,
  importExtraction: true,
  symbolExtraction: true,
  asyncDetection: true,
  decoratorDetection: true,
};

// =============================================================================
// AST Types
// =============================================================================

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
    isGenerator: boolean;
    isArrowFunction?: boolean;
    startOffset: number;
    endOffset: number;
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
      isAsync: boolean;
      startOffset: number;
      endOffset: number;
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
    startOffset: number;
    endOffset: number;
  }>;
  constants: Array<{
    name: string;
    code: string;
    type: string;
    value?: string;
    lineRange: [number, number];
    startOffset: number;
    endOffset: number;
  }>;
}

// Helper: Find matching closing brace, handling strings and comments
function findMatchingBrace(content: string, startIndex: number): number {
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inMultiLineComment = false;
  let i = startIndex;

  while (i < content.length) {
    const char = content[i];
    const nextChar = content[i + 1] || '';
    // Handle multi-line comments /* */
    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '/' && nextChar === '*') {
        inMultiLineComment = true;
        i += 2;
        continue;
      }
      if (inMultiLineComment && char === '*' && nextChar === '/') {
        inMultiLineComment = false;
        i += 2;
        continue;
      }
    }

    // Handle single-line comments //
    if (!inSingleQuote && !inDoubleQuote && !inMultiLineComment) {
      if (char === '/' && nextChar === '/') {
        // Skip to end of line
        while (i < content.length && content[i] !== '\n') {
          i++;
        }
        continue;
      }
    }

    // Handle string literals (skip if in comment)
    if (!inMultiLineComment) {
      if (char === "'" && !isEscaped(content, i)) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && !isEscaped(content, i)) {
        inDoubleQuote = !inDoubleQuote;
      }
    }

    // Count braces only if not in string or comment
    if (!inSingleQuote && !inDoubleQuote && !inMultiLineComment) {
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }

    i++;
  }

  return -1; // No matching brace found
}

// Helper: Parse parameters from function signature
function parseParameters(paramString: string): string[] {
  if (!paramString.trim()) {
    return [];
  }

  const params: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < paramString.length; i++) {
    const char = paramString[i];

    // Track string state
    if ((char === "'" || char === '"') && !isEscaped(paramString, i)) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }

    // Track depth for nested structures
    if (!inString) {
      if (char === '<' || char === '{' || char === '[') {
        depth++;
      } else if (char === '>' || char === '}' || char === ']') {
        depth--;
      }
    }

    // Split on commas at depth 0
    if (char === ',' && depth === 0 && !inString) {
      params.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    params.push(current.trim());
  }

  return params;
}

// Helper: Extract doc comment (/// style) before a declaration
function extractDocComment(content: string, declarationIndex: number): string | undefined {
  const lines = content.substring(0, declarationIndex).split('\n');
  const docLines: string[] = [];

  // Work backwards from declaration
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();

    if (line.startsWith('///')) {
      docLines.unshift(line.substring(3).trim());
    } else if (line === '' || line.startsWith('//')) {
      // Allow empty lines and single-line comments
    } else {
      break; // Stop at first non-doc-comment line
    }
  }

  return docLines.length > 0 ? docLines.join('\n') : undefined;
}

// Helper: Calculate line range from character indices
function getLineRange(content: string, start: number, end: number): [number, number] {
  const beforeStart = content.substring(0, start);
  const beforeEnd = content.substring(0, end);
  const startLine = beforeStart.split('\n').length;
  const endLine = beforeEnd.split('\n').length;
  return [startLine, endLine];
}

function extractCodeSegment(
  content: string,
  rawStart: number,
  rawEnd: number
): { code: string; startOffset: number; endOffset: number } {
  const slice = content.slice(rawStart, rawEnd);
  const leadingWhitespaceMatch = slice.match(/^\s*/);
  const trailingWhitespaceMatch = slice.match(/\s*$/);
  const leadingWhitespace = leadingWhitespaceMatch ? leadingWhitespaceMatch[0].length : 0;
  const trailingWhitespace = trailingWhitespaceMatch ? trailingWhitespaceMatch[0].length : 0;
  let startOffset = rawStart + leadingWhitespace;
  let endOffset = rawEnd - trailingWhitespace;
  let code = slice.trim();

  if (startOffset > endOffset) {
    startOffset = rawStart;
    endOffset = rawStart;
    code = '';
  }

  return {
    code,
    startOffset,
    endOffset,
  };
}

// Helper: Determine whether the character at index is escaped by backslashes
function isEscaped(source: string, index: number): boolean {
  let backslashCount = 0;
  for (let i = index - 1; i >= 0 && source[i] === '\\'; i--) {
    backslashCount++;
  }
  return backslashCount % 2 === 1;
}

// Helper: Determine if the given index sits inside an open class declaration
function isInsideClass(content: string, position: number): boolean {
  const classRegex =
    /(abstract\s+)?class\s+\w+(?:\s+extends\s+\w+)?(?:\s+with\s+[^\{]+)?(?:\s+implements\s+[^\{]+)?\s*\{/g;

  let match: RegExpExecArray | null;
  while ((match = classRegex.exec(content)) !== null) {
    const openBraceIndex = match.index + match[0].length - 1;

    if (openBraceIndex >= position) {
      break; // later classes open after the position we care about
    }

    const closingBraceIndex = findMatchingBrace(content, openBraceIndex);

    if (position > openBraceIndex && (closingBraceIndex === -1 || position < closingBraceIndex)) {
      return true;
    }
  }

  return false;
}

// Extract imports from Dart source
function extractImports(content: string): DartAST['imports'] {
  const imports: DartAST['imports'] = [];
  // Regex: import 'uri' [as prefix] [show/hide names];
  const importRegex = /import\s+['"]([^'"]+)['"]\s*(?:as\s+(\w+))?\s*(?:(show|hide)\s+([^;]+))?;/g;

  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    const uri = match[1];
    const prefix = match[2];
    const showOrHide = match[3];
    const names = match[4];

    const importEntry: DartAST['imports'][0] = { uri };

    if (prefix) {
      importEntry.prefix = prefix;
    }

    if (showOrHide && names) {
      const nameList = names.split(',').map((n) => n.trim());
      if (showOrHide === 'show') {
        importEntry.show = nameList;
      } else {
        importEntry.hide = nameList;
      }
    }

    imports.push(importEntry);
  }

  return imports;
}

// Extract top-level functions (not inside classes)
function extractFunctions(content: string): DartAST['functions'] {
  const functions: DartAST['functions'] = [];

  // Regex: [Future<T>|void|Type] functionName(params) [async] {
  const funcRegex =
    /(^|\n)\s*(?:Future<[^>]+>|Future|void|\w+(?:<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)\s*(async)?\s*\{/g;

  let match: RegExpExecArray | null;
  while ((match = funcRegex.exec(content)) !== null) {
    const matchStart = match.index + match[1].length;
    const funcName = match[2];
    const paramsStr = match[3];
    const isAsync = !!match[4];

    // Find matching brace to get full function body
    const braceIndex = match.index + match[0].length - 1;
    const endBrace = findMatchingBrace(content, braceIndex);

    if (endBrace === -1) {
      continue; // Malformed function, skip
    }

    // Extract full function code and normalised offsets
    const {
      code: funcCode,
      startOffset,
      endOffset,
    } = extractCodeSegment(content, matchStart, endBrace + 1);

    // Extract return type
    const returnTypeMatch = funcCode.match(
      /^((?:Future<[^>]+>|Future|void|\w+(?:<[^>]+>)?))\s+\w+/
    );
    const returnType = returnTypeMatch ? returnTypeMatch[1] : 'dynamic';

    // Parse parameters
    const parameters = parseParameters(paramsStr);

    // Extract doc comment
    const docComment = extractDocComment(content, matchStart);

    // Calculate line range
    const lineRange = getLineRange(content, matchStart, endBrace + 1);

    if (isInsideClass(content, matchStart)) {
      continue; // Inside a class, skip (will be extracted as method)
    }

    functions.push({
      name: funcName,
      code: funcCode,
      parameters,
      returnType,
      docComment,
      lineRange,
      isGenerator: false, // Dart does not have generator functions
      isAsync,
      startOffset,
      endOffset,
    });
  }

  return functions;
}

// Extract classes with methods and properties
function extractClasses(content: string): DartAST['classes'] {
  const classes: DartAST['classes'] = [];

  // Regex: [abstract] class ClassName [extends Super] [with Mixin] [implements Interface] {
  const classRegex =
    /(abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+with\s+([^{]+))?(?:\s+implements\s+([^{]+))?\s*\{/g;

  let match: RegExpExecArray | null;
  while ((match = classRegex.exec(content)) !== null) {
    const isAbstract = !!match[1];
    const className = match[2];
    const superclass = match[3];
    const mixinsStr = match[4];
    const interfacesStr = match[5];

    const braceIndex = match.index + match[0].length - 1;
    const endBrace = findMatchingBrace(content, braceIndex);

    if (endBrace === -1) {
      continue; // Malformed class, skip
    }

    const {
      code: classCode,
      startOffset,
      endOffset,
    } = extractCodeSegment(content, match.index, endBrace + 1);
    const classBody = content.substring(braceIndex + 1, endBrace);

    // Parse mixins and interfaces
    const mixins = mixinsStr ? mixinsStr.split(',').map((m) => m.trim()) : [];
    const interfaces = interfacesStr ? interfacesStr.split(',').map((i) => i.trim()) : [];

    // Extract methods
    const methods: DartAST['classes'][0]['methods'] = [];
    const methodRegex =
      /(static\s+)?(?:Future<[^>]+>|Future|void|\w+(?:<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)\s*(async)?\s*\{/g;

    let methodMatch: RegExpExecArray | null;
    while ((methodMatch = methodRegex.exec(classBody)) !== null) {
      const isStatic = !!methodMatch[1];
      const methodName = methodMatch[2];
      const paramsStr = methodMatch[3];
      const isAsync = !!methodMatch[4];

      // Skip constructor
      if (methodName === className) {
        continue;
      }

      const methodBraceStart = braceIndex + 1 + methodMatch.index + methodMatch[0].length - 1;
      const methodBraceEnd = findMatchingBrace(content, methodBraceStart);

      if (methodBraceEnd === -1) {
        continue;
      }

      const methodStart = braceIndex + 1 + methodMatch.index;
      const methodEnd = methodBraceEnd + 1;
      const {
        code: methodCode,
        startOffset,
        endOffset,
      } = extractCodeSegment(content, methodStart, methodEnd);
      const returnTypeMatch = methodCode.match(
        /^(?:static\s+)?((?:Future<[^>]+>|Future|void|\w+(?:<[^>]+>)?))\s+\w+/
      );
      const returnType = returnTypeMatch ? returnTypeMatch[1] : 'dynamic';
      const parameters = parseParameters(paramsStr);
      const lineRange = getLineRange(
        content,
        braceIndex + 1 + methodMatch.index,
        methodBraceEnd + 1
      );

      methods.push({
        name: methodName,
        code: methodCode,
        parameters,
        returnType,
        lineRange,
        isStatic,
        isAsync,
        startOffset,
        endOffset,
      });
    }

    // Extract properties
    const properties: DartAST['classes'][0]['properties'] = [];
    const propRegex =
      /(static\s+)?(final\s+|const\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*(?:=\s*[^;]+)?;/g;

    let propMatch: RegExpExecArray | null;
    while ((propMatch = propRegex.exec(classBody)) !== null) {
      const isStatic = !!propMatch[1];
      const isFinal = !!propMatch[2];
      const type = propMatch[3];
      const name = propMatch[4];

      properties.push({
        name,
        type,
        isFinal,
        isStatic,
      });
    }

    const lineRange = getLineRange(content, match.index, endBrace + 1);

    classes.push({
      name: className,
      code: classCode,
      methods,
      properties,
      superclass,
      interfaces,
      mixins,
      lineRange,
      isAbstract,
      startOffset,
      endOffset,
    });
  }

  return classes;
}

// Extract top-level constants
function extractConstants(content: string): DartAST['constants'] {
  const constants: DartAST['constants'] = [];

  // Regex: const/final Type name = value;
  const constRegex = /(^|\n)\s*(const|final)\s+(\w+(?:<[^>]+>)?)\s+(\w+)\s*=\s*([^;]+);/g;

  let match: RegExpExecArray | null;
  while ((match = constRegex.exec(content)) !== null) {
    const matchStart = match.index + match[1].length;
    const type = match[3];
    const name = match[4];
    const value = match[5].trim();

    if (isInsideClass(content, matchStart)) {
      continue; // Inside a class, skip
    }

    const { code, startOffset, endOffset } = extractCodeSegment(
      content,
      matchStart,
      match.index + match[0].length
    );
    const lineRange = getLineRange(content, matchStart, match.index + match[0].length);

    constants.push({
      name,
      code,
      type,
      value,
      lineRange,
      startOffset,
      endOffset,
    });
  }

  return constants;
}

// Main parser function
export async function parseDartFile(content: string, filePath?: string): Promise<DartAST> {
  try {
    const imports = extractImports(content);
    const functions = extractFunctions(content);
    const classes = extractClasses(content);
    const constants = extractConstants(content);

    return {
      imports,
      functions,
      classes,
      constants,
    };
  } catch (error) {
    // Graceful degradation: return partial AST on error
    console.warn(`Failed to parse Dart file${filePath ? ` ${filePath}` : ''}: ${error}`);
    return {
      imports: extractImports(content) || [],
      functions: [],
      classes: [],
      constants: [],
    };
  }
}

// =============================================================================
// Language Analyzer Registration (Phase 14)
// =============================================================================

/**
 * Dart language analyzer implementation
 */
export const dartAnalyzer: LanguageAnalyzer = {
  language: 'dart',
  extensions: ['dart'],
  parserType: 'regex',
  capabilities: DART_ANALYZER_CAPABILITIES,

  async analyze(code: string, filePath: string): Promise<DartAST> {
    return parseDartFile(code, filePath);
  },

  detectFrameworks(code: string, filePath: string): FrameworkInfo[] {
    return detectDartFrameworks(code, filePath);
  },
};

// Register the analyzer
analyzerRegistry.register(dartAnalyzer, 10);
