#!/usr/bin/env node

/**
 * Synthesis MCP Server
 *
 * This server implements the Model Context Protocol (MCP) to expose the Synthesis RAG system
 * to external AI agents via both stdio and HTTP transports.
 */

import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import dotenv from 'dotenv';
import { z } from 'zod';
// zod-to-json-schema not needed - MCP SDK 1.19.x handles Zod schema conversion internally

import { apiClient } from './api.js';
import { getRateLimiter } from './rate-limiter.js';
import { DynamicToolRegistry } from './tool-registry.js';
import { TOOL_METADATA } from './toolpacks.js';
import { executeMcpBridge } from './tools/bridge.js';
import { buildDiscoverResult } from './tools/discover.js';
import { enableTools } from './tools/enable.js';
import { executeViaRouter } from './tools/router.js';
import { executeSearch } from './tools/search.js';
import { toToolResult } from './types/gateway-responses.js';
import {
  GATEWAY_TOOL_DESCRIPTIONS,
  bridgeInputSchema,
  discoverToolsInputSchema,
  enableToolsInputSchema,
  enableToolsInputSchemaBase,
  routerInputSchema,
  searchInputSchema,
} from './types/gateway-schemas.js';
import { parseEnvConfig } from './types/index.js';

// Load environment variables
dotenv.config();

const MCP_PORT = (() => {
  const port = Number.parseInt(process.env.MCP_PORT || '3334', 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    console.error(
      `Invalid MCP_PORT: ${process.env.MCP_PORT}. Must be 1-65535. Using default 3334.`
    );
    return 3334;
  }
  return port;
})();
const MCP_MODE = process.env.MCP_MODE || 'stdio'; // 'stdio' or 'http'

// Initialize MCP Server with dynamic tool management capabilities (Phase 3.6)
const server = new McpServer(
  {
    name: 'synthesis-rag',
    version: '2.0.0', // Bumped for Phase 3 tool registry support
  },
  {
    capabilities: {
      tools: { listChanged: true }, // Support dynamic tool enable/disable notifications
    },
  }
);

// Parse configuration from environment variables (Phase 5.6.1)
const config = parseEnvConfig();

// Create dynamic tool registry for enable/disable operations (Phase 5.6.1)
// This captures MCP SDK handles for profile-based tool management
export const dynamicRegistry = new DynamicToolRegistry(server, config);

/**
 * Extract the shape from a z.object schema for MCP SDK 1.19.x compatibility.
 * The SDK expects a shape object { key: z.schema } not a wrapped z.object().
 */
function toInputShape<T extends z.ZodRawShape>(schema: z.ZodObject<T>): T {
  return schema.shape;
}

/**
 * Tool 1: search_rag
 * Searches the RAG knowledge base for relevant information.
 */
// Define Zod schema for runtime validation
const searchRagInput = z
  .object({
    collectionId: z.string().uuid().describe('The ID of the collection to search'),
    query: z.string().min(1).describe('The search query'),
    top_k: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(5)
      .describe('Number of results to return (default: 5)'),
    min_similarity: z
      .number()
      .min(0)
      .max(1)
      .default(0.5)
      .describe('Minimum similarity threshold (default: 0.5)'),
  })
  .strict();

