# MCP Server Implementation
**Version:** 1.0  
**Last Updated:** October 6, 2025

---

## 🎯 Purpose

Expose RAG capabilities to external AI agents via Model Context Protocol (MCP).

**Two modes:**
1. **stdio** - For IDE agents (Cursor, Windsurf) in WSL
2. **SSE** - For Claude Desktop on Windows

---

## 🏗️ Architecture

```
External Agent (Cursor/Claude Desktop)
  ↓
MCP Server (stdio or SSE)
  ↓
Synthesis Backend API
  ↓
Database + Ollama
```

---

## 📦 Project Structure

```
apps/mcp/
├── src/
│   ├── server.ts          # Main MCP server
│   ├── tools/
│   │   ├── search.ts      # search_docs tool
│   │   └── list.ts        # list_collections tool
│   ├── stdio.ts           # stdio transport
│   ├── sse.ts             # SSE transport
│   └── client.ts          # Backend API client
├── package.json
└── tsconfig.json
```

---

## 🛠️ Tools Exposed

### 1. search_docs

Search documentation across collections

```typescript
{
  name: "search_docs",
  description: "Search the Synthesis RAG documentation system",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query"
      },
      collection_id: {
        type: "string",
        description: "Optional: UUID of collection to search. If not provided, searches all collections."
      },
      top_k: {
        type: "number",
        description: "Number of results to return",
        default: 5
      }
    },
    required: ["query"]
  }
}
```

### 2. list_collections

List available documentation collections

```typescript
{
  name: "list_collections",
  description: "List all available documentation collections in Synthesis RAG",
  inputSchema: {
    type: "object",
    properties: {}
  }
}
```

---

## 💻 Implementation

### Main Server

**File:** `apps/mcp/src/server.ts`

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { searchDocs } from './tools/search.js';
import { listCollections } from './tools/list.js';

const server = new Server(
  {
    name: 'synthesis-rag',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search_docs',
      description: 'Search the Synthesis RAG documentation system',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query',
          },
          collection_id: {
            type: 'string',
            description: 'Optional: UUID of collection to search',
          },
          top_k: {
            type: 'number',
            description: 'Number of results to return',
            default: 5,
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'list_collections',
      description: 'List all available documentation collections',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_docs':
        const results = await searchDocs(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };

      case 'list_collections':
        const collections = await listCollections();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(collections, null, 2),
            },
          ],
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

export default server;
```

---

### stdio Mode (WSL/IDE)

**File:** `apps/mcp/src/stdio.ts`

```typescript
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import server from './server.js';

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('Synthesis MCP Server running on stdio');
}

main().catch(console.error);
```

**Usage in IDE (Cursor config):**
```json
{
  "mcpServers": {
    "synthesis": {
      "command": "node",
      "args": ["/home/kngpnn/dev/synthesis/apps/mcp/dist/stdio.js"]
    }
  }
}
```

---

### SSE Mode (Windows/Claude Desktop)

**File:** `apps/mcp/src/sse.ts`

```typescript
import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import server from './server.js';

const app = express();
const PORT = process.env.MCP_PORT || 3334;

app.get('/sse', async (req, res) => {
  const transport = new SSEServerTransport('/messages', res);
  await server.connect(transport);
});

app.listen(PORT, () => {
  console.log(`Synthesis MCP Server (SSE) listening on port ${PORT}`);
  console.log(`Endpoint: http://localhost:${PORT}/sse`);
});
```

**Usage in Claude Desktop (Windows):**
```json
{
  "mcpServers": {
    "synthesis": {
      "url": "http://localhost:3334/sse"
    }
  }
}
```

---

### Tool: search_docs

**File:** `apps/mcp/src/tools/search.ts`

```typescript
import { backendClient } from '../client.js';

export async function searchDocs(args: any) {
  const { query, collection_id, top_k = 5 } = args;

  const response = await backendClient.post('/api/search', {
    query,
    collection_id,
    top_k,
  });

  const { results } = response.data;

  // Format for agent consumption
  return {
    query,
    results: results.map((r: any) => ({
      text: r.text,
      relevance: r.similarity,
      source: {
        document: r.doc_title,
        page: r.citation?.page,
        section: r.citation?.section,
      },
    })),
    total: results.length,
  };
}
```

---

### Tool: list_collections

**File:** `apps/mcp/src/tools/list.ts`

```typescript
import { backendClient } from '../client.js';

export async function listCollections() {
  const response = await backendClient.get('/api/collections');
  
  const { collections } = response.data;

  return {
    collections: collections.map((c: any) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      document_count: c.doc_count,
    })),
    total: collections.length,
  };
}
```

---

### Backend API Client

**File:** `apps/mcp/src/client.ts`

```typescript
import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3333';

