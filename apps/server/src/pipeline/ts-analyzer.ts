/**
 * TypeScript/JavaScript AST Parser using TypeScript Compiler API (Phase 14 Enhanced)
 *
 * Produces DartAST-compatible output for seamless integration with existing chunking pipeline.
 * Includes framework detection for React, Next.js, Express, NestJS, Supabase, Redis, PostgreSQL.
 *
 * @module pipeline/ts-analyzer
 */

import type { AnalyzerCapabilities, DocumentFramework, FrameworkInfo } from '@synthesis/shared';
import ts from 'typescript';
import { type LanguageAnalyzer, analyzerRegistry } from './analyzers/registry.js';
import type { DartAST } from './dart-analyzer.js';

// =============================================================================
// Framework Detection (Phase 14)
// =============================================================================

/**
 * TypeScript/JavaScript-specific framework patterns with enhanced detection
 */
const TS_FRAMEWORK_PATTERNS: Record<string, { patterns: RegExp[]; framework: DocumentFramework }> =
  {
    react: {
      framework: 'react',
      patterns: [
        /import\s+.*\s+from\s+['"]react['"]/,
        /from\s+['"]react['"]/,
        /React\.(?:Component|createElement|useState|useEffect)/,
        /useState\s*\(|useEffect\s*\(|useCallback\s*\(/,
        /return\s*\(\s*</,
        /<[A-Z]\w+/,
        /className=/,
      ],
    },
    nextjs: {
      framework: 'nextjs',
      patterns: [
        /from\s+['"]next\//,
        /getServerSideProps|getStaticProps|getStaticPaths/,
        /import\s+.*\s+from\s+['"]next\/(?:router|link|image|head)['"]/,
        /useRouter\s*\(/,
        /NextPage|GetServerSideProps|GetStaticProps/,
        /pages\/|app\//,
      ],
    },
    express: {
      framework: 'express',
      patterns: [
        /from\s+['"]express['"]/,
        /require\s*\(\s*['"]express['"]\s*\)/,
        /express\s*\(\)/,
        /app\.(?:get|post|put|delete|use|listen)\s*\(/,
        /req\.(?:body|params|query)/,
        /res\.(?:json|send|status)/,
        /Router\s*\(\)/,
      ],
    },
    nestjs: {
      framework: 'nestjs',
      patterns: [
        /@(?:Controller|Injectable|Module|Get|Post|Put|Delete)\s*\(/,
        /from\s+['"]@nestjs\//,
        /NestFactory\.create/,
        /@Body\(\)|@Param\(\)|@Query\(\)/,
        /implements\s+(?:OnModuleInit|OnModuleDestroy)/,
      ],
    },
    fastify: {
      framework: 'fastify',
      patterns: [
        /from\s+['"]fastify['"]/,
        /require\s*\(\s*['"]fastify['"]\s*\)/,
        /fastify\s*\(\)/,
        /\.register\s*\(/,
        /\.get\s*\(|.post\s*\(/,
      ],
    },
    supabase: {
      framework: 'supabase',
      patterns: [
        /from\s+['"]@supabase\/supabase-js['"]/,
        /createClient\s*\(/,
        /supabase\.from\s*\(/,
        /supabase\.auth/,
        /supabase\.storage/,
        /SUPABASE_URL|SUPABASE_ANON_KEY|NEXT_PUBLIC_SUPABASE/,
      ],
    },
    firebase: {
      framework: 'firebase',
      patterns: [
        /from\s+['"]firebase\//,
        /initializeApp\s*\(/,
        /getFirestore|getAuth|getStorage/,
        /collection\s*\(|doc\s*\(/,
        /FIREBASE_|NEXT_PUBLIC_FIREBASE/,
      ],
    },
    redis: {
      framework: 'redis',
      patterns: [
        /from\s+['"](?:redis|ioredis)['"]/,
        /require\s*\(\s*['"](?:redis|ioredis)['"]\s*\)/,
        /createClient\s*\(/,
        /\.get\s*\(|\.set\s*\(|\.hget\s*\(|\.hset\s*\(/,
        /REDIS_URL|REDIS_HOST/,
      ],
    },
    postgres: {
      framework: 'postgres',
      patterns: [
        /from\s+['"]pg['"]/,
        /require\s*\(\s*['"]pg['"]\s*\)/,
        /new\s+Pool\s*\(/,
        /pool\.query\s*\(/,
        /DATABASE_URL|PG_HOST|POSTGRES/,
      ],
    },
    reactnative: {
      framework: 'reactnative',
      patterns: [
        // React Native core
        /from\s+['"]react-native['"]/,
        /from\s+['"]@react-native\//,
        /from\s+['"]@react-navigation\//,
        /StyleSheet\.create\s*\(/,
        /View|Text|TouchableOpacity|TouchableHighlight/,
        /FlatList|ScrollView|SafeAreaView/,
        /Platform\.(?:OS|select|Version)/,
        /Dimensions\.get\s*\(/,
        /useColorScheme|useWindowDimensions/,
        /StatusBar|Modal|Alert\.alert/,
        /AsyncStorage|SecureStore/,
        /\.ios\.|\.android\./,
        // Expo SDK
        /from\s+['"]expo['"]/,
        /from\s+['"]expo-/,
        /from\s+['"]@expo\//,
        /expo-router|expo-constants|expo-camera|expo-location/,
        /expo-notifications|expo-image-picker|expo-file-system/,
        /expo-linear-gradient|expo-blur|expo-haptics/,
        /expo-secure-store|expo-auth-session|expo-linking/,
        /useAssets|useFonts|useKeepAwake/,
        /Constants\.(?:expoConfig|manifest|deviceName)/,
        /SplashScreen\.(?:preventAutoHideAsync|hideAsync)/,
        /registerRootComponent\s*\(/,
      ],
    },
  };

/**
 * Detect TypeScript/JavaScript frameworks from code
 */
export function detectTsFrameworks(code: string, _filePath: string): FrameworkInfo[] {
  const results: FrameworkInfo[] = [];

  for (const [, config] of Object.entries(TS_FRAMEWORK_PATTERNS)) {
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
 * TypeScript analyzer capabilities
 */
export const TS_ANALYZER_CAPABILITIES: AnalyzerCapabilities = {
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

// =============================================================================
// Language Analyzer Registration (Phase 14)
// =============================================================================

/**
 * TypeScript language analyzer implementation
 */
export const typescriptAnalyzer: LanguageAnalyzer = {
  language: 'typescript',
  extensions: ['ts', 'tsx'],
  parserType: 'ast',
  capabilities: TS_ANALYZER_CAPABILITIES,

  async analyze(code: string, filePath: string): Promise<DartAST> {
    return parseTypeScriptFile(code, filePath);
  },

  detectFrameworks(code: string, filePath: string): FrameworkInfo[] {
    return detectTsFrameworks(code, filePath);
  },
};

/**
 * JavaScript language analyzer implementation
 */
export const javascriptAnalyzer: LanguageAnalyzer = {
  language: 'javascript',
  extensions: ['js', 'jsx', 'mjs', 'cjs'],
  parserType: 'ast',
  capabilities: TS_ANALYZER_CAPABILITIES,

  async analyze(code: string, filePath: string): Promise<DartAST> {
    return parseTypeScriptFile(code, filePath);
  },

  detectFrameworks(code: string, filePath: string): FrameworkInfo[] {
    return detectTsFrameworks(code, filePath);
  },
};

// Register the analyzers
analyzerRegistry.register(typescriptAnalyzer, 10);
analyzerRegistry.register(javascriptAnalyzer, 10);
