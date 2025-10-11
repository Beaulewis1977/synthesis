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
import { type JsonSchema7Type, zodToJsonSchema } from 'zod-to-json-schema';

import { apiClient } from './api.js';

// Load environment variables
dotenv.config();

const MCP_PORT = Number.parseInt(process.env.MCP_PORT || '3334', 10);
const MCP_MODE = process.env.MCP_MODE || 'stdio'; // 'stdio' or 'http'

// Initialize MCP Server
const server = new McpServer({
  name: 'synthesis-rag',
  version: '1.0.0',
});

function toJsonSchema<T extends z.ZodTypeAny>(schema: T, name: string): JsonSchema7Type {
  const jsonSchema = zodToJsonSchema(schema, { target: 'jsonSchema7', name });

  if (
    jsonSchema &&
    typeof jsonSchema === 'object' &&
    '$ref' in jsonSchema &&
    typeof jsonSchema.$ref === 'string' &&
    jsonSchema.$ref.startsWith('#/definitions/') &&
    'definitions' in jsonSchema &&
    jsonSchema.definitions &&
    typeof jsonSchema.definitions === 'object'
  ) {
    const definitionKey = jsonSchema.$ref.slice('#/definitions/'.length);
    const definitions = jsonSchema.definitions as Record<string, JsonSchema7Type>;
    const definition = definitions[definitionKey];

    if (definition) {
      return definition;
    }
  }

  return jsonSchema as JsonSchema7Type;
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

const searchRagInputSchema = toJsonSchema(searchRagInput, 'SearchRagInput');

server.registerTool(
  'search_rag',
  {
    description:
      'Search the RAG knowledge base for relevant information and return matching chunks with citations.',
    // biome-ignore lint/suspicious/noExplicitAny: MCP SDK type mismatch requires any for JSON Schema
    inputSchema: searchRagInputSchema as any,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
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
server.registerTool(
  'list_collections',
  {
    description: 'List all available document collections.',
  },
  async () => {
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

const listDocumentsInputSchema = toJsonSchema(listDocumentsInput, 'ListDocumentsInput');

server.registerTool(
  'list_documents',
  {
    description: 'List all documents in a specific collection.',
    // biome-ignore lint/suspicious/noExplicitAny: MCP SDK type mismatch requires any for JSON Schema
    inputSchema: listDocumentsInputSchema as any,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
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

const createCollectionInputSchema = toJsonSchema(createCollectionInput, 'CreateCollectionInput');

server.registerTool(
  'create_collection',
  {
    description: 'Create a new document collection.',
    // biome-ignore lint/suspicious/noExplicitAny: MCP SDK type mismatch requires any for JSON Schema
    inputSchema: createCollectionInputSchema as any,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
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

const fetchDocumentInputSchema = toJsonSchema(fetchDocumentInput, 'FetchDocumentInput');

server.registerTool(
  'fetch_and_add_document_from_url',
  {
    description: 'Fetch content from a public URL and ingest it as a new document.',
    // biome-ignore lint/suspicious/noExplicitAny: MCP SDK type mismatch requires any for JSON Schema
    inputSchema: fetchDocumentInputSchema as any,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
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

const deleteDocumentInputSchema = toJsonSchema(deleteDocumentInput, 'DeleteDocumentInput');

server.registerTool(
  'delete_document',
  {
    description: 'Delete a document and all associated chunks.',
    // biome-ignore lint/suspicious/noExplicitAny: MCP SDK type mismatch requires any for JSON Schema
    inputSchema: deleteDocumentInputSchema as any,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
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

const deleteCollectionInputSchema = toJsonSchema(deleteCollectionInput, 'DeleteCollectionInput');

server.registerTool(
  'delete_collection',
  {
    description: 'Delete an entire collection and all its documents. Use with caution.',
    // biome-ignore lint/suspicious/noExplicitAny: MCP SDK type mismatch requires any for JSON Schema
    inputSchema: deleteCollectionInputSchema as any,
  },
  // biome-ignore lint/suspicious/noExplicitAny: MCP SDK provides untyped input, validated by Zod
  async (input: any) => {
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
 * Main function to start the MCP server with either stdio or HTTP transport
 */
async function main() {
  try {
    if (MCP_MODE === 'stdio') {
      // Start stdio transport for IDE agents (e.g., Cursor, VSCode)
      const stdioTransport = new StdioServerTransport();
      await server.connect(stdioTransport);

      console.error('🚀 Synthesis MCP Server started successfully');
      console.error('   Mode: stdio');
      console.error(`   Backend API: ${process.env.BACKEND_API_URL || 'http://localhost:3333'}`);
      console.error('   Tools: 7 available');
      console.error('');
    } else if (MCP_MODE === 'http') {
      // Start HTTP/SSE transport for Claude Desktop and web clients
      const httpTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      await server.connect(httpTransport);

      // Create HTTP server to handle requests
      const httpServer = http.createServer(async (req, res) => {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
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
        console.error('🚀 Synthesis MCP Server started successfully');
        console.error('   Mode: HTTP/SSE');
        console.error(`   Port: ${MCP_PORT}`);
        console.error(`   URL: http://localhost:${MCP_PORT}`);
        console.error(`   Backend API: ${process.env.BACKEND_API_URL || 'http://localhost:3333'}`);
        console.error('   Tools: 7 available');
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
