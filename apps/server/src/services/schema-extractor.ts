/**
 * GPT Phase 3 Sub-Phase 5.2: Schema Extractor Service
 *
 * Extracts database schema information from knowledge graph nodes.
 * Tables and columns are stored as 'table' and 'column' node types,
 * with relationships via 'belongs_to' and 'persists_to' edges.
 */

import { performance } from 'node:perf_hooks';
import type { Pool } from 'pg';

// =============================================================================
// INTERFACES
// =============================================================================

export interface ExtractSchemaParams {
  collectionId: string;
  tables?: string[]; // filter to specific tables
  includeRelationships?: boolean; // default: true
}

export interface ColumnSchema {
  name: string;
  nodeId: string;
  dataType: string | null;
  constraints: string[];
  metadata: Record<string, unknown>;
}

export interface TableSchema {
  name: string;
  nodeId: string;
  documentId: string | null;
  columns: ColumnSchema[];
  metadata: Record<string, unknown>;
}

export interface SchemaRelationship {
  sourceTable: string;
  targetTable: string;
  edgeType: string;
  sourceNodeId: string;
  targetNodeId: string;
  metadata: Record<string, unknown>;
}

export interface SchemaExtractionResult {
  tables: TableSchema[];
  relationships: SchemaRelationship[];
  stats: {
    totalTables: number;
    totalColumns: number;
    totalRelationships: number;
    extractionDurationMs: number;
  };
}

// =============================================================================
// CONFIG HELPERS
// =============================================================================

/**
 * Check if schema extraction is enabled via environment variable
 */
export function isSchemaExtractionEnabled(): boolean {
  return process.env.ENABLE_SCHEMA_EXTRACTION === 'true';
}

// =============================================================================
// MAIN EXTRACTION FUNCTION
// =============================================================================

/**
 * Extract database schema from knowledge graph nodes.
 *
 * This function:
 * 1. Queries knowledge_nodes where node_type = 'table' for the collection
 * 2. Optionally filters by specific table names
 * 3. For each table, finds columns via 'belongs_to' edges (column -> table)
 * 4. Finds relationships between tables via 'persists_to' edges
 * 5. Extracts metadata for types/constraints from node metadata JSONB
 *
 * @param db - PostgreSQL connection pool
 * @param params - Schema extraction parameters
 * @returns Schema extraction result including tables, columns, relationships, and stats
 */
