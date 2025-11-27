import type { DocumentLanguage } from '@synthesis/shared';
import type { Pool } from 'pg';
import { buildFileRelationships } from '../services/file-relationships.js';
import { detectTechStack } from '../services/tech-detector.js';
import type { Chunk, ChunkMetadata } from './chunk.js';
import { parseConfigFile } from './config-analyzer.js';
import { parseDartFile } from './dart-analyzer.js';
import {
  type HierarchicalChunkOptions,
  type ParsedClass,
  chunkClassHierarchically,
} from './hierarchical-chunker.js';
import { parseKotlinFile } from './kotlin-analyzer.js';
import { parsePythonFile } from './python-analyzer.js';
import { analyzeRedisUsage } from './redis-analyzer.js';
import { parseSQLFile } from './sql-analyzer.js';
import type { TableConstraint } from './sql-analyzer.js';
import { parseSwiftFile } from './swift-analyzer.js';
import { parseTypeScriptFile } from './ts-analyzer.js';

/**
 * Configuration options for code-aware chunking.
 */
export interface CodeChunkOptions {
  /** Maximum number of lines per chunk (default: 100). */
  maxChunkSize?: number;
  /** Include imports array in chunk metadata (default: false). */
  preserveImports?: boolean;
  /** Track file relationships for dependency graph (Day 3 feature, default: false). */
  trackRelationships?: boolean;
  /** Database pool for relationship tracking. */
  db?: Pool;
  /** Collection ID for relationship tracking. */
  collectionId?: string;
  /** Phase 9: Enable hierarchical chunking for large classes (default: true). */
  hierarchicalChunking?: boolean;
}

/**
 * Main entry point for code-aware chunking.
 * Routes to appropriate language-specific chunker based on file extension.
 * Falls back to simple text chunking on parse errors or unsupported types.
 */
export async function chunkCodeFile(
  filePath: string,
  content: string,
  options: CodeChunkOptions = {}
): Promise<Chunk[]> {
  const extension = filePath.split('.').pop()?.toLowerCase();

  try {
    // Check if backend parsing is enabled for SQL and config files
    const backendParsingEnabled = process.env.BACKEND_PARSING === 'true';

    switch (extension) {
      case 'dart':
        return await chunkDartCode(filePath, content, options);
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx': {
        // First, get standard chunks
        const chunks =
          extension === 'js' || extension === 'jsx'
            ? await chunkJavaScriptCode(filePath, content, options)
            : await chunkTypeScriptCode(filePath, content, options);

        // Enhance with Redis analysis if enabled
        const redisAnalysisEnabled = process.env.REDIS_ANALYSIS === 'true';
        if (!redisAnalysisEnabled) {
          return chunks;
        }

        try {
          const redisChunks = await analyzeRedisUsage(content, filePath);
          return [...chunks, ...redisChunks];
        } catch (err) {
          // Use console.warn for non-fatal analysis errors
          console.warn('Redis analysis failed, skipping', err);
          return chunks;
        }
      }
      case 'sql':
        if (backendParsingEnabled) {
          return await chunkSQLCode(filePath, content, options);
        }
        console.warn('BACKEND_PARSING=false, using simple chunking for SQL file');
        return simpleChunking(content, filePath);
      case 'yaml':
      case 'yml':
      case 'json':
        if (backendParsingEnabled) {
          return await chunkConfigCode(filePath, content, options);
        }
        console.warn('BACKEND_PARSING=false, using simple chunking for config file');
        return simpleChunking(content, filePath);
      case 'kt':
      case 'kts':
        return await chunkKotlinCode(filePath, content, options);
      case 'swift':
        return await chunkSwiftCode(filePath, content, options);
      case 'py':
        return await chunkPythonCode(filePath, content, options);
      case 'java':
        // TODO: Implement dedicated Java analyzer - Java syntax differs from Kotlin
        // For now, use simple chunking to avoid incorrect metadata
        console.warn('Java AST parsing not yet implemented, using simple chunking');
        return simpleChunking(content, filePath);
      default:
        console.warn(`Unsupported file type: ${extension}, using simple chunking`);
        return simpleChunking(content, filePath);
    }
  } catch (error) {
    console.error(`AST parsing failed for ${filePath}, falling back to simple chunking`, error);
    return simpleChunking(content, filePath);
  }
}

/**
 * Chunks Dart code using the AST parser from Day 1.
 * Extracts complete functions and classes with rich metadata.
 */
