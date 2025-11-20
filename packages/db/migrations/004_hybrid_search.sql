-- Phase 8: Hybrid search prerequisites
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Lexical search indexes
CREATE INDEX IF NOT EXISTS chunks_text_tsv_idx
  ON chunks
  USING gin (to_tsvector('english', text));

CREATE INDEX IF NOT EXISTS chunks_text_trgm_idx
  ON chunks
  USING gin (text gin_trgm_ops);

-- Generated columns for frequently queried metadata attributes
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS source_quality TEXT
    GENERATED ALWAYS AS ((metadata ->> 'source_quality')) STORED,
  ADD COLUMN IF NOT EXISTS framework TEXT
    GENERATED ALWAYS AS ((metadata ->> 'framework')) STORED,
  ADD COLUMN IF NOT EXISTS framework_version TEXT
    GENERATED ALWAYS AS ((metadata ->> 'framework_version')) STORED;

CREATE INDEX IF NOT EXISTS documents_source_quality_idx ON documents (source_quality);
CREATE INDEX IF NOT EXISTS documents_framework_idx ON documents (framework);
CREATE INDEX IF NOT EXISTS documents_framework_version_idx ON documents (framework_version);
