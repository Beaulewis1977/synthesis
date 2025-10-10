#!/usr/bin/env node

/**
 * Synthesis MCP Server
 *
 * This server implements the Model Context Protocol (MCP) to expose the Synthesis RAG system
 * to external AI agents via both stdio and HTTP transports.
 */

import http from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import dotenv from 'dotenv';
import { z } from 'zod';
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

/**
 * Tool 1: search_rag
 * Searches the RAG knowledge base for relevant information.
 */
// Define Zod schema for runtime validation
const searchRagSchema = z.object({
  collection_id: z.string().uuid(),
  query: z.string().min(1),
  top_k: z.number().int().min(1).max(50).optional(),
  min_similarity: z.number().min(0).max(1).optional(),
});

server.registerTool(
  'search_rag',
  {
    description:
      'Search the RAG knowledge base for relevant information and return matching chunks with citations.',
    inputSchema: {
      type: 'object',
      properties: {
        collection_id: {
          type: 'string',
          format: 'uuid',
          description: 'The ID of the collection to search',
        },
        query: {
          type: 'string',
          minLength: 1,
          description: 'The search query',
        },
        top_k: {
          type: 'number',
          minimum: 1,
          maximum: 50,
          description: 'Number of results to return (default: 5)',
        },
        min_similarity: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Minimum similarity threshold (default: 0.5)',
        },
      },
      required: ['collection_id', 'query'],
    },
  },
  async (input) => {
    // Validate input with Zod
    const { collection_id, query, top_k, min_similarity } = searchRagSchema.parse(input);
    try {
      const result = await apiClient.post('/api/search', {
        collection_id,
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
    inputSchema: {
      type: 'object',
      properties: {},
    },
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
const listDocumentsSchema = z.object({
  collection_id: z.string().uuid(),
});

server.registerTool(
  'list_documents',
  {
    description: 'List all documents in a specific collection.',
    inputSchema: {
      type: 'object',
      properties: {
        collection_id: {
          type: 'string',
          format: 'uuid',
          description: 'The ID of the collection',
        },
      },
      required: ['collection_id'],
    },
  },
  async (input) => {
    const { collection_id } = listDocumentsSchema.parse(input);
    try {
      const result = await apiClient.get(`/api/collections/${collection_id}/documents`);

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
const createCollectionSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

server.registerTool(
  'create_collection',
  {
    description: 'Create a new document collection.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          minLength: 1,
          maxLength: 255,
          description: 'The name of the collection',
        },
        description: {
          type: 'string',
          description: 'Optional description of the collection',
        },
      },
      required: ['name'],
    },
  },
  async (input) => {
    const { name, description } = createCollectionSchema.parse(input);
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
const fetchDocumentSchema = z.object({
  url: z.string().url(),
  collection_id: z.string().uuid(),
  mode: z.enum(['single', 'crawl']).optional(),
  max_pages: z.number().int().min(1).max(200).optional(),
  title_prefix: z.string().optional(),
});

server.registerTool(
  'fetch_and_add_document_from_url',
  {
    description: 'Fetch content from a public URL and ingest it as a new document.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          format: 'uri',
          description: 'The URL to fetch content from',
        },
        collection_id: {
          type: 'string',
          format: 'uuid',
          description: 'The ID of the collection to add the document to',
        },
        mode: {
          type: 'string',
          enum: ['single', 'crawl'],
          description: 'Fetch mode: single page or crawl (default: single)',
        },
        max_pages: {
          type: 'number',
          minimum: 1,
          maximum: 200,
          description: 'Maximum pages to crawl (default: 25)',
        },
        title_prefix: {
          type: 'string',
          description: 'Optional prefix for document titles',
        },
      },
      required: ['url', 'collection_id'],
    },
  },
  async (input) => {
    const { url, collection_id, mode, max_pages, title_prefix } = fetchDocumentSchema.parse(input);
    try {
      const result = await apiClient.post('/api/agent/fetch-web-content', {
        url,
        collection_id,
        mode: mode || 'single',
        max_pages: max_pages || 25,
        title_prefix,
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
const deleteDocumentSchema = z.object({
  doc_id: z.string().uuid(),
  confirm: z.boolean(),
});

server.registerTool(
  'delete_document',
  {
    description: 'Delete a document and all associated chunks.',
    inputSchema: {
      type: 'object',
      properties: {
        doc_id: {
          type: 'string',
          format: 'uuid',
          description: 'The ID of the document to delete',
        },
        confirm: {
          type: 'boolean',
          description: 'Must be set to true to confirm deletion',
        },
      },
      required: ['doc_id', 'confirm'],
    },
  },
  async (input) => {
    const { doc_id, confirm } = deleteDocumentSchema.parse(input);
    try {
      const result = await apiClient.post('/api/agent/delete-document', {
        doc_id,
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
const deleteCollectionSchema = z.object({
  collection_id: z.string().uuid(),
  confirm: z.boolean(),
});

server.registerTool(
  'delete_collection',
  {
    description: 'Delete an entire collection and all its documents. Use with caution.',
    inputSchema: {
      type: 'object',
      properties: {
        collection_id: {
          type: 'string',
          format: 'uuid',
          description: 'The ID of the collection to delete',
        },
        confirm: {
          type: 'boolean',
          description: 'Must be set to true to confirm deletion',
        },
      },
      required: ['collection_id', 'confirm'],
    },
  },
  async (input) => {
    const { collection_id, confirm } = deleteCollectionSchema.parse(input);
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

      const result = await apiClient.delete(`/api/collections/${collection_id}`);

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
        sessionIdGenerator: () => crypto.randomUUID(),
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
