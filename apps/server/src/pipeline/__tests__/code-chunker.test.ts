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

    it('routes .ts files to TypeScript chunker', async () => {
      const code = 'function test() {}';
      const chunks = await chunkCodeFile('test.ts', code);

      // Should use TypeScript chunker
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.chunk_type).toBe('code');
      expect(chunks[0].metadata.language).toBe('typescript');
    });

    it('routes .tsx files to TypeScript chunker', async () => {
      const code = 'export const Component = () => <div>test</div>;';
      const chunks = await chunkCodeFile('Component.tsx', code);

      // Should use TypeScript chunker for TSX
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.chunk_type).toBe('code');
      expect(chunks[0].metadata.language).toBe('tsx');
    });

    it('routes .js files to JavaScript chunker', async () => {
      const code = 'function test() {}';
      const chunks = await chunkCodeFile('test.js', code);

      // Should use JavaScript chunker (via TypeScript parser)
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.chunk_type).toBe('code');
      expect(chunks[0].metadata.language).toBe('javascript');
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

  describe('TypeScript Code Chunking', () => {
    it('chunks TypeScript file into functions and methods', async () => {
      const samplePath = join(__dirname, 'fixtures', 'sample.ts');
      const content = readFileSync(samplePath, 'utf-8');

      const chunks = await chunkCodeFile('sample.ts', content);

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

      const chunks = await chunkCodeFile('sample.tsx', content);

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

    it('preserves TypeScript imports when enabled', async () => {
      const code = `
import { Request } from 'express';
import * as fs from 'fs';
const http = require('http');

export function handleRequest(req: Request): void {
  console.log('Handling request');
}
`;

      const chunks = await chunkCodeFile('handler.ts', code, { preserveImports: true });

      const handlerChunk = chunks.find((c) => c.metadata.function_name === 'handleRequest');
      expect(handlerChunk).toBeDefined();
      expect(handlerChunk?.metadata.imports).toBeDefined();
      expect(handlerChunk?.metadata.imports).toContain('express');
      expect(handlerChunk?.metadata.imports).toContain('fs');
      expect(handlerChunk?.metadata.imports).toContain('http');
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

      const chunks = await chunkCodeFile('example.js', jsCode);

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

      const chunks = await chunkCodeFile('components.jsx', jsxCode);

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

      const chunks = await chunkCodeFile('large.ts', code, { maxChunkSize: 50 });

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
});
