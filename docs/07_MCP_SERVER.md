# MCP Server Implementation
**Version:** 1.1
**Last Updated:** October 9, 2025

---

## 🎯 Purpose

Expose the full capabilities of the Synthesis RAG system to external AI agents via the Model-Context-Protocol (MCP). This server acts as a bridge between any MCP-compatible agent and the backend API.

---

## 🏗️ Architecture

The MCP server is a lightweight wrapper that translates agent tool calls into standard HTTP requests to the main backend server. It does not contain any core business logic itself.

```text
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
- **`search_rag({ collectionId: string, query: string, top_k?: number = 5, min_similarity?: number = 0.5 })`**: Searches for information within a specific collection (collectionId must be a UUID).
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
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import dotenv from 'dotenv';
import { z } from 'zod';
import { zodToJsonSchema, type JsonSchema7Type } from 'zod-to-json-schema';
import { apiClient } from './api.js';

dotenv.config();

const MCP_PORT = Number.parseInt(process.env.MCP_PORT || '3334', 10);
const MCP_MODE = process.env.MCP_MODE || 'stdio';

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
    jsonSchema.definitions
  ) {
    const key = jsonSchema.$ref.slice('#/definitions/'.length);
    const definition = (jsonSchema.definitions as Record<string, JsonSchema7Type>)[key];
    if (definition) {
      return definition;
    }
  }

  return jsonSchema as JsonSchema7Type;
}

const searchRagInput = z
  .object({
    collectionId: z.string().uuid(),
    query: z.string().min(1),
    top_k: z.number().int().min(1).max(50).default(5),
    min_similarity: z.number().min(0).max(1).default(0.5),
  })
  .strict();

const searchRagInputSchema = toJsonSchema(searchRagInput, 'SearchRagInput');

server.registerTool(
  'search_rag',
  {
    description:
      'Search the RAG knowledge base for relevant information and return matching chunks with citations.',
    inputSchema: searchRagInput.shape,
    _meta: {
      jsonSchema: searchRagInputSchema,
    },
  },
  async (rawInput) => {
    const { collectionId, query, top_k, min_similarity } = searchRagInput.parse(rawInput);
    const result = await apiClient.post('/api/search', {
      collectionId,
      query,
      top_k,
      min_similarity,
    });

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

// ...

async function main() {
  if (MCP_MODE === 'stdio') {
    const stdioTransport = new StdioServerTransport();
    await server.connect(stdioTransport);
    console.error('🚀 Synthesis MCP Server started (stdio mode)');
    return;
  }

  if (MCP_MODE === 'http') {
    const httpTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });
    await server.connect(httpTransport);

    const httpServer = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      let body = '';
      for await (const chunk of req) {
        body += chunk;
      }

      const parsedBody = body ? JSON.parse(body) : undefined;
      await httpTransport.handleRequest(req, res, parsedBody);
    });

    httpServer.listen(MCP_PORT, () => {
      console.error(`🚀 Synthesis MCP Server started (HTTP/SSE mode on port ${MCP_PORT})`);
    });
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

Each tool keeps its runtime Zod validator and the generated JSON Schema aligned by adding a `_meta.jsonSchema` payload, which is useful for documentation and external validation while the SDK still performs server-side parsing.

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
