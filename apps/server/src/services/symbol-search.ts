/**
 * GPT Phase 3 Sub-Phase 5.2: Symbol Search Service
 *
 * Finds symbol definitions and usages across the knowledge graph.
 * Enables code navigation features like "Find References" and "Go to Definition".
 */

import { performance } from 'node:perf_hooks';
import type { Pool } from 'pg';

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * Symbol kinds supported for filtering
 */
export type SymbolKind =
  | 'function'
  | 'class'
  | 'widget'
  | 'method'
  | 'constant'
  | 'interface'
  | 'type'
  | 'enum';

/**
 * Parameters for finding symbol usages
 */
export interface FindSymbolUsagesParams {
  /** Collection ID to search within */
  collectionId: string;
  /** Symbol name to search for (case-insensitive) */
  symbolName: string;
  /** Filter by symbol kind (optional) */
  symbolKind?: SymbolKind;
  /** Include definition locations (default: true) */
  includeDefinitions?: boolean;
  /** Include usage locations (default: true) */
  includeUsages?: boolean;
  /** Maximum number of results to return (default: 20) */
  maxResults?: number;
}

/**
 * Represents a location where a symbol is found (definition or usage)
 */
export interface SymbolLocation {
  /** Knowledge graph node ID */
  nodeId: string;
  /** Associated document ID (if linked) */
  documentId: string | null;
  /** Document title (if available) */
  documentTitle: string | null;
  /** Associated chunk ID (if linked) */
  chunkId: number | null;
  /** Chunk text content (if available) */
  chunkText: string | null;
  /** File path from metadata */
  filePath: string | null;
  /** Line number from metadata */
  lineNumber: number | null;
  /** Full node metadata */
  metadata: Record<string, unknown>;
}

/**
 * Symbol usage with additional edge context
 */
export interface SymbolUsage extends SymbolLocation {
  /** Type of relationship (calls, imports, depends_on) */
  edgeType: string;
}

/**
 * Result of symbol usages search
 */
