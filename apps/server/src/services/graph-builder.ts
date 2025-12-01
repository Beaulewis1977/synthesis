/**
 * GPT Phase 2 Sub-Phase 3.2: Knowledge Graph Builder Service
 *
 * Builds a lightweight knowledge graph from document chunks during ingestion.
 * Creates nodes for symbols, tables, endpoints, and config sections, then
 * creates edges to represent relationships between them.
 *
 * Key Features:
 * - Idempotent: Deletes existing nodes for document before rebuilding
 * - Transactional: Uses database transaction for atomicity
 * - Non-blocking: Logs errors but doesn't fail the ingestion pipeline
 * - Feature flagged: Controlled by ENABLE_GRAPH_BUILDER env var
 */

import {
  type KnowledgeNodeRow,
  createEdgesBatch,
  createNodesBatch,
  deleteNodesByDocument,
  findOrCreateNode,
  getNodeByName,
} from '@synthesis/db';
import type { ChunkMetadata, KnowledgeEdgeType, KnowledgeNodeType } from '@synthesis/shared';
import type { Pool, PoolClient } from 'pg';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface GraphBuilderOptions {
  /** Skip creating document -> symbol "defines" edges */
  skipDefinesEdges?: boolean;
  /** Skip creating document -> document "imports" edges */
  skipImportsEdges?: boolean;
  /** Skip creating child -> parent "belongs_to" edges (method -> class, column -> table) */
  skipBelongsToEdges?: boolean;
  /** Skip creating symbol -> symbol "depends_on" edges (extends/implements) */
  skipDependsOnEdges?: boolean;
}

export interface GraphBuilderResult {
  /** Number of nodes created */
  nodesCreated: number;
  /** Number of edges created */
  edgesCreated: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Any warnings encountered during graph building */
  warnings: string[];
}

/** Internal chunk representation with typed metadata */
interface ChunkRow {
  id: number;
  text: string;
  metadata: ChunkMetadata;
}

/** Node input for batch creation */
interface NodeInput {
  collection_id: string;
  node_type: KnowledgeNodeType;
  name: string;
  document_id?: string | null;
  chunk_id?: number | null;
  metadata?: Record<string, unknown>;
}

