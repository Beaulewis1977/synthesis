import type { Pool } from 'pg';
import { buildFileRelationships } from '../services/file-relationships.js';
import type { Chunk, ChunkMetadata } from './chunk.js';
import { parseDartFile } from './dart-analyzer.js';

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
    switch (extension) {
      case 'dart':
        return await chunkDartCode(filePath, content, options);
      case 'ts':
      case 'tsx':
        return await chunkTypeScriptCode(filePath, content, options);
      case 'js':
      case 'jsx':
        return await chunkJavaScriptCode(filePath, content, options);
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
 * Placeholder for TypeScript/TSX chunking (Day 4 implementation).
 * Currently falls back to simple chunking.
 */
async function chunkTypeScriptCode(
  filePath: string,
  content: string,
  _options: CodeChunkOptions
): Promise<Chunk[]> {
  console.warn(`TypeScript chunking not yet implemented for ${filePath}, using simple chunking`);
  return simpleChunking(content);
}

/**
 * Placeholder for JavaScript/JSX chunking.
 * Currently falls back to simple chunking.
 */
async function chunkJavaScriptCode(
  filePath: string,
  content: string,
  _options: CodeChunkOptions
): Promise<Chunk[]> {
  console.warn(`JavaScript chunking not yet implemented for ${filePath}, using simple chunking`);
  return simpleChunking(content);
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
