/**
 * Language Analyzer Registry (Phase 14)
 *
 * Centralized registry for all language analyzers with:
 * - Extension → Analyzer mapping
 * - Capability metadata
 * - Framework detection routing
 * - Language support status for UI
 *
 * @module pipeline/analyzers/registry
 */

import type {
  AnalyzerCapabilities,
  DocumentFramework,
  DocumentLanguage,
  FrameworkInfo,
  LanguageSupportLevel,
  LanguageSupportStatus,
  ParserType,
} from '@synthesis/shared';
import type { DartAST } from '../dart-analyzer.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Language analyzer interface that all analyzers must implement
 */
export interface LanguageAnalyzer {
  /** Language identifier */
  language: DocumentLanguage;

  /** File extensions this analyzer handles (without dot) */
  extensions: string[];

  /** Parser type classification */
  parserType: ParserType;

  /** Analyzer capabilities */
  capabilities: AnalyzerCapabilities;

  /**
   * Parse source code and return AST
   * All analyzers return DartAST-compatible structure for consistency
   */
  analyze(code: string, filePath: string): Promise<DartAST>;

  /**
   * Detect frameworks used in the code
   * Returns null if no framework detected
   */
  detectFrameworks?(code: string, filePath: string): FrameworkInfo[];
}

/**
 * Analyzer registration entry
 */
interface AnalyzerEntry {
  analyzer: LanguageAnalyzer;
  priority: number; // Higher priority wins for overlapping extensions
}

// =============================================================================
// Registry Implementation
// =============================================================================

/**
 * Global analyzer registry
 */
class AnalyzerRegistry {
  private readonly analyzersByLanguage = new Map<DocumentLanguage, AnalyzerEntry>();
  private readonly analyzersByExtension = new Map<string, AnalyzerEntry>();

  /**
   * Register a language analyzer
   */
  register(analyzer: LanguageAnalyzer, priority = 0): void {
    const entry: AnalyzerEntry = { analyzer, priority };

    // Register by language
    const existing = this.analyzersByLanguage.get(analyzer.language);
    if (!existing || existing.priority < priority) {
      this.analyzersByLanguage.set(analyzer.language, entry);
    }

    // Register by extension
    for (const ext of analyzer.extensions) {
      const existingExt = this.analyzersByExtension.get(ext);
      if (!existingExt || existingExt.priority < priority) {
        this.analyzersByExtension.set(ext, entry);
      }
    }
  }

  /**
   * Get analyzer by file extension
   */
  getByExtension(extension: string): LanguageAnalyzer | null {
    const ext = extension.toLowerCase().replace(/^\./, '');
    return this.analyzersByExtension.get(ext)?.analyzer ?? null;
  }

  /**
   * Get analyzer by language
   */
  getByLanguage(language: DocumentLanguage): LanguageAnalyzer | null {
    return this.analyzersByLanguage.get(language)?.analyzer ?? null;
  }

  /**
   * Get all registered analyzers
   */
  getAll(): LanguageAnalyzer[] {
    const seen = new Set<DocumentLanguage>();
    const result: LanguageAnalyzer[] = [];

    for (const entry of this.analyzersByLanguage.values()) {
      if (!seen.has(entry.analyzer.language)) {
        seen.add(entry.analyzer.language);
        result.push(entry.analyzer);
      }
    }

    return result;
  }

  /**
   * Get language support status for a file extension
   */
  getLanguageSupportStatus(extension: string): LanguageSupportStatus {
    const ext = extension.toLowerCase().replace(/^\./, '');
    const analyzer = this.getByExtension(ext);

    if (!analyzer) {
      return {
        language: this.guessLanguageFromExtension(ext),
        extension: ext,
        parserType: 'line-based',
        supportLevel: 'basic',
        frameworks: [],
        capabilities: {
          hierarchicalChunking: false,
          frameworkDetection: false,
          importExtraction: false,
          symbolExtraction: false,
          asyncDetection: false,
          decoratorDetection: false,
        },
      };
    }

    return {
      language: analyzer.language,
      extension: ext,
      parserType: analyzer.parserType,
      supportLevel: this.calculateSupportLevel(analyzer),
      frameworks: [],
      capabilities: analyzer.capabilities,
    };
  }

