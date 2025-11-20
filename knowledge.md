# Synthesis RAG Project Knowledge

## Project Overview

Autonomous RAG (Retrieval-Augmented Generation) system built with Claude Agent SDK for multi-project documentation management.

## Tech Stack

- **Monorepo:** pnpm workspaces with Turbo
- **Backend:** Fastify server with TypeScript
- **Database:** PostgreSQL with pgvector extension
- **AI/ML:** Claude Agent SDK, Ollama embeddings
- **Testing:** Vitest
- **Code Quality:** Biome (linting + formatting)
- **Package Manager:** pnpm (required, v9.12.0+)
- **Node Version:** 22.0.0+

## Development Workflow

- Use `pnpm` for all package management (never npm/yarn)
- Run `pnpm dev` from root to start all services
- Tests with `pnpm test`, watch mode with `pnpm test:watch`
- Code formatting: `pnpm format`
- Linting: `pnpm lint:fix`
- Type checking: `pnpm typecheck`

## Docker Services

- `pnpm docker:dev` - Start DB and Ollama only
- `pnpm docker:up` - Start all services including app
- `pnpm docker:down` - Stop all services

## Project Structure

- `apps/server` - Fastify API server
- `apps/web` - React frontend
- `apps/mcp` - MCP server
- `packages/db` - Database client and migrations
- `packages/shared` - Shared types and utilities

## Key Conventions

- All packages use ES modules (`"type": "module"`)
- TypeScript strict mode enabled
- Workspace dependencies use `workspace:*` protocol
