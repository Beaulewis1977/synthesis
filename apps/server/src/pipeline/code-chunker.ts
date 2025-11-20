import type { Pool } from 'pg';
import { buildFileRelationships } from '../services/file-relationships.js';
import { detectTechStack } from '../services/tech-detector.js';
import type { Chunk, ChunkMetadata } from './chunk.js';
import { parseConfigFile } from './config-analyzer.js';
import { parseDartFile } from './dart-analyzer.js';
import { analyzeRedisUsage } from './redis-analyzer.js';
import { parseSQLFile } from './sql-analyzer.js';
import type { TableConstraint } from './sql-analyzer.js';
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
        return simpleChunking(content);
      case 'yaml':
      case 'yml':
      case 'json':
        if (backendParsingEnabled) {
          return await chunkConfigCode(filePath, content, options);
        }
        console.warn('BACKEND_PARSING=false, using simple chunking for config file');
        return simpleChunking(content);
      default:
        console.warn(`Unsupported file type: ${extension}, using simple chunking`);
        return simpleChunking(content);
    }
  } catch (error) {
    console.error(`AST parsing failed for ${filePath}, falling back to simple chunking`, error);
    return simpleChunking(content);
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
        language: filePath.endsWith('.tsx') ? 'tsx' : 'typescript',
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
          language: filePath.endsWith('.tsx') ? 'tsx' : 'typescript',
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
 * Fallback text chunking for unsupported file types or parse errors.
 * Uses simple line-based chunking with overlap.
 */
function simpleChunking(content: string): Chunk[] {
  const lines = content.split('\n');
  const chunkSize = 50; // lines per chunk
  const overlap = 10; // overlapping lines
  const chunks: Chunk[] = [];
  let chunkIndex = 0;
  const lineStartOffsets: number[] = [];
  const lineEndOffsets: number[] = [];

  // Precompute original character offsets for each line so metadata stays roughly accurate.
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

  for (let i = 0; i < lines.length; i += chunkSize - overlap) {
    const chunkLines = lines.slice(i, i + chunkSize);
    const text = chunkLines.join('\n');

    if (text.trim().length === 0) {
      continue;
    }

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

  return chunks;
}
