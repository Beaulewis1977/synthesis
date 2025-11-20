-- Migration: 010_document_versioning.sql
-- Description: Add versioning and refresh tracking fields to documents table

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS version INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS source_url_hash TEXT,
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;

-- Index for source_url_hash lookups (partial index for docs with URLs)
CREATE INDEX IF NOT EXISTS documents_source_url_hash_idx 
  ON documents (source_url_hash) 
  WHERE source_url_hash IS NOT NULL;

-- Index for finding stale documents that need refresh
CREATE INDEX IF NOT EXISTS documents_last_checked_at_idx 
  ON documents (last_checked_at) 
  WHERE source_url IS NOT NULL;

