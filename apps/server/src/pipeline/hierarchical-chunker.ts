/**
 * Hierarchical Code Chunking Service (Phase 9)
 *
 * Creates class overview chunks + method detail chunks for large classes,
 * maintaining parent-child relationships via metadata.
 *
 * @module pipeline/hierarchical-chunker
 */

import { randomUUID } from 'node:crypto';
import type { ChunkHierarchy, DocumentLanguage } from '@synthesis/shared';
import type { Chunk, ChunkMetadata } from './chunk.js';

/**
 * Options for hierarchical chunking.
 */
export interface HierarchicalChunkOptions {
  /** Maximum lines before a class is split hierarchically (default: 100) */
  maxChunkSize?: number;
  /** Include method signatures in overview (default: true) */
  includeMethodSignatures?: boolean;
  /** Include property declarations in overview (default: true) */
  includeProperties?: boolean;
  /** Preserve imports in metadata (default: false) */
  preserveImports?: boolean;
  /** Import URIs to include if preserveImports is true */
  imports?: string[];
}

/**
 * Parsed class information from AST.
 */
export interface ParsedClass {
  name: string;
  code: string;
  superclass?: string;
  interfaces?: string[];
  mixins?: string[];
  isAbstract?: boolean;
  lineRange: [number, number];
  startOffset: number;
  endOffset: number;
  methods: ParsedMethod[];
  properties: ParsedProperty[];
}

/**
 * Parsed method information from AST.
 */
export interface ParsedMethod {
  name: string;
  code: string;
  parameters?: string[];
  returnType?: string;
  lineRange: [number, number];
  startOffset: number;
  endOffset: number;
  isStatic?: boolean;
  isAsync?: boolean;
  docComment?: string;
}

/**
 * Parsed property information from AST.
 */
export interface ParsedProperty {
  name: string;
  type?: string;
  isStatic?: boolean;
  isFinal?: boolean;
}

/**
 * Result of hierarchical chunking.
 */
export interface HierarchicalChunkResult {
  /** All chunks (overview + details) */
  chunks: Chunk[];
  /** Whether hierarchical chunking was applied */
  wasHierarchical: boolean;
  /** Number of detail chunks created */
  detailCount: number;
}

const DEFAULT_OPTIONS: Required<Omit<HierarchicalChunkOptions, 'imports'>> = {
  maxChunkSize: 100,
  includeMethodSignatures: true,
  includeProperties: true,
  preserveImports: false,
};

/**
 * Generate a class overview containing signature, properties, and method signatures.
 */
export function generateClassOverview(
  cls: ParsedClass,
  options: HierarchicalChunkOptions = {}
): string {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const lines: string[] = [];

  // Class signature
  let signature = '';
  if (cls.isAbstract) signature += 'abstract ';
  signature += `class ${cls.name}`;
  if (cls.superclass) signature += ` extends ${cls.superclass}`;
  if (cls.interfaces && cls.interfaces.length > 0) {
    signature += ` implements ${cls.interfaces.join(', ')}`;
  }
  if (cls.mixins && cls.mixins.length > 0) {
    signature += ` with ${cls.mixins.join(', ')}`;
  }
  signature += ' {';
  lines.push(signature);

  // Properties
  if (config.includeProperties && cls.properties.length > 0) {
    lines.push('  // Properties');
    for (const prop of cls.properties) {
      let propLine = '  ';
      if (prop.isStatic) propLine += 'static ';
      if (prop.isFinal) propLine += 'final ';
      if (prop.type) propLine += `${prop.type} `;
      propLine += `${prop.name};`;
      lines.push(propLine);
    }
    lines.push('');
  }

  // Method signatures
  if (config.includeMethodSignatures && cls.methods.length > 0) {
    lines.push('  // Methods');
    for (const method of cls.methods) {
      let methodSig = '  ';
      if (method.isStatic) methodSig += 'static ';
      if (method.isAsync) methodSig += 'async ';
      if (method.returnType) methodSig += `${method.returnType} `;
      methodSig += `${method.name}(`;
      if (method.parameters && method.parameters.length > 0) {
        methodSig += method.parameters.join(', ');
      }
      methodSig += ');';
      lines.push(methodSig);
    }
  }

  lines.push('}');
  return lines.join('\n');
}

