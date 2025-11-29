/**
 * C/C++ AST Parser using regex-based analysis (Phase 14)
 *
 * Produces DartAST-compatible output for seamless integration with existing chunking pipeline.
 * Handles both C and C++ syntax patterns.
 *
 * @module pipeline/cpp-analyzer
 */

import type { AnalyzerCapabilities, FrameworkInfo } from '@synthesis/shared';
import { type LanguageAnalyzer, analyzerRegistry } from './analyzers/registry.js';
import type { DartAST } from './dart-analyzer.js';

// =============================================================================
// Analyzer Capabilities
// =============================================================================

/**
 * C analyzer capabilities
 */
export const C_ANALYZER_CAPABILITIES: AnalyzerCapabilities = {
  hierarchicalChunking: true,
  frameworkDetection: false,
  importExtraction: true,
  symbolExtraction: true,
  asyncDetection: false,
  decoratorDetection: false,
};

/**
 * C++ analyzer capabilities
 */
export const CPP_ANALYZER_CAPABILITIES: AnalyzerCapabilities = {
  hierarchicalChunking: true,
  frameworkDetection: false,
  importExtraction: true,
  symbolExtraction: true,
  asyncDetection: false,
  decoratorDetection: false,
};

// =============================================================================
// AST Parsing
// =============================================================================

/**
 * Parse C file using regex-based analysis.
 */
export async function parseCFile(content: string, filePath: string): Promise<DartAST> {
  return parseCppFile(content, filePath); // C is a subset of C++
}

/**
 * Parse C++ file using regex-based analysis.
 * Returns DartAST-compatible structure for consistent chunking across languages.
 */
export async function parseCppFile(content: string, filePath: string): Promise<DartAST> {
  const ast: DartAST = {
    imports: [],
    functions: [],
    classes: [],
    constants: [],
  };

  try {
    extractCppIncludes(content, ast);
    extractCppFunctions(content, ast);
    extractCppClasses(content, ast);
    extractCppStructs(content, ast);
    extractCppEnums(content, ast);
    extractCppConstants(content, ast);

    return ast;
  } catch (error) {
    console.error(`Failed to parse C/C++ file ${filePath}:`, error);
    return ast;
  }
}

/**
 * Extract #include statements
 */
function extractCppIncludes(content: string, ast: DartAST): void {
  const includeRegex = /^#include\s*[<"]([^>"]+)[>"]/gm;
  let match: RegExpExecArray | null;

  while ((match = includeRegex.exec(content)) !== null) {
    ast.imports.push({ uri: match[1] });
  }
}

/**
 * Extract C++ functions (excluding class methods)
 */
function extractCppFunctions(content: string, ast: DartAST): void {
  // Match function definitions (not declarations ending with ;)
  // This regex handles return types, pointers, references, templates
  const funcRegex =
    /^(?:template\s*<[^>]+>\s*)?(?:(?:static|inline|virtual|explicit|constexpr|extern)\s+)*(?:[\w:]+(?:\s*[*&]+)?)\s+(\w+)\s*\(([^)]*)\)(?:\s*const)?(?:\s*noexcept)?(?:\s*override)?(?:\s*->\s*[\w:]+)?\s*\{/gm;

  let match: RegExpExecArray | null;

  while ((match = funcRegex.exec(content)) !== null) {
    const funcName = match[1];
    const paramsStr = match[2];

    // Skip if inside a class (check for class context)
    const beforeMatch = content.substring(0, match.index);
    if (isInsideClass(beforeMatch)) continue;

    const startOffset = match.index;
    const startLine = content.substring(0, startOffset).split('\n').length;

    const braceStart = match.index + match[0].length - 1;
    const endBrace = findMatchingBrace(content, braceStart);
    if (endBrace === -1) continue;

    const code = content.substring(startOffset, endBrace + 1);
    const endLine = content.substring(0, endBrace + 1).split('\n').length;

    // Extract return type from the match
    const returnTypeMatch = match[0].match(
      /^(?:template\s*<[^>]+>\s*)?(?:(?:static|inline|virtual|explicit|constexpr|extern)\s+)*([\w:]+(?:\s*[*&]+)?)\s+\w+/
    );
    const returnType = returnTypeMatch ? returnTypeMatch[1].trim() : 'void';

    const parameters = parseCppParameters(paramsStr);

    ast.functions.push({
      name: funcName,
      code,
      parameters,
      returnType,
      lineRange: [startLine, endLine],
      isAsync: false,
      isGenerator: false,
      startOffset,
      endOffset: endBrace + 1,
    });
  }
}

