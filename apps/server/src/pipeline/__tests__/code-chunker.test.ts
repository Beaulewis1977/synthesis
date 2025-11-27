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

      // Phase 10: chunkCodeFile now returns CodeChunkResult
      const result = await chunkCodeFile('sample.dart', content);
      const chunks = result.chunks;

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

      const result = await chunkCodeFile('small_widget.dart', code);
      const chunks = result.chunks;

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

      const result = await chunkCodeFile('large_class.dart', code, { maxChunkSize: 50 });
      const chunks = result.chunks;

      // Should have individual method chunks, not a single class chunk
      const methodChunks = chunks.filter((c) => c.metadata.function_name?.startsWith('method'));
      expect(methodChunks.length).toBeGreaterThan(0);

      // Each method chunk should have class_context
      const method0 = chunks.find((c) => c.metadata.function_name === 'method0');
      expect(method0).toBeDefined();
      expect(method0?.metadata.class_context).toBe('LargeClass');
    });

    // Phase 10: Imports are now stored at file level, not per chunk
    it('returns file-level imports when preserveImports enabled', async () => {
      const code = `
import 'package:flutter/material.dart';
import '../models/user.dart';

void greet() {
  print('hello');
}
`;

      const result = await chunkCodeFile('greet.dart', code, { preserveImports: true });
      const chunks = result.chunks;

      const greetChunk = chunks.find((c) => c.metadata.function_name === 'greet');
      expect(greetChunk).toBeDefined();
      // Phase 10: Imports no longer stored per chunk
      expect(greetChunk?.metadata.imports).toBeUndefined();
      // Phase 10: First chunk has has_file_imports flag
      expect(chunks[0].metadata.has_file_imports).toBe(true);
      // Phase 10: Imports returned at file level
      expect(result.fileImports).toBeDefined();
      expect(result.fileImports).toContain('package:flutter/material.dart');
      expect(result.fileImports).toContain('../models/user.dart');
    });

    it('excludes file imports when not enabled', async () => {
      const code = `
import 'package:flutter/material.dart';

void greet() {
  print('hello');
}
`;

      const result = await chunkCodeFile('greet.dart', code, { preserveImports: false });
      const chunks = result.chunks;

      const greetChunk = chunks.find((c) => c.metadata.function_name === 'greet');
      expect(greetChunk).toBeDefined();
      expect(greetChunk?.metadata.imports).toBeUndefined();
      // Phase 10: No file imports when preserveImports is false
      expect(result.fileImports).toBeUndefined();
      expect(chunks[0].metadata.has_file_imports).toBeUndefined();
    });

    it('includes rich metadata in chunks', async () => {
      const code = `
/// Login to the system
Future<User> login(String email, String password) async {
  return User();
}
`;

      const result = await chunkCodeFile('auth.dart', code);
      const chunks = result.chunks;

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

      const result = await chunkCodeFile('app.dart', code);
      const chunks = result.chunks;

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

      const result = await chunkCodeFile('config.dart', code);
      const chunks = result.chunks;

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
      const result = await chunkCodeFile('test.dart', code);
      const chunks = result.chunks;

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.language).toBe('dart');
    });

    it('routes .ts files to TypeScript chunker', async () => {
      const code = 'function test() {}';
      const result = await chunkCodeFile('test.ts', code);
      const chunks = result.chunks;

      // Should use TypeScript chunker
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.chunk_type).toBe('code');
      expect(chunks[0].metadata.language).toBe('typescript');
    });

    it('routes .tsx files to TypeScript chunker', async () => {
      const code = 'export const Component = () => <div>test</div>;';
      const result = await chunkCodeFile('Component.tsx', code);
      const chunks = result.chunks;

      // Should use TypeScript chunker for TSX
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.chunk_type).toBe('code');
      expect(chunks[0].metadata.language).toBe('tsx');
    });

    it('routes .js files to JavaScript chunker', async () => {
      const code = 'function test() {}';
      const result = await chunkCodeFile('test.js', code);
      const chunks = result.chunks;

      // Should use JavaScript chunker (via TypeScript parser)
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.chunk_type).toBe('code');
      expect(chunks[0].metadata.language).toBe('javascript');
    });

    it('uses simple chunking for unsupported extensions', async () => {
      const code = 'Some random text content';
      const result = await chunkCodeFile('readme.txt', code);
      const chunks = result.chunks;

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

      const result = await chunkCodeFile('broken.dart', invalidCode);
      const chunks = result.chunks;

      // Should return chunks (simple chunking fallback)
      expect(Array.isArray(chunks)).toBe(true);
      if (chunks.length > 0) {
        expect(chunks[0].metadata.chunk_type).toBe('text');
      }
    });

    it('handles empty files gracefully', async () => {
      const result = await chunkCodeFile('empty.dart', '');
      const chunks = result.chunks;

      // Empty file returns no chunks (or single empty chunk)
      expect(chunks.length).toBe(0);
    });

    it('handles files with only comments', async () => {
      const code = `
// Just comments
/* More comments */
/// Doc comments
`;
      const result = await chunkCodeFile('comments.dart', code);
      const chunks = result.chunks;

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
      const result = await chunkCodeFile('funcs.dart', code);
      const chunks = result.chunks;

      expect(chunks.length).toBe(3);
      expect(chunks[0].index).toBe(0);
      expect(chunks[1].index).toBe(1);
      expect(chunks[2].index).toBe(2);
    });
  });

  describe('Real Sample File', () => {
    // Phase 10: Updated to test file-level imports
    it('chunks sample.dart fixture correctly with file-level imports', async () => {
      const samplePath = join(__dirname, 'fixtures', 'sample.dart');
      const content = readFileSync(samplePath, 'utf-8');

      const result = await chunkCodeFile('sample.dart', content, { preserveImports: true });
      const chunks = result.chunks;

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

      // Phase 10: Imports should be at file level, not per chunk
      expect(result.fileImports).toBeDefined();
      expect(result.fileImports?.some((imp: string) => imp.includes('flutter'))).toBe(true);

      // First chunk should have has_file_imports flag
      expect(chunks[0].metadata.has_file_imports).toBe(true);

      // No chunk should have imports array (Phase 10 change)
      for (const chunk of chunks) {
        expect(chunk.metadata.imports).toBeUndefined();
      }
    });
  });

  describe('TypeScript Code Chunking', () => {
    it('chunks TypeScript file into functions and methods', async () => {
      const samplePath = join(__dirname, 'fixtures', 'sample.ts');
      const content = readFileSync(samplePath, 'utf-8');

      const result = await chunkCodeFile('sample.ts', content);
      const chunks = result.chunks;

      // Should have functions, classes, methods, and constants
      expect(chunks.length).toBeGreaterThanOrEqual(5);

      // Check function chunks
      const initChunk = chunks.find((c) => c.metadata.function_name === 'initializeApp');
      expect(initChunk).toBeDefined();
      expect(initChunk?.metadata.chunk_type).toBe('code');
      expect(initChunk?.metadata.language).toBe('typescript');
      expect(initChunk?.metadata.return_type).toBe('Promise<void>');

      // Check arrow function chunk
      const setupChunk = chunks.find((c) => c.metadata.function_name === 'setupDatabase');
      expect(setupChunk).toBeDefined();
      expect(setupChunk?.text).toContain('=>');

      // Check class chunk
      const dbServiceChunk = chunks.find((c) => c.metadata.class_name === 'DatabaseService');
      expect(dbServiceChunk).toBeDefined();
      expect(dbServiceChunk?.metadata.extends).toBe('BaseService');
      expect(dbServiceChunk?.metadata.implements).toContain('IService');

      // Check enum chunk
      const enumChunk = chunks.find((c) => c.metadata.constant_name === 'UserRole');
      expect(enumChunk).toBeDefined();
      expect(enumChunk?.metadata.is_enum).toBe(true);
    });

    it('detects React components in TSX files', async () => {
      const samplePath = join(__dirname, 'fixtures', 'sample.tsx');
      const content = readFileSync(samplePath, 'utf-8');

      const result = await chunkCodeFile('sample.tsx', content);
      const chunks = result.chunks;

      // Check functional component
      const appChunk = chunks.find((c) => c.metadata.function_name === 'App');
      expect(appChunk).toBeDefined();
      expect(appChunk?.metadata.language).toBe('tsx');
      expect(appChunk?.metadata.is_component).toBe(true);
      expect(appChunk?.metadata.hooks_used).toContain('useState');
      expect(appChunk?.metadata.hooks_used).toContain('useEffect');
      expect(appChunk?.metadata.hooks_used).toContain('useCallback');

      // Check arrow component
      const headerChunk = chunks.find((c) => c.metadata.function_name === 'Header');
      expect(headerChunk).toBeDefined();
      expect(headerChunk?.metadata.is_component).toBe(true);

      // Check class component
      const counterChunk = chunks.find((c) => c.metadata.class_name === 'Counter');
      expect(counterChunk).toBeDefined();
      expect(counterChunk?.metadata.is_component).toBe(true);
      expect(counterChunk?.metadata.is_class_component).toBe(true);

      // Check custom hook (should not be marked as component)
      const hookChunk = chunks.find((c) => c.metadata.function_name === 'useCounter');
      expect(hookChunk).toBeDefined();
      expect(hookChunk?.metadata.is_component).toBeUndefined();
      expect(hookChunk?.metadata.hooks_used).toContain('useState');
      expect(hookChunk?.metadata.hooks_used).toContain('useCallback');

      // Check non-component function
      const formatChunk = chunks.find((c) => c.metadata.function_name === 'formatDate');
      expect(formatChunk).toBeDefined();
      expect(formatChunk?.metadata.is_component).toBeUndefined();
    });

    // Phase 10: Updated to test file-level imports
    it('returns file-level imports for TypeScript when enabled', async () => {
      const code = `
import { Request } from 'express';
import * as fs from 'fs';
const http = require('http');

export function handleRequest(req: Request): void {
  console.log('Handling request');
}
`;

      const result = await chunkCodeFile('handler.ts', code, { preserveImports: true });
      const chunks = result.chunks;

      const handlerChunk = chunks.find((c) => c.metadata.function_name === 'handleRequest');
      expect(handlerChunk).toBeDefined();
      // Phase 10: Imports no longer stored per chunk
      expect(handlerChunk?.metadata.imports).toBeUndefined();
      // Phase 10: Imports returned at file level
      expect(result.fileImports).toBeDefined();
      expect(result.fileImports).toContain('express');
      expect(result.fileImports).toContain('fs');
      expect(result.fileImports).toContain('http');
      // First chunk has has_file_imports flag
      expect(chunks[0].metadata.has_file_imports).toBe(true);
    });

    it('handles JavaScript files with TypeScript parser', async () => {
      const jsCode = `
const React = require('react');

function Component(props) {
  return React.createElement('div', null, props.children);
}

class Service {
  constructor(name) {
    this.name = name;
  }
  
  start() {
    console.log('Starting', this.name);
  }
}

const API_URL = 'https://api.example.com';
`;

      const result = await chunkCodeFile('example.js', jsCode);
      const chunks = result.chunks;

      // Should process JS files correctly
      const componentChunk = chunks.find((c) => c.metadata.function_name === 'Component');
      expect(componentChunk).toBeDefined();
      expect(componentChunk?.metadata.language).toBe('javascript');

      const serviceChunk = chunks.find((c) => c.metadata.class_name === 'Service');
      expect(serviceChunk).toBeDefined();
      expect(serviceChunk?.metadata.methods).toContain('start');

      const constantChunk = chunks.find((c) => c.metadata.constant_name === 'API_URL');
      expect(constantChunk).toBeDefined();
    });

    it('handles JSX files with component detection', async () => {
      const jsxCode = `
import React from 'react';

export function Button({ onClick, children }) {
  return (
    <button onClick={onClick}>
      {children}
    </button>
  );
}

const Card = ({ title, content }) => (
  <div className="card">
    <h2>{title}</h2>
    <p>{content}</p>
  </div>
);
`;

      const result = await chunkCodeFile('components.jsx', jsxCode);
      const chunks = result.chunks;

      const buttonChunk = chunks.find((c) => c.metadata.function_name === 'Button');
      expect(buttonChunk).toBeDefined();
      expect(buttonChunk?.metadata.language).toBe('jsx');
      expect(buttonChunk?.metadata.is_component).toBe(true);

      const cardChunk = chunks.find((c) => c.metadata.function_name === 'Card');
      expect(cardChunk).toBeDefined();
      expect(cardChunk?.metadata.is_component).toBe(true);
    });

    it('chunks large TypeScript class per method', async () => {
      // Create a large TypeScript class
      const methods = Array.from(
        { length: 30 },
        (_, i) => `
  method${i}(): void {
    console.log('Method ${i}');
  }
`
      ).join('\n');

      const code = `
class LargeService {
${methods}
}
`;

      const result = await chunkCodeFile('large.ts', code, { maxChunkSize: 50 });
      const chunks = result.chunks;

      // Should have individual method chunks
      const methodChunks = chunks.filter((c) => c.metadata.function_name?.startsWith('method'));
      expect(methodChunks.length).toBeGreaterThan(0);

      // Each method chunk should have class_context
      const method0 = chunks.find((c) => c.metadata.function_name === 'method0');
      expect(method0).toBeDefined();
      expect(method0?.metadata.class_context).toBe('LargeService');
      expect(method0?.metadata.language).toBe('typescript');
    });
  });

  describe('Phase 9: Hierarchical Code Chunking', () => {
    it('creates overview chunk for large Dart class', async () => {
      // Create a large Dart class (>100 lines)
      const methods = Array.from(
        { length: 30 },
        (_, i) => `
  void method${i}() {
    // Method ${i} implementation
    print('method${i}');
  }
`
      ).join('\n');

      const code = `
class LargeWidget extends StatelessWidget {
  final String title;
  final int count;

${methods}
}
`;

      const result = await chunkCodeFile('large_widget.dart', code, { maxChunkSize: 50 });
      const chunks = result.chunks;

      // Should have overview chunk
      const overviewChunk = chunks.find((c) => c.metadata.chunk_hierarchy === 'overview');
      expect(overviewChunk).toBeDefined();
      expect(overviewChunk?.metadata.class_name).toBe('LargeWidget');
      expect(overviewChunk?.metadata.sibling_count).toBeGreaterThan(0);

      // Overview should contain class signature and method signatures
      expect(overviewChunk?.text).toContain('class LargeWidget');
      expect(overviewChunk?.text).toContain('// Methods');

      // Should have detail chunks for methods
      const detailChunks = chunks.filter((c) => c.metadata.chunk_hierarchy === 'detail');
      expect(detailChunks.length).toBeGreaterThan(0);

      // All detail chunks should reference the overview via parent_chunk_id
      const overviewId = overviewChunk?.metadata.overview_chunk_id;
      expect(overviewId).toBeDefined();
      for (const detail of detailChunks) {
        expect(detail.metadata.parent_chunk_id).toBe(overviewId);
        expect(detail.metadata.class_context).toBe('LargeWidget');
      }
    });

    it('creates overview chunk for large TypeScript class', async () => {
      const methods = Array.from(
        { length: 30 },
        (_, i) => `
  method${i}(): void {
    console.log('Method ${i}');
  }
`
      ).join('\n');

      const code = `
class LargeService extends BaseService implements IService {
  private db: Database;
  public cache: Cache;

${methods}
}
`;

      const result = await chunkCodeFile('large_service.ts', code, { maxChunkSize: 50 });
      const chunks = result.chunks;

      // Should have overview chunk
      const overviewChunk = chunks.find((c) => c.metadata.chunk_hierarchy === 'overview');
      expect(overviewChunk).toBeDefined();
      expect(overviewChunk?.metadata.class_name).toBe('LargeService');
      expect(overviewChunk?.metadata.extends).toBe('BaseService');
      expect(overviewChunk?.metadata.implements).toContain('IService');

      // Should have detail chunks
      const detailChunks = chunks.filter((c) => c.metadata.chunk_hierarchy === 'detail');
      expect(detailChunks.length).toBeGreaterThan(0);
    });

    it('does not create hierarchical chunks for small classes', async () => {
      const code = `
class SmallWidget extends StatelessWidget {
  final String title;

  @override
  Widget build(BuildContext context) {
    return Text(title);
  }
}
`;

      const result = await chunkCodeFile('small_widget.dart', code);
      const chunks = result.chunks;

      // Should NOT have overview/detail hierarchy
      const overviewChunk = chunks.find((c) => c.metadata.chunk_hierarchy === 'overview');
      expect(overviewChunk).toBeUndefined();

      // Should have single class chunk
      const classChunk = chunks.find((c) => c.metadata.class_name === 'SmallWidget');
      expect(classChunk).toBeDefined();
      expect(classChunk?.metadata.chunk_hierarchy).toBeUndefined();
    });

    it('can disable hierarchical chunking', async () => {
      const methods = Array.from(
        { length: 30 },
        (_, i) => `
  void method${i}() {
    print('method${i}');
  }
`
      ).join('\n');

      const code = `
class LargeClass {
${methods}
}
`;

      const result = await chunkCodeFile('large.dart', code, {
        maxChunkSize: 50,
        hierarchicalChunking: false,
      });
      const chunks = result.chunks;

      // Should NOT have overview chunk
      const overviewChunk = chunks.find((c) => c.metadata.chunk_hierarchy === 'overview');
      expect(overviewChunk).toBeUndefined();

      // Should have method chunks with class_context but no hierarchy
      const methodChunks = chunks.filter((c) => c.metadata.class_context === 'LargeClass');
      expect(methodChunks.length).toBeGreaterThan(0);
      for (const chunk of methodChunks) {
        expect(chunk.metadata.chunk_hierarchy).toBeUndefined();
      }
    });
  });

  describe('Phase 9: Language-Aware Simple Chunking', () => {
    it('uses simple chunking for Java files with boundary detection', async () => {
      const code = `
public class UserService {
    private Database db;

    public User getUser(String id) {
        return db.findById(id);
    }

    public void createUser(User user) {
        db.save(user);
    }
}

public class OrderService {
    public Order getOrder(String id) {
        return null;
    }
}
`;

      const result = await chunkCodeFile('services.java', code);
      const chunks = result.chunks;

      // Should produce chunks (simple chunking fallback)
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.chunk_type).toBe('text');
    });

    it('uses simple chunking for unsupported file types', async () => {
      const code = `
Some random content
that spans multiple lines
and should be chunked
`;

      const result = await chunkCodeFile('readme.txt', code);
      const chunks = result.chunks;

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.chunk_type).toBe('text');
    });
  });
});
