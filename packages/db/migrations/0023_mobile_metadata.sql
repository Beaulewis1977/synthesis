-- GPT Phase 1: Mobile Feature Metadata Indexes
-- Enables efficient filtering by feature tags, platform, and usage tier
-- Migration: 0023_mobile_metadata.sql

-- GIN index for feature_tags array queries on documents
-- Supports queries like: WHERE metadata->'feature_tags' @> '["auth"]'
CREATE INDEX IF NOT EXISTS idx_documents_feature_tags
  ON documents USING GIN ((metadata->'feature_tags') jsonb_path_ops);

-- GIN index for feature_tags array queries on chunks
-- Supports queries like: WHERE metadata->'feature_tags' @> '["auth", "billing"]'
CREATE INDEX IF NOT EXISTS idx_chunks_feature_tags
  ON chunks USING GIN ((metadata->'feature_tags') jsonb_path_ops);

-- Expression index for platform filtering on documents
-- Supports queries like: WHERE metadata->>'platform' = 'mobile'
CREATE INDEX IF NOT EXISTS idx_documents_platform
  ON documents ((metadata->>'platform'))
  WHERE metadata->>'platform' IS NOT NULL;

-- Expression index for usage_tier filtering on documents
-- Supports queries like: WHERE metadata->>'usage_tier' = 'official'
CREATE INDEX IF NOT EXISTS idx_documents_usage_tier
  ON documents ((metadata->>'usage_tier'))
  WHERE metadata->>'usage_tier' IS NOT NULL;

-- Expression index for platform filtering on chunks
CREATE INDEX IF NOT EXISTS idx_chunks_platform
  ON chunks ((metadata->>'platform'))
  WHERE metadata->>'platform' IS NOT NULL;

-- Documentation comments
COMMENT ON INDEX idx_documents_feature_tags IS 'GPT Phase 1: GIN index for mobile feature tag queries on documents';
COMMENT ON INDEX idx_chunks_feature_tags IS 'GPT Phase 1: GIN index for mobile feature tag queries on chunks';
COMMENT ON INDEX idx_documents_platform IS 'GPT Phase 1: Index for platform filtering on documents';
COMMENT ON INDEX idx_documents_usage_tier IS 'GPT Phase 1: Index for usage tier filtering on documents';
COMMENT ON INDEX idx_chunks_platform IS 'GPT Phase 1: Index for platform filtering on chunks';
