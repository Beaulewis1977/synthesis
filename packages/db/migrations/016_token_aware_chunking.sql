-- Migration: Token-Aware Chunking Support
-- Phase 1 of RAG & Model Selector Implementation Plan
--
-- Adds support for parent-child chunk relationships when chunks are split
-- due to exceeding embedding provider token limits.

-- Add parent-child relationship columns to chunks table
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS parent_chunk_id TEXT;
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS split_index INTEGER;
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS total_splits INTEGER;

-- Add index for efficient parent-child queries
CREATE INDEX IF NOT EXISTS idx_chunks_parent_chunk_id ON chunks(parent_chunk_id)
  WHERE parent_chunk_id IS NOT NULL;

-- Add comment explaining the columns
COMMENT ON COLUMN chunks.parent_chunk_id IS 'UUID of the parent chunk if this chunk was created by splitting an oversized chunk';
COMMENT ON COLUMN chunks.split_index IS 'Zero-based index of this split within the parent chunk (0 = first split)';
COMMENT ON COLUMN chunks.total_splits IS 'Total number of splits created from the parent chunk';

-- Update the token_count column comment to reflect improved estimation
COMMENT ON COLUMN chunks.token_count IS 'Estimated token count using improved estimation (chars/3.5 ratio with provider-specific limits)';
