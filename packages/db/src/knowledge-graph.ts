/**
 * GPT Phase 2: Knowledge Graph Query Helpers
 *
 * CRUD operations for knowledge_nodes and knowledge_edges tables.
 * Enables graph-style retrieval for end-to-end context expansion.
 */

import type { PoolClient } from 'pg';
import { query } from './client.js';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Knowledge node types representing entities in the codebase graph.
 * Matches KnowledgeNodeType from @synthesis/shared
 */
export type KnowledgeNodeType =
  | 'document'
  | 'chunk'
  | 'symbol'
  | 'endpoint'
  | 'table'
  | 'column'
  | 'config_section';

/**
 * Knowledge edge types representing relationships between nodes.
 * Matches KnowledgeEdgeType from @synthesis/shared
 */
export type KnowledgeEdgeType =
  | 'calls'
  | 'defines'
  | 'belongs_to'
  | 'persists_to'
  | 'configured_by'
  | 'documents'
  | 'imports'
  | 'depends_on';

/**
 * Database row type for knowledge_nodes table
 */
export interface KnowledgeNodeRow {
  id: string;
  collection_id: string;
  node_type: string;
  name: string;
  document_id: string | null;
  chunk_id: number | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

/**
 * Database row type for knowledge_edges table
 */
export interface KnowledgeEdgeRow {
  id: string;
  collection_id: string;
  source_node_id: string;
  target_node_id: string;
  edge_type: string;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

// =============================================================================
// NODE OPERATIONS
// =============================================================================

/**
 * Create a new knowledge node
 */
export async function createNode(
  node: {
    collection_id: string;
    node_type: KnowledgeNodeType;
    name: string;
    document_id?: string | null;
    chunk_id?: number | null;
    metadata?: Record<string, unknown>;
  },
  client?: PoolClient
): Promise<KnowledgeNodeRow> {
  const queryFn = client ? client.query.bind(client) : query;
  const result = await queryFn(
    `INSERT INTO knowledge_nodes (collection_id, node_type, name, document_id, chunk_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      node.collection_id,
      node.node_type,
      node.name,
      node.document_id ?? null,
      node.chunk_id ?? null,
      JSON.stringify(node.metadata || {}),
    ]
  );
  return result.rows[0] as KnowledgeNodeRow;
}

/**
 * Create multiple nodes in a single batch insert
 */
export async function createNodesBatch(
  nodes: Array<{
    collection_id: string;
    node_type: KnowledgeNodeType;
    name: string;
    document_id?: string | null;
    chunk_id?: number | null;
    metadata?: Record<string, unknown>;
  }>,
  client?: PoolClient
): Promise<KnowledgeNodeRow[]> {
  if (nodes.length === 0) return [];

  const queryFn = client ? client.query.bind(client) : query;
  const values: (string | number | boolean | null | Date | object)[] = [];
  const placeholders: string[] = [];

  nodes.forEach((node, i) => {
    const offset = i * 6;
    placeholders.push(
      `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`
    );
    values.push(
      node.collection_id,
      node.node_type,
      node.name,
      node.document_id ?? null,
      node.chunk_id ?? null,
      JSON.stringify(node.metadata || {})
    );
  });

  const result = await queryFn(
    `INSERT INTO knowledge_nodes (collection_id, node_type, name, document_id, chunk_id, metadata)
     VALUES ${placeholders.join(', ')}
     RETURNING *`,
    values
  );
  return result.rows as KnowledgeNodeRow[];
}

/**
 * Get a node by ID
 */
export async function getNodeById(id: string): Promise<KnowledgeNodeRow | null> {
  const result = await query('SELECT * FROM knowledge_nodes WHERE id = $1', [id]);
  return (result.rows[0] as KnowledgeNodeRow) || null;
}

/**
 * Get all nodes in a collection, optionally filtered by type
 */
export async function getNodesByCollection(
  collectionId: string,
  nodeType?: KnowledgeNodeType
): Promise<KnowledgeNodeRow[]> {
  if (nodeType) {
    const result = await query(
      'SELECT * FROM knowledge_nodes WHERE collection_id = $1 AND node_type = $2 ORDER BY name',
      [collectionId, nodeType]
    );
    return result.rows as KnowledgeNodeRow[];
  }
  const result = await query(
    'SELECT * FROM knowledge_nodes WHERE collection_id = $1 ORDER BY node_type, name',
    [collectionId]
  );
  return result.rows as KnowledgeNodeRow[];
}

/**
 * Get a node by name within a collection, optionally filtered by type.
 * Accepts an optional transaction client for consistency within a transaction.
 */
export async function getNodeByName(
  collectionId: string,
  name: string,
  nodeType?: KnowledgeNodeType,
  client?: PoolClient
): Promise<KnowledgeNodeRow | null> {
  const queryFn = client ? client.query.bind(client) : query;

  if (nodeType) {
    const result = await queryFn(
      'SELECT * FROM knowledge_nodes WHERE collection_id = $1 AND name = $2 AND node_type = $3',
      [collectionId, name, nodeType]
    );
    return (result.rows[0] as KnowledgeNodeRow) || null;
  }
  const result = await queryFn(
    'SELECT * FROM knowledge_nodes WHERE collection_id = $1 AND name = $2',
    [collectionId, name]
  );
  return (result.rows[0] as KnowledgeNodeRow) || null;
}

/**
 * Get all nodes linked to a document
 */
export async function getNodesByDocument(documentId: string): Promise<KnowledgeNodeRow[]> {
  const result = await query(
    'SELECT * FROM knowledge_nodes WHERE document_id = $1 ORDER BY node_type, name',
    [documentId]
  );
  return result.rows as KnowledgeNodeRow[];
}

/**
 * Get all nodes linked to a chunk
 */
export async function getNodesByChunk(chunkId: number): Promise<KnowledgeNodeRow[]> {
  const result = await query(
    'SELECT * FROM knowledge_nodes WHERE chunk_id = $1 ORDER BY node_type, name',
    [chunkId]
  );
  return result.rows as KnowledgeNodeRow[];
}

/**
 * Delete a node by ID (edges are cascade deleted)
 */
export async function deleteNode(id: string, client?: PoolClient): Promise<void> {
  const queryFn = client ? client.query.bind(client) : query;
  await queryFn('DELETE FROM knowledge_nodes WHERE id = $1', [id]);
}

/**
 * Delete all nodes linked to a document
 */
export async function deleteNodesByDocument(
  documentId: string,
  client?: PoolClient
): Promise<number> {
  const queryFn = client ? client.query.bind(client) : query;
  const result = await queryFn('DELETE FROM knowledge_nodes WHERE document_id = $1', [documentId]);
  return result.rowCount ?? 0;
}

/**
 * Delete all nodes in a collection
 */
export async function deleteNodesByCollection(
  collectionId: string,
  client?: PoolClient
): Promise<number> {
  const queryFn = client ? client.query.bind(client) : query;
  const result = await queryFn('DELETE FROM knowledge_nodes WHERE collection_id = $1', [
    collectionId,
  ]);
  return result.rowCount ?? 0;
}

// =============================================================================
// EDGE OPERATIONS
// =============================================================================

/**
 * Create a new edge (upserts on conflict)
 */
export async function createEdge(
  edge: {
    collection_id: string;
    source_node_id: string;
    target_node_id: string;
    edge_type: KnowledgeEdgeType;
    metadata?: Record<string, unknown>;
  },
  client?: PoolClient
): Promise<KnowledgeEdgeRow> {
  const queryFn = client ? client.query.bind(client) : query;
  const result = await queryFn(
    `INSERT INTO knowledge_edges (collection_id, source_node_id, target_node_id, edge_type, metadata)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (collection_id, source_node_id, target_node_id, edge_type)
     DO UPDATE SET metadata = EXCLUDED.metadata, updated_at = NOW()
     RETURNING *`,
    [
      edge.collection_id,
      edge.source_node_id,
      edge.target_node_id,
      edge.edge_type,
      JSON.stringify(edge.metadata || {}),
    ]
  );
  return result.rows[0] as KnowledgeEdgeRow;
}

/**
 * Create multiple edges in a single batch insert (ignores conflicts)
 */
export async function createEdgesBatch(
  edges: Array<{
    collection_id: string;
    source_node_id: string;
    target_node_id: string;
    edge_type: KnowledgeEdgeType;
    metadata?: Record<string, unknown>;
  }>,
  client?: PoolClient
): Promise<KnowledgeEdgeRow[]> {
  if (edges.length === 0) return [];

  const queryFn = client ? client.query.bind(client) : query;
  const values: (string | number | boolean | null | Date | object)[] = [];
  const placeholders: string[] = [];

  edges.forEach((edge, i) => {
    const offset = i * 5;
    placeholders.push(
      `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`
    );
    values.push(
      edge.collection_id,
      edge.source_node_id,
      edge.target_node_id,
      edge.edge_type,
      JSON.stringify(edge.metadata || {})
    );
  });

  const result = await queryFn(
    `INSERT INTO knowledge_edges (collection_id, source_node_id, target_node_id, edge_type, metadata)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (collection_id, source_node_id, target_node_id, edge_type) DO NOTHING
     RETURNING *`,
    values
  );
  return result.rows as KnowledgeEdgeRow[];
}

/**
 * Get an edge by ID
 */
export async function getEdgeById(id: string): Promise<KnowledgeEdgeRow | null> {
  const result = await query('SELECT * FROM knowledge_edges WHERE id = $1', [id]);
  return (result.rows[0] as KnowledgeEdgeRow) || null;
}

/**
 * Get all outgoing edges from a node, optionally filtered by type
 */
export async function getOutgoingEdges(
  nodeId: string,
  edgeType?: KnowledgeEdgeType
): Promise<KnowledgeEdgeRow[]> {
  if (edgeType) {
    const result = await query(
      'SELECT * FROM knowledge_edges WHERE source_node_id = $1 AND edge_type = $2',
      [nodeId, edgeType]
    );
    return result.rows as KnowledgeEdgeRow[];
  }
  const result = await query('SELECT * FROM knowledge_edges WHERE source_node_id = $1', [nodeId]);
  return result.rows as KnowledgeEdgeRow[];
}

/**
 * Get all incoming edges to a node, optionally filtered by type
 */
export async function getIncomingEdges(
  nodeId: string,
  edgeType?: KnowledgeEdgeType
): Promise<KnowledgeEdgeRow[]> {
  if (edgeType) {
    const result = await query(
      'SELECT * FROM knowledge_edges WHERE target_node_id = $1 AND edge_type = $2',
      [nodeId, edgeType]
    );
    return result.rows as KnowledgeEdgeRow[];
  }
  const result = await query('SELECT * FROM knowledge_edges WHERE target_node_id = $1', [nodeId]);
  return result.rows as KnowledgeEdgeRow[];
}

/**
 * Get all edges in a collection, optionally filtered by type
 */
export async function getEdgesByCollection(
  collectionId: string,
  edgeType?: KnowledgeEdgeType
): Promise<KnowledgeEdgeRow[]> {
  if (edgeType) {
    const result = await query(
      'SELECT * FROM knowledge_edges WHERE collection_id = $1 AND edge_type = $2',
      [collectionId, edgeType]
    );
    return result.rows as KnowledgeEdgeRow[];
  }
  const result = await query('SELECT * FROM knowledge_edges WHERE collection_id = $1', [
    collectionId,
  ]);
  return result.rows as KnowledgeEdgeRow[];
}

/**
 * Delete an edge by ID
 */
export async function deleteEdge(id: string, client?: PoolClient): Promise<void> {
  const queryFn = client ? client.query.bind(client) : query;
  await queryFn('DELETE FROM knowledge_edges WHERE id = $1', [id]);
}

/**
 * Delete all edges connected to a node (both incoming and outgoing)
 */
export async function deleteEdgesByNode(nodeId: string, client?: PoolClient): Promise<number> {
  const queryFn = client ? client.query.bind(client) : query;
  const result = await queryFn(
    'DELETE FROM knowledge_edges WHERE source_node_id = $1 OR target_node_id = $1',
    [nodeId]
  );
  return result.rowCount ?? 0;
}

/**
 * Delete all edges in a collection
 */
export async function deleteEdgesByCollection(
  collectionId: string,
  client?: PoolClient
): Promise<number> {
  const queryFn = client ? client.query.bind(client) : query;
  const result = await queryFn('DELETE FROM knowledge_edges WHERE collection_id = $1', [
    collectionId,
  ]);
  return result.rowCount ?? 0;
}

// =============================================================================
// GRAPH STATISTICS
// =============================================================================

export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
}

/**
 * Get statistics about a collection's knowledge graph
 */
export async function getGraphStats(collectionId: string): Promise<GraphStats> {
  const [nodeCountResult, edgeCountResult, nodesByTypeResult, edgesByTypeResult] =
    await Promise.all([
      query('SELECT COUNT(*) as count FROM knowledge_nodes WHERE collection_id = $1', [
        collectionId,
      ]),
      query('SELECT COUNT(*) as count FROM knowledge_edges WHERE collection_id = $1', [
        collectionId,
      ]),
      query(
        'SELECT node_type, COUNT(*) as count FROM knowledge_nodes WHERE collection_id = $1 GROUP BY node_type',
        [collectionId]
      ),
      query(
        'SELECT edge_type, COUNT(*) as count FROM knowledge_edges WHERE collection_id = $1 GROUP BY edge_type',
        [collectionId]
      ),
    ]);

  const nodesByType: Record<string, number> = {};
  for (const row of nodesByTypeResult.rows) {
    nodesByType[row.node_type as string] = Number.parseInt(row.count as string, 10);
  }

  const edgesByType: Record<string, number> = {};
  for (const row of edgesByTypeResult.rows) {
    edgesByType[row.edge_type as string] = Number.parseInt(row.count as string, 10);
  }

  return {
    totalNodes: Number.parseInt(nodeCountResult.rows[0]?.count ?? '0', 10),
    totalEdges: Number.parseInt(edgeCountResult.rows[0]?.count ?? '0', 10),
    nodesByType,
    edgesByType,
  };
}

// =============================================================================
// GRAPH TRAVERSAL HELPERS (for future sub-phases)
// =============================================================================

/**
 * Get neighbors of a node (both outgoing and incoming connections)
 */
export async function getNodeNeighbors(
  nodeId: string,
  edgeTypes?: KnowledgeEdgeType[]
): Promise<{ outgoing: KnowledgeNodeRow[]; incoming: KnowledgeNodeRow[] }> {
  let outgoingQuery = `
    SELECT kn.* FROM knowledge_nodes kn
    INNER JOIN knowledge_edges ke ON ke.target_node_id = kn.id
    WHERE ke.source_node_id = $1
  `;
  let incomingQuery = `
    SELECT kn.* FROM knowledge_nodes kn
    INNER JOIN knowledge_edges ke ON ke.source_node_id = kn.id
    WHERE ke.target_node_id = $1
  `;

  const params: (string | number | boolean | null | Date | object)[] = [nodeId];

  if (edgeTypes && edgeTypes.length > 0) {
    outgoingQuery += ' AND ke.edge_type = ANY($2)';
    incomingQuery += ' AND ke.edge_type = ANY($2)';
    params.push(edgeTypes);
  }

  const [outgoingResult, incomingResult] = await Promise.all([
    query(outgoingQuery, params),
    query(incomingQuery, params),
  ]);

  return {
    outgoing: outgoingResult.rows as KnowledgeNodeRow[],
    incoming: incomingResult.rows as KnowledgeNodeRow[],
  };
}

/**
 * Find a node by collection and name, or create it if it doesn't exist
 */
export async function findOrCreateNode(
  node: {
    collection_id: string;
    node_type: KnowledgeNodeType;
    name: string;
    document_id?: string | null;
    chunk_id?: number | null;
    metadata?: Record<string, unknown>;
  },
  client?: PoolClient
): Promise<KnowledgeNodeRow> {
  const queryFn = client ? client.query.bind(client) : query;

  // Try to find existing node
  const existingResult = await queryFn(
    'SELECT * FROM knowledge_nodes WHERE collection_id = $1 AND name = $2 AND node_type = $3',
    [node.collection_id, node.name, node.node_type]
  );

  if (existingResult.rows.length > 0) {
    return existingResult.rows[0] as KnowledgeNodeRow;
  }

  // Create new node
  return createNode(node, client);
}
