import type { Pool } from 'pg';

export interface BM25Params {
  query: string;
  collectionId: string;
  topK?: number;
  language?: string;
  techStack?: string[];
}

export interface BM25Result {
  chunkId: number;
  text: string;
  rank: number;
  score: number;
  docId: string;
  docTitle: string | null;
  sourceUrl: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Extended result that includes query type metadata for diagnostics
 */
export interface BM25SearchResponse {
  results: BM25Result[];
  metadata: BM25SearchMetadata;
}

export interface BM25SearchMetadata {
  queryType: QueryType;
  tsFunction: TsQueryFunction;
  elapsedMs: number;
  resultCount: number;
}

interface BM25Row {
  chunk_id: number;
  text: string;
  rank: number | null;
  doc_id: string;
  doc_title: string | null;
  source_url: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Query type classification for smart tsquery function selection
 */
export type QueryType = 'natural_language' | 'code_symbol' | 'phrase';

/**
 * PostgreSQL tsquery functions available for full-text search
 */
export type TsQueryFunction =
  | 'to_tsquery'
  | 'plainto_tsquery'
  | 'websearch_to_tsquery'
  | 'phraseto_tsquery';

const DEFAULT_TOP_K = 30;
const DEFAULT_LANGUAGE = 'english';

/**
 * Detects the query type based on patterns in the input.
 *
 * - **phrase**: Query wrapped in double quotes (e.g., `"exact phrase"`)
 * - **code_symbol**: Contains camelCase, PascalCase, snake_case, dot notation, or C++ operators
 * - **natural_language**: Default for questions and prose
 *
 * @param query - The search query string
 * @returns The detected query type
 */
export function detectQueryType(query: string): QueryType {
  const trimmed = query.trim();

  // Phrase: wrapped in double quotes
  if (/^".*"$/.test(trimmed)) {
    return 'phrase';
  }

  // Code symbol patterns:
  // - camelCase: lowercase followed by uppercase (e.g., "setState", "buildContext")
  // - PascalCase: uppercase followed by lowercase then uppercase (e.g., "StatefulWidget")
  // - snake_case: underscore followed by word char (e.g., "my_function")
  // - dot notation: dot followed by word char (e.g., "Navigator.push")
  // - C++ operators: :: or ->
  // - Method calls with parentheses: word followed by ( (e.g., "build()")
  const codePatterns = [
    /[a-z][A-Z]/, // camelCase
    /[A-Z][a-z]+[A-Z]/, // PascalCase with multiple humps
    /_\w/, // snake_case
    /\.\w/, // dot notation
    /::/, // C++ scope resolution
    /->/, // C++ pointer member access
    /\w+\(/, // function call syntax
  ];

  for (const pattern of codePatterns) {
    if (pattern.test(trimmed)) {
      return 'code_symbol';
    }
  }

  return 'natural_language';
}

/**
 * Builds the appropriate tsquery based on query type.
 *
 * - **phrase**: Uses phraseto_tsquery for exact sequence matching
 * - **code_symbol**: Uses to_tsquery with prefix matching (term:*)
 * - **natural_language**: Uses websearch_to_tsquery for best NL handling
 *
 * @param query - The search query string
 * @param queryType - The detected query type
 * @returns Object containing the processed query and the tsquery function to use
 */
export function buildSmartTsQuery(
  query: string,
  queryType: QueryType
): { tsQuery: string; tsFunction: TsQueryFunction } {
  const trimmed = query.trim();

  switch (queryType) {
    case 'phrase': {
      // Remove surrounding quotes for phraseto_tsquery
      const unquoted = trimmed.slice(1, -1).trim();
      // Sanitize but preserve spaces for phrase matching
      const sanitized = sanitizeForPhrase(unquoted);
      if (!sanitized) {
        throw new Error('Query must contain alphanumeric characters');
      }
      return { tsQuery: sanitized, tsFunction: 'phraseto_tsquery' };
    }

    case 'code_symbol': {
      // Use prefix matching for code symbols (current behavior)
      const prefixQuery = buildPrefixTsQuery(trimmed);
      if (!prefixQuery) {
        throw new Error('Query must contain alphanumeric characters');
      }
      return { tsQuery: prefixQuery, tsFunction: 'to_tsquery' };
    }

    default: {
      // Use websearch_to_tsquery for natural language
      // It handles stemming, stop words, and is robust against syntax errors
      const sanitized = sanitizeForWebsearch(trimmed);
      if (!sanitized) {
        throw new Error('Query must contain alphanumeric characters');
      }
      return { tsQuery: sanitized, tsFunction: 'websearch_to_tsquery' };
    }
  }
}

/**
 * Performs BM25 full-text search with smart query type detection.
 *
 * This function automatically detects the query type and uses the appropriate
 * PostgreSQL tsquery function:
 * - Natural language queries use websearch_to_tsquery (handles stemming, stop words)
 * - Code symbol queries use to_tsquery with prefix matching
 * - Phrase queries use phraseto_tsquery for exact sequence matching
 *
 * @param db - PostgreSQL connection pool
 * @param params - Search parameters
 * @returns Search results with metadata
 */
export async function bm25Search(db: Pool, params: BM25Params): Promise<BM25Result[]> {
  const response = await bm25SearchWithMetadata(db, params);
  return response.results;
}

/**
 * Performs BM25 search and returns results with metadata for diagnostics.
 *
 * @param db - PostgreSQL connection pool
 * @param params - Search parameters
 * @returns Search results with query type and timing metadata
 */
export async function bm25SearchWithMetadata(
  db: Pool,
  params: BM25Params
): Promise<BM25SearchResponse> {
  const startTime = performance.now();

  const topK = params.topK ?? DEFAULT_TOP_K;
  const envLanguage = process.env.FTS_LANGUAGE?.trim();
  const language = params.language ?? (envLanguage ? envLanguage : DEFAULT_LANGUAGE);
  const trimmedQuery = params.query.trim();

  if (!trimmedQuery) {
    throw new Error('Query must not be empty');
  }

  if (!Number.isFinite(topK) || topK <= 0) {
    throw new Error('topK must be a positive number');
  }

  // Detect query type and build appropriate tsquery
  const queryType = detectQueryType(trimmedQuery);
  const { tsQuery, tsFunction } = buildSmartTsQuery(trimmedQuery, queryType);

  // Handle tech_stack filtering: empty array means no filter
  const techStackFilter = params.techStack && params.techStack.length > 0 ? params.techStack : null;

  // Build the SQL query with the appropriate tsquery function
  const sql = buildBM25Query(tsFunction);

  const { rows } = await db.query<BM25Row>(sql, [
    language,
    tsQuery,
    params.collectionId,
    topK,
    techStackFilter,
  ]);

  const elapsedMs = Math.round(performance.now() - startTime);

  if (rows.length === 0) {
    return {
      results: [],
      metadata: {
        queryType,
        tsFunction,
        elapsedMs,
        resultCount: 0,
      },
    };
  }

  const maxRank = rows.reduce((max, row) => {
    const value = typeof row.rank === 'number' ? row.rank : 0;
    return value > max ? value : max;
  }, 0);
  const safeMaxRank = maxRank > 0 ? maxRank : 1;

  const results = rows.map((row, index) => {
    const metadata =
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : null;
    const rawRank = typeof row.rank === 'number' ? row.rank : 0;

    return {
      chunkId: row.chunk_id,
      text: row.text,
      rank: index + 1,
      score: rawRank / safeMaxRank,
      docId: row.doc_id,
      docTitle: row.doc_title ?? null,
      sourceUrl: row.source_url ?? null,
      metadata,
    };
  });

  return {
    results,
    metadata: {
      queryType,
      tsFunction,
      elapsedMs,
      resultCount: results.length,
    },
  };
}

/**
 * Builds the SQL query with the specified tsquery function.
 * Uses parameterized function name in the query.
 */
function buildBM25Query(tsFunction: TsQueryFunction): string {
  // Map function names to their SQL representations
  // Note: websearch_to_tsquery and phraseto_tsquery take the query directly
  // to_tsquery expects pre-formatted query with operators
  const allowedFunctions: Record<TsQueryFunction, string> = {
    to_tsquery: 'to_tsquery',
    plainto_tsquery: 'plainto_tsquery',
    websearch_to_tsquery: 'websearch_to_tsquery',
    phraseto_tsquery: 'phraseto_tsquery',
  };

  const fn = allowedFunctions[tsFunction];
  if (!fn) {
    throw new Error(`Invalid tsquery function: ${tsFunction}`);
  }

  const functionCall = `${fn}($1::regconfig, $2)`;

  return `
    SELECT
      ch.id AS chunk_id,
      ch.text,
      ch.metadata,
      ch.doc_id,
      d.title AS doc_title,
      d.source_url,
      ts_rank_cd(
        to_tsvector($1::regconfig, ch.text),
        ${functionCall}
      ) AS rank
    FROM chunks ch
    JOIN documents d ON d.id = ch.doc_id
    WHERE d.collection_id = $3
      AND to_tsvector($1::regconfig, ch.text) @@ ${functionCall}
      AND (
        $5::text[] IS NULL
        OR ch.metadata->'tech_stack' ?| $5::text[]
      )
    ORDER BY rank DESC
    LIMIT $4
  `;
}

/**
 * Builds a prefix-matching tsquery for code symbols.
 * Each term gets a :* suffix for prefix matching.
 *
 * @param input - The search query
 * @returns Formatted tsquery string with prefix operators
 */
function buildPrefixTsQuery(input: string): string {
  const terms = input
    .split(/\s+/)
    .map((term) => term.replace(/[':*&|!()]/g, '').trim())
    .filter((term) => term.length > 0)
    .map((term) => `${term}:*`);

  return terms.join(' & ');
}

/**
 * Sanitizes input for websearch_to_tsquery and converts to OR logic.
 *
 * Natural language queries work better with OR logic because:
 * 1. Not all terms may exist in the corpus (e.g., "stateless" vs "stateful")
 * 2. Users expect partial matches to return results
 * 3. AND logic is too strict for question-style queries
 *
 * websearch_to_tsquery uses AND by default, but respects "or" keyword.
 * We insert "or" between terms to get broader matching.
 *
 * @param input - The search query
 * @returns Sanitized query string with OR logic
 */
function sanitizeForWebsearch(input: string): string {
  // Remove characters that could cause syntax issues
  const cleaned = input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/[?!.,;:]/g, '') // Remove punctuation
    .trim();

  // Check if there are any alphanumeric characters
  if (!/[a-zA-Z0-9]/.test(cleaned)) {
    return '';
  }

  const rawTokens = cleaned.split(/\s+/).filter((word) => word.length > 0);

  // If the user is explicitly using boolean operators, treat this as an
  // advanced websearch query and do not rewrite it into OR logic.
  if (rawTokens.some((token) => /^(or|and|not)$/i.test(token))) {
    return cleaned;
  }

  // Split into words and filter out empty/short terms
  const words = rawTokens.filter(
    (word) =>
      !/^(the|a|an|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|must|shall|can|need|dare|ought|used|to|of|in|for|on|with|at|by|from|as|into|through|during|before|after|above|below|between|under|again|further|then|once|here|there|when|where|why|how|all|each|few|more|most|other|some|such|no|nor|not|only|own|same|so|than|too|very|just|and|but|because|until|while|although|though|even|what|which|who|whom|this|that|these|those|i|you|he|she|it|we|they|me|him|her|us|them|my|your|his|its|our|their)$/i.test(
        word
      )
  );

  if (words.length === 0) {
    // If all words were filtered out, use the original cleaned input
    // but still apply OR logic
    const fallbackWords = cleaned.split(/\s+/).filter((w) => w.length > 0);
    if (fallbackWords.length === 0) {
      return '';
    }
    return fallbackWords.join(' or ');
  }

  // Join with "or" for broader matching
  // websearch_to_tsquery will interpret "word1 or word2" as word1 | word2
  return words.join(' or ');
}

/**
 * Sanitizes input for phraseto_tsquery.
 * Removes special characters but preserves spaces for phrase matching.
 *
 * @param input - The search query (without surrounding quotes)
 * @returns Sanitized query string
 */
function sanitizeForPhrase(input: string): string {
  // Remove tsquery operators and special characters
  const cleaned = input
    .replace(/[':*&|!()<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Check if there are any alphanumeric characters
  if (!/[a-zA-Z0-9]/.test(cleaned)) {
    return '';
  }

  return cleaned;
}
