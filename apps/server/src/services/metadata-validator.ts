/**
 * Metadata Validator Service
 *
 * Provides validation and inference for document and chunk metadata.
 * Ensures all required fields are present and correctly typed.
 *
 * @module services/metadata-validator
 * @since Phase 3: Metadata Guarantees
 */

import type {
  ChunkMetadata,
  ChunkType,
  DocumentMetadata,
  RequiredChunkMetadata,
  RequiredDocumentMetadata,
  SourceType,
} from '@synthesis/shared';
import { z } from 'zod';

// ============================================
// Zod Schemas
// ============================================

/**
 * Schema for source type classification.
 */
export const SourceTypeSchema = z.enum(['url', 'repo', 'file']);

/**
 * Schema for chunk type classification.
 */
export const ChunkTypeSchema = z.enum([
  'text',
  'code',
  'sql',
  'config',
  'heading',
  'list',
  'analysis',
]);

/**
 * Schema for required document metadata fields.
 */
export const RequiredDocumentMetadataSchema = z.object({
  source: z.string().min(1, 'Source is required'),
  source_type: SourceTypeSchema,
  languages: z.array(z.string()).min(1, 'At least one language is required'),
  ingested_at: z.string().datetime({ message: 'ingested_at must be a valid ISO timestamp' }),
  framework_version: z.string().optional(),
  commit_sha: z.string().optional(),
});

/**
 * Schema for required chunk metadata fields.
 */
export const RequiredChunkMetadataSchema = z
  .object({
    chunk_type: ChunkTypeSchema,
    startOffset: z.number().int().min(0, 'startOffset must be a non-negative integer'),
    endOffset: z.number().int().min(0, 'endOffset must be a non-negative integer'),
    language: z.string().optional(),
    file_path: z.string().optional(),
    class_name: z.string().optional(),
    function_name: z.string().optional(),
  })
  .refine((data) => data.endOffset >= data.startOffset, {
    message: 'endOffset must be greater than or equal to startOffset',
  });

// ============================================
// Validation Result Types
// ============================================

export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

export interface ValidationFailure {
  success: false;
  errors: Array<{
    field: string;
    message: string;
  }>;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

// ============================================
// Validation Functions
// ============================================

/**
 * Validates document metadata against required fields schema.
 * Returns a result object indicating success or failure with detailed errors.
 */
export function validateDocumentMetadata(
  metadata: Partial<RequiredDocumentMetadata>
): ValidationResult<RequiredDocumentMetadata> {
  const result = RequiredDocumentMetadataSchema.safeParse(metadata);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

/**
 * Validates chunk metadata against required fields schema.
 * Returns a result object indicating success or failure with detailed errors.
 */
export function validateChunkMetadata(
  metadata: Partial<RequiredChunkMetadata>
): ValidationResult<RequiredChunkMetadata> {
  const result = RequiredChunkMetadataSchema.safeParse(metadata);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

/**
 * Validates and throws if document metadata is invalid.
 * Use this when you want to halt processing on invalid metadata.
 */
export function assertValidDocumentMetadata(
  metadata: Partial<RequiredDocumentMetadata>
): asserts metadata is RequiredDocumentMetadata {
  const result = validateDocumentMetadata(metadata);
  if (!result.success) {
    const errorMessages = result.errors.map((e) => `${e.field}: ${e.message}`).join('; ');
    throw new Error(`Invalid document metadata: ${errorMessages}`);
  }
}

/**
 * Validates and throws if chunk metadata is invalid.
 * Use this when you want to halt processing on invalid metadata.
 */
export function assertValidChunkMetadata(
  metadata: Partial<RequiredChunkMetadata>
): asserts metadata is RequiredChunkMetadata {
  const result = validateChunkMetadata(metadata);
  if (!result.success) {
    const errorMessages = result.errors.map((e) => `${e.field}: ${e.message}`).join('; ');
    throw new Error(`Invalid chunk metadata: ${errorMessages}`);
  }
}

// ============================================
// Inference Functions
// ============================================

/**
 * Language extension mapping for inference.
 */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.dart': 'dart',
  '.py': 'python',
  '.java': 'java',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.sql': 'sql',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.json': 'json',
  '.toml': 'toml',
  '.ini': 'ini',
  '.env': 'env',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.go': 'go',
  '.rs': 'rust',
  '.rb': 'ruby',
  '.php': 'php',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
};

/**
 * Infers source type from a source string.
 */
export function inferSourceType(source: string): SourceType {
  if (!source) {
    return 'file';
  }

  // Check for GitHub/GitLab/Bitbucket URLs
  if (
    source.includes('github.com') ||
    source.includes('gitlab.com') ||
    source.includes('bitbucket.org') ||
    source.endsWith('.git')
  ) {
    return 'repo';
  }

  // Check for HTTP(S) URLs
  if (source.startsWith('http://') || source.startsWith('https://')) {
    return 'url';
  }

  // Default to file
  return 'file';
}

/**
 * Infers language from a file path.
 */
export function inferLanguageFromPath(filePath: string): string | undefined {
  if (!filePath) {
    return undefined;
  }

  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1) {
    return undefined;
  }

  const ext = filePath.slice(lastDot).toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext];
}