  /**
   * Detect frameworks in code
   */
  detectFrameworks(code: string, filePath: string): FrameworkInfo[] {
    const ext = filePath.split('.').pop() ?? '';
    const analyzer = this.getByExtension(ext);

    if (!analyzer?.detectFrameworks) {
      return [];
    }

    return analyzer.detectFrameworks(code, filePath);
  }

  /**
   * Check if a language has AST support
   */
  hasASTSupport(extension: string): boolean {
    const analyzer = this.getByExtension(extension);
    return analyzer?.parserType === 'ast' || analyzer?.parserType === 'regex';
  }

  /**
   * Get supported extensions
   */
  getSupportedExtensions(): string[] {
    return Array.from(this.analyzersByExtension.keys());
  }

  /**
   * Calculate support level based on capabilities
   */
  private calculateSupportLevel(analyzer: LanguageAnalyzer): LanguageSupportLevel {
    const caps = analyzer.capabilities;
    const score =
      (caps.hierarchicalChunking ? 2 : 0) +
      (caps.frameworkDetection ? 2 : 0) +
      (caps.importExtraction ? 1 : 0) +
      (caps.symbolExtraction ? 2 : 0) +
      (caps.asyncDetection ? 1 : 0) +
      (caps.decoratorDetection ? 1 : 0);

    if (score >= 8) return 'full';
    if (score >= 5) return 'partial';
    if (score >= 2) return 'basic';
    return 'none';
  }

