/**
 * Sentence Boundary Detection Module
 *
 * Phase 11: Improved text chunking heuristics with robust sentence boundary detection.
 *
 * This module provides accurate sentence splitting that handles:
 * - Common abbreviations (Dr., Mr., Mrs., etc.)
 * - Version numbers (3.24.5, v2.0.1)
 * - Decimal numbers (3.14, 0.5)
 * - URLs and file paths
 * - Inline code and code blocks
 * - Initials (J.K., U.S., etc.)
 * - Ellipsis (...)
 */

/**
 * Sentence splitting mode.
 * - 'regex': Fast, rule-based splitting (default)
 * - 'nlp': More accurate but requires optional sbd dependency
 */
export type SentenceSplitMode = 'regex' | 'nlp';

export interface SentenceSplitOptions {
  /** Splitting mode: 'regex' (default) or 'nlp' */
  mode?: SentenceSplitMode;
  /** Preserve code blocks as single units (default: true) */
  preserveCodeBlocks?: boolean;
  /** Custom abbreviations to add to the default set */
  customAbbreviations?: string[];
}

/**
 * Common abbreviations that should NOT trigger sentence splits.
 * Stored in lowercase for case-insensitive matching.
 */
const ABBREVIATIONS: ReadonlySet<string> = new Set([
  // Titles
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'sr',
  'jr',
  'rev',
  'hon',
  'gen',
  'col',
  'lt',
  'sgt',
  'capt',
  'cmdr',
  'adm',

  // Academic
  'ph.d',
  'phd',
  'm.d',
  'md',
  'b.a',
  'ba',
  'm.a',
  'ma',
  'b.s',
  'bs',
  'm.s',
  'd.d.s',
  'dds',
  'j.d',
  'jd',
  'ed.d',
  'edd',

  // Latin abbreviations
  'vs',
  'etc',
  'al',
  'e.g',
  'eg',
  'i.e',
  'ie',
  'cf',
  'viz',
  'et',
  'ibid',
  'op',
  'cit',
  'n.b',
  'nb',
  'p.s',
  'ps',

  // Months
  'jan',
  'feb',
  'mar',
  'apr',
  'jun',
  'jul',
  'aug',
  'sep',
  'sept',
  'oct',
  'nov',
  'dec',

  // Business/Legal
  'inc',
  'ltd',
  'corp',
  'co',
  'llc',
  'plc',
  'assn',
  'bros',
  'dept',
  'div',
  'est',
  'govt',
  'intl',
  'natl',

  // Address
  'st',
  'ave',
  'blvd',
  'rd',
  'ln',
  'ct',
  'pl',
  'sq',
  'apt',
  'ste',
  'bldg',
  'fl',
  'rm',

  // Measurements
  'ft',
  'in',
  'yd',
  'mi',
  'oz',
  'lb',
  'lbs',
  'pt',
  'qt',
  'gal',
  'cm',
  'mm',
  'km',
  'kg',
  'mg',
  'ml',

  // Other common
  'fig',
  'no',
  'nos',
  'vol',
  'vols',
  'ed',
  'eds',
  'pp',
  'pg',
  'pgs',
  'ch',
  'sec',
  'approx',
  'ca',
  'c',
  'min',
  'max',
  'avg',
  'tel',
  'fax',
  'ext',
  'ref',
  'misc',
  'orig',
  'trans',
  'repr',
  'abr',
  'anon',
  'attrib',
]);

/**
 * Checks if a period at the given position is likely an abbreviation or initial.
 */
