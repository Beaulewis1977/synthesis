/**
 * TypeScript/JavaScript AST Parser using TypeScript Compiler API
 * Produces DartAST-compatible output for seamless integration with existing chunking pipeline
 */

import ts from 'typescript';
import type { DartAST } from './dart-analyzer.js';

/**
 * Parse TypeScript/JavaScript file using TypeScript Compiler API.
 * Returns DartAST-compatible structure for consistent chunking across languages.
 */
export async function parseTypeScriptFile(content: string, filePath: string): Promise<DartAST> {
  const ast: DartAST = {
    imports: [],
    functions: [],
    classes: [],
    constants: [],
  };

  try {
    // Determine script kind based on file extension
    let scriptKind: ts.ScriptKind;
    if (filePath.endsWith('.tsx')) {
      scriptKind = ts.ScriptKind.TSX;
    } else if (filePath.endsWith('.jsx')) {
      scriptKind = ts.ScriptKind.JSX;
    } else if (filePath.endsWith('.js')) {
      scriptKind = ts.ScriptKind.JS;
    } else {
      scriptKind = ts.ScriptKind.TS;
    }

    // Create source file with TypeScript Compiler API
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true, // setParentNodes
      scriptKind
    );

    // Visit all top-level nodes
    ts.forEachChild(sourceFile, (node) => visitNode(node, sourceFile, content, ast));

    return ast;
  } catch (error) {
    console.error(`Failed to parse ${filePath}:`, error);
    // Return partial AST on error
    return ast;
  }
}

/**
 * Visit AST node and extract relevant information
 */
function visitNode(node: ts.Node, sourceFile: ts.SourceFile, content: string, ast: DartAST): void {
  try {
    // Extract imports
    if (ts.isImportDeclaration(node)) {
      extractImport(node, sourceFile, ast);
    }

    // Extract function declarations
    if (ts.isFunctionDeclaration(node)) {
      extractFunction(node, sourceFile, content, ast);
    }

    // Extract arrow functions from variable declarations
    if (ts.isVariableStatement(node)) {
      extractVariableDeclarations(node, sourceFile, content, ast);
    }

    // Extract class declarations
    if (ts.isClassDeclaration(node)) {
      extractClass(node, sourceFile, content, ast);
    }

    // Extract interfaces and type aliases
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      extractTypeDeclaration(node, sourceFile, content, ast);
    }

    // Extract enums
    if (ts.isEnumDeclaration(node)) {
      extractEnum(node, sourceFile, content, ast);
    }
  } catch (error) {
    console.error('Error visiting node:', error);
    // Continue parsing other nodes
  }
}

/**
 * Extract import statement
 */
function extractImport(node: ts.ImportDeclaration, _sourceFile: ts.SourceFile, ast: DartAST): void {
  const moduleSpecifier = node.moduleSpecifier;

  if (!ts.isStringLiteral(moduleSpecifier)) {
    return;
  }

  const uri = moduleSpecifier.text;
  const importEntry: DartAST['imports'][0] = { uri };

  const importClause = node.importClause;
  if (importClause) {
    // Default import: import Foo from 'module'
    if (importClause.name) {
      importEntry.show = [importClause.name.text];
    }

    // Named imports: import { a, b } from 'module'
    if (importClause.namedBindings) {
      if (ts.isNamedImports(importClause.namedBindings)) {
        const names = importClause.namedBindings.elements.map((el) => {
          return el.propertyName ? el.propertyName.text : el.name.text;
        });

        if (importEntry.show) {
          importEntry.show.push(...names);
        } else {
          importEntry.show = names;
        }
      }

      // Namespace import: import * as foo from 'module'
      if (ts.isNamespaceImport(importClause.namedBindings)) {
        importEntry.prefix = importClause.namedBindings.name.text;
      }
    }
  } else {
    // Side-effect import: import 'module'
    // No additional metadata needed
  }

  ast.imports.push(importEntry);
}

/**
 * Extract function declaration
 */
