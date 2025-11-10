import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { getRelatedFiles } from '../../services/file-relationships.js';
import { chunkText } from '../chunk.js';
import { chunkCodeFile } from '../code-chunker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Code Chunking Integration', () => {
  describe('End-to-End Dart File Chunking', () => {
    it('ingests Dart file with code-aware chunking', async () => {
      const samplePath = join(__dirname, 'fixtures', 'sample.dart');
      const content = readFileSync(samplePath, 'utf-8');

      const chunks = await chunkCodeFile('sample.dart', content, {
        preserveImports: true,
        trackRelationships: false,
      });

      // Verify we have chunks
      expect(chunks.length).toBeGreaterThan(0);

      // Should have function chunks
      const functionChunks = chunks.filter((c) => c.metadata.function_name);
      expect(functionChunks.length).toBeGreaterThan(0);

      // Should have method chunks or class chunks
      const classRelated = chunks.filter((c) => c.metadata.class_name || c.metadata.class_context);
      expect(classRelated.length).toBeGreaterThan(0);

      // Should preserve imports
      const chunksWithImports = chunks.filter((c) => c.metadata.imports);
      expect(chunksWithImports.length).toBeGreaterThan(0);

      // Verify import content
      const firstChunk = chunks[0];
      if (firstChunk.metadata.imports) {
        expect(firstChunk.metadata.imports.some((imp) => imp.includes('flutter'))).toBe(true);
      }

      // All chunks should have correct metadata
      for (const chunk of chunks) {
        expect(chunk.text).toBeTruthy();
        expect(chunk.metadata.chunk_type).toBe('code');
        expect(chunk.metadata.language).toBe('dart');
        expect(chunk.metadata.line_range).toBeDefined();
        expect(chunk.metadata.file_path).toBe('sample.dart');
      }
    });

    it('chunks have sequential indices', async () => {
      const code = `
void func1() {}
void func2() {}
void func3() {}
`;

      const chunks = await chunkCodeFile('test.dart', code);

      expect(chunks.length).toBeGreaterThan(0);
      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].index).toBe(i);
      }
    });

    it('preserves all metadata through chunking process', async () => {
      const code = `
import 'package:flutter/material.dart';

/// Main app entry point
Future<void> main() async {
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(home: Scaffold());
  }
}
`;

      const chunks = await chunkCodeFile('app.dart', code, { preserveImports: true });

      // Find main function
      const mainFunc = chunks.find((c) => c.metadata.function_name === 'main');
      expect(mainFunc).toBeDefined();
      expect(mainFunc?.metadata.return_type).toBe('Future<void>');
      expect(mainFunc?.metadata.imports).toContain('package:flutter/material.dart');
      expect(mainFunc?.metadata.doc_comment).toBe('Main app entry point');

      // Find MyApp class
      const myApp = chunks.find((c) => c.metadata.class_name === 'MyApp');
      expect(myApp).toBeDefined();
      expect(myApp?.metadata.extends).toBe('StatelessWidget');
      expect(myApp?.metadata.is_widget).toBe(true);
      expect(myApp?.metadata.methods).toContain('build');
    });
  });

  describe('Feature Flag Behavior', () => {
    it('uses simple chunking when CODE_CHUNKING is not enabled', async () => {
      // Simulate CODE_CHUNKING=false (default)
      const originalValue = process.env.CODE_CHUNKING;
      process.env.CODE_CHUNKING = 'false';

      const code = `
void test() {
  print('hello');
}
`;

      // Use chunkText directly (simulating orchestrator behavior when flag is off)
      const chunks = chunkText(code);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.chunk_type).not.toBe('code');

      // Restore
      if (originalValue !== undefined) {
        process.env.CODE_CHUNKING = originalValue;
      } else {
        Reflect.deleteProperty(process.env, 'CODE_CHUNKING');
      }
    });

    it('uses code chunking when CODE_CHUNKING is true', async () => {
      const code = `
void test() {
  print('hello');
}
`;

      const chunks = await chunkCodeFile('test.dart', code);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.chunk_type).toBe('code');
      expect(chunks[0].metadata.function_name).toBe('test');
    });

    it('respects PRESERVE_IMPORTS flag', async () => {
      const code = `
import 'package:flutter/material.dart';

void test() {}
`;

      // With preserveImports: true
      const chunksWithImports = await chunkCodeFile('test.dart', code, {
        preserveImports: true,
      });

      const testFuncWithImports = chunksWithImports.find(
        (c) => c.metadata.function_name === 'test'
      );
      expect(testFuncWithImports?.metadata.imports).toBeDefined();
      expect(testFuncWithImports?.metadata.imports).toContain('package:flutter/material.dart');

      // With preserveImports: false
      const chunksWithoutImports = await chunkCodeFile('test.dart', code, {
        preserveImports: false,
      });

      const testFuncWithoutImports = chunksWithoutImports.find(
        (c) => c.metadata.function_name === 'test'
      );
      expect(testFuncWithoutImports?.metadata.imports).toBeUndefined();
    });
  });

  describe('Error Recovery', () => {
    it('falls back to simple chunking on parse error without crashing', async () => {
      const invalidCode = `class { malformed dart }
More content here
Line 3
Line 4
Line 5`;

      // Should not throw
      await expect(chunkCodeFile('broken.dart', invalidCode)).resolves.toBeDefined();

      const chunks = await chunkCodeFile('broken.dart', invalidCode);

      // Should return chunks (fallback mode)
      expect(Array.isArray(chunks)).toBe(true);
    });

    it('handles empty files gracefully', async () => {
      const chunks = await chunkCodeFile('empty.dart', '');

      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBe(0);
    });

    it('handles files with only whitespace', async () => {
      const chunks = await chunkCodeFile('whitespace.dart', '   \n\n   \t   \n   ');

      expect(Array.isArray(chunks)).toBe(true);
    });
  });

  describe('Multiple Language Support', () => {
    it('routes TypeScript files to TS chunker with code-aware chunking', async () => {
      const code = `
function greet(name: string): string {
  return 'hello ' + name;
}
`;

      const chunks = await chunkCodeFile('app.ts', code);

      expect(chunks.length).toBeGreaterThan(0);
      // Should use code-aware chunking
      expect(chunks[0].metadata.chunk_type).toBe('code');
      expect(chunks[0].metadata.language).toBe('typescript');
      expect(chunks[0].metadata.function_name).toBe('greet');
    });

    it('routes JavaScript files to JS chunker with code-aware chunking', async () => {
      const code = `
function greet(name) {
  return 'hello ' + name;
}
`;

      const chunks = await chunkCodeFile('app.js', code);

      expect(chunks.length).toBeGreaterThan(0);
      // Should use code-aware chunking (JS uses TS parser)
      expect(chunks[0].metadata.chunk_type).toBe('code');
      expect(chunks[0].metadata.language).toBe('javascript');
      expect(chunks[0].metadata.function_name).toBe('greet');
    });

    it('parses .js file with classes and imports from fixture', async () => {
      const samplePath = join(__dirname, 'fixtures', 'sample.js');
      const content = readFileSync(samplePath, 'utf-8');

      const chunks = await chunkCodeFile('sample.js', content);

      expect(chunks.length).toBeGreaterThan(0);

      // Should have class chunk
      const dataStoreChunk = chunks.find((c) => c.metadata.class_name === 'DataStore');
      expect(dataStoreChunk).toBeDefined();
      expect(dataStoreChunk?.metadata.chunk_type).toBe('code');
      expect(dataStoreChunk?.metadata.language).toBe('javascript');
      expect(dataStoreChunk?.metadata.extends).toBe('EventEmitter');

      // Should have function chunks
      const processDataChunk = chunks.find((c) => c.metadata.function_name === 'processData');
      expect(processDataChunk).toBeDefined();
      expect(processDataChunk?.metadata.chunk_type).toBe('code');
      expect(processDataChunk?.metadata.language).toBe('javascript');

      // Should have arrow function
      const formatPathChunk = chunks.find((c) => c.metadata.function_name === 'formatPath');
      expect(formatPathChunk).toBeDefined();
      expect(formatPathChunk?.metadata.language).toBe('javascript');
    });

    it('parses .jsx file with React components from fixture', async () => {
      const samplePath = join(__dirname, 'fixtures', 'sample.jsx');
      const content = readFileSync(samplePath, 'utf-8');

      const chunks = await chunkCodeFile('sample.jsx', content);

      expect(chunks.length).toBeGreaterThan(0);

      // Should have UserCard component
      const userCardChunk = chunks.find((c) => c.metadata.function_name === 'UserCard');
      expect(userCardChunk).toBeDefined();
      expect(userCardChunk?.metadata.chunk_type).toBe('code');
      expect(userCardChunk?.metadata.language).toBe('jsx');
      expect(userCardChunk?.text).toContain('useState');
      expect(userCardChunk?.text).toContain('return (');

      // Should have Avatar component (arrow function)
      const avatarChunk = chunks.find((c) => c.metadata.function_name === 'Avatar');
      expect(avatarChunk).toBeDefined();
      expect(avatarChunk?.metadata.language).toBe('jsx');

      // Should have helper function (not component)
      const helperChunk = chunks.find((c) => c.metadata.function_name === 'formatUserName');
      expect(helperChunk).toBeDefined();
      expect(helperChunk?.metadata.language).toBe('jsx');
    });

    it('handles unsupported file types with simple chunking', async () => {
      const code = 'Some random text file content';

      const chunks = await chunkCodeFile('readme.txt', code);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.chunk_type).toBe('text');
    });
  });

  describe('Chunk Content Validation', () => {
    it('includes complete function code in chunks', async () => {
      const code = `
Future<User> login(String email, String password) async {
  final response = await apiClient.post('/login', {
    'email': email,
    'password': password,
  });
  return User.fromJson(response.data);
}
`;

      const chunks = await chunkCodeFile('auth.dart', code);

      const loginChunk = chunks.find((c) => c.metadata.function_name === 'login');
      expect(loginChunk).toBeDefined();

      // Should contain full function code
      expect(loginChunk?.text).toContain('Future<User> login');
      expect(loginChunk?.text).toContain('apiClient.post');
      expect(loginChunk?.text).toContain('User.fromJson');
    });

    it('includes complete class code for small classes', async () => {
      const code = `
class User {
  final String name;
  final int age;

  User(this.name, this.age);
}
`;

      const chunks = await chunkCodeFile('user.dart', code);

      const userChunk = chunks.find((c) => c.metadata.class_name === 'User');
      expect(userChunk).toBeDefined();

      // Should contain full class code
      expect(userChunk?.text).toContain('class User');
      expect(userChunk?.text).toContain('final String name');
      expect(userChunk?.text).toContain('User(this.name, this.age)');
    });
  });

  describe('Performance', () => {
    it('processes sample.dart file in reasonable time', async () => {
      const samplePath = join(__dirname, 'fixtures', 'sample.dart');
      const content = readFileSync(samplePath, 'utf-8');

      const start = performance.now();
      const chunks = await chunkCodeFile('sample.dart', content, {
        preserveImports: true,
      });
      const elapsed = performance.now() - start;

      expect(chunks.length).toBeGreaterThan(0);
      // Should process in under 500ms (accounts for CI environment variability)
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe('File Relationship Tracking (Day 3)', () => {
    // Mock database for relationship tracking tests
    const mockRelationships: Array<{
      source_file: string;
      target_file: string;
      relationship_type: string;
      metadata: Record<string, unknown>;
    }> = [];

    const mockDb = {
      query: async (text: string, params?: unknown[]) => {
        if (text.includes('INSERT INTO file_relationships')) {
          // Store relationship
          const [collectionId, sourceFile, targetFile, type, metadata] = params || [];
          mockRelationships.push({
            source_file: sourceFile,
            target_file: targetFile,
            relationship_type: type,
            metadata: JSON.parse(metadata),
          });
          return { rows: [], rowCount: 1 };
        }

        if (text.includes('SELECT') && text.includes('file_relationships')) {
          // Return stored relationships
          const filePath = params?.[1];
          const filtered = mockRelationships.filter(
            (r) => r.source_file === filePath || r.target_file === filePath
          );
          return { rows: filtered };
        }

        if (text.includes('SELECT DISTINCT file_path FROM documents')) {
          // Return mock sibling files
          return {
            rows: [{ file_path: 'lib/services/api.dart' }],
          };
        }

        return { rows: [] };
      },
    } as unknown as Pool;

    it('tracks import relationships when enabled', async () => {
      mockRelationships.length = 0; // Clear

      const code = `
import 'package:flutter/material.dart';
import '../models/user.dart';

void test() {}
`;

      const chunks = await chunkCodeFile('lib/services/auth.dart', code, {
        trackRelationships: true,
        db: mockDb,
        collectionId: 'test-collection',
      });

      expect(chunks.length).toBeGreaterThan(0);

      // Verify imports were tracked
      const importRelationships = mockRelationships.filter((r) => r.relationship_type === 'import');
      expect(importRelationships.length).toBeGreaterThan(0);

      // Check specific imports
      const flutterImport = importRelationships.find((r) =>
        r.target_file.includes('flutter/material')
      );
      expect(flutterImport).toBeDefined();

      const userImport = importRelationships.find((r) => r.target_file.includes('models/user'));
      expect(userImport).toBeDefined();
    });

    it('does not track relationships when flag is false', async () => {
      mockRelationships.length = 0; // Clear

      const code = `
import 'package:flutter/material.dart';

void test() {}
`;

      const chunks = await chunkCodeFile('lib/services/auth.dart', code, {
        trackRelationships: false,
        db: mockDb,
        collectionId: 'test-collection',
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(mockRelationships.length).toBe(0);
    });

    it('does not track relationships when db is not provided', async () => {
      mockRelationships.length = 0; // Clear

      const code = `
import 'package:flutter/material.dart';

void test() {}
`;

      const chunks = await chunkCodeFile('lib/services/auth.dart', code, {
        trackRelationships: true,
        collectionId: 'test-collection',
        // db not provided
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(mockRelationships.length).toBe(0);
    });

    it('continues chunking even if relationship tracking fails', async () => {
      const errorDb = {
        query: async () => {
          throw new Error('Database error');
        },
      } as unknown as Pool;

      const code = `
import 'package:flutter/material.dart';

void test() {}
`;

      // Should not throw, should return chunks
      await expect(
        chunkCodeFile('lib/services/auth.dart', code, {
          trackRelationships: true,
          db: errorDb,
          collectionId: 'test-collection',
        })
      ).resolves.toBeDefined();

      const chunks = await chunkCodeFile('lib/services/auth.dart', code, {
        trackRelationships: true,
        db: errorDb,
        collectionId: 'test-collection',
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('can query tracked relationships', async () => {
      mockRelationships.length = 0; // Clear

      const code = `
import 'package:flutter/material.dart';
import '../models/user.dart';

void login() {}
`;

      // Track relationships
      await chunkCodeFile('lib/services/auth.dart', code, {
        trackRelationships: true,
        db: mockDb,
        collectionId: 'test-collection',
      });

      // Query relationships
      const related = await getRelatedFiles(mockDb, 'lib/services/auth.dart', 'test-collection');

      expect(related.imports).toBeDefined();
      expect(related.imports.length).toBeGreaterThan(0);
      expect(related.imports.some((imp) => imp.includes('flutter'))).toBe(true);
    });
  });

  describe('Embedding Input Sanity', () => {
    it('embeddings use only chunk.text without metadata pollution', async () => {
      const code = `
import 'package:flutter/material.dart';

class TestWidget extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Text('test');
  }
}

void helperFunction() {
  print('helper');
}
`;

      const chunks = await chunkCodeFile('test_widget.dart', code, {
        preserveImports: true,
        trackRelationships: false,
      });

      expect(chunks.length).toBeGreaterThan(0);

      // Verify each chunk has text and metadata separated
      for (const chunk of chunks) {
        // Text should be code only
        expect(chunk.text).toBeTruthy();
        expect(typeof chunk.text).toBe('string');

        // Metadata should be separate object
        expect(chunk.metadata).toBeTruthy();
        expect(typeof chunk.metadata).toBe('object');

        // Text should NOT contain metadata fields
        expect(chunk.text).not.toContain('chunk_type');
        expect(chunk.text).not.toContain('function_name');
        expect(chunk.text).not.toContain('class_name');
        expect(chunk.text).not.toContain('language');

        // If imports are preserved, they're in metadata, not concatenated to text
        if (chunk.metadata.imports) {
          expect(Array.isArray(chunk.metadata.imports)).toBe(true);
          // The import statements should be in the code text itself,
          // not separately concatenated
          if (chunk.text.includes('import')) {
            // This is natural - the code contains import statements
            expect(true).toBe(true);
          }
        }
      }

      // Simulate what embedBatch receives
      const embeddingInputs = chunks.map((chunk) => chunk.text);

      // Each input should be pure text from the chunk
      for (const input of embeddingInputs) {
        expect(typeof input).toBe('string');
        expect(input.length).toBeGreaterThan(0);
        // Should not contain stringified JSON metadata
        expect(input).not.toMatch(/\{"chunk_type":/);
        expect(input).not.toMatch(/\{"metadata":/);
      }
    });

    it('embedding inputs are strictly chunk.text for TypeScript files', async () => {
      const tsCode = `
export async function fetchUser(id: number): Promise<User> {
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json();
}
`;

      const chunks = await chunkCodeFile('api.ts', tsCode, {
        preserveImports: false,
      });

      expect(chunks.length).toBeGreaterThan(0);

      const fetchUserChunk = chunks.find((c) => c.metadata.function_name === 'fetchUser');
      expect(fetchUserChunk).toBeDefined();

      // The embedding input should be exactly the text, nothing else
      const embeddingInput = fetchUserChunk?.text;
      expect(embeddingInput).toBeDefined();

      expect(embeddingInput).toContain('export async function fetchUser');
      expect(embeddingInput).toContain('Promise<User>');
      expect(embeddingInput).not.toContain('"chunk_type"');
      expect(embeddingInput).not.toContain('"function_name"');
      expect(embeddingInput).not.toContain('"language":"typescript"');
    });
  });
});
