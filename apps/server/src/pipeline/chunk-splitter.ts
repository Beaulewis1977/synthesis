/**
 * Chunk Splitter Service
 *
 * Handles splitting oversized chunks into smaller pieces while maintaining
 * semantic coherence and tracking parent-child relationships.
 *
 * @module pipeline/chunk-splitter
 */

import { randomUUID } from 'node:crypto';
import type { Chunk, ChunkMetadata } from './chunk.js';
import {
  CHARS_PER_TOKEN,
  type TokenLimitConfig,
  estimateTokens,
  getTokenLimit,
  validateChunkTokens,
} from './token-estimator.js';

/**
 * Extended chunk with parent-child relationship tracking.
 */
export interface SplitChunk extends Chunk {
  metadata: ChunkMetadata & {
    /** ID of the parent chunk if this is a split */
    parent_chunk_id?: string;
    /** Index of this split within the parent (0-based) */
    split_index?: number;
    /** Total number of splits from the parent */
    total_splits?: number;
    /** Whether this chunk was created by splitting */
    is_split?: boolean;
    /** Stable identifier for the original unsplit chunk/group across re-splits */
    original_chunk_id?: string;
  };
}

/**
 * Options for chunk splitting.
 */
export interface SplitOptions {
  /** Maximum tokens per chunk (derived from provider/model if not specified) */
  maxTokens?: number;
  /** Number of characters to overlap between splits (default: 150) */
  overlapChars?: number;
  /** Whether to preserve semantic boundaries (sentences, paragraphs) */
  preserveSemanticBoundaries?: boolean;
  /** Minimum chunk size in characters (to avoid tiny splits) */
  minChunkChars?: number;
}

/**
 * Result of validating and potentially splitting chunks.
 */
export interface ChunkValidationResult {
  /** All chunks after validation/splitting */
  chunks: SplitChunk[];
  /** Number of chunks that were split */
  splitCount: number;
  /** Number of new chunks created from splits */
  newChunksCreated: number;
  /** Any warnings generated during processing */
  warnings: string[];
}

/**
 * Default split options.
 */
const DEFAULT_SPLIT_OPTIONS: Required<SplitOptions> = {
  maxTokens: 7000, // Conservative default
  overlapChars: 150,
  preserveSemanticBoundaries: true,
  minChunkChars: 100,
};

/**
 * Get configured overlap size from environment or default.
 */
function getOverlapChars(): number {
  const overlap = Number.parseInt(process.env.CHUNK_OVERLAP_SIZE ?? '', 10);
  if (!Number.isNaN(overlap) && overlap >= 0) {
    return overlap;
  }
  return DEFAULT_SPLIT_OPTIONS.overlapChars;
}

/**
 * Check if auto-splitting is enabled.
 */
export function isAutoSplitEnabled(): boolean {
  const enabled = process.env.AUTO_SPLIT_CHUNKS?.toLowerCase();
  // Default to true if not specified
  return enabled !== 'false' && enabled !== '0';
}

/**
 * Split a single oversized chunk into smaller pieces.
 *
 * @param chunk - The chunk to split
 * @param options - Split options
 * @returns Array of split chunks with parent-child relationships
 */