/** Edge input for batch creation */
interface EdgeInput {
  collection_id: string;
  source_node_id: string;
  target_node_id: string;
  edge_type: KnowledgeEdgeType;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Check if graph builder is enabled via environment variable
 */
export function isGraphBuilderEnabled(): boolean {
  const enabled = process.env.ENABLE_GRAPH_BUILDER;
  return enabled === 'true' || enabled === '1';
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

/**
 * Build knowledge graph nodes and edges for a document.
 *
 * This function is idempotent - it deletes existing nodes for the document
 * before creating new ones. It runs in a transaction for atomicity.
 *
 * @param db - Database pool
 * @param documentId - UUID of the document to build graph for
 * @param options - Optional configuration to skip certain edge types
 * @returns Result with counts and timing information
 */
export async function buildGraphForDocument(
  db: Pool,
  documentId: string,
  options: GraphBuilderOptions = {}
): Promise<GraphBuilderResult> {
  const startTime = Date.now();
  const warnings: string[] = [];

  // Check feature flag
  if (!isGraphBuilderEnabled()) {
    return {
      nodesCreated: 0,
      edgesCreated: 0,
      durationMs: Date.now() - startTime,
      warnings: ['Graph builder is disabled (ENABLE_GRAPH_BUILDER != true)'],
    };
  }

  let nodesCreated = 0;
  let edgesCreated = 0;
  let client: PoolClient | undefined;

  try {
    // Fetch document
    const docResult = await db.query('SELECT * FROM documents WHERE id = $1', [documentId]);
    const document = docResult.rows[0];

    if (!document) {
      return {
        nodesCreated: 0,
        edgesCreated: 0,
        durationMs: Date.now() - startTime,
        warnings: [`Document ${documentId} not found`],
      };
    }

    const collectionId = document.collection_id as string;
    const docTitle = document.title as string;
    const docMetadata = (document.metadata || {}) as Record<string, unknown>;
    const fileImports = (docMetadata.file_imports || []) as string[];

    // Fetch chunks
    const chunksResult = await db.query(
      'SELECT id, text, metadata FROM chunks WHERE doc_id = $1 ORDER BY chunk_index',
      [documentId]
    );
    const chunks = chunksResult.rows as ChunkRow[];

    if (chunks.length === 0) {
      return {
        nodesCreated: 0,
        edgesCreated: 0,
        durationMs: Date.now() - startTime,
        warnings: [`Document ${documentId} has no chunks`],
      };
    }

    // Start transaction
    client = await db.connect();
    await client.query('BEGIN');

    try {
      // Delete existing nodes for this document (idempotent)
      const deletedCount = await deleteNodesByDocument(documentId, client);
      if (deletedCount > 0) {
        console.info(
          `[graph-builder] Deleted ${deletedCount} existing nodes for document ${documentId}`
        );
      }

      // Create document node
      const docNode = await findOrCreateNode(
        {
          collection_id: collectionId,
          node_type: 'document',
          name: docTitle,
          document_id: documentId,
          metadata: {
            file_path: docMetadata.file_path,
            framework: docMetadata.framework,
            language: docMetadata.language,
          },
        },
        client
      );
      nodesCreated++;

      // Extract all nodes from chunks
      const allNodes: NodeInput[] = [];
      const symbolNodes: KnowledgeNodeRow[] = [];
      const tableNodes: KnowledgeNodeRow[] = [];
      const columnNodes: KnowledgeNodeRow[] = [];
      const configNodes: KnowledgeNodeRow[] = [];
      const endpointNodes: KnowledgeNodeRow[] = [];
      const classNodes: KnowledgeNodeRow[] = [];

      for (const chunk of chunks) {
        // Extract symbol nodes (functions, classes, methods, constants)
        const symbols = extractSymbolNodes(chunk, collectionId, documentId);
        allNodes.push(...symbols);

        // Extract table and column nodes from SQL chunks
        const tables = extractTableNodes(chunk, collectionId, documentId);
        allNodes.push(...tables);

        // Extract config section nodes
        const configs = extractConfigSectionNodes(chunk, collectionId, documentId);
        allNodes.push(...configs);

        // Extract endpoint nodes
        const endpoints = extractEndpointNodes(chunk, collectionId, documentId);
        allNodes.push(...endpoints);
      }

      // Batch create all nodes
      if (allNodes.length > 0) {
        const createdNodes = await createNodesBatch(allNodes, client);
        nodesCreated += createdNodes.length;

        // Categorize created nodes for edge creation
        for (const node of createdNodes) {
          switch (node.node_type) {
            case 'symbol': {
              symbolNodes.push(node);
              const kind = node.metadata?.symbol_kind as string | undefined;
              if (kind === 'class' || kind === 'widget') {
                classNodes.push(node);
              }
              break;
            }
            case 'table':
              tableNodes.push(node);
              break;
            case 'column':
              columnNodes.push(node);
              break;
            case 'config_section':
              configNodes.push(node);
              break;
            case 'endpoint':
              endpointNodes.push(node);
              break;
          }
        }
      }

      // Create edges
      const allEdges: EdgeInput[] = [];

      // 1. Document -> Symbol "defines" edges
      if (!options.skipDefinesEdges) {
        const definesEdges = createDefinesEdges(docNode.id, symbolNodes, collectionId);
        allEdges.push(...definesEdges);
      }

      // 2. Child -> Parent "belongs_to" edges
      if (!options.skipBelongsToEdges) {
        const belongsToEdges = await createBelongsToEdges(
          client,
          symbolNodes,
          columnNodes,
          tableNodes,
          chunks,
          collectionId
        );
        allEdges.push(...belongsToEdges);
      }

      // 3. Document -> Document "imports" edges
      if (!options.skipImportsEdges && fileImports.length > 0) {
        const importEdges = await createImportsEdges(
          client,
          docNode.id,
          fileImports,
          collectionId,
          warnings
        );
        allEdges.push(...importEdges);
      }

      // 4. Class -> Class "depends_on" edges (extends/implements)
      if (!options.skipDependsOnEdges && classNodes.length > 0) {
        const dependsOnEdges = await createDependsOnEdges(
          client,
          classNodes,
          chunks,
          collectionId,
          warnings
        );
        allEdges.push(...dependsOnEdges);
      }

      // 5. Function -> Table "persists_to" edges (SQL patterns in code)
      const persistsToEdges = await createPersistsToEdges(
        client,
        symbolNodes,
        tableNodes,
        chunks,
        collectionId,
        warnings
      );
      allEdges.push(...persistsToEdges);

      // 6. Symbol -> Config "configured_by" edges
      const configuredByEdges = await createConfiguredByEdges(
        client,
        symbolNodes,
        configNodes,
        chunks,
        collectionId,
        warnings
      );
      allEdges.push(...configuredByEdges);

      // Batch create all edges
      if (allEdges.length > 0) {
        const createdEdges = await createEdgesBatch(allEdges, client);
        edgesCreated += createdEdges.length;
      }

      // Commit transaction
      await client.query('COMMIT');

      console.info(
        `[graph-builder] Built graph for document ${documentId}: ${nodesCreated} nodes, ${edgesCreated} edges`
      );
    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[graph-builder] Failed to build graph for document ${documentId}:`, error);
    warnings.push(`Graph build failed: ${errorMessage}`);
    // Non-blocking: return result with warnings instead of throwing
  } finally {
    if (client) {
      client.release();
    }
  }

  return {
    nodesCreated,
    edgesCreated,
    durationMs: Date.now() - startTime,
    warnings,
  };
}

// =============================================================================
// NODE EXTRACTION FUNCTIONS
// =============================================================================

/**
 * Extract symbol nodes from a chunk (functions, classes, methods, constants)
 */
function extractSymbolNodes(
  chunk: ChunkRow,
  collectionId: string,
  documentId: string
): NodeInput[] {
  const nodes: NodeInput[] = [];
  const meta = chunk.metadata;

  // Guard against null/undefined metadata
  if (!meta) {
    return nodes;
  }

  // Extract function node
  if (meta.function_name) {
    nodes.push({
      collection_id: collectionId,
      node_type: 'symbol',
      name: meta.function_name,
      document_id: documentId,
      chunk_id: chunk.id,
      metadata: {
        symbol_kind: 'function',
        file_path: meta.file_path,
        line_start: meta.line_range?.[0],
        line_end: meta.line_range?.[1],
        parameters: meta.parameters,
        return_type: meta.return_type,
        is_async: meta.is_async,
        framework: meta.framework,
        tech_stack: meta.tech_stack,
      },
    });
  }

  // Extract class node
  if (meta.class_name) {
    const isWidget = meta.is_widget === true;
    nodes.push({
      collection_id: collectionId,
      node_type: 'symbol',
      name: meta.class_name,
      document_id: documentId,
      chunk_id: chunk.id,
      metadata: {
        symbol_kind: isWidget ? 'widget' : 'class',
        file_path: meta.file_path,
        line_start: meta.line_range?.[0],
        line_end: meta.line_range?.[1],
        extends: meta.extends,
        implements: meta.implements,
        mixins: meta.mixins,
        is_abstract: meta.is_abstract,
        is_stateful: meta.is_stateful,
        is_widget: isWidget,
        methods: meta.methods,
        properties: meta.properties,
        framework: meta.framework,
        tech_stack: meta.tech_stack,
      },
    });
  }

  // Extract constant node (detected via chunk_type or naming patterns)
  // Constants are typically detected as code chunks with const/final keywords
  // We check for a pattern where the chunk has a single identifier that looks like a constant
  const constantName = (meta as Record<string, unknown>).constant_name as string | undefined;
  if (constantName) {
    nodes.push({
      collection_id: collectionId,
      node_type: 'symbol',
      name: constantName,
      document_id: documentId,
      chunk_id: chunk.id,
      metadata: {
        symbol_kind: 'constant',
        file_path: meta.file_path,
        line_start: meta.line_range?.[0],
        line_end: meta.line_range?.[1],
        framework: meta.framework,
        tech_stack: meta.tech_stack,
      },
    });
  }

  // Extract method node (when class_context is present, this is a method of that class)
  if (meta.function_name && meta.class_context) {
    // Already created as function above, but add method relationship metadata
    const existingNode = nodes.find((n) => n.name === meta.function_name);
    if (existingNode?.metadata) {
      existingNode.metadata.symbol_kind = meta.is_static ? 'static_method' : 'method';
      existingNode.metadata.class_context = meta.class_context;
    }
  }

  return nodes;
}

/**
 * Extract table and column nodes from SQL chunks
 */
function extractTableNodes(chunk: ChunkRow, collectionId: string, documentId: string): NodeInput[] {
  const nodes: NodeInput[] = [];
  const meta = chunk.metadata;

  // Guard against null/undefined metadata
  if (!meta) {
    return nodes;
  }

  // Only process SQL chunks with table information
  if (meta.sql_type !== 'table' || !meta.table) {
    return nodes;
  }

  const tableName = meta.table;
  const schemaName = meta.schema || 'public';
  const fullTableName = schemaName !== 'public' ? `${schemaName}.${tableName}` : tableName;

  // Create table node
  nodes.push({
    collection_id: collectionId,
    node_type: 'table',
    name: fullTableName,
    document_id: documentId,
    chunk_id: chunk.id,
    metadata: {
      schema: schemaName,
      file_path: meta.file_path,
      line_start: meta.line_range?.[0],
      line_end: meta.line_range?.[1],
      tech_stack: meta.tech_stack,
    },
  });

  // Create column nodes
  if (Array.isArray(meta.columns)) {
    for (const column of meta.columns) {
      if (typeof column === 'object' && column.name) {
        nodes.push({
          collection_id: collectionId,
          node_type: 'column',
          name: `${fullTableName}.${column.name}`,
          document_id: documentId,
          chunk_id: chunk.id,
          metadata: {
            table: fullTableName,
            column_type: column.type,
            constraints: column.constraints,
            file_path: meta.file_path,
          },
        });
      }
    }
  }

  // Create column nodes from foreign keys
  if (Array.isArray(meta.foreign_keys)) {
    for (const fk of meta.foreign_keys) {
      if (typeof fk === 'object' && fk.column) {
        // The foreign key column already exists in columns, so we add reference metadata
        const existingColumn = nodes.find(
          (n) => n.node_type === 'column' && n.name === `${fullTableName}.${fk.column}`
        );
        if (existingColumn?.metadata) {
          existingColumn.metadata.references_table = fk.references_table;
          existingColumn.metadata.references_column = fk.references_column;
        }
      }
    }
  }

  return nodes;
}

/**
 * Extract config section nodes from config file chunks
 */
function extractConfigSectionNodes(
  chunk: ChunkRow,
  collectionId: string,
  documentId: string
): NodeInput[] {
  const nodes: NodeInput[] = [];
  const meta = chunk.metadata;

  // Guard against null/undefined metadata
  if (!meta || !meta.config_section) {
    return nodes;
  }

  nodes.push({
    collection_id: collectionId,
    node_type: 'config_section',
    name: meta.config_section,
    document_id: documentId,
    chunk_id: chunk.id,
    metadata: {
      format: meta.format,
      file_path: meta.file_path,
      keys: meta.keys,
      nested_paths: meta.nested_paths,
      maps_to: meta.maps_to,
      tech_stack: meta.tech_stack,
    },
  });

  return nodes;
}

/**
 * Extract API endpoint nodes from chunks using regex patterns
 */
function extractEndpointNodes(
  chunk: ChunkRow,
  collectionId: string,
  documentId: string
): NodeInput[] {
  const nodes: NodeInput[] = [];
  const meta = chunk.metadata || {};
  const text = chunk.text;

  // Pattern for common API route definitions
  // Fastify: fastify.get('/api/users', ...)
  // Express: router.get('/api/users', ...)
  // NestJS: @Get('/users')
  // FastAPI: @app.get('/users')
  // Django: path('users/', ...)

  const patterns = [
    // Fastify/Express style: app.get('/path', ...) or router.post('/path', ...)
    /(?:app|router|fastify|server)\.(get|post|put|patch|delete|head|options)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
    // NestJS decorators: @Get('/path'), @Post('/path'), etc.
    /@(Get|Post|Put|Patch|Delete|Head|Options)\s*\(\s*['"`]?([^'"`)\s]*)['"`]?\s*\)/gi,
    // FastAPI/Flask style: @app.get('/path') or @router.get('/path')
    /@(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  ];

  const foundEndpoints = new Set<string>();

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    // Reset lastIndex for each pattern
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      const method = match[1].toUpperCase();
      const path = match[2] || '/';
      const endpointName = `${method} ${path}`;

      if (!foundEndpoints.has(endpointName)) {
        foundEndpoints.add(endpointName);
        nodes.push({
          collection_id: collectionId,
          node_type: 'endpoint',
          name: endpointName,
          document_id: documentId,
          chunk_id: chunk.id,
          metadata: {
            method,
            path,
            file_path: meta.file_path,
            line_start: meta.line_range?.[0],
            line_end: meta.line_range?.[1],
            framework: meta.framework,
            tech_stack: meta.tech_stack,
          },
        });
      }
    }
  }

  return nodes;
}

// =============================================================================
// EDGE CREATION FUNCTIONS
// =============================================================================

/**
 * Create "defines" edges from document to symbols
 */
function createDefinesEdges(
  docNodeId: string,
  symbolNodes: KnowledgeNodeRow[],
  collectionId: string
): EdgeInput[] {
  return symbolNodes.map((symbol) => ({
    collection_id: collectionId,
    source_node_id: docNodeId,
    target_node_id: symbol.id,
    edge_type: 'defines' as KnowledgeEdgeType,
    metadata: {
      symbol_kind: symbol.metadata?.symbol_kind,
    },
  }));
}

/**
 * Create "belongs_to" edges for hierarchical relationships:
 * - method -> class
 * - column -> table
 */
async function createBelongsToEdges(
  client: PoolClient,
  symbolNodes: KnowledgeNodeRow[],
  columnNodes: KnowledgeNodeRow[],
  tableNodes: KnowledgeNodeRow[],
  _chunks: ChunkRow[],
  collectionId: string
): Promise<EdgeInput[]> {
  const edges: EdgeInput[] = [];

  // Method -> Class relationships
  for (const symbol of symbolNodes) {
    const kind = symbol.metadata?.symbol_kind as string | undefined;
    const classContext = symbol.metadata?.class_context as string | undefined;

    if ((kind === 'method' || kind === 'static_method') && classContext) {
      // Find the class node
      const classNode = await getNodeByName(collectionId, classContext, 'symbol', client);
      if (classNode) {
        edges.push({
          collection_id: collectionId,
          source_node_id: symbol.id,
          target_node_id: classNode.id,
          edge_type: 'belongs_to',
          metadata: {
            relationship: 'method_of_class',
          },
        });
      }
    }
  }

  // Column -> Table relationships
  for (const column of columnNodes) {
    const tableName = column.metadata?.table as string | undefined;
    if (tableName) {
      const tableNode = tableNodes.find((t) => t.name === tableName);
      if (tableNode) {
        edges.push({
          collection_id: collectionId,
          source_node_id: column.id,
          target_node_id: tableNode.id,
          edge_type: 'belongs_to',
          metadata: {
            relationship: 'column_of_table',
          },
        });
      }
    }
  }

  return edges;
}

/**
 * Create "imports" edges from document to imported documents
 */
async function createImportsEdges(
  client: PoolClient,
  docNodeId: string,
  fileImports: string[],
  collectionId: string,
  warnings: string[]
): Promise<EdgeInput[]> {
  const edges: EdgeInput[] = [];

  for (const importPath of fileImports) {
    try {
      // Try to find a document node matching the import path
      // First, try exact match on file_path in document metadata
      const result = await client.query(
        `SELECT kn.id FROM knowledge_nodes kn
         WHERE kn.collection_id = $1
           AND kn.node_type = 'document'
           AND (
             kn.metadata->>'file_path' = $2
             OR kn.name LIKE '%' || $2
           )
         LIMIT 1`,
        [collectionId, importPath]
      );

      if (result.rows.length > 0) {
        edges.push({
          collection_id: collectionId,
          source_node_id: docNodeId,
          target_node_id: result.rows[0].id as string,
          edge_type: 'imports',
          metadata: {
            import_path: importPath,
          },
        });
      }
    } catch (error) {
      // Log but don't fail on import resolution errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      warnings.push(`Failed to resolve import ${importPath}: ${errorMessage}`);
    }
  }

  return edges;
}

/**
 * Create "depends_on" edges for class inheritance/implementation
 */
async function createDependsOnEdges(
  client: PoolClient,
  classNodes: KnowledgeNodeRow[],
  _chunks: ChunkRow[],
  collectionId: string,
  warnings: string[]
): Promise<EdgeInput[]> {
  const edges: EdgeInput[] = [];

  for (const classNode of classNodes) {
    const extendsClass = classNode.metadata?.extends as string | undefined;
    const implementsInterfaces = classNode.metadata?.implements as string[] | undefined;
    const mixins = classNode.metadata?.mixins as string[] | undefined;

    // Handle extends
    if (extendsClass) {
      try {
        const parentNode = await getNodeByName(collectionId, extendsClass, 'symbol', client);
        if (parentNode) {
          edges.push({
            collection_id: collectionId,
            source_node_id: classNode.id,
            target_node_id: parentNode.id,
            edge_type: 'depends_on',
            metadata: {
              dependency_type: 'extends',
            },
          });
        }
      } catch (error) {
        warnings.push(`Failed to resolve extends ${extendsClass} for class ${classNode.name}`);
      }
    }

    // Handle implements
    if (Array.isArray(implementsInterfaces)) {
      for (const interfaceName of implementsInterfaces) {
        try {
          const interfaceNode = await getNodeByName(collectionId, interfaceName, 'symbol', client);
          if (interfaceNode) {
            edges.push({
              collection_id: collectionId,
              source_node_id: classNode.id,
              target_node_id: interfaceNode.id,
              edge_type: 'depends_on',
              metadata: {
                dependency_type: 'implements',
              },
            });
          }
        } catch (error) {
          warnings.push(
            `Failed to resolve implements ${interfaceName} for class ${classNode.name}`
          );
        }
      }
    }

    // Handle mixins (Dart-specific)
    if (Array.isArray(mixins)) {
      for (const mixinName of mixins) {
        try {
          const mixinNode = await getNodeByName(collectionId, mixinName, 'symbol', client);
          if (mixinNode) {
            edges.push({
              collection_id: collectionId,
              source_node_id: classNode.id,
              target_node_id: mixinNode.id,
              edge_type: 'depends_on',
              metadata: {
                dependency_type: 'mixin',
              },
            });
          }
        } catch (error) {
          warnings.push(`Failed to resolve mixin ${mixinName} for class ${classNode.name}`);
        }
      }
    }
  }

  return edges;
}

/**
 * Create "persists_to" edges from functions to tables based on SQL patterns in code
 */
async function createPersistsToEdges(
  _client: PoolClient,
  symbolNodes: KnowledgeNodeRow[],
  tableNodes: KnowledgeNodeRow[],
  chunks: ChunkRow[],
  collectionId: string,
  _warnings: string[]
): Promise<EdgeInput[]> {
  const edges: EdgeInput[] = [];

  // Build a map of table names for quick lookup
  const tableNameSet = new Set(tableNodes.map((t) => t.name.toLowerCase()));
  const tableNameToNode = new Map(tableNodes.map((t) => [t.name.toLowerCase(), t]));

  // Patterns for SQL operations in code
  const sqlPatterns = [
    // INSERT INTO table_name
    /INSERT\s+INTO\s+["'`]?(\w+)["'`]?/gi,
    // UPDATE table_name
    /UPDATE\s+["'`]?(\w+)["'`]?\s+SET/gi,
    // DELETE FROM table_name
    /DELETE\s+FROM\s+["'`]?(\w+)["'`]?/gi,
    // SELECT FROM table_name (reads, but still a relationship)
    /SELECT\s+.+?\s+FROM\s+["'`]?(\w+)["'`]?/gi,
    // Prisma/ORM patterns: prisma.tableName.create/update/delete and similar
    /(?:prisma|db)\.(\w+)\.(create|update|delete|upsert|findMany|findFirst)\s*\(/gi,
  ];

  // Function symbols only
  const functionNodes = symbolNodes.filter((s) => {
    const kind = s.metadata?.symbol_kind as string | undefined;
    return kind === 'function' || kind === 'method' || kind === 'static_method';
  });

  for (const funcNode of functionNodes) {
    // Find the chunk for this function
    const chunkId = funcNode.chunk_id;
    const chunk = chunks.find((c) => c.id === chunkId);
    if (!chunk) continue;

    const text = chunk.text;
    const referencedTables = new Set<string>();

    for (const pattern of sqlPatterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const tableName = match[1]?.toLowerCase();
        if (tableName && tableNameSet.has(tableName)) {
          referencedTables.add(tableName);
        }
      }
    }

    // Create edges for each referenced table
    for (const tableName of referencedTables) {
      const tableNode = tableNameToNode.get(tableName);
      if (tableNode) {
        edges.push({
          collection_id: collectionId,
          source_node_id: funcNode.id,
          target_node_id: tableNode.id,
          edge_type: 'persists_to',
          metadata: {
            detected_via: 'sql_pattern',
          },
        });
      }
    }
  }

  return edges;
}

/**
 * Create "configured_by" edges from symbols to config sections
 */
async function createConfiguredByEdges(
  _client: PoolClient,
  symbolNodes: KnowledgeNodeRow[],
  configNodes: KnowledgeNodeRow[],
  chunks: ChunkRow[],
  collectionId: string,
  _warnings: string[]
): Promise<EdgeInput[]> {
  const edges: EdgeInput[] = [];

  // Look for config references in symbol metadata
  for (const configNode of configNodes) {
    const mapsTo = configNode.metadata?.maps_to as { type: string; name: string } | undefined;

    if (mapsTo?.name) {
      // Find symbol that this config maps to
      const matchingSymbol = symbolNodes.find((s) => {
        const symbolName = s.name.toLowerCase();
        const targetName = mapsTo.name.toLowerCase();
        return symbolName === targetName || symbolName.includes(targetName);
      });

      if (matchingSymbol) {
        edges.push({
          collection_id: collectionId,
          source_node_id: matchingSymbol.id,
          target_node_id: configNode.id,
          edge_type: 'configured_by',
          metadata: {
            config_type: mapsTo.type,
          },
        });
      }
    }
  }

  // Also look for environment variable references in function code
  const envVarPattern = /process\.env\.(\w+)|env\(['"](\w+)['"]\)|getenv\(['"](\w+)['"]\)/gi;

  for (const funcNode of symbolNodes) {
    const kind = funcNode.metadata?.symbol_kind as string | undefined;
    if (kind !== 'function' && kind !== 'method') continue;

    const chunkId = funcNode.chunk_id;
    const chunk = chunks.find((c) => c.id === chunkId);
    if (!chunk) continue;

    const text = chunk.text;
    const referencedEnvVars = new Set<string>();

    envVarPattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = envVarPattern.exec(text)) !== null) {
      const envVar = match[1] || match[2] || match[3];
      if (envVar) {
        referencedEnvVars.add(envVar);
      }
    }

    // Find config sections that define these env vars
    for (const envVar of referencedEnvVars) {
      const matchingConfig = configNodes.find((c) => {
        const keys = c.metadata?.keys as string[] | undefined;
        const nestedPaths = c.metadata?.nested_paths as string[] | undefined;
        return (
          keys?.some((k) => k.toUpperCase() === envVar) ||
          nestedPaths?.some((p) => p.toUpperCase().includes(envVar))
        );
      });

      if (matchingConfig) {
        edges.push({
          collection_id: collectionId,
          source_node_id: funcNode.id,
          target_node_id: matchingConfig.id,
          edge_type: 'configured_by',
          metadata: {
            env_var: envVar,
          },
        });
      }
    }
  }

  return edges;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Build graph for all documents in a collection (for bulk operations)
 */
export async function buildGraphForCollection(
  db: Pool,
  collectionId: string,
  options: GraphBuilderOptions = {}
): Promise<{
  totalDocuments: number;
  successCount: number;
  failureCount: number;
  totalNodesCreated: number;
  totalEdgesCreated: number;
  durationMs: number;
  failures: Array<{ documentId: string; error: string }>;
}> {
  const startTime = Date.now();
  const failures: Array<{ documentId: string; error: string }> = [];

  // Get all complete documents in the collection
  const docsResult = await db.query(
    "SELECT id FROM documents WHERE collection_id = $1 AND status = 'complete'",
    [collectionId]
  );
  const documents = docsResult.rows as Array<{ id: string }>;

  let successCount = 0;
  let failureCount = 0;
  let totalNodesCreated = 0;
  let totalEdgesCreated = 0;

  for (const doc of documents) {
    try {
      const result = await buildGraphForDocument(db, doc.id, options);
      totalNodesCreated += result.nodesCreated;
      totalEdgesCreated += result.edgesCreated;

      if (result.warnings.some((w) => w.includes('failed'))) {
        failureCount++;
        failures.push({
          documentId: doc.id,
          error: result.warnings.join('; '),
        });
      } else {
        successCount++;
      }
    } catch (error) {
      failureCount++;
      failures.push({
        documentId: doc.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    totalDocuments: documents.length,
    successCount,
    failureCount,
    totalNodesCreated,
    totalEdgesCreated,
    durationMs: Date.now() - startTime,
    failures,
  };
}
