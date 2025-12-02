/**
 * GPT Phase 2 Sub-Phase 3.3: Graph Routes
 * GPT Phase 3 Sub-Phase 5.2: HTTP API Enhancements
 *
 * REST API endpoints for knowledge graph context retrieval.
 *
 * Endpoints:
 * - POST /api/graph/context - Get graph context from seeds
 * - GET /api/graph/stats/:collectionId - Get graph statistics
 * - POST /api/graph/build/:collectionId - Build/rebuild graph for a collection
 * - POST /api/graph/symbols - Symbol usage search
 * - GET /api/graph/schema/:collectionId - Database schema extraction
 */

import { getPool } from '@synthesis/db';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { buildGraphForCollection } from '../services/graph-builder.js';
import { getGraphStats, graphSearch, isGraphExpansionEnabled } from '../services/graph-search.js';
import { extractSchema, isSchemaExtractionEnabled } from '../services/schema-extractor.js';
import { findSymbolUsages, isSymbolSearchEnabled } from '../services/symbol-search.js';

// Valid edge types for Zod schema
const EdgeTypeEnum = z.enum([
  'calls',
  'defines',
  'belongs_to',
  'persists_to',
  'configured_by',
  'documents',
  'imports',
  'depends_on',
]);

// Valid node types for Zod schema
const NodeTypeEnum = z.enum([
  'document',
  'chunk',
  'symbol',
  'endpoint',
  'table',
  'column',
  'config_section',
]);

const GraphContextSchema = z
  .object({
    collection_id: z.string().uuid().optional(),
    collectionId: z.string().uuid().optional(),
    seed_chunk_ids: z.array(z.number().int()).optional(),
    seedChunkIds: z.array(z.number().int()).optional(),
    seed_node_ids: z.array(z.string().uuid()).optional(),
    seedNodeIds: z.array(z.string().uuid()).optional(),
    query: z.string().min(1).optional(),
    max_depth: z.number().int().min(1).max(10).optional(),
    maxDepth: z.number().int().min(1).max(10).optional(),
    max_nodes: z.number().int().min(1).max(200).optional(),
    maxNodes: z.number().int().min(1).max(200).optional(),
    edge_types: z.array(EdgeTypeEnum).optional(),
    edgeTypes: z.array(EdgeTypeEnum).optional(),
    node_types: z.array(NodeTypeEnum).optional(),
    nodeTypes: z.array(NodeTypeEnum).optional(),
  })
  .refine(
    (data) => {
      // Require collection_id or collectionId
      const hasCollection = Boolean(data.collection_id ?? data.collectionId);
      return hasCollection;
    },
    {
      message: 'collection_id is required',
      path: ['collection_id'],
    }
  )
  .refine(
    (data) => {
      const hasSeeds =
        (data.seed_chunk_ids?.length ?? 0) > 0 ||
        (data.seedChunkIds?.length ?? 0) > 0 ||
        (data.seed_node_ids?.length ?? 0) > 0 ||
        (data.seedNodeIds?.length ?? 0) > 0 ||
        Boolean(data.query);
      return hasSeeds;
    },
    {
      message: 'At least one seed type required (seed_chunk_ids, seed_node_ids, or query)',
      path: ['seed_chunk_ids'],
    }
  );

// Symbol kind enum for symbol search
const SymbolKindEnum = z.enum(['function', 'class', 'widget', 'method', 'constant']);

// Schema for POST /api/graph/symbols - Symbol usage search
const SymbolSearchSchema = z
  .object({
    collection_id: z.string().uuid().optional(),
    collectionId: z.string().uuid().optional(),
    symbol_name: z.string().min(1).optional(),
    symbolName: z.string().min(1).optional(),
    symbol_kind: SymbolKindEnum.optional(),
    symbolKind: SymbolKindEnum.optional(),
    include_definitions: z.boolean().optional(),
    includeDefinitions: z.boolean().optional(),
    include_usages: z.boolean().optional(),
    includeUsages: z.boolean().optional(),
    max_results: z.number().int().min(1).max(100).optional(),
    maxResults: z.number().int().min(1).max(100).optional(),
  })
  .refine((data) => Boolean(data.collection_id ?? data.collectionId), {
    message: 'collection_id is required',
    path: ['collection_id'],
  })
  .refine((data) => Boolean(data.symbol_name ?? data.symbolName), {
    message: 'symbol_name is required',
    path: ['symbol_name'],
  });

