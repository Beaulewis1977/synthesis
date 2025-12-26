-- Migration 036: Reset Content + 1024-Dimensional Embeddings
--
-- This migration:
-- 1. Wipes all content data (preserving settings)
-- 2. Changes chunks.embedding from VECTOR(768) to VECTOR(1024)
-- 3. Rebuilds the HNSW index for 1024-dimensional vectors
--
-- Tables preserved:
--   - provider_api_keys
--   - provider_settings
--   - model_configs
--   - system_settings
--   - custom_providers
--   - mcp_server_configs
--   - embedding_profiles

BEGIN;

-- Step 1: Wipe content tables (CASCADE handles dependent tables like documents, chunks, etc.)
TRUNCATE TABLE collections RESTART IDENTITY CASCADE;

-- Step 2: Wipe standalone content tables not linked to collections
-- Note: Some tables may not exist in all deployments, so we use IF EXISTS pattern via DO block
DO $$
BEGIN
  -- Users and organizations
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    TRUNCATE TABLE users RESTART IDENTITY CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
    TRUNCATE TABLE organizations RESTART IDENTITY CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organization_members') THEN
    TRUNCATE TABLE organization_members RESTART IDENTITY CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'collection_permissions') THEN
    TRUNCATE TABLE collection_permissions RESTART IDENTITY CASCADE;
  END IF;

  -- Auth and sessions (NOT provider_api_keys - that's preserved)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_keys') THEN
    TRUNCATE TABLE api_keys RESTART IDENTITY CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sessions') THEN
    TRUNCATE TABLE sessions RESTART IDENTITY CASCADE;
  END IF;

  -- Audit and logging
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
    TRUNCATE TABLE audit_log RESTART IDENTITY CASCADE;
  END IF;

  -- Workflows
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_templates') THEN
    TRUNCATE TABLE workflow_templates RESTART IDENTITY CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_instances') THEN
    TRUNCATE TABLE workflow_instances RESTART IDENTITY CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_queries') THEN
    TRUNCATE TABLE task_queries RESTART IDENTITY CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'code_contexts') THEN
    TRUNCATE TABLE code_contexts RESTART IDENTITY CASCADE;
  END IF;

  -- Budget tracking
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'budget_alerts') THEN
    TRUNCATE TABLE budget_alerts RESTART IDENTITY CASCADE;
  END IF;

  -- Repository sources
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'repository_sources') THEN
    TRUNCATE TABLE repository_sources RESTART IDENTITY CASCADE;
  END IF;

  -- Chat (cascades from collections but may have orphans)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_sessions') THEN
    TRUNCATE TABLE chat_sessions RESTART IDENTITY CASCADE;
  END IF;

  -- Knowledge graph
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'knowledge_nodes') THEN
    TRUNCATE TABLE knowledge_nodes RESTART IDENTITY CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'knowledge_edges') THEN
    TRUNCATE TABLE knowledge_edges RESTART IDENTITY CASCADE;
  END IF;

  -- Feedback and quality (cascades from collections but may have orphans)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'search_feedback') THEN
    TRUNCATE TABLE search_feedback RESTART IDENTITY CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_feedback') THEN
    TRUNCATE TABLE chat_feedback RESTART IDENTITY CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_quality_scores') THEN
    TRUNCATE TABLE document_quality_scores RESTART IDENTITY CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chunk_quality_scores') THEN
    TRUNCATE TABLE chunk_quality_scores RESTART IDENTITY CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quality_metrics_daily') THEN
    TRUNCATE TABLE quality_metrics_daily RESTART IDENTITY CASCADE;
  END IF;

  -- Cost tracking
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cost_entries') THEN
    TRUNCATE TABLE cost_entries RESTART IDENTITY CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cost_entries_daily') THEN
    TRUNCATE TABLE cost_entries_daily RESTART IDENTITY CASCADE;
  END IF;
END $$;

-- Step 3: Drop HNSW index before altering vector dimension
DROP INDEX IF EXISTS chunks_embedding_hnsw;

-- Step 4: Change embedding column to 1024 dimensions
ALTER TABLE chunks ALTER COLUMN embedding TYPE VECTOR(1024);

-- Step 5: Update default embedding model reference
ALTER TABLE chunks ALTER COLUMN embedding_model SET DEFAULT 'mxbai-embed-large';

-- Step 6: Recreate HNSW index for 1024-dimensional vectors
CREATE INDEX chunks_embedding_hnsw ON chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Step 7: Add comment documenting the dimension change
COMMENT ON COLUMN chunks.embedding IS '1024-dimensional embedding vector (standardized dimension for all providers)';

COMMIT;