async function chunkDartCode(
  filePath: string,
  content: string,
  options: CodeChunkOptions
): Promise<Chunk[]> {
  const ast = await parseDartFile(content, filePath);
  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  // Extract import URIs for preservation
  const imports = ast.imports.map((i) => i.uri);

  // Chunk top-level functions
  for (const func of ast.functions) {
    const metadata: ChunkMetadata = {
      chunk_type: 'code',
      function_name: func.name,
      parameters: func.parameters,
      return_type: func.returnType,
      line_range: func.lineRange as [number, number],
      file_path: filePath,
      language: 'dart',
      startOffset: func.startOffset,
      endOffset: func.endOffset,
    };

    // Add optional fields
    if (func.docComment) {
      metadata.doc_comment = func.docComment;
    }
    if (options.preserveImports && imports.length > 0) {
      metadata.imports = imports;
    }

    chunks.push({
      text: func.code,
      index: chunkIndex++,
      metadata,
    });
  }

  // Chunk classes
  const hierarchicalEnabled = options.hierarchicalChunking !== false; // Default true
  const maxSize = options.maxChunkSize ?? 100;

  for (const cls of ast.classes) {
    const lineCount = cls.code.split('\n').length;

    if (lineCount < maxSize) {
      // Small class: chunk as whole
      const metadata: ChunkMetadata = {
        chunk_type: 'code',
        class_name: cls.name,
        methods: cls.methods.map((m) => m.name),
        properties: cls.properties.map((p) => p.name),
        line_range: cls.lineRange as [number, number],
        file_path: filePath,
        language: 'dart',
        startOffset: cls.startOffset,
        endOffset: cls.endOffset,
      };

      // Add Dart-specific class metadata
      if (cls.superclass) {
        metadata.extends = cls.superclass;
      }
      if (cls.interfaces && cls.interfaces.length > 0) {
        metadata.implements = cls.interfaces;
      }
      if (cls.mixins && cls.mixins.length > 0) {
        metadata.mixins = cls.mixins;
      }
      if (cls.isAbstract) {
        metadata.is_abstract = cls.isAbstract;
      }

      // Flutter-specific metadata
      const isWidget =
        cls.superclass === 'StatelessWidget' ||
        cls.superclass === 'StatefulWidget' ||
        cls.superclass?.endsWith('Widget');
      const isStateful = cls.superclass === 'StatefulWidget';
      if (isWidget) {
        metadata.is_widget = true;
      }
      if (isStateful) {
        metadata.is_stateful = true;
      }

      if (options.preserveImports && imports.length > 0) {
        metadata.imports = imports;
      }

      chunks.push({
        text: cls.code,
        index: chunkIndex++,
        metadata,
      });
    } else if (hierarchicalEnabled && cls.methods.length > 0) {
      // Phase 9: Large class with hierarchical chunking - create overview + method chunks
      const parsedClass: ParsedClass = {
        name: cls.name,
        code: cls.code,
        superclass: cls.superclass,
        interfaces: cls.interfaces,
        mixins: cls.mixins,
        isAbstract: cls.isAbstract,
        lineRange: cls.lineRange as [number, number],
        startOffset: cls.startOffset,
        endOffset: cls.endOffset,
        methods: cls.methods.map((m) => ({
          name: m.name,
          code: m.code,
          parameters: m.parameters,
          returnType: m.returnType,
          lineRange: m.lineRange as [number, number],
          startOffset: m.startOffset,
          endOffset: m.endOffset,
          isStatic: m.isStatic,
          isAsync: m.isAsync,
        })),
        properties: cls.properties.map((p) => ({
          name: p.name,
          type: p.type,
          isStatic: p.isStatic,
          isFinal: p.isFinal,
        })),
      };

      const hierarchicalOptions: HierarchicalChunkOptions = {
        maxChunkSize: maxSize,
        preserveImports: options.preserveImports,
        imports,
      };

      const result = chunkClassHierarchically(
        parsedClass,
        filePath,
        'dart',
        chunkIndex,
        hierarchicalOptions
      );

      // Add Flutter-specific metadata to overview chunk
      if (result.wasHierarchical && result.chunks.length > 0) {
        const overviewChunk = result.chunks[0];
        const isWidget =
          cls.superclass === 'StatelessWidget' ||
          cls.superclass === 'StatefulWidget' ||
          cls.superclass?.endsWith('Widget');
        const isStateful = cls.superclass === 'StatefulWidget';
        if (isWidget) {
          overviewChunk.metadata.is_widget = true;
        }
        if (isStateful) {
          overviewChunk.metadata.is_stateful = true;
        }
        if (cls.mixins && cls.mixins.length > 0) {
          overviewChunk.metadata.mixins = cls.mixins;
        }
      }

      chunks.push(...result.chunks);
      chunkIndex += result.chunks.length;
    } else {
      // Large class without hierarchical chunking: chunk per method (legacy behavior)
      for (const method of cls.methods) {
        const metadata: ChunkMetadata = {
          chunk_type: 'code',
          function_name: method.name,
          class_context: cls.name,
          parameters: method.parameters,
          return_type: method.returnType,
          line_range: method.lineRange as [number, number],
          file_path: filePath,
          language: 'dart',
          startOffset: method.startOffset,
          endOffset: method.endOffset,
        };

        if (method.isStatic) {
          metadata.is_static = method.isStatic;
        }
        if (options.preserveImports && imports.length > 0) {
          metadata.imports = imports;
        }

        chunks.push({
          text: method.code,
          index: chunkIndex++,
          metadata,
        });
      }
    }
  }

  // Chunk constants (optional, for completeness)
  for (const constant of ast.constants) {
    const metadata: ChunkMetadata = {
      chunk_type: 'code',
      constant_name: constant.name,
      constant_type: constant.type,
      line_range: constant.lineRange as [number, number],
      file_path: filePath,
      language: 'dart',
      startOffset: constant.startOffset,
      endOffset: constant.endOffset,
    };

    if (options.preserveImports && imports.length > 0) {
      metadata.imports = imports;
    }

    chunks.push({
      text: constant.code,
      index: chunkIndex++,
      metadata,
    });
  }

  // Track file relationships if enabled
  if (options.trackRelationships && options.db && options.collectionId) {
    await buildFileRelationships(options.db, options.collectionId, filePath, ast);
  }

  return chunks;
}

/**
 * Chunks TypeScript/TSX code using the AST parser.
 * Extracts complete functions, classes, and interfaces with rich metadata.
 */