function isAbbreviationPeriod(
  text: string,
  periodIndex: number,
  abbreviations: ReadonlySet<string>
): boolean {
  // Look backwards to find the word before the period
  let wordStart = periodIndex - 1;
  while (wordStart >= 0 && /[a-zA-Z.]/.test(text[wordStart])) {
    wordStart--;
  }
  wordStart++;

  if (wordStart >= periodIndex) {
    return false;
  }

  const word = text.slice(wordStart, periodIndex).toLowerCase();

  // Check if it's a known abbreviation
  if (abbreviations.has(word)) {
    return true;
  }

  // Check for abbreviations with internal periods (e.g., "e.g", "i.e")
  const wordWithoutPeriods = word.replace(/\./g, '');
  if (abbreviations.has(wordWithoutPeriods) || abbreviations.has(word.replace(/\.$/, ''))) {
    return true;
  }

  // Check for initials pattern (e.g., J.K., U.S.A.)
  // Pattern: single uppercase letter, possibly preceded by other initials
  const beforePeriod = text.slice(wordStart, periodIndex);
  if (/^[A-Z]$/.test(beforePeriod)) {
    // Single uppercase letter - check what follows
    const afterPeriod = text.slice(periodIndex + 1);
    // If followed by space and lowercase, or another initial, it's an initial
    if (/^\s+[a-z]/.test(afterPeriod) || /^\s*[A-Z]\./.test(afterPeriod)) {
      return true;
    }
    // If followed by space and uppercase that's part of a name (not sentence start)
    // Check if the next word looks like a name (capitalized but not all caps)
    const nextWordMatch = afterPeriod.match(/^\s+([A-Z][a-z]+)/);
    if (nextWordMatch) {
      return true; // Likely "J.K. Rowling" pattern
    }
  }

  // Check for multi-letter initials like "Ph.D" or "U.S"
  if (/^[A-Za-z]$/.test(word)) {
    return true;
  }

  return false;
}

/**
 * Checks if the position is inside a protected pattern (URL, version, code, etc.)
 */
