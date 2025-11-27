import { describe, expect, it } from 'vitest';
import {
  type ParsedClass,
  chunkClassHierarchically,
  generateClassOverview,
  shouldChunkHierarchically,
} from '../hierarchical-chunker.js';

describe('Hierarchical Chunker (Phase 9)', () => {
  describe('generateClassOverview', () => {
    it('generates overview with class signature', () => {
      const cls: ParsedClass = {
        name: 'UserService',
        code: 'class UserService { ... }',
        superclass: 'BaseService',
        interfaces: ['IUserService'],
        lineRange: [1, 100],
        startOffset: 0,
        endOffset: 1000,
        methods: [
          {
            name: 'getUser',
            code: 'getUser(id: string) { ... }',
            parameters: ['id: string'],
            returnType: 'User',
            lineRange: [10, 20],
            startOffset: 100,
            endOffset: 200,
          },
          {
            name: 'createUser',
            code: 'createUser(data: UserData) { ... }',
            parameters: ['data: UserData'],
            returnType: 'User',
            lineRange: [25, 40],
            startOffset: 250,
            endOffset: 400,
            isAsync: true,
          },
        ],
        properties: [
          { name: 'db', type: 'Database' },
          { name: 'cache', type: 'Cache', isStatic: true },
        ],
      };

      const overview = generateClassOverview(cls);

      expect(overview).toContain('class UserService extends BaseService implements IUserService');
      expect(overview).toContain('// Properties');
      expect(overview).toContain('Database db;');
      expect(overview).toContain('static Cache cache;');
      expect(overview).toContain('// Methods');
      expect(overview).toContain('User getUser(id: string);');
      expect(overview).toContain('async User createUser(data: UserData);');
    });

    it('handles abstract classes', () => {
      const cls: ParsedClass = {
        name: 'AbstractHandler',
        code: 'abstract class AbstractHandler { ... }',
        isAbstract: true,
        lineRange: [1, 50],
        startOffset: 0,
        endOffset: 500,
        methods: [],
        properties: [],
      };

      const overview = generateClassOverview(cls);
      expect(overview).toContain('abstract class AbstractHandler');
    });

    it('handles classes with mixins (Dart)', () => {
      const cls: ParsedClass = {
        name: 'MyWidget',
        code: 'class MyWidget extends StatelessWidget with TickerProviderMixin { ... }',
        superclass: 'StatelessWidget',
        mixins: ['TickerProviderMixin'],
        lineRange: [1, 50],
        startOffset: 0,
        endOffset: 500,
        methods: [],
        properties: [],
      };

      const overview = generateClassOverview(cls);
      expect(overview).toContain('class MyWidget extends StatelessWidget with TickerProviderMixin');
    });
  });

  describe('chunkClassHierarchically', () => {
    it('creates overview + method chunks for large class', () => {
      // Create a class with >100 lines
      const methodCode = Array.from({ length: 20 }, (_, i) => `  line${i}`).join('\n');
      const cls: ParsedClass = {
        name: 'LargeService',
        code: `class LargeService {\n${methodCode.repeat(6)}\n}`,
        lineRange: [1, 125],
        startOffset: 0,
        endOffset: 2500,
        methods: [
          {
            name: 'method1',
            code: 'method1() { ... }',
            parameters: [],
            returnType: 'void',
            lineRange: [5, 25],
            startOffset: 50,
            endOffset: 250,
          },
          {
            name: 'method2',
            code: 'method2(x: number) { ... }',
            parameters: ['x: number'],
            returnType: 'number',
            lineRange: [30, 50],
            startOffset: 300,
            endOffset: 500,
            isStatic: true,
          },
        ],
        properties: [{ name: 'config', type: 'Config' }],
      };

      const result = chunkClassHierarchically(cls, 'service.ts', 'typescript', 0);

      expect(result.wasHierarchical).toBe(true);
      expect(result.chunks.length).toBe(3); // 1 overview + 2 methods
      expect(result.detailCount).toBe(2);

      // Check overview chunk
      const overview = result.chunks[0];
      expect(overview.metadata.chunk_hierarchy).toBe('overview');
      expect(overview.metadata.class_name).toBe('LargeService');
      expect(overview.metadata.sibling_count).toBe(2);
      expect(overview.metadata.parent_chunk_id).toBeDefined();

      // Check method chunks
      const method1 = result.chunks[1];
      expect(method1.metadata.chunk_hierarchy).toBe('detail');
      expect(method1.metadata.function_name).toBe('method1');
      expect(method1.metadata.class_context).toBe('LargeService');
      expect(method1.metadata.parent_chunk_id).toBe(overview.metadata.parent_chunk_id);

      const method2 = result.chunks[2];
      expect(method2.metadata.chunk_hierarchy).toBe('detail');
      expect(method2.metadata.function_name).toBe('method2');
      expect(method2.metadata.is_static).toBe(true);
      expect(method2.metadata.parent_chunk_id).toBe(overview.metadata.parent_chunk_id);
    });

    it('returns empty result for small class', () => {
      const cls: ParsedClass = {
        name: 'SmallClass',
        code: 'class SmallClass { method() {} }',
        lineRange: [1, 10],
        startOffset: 0,
        endOffset: 100,
        methods: [
          {
            name: 'method',
            code: 'method() {}',
            parameters: [],
            returnType: 'void',
            lineRange: [2, 5],
            startOffset: 20,
            endOffset: 50,
          },
        ],
        properties: [],
      };

      const result = chunkClassHierarchically(cls, 'small.ts', 'typescript', 0);

      expect(result.wasHierarchical).toBe(false);
      expect(result.chunks.length).toBe(0);
    });

    it('preserves imports in metadata when enabled', () => {
      const methodCode = Array.from({ length: 20 }, (_, i) => `  line${i}`).join('\n');
      const cls: ParsedClass = {
        name: 'ServiceWithImports',
        code: `class ServiceWithImports {\n${methodCode.repeat(6)}\n}`,
        lineRange: [1, 125],
        startOffset: 0,
        endOffset: 2500,
        methods: [
          {
            name: 'doSomething',
            code: 'doSomething() { ... }',
            parameters: [],
            returnType: 'void',
            lineRange: [5, 25],
            startOffset: 50,
            endOffset: 250,
          },
        ],
        properties: [],
      };

      const result = chunkClassHierarchically(cls, 'service.ts', 'typescript', 0, {
        preserveImports: true,
        imports: ['express', 'lodash'],
      });

      expect(result.wasHierarchical).toBe(true);
      expect(result.chunks[0].metadata.imports).toEqual(['express', 'lodash']);
      expect(result.chunks[1].metadata.imports).toEqual(['express', 'lodash']);
    });

    it('assigns sequential chunk indices', () => {
      const methodCode = Array.from({ length: 20 }, (_, i) => `  line${i}`).join('\n');
      const cls: ParsedClass = {
        name: 'IndexedClass',
        code: `class IndexedClass {\n${methodCode.repeat(6)}\n}`,
        lineRange: [1, 125],
        startOffset: 0,
        endOffset: 2500,
        methods: [
          {
            name: 'a',
            code: 'a() {}',
            parameters: [],
            returnType: 'void',
            lineRange: [5, 10],
            startOffset: 50,
            endOffset: 100,
          },
          {
            name: 'b',
            code: 'b() {}',
            parameters: [],
            returnType: 'void',
            lineRange: [15, 20],
            startOffset: 150,
            endOffset: 200,
          },
        ],
        properties: [],
      };

      const result = chunkClassHierarchically(cls, 'indexed.ts', 'typescript', 5);

      expect(result.chunks[0].index).toBe(5);
      expect(result.chunks[1].index).toBe(6);
      expect(result.chunks[2].index).toBe(7);
    });
  });

  describe('shouldChunkHierarchically', () => {
    it('returns true for large class with methods', () => {
      const largeCode = Array.from({ length: 150 }, () => 'line').join('\n');
      const cls: ParsedClass = {
        name: 'LargeClass',
        code: largeCode,
        lineRange: [1, 150],
        startOffset: 0,
        endOffset: 1500,
        methods: [
          {
            name: 'method',
            code: 'method() {}',
            parameters: [],
            returnType: 'void',
            lineRange: [10, 20],
            startOffset: 100,
            endOffset: 200,
          },
        ],
        properties: [],
      };

      expect(shouldChunkHierarchically(cls)).toBe(true);
    });

    it('returns false for small class', () => {
      const cls: ParsedClass = {
        name: 'SmallClass',
        code: 'class SmallClass {}',
        lineRange: [1, 5],
        startOffset: 0,
        endOffset: 50,
        methods: [],
        properties: [],
      };

      expect(shouldChunkHierarchically(cls)).toBe(false);
    });

    it('returns false for large class without methods', () => {
      const largeCode = Array.from({ length: 150 }, () => 'line').join('\n');
      const cls: ParsedClass = {
        name: 'DataClass',
        code: largeCode,
        lineRange: [1, 150],
        startOffset: 0,
        endOffset: 1500,
        methods: [],
        properties: [{ name: 'field1', type: 'string' }],
      };

      expect(shouldChunkHierarchically(cls)).toBe(false);
    });

    it('respects custom maxChunkSize', () => {
      const cls: ParsedClass = {
        name: 'MediumClass',
        code: Array.from({ length: 60 }, () => 'line').join('\n'),
        lineRange: [1, 60],
        startOffset: 0,
        endOffset: 600,
        methods: [
          {
            name: 'method',
            code: 'method() {}',
            parameters: [],
            returnType: 'void',
            lineRange: [10, 20],
            startOffset: 100,
            endOffset: 200,
          },
        ],
        properties: [],
      };

      expect(shouldChunkHierarchically(cls, 100)).toBe(false);
      expect(shouldChunkHierarchically(cls, 50)).toBe(true);
    });
  });
});
