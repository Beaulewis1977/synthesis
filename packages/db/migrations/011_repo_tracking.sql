-- Migration: 011_repo_tracking.sql
-- Description: Add repository source tracking for GitHub repo ingestion

CREATE TABLE IF NOT EXISTS repository_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  repo_url TEXT NOT NULL,
  default_branch TEXT DEFAULT 'main',
  last_synced_commit TEXT,
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'idle', -- idle | syncing | error
  sync_error TEXT,
  ignored_paths TEXT[] DEFAULT ARRAY['node_modules/', '.git/', 'dist/', 'build/', '*.log'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(collection_id, repo_url)
);

-- Add repository source reference to documents
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS repo_source_id UUID REFERENCES repository_sources(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS repo_sources_collection_id_idx ON repository_sources(collection_id);
CREATE INDEX IF NOT EXISTS repo_sources_sync_status_idx ON repository_sources(sync_status);
CREATE INDEX IF NOT EXISTS documents_repo_source_id_idx ON documents(repo_source_id);

