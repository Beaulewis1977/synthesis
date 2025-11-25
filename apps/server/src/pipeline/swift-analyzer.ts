/**
 * Swift AST Parser using regex-based analysis
 * Produces DartAST-compatible output for seamless integration with existing chunking pipeline
 */

import type { DartAST } from './dart-analyzer.js';

/**
 * Parse Swift file using regex-based analysis.
 * Returns DartAST-compatible structure for consistent chunking across languages.
 */
export async function parseSwiftFile(content: string, filePath: string): Promise<DartAST> {
  const ast: DartAST = {
    imports: [],
    functions: [],
    classes: [],
    constants: [],
  };

  try {
    // Extract imports
    extractSwiftImports(content, ast);

    // Extract functions
    extractSwiftFunctions(content, ast);

    // Extract classes, structs, enums, protocols, extensions
    extractSwiftTypes(content, ast);

    // Extract top-level constants
    extractSwiftConstants(content, ast);

    return ast;
  } catch (error) {
    console.error(`Failed to parse Swift file ${filePath}:`, error);
    return ast;
  }
}

/**
 * Extract Swift imports
 */
function extractSwiftImports(content: string, ast: DartAST): void {
  const importRegex = /^import\s+(\w+)(?:\.(\w+))?/gm;
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(content)) !== null) {
    const module = match[1];
    const submodule = match[2];
    ast.imports.push({
      uri: submodule ? `${module}.${submodule}` : module,
    });
  }
}

/**
 * Extract Swift functions (global, static, class methods)
 */
function extractSwiftFunctions(content: string, ast: DartAST): void {
  // Match function declarations
  const funcRegex =
    /^((?:@\w+\s+)*)((?:private|public|internal|fileprivate|open|final|static|class|override|mutating|nonmutating|async|throws|rethrows|\s)*)\s*func\s+(\w+)(?:<[^>]+>)?\s*\(([^)]*)\)(?:\s*(?:async\s+)?(?:throws\s+)?->\s*([^{]+))?/gm;

  let match: RegExpExecArray | null;

  while ((match = funcRegex.exec(content)) !== null) {
    // const attributes = match[1].trim(); // Reserved for future use
    const modifiers = match[2].trim();
    const name = match[3];
    const params = match[4];
    const returnType = match[5]?.trim() || 'Void';

    const startOffset = match.index;
    const startLine = content.substring(0, startOffset).split('\n').length;
    const body = extractSwiftBody(content, match.index + match[0].length);
    const code = match[0] + body;
    const endOffset = startOffset + code.length;
    const endLine = startLine + code.split('\n').length - 1;

    ast.functions.push({
      name,
      code,
      parameters: parseSwiftParameterNames(params),
      returnType,
      docComment: extractSwiftDocComment(content, startOffset),
      lineRange: [startLine, endLine],
      isAsync: modifiers.includes('async'),
      isGenerator: false,
      startOffset,
      endOffset,
    });
  }
}

/**
 * Extract Swift types (class, struct, enum, protocol, extension)
 */
