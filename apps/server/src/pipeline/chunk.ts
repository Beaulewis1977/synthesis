export interface ChunkOptions {
  /** Maximum number of characters per chunk (default: 800). */
  maxSize?: number;
  /** Number of overlapping characters between consecutive chunks (default: 150). */
  overlap?: number;
  /** Custom paragraph separator detection (default: two or more newlines). */
  paragraphSeparator?: RegExp;
}

export interface ChunkMetadata {
  /** Inclusive start offset within the source text. */
  startOffset: number;
  /** Exclusive end offset within the source text. */
  endOffset: number;
  /** Optional heading inferred from the chunk content. */
  heading?: string;
  /** Optional section metadata (reserved for future use). */
  section?: string;
  /** Optional page number if present in the source metadata. */
  pageNumber?: number;
  [key: string]: unknown;
}

export interface Chunk {
  /** The text content of the chunk. */
  text: string;
  /** Position of the chunk within the generated sequence (0-based). */
  index: number;
  /** Metadata describing this chunk. */
  metadata: ChunkMetadata;
}

interface NormalisedOptions {
  maxSize: number;
  overlap: number;
  paragraphSeparator: RegExp;
}

const DEFAULTS: NormalisedOptions = {
  maxSize: 800,
  overlap: 150,
  paragraphSeparator: /\n{2,}/g,
};

/**
 * Split a text into overlapping, trimmed chunks optimized for downstream embedding.
 *
 * @param text - The input text to split; CRLF/CR line endings are normalized to LF before processing.
 * @param options - Chunking configuration. Supported fields:
 *   - `maxSize` (default 800): preferred maximum characters per chunk.
 *   - `overlap` (default 150): number of characters to overlap between consecutive chunks.
 *   - `paragraphSeparator` (default: regex matching two or more newlines): pattern used to prefer paragraph breaks.
 * @param documentMetadata - Metadata to merge into each chunk's `metadata`; `startOffset`, `endOffset`, and inferred `heading` are added or overridden per chunk.
 * @returns An array of chunks covering the input text in order; each chunk includes `text`, a zero-based `index`, and `metadata` with `startOffset` (inclusive) and `endOffset` (exclusive). Returns an empty array for input that is empty or only whitespace after normalization.
 */
export function chunkText(
  text: string,
  options: ChunkOptions = {},
  documentMetadata: Record<string, unknown> = {}
): Chunk[] {
  const normalisedText = normaliseNewlines(text).trim();

  if (normalisedText.length === 0) {
    return [];
  }

  const config: NormalisedOptions = {
    maxSize: options.maxSize ?? DEFAULTS.maxSize,
    overlap: options.overlap ?? DEFAULTS.overlap,
    paragraphSeparator: options.paragraphSeparator ?? DEFAULTS.paragraphSeparator,
  };

  if (config.maxSize <= 0) {
    throw new Error('chunk maxSize must be greater than zero');
  }

  if (config.overlap < 0) {
    throw new Error('chunk overlap cannot be negative');
  }

  if (config.overlap >= config.maxSize) {
    throw new Error('chunk overlap must be smaller than maxSize');
  }

  const chunks: Chunk[] = [];
  const length = normalisedText.length;
  let start = 0;
  let chunkIndex = 0;

  while (start < length) {
    const { end, hardLimit } = determineChunkEnd(normalisedText, start, config);
    const rawChunk = normalisedText.slice(start, end);
    const trimmedChunk = rawChunk.replace(/\s+$/u, '');

    if (trimmedChunk.length === 0) {
      // Prevent infinite loops when encountering excessive whitespace.
      start = hardLimit;
      continue;
    }

    const trailingWhitespace = rawChunk.length - trimmedChunk.length;
    const startOffset = start;
    const endOffset = end - trailingWhitespace;

    const candidate: Chunk = {
      text: trimmedChunk,
      index: chunkIndex,
      metadata: {
        ...documentMetadata,
        startOffset,
        endOffset,
        heading:
          extractHeading(trimmedChunk.trimStart()) ??
          (documentMetadata.heading as string | undefined),
      },
    };

    const previous = chunks[chunks.length - 1];
    if (previous && candidate.metadata.endOffset <= previous.metadata.endOffset) {
      start = endOffset;
      continue;
    }

    chunkIndex += 1;
    chunks.push(candidate);

    if (end >= length) {
      break;
    }

    let nextStart = end - config.overlap;
    if (nextStart <= start) {
      nextStart = end;
    }

    start = nextStart;
  }

  return chunks;
}

/**
 * Determine the end index for a chunk starting at `start` using paragraph/sentence heuristics and size constraints.
 *
 * @param text - The full source text being chunked.
 * @param start - The inclusive start index for the current chunk.
 * @param config - Normalised options controlling `maxSize`, `overlap`, and `paragraphSeparator`.
 * @returns An object with:
 *  - `end`: the exclusive end index where the chunk should finish (chosen by paragraph break, sentence boundary, or size limit),
 *  - `hardLimit`: the maximum index considered when searching for boundaries (typically `min(start + maxSize, text.length)`, but may be `start + maxSize + overlap` when a forward sentence boundary is used).
 */
