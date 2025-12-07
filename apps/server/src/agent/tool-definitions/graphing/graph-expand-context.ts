import type { Pool } from 'pg';
import { z } from 'zod';
import { graphSearch } from '../../../services/graph-search.js';
import { createToolResponse } from '../adapters.js';
import type { ToolContext, UnifiedToolDefinition } from '../types.js';

// Input Schema
const graphExpandContextInputSchema = z
  .object({
    collectionId: z.string().uuid().optional().describe('Collection ID'),
    seedChunkIds: z.array(z.number().int()).optional().describe('Chunk IDs as starting points'),
    seedNodeIds: z.array(z.string().uuid()).optional().describe('Node IDs as starting points'),
    query: z.string().min(1).optional().describe('Query to find seed nodes'),
    maxDepth: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe('Maximum traversal depth (default: 3)'),
    maxNodes: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .describe('Maximum nodes to visit (default: 50)'),
    edgeTypes: z
      .array(
        z.enum([
          'calls',
          'defines',
          'belongs_to',
          'persists_to',
          'configured_by',
          'documents',
          'imports',
          'depends_on',
        ])
      )
      .optional()
      .describe('Filter by edge types'),
    nodeTypes: z
      .array(
        z.enum(['document', 'chunk', 'symbol', 'endpoint', 'table', 'column', 'config_section'])
      )
      .optional()
      .describe('Filter by node types'),
  })
  .refine(
    (data) => {
      const hasSeeds =
        (data.seedChunkIds?.length ?? 0) > 0 ||
        (data.seedNodeIds?.length ?? 0) > 0 ||
        Boolean(data.query);
      return hasSeeds;
    },
    {
      message: 'At least one seed required (seedChunkIds, seedNodeIds, or query)',
      path: [],
    }
  );

// Tool Definition
export const graphExpandContextTool: UnifiedToolDefinition = {
  name: 'graph_expand_context',
  description:
    'Traverse the knowledge graph to expand context from seed nodes. Use chunk IDs, node IDs, or a query as seeds to discover related code structures, endpoints, database tables, and configuration.',
  inputSchema: graphExpandContextInputSchema,
  metadata: {
    toolpack: 'graphing',
    category: 'graph',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: (db: Pool, context: ToolContext) => async (input: unknown) => {
    const parsed = graphExpandContextInputSchema.parse(input);

    const result = await graphSearch(db, {
      collectionId: parsed.collectionId ?? context.collectionId,
      seedChunkIds: parsed.seedChunkIds,
      seedNodeIds: parsed.seedNodeIds,
      query: parsed.query,
      maxDepth: parsed.maxDepth ?? 3,
      maxNodes: parsed.maxNodes ?? 50,
      edgeTypes: parsed.edgeTypes,
      nodeTypes: parsed.nodeTypes,
    });

    const payload = {
      nodes: result.nodes,
      edges: result.edges,
      chunks: result.chunks,
      stats: result.stats,
    };

    return createToolResponse(
      `Graph expanded: ${result.nodes.length} nodes, ${result.edges.length} edges, ${result.chunks.length} chunks`,
      payload
    );
  },
};