/**
 * Extract C++ classes
 */
function extractCppClasses(content: string, ast: DartAST): void {
  const classRegex =
    /^(?:template\s*<[^>]+>\s*)?class\s+(\w+)(?:\s*:\s*(?:public|private|protected)\s+(\w+)(?:\s*,\s*(?:public|private|protected)\s+\w+)*)?\s*\{/gm;

  let match: RegExpExecArray | null;

  while ((match = classRegex.exec(content)) !== null) {
    const className = match[1];
    const superclass = match[2];

    const startOffset = match.index;
    const startLine = content.substring(0, startOffset).split('\n').length;

    const braceStart = match.index + match[0].length - 1;
    const endBrace = findMatchingBrace(content, braceStart);
    if (endBrace === -1) continue;

    // Find the semicolon after the closing brace
    let endOffset = endBrace + 1;
    const afterBrace = content.substring(endBrace + 1);
    const semiMatch = afterBrace.match(/^\s*;/);
    if (semiMatch) {
      endOffset = endBrace + 1 + semiMatch[0].length;
    }

    const classBody = content.substring(braceStart + 1, endBrace);
    const code = content.substring(startOffset, endOffset);
    const endLine = content.substring(0, endOffset).split('\n').length;

    const methods = extractCppMethods(classBody, braceStart + 1, content);
    const properties = extractCppFields(classBody);

    ast.classes.push({
      name: className,
      code,
      methods,
      properties,
      superclass,
      interfaces: [],
      mixins: [],
      lineRange: [startLine, endLine],
      isAbstract: classBody.includes('= 0;'), // Pure virtual methods
      startOffset,
      endOffset,
    });
  }
}

/**
 * Extract C++ structs (treated as classes)
 */
function extractCppStructs(content: string, ast: DartAST): void {
  const structRegex = /^struct\s+(\w+)(?:\s*:\s*(?:public|private)?\s*(\w+))?\s*\{/gm;

  let match: RegExpExecArray | null;

  while ((match = structRegex.exec(content)) !== null) {
    const structName = match[1];
    const superclass = match[2];

    const startOffset = match.index;
    const startLine = content.substring(0, startOffset).split('\n').length;

    const braceStart = match.index + match[0].length - 1;
    const endBrace = findMatchingBrace(content, braceStart);
    if (endBrace === -1) continue;

    let endOffset = endBrace + 1;
    const afterBrace = content.substring(endBrace + 1);
    const semiMatch = afterBrace.match(/^\s*;/);
    if (semiMatch) {
      endOffset = endBrace + 1 + semiMatch[0].length;
    }

    const structBody = content.substring(braceStart + 1, endBrace);
    const code = content.substring(startOffset, endOffset);
    const endLine = content.substring(0, endOffset).split('\n').length;

    const properties = extractCppFields(structBody);

    ast.classes.push({
      name: structName,
      code,
      methods: [],
      properties,
      superclass,
      interfaces: [],
      mixins: [],
      lineRange: [startLine, endLine],
      isAbstract: false,
      startOffset,
      endOffset,
    });
  }
}

/**
 * Extract methods from C++ class body
 */
function extractCppMethods(
  classBody: string,
  classStartOffset: number,
  fullContent: string
): DartAST['classes'][0]['methods'] {
  const methods: DartAST['classes'][0]['methods'] = [];

  // Match method definitions (with body)
  const methodRegex =
    /(?:(?:static|virtual|inline|explicit|constexpr)\s+)*(?:[\w:]+(?:\s*[*&]+)?)\s+(\w+)\s*\(([^)]*)\)(?:\s*const)?(?:\s*noexcept)?(?:\s*override)?(?:\s*=\s*0)?(?:\s*->\s*[\w:]+)?\s*(?:\{|;)/g;

  let match: RegExpExecArray | null;

  while ((match = methodRegex.exec(classBody)) !== null) {
    const methodName = match[1];
    const paramsStr = match[2];

    // Skip constructors/destructors with same name as would-be class
    // Skip if it's just a declaration (ends with ;)
    const isDeclaration = match[0].trim().endsWith(';');

    const relativeOffset = match.index;
    const startOffset = classStartOffset + relativeOffset;
    const startLine = fullContent.substring(0, startOffset).split('\n').length;

    let code: string;
    let endOffset: number;

    if (isDeclaration) {
      code = match[0];
      endOffset = startOffset + match[0].length;
    } else {
      const braceStart = classStartOffset + relativeOffset + match[0].length - 1;
      const endBrace = findMatchingBrace(fullContent, braceStart);
      if (endBrace === -1) continue;

      code = fullContent.substring(startOffset, endBrace + 1);
      endOffset = endBrace + 1;
    }

    const endLine = fullContent.substring(0, endOffset).split('\n').length;

    // Extract return type
    const returnTypeMatch = match[0].match(
      /^(?:(?:static|virtual|inline|explicit|constexpr)\s+)*([\w:]+(?:\s*[*&]+)?)\s+\w+/
    );
    const returnType = returnTypeMatch ? returnTypeMatch[1].trim() : 'void';

    const isStatic = /\bstatic\b/.test(match[0]);
    const parameters = parseCppParameters(paramsStr);

    methods.push({
      name: methodName,
      code,
      parameters,
      returnType,
      lineRange: [startLine, endLine],
      isStatic,
      isAsync: false,
      startOffset,
      endOffset,
    });
  }

  return methods;
}

/**
 * Extract fields from C++ class/struct body
 */
function extractCppFields(body: string): DartAST['classes'][0]['properties'] {
  const properties: DartAST['classes'][0]['properties'] = [];
  const seen = new Set<string>();

  // Match field declarations
  const fieldRegex =
    /(?:(?:static|const|mutable)\s+)*([\w:]+(?:\s*[*&]+)?)\s+(\w+)(?:\s*=\s*[^;]+)?;/g;

  let match: RegExpExecArray | null;

  while ((match = fieldRegex.exec(body)) !== null) {
    const type = match[1].trim();
    const name = match[2];

    // Skip if it looks like a method or already seen
    if (seen.has(name) || /\(/.test(match[0])) continue;

    seen.add(name);

    const isStatic = /\bstatic\b/.test(match[0]);
    const isFinal = /\bconst\b/.test(match[0]);

    properties.push({
      name,
      type,
      isFinal,
      isStatic,
    });
  }

  return properties;
}

/**
 * Extract C++ enums
 */
function extractCppEnums(content: string, ast: DartAST): void {
  const enumRegex = /^enum(?:\s+class)?\s+(\w+)(?:\s*:\s*\w+)?\s*\{/gm;

  let match: RegExpExecArray | null;

  while ((match = enumRegex.exec(content)) !== null) {
    const enumName = match[1];
    const startOffset = match.index;
    const startLine = content.substring(0, startOffset).split('\n').length;

    const braceStart = match.index + match[0].length - 1;
    const endBrace = findMatchingBrace(content, braceStart);
    if (endBrace === -1) continue;

    let endOffset = endBrace + 1;
    const afterBrace = content.substring(endBrace + 1);
    const semiMatch = afterBrace.match(/^\s*;/);
    if (semiMatch) {
      endOffset = endBrace + 1 + semiMatch[0].length;
    }

    const code = content.substring(startOffset, endOffset);
    const endLine = content.substring(0, endOffset).split('\n').length;

    ast.constants.push({
      name: enumName,
      code,
      type: 'enum',
      lineRange: [startLine, endLine],
      startOffset,
      endOffset,
    });
  }
}

/**
 * Extract C++ constants (#define and const)
 */
function extractCppConstants(content: string, ast: DartAST): void {
  // #define constants
  const defineRegex = /^#define\s+(\w+)(?:\s+(.+))?$/gm;
  let match: RegExpExecArray | null;

  while ((match = defineRegex.exec(content)) !== null) {
    const name = match[1];
    const value = match[2]?.trim() || '';

    const startOffset = match.index;
    const startLine = content.substring(0, startOffset).split('\n').length;

    ast.constants.push({
      name,
      code: match[0],
      type: 'macro',
      value: value.substring(0, 100),
      lineRange: [startLine, startLine],
      startOffset,
      endOffset: startOffset + match[0].length,
    });
  }

  // const/constexpr constants
  const constRegex = /^(?:static\s+)?(?:const|constexpr)\s+([\w:]+)\s+(\w+)\s*=\s*([^;]+);/gm;

  while ((match = constRegex.exec(content)) !== null) {
    const type = match[1];
    const name = match[2];
    const value = match[3].trim();

    const startOffset = match.index;
    const startLine = content.substring(0, startOffset).split('\n').length;

    ast.constants.push({
      name,
      code: match[0],
      type,
      value: value.substring(0, 100),
      lineRange: [startLine, startLine],
      startOffset,
      endOffset: startOffset + match[0].length,
    });
  }
}

/**
 * Parse C++ function parameters
 */
function parseCppParameters(paramsStr: string): string[] {
  if (!paramsStr.trim()) return [];

  const params: string[] = [];
  let depth = 0;
  let current = '';

  for (const char of paramsStr) {
    if (char === '<' || char === '(' || char === '[') depth++;
    if (char === '>' || char === ')' || char === ']') depth--;

    if (char === ',' && depth === 0) {
      const param = extractCppParamName(current.trim());
      if (param) params.push(param);
      current = '';
    } else {
      current += char;
    }
  }

  const param = extractCppParamName(current.trim());
  if (param) params.push(param);

  return params;
}

/**
 * Extract parameter name from C++ parameter
 */
function extractCppParamName(param: string): string | null {
  if (!param) return null;

  // Remove default value
  const withoutDefault = param.split('=')[0].trim();

  // Extract the last word (parameter name)
  const words = withoutDefault.split(/\s+/);
  if (words.length === 0) return null;

  let name = words[words.length - 1];
  // Remove pointer/reference symbols
  name = name.replace(/^[*&]+/, '');

  return name || null;
}

/**
 * Check if position is inside a class definition
 */
function isInsideClass(beforeMatch: string): boolean {
  // Find last class definition
  const lastClassIndex = beforeMatch.lastIndexOf('class ');
  if (lastClassIndex === -1) return false;

  // Count braces after last class keyword
  const afterLastClass = beforeMatch.substring(lastClassIndex);
  const opens = (afterLastClass.match(/\{/g) || []).length;
  const closes = (afterLastClass.match(/\}/g) || []).length;

  return opens > closes;
}

/**
 * Find matching closing brace
 */
function findMatchingBrace(content: string, startIndex: number): number {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let inLineComment = false;

  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];
    const prevChar = content[i - 1];

    // Handle line comments
    if (!inString && !inComment && char === '/' && nextChar === '/') {
      inLineComment = true;
      continue;
    }
    if (inLineComment && char === '\n') {
      inLineComment = false;
      continue;
    }
    if (inLineComment) continue;

    // Handle block comments
    if (!inString && !inComment && char === '/' && nextChar === '*') {
      inComment = true;
      continue;
    }
    if (inComment && char === '*' && nextChar === '/') {
      inComment = false;
      i++;
      continue;
    }
    if (inComment) continue;

    // Handle strings
    if (!inString && (char === '"' || char === "'") && prevChar !== '\\') {
      inString = true;
      stringChar = char;
      continue;
    }
    if (inString && char === stringChar && prevChar !== '\\') {
      inString = false;
      continue;
    }
    if (inString) continue;

    // Count braces
    if (char === '{') depth++;
    if (char === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

// =============================================================================
// Language Analyzer Registration (Phase 14)
// =============================================================================

/**
 * C language analyzer implementation
 */
export const cAnalyzer: LanguageAnalyzer = {
  language: 'c',
  extensions: ['c', 'h'],
  parserType: 'regex',
  capabilities: C_ANALYZER_CAPABILITIES,

  async analyze(code: string, filePath: string): Promise<DartAST> {
    return parseCFile(code, filePath);
  },

  detectFrameworks(): FrameworkInfo[] {
    return []; // C doesn't have framework detection
  },
};

/**
 * C++ language analyzer implementation
 */
export const cppAnalyzer: LanguageAnalyzer = {
  language: 'cpp',
  extensions: ['cpp', 'cc', 'cxx', 'hpp', 'hxx'],
  parserType: 'regex',
  capabilities: CPP_ANALYZER_CAPABILITIES,

  async analyze(code: string, filePath: string): Promise<DartAST> {
    return parseCppFile(code, filePath);
  },

  detectFrameworks(): FrameworkInfo[] {
    return []; // C++ framework detection could be added later
  },
};

// Register the analyzers
analyzerRegistry.register(cAnalyzer, 10);
analyzerRegistry.register(cppAnalyzer, 10);