function extractSwiftTypes(content: string, ast: DartAST): void {
  // Match type declarations
  const typeRegex =
    /^((?:@\w+\s+)*)((?:private|public|internal|fileprivate|open|final|\s)*)\s*(class|struct|enum|protocol|actor)\s+(\w+)(?:<[^>]+>)?(?:\s*:\s*([^{]+))?/gm;

  let match: RegExpExecArray | null;

  while ((match = typeRegex.exec(content)) !== null) {
    // const modifiers = match[2].trim(); // Reserved for future use
    const kind = match[3];
    const name = match[4];
    const inheritance = match[5]?.trim();

    const startOffset = match.index;
    const startLine = content.substring(0, startOffset).split('\n').length;
    const body = extractSwiftBody(content, match.index + match[0].length);
    const code = match[0] + body;
    const endOffset = startOffset + code.length;
    const endLine = startLine + code.split('\n').length - 1;

    // Parse inheritance
    const inheritanceList = inheritance?.split(',').map((s) => s.trim()) || [];
    const superclass = kind === 'class' ? inheritanceList[0] : undefined;
    const interfaces = kind === 'class' ? inheritanceList.slice(1) : inheritanceList;

    // Extract methods from type body
    const methods = extractSwiftMethods(body, startOffset + match[0].length);

    // Extract properties from type body
    const properties = extractSwiftProperties(body);

    ast.classes.push({
      name,
      code,
      methods,
      properties,
      superclass,
      interfaces,
      mixins: [],
      lineRange: [startLine, endLine],
      isAbstract: kind === 'protocol',
      startOffset,
      endOffset,
    });
  }

  // Also extract extensions
  extractSwiftExtensions(content, ast);
}

/**
 * Extract Swift extensions
 */
function extractSwiftExtensions(content: string, ast: DartAST): void {
  const extRegex =
    /^((?:@\w+\s+)*)((?:private|public|internal|fileprivate|\s)*)\s*extension\s+(\w+)(?:<[^>]+>)?(?:\s*:\s*([^{]+))?/gm;

  let match: RegExpExecArray | null;

  while ((match = extRegex.exec(content)) !== null) {
    const name = match[3];
    const protocols = match[4]?.trim();

    const startOffset = match.index;
    const startLine = content.substring(0, startOffset).split('\n').length;
    const body = extractSwiftBody(content, match.index + match[0].length);
    const code = match[0] + body;
    const endOffset = startOffset + code.length;
    const endLine = startLine + code.split('\n').length - 1;

    const methods = extractSwiftMethods(body, startOffset + match[0].length);
    const properties = extractSwiftProperties(body);

    ast.classes.push({
      name: `${name}+Extension`,
      code,
      methods,
      properties,
      superclass: name,
      interfaces: protocols?.split(',').map((s) => s.trim()) || [],
      mixins: [],
      lineRange: [startLine, endLine],
      isAbstract: false,
      startOffset,
      endOffset,
    });
  }
}

/**
 * Extract methods from a Swift type body
 */
function extractSwiftMethods(
  typeBody: string,
  typeStartOffset: number
): DartAST['classes'][0]['methods'] {
  const methods: DartAST['classes'][0]['methods'] = [];
  const methodRegex =
    /^\s+((?:@\w+\s+)*)((?:private|public|internal|fileprivate|open|final|static|class|override|mutating|nonmutating|async|throws|rethrows|\s)*)\s*func\s+(\w+)(?:<[^>]+>)?\s*\(([^)]*)\)(?:\s*(?:async\s+)?(?:throws\s+)?->\s*([^{]+))?/gm;

  let match: RegExpExecArray | null;

  while ((match = methodRegex.exec(typeBody)) !== null) {
    const modifiers = match[2].trim();
    const name = match[3];
    const params = match[4];
    const returnType = match[5]?.trim() || 'Void';

    const relativeOffset = match.index;
    const startOffset = typeStartOffset + relativeOffset;
    const body = extractSwiftBody(typeBody, match.index + match[0].length);
    const code = match[0] + body;
    const endOffset = startOffset + code.length;

    const startLine = typeBody.substring(0, relativeOffset).split('\n').length;
    const endLine = startLine + code.split('\n').length - 1;

    methods.push({
      name,
      code,
      parameters: parseSwiftParameterNames(params),
      returnType,
      lineRange: [startLine, endLine],
      isStatic: modifiers.includes('static') || modifiers.includes('class'),
      isAsync: modifiers.includes('async'),
      startOffset,
      endOffset,
    });
  }

  return methods;
}

/**
 * Extract properties from a Swift type body
 */
function extractSwiftProperties(typeBody: string): DartAST['classes'][0]['properties'] {
  const properties: DartAST['classes'][0]['properties'] = [];
  const propRegex =
    /^\s+((?:@\w+\s+)*)((?:private|public|internal|fileprivate|open|final|static|class|lazy|weak|unowned|\s)*)\s*(let|var)\s+(\w+)(?:\s*:\s*([^={\n]+))?/gm;

  let match: RegExpExecArray | null;

  while ((match = propRegex.exec(typeBody)) !== null) {
    const modifiers = match[2].trim();
    const kind = match[3];
    const name = match[4];
    const type = match[5]?.trim() || 'Any';

    properties.push({
      name,
      type,
      isFinal: kind === 'let',
      isStatic: modifiers.includes('static') || modifiers.includes('class'),
    });
  }

  return properties;
}

/**
 * Extract top-level constants
 */
function extractSwiftConstants(content: string, ast: DartAST): void {
  const constRegex =
    /^((?:private|public|internal|fileprivate|\s)*)\s*(let|var)\s+(\w+)(?:\s*:\s*([^=\n]+))?\s*=\s*([^\n]+)/gm;

  let match: RegExpExecArray | null;

  while ((match = constRegex.exec(content)) !== null) {
    const name = match[3];
    const type = match[4]?.trim() || 'Any';
    const value = match[5].trim();

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
 * Extract body of a Swift construct
 */
function extractSwiftBody(content: string, startIndex: number): string {
  let i = startIndex;

  // Skip whitespace
  while (i < content.length && /\s/.test(content[i])) {
    i++;
  }

  if (content[i] !== '{') {
    return '';
  }

  // Match braces to find the end
  let braceCount = 1;
  let j = i + 1;

  while (j < content.length && braceCount > 0) {
    if (content[j] === '{') braceCount++;
    if (content[j] === '}') braceCount--;
    j++;
  }

  return content.substring(startIndex, j);
}

/**
 * Parse Swift function parameter names
 */
function parseSwiftParameterNames(params: string): string[] {
  if (!params.trim()) return [];

  const result: string[] = [];
  // Swift params: externalName internalName: Type
  const paramRegex = /(?:(\w+)\s+)?(\w+)\s*:/g;

  let match: RegExpExecArray | null;
  while ((match = paramRegex.exec(params)) !== null) {
    // Use internal name (match[2]) or external name if internal is _
    result.push(match[2] === '_' ? match[1] || '_' : match[2]);
  }

  return result;
}

/**
 * Extract Swift doc comment before a declaration
 */
function extractSwiftDocComment(content: string, declarationOffset: number): string | undefined {
  // Look backwards for /// or /** comments
  let i = declarationOffset - 1;

  // Skip whitespace
  while (i >= 0 && /\s/.test(content[i])) {
    i--;
  }

  // Check for doc comments
  const beforeDecl = content.substring(Math.max(0, i - 500), i + 1);

  // Match /// style comments
  const tripleSlashMatch = beforeDecl.match(/((?:\/\/\/[^\n]*\n\s*)+)$/);
  if (tripleSlashMatch) {
    return tripleSlashMatch[1].trim();
  }

  // Match /** */ style comments
  const blockMatch = beforeDecl.match(/\/\*\*[\s\S]*?\*\/\s*$/);
  if (blockMatch) {
    return blockMatch[0].trim();
  }

  return undefined;
}
