-- Phase 15 Day 2: Performance instrumentation and indexes

-- Ensure pg_stat_statements is available for query profiling
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Accelerate tech_stack filtering on chunk metadata
CREATE INDEX IF NOT EXISTS chunks_metadata_tech_stack_idx
  ON chunks
  USING gin ((metadata -> 'tech_stack') jsonb_path_ops);

-- Improve collection level filtering on documents
CREATE INDEX IF NOT EXISTS documents_collection_processed_idx
  ON documents (collection_id, processed_at DESC NULLS LAST);

-- Speed up relationship lookups scoped to collection
CREATE INDEX IF NOT EXISTS file_relationships_collection_source_idx
  ON file_relationships (collection_id, source_file);

CREATE INDEX IF NOT EXISTS file_relationships_collection_target_idx
  ON file_relationships (collection_id, target_file);
