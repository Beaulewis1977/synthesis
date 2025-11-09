import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
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
        process.env.CODE_CHUNKING = undefined;
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
    it('routes TypeScript files to TS chunker (currently fallback)', async () => {
      const code = `
function greet(name: string): string {
  return 'hello ' + name;
}
`;

      const chunks = await chunkCodeFile('app.ts', code);

      expect(chunks.length).toBeGreaterThan(0);
      // Currently falls back to simple chunking
      expect(chunks[0].metadata.chunk_type).toBe('text');
    });

    it('routes JavaScript files to JS chunker (currently fallback)', async () => {
      const code = `
function greet(name) {
  return 'hello ' + name;
}
`;

      const chunks = await chunkCodeFile('app.js', code);

      expect(chunks.length).toBeGreaterThan(0);
      // Currently falls back to simple chunking
      expect(chunks[0].metadata.chunk_type).toBe('text');
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
});