/**
 * Infers languages array from file path and content.
 */
export function inferLanguages(filePath?: string, content?: string): string[] {
  const languages: Set<string> = new Set();

  // Infer from file path
  if (filePath) {
    const lang = inferLanguageFromPath(filePath);
    if (lang) {
      languages.add(lang);
    }
  }

  // Infer from content patterns (basic heuristics)
  if (content) {
    const normalized = content.toUpperCase();

    // Detect common language patterns
    if (content.includes("import 'package:flutter")) {
      languages.add('dart');
    }
    if (content.includes('import React') || content.includes("from 'react'")) {
      languages.add('typescript');
    }

    // SQL detection: look for strong SQL keywords and patterns
    if (
      /\bCREATE\s+TABLE\b/.test(normalized) ||
      /\bALTER\s+TABLE\b/.test(normalized) ||
      /\bINSERT\s+INTO\b/.test(normalized) ||
      (/\bSELECT\b/.test(normalized) && /\bFROM\b/.test(normalized))
    ) {
      languages.add('sql');
    }

    // Python detection: function definition pattern
    if (/\bdef\s+\w+\s*\(.*\)\s*:/m.test(content)) {
      languages.add('python');
    }
  }

  // Default to 'unknown' if no language detected
  if (languages.size === 0) {
    languages.add('unknown');
  }

  return Array.from(languages);
}

/**
 * Infers chunk type from file extension and content.
 */
export function inferChunkType(filePath?: string, content?: string): ChunkType {
  if (filePath) {
    const lastDot = filePath.lastIndexOf('.');
    const ext = lastDot === -1 ? '' : filePath.slice(lastDot).toLowerCase();

    // SQL files
    if (ext === '.sql') {
      return 'sql';
    }

    // Config files
    if (['.yaml', '.yml', '.json', '.toml', '.ini', '.env'].includes(ext)) {
      return 'config';
    }

    // Code files
    const lang = EXTENSION_TO_LANGUAGE[ext];
    const isCodeLanguage = (value: string | undefined): boolean =>
      !!value && !['markdown', 'text'].includes(value);

    if (isCodeLanguage(lang)) {
      return 'code';
    }
  }

  // Check content for patterns
  if (content) {
    const normalized = content.toUpperCase();

    // SQL content
    if (
      /\bCREATE\s+TABLE\b/.test(normalized) ||
      /\bALTER\s+TABLE\b/.test(normalized) ||
      /\bINSERT\s+INTO\b/.test(normalized) ||
      (/\bSELECT\b/.test(normalized) && /\bFROM\b/.test(normalized))
    ) {
      return 'sql';
    }

    // Heading content (starts with # in markdown)
    if (content.trim().startsWith('#')) {
      return 'heading';
    }

    // List content
    if (/^[\s]*[-*]\s/m.test(content) || /^[\s]*\d+\.\s/m.test(content)) {
      return 'list';
    }
  }

  // Default to text
  return 'text';
}