async function chunkTypeScriptCode(
  filePath: string,
  content: string,
  options: CodeChunkOptions
): Promise<Chunk[]> {
  const ast = await parseTypeScriptFile(content, filePath);
  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  // Extract import URIs for preservation
  const imports = ast.imports.map((i) => i.uri);

  // Chunk top-level functions
  for (const func of ast.functions) {
    const metadata: ChunkMetadata = {
      chunk_type: 'code',
      function_name: func.name,
      parameters: func.parameters,
      return_type: func.returnType,
      line_range: func.lineRange as [number, number],
      file_path: filePath,
      language: filePath.endsWith('.tsx') ? 'tsx' : 'typescript',
      startOffset: func.startOffset,
      endOffset: func.endOffset,
    };

    // Add optional fields
    if (func.docComment) {
      metadata.doc_comment = func.docComment;
    }
    if (options.preserveImports && imports.length > 0) {
      metadata.imports = imports;
    }

    // React component detection for TSX files
    if (filePath.endsWith('.tsx')) {
      const isComponent =
        /^[A-Z]/.test(func.name) ||
        func.returnType?.includes('JSX.Element') ||
        func.returnType?.includes('ReactElement') ||
        func.code.includes('return <') ||
        func.code.includes('return (');

      if (isComponent) {
        metadata.is_component = true;
      }

      // Extract hooks usage for all functions (components and custom hooks)
      const hookPattern = /use[A-Z]\w+/g;
      const hooks = [...new Set(func.code.match(hookPattern) || [])];
      if (hooks.length > 0) {
        metadata.hooks_used = hooks;
      }
    }

    chunks.push({
      text: func.code,
      index: chunkIndex++,
      metadata,
    });
  }

  // Chunk classes
  const tsHierarchicalEnabled = options.hierarchicalChunking !== false;
  const tsMaxSize = options.maxChunkSize ?? 100;
  const tsLanguage: DocumentLanguage = filePath.endsWith('.tsx') ? 'tsx' : 'typescript';

  for (const cls of ast.classes) {
    const lineCount = cls.code.split('\n').length;

    if (lineCount < tsMaxSize) {
      // Small class: chunk as whole
      const metadata: ChunkMetadata = {
        chunk_type: 'code',
        class_name: cls.name,
        methods: cls.methods.map((m) => m.name),
        properties: cls.properties.map((p) => p.name),
        line_range: cls.lineRange as [number, number],
        file_path: filePath,
        language: tsLanguage,
        startOffset: cls.startOffset,
        endOffset: cls.endOffset,
      };

      // Add TypeScript-specific class metadata
      if (cls.superclass) {
        metadata.extends = cls.superclass;
      }
      if (cls.interfaces && cls.interfaces.length > 0) {
        metadata.implements = cls.interfaces;
      }
      if (cls.isAbstract) {
        metadata.is_abstract = cls.isAbstract;
      }

      // React component detection for class components
      if (filePath.endsWith('.tsx')) {
        const isComponent =
          cls.superclass?.includes('Component') ||
          cls.superclass?.includes('PureComponent') ||
          cls.methods.some((m) => m.name === 'render');

        if (isComponent) {
          metadata.is_component = true;
          metadata.is_class_component = true;
        }
      }

      if (options.preserveImports && imports.length > 0) {
        metadata.imports = imports;
      }

      chunks.push({
        text: cls.code,
        index: chunkIndex++,
        metadata,
      });
    } else if (tsHierarchicalEnabled && cls.methods.length > 0) {
      // Phase 9: Large class with hierarchical chunking
      const parsedClass: ParsedClass = {
        name: cls.name,
        code: cls.code,
        superclass: cls.superclass,
        interfaces: cls.interfaces,
        isAbstract: cls.isAbstract,
        lineRange: cls.lineRange as [number, number],
        startOffset: cls.startOffset,
        endOffset: cls.endOffset,
        methods: cls.methods.map((m) => ({
          name: m.name,
          code: m.code,
          parameters: m.parameters,
          returnType: m.returnType,
          lineRange: m.lineRange as [number, number],
          startOffset: m.startOffset,
          endOffset: m.endOffset,
          isStatic: m.isStatic,
          isAsync: m.isAsync,
        })),
        properties: cls.properties.map((p) => ({
          name: p.name,
          type: p.type,
          isStatic: p.isStatic,
        })),
      };

      const hierarchicalOptions: HierarchicalChunkOptions = {
        maxChunkSize: tsMaxSize,
        preserveImports: options.preserveImports,
        imports,
      };

      const result = chunkClassHierarchically(
        parsedClass,
        filePath,
        tsLanguage,
        chunkIndex,
        hierarchicalOptions
      );

      // Add React component metadata to overview chunk
      if (result.wasHierarchical && result.chunks.length > 0 && filePath.endsWith('.tsx')) {
        const overviewChunk = result.chunks[0];
        const isComponent =
          cls.superclass?.includes('Component') ||
          cls.superclass?.includes('PureComponent') ||
          cls.methods.some((m) => m.name === 'render');

        if (isComponent) {
          overviewChunk.metadata.is_component = true;
          overviewChunk.metadata.is_class_component = true;
        }
      }

      chunks.push(...result.chunks);
      chunkIndex += result.chunks.length;
    } else {
      // Large class without hierarchical chunking: chunk per method (legacy behavior)
      for (const method of cls.methods) {
        const metadata: ChunkMetadata = {
          chunk_type: 'code',
          function_name: method.name,
          class_context: cls.name,
          parameters: method.parameters,
          return_type: method.returnType,
          line_range: method.lineRange as [number, number],
          file_path: filePath,
          language: tsLanguage,
          startOffset: method.startOffset,
          endOffset: method.endOffset,
        };

        if (method.isStatic) {
          metadata.is_static = method.isStatic;
        }
        if (options.preserveImports && imports.length > 0) {
          metadata.imports = imports;
        }

        chunks.push({
          text: method.code,
          index: chunkIndex++,
          metadata,
        });
      }
    }
  }

  // Chunk constants and enums
  for (const constant of ast.constants) {
    const metadata: ChunkMetadata = {
      chunk_type: 'code',
      constant_name: constant.name,
      constant_type: constant.type,
      line_range: constant.lineRange as [number, number],
      file_path: filePath,
      language: filePath.endsWith('.tsx') ? 'tsx' : 'typescript',
      startOffset: constant.startOffset,
      endOffset: constant.endOffset,
    };

    if (constant.type === 'enum') {
      metadata.is_enum = true;
    }

    if (options.preserveImports && imports.length > 0) {
      metadata.imports = imports;
    }

    chunks.push({
      text: constant.code,
      index: chunkIndex++,
      metadata,
    });
  }

  // Track file relationships if enabled
  if (options.trackRelationships && options.db && options.collectionId) {
    await buildFileRelationships(options.db, options.collectionId, filePath, ast);
  }

  return chunks;
}

