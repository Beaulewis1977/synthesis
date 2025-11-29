/**
 * Query Intent Detection Module
 *
 * Classifies search queries by intent to optimize search behavior.
 * Different intents trigger different search modes, weights, and reranking strategies.
 *
 * @module query-intent
 * @since Phase 12
 */

/**
 * Query intent types that drive search behavior optimization.
 *
 * Each intent maps to specific search configuration:
 * - code_symbol: Hybrid search with high BM25 weight (0.5), reranking enabled
 * - natural_language: Hybrid search with low BM25 weight (0.2), reranking enabled
 * - error_message: Hybrid search with high BM25 weight (0.6), reranking disabled
 * - api_lookup: Vector-only search, reranking enabled
 * - conceptual: Vector-only search, reranking enabled
 * - comparison: Hybrid search with slight BM25 (0.1), reranking enabled
 */
export type QueryIntent =
  | 'code_symbol'
  | 'natural_language'
  | 'error_message'
  | 'api_lookup'
  | 'conceptual'
  | 'comparison';

/**
 * Result of query intent detection including confidence score.
 */
export interface QueryIntentResult {
  /** Detected intent type */
  intent: QueryIntent;
  /** Confidence score (0.0 - 1.0) */
  confidence: number;
  /** Whether intent was auto-detected or manually specified */
  autoDetected: boolean;
  /** Signals that triggered this classification (for debugging) */
  signals: string[];
}

/**
 * Search configuration derived from query intent.
 */
export interface IntentSearchConfig {
  /** Search mode to use */
  mode: 'vector' | 'hybrid';
  /** BM25 weight for hybrid search (0.0 - 1.0) */
  bm25Weight: number;
  /** Vector weight for hybrid search (0.0 - 1.0) */
  vectorWeight: number;
  /** Whether to enable reranking */
  rerank: boolean;
  /** Description of why this config was chosen */
  rationale: string;
}

/**
 * Intent to search configuration mapping.
 * Based on Phase 12 specification in RAG_AND_MODEL_SELECTOR_IMPLEMENTATION_PLAN.md
 */
export const INTENT_SEARCH_CONFIG: Record<QueryIntent, IntentSearchConfig> = {
  code_symbol: {
    mode: 'hybrid',
    bm25Weight: 0.5,
    vectorWeight: 0.5,
    rerank: true,
    rationale: 'Code symbols benefit from exact BM25 matching combined with semantic search',
  },
  natural_language: {
    mode: 'hybrid',
    bm25Weight: 0.2,
    vectorWeight: 0.8,
    rerank: true,
    rationale: 'Natural language queries are best served by vector-dominant hybrid search',
  },
  error_message: {
    mode: 'hybrid',
    bm25Weight: 0.6,
    vectorWeight: 0.4,
    rerank: false,
    rationale: 'Error messages need exact text matching; reranking may lose precision',
  },
  api_lookup: {
    mode: 'vector',
    bm25Weight: 0.0,
    vectorWeight: 1.0,
    rerank: true,
    rationale: 'API lookups benefit from semantic similarity to find related documentation',
  },
  conceptual: {
    mode: 'vector',
    bm25Weight: 0.0,
    vectorWeight: 1.0,
    rerank: true,
    rationale: 'Conceptual questions need semantic understanding, not keyword matching',
  },
  comparison: {
    mode: 'hybrid',
    bm25Weight: 0.1,
    vectorWeight: 0.9,
    rerank: true,
    rationale: 'Comparisons need diverse results with slight keyword boost for mentioned terms',
  },
};

// ============================================================================
// Pattern Definitions
// ============================================================================

/**
 * Error message detection patterns.
 * Matches stack traces, error codes, and common error formats.
 */
