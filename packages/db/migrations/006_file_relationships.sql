-- Phase 13 Day 3: File relationship tracking for code intelligence

CREATE TABLE file_relationships (
  id SERIAL PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  source_file TEXT NOT NULL,
  target_file TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  -- Types: 'import', 'usage', 'test', 'sibling', 'parent'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicates
  UNIQUE(collection_id, source_file, target_file, relationship_type)
);

-- Indexes for efficient queries
CREATE INDEX file_relationships_collection_idx 
  ON file_relationships(collection_id);

CREATE INDEX file_relationships_source_idx 
  ON file_relationships(source_file);

CREATE INDEX file_relationships_target_idx 
  ON file_relationships(target_file);

CREATE INDEX file_relationships_type_idx 
  ON file_relationships(relationship_type);

-- Composite index for common queries
CREATE INDEX file_relationships_source_type_idx 
  ON file_relationships(source_file, relationship_type);

COMMENT ON TABLE file_relationships IS 
  'Tracks relationships between code files (imports, usage, tests, etc.)';

COMMENT ON COLUMN file_relationships.relationship_type IS 
  'Type of relationship: import, usage, test, sibling, parent';

COMMENT ON COLUMN file_relationships.metadata IS 
  'Additional data: import alias, symbols used, etc.';
