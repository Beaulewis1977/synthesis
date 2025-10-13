# Phase 13: File Relationships

**Track dependencies and connections between code files**

---

## 🎯 Purpose

Build a knowledge graph of file relationships to:
1. **Track imports** - Which files import which
2. **Map dependencies** - Which symbols are used where
3. **Link tests** - Connect test files to source files
4. **Suggest related files** - Show connected files in search results
5. **Enable navigation** - Browse codebase via relationships

---

## 🗄️ Database Schema

**File:** `packages/db/migrations/006_file_relationships.sql`

```sql
CREATE TABLE file_relationships (
  id SERIAL PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  source_file TEXT NOT NULL,
  target_file TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  -- Types: 'import', 'usage', 'test', 'sibling', 'parent'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicates
  UNIQUE(collection_id, source_file, target_file, relationship_type)
);

-- Indexes for efficient queries
CREATE INDEX file_relationships_collection_idx 
  ON file_relationships(collection_id);
CREATE INDEX file_relationships_source_idx 
  ON file_relationships(source_file);
CREATE INDEX file_relationships_target_idx 
  ON file_relationships(target_file);
CREATE INDEX file_relationships_type_idx 
  ON file_relationships(relationship_type);

-- Composite index for common queries
CREATE INDEX file_relationships_source_type_idx 
  ON file_relationships(source_file, relationship_type);
```

---

## 📦 Implementation

### Relationship Tracker Service

**File:** `apps/server/src/services/file-relationships.ts`

```typescript
import type { Pool } from 'pg';

export type RelationshipType = 'import' | 'usage' | 'test' | 'sibling' | 'parent';

export interface FileRelationship {
  sourceFile: string;
  targetFile: string;
  type: RelationshipType;
  metadata?: {
    symbols?: string[];        // For 'usage' type
    importAlias?: string;      // For 'import' type
    [key: string]: any;
  };
}

export interface RelatedFiles {
  imports: string[];           // Files this file imports
  imported_by: string[];       // Files that import this file
  uses: string[];              // Files this file uses symbols from
  used_by: string[];           // Files that use symbols from this file
  tests: string[];             // Test files for this file
  tested_by: string[];         // Source file this test file tests
  siblings: string[];          // Files in same directory
  parent: string | null;       // Parent directory
}

/**
 * Track a file relationship
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
     DO UPDATE SET metadata = $5`,
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
  // Query all relationships
  const { rows } = await db.query(
    `
    SELECT 
      source_file,
      target_file,
      relationship_type,
      metadata
    FROM file_relationships
    WHERE collection_id = $1
      AND (source_file = $2 OR target_file = $2)
    `,
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
        related.siblings.push(
          isSource ? row.target_file : row.source_file
        );
        break;
        
      case 'parent':
        if (isSource) {
          related.parent = row.target_file;
        }
        break;
    }
  }
  
  return related;
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
  // 1. Track imports
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
  
  // 2. Track usage (symbols used from imports)
  const usedSymbols = extractUsedSymbols(ast);
  for (const [file, symbols] of Object.entries(usedSymbols)) {
    await trackFileRelationship(db, collectionId, {
      sourceFile: filePath,
      targetFile: file,
      type: 'usage',
      metadata: { symbols },
    });
  }
  
  // 3. Track test relationship
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
  
  // 4. Track siblings (files in same directory)
  const siblings = await findSiblingFiles(db, collectionId, filePath);
  for (const sibling of siblings) {
    await trackFileRelationship(db, collectionId, {
      sourceFile: filePath,
      targetFile: sibling,
      type: 'sibling',
    });
  }
}

/**
 * Resolve import path to absolute file path
 */