/**
 * Infers and fills in missing document metadata fields.
 * Returns a complete metadata object with all required fields.
 */
export function inferDocumentMetadata(
  partialMetadata: Partial<DocumentMetadata>,
  context: {
    filePath?: string;
    sourceUrl?: string;
    content?: string;
  } = {}
): DocumentMetadata & RequiredDocumentMetadata {
  const source =
    partialMetadata.source ||
    partialMetadata.source_url ||
    context.sourceUrl ||
    context.filePath ||
    'unknown';

  const sourceType = partialMetadata.source_type || inferSourceType(source);

  const languages =
    partialMetadata.languages && partialMetadata.languages.length > 0
      ? partialMetadata.languages
      : inferLanguages(context.filePath || partialMetadata.file_path, context.content);

  const ingestedAt = partialMetadata.ingested_at || new Date().toISOString();

  return {
    ...partialMetadata,
    source,
    source_type: sourceType,
    languages,
    ingested_at: ingestedAt,
    // Preserve optional fields if present
    framework_version: partialMetadata.framework_version,
    commit_sha: partialMetadata.commit_sha,
  };
}

/**
 * Infers and fills in missing chunk metadata fields.
 * Returns a complete metadata object with all required fields.
 */
export function inferChunkMetadata(
  partialMetadata: Partial<ChunkMetadata>,
  context: {
    filePath?: string;
    content?: string;
    startOffset?: number;
    endOffset?: number;
  } = {}
): ChunkMetadata & RequiredChunkMetadata {
  const chunkType = partialMetadata.chunk_type || inferChunkType(context.filePath, context.content);

  const startOffset = partialMetadata.startOffset ?? context.startOffset ?? 0;
  const endOffset = partialMetadata.endOffset ?? context.endOffset ?? context.content?.length ?? 0;

  // Infer language if not provided
  const inferredLanguage = inferLanguageFromPath(context.filePath || '');

  return {
    ...partialMetadata,
    chunk_type: chunkType,
    startOffset,
    endOffset,
    // Preserve optional fields if present
    // Cast to any to allow flexible language strings beyond the strict union type
    language: (partialMetadata.language || inferredLanguage) as ChunkMetadata['language'],
    file_path: partialMetadata.file_path || context.filePath,
    class_name: partialMetadata.class_name,
    function_name: partialMetadata.function_name,
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Checks if document metadata has all required fields.
 * Does not throw, just returns a boolean.
 */
export function hasRequiredDocumentMetadata(metadata: Partial<DocumentMetadata>): boolean {
  return validateDocumentMetadata(metadata as Partial<RequiredDocumentMetadata>).success;
}

/**
 * Checks if chunk metadata has all required fields.
 * Does not throw, just returns a boolean.
 */
export function hasRequiredChunkMetadata(metadata: Partial<ChunkMetadata>): boolean {
  return validateChunkMetadata(metadata as Partial<RequiredChunkMetadata>).success;
}

/**
 * Gets a list of missing required fields for document metadata.
 */
export function getMissingDocumentFields(metadata: Partial<DocumentMetadata>): string[] {
  const result = validateDocumentMetadata(metadata as Partial<RequiredDocumentMetadata>);
  if (result.success) {
    return [];
  }
  return result.errors.map((e) => e.field);
}

/**
 * Gets a list of missing required fields for chunk metadata.
 */
export function getMissingChunkFields(metadata: Partial<ChunkMetadata>): string[] {
  const result = validateChunkMetadata(metadata as Partial<RequiredChunkMetadata>);
  if (result.success) {
    return [];
  }
  return result.errors.map((e) => e.field);
}
