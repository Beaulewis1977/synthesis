export interface ChunkOptions {
  /** Maximum number of characters per chunk (default: 800). */
  maxSize?: number;
  /** Number of overlapping characters between consecutive chunks (default: 150). */
  overlap?: number;
  /** Custom paragraph separator detection (default: two or more newlines). */
  paragraphSeparator?: RegExp;
}

import type { ChunkMetadata as SharedChunkMetadata } from '@synthesis/shared';

export interface ChunkMetadata extends SharedChunkMetadata {
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
 * Splits free-form text into overlapping chunks sized for downstream embedding.
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

function normaliseNewlines(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}
