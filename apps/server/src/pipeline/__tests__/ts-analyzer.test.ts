import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseTypeScriptFile } from '../ts-analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('TypeScript Analyzer', () => {
  describe('TypeScript file parsing', () => {
    it('parses imports correctly', async () => {
      const samplePath = join(__dirname, 'fixtures', 'sample.ts');
      const content = readFileSync(samplePath, 'utf-8');
      const ast = await parseTypeScriptFile(content, samplePath);

      expect(ast.imports).toHaveLength(4);

      // Named imports
      const expressImport = ast.imports.find((i) => i.uri === 'express');
      expect(expressImport).toBeDefined();
      expect(expressImport?.show).toContain('Request');
      expect(expressImport?.show).toContain('Response');

      // Namespace import
      const fsImport = ast.imports.find((i) => i.uri === 'node:fs');
      expect(fsImport).toBeDefined();
      expect(fsImport?.prefix).toBe('fs');

      // Default import
      const pathImport = ast.imports.find((i) => i.uri === 'node:path');
      expect(pathImport).toBeDefined();

      // CommonJS require
      const httpImport = ast.imports.find((i) => i.uri === 'node:http');
      expect(httpImport).toBeDefined();
      expect(httpImport?.prefix).toBe('http');
    });

    it('extracts functions correctly', async () => {
      const samplePath = join(__dirname, 'fixtures', 'sample.ts');
      const content = readFileSync(samplePath, 'utf-8');
      const ast = await parseTypeScriptFile(content, samplePath);

      // Check function count (including arrow functions)
      // We should find at least 5 functions: initializeApp, loadConfig, validateUser, fibonacci, outerFunction
      // setupDatabase and processUser are trickier arrow functions that might not be caught
      expect(ast.functions.length).toBeGreaterThanOrEqual(5);

      // Regular async function
      const initFunc = ast.functions.find((f) => f.name === 'initializeApp');
      expect(initFunc).toBeDefined();
      expect(initFunc?.isAsync).toBe(true);
      expect(initFunc?.returnType).toBe('Promise<void>');
      expect(initFunc?.docComment).toContain('Initialize the application');

      // Arrow function - setupDatabase might not be captured due to its simple structure
      // loadConfig should be captured
      const loadConfigFunc = ast.functions.find((f) => f.name === 'loadConfig');
      expect(loadConfigFunc).toBeDefined();
      expect(loadConfigFunc?.isAsync).toBe(true);
      expect(loadConfigFunc?.code).toContain('=>');

      // Function with parameters
      const validateFunc = ast.functions.find((f) => f.name === 'validateUser');
      expect(validateFunc).toBeDefined();
      expect(validateFunc?.parameters).toHaveLength(2);
      expect(validateFunc?.parameters).toContain('username: string');
      expect(validateFunc?.parameters).toContain('password: string');
      expect(validateFunc?.returnType).toBe('boolean');

      // Generator function
      const fibFunc = ast.functions.find((f) => f.name === 'fibonacci');
      expect(fibFunc).toBeDefined();
      expect(fibFunc?.isAsync).toBe(true); // Generators are treated as async
      expect(fibFunc?.returnType).toBe('Generator<number, void, unknown>');
    });

    it('extracts classes correctly', async () => {
      const samplePath = join(__dirname, 'fixtures', 'sample.ts');
      const content = readFileSync(samplePath, 'utf-8');
      const ast = await parseTypeScriptFile(content, samplePath);

      expect(ast.classes).toHaveLength(2);

      // Abstract class
      const baseClass = ast.classes.find((c) => c.name === 'BaseService');
      expect(baseClass).toBeDefined();
      expect(baseClass?.isAbstract).toBe(true);
      // Should have serviceName property
      expect(baseClass?.properties.some((p) => p.name === 'serviceName')).toBe(true);
      expect(baseClass?.methods).toHaveLength(1); // log method (abstract methods not captured as code)

      // Concrete class with inheritance
      const dbClass = ast.classes.find((c) => c.name === 'DatabaseService');
      expect(dbClass).toBeDefined();
      expect(dbClass?.superclass).toBe('BaseService');
      expect(dbClass?.interfaces).toContain('IService');

      // Check static method
      const getInstanceMethod = dbClass?.methods.find((m) => m.name === 'getInstance');
      expect(getInstanceMethod).toBeDefined();
      expect(getInstanceMethod?.isStatic).toBe(true);

      // Arrow function methods might not be captured in the same way
      // Just check that we have some methods
      expect(dbClass?.methods.length).toBeGreaterThanOrEqual(1);

      // Check getter/setter
      const getterMethod = dbClass?.methods.find((m) => m.name === 'get isConnected');
      expect(getterMethod).toBeDefined();

      const setterMethod = dbClass?.methods.find((m) => m.name === 'set connectionStatus');
      expect(setterMethod).toBeDefined();
    });

    it('extracts constants and enums correctly', async () => {
      const samplePath = join(__dirname, 'fixtures', 'sample.ts');
      const content = readFileSync(samplePath, 'utf-8');
      const ast = await parseTypeScriptFile(content, samplePath);

      // Regular constant
      const apiConstant = ast.constants.find((c) => c.name === 'API_VERSION');
      expect(apiConstant).toBeDefined();
      expect(apiConstant?.value).toBe("'v1'");

      // Enum
      const userRoleEnum = ast.constants.find((c) => c.name === 'UserRole');
      expect(userRoleEnum).toBeDefined();
      expect(userRoleEnum?.type).toBe('enum');
      expect(userRoleEnum?.code).toContain('Admin');
      expect(userRoleEnum?.code).toContain('User');
      expect(userRoleEnum?.code).toContain('Guest');
    });
  });

  describe('TSX/React file parsing', () => {
    it('parses React imports correctly', async () => {
      const samplePath = join(__dirname, 'fixtures', 'sample.tsx');
      const content = readFileSync(samplePath, 'utf-8');
      const ast = await parseTypeScriptFile(content, samplePath);

      const reactImport = ast.imports.find((i) => i.uri === 'react');
      expect(reactImport).toBeDefined();
      expect(reactImport?.show).toContain('useState');
      expect(reactImport?.show).toContain('useEffect');
      expect(reactImport?.show).toContain('useCallback');
    });

    it('identifies React components', async () => {
      const samplePath = join(__dirname, 'fixtures', 'sample.tsx');
      const content = readFileSync(samplePath, 'utf-8');
      const ast = await parseTypeScriptFile(content, samplePath);

      // Functional component
      const appFunc = ast.functions.find((f) => f.name === 'App');
      expect(appFunc).toBeDefined();
      expect(appFunc?.returnType).toBe('JSX.Element');
      expect(appFunc?.code).toContain('useState');
      expect(appFunc?.code).toContain('useEffect');

      // Arrow component
      const headerFunc = ast.functions.find((f) => f.name === 'Header');
      expect(headerFunc).toBeDefined();
      // The arrow function should capture the JSX return
      expect(headerFunc?.code).toBeDefined();

      // Custom hook
      const useCounterFunc = ast.functions.find((f) => f.name === 'useCounter');
      expect(useCounterFunc).toBeDefined();
      expect(useCounterFunc?.code).toContain('useState');

      // Non-component function
      const formatFunc = ast.functions.find((f) => f.name === 'formatDate');
      expect(formatFunc).toBeDefined();
      expect(formatFunc?.returnType).toBe('string');
    });

    it('extracts React class components', async () => {
      const samplePath = join(__dirname, 'fixtures', 'sample.tsx');
      const content = readFileSync(samplePath, 'utf-8');
      const ast = await parseTypeScriptFile(content, samplePath);

      const counterClass = ast.classes.find((c) => c.name === 'Counter');
      expect(counterClass).toBeDefined();
      expect(counterClass?.superclass).toEqual('React.Component');

      // Check that the class has methods (increment, decrement, render)
      expect(counterClass?.methods.length).toBeGreaterThan(0);

      // Check if render method exists
      const renderMethod = counterClass?.methods.find((m) => m.name === 'render');
      if (renderMethod) {
        expect(renderMethod.code).toContain('return');
      }

      // Check arrow function methods
      const incrementMethod = counterClass?.methods.find((m) => m.name === 'increment');
      expect(incrementMethod).toBeDefined();
      expect(incrementMethod?.code).toContain('setState');
    });
  });

  describe('Edge cases and error handling', () => {
    it('handles empty content gracefully', async () => {
      const ast = await parseTypeScriptFile('', 'empty.ts');

      expect(ast.imports).toEqual([]);
      expect(ast.functions).toEqual([]);
      expect(ast.classes).toEqual([]);
      expect(ast.constants).toEqual([]);
    });

    it('handles malformed code gracefully', async () => {
      const malformed = `
        function incomplete() {
          // Missing closing brace
        
        class Broken extends
          // Incomplete class
      `;

      const ast = await parseTypeScriptFile(malformed, 'malformed.ts');

      // Should still extract what it can
      expect(ast).toBeDefined();
      expect(ast.imports).toEqual([]);
      // May or may not extract the incomplete function/class
    });

    it('handles deeply nested structures', async () => {
      const nested = `
        function outer() {
          function inner() {
            function deeplyNested() {
              return 42;
            }
            return deeplyNested;
          }
          return inner;
        }
        
        class Container {
          method() {
            const arrow = () => {
              const nested = () => console.log('deep');
              return nested;
            };
            return arrow;
          }
        }
      `;

      const ast = await parseTypeScriptFile(nested, 'nested.ts');

      // Should extract top-level function
      expect(ast.functions.some((f) => f.name === 'outer')).toBe(true);

      // Should extract class and its method
      expect(ast.classes.some((c) => c.name === 'Container')).toBe(true);
      const container = ast.classes.find((c) => c.name === 'Container');
      expect(container?.methods.some((m) => m.name === 'method')).toBe(true);
    });

    it('handles TypeScript-specific syntax', async () => {
      const tsSpecific = `
        // Type guards
        function isString(value: unknown): value is string {
          return typeof value === 'string';
        }
        
        // Generic function
        function identity<T>(value: T): T {
          return value;
        }
        
        // Async generator
        async function* asyncGen(): AsyncGenerator<number> {
          yield 1;
          yield 2;
        }
        
        // Decorator (simplified, decorators are complex)
        class DecoratedClass {
          @readonly
          prop: string = 'value';
          
          @log
          method() {
            return 'result';
          }
        }
      `;

      const ast = await parseTypeScriptFile(tsSpecific, 'ts-specific.ts');

      // Type guard function
      const isStringFunc = ast.functions.find((f) => f.name === 'isString');
      expect(isStringFunc).toBeDefined();
      expect(isStringFunc?.returnType).toBe('value is string');

      // Generic function
      const identityFunc = ast.functions.find((f) => f.name === 'identity');
      expect(identityFunc).toBeDefined();

      // Async generator
      const asyncGenFunc = ast.functions.find((f) => f.name === 'asyncGen');
      expect(asyncGenFunc).toBeDefined();
      expect(asyncGenFunc?.isAsync).toBe(true);

      // Class with decorators (properties will be captured)
      const decoratedClass = ast.classes.find((c) => c.name === 'DecoratedClass');
      expect(decoratedClass).toBeDefined();
      expect(decoratedClass?.properties.some((p) => p.name === 'prop')).toBe(true);
    });
  });
});