/**
 * Chunks JavaScript/JSX code using the TypeScript parser.
 * JavaScript is parsed as TypeScript since JS is a subset of TS.
 */
async function chunkJavaScriptCode(
  filePath: string,
  content: string,
  options: CodeChunkOptions
): Promise<Chunk[]> {
  // Use TypeScript parser for JavaScript (JS is subset of TS)
  const ast = await parseTypeScriptFile(content, filePath);
  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  // Extract import URIs for preservation
  const imports = ast.imports.map((i) => i.uri);

  // Chunk top-level functions
  for (const func of ast.functions) {
    const metadata: ChunkMetadata = {
      chunk_type: 'code',
      function_name: func.name,
      parameters: func.parameters,
      return_type: func.returnType,
      line_range: func.lineRange as [number, number],
      file_path: filePath,
      language: filePath.endsWith('.jsx') ? 'jsx' : 'javascript',
      startOffset: func.startOffset,
      endOffset: func.endOffset,
    };

    // Add optional fields
    if (func.docComment) {
      metadata.doc_comment = func.docComment;
    }
    if (options.preserveImports && imports.length > 0) {
      metadata.imports = imports;
    }

    // React component detection for JSX files
    if (filePath.endsWith('.jsx')) {
      const isComponent =
        /^[A-Z]/.test(func.name) ||
        func.code.includes('return <') ||
        func.code.includes('return (');

      if (isComponent) {
        metadata.is_component = true;

        // Extract hooks usage
        const hookPattern = /use[A-Z]\w+/g;
        const hooks = [...new Set(func.code.match(hookPattern) || [])];
        if (hooks.length > 0) {
          metadata.hooks_used = hooks;
        }
      }
    }

    chunks.push({
      text: func.code,
      index: chunkIndex++,
      metadata,
    });
  }

  // Chunk classes
  for (const cls of ast.classes) {
    const lineCount = cls.code.split('\n').length;
    const maxSize = options.maxChunkSize ?? 100;

    if (lineCount < maxSize) {
      // Small class: chunk as whole
      const metadata: ChunkMetadata = {
        chunk_type: 'code',
        class_name: cls.name,
        methods: cls.methods.map((m) => m.name),
        properties: cls.properties.map((p) => p.name),
        line_range: cls.lineRange as [number, number],
        file_path: filePath,
        language: filePath.endsWith('.jsx') ? 'jsx' : 'javascript',
        startOffset: cls.startOffset,
        endOffset: cls.endOffset,
      };

      // Add JavaScript-specific class metadata
      if (cls.superclass) {
        metadata.extends = cls.superclass;
      }

      // React component detection for class components
      if (filePath.endsWith('.jsx')) {
        const isComponent =
          cls.superclass?.includes('Component') ||
          cls.superclass?.includes('PureComponent') ||
          cls.methods.some((m) => m.name === 'render');

        if (isComponent) {
          metadata.is_component = true;
          metadata.is_class_component = true;
        }
      }

      if (options.preserveImports && imports.length > 0) {
        metadata.imports = imports;
      }

      chunks.push({
        text: cls.code,
        index: chunkIndex++,
        metadata,
      });
    } else {
      // Large class: chunk per method
      for (const method of cls.methods) {
        const metadata: ChunkMetadata = {
          chunk_type: 'code',
          function_name: method.name,
          class_context: cls.name,
          parameters: method.parameters,
          return_type: method.returnType,
          line_range: method.lineRange as [number, number],
          file_path: filePath,
          language: filePath.endsWith('.jsx') ? 'jsx' : 'javascript',
          startOffset: method.startOffset,
          endOffset: method.endOffset,
        };

        if (method.isStatic) {
          metadata.is_static = method.isStatic;
        }
        if (options.preserveImports && imports.length > 0) {
          metadata.imports = imports;
        }

        chunks.push({
          text: method.code,
          index: chunkIndex++,
          metadata,
        });
      }
    }
  }

  // Chunk constants
  for (const constant of ast.constants) {
    const metadata: ChunkMetadata = {
      chunk_type: 'code',
      constant_name: constant.name,
      constant_type: constant.type,
      line_range: constant.lineRange as [number, number],
      file_path: filePath,
      language: filePath.endsWith('.jsx') ? 'jsx' : 'javascript',
      startOffset: constant.startOffset,
      endOffset: constant.endOffset,
    };

    if (options.preserveImports && imports.length > 0) {
      metadata.imports = imports;
    }

    chunks.push({
      text: constant.code,
      index: chunkIndex++,
      metadata,
    });
  }

  // Track file relationships if enabled
  if (options.trackRelationships && options.db && options.collectionId) {
    await buildFileRelationships(options.db, options.collectionId, filePath, ast);
  }

  return chunks;
}

