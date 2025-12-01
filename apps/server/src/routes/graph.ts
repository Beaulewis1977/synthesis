/**
 * GPT Phase 2 Sub-Phase 3.3: Graph Routes
 *
 * REST API endpoints for knowledge graph context retrieval.
 *
 * Endpoints:
 * - POST /api/graph/context - Get graph context from seeds
 * - GET /api/graph/stats/:collectionId - Get graph statistics
 */

import { getPool } from '@synthesis/db';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getGraphStats, graphSearch, isGraphExpansionEnabled } from '../services/graph-search.js';

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

      // Validate UUID format
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
};
