# Synthesis RAG Project Context

## Project Overview

**Synthesis RAG** is an autonomous RAG (Retrieval-Augmented Generation) system powered by the Claude Agent SDK, designed for multi-project documentation management. It features a hybrid search engine, multi-provider embeddings, and autonomous agent capabilities.

**Version:** 2.0.0
**Monorepo:** Managed with TurboRepo and pnpm workspaces.

## Tech Stack

*   **Runtime:** Node.js 22 (LTS)
*   **Languages:** TypeScript (Strict mode)
*   **Package Manager:** pnpm 9.12.x
*   **Backend:** Fastify
*   **Frontend:** React, Vite, Tailwind CSS
*   **Database:** PostgreSQL 16 + pgvector 0.7.4
*   **AI/Agent:** Claude Agent SDK, Ollama (Local), Voyage AI, OpenAI
*   **Infrastructure:** Docker Compose
*   **Tools:** Biome (Linting/Formatting), Vitest (Testing)

## Architecture

The project is structured as a monorepo:

*   **`apps/`**
    *   `server`: Fastify backend API (Port 3333). Handles chat, search, ingestion, and agent orchestration.
    *   `web`: React frontend (Port 5173). UI for managing collections and chat.
    *   `mcp`: MCP (Model Context Protocol) server (Port 3334). Exposes RAG tools to external agents (e.g., Cursor, Claude Desktop).
    *   `desktop`: Desktop application (Tauri).
*   **`packages/`**
    *   `db`: Database client, schema, and migrations.
    *   `shared`: Shared types, utilities, and constants.

## Key Features

*   **Hybrid Search:** Combines BM25 keyword search and vector similarity search using Reciprocal Rank Fusion (RRF).
*   **Intelligent Routing:** Routes content to optimal embedding providers (Voyage for code, OpenAI for writing, Ollama for docs).
*   **Re-ranking:** Uses Cohere or local BGE models to improve search relevance.
*   **Code Intelligence:** AST-based chunking for preserving function boundaries and imports in code files.
*   **Cost Management:** Real-time budget tracking and monitoring.

## Development Workflow

### Prerequisites
*   Node.js 22+
*   pnpm 9.12+
*   Docker Desktop

### Common Commands

Run these commands from the root directory:

*   **Start All (Dev):** `pnpm dev:all` (Starts infra in Docker, apps locally)
*   **Start Infrastructure:** `pnpm dev:infra` (Postgres, Ollama, Redis)
*   **Start Backend:** `pnpm dev:server`
*   **Start Frontend:** `pnpm dev:web`
*   **Run Tests:** `pnpm test`
*   **Lint & Format:** `pnpm lint` / `pnpm format`
*   **Type Check:** `pnpm type-check`
*   **Database Migrations:** `pnpm dev:migrate`

### Docker

*   **Run Everything in Docker:** `pnpm docker:all`
*   **Stop Containers:** `pnpm docker:stop`
*   **View Logs:** `pnpm docker:logs`

## Key Documentation

*   **`README.md`**: Main project entry point.
*   **`docs/01_TECH_STACK.md`**: Detailed technology choices.
*   **`docs/02_ARCHITECTURE.md`**: System architecture and data flow.
*   **`docs/05_API_SPEC.md`**: REST API reference.
*   **`docs/CONFIGURATION.md`**: Environment variables.