function isInsideProtectedPattern(text: string, index: number, preserveCodeBlocks = true): boolean {
  if (preserveCodeBlocks) {
    // Check if inside inline code (`...`)
    let backtickCount = 0;
    for (let i = 0; i < index; i++) {
      if (text[i] === '`' && (i === 0 || text[i - 1] !== '\\')) {
        backtickCount++;
      }
    }
    if (backtickCount % 2 === 1) {
      return true; // Inside inline code
    }

    // Check if inside fenced code block (```...```)
    const beforeIndex = text.slice(0, index);
    const fenceMatches = beforeIndex.match(/```/g);
    if (fenceMatches && fenceMatches.length % 2 === 1) {
      return true; // Inside fenced code block
    }
  }

  // Check if this period is part of a URL
  // Look for http://, https://, or www. before this position
  const urlStart = Math.max(0, index - 100);
  const beforeText = text.slice(urlStart, index);
  if (/https?:\/\/[^\s]*$/.test(beforeText) || /www\.[^\s]*$/.test(beforeText)) {
    // Check if we're still in the URL (no whitespace after)
    const afterText = text.slice(index);
    if (/^[^\s<>")\]]+/.test(afterText)) {
      return true;
    }
  }

  // Check if this period is part of a version number (e.g., 3.24.5)
  // Look for digit before and digit after
  if (index > 0 && index < text.length - 1) {
    const before = text[index - 1];
    const after = text[index + 1];
    if (/\d/.test(before) && /\d/.test(after)) {
      return true; // Part of a version/decimal number
    }
  }

  // Check if this period is part of a file extension
  // Pattern: word.ext where ext is a known extension
  const fileExtPattern =
    /\.(ts|js|tsx|jsx|py|java|go|rs|rb|php|css|html|json|yaml|yml|md|txt|xml|sql|sh|c|cpp|h|cs|swift|kt|dart|vue|svelte)$/i;
  const beforeWord = text.slice(Math.max(0, index - 20), index + 10);
  const spaceIndex = beforeWord.indexOf(' ');
  const sliceEnd = spaceIndex === -1 ? undefined : spaceIndex;
  if (fileExtPattern.test(beforeWord.slice(0, sliceEnd))) {
    return true;
  }

  // Check if this is part of an ellipsis (...)
  if (index > 0 && index < text.length - 1) {
    if (text[index - 1] === '.' || text[index + 1] === '.') {
      return true;
    }
  }

  // Check if this is part of initials (J.K., U.S.A.)
  // Pattern: single letter followed by period, possibly repeated
  if (index >= 1) {
    const prevChar = text[index - 1];
    if (/[A-Z]/.test(prevChar)) {
      // Check if this looks like initials
      const initialsPattern = /(?:^|[^A-Za-z])([A-Z]\.)+$/;
      const beforeText2 = text.slice(Math.max(0, index - 10), index + 1);
      if (initialsPattern.test(beforeText2)) {
        // Check what comes after - if it's another initial or lowercase, it's initials
        const afterChar = text[index + 1];
        if (afterChar && (/[A-Z]/.test(afterChar) || /\s/.test(afterChar))) {
          // Check if the next non-space char is uppercase (new sentence) or lowercase (continuation)
          const afterTrimmed = text.slice(index + 1).trimStart();
          if (afterTrimmed.length > 0 && /[a-z]/.test(afterTrimmed[0])) {
            return true; // Continuation after initials
          }
        }
      }
    }
  }

  return false;
}

/**
 * Checks if the character after the period indicates a sentence boundary.
 */
function isLikelySentenceEnd(text: string, punctIndex: number): boolean {
  const afterPunct = text.slice(punctIndex + 1);

  // Must have whitespace after punctuation
  if (!/^\s/.test(afterPunct)) {
    return false;
  }

  // Find the first non-whitespace character after
  const match = afterPunct.match(/^\s+(\S)/);
  if (!match) {
    // End of text after whitespace is a sentence end
    return true;
  }

  const nextChar = match[1];

  // Next sentence should start with uppercase, quote, or opening bracket
  if (/[A-Z"'(\[{]/.test(nextChar)) {
    return true;
  }

  // Numbers can start sentences (e.g., "1. First item")
  if (/\d/.test(nextChar)) {
    return true;
  }

  return false;
}

/**
 * Finds the last sentence boundary within the given range.
 * Returns -1 if no valid boundary is found.
 */
export function findLastSentenceBoundary(
  text: string,
  start: number,
  limit: number,
  options: SentenceSplitOptions = {}
): number {
  const { customAbbreviations = [], preserveCodeBlocks = true } = options;

  if (limit <= start) {
    return -1;
  }

  // Build abbreviation set with custom additions
  const abbreviations =
    customAbbreviations.length > 0
      ? new Set([...ABBREVIATIONS, ...customAbbreviations.map((a) => a.toLowerCase())])
      : ABBREVIATIONS;

  const window = text.slice(start, limit);
  let lastBoundary = -1;

  // Match sentence-ending punctuation followed by optional closing quotes/brackets and whitespace
  const punctuationMatches = window.matchAll(/[.!?]["')\]]*\s+/g);

  for (const match of punctuationMatches) {
    const matchIndex = match.index ?? 0;
    const absoluteIndex = start + matchIndex;
    const punct = match[0][0];

    // Skip if inside protected pattern
    if (isInsideProtectedPattern(text, absoluteIndex, preserveCodeBlocks)) {
      continue;
    }

    // For periods, check if it's an abbreviation
    if (punct === '.') {
      if (isAbbreviationPeriod(text, absoluteIndex, abbreviations)) {
        continue;
      }
    }

    // Check if this looks like a real sentence end
    if (!isLikelySentenceEnd(text, absoluteIndex)) {
      continue;
    }

    // Valid boundary found
    const boundaryIndex = start + matchIndex + match[0].length;
    if (boundaryIndex <= limit) {
      lastBoundary = boundaryIndex;
    }
  }

  return lastBoundary;
}

/**
 * Finds the first sentence boundary within the given range.
 * Returns -1 if no valid boundary is found.
 */
export function findFirstSentenceBoundary(
  text: string,
  rangeStart: number,
  rangeEnd: number,
  options: SentenceSplitOptions = {}
): number {
  const { customAbbreviations = [], preserveCodeBlocks = true } = options;

  if (rangeEnd <= rangeStart) {
    return -1;
  }

  // Build abbreviation set with custom additions
  const abbreviations =
    customAbbreviations.length > 0
      ? new Set([...ABBREVIATIONS, ...customAbbreviations.map((a) => a.toLowerCase())])
      : ABBREVIATIONS;

  const window = text.slice(rangeStart, rangeEnd);
  const punctuationMatches = window.matchAll(/[.!?]["')\]]*\s+/g);

  for (const match of punctuationMatches) {
    const matchIndex = match.index ?? 0;
    const absoluteIndex = rangeStart + matchIndex;
    const punct = match[0][0];

    // Skip if inside protected pattern
    if (isInsideProtectedPattern(text, absoluteIndex, preserveCodeBlocks)) {
      continue;
    }

    // For periods, check if it's an abbreviation
    if (punct === '.') {
      if (isAbbreviationPeriod(text, absoluteIndex, abbreviations)) {
        continue;
      }
    }

    // Check if this looks like a real sentence end
    if (!isLikelySentenceEnd(text, absoluteIndex)) {
      continue;
    }

    // Valid boundary found
    const boundaryIndex = rangeStart + matchIndex + match[0].length;
    if (boundaryIndex <= rangeEnd) {
      return boundaryIndex;
    }
  }

  return -1;
}

/**
 * Splits text into sentences using improved heuristics.
 */
export function splitIntoSentences(text: string, options: SentenceSplitOptions = {}): string[] {
  const { mode = 'regex', customAbbreviations = [], preserveCodeBlocks = true } = options;

  if (!text.trim()) {
    return [];
  }

  if (mode === 'nlp') {
    return splitWithNLP(text, options);
  }

  // Build abbreviation set with custom additions
  const abbreviations =
    customAbbreviations.length > 0
      ? new Set([...ABBREVIATIONS, ...customAbbreviations.map((a) => a.toLowerCase())])
      : ABBREVIATIONS;

  const sentences: string[] = [];
  let currentStart = 0;

  // Find all potential sentence boundaries
  const punctuationMatches = [...text.matchAll(/[.!?]["')\]]*\s+/g)];

  for (const match of punctuationMatches) {
    const matchIndex = match.index ?? 0;
    const punct = match[0][0];

    // Skip if inside protected pattern
    if (isInsideProtectedPattern(text, matchIndex, preserveCodeBlocks)) {
      continue;
    }

    // For periods, check if it's an abbreviation
    if (punct === '.') {
      if (isAbbreviationPeriod(text, matchIndex, abbreviations)) {
        continue;
      }
    }

    // Check if this looks like a real sentence end
    if (!isLikelySentenceEnd(text, matchIndex)) {
      continue;
    }

    // Extract sentence
    const sentenceEnd = matchIndex + match[0].length;
    const sentence = text.slice(currentStart, sentenceEnd).trim();

    if (sentence) {
      sentences.push(sentence);
    }

    currentStart = sentenceEnd;
  }

  // Add remaining text as final sentence
  if (currentStart < text.length) {
    const sentence = text.slice(currentStart).trim();
    if (sentence) {
      sentences.push(sentence);
    }
  }

  return sentences;
}

/**
 * Splits text using NLP-based sentence boundary detection.
 * Falls back to regex mode if the sbd library is not available.
 */
function splitWithNLP(text: string, options: SentenceSplitOptions): string[] {
  try {
    // Dynamic import to avoid requiring sbd as a hard dependency
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sbd = require('sbd');
    return sbd.sentences(text, {
      newline_boundaries: false,
      html_boundaries: false,
      sanitize: false,
      preserve_whitespace: false,
      abbreviations: options.customAbbreviations,
    });
  } catch {
    // Fall back to regex mode if sbd is not installed
    console.warn(
      'NLP mode requested but sbd library not available. Falling back to regex mode. ' +
        'Install with: npm install sbd'
    );
    return splitIntoSentences(text, { ...options, mode: 'regex' });
  }
}

/**
 * Gets the default sentence split mode from environment variable.
 */
export function getDefaultSentenceSplitMode(): SentenceSplitMode {
  const envMode = process.env.TEXT_CHUNKING_MODE?.toLowerCase();
  if (envMode === 'nlp') {
    return 'nlp';
  }
  return 'regex';
}

/**
 * Validates that the sentence splitter is working correctly.
 * Useful for testing and debugging.
 */
export function validateSentenceSplitter(): { passed: boolean; failures: string[] } {
  const testCases: Array<{ input: string; expectedCount: number; description: string }> = [
    {
      input: 'Dr. Smith went home. He was tired.',
      expectedCount: 2,
      description: 'Abbreviation Dr.',
    },
    {
      input: 'Use Flutter 3.24.5 for this project. It works well.',
      expectedCount: 2,
      description: 'Version number',
    },
    {
      input: 'The value is 3.14 radians. That is pi.',
      expectedCount: 2,
      description: 'Decimal number',
    },
    {
      input: 'Call `foo.bar()` method. It returns null.',
      expectedCount: 2,
      description: 'Inline code',
    },
    {
      input: 'Mr. and Mrs. Jones arrived. They were happy.',
      expectedCount: 2,
      description: 'Multiple abbreviations',
    },
    {
      input: 'See e.g. the documentation. It explains everything.',
      expectedCount: 2,
      description: 'Latin abbreviation',
    },
  ];

  const failures: string[] = [];

  for (const { input, expectedCount, description } of testCases) {
    const sentences = splitIntoSentences(input);
    if (sentences.length !== expectedCount) {
      failures.push(
        `${description}: expected ${expectedCount} sentences, got ${sentences.length}. ` +
          `Input: "${input}" → Output: ${JSON.stringify(sentences)}`
      );
    }
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}