  /**
   * Guess language from extension for unsupported files
   */
  private guessLanguageFromExtension(ext: string): DocumentLanguage {
    const mapping: Record<string, DocumentLanguage> = {
      ts: 'typescript',
      tsx: 'tsx',
      js: 'javascript',
      jsx: 'jsx',
      dart: 'dart',
      py: 'python',
      java: 'java',
      kt: 'kotlin',
      kts: 'kotlin',
      swift: 'swift',
      go: 'go',
      rs: 'rust',
      c: 'c',
      cpp: 'cpp',
      cc: 'cpp',
      cxx: 'cpp',
      h: 'c',
      hpp: 'cpp',
      cs: 'csharp',
      rb: 'ruby',
      php: 'php',
      sql: 'sql',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      md: 'markdown',
    };

    return mapping[ext] ?? 'markdown';
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

/**
 * Global analyzer registry instance
 */
export const analyzerRegistry = new AnalyzerRegistry();

// =============================================================================
// Framework Detection Utilities
// =============================================================================

/**
 * Common framework detection patterns
 */
export const FRAMEWORK_PATTERNS: Record<DocumentFramework, RegExp[]> = {
  // Dart/Flutter
  flutter: [
    /import\s+['"]package:flutter\//,
    /extends\s+(?:Stateless|Stateful)Widget/,
    /MaterialApp|CupertinoApp|WidgetsApp/,
    /BuildContext\s+context/,
  ],
  dart: [/import\s+['"]dart:/, /void\s+main\s*\(\s*\)/],

  // Python frameworks
  fastapi: [
    /from\s+fastapi\s+import/,
    /FastAPI\s*\(/,
    /@(?:app|router)\.(?:get|post|put|delete|patch)\s*\(/,
    /APIRouter\s*\(/,
  ],
  django: [
    /from\s+django/,
    /django\.(?:db|http|views|urls)/,
    /class\s+\w+\s*\(\s*models\.Model\s*\)/,
    /urlpatterns\s*=/,
  ],
  flask: [/from\s+flask\s+import/, /Flask\s*\(__name__\)/, /@app\.route\s*\(/],

  // Java/Kotlin frameworks
  spring: [
    /@(?:RestController|Controller|Service|Repository|Component|Autowired|Bean)/,
    /import\s+org\.springframework/,
    /SpringApplication\.run/,
  ],
  android: [
    /import\s+android\./,
    /extends\s+(?:Activity|Fragment|Service|BroadcastReceiver)/,
    /@Composable/,
    /import\s+androidx\./,
  ],

  // JavaScript/TypeScript frameworks
  react: [
    /import\s+.*\s+from\s+['"]react['"]/,
    /from\s+['"]react['"]/,
    /React\.(?:Component|createElement|useState|useEffect)/,
    /use(?:State|Effect|Context|Reducer|Callback|Memo|Ref)\s*\(/,
  ],
  nextjs: [
    /from\s+['"]next\//,
    /getServerSideProps|getStaticProps|getStaticPaths/,
    /import\s+.*\s+from\s+['"]next\/(?:router|link|image|head)['"]/,
  ],
  express: [/from\s+['"]express['"]/, /express\s*\(\)/, /app\.(?:get|post|put|delete|use)\s*\(/],
  nestjs: [/@(?:Controller|Injectable|Module|Get|Post|Put|Delete)\s*\(/, /from\s+['"]@nestjs\//],
  fastify: [/from\s+['"]fastify['"]/, /fastify\s*\(\)/, /\.register\s*\(/],
  reactnative: [
    /from\s+['"]react-native['"]/,
    /from\s+['"]@react-native\//,
    /from\s+['"]@react-navigation\//,
    /StyleSheet\.create\s*\(/,
    /View|Text|TouchableOpacity|FlatList|ScrollView/,
    /Platform\.(?:OS|select)/,
  ],

  // Database/Backend
  supabase: [
    /from\s+['"]@supabase\/supabase-js['"]/,
    /createClient\s*\(/,
    /supabase\.from\s*\(/,
    /import\s+['"]package:supabase/,
  ],
  postgres: [
    /import\s+['"]pg['"]/,
    /from\s+['"]pg['"]/,
    /Pool\s*\(/,
    /CREATE\s+TABLE/i,
    /SELECT\s+.*\s+FROM/i,
  ],
  firebase: [
    /from\s+['"]firebase\//,
    /import\s+['"]package:firebase/,
    /initializeApp\s*\(/,
    /FirebaseFirestore|FirebaseAuth/,
  ],
  redis: [
    /from\s+['"](?:redis|ioredis)['"]/,
    /createClient\s*\(/,
    /redis\.(?:get|set|hget|hset|lpush|rpush)/i,
    /REDIS_URL|REDIS_HOST/,
  ],

  // Go frameworks
  gin: [/import\s+"github\.com\/gin-gonic\/gin"/, /gin\.(?:Default|New)\s*\(\)/],
  echo: [/import\s+"github\.com\/labstack\/echo"/, /echo\.New\s*\(\)/],

  // Rust frameworks
  actix: [/use\s+actix_web/, /HttpServer::new/, /#\[(?:get|post|put|delete)\(/],
  tokio: [/use\s+tokio/, /#\[tokio::main\]/, /async\s+fn\s+main/],

  // ML frameworks
  pytorch: [/import\s+torch/, /from\s+torch/, /nn\.Module/, /torch\.tensor/],
  tensorflow: [/import\s+tensorflow/, /from\s+tensorflow/, /tf\.keras/, /tf\.constant/],
};

/**
 * Detect frameworks from code using pattern matching
 */
export function detectFrameworksFromPatterns(
  code: string,
  applicableFrameworks: DocumentFramework[]
): FrameworkInfo[] {
  const results: FrameworkInfo[] = [];

  for (const framework of applicableFrameworks) {
    const patterns = FRAMEWORK_PATTERNS[framework];
    if (!patterns) continue;

    const indicators: string[] = [];
    let matchCount = 0;

    for (const pattern of patterns) {
      const match = code.match(pattern);
      if (match) {
        matchCount++;
        indicators.push(match[0].substring(0, 50));
      }
    }

    if (matchCount > 0) {
      const confidence = Math.min(matchCount / patterns.length, 1);
      results.push({
        name: framework,
        confidence,
        indicators,
      });
    }
  }

  // Sort by confidence descending
  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Calculate chunking quality score based on analyzer capabilities and detection results
 */
export function calculateChunkingQuality(
  analyzer: LanguageAnalyzer | null,
  frameworks: FrameworkInfo[]
): number {
  if (!analyzer) return 20; // Basic line-based chunking

  let score = 0;

  // Base score from parser type
  switch (analyzer.parserType) {
    case 'ast':
      score += 40;
      break;
    case 'regex':
      score += 30;
      break;
    case 'line-based':
      score += 10;
      break;
  }

  // Capability bonuses
  const caps = analyzer.capabilities;
  if (caps.hierarchicalChunking) score += 15;
  if (caps.frameworkDetection) score += 10;
  if (caps.importExtraction) score += 5;
  if (caps.symbolExtraction) score += 15;
  if (caps.asyncDetection) score += 5;
  if (caps.decoratorDetection) score += 5;

  // Framework detection bonus
  if (frameworks.length > 0) {
    const maxConfidence = Math.max(...frameworks.map((f) => f.confidence));
    score += Math.round(maxConfidence * 5);
  }

  return Math.min(score, 100);
}

// =============================================================================
// Extension Mapping Utilities
// =============================================================================

/**
 * Map of file extensions to languages
 */
export const EXTENSION_TO_LANGUAGE: Record<string, DocumentLanguage> = {
  // TypeScript/JavaScript
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  mjs: 'javascript',
  cjs: 'javascript',

  // Dart
  dart: 'dart',

  // Python
  py: 'python',
  pyw: 'python',
  pyi: 'python',

  // Java/Kotlin
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',

  // Swift
  swift: 'swift',

  // Go
  go: 'go',

  // Rust
  rs: 'rust',

  // C/C++
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hxx: 'cpp',

  // C#
  cs: 'csharp',

  // Ruby
  rb: 'ruby',
  rake: 'ruby',

  // PHP
  php: 'php',

  // Data formats
  sql: 'sql',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  md: 'markdown',
  markdown: 'markdown',
};

/**
 * Get language from file path
 */
export function getLanguageFromPath(filePath: string): DocumentLanguage | null {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (!ext) return null;
  return EXTENSION_TO_LANGUAGE[ext] ?? null;
}

/**
 * Get applicable frameworks for a language
 */
export function getApplicableFrameworks(language: DocumentLanguage): DocumentFramework[] {
  const mapping: Record<DocumentLanguage, DocumentFramework[]> = {
    dart: ['flutter', 'dart', 'supabase', 'firebase'],
    typescript: [
      'react',
      'reactnative',
      'nextjs',
      'express',
      'nestjs',
      'fastify',
      'supabase',
      'firebase',
      'redis',
      'postgres',
    ],
    tsx: ['react', 'reactnative', 'nextjs', 'supabase', 'firebase'],
    javascript: [
      'react',
      'reactnative',
      'express',
      'fastify',
      'supabase',
      'firebase',
      'redis',
      'postgres',
    ],
    jsx: ['react', 'reactnative'],
    python: [
      'fastapi',
      'django',
      'flask',
      'pytorch',
      'tensorflow',
      'supabase',
      'redis',
      'postgres',
    ],
    java: ['spring', 'android'],
    kotlin: ['spring', 'android'],
    swift: [],
    go: ['gin', 'echo', 'redis', 'postgres'],
    rust: ['actix', 'tokio', 'redis', 'postgres'],
    c: [],
    cpp: [],
    csharp: [],
    ruby: ['redis', 'postgres'],
    php: ['redis', 'postgres'],
    sql: ['postgres', 'supabase'],
    json: ['supabase', 'firebase'],
    yaml: [],
    markdown: [],
  };

  return mapping[language] ?? [];
}
