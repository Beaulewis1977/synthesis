-- Migration: 021_collection_versioning.sql
-- Description: Add document lifecycle management and versioning support
-- Phase 7: Collection Versioning

-- ============================================
-- Document Lifecycle Status
-- ============================================

-- Add lifecycle status for document archiving/superseding
-- Values: 'active' (default), 'archived', 'superseded'
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT DEFAULT 'active';

-- Add reference to the document that supersedes this one
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES documents(id) ON DELETE SET NULL;

-- Add semantic version for the document content
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS doc_version TEXT;

-- Add git branch for repository sources
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS branch TEXT;

-- Add archived timestamp
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- ============================================
-- Indexes for Efficient Queries
-- ============================================

-- Index for filtering by lifecycle status (most common query)
CREATE INDEX IF NOT EXISTS documents_lifecycle_status_idx 
  ON documents(lifecycle_status);

-- Partial index for superseded documents (sparse)
CREATE INDEX IF NOT EXISTS documents_superseded_by_idx 
  ON documents(superseded_by) 
  WHERE superseded_by IS NOT NULL;

-- Composite index for collection + status filtering
CREATE INDEX IF NOT EXISTS documents_collection_lifecycle_idx 
  ON documents(collection_id, lifecycle_status);

-- Index for version queries within a collection
CREATE INDEX IF NOT EXISTS documents_collection_version_idx 
  ON documents(collection_id, doc_version) 
  WHERE doc_version IS NOT NULL;

-- Index for framework version filtering
CREATE INDEX IF NOT EXISTS documents_framework_version_idx 
  ON documents((metadata->>'framework_version')) 
  WHERE metadata->>'framework_version' IS NOT NULL;

-- ============================================
-- Constraint for Valid Lifecycle Status
-- ============================================

-- Ensure lifecycle_status is one of the valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_lifecycle_status_check'
  ) THEN
    ALTER TABLE documents
      ADD CONSTRAINT documents_lifecycle_status_check
      CHECK (lifecycle_status IN ('active', 'archived', 'superseded'));
  END IF;
END $$;

-- ============================================
-- Helper Functions
-- ============================================

-- Function to archive a document
CREATE OR REPLACE FUNCTION archive_document(doc_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE documents
  SET 
    lifecycle_status = 'archived',
    archived_at = NOW(),
    updated_at = NOW()
  WHERE id = doc_id AND lifecycle_status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Function to supersede a document with a new one
CREATE OR REPLACE FUNCTION supersede_document(old_doc_id UUID, new_doc_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Mark old document as superseded
  UPDATE documents
  SET 
    lifecycle_status = 'superseded',
    superseded_by = new_doc_id,
    updated_at = NOW()
  WHERE id = old_doc_id AND lifecycle_status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Function to restore an archived document
CREATE OR REPLACE FUNCTION restore_document(doc_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE documents
  SET 
    lifecycle_status = 'active',
    archived_at = NULL,
    superseded_by = NULL,
    updated_at = NOW()
  WHERE id = doc_id AND lifecycle_status IN ('archived', 'superseded');
END;
$$ LANGUAGE plpgsql;

-- Function to get version history for a document (by source_url_hash)
CREATE OR REPLACE FUNCTION get_document_version_history(doc_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  doc_version TEXT,
  lifecycle_status TEXT,
  created_at TIMESTAMPTZ,
  superseded_by UUID
) AS $$
DECLARE
  source_hash TEXT;
BEGIN
  -- Get the source_url_hash for the document
  SELECT d.source_url_hash INTO source_hash
  FROM documents d
  WHERE d.id = doc_id;
  
  -- Return all documents with the same source_url_hash
  RETURN QUERY
  SELECT 
    d.id,
    d.title,
    d.doc_version,
    d.lifecycle_status,
    d.created_at,
    d.superseded_by
  FROM documents d
  WHERE d.source_url_hash = source_hash
    AND source_hash IS NOT NULL
  ORDER BY d.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Update existing documents to have 'active' status
-- ============================================

UPDATE documents 
SET lifecycle_status = 'active' 
WHERE lifecycle_status IS NULL;