const ERROR_PATTERNS = {
  // Stack trace patterns
  stackTrace:
    /(?:at\s+[\w.<>]+\s*\(|^\s*at\s+|Traceback\s*\(most recent call last\)|File\s+"[^"]+",\s*line\s+\d+)/im,

  // Error keywords with context (must be followed by : or appear with error context)
  errorKeywords:
    /\b(?:Error|Exception|Failed|Failure|Crash|Fatal|Panic|Abort|Segfault|SIGSEGV|SIGABRT|TypeError|ReferenceError|SyntaxError|RuntimeError|ValueError|KeyError|IndexError|NullPointerException|IllegalArgumentException|OutOfMemoryError|StackOverflowError|AssertionError|AttributeError|ImportError|ModuleNotFoundError|FileNotFoundError|PermissionError|ConnectionError|TimeoutError|HTTPError)\s*[:]/i,

  // Error keywords at word boundary (weaker signal)
  errorKeywordsWeak:
    /\b(?:Error|Exception|TypeError|ReferenceError|SyntaxError|RuntimeError|ValueError|NullPointerException|OutOfMemoryError|StackOverflowError)\b/i,

  // Error codes (e.g., E0001, ERR_001, error-404)
  errorCodes: /\b(?:E\d{3,}|ERR[_-]?\d+|error[_-]?\d+|code[_-]?\d+|status[_-]?\d{3})\b/i,

  // Common error message formats
  errorFormats: /(?::\s*\d+:\s*\d+:|line\s+\d+|column\s+\d+|position\s+\d+)/i,

  // HTTP error status codes in context
  httpErrors:
    /\b(?:4\d{2}|5\d{2})\s+(?:error|not found|forbidden|unauthorized|internal server|bad gateway|service unavailable)/i,
};

/**
 * API lookup detection patterns.
 * Matches queries about widget/class properties, methods, parameters.
 */
const API_LOOKUP_PATTERNS = {
  // Widget/Component properties pattern
  propertiesQuery:
    /\b(?:properties|props|attributes|parameters|params|arguments|args|options|config|settings)\s+(?:of|for|in)\s+\w+|\w+\s+(?:properties|props|attributes|parameters|params|arguments|args|options|config|settings)\b/i,

  // Methods/functions query
  methodsQuery:
    /\b(?:methods|functions|apis?|endpoints?|hooks?)\s+(?:of|for|in|on)\s+\w+|\w+\s+(?:methods|functions|apis?|endpoints?|hooks?)\b/i,

  // API reference patterns
  apiReference: /\b(?:api\s+reference|documentation|docs?|spec|specification)\s+(?:for|of)\s+\w+/i,

  // Constructor/initialization patterns
  constructorQuery:
    /\b(?:constructor|initializer?|create|instantiate|new)\s+\w+|\w+\s+(?:constructor|initialization)\b/i,

  // Return type/value queries
  returnQuery: /\b(?:return\s+(?:type|value)|what\s+does\s+\w+\s+return)\b/i,

  // Signature/interface queries
  signatureQuery: /\b(?:signature|interface|type\s+definition|typedef)\s+(?:of|for)\s+\w+/i,
};

/**
 * Conceptual question patterns.
 * Matches queries seeking understanding or explanation.
 */
const CONCEPTUAL_PATTERNS = {
  // Direct conceptual questions
  whatIs: /\b(?:what\s+is|what\s+are|what's)\s+(?:a\s+|an\s+|the\s+)?[\w\s]+\??$/i,

  // Explanation requests
  explain:
    /\b(?:explain|describe|define|clarify|elaborate\s+on|tell\s+me\s+about|overview\s+of|introduction\s+to|basics?\s+of|fundamentals?\s+of)\b/i,

  // Understanding queries
  understand:
    /\b(?:understand|understanding|concept\s+of|theory\s+of|principle\s+of|idea\s+behind|purpose\s+of|reason\s+for|why\s+do\s+we|why\s+use|when\s+to\s+use|when\s+should)\b/i,

  // Learning-oriented queries
  learning:
    /\b(?:learn|learning|tutorial|guide|getting\s+started|beginner|newbie|intro(?:duction)?)\b/i,

  // Architectural/design questions
  architecture:
    /\b(?:architecture|design\s+pattern|best\s+practice|convention|paradigm|approach|strategy|methodology)\b/i,
};

/**
 * Comparison patterns.
 * Matches queries comparing two or more things.
 */
const COMPARISON_PATTERNS = {
  // Explicit comparison keywords
  versus:
    /\b(?:vs\.?|versus|compared?\s+to|comparison|differ(?:ence|ent|s)?|similarities?|pros?\s+and\s+cons?)\b/i,

  // Choice/selection queries
  choice:
    /\b(?:which\s+(?:is|one|should)|should\s+i\s+use|better|best|prefer|choose|choosing|between)\b/i,

  // Alternative queries
  alternative: /\b(?:alternative|instead\s+of|rather\s+than|or\s+should|over)\b/i,

  // Trade-off queries
  tradeoff: /\b(?:trade-?offs?|advantages?|disadvantages?|benefits?|drawbacks?|limitations?)\b/i,
};

/**
 * Code symbol patterns.
 * Matches queries about specific code identifiers.
 * Extended from Phase 2 BM25 detection.
 */
const CODE_SYMBOL_PATTERNS = {
  // camelCase: lowercase followed by uppercase
  camelCase: /[a-z][A-Z]/,

  // PascalCase: uppercase followed by lowercase then uppercase
  pascalCase: /[A-Z][a-z]+[A-Z]/,

  // snake_case: underscore followed by word char
  snakeCase: /_\w/,

  // dot notation: dot followed by word char
  dotNotation: /\.\w/,

  // C++ scope resolution
  cppScope: /::/,

  // C++ pointer member access
  cppPointer: /->/,

  // Function call syntax
  functionCall: /\w+\s*\(/,

  // Generic type syntax (e.g., List<String>, Map<K,V>)
  genericType: /\w+<\w+(?:,\s*\w+)*>/,

  // Array/index access
  arrayAccess: /\w+\s*\[/,

  // Import/require statements (limited match to prevent catastrophic backtracking)
  importStatement: /\b(?:import|require|from|export)\b[^'"`]{0,100}['"`]/,

  // File paths with extensions
  filePath:
    /[\w/\\]+\.(?:ts|js|tsx|jsx|py|dart|java|go|rs|cpp|c|h|hpp|swift|kt|rb|php|vue|svelte)\b/i,

  // Package/module names with @ scope
  packageName: /@[\w-]+\/[\w-]+/,
};

/**
 * Natural language indicators.
 * Patterns that suggest a conversational/prose query.
 */
const NATURAL_LANGUAGE_PATTERNS = {
  // Question words at start
  questionStart:
    /^(?:how|what|why|when|where|who|which|can|could|would|should|is|are|do|does|did|will|have|has)\b/i,

  // Imperative/request patterns
  imperative: /^(?:show|find|get|list|give|tell|help|explain|describe)\s+me\b/i,

  // Conversational phrases
  conversational:
    /\b(?:i\s+want|i\s+need|i'm\s+trying|i\s+have|can\s+you|please|thanks?|help\s+me)\b/i,

  // Multi-word queries without code patterns
  multiWord: /^\w+(?:\s+\w+){2,}$/,
};

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Checks if query matches error message patterns.
 */
function detectErrorMessage(query: string): { match: boolean; signals: string[] } {
  const signals: string[] = [];

  if (ERROR_PATTERNS.stackTrace.test(query)) {
    signals.push('stack_trace_pattern');
  }
  if (ERROR_PATTERNS.errorKeywords.test(query)) {
    signals.push('error_keyword');
  }
  // Weak error keywords only count if we have other signals or query is short
  if (ERROR_PATTERNS.errorKeywordsWeak.test(query)) {
    signals.push('error_keyword_weak');
  }
  if (ERROR_PATTERNS.errorCodes.test(query)) {
    signals.push('error_code');
  }
  if (ERROR_PATTERNS.errorFormats.test(query)) {
    signals.push('error_format');
  }
  if (ERROR_PATTERNS.httpErrors.test(query)) {
    signals.push('http_error');
  }

  // Only consider it a match if we have strong signals or multiple weak ones
  const hasStrongSignal = signals.some(
    (s) =>
      s === 'stack_trace_pattern' ||
      s === 'error_keyword' ||
      s === 'error_code' ||
      s === 'error_format' ||
      s === 'http_error'
  );
  const hasMultipleSignals = signals.length >= 2;

  return { match: hasStrongSignal || hasMultipleSignals, signals };
}

/**
 * Checks if query matches API lookup patterns.
 */
function detectApiLookup(query: string): { match: boolean; signals: string[] } {
  const signals: string[] = [];

  if (API_LOOKUP_PATTERNS.propertiesQuery.test(query)) {
    signals.push('properties_query');
  }
  if (API_LOOKUP_PATTERNS.methodsQuery.test(query)) {
    signals.push('methods_query');
  }
  if (API_LOOKUP_PATTERNS.apiReference.test(query)) {
    signals.push('api_reference');
  }
  if (API_LOOKUP_PATTERNS.constructorQuery.test(query)) {
    signals.push('constructor_query');
  }
  if (API_LOOKUP_PATTERNS.returnQuery.test(query)) {
    signals.push('return_query');
  }
  if (API_LOOKUP_PATTERNS.signatureQuery.test(query)) {
    signals.push('signature_query');
  }

  return { match: signals.length > 0, signals };
}

/**
 * Checks if query matches conceptual question patterns.
 */
function detectConceptual(query: string): { match: boolean; signals: string[] } {
  const signals: string[] = [];

  if (CONCEPTUAL_PATTERNS.whatIs.test(query)) {
    signals.push('what_is_pattern');
  }
  if (CONCEPTUAL_PATTERNS.explain.test(query)) {
    signals.push('explain_pattern');
  }
  if (CONCEPTUAL_PATTERNS.understand.test(query)) {
    signals.push('understand_pattern');
  }
  if (CONCEPTUAL_PATTERNS.learning.test(query)) {
    signals.push('learning_pattern');
  }
  if (CONCEPTUAL_PATTERNS.architecture.test(query)) {
    signals.push('architecture_pattern');
  }

  return { match: signals.length > 0, signals };
}

/**
 * Checks if query matches comparison patterns.
 */
function detectComparison(query: string): { match: boolean; signals: string[] } {
  const signals: string[] = [];

  if (COMPARISON_PATTERNS.versus.test(query)) {
    signals.push('versus_pattern');
  }
  if (COMPARISON_PATTERNS.choice.test(query)) {
    signals.push('choice_pattern');
  }
  if (COMPARISON_PATTERNS.alternative.test(query)) {
    signals.push('alternative_pattern');
  }
  if (COMPARISON_PATTERNS.tradeoff.test(query)) {
    signals.push('tradeoff_pattern');
  }

  return { match: signals.length > 0, signals };
}

/**
 * Checks if query matches code symbol patterns.
 */
function detectCodeSymbol(query: string): { match: boolean; signals: string[] } {
  const signals: string[] = [];

  if (CODE_SYMBOL_PATTERNS.camelCase.test(query)) {
    signals.push('camel_case');
  }
  if (CODE_SYMBOL_PATTERNS.pascalCase.test(query)) {
    signals.push('pascal_case');
  }
  if (CODE_SYMBOL_PATTERNS.snakeCase.test(query)) {
    signals.push('snake_case');
  }
  if (CODE_SYMBOL_PATTERNS.dotNotation.test(query)) {
    signals.push('dot_notation');
  }
  if (CODE_SYMBOL_PATTERNS.cppScope.test(query)) {
    signals.push('cpp_scope');
  }
  if (CODE_SYMBOL_PATTERNS.cppPointer.test(query)) {
    signals.push('cpp_pointer');
  }
  if (CODE_SYMBOL_PATTERNS.functionCall.test(query)) {
    signals.push('function_call');
  }
  if (CODE_SYMBOL_PATTERNS.genericType.test(query)) {
    signals.push('generic_type');
  }
  if (CODE_SYMBOL_PATTERNS.arrayAccess.test(query)) {
    signals.push('array_access');
  }
  if (CODE_SYMBOL_PATTERNS.importStatement.test(query)) {
    signals.push('import_statement');
  }
  if (CODE_SYMBOL_PATTERNS.filePath.test(query)) {
    signals.push('file_path');
  }
  if (CODE_SYMBOL_PATTERNS.packageName.test(query)) {
    signals.push('package_name');
  }

  return { match: signals.length > 0, signals };
}

/**
 * Checks if query matches natural language patterns.
 */
function detectNaturalLanguage(query: string): { match: boolean; signals: string[] } {
  const signals: string[] = [];

  if (NATURAL_LANGUAGE_PATTERNS.questionStart.test(query)) {
    signals.push('question_start');
  }
  if (NATURAL_LANGUAGE_PATTERNS.imperative.test(query)) {
    signals.push('imperative');
  }
  if (NATURAL_LANGUAGE_PATTERNS.conversational.test(query)) {
    signals.push('conversational');
  }
  if (NATURAL_LANGUAGE_PATTERNS.multiWord.test(query)) {
    signals.push('multi_word');
  }

  return { match: signals.length > 0, signals };
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detects the intent of a search query.
 *
 * Uses a priority-based classification system:
 * 1. Error messages (highest priority - specific patterns)
 * 2. Comparisons (explicit comparison keywords)
 * 3. API lookups (documentation/reference queries)
 * 4. Conceptual questions (understanding/explanation)
 * 5. Code symbols (programming identifiers)
 * 6. Natural language (default fallback)
 *
 * @param query - The search query to classify
 * @returns Intent classification with confidence and signals
 *
 * @example
 * ```typescript
 * const result = detectQueryIntent("TypeError: Cannot read property 'x' of undefined");
 * // { intent: 'error_message', confidence: 0.95, signals: ['error_keyword'] }
 *
 * const result2 = detectQueryIntent("What is the difference between const and final?");
 * // { intent: 'comparison', confidence: 0.9, signals: ['versus_pattern', 'what_is_pattern'] }
 * ```
 */
export function detectQueryIntent(query: string): QueryIntentResult {
  const trimmed = query.trim();

  if (!trimmed) {
    return {
      intent: 'natural_language',
      confidence: 0.5,
      autoDetected: true,
      signals: ['empty_query'],
    };
  }

  // Collect all detection results
  const errorResult = detectErrorMessage(trimmed);
  const comparisonResult = detectComparison(trimmed);
  const apiLookupResult = detectApiLookup(trimmed);
  const conceptualResult = detectConceptual(trimmed);
  const codeSymbolResult = detectCodeSymbol(trimmed);
  const naturalLanguageResult = detectNaturalLanguage(trimmed);

  // Calculate scores based on signal count and priority
  const scores: Array<{ intent: QueryIntent; score: number; signals: string[] }> = [];

  // Determine if query is asking ABOUT something vs searching FOR something
  const isAskingAbout = /^(?:what|how|why|when|where|explain|describe|tell|show|find|help)/i.test(
    trimmed
  );
  const hasQuestionMark = trimmed.includes('?');
  const isQuestion = isAskingAbout || hasQuestionMark;

  // Error messages get highest priority (specific, actionable)
  if (errorResult.match) {
    // Stack traces are very strong signals
    const hasStackTrace = errorResult.signals.includes('stack_trace_pattern');
    const hasStrongError = errorResult.signals.includes('error_keyword');
    const baseScore = hasStackTrace ? 0.95 : hasStrongError ? 0.9 : 0.85;
    scores.push({
      intent: 'error_message',
      score: baseScore + errorResult.signals.length * 0.02,
      signals: errorResult.signals,
    });
  }

  // Comparisons are explicit and should be detected early
  if (comparisonResult.match) {
    scores.push({
      intent: 'comparison',
      score: 0.88 + comparisonResult.signals.length * 0.03,
      signals: comparisonResult.signals,
    });
  }

  // API lookups are specific documentation queries - boost if asking about something
  if (apiLookupResult.match) {
    const baseScore = isQuestion ? 0.88 : 0.82;
    scores.push({
      intent: 'api_lookup',
      score: baseScore + apiLookupResult.signals.length * 0.03,
      signals: apiLookupResult.signals,
    });
  }

  // Conceptual questions seek understanding - boost if asking about something
  if (conceptualResult.match) {
    // "What is" at start is a strong conceptual signal
    const hasWhatIs = conceptualResult.signals.includes('what_is_pattern');
    const baseScore = hasWhatIs ? 0.9 : isQuestion ? 0.85 : 0.75;
    scores.push({
      intent: 'conceptual',
      score: baseScore + conceptualResult.signals.length * 0.03,
      signals: conceptualResult.signals,
    });
  }

  // Code symbols are programming identifiers
  // Reduce score if query is clearly asking about something (not just searching for it)
  if (codeSymbolResult.match) {
    const patternCount = codeSymbolResult.signals.length;
    // If asking about code, reduce code_symbol priority
    const questionPenalty =
      isQuestion && (apiLookupResult.match || conceptualResult.match) ? 0.15 : 0;
    const baseScore = patternCount >= 3 ? 0.9 : patternCount >= 2 ? 0.8 : 0.7;
    scores.push({
      intent: 'code_symbol',
      score: Math.max(0.5, baseScore + patternCount * 0.02 - questionPenalty),
      signals: codeSymbolResult.signals,
    });
  }

  // Natural language is the fallback
  if (naturalLanguageResult.match || scores.length === 0) {
    scores.push({
      intent: 'natural_language',
      score: 0.6 + naturalLanguageResult.signals.length * 0.05,
      signals: naturalLanguageResult.signals,
    });
  }

  // Handle mixed signals with priority rules
  // If we have both conceptual AND comparison, comparison wins (more specific)
  // If we have both code_symbol AND conceptual, check which is stronger
  // If we have error_message, it almost always wins

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  // Apply priority overrides for specific combinations
  const topResult = scores[0];

  // Error messages with stack traces always win
  if (
    errorResult.match &&
    errorResult.signals.includes('stack_trace_pattern') &&
    topResult.intent !== 'error_message'
  ) {
    const errorScore = scores.find((s) => s.intent === 'error_message');
    if (errorScore) {
      return {
        intent: 'error_message',
        confidence: Math.min(errorScore.score, 0.99),
        autoDetected: true,
        signals: errorScore.signals,
      };
    }
  }

  // If query has comparison keywords AND conceptual patterns, prefer comparison
  if (comparisonResult.match && conceptualResult.match && topResult.intent === 'conceptual') {
    const compScore = scores.find((s) => s.intent === 'comparison');
    if (compScore && compScore.score > 0.7) {
      return {
        intent: 'comparison',
        confidence: Math.min(compScore.score, 0.99),
        autoDetected: true,
        signals: compScore.signals,
      };
    }
  }

  // If query has code symbols but is clearly a question about them, prefer conceptual/api_lookup
  if (
    codeSymbolResult.match &&
    (conceptualResult.match || apiLookupResult.match) &&
    topResult.intent === 'code_symbol'
  ) {
    // Check if the query is asking ABOUT the code symbol rather than searching FOR it
    // Uses same pattern as line 515 for consistency
    const isAskingAboutCode =
      /^(?:what|how|why|when|where|explain|describe|tell|show|find|help)/i.test(trimmed);
    if (isAskingAboutCode) {
      const altIntent = apiLookupResult.match ? 'api_lookup' : 'conceptual';
      const altScore = scores.find((s) => s.intent === altIntent);
      if (altScore) {
        return {
          intent: altIntent,
          confidence: Math.min(altScore.score + 0.1, 0.99),
          autoDetected: true,
          signals: [...altScore.signals, 'asking_about_code'],
        };
      }
    }
  }

  return {
    intent: topResult.intent,
    confidence: Math.min(topResult.score, 0.99),
    autoDetected: true,
    signals: topResult.signals,
  };
}

/**
 * Gets the search configuration for a given intent.
 *
 * @param intent - The query intent
 * @returns Search configuration optimized for the intent
 */
export function getIntentSearchConfig(intent: QueryIntent): IntentSearchConfig {
  return INTENT_SEARCH_CONFIG[intent];
}

/**
 * Detects intent and returns both the result and search config.
 * Convenience function for common use case.
 *
 * @param query - The search query
 * @returns Intent result and corresponding search configuration
 */
export function analyzeQuery(query: string): {
  intentResult: QueryIntentResult;
  searchConfig: IntentSearchConfig;
} {
  const intentResult = detectQueryIntent(query);
  const searchConfig = getIntentSearchConfig(intentResult.intent);
  return { intentResult, searchConfig };
}

// ============================================================================
// Metrics and Logging
// ============================================================================

/**
 * Intent distribution metrics for monitoring.
 */
export interface IntentMetrics {
  /** Total queries processed */
  totalQueries: number;
  /** Count per intent type */
  intentCounts: Record<QueryIntent, number>;
  /** Average confidence per intent */
  avgConfidence: Record<QueryIntent, number>;
  /** Timestamp of last reset */
  lastReset: Date;
}

// In-memory metrics (could be replaced with proper metrics system)
let metrics: IntentMetrics = createEmptyMetrics();

function createEmptyMetrics(): IntentMetrics {
  return {
    totalQueries: 0,
    intentCounts: {
      code_symbol: 0,
      natural_language: 0,
      error_message: 0,
      api_lookup: 0,
      conceptual: 0,
      comparison: 0,
    },
    avgConfidence: {
      code_symbol: 0,
      natural_language: 0,
      error_message: 0,
      api_lookup: 0,
      conceptual: 0,
      comparison: 0,
    },
    lastReset: new Date(),
  };
}

/**
 * Records an intent detection result for metrics.
 *
 * Note: These metrics are approximate in high-concurrency scenarios.
 * The in-memory counters are not thread-safe and may have slight
 * inaccuracies under heavy concurrent load. For production monitoring,
 * consider using a proper metrics library (e.g., prom-client).
 *
 * @param result - The intent detection result
 */
export function recordIntentMetric(result: QueryIntentResult): void {
  metrics.totalQueries++;
  metrics.intentCounts[result.intent]++;

  // Update running average confidence (Welford's online algorithm)
  const count = metrics.intentCounts[result.intent];
  const prevAvg = metrics.avgConfidence[result.intent];
  metrics.avgConfidence[result.intent] = prevAvg + (result.confidence - prevAvg) / count;
}

/**
 * Gets current intent metrics.
 *
 * @returns Current metrics snapshot
 */
export function getIntentMetrics(): IntentMetrics {
  return { ...metrics };
}

/**
 * Resets intent metrics.
 */
export function resetIntentMetrics(): void {
  metrics = createEmptyMetrics();
}

/**
 * Logs intent detection result if logging is enabled.
 *
 * @param query - The original query
 * @param result - The detection result
 */
export function logIntentDetection(query: string, result: QueryIntentResult): void {
  const shouldLog =
    process.env.QUERY_INTENT_LOG === 'true' || process.env.NODE_ENV === 'development';

  if (shouldLog) {
    // Using console.info for structured logging (not console.log)
    // biome-ignore lint/suspicious/noConsole: Intentional structured logging for intent detection
    console.info(
      JSON.stringify({
        type: 'query_intent',
        query: query.slice(0, 100),
        intent: result.intent,
        confidence: result.confidence,
        signals: result.signals,
      })
    );
  }
}
