# Environment Variables Reference

This document lists all environment variables used in the Synthesis RAG application.

## Complete Variable List

### Required Variables

| Variable | Description | Default | Used In |
|----------|-------------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection string | *none* | Server (required) |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | *none* | Server (agent features) |

### Server Configuration

| Variable | Description | Default | Used In |
|----------|-------------|---------|---------|
| `SERVER_PORT` | Backend server port | `3333` | Server |
| `HOST` | Server host address | `0.0.0.0` | Server |
| `NODE_ENV` | Environment mode | `development` | Server |
| `LOG_LEVEL` | Pino log level | `info` | Server |

### Storage

| Variable | Description | Default | Used In |
|----------|-------------|---------|---------|
| `STORAGE_PATH` | Document storage directory | `./storage` | Server |

### AI Services

| Variable | Description | Default | Used In |
|----------|-------------|---------|---------|
| `OLLAMA_HOST` | Ollama API endpoint | `http://localhost:11434` | Server (embeddings) |
| `EMBEDDING_MODEL` | Embedding model name | `nomic-embed-text` | Server (embeddings) |

### CORS (Optional)

| Variable | Description | Default | Used In |
|----------|-------------|---------|---------|
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins | *all origins* | Server |

### MCP Server

| Variable | Description | Default | Used In |
|----------|-------------|---------|---------|
| `MCP_PORT` | MCP server port (HTTP mode) | `3334` | MCP Server |
| `MCP_MODE` | Transport mode (stdio/http) | `stdio` | MCP Server |
| `BACKEND_API_URL` | Backend API URL | `http://localhost:3333` | MCP Server |

### Web Frontend

| Variable | Description | Default | Used In |
|----------|-------------|---------|---------|
| `VITE_API_URL` | API proxy target | `http://localhost:3333` | Web (Vite) |

## File Locations

Environment variables are read from:
- **Root**: `/home/kngpnn/dev/synthesis/.env` (primary)
- **Example**: `/home/kngpnn/dev/synthesis/.env.example` (template)

## Source Code References

### Server (`apps/server/src`)
```typescript
// index.ts (lines 8, 18-19, 22, 26, 31, 36, 38)
import 'dotenv/config';  // Loads .env file
const PORT = Number(process.env.SERVER_PORT) || 3333;
const HOST = process.env.HOST || '0.0.0.0';
getPool(process.env.DATABASE_URL);
level: process.env.LOG_LEVEL || 'info'
const isProduction = process.env.NODE_ENV === 'production';
process.env.CORS_ALLOWED_ORIGINS?.split(',')

// agent/tools.ts & agent/agent.ts (lines 94, 99, 559, 579)
if (!process.env.ANTHROPIC_API_KEY) throw error;
apiKey: process.env.ANTHROPIC_API_KEY

// pipeline/store.ts (line 36)
options.embeddingModel ?? process.env.EMBEDDING_MODEL ?? 'nomic-embed-text'

// pipeline/embed.ts (line 38)
const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434'

// agent/utils/storage.ts & routes/ingest.ts (lines 4, 9)
const STORAGE_ROOT = process.env.STORAGE_PATH || './storage'
```

### MCP Server (`apps/mcp/src`)
```typescript
// index.ts (lines 14, 19, 21-22)
import dotenv from 'dotenv';
dotenv.config();
const MCP_PORT = Number.parseInt(process.env.MCP_PORT || '3334', 10);
const MCP_MODE = process.env.MCP_MODE || 'stdio';

// api.ts (line 6)
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3333';
```

### Web Frontend (`apps/web`)
```typescript
// vite.config.ts (line 5)
const apiTarget = process.env.VITE_API_URL ?? 'http://localhost:3333';
```

## Quick Setup

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit required variables:**
   ```bash
   # Set your Anthropic API key
   ANTHROPIC_API_KEY=sk-ant-...
   ```

3. **Verify configuration:**
   ```bash
   # Check if variables are loaded
   cd apps/server && pnpm dev
   # Should see: "Database pool initialized" and "Server listening..."
   ```

## Troubleshooting

### Error: DATABASE_URL environment variable is not defined
- **Cause**: `.env` file missing or not loaded
- **Fix**: Ensure `.env` exists and `dotenv` is imported in `apps/server/src/index.ts`

### Error: ANTHROPIC_API_KEY not found
- **Cause**: API key not set or invalid
- **Fix**: Get key from https://console.anthropic.com/ and update `.env`

### Embeddings fail
- **Cause**: Ollama not running or model not downloaded
- **Fix**: 
  ```bash
  docker-compose up -d synthesis-ollama
  docker exec -it synthesis-ollama ollama pull nomic-embed-text
  ```
