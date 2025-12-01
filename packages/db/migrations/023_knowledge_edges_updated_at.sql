-- =============================================================================
-- Add updated_at column to knowledge_edges
-- Tracks modification time separately from created_at
-- =============================================================================

ALTER TABLE knowledge_edges
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill any existing rows that may have NULL updated_at
UPDATE knowledge_edges
SET updated_at = NOW()
WHERE updated_at IS NULL;