export const backendClient = axios.create({
  baseURL: BACKEND_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Error handling
backendClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Backend API error:', error.message);
    throw new Error(
      error.response?.data?.error || 'Backend API request failed'
    );
  }
);
```

---

## 📦 Package Configuration

**File:** `apps/mcp/package.json`

```json
{
  "name": "@synthesis/mcp",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/stdio.ts",
    "dev:sse": "tsx watch src/sse.ts",
    "build": "tsup src/stdio.ts src/sse.ts --format esm",
    "start": "node dist/stdio.js",
    "start:sse": "node dist/sse.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "axios": "^1.7.7",
    "express": "^4.19.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "tsx": "^4.19.1",
    "tsup": "^8.3.0",
    "typescript": "^5.6.2"
  }
}
```

---

## 🔧 Configuration

### Environment Variables

```bash
# Backend connection
BACKEND_URL=http://localhost:3333

# SSE server port
MCP_PORT=3334

# Mode (stdio or sse)
MCP_MODE=stdio
```

---

## 🧪 Testing

### Test from Command Line

**stdio mode:**
```bash
# Send JSON-RPC request
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node apps/mcp/dist/stdio.js

# Expected output
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [...]
  }
}
```

**SSE mode:**
```bash
# Start SSE server
pnpm --filter @synthesis/mcp start:sse

# Test with curl
curl http://localhost:3334/sse
```

---

### Test from IDE (Cursor)

1. Add to Cursor settings:
```json
{
  "mcpServers": {
    "synthesis": {
      "command": "node",
      "args": ["/home/kngpnn/dev/synthesis/apps/mcp/dist/stdio.js"]
    }
  }
}
```

2. In Cursor, ask:
```
@synthesis search_docs("flutter state management")
```

3. Verify results appear

---

### Test from Claude Desktop (Windows)

1. Add to `%APPDATA%\Claude\claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "synthesis": {
      "url": "http://localhost:3334/sse"
    }
  }
}
```

2. Restart Claude Desktop

3. In Claude, ask:
```
Search my Synthesis docs for "authentication"
```

4. Verify tool is called and results returned

---

## 🐳 Docker Setup

**Dockerfile:** `apps/mcp/Dockerfile`

```dockerfile
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY apps/mcp/package.json ./apps/mcp/

# Install dependencies
RUN npm install -g pnpm@9.12.2
RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/mcp ./apps/mcp

# Build
RUN pnpm --filter @synthesis/mcp build

# Run
CMD ["pnpm", "--filter", "@synthesis/mcp", "start:sse"]
```

**docker-compose.yml:**
```yaml
mcp:
  container_name: synthesis-mcp
  build:
    context: .
    dockerfile: apps/mcp/Dockerfile
  ports:
    - "3334:3334"
  environment:
    - BACKEND_URL=http://server:3333
    - MCP_PORT=3334
  depends_on:
    - server
```

---

## 📊 Usage Examples

### Example 1: Search Across All Collections

**Request:**
```json
{
  "query": "How to set up authentication in Supabase?"
}
```

**Response:**
```json
{
  "query": "How to set up authentication in Supabase?",
  "results": [
    {
      "text": "Supabase provides built-in authentication...",
      "relevance": 0.87,
      "source": {
        "document": "Supabase Auth Guide",
        "page": 12,
        "section": "Getting Started"
      }
    }
  ],
  "total": 5
}
```

### Example 2: Search Specific Collection

**Request:**
```json
{
  "query": "widget lifecycle",
  "collection_id": "flutter-collection-uuid",
  "top_k": 3
}
```

**Response:**
```json
{
  "query": "widget lifecycle",
  "results": [
    {
      "text": "Flutter widget lifecycle consists of...",
      "relevance": 0.92,
      "source": {
        "document": "Flutter Widget Guide",
        "page": 45
      }
    }
  ],
  "total": 3
}
```

---

## ✅ Implementation Checklist

For agents building this:

- [ ] Install MCP SDK
- [ ] Create server with tool registration
- [ ] Implement search_docs tool
- [ ] Implement list_collections tool
- [ ] Create stdio transport
- [ ] Create SSE transport
- [ ] Create backend API client
- [ ] Add error handling
- [ ] Write tests
- [ ] Test from Cursor (stdio)
- [ ] Test from Claude Desktop (SSE)
- [ ] Document configuration
- [ ] Create Dockerfile

---

**This MCP server makes your RAG accessible to all AI agents!**