export function splitOversizedChunk(chunk: Chunk, options: SplitOptions = {}): SplitChunk[] {
  const config: Required<SplitOptions> = {
    ...DEFAULT_SPLIT_OPTIONS,
    overlapChars: getOverlapChars(),
    ...options,
  };

  const text = chunk.text;
  const existingOriginalId =
    typeof chunk.metadata.original_chunk_id === 'string'
      ? chunk.metadata.original_chunk_id
      : undefined;

  const parentId = existingOriginalId ?? randomUUID();

  // Calculate target size in characters based on token limit
  // Use a conservative ratio to ensure we stay under the limit
  const targetChars = Math.floor(config.maxTokens * CHARS_PER_TOKEN);

  if (text.length <= targetChars) {
    // No split needed
    return [chunk as SplitChunk];
  }

  const splits: SplitChunk[] = [];
  let start = 0;
  let splitIndex = 0;

  while (start < text.length) {
    // Calculate end position
    let end = Math.min(start + targetChars, text.length);

    // If not at the end, try to find a semantic boundary
    if (end < text.length && config.preserveSemanticBoundaries) {
      const boundaryEnd = findSemanticBoundary(text, start, end);
      if (boundaryEnd > start + config.minChunkChars) {
        end = boundaryEnd;
      }
    }

    // Extract the split text
    const splitText = text.slice(start, end).trim();

    if (splitText.length >= config.minChunkChars || splits.length === 0) {
      const splitChunk: SplitChunk = {
        text: splitText,
        index: chunk.index, // Will be re-indexed later
        metadata: {
          ...chunk.metadata,
          parent_chunk_id: parentId,
          split_index: splitIndex,
          total_splits: 0, // Will be updated after all splits are created
          is_split: true,
          original_chunk_id: parentId,
          // Update offsets for the split
          startOffset: (chunk.metadata.startOffset ?? 0) + start,
          endOffset: (chunk.metadata.startOffset ?? 0) + end,
        },
      };

      splits.push(splitChunk);
      splitIndex++;
    }

    // Move start position with overlap
    const nextStart = end - config.overlapChars;
    if (nextStart <= start) {
      // Prevent infinite loop
      start = end;
    } else {
      start = nextStart;
    }

    // Safety check: if we're not making progress, break
    if (start >= text.length) {
      break;
    }
  }

  // Update total_splits in all chunks
  for (const split of splits) {
    split.metadata.total_splits = splits.length;
  }

  return splits;
}

/**
 * Find a semantic boundary (sentence or paragraph end) near the target position.
 *
 * Looks backward from the target position to find the best split point.
 *
 * @param text - The full text
 * @param start - Start position of the current chunk
 * @param targetEnd - Target end position
 * @returns Best boundary position
 */
