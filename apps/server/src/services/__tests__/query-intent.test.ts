import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  INTENT_SEARCH_CONFIG,
  type QueryIntent,
  analyzeQuery,
  detectQueryIntent,
  getIntentMetrics,
  getIntentSearchConfig,
  recordIntentMetric,
  resetIntentMetrics,
} from '../query-intent.js';

describe('detectQueryIntent', () => {
  describe('error_message detection', () => {
    it('detects JavaScript stack traces', () => {
      const query = `TypeError: Cannot read property 'x' of undefined
    at Object.<anonymous> (/app/src/index.js:10:5)
    at Module._compile (internal/modules/cjs/loader.js:1063:30)`;
      const result = detectQueryIntent(query);
      expect(result.intent).toBe('error_message');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.signals).toContain('stack_trace_pattern');
      expect(result.signals).toContain('error_keyword');
    });

    it('detects Python tracebacks', () => {
      const query = `Traceback (most recent call last):
  File "main.py", line 10, in <module>
    raise ValueError("Invalid input")
ValueError: Invalid input`;
      const result = detectQueryIntent(query);
      expect(result.intent).toBe('error_message');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.signals).toContain('stack_trace_pattern');
    });

    it('detects error keywords with colon', () => {
      const queries = [
        'RuntimeError: maximum recursion depth exceeded',
        'SyntaxError: unexpected token',
        'ModuleNotFoundError: No module named flask',
        'TypeError: Cannot read property of undefined',
      ];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.intent).toBe('error_message');
        expect(result.signals).toContain('error_keyword');
      }
    });

    it('detects error codes', () => {
      // Error codes with numeric patterns
      const result = detectQueryIntent('ERR_001 occurred');
      expect(result.signals).toContain('error_code');
    });

    it('detects error formats with line/column numbers', () => {
      const query = 'Error: at line 42, column 15 - Property does not exist';
      const result = detectQueryIntent(query);
      expect(result.intent).toBe('error_message');
    });
  });

  describe('comparison detection', () => {
    it('detects "vs" comparisons', () => {
      const queries = [
        'React vs Vue',
        'const vs let vs var',
        'Flutter versus React Native',
        'TypeScript vs JavaScript comparison',
      ];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.intent).toBe('comparison');
        expect(result.signals).toContain('versus_pattern');
      }
    });

    it('detects "difference between" queries', () => {
      const queries = [
        'What is the difference between const and final?',
        'Differences between REST and GraphQL',
        'How do async and await differ?',
      ];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.intent).toBe('comparison');
      }
    });

    it('detects choice/selection queries', () => {
      const queries = [
        'Which is better for mobile development?',
        'Should I use Redux or Context API?',
        'Which one should I choose for my project?',
        'Is React better than Angular?',
      ];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.intent).toBe('comparison');
        expect(result.signals).toContain('choice_pattern');
      }
    });

    it('detects pros and cons queries', () => {
      const query = 'Pros and cons of using microservices';
      const result = detectQueryIntent(query);
      expect(result.intent).toBe('comparison');
      expect(result.signals).toContain('versus_pattern');
    });

    it('detects trade-off queries', () => {
      // Trade-off pattern detection - using explicit advantage/disadvantage keywords
      const result = detectQueryIntent('What are the advantages and disadvantages?');
      expect(result.signals).toContain('tradeoff_pattern');
    });
  });

  describe('api_lookup detection', () => {
    it('detects properties queries', () => {
      const queries = [
        'Text widget properties',
        'Properties of useState',
        'Attributes of input element',
        'Parameters for fetch',
      ];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.intent).toBe('api_lookup');
        expect(result.signals).toContain('properties_query');
      }
    });

    it('detects methods queries', () => {
      const queries = [
        'Methods of Array in JavaScript',
        'String methods in Python',
        'Available APIs for Navigator',
      ];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.intent).toBe('api_lookup');
        expect(result.signals).toContain('methods_query');
      }
    });

    it('detects API reference queries', () => {
      const queries = [
        'API reference for Express',
        'Documentation for pandas',
        'Spec for WebSocket API',
      ];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.intent).toBe('api_lookup');
        expect(result.signals).toContain('api_reference');
      }
    });

    it('detects constructor queries', () => {
      const queries = [
        'Constructor for DateTime',
        'How to create new instance',
        'Instantiate a class',
      ];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.intent).toBe('api_lookup');
        expect(result.signals).toContain('constructor_query');
      }
    });

    it('detects return type queries', () => {
      const query = 'What does map return in JavaScript?';
      const result = detectQueryIntent(query);
      expect(result.intent).toBe('api_lookup');
      expect(result.signals).toContain('return_query');
    });
  });

  describe('conceptual detection', () => {
    it('detects "what is" questions', () => {
      const queries = [
        'What is state management?',
        'What are React hooks?',
        "What's the purpose of middleware?",
      ];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.intent).toBe('conceptual');
        expect(result.signals).toContain('what_is_pattern');
      }
    });

    it('detects explanation requests', () => {
      const queries = [
        'Explain the event loop in JavaScript',
        'Describe how garbage collection works',
        'Tell me about dependency injection',
        'Overview of microservices architecture',
        'Introduction to functional programming',
      ];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.intent).toBe('conceptual');
        expect(result.signals).toContain('explain_pattern');
      }
    });

    it('detects understanding queries', () => {
      const queries = [
        'Understanding closures',
        'Concept of immutability',
        'Why do we use interfaces?',
        'When to use composition',
        'Purpose of the repository pattern',
      ];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.intent).toBe('conceptual');
        expect(result.signals).toContain('understand_pattern');
      }
    });

    it('detects learning-oriented queries', () => {
      const queries = [
        'Learn the basics',
        'Tutorial for beginners',
        'Getting started guide',
        'Beginner introduction',
      ];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.intent).toBe('conceptual');
        expect(result.signals).toContain('learning_pattern');
      }
    });

    it('detects architecture questions', () => {
      const queries = [
        'Explain the architecture',
        'What is a paradigm?',
        'Understanding the methodology',
      ];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.intent).toBe('conceptual');
      }
    });
  });

  describe('code_symbol detection', () => {
    it('detects camelCase identifiers', () => {
      const queries = ['setState', 'handleClick', 'getUserData', 'buildContext'];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.intent).toBe('code_symbol');
        expect(result.signals).toContain('camel_case');
      }
    });

    it('detects PascalCase identifiers', () => {
      const queries = ['StatefulWidget', 'BuildContext', 'MaterialApp', 'HttpClient'];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.intent).toBe('code_symbol');
        expect(result.signals).toContain('pascal_case');
      }
    });

    it('detects snake_case identifiers', () => {
      const queries = ['my_function', 'get_user_data', '_private_var', 'MAX_SIZE'];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.intent).toBe('code_symbol');
        expect(result.signals).toContain('snake_case');
      }
    });

    it('detects dot notation', () => {
      const queries = ['Navigator.push', 'context.read', 'Array.from', 'Object.keys'];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.intent).toBe('code_symbol');
        expect(result.signals).toContain('dot_notation');
      }
    });

    it('detects C++ operators', () => {
      const queries = ['std::vector', 'std::string', 'ptr->member', 'obj->method'];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.intent).toBe('code_symbol');
        expect(result.signals.some((s) => s === 'cpp_scope' || s === 'cpp_pointer')).toBe(true);
      }
    });

    it('detects function call syntax', () => {
      const queries = ['build()', 'initState()', 'render()', 'componentDidMount()'];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.intent).toBe('code_symbol');
        expect(result.signals).toContain('function_call');
      }
    });

    it('detects generic types', () => {
      const queries = ['List<String>', 'Map<String, int>', 'Future<void>'];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.intent).toBe('code_symbol');
        expect(result.signals).toContain('generic_type');
      }
    });

    it('detects file paths', () => {
      const queries = [
        'src/components/Button.tsx',
        'lib/main.dart',
        'app/models/user.py',
        'pkg/handler.go',
      ];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.intent).toBe('code_symbol');
        expect(result.signals).toContain('file_path');
      }
    });

    it('detects scoped package names', () => {
      const queries = ['@angular/core', '@types/node', '@synthesis/shared'];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.intent).toBe('code_symbol');
        expect(result.signals).toContain('package_name');
      }
    });
  });

  describe('natural_language detection', () => {
    it('detects question-style queries without code symbols', () => {
      const queries = ['Why is this slow?', 'Where are the logs?', 'Who maintains this?'];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.signals).toContain('question_start');
      }
    });

    it('detects conversational patterns', () => {
      const queries = ['Can you help me with this?', 'Please show me how', 'Thanks for the help'];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.signals).toContain('conversational');
      }
    });

    it('defaults to natural_language for simple prose', () => {
      const queries = [
        'flutter widgets',
        'state management',
        'authentication flow',
        'database design',
      ];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.intent).toBe('natural_language');
      }
    });
  });

  describe('mixed signal handling', () => {
    it('prioritizes error_message over code_symbol when stack trace present', () => {
      const query = `TypeError at StatefulWidget.build()
    at Object.<anonymous> (/app/src/index.js:10:5)`;
      const result = detectQueryIntent(query);
      expect(result.intent).toBe('error_message');
    });

    it('prioritizes comparison over conceptual for "what is the difference"', () => {
      const query = 'What is the difference between const and final in Dart?';
      const result = detectQueryIntent(query);
      expect(result.intent).toBe('comparison');
    });

    it('prioritizes api_lookup when asking about properties', () => {
      const query = 'Container widget properties in Flutter';
      const result = detectQueryIntent(query);
      expect(result.intent).toBe('api_lookup');
    });

    it('prioritizes conceptual over code_symbol when asking "what is"', () => {
      const query = 'What is BuildContext in Flutter?';
      const result = detectQueryIntent(query);
      expect(result.intent).toBe('conceptual');
    });

    it('handles code symbol in natural language question', () => {
      // Query contains both code symbol (Navigator.push) and natural language patterns
      // The classifier may detect either based on pattern strength
      const query = 'How do I use Navigator.push to navigate?';
      const result = detectQueryIntent(query);
      // Navigator.push is a strong code pattern, so code_symbol is acceptable
      // api_lookup would also be valid due to "how do I use" pattern
      expect(['api_lookup', 'code_symbol']).toContain(result.intent);
    });
  });

  describe('edge cases', () => {
    it('handles empty query', () => {
      const result = detectQueryIntent('');
      expect(result.intent).toBe('natural_language');
      expect(result.confidence).toBe(0.5);
      expect(result.signals).toContain('empty_query');
    });

    it('handles whitespace-only query', () => {
      const result = detectQueryIntent('   \n\t  ');
      expect(result.intent).toBe('natural_language');
      expect(result.signals).toContain('empty_query');
    });

    it('handles very short queries', () => {
      const result = detectQueryIntent('map');
      expect(result.intent).toBe('natural_language');
    });

    it('handles very long queries', () => {
      const longQuery =
        'I am trying to implement a feature where users can navigate between screens in my Flutter application but I keep getting errors when I try to use Navigator.push and I am not sure what I am doing wrong can you help me understand how navigation works in Flutter and what the best practices are for managing routes in a large application';
      const result = detectQueryIntent(longQuery);
      expect(result.intent).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('handles queries with special characters', () => {
      const queries = [
        'How to handle @Input() in Angular?',
        'Using $scope in AngularJS',
        'What does #include do?',
        'Understanding &&, ||, and ! operators',
      ];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.intent).toBeDefined();
      }
    });

    it('handles queries with numbers', () => {
      const queries = ['ES6 vs ES5', 'Python 2 vs Python 3', 'HTTP/2 features', 'IPv4 vs IPv6'];

      for (const query of queries) {
        const result = detectQueryIntent(query);
        expect(result.intent).toBeDefined();
      }
    });
  });

  describe('confidence scores', () => {
    it('returns high confidence for clear error messages', () => {
      const query = 'TypeError: Cannot read property of undefined';
      const result = detectQueryIntent(query);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('returns high confidence for explicit comparisons', () => {
      const query = 'React vs Vue comparison';
      const result = detectQueryIntent(query);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('returns high confidence for multiple code patterns', () => {
      const query = 'StatefulWidget.build() method';
      const result = detectQueryIntent(query);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('returns moderate confidence for ambiguous queries', () => {
      const query = 'flutter navigation';
      const result = detectQueryIntent(query);
      expect(result.confidence).toBeLessThan(0.9);
    });
  });
});

describe('getIntentSearchConfig', () => {
  it('returns correct config for code_symbol', () => {
    const config = getIntentSearchConfig('code_symbol');
    expect(config.mode).toBe('hybrid');
    expect(config.bm25Weight).toBe(0.5);
    expect(config.vectorWeight).toBe(0.5);
    expect(config.rerank).toBe(true);
  });

  it('returns correct config for natural_language', () => {
    const config = getIntentSearchConfig('natural_language');
    expect(config.mode).toBe('hybrid');
    expect(config.bm25Weight).toBe(0.2);
    expect(config.vectorWeight).toBe(0.8);
    expect(config.rerank).toBe(true);
  });

  it('returns correct config for error_message', () => {
    const config = getIntentSearchConfig('error_message');
    expect(config.mode).toBe('hybrid');
    expect(config.bm25Weight).toBe(0.6);
    expect(config.vectorWeight).toBe(0.4);
    expect(config.rerank).toBe(false);
  });

  it('returns correct config for api_lookup', () => {
    const config = getIntentSearchConfig('api_lookup');
    expect(config.mode).toBe('vector');
    expect(config.bm25Weight).toBe(0.0);
    expect(config.vectorWeight).toBe(1.0);
    expect(config.rerank).toBe(true);
  });

  it('returns correct config for conceptual', () => {
    const config = getIntentSearchConfig('conceptual');
    expect(config.mode).toBe('vector');
    expect(config.bm25Weight).toBe(0.0);
    expect(config.vectorWeight).toBe(1.0);
    expect(config.rerank).toBe(true);
  });

  it('returns correct config for comparison', () => {
    const config = getIntentSearchConfig('comparison');
    expect(config.mode).toBe('hybrid');
    expect(config.bm25Weight).toBe(0.1);
    expect(config.vectorWeight).toBe(0.9);
    expect(config.rerank).toBe(true);
  });

  it('all configs have weights summing to 1.0', () => {
    const intents: QueryIntent[] = [
      'code_symbol',
      'natural_language',
      'error_message',
      'api_lookup',
      'conceptual',
      'comparison',
    ];

    for (const intent of intents) {
      const config = getIntentSearchConfig(intent);
      expect(config.bm25Weight + config.vectorWeight).toBeCloseTo(1.0);
    }
  });
});

describe('analyzeQuery', () => {
  it('returns both intent result and search config', () => {
    const { intentResult, searchConfig } = analyzeQuery('Navigator.push');
    expect(intentResult.intent).toBe('code_symbol');
    expect(searchConfig.mode).toBe('hybrid');
    expect(searchConfig.bm25Weight).toBe(0.5);
  });

  it('config matches the detected intent', () => {
    const queries = [
      'TypeError: undefined is not a function',
      'React vs Angular',
      'What is dependency injection?',
      'Properties of Text widget',
      'useState hook',
      'flutter state management',
    ];

    for (const query of queries) {
      const { intentResult, searchConfig } = analyzeQuery(query);
      const expectedConfig = INTENT_SEARCH_CONFIG[intentResult.intent];
      expect(searchConfig).toEqual(expectedConfig);
    }
  });
});

describe('metrics', () => {
  beforeEach(() => {
    resetIntentMetrics();
  });

  afterEach(() => {
    resetIntentMetrics();
  });

  it('records intent metrics correctly', () => {
    recordIntentMetric({
      intent: 'code_symbol',
      confidence: 0.9,
      autoDetected: true,
      signals: ['camel_case'],
    });

    const metrics = getIntentMetrics();
    expect(metrics.totalQueries).toBe(1);
    expect(metrics.intentCounts.code_symbol).toBe(1);
    expect(metrics.avgConfidence.code_symbol).toBe(0.9);
  });

  it('calculates running average confidence', () => {
    recordIntentMetric({
      intent: 'code_symbol',
      confidence: 0.8,
      autoDetected: true,
      signals: [],
    });
    recordIntentMetric({
      intent: 'code_symbol',
      confidence: 1.0,
      autoDetected: true,
      signals: [],
    });

    const metrics = getIntentMetrics();
    expect(metrics.intentCounts.code_symbol).toBe(2);
    expect(metrics.avgConfidence.code_symbol).toBeCloseTo(0.9);
  });

  it('tracks multiple intent types', () => {
    recordIntentMetric({
      intent: 'code_symbol',
      confidence: 0.9,
      autoDetected: true,
      signals: [],
    });
    recordIntentMetric({
      intent: 'error_message',
      confidence: 0.95,
      autoDetected: true,
      signals: [],
    });
    recordIntentMetric({
      intent: 'natural_language',
      confidence: 0.7,
      autoDetected: true,
      signals: [],
    });

    const metrics = getIntentMetrics();
    expect(metrics.totalQueries).toBe(3);
    expect(metrics.intentCounts.code_symbol).toBe(1);
    expect(metrics.intentCounts.error_message).toBe(1);
    expect(metrics.intentCounts.natural_language).toBe(1);
  });

  it('resets metrics correctly', () => {
    recordIntentMetric({
      intent: 'code_symbol',
      confidence: 0.9,
      autoDetected: true,
      signals: [],
    });

    resetIntentMetrics();

    const metrics = getIntentMetrics();
    expect(metrics.totalQueries).toBe(0);
    expect(metrics.intentCounts.code_symbol).toBe(0);
  });
});

describe('real-world query examples', () => {
  // These are examples from actual RAG usage patterns
  const testCases: Array<{ query: string; expectedIntent: QueryIntent; description: string }> = [
    // Error messages
    {
      query: "TypeError: type 'Null' is not a subtype of type 'String'",
      expectedIntent: 'error_message',
      description: 'Dart null safety error',
    },
    {
      query: 'Error: CALL_AND_RETRY_LAST Allocation failed',
      expectedIntent: 'error_message',
      description: 'Node.js memory error',
    },
    {
      query: 'SyntaxError: cannot find symbol\n  symbol:   class BuildContext',
      expectedIntent: 'error_message',
      description: 'Java/Kotlin compilation error',
    },

    // Comparisons
    {
      query: 'StatelessWidget vs StatefulWidget when to use which',
      expectedIntent: 'comparison',
      description: 'Flutter widget comparison',
    },
    {
      query: 'Provider vs Riverpod vs BLoC for state management',
      expectedIntent: 'comparison',
      description: 'State management comparison',
    },
    {
      query: 'Advantages of using GetX over Provider',
      expectedIntent: 'comparison',
      description: 'Package comparison with trade-offs',
    },

    // API lookups
    {
      query: 'Container widget properties in Flutter',
      expectedIntent: 'api_lookup',
      description: 'Widget properties lookup',
    },
    {
      query: 'What methods does List have in Dart?',
      expectedIntent: 'api_lookup',
      description: 'Class methods lookup',
    },
    {
      query: 'API reference for http package',
      expectedIntent: 'api_lookup',
      description: 'Package API reference',
    },

    // Conceptual
    {
      query: 'What is the widget tree in Flutter?',
      expectedIntent: 'conceptual',
      description: 'Conceptual question about Flutter',
    },
    {
      query: 'Explain how hot reload works',
      expectedIntent: 'conceptual',
      description: 'Explanation request',
    },
    {
      query: 'Understanding the build method lifecycle',
      expectedIntent: 'conceptual',
      description: 'Understanding query',
    },

    // Code symbols
    {
      query: 'Navigator.pushNamed',
      expectedIntent: 'code_symbol',
      description: 'Direct method reference',
    },
    {
      query: 'BuildContext context',
      expectedIntent: 'code_symbol',
      description: 'Type and variable',
    },
    {
      query: '@override initState',
      expectedIntent: 'code_symbol',
      description: 'Annotation and method',
    },

    // Natural language
    {
      query: 'How do I navigate to another screen?',
      expectedIntent: 'natural_language',
      description: 'How-to question',
    },
    {
      query: 'Show me an example of forms',
      expectedIntent: 'natural_language',
      description: 'Example request',
    },
    {
      query: 'flutter form validation',
      expectedIntent: 'natural_language',
      description: 'Topic search',
    },
  ];

  for (const { query, expectedIntent, description } of testCases) {
    it(`correctly classifies: ${description}`, () => {
      const result = detectQueryIntent(query);
      expect(result.intent).toBe(expectedIntent);
    });
  }
});