function extractFunction(
  node: ts.FunctionDeclaration,
  sourceFile: ts.SourceFile,
  content: string,
  ast: DartAST
): void {
  if (!node.name) {
    return; // Skip anonymous functions
  }

  const name = node.name.text;
  const startPos = node.getStart(sourceFile);
  const endPos = node.getEnd();
  const code = content.substring(startPos, endPos);

  const parameters = node.parameters.map((p) => p.getText(sourceFile));
  const returnType = node.type ? node.type.getText(sourceFile) : 'void';

  const lineRange = getLineRange(sourceFile, startPos, endPos);
  const docComment = extractJSDoc(node, sourceFile);

  const isAsync = hasModifier(node, ts.SyntaxKind.AsyncKeyword);
  const isGenerator = node.asteriskToken !== undefined;

  ast.functions.push({
    name,
    code,
    parameters,
    returnType,
    docComment,
    lineRange,
    isAsync,
    isGenerator,
    startOffset: startPos,
    endOffset: endPos,
  });
}

/**
 * Extract variable declarations (includes arrow functions and require() imports)
 */
function extractVariableDeclarations(
  node: ts.VariableStatement,
  sourceFile: ts.SourceFile,
  content: string,
  ast: DartAST
): void {
  // biome-ignore lint/complexity/noForEach: TypeScript AST API iteration pattern
  node.declarationList.declarations.forEach((decl) => {
    if (!decl.initializer) {
      return;
    }

    const name = decl.name.getText(sourceFile);

    // Check for CommonJS require: const x = require('module')
    if (ts.isCallExpression(decl.initializer)) {
      const callExpr = decl.initializer;
      if (
        ts.isIdentifier(callExpr.expression) &&
        callExpr.expression.text === 'require' &&
        callExpr.arguments.length === 1
      ) {
        const arg = callExpr.arguments[0];
        if (ts.isStringLiteral(arg)) {
          ast.imports.push({
            uri: arg.text,
            prefix: name,
          });
          return; // Don't process as constant
        }
      }
    }

    // Arrow function: const foo = () => {}
    if (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) {
      const funcNode = decl.initializer;
      const startPos = node.getStart(sourceFile);
      const endPos = node.getEnd();
      const code = content.substring(startPos, endPos);

      const parameters = funcNode.parameters.map((p) => p.getText(sourceFile));
      const returnType = funcNode.type ? funcNode.type.getText(sourceFile) : 'any';

      const lineRange = getLineRange(sourceFile, startPos, endPos);
      const docComment = extractJSDoc(node, sourceFile);

      const isAsync = hasModifier(funcNode, ts.SyntaxKind.AsyncKeyword);
      const isArrow = ts.isArrowFunction(funcNode);
      const isGenerator = ts.isFunctionExpression(funcNode)
        ? funcNode.asteriskToken !== undefined
        : false;

      ast.functions.push({
        name,
        code,
        parameters,
        returnType,
        docComment,
        lineRange,
        isAsync,
        isGenerator,
        isArrowFunction: isArrow,
        startOffset: startPos,
        endOffset: endPos,
      });
    }
    // Constants and exported values
    else {
      const startPos = node.getStart(sourceFile);
      const endPos = node.getEnd();
      const code = content.substring(startPos, endPos);

      const type = decl.type ? decl.type.getText(sourceFile) : 'any';
      const lineRange = getLineRange(sourceFile, startPos, endPos);

      // Extract initializer value if present
      const value = decl.initializer ? decl.initializer.getText(sourceFile) : undefined;

      ast.constants.push({
        name,
        code,
        type,
        value,
        lineRange,
        startOffset: startPos,
        endOffset: endPos,
      });
    }
  });
}

/**
 * Extract class declaration
 */