function resolveImportPath(importUri: string, currentFile: string): string {
  // Package imports (e.g., package:flutter/material.dart)
  if (importUri.startsWith('package:')) {
    return importUri; // Keep as-is for package imports
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
 * Extract used symbols from AST
 */
function extractUsedSymbols(ast: DartAST): Record<string, string[]> {
  const used: Record<string, string[]> = {};
  
  // Analyze function bodies and class methods for symbol usage
  // This is simplified - real implementation would parse expressions
  
  for (const func of ast.functions) {
    const symbols = extractSymbolsFromCode(func.code);
    for (const [file, syms] of Object.entries(symbols)) {
      used[file] = [...(used[file] || []), ...syms];
    }
  }
  
  for (const cls of ast.classes) {
    for (const method of cls.methods) {
      const symbols = extractSymbolsFromCode(method.code);
      for (const [file, syms] of Object.entries(symbols)) {
        used[file] = [...(used[file] || []), ...syms];
      }
    }
  }
  
  return used;
}

/**
 * Extract symbols used in code (simplified)
 */
function extractSymbolsFromCode(code: string): Record<string, string[]> {
  // Simplified: look for capitalized identifiers (likely class names)
  const symbols: Record<string, string[]> = {};
  const matches = code.match(/\b[A-Z][a-zA-Z0-9_]*\b/g) || [];
  
  // Group by likely source (would map to imports in real implementation)
  const uniqueSymbols = [...new Set(matches)];
  
  // For now, return as generic
  if (uniqueSymbols.length > 0) {
    symbols['unknown'] = uniqueSymbols;
  }
  
  return symbols;
}

/**
 * Check if file is a test file
 */
function isTestFile(filePath: string): boolean {
  return filePath.includes('_test.dart') || 
         filePath.startsWith('test/');
}

/**
 * Get source file path from test file path
 */
function getSourceFileForTest(testPath: string): string | null {
  if (testPath.startsWith('test/')) {
    // test/services/auth_service_test.dart -> lib/services/auth_service.dart
    const sourcePath = testPath
      .replace('test/', 'lib/')
      .replace('_test.dart', '.dart');
    return sourcePath;
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
  const directory = filePath.substring(0, filePath.lastIndexOf('/'));
  
  // Query documents in same directory
  const { rows } = await db.query(
    `
    SELECT DISTINCT metadata->>'file_path' as file_path
    FROM documents
    WHERE collection_id = $1
      AND metadata->>'file_path' LIKE $2
      AND metadata->>'file_path' != $3
    `,
    [collectionId, `${directory}/%`, filePath]
  );
  
  return rows.map(r => r.file_path).filter(Boolean);
}
```

---

## 🌐 API Endpoint

```typescript
// apps/server/src/routes/docs.ts

app.get('/api/documents/:id/related-files', async (request, reply) => {
  const { id } = request.params;
  
  // Get document
  const { rows } = await db.query(
    'SELECT file_path, collection_id, metadata FROM documents WHERE id = $1',
    [id]
  );
  
  if (rows.length === 0) {
    return reply.code(404).send({ error: 'Document not found' });
  }
  
  const doc = rows[0];
  const filePath = doc.metadata?.file_path;
  
  if (!filePath) {
    return { related_files: null };
  }
  
  // Get related files
  const related = await getRelatedFiles(db, filePath, doc.collection_id);
  
  return {
    file_path: filePath,
    related_files: related,
  };
});
```

---

## 🔍 Integration with Search

### Enhance Search Results with Related Files

```typescript
// apps/server/src/services/search.ts

export async function searchWithRelatedFiles(
  db: Pool,
  params: SearchParams
): Promise<SearchResultWithRelated[]> {
  // 1. Regular search
  const results = await searchWithReranking(db, params);
  
  // 2. Enrich with related files
  const enriched = await Promise.all(
    results.map(async result => {
      const filePath = result.metadata?.file_path;
      
      if (!filePath) {
        return { ...result, related_files: null };
      }
      
      const related = await getRelatedFiles(
        db,
        filePath,
        params.collectionId
      );
      
      return {
        ...result,
        related_files: related,
      };
    })
  );
  
  return enriched;
}
```

---

## 📊 Relationship Visualization

### Get Dependency Graph

```typescript
export async function getDependencyGraph(
  db: Pool,
  collectionId: string,
  rootFile?: string
): Promise<DependencyGraph> {
  const query = rootFile
    ? `SELECT * FROM file_relationships 
       WHERE collection_id = $1 AND source_file = $2`
    : `SELECT * FROM file_relationships WHERE collection_id = $1`;
  
  const params = rootFile ? [collectionId, rootFile] : [collectionId];
  const { rows } = await db.query(query, params);
  
  // Build graph structure
  const nodes = new Set<string>();
  const edges: Array<{ source: string; target: string; type: string }> = [];
  
  for (const row of rows) {
    nodes.add(row.source_file);
    nodes.add(row.target_file);
    edges.push({
      source: row.source_file,
      target: row.target_file,
      type: row.relationship_type,
    });
  }
  
  return {
    nodes: Array.from(nodes),
    edges,
  };
}
```

---

## 🧪 Testing

```typescript
describe('File Relationships', () => {
  it('tracks import relationships', async () => {
    await trackFileRelationship(db, collectionId, {
      sourceFile: 'lib/services/auth.dart',
      targetFile: 'lib/models/user.dart',
      type: 'import',
    });
    
    const related = await getRelatedFiles(
      db,
      'lib/services/auth.dart',
      collectionId
    );
    
    expect(related.imports).toContain('lib/models/user.dart');
  });
  
  it('detects test relationships', async () => {
    const testFile = 'test/services/auth_test.dart';
    const sourceFile = getSourceFileForTest(testFile);
    
    expect(sourceFile).toBe('lib/services/auth.dart');
  });
  
  it('finds sibling files', async () => {
    const siblings = await findSiblingFiles(
      db,
      collectionId,
      'lib/services/auth.dart'
    );
    
    expect(siblings).toContain('lib/services/user.dart');
  });
});
```

---

## 🎨 Use Cases

### Use Case 1: Code Search with Context

**Query:** "login function"

**Response includes:**
```json
{
  "text": "Future<User> login(...) { ... }",
  "file_path": "lib/services/auth_service.dart",
  "related_files": {
    "imports": [
      "lib/models/user.dart",
      "package:http/http.dart"
    ],
    "tests": [
      "test/services/auth_service_test.dart"
    ],
    "siblings": [
      "lib/services/user_service.dart",
      "lib/services/session_service.dart"
    ]
  }
}
```

### Use Case 2: Navigate Codebase

User clicks "Show related files" → See import tree and dependencies

### Use Case 3: Impact Analysis

"What files use this class?" → Query `used_by` relationships

---

## ✅ Acceptance Criteria

- [ ] Import relationships tracked accurately
- [ ] Usage relationships detect symbol usage
- [ ] Test files linked to source files
- [ ] Sibling files identified correctly
- [ ] API endpoint returns related files
- [ ] Search results include related files
- [ ] Dependency graph can be generated
- [ ] Performance: <100ms to get related files

---

**Next:** See `04_BUILD_PLAN.md` for implementation schedule

---

**Phase 13 Documentation Complete!** 🎉
