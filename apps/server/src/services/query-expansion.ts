/**
 * Query Expansion Service
 *
 * Expands queries to improve retrieval recall by:
 * 1. Synonym expansion for technical terms
 * 2. Query reformulation
 * 3. Multi-query generation
 * 4. Fallback queries for zero-hit recovery
 */

// Technical synonym dictionary for documentation search
const TECHNICAL_SYNONYMS: Record<string, string[]> = {
  auth: ['authentication', 'authorization', 'login', 'signin'],
  config: ['configuration', 'settings', 'setup'],
  api: ['endpoint', 'route', 'interface'],
  func: ['function', 'method'],
  db: ['database', 'storage', 'data store'],
  err: ['error', 'exception', 'failure'],
  async: ['asynchronous', 'promise', 'future', 'await'],
  mfa: ['multi-factor authentication', '2fa', 'two-factor'],
  jwt: ['json web token', 'token'],
  oauth: ['oauth2', 'oauth 2.0', 'authentication'],
  ui: ['user interface', 'interface', 'frontend'],
  ux: ['user experience', 'usability'],
  repo: ['repository', 'git repository'],
  dep: ['dependency', 'dependencies', 'package'],
  env: ['environment', 'configuration'],
  var: ['variable', 'property'],
  param: ['parameter', 'argument'],
  arg: ['argument', 'parameter'],
  ref: ['reference', 'pointer'],
  doc: ['documentation', 'docs'],
  pkg: ['package', 'module'],
  lib: ['library', 'module'],
  fn: ['function', 'method'],
  obj: ['object', 'instance'],
  arr: ['array', 'list'],
  str: ['string', 'text'],
  int: ['integer', 'number'],
  bool: ['boolean', 'flag'],
  util: ['utility', 'helper'],
  impl: ['implementation', 'code'],
  spec: ['specification', 'requirement'],
  req: ['request', 'http request'],
  res: ['response', 'http response'],
  cli: ['command line', 'terminal', 'shell'],
  gui: ['graphical user interface', 'desktop app'],
  sdk: ['software development kit', 'library'],
  ide: ['integrated development environment', 'editor'],
  ci: ['continuous integration', 'build pipeline'],
  cd: ['continuous deployment', 'deployment pipeline'],
  orm: ['object relational mapping', 'database abstraction'],
  rest: ['restful api', 'http api'],
  crud: ['create read update delete', 'data operations'],
  // Add more as needed
};

export interface ExpandedQuery {
  original: string;
  expanded: string;
  variants: string[];
}

/**
 * Expand a query with synonyms
 */
export function expandWithSynonyms(query: string): string {
  let expanded = query.toLowerCase();

  for (const [abbrev, synonyms] of Object.entries(TECHNICAL_SYNONYMS)) {
    const pattern = new RegExp(`\\b${abbrev}\\b`, 'gi');
    // Use replace directly - it returns unchanged string if no match
    expanded = expanded.replace(pattern, `${abbrev} ${synonyms[0]}`);
  }

  return expanded;
}

/**
 * Generate query variants for multi-query search
 */
export function generateQueryVariants(query: string): string[] {
  const variants: string[] = [query];

  // Variant 1: Question form
  if (!query.includes('?') && !query.toLowerCase().startsWith('how')) {
    variants.push(`How to ${query.toLowerCase()}`);
  }

  // Variant 2: Expanded synonyms
  const expanded = expandWithSynonyms(query);
  if (expanded !== query.toLowerCase()) {
    variants.push(expanded);
  }

  // Variant 3: Key terms only (remove stop words)
  const stopWords = [
    'the',
    'a',
    'an',
    'is',
    'are',
    'was',
    'were',
    'to',
    'of',
    'in',
    'for',
    'on',
    'with',
  ];
  const keyTerms = query
    .split(' ')
    .filter((word) => !stopWords.includes(word.toLowerCase()))
    .join(' ');
  if (keyTerms !== query && keyTerms.length > 3) {
    variants.push(keyTerms);
  }

  return [...new Set(variants)]; // Deduplicate
}

/**
 * Get fallback queries for zero-hit recovery
 */
export function getFallbackQueries(query: string): string[] {
  const fallbacks: string[] = [];

  // Fallback 1: Remove technical specifics, keep concepts
  const conceptQuery = query
    .replace(/[A-Z][a-z]+[A-Z][a-zA-Z]+/g, '') // Remove camelCase
    .replace(/[a-z]+_[a-z_]+/g, '') // Remove snake_case
    .replace(/\s+/g, ' ')
    .trim();
  if (conceptQuery.length > 5) {
    fallbacks.push(conceptQuery);
  }

  // Fallback 2: First few words only
  const words = query.split(' ');
  if (words.length > 3) {
    fallbacks.push(words.slice(0, 3).join(' '));
  }

  // Fallback 3: Extract technical terms (acronyms and abbreviations)
  const technicalTerms = query
    .split(' ')
    .filter((word) => {
      // Keep words that are in our synonym dictionary or are all caps
      const lower = word.toLowerCase();
      return TECHNICAL_SYNONYMS[lower] || /^[A-Z]{2,}$/.test(word);
    })
    .join(' ');
  if (technicalTerms.length > 0 && technicalTerms !== query) {
    fallbacks.push(technicalTerms);
  }

  return fallbacks.filter((f) => f.length > 0);
}

/**
 * Expand a query with all techniques and return structured result
 */
export function expandQuery(query: string): ExpandedQuery {
  const expanded = expandWithSynonyms(query);
  const variants = generateQueryVariants(query);

  return {
    original: query,
    expanded,
    variants,
  };
}
