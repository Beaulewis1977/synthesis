-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Collections table: Isolate different projects/contexts
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX collections_created_at_idx ON collections (created_at DESC);

-- Documents table: Track uploaded/fetched documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  
  -- File info
  title TEXT NOT NULL,
  file_path TEXT,
  content_type TEXT,
  file_size BIGINT,
  source_url TEXT,
  
  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending',
  -- Values: pending | extracting | chunking | embedding | complete | error
  error_message TEXT,
  
  -- Metadata (extensible)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX documents_collection_id_idx ON documents (collection_id);
CREATE INDEX documents_status_idx ON documents (status);
CREATE INDEX documents_created_at_idx ON documents (created_at DESC);

-- Chunks table: Store document fragments with vector embeddings
CREATE TABLE chunks (
  id BIGSERIAL PRIMARY KEY,
  doc_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  
  -- Chunk info
  chunk_index INT NOT NULL,
  text TEXT NOT NULL,
  token_count INT,
  
  -- Vector embedding
  embedding VECTOR(768), -- nomic-embed-text dimensions
  embedding_model TEXT DEFAULT 'nomic-embed-text',
  
  -- Metadata (extensible)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure no duplicate chunks per document
  UNIQUE(doc_id, chunk_index)
);

-- HNSW index for fast vector search
CREATE INDEX chunks_embedding_hnsw ON chunks 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Foreign key index
CREATE INDEX chunks_doc_id_idx ON chunks (doc_id);