/**
 * Chunks SQL code using the SQL parser (Phase 13.5).
 * Extracts tables, indexes, and functions with rich metadata.
 */
async function chunkSQLCode(
  filePath: string,
  content: string,
  _options: CodeChunkOptions
): Promise<Chunk[]> {
  const ast = await parseSQLFile(content, filePath);
  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  const techStackEnabled = process.env.TECH_STACK_TAGS === 'true';
  const techStack = techStackEnabled ? detectTechStack(filePath, content) : undefined;

  // Chunk tables
  for (const table of ast.tables) {
    const tableStartOffset = table.startOffset ?? 0;
    const tableEndOffset = table.endOffset ?? table.code?.length ?? 0;
    const metadata: ChunkMetadata = {
      chunk_type: 'code',
      language: 'sql',
      file_path: filePath,
      line_range: table.lineRange,
      table: table.name,
      schema: table.schema,
      columns: table.columns.map((col) => ({
        name: col.name,
        type: col.type,
        constraints: col.constraints ?? [],
      })),
      sql_type: 'table',
      startOffset: tableStartOffset,
      endOffset: tableEndOffset,
    };

    if (techStack && techStack.length > 0) {
      metadata.tech_stack = techStack;
    }

    // Add conservative cross-tech hint for table (Phase 13.5)
    metadata.maps_to = {
      type: 'table',
      name: table.name,
    };

    // Add constraints info if present
    if (table.constraints && table.constraints.length > 0) {
      metadata.indexes = table.constraints
        .filter((c) => c.type === 'PRIMARY KEY' || c.type === 'UNIQUE')
        .map((c) => c.name || `${table.name}_${c.type.toLowerCase().replace(' ', '_')}`);

      const fkConstraints: TableConstraint[] = table.constraints.filter(
        (c) => c.type === 'FOREIGN KEY'
      );
      if (fkConstraints.length > 0) {
        metadata.foreign_keys = fkConstraints
          .filter((c) => c.referencedTable)
          .map((c) => ({
            column: c.columns?.[0] || '',
            references_table: c.referencedTable || '',
            references_column: c.referencedColumns?.[0] || '',
          }))
          .filter((fk) => fk.column && fk.references_table);
      }
    }

    chunks.push({
      text: table.code ?? '',
      index: chunkIndex++,
      metadata,
    });
  }

  // Chunk indexes
  for (const index of ast.indexes) {
    const indexText =
      index.code ||
      `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX ${index.name} ON ${index.table} (${index.columns.join(', ')})`;
    const metadata: ChunkMetadata = {
      chunk_type: 'code',
      language: 'sql',
      file_path: filePath,
      line_range: index.lineRange,
      table: index.table,
      indexes: [index.name],
      sql_type: 'index',
      startOffset: index.startOffset ?? 0,
      endOffset: index.endOffset ?? indexText.length,
    };

    if (techStack && techStack.length > 0) {
      metadata.tech_stack = techStack;
    }

    chunks.push({
      text: indexText,
      index: chunkIndex++,
      metadata,
    });
  }

  // Chunk functions
  for (const func of ast.functions) {
    const metadata: ChunkMetadata = {
      chunk_type: 'code',
      function_name: func.name,
      language: 'sql',
      file_path: filePath,
      line_range: func.lineRange,
      return_type: func.return_type,
      schema: func.schema,
      sql_type: 'function',
      startOffset: func.startOffset ?? 0,
      endOffset: func.endOffset ?? func.code?.length ?? 0,
    };

    if (techStack && techStack.length > 0) {
      metadata.tech_stack = techStack;
    }

    chunks.push({
      text: func.code ?? '',
      index: chunkIndex++,
      metadata,
    });
  }

  return chunks;
}

/**
 * Chunks config files (YAML/JSON) using the config parser (Phase 13.5).
 * Extracts sections and nested key paths with metadata.
 */
