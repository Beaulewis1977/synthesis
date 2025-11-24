/**
 * Kotlin/Java AST Parser using regex-based analysis
 * Produces DartAST-compatible output for seamless integration with existing chunking pipeline
 */

import type { DartAST } from './dart-analyzer.js';

// Regex patterns for Kotlin/Java parsing
const IMPORT_PATTERN = /^import\s+([\w.]+)(?:\s+as\s+(\w+))?;?\s*$/gm;
const PACKAGE_PATTERN = /^package\s+([\w.]+);?\s*$/m;

const FUNCTION_PATTERN =
  /(?:(?:public|private|protected|internal|open|override|suspend|inline|infix|operator|tailrec)\s+)*fun\s+(?:<[^>]+>\s+)?(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^\s{=]+))?/g;

const CLASS_PATTERN =
  /(?:(?:public|private|protected|internal|open|abstract|sealed|data|enum|annotation|inner)\s+)*(?:class|interface|object)\s+(\w+)(?:\s*<[^>]+>)?(?:\s*(?::\s*([^{]+))?)?/g;

const PROPERTY_PATTERN =
  /(?:(?:public|private|protected|internal|open|override|const|lateinit)\s+)*(?:val|var)\s+(\w+)(?:\s*:\s*([^\s=]+))?(?:\s*=\s*([^;\n]+))?/g;

const KDOC_PATTERN = /\/\*\*[\s\S]*?\*\//g;
const SINGLE_COMMENT_PATTERN = /\/\/.*$/gm;

/**
 * Parse a Kotlin/Java file and extract AST information
 */
export function parseKotlinFile(content: string, _filePath: string): DartAST {
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
}

function extractImports(content: string): DartAST['imports'] {
  const imports: DartAST['imports'] = [];
  let match: RegExpExecArray | null;

  IMPORT_PATTERN.lastIndex = 0;

  while ((match = IMPORT_PATTERN.exec(content)) !== null) {
    imports.push({
      uri: match[1],
      prefix: match[2] || undefined,
      show: [],
      hide: [],
    });
  }

  const packageMatch = PACKAGE_PATTERN.exec(content);
  if (packageMatch) {
    imports.unshift({
      uri: `package:${packageMatch[1]}`,
      prefix: undefined,
      show: [],
      hide: [],
    });
  }

  return imports;
}

function extractFunctions(content: string): DartAST['functions'] {
  const functions: DartAST['functions'] = [];
  let match: RegExpExecArray | null;

  const cleanContent = content
    .replace(KDOC_PATTERN, (m) => ' '.repeat(m.length))
    .replace(SINGLE_COMMENT_PATTERN, (m) => ' '.repeat(m.length));

  FUNCTION_PATTERN.lastIndex = 0;

  while ((match = FUNCTION_PATTERN.exec(cleanContent)) !== null) {
    const name = match[1];
    const paramsStr = match[2];
    const returnType = match[3] || 'Unit';
    const startOffset = match.index;
    const endOffset = findFunctionEnd(content, startOffset);
    const code = content.substring(startOffset, endOffset);
    const lineRange = getLineRange(content, startOffset, endOffset);

    functions.push({
      name,
      code,
      parameters: parseParameterNames(paramsStr),
      returnType,
      docComment: extractDocComment(content, startOffset),
      lineRange,
      isAsync: content.substring(Math.max(0, startOffset - 50), startOffset).includes('suspend'),
      isGenerator: false,
      isArrowFunction: code.includes('=') && !code.includes('{'),
      startOffset,
      endOffset,
    });
  }

  return functions;
}

function extractClasses(content: string): DartAST['classes'] {
  const classes: DartAST['classes'] = [];
  let match: RegExpExecArray | null;

  const cleanContent = content
    .replace(KDOC_PATTERN, (m) => ' '.repeat(m.length))
    .replace(SINGLE_COMMENT_PATTERN, (m) => ' '.repeat(m.length));

  CLASS_PATTERN.lastIndex = 0;

  while ((match = CLASS_PATTERN.exec(cleanContent)) !== null) {
    const name = match[1];
    const extendsClause = match[2]?.trim() || null;
    const startOffset = match.index;
    const endOffset = findClassEnd(content, startOffset);
    const code = content.substring(startOffset, endOffset);
    const lineRange = getLineRange(content, startOffset, endOffset);

    let superclass: string | undefined;
    const interfaces: string[] = [];

    if (extendsClause) {
      const parts = extendsClause.split(',').map((p) => p.trim());
      for (const part of parts) {
        const cleanPart = part.split('(')[0].trim();
        if (!superclass) {
          superclass = cleanPart;
        } else {
          interfaces.push(cleanPart);
        }
      }
    }

    const classBody = extractClassBody(content, startOffset);
    const methods = extractMethodsFromClass(classBody, startOffset);
    const properties = extractPropertiesFromClass(classBody);

    classes.push({
      name,
      code,
      methods,
      properties,
      superclass,
      interfaces,
      mixins: [],
      lineRange,
      isAbstract: content.substring(Math.max(0, startOffset - 30), startOffset).includes('abstract'),
      startOffset,
      endOffset,
    });
  }

  return classes;
}

function extractConstants(content: string): DartAST['constants'] {
  const constants: DartAST['constants'] = [];
  let match: RegExpExecArray | null;

  const CONST_PATTERN = /const\s+val\s+(\w+)(?:\s*:\s*(\w+))?\s*=\s*([^;\n]+)/g;

  while ((match = CONST_PATTERN.exec(content)) !== null) {
    const startOffset = match.index;
    const endOffset = startOffset + match[0].length;

    constants.push({
      name: match[1],
      code: match[0],
      type: match[2] || 'Any',
      value: match[3].trim(),
      lineRange: getLineRange(content, startOffset, endOffset),
      startOffset,
      endOffset,
    });
  }

  return constants;
}

function parseParameterNames(paramsStr: string): string[] {
  if (!paramsStr.trim()) return [];
  const params: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of paramsStr) {
    if (char === '<' || char === '(') depth++;
    else if (char === '>' || char === ')') depth--;
    else if (char === ',' && depth === 0) {
      const match = current.trim().match(/(\w+)\s*:/);
      if (match) params.push(match[1]);
      current = '';
      continue;
    }
    current += char;
  }

  if (current.trim()) {
    const match = current.trim().match(/(\w+)\s*:/);
    if (match) params.push(match[1]);
  }

  return params;
}