/**
 * Chunk a large class hierarchically into overview + method chunks.
 *
 * @param cls - Parsed class from AST
 * @param filePath - Source file path
 * @param language - Programming language
 * @param startIndex - Starting chunk index
 * @param options - Chunking options
 * @returns Hierarchical chunk result
 */
export function chunkClassHierarchically(
  cls: ParsedClass,
  filePath: string,
  language: DocumentLanguage,
  startIndex: number,
  options: HierarchicalChunkOptions = {}
): HierarchicalChunkResult {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const lineCount = cls.code.split('\n').length;

  // If class is small enough, don't use hierarchical chunking
  if (lineCount < config.maxChunkSize) {
    return {
      chunks: [],
      wasHierarchical: false,
      detailCount: 0,
    };
  }

  const chunks: Chunk[] = [];
  let chunkIndex = startIndex;

  // Generate parent ID for linking
  const parentChunkId = randomUUID();

  // Create overview chunk
  // Note: Overview chunk does NOT have parent_chunk_id - only child chunks reference the parent
  // The parentChunkId is used as a linking ID that children reference
  const overviewText = generateClassOverview(cls, options);
  const overviewMetadata: ChunkMetadata = {
    chunk_type: 'code',
    class_name: cls.name,
    methods: cls.methods.map((m) => m.name),
    properties: cls.properties.map((p) => p.name),
    line_range: cls.lineRange,
    file_path: filePath,
    language,
    startOffset: cls.startOffset,
    endOffset: cls.endOffset,
    // Phase 9: Hierarchical metadata
    // overview_chunk_id is used by children to reference this overview chunk
    overview_chunk_id: parentChunkId,
    chunk_hierarchy: 'overview' as ChunkHierarchy,
    sibling_count: cls.methods.length,
  };

  // Add class-specific metadata
  if (cls.superclass) overviewMetadata.extends = cls.superclass;
  if (cls.interfaces && cls.interfaces.length > 0) {
    overviewMetadata.implements = cls.interfaces;
  }
  if (cls.isAbstract) overviewMetadata.is_abstract = cls.isAbstract;
  if (config.preserveImports && options.imports && options.imports.length > 0) {
    overviewMetadata.imports = options.imports;
  }

  chunks.push({
    text: overviewText,
    index: chunkIndex++,
    metadata: overviewMetadata,
  });

  // Create method detail chunks
  for (const method of cls.methods) {
    const methodMetadata: ChunkMetadata = {
      chunk_type: 'code',
      function_name: method.name,
      class_context: cls.name,
      class_name: cls.name,
      parameters: method.parameters,
      return_type: method.returnType,
      line_range: method.lineRange,
      file_path: filePath,
      language,
      startOffset: method.startOffset,
      endOffset: method.endOffset,
      // Phase 9: Hierarchical metadata
      parent_chunk_id: parentChunkId,
      chunk_hierarchy: 'detail' as ChunkHierarchy,
    };

    if (method.isStatic) methodMetadata.is_static = method.isStatic;
    if (method.isAsync) methodMetadata.is_async = method.isAsync;
    if (method.docComment) methodMetadata.doc_comment = method.docComment;
    if (config.preserveImports && options.imports && options.imports.length > 0) {
      methodMetadata.imports = options.imports;
    }

    chunks.push({
      text: method.code,
      index: chunkIndex++,
      metadata: methodMetadata,
    });
  }

  return {
    chunks,
    wasHierarchical: true,
    detailCount: cls.methods.length,
  };
}

/**
 * Check if a class should be chunked hierarchically.
 */
export function shouldChunkHierarchically(
  cls: ParsedClass,
  maxChunkSize: number = DEFAULT_OPTIONS.maxChunkSize
): boolean {
  const lineCount = cls.code.split('\n').length;
  return lineCount >= maxChunkSize && cls.methods.length > 0;
}