async function chunkConfigCode(
  filePath: string,
  content: string,
  _options: CodeChunkOptions
): Promise<Chunk[]> {
  const ast = await parseConfigFile(content, filePath);
  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  const techStackEnabled = process.env.TECH_STACK_TAGS === 'true';
  const techStack = techStackEnabled ? detectTechStack(filePath, content) : undefined;

  const isJson = filePath.toLowerCase().endsWith('.json');
  const format = isJson ? 'json' : 'yaml';

  // Chunk config sections (stored as "tables" in BackendAST)
  for (const section of ast.tables) {
    const sectionLineRange =
      section.lineRange ?? (section as { line_range?: [number, number] }).line_range;
    const sectionStartOffset =
      section.startOffset ?? (section as { start_offset?: number }).start_offset;
    const sectionEndOffset = section.endOffset ?? (section as { end_offset?: number }).end_offset;

    const metadata: ChunkMetadata = {
      chunk_type: 'code',
      language: isJson ? 'json' : 'yaml',
      file_path: filePath,
      format,
      config_section: section.name,
      keys: [section.name],
      nested_paths: section.columns.map((col) => `${section.name}.${col.name}`),
      line_range: sectionLineRange as [number, number] | undefined,
      startOffset: sectionStartOffset ?? 0,
      endOffset: sectionEndOffset ?? 0,
    };

    if (techStack && techStack.length > 0) {
      metadata.tech_stack = techStack;
    }

    // Add conservative cross-tech hint for config sections that map to backend services
    if (section.name === 'database' || section.name === 'redis' || section.name === 'cache') {
      metadata.maps_to = {
        type: 'endpoint',
        name: section.name,
      };
    }

    // Use JSON.stringify to render section content if code property doesn't exist
    const sectionCode = section.code ?? (section as { code?: string }).code;
    const placeholderColumns = section.columns.reduce<Record<string, string>>((acc, col) => {
      acc[col.name] = '...';
      return acc;
    }, {});

    const sectionText =
      typeof sectionCode === 'string'
        ? sectionCode
        : JSON.stringify({ [section.name]: placeholderColumns }, null, 2);

    if (metadata.endOffset === 0) {
      const fallbackStart = metadata.startOffset ?? 0;
      metadata.endOffset = fallbackStart + sectionText.length;
    }

    chunks.push({
      text: sectionText,
      index: chunkIndex++,
      metadata,
    });
  }

  return chunks;
}

/**
 * Phase 9: Options for simple/fallback chunking.
 */
interface SimpleChunkOptions {
  /** Lines per chunk (default: 50) */
  chunkSize?: number;
  /** Overlap lines (default: 10) */
  overlap?: number;
  /** Try to detect function boundaries (default: true) */
  respectFunctionBoundaries?: boolean;
}

/**
 * Phase 9: Regex patterns for detecting function boundaries in various languages.
 * These are heuristics for languages without AST support.
 */
const FUNCTION_BOUNDARY_PATTERNS: Record<string, RegExp[]> = {
  // Generic patterns that work across many languages
  generic: [
    /^\s*(public|private|protected|static|async|export)?\s*(function|def|fn|func|sub)\s+\w+/i,
    /^\s*(public|private|protected|static)?\s*\w+\s*\([^)]*\)\s*[:{]/,
    /^\s*class\s+\w+/i,
    /^\s*interface\s+\w+/i,
  ],
  // Java-specific
  java: [
    /^\s*(public|private|protected)?\s*(static)?\s*\w+\s+\w+\s*\([^)]*\)\s*(throws\s+\w+)?\s*\{/,
    /^\s*(public|private|protected)?\s*(abstract)?\s*class\s+\w+/,
    /^\s*(public)?\s*interface\s+\w+/,
  ],
  // Go-specific
  go: [/^\s*func\s+(\([^)]+\)\s*)?\w+\s*\([^)]*\)/, /^\s*type\s+\w+\s+(struct|interface)\s*\{/],
  // Rust-specific
  rust: [
    /^\s*(pub\s+)?(async\s+)?fn\s+\w+/,
    /^\s*(pub\s+)?struct\s+\w+/,
    /^\s*(pub\s+)?impl\s+/,
    /^\s*(pub\s+)?trait\s+\w+/,
  ],
  // C/C++-specific
  c: [/^\s*\w+\s+\w+\s*\([^)]*\)\s*\{/, /^\s*(class|struct)\s+\w+/, /^\s*#define\s+\w+/],
};

/**
 * Phase 9: Detect if a line is likely a function/class boundary.
 */
function isFunctionBoundary(line: string, languageHint?: string): boolean {
  const patterns =
    languageHint && FUNCTION_BOUNDARY_PATTERNS[languageHint]
      ? [...FUNCTION_BOUNDARY_PATTERNS[languageHint], ...FUNCTION_BOUNDARY_PATTERNS.generic]
      : FUNCTION_BOUNDARY_PATTERNS.generic;

  return patterns.some((pattern) => pattern.test(line));
}

/**
 * Phase 9: Detect language from file extension for boundary detection.
 */
function detectLanguageHint(filePath?: string): string | undefined {
  if (!filePath) return undefined;
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'java':
      return 'java';
    case 'go':
      return 'go';
    case 'rs':
      return 'rust';
    case 'c':
    case 'cpp':
    case 'cc':
    case 'h':
    case 'hpp':
      return 'c';
    default:
      return undefined;
  }
}

/**
 * Fallback text chunking for unsupported file types or parse errors.
 * Phase 9: Enhanced with language-aware function boundary detection.
 */
