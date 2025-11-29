/**
 * Python AST Parser using regex-based analysis (Phase 14 Enhanced)
 *
 * Produces DartAST-compatible output for seamless integration with existing chunking pipeline.
 * Includes framework detection for FastAPI, Django, Flask, PyTorch, TensorFlow.
 *
 * @module pipeline/python-analyzer
 */

import type { AnalyzerCapabilities, DocumentFramework, FrameworkInfo } from '@synthesis/shared';
import { type LanguageAnalyzer, analyzerRegistry } from './analyzers/registry.js';
import type { DartAST } from './dart-analyzer.js';

// =============================================================================
// Framework Detection (Phase 14)
// =============================================================================

/**
 * Python-specific framework patterns with enhanced detection
 */
const PYTHON_FRAMEWORK_PATTERNS: Record<
  string,
  { patterns: RegExp[]; framework: DocumentFramework }
> = {
  fastapi: {
    framework: 'fastapi',
    patterns: [
      /from\s+fastapi\s+import/,
      /import\s+fastapi/,
      /FastAPI\s*\(/,
      /@(?:app|router)\.(?:get|post|put|delete|patch|options|head)\s*\(/,
      /APIRouter\s*\(/,
      /Depends\s*\(/,
      /HTTPException/,
      /Response\s*\(/,
      /BackgroundTasks/,
    ],
  },
  django: {
    framework: 'django',
    patterns: [
      /from\s+django/,
      /import\s+django/,
      /django\.(?:db|http|views|urls|conf|contrib)/,
      /class\s+\w+\s*\(\s*models\.Model\s*\)/,
      /class\s+\w+\s*\(\s*(?:forms\.Form|forms\.ModelForm)\s*\)/,
      /urlpatterns\s*=/,
      /path\s*\(|re_path\s*\(/,
      /render\s*\(\s*request/,
      /HttpResponse|JsonResponse/,
      /@(?:login_required|permission_required)/,
    ],
  },
  flask: {
    framework: 'flask',
    patterns: [
      /from\s+flask\s+import/,
      /import\s+flask/,
      /Flask\s*\(__name__\)/,
      /@app\.route\s*\(/,
      /@(?:app|blueprint)\.(?:get|post|put|delete)\s*\(/,
      /Blueprint\s*\(/,
      /render_template\s*\(/,
      /request\.(?:args|form|json)/,
      /jsonify\s*\(/,
    ],
  },
  pytorch: {
    framework: 'pytorch',
    patterns: [
      /import\s+torch/,
      /from\s+torch/,
      /torch\.nn/,
      /nn\.Module/,
      /torch\.tensor/,
      /\.cuda\(\)/,
      /\.to\(device\)/,
      /DataLoader/,
      /torch\.optim/,
      /backward\(\)/,
    ],
  },
  tensorflow: {
    framework: 'tensorflow',
    patterns: [
      /import\s+tensorflow/,
      /from\s+tensorflow/,
      /tf\.keras/,
      /tf\.constant/,
      /tf\.Variable/,
      /Model\s*\(/,
      /Sequential\s*\(/,
      /\.compile\s*\(/,
      /\.fit\s*\(/,
      /tf\.data/,
    ],
  },
  supabase: {
    framework: 'supabase',
    patterns: [
      /from\s+supabase\s+import/,
      /import\s+supabase/,
      /create_client\s*\(/,
      /supabase\.(?:table|from_|auth|storage)/,
      /SUPABASE_URL|SUPABASE_KEY/,
    ],
  },
  redis: {
    framework: 'redis',
    patterns: [
      /import\s+redis/,
      /from\s+redis\s+import/,
      /Redis\s*\(/,
      /StrictRedis\s*\(/,
      /redis\.(?:get|set|hget|hset|lpush|rpush)/,
      /REDIS_URL|REDIS_HOST/,
      /aioredis/,
    ],
  },
  postgres: {
    framework: 'postgres',
    patterns: [
      /import\s+psycopg2/,
      /from\s+psycopg2/,
      /import\s+asyncpg/,
      /from\s+asyncpg/,
      /connect\s*\([^)]*(?:postgres|postgresql)/i,
      /DATABASE_URL/,
      /PG_HOST|POSTGRES_HOST/,
    ],
  },
};

/**
 * Detect Python frameworks from code
 */
export function detectPythonFrameworks(code: string, _filePath: string): FrameworkInfo[] {
  const results: FrameworkInfo[] = [];

  for (const [, config] of Object.entries(PYTHON_FRAMEWORK_PATTERNS)) {
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
      // Calculate confidence based on pattern matches
      const confidence = Math.min(matchCount / config.patterns.length, 1);
      results.push({
        name: config.framework,
        confidence,
        indicators: indicators.slice(0, 5), // Limit indicators
      });
    }
  }

  // Sort by confidence descending
  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Python analyzer capabilities
 */
export const PYTHON_ANALYZER_CAPABILITIES: AnalyzerCapabilities = {
  hierarchicalChunking: true,
  frameworkDetection: true,
  importExtraction: true,
  symbolExtraction: true,
  asyncDetection: true,
  decoratorDetection: true,
};

// =============================================================================
// AST Parsing
// =============================================================================

/**
 * Parse Python file using regex-based analysis.
 * Returns DartAST-compatible structure for consistent chunking across languages.
 */
export async function parsePythonFile(content: string, filePath: string): Promise<DartAST> {
  const ast: DartAST = {
    imports: [],
    functions: [],
    classes: [],
    constants: [],
  };

  try {
    // Extract imports
    extractPythonImports(content, ast);

    // Extract functions (top-level)
    extractPythonFunctions(content, ast);

    // Extract classes
    extractPythonClasses(content, ast);

    // Extract top-level constants
    extractPythonConstants(content, ast);

    return ast;
  } catch (error) {
    console.error(`Failed to parse Python file ${filePath}:`, error);
    return ast;
  }
}

/**
 * Extract Python imports
 */
function extractPythonImports(content: string, ast: DartAST): void {
  // Match 'import module' and 'import module as alias'
  const importRegex = /^import\s+([\w.]+)(?:\s+as\s+(\w+))?/gm;
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(content)) !== null) {
    ast.imports.push({
      uri: match[1],
      prefix: match[2],
    });
  }

  // Match 'from module import ...'
  const fromImportRegex = /^from\s+([\w.]+)\s+import\s+(.+)/gm;
  while ((match = fromImportRegex.exec(content)) !== null) {
    const module = match[1];
    const imports = match[2].split(',').map((s) => s.trim().split(' as ')[0].trim());

    for (const imp of imports) {
      if (imp && imp !== '*') {
        ast.imports.push({
          uri: `${module}.${imp}`,
        });
      } else if (imp === '*') {
        ast.imports.push({
          uri: `${module}.*`,
        });
      }
    }
  }
}

/**
 * Extract Python functions (top-level, async)
 */
function extractPythonFunctions(content: string, ast: DartAST): void {
  // Match function definitions with decorators
  const funcRegex =
    /^((?:@[\w.]+(?:\([^)]*\))?\s*\n)*)(async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/gm;

  let match: RegExpExecArray | null;

  while ((match = funcRegex.exec(content)) !== null) {
    const decorators = match[1].trim();
    const isAsync = !!match[2];
    const name = match[3];
    const params = match[4];
    const returnType = match[5]?.trim() || 'None';

    // Skip methods (indented functions)
    const lineStart = content.lastIndexOf('\n', match.index) + 1;
    const indent = match.index - lineStart;
    if (indent > 0) continue;

    const startOffset = match.index;
    const startLine = content.substring(0, startOffset).split('\n').length;
    const body = extractPythonBody(content, match.index + match[0].length);
    const code = match[0] + body;
    const endOffset = startOffset + code.length;
    const endLine = startLine + code.split('\n').length - 1;

    ast.functions.push({
      name,
      code: decorators ? decorators + '\n' + code : code,
      parameters: parsePythonParameterNames(params),
      returnType,
      docComment: extractPythonDocstring(body),
      lineRange: [startLine, endLine],
      isAsync,
      isGenerator: body.includes('yield'),
      startOffset,
      endOffset,
    });
  }
}

/**
 * Extract Python classes
 */
function extractPythonClasses(content: string, ast: DartAST): void {
  // Match class definitions with decorators
  const classRegex = /^((?:@[\w.]+(?:\([^)]*\))?\s*\n)*)class\s+(\w+)(?:\s*\(([^)]*)\))?:/gm;

  let match: RegExpExecArray | null;

  while ((match = classRegex.exec(content)) !== null) {
    const decorators = match[1].trim();
    const name = match[2];
    const bases = match[3]?.trim();

    const startOffset = match.index;
    const startLine = content.substring(0, startOffset).split('\n').length;
    const body = extractPythonBody(content, match.index + match[0].length);
    const code = match[0] + body;
    const endOffset = startOffset + code.length;
    const endLine = startLine + code.split('\n').length - 1;

    // Parse base classes
    const baseList =
      bases
        ?.split(',')
        .map((s) => s.trim().split('(')[0].trim())
        .filter(Boolean) || [];
    const superclass = baseList[0];
    const interfaces = baseList.slice(1);

    // Extract methods from class body
    const methods = extractPythonMethods(body, startOffset + match[0].length);

    // Extract properties from class body
    const properties = extractPythonClassProperties(body);

    ast.classes.push({
      name,
      code: decorators ? decorators + '\n' + code : code,
      methods,
      properties,
      superclass,
      interfaces,
      mixins: [],
      lineRange: [startLine, endLine],
      isAbstract: decorators.includes('@abstractmethod') || bases?.includes('ABC') || false,
      startOffset,
      endOffset,
    });
  }
}

/**
 * Extract methods from a Python class body
 */
function extractPythonMethods(
  classBody: string,
  classStartOffset: number
): DartAST['classes'][0]['methods'] {
  const methods: DartAST['classes'][0]['methods'] = [];
  const methodRegex =
    /^(\s+)((?:@[\w.]+(?:\([^)]*\))?\s*\n\s*)*)(async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/gm;

  let match: RegExpExecArray | null;

  while ((match = methodRegex.exec(classBody)) !== null) {
    const indent = match[1];
    const decorators = match[2].trim();
    const isAsync = !!match[3];
    const name = match[4];
    const params = match[5];
    const returnType = match[6]?.trim() || 'None';

    // Only match first-level methods (4 spaces or 1 tab)
    if (indent.length > 4 && !indent.startsWith('\t')) continue;

    const relativeOffset = match.index;
    const startOffset = classStartOffset + relativeOffset;
    const body = extractPythonBody(classBody, match.index + match[0].length);
    const code = match[0] + body;
    const endOffset = startOffset + code.length;

    const startLine = classBody.substring(0, relativeOffset).split('\n').length;
    const endLine = startLine + code.split('\n').length - 1;

    const isStatic = decorators.includes('@staticmethod') || decorators.includes('@classmethod');

    methods.push({
      name,
      code: decorators ? decorators + '\n' + code : code,
      parameters: parsePythonParameterNames(params),
      returnType,
      lineRange: [startLine, endLine],
      isStatic,
      isAsync,
      startOffset,
      endOffset,
    });
  }

  return methods;
}

/**
 * Extract properties from a Python class body (class variables and __init__ assignments)
 */
function extractPythonClassProperties(classBody: string): DartAST['classes'][0]['properties'] {
  const properties: DartAST['classes'][0]['properties'] = [];
  const seen = new Set<string>();

  // Match class-level variable annotations
  const classVarRegex = /^\s+(\w+)\s*:\s*([^=\n]+)(?:\s*=\s*[^\n]+)?/gm;
  let match: RegExpExecArray | null;

  while ((match = classVarRegex.exec(classBody)) !== null) {
    const name = match[1];
    const type = match[2].trim();

    if (!seen.has(name) && !name.startsWith('_')) {
      seen.add(name);
      properties.push({
        name,
        type,
        isFinal: false,
        isStatic: true, // Class-level variables are like static
      });
    }
  }

  // Match self.x assignments in __init__
  const initMatch = classBody.match(/def\s+__init__\s*\([^)]*\):[^\n]*\n((?:\s+[^\n]+\n)*)/);
  if (initMatch) {
    const initBody = initMatch[1];
    const selfAssignRegex = /self\.(\w+)\s*(?::\s*([^=\n]+))?\s*=/g;

    while ((match = selfAssignRegex.exec(initBody)) !== null) {
      const name = match[1];
      const type = match[2]?.trim() || 'Any';

      if (!seen.has(name) && !name.startsWith('_')) {
        seen.add(name);
        properties.push({
          name,
          type,
          isFinal: false,
          isStatic: false,
        });
      }
    }
  }

  return properties;
}

/**
 * Extract top-level constants (UPPER_CASE variables)
 */
function extractPythonConstants(content: string, ast: DartAST): void {
  // Match top-level assignments that look like constants (UPPER_CASE)
  const constRegex = /^([A-Z][A-Z0-9_]*)\s*(?::\s*([^=\n]+))?\s*=\s*([^\n]+)/gm;

  let match: RegExpExecArray | null;

  while ((match = constRegex.exec(content)) !== null) {
    const name = match[1];
    const type = match[2]?.trim() || 'Any';
    const value = match[3].trim();

    const startOffset = match.index;
    const startLine = content.substring(0, startOffset).split('\n').length;
    const code = match[0];
    const endOffset = startOffset + code.length;

    ast.constants.push({
      name,
      code,
      type,
      value: value.substring(0, 100),
      lineRange: [startLine, startLine],
      startOffset,
      endOffset,
    });
  }
}

/**
 * Extract body of a Python construct (function, class)
 * Uses indentation to determine block boundaries
 */
function extractPythonBody(content: string, startIndex: number): string {
  const lines = content.substring(startIndex).split('\n');
  if (lines.length === 0) return '';

  // Find the base indentation of the first non-empty line
  let baseIndent = -1;
  const bodyLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines at the start
    if (line.trim() === '' && baseIndent === -1) {
      bodyLines.push(line);
      continue;
    }

    // Determine base indentation from first non-empty line
    if (baseIndent === -1) {
      const match = line.match(/^(\s*)/);
      if (match) {
        baseIndent = match[1].length;
      }
      if (baseIndent === 0) {
        // No indentation means we've hit the next top-level construct
        break;
      }
    }

    // Check if this line is still part of the body
    const currentIndent = line.match(/^(\s*)/)?.[1].length || 0;

    if (line.trim() === '') {
      // Empty lines are included
      bodyLines.push(line);
    } else if (currentIndent >= baseIndent) {
      // Indented line is part of body
      bodyLines.push(line);
    } else {
      // Less indented non-empty line means end of body
      break;
    }
  }

  // Remove trailing empty lines
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') {
    bodyLines.pop();
  }

  return '\n' + bodyLines.join('\n');
}

/**
 * Parse Python function parameter names
 */
function parsePythonParameterNames(params: string): string[] {
  if (!params.trim()) return [];

  const result: string[] = [];
  // Split by comma, handling nested parentheses
  let depth = 0;
  let current = '';

  for (const char of params) {
    if (char === '(' || char === '[' || char === '{') depth++;
    if (char === ')' || char === ']' || char === '}') depth--;

    if (char === ',' && depth === 0) {
      const param = current.trim().split(':')[0].split('=')[0].trim();
      if (param && param !== 'self' && param !== 'cls' && !param.startsWith('*')) {
        result.push(param);
      }
      current = '';
    } else {
      current += char;
    }
  }

  // Handle last parameter
  const param = current.trim().split(':')[0].split('=')[0].trim();
  if (param && param !== 'self' && param !== 'cls' && !param.startsWith('*')) {
    result.push(param);
  }

  return result;
}

/**
 * Extract Python docstring from function/class body
 */
function extractPythonDocstring(body: string): string | undefined {
  // Look for triple-quoted string at the start of the body
  const docstringMatch = body.match(/^\s*(?:"""([\s\S]*?)"""|'''([\s\S]*?)''')/);
  if (docstringMatch) {
    return (docstringMatch[1] || docstringMatch[2]).trim();
  }
  return undefined;
}

// =============================================================================
// Language Analyzer Registration (Phase 14)
// =============================================================================

/**
 * Python language analyzer implementation
 */
export const pythonAnalyzer: LanguageAnalyzer = {
  language: 'python',
  extensions: ['py', 'pyw', 'pyi'],
  parserType: 'regex',
  capabilities: PYTHON_ANALYZER_CAPABILITIES,

  async analyze(code: string, filePath: string): Promise<DartAST> {
    return parsePythonFile(code, filePath);
  },

  detectFrameworks(code: string, filePath: string): FrameworkInfo[] {
    return detectPythonFrameworks(code, filePath);
  },
};

// Register the analyzer
analyzerRegistry.register(pythonAnalyzer, 10);