// Schema for GET /api/graph/schema/:collectionId query params
const SchemaQuerySchema = z.object({
  tables: z.string().optional(), // comma-separated table names
  include_relationships: z.coerce.boolean().optional(),
  includeRelationships: z.coerce.boolean().optional(),
});

export const graphRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/graph/context - Get graph context from seeds
  fastify.post('/api/graph/context', async (request, reply) => {
    const validation = GraphContextSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.code(400).send({
        error: 'INVALID_INPUT',
        details: validation.error.issues,
      });
    }

    const data = validation.data;

    // Normalize snake_case/camelCase
    const collectionId = (data.collection_id ?? data.collectionId) as string;
    const seedChunkIds = data.seed_chunk_ids ?? data.seedChunkIds;
    const seedNodeIds = data.seed_node_ids ?? data.seedNodeIds;
    const maxDepth = data.max_depth ?? data.maxDepth;
    const maxNodes = data.max_nodes ?? data.maxNodes;
    const edgeTypes = data.edge_types ?? data.edgeTypes;
    const nodeTypes = data.node_types ?? data.nodeTypes;

    try {
      const db = getPool();
      const result = await graphSearch(db, {
        collectionId,
        seedChunkIds,
        seedNodeIds,
        query: data.query,
        maxDepth,
        maxNodes,
        edgeTypes: edgeTypes as
          | (
              | 'calls'
              | 'defines'
              | 'belongs_to'
              | 'persists_to'
              | 'configured_by'
              | 'documents'
              | 'imports'
              | 'depends_on'
            )[]
          | undefined,
        nodeTypes: nodeTypes as
          | ('document' | 'chunk' | 'symbol' | 'endpoint' | 'table' | 'column' | 'config_section')[]
          | undefined,
      });

      return reply.send({
        nodes: result.nodes,
        edges: result.edges,
        chunks: result.chunks,
        stats: result.stats,
        graph_expansion_enabled: isGraphExpansionEnabled(),
      });
    } catch (error) {
      fastify.log.error(error, 'Graph context search failed');
      return reply.code(500).send({
        error: 'GRAPH_SEARCH_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // GET /api/graph/stats/:collectionId - Get graph statistics
  fastify.get<{ Params: { collectionId: string } }>(
    '/api/graph/stats/:collectionId',
    async (request, reply) => {
      const { collectionId } = request.params;

      // Validate UUID format (permissive - allows any valid hex UUID format)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(collectionId)) {
        return reply.code(400).send({
          error: 'INVALID_INPUT',
          message: 'collectionId must be a valid UUID',
        });
      }

      try {
        const stats = await getGraphStats(collectionId);
        return reply.send({
          collection_id: collectionId,
          total_nodes: stats.totalNodes,
          total_edges: stats.totalEdges,
          nodes_by_type: stats.nodesByType,
          edges_by_type: stats.edgesByType,
        });
      } catch (error) {
        fastify.log.error(error, 'Failed to get graph stats');
        return reply.code(500).send({
          error: 'GRAPH_STATS_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // POST /api/graph/build/:collectionId - Build/rebuild graph for a collection
  fastify.post<{ Params: { collectionId: string } }>(
    '/api/graph/build/:collectionId',
    async (request, reply) => {
      const { collectionId } = request.params;

      // Validate UUID format (permissive - allows any valid hex UUID format)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(collectionId)) {
        return reply.code(400).send({
          error: 'INVALID_INPUT',
          message: 'collectionId must be a valid UUID',
        });
      }

      try {
        const db = getPool();
        fastify.log.info({ collectionId }, 'Starting graph build for collection');

        const result = await buildGraphForCollection(db, collectionId, { forceEnabled: true });

        fastify.log.info(
          {
            collectionId,
            totalDocuments: result.totalDocuments,
            successCount: result.successCount,
            totalNodes: result.totalNodesCreated,
            totalEdges: result.totalEdgesCreated,
            durationMs: result.durationMs,
          },
          'Graph build completed'
        );

        return reply.send({
          collection_id: collectionId,
          documents_processed: result.successCount,
          total_nodes_created: result.totalNodesCreated,
          total_edges_created: result.totalEdgesCreated,
          duration_ms: result.durationMs,
          errors: result.failures.map((f) => `${f.documentId}: ${f.error}`),
        });
      } catch (error) {
        fastify.log.error(error, 'Failed to build graph for collection');
        return reply.code(500).send({
          error: 'GRAPH_BUILD_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // POST /api/graph/symbols - Symbol usage search
  fastify.post('/api/graph/symbols', async (request, reply) => {
    const validation = SymbolSearchSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.code(400).send({
        error: 'INVALID_INPUT',
        details: validation.error.issues,
      });
    }

    const data = validation.data;

    // Normalize snake_case/camelCase
    const collectionId = (data.collection_id ?? data.collectionId) as string;
    const symbolName = (data.symbol_name ?? data.symbolName) as string;
    const symbolKind = data.symbol_kind ?? data.symbolKind;
    const includeDefinitions = data.include_definitions ?? data.includeDefinitions;
    const includeUsages = data.include_usages ?? data.includeUsages;
    const maxResults = data.max_results ?? data.maxResults;

    try {
      const db = getPool();
      const result = await findSymbolUsages(db, {
        collectionId,
        symbolName,
        symbolKind: symbolKind as
          | 'function'
          | 'class'
          | 'widget'
          | 'method'
          | 'constant'
          | undefined,
        includeDefinitions,
        includeUsages,
        maxResults,
      });

      return reply.send({
        symbol: result.symbol,
        definitions: result.definitions,
        usages: result.usages,
        stats: result.stats,
        symbol_search_enabled: isSymbolSearchEnabled(),
      });
    } catch (error) {
      fastify.log.error(error, 'Symbol search failed');
      return reply.code(500).send({
        error: 'SYMBOL_SEARCH_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // GET /api/graph/schema/:collectionId - Database schema extraction
  fastify.get<{
    Params: { collectionId: string };
    Querystring: Record<string, string | undefined>;
  }>('/api/graph/schema/:collectionId', async (request, reply) => {
    const { collectionId } = request.params;

    // Validate UUID format (permissive - allows any valid hex UUID format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(collectionId)) {
      return reply.code(400).send({
        error: 'INVALID_INPUT',
        message: 'collectionId must be a valid UUID',
      });
    }

    // Validate query parameters
    const queryValidation = SchemaQuerySchema.safeParse(request.query);
    if (!queryValidation.success) {
      return reply.code(400).send({
        error: 'INVALID_INPUT',
        details: queryValidation.error.issues,
      });
    }

    const queryData = queryValidation.data;

    // Normalize snake_case/camelCase
    const includeRelationships =
      queryData.include_relationships ?? queryData.includeRelationships ?? true;

    // Parse comma-separated table names if provided
    const tables = queryData.tables
      ? queryData.tables
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      : undefined;

    try {
      const db = getPool();
      const result = await extractSchema(db, {
        collectionId,
        tables,
        includeRelationships,
      });

      return reply.send({
        collection_id: collectionId,
        tables: result.tables,
        relationships: result.relationships,
        stats: {
          total_tables: result.stats.totalTables,
          total_columns: result.stats.totalColumns,
          total_relationships: result.stats.totalRelationships,
          extraction_duration_ms: result.stats.extractionDurationMs,
        },
        schema_extraction_enabled: isSchemaExtractionEnabled(),
      });
    } catch (error) {
      fastify.log.error(error, 'Schema extraction failed');
      return reply.code(500).send({
        error: 'SCHEMA_EXTRACTION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
};