dynamicRegistry.registerTool(
  'search_rag',
  {
    description:
      'Search the RAG knowledge base for relevant information and return matching chunks with citations.',
    inputSchema: toInputShape(searchRagInput),
    toolpack: TOOL_METADATA.search_rag.toolpack,
    category: TOOL_METADATA.search_rag.category,
    sensitive: TOOL_METADATA.search_rag.sensitive,
  },
  async (input) => {
    dynamicRegistry.recordCall('search_rag');
    const { collectionId, query, top_k, min_similarity } = searchRagInput.parse(input);
    try {
      const result = await apiClient.post('/api/search', {
        collectionId,
        query,
        top_k,
        min_similarity,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Tool 2: list_collections
 * Lists all available document collections.
 */
dynamicRegistry.registerTool(
  'list_collections',
  {
    description: 'List all available document collections.',
    toolpack: TOOL_METADATA.list_collections.toolpack,
    category: TOOL_METADATA.list_collections.category,
    sensitive: TOOL_METADATA.list_collections.sensitive,
  },
  async () => {
    dynamicRegistry.recordCall('list_collections');
    try {
      const result = await apiClient.get('/api/collections');

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Tool 3: list_documents
 * Lists all documents in a specific collection.
 */
const listDocumentsInput = z
  .object({
    collectionId: z.string().uuid().describe('The ID of the collection'),
  })
  .strict();

dynamicRegistry.registerTool(
  'list_documents',
  {
    description: 'List all documents in a specific collection.',
    inputSchema: toInputShape(listDocumentsInput),
    toolpack: TOOL_METADATA.list_documents.toolpack,
    category: TOOL_METADATA.list_documents.category,
    sensitive: TOOL_METADATA.list_documents.sensitive,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
    dynamicRegistry.recordCall('list_documents');
    const { collectionId } = listDocumentsInput.parse(input);
    try {
      const result = await apiClient.get(`/api/collections/${collectionId}/documents`);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Tool 4: create_collection
 * Creates a new document collection.
 */
const createCollectionInput = z
  .object({
    name: z.string().min(1).max(255).describe('The name of the collection'),
    description: z.string().optional().describe('Optional description of the collection'),
  })
  .strict();

dynamicRegistry.registerTool(
  'create_collection',
  {
    description: 'Create a new document collection.',
    inputSchema: toInputShape(createCollectionInput),
    toolpack: TOOL_METADATA.create_collection.toolpack,
    category: TOOL_METADATA.create_collection.category,
    sensitive: TOOL_METADATA.create_collection.sensitive,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
    dynamicRegistry.recordCall('create_collection');
    const { name, description } = createCollectionInput.parse(input);
    try {
      const result = await apiClient.post('/api/collections', {
        name,
        description,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Tool 5: fetch_and_add_document_from_url
 * Fetches content from a URL and adds it to a collection.
 */
const fetchDocumentInput = z
  .object({
    url: z.string().url().describe('The URL to fetch content from'),
    collectionId: z.string().uuid().describe('The ID of the collection to add the document to'),
    mode: z
      .enum(['single', 'crawl'])
      .default('single')
      .describe('Fetch mode: single page or crawl (default: single)'),
    maxPages: z
      .number()
      .int()
      .min(1)
      .max(200)
      .default(25)
      .describe('Maximum pages to crawl (default: 25)'),
    titlePrefix: z.string().optional().describe('Optional prefix for document titles'),
  })
  .strict();

dynamicRegistry.registerTool(
  'fetch_and_add_document_from_url',
  {
    description: 'Fetch content from a public URL and ingest it as a new document.',
    inputSchema: toInputShape(fetchDocumentInput),
    toolpack: TOOL_METADATA.fetch_and_add_document_from_url.toolpack,
    category: TOOL_METADATA.fetch_and_add_document_from_url.category,
    sensitive: TOOL_METADATA.fetch_and_add_document_from_url.sensitive,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
    dynamicRegistry.recordCall('fetch_and_add_document_from_url');
    const { url, collectionId, mode, maxPages, titlePrefix } = fetchDocumentInput.parse(input);
    try {
      const result = await apiClient.post('/api/agent/fetch-web-content', {
        url,
        collectionId,
        mode,
        maxPages,
        titlePrefix,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Tool 6: delete_document
 * Deletes a document and all associated chunks.
 */
const deleteDocumentInput = z
  .object({
    docId: z.string().uuid().describe('The ID of the document to delete'),
    confirm: z.boolean().describe('Must be set to true to confirm deletion'),
  })
  .strict();

dynamicRegistry.registerTool(
  'delete_document',
  {
    description: 'Delete a document and all associated chunks.',
    inputSchema: toInputShape(deleteDocumentInput),
    toolpack: TOOL_METADATA.delete_document.toolpack,
    category: TOOL_METADATA.delete_document.category,
    sensitive: TOOL_METADATA.delete_document.sensitive,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
    dynamicRegistry.recordCall('delete_document');
    const { docId, confirm } = deleteDocumentInput.parse(input);
    try {
      const result = await apiClient.post('/api/agent/delete-document', {
        docId,
        confirm,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Tool 7: delete_collection
 * Deletes an entire collection and all its documents.
 */
const deleteCollectionInput = z
  .object({
    collectionId: z.string().uuid().describe('The ID of the collection to delete'),
    confirm: z.boolean().describe('Must be set to true to confirm deletion'),
  })
  .strict();

dynamicRegistry.registerTool(
  'delete_collection',
  {
    description: 'Delete an entire collection and all its documents. Use with caution.',
    inputSchema: toInputShape(deleteCollectionInput),
    toolpack: TOOL_METADATA.delete_collection.toolpack,
    category: TOOL_METADATA.delete_collection.category,
    sensitive: TOOL_METADATA.delete_collection.sensitive,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
    dynamicRegistry.recordCall('delete_collection');
    const { collectionId, confirm } = deleteCollectionInput.parse(input);
    try {
      if (!confirm) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Deletion not confirmed. Set confirm=true to permanently remove the collection.',
            },
          ],
        };
      }

      const result = await apiClient.delete(`/api/collections/${collectionId}`);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Tool 8: add_repo_to_collection
 * Adds a GitHub/Git repository to a collection for ingestion.
 */
const addRepoInput = z
  .object({
    collectionId: z.string().uuid().describe('The ID of the collection to add the repo to'),
    repoUrl: z
      .string()
      .url()
      .describe('The Git repository URL (e.g., https://github.com/user/repo)'),
    defaultBranch: z
      .string()
      .default('main')
      .describe('The default branch to sync (default: main)'),
    ignoredPaths: z
      .array(z.string())
      .optional()
      .describe('Paths to ignore (e.g., ["node_modules/", "dist/"])'),
  })
  .strict();

dynamicRegistry.registerTool(
  'add_repo_to_collection',
  {
    description: 'Add a GitHub/Git repository to a collection for code ingestion.',
    inputSchema: toInputShape(addRepoInput),
    toolpack: TOOL_METADATA.add_repo_to_collection.toolpack,
    category: TOOL_METADATA.add_repo_to_collection.category,
    sensitive: TOOL_METADATA.add_repo_to_collection.sensitive,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
    dynamicRegistry.recordCall('add_repo_to_collection');
    const { collectionId, repoUrl, defaultBranch, ignoredPaths } = addRepoInput.parse(input);
    try {
      const result = await apiClient.post('/api/repos', {
        collection_id: collectionId,
        repo_url: repoUrl,
        default_branch: defaultBranch,
        ignored_paths: ignoredPaths,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Tool 9: sync_repo
 * Triggers a sync for a repository to pull latest changes.
 */
const syncRepoInput = z
  .object({
    repoSourceId: z.string().uuid().describe('The ID of the repository source to sync'),
  })
  .strict();

dynamicRegistry.registerTool(
  'sync_repo',
  {
    description: 'Trigger a sync for a repository to pull and ingest latest changes.',
    inputSchema: toInputShape(syncRepoInput),
    toolpack: TOOL_METADATA.sync_repo.toolpack,
    category: TOOL_METADATA.sync_repo.category,
    sensitive: TOOL_METADATA.sync_repo.sensitive,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
    dynamicRegistry.recordCall('sync_repo');
    const { repoSourceId } = syncRepoInput.parse(input);
    try {
      const result = await apiClient.post(`/api/repos/${repoSourceId}/sync`, {});

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Tool 10: list_repos
 * Lists all repository sources for a collection.
 */
const listReposInput = z
  .object({
    collectionId: z.string().uuid().describe('The ID of the collection'),
  })
  .strict();

dynamicRegistry.registerTool(
  'list_repos',
  {
    description: 'List all repository sources for a collection.',
    inputSchema: toInputShape(listReposInput),
    toolpack: TOOL_METADATA.list_repos.toolpack,
    category: TOOL_METADATA.list_repos.category,
    sensitive: TOOL_METADATA.list_repos.sensitive,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
    dynamicRegistry.recordCall('list_repos');
    const { collectionId } = listReposInput.parse(input);
    try {
      const result = await apiClient.get(`/api/repos?collection_id=${collectionId}`);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// =============================================================================
// GPT Phase 1: Mobile Feature Search Tools
// =============================================================================

/**
 * Tool 11: search_mobile_docs
 * Feature + framework aware search for mobile documentation
 */
const searchMobileDocsInput = z
  .object({
    collectionId: z.string().uuid().describe('The ID of the collection to search'),
    query: z.string().min(1).describe('Search query for mobile documentation'),
    featureTags: z
      .array(z.string())
      .optional()
      .describe('Mobile feature tags to filter by (e.g., auth, payments, offline)'),
    platform: z
      .enum(['mobile', 'web', 'backend', 'shared'])
      .optional()
      .describe('Content platform filter'),
    framework: z.string().optional().describe('Framework name (e.g., flutter, react-native)'),
    top_k: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10)
      .describe('Number of results to return (default: 10)'),
  })
  .strict();

dynamicRegistry.registerTool(
  'search_mobile_docs',
  {
    description:
      'Search mobile documentation with feature-aware filtering. Returns docs filtered by platform, feature tags, and framework.',
    inputSchema: toInputShape(searchMobileDocsInput),
    toolpack: TOOL_METADATA.search_mobile_docs.toolpack,
    category: TOOL_METADATA.search_mobile_docs.category,
    sensitive: TOOL_METADATA.search_mobile_docs.sensitive,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
    dynamicRegistry.recordCall('search_mobile_docs');
    const { collectionId, query, featureTags, platform, framework, top_k } =
      searchMobileDocsInput.parse(input);
    try {
      const result = await apiClient.post('/api/search', {
        query,
        collection_id: collectionId,
        top_k,
        feature_tags: featureTags,
        platform,
        tech_stack: framework ? [framework] : undefined,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Tool 12: find_code_examples
 * Find code examples biased toward example/demo content
 */
const findCodeExamplesInput = z
  .object({
    collectionId: z.string().uuid().describe('The ID of the collection to search'),
    query: z.string().min(1).describe('Search query for code examples'),
    featureTags: z.array(z.string()).optional().describe('Mobile feature tags to filter examples'),
    framework: z.string().optional().describe('Framework name (e.g., flutter, supabase)'),
    top_k: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(5)
      .describe('Number of examples to return (default: 5)'),
  })
  .strict();

dynamicRegistry.registerTool(
  'find_code_examples',
  {
    description:
      'Find code examples and sample implementations. Returns results biased toward example code, demos, and sample projects.',
    inputSchema: toInputShape(findCodeExamplesInput),
    toolpack: TOOL_METADATA.find_code_examples.toolpack,
    category: TOOL_METADATA.find_code_examples.category,
    sensitive: TOOL_METADATA.find_code_examples.sensitive,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
    dynamicRegistry.recordCall('find_code_examples');
    const { collectionId, query, featureTags, framework, top_k } =
      findCodeExamplesInput.parse(input);
    try {
      const result = await apiClient.post('/api/search', {
        query,
        collection_id: collectionId,
        top_k,
        feature_tags: featureTags,
        usage_tier: 'example',
        tech_stack: framework ? [framework] : undefined,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Tool 13: get_feature_recipe
 * Retrieve curated recipe documentation for mobile features
 */
const getFeatureRecipeInput = z
  .object({
    collectionId: z.string().uuid().describe('The ID of the collection to search'),
    featureTags: z
      .array(z.string())
      .min(1)
      .describe('Required: Mobile feature tags to find recipes for (e.g., ["auth", "supabase"])'),
    framework: z.string().optional().describe('Framework name (e.g., flutter)'),
    top_k: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(5)
      .describe('Number of recipes to return (default: 5)'),
  })
  .strict();

dynamicRegistry.registerTool(
  'get_feature_recipe',
  {
    description:
      'Get curated recipe documentation for mobile features. Returns opinionated guides and patterns for implementing specific features.',
    inputSchema: toInputShape(getFeatureRecipeInput),
    toolpack: TOOL_METADATA.get_feature_recipe.toolpack,
    category: TOOL_METADATA.get_feature_recipe.category,
    sensitive: TOOL_METADATA.get_feature_recipe.sensitive,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
    dynamicRegistry.recordCall('get_feature_recipe');
    const { collectionId, featureTags, framework, top_k } = getFeatureRecipeInput.parse(input);
    try {
      const result = await apiClient.post('/api/search', {
        query: featureTags.join(' ') + ' implementation guide',
        collection_id: collectionId,
        top_k,
        feature_tags: featureTags,
        usage_tier: 'recipe',
        tech_stack: framework ? [framework] : undefined,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// =============================================================================
// GPT Phase 2: Knowledge Graph Context Expansion Tools
// =============================================================================

/**
 * Tool 14: graph_expand_context
 * Expand context from seed nodes using BFS traversal of the knowledge graph
 */
// Base schema (without refine) for MCP input schema registration
const graphExpandContextInputBase = z.object({
  collectionId: z.string().uuid().describe('The ID of the collection to search'),
  seedChunkIds: z
    .array(z.number().int())
    .optional()
    .describe('Chunk IDs to use as starting points for graph traversal'),
  seedNodeIds: z
    .array(z.string().uuid())
    .optional()
    .describe('Node IDs to use as starting points for graph traversal'),
  query: z.string().min(1).optional().describe('Query to find seed nodes via semantic search'),
  maxDepth: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(3)
    .describe('Maximum traversal depth (default: 3)'),
  maxNodes: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .describe('Maximum nodes to return (default: 50)'),
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
    .describe('Filter traversal by edge types'),
  nodeTypes: z
    .array(z.enum(['document', 'chunk', 'symbol', 'endpoint', 'table', 'column', 'config_section']))
    .optional()
    .describe('Filter results by node types'),
});

// Full validation schema with refine for runtime checks
const graphExpandContextInput = graphExpandContextInputBase
  .strict()
  .refine(
    (data) =>
      (data.seedChunkIds?.length ?? 0) > 0 ||
      (data.seedNodeIds?.length ?? 0) > 0 ||
      Boolean(data.query),
    {
      message: 'At least one seed type required (seedChunkIds, seedNodeIds, or query)',
      path: ['seedChunkIds'],
    }
  );

dynamicRegistry.registerTool(
  'graph_expand_context',
  {
    description:
      'Expand context from seed nodes using BFS traversal of the knowledge graph. Returns connected nodes, edges, and associated chunks for end-to-end context retrieval.',
    inputSchema: toInputShape(graphExpandContextInputBase),
    toolpack: TOOL_METADATA.graph_expand_context.toolpack,
    category: TOOL_METADATA.graph_expand_context.category,
    sensitive: TOOL_METADATA.graph_expand_context.sensitive,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
    dynamicRegistry.recordCall('graph_expand_context');
    const validated = graphExpandContextInput.parse(input);
    try {
      const result = await apiClient.post('/api/graph/context', {
        collection_id: validated.collectionId,
        seed_chunk_ids: validated.seedChunkIds,
        seed_node_ids: validated.seedNodeIds,
        query: validated.query,
        max_depth: validated.maxDepth,
        max_nodes: validated.maxNodes,
        edge_types: validated.edgeTypes,
        node_types: validated.nodeTypes,
      });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// =============================================================================
// GPT Phase 3: Symbol Search, Tech Stack, and DB Schema Tools
// =============================================================================

/**
 * Tool 15: find_symbol_usages
 * Search for symbol definitions and usages across the codebase
 */
const findSymbolUsagesInput = z
  .object({
    collectionId: z.string().uuid().describe('The ID of the collection to search'),
    symbolName: z.string().min(1).describe('Name of the symbol to find'),
    symbolKind: z
      .enum(['function', 'class', 'widget', 'method', 'constant'])
      .optional()
      .describe('Filter by symbol kind'),
    includeDefinitions: z
      .boolean()
      .default(true)
      .describe('Include definition locations (default: true)'),
    includeUsages: z.boolean().default(true).describe('Include usage locations (default: true)'),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe('Maximum results to return (default: 20)'),
  })
  .strict();

dynamicRegistry.registerTool(
  'find_symbol_usages',
  {
    description:
      'Search for symbol definitions and usages across the codebase. Returns where a function, class, or method is defined and where it is called or imported.',
    inputSchema: toInputShape(findSymbolUsagesInput),
    toolpack: TOOL_METADATA.find_symbol_usages.toolpack,
    category: TOOL_METADATA.find_symbol_usages.category,
    sensitive: TOOL_METADATA.find_symbol_usages.sensitive,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
    dynamicRegistry.recordCall('find_symbol_usages');
    const { collectionId, symbolName, symbolKind, includeDefinitions, includeUsages, maxResults } =
      findSymbolUsagesInput.parse(input);
    try {
      const result = await apiClient.post('/api/graph/symbols', {
        collection_id: collectionId,
        symbol_name: symbolName,
        symbol_kind: symbolKind,
        include_definitions: includeDefinitions,
        include_usages: includeUsages,
        max_results: maxResults,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Tool 16: get_project_tech_stack
 * Get the technology stack profile for a project collection
 */
const getProjectTechStackInput = z
  .object({
    collectionId: z.string().uuid().describe('The ID of the collection'),
  })
  .strict();

dynamicRegistry.registerTool(
  'get_project_tech_stack',
  {
    description:
      'Get the technology stack profile for a project collection. Returns detected frameworks, languages, databases, and libraries.',
    inputSchema: toInputShape(getProjectTechStackInput),
    toolpack: TOOL_METADATA.get_project_tech_stack.toolpack,
    category: TOOL_METADATA.get_project_tech_stack.category,
    sensitive: TOOL_METADATA.get_project_tech_stack.sensitive,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
    dynamicRegistry.recordCall('get_project_tech_stack');
    const { collectionId } = getProjectTechStackInput.parse(input);
    try {
      const result = await apiClient.get(`/api/tech-profiles/${collectionId}`);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

/**
 * Tool 17: get_db_schema
 * Extract database schema from the codebase
 */
const getDbSchemaInput = z
  .object({
    collectionId: z.string().uuid().describe('The ID of the collection'),
    tables: z.array(z.string()).optional().describe('Filter to specific table names'),
    includeRelationships: z
      .boolean()
      .default(true)
      .describe('Include table relationships (default: true)'),
  })
  .strict();

dynamicRegistry.registerTool(
  'get_db_schema',
  {
    description:
      'Extract database schema from the codebase. Returns tables, columns, data types, and relationships found in SQL migrations or ORM code.',
    inputSchema: toInputShape(getDbSchemaInput),
    toolpack: TOOL_METADATA.get_db_schema.toolpack,
    category: TOOL_METADATA.get_db_schema.category,
    sensitive: TOOL_METADATA.get_db_schema.sensitive,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
    dynamicRegistry.recordCall('get_db_schema');
    const { collectionId, tables, includeRelationships } = getDbSchemaInput.parse(input);
    try {
      const queryParams = new URLSearchParams();
      if (tables && tables.length > 0) {
        queryParams.set('tables', tables.join(','));
      }
      if (includeRelationships !== undefined) {
        queryParams.set('include_relationships', String(includeRelationships));
      }

      const queryString = queryParams.toString();
      const url = `/api/graph/schema/${collectionId}${queryString ? `?${queryString}` : ''}`;
      const result = await apiClient.get(url);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// =============================================================================
// Gateway Tools (Phase 5.6.2)
// =============================================================================
// Gateway tools are always-on tools for dynamic tool management.
// They cannot be disabled and are used to discover, enable, and route tool calls.

/**
 * Gateway Tool 1: synthesis_discover_tools
 * Discover available tools and toolpacks based on task or list all.
 */
dynamicRegistry.registerTool(
  'synthesis_discover_tools',
  {
    description: GATEWAY_TOOL_DESCRIPTIONS.synthesis_discover_tools,
    inputSchema: toInputShape(discoverToolsInputSchema),
    toolpack: TOOL_METADATA.synthesis_discover_tools.toolpack,
    category: TOOL_METADATA.synthesis_discover_tools.category,
    sensitive: TOOL_METADATA.synthesis_discover_tools.sensitive,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
    dynamicRegistry.recordCall('synthesis_discover_tools');
    const validated = discoverToolsInputSchema.parse(input);
    const result = buildDiscoverResult(validated, dynamicRegistry);
    return toToolResult(result);
  }
);

/**
 * Gateway Tool 2: enable_tools
 * Enable tools by name, toolpack, or category.
 */
dynamicRegistry.registerTool(
  'enable_tools',
  {
    description: GATEWAY_TOOL_DESCRIPTIONS.enable_tools,
    // Use base schema without refine for MCP SDK registration
    inputSchema: toInputShape(enableToolsInputSchemaBase),
    toolpack: TOOL_METADATA.enable_tools.toolpack,
    category: TOOL_METADATA.enable_tools.category,
    sensitive: TOOL_METADATA.enable_tools.sensitive,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
    dynamicRegistry.recordCall('enable_tools');
    // Use full schema with refine for runtime validation
    const validated = enableToolsInputSchema.parse(input);
    const result = enableTools(validated, dynamicRegistry);
    return toToolResult(result);
  }
);

/**
 * Gateway Tool 3: synthesis_router
 * Execute any tool with auto-enable support.
 */
dynamicRegistry.registerTool(
  'synthesis_router',
  {
    description: GATEWAY_TOOL_DESCRIPTIONS.synthesis_router,
    inputSchema: toInputShape(routerInputSchema),
    toolpack: TOOL_METADATA.synthesis_router.toolpack,
    category: TOOL_METADATA.synthesis_router.category,
    sensitive: TOOL_METADATA.synthesis_router.sensitive,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
    dynamicRegistry.recordCall('synthesis_router');
    const validated = routerInputSchema.parse(input);
    const result = await executeViaRouter(validated, dynamicRegistry);
    return toToolResult(result);
  }
);

/**
 * Gateway Tool 4: synthesis_mcp_bridge
 * Direct MCP call bypassing local state.
 */
dynamicRegistry.registerTool(
  'synthesis_mcp_bridge',
  {
    description: GATEWAY_TOOL_DESCRIPTIONS.synthesis_mcp_bridge,
    inputSchema: toInputShape(bridgeInputSchema),
    toolpack: TOOL_METADATA.synthesis_mcp_bridge.toolpack,
    category: TOOL_METADATA.synthesis_mcp_bridge.category,
    sensitive: TOOL_METADATA.synthesis_mcp_bridge.sensitive,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
    dynamicRegistry.recordCall('synthesis_mcp_bridge');
    const validated = bridgeInputSchema.parse(input);
    const result = await executeMcpBridge(validated, dynamicRegistry);
    return toToolResult(result);
  }
);

/**
 * Gateway Tool 5: synthesis_search
 * Always-on search fallback.
 */
dynamicRegistry.registerTool(
  'synthesis_search',
  {
    description: GATEWAY_TOOL_DESCRIPTIONS.synthesis_search,
    inputSchema: toInputShape(searchInputSchema),
    toolpack: TOOL_METADATA.synthesis_search.toolpack,
    category: TOOL_METADATA.synthesis_search.category,
    sensitive: TOOL_METADATA.synthesis_search.sensitive,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
    dynamicRegistry.recordCall('synthesis_search');
    const validated = searchInputSchema.parse(input);
    const result = await executeSearch(validated, apiClient);
    return toToolResult(result);
  }
);

// =============================================================================
// Tool Registration Complete (Phase 5.6.3)
// =============================================================================
// All 22 tools are now registered via dynamicRegistry.registerTool() above:
// - 17 original tools (Phase 3.5.3)
// - 5 gateway tools (Phase 5.6.2-5.6.3): synthesis_discover_tools, enable_tools,
//   synthesis_router, synthesis_mcp_bridge, synthesis_search
//
// Each tool registration includes:
// - MCP SDK handle capture for enable/disable operations
// - Toolpack and category metadata from TOOL_METADATA
// - Sensitive flag for gated access
// - Call recording for usage analytics
// - Handler storage for router/bridge execution
//
// The old toolRegistry.register() loop has been replaced by the unified
// dynamicRegistry which manages both MCP SDK registration and metadata.

/**
 * Main function to start the MCP server with either stdio or HTTP transport
 */
async function main() {
  try {
    // Apply profile-based tool filtering BEFORE connecting (Phase 5.6.1)
    // This ensures clients receive the correct initial tool list
    dynamicRegistry.applyProfile(config.profile);

    if (MCP_MODE === 'stdio') {
      // Start stdio transport for IDE agents (e.g., Cursor, VSCode)
      const stdioTransport = new StdioServerTransport();
      await server.connect(stdioTransport);

      const snapshot = dynamicRegistry.getSnapshot();
      console.error('🚀 Synthesis MCP Server v2.0.0 started successfully');
      console.error('   Mode: stdio');
      console.error(`   Profile: ${config.profile}`);
      console.error(`   Backend API: ${process.env.BACKEND_API_URL || 'http://localhost:3333'}`);
      console.error(
        `   Tools: ${snapshot.enabledCount}/${snapshot.totalCount} enabled (${dynamicRegistry.getSensitiveToolCount()} sensitive)`
      );
      console.error('   Capabilities: listChanged=true');
      console.error('');
    } else if (MCP_MODE === 'http') {
      // Start HTTP/SSE transport for Claude Desktop and web clients
      const httpTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      await server.connect(httpTransport);

      // Initialize rate limiter
      const rateLimiter = getRateLimiter();

      // Create HTTP server to handle requests
      const httpServer = http.createServer(async (req, res) => {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');

        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        // Check rate limit first, then add headers with accurate post-check values
        if (!rateLimiter.isAllowed(req)) {
          // Calculate actual retry time based on refill rate (time for 1 token)
          const retryAfter = Math.ceil(60 / rateLimiter.getStats().config.refillRate);
          const rateLimitHeaders = rateLimiter.getHeaders(req);

          res.writeHead(429, {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
            ...rateLimitHeaders,
          });
          res.end(
            JSON.stringify({
              error: 'Too Many Requests',
              message: 'Rate limit exceeded. Please try again later.',
              retryAfter,
            })
          );
          return;
        }

        // Add rate limit headers after successful check (accurate remaining count)
        const rateLimitHeaders = rateLimiter.getHeaders(req);
        for (const [key, value] of Object.entries(rateLimitHeaders)) {
          res.setHeader(key, value);
        }

        // Handle MCP requests
        if (req.method === 'POST' || req.method === 'GET' || req.method === 'DELETE') {
          try {
            let body = '';
            for await (const chunk of req) {
              body += chunk;
            }

            const parsedBody = body ? JSON.parse(body) : undefined;
            await httpTransport.handleRequest(req, res, parsedBody);
          } catch (error) {
            console.error('Error handling HTTP request:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error',
              })
            );
          }
        } else {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
      });

      httpServer.listen(MCP_PORT, () => {
        const stats = rateLimiter.getStats();
        const snapshot = dynamicRegistry.getSnapshot();
        console.error('🚀 Synthesis MCP Server v2.0.0 started successfully');
        console.error('   Mode: HTTP/SSE');
        console.error(`   Profile: ${config.profile}`);
        console.error(`   Port: ${MCP_PORT}`);
        console.error(`   URL: http://localhost:${MCP_PORT}`);
        console.error(`   Backend API: ${process.env.BACKEND_API_URL || 'http://localhost:3333'}`);
        console.error(
          `   Tools: ${snapshot.enabledCount}/${snapshot.totalCount} enabled (${dynamicRegistry.getSensitiveToolCount()} sensitive)`
        );
        console.error('   Capabilities: listChanged=true');
        console.error(
          `   Rate Limit: ${stats.config.refillRate}/min, burst ${stats.config.burstCapacity}`
        );
        console.error('');
      });

      // Handle server errors
      httpServer.on('error', (error) => {
        console.error('HTTP server error:', error);
        process.exit(1);
      });
    } else {
      console.error(`Invalid MCP_MODE: ${MCP_MODE}. Use 'stdio' or 'http'`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error('\nShutting down MCP server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('\nShutting down MCP server...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