export interface SymbolUsagesResult {
  /** Information about the symbol itself (null if not found) */
  symbol: { name: string; kind: string; nodeId: string } | null;
  /** Locations where the symbol is defined */
  definitions: SymbolLocation[];
  /** Locations where the symbol is used */
  usages: SymbolUsage[];
  /** Search statistics */
  stats: {
    /** Number of definition locations found */
    totalDefinitions: number;
    /** Number of usage locations found */
    totalUsages: number;
    /** Number of unique documents containing usages */
    documentsWithUsages: number;
    /** Search duration in milliseconds */
    searchDurationMs: number;
  };
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Check if symbol search is enabled via environment variable
 */
export function isSymbolSearchEnabled(): boolean {
  return process.env.ENABLE_SYMBOL_SEARCH === 'true';
}

/**
 * Edge types that indicate symbol usage (consumption)
 */
const USAGE_EDGE_TYPES = ['calls', 'imports', 'depends_on'] as const;

/**
 * Edge type that indicates symbol definition
 */
const DEFINITION_EDGE_TYPE = 'defines';

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Find symbol definitions and usages across the knowledge graph.
 *
 * This function:
 * 1. Searches knowledge_nodes for symbol nodes matching the name (case-insensitive)
 * 2. Optionally filters by symbol kind
 * 3. Finds 'defines' edges pointing TO the symbol for definitions
 * 4. Finds 'calls', 'imports', 'depends_on' edges pointing TO the symbol for usages
 * 5. Batch fetches associated chunks and documents for context
 *
 * @param db - PostgreSQL connection pool
 * @param params - Search parameters
 * @returns Symbol usages result with definitions, usages, and stats
 */
export async function findSymbolUsages(
  db: Pool,
  params: FindSymbolUsagesParams
): Promise<SymbolUsagesResult> {
  const startTime = performance.now();

  const {
    collectionId,
    symbolName,
    symbolKind,
    includeDefinitions = true,
    includeUsages = true,
    maxResults = 20,
  } = params;

  // Validate inputs
  if (!collectionId || !symbolName) {
    return createEmptyResult(performance.now() - startTime);
  }

  // Step 1: Find symbol nodes matching the name
  const symbolNodes = await findSymbolNodes(db, collectionId, symbolName, symbolKind);

  if (symbolNodes.length === 0) {
    return createEmptyResult(performance.now() - startTime);
  }

  // Use the first matching symbol as the primary result
  const primarySymbol = symbolNodes[0];
  const symbolNodeIds = symbolNodes.map((n) => n.id);

  // Step 2: Find definitions and usages in parallel
  const [definitions, usages] = await Promise.all([
    includeDefinitions
      ? findDefinitions(db, collectionId, symbolNodeIds, maxResults)
      : Promise.resolve([]),
    includeUsages ? findUsages(db, collectionId, symbolNodeIds, maxResults) : Promise.resolve([]),
  ]);

  // Step 3: Collect all unique chunk IDs and document IDs for batch fetching
  const allLocations = [...definitions, ...usages];
  const chunkIds = new Set<number>();
  const documentIds = new Set<string>();

  for (const loc of allLocations) {
    if (loc.chunkId !== null) {
      chunkIds.add(loc.chunkId);
    }
    if (loc.documentId !== null) {
      documentIds.add(loc.documentId);
    }
  }

  // Step 4: Batch fetch chunks and documents
  const [chunksMap, documentsMap] = await Promise.all([
    fetchChunks(db, Array.from(chunkIds)),
    fetchDocuments(db, Array.from(documentIds)),
  ]);

  // Step 5: Enrich locations with chunk text and document titles
  const enrichedDefinitions = enrichLocations(definitions, chunksMap, documentsMap);
  const enrichedUsages = enrichUsages(usages, chunksMap, documentsMap);

  // Step 6: Count unique documents with usages
  const documentsWithUsages = new Set(
    enrichedUsages.filter((u) => u.documentId !== null).map((u) => u.documentId)
  ).size;

  const searchDurationMs = Math.round(performance.now() - startTime);

  return {
    symbol: {
      name: primarySymbol.name,
      kind: extractSymbolKind(primarySymbol),
      nodeId: primarySymbol.id,
    },
    definitions: enrichedDefinitions,
    usages: enrichedUsages,
    stats: {
      totalDefinitions: enrichedDefinitions.length,
      totalUsages: enrichedUsages.length,
      documentsWithUsages,
      searchDurationMs,
    },
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Creates an empty result for when no symbol is found
 */
function createEmptyResult(durationMs: number): SymbolUsagesResult {
  return {
    symbol: null,
    definitions: [],
    usages: [],
    stats: {
      totalDefinitions: 0,
      totalUsages: 0,
      documentsWithUsages: 0,
      searchDurationMs: Math.round(durationMs),
    },
  };
}

/**
 * Database row type for symbol nodes
 */
interface SymbolNodeRow {
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
 * Find symbol nodes matching the given name (case-insensitive)
 */
async function findSymbolNodes(
  db: Pool,
  collectionId: string,
  symbolName: string,
  symbolKind?: SymbolKind
): Promise<SymbolNodeRow[]> {
  // Build the query with optional kind filter
  // We search for node_type = 'symbol' and name ILIKE the provided symbol name
  // For exact matches, we prioritize them using ORDER BY

  const baseQuery = `
    SELECT id, collection_id, node_type, name, document_id, chunk_id, metadata, created_at
    FROM knowledge_nodes
    WHERE collection_id = $1
      AND node_type = 'symbol'
      AND name ILIKE $2
    ORDER BY
      CASE WHEN name = $3 THEN 0 ELSE 1 END,
      created_at DESC
    LIMIT 10
  `;

  // Use pattern matching for ILIKE (% at start and end for contains match)
  // But also pass exact name for priority ordering
  const result = await db.query<SymbolNodeRow>(baseQuery, [
    collectionId,
    `%${symbolName}%`,
    symbolName,
  ]);

  let nodes = result.rows;

  // Filter by symbol kind if specified
  if (symbolKind && nodes.length > 0) {
    nodes = nodes.filter((node) => {
      const nodeKind = extractSymbolKind(node);
      return nodeKind === symbolKind;
    });
  }

  return nodes;
}

/**
 * Extract symbol kind from node metadata or name pattern
 */
function extractSymbolKind(node: SymbolNodeRow): string {
  // First check metadata.kind
  const metadataKind = node.metadata?.kind;
  if (typeof metadataKind === 'string') {
    return metadataKind;
  }

  // Check metadata.symbolKind (alternative key)
  const symbolKind = node.metadata?.symbolKind;
  if (typeof symbolKind === 'string') {
    return symbolKind;
  }

  // Check metadata.type (another common key)
  const typeKind = node.metadata?.type;
  if (typeof typeKind === 'string') {
    return typeKind;
  }

  // Infer from name patterns
  const name = node.name.toLowerCase();

  // Interface pattern: starts with I + PascalCase or ends with Interface
  if (/^I[A-Z]/.test(node.name) || name.endsWith('interface')) {
    return 'interface';
  }

  // Type pattern: ends with Type, Props, Options, Config, State
  if (/(?:Type|Props|Options|Config|State|Params|Args)$/i.test(node.name)) {
    return 'type';
  }

  // Enum pattern: ends with Enum or Status, or metadata suggests enum
  if (name.endsWith('enum') || /(?:Status|Kind|Mode)$/.test(node.name)) {
    return 'enum';
  }

  // Widget pattern (Flutter/React): ends with Widget or starts with capital
  if (name.endsWith('widget') || name.endsWith('component')) {
    return 'widget';
  }

  // Class pattern: PascalCase with common suffixes
  if (
    /^[A-Z][a-zA-Z]*(?:Service|Repository|Controller|Manager|Factory|Provider|Model|Handler|Adapter|Builder)$/.test(
      node.name
    )
  ) {
    return 'class';
  }

  // Method pattern: starts with verb
  if (/^(?:get|set|create|update|delete|fetch|handle|on|do|is|has|can)/i.test(name)) {
    return 'method';
  }

  // Constant pattern: ALL_CAPS with underscores
  if (/^[A-Z][A-Z0-9_]*$/.test(node.name)) {
    return 'constant';
  }

  // Default to function
  return 'function';
}

/**
 * Raw location row from edge query
 */
interface LocationRow {
  source_node_id: string;
  target_node_id: string;
  edge_type: string;
  edge_metadata: Record<string, unknown>;
  node_id: string;
  node_name: string;
  document_id: string | null;
  chunk_id: number | null;
  node_metadata: Record<string, unknown>;
}

/**
 * Find nodes that define the symbol(s)
 * Definition: An edge with type 'defines' where the target is the symbol
 * (source_node defines target_node)
 */
async function findDefinitions(
  db: Pool,
  collectionId: string,
  symbolNodeIds: string[],
  maxResults: number
): Promise<SymbolLocation[]> {
  if (symbolNodeIds.length === 0) {
    return [];
  }

  // Find edges where: source defines target (target is our symbol)
  // The defining node is the source
  const query = `
    SELECT
      ke.source_node_id,
      ke.target_node_id,
      ke.edge_type,
      ke.metadata AS edge_metadata,
      kn.id AS node_id,
      kn.name AS node_name,
      kn.document_id,
      kn.chunk_id,
      kn.metadata AS node_metadata
    FROM knowledge_edges ke
    JOIN knowledge_nodes kn ON kn.id = ke.source_node_id
    WHERE ke.collection_id = $1
      AND ke.edge_type = $2
      AND ke.target_node_id = ANY($3::uuid[])
    ORDER BY kn.created_at DESC
    LIMIT $4
  `;

  const result = await db.query<LocationRow>(query, [
    collectionId,
    DEFINITION_EDGE_TYPE,
    symbolNodeIds,
    maxResults,
  ]);

  return result.rows.map((row) => ({
    nodeId: row.node_id,
    documentId: row.document_id,
    documentTitle: null, // Will be enriched later
    chunkId: row.chunk_id,
    chunkText: null, // Will be enriched later
    filePath: extractFilePath(row.node_metadata),
    lineNumber: extractLineNumber(row.node_metadata),
    metadata: row.node_metadata,
  }));
}

/**
 * Find nodes that use the symbol(s)
 * Usage: Edges with type 'calls', 'imports', 'depends_on' where the target is the symbol
 * (source_node uses target_node via calls/imports/depends_on)
 */
async function findUsages(
  db: Pool,
  collectionId: string,
  symbolNodeIds: string[],
  maxResults: number
): Promise<Array<SymbolLocation & { edgeType: string }>> {
  if (symbolNodeIds.length === 0) {
    return [];
  }

  // Find edges where: source uses target (target is our symbol)
  // The using node is the source
  const query = `
    SELECT
      ke.source_node_id,
      ke.target_node_id,
      ke.edge_type,
      ke.metadata AS edge_metadata,
      kn.id AS node_id,
      kn.name AS node_name,
      kn.document_id,
      kn.chunk_id,
      kn.metadata AS node_metadata
    FROM knowledge_edges ke
    JOIN knowledge_nodes kn ON kn.id = ke.source_node_id
    WHERE ke.collection_id = $1
      AND ke.edge_type = ANY($2::varchar[])
      AND ke.target_node_id = ANY($3::uuid[])
    ORDER BY kn.created_at DESC
    LIMIT $4
  `;

  const result = await db.query<LocationRow>(query, [
    collectionId,
    USAGE_EDGE_TYPES as unknown as string[],
    symbolNodeIds,
    maxResults,
  ]);

  return result.rows.map((row) => ({
    nodeId: row.node_id,
    documentId: row.document_id,
    documentTitle: null, // Will be enriched later
    chunkId: row.chunk_id,
    chunkText: null, // Will be enriched later
    filePath: extractFilePath(row.node_metadata),
    lineNumber: extractLineNumber(row.node_metadata),
    metadata: row.node_metadata,
    edgeType: row.edge_type,
  }));
}

/**
 * Extract file path from node metadata
 */
function extractFilePath(metadata: Record<string, unknown>): string | null {
  const filePath = metadata?.file_path ?? metadata?.filePath ?? metadata?.path;
  return typeof filePath === 'string' ? filePath : null;
}

/**
 * Extract line number from node metadata
 */
function extractLineNumber(metadata: Record<string, unknown>): number | null {
  const lineNumber = metadata?.line_number ?? metadata?.lineNumber ?? metadata?.line;
  if (typeof lineNumber === 'number' && Number.isFinite(lineNumber)) {
    return lineNumber;
  }
  if (typeof lineNumber === 'string') {
    const parsed = Number.parseInt(lineNumber, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Chunk data from database
 */
interface ChunkData {
  id: number;
  text: string;
}

/**
 * Batch fetch chunks by IDs
 */
async function fetchChunks(db: Pool, chunkIds: number[]): Promise<Map<number, ChunkData>> {
  if (chunkIds.length === 0) {
    return new Map();
  }

  const result = await db.query<ChunkData>(
    'SELECT id, text FROM chunks WHERE id = ANY($1::int[])',
    [chunkIds]
  );

  const map = new Map<number, ChunkData>();
  for (const row of result.rows) {
    map.set(row.id, row);
  }
  return map;
}

/**
 * Document data from database
 */
interface DocumentData {
  id: string;
  title: string;
}

/**
 * Batch fetch documents by IDs
 */
async function fetchDocuments(db: Pool, documentIds: string[]): Promise<Map<string, DocumentData>> {
  if (documentIds.length === 0) {
    return new Map();
  }

  const result = await db.query<DocumentData>(
    'SELECT id, title FROM documents WHERE id = ANY($1::uuid[])',
    [documentIds]
  );

  const map = new Map<string, DocumentData>();
  for (const row of result.rows) {
    map.set(row.id, row);
  }
  return map;
}

/**
 * Enrich location objects with chunk text and document titles
 */
function enrichLocations(
  locations: SymbolLocation[],
  chunksMap: Map<number, ChunkData>,
  documentsMap: Map<string, DocumentData>
): SymbolLocation[] {
  return locations.map((loc) => {
    const chunk = loc.chunkId !== null ? chunksMap.get(loc.chunkId) : undefined;
    const document = loc.documentId !== null ? documentsMap.get(loc.documentId) : undefined;

    return {
      ...loc,
      chunkText: chunk?.text ?? null,
      documentTitle: document?.title ?? null,
    };
  });
}

/**
 * Enrich usage objects with chunk text and document titles
 */
function enrichUsages(
  usages: Array<SymbolLocation & { edgeType: string }>,
  chunksMap: Map<number, ChunkData>,
  documentsMap: Map<string, DocumentData>
): SymbolUsage[] {
  return usages.map((usage) => {
    const chunk = usage.chunkId !== null ? chunksMap.get(usage.chunkId) : undefined;
    const document = usage.documentId !== null ? documentsMap.get(usage.documentId) : undefined;

    return {
      ...usage,
      chunkText: chunk?.text ?? null,
      documentTitle: document?.title ?? null,
    };
  });
}
