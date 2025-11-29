/**
 * Language Analyzer Registry Tests (Phase 14)
 */

import { describe, expect, it } from 'vitest';
import {
  EXTENSION_TO_LANGUAGE,
  analyzerRegistry,
  calculateChunkingQuality,
  getApplicableFrameworks,
  getLanguageFromPath,
} from '../analyzers/registry.js';

// Import analyzers to trigger registration
import '../dart-analyzer.js';
import '../ts-analyzer.js';
import '../python-analyzer.js';
import '../java-analyzer.js';
import '../go-analyzer.js';
import '../rust-analyzer.js';
import '../cpp-analyzer.js';

describe('Analyzer Registry', () => {
  describe('analyzerRegistry', () => {
    it('should have registered analyzers', () => {
      const all = analyzerRegistry.getAll();
      expect(all.length).toBeGreaterThan(0);
    });

    it('should get analyzer by extension for TypeScript', () => {
      const analyzer = analyzerRegistry.getByExtension('ts');
      expect(analyzer).toBeDefined();
      expect(analyzer?.language).toBe('typescript');
    });

    it('should get analyzer by extension for Python', () => {
      const analyzer = analyzerRegistry.getByExtension('py');
      expect(analyzer).toBeDefined();
      expect(analyzer?.language).toBe('python');
    });

    it('should get analyzer by extension for Java', () => {
      const analyzer = analyzerRegistry.getByExtension('java');
      expect(analyzer).toBeDefined();
      expect(analyzer?.language).toBe('java');
    });

    it('should get analyzer by extension for Go', () => {
      const analyzer = analyzerRegistry.getByExtension('go');
      expect(analyzer).toBeDefined();
      expect(analyzer?.language).toBe('go');
    });

    it('should get analyzer by extension for Rust', () => {
      const analyzer = analyzerRegistry.getByExtension('rs');
      expect(analyzer).toBeDefined();
      expect(analyzer?.language).toBe('rust');
    });

    it('should get analyzer by extension for C', () => {
      const analyzer = analyzerRegistry.getByExtension('c');
      expect(analyzer).toBeDefined();
      expect(analyzer?.language).toBe('c');
    });

    it('should get analyzer by extension for C++', () => {
      const analyzer = analyzerRegistry.getByExtension('cpp');
      expect(analyzer).toBeDefined();
      expect(analyzer?.language).toBe('cpp');
    });

    it('should get analyzer by extension for Dart', () => {
      const analyzer = analyzerRegistry.getByExtension('dart');
      expect(analyzer).toBeDefined();
      expect(analyzer?.language).toBe('dart');
    });

    it('should return null for unsupported extension', () => {
      const analyzer = analyzerRegistry.getByExtension('xyz');
      expect(analyzer).toBeNull();
    });

    it('should get language support status', () => {
      const status = analyzerRegistry.getLanguageSupportStatus('ts');
      expect(status.language).toBe('typescript');
      expect(status.parserType).toBe('ast');
      expect(status.supportLevel).toBe('full');
      expect(status.capabilities.hierarchicalChunking).toBe(true);
    });

    it('should return basic support for unknown extension', () => {
      const status = analyzerRegistry.getLanguageSupportStatus('xyz');
      expect(status.supportLevel).toBe('basic');
      expect(status.parserType).toBe('line-based');
    });

    it('should check AST support', () => {
      expect(analyzerRegistry.hasASTSupport('ts')).toBe(true);
      expect(analyzerRegistry.hasASTSupport('py')).toBe(true);
      expect(analyzerRegistry.hasASTSupport('java')).toBe(true);
      expect(analyzerRegistry.hasASTSupport('xyz')).toBe(false);
    });

    it('should get supported extensions', () => {
      const extensions = analyzerRegistry.getSupportedExtensions();
      expect(extensions).toContain('ts');
      expect(extensions).toContain('py');
      expect(extensions).toContain('java');
      expect(extensions).toContain('go');
      expect(extensions).toContain('rs');
    });
  });

  describe('getLanguageFromPath', () => {
    it('should get language from TypeScript file', () => {
      expect(getLanguageFromPath('src/app.ts')).toBe('typescript');
      expect(getLanguageFromPath('src/App.tsx')).toBe('tsx');
    });

    it('should get language from JavaScript file', () => {
      expect(getLanguageFromPath('src/app.js')).toBe('javascript');
      expect(getLanguageFromPath('src/App.jsx')).toBe('jsx');
    });

    it('should get language from Python file', () => {
      expect(getLanguageFromPath('src/main.py')).toBe('python');
    });

    it('should get language from Java file', () => {
      expect(getLanguageFromPath('src/Main.java')).toBe('java');
    });

    it('should get language from Go file', () => {
      expect(getLanguageFromPath('src/main.go')).toBe('go');
    });

    it('should get language from Rust file', () => {
      expect(getLanguageFromPath('src/main.rs')).toBe('rust');
    });

    it('should get language from C/C++ files', () => {
      expect(getLanguageFromPath('src/main.c')).toBe('c');
      expect(getLanguageFromPath('src/main.cpp')).toBe('cpp');
      expect(getLanguageFromPath('src/header.h')).toBe('c');
      expect(getLanguageFromPath('src/header.hpp')).toBe('cpp');
    });

    it('should return null for unknown extension', () => {
      expect(getLanguageFromPath('src/file.xyz')).toBeNull();
    });
  });

  describe('getApplicableFrameworks', () => {
    it('should return frameworks for TypeScript', () => {
      const frameworks = getApplicableFrameworks('typescript');
      expect(frameworks).toContain('react');
      expect(frameworks).toContain('nextjs');
      expect(frameworks).toContain('express');
      expect(frameworks).toContain('supabase');
    });

    it('should return frameworks for Python', () => {
      const frameworks = getApplicableFrameworks('python');
      expect(frameworks).toContain('fastapi');
      expect(frameworks).toContain('django');
      expect(frameworks).toContain('flask');
      expect(frameworks).toContain('pytorch');
    });

    it('should return frameworks for Java', () => {
      const frameworks = getApplicableFrameworks('java');
      expect(frameworks).toContain('spring');
      expect(frameworks).toContain('android');
    });

    it('should return frameworks for Dart', () => {
      const frameworks = getApplicableFrameworks('dart');
      expect(frameworks).toContain('flutter');
      expect(frameworks).toContain('supabase');
    });

    it('should return frameworks for Go', () => {
      const frameworks = getApplicableFrameworks('go');
      expect(frameworks).toContain('gin');
      expect(frameworks).toContain('echo');
    });

    it('should return frameworks for Rust', () => {
      const frameworks = getApplicableFrameworks('rust');
      expect(frameworks).toContain('actix');
      expect(frameworks).toContain('tokio');
    });
  });

  describe('calculateChunkingQuality', () => {
    it('should return low score for null analyzer', () => {
      const score = calculateChunkingQuality(null, []);
      expect(score).toBe(20);
    });

    it('should return high score for AST analyzer with framework detection', () => {
      const analyzer = analyzerRegistry.getByExtension('ts');
      const frameworks = [{ name: 'react' as const, confidence: 0.8, indicators: [] }];
      const score = calculateChunkingQuality(analyzer, frameworks);
      expect(score).toBeGreaterThan(80);
    });

    it('should return medium score for regex analyzer', () => {
      const analyzer = analyzerRegistry.getByExtension('py');
      const score = calculateChunkingQuality(analyzer, []);
      expect(score).toBeGreaterThan(50);
    });
  });

  describe('EXTENSION_TO_LANGUAGE', () => {
    it('should have all common extensions', () => {
      expect(EXTENSION_TO_LANGUAGE.ts).toBe('typescript');
      expect(EXTENSION_TO_LANGUAGE.tsx).toBe('tsx');
      expect(EXTENSION_TO_LANGUAGE.js).toBe('javascript');
      expect(EXTENSION_TO_LANGUAGE.jsx).toBe('jsx');
      expect(EXTENSION_TO_LANGUAGE.py).toBe('python');
      expect(EXTENSION_TO_LANGUAGE.java).toBe('java');
      expect(EXTENSION_TO_LANGUAGE.go).toBe('go');
      expect(EXTENSION_TO_LANGUAGE.rs).toBe('rust');
      expect(EXTENSION_TO_LANGUAGE.c).toBe('c');
      expect(EXTENSION_TO_LANGUAGE.cpp).toBe('cpp');
      expect(EXTENSION_TO_LANGUAGE.dart).toBe('dart');
    });
  });
});
