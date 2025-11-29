/**
 * Go AST Parser using regex-based analysis (Phase 14)
 *
 * Produces DartAST-compatible output for seamless integration with existing chunking pipeline.
 * Includes framework detection for Gin, Echo, and common Go libraries.
 *
 * @module pipeline/go-analyzer
 */

import type { AnalyzerCapabilities, DocumentFramework, FrameworkInfo } from '@synthesis/shared';
import { type LanguageAnalyzer, analyzerRegistry } from './analyzers/registry.js';
import type { DartAST } from './dart-analyzer.js';

// =============================================================================
// Framework Detection (Phase 14)
// =============================================================================

/**
 * Go-specific framework patterns with enhanced detection
 */
const GO_FRAMEWORK_PATTERNS: Record<string, { patterns: RegExp[]; framework: DocumentFramework }> =
  {
    gin: {
      framework: 'gin',
      patterns: [
        /import\s+"github\.com\/gin-gonic\/gin"/,
        /gin\.(?:Default|New)\s*\(\)/,
        /\.(?:GET|POST|PUT|DELETE|PATCH)\s*\(/,
        /gin\.Context/,
        /c\.JSON\s*\(/,
        /c\.Bind\s*\(/,
        /gin\.H\{/,
        /\.Use\s*\(/,
      ],
    },
    echo: {
      framework: 'echo',
      patterns: [
        /import\s+"github\.com\/labstack\/echo/,
        /echo\.New\s*\(\)/,
        /e\.(?:GET|POST|PUT|DELETE|PATCH)\s*\(/,
        /echo\.Context/,
        /c\.JSON\s*\(/,
        /c\.Bind\s*\(/,
        /\.Use\s*\(/,
      ],
    },
    redis: {
      framework: 'redis',
      patterns: [
        /import\s+"github\.com\/(?:go-redis\/redis|redis\/go-redis)/,
        /redis\.NewClient\s*\(/,
        /redis\.Options\{/,
        /\.Get\s*\(ctx,/,
        /\.Set\s*\(ctx,/,
        /\.HGet\s*\(/,
        /\.HSet\s*\(/,
        /REDIS_URL|REDIS_HOST/,
      ],
    },
    postgres: {
      framework: 'postgres',
      patterns: [
        /import\s+"(?:database\/sql|github\.com\/lib\/pq|github\.com\/jackc\/pgx)"/,
        /sql\.Open\s*\(\s*"postgres"/,
        /pgx\.Connect\s*\(/,
        /\.Query\s*\(ctx,/,
        /\.Exec\s*\(ctx,/,
        /DATABASE_URL/,
        /PG_HOST|POSTGRES_HOST/,
      ],
    },
  };

/**
 * Detect Go frameworks from code
 */
export function detectGoFrameworks(code: string, _filePath: string): FrameworkInfo[] {
  const results: FrameworkInfo[] = [];

  for (const [, config] of Object.entries(GO_FRAMEWORK_PATTERNS)) {
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
 * Go analyzer capabilities
 */
export const GO_ANALYZER_CAPABILITIES: AnalyzerCapabilities = {
  hierarchicalChunking: true,
  frameworkDetection: true,
  importExtraction: true,
  symbolExtraction: true,
  asyncDetection: true, // Goroutines
  decoratorDetection: false, // Go doesn't have decorators
};

// =============================================================================
// AST Parsing
// =============================================================================

/**
 * Parse Go file using regex-based analysis.
 * Returns DartAST-compatible structure for consistent chunking across languages.
 */
export async function parseGoFile(content: string, filePath: string): Promise<DartAST> {
  const ast: DartAST = {
    imports: [],
    functions: [],
    classes: [],
    constants: [],
  };

  try {
    extractGoImports(content, ast);
    extractGoFunctions(content, ast);
    extractGoStructs(content, ast);
    extractGoInterfaces(content, ast);
    extractGoConstants(content, ast);

    return ast;
  } catch (error) {
    console.error(`Failed to parse Go file ${filePath}:`, error);
    return ast;
  }
}

/**
 * Extract Go imports
 */
function extractGoImports(content: string, ast: DartAST): void {
  // Single import
  const singleImportRegex = /^import\s+"([^"]+)"/gm;
  let match: RegExpExecArray | null;

  while ((match = singleImportRegex.exec(content)) !== null) {
    ast.imports.push({ uri: match[1] });
  }

  // Import block
  const importBlockRegex = /import\s*\(([\s\S]*?)\)/g;
  while ((match = importBlockRegex.exec(content)) !== null) {
    const block = match[1];
    const importLineRegex = /(?:(\w+)\s+)?"([^"]+)"/g;
    let importMatch: RegExpExecArray | null;

    while ((importMatch = importLineRegex.exec(block)) !== null) {
      ast.imports.push({
        uri: importMatch[2],
        prefix: importMatch[1],
      });
    }
  }
}

/**
 * Extract Go functions
 */
function extractGoFunctions(content: string, ast: DartAST): void {
  // Match function declarations (including methods)
  const funcRegex =
    /^func\s+(?:\(\s*(\w+)\s+\*?(\w+)\s*\)\s+)?(\w+)\s*\(([^)]*)\)(?:\s*\(([^)]*)\)|\s+(\w+(?:\s*,\s*\w+)*))?\s*\{/gm;

  let match: RegExpExecArray | null;

  while ((match = funcRegex.exec(content)) !== null) {
    const receiverType = match[2]; // match[1] is receiver name, unused
    const funcName = match[3];
    const paramsStr = match[4];
    const multiReturnStr = match[5];
    const singleReturnStr = match[6];

    const startOffset = match.index;
    const startLine = content.substring(0, startOffset).split('\n').length;

    // Find matching brace
    const braceStart = match.index + match[0].length - 1;
    const endBrace = findMatchingBrace(content, braceStart);
    if (endBrace === -1) continue;

    const code = content.substring(startOffset, endBrace + 1);
    const endLine = content.substring(0, endBrace + 1).split('\n').length;

    // Parse return type
    let returnType = 'void';
    if (multiReturnStr) {
      returnType = `(${multiReturnStr.trim()})`;
    } else if (singleReturnStr) {
      returnType = singleReturnStr.trim();
    }

    // Parse parameters
    const parameters = parseGoParameters(paramsStr);

    // If it's a method, add to struct's methods later
    // For now, add as function with class_context
    const isMethod = !!receiverType;

    ast.functions.push({
      name: funcName,
      code,
      parameters,
      returnType,
      lineRange: [startLine, endLine],
      isAsync: code.includes('go ') || code.includes('goroutine'),
      isGenerator: false,
      startOffset,
      endOffset: endBrace + 1,
      // Store receiver info in docComment for now
      docComment: isMethod ? `Method of ${receiverType}` : undefined,
    });
  }
}

/**
 * Extract Go structs (mapped to classes)
 */
function extractGoStructs(content: string, ast: DartAST): void {
  const structRegex = /^type\s+(\w+)\s+struct\s*\{/gm;

  let match: RegExpExecArray | null;

  while ((match = structRegex.exec(content)) !== null) {
    const structName = match[1];
    const startOffset = match.index;
    const startLine = content.substring(0, startOffset).split('\n').length;

    const braceStart = match.index + match[0].length - 1;
    const endBrace = findMatchingBrace(content, braceStart);
    if (endBrace === -1) continue;

    const structBody = content.substring(braceStart + 1, endBrace);
    const code = content.substring(startOffset, endBrace + 1);
    const endLine = content.substring(0, endBrace + 1).split('\n').length;

    // Extract fields as properties
    const properties = extractGoStructFields(structBody);

    // Find methods for this struct
    const methods = findGoMethods(content, structName);

    ast.classes.push({
      name: structName,
      code,
      methods,
      properties,
      superclass: undefined,
      interfaces: [],
      mixins: [],
      lineRange: [startLine, endLine],
      isAbstract: false,
      startOffset,
      endOffset: endBrace + 1,
    });
  }
}

/**
 * Extract Go struct fields
 */
function extractGoStructFields(structBody: string): DartAST['classes'][0]['properties'] {
  const properties: DartAST['classes'][0]['properties'] = [];
  const fieldRegex = /^\s*(\w+)\s+(\S+)(?:\s+`[^`]*`)?/gm;

  let match: RegExpExecArray | null;

  while ((match = fieldRegex.exec(structBody)) !== null) {
    const name = match[1];
    const type = match[2];

    // Skip embedded types (single word without explicit name)
    if (name === type) continue;

    properties.push({
      name,
      type,
      isFinal: false,
      isStatic: false,
    });
  }

  return properties;
}

/**
 * Find methods for a Go struct
 */
function findGoMethods(content: string, structName: string): DartAST['classes'][0]['methods'] {
  const methods: DartAST['classes'][0]['methods'] = [];
  const methodRegex = new RegExp(
    `^func\\s+\\(\\s*\\w+\\s+\\*?${structName}\\s*\\)\\s+(\\w+)\\s*\\(([^)]*)\\)(?:\\s*\\(([^)]*)\\)|\\s+(\\w+(?:\\s*,\\s*\\w+)*))?\\s*\\{`,
    'gm'
  );

  let match: RegExpExecArray | null;

  while ((match = methodRegex.exec(content)) !== null) {
    const methodName = match[1];
    const paramsStr = match[2];
    const multiReturnStr = match[3];
    const singleReturnStr = match[4];

    const startOffset = match.index;
    const startLine = content.substring(0, startOffset).split('\n').length;

    const braceStart = match.index + match[0].length - 1;
    const endBrace = findMatchingBrace(content, braceStart);
    if (endBrace === -1) continue;

    const code = content.substring(startOffset, endBrace + 1);
    const endLine = content.substring(0, endBrace + 1).split('\n').length;

    let returnType = 'void';
    if (multiReturnStr) {
      returnType = `(${multiReturnStr.trim()})`;
    } else if (singleReturnStr) {
      returnType = singleReturnStr.trim();
    }

    methods.push({
      name: methodName,
      code,
      parameters: parseGoParameters(paramsStr),
      returnType,
      lineRange: [startLine, endLine],
      isStatic: false,
      isAsync: code.includes('go '),
      startOffset,
      endOffset: endBrace + 1,
    });
  }

  return methods;
}

/**
 * Extract Go interfaces
 */
function extractGoInterfaces(content: string, ast: DartAST): void {
  const interfaceRegex = /^type\s+(\w+)\s+interface\s*\{/gm;

  let match: RegExpExecArray | null;

  while ((match = interfaceRegex.exec(content)) !== null) {
    const interfaceName = match[1];
    const startOffset = match.index;
    const startLine = content.substring(0, startOffset).split('\n').length;

    const braceStart = match.index + match[0].length - 1;
    const endBrace = findMatchingBrace(content, braceStart);
    if (endBrace === -1) continue;

    const code = content.substring(startOffset, endBrace + 1);
    const endLine = content.substring(0, endBrace + 1).split('\n').length;

    ast.classes.push({
      name: interfaceName,
      code,
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
 * Extract Go constants
 */
function extractGoConstants(content: string, ast: DartAST): void {
  // Single const
  const singleConstRegex = /^const\s+(\w+)(?:\s+(\w+))?\s*=\s*([^\n]+)/gm;
  let match: RegExpExecArray | null;

  while ((match = singleConstRegex.exec(content)) !== null) {
    const name = match[1];
    const type = match[2] || 'auto';
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

  // Const block
  const constBlockRegex = /^const\s*\(([\s\S]*?)\)/gm;
  while ((match = constBlockRegex.exec(content)) !== null) {
    const block = match[1];
    const blockStartOffset = match.index;
    const constLineRegex = /^\s*(\w+)(?:\s+(\w+))?\s*=\s*([^\n]+)/gm;
    let constMatch: RegExpExecArray | null;

    while ((constMatch = constLineRegex.exec(block)) !== null) {
      const name = constMatch[1];
      const type = constMatch[2] || 'auto';
      const value = constMatch[3].trim();

      const startOffset = blockStartOffset + constMatch.index;
      const startLine = content.substring(0, startOffset).split('\n').length;

      ast.constants.push({
        name,
        code: constMatch[0].trim(),
        type,
        value: value.substring(0, 100),
        lineRange: [startLine, startLine],
        startOffset,
        endOffset: startOffset + constMatch[0].length,
      });
    }
  }
}

/**
 * Parse Go function parameters
 */
function parseGoParameters(paramsStr: string): string[] {
  if (!paramsStr.trim()) return [];

  const params: string[] = [];
  const parts = paramsStr.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Go parameters can be "name type" or just "type" for multiple same-type params
    const words = trimmed.split(/\s+/);
    if (words.length >= 1) {
      // Take the first word as parameter name
      params.push(words[0]);
    }
  }

  return params;
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
    if (!inString && (char === '"' || char === '`') && prevChar !== '\\') {
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
 * Go language analyzer implementation
 */
export const goAnalyzer: LanguageAnalyzer = {
  language: 'go',
  extensions: ['go'],
  parserType: 'regex',
  capabilities: GO_ANALYZER_CAPABILITIES,

  async analyze(code: string, filePath: string): Promise<DartAST> {
    return parseGoFile(code, filePath);
  },

  detectFrameworks(code: string, filePath: string): FrameworkInfo[] {
    return detectGoFrameworks(code, filePath);
  },
};

// Register the analyzer
analyzerRegistry.register(goAnalyzer, 10);
