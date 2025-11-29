/**
 * Java AST Parser using regex-based analysis (Phase 14)
 *
 * Produces DartAST-compatible output for seamless integration with existing chunking pipeline.
 * Includes framework detection for Spring, Android, and common Java libraries.
 *
 * @module pipeline/java-analyzer
 */

import type { AnalyzerCapabilities, DocumentFramework, FrameworkInfo } from '@synthesis/shared';
import { type LanguageAnalyzer, analyzerRegistry } from './analyzers/registry.js';
import type { DartAST } from './dart-analyzer.js';

// =============================================================================
// Framework Detection (Phase 14)
// =============================================================================

/**
 * Java-specific framework patterns with enhanced detection
 */
const JAVA_FRAMEWORK_PATTERNS: Record<
  string,
  { patterns: RegExp[]; framework: DocumentFramework }
> = {
  spring: {
    framework: 'spring',
    patterns: [
      /import\s+org\.springframework/,
      /@(?:RestController|Controller|Service|Repository|Component)/,
      /@(?:Autowired|Inject|Bean|Configuration)/,
      /@(?:GetMapping|PostMapping|PutMapping|DeleteMapping|RequestMapping)/,
      /@(?:PathVariable|RequestBody|RequestParam)/,
      /SpringApplication\.run/,
      /@SpringBootApplication/,
      /@EnableAutoConfiguration/,
      /ResponseEntity</,
      /@Transactional/,
    ],
  },
  android: {
    framework: 'android',
    patterns: [
      /import\s+android\./,
      /import\s+androidx\./,
      /extends\s+(?:Activity|AppCompatActivity|Fragment|Service)/,
      /extends\s+(?:BroadcastReceiver|ContentProvider)/,
      /@(?:Override|Composable|Preview)/,
      /findViewById\s*\(/,
      /setContentView\s*\(/,
      /Intent\s*\(/,
      /Bundle\s+savedInstanceState/,
      /R\.(?:layout|id|string|drawable)/,
    ],
  },
  supabase: {
    framework: 'supabase',
    patterns: [
      /import\s+io\.supabase/,
      /SupabaseClient/,
      /createClient\s*\(/,
      /\.from\s*\(\s*["']/,
      /SUPABASE_URL|SUPABASE_KEY/,
    ],
  },
  redis: {
    framework: 'redis',
    patterns: [
      /import\s+redis\.clients\.jedis/,
      /import\s+io\.lettuce/,
      /import\s+org\.springframework\.data\.redis/,
      /Jedis\s*\(/,
      /RedisTemplate/,
      /StringRedisTemplate/,
      /@Cacheable|@CacheEvict/,
    ],
  },
  postgres: {
    framework: 'postgres',
    patterns: [
      /import\s+java\.sql/,
      /import\s+org\.postgresql/,
      /DriverManager\.getConnection\s*\([^)]*postgres/i,
      /jdbc:postgresql/,
      /PGConnection|PGStatement/,
      /@Table|@Entity|@Column/,
    ],
  },
};

/**
 * Detect Java frameworks from code
 */
export function detectJavaFrameworks(code: string, _filePath: string): FrameworkInfo[] {
  const results: FrameworkInfo[] = [];

  for (const [, config] of Object.entries(JAVA_FRAMEWORK_PATTERNS)) {
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
 * Java analyzer capabilities
 */
export const JAVA_ANALYZER_CAPABILITIES: AnalyzerCapabilities = {
  hierarchicalChunking: true,
  frameworkDetection: true,
  importExtraction: true,
  symbolExtraction: true,
  asyncDetection: false, // Java uses different async patterns
  decoratorDetection: true, // Annotations
};

// =============================================================================
// AST Parsing
// =============================================================================

/**
 * Parse Java file using regex-based analysis.
 * Returns DartAST-compatible structure for consistent chunking across languages.
 */
export async function parseJavaFile(content: string, filePath: string): Promise<DartAST> {
  const ast: DartAST = {
    imports: [],
    functions: [],
    classes: [],
    constants: [],
  };

  try {
    extractJavaImports(content, ast);
    extractJavaClasses(content, ast);
    extractJavaInterfaces(content, ast);
    extractJavaEnums(content, ast);
    extractJavaConstants(content, ast);

    return ast;
  } catch (error) {
    console.error(`Failed to parse Java file ${filePath}:`, error);
    return ast;
  }
}

/**
 * Extract Java imports
 */
function extractJavaImports(content: string, ast: DartAST): void {
  const importRegex = /^import\s+(?:static\s+)?([\w.]+(?:\.\*)?);/gm;
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(content)) !== null) {
    ast.imports.push({
      uri: match[1],
    });
  }
}

/**
 * Extract Java classes with methods and fields
 */
function extractJavaClasses(content: string, ast: DartAST): void {
  // Match class declarations with annotations
  const classRegex =
    /((?:@\w+(?:\([^)]*\))?\s*\n?\s*)*)(?:public\s+|private\s+|protected\s+)?(?:abstract\s+|final\s+)?class\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+(\w+)(?:<[^>]+>)?)?(?:\s+implements\s+([^{]+))?\s*\{/g;

  let match: RegExpExecArray | null;

  while ((match = classRegex.exec(content)) !== null) {
    const annotations = match[1].trim();
    const className = match[2];
    const superclass = match[3];
    const implementsStr = match[4]?.trim();

    const startOffset = match.index;
    const startLine = content.substring(0, startOffset).split('\n').length;

    // Find matching closing brace
    const braceStart = match.index + match[0].length - 1;
    const endBrace = findMatchingBrace(content, braceStart);
    if (endBrace === -1) continue;

    const classBody = content.substring(braceStart + 1, endBrace);
    const code = content.substring(startOffset, endBrace + 1);
    const endLine = content.substring(0, endBrace + 1).split('\n').length;

    // Parse interfaces
    const interfaces = implementsStr
      ? implementsStr.split(',').map((s) => s.trim().split('<')[0].trim())
      : [];

    // Extract methods
    const methods = extractJavaMethods(classBody, braceStart + 1, content);

    // Extract fields as properties
    const properties = extractJavaFields(classBody);

    // Detect if abstract
    const isAbstract = /\babstract\s+class\b/.test(match[0]);

    ast.classes.push({
      name: className,
      code: annotations ? annotations + '\n' + code : code,
      methods,
      properties,
      superclass,
      interfaces,
      mixins: [],
      lineRange: [startLine, endLine],
      isAbstract,
      startOffset,
      endOffset: endBrace + 1,
    });
  }
}

/**
 * Extract methods from Java class body
 */
function extractJavaMethods(
  classBody: string,
  classStartOffset: number,
  fullContent: string
): DartAST['classes'][0]['methods'] {
  const methods: DartAST['classes'][0]['methods'] = [];

  // Match method declarations with annotations
  const methodRegex =
    /((?:@\w+(?:\([^)]*\))?\s*\n?\s*)*)(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(?:abstract\s+)?(?:<[^>]+>\s+)?(\w+(?:<[^>]+>)?(?:\[\])?)\s+(\w+)\s*\(([^)]*)\)(?:\s+throws\s+[^{;]+)?(?:\s*\{|\s*;)/g;

  let match: RegExpExecArray | null;

  while ((match = methodRegex.exec(classBody)) !== null) {
    const annotations = match[1].trim();
    const returnType = match[2];
    const methodName = match[3];
    const paramsStr = match[4];

    // Skip constructors (return type matches class name pattern)
    if (returnType === methodName) continue;

    const relativeOffset = match.index;
    const startOffset = classStartOffset + relativeOffset;
    const startLine = fullContent.substring(0, startOffset).split('\n').length;

    // Check if abstract (ends with ;) or has body
    const isAbstract = match[0].trim().endsWith(';');
    let code: string;
    let endOffset: number;

    if (isAbstract) {
      code = match[0];
      endOffset = startOffset + match[0].length;
    } else {
      // Find matching brace for method body
      const braceStart = classStartOffset + relativeOffset + match[0].length - 1;
      const endBrace = findMatchingBrace(fullContent, braceStart);
      if (endBrace === -1) continue;

      code = fullContent.substring(startOffset, endBrace + 1);
      endOffset = endBrace + 1;
    }

    const endLine = fullContent.substring(0, endOffset).split('\n').length;

    // Parse parameters
    const parameters = parseJavaParameters(paramsStr);

    // Check for static
    const isStatic = /\bstatic\b/.test(match[0]);

    methods.push({
      name: methodName,
      code: annotations ? annotations + '\n' + code : code,
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
 * Extract fields from Java class body
 */
function extractJavaFields(classBody: string): DartAST['classes'][0]['properties'] {
  const properties: DartAST['classes'][0]['properties'] = [];
  const seen = new Set<string>();

  // Match field declarations
  const fieldRegex =
    /(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:final\s+)?(\w+(?:<[^>]+>)?(?:\[\])?)\s+(\w+)\s*(?:=\s*[^;]+)?;/g;

  let match: RegExpExecArray | null;

  while ((match = fieldRegex.exec(classBody)) !== null) {
    const type = match[1];
    const name = match[2];

    // Skip if it looks like a method call or already seen
    if (seen.has(name) || /\(/.test(match[0])) continue;

    seen.add(name);

    const isStatic = /\bstatic\b/.test(match[0]);
    const isFinal = /\bfinal\b/.test(match[0]);

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
 * Extract Java interfaces
 */
function extractJavaInterfaces(content: string, ast: DartAST): void {
  const interfaceRegex =
    /((?:@\w+(?:\([^)]*\))?\s*\n?\s*)*)(?:public\s+)?interface\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+([^{]+))?\s*\{/g;

  let match: RegExpExecArray | null;

  while ((match = interfaceRegex.exec(content)) !== null) {
    const annotations = match[1].trim();
    const interfaceName = match[2];
    const extendsStr = match[3]?.trim();

    const startOffset = match.index;
    const startLine = content.substring(0, startOffset).split('\n').length;

    const braceStart = match.index + match[0].length - 1;
    const endBrace = findMatchingBrace(content, braceStart);
    if (endBrace === -1) continue;

    const code = content.substring(startOffset, endBrace + 1);
    const endLine = content.substring(0, endBrace + 1).split('\n').length;

    // Parse extended interfaces
    const interfaces = extendsStr
      ? extendsStr.split(',').map((s) => s.trim().split('<')[0].trim())
      : [];

    ast.classes.push({
      name: interfaceName,
      code: annotations ? annotations + '\n' + code : code,
      methods: [],
      properties: [],
      superclass: undefined,
      interfaces,
      mixins: [],
      lineRange: [startLine, endLine],
      isAbstract: true, // Interfaces are abstract by nature
      startOffset,
      endOffset: endBrace + 1,
    });
  }
}

/**
 * Extract Java enums
 */
function extractJavaEnums(content: string, ast: DartAST): void {
  const enumRegex =
    /((?:@\w+(?:\([^)]*\))?\s*\n?\s*)*)(?:public\s+)?enum\s+(\w+)(?:\s+implements\s+([^{]+))?\s*\{/g;

  let match: RegExpExecArray | null;

  while ((match = enumRegex.exec(content)) !== null) {
    const annotations = match[1].trim();
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
      code: annotations ? annotations + '\n' + code : code,
      type: 'enum',
      lineRange: [startLine, endLine],
      startOffset,
      endOffset: endBrace + 1,
    });
  }
}

/**
 * Extract top-level constants (static final fields)
 */
function extractJavaConstants(content: string, ast: DartAST): void {
  // Match public static final fields at class level
  const constRegex =
    /(?:public\s+)?static\s+final\s+(\w+(?:<[^>]+>)?)\s+([A-Z][A-Z0-9_]*)\s*=\s*([^;]+);/g;

  let match: RegExpExecArray | null;

  while ((match = constRegex.exec(content)) !== null) {
    const type = match[1];
    const name = match[2];
    const value = match[3].trim();

    const startOffset = match.index;
    const startLine = content.substring(0, startOffset).split('\n').length;
    const code = match[0];

    ast.constants.push({
      name,
      code,
      type,
      value: value.substring(0, 100),
      lineRange: [startLine, startLine],
      startOffset,
      endOffset: startOffset + code.length,
    });
  }
}

/**
 * Parse Java method parameters
 */
function parseJavaParameters(paramsStr: string): string[] {
  if (!paramsStr.trim()) return [];

  const params: string[] = [];
  let depth = 0;
  let current = '';

  for (const char of paramsStr) {
    if (char === '<' || char === '(' || char === '[') depth++;
    if (char === '>' || char === ')' || char === ']') depth--;

    if (char === ',' && depth === 0) {
      const param = extractParamName(current.trim());
      if (param) params.push(param);
      current = '';
    } else {
      current += char;
    }
  }

  const param = extractParamName(current.trim());
  if (param) params.push(param);

  return params;
}

/**
 * Extract parameter name from Java parameter declaration
 */
function extractParamName(param: string): string | null {
  if (!param) return null;

  // Remove annotations
  const withoutAnnotations = param.replace(/@\w+(?:\([^)]*\))?\s*/g, '');

  // Extract name (last word before any ... or after type)
  const parts = withoutAnnotations.trim().split(/\s+/);
  if (parts.length < 2) return null;

  let name = parts[parts.length - 1];
  // Handle varargs
  name = name.replace(/\.{3}$/, '');

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
      i++; // Skip the /
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
 * Java language analyzer implementation
 */
export const javaAnalyzer: LanguageAnalyzer = {
  language: 'java',
  extensions: ['java'],
  parserType: 'regex',
  capabilities: JAVA_ANALYZER_CAPABILITIES,

  async analyze(code: string, filePath: string): Promise<DartAST> {
    return parseJavaFile(code, filePath);
  },

  detectFrameworks(code: string, filePath: string): FrameworkInfo[] {
    return detectJavaFrameworks(code, filePath);
  },
};

// Register the analyzer
analyzerRegistry.register(javaAnalyzer, 10);
