import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseDartFile } from '../dart-analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Dart AST Parser', () => {
  // Import Tests
  describe('Import Extraction', () => {
    it('extracts basic package imports', async () => {
      const code = `import 'package:flutter/material.dart';`;
      const ast = await parseDartFile(code);

      expect(ast.imports).toHaveLength(1);
      expect(ast.imports[0].uri).toBe('package:flutter/material.dart');
      expect(ast.imports[0].prefix).toBeUndefined();
      expect(ast.imports[0].show).toBeUndefined();
      expect(ast.imports[0].hide).toBeUndefined();
    });

    it('extracts imports with prefix (as)', async () => {
      const code = `import 'package:http/http.dart' as http;`;
      const ast = await parseDartFile(code);

      expect(ast.imports).toHaveLength(1);
      expect(ast.imports[0].uri).toBe('package:http/http.dart');
      expect(ast.imports[0].prefix).toBe('http');
    });

    it('extracts imports with show clauses', async () => {
      const code = `import 'utils.dart' show formatDate, parseDate;`;
      const ast = await parseDartFile(code);

      expect(ast.imports).toHaveLength(1);
      expect(ast.imports[0].uri).toBe('utils.dart');
      expect(ast.imports[0].show).toEqual(['formatDate', 'parseDate']);
      expect(ast.imports[0].hide).toBeUndefined();
    });

    it('extracts imports with hide clauses', async () => {
      const code = `import 'dart:math' hide sin, cos;`;
      const ast = await parseDartFile(code);

      expect(ast.imports).toHaveLength(1);
      expect(ast.imports[0].uri).toBe('dart:math');
      expect(ast.imports[0].hide).toEqual(['sin', 'cos']);
      expect(ast.imports[0].show).toBeUndefined();
    });

    it('extracts multiple imports', async () => {
      const code = `
        import 'package:flutter/material.dart';
        import 'package:http/http.dart' as http;
        import 'utils.dart' show formatDate;
      `;
      const ast = await parseDartFile(code);

      expect(ast.imports).toHaveLength(3);
      expect(ast.imports[0].uri).toBe('package:flutter/material.dart');
      expect(ast.imports[1].prefix).toBe('http');
      expect(ast.imports[2].show).toEqual(['formatDate']);
    });
  });

  // Function Tests
  describe('Function Extraction', () => {
    it('extracts async functions', async () => {
      const code = `
        Future<void> initializeApp() async {
          print('App initialized');
        }
      `;
      const ast = await parseDartFile(code);

      expect(ast.functions).toHaveLength(1);
      expect(ast.functions[0].name).toBe('initializeApp');
      expect(ast.functions[0].isAsync).toBe(true);
      expect(ast.functions[0].returnType).toBe('Future<void>');
    });

    it('extracts function parameters correctly', async () => {
      const code = `
        String formatUser(String name, int age, bool isActive) {
          return '$name: $age';
        }
      `;
      const ast = await parseDartFile(code);

      expect(ast.functions).toHaveLength(1);
      expect(ast.functions[0].parameters).toEqual(['String name', 'int age', 'bool isActive']);
    });

    it('extracts return types including Future<T>', async () => {
      const code = `
        Future<User> getUser(String id) async {
          return User();
        }
      `;
      const ast = await parseDartFile(code);

      expect(ast.functions).toHaveLength(1);
      expect(ast.functions[0].returnType).toBe('Future<User>');
      expect(ast.functions[0].isAsync).toBe(true);
    });

    it('extracts doc comments', async () => {
      const code = `
        /// Initializes the application
        Future<void> initializeApp() async {
          print('App initialized');
        }
      `;
      const ast = await parseDartFile(code);

      expect(ast.functions).toHaveLength(1);
      expect(ast.functions[0].docComment).toBe('Initializes the application');
    });

    it('extracts multi-line doc comments', async () => {
      const code = `
        /// Authenticates a user
        /// Returns the user object on success
        /// Throws an exception on failure
        Future<User> login(String email) async {
          return User();
        }
      `;
      const ast = await parseDartFile(code);

      expect(ast.functions).toHaveLength(1);
      expect(ast.functions[0].docComment).toContain('Authenticates a user');
      expect(ast.functions[0].docComment).toContain('Returns the user object on success');
      expect(ast.functions[0].docComment).toContain('Throws an exception on failure');
    });

    it('extracts void return type', async () => {
      const code = `
        void printMessage(String msg) {
          print(msg);
        }
      `;
      const ast = await parseDartFile(code);

      expect(ast.functions).toHaveLength(1);
      expect(ast.functions[0].returnType).toBe('void');
      expect(ast.functions[0].isAsync).toBe(false);
    });

    it('handles functions with no parameters', async () => {
      const code = `
        String getMessage() {
          return 'Hello';
        }
      `;
      const ast = await parseDartFile(code);

      expect(ast.functions).toHaveLength(1);
      expect(ast.functions[0].parameters).toEqual([]);
    });
  });

  // Class Tests
  describe('Class Extraction', () => {
    it('extracts classes with inheritance (extends)', async () => {
      const code = `
        class AuthService extends BaseService {
          void login() {}
        }
      `;
      const ast = await parseDartFile(code);

      expect(ast.classes).toHaveLength(1);
      expect(ast.classes[0].name).toBe('AuthService');
      expect(ast.classes[0].superclass).toBe('BaseService');
    });

    it('extracts classes with mixins (with)', async () => {
      const code = `
        class MyWidget extends StatefulWidget with TickerProviderStateMixin {
          void build() {}
        }
      `;
      const ast = await parseDartFile(code);

      expect(ast.classes).toHaveLength(1);
      expect(ast.classes[0].mixins).toEqual(['TickerProviderStateMixin']);
    });

    it('extracts classes with interfaces (implements)', async () => {
      const code = `
        class UserRepository implements Repository {
          void save() {}
        }
      `;
      const ast = await parseDartFile(code);

      expect(ast.classes).toHaveLength(1);
      expect(ast.classes[0].interfaces).toEqual(['Repository']);
    });

    it('extracts abstract classes', async () => {
      const code = `
        abstract class BaseService {
          void initialize();
        }
      `;
      const ast = await parseDartFile(code);

      expect(ast.classes).toHaveLength(1);
      expect(ast.classes[0].isAbstract).toBe(true);
    });

    it('extracts class methods (static and instance)', async () => {
      const code = `
        class AuthService {
          Future<void> login() async {
            return;
          }

          static String formatToken(String token) {
            return token.trim();
          }
        }
      `;
      const ast = await parseDartFile(code);

      expect(ast.classes).toHaveLength(1);
      expect(ast.classes[0].methods).toHaveLength(2);

      const loginMethod = ast.classes[0].methods.find((m) => m.name === 'login');
      expect(loginMethod).toBeDefined();
      expect(loginMethod?.isStatic).toBe(false);
      expect(loginMethod?.isAsync).toBe(true);

      const formatMethod = ast.classes[0].methods.find((m) => m.name === 'formatToken');
      expect(formatMethod).toBeDefined();
      expect(formatMethod?.isStatic).toBe(true);
    });

    it('extracts class properties (final and static)', async () => {
      const code = `
        class AuthService {
          final String apiKey;
          static const String API_BASE = 'https://api.example.com';
          int retryCount;
        }
      `;
      const ast = await parseDartFile(code);

      expect(ast.classes).toHaveLength(1);
      expect(ast.classes[0].properties).toHaveLength(3);

      const apiKeyProp = ast.classes[0].properties.find((p) => p.name === 'apiKey');
      expect(apiKeyProp).toBeDefined();
      expect(apiKeyProp?.isFinal).toBe(true);
      expect(apiKeyProp?.isStatic).toBe(false);

      const apiBaseProp = ast.classes[0].properties.find((p) => p.name === 'API_BASE');
      expect(apiBaseProp).toBeDefined();
      expect(apiBaseProp?.isStatic).toBe(true);

      const retryProp = ast.classes[0].properties.find((p) => p.name === 'retryCount');
      expect(retryProp).toBeDefined();
      expect(retryProp?.isFinal).toBe(false);
    });

    it('extracts classes with mixins', async () => {
      const code =
        'class MyWidget extends StatefulWidget with TickerProviderMixin { void build() {} }';
      const ast = await parseDartFile(code);

      expect(ast.classes).toHaveLength(1);
      expect(ast.classes[0].name).toBe('MyWidget');
      expect(ast.classes[0].superclass).toBe('StatefulWidget');
      expect(ast.classes[0].mixins.length).toBeGreaterThanOrEqual(1);
      const mixinText = ast.classes[0].mixins.join(' ');
      expect(mixinText).toContain('TickerProviderMixin');
    });
  });

  // Constants Tests
  describe('Constants Extraction', () => {
    it('extracts const declarations', async () => {
      const code = 'const int MAX_RETRIES = 3;';
      const ast = await parseDartFile(code);

      expect(ast.constants).toHaveLength(1);
      expect(ast.constants[0].name).toBe('MAX_RETRIES');
      expect(ast.constants[0].type).toBe('int');
      expect(ast.constants[0].value).toBe('3');
    });

    it('extracts final declarations', async () => {
      const code = `final String apiKey = 'secret_key';`;
      const ast = await parseDartFile(code);

      expect(ast.constants).toHaveLength(1);
      expect(ast.constants[0].name).toBe('apiKey');
      expect(ast.constants[0].type).toBe('String');
      expect(ast.constants[0].value).toBe("'secret_key'");
    });

    it('extracts multiple constants', async () => {
      const code = `
        const int MAX_RETRIES = 3;
        final String apiKey = 'secret_key';
        const double PI = 3.14159;
      `;
      const ast = await parseDartFile(code);

      expect(ast.constants).toHaveLength(3);
      expect(ast.constants[0].name).toBe('MAX_RETRIES');
      expect(ast.constants[1].name).toBe('apiKey');
      expect(ast.constants[2].name).toBe('PI');
    });
  });

  // Edge Case Tests
  describe('Edge Cases', () => {
    it('handles braces in strings correctly', async () => {
      const code = `
        String getBracedString() {
          return "This has { braces } in it";
        }
      `;
      const ast = await parseDartFile(code);

      expect(ast.functions).toHaveLength(1);
      expect(ast.functions[0].name).toBe('getBracedString');
      expect(ast.functions[0].code).toContain('{ braces }');
    });

    it('handles braces in comments correctly', async () => {
      const code = `
        void testFunction() {
          // Comment with { braces }
          /* Multi-line comment with { braces } */
          print('test');
        }
      `;
      const ast = await parseDartFile(code);

      expect(ast.functions).toHaveLength(1);
      expect(ast.functions[0].name).toBe('testFunction');
    });

    it('handles nested braces in function bodies', async () => {
      const code = `
        void complexFunction() {
          if (true) {
            while (false) {
              for (var i = 0; i < 10; i++) {
                print(i);
              }
            }
          }
        }
      `;
      const ast = await parseDartFile(code);

      expect(ast.functions).toHaveLength(1);
      expect(ast.functions[0].name).toBe('complexFunction');
      expect(ast.functions[0].code).toContain('for (var i = 0; i < 10; i++)');
    });

    it('handles generic types with angle brackets', async () => {
      const code = 'Future<User> getUser() async { return null; }';
      const ast = await parseDartFile(code);

      expect(ast.functions).toHaveLength(1);
      expect(ast.functions[0].returnType).toBe('Future<User>');
      expect(ast.functions[0].isAsync).toBe(true);
    });

    it('handles complex parameter lists', async () => {
      const code = 'void complexParams(String name, int age, bool isActive) { print(name); }';
      const ast = await parseDartFile(code);

      expect(ast.functions).toHaveLength(1);
      expect(ast.functions[0].parameters).toHaveLength(3);
      expect(ast.functions[0].parameters[0]).toBe('String name');
      expect(ast.functions[0].parameters[1]).toBe('int age');
      expect(ast.functions[0].parameters[2]).toBe('bool isActive');
    });
  });

  // Integration Test
  describe('Integration', () => {
    it('parses complete sample.dart fixture file', async () => {
      const fixturePath = join(__dirname, 'fixtures', 'sample.dart');
      const content = readFileSync(fixturePath, 'utf-8');
      const ast = await parseDartFile(content);

      // Verify imports
      expect(ast.imports).toHaveLength(5);
      expect(ast.imports[0].uri).toBe('dart:convert');
      expect(ast.imports[1].uri).toBe('package:flutter/material.dart');
      expect(ast.imports[2].uri).toBe('package:http/http.dart');
      expect(ast.imports[2].prefix).toBe('http');
      expect(ast.imports[4].show).toEqual(['formatDate', 'parseDate']);

      // Verify classes
      expect(ast.classes).toHaveLength(1);
      expect(ast.classes[0].name).toBe('AuthService');
      expect(ast.classes[0].superclass).toBe('BaseService');
      // Properties: _client (final field), API_BASE (static const), and potentially others
      expect(ast.classes[0].properties.length).toBeGreaterThanOrEqual(2);
      expect(ast.classes[0].methods).toHaveLength(3); // login, logout, formatToken

      const loginMethod = ast.classes[0].methods.find((m) => m.name === 'login');
      expect(loginMethod).toBeDefined();
      expect(loginMethod?.returnType).toBe('Future<User>');
      expect(loginMethod?.isAsync).toBe(true);
      expect(loginMethod?.parameters).toEqual(['String email', 'String password']);

      const formatTokenMethod = ast.classes[0].methods.find((m) => m.name === 'formatToken');
      expect(formatTokenMethod).toBeDefined();
      expect(formatTokenMethod?.isStatic).toBe(true);

      // Verify top-level functions
      expect(ast.functions).toHaveLength(1);
      expect(ast.functions[0].name).toBe('initializeApp');
      expect(ast.functions[0].docComment).toBe('Initializes the application');

      // Verify constants
      expect(ast.constants).toHaveLength(2);
      expect(ast.constants[0].name).toBe('MAX_RETRIES');
      expect(ast.constants[0].type).toBe('int');
      expect(ast.constants[1].name).toBe('apiKey');
      expect(ast.constants[1].type).toBe('String');
    });
  });

  // Performance Test
  describe('Performance', () => {
    it('parses typical files in under 200ms', async () => {
      const classes = Array.from(
        { length: 10 },
        (_, i) =>
          `class Service${i} extends BaseService {
  final int id;
  static const String NAME = 'Service${i}';

  Future<void> method${i}(String param) async {
    print(param);
  }

  void syncMethod${i}() {
    print('sync');
  }
}`
      ).join('\n\n');

      const functions = Array.from(
        { length: 20 },
        (_, i) =>
          `\nFuture<String> function${i}() async {
  return 'result${i}';
}`
      ).join('\n');

      const largeCode = `import 'package:flutter/material.dart';\n\n${classes}\n${functions}`;

      const startTime = Date.now();
      const ast = await parseDartFile(largeCode);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200);
      expect(ast.classes).toHaveLength(10);
      expect(ast.functions).toHaveLength(20);
    });
  });

  // Error Handling
  describe('Error Handling', () => {
    it('handles malformed code gracefully', async () => {
      const malformedCode = `
        class BrokenClass {
          void method() {
            // Missing closing brace
      `;

      const ast = await parseDartFile(malformedCode);

      // Should return partial AST, not throw
      expect(ast).toBeDefined();
      expect(ast.imports).toBeDefined();
      expect(ast.functions).toBeDefined();
      expect(ast.classes).toBeDefined();
      expect(ast.constants).toBeDefined();
    });

    it('handles empty input', async () => {
      const ast = await parseDartFile('');

      expect(ast.imports).toEqual([]);
      expect(ast.functions).toEqual([]);
      expect(ast.classes).toEqual([]);
      expect(ast.constants).toEqual([]);
    });

    it('handles code with only comments', async () => {
      const code = `
        // Just a comment
        /* Multi-line
           comment */
        /// Doc comment
      `;
      const ast = await parseDartFile(code);

      expect(ast.imports).toEqual([]);
      expect(ast.functions).toEqual([]);
      expect(ast.classes).toEqual([]);
      expect(ast.constants).toEqual([]);
    });
  });
});