function simpleChunking(
  content: string,
  filePath?: string,
  options: SimpleChunkOptions = {}
): Chunk[] {
  const lines = content.split('\n');
  const chunkSize = options.chunkSize ?? 50;
  const overlap = options.overlap ?? 10;
  const respectBoundaries = options.respectFunctionBoundaries !== false;
  const languageHint = detectLanguageHint(filePath);

  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  // Precompute original character offsets for each line
  const lineStartOffsets: number[] = [];
  const lineEndOffsets: number[] = [];
  let lineStart = 0;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') {
      lineStartOffsets.push(lineStart);
      lineEndOffsets.push(i);
      lineStart = i + 1;
    }
  }
  lineStartOffsets.push(lineStart);
  lineEndOffsets.push(content.length);

  // Phase 9: Find function boundaries for smarter chunking
  const functionBoundaries: number[] = [];
  if (respectBoundaries) {
    for (let i = 0; i < lines.length; i++) {
      if (isFunctionBoundary(lines[i], languageHint)) {
        functionBoundaries.push(i);
      }
    }
  }

  let i = 0;
  while (i < lines.length) {
    let endLine = Math.min(i + chunkSize, lines.length);

    // Phase 9: Try to end at a function boundary if one exists nearby
    if (respectBoundaries && functionBoundaries.length > 0) {
      // Look for a function boundary within the last 20% of the chunk
      const searchStart = Math.floor(i + chunkSize * 0.8);
      const nearbyBoundary = functionBoundaries.find(
        (b) => b > searchStart && b <= endLine && b > i
      );
      if (nearbyBoundary !== undefined) {
        endLine = nearbyBoundary;
      }
    }

    const chunkLines = lines.slice(i, endLine);
    const text = chunkLines.join('\n');

    if (text.trim().length > 0) {
      chunks.push({
        text,
        index: chunkIndex++,
        metadata: {
          chunk_type: 'text',
          line_range: [i + 1, i + chunkLines.length],
          startOffset: lineStartOffsets[i] ?? 0,
          endOffset: lineEndOffsets[i + chunkLines.length - 1] ?? lineStartOffsets[i] + text.length,
        },
      });
    }

    // Move to next chunk with overlap
    const nextStart = endLine - overlap;
    if (nextStart <= i) {
      i = endLine; // Prevent infinite loop
    } else {
      i = nextStart;
    }
  }

  return chunks;
}

/**
 * Chunks Kotlin code using the AST parser.
 * Extracts complete functions and classes with rich metadata.
 */
async function chunkKotlinCode(
  filePath: string,
  content: string,
  options: CodeChunkOptions
): Promise<Chunk[]> {
  const ast = await parseKotlinFile(content, filePath);
  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  const imports = ast.imports.map((i) => i.uri);

  for (const func of ast.functions) {
    const metadata: ChunkMetadata = {
      chunk_type: 'code',
      function_name: func.name,
      parameters: func.parameters,
      return_type: func.returnType,
      line_range: func.lineRange as [number, number],
      file_path: filePath,
      language: 'kotlin',
      startOffset: func.startOffset,
      endOffset: func.endOffset,
    };

    if (func.docComment) {
      metadata.doc_comment = func.docComment;
    }
    if (func.isAsync) {
      metadata.is_async = func.isAsync;
    }
    if (options.preserveImports && imports.length > 0) {
      metadata.imports = imports;
    }

    chunks.push({ text: func.code, index: chunkIndex++, metadata });
  }

  for (const cls of ast.classes) {
    const lineCount = cls.code.split('\n').length;
    const maxSize = options.maxChunkSize ?? 100;

    if (lineCount < maxSize) {
      const metadata: ChunkMetadata = {
        chunk_type: 'code',
        class_name: cls.name,
        methods: cls.methods.map((m) => m.name),
        properties: cls.properties.map((p) => p.name),
        line_range: cls.lineRange as [number, number],
        file_path: filePath,
        language: 'kotlin',
        startOffset: cls.startOffset,
        endOffset: cls.endOffset,
      };

      if (cls.superclass) metadata.extends = cls.superclass;
      if (cls.interfaces?.length > 0) metadata.implements = cls.interfaces;
      if (cls.isAbstract) metadata.is_abstract = cls.isAbstract;
      if (options.preserveImports && imports.length > 0) metadata.imports = imports;

      chunks.push({ text: cls.code, index: chunkIndex++, metadata });
    } else {
      for (const method of cls.methods) {
        const metadata: ChunkMetadata = {
          chunk_type: 'code',
          function_name: method.name,
          class_context: cls.name,
          parameters: method.parameters,
          return_type: method.returnType,
          line_range: method.lineRange as [number, number],
          file_path: filePath,
          language: 'kotlin',
          startOffset: method.startOffset,
          endOffset: method.endOffset,
        };

        if (method.isStatic) metadata.is_static = method.isStatic;
        if (method.isAsync) metadata.is_async = method.isAsync;
        if (options.preserveImports && imports.length > 0) metadata.imports = imports;

        chunks.push({ text: method.code, index: chunkIndex++, metadata });
      }
    }
  }

  for (const constant of ast.constants) {
    chunks.push({
      text: constant.code,
      index: chunkIndex++,
      metadata: {
        chunk_type: 'code',
        constant_name: constant.name,
        constant_type: constant.type,
        line_range: constant.lineRange as [number, number],
        file_path: filePath,
        language: 'kotlin',
        startOffset: constant.startOffset,
        endOffset: constant.endOffset,
      },
    });
  }

  return chunks;
}

/**
 * Chunks Swift code using the AST parser.
 */
