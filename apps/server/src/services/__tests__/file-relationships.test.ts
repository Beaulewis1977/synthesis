import type { Pool } from 'pg';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  getRelatedFiles,
  getSourceFileForTest,
  isTestFile,
  resolveImportPath,
  trackFileRelationship,
} from '../file-relationships.js';

// Mock database pool
const mockQuery = async (
  text: string,
  params?: unknown[]
): Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number }> => {
  // Mock responses based on query
  if (text.includes('INSERT INTO file_relationships')) {
    return { rows: [], rowCount: 1 };
  }

  if (text.includes('SELECT') && text.includes('file_relationships')) {
    // Return mock relationships
    return {
      rows: [
        {
          source_file: 'lib/services/auth.dart',
          target_file: 'lib/models/user.dart',
          relationship_type: 'import',
          metadata: { importAlias: null },
        },
        {
          source_file: 'lib/services/auth.dart',
          target_file: 'package:flutter/material.dart',
          relationship_type: 'import',
          metadata: {},
        },
        {
          source_file: 'lib/services/auth.dart',
          target_file: 'lib/services/api.dart',
          relationship_type: 'sibling',
          metadata: {},
        },
      ],
    };
  }

  if (text.includes('SELECT DISTINCT file_path FROM documents')) {
    // Return mock sibling files
    return {
      rows: [{ file_path: 'lib/services/api.dart' }, { file_path: 'lib/services/user.dart' }],
    };
  }

  return { rows: [] };
};

const mockDb = {
  query: mockQuery,
} as unknown as Pool;

describe('File Relationships', () => {
  const collectionId = 'test-collection-123';

  describe('trackFileRelationship', () => {
    it('tracks import relationship', async () => {
      await expect(
        trackFileRelationship(mockDb, collectionId, {
          sourceFile: 'lib/services/auth.dart',
          targetFile: 'lib/models/user.dart',
          type: 'import',
        })
      ).resolves.not.toThrow();
    });

    it('tracks import with metadata', async () => {
      await expect(
        trackFileRelationship(mockDb, collectionId, {
          sourceFile: 'lib/services/auth.dart',
          targetFile: 'lib/models/user.dart',
          type: 'import',
          metadata: {
            importAlias: 'auth',
          },
        })
      ).resolves.not.toThrow();
    });

    it('tracks test relationship', async () => {
      await expect(
        trackFileRelationship(mockDb, collectionId, {
          sourceFile: 'lib/services/auth.dart',
          targetFile: 'test/services/auth_test.dart',
          type: 'test',
        })
      ).resolves.not.toThrow();
    });

    it('tracks sibling relationship', async () => {
      await expect(
        trackFileRelationship(mockDb, collectionId, {
          sourceFile: 'lib/services/auth.dart',
          targetFile: 'lib/services/api.dart',
          type: 'sibling',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('getRelatedFiles', () => {
    it('returns all relationship types', async () => {
      const related = await getRelatedFiles(mockDb, 'lib/services/auth.dart', collectionId);

      expect(related).toHaveProperty('imports');
      expect(related).toHaveProperty('imported_by');
      expect(related).toHaveProperty('uses');
      expect(related).toHaveProperty('used_by');
      expect(related).toHaveProperty('tests');
      expect(related).toHaveProperty('tested_by');
      expect(related).toHaveProperty('siblings');
      expect(related).toHaveProperty('parent');
    });

    it('categorizes imports correctly', async () => {
      const related = await getRelatedFiles(mockDb, 'lib/services/auth.dart', collectionId);

      expect(related.imports).toContain('lib/models/user.dart');
      expect(related.imports).toContain('package:flutter/material.dart');
    });

    it('categorizes siblings correctly', async () => {
      const related = await getRelatedFiles(mockDb, 'lib/services/auth.dart', collectionId);

      expect(related.siblings).toContain('lib/services/api.dart');
    });

    it('returns empty arrays when no relationships exist', async () => {
      const emptyDb = {
        query: async () => ({ rows: [] }),
      } as unknown as Pool;

      const related = await getRelatedFiles(emptyDb, 'nonexistent.dart', collectionId);

      expect(related.imports).toEqual([]);
      expect(related.imported_by).toEqual([]);
      expect(related.tests).toEqual([]);
      expect(related.siblings).toEqual([]);
    });
  });

  describe('resolveImportPath', () => {
    it('keeps package imports as-is', () => {
      const resolved = resolveImportPath('package:flutter/material.dart', 'lib/services/auth.dart');
      expect(resolved).toBe('package:flutter/material.dart');
    });

    it('resolves relative imports correctly', () => {
      const resolved = resolveImportPath('../models/user.dart', 'lib/services/auth.dart');
      expect(resolved).toBe('lib/models/user.dart');
    });

    it('resolves parent directory imports', () => {
      const resolved = resolveImportPath('../../utils/helper.dart', 'lib/services/api/auth.dart');
      expect(resolved).toBe('lib/utils/helper.dart');
    });

    it('resolves same directory imports', () => {
      const resolved = resolveImportPath('./api.dart', 'lib/services/auth.dart');
      expect(resolved).toBe('lib/services/api.dart');
    });

    it('resolves absolute imports from lib/', () => {
      const resolved = resolveImportPath('models/user.dart', 'lib/services/auth.dart');
      expect(resolved).toBe('lib/models/user.dart');
    });
  });

  describe('isTestFile', () => {
    it('detects _test.dart files', () => {
      expect(isTestFile('lib/services/auth_test.dart')).toBe(true);
      expect(isTestFile('auth_service_test.dart')).toBe(true);
    });

    it('detects files in test/ directory', () => {
      expect(isTestFile('test/services/auth_test.dart')).toBe(true);
      expect(isTestFile('test/widget_test.dart')).toBe(true);
    });

    it('returns false for non-test files', () => {
      expect(isTestFile('lib/services/auth.dart')).toBe(false);
      expect(isTestFile('lib/models/user.dart')).toBe(false);
    });
  });

  describe('getSourceFileForTest', () => {
    it('maps test/ directory to lib/', () => {
      const source = getSourceFileForTest('test/services/auth_service_test.dart');
      expect(source).toBe('lib/services/auth_service.dart');
    });

    it('maps _test.dart suffix correctly', () => {
      const source = getSourceFileForTest('test/widget_test.dart');
      expect(source).toBe('lib/widget.dart');
    });

    it('handles _test.dart in lib/ directory', () => {
      const source = getSourceFileForTest('lib/services/auth_test.dart');
      expect(source).toBe('lib/services/auth.dart');
    });

    it('returns null for non-test files', () => {
      const source = getSourceFileForTest('lib/services/auth.dart');
      expect(source).toBeNull();
    });
  });
});
