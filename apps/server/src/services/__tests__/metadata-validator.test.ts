import { describe, expect, it } from 'vitest';
import {
  assertValidChunkMetadata,
  assertValidDocumentMetadata,
  getMissingChunkFields,
  getMissingDocumentFields,
  hasRequiredChunkMetadata,
  hasRequiredDocumentMetadata,
  inferChunkMetadata,
  inferChunkType,
  inferDocumentMetadata,
  inferLanguageFromPath,
  inferLanguages,
  inferSourceType,
  validateChunkMetadata,
  validateDocumentMetadata,
} from '../metadata-validator.js';

describe('metadata-validator', () => {
  describe('inferSourceType', () => {
    it('detects GitHub URLs as repo', () => {
      expect(inferSourceType('https://github.com/flutter/flutter')).toBe('repo');
      expect(inferSourceType('https://github.com/user/repo.git')).toBe('repo');
    });

    it('detects GitLab URLs as repo', () => {
      expect(inferSourceType('https://gitlab.com/user/project')).toBe('repo');
    });

    it('detects Bitbucket URLs as repo', () => {
      expect(inferSourceType('https://bitbucket.org/user/repo')).toBe('repo');
    });

    it('detects .git URLs as repo', () => {
      expect(inferSourceType('git@github.com:user/repo.git')).toBe('repo');
    });

    it('detects HTTP URLs as url', () => {
      expect(inferSourceType('https://flutter.dev/docs')).toBe('url');
      expect(inferSourceType('http://example.com/page')).toBe('url');
    });

    it('detects file paths as file', () => {
      expect(inferSourceType('/home/user/project/file.dart')).toBe('file');
      expect(inferSourceType('./src/index.ts')).toBe('file');
      expect(inferSourceType('lib/main.dart')).toBe('file');
    });

    it('returns file for empty string', () => {
      expect(inferSourceType('')).toBe('file');
    });
  });

  describe('inferLanguageFromPath', () => {
    it('infers TypeScript from .ts files', () => {
      expect(inferLanguageFromPath('src/index.ts')).toBe('typescript');
      expect(inferLanguageFromPath('component.tsx')).toBe('typescript');
    });

    it('infers JavaScript from .js files', () => {
      expect(inferLanguageFromPath('app.js')).toBe('javascript');
      expect(inferLanguageFromPath('component.jsx')).toBe('javascript');
    });

    it('infers Dart from .dart files', () => {
      expect(inferLanguageFromPath('lib/main.dart')).toBe('dart');
    });

    it('infers Python from .py files', () => {
      expect(inferLanguageFromPath('script.py')).toBe('python');
    });

    it('infers SQL from .sql files', () => {
      expect(inferLanguageFromPath('migrations/001.sql')).toBe('sql');
    });

    it('infers YAML from .yaml and .yml files', () => {
      expect(inferLanguageFromPath('config.yaml')).toBe('yaml');
      expect(inferLanguageFromPath('docker-compose.yml')).toBe('yaml');
    });

    it('returns undefined for unknown extensions', () => {
      expect(inferLanguageFromPath('file.xyz')).toBeUndefined();
    });

    it('returns undefined for empty path', () => {
      expect(inferLanguageFromPath('')).toBeUndefined();
    });
  });

  describe('inferLanguages', () => {
    it('infers language from file path', () => {
      expect(inferLanguages('src/app.ts')).toEqual(['typescript']);
    });

    it('infers Dart from Flutter imports in content', () => {
      const content = "import 'package:flutter/material.dart';";
      expect(inferLanguages(undefined, content)).toContain('dart');
    });

    it('infers TypeScript from React imports in content', () => {
      const content = "import React from 'react';";
      expect(inferLanguages(undefined, content)).toContain('typescript');
    });

    it('infers SQL from SQL statements in content', () => {
      const content = 'CREATE TABLE users (id INT PRIMARY KEY);';
      expect(inferLanguages(undefined, content)).toContain('sql');
    });

    it("returns 'unknown' as default when no language detected", () => {
      expect(inferLanguages()).toEqual(['unknown']);
    });

    it('combines languages from path and content', () => {
      const content = 'SELECT * FROM users;';
      const languages = inferLanguages('app.ts', content);
      expect(languages).toContain('typescript');
      expect(languages).toContain('sql');
    });
  });

  describe('inferChunkType', () => {
    it('returns sql for .sql files', () => {
      expect(inferChunkType('migration.sql')).toBe('sql');
    });

    it('returns config for config files', () => {
      expect(inferChunkType('config.yaml')).toBe('config');
      expect(inferChunkType('settings.json')).toBe('config');
      expect(inferChunkType('.env')).toBe('config');
    });

    it('returns code for code files', () => {
      expect(inferChunkType('app.ts')).toBe('code');
      expect(inferChunkType('main.dart')).toBe('code');
      expect(inferChunkType('script.py')).toBe('code');
    });

    it('returns sql for SQL content', () => {
      expect(inferChunkType(undefined, 'CREATE TABLE users (id INT);')).toBe('sql');
      expect(inferChunkType(undefined, 'ALTER TABLE users ADD COLUMN name TEXT;')).toBe('sql');
    });

    it('returns heading for markdown headings', () => {
      expect(inferChunkType(undefined, '# Main Title')).toBe('heading');
      expect(inferChunkType(undefined, '## Section')).toBe('heading');
    });

    it('returns list for list content', () => {
      expect(inferChunkType(undefined, '- Item 1\n- Item 2')).toBe('list');
      expect(inferChunkType(undefined, '1. First\n2. Second')).toBe('list');
    });

    it('returns text as default', () => {
      expect(inferChunkType()).toBe('text');
      expect(inferChunkType(undefined, 'Just some plain text.')).toBe('text');
    });
  });

  describe('validateDocumentMetadata', () => {
    it('validates complete metadata successfully', () => {
      const metadata = {
        source: 'https://github.com/flutter/flutter',
        source_type: 'repo' as const,
        languages: ['dart'],
        ingested_at: new Date().toISOString(),
      };

      const result = validateDocumentMetadata(metadata);
      expect(result.success).toBe(true);
    });

    it('fails when source is missing', () => {
      const metadata = {
        source_type: 'repo' as const,
        languages: ['dart'],
        ingested_at: new Date().toISOString(),
      };

      const result = validateDocumentMetadata(metadata);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((e) => e.field === 'source')).toBe(true);
      }
    });

    it('fails when languages array is empty', () => {
      const metadata = {
        source: 'https://example.com',
        source_type: 'url' as const,
        languages: [],
        ingested_at: new Date().toISOString(),
      };

      const result = validateDocumentMetadata(metadata);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((e) => e.field === 'languages')).toBe(true);
      }
    });

    it('fails when ingested_at is not a valid ISO timestamp', () => {
      const metadata = {
        source: 'https://example.com',
        source_type: 'url' as const,
        languages: ['typescript'],
        ingested_at: 'not-a-date',
      };

      const result = validateDocumentMetadata(metadata);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((e) => e.field === 'ingested_at')).toBe(true);
      }
    });

    it('accepts optional framework_version and commit_sha', () => {
      const metadata = {
        source: 'https://github.com/flutter/flutter',
        source_type: 'repo' as const,
        languages: ['dart'],
        ingested_at: new Date().toISOString(),
        framework_version: 'Flutter 3.24.5',
        commit_sha: 'abc123def456',
      };

      const result = validateDocumentMetadata(metadata);
      expect(result.success).toBe(true);
    });
  });

  describe('validateChunkMetadata', () => {
    it('validates complete metadata successfully', () => {
      const metadata = {
        chunk_type: 'code' as const,
        startOffset: 0,
        endOffset: 100,
      };

      const result = validateChunkMetadata(metadata);
      expect(result.success).toBe(true);
    });

    it('fails when chunk_type is missing', () => {
      const metadata = {
        startOffset: 0,
        endOffset: 100,
      };

      const result = validateChunkMetadata(metadata);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((e) => e.field === 'chunk_type')).toBe(true);
      }
    });

    it('fails when startOffset is negative', () => {
      const metadata = {
        chunk_type: 'text' as const,
        startOffset: -1,
        endOffset: 100,
      };

      const result = validateChunkMetadata(metadata);
      expect(result.success).toBe(false);
    });

    it('fails when endOffset is less than startOffset', () => {
      const metadata = {
        chunk_type: 'text' as const,
        startOffset: 100,
        endOffset: 50,
      };

      const result = validateChunkMetadata(metadata);
      expect(result.success).toBe(false);
    });

    it('accepts optional fields', () => {
      const metadata = {
        chunk_type: 'code' as const,
        startOffset: 0,
        endOffset: 100,
        language: 'typescript',
        file_path: 'src/app.ts',
        class_name: 'MyClass',
        function_name: 'myFunction',
      };

      const result = validateChunkMetadata(metadata);
      expect(result.success).toBe(true);
    });
  });

  describe('assertValidDocumentMetadata', () => {
    it('does not throw for valid metadata', () => {
      const metadata = {
        source: 'https://example.com',
        source_type: 'url' as const,
        languages: ['typescript'],
        ingested_at: new Date().toISOString(),
      };

      expect(() => assertValidDocumentMetadata(metadata)).not.toThrow();
    });

    it('throws for invalid metadata', () => {
      const metadata = {
        source_type: 'url' as const,
        languages: [],
      };

      expect(() => assertValidDocumentMetadata(metadata)).toThrow('Invalid document metadata');
    });
  });

  describe('assertValidChunkMetadata', () => {
    it('does not throw for valid metadata', () => {
      const metadata = {
        chunk_type: 'text' as const,
        startOffset: 0,
        endOffset: 100,
      };

      expect(() => assertValidChunkMetadata(metadata)).not.toThrow();
    });

    it('throws for invalid metadata', () => {
      const metadata = {
        startOffset: 0,
      };

      expect(() => assertValidChunkMetadata(metadata)).toThrow('Invalid chunk metadata');
    });
  });

  describe('inferDocumentMetadata', () => {
    it('infers all required fields from context', () => {
      const result = inferDocumentMetadata(
        {},
        {
          filePath: 'lib/main.dart',
          sourceUrl: 'https://github.com/user/repo',
        }
      );

      expect(result.source).toBe('https://github.com/user/repo');
      expect(result.source_type).toBe('repo');
      expect(result.languages).toContain('dart');
      expect(result.ingested_at).toBeDefined();
    });

    it('preserves existing metadata values', () => {
      const result = inferDocumentMetadata(
        {
          source: 'custom-source',
          languages: ['python'],
          framework_version: 'Django 4.0',
        },
        {
          filePath: 'app.ts',
        }
      );

      expect(result.source).toBe('custom-source');
      expect(result.languages).toEqual(['python']);
      expect(result.framework_version).toBe('Django 4.0');
    });

    it('uses file path as source when no URL provided', () => {
      const result = inferDocumentMetadata(
        {},
        {
          filePath: '/home/user/project/main.dart',
        }
      );

      expect(result.source).toBe('/home/user/project/main.dart');
      expect(result.source_type).toBe('file');
    });
  });

  describe('inferChunkMetadata', () => {
    it('infers all required fields from context', () => {
      const result = inferChunkMetadata(
        {},
        {
          filePath: 'src/app.ts',
          content: 'const x = 1;',
          startOffset: 0,
          endOffset: 12,
        }
      );

      expect(result.chunk_type).toBe('code');
      expect(result.startOffset).toBe(0);
      expect(result.endOffset).toBe(12);
      expect(result.language).toBe('typescript');
      expect(result.file_path).toBe('src/app.ts');
    });

    it('preserves existing metadata values', () => {
      const result = inferChunkMetadata(
        {
          chunk_type: 'sql',
          class_name: 'MyClass',
        },
        {
          filePath: 'app.ts',
          startOffset: 10,
          endOffset: 50,
        }
      );

      expect(result.chunk_type).toBe('sql');
      expect(result.class_name).toBe('MyClass');
      expect(result.startOffset).toBe(10);
      expect(result.endOffset).toBe(50);
    });

    it('uses content length as endOffset when not provided', () => {
      const content = 'Hello, World!';
      const result = inferChunkMetadata(
        {},
        {
          content,
        }
      );

      expect(result.endOffset).toBe(content.length);
    });
  });

  describe('hasRequiredDocumentMetadata', () => {
    it('returns true for complete metadata', () => {
      const metadata = {
        source: 'https://example.com',
        source_type: 'url' as const,
        languages: ['typescript'],
        ingested_at: new Date().toISOString(),
      };

      expect(hasRequiredDocumentMetadata(metadata)).toBe(true);
    });

    it('returns false for incomplete metadata', () => {
      const metadata = {
        source: 'https://example.com',
      };

      expect(hasRequiredDocumentMetadata(metadata)).toBe(false);
    });
  });

  describe('hasRequiredChunkMetadata', () => {
    it('returns true for complete metadata', () => {
      const metadata = {
        chunk_type: 'text' as const,
        startOffset: 0,
        endOffset: 100,
      };

      expect(hasRequiredChunkMetadata(metadata)).toBe(true);
    });

    it('returns false for incomplete metadata', () => {
      const metadata = {
        chunk_type: 'text' as const,
      };

      expect(hasRequiredChunkMetadata(metadata)).toBe(false);
    });
  });

  describe('getMissingDocumentFields', () => {
    it('returns empty array for complete metadata', () => {
      const metadata = {
        source: 'https://example.com',
        source_type: 'url' as const,
        languages: ['typescript'],
        ingested_at: new Date().toISOString(),
      };

      expect(getMissingDocumentFields(metadata)).toEqual([]);
    });

    it('returns list of missing fields', () => {
      const metadata = {
        source: 'https://example.com',
      };

      const missing = getMissingDocumentFields(metadata);
      expect(missing).toContain('source_type');
      expect(missing).toContain('languages');
      expect(missing).toContain('ingested_at');
    });
  });

  describe('getMissingChunkFields', () => {
    it('returns empty array for complete metadata', () => {
      const metadata = {
        chunk_type: 'text' as const,
        startOffset: 0,
        endOffset: 100,
      };

      expect(getMissingChunkFields(metadata)).toEqual([]);
    });

    it('returns list of missing fields', () => {
      const metadata = {
        chunk_type: 'text' as const,
      };

      const missing = getMissingChunkFields(metadata);
      expect(missing).toContain('startOffset');
      expect(missing).toContain('endOffset');
    });
  });
});