async function chunkSwiftCode(
  filePath: string,
  content: string,
  options: CodeChunkOptions
): Promise<Chunk[]> {
  const ast = await parseSwiftFile(content, filePath);
  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  const imports = ast.imports.map((i) => i.uri);

  for (const func of ast.functions) {
    const metadata: ChunkMetadata = {
      chunk_type: 'code',
      function_name: func.name,
      parameters: func.parameters,
      return_type: func.returnType,
      line_range: func.lineRange as [number, number],
      file_path: filePath,
      language: 'swift',
      startOffset: func.startOffset,
      endOffset: func.endOffset,
    };

    if (func.docComment) metadata.doc_comment = func.docComment;
    if (func.isAsync) metadata.is_async = func.isAsync;
    if (options.preserveImports && imports.length > 0) metadata.imports = imports;

    chunks.push({ text: func.code, index: chunkIndex++, metadata });
  }

  for (const cls of ast.classes) {
    const lineCount = cls.code.split('\n').length;
    const maxSize = options.maxChunkSize ?? 100;

    if (lineCount < maxSize) {
      const metadata: ChunkMetadata = {
        chunk_type: 'code',
        class_name: cls.name,
        methods: cls.methods.map((m) => m.name),
        properties: cls.properties.map((p) => p.name),
        line_range: cls.lineRange as [number, number],
        file_path: filePath,
        language: 'swift',
        startOffset: cls.startOffset,
        endOffset: cls.endOffset,
      };

      if (cls.superclass) metadata.extends = cls.superclass;
      if (cls.interfaces?.length > 0) metadata.implements = cls.interfaces;
      if (cls.isAbstract) metadata.is_abstract = cls.isAbstract;
      if (options.preserveImports && imports.length > 0) metadata.imports = imports;

      chunks.push({ text: cls.code, index: chunkIndex++, metadata });
    } else {
      for (const method of cls.methods) {
        const metadata: ChunkMetadata = {
          chunk_type: 'code',
          function_name: method.name,
          class_context: cls.name,
          parameters: method.parameters,
          return_type: method.returnType,
          line_range: method.lineRange as [number, number],
          file_path: filePath,
          language: 'swift',
          startOffset: method.startOffset,
          endOffset: method.endOffset,
        };

        if (method.isStatic) metadata.is_static = method.isStatic;
        if (method.isAsync) metadata.is_async = method.isAsync;
        if (options.preserveImports && imports.length > 0) metadata.imports = imports;

        chunks.push({ text: method.code, index: chunkIndex++, metadata });
      }
    }
  }

  for (const constant of ast.constants) {
    chunks.push({
      text: constant.code,
      index: chunkIndex++,
      metadata: {
        chunk_type: 'code',
        constant_name: constant.name,
        constant_type: constant.type,
        line_range: constant.lineRange as [number, number],
        file_path: filePath,
        language: 'swift',
        startOffset: constant.startOffset,
        endOffset: constant.endOffset,
      },
    });
  }

  return chunks;
}

/**
 * Chunks Python code using the AST parser.
 */
async function chunkPythonCode(
  filePath: string,
  content: string,
  options: CodeChunkOptions
): Promise<Chunk[]> {
  const ast = await parsePythonFile(content, filePath);
  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  const imports = ast.imports.map((i) => i.uri);

  for (const func of ast.functions) {
    const metadata: ChunkMetadata = {
      chunk_type: 'code',
      function_name: func.name,
      parameters: func.parameters,
      return_type: func.returnType,
      line_range: func.lineRange as [number, number],
      file_path: filePath,
      language: 'python',
      startOffset: func.startOffset,
      endOffset: func.endOffset,
    };

    if (func.docComment) metadata.doc_comment = func.docComment;
    if (func.isAsync) metadata.is_async = func.isAsync;
    if (func.isGenerator) metadata.is_generator = func.isGenerator;
    if (options.preserveImports && imports.length > 0) metadata.imports = imports;

    chunks.push({ text: func.code, index: chunkIndex++, metadata });
  }

  for (const cls of ast.classes) {
    const lineCount = cls.code.split('\n').length;
    const maxSize = options.maxChunkSize ?? 100;

    if (lineCount < maxSize) {
      const metadata: ChunkMetadata = {
        chunk_type: 'code',
        class_name: cls.name,
        methods: cls.methods.map((m) => m.name),
        properties: cls.properties.map((p) => p.name),
        line_range: cls.lineRange as [number, number],
        file_path: filePath,
        language: 'python',
        startOffset: cls.startOffset,
        endOffset: cls.endOffset,
      };

      if (cls.superclass) metadata.extends = cls.superclass;
      if (cls.interfaces?.length > 0) metadata.implements = cls.interfaces;
      if (cls.isAbstract) metadata.is_abstract = cls.isAbstract;
      if (options.preserveImports && imports.length > 0) metadata.imports = imports;

      chunks.push({ text: cls.code, index: chunkIndex++, metadata });
    } else {
      for (const method of cls.methods) {
        const metadata: ChunkMetadata = {
          chunk_type: 'code',
          function_name: method.name,
          class_context: cls.name,
          parameters: method.parameters,
          return_type: method.returnType,
          line_range: method.lineRange as [number, number],
          file_path: filePath,
          language: 'python',
          startOffset: method.startOffset,
          endOffset: method.endOffset,
        };

        if (method.isStatic) metadata.is_static = method.isStatic;
        if (method.isAsync) metadata.is_async = method.isAsync;
        if (options.preserveImports && imports.length > 0) metadata.imports = imports;

        chunks.push({ text: method.code, index: chunkIndex++, metadata });
      }
    }
  }

  for (const constant of ast.constants) {
    chunks.push({
      text: constant.code,
      index: chunkIndex++,
      metadata: {
        chunk_type: 'code',
        constant_name: constant.name,
        constant_type: constant.type,
        line_range: constant.lineRange as [number, number],
        file_path: filePath,
        language: 'python',
        startOffset: constant.startOffset,
        endOffset: constant.endOffset,
      },
    });
  }

  return chunks;
}
