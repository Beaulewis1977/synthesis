/**
 * Rust AST Parser using regex-based analysis (Phase 14)
 *
 * Produces DartAST-compatible output for seamless integration with existing chunking pipeline.
 * Includes framework detection for Actix, Tokio, and common Rust libraries.
 *
 * @module pipeline/rust-analyzer
 */

import type { AnalyzerCapabilities, DocumentFramework, FrameworkInfo } from '@synthesis/shared';
import { type LanguageAnalyzer, analyzerRegistry } from './analyzers/registry.js';
import type { DartAST } from './dart-analyzer.js';

// =============================================================================
// Utilities
// =============================================================================

/**
 * Escape special regex characters to prevent ReDoS attacks
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// =============================================================================
// Framework Detection (Phase 14)
// =============================================================================

/**
 * Rust-specific framework patterns with enhanced detection
 */
const RUST_FRAMEWORK_PATTERNS: Record<
  string,
  { patterns: RegExp[]; framework: DocumentFramework }
> = {
  actix: {
    framework: 'actix',
    patterns: [
      /use\s+actix_web/,
      /HttpServer::new/,
      /#\[(?:get|post|put|delete|patch)\s*\(/,
      /#\[actix_web::main\]/,
      /web::(?:Json|Path|Query|Data)/,
      /HttpResponse::/,
      /\.route\s*\(/,
      /App::new\s*\(\)/,
    ],
  },
  tokio: {
    framework: 'tokio',
    patterns: [
      /use\s+tokio/,
      /#\[tokio::main\]/,
      /#\[tokio::test\]/,
      /tokio::spawn/,
      /tokio::time::/,
      /tokio::sync::/,
      /\.await/,
      /async\s+fn/,
    ],
  },
  redis: {
    framework: 'redis',
    patterns: [
      /use\s+redis/,
      /redis::Client/,
      /\.get_connection\s*\(/,
      /redis::cmd\s*\(/,
      /\.set\s*\(/,
      /\.get\s*\(/,
      /REDIS_URL|REDIS_HOST/,
    ],
  },
  postgres: {
    framework: 'postgres',
    patterns: [
      /use\s+(?:tokio_postgres|postgres|sqlx)/,
      /PgPool|PgConnection/,
      /\.connect\s*\(/,
      /\.query\s*\(/,
      /\.execute\s*\(/,
      /DATABASE_URL/,
      /sqlx::query!/,
    ],
  },
};

/**
 * Detect Rust frameworks from code
 */
export function detectRustFrameworks(code: string, _filePath: string): FrameworkInfo[] {
  const results: FrameworkInfo[] = [];

  for (const [, config] of Object.entries(RUST_FRAMEWORK_PATTERNS)) {
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
 * Rust analyzer capabilities
 */
export const RUST_ANALYZER_CAPABILITIES: AnalyzerCapabilities = {
  hierarchicalChunking: true,
  frameworkDetection: true,
  importExtraction: true,
  symbolExtraction: true,
  asyncDetection: true,
  decoratorDetection: true, // Attributes like #[derive]
};

// =============================================================================
// AST Parsing
// =============================================================================

/**
 * Parse Rust file using regex-based analysis.
 * Returns DartAST-compatible structure for consistent chunking across languages.
 */
export async function parseRustFile(content: string, filePath: string): Promise<DartAST> {
  const ast: DartAST = {
    imports: [],
    functions: [],
    classes: [],
    constants: [],
  };

  try {
    extractRustImports(content, ast);
    extractRustFunctions(content, ast);
    extractRustStructs(content, ast);
    extractRustEnums(content, ast);
    extractRustTraits(content, ast);
    extractRustConstants(content, ast);

    return ast;
  } catch (error) {
    console.error(`Failed to parse Rust file ${filePath}:`, error);
    return ast;
  }
}

/**
 * Extract Rust use statements
 */
function extractRustImports(content: string, ast: DartAST): void {
  const useRegex = /^use\s+([^;]+);/gm;
  let match: RegExpExecArray | null;

  while ((match = useRegex.exec(content)) !== null) {
    const usePath = match[1].trim();
    ast.imports.push({ uri: usePath });
  }
}

/**
 * Extract Rust functions
 */
function extractRustFunctions(content: string, ast: DartAST): void {
  // Match function declarations with attributes
  const funcRegex =
    /((?:#\[[^\]]+\]\s*\n?\s*)*)(?:pub\s+)?(?:async\s+)?fn\s+(\w+)(?:<[^>]+>)?\s*\(([^)]*)\)(?:\s*->\s*([^{]+))?\s*(?:where[^{]+)?\{/g;

  let match: RegExpExecArray | null;

  while ((match = funcRegex.exec(content)) !== null) {
    const attributes = match[1].trim();
    const funcName = match[2];
    const paramsStr = match[3];
    const returnType = match[4]?.trim() || '()';

    // Skip impl block methods (they'll be extracted with structs)
    const beforeMatch = content.substring(0, match.index);
    if (/impl\s+(?:<[^>]+>\s*)?\w+[^{]*\{\s*$/.test(beforeMatch.slice(-100))) {
      continue;
    }

    const startOffset = match.index;
    const startLine = content.substring(0, startOffset).split('\n').length;

    const braceStart = match.index + match[0].length - 1;
    const endBrace = findMatchingBrace(content, braceStart);
    if (endBrace === -1) continue;

    const code = content.substring(startOffset, endBrace + 1);
    const endLine = content.substring(0, endBrace + 1).split('\n').length;

    const isAsync = /\basync\s+fn\b/.test(match[0]);
    const parameters = parseRustParameters(paramsStr);

    ast.functions.push({
      name: funcName,
      code: attributes ? attributes + '\n' + code : code,
      parameters,
      returnType,
      lineRange: [startLine, endLine],
      isAsync,
      isGenerator: false,
      startOffset,
      endOffset: endBrace + 1,
    });
  }
}

/**
 * Extract Rust structs with impl blocks
 */
function extractRustStructs(content: string, ast: DartAST): void {
  const structRegex =
    /((?:#\[[^\]]+\]\s*\n?\s*)*)(?:pub\s+)?struct\s+(\w+)(?:<[^>]+>)?(?:\s*\([^)]*\))?(?:\s*where[^{;]+)?\s*(?:\{|;)/g;

  let match: RegExpExecArray | null;

  while ((match = structRegex.exec(content)) !== null) {
    const attributes = match[1].trim();
    const structName = match[2];
    const startOffset = match.index;
    const startLine = content.substring(0, startOffset).split('\n').length;

    let code: string;
    let endOffset: number;
    let endLine: number;
    const properties: DartAST['classes'][0]['properties'] = [];

    // Check if it's a tuple struct (ends with ;) or regular struct (ends with {)
    if (match[0].trim().endsWith(';')) {
      code = match[0];
      endOffset = startOffset + match[0].length;
      endLine = startLine;
    } else {
      const braceStart = match.index + match[0].length - 1;
      const endBrace = findMatchingBrace(content, braceStart);
      if (endBrace === -1) continue;

      const structBody = content.substring(braceStart + 1, endBrace);
      code = content.substring(startOffset, endBrace + 1);
      endOffset = endBrace + 1;
      endLine = content.substring(0, endBrace + 1).split('\n').length;

      // Extract fields
      const fieldRegex = /(?:pub\s+)?(\w+)\s*:\s*([^,}]+)/g;
      let fieldMatch: RegExpExecArray | null;

      while ((fieldMatch = fieldRegex.exec(structBody)) !== null) {
        properties.push({
          name: fieldMatch[1],
          type: fieldMatch[2].trim(),
          isFinal: false,
          isStatic: false,
        });
      }
    }

    // Find impl blocks for this struct
    const methods = findRustImplMethods(content, structName);

    ast.classes.push({
      name: structName,
      code: attributes ? attributes + '\n' + code : code,
      methods,
      properties,
      superclass: undefined,
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
 * Find impl block methods for a Rust struct
 */
function findRustImplMethods(
  content: string,
  structName: string
): DartAST['classes'][0]['methods'] {
  const methods: DartAST['classes'][0]['methods'] = [];

  // Escape structName to prevent ReDoS attacks
  const escapedName = escapeRegex(structName);

  // Find impl blocks for this struct
  const implRegex = new RegExp(
    `impl(?:<[^>]+>)?\\s+(?:${escapedName}|\\w+\\s+for\\s+${escapedName})(?:<[^>]+>)?(?:\\s+where[^{]+)?\\s*\\{`,
    'g'
  );

  let implMatch: RegExpExecArray | null;

  while ((implMatch = implRegex.exec(content)) !== null) {
    const implStart = implMatch.index + implMatch[0].length - 1;
    const implEnd = findMatchingBrace(content, implStart);
    if (implEnd === -1) continue;

    const implBody = content.substring(implStart + 1, implEnd);

    // Extract methods from impl block
    const methodRegex =
      /((?:#\[[^\]]+\]\s*\n?\s*)*)(?:pub\s+)?(?:async\s+)?fn\s+(\w+)(?:<[^>]+>)?\s*\(([^)]*)\)(?:\s*->\s*([^{]+))?\s*(?:where[^{]+)?\{/g;

    let methodMatch: RegExpExecArray | null;

    while ((methodMatch = methodRegex.exec(implBody)) !== null) {
      const attributes = methodMatch[1].trim();
      const methodName = methodMatch[2];
      const paramsStr = methodMatch[3];
      const returnType = methodMatch[4]?.trim() || '()';

      const relativeOffset = methodMatch.index;
      const startOffset = implStart + 1 + relativeOffset;
      const startLine = content.substring(0, startOffset).split('\n').length;

      const braceStart = implStart + 1 + relativeOffset + methodMatch[0].length - 1;
      const endBrace = findMatchingBrace(content, braceStart);
      if (endBrace === -1) continue;

      const code = content.substring(startOffset, endBrace + 1);
      const endLine = content.substring(0, endBrace + 1).split('\n').length;

      const isAsync = /\basync\s+fn\b/.test(methodMatch[0]);
      // Static detection: check for absence of self/&self/&mut self as first parameter
      // This properly handles associated functions vs instance methods
      const isStatic = !/^\s*(?:&\s*)?(?:mut\s+)?self\b/.test(paramsStr);
      const parameters = parseRustParameters(paramsStr);

      methods.push({
        name: methodName,
        code: attributes ? attributes + '\n' + code : code,
        parameters,
        returnType,
        lineRange: [startLine, endLine],
        isStatic,
        isAsync,
        startOffset,
        endOffset: endBrace + 1,
      });
    }
  }

  return methods;
}

/**
 * Extract Rust enums
 */
function extractRustEnums(content: string, ast: DartAST): void {
  const enumRegex = /((?:#\[[^\]]+\]\s*\n?\s*)*)(?:pub\s+)?enum\s+(\w+)(?:<[^>]+>)?\s*\{/g;

  let match: RegExpExecArray | null;

  while ((match = enumRegex.exec(content)) !== null) {
    const attributes = match[1].trim();
    const enumName = match[2];
    const startOffset = match.index;
    const startLine = content.substring(0, startOffset).split('\n').length;

    const braceStart = match.index + match[0].length - 1;
    const endBrace = findMatchingBrace(content, braceStart);
    if (endBrace === -1) continue;

    const code = content.substring(startOffset, endBrace + 1);
    const endLine = content.substring(0, endBrace + 1).split('\n').length;

    ast.constants.push({
      name: enumName,
      code: attributes ? attributes + '\n' + code : code,
      type: 'enum',
      lineRange: [startLine, endLine],
      startOffset,
      endOffset: endBrace + 1,
    });
  }
}

/**
 * Extract Rust traits (mapped to abstract classes)
 */
function extractRustTraits(content: string, ast: DartAST): void {
  const traitRegex =
    /((?:#\[[^\]]+\]\s*\n?\s*)*)(?:pub\s+)?trait\s+(\w+)(?:<[^>]+>)?(?:\s*:\s*[^{]+)?\s*\{/g;

  let match: RegExpExecArray | null;

  while ((match = traitRegex.exec(content)) !== null) {
    const attributes = match[1].trim();
    const traitName = match[2];
    const startOffset = match.index;
    const startLine = content.substring(0, startOffset).split('\n').length;

    const braceStart = match.index + match[0].length - 1;
    const endBrace = findMatchingBrace(content, braceStart);
    if (endBrace === -1) continue;

    const code = content.substring(startOffset, endBrace + 1);
    const endLine = content.substring(0, endBrace + 1).split('\n').length;

    ast.classes.push({
      name: traitName,
      code: attributes ? attributes + '\n' + code : code,
      methods: [],
      properties: [],
      superclass: undefined,
      interfaces: [],
      mixins: [],
      lineRange: [startLine, endLine],
      isAbstract: true,
      startOffset,
      endOffset: endBrace + 1,
    });
  }
}

/**
 * Extract Rust constants
 */
function extractRustConstants(content: string, ast: DartAST): void {
  const constRegex = /(?:pub\s+)?(?:const|static)\s+(\w+)\s*:\s*([^=]+)\s*=\s*([^;]+);/g;

  let match: RegExpExecArray | null;

  while ((match = constRegex.exec(content)) !== null) {
    const name = match[1];
    const type = match[2].trim();
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
 * Parse Rust function parameters
 */
function parseRustParameters(paramsStr: string): string[] {
  if (!paramsStr.trim()) return [];

  const params: string[] = [];
  let depth = 0;
  let current = '';

  for (const char of paramsStr) {
    if (char === '<' || char === '(' || char === '[' || char === '{') depth++;
    if (char === '>' || char === ')' || char === ']' || char === '}') depth--;

    if (char === ',' && depth === 0) {
      const param = extractRustParamName(current.trim());
      if (param) params.push(param);
      current = '';
    } else {
      current += char;
    }
  }

  const param = extractRustParamName(current.trim());
  if (param) params.push(param);

  return params;
}

/**
 * Extract parameter name from Rust parameter
 */
function extractRustParamName(param: string): string | null {
  if (!param) return null;

  // Skip self parameters
  if (/^&?\s*(?:mut\s+)?self$/.test(param)) return null;

  // Extract name before colon
  const colonIndex = param.indexOf(':');
  if (colonIndex === -1) return null;

  let name = param.substring(0, colonIndex).trim();
  // Remove mut keyword
  name = name.replace(/^mut\s+/, '');

  return name || null;
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

    // Handle strings (including raw strings)
    if (!inString && char === '"' && prevChar !== '\\') {
      inString = true;
      stringChar = '"';
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
 * Rust language analyzer implementation
 */
export const rustAnalyzer: LanguageAnalyzer = {
  language: 'rust',
  extensions: ['rs'],
  parserType: 'regex',
  capabilities: RUST_ANALYZER_CAPABILITIES,

  async analyze(code: string, filePath: string): Promise<DartAST> {
    return parseRustFile(code, filePath);
  },

  detectFrameworks(code: string, filePath: string): FrameworkInfo[] {
    return detectRustFrameworks(code, filePath);
  },
};

// Register the analyzer
analyzerRegistry.register(rustAnalyzer, 10);