function findFunctionEnd(content: string, startIndex: number): number {
  let i = startIndex;
  while (i < content.length && content[i] !== '{' && content[i] !== '=') i++;

  if (content[i] === '=') {
    while (i < content.length && content[i] !== '\n') i++;
    return i;
  }

  return findMatchingBrace(content, i);
}

function findClassEnd(content: string, startIndex: number): number {
  let i = startIndex;
  while (i < content.length && content[i] !== '{') i++;
  return findMatchingBrace(content, i);
}

function findMatchingBrace(content: string, startIndex: number): number {
  let depth = 0;
  let i = startIndex;

  while (i < content.length) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }

  return content.length;
}

function extractClassBody(content: string, startIndex: number): string {
  let i = startIndex;
  while (i < content.length && content[i] !== '{') i++;
  const bodyStart = i + 1;
  const bodyEnd = findMatchingBrace(content, i) - 1;
  return content.substring(bodyStart, bodyEnd);
}

function extractMethodsFromClass(classBody: string, classStartOffset: number): DartAST['classes'][0]['methods'] {
  const methods: DartAST['classes'][0]['methods'] = [];
  let match: RegExpExecArray | null;

  FUNCTION_PATTERN.lastIndex = 0;

  while ((match = FUNCTION_PATTERN.exec(classBody)) !== null) {
    const startOffset = classStartOffset + match.index;
    const endOffset = startOffset + match[0].length + 50;

    methods.push({
      name: match[1],
      code: match[0],
      parameters: parseParameterNames(match[2]),
      returnType: match[3] || 'Unit',
      lineRange: getLineRange(classBody, match.index, match.index + match[0].length),
      isStatic: classBody.substring(Math.max(0, match.index - 30), match.index).includes('companion'),
      isAsync: classBody.substring(Math.max(0, match.index - 50), match.index).includes('suspend'),
      startOffset,
      endOffset,
    });
  }

  return methods;
}

function extractPropertiesFromClass(classBody: string): DartAST['classes'][0]['properties'] {
  const properties: DartAST['classes'][0]['properties'] = [];
  let match: RegExpExecArray | null;

  PROPERTY_PATTERN.lastIndex = 0;

  while ((match = PROPERTY_PATTERN.exec(classBody)) !== null) {
    const prefix = classBody.substring(Math.max(0, match.index - 30), match.index);
    properties.push({
      name: match[1],
      type: match[2] || 'Any',
      isFinal: prefix.includes('val'),
      isStatic: prefix.includes('companion') || prefix.includes('const'),
    });
  }

  return properties;
}

function extractDocComment(content: string, position: number): string | undefined {
  const before = content.substring(Math.max(0, position - 500), position);
  const docMatch = before.match(/\/\*\*[\s\S]*?\*\/\s*$/);

  if (docMatch) {
    return docMatch[0]
      .replace(/^\/\*\*\s*/, '')
      .replace(/\s*\*\/$/, '')
      .replace(/^\s*\*\s?/gm, '')
      .trim();
  }

  return undefined;
}

function getLineRange(content: string, startOffset: number, endOffset: number): [number, number] {
  const startLine = content.substring(0, startOffset).split('\n').length;
  const endLine = content.substring(0, endOffset).split('\n').length;
  return [startLine, endLine];
}