export function findSemanticBoundary(text: string, start: number, targetEnd: number): number {
  // Define search window (look back up to 20% of chunk size)
  const searchWindow = Math.floor((targetEnd - start) * 0.2);
  const searchStart = Math.max(start, targetEnd - searchWindow);
  const searchText = text.slice(searchStart, targetEnd);

  // Priority 1: Paragraph break (double newline)
  const lastParagraphBreak = searchText.lastIndexOf('\n\n');
  if (lastParagraphBreak !== -1 && searchStart + lastParagraphBreak > start) {
    return searchStart + lastParagraphBreak + 2; // After the double newline
  }

  // Priority 2: Sentence end (. ! ? followed by space or newline)
  const sentencePattern = /[.!?]["')\]]*[\s\n]+/g;
  let lastSentenceEnd = -1;
  let match: RegExpExecArray | null;

  while ((match = sentencePattern.exec(searchText)) !== null) {
    lastSentenceEnd = searchStart + match.index + match[0].length;
  }

  if (lastSentenceEnd > start) {
    return lastSentenceEnd;
  }

  // Priority 3: Line break
  const lastNewline = searchText.lastIndexOf('\n');
  if (lastNewline !== -1 && searchStart + lastNewline > start) {
    return searchStart + lastNewline + 1;
  }

  // Priority 4: Word boundary (space)
  const lastSpace = searchText.lastIndexOf(' ');
  if (lastSpace !== -1 && searchStart + lastSpace > start) {
    return searchStart + lastSpace + 1;
  }

  // No good boundary found, use target position
  return targetEnd;
}

/**
 * Validate and split chunks that exceed token limits.
 *
 * @param chunks - Array of chunks to validate
 * @param provider - Embedding provider
 * @param model - Embedding model
 * @param options - Split options
 * @returns Validation result with processed chunks
 */
export function validateAndSplitChunks(
  chunks: Chunk[],
  provider: string,
  model: string,
  options: SplitOptions = {}
): ChunkValidationResult {
  if (!isAutoSplitEnabled()) {
    // Return chunks as-is if auto-split is disabled
    return {
      chunks: chunks as SplitChunk[],
      splitCount: 0,
      newChunksCreated: 0,
      warnings: [],
    };
  }

  const tokenLimit = getTokenLimit(provider, model);
  const splitOptions: SplitOptions = {
    ...options,
    maxTokens: tokenLimit.effectiveLimit,
  };

  const result: ChunkValidationResult = {
    chunks: [],
    splitCount: 0,
    newChunksCreated: 0,
    warnings: [],
  };

  let newIndex = 0;

  for (const chunk of chunks) {
    const validation = validateChunkTokens(chunk.text, provider, model);

    if (validation.isValid) {
      // Chunk is within limits, keep as-is
      result.chunks.push({
        ...chunk,
        index: newIndex++,
      } as SplitChunk);
    } else {
      // Chunk exceeds limit, split it
      result.splitCount++;

      const splits = splitOversizedChunk(chunk, splitOptions);
      result.newChunksCreated += splits.length - 1; // -1 because original is replaced

      // Log warning about the split
      const warning = `Chunk ${chunk.index} (original index) exceeded token limit (${validation.tokenCount}/${validation.effectiveLimit}), split into ${splits.length} parts`;
      result.warnings.push(warning);
      console.info(`[ChunkSplitter] ${warning}`);

      // Re-index the splits
      for (const split of splits) {
        split.index = newIndex++;
        result.chunks.push(split);
      }
    }
  }

  if (result.splitCount > 0) {
    console.info(
      `[ChunkSplitter] Processed ${chunks.length} chunks: ${result.splitCount} split, ${result.newChunksCreated} new chunks created`
    );
  }

  return result;
}

/**
 * Estimate how many splits would be needed for a given text.
 *
 * @param text - The text to analyze
 * @param provider - Embedding provider
 * @param model - Embedding model
 * @returns Estimated number of splits (1 = no split needed)
 */
export function estimateSplitCount(text: string, provider: string, model: string): number {
  const tokenLimit = getTokenLimit(provider, model);
  const tokenCount = estimateTokens(text, model);

  if (tokenCount <= tokenLimit.effectiveLimit) {
    return 1;
  }

  // Account for overlap when estimating splits
  const overlapTokens = Math.ceil(getOverlapChars() / CHARS_PER_TOKEN);
  const rawEffectiveChunkSize = tokenLimit.effectiveLimit - overlapTokens;
  const effectiveChunkSize = Math.max(1, rawEffectiveChunkSize);

  return Math.ceil(tokenCount / effectiveChunkSize);
}

/**
 * Get statistics about chunk sizes in a collection.
 *
 * @param chunks - Array of chunks to analyze
 * @param provider - Embedding provider
 * @param model - Embedding model
 * @returns Statistics about chunk sizes
 */
export function getChunkStatistics(
  chunks: Chunk[],
  provider: string,
  model: string
): {
  total: number;
  oversized: number;
  avgTokens: number;
  maxTokens: number;
  minTokens: number;
  tokenLimit: TokenLimitConfig;
} {
  const tokenLimit = getTokenLimit(provider, model);
  const tokenCounts = chunks.map((c) => estimateTokens(c.text, model));

  const oversized = tokenCounts.filter((t) => t > tokenLimit.effectiveLimit).length;
  const total = tokenCounts.reduce((a, b) => a + b, 0);

  return {
    total: chunks.length,
    oversized,
    avgTokens: chunks.length > 0 ? Math.round(total / chunks.length) : 0,
    maxTokens: chunks.length > 0 ? Math.max(...tokenCounts) : 0,
    minTokens: chunks.length > 0 ? Math.min(...tokenCounts) : 0,
    tokenLimit,
  };
}