function determineChunkEnd(
  text: string,
  start: number,
  config: NormalisedOptions
): { end: number; hardLimit: number } {
  const hardLimit = Math.min(start + config.maxSize, text.length);

  if (hardLimit === text.length) {
    return { end: hardLimit, hardLimit };
  }

  const paragraphBreak = findParagraphBreak(text, start, hardLimit, config.paragraphSeparator);
  if (paragraphBreak > start) {
    return { end: paragraphBreak, hardLimit };
  }

  const sentenceBoundary = findLastSentenceBoundary(text, start, hardLimit);
  if (sentenceBoundary > start) {
    return { end: sentenceBoundary, hardLimit };
  }

  const extendedLimit = Math.min(start + config.maxSize + config.overlap, text.length);
  if (extendedLimit > hardLimit) {
    const forwardBoundary = findFirstSentenceBoundary(text, hardLimit, extendedLimit);
    if (forwardBoundary > hardLimit) {
      return { end: forwardBoundary, hardLimit: extendedLimit };
    }
  }

  return { end: hardLimit, hardLimit };
}

/**
 * Locate the last paragraph separator between `start` and `limit` and return the index immediately after it.
 *
 * Searches `text` for the final match of `paragraphSeparator` whose match position is greater than `start` and less than `limit`. If found, returns the position after any leading newline characters that follow the separator so the separator is included in the chunk; otherwise returns `-1`.
 *
 * @param text - The full text to search.
 * @param start - The inclusive start index from which to search for paragraph separators.
 * @param limit - The exclusive upper bound for match positions.
 * @param paragraphSeparator - A RegExp used to identify paragraph separators; the function will iterate matches and will reset `paragraphSeparator.lastIndex` to `0` before returning.
 * @returns `-1` if no suitable paragraph separator is found; otherwise the index immediately after the separator (including any following newline characters).
 */
function findParagraphBreak(
  text: string,
  start: number,
  limit: number,
  paragraphSeparator: RegExp
): number {
  paragraphSeparator.lastIndex = start;
  let candidate = -1;
  while (true) {
    const match = paragraphSeparator.exec(text);
    if (!match || match.index >= limit) {
      break;
    }

    candidate = match.index;
  }

  paragraphSeparator.lastIndex = 0;

  if (candidate <= start) {
    return -1;
  }

  // Include the separator characters in the chunk to avoid leading newlines later.
  const separatorLength = (text.slice(candidate).match(/^\n+/) ?? [''])[0].length;
  return candidate + separatorLength;
}

/**
 * Finds the final sentence boundary within the specified window of the text.
 *
 * @param text - The full text to search
 * @param start - The start offset (inclusive) of the search window
 * @param limit - The end offset (exclusive) of the search window
 * @returns The index in `text` immediately after the last sentence-ending punctuation and following whitespace within `[start, limit)`, or `-1` if no sentence boundary is found
 */
function findLastSentenceBoundary(text: string, start: number, limit: number): number {
  if (limit <= start) {
    return -1;
  }

  const window = text.slice(start, limit);
  const punctuationMatches = window.matchAll(/[.!?]["')\]]*\s+/g);
  let boundary = -1;

  for (const match of punctuationMatches) {
    const index = start + (match.index ?? 0) + match[0].length;
    if (index <= limit) {
      boundary = index;
    }
  }

  return boundary;
}

/**
 * Finds the first sentence boundary inside the specified substring range.
 *
 * A sentence boundary is defined as a sentence-ending punctuation mark (`.`, `!`, or `?`)
 * optionally followed by closing quotes/parens/brackets and then whitespace.
 *
 * @param text - The full text to search
 * @param rangeStart - Inclusive start index of the search range
 * @param rangeEnd - Exclusive end index of the search range
 * @returns The index immediately after the sentence boundary within `[rangeStart, rangeEnd]`, or `-1` if none is found
 */
function findFirstSentenceBoundary(text: string, rangeStart: number, rangeEnd: number): number {
  if (rangeEnd <= rangeStart) {
    return -1;
  }

  const window = text.slice(rangeStart, rangeEnd);
  const punctuationMatches = window.matchAll(/[.!?]["')\]]*\s+/g);

  for (const match of punctuationMatches) {
    const index = rangeStart + (match.index ?? 0) + match[0].length;
    if (index <= rangeEnd) {
      return index;
    }
  }

  return -1;
}

/**
 * Infer a heading from the first line of a text chunk.
 *
 * @param chunk - The chunk of text to inspect
 * @returns The first line as a heading if it is non-empty, at most 120 characters, and starts with `#` or an uppercase letter; `undefined` otherwise.
 */
function extractHeading(chunk: string): string | undefined {
  const firstLine = chunk.split('\n', 1)[0]?.trim();
  if (!firstLine) {
    return undefined;
  }

  if (firstLine.length <= 120 && /^[#A-Z]/.test(firstLine)) {
    return firstLine;
  }

  return undefined;
}

/**
 * Normalize line endings to LF (`\n`).
 *
 * @param text - The input string whose line endings should be normalized
 * @returns The input string with all CRLF (`\r\n`) and CR (`\r`) sequences replaced by LF (`\n`)
 */
function normaliseNewlines(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}