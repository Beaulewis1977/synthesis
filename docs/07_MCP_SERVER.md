# MCP Server Implementation
**Version:** 1.1
**Last Updated:** October 9, 2025

---

## 🎯 Purpose

Expose the full capabilities of the Synthesis RAG system to external AI agents via the Model-Context-Protocol (MCP). This server acts as a bridge between any MCP-compatible agent and the backend API.

---

## 🏗️ Architecture

The MCP server is a lightweight wrapper that translates agent tool calls into standard HTTP requests to the main backend server. It does not contain any core business logic itself.

```mermaid
External Agent (e.g., IDE Agent)
           ↓
MCP Server (stdio or SSE transport)
           ↓
Synthesis Backend API (e.g., <http://localhost:3333>)
           ↓
Core Services (Database, Ollama, etc.)
```

---

## 🛠️ Tools Exposed

The server exposes a comprehensive set of tools for reading, searching, and managing RAG collections and documents.

### Search & Read Tools
- **`search_rag(query: string, collection_id: string, top_k?: number)`**: Searches for information within a specific collection.
- **`list_collections()`**: Lists all available document collections.
- **`list_documents(collection_id: string)`**: Lists all documents within a given collection.

### Management Tools
- **`create_collection(name: string, description: string)`**: Creates a new, empty collection.
- **`fetch_and_add_document_from_url(url: string, collection_id: string)`**: Fetches content from a public URL and ingests it as a new document.
- **`delete_document(doc_id: string, confirm: boolean)`**: Deletes a document and its associated data. Requires confirmation flag.
- **`delete_collection(collection_id: string, confirm: boolean)`**: Deletes an entire collection. Requires confirmation flag. Use with caution.

---

## 💻 Implementation (`@modelcontextprotocol/sdk`)

The implementation uses the official `@modelcontextprotocol/sdk` library, which provides the `McpServer` class for defining tools and managing transport layers.

### Main Server (`apps/mcp/src/index.ts`)

The main file registers tools with the `McpServer` instance and configures either stdio or HTTP transport based on the `MCP_MODE` environment variable.

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import dotenv from 'dotenv';
import http from 'node:http';
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

// Register tools using server.registerTool()
// Define Zod schema for runtime validation with descriptive metadata
const searchRagSchema = z.object({
  collection_id: z.string().uuid().describe('The ID of the collection to search'),
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
});

server.registerTool(
  'search_rag',
  {
    description: 'Search the RAG knowledge base for relevant information and return matching chunks with citations.',
    inputSchema: searchRagSchema.shape,
  },
  async ({ collection_id, query, top_k, min_similarity }) => {
    const result = await apiClient.post('/api/search', {
      collection_id,
      query,
      top_k,
      min_similarity,
    });
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ... other tool registrations ...

// Start transport based on MCP_MODE
async function main() {
  if (MCP_MODE === 'stdio') {
    // Start stdio transport for IDE agents (e.g., Cursor, VSCode)
    const stdioTransport = new StdioServerTransport();
    await server.connect(stdioTransport);
    console.error('🚀 Synthesis MCP Server started (stdio mode)');
  } else if (MCP_MODE === 'http') {
    // Start HTTP/SSE transport for Claude Desktop and web clients
    const httpTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });
    await server.connect(httpTransport);

    // Create HTTP server to handle requests
    const httpServer = http.createServer(async (req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Parse body and delegate to transport
      let body = '';
      for await (const chunk of req) body += chunk;
      const parsedBody = body ? JSON.parse(body) : undefined;
      await httpTransport.handleRequest(req, res, parsedBody);
    });

    httpServer.listen(MCP_PORT, () => {
      console.error(`🚀 Synthesis MCP Server started (HTTP/SSE mode on port ${MCP_PORT})`);
    });
  }
}

main();

```

**Key Points:**

- The server uses `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`
- Tools are registered with `server.registerTool(name, config, handler)`
- Transport is selected via the `MCP_MODE` environment variable (`stdio` or `http`)
- For stdio mode, it uses `StdioServerTransport` which connects directly to stdin/stdout (used by IDE agents)
- For HTTP mode, it uses `StreamableHTTPServerTransport` with SSE support and runs on the port specified by `MCP_PORT` (default: 3334)
- The verification script (`scripts/verify-mcp-tools.sh`) expects the server to be built and runnable via `node apps/mcp/dist/index.js` with stdio transport

### Backend API Client (`apps/mcp/src/api.ts`)

This module will centralize communication with the `apps/server` backend.

```typescript
// A simple API client to communicate with the backend server
const BASE_URL = process.env.BACKEND_API_URL || 'http://localhost:3333';

async function request(endpoint: string, options: RequestInit) {
  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request to ${endpoint} failed with status ${response.status}: ${errorText}`);
  }
  return response.json();
}

export const apiClient = {
  post: (endpoint: string, body: unknown) => request(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  get: (endpoint: string) => request(endpoint, { method: 'GET' }),
  delete: (endpoint: string) => request(endpoint, { method: 'DELETE' }),
};
```

---

## 🧪 Testing

### Test from Command Line (stdio)
```bash
echo '{"id": "1", "method": "tools/list"}' | pnpm --filter @synthesis/mcp dev
Output: JSON-RPC response listing available tools
```

### Test from Command Line (HTTP/SSE)
```bash
Start the server
MCP_MODE=http pnpm --filter @synthesis/mcp dev

In another terminal, list tools via JSON-RPC
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  http://localhost:3334

Call a tool via JSON-RPC
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_collections","arguments":{}}}' \
  http://localhost:3334
Each command returns a JSON-RPC response printed to stdout
```
