/**
 * Dart AST Parser - Regex-based extraction for Dart source files
 * Extracts imports, functions, classes, and constants from Dart code
 */

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
      isAsync: boolean;
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
    const prevChar = i > 0 ? content[i - 1] : '';

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
      if (char === "'" && prevChar !== '\\') {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && prevChar !== '\\') {
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
    const prevChar = i > 0 ? paramString[i - 1] : '';

    // Track string state
    if ((char === "'" || char === '"') && prevChar !== '\\') {
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

// Extract imports from Dart source
function extractImports(content: string): DartAST['imports'] {
  const imports: DartAST['imports'] = [];
  // Regex: import 'uri' [as prefix] [show/hide names];
  const importRegex = /import\s+['"]([^'"]+)['"]\s*(?:as\s+(\w+))?\s*(?:(show|hide)\s+([^;]+))?;/g;

  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex pattern
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
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex pattern
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

    // Extract full function code
    const funcCode = content.substring(matchStart, endBrace + 1).trim();

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

    // Skip if inside a class (check if there's a class declaration before this that hasn't closed)
    const beforeFunc = content.substring(0, matchStart);
    const classMatches = beforeFunc.match(/\bclass\s+\w+/g);
    const closingBraces = beforeFunc.match(/^\}/gm);

    // Simple heuristic: if more class declarations than closing braces at column 0, we're inside a class
    const classCount = classMatches?.length || 0;
    const closingCount = closingBraces?.length || 0;

    if (classCount > closingCount) {
      continue; // Inside a class, skip (will be extracted as method)
    }

    functions.push({
      name: funcName,
      code: funcCode,
      parameters,
      returnType,
      docComment,
      lineRange,
      isAsync,
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
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex pattern
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

    const classCode = content.substring(match.index, endBrace + 1).trim();
    const classBody = content.substring(braceIndex + 1, endBrace);

    // Parse mixins and interfaces
    const mixins = mixinsStr ? mixinsStr.split(',').map((m) => m.trim()) : [];
    const interfaces = interfacesStr ? interfacesStr.split(',').map((i) => i.trim()) : [];

    // Extract methods
    const methods: DartAST['classes'][0]['methods'] = [];
    const methodRegex =
      /(static\s+)?(?:Future<[^>]+>|Future|void|\w+(?:<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)\s*(async)?\s*\{/g;

    let methodMatch: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex pattern
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

      const methodCode = content
        .substring(braceIndex + 1 + methodMatch.index, methodBraceEnd + 1)
        .trim();
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
      });
    }

    // Extract properties
    const properties: DartAST['classes'][0]['properties'] = [];
    const propRegex =
      /(static\s+)?(final\s+|const\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*(?:=\s*[^;]+)?;/g;

    let propMatch: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex pattern
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
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex pattern
  while ((match = constRegex.exec(content)) !== null) {
    const matchStart = match.index + match[1].length;
    const type = match[3];
    const name = match[4];
    const value = match[5].trim();

    // Check if inside a class (same heuristic as functions)
    const beforeConst = content.substring(0, matchStart);
    const classMatches = beforeConst.match(/\bclass\s+\w+/g);
    const closingBraces = beforeConst.match(/^\}/gm);

    const classCount = classMatches?.length || 0;
    const closingCount = closingBraces?.length || 0;

    if (classCount > closingCount) {
      continue; // Inside a class, skip
    }

    const code = match[0].trim();
    const lineRange = getLineRange(content, matchStart, match.index + match[0].length);

    constants.push({
      name,
      code,
      type,
      value,
      lineRange,
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