export async function extractSchema(
  db: Pool,
  params: ExtractSchemaParams
): Promise<SchemaExtractionResult> {
  const startTime = performance.now();
  const includeRelationships = params.includeRelationships ?? true;

  try {
    // 1. Query table nodes
    const tableNodes = await queryTableNodes(db, params.collectionId, params.tables);

    if (tableNodes.length === 0) {
      return {
        tables: [],
        relationships: [],
        stats: {
          totalTables: 0,
          totalColumns: 0,
          totalRelationships: 0,
          extractionDurationMs: performance.now() - startTime,
        },
      };
    }

    // Build lookup map for table nodes by ID
    const tableNodeMap = new Map<string, TableNodeRow>();
    for (const node of tableNodes) {
      tableNodeMap.set(node.id, node);
    }

    // 2. Query columns and relationships in parallel (if enabled)
    const [columnsByTable, relationships] = await Promise.all([
      queryColumnsForTables(db, params.collectionId, tableNodes),
      includeRelationships
        ? queryTableRelationships(db, params.collectionId, tableNodeMap)
        : Promise.resolve([]),
    ]);

    // 3. Build table schemas with their columns
    const tables: TableSchema[] = tableNodes.map((tableNode) => ({
      name: tableNode.name,
      nodeId: tableNode.id,
      documentId: tableNode.document_id,
      columns: columnsByTable.get(tableNode.id) ?? [],
      metadata: tableNode.metadata ?? {},
    }));

    // Calculate total columns
    let totalColumns = 0;
    for (const table of tables) {
      totalColumns += table.columns.length;
    }

    const durationMs = performance.now() - startTime;

    return {
      tables,
      relationships,
      stats: {
        totalTables: tables.length,
        totalColumns,
        totalRelationships: relationships.length,
        extractionDurationMs: durationMs,
      },
    };
  } catch (error) {
    throw new Error(
      `Schema extraction failed for collection ${params.collectionId}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// =============================================================================
// INTERNAL TYPES
// =============================================================================

interface TableNodeRow {
  id: string;
  name: string;
  document_id: string | null;
  metadata: Record<string, unknown>;
}

interface ColumnNodeRow {
  id: string;
  name: string;
  metadata: Record<string, unknown>;
  target_node_id: string; // table node ID via belongs_to edge
}

interface RelationshipRow {
  source_node_id: string;
  target_node_id: string;
  edge_type: string;
  metadata: Record<string, unknown>;
}

// =============================================================================
// QUERY HELPERS
// =============================================================================

/**
 * Query table nodes from knowledge_nodes.
 * Optionally filters by specific table names.
 */
async function queryTableNodes(
  db: Pool,
  collectionId: string,
  tableNames?: string[]
): Promise<TableNodeRow[]> {
  let query: string;
  let queryParams: unknown[];

  if (tableNames && tableNames.length > 0) {
    // Filter by specific table names
    query = `
      SELECT id, name, document_id, metadata
      FROM knowledge_nodes
      WHERE collection_id = $1
        AND node_type = 'table'
        AND name = ANY($2)
      ORDER BY name
    `;
    queryParams = [collectionId, tableNames];
  } else {
    // Get all tables in collection
    query = `
      SELECT id, name, document_id, metadata
      FROM knowledge_nodes
      WHERE collection_id = $1
        AND node_type = 'table'
      ORDER BY name
    `;
    queryParams = [collectionId];
  }

  const result = await db.query(query, queryParams);
  return result.rows as TableNodeRow[];
}

/**
 * Query columns for multiple tables in a single batch.
 * Columns are linked to tables via 'belongs_to' edges (column belongs_to table).
 *
 * Returns a map of table node ID -> array of column schemas.
 */
async function queryColumnsForTables(
  db: Pool,
  collectionId: string,
  tableNodes: TableNodeRow[]
): Promise<Map<string, ColumnSchema[]>> {
  if (tableNodes.length === 0) {
    return new Map();
  }

  const tableIds = tableNodes.map((t) => t.id);

  // Query columns linked to tables via 'belongs_to' edges
  // Edge direction: column (source) --belongs_to--> table (target)
  const query = `
    SELECT
      kn.id,
      kn.name,
      kn.metadata,
      ke.target_node_id
    FROM knowledge_nodes kn
    INNER JOIN knowledge_edges ke ON ke.source_node_id = kn.id
    WHERE kn.collection_id = $1
      AND kn.node_type = 'column'
      AND ke.edge_type = 'belongs_to'
      AND ke.target_node_id = ANY($2)
    ORDER BY kn.name
  `;

  const result = await db.query(query, [collectionId, tableIds]);
  const columnRows = result.rows as ColumnNodeRow[];

  // Group columns by their parent table
  const columnsByTable = new Map<string, ColumnSchema[]>();

  for (const row of columnRows) {
    const tableId = row.target_node_id;
    const columnSchema = parseColumnNode(row);

    const existing = columnsByTable.get(tableId);
    if (existing) {
      existing.push(columnSchema);
    } else {
      columnsByTable.set(tableId, [columnSchema]);
    }
  }

  return columnsByTable;
}

/**
 * Parse column node row into ColumnSchema.
 * Extracts dataType and constraints from metadata JSONB.
 */
function parseColumnNode(row: ColumnNodeRow): ColumnSchema {
  const metadata = row.metadata ?? {};

  // Extract data type from metadata (common field names)
  const dataType =
    extractString(metadata, 'data_type') ??
    extractString(metadata, 'dataType') ??
    extractString(metadata, 'type') ??
    null;

  // Extract constraints from metadata (can be array or comma-separated string)
  const constraints = extractConstraints(metadata);

  return {
    name: row.name,
    nodeId: row.id,
    dataType,
    constraints,
    metadata,
  };
}

/**
 * Extract a string value from metadata by key.
 */
function extractString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return null;
}

/**
 * Extract constraints from metadata.
 * Handles array or comma-separated string formats.
 */
function extractConstraints(metadata: Record<string, unknown>): string[] {
  // Try 'constraints' field
  const constraints = metadata.constraints;
  if (Array.isArray(constraints)) {
    return constraints.filter((c): c is string => typeof c === 'string');
  }
  if (typeof constraints === 'string' && constraints.length > 0) {
    return constraints.split(',').map((c) => c.trim());
  }

  // Try 'constraint' field (singular)
  const constraint = metadata.constraint;
  if (typeof constraint === 'string' && constraint.length > 0) {
    return [constraint];
  }

  // Build constraints from individual boolean flags
  const result: string[] = [];
  if (metadata.is_primary_key === true || metadata.isPrimaryKey === true) {
    result.push('PRIMARY KEY');
  }
  if (metadata.is_not_null === true || metadata.isNotNull === true || metadata.required === true) {
    result.push('NOT NULL');
  }
  if (metadata.is_unique === true || metadata.isUnique === true) {
    result.push('UNIQUE');
  }
  if (metadata.is_foreign_key === true || metadata.isForeignKey === true) {
    result.push('FOREIGN KEY');
  }
  if (metadata.has_default === true || metadata.hasDefault === true) {
    result.push('DEFAULT');
  }

  return result;
}

/**
 * Query relationships between tables.
 * Finds edges where both endpoints are table nodes.
 * Primary edge types: 'persists_to' (function persists to table),
 * but also captures any table-to-table relationships.
 */
async function queryTableRelationships(
  db: Pool,
  collectionId: string,
  tableNodeMap: Map<string, TableNodeRow>
): Promise<SchemaRelationship[]> {
  if (tableNodeMap.size === 0) {
    return [];
  }

  const tableIds = Array.from(tableNodeMap.keys());

  // Query edges between tables
  // This captures:
  // - Direct table-to-table relationships
  // - Any edges where both source and target are tables
  const query = `
    SELECT
      source_node_id,
      target_node_id,
      edge_type,
      metadata
    FROM knowledge_edges
    WHERE collection_id = $1
      AND source_node_id = ANY($2)
      AND target_node_id = ANY($2)
    ORDER BY edge_type, source_node_id
  `;

  const result = await db.query(query, [collectionId, tableIds]);
  const rows = result.rows as RelationshipRow[];

  const relationships: SchemaRelationship[] = [];

  for (const row of rows) {
    const sourceTable = tableNodeMap.get(row.source_node_id);
    const targetTable = tableNodeMap.get(row.target_node_id);

    // Both nodes must be tables (should always be true given our query, but verify)
    if (sourceTable && targetTable) {
      relationships.push({
        sourceTable: sourceTable.name,
        targetTable: targetTable.name,
        edgeType: row.edge_type,
        sourceNodeId: row.source_node_id,
        targetNodeId: row.target_node_id,
        metadata: row.metadata ?? {},
      });
    }
  }

  return relationships;
}

// =============================================================================
// ADDITIONAL UTILITIES
// =============================================================================

/**
 * Check if a collection has any schema nodes (tables/columns).
 * Useful for determining if schema extraction is worthwhile.
 */
export async function hasSchemaNodes(db: Pool, collectionId: string): Promise<boolean> {
  const result = await db.query(
    `
    SELECT EXISTS (
      SELECT 1 FROM knowledge_nodes
      WHERE collection_id = $1
        AND node_type IN ('table', 'column')
      LIMIT 1
    ) as has_schema
  `,
    [collectionId]
  );

  return result.rows[0]?.has_schema === true;
}

/**
 * Get a summary count of schema nodes in a collection.
 */
export async function getSchemaNodeCounts(
  db: Pool,
  collectionId: string
): Promise<{ tables: number; columns: number }> {
  try {
    const result = await db.query(
      `
      SELECT
        node_type,
        COUNT(*) as count
      FROM knowledge_nodes
      WHERE collection_id = $1
        AND node_type IN ('table', 'column')
      GROUP BY node_type
    `,
      [collectionId]
    );

    const counts = { tables: 0, columns: 0 };
    for (const row of result.rows) {
      if (row.node_type === 'table') {
        counts.tables = Number.parseInt(row.count as string, 10);
      } else if (row.node_type === 'column') {
        counts.columns = Number.parseInt(row.count as string, 10);
      }
    }

    return counts;
  } catch (error) {
    throw new Error(
      `Failed to get schema node counts for collection ${collectionId}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
