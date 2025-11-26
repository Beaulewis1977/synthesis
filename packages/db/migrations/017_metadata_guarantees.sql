-- Migration: 017_metadata_guarantees
-- Phase 3: Metadata Guarantees
-- 
-- This migration adds columns for queryable metadata fields and indexes
-- for efficient filtering. All new columns are nullable for backward
-- compatibility with existing documents.

-- ============================================
-- Documents table additions
-- ============================================

-- Add source_type column for classifying document sources
-- Values: 'url', 'repo', 'file'
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS source_type TEXT;

-- Add ingested_at timestamp for tracking when document was processed
-- Added as nullable for existing rows; default applied after backfill
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS ingested_at TIMESTAMPTZ;

-- Add languages array for storing detected programming languages
-- Stored as TEXT[] for efficient array operations
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS languages TEXT[];

-- ============================================
-- Chunks table additions
-- ============================================

-- Add chunk_type column for classifying chunk content
-- Values: 'text', 'code', 'sql', 'config', 'heading', 'list', 'analysis'
ALTER TABLE chunks 
ADD COLUMN IF NOT EXISTS chunk_type TEXT;

-- ============================================
-- Indexes for efficient querying
-- ============================================

-- Index on source_type for filtering by source classification
CREATE INDEX IF NOT EXISTS documents_source_type_idx 
ON documents (source_type) 
WHERE source_type IS NOT NULL;

-- Index on ingested_at for time-based queries
CREATE INDEX IF NOT EXISTS documents_ingested_at_idx 
ON documents (ingested_at DESC) 
WHERE ingested_at IS NOT NULL;

-- GIN index on languages array for efficient array containment queries
-- Enables queries like: WHERE languages @> ARRAY['dart']
CREATE INDEX IF NOT EXISTS documents_languages_gin_idx 
ON documents USING GIN (languages) 
WHERE languages IS NOT NULL;

-- Index on chunk_type for filtering chunks by type
CREATE INDEX IF NOT EXISTS chunks_chunk_type_idx 
ON chunks (chunk_type) 
WHERE chunk_type IS NOT NULL;

-- GIN index on metadata JSONB for flexible metadata queries
-- Enables queries on any metadata field
CREATE INDEX IF NOT EXISTS documents_metadata_gin_idx 
ON documents USING GIN (metadata);

CREATE INDEX IF NOT EXISTS chunks_metadata_gin_idx 
ON chunks USING GIN (metadata);

-- ============================================
-- Backfill existing data (optional)
-- ============================================

-- Set source_type based on existing source_url patterns
UPDATE documents 
SET source_type = CASE
  WHEN source_url LIKE '%github.com%' THEN 'repo'
  WHEN source_url LIKE '%gitlab.com%' THEN 'repo'
  WHEN source_url LIKE '%bitbucket.org%' THEN 'repo'
  WHEN source_url LIKE '%.git' THEN 'repo'
  WHEN source_url LIKE 'http%' THEN 'url'
  WHEN file_path IS NOT NULL THEN 'file'
  ELSE 'file'
END
WHERE source_type IS NULL
  AND (source_url IS NOT NULL OR file_path IS NOT NULL);

-- Set ingested_at from processed_at for existing documents
UPDATE documents 
SET ingested_at = COALESCE(processed_at, created_at)
WHERE ingested_at IS NULL;

-- Ensure new documents default ingested_at to NOW()
ALTER TABLE documents 
ALTER COLUMN ingested_at SET DEFAULT NOW();

-- Set default chunk_type for existing chunks based on metadata
UPDATE chunks 
SET chunk_type = COALESCE(
  metadata->>'chunk_type',
  CASE
    WHEN metadata->>'language' IN ('sql') THEN 'sql'
    WHEN metadata->>'language' IN ('yaml', 'json', 'toml') THEN 'config'
    WHEN metadata->>'language' IS NOT NULL THEN 'code'
    ELSE 'text'
  END
)
WHERE chunk_type IS NULL;

-- ============================================
-- Comments for documentation
-- ============================================

COMMENT ON COLUMN documents.source_type IS 'Classification of document source: url, repo, or file';
COMMENT ON COLUMN documents.ingested_at IS 'Timestamp when document was ingested into the system';
COMMENT ON COLUMN documents.languages IS 'Array of programming languages detected in the document';
COMMENT ON COLUMN chunks.chunk_type IS 'Classification of chunk content: text, code, sql, config, heading, list, analysis';
