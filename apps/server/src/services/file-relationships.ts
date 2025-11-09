import type { Pool } from 'pg';
import type { DartAST } from '../pipeline/dart-analyzer.js';

export type RelationshipType = 'import' | 'usage' | 'test' | 'sibling' | 'parent';

export interface FileRelationship {
  sourceFile: string;
  targetFile: string;
  type: RelationshipType;
  metadata?: {
    symbols?: string[];
    importAlias?: string;
    [key: string]: unknown;
  };
}

export interface RelatedFiles {
  imports: string[];
  imported_by: string[];
  uses: string[];
  used_by: string[];
  tests: string[];
  tested_by: string[];
  siblings: string[];
  parent: string | null;
}

/**
 * Track a file relationship in the database
 */
export async function trackFileRelationship(
  db: Pool,
  collectionId: string,
  relationship: FileRelationship
): Promise<void> {
  await db.query(
    `INSERT INTO file_relationships
     (collection_id, source_file, target_file, relationship_type, metadata)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (collection_id, source_file, target_file, relationship_type)
     DO UPDATE SET metadata = $5, created_at = NOW()`,
    [
      collectionId,
      relationship.sourceFile,
      relationship.targetFile,
      relationship.type,
      JSON.stringify(relationship.metadata || {}),
    ]
  );
}

/**
 * Get all related files for a given file
 */
export async function getRelatedFiles(
  db: Pool,
  filePath: string,
  collectionId: string
): Promise<RelatedFiles> {
  try {
    const { rows } = await db.query(
      `SELECT 
        source_file,
        target_file,
        relationship_type,
        metadata
      FROM file_relationships
      WHERE collection_id = $1
        AND (source_file = $2 OR target_file = $2)`,
      [collectionId, filePath]
    );

    const related: RelatedFiles = {
      imports: [],
      imported_by: [],
      uses: [],
      used_by: [],
      tests: [],
      tested_by: [],
      siblings: [],
      parent: null,
    };

    for (const row of rows) {
      const isSource = row.source_file === filePath;

      switch (row.relationship_type) {
        case 'import':
          if (isSource) {
            related.imports.push(row.target_file);
          } else {
            related.imported_by.push(row.source_file);
          }
          break;

        case 'usage':
          if (isSource) {
            related.uses.push(row.target_file);
          } else {
            related.used_by.push(row.source_file);
          }
          break;

        case 'test':
          if (isSource) {
            related.tests.push(row.target_file);
          } else {
            related.tested_by.push(row.source_file);
          }
          break;

        case 'sibling':
          related.siblings.push(isSource ? row.target_file : row.source_file);
          break;

        case 'parent':
          if (isSource) {
            related.parent = row.target_file;
          }
          break;
      }
    }

    return related;
  } catch (error) {
    console.error(
      `Failed to fetch related files for ${filePath} in collection ${collectionId}`,
      error
    );
    throw error;
  }
}

/**
 * Build relationships for a file during ingestion
 */
export async function buildFileRelationships(
  db: Pool,
  collectionId: string,
  filePath: string,
  ast: DartAST
): Promise<void> {
  try {
    // Track imports
    for (const importStmt of ast.imports) {
      const targetPath = resolveImportPath(importStmt.uri, filePath);

      await trackFileRelationship(db, collectionId, {
        sourceFile: filePath,
        targetFile: targetPath,
        type: 'import',
        metadata: {
          importAlias: importStmt.prefix,
        },
      });
    }

    // Track test relationship
    if (isTestFile(filePath)) {
      const sourceFile = getSourceFileForTest(filePath);
      if (sourceFile) {
        await trackFileRelationship(db, collectionId, {
          sourceFile: sourceFile,
          targetFile: filePath,
          type: 'test',
        });
      }
    }

    // Track siblings (files in same directory)
    const siblings = await findSiblingFiles(db, collectionId, filePath);
    for (const sibling of siblings) {
      await trackFileRelationship(db, collectionId, {
        sourceFile: filePath,
        targetFile: sibling,
        type: 'sibling',
      });
    }
  } catch (error) {
    console.error(`Failed to build file relationships for ${filePath}:`, error);
    // Don't throw - relationship tracking is optional
  }
}

/**
 * Resolve import path to absolute file path
 */
export function resolveImportPath(importUri: string, currentFile: string): string {
  // Package imports (e.g., package:flutter/material.dart)
  if (importUri.startsWith('package:')) {
    return importUri;
  }

  // Relative imports (e.g., ../models/user.dart)
  if (importUri.startsWith('.')) {
    const currentDir = currentFile.substring(0, currentFile.lastIndexOf('/'));
    return resolvePath(currentDir, importUri);
  }

  // Absolute imports from lib/
  return `lib/${importUri}`;
}

/**
 * Resolve relative path
 */
function resolvePath(base: string, relative: string): string {
  const parts = base.split('/');
  const relativeParts = relative.split('/');

  for (const part of relativeParts) {
    if (part === '..') {
      parts.pop();
    } else if (part !== '.') {
      parts.push(part);
    }
  }

  return parts.join('/');
}

/**
 * Check if file is a test file
 */
export function isTestFile(filePath: string): boolean {
  return filePath.includes('_test.dart') || filePath.startsWith('test/');
}

/**
 * Get source file path from test file path
 */
export function getSourceFileForTest(testPath: string): string | null {
  if (testPath.startsWith('test/')) {
    // test/services/auth_service_test.dart -> lib/services/auth_service.dart
    const sourcePath = testPath.replace('test/', 'lib/').replace('_test.dart', '.dart');
    return sourcePath;
  }

  if (testPath.includes('_test.dart')) {
    // lib/services/auth_service_test.dart -> lib/services/auth_service.dart
    return testPath.replace('_test.dart', '.dart');
  }

  return null;
}

/**
 * Find sibling files (in same directory)
 */
async function findSiblingFiles(
  db: Pool,
  collectionId: string,
  filePath: string
): Promise<string[]> {
  const separatorIndex = filePath.lastIndexOf('/');

  if (separatorIndex === -1) {
    return [];
  }

  const directory = filePath.substring(0, separatorIndex);
  const pattern = `${escapeForLike(directory)}/%`;

  // Query documents in same directory
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT file_path
      FROM documents
      WHERE collection_id = $1
        AND file_path LIKE $2 ESCAPE '\\'
        AND file_path != $3`,
      [collectionId, pattern, filePath]
    );

    return rows.map((r) => r.file_path).filter(Boolean);
  } catch (error) {
    console.error(
      `Failed to find sibling files for ${filePath} in collection ${collectionId} with pattern ${pattern}`,
      error
    );
    throw error;
  }
}

/**
 * Escape %, _ and \ so they are treated literally in LIKE comparisons.
 */
function escapeForLike(value: string): string {
  return value.replace(/([\\%_])/g, '\\$1');
}