function extractClass(
  node: ts.ClassDeclaration,
  sourceFile: ts.SourceFile,
  content: string,
  ast: DartAST
): void {
  if (!node.name) {
    return; // Skip anonymous classes
  }

  const className = node.name.text;
  const startPos = node.getStart(sourceFile);
  const endPos = node.getEnd();
  const code = content.substring(startPos, endPos);

  const lineRange = getLineRange(sourceFile, startPos, endPos);
  const isAbstract = hasModifier(node, ts.SyntaxKind.AbstractKeyword);

  // Extract heritage (extends/implements)
  let superclass: string | undefined;
  const interfaces: string[] = [];

  if (node.heritageClauses) {
    for (const heritage of node.heritageClauses) {
      if (heritage.token === ts.SyntaxKind.ExtendsKeyword) {
        superclass = heritage.types[0]?.expression.getText(sourceFile);
      } else if (heritage.token === ts.SyntaxKind.ImplementsKeyword) {
        interfaces.push(...heritage.types.map((t) => t.expression.getText(sourceFile)));
      }
    }
  }

  // Extract methods and properties
  const methods: DartAST['classes'][0]['methods'] = [];
  const properties: DartAST['classes'][0]['properties'] = [];

  // biome-ignore lint/complexity/noForEach: TypeScript AST API uses callbacks
  node.members.forEach((member) => {
    // Method declarations
    if (ts.isMethodDeclaration(member)) {
      if (!member.name || member.name.getText(sourceFile) === 'constructor') {
        return; // Skip constructor
      }

      // Skip abstract methods (they have no body)
      const isAbstract = hasModifier(member, ts.SyntaxKind.AbstractKeyword);
      if (isAbstract) {
        return;
      }

      const methodName = member.name.getText(sourceFile);
      const methodStartPos = member.getStart(sourceFile);
      const methodEndPos = member.getEnd();
      const methodCode = content.substring(methodStartPos, methodEndPos);

      const parameters = member.parameters.map((p) => p.getText(sourceFile));
      const returnType = member.type ? member.type.getText(sourceFile) : 'void';

      const methodLineRange = getLineRange(sourceFile, methodStartPos, methodEndPos);
      const isStatic = hasModifier(member, ts.SyntaxKind.StaticKeyword);
      const isAsync = hasModifier(member, ts.SyntaxKind.AsyncKeyword);

      methods.push({
        name: methodName,
        code: methodCode,
        parameters,
        returnType,
        lineRange: methodLineRange,
        isStatic,
        isAsync,
        startOffset: methodStartPos,
        endOffset: methodEndPos,
      });
    }

    // Property declarations (including arrow function properties)
    if (ts.isPropertyDeclaration(member)) {
      const propName = member.name.getText(sourceFile);
      const isStatic = hasModifier(member, ts.SyntaxKind.StaticKeyword);
      const isReadonly = hasModifier(member, ts.SyntaxKind.ReadonlyKeyword);

      // Check if property is an arrow function (method)
      if (member.initializer && ts.isArrowFunction(member.initializer)) {
        const methodStartPos = member.getStart(sourceFile);
        const methodEndPos = member.getEnd();
        const methodCode = content.substring(methodStartPos, methodEndPos);

        const parameters = member.initializer.parameters.map((p) => p.getText(sourceFile));
        const returnType = member.initializer.type
          ? member.initializer.type.getText(sourceFile)
          : 'any';

        const methodLineRange = getLineRange(sourceFile, methodStartPos, methodEndPos);
        const isAsync = hasModifier(member.initializer, ts.SyntaxKind.AsyncKeyword);

        methods.push({
          name: propName,
          code: methodCode,
          parameters,
          returnType,
          lineRange: methodLineRange,
          isStatic,
          isAsync,
          startOffset: methodStartPos,
          endOffset: methodEndPos,
        });
      } else {
        // Regular property
        const type = member.type ? member.type.getText(sourceFile) : 'any';

        properties.push({
          name: propName,
          type,
          isFinal: isReadonly,
          isStatic,
        });
      }
    }

    // Getter/Setter
    if (ts.isGetAccessor(member) || ts.isSetAccessor(member)) {
      const accessorName = member.name.getText(sourceFile);
      const prefix = ts.isGetAccessor(member) ? 'get' : 'set';
      const fullName = `${prefix} ${accessorName}`;

      const methodStartPos = member.getStart(sourceFile);
      const methodEndPos = member.getEnd();
      const methodCode = content.substring(methodStartPos, methodEndPos);

      const parameters = member.parameters.map((p) => p.getText(sourceFile));
      const returnType = member.type ? member.type.getText(sourceFile) : 'any';

      const methodLineRange = getLineRange(sourceFile, methodStartPos, methodEndPos);
      const isStatic = hasModifier(member, ts.SyntaxKind.StaticKeyword);

      methods.push({
        name: fullName,
        code: methodCode,
        parameters,
        returnType,
        lineRange: methodLineRange,
        isStatic,
        isAsync: false,
        startOffset: methodStartPos,
        endOffset: methodEndPos,
      });
    }
  });

  ast.classes.push({
    name: className,
    code,
    methods,
    properties,
    superclass,
    interfaces,
    mixins: [], // TypeScript doesn't have mixins
    lineRange,
    isAbstract,
    startOffset: startPos,
    endOffset: endPos,
  });
}

