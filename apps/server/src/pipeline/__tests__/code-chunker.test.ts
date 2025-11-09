import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { chunkCodeFile } from '../code-chunker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Code Chunker', () => {
  describe('Dart Code Chunking', () => {
    it('chunks Dart file into functions and methods', async () => {
      const samplePath = join(__dirname, 'fixtures', 'sample.dart');
      const content = readFileSync(samplePath, 'utf-8');

      const chunks = await chunkCodeFile('sample.dart', content);

      // Should have: 1 top-level function + 3 methods (login, logout, formatToken) + 1 class + 2 constants
      expect(chunks.length).toBeGreaterThanOrEqual(3);

      // Check that we have function chunks
      const functionChunks = chunks.filter((c) => c.metadata.function_name);
      expect(functionChunks.length).toBeGreaterThan(0);

      // Verify initializeApp function exists
      const initChunk = chunks.find((c) => c.metadata.function_name === 'initializeApp');
      expect(initChunk).toBeDefined();
      expect(initChunk?.text).toContain('Future<void> initializeApp()');
      expect(initChunk?.metadata.chunk_type).toBe('code');
      expect(initChunk?.metadata.language).toBe('dart');
    });

    it('chunks small Dart class as whole unit', async () => {
      const code = `
import 'package:flutter/material.dart';

class SmallWidget extends StatelessWidget {
  final String title;

  SmallWidget(this.title);

  @override
  Widget build(BuildContext context) {
    return Text(title);
  }
}
`;

      const chunks = await chunkCodeFile('small_widget.dart', code);

      // Should have whole class as one chunk
      const classChunk = chunks.find((c) => c.metadata.class_name === 'SmallWidget');
      expect(classChunk).toBeDefined();
      expect(classChunk?.text).toContain('class SmallWidget');
      expect(classChunk?.text).toContain('Widget build');
      expect(classChunk?.metadata.methods).toContain('build');
      expect(classChunk?.metadata.extends).toBe('StatelessWidget');
      expect(classChunk?.metadata.is_widget).toBe(true);
    });

    it('chunks large Dart class per method', async () => {
      // Create a large class (>100 lines)
      const methods = Array.from(
        { length: 30 },
        (_, i) => `
  void method${i}() {
    // Method ${i}
  }
`
      ).join('\n');

      const code = `
class LargeClass {
${methods}
}
`;

      const chunks = await chunkCodeFile('large_class.dart', code, { maxChunkSize: 50 });

      // Should have individual method chunks, not a single class chunk
      const methodChunks = chunks.filter((c) => c.metadata.function_name?.startsWith('method'));
      expect(methodChunks.length).toBeGreaterThan(0);

      // Each method chunk should have class_context
      const method0 = chunks.find((c) => c.metadata.function_name === 'method0');
      expect(method0).toBeDefined();
      expect(method0?.metadata.class_context).toBe('LargeClass');
    });

    it('preserves imports when enabled', async () => {
      const code = `
import 'package:flutter/material.dart';
import '../models/user.dart';

void greet() {
  print('hello');
}
`;

      const chunks = await chunkCodeFile('greet.dart', code, { preserveImports: true });

      const greetChunk = chunks.find((c) => c.metadata.function_name === 'greet');
      expect(greetChunk).toBeDefined();
      expect(greetChunk?.metadata.imports).toBeDefined();
      expect(greetChunk?.metadata.imports).toContain('package:flutter/material.dart');
      expect(greetChunk?.metadata.imports).toContain('../models/user.dart');
    });

    it('excludes imports when not enabled', async () => {
      const code = `
import 'package:flutter/material.dart';

void greet() {
  print('hello');
}
`;

      const chunks = await chunkCodeFile('greet.dart', code, { preserveImports: false });

      const greetChunk = chunks.find((c) => c.metadata.function_name === 'greet');
      expect(greetChunk).toBeDefined();
      expect(greetChunk?.metadata.imports).toBeUndefined();
    });

    it('includes rich metadata in chunks', async () => {
      const code = `
/// Login to the system
Future<User> login(String email, String password) async {
  return User();
}
`;

      const chunks = await chunkCodeFile('auth.dart', code);

      const loginChunk = chunks.find((c) => c.metadata.function_name === 'login');
      expect(loginChunk).toBeDefined();

      // Check metadata fields
      expect(loginChunk?.metadata.function_name).toBe('login');
      expect(loginChunk?.metadata.parameters).toEqual(['String email', 'String password']);
      expect(loginChunk?.metadata.return_type).toBe('Future<User>');
      expect(loginChunk?.metadata.line_range).toBeDefined();
      expect(loginChunk?.metadata.line_range?.[0]).toBeGreaterThan(0);
      expect(loginChunk?.metadata.file_path).toBe('auth.dart');
      expect(loginChunk?.metadata.language).toBe('dart');
      expect(loginChunk?.metadata.doc_comment).toBe('Login to the system');
    });

    it('detects StatefulWidget classes', async () => {
      const code = `
class MyApp extends StatefulWidget {
  @override
  State<MyApp> createState() => _MyAppState();
}
`;

      const chunks = await chunkCodeFile('app.dart', code);

      const appChunk = chunks.find((c) => c.metadata.class_name === 'MyApp');
      expect(appChunk).toBeDefined();
      expect(appChunk?.metadata.is_widget).toBe(true);
      expect(appChunk?.metadata.is_stateful).toBe(true);
    });

    it('chunks constants correctly', async () => {
      const code = `
const int MAX_RETRIES = 3;
final String apiKey = 'sk_test_123';
`;

      const chunks = await chunkCodeFile('config.dart', code);

      const maxRetriesChunk = chunks.find((c) => c.metadata.constant_name === 'MAX_RETRIES');
      expect(maxRetriesChunk).toBeDefined();
      expect(maxRetriesChunk?.text).toContain('const int MAX_RETRIES');
      expect(maxRetriesChunk?.metadata.constant_type).toBe('int');

      const apiKeyChunk = chunks.find((c) => c.metadata.constant_name === 'apiKey');
      expect(apiKeyChunk).toBeDefined();
      expect(apiKeyChunk?.metadata.constant_type).toBe('String');
    });
  });

  describe('File Type Routing', () => {
    it('routes .dart files to Dart chunker', async () => {
      const code = 'void test() {}';
      const chunks = await chunkCodeFile('test.dart', code);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.language).toBe('dart');
    });

    it('routes .ts files to TypeScript chunker (placeholder)', async () => {
      const code = 'function test() {}';
      const chunks = await chunkCodeFile('test.ts', code);

      // Currently falls back to simple chunking
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.chunk_type).toBe('text');
    });

    it('routes .tsx files to TypeScript chunker (placeholder)', async () => {
      const code = 'const Component = () => <div>test</div>';
      const chunks = await chunkCodeFile('Component.tsx', code);

      // Currently falls back to simple chunking
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.chunk_type).toBe('text');
    });

    it('routes .js files to JavaScript chunker (placeholder)', async () => {
      const code = 'function test() {}';
      const chunks = await chunkCodeFile('test.js', code);

      // Currently falls back to simple chunking
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.chunk_type).toBe('text');
    });

    it('uses simple chunking for unsupported extensions', async () => {
      const code = 'Some random text content';
      const chunks = await chunkCodeFile('readme.txt', code);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.chunk_type).toBe('text');
    });
  });

  describe('Error Handling', () => {
    it('falls back to simple chunking on parse error', async () => {
      const invalidCode = `class { this is totally broken dart syntax }
Some more content to ensure we have chunks
Line 3
Line 4
Line 5`;

      // Should not throw
      await expect(chunkCodeFile('broken.dart', invalidCode)).resolves.toBeDefined();

      const chunks = await chunkCodeFile('broken.dart', invalidCode);

      // Should return chunks (simple chunking fallback)
      expect(Array.isArray(chunks)).toBe(true);
      if (chunks.length > 0) {
        expect(chunks[0].metadata.chunk_type).toBe('text');
      }
    });

    it('handles empty files gracefully', async () => {
      const chunks = await chunkCodeFile('empty.dart', '');

      // Empty file returns no chunks (or single empty chunk)
      expect(chunks.length).toBe(0);
    });

    it('handles files with only comments', async () => {
      const code = `
// Just comments
/* More comments */
/// Doc comments
`;
      const chunks = await chunkCodeFile('comments.dart', code);

      // Should either return no chunks or simple text chunks
      expect(Array.isArray(chunks)).toBe(true);
    });
  });

  describe('Chunk Index Sequencing', () => {
    it('assigns sequential indices to chunks', async () => {
      const code = `
void func1() {}
void func2() {}
void func3() {}
`;
      const chunks = await chunkCodeFile('funcs.dart', code);

      expect(chunks.length).toBe(3);
      expect(chunks[0].index).toBe(0);
      expect(chunks[1].index).toBe(1);
      expect(chunks[2].index).toBe(2);
    });
  });

  describe('Real Sample File', () => {
    it('chunks sample.dart fixture correctly', async () => {
      const samplePath = join(__dirname, 'fixtures', 'sample.dart');
      const content = readFileSync(samplePath, 'utf-8');

      const chunks = await chunkCodeFile('sample.dart', content, { preserveImports: true });

      // Verify we have expected chunks from sample.dart
      expect(chunks.length).toBeGreaterThan(0);

      // Should have initializeApp function
      const initFunc = chunks.find((c) => c.metadata.function_name === 'initializeApp');
      expect(initFunc).toBeDefined();

      // Should have AuthService class or its methods
      const authRelated = chunks.filter(
        (c) => c.metadata.class_name === 'AuthService' || c.metadata.class_context === 'AuthService'
      );
      expect(authRelated.length).toBeGreaterThan(0);

      // Should have imports preserved
      const withImports = chunks.filter((c) => c.metadata.imports && c.metadata.imports.length > 0);
      expect(withImports.length).toBeGreaterThan(0);

      // Verify import content
      const firstChunk = chunks[0];
      if (firstChunk.metadata.imports) {
        expect(firstChunk.metadata.imports.some((imp) => imp.includes('flutter'))).toBe(true);
      }
    });
  });
});
