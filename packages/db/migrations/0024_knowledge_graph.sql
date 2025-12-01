-- GPT Phase 2: Knowledge Graph Tables
-- Enables graph-style retrieval for end-to-end context expansion
-- Migration: 0024_knowledge_graph.sql

-- =============================================================================
-- NODES TABLE
-- Represents entities in the codebase: symbols, tables, endpoints, config sections
-- =============================================================================
CREATE TABLE IF NOT EXISTS knowledge_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  node_type VARCHAR(50) NOT NULL,
  name VARCHAR(500) NOT NULL,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  chunk_id INTEGER REFERENCES chunks(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- EDGES TABLE
-- Represents relationships between nodes: calls, defines, belongs_to, persists_to, etc.
-- =============================================================================
CREATE TABLE IF NOT EXISTS knowledge_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  edge_type VARCHAR(50) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- NODE INDEXES
-- Optimized for lookups by collection, type, name, and linked entities
-- =============================================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_collection
  ON knowledge_nodes(collection_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_type
  ON knowledge_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_name
  ON knowledge_nodes(name);

-- Entity linkage indexes (partial for efficiency)
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_document
  ON knowledge_nodes(document_id) WHERE document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_chunk
  ON knowledge_nodes(chunk_id) WHERE chunk_id IS NOT NULL;

-- Composite index for filtered lookups
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_collection_type
  ON knowledge_nodes(collection_id, node_type);

-- =============================================================================
-- EDGE INDEXES
-- Optimized for graph traversal (BFS) and reverse lookups
-- =============================================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_collection
  ON knowledge_edges(collection_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_source
  ON knowledge_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_target
  ON knowledge_edges(target_node_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_type
  ON knowledge_edges(edge_type);

-- Composite index for efficient BFS traversal from source nodes
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_traversal
  ON knowledge_edges(source_node_id, edge_type);

-- Composite index for reverse traversal (find what points to a node)
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_reverse_traversal
  ON knowledge_edges(target_node_id, edge_type);

-- Unique constraint to prevent duplicate edges
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_edges_unique
  ON knowledge_edges(collection_id, source_node_id, target_node_id, edge_type);

-- =============================================================================
-- DOCUMENTATION COMMENTS
-- =============================================================================
COMMENT ON TABLE knowledge_nodes IS 'GPT Phase 2: Graph nodes representing entities (symbols, tables, endpoints, configs)';
COMMENT ON TABLE knowledge_edges IS 'GPT Phase 2: Graph edges representing relationships between nodes';
COMMENT ON COLUMN knowledge_nodes.node_type IS 'Entity type: document, chunk, symbol, endpoint, table, column, config_section';
COMMENT ON COLUMN knowledge_nodes.document_id IS 'Link to source document (nullable for external references)';
COMMENT ON COLUMN knowledge_nodes.chunk_id IS 'Link to specific chunk containing the entity';
COMMENT ON COLUMN knowledge_edges.edge_type IS 'Relationship type: calls, defines, belongs_to, persists_to, configured_by, documents, imports, depends_on';
COMMENT ON INDEX idx_knowledge_edges_traversal IS 'Optimizes BFS traversal from source nodes';
COMMENT ON INDEX idx_knowledge_edges_reverse_traversal IS 'Optimizes finding incoming edges to a node';
COMMENT ON INDEX idx_knowledge_edges_unique IS 'Prevents duplicate edges between same nodes with same type';