/**
 * Extract interface or type alias as a constant
 */
function extractTypeDeclaration(
  node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration,
  sourceFile: ts.SourceFile,
  content: string,
  ast: DartAST
): void {
  const name = node.name.text;
  const startPos = node.getStart(sourceFile);
  const endPos = node.getEnd();
  const code = content.substring(startPos, endPos);

  const lineRange = getLineRange(sourceFile, startPos, endPos);
  const type = ts.isInterfaceDeclaration(node) ? 'interface' : 'type';

  ast.constants.push({
    name,
    code,
    type,
    lineRange,
    startOffset: startPos,
    endOffset: endPos,
  });
}

/**
 * Extract enum declaration as a constant
 */
function extractEnum(
  node: ts.EnumDeclaration,
  sourceFile: ts.SourceFile,
  content: string,
  ast: DartAST
): void {
  const name = node.name.text;
  const startPos = node.getStart(sourceFile);
  const endPos = node.getEnd();
  const code = content.substring(startPos, endPos);

  const lineRange = getLineRange(sourceFile, startPos, endPos);

  ast.constants.push({
    name,
    code,
    type: 'enum',
    lineRange,
    startOffset: startPos,
    endOffset: endPos,
  });
}

/**
 * Get line range for a node
 */
function getLineRange(
  sourceFile: ts.SourceFile,
  startPos: number,
  endPos: number
): [number, number] {
  const startLine = sourceFile.getLineAndCharacterOfPosition(startPos).line + 1;
  const endLine = sourceFile.getLineAndCharacterOfPosition(endPos).line + 1;
  return [startLine, endLine];
}

/**
 * Check if node has a specific modifier
 */
function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  if (!ts.canHaveModifiers(node)) {
    return false;
  }

  const modifiers = ts.getModifiers(node);
  if (!modifiers) {
    return false;
  }

  return modifiers.some((m) => m.kind === kind);
}

/**
 * Extract JSDoc comment from node
 */
function extractJSDoc(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
  // Try to get the full JSDoc comment text
  const fullText = sourceFile.getFullText();
  const nodeStart = node.getFullStart();
  const commentRanges = ts.getLeadingCommentRanges(fullText, nodeStart);

  if (!commentRanges || commentRanges.length === 0) {
    return undefined;
  }

  // Get the last comment (closest to the declaration)
  const lastComment = commentRanges[commentRanges.length - 1];
  const commentText = fullText.substring(lastComment.pos, lastComment.end);

  // Only process JSDoc-style comments (/** ... */)
  if (!commentText.trim().startsWith('/**')) {
    return undefined;
  }

  // Extract just the description part (remove /** and */)
  const cleaned = commentText
    .replace(/^\/\*\*/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, '').trim())
    .filter((line) => line && !line.startsWith('@'))
    .join(' ')
    .trim();

  return cleaned || undefined;
}
