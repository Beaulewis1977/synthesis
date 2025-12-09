# Backend Recipe Expansion Roadmap

> **Status:** Planning Phase
> **Target:** Document Hybrid Serverless Architecture (Fastify + Edge Functions + Cloudflare)

## Overview

This roadmap defines the plan to expand the `docs/recipes/backend` collection. It focuses on a hybrid architecture that leverages Node.js (Fastify) for the core server, but offloads specific tasks to **Supabase Edge Functions** (Deno) and **Cloudflare Workers**.

## New Recipe Specifications

---

### 1. Fastify Plugin Architecture

**Target File:** `fastify_plugin_architecture.md`
**Priority:** High

**Goal:** Structure the core Node.js server using scalable plugin patterns.

**Tech Stack:**

- `fastify`
- `fastify-plugin`
- `zod`

**Key Sections:**

- **Encapsulation:** Scoping services and decorators.
- **Validation:** Zod schema integration.
- **DI:** Service registration patterns.

---

### 2. Edge Functions (Supabase/Deno)

**Target File:** `backend_supabase_edge_functions.md`
**Priority:** High

**Goal:** Writing and deploying Deno-based edge functions for webhooks and light API tasks.

**Tech Stack:**

- Deno
- Supabase CLI

**Key Sections:**

- **Development:** Local serving and testing (`supabase functions serve`).
- **Auth:** verifying Supabase JWTs.
- **Database:** Direct connection via connection pool vs REST API.
- **Deployment:** CI/CD for functions.

---

### 3. Serverless Video Pipeline (Cloudflare + AI)

**Target File:** `backend_video_pipeline.md`
**Priority:** Medium

**Goal:** Architecture for generating, storing, and serving AI video content.

**Tech Stack:**

- Cloudflare Workers (Orchestration)
- Cloudflare R2 (Storage)
- Cloudflare CDN (Delivery)
- Replicate/RunPod (Generation)

**Key Sections:**

- **Orchestration:** Triggering AI jobs from Workers.
- **Webhooks:** Handling completion callbacks securely.
- **Storage:** Uploading/Streaming from R2.
- **Access Control:** Signed URLs for private content.

---

### 4. Global Caching with Upstash Redis

**Target File:** `backend_redis_upstash.md`
**Priority:** Medium

**Goal:** Implementing caching and queues using serverless Redis.

**Tech Stack:**

- `upstash/redis` (HTTP client preferred for Edge/Serverless)
- `bullmq` (for Node.js services)

**Key Sections:**

- **Client Selection:** HTTP (Edge) vs TCP (Long-running Node).
- **Patterns:** Cache-aside implementation.
- **Rate Limiting:** Global limits at the edge.
- **Queues:** Async job management.

---

### 5. Postgres & Vector Search

**Target File:** `backend_postgres_vectors.md`
**Priority:** Low

**Goal:** Managing the Supabase database and vector operations.

**Tech Stack:**

- PostgreSQL 16
- `pgvector`

**Key Sections:**

- **Migrations:** Schema management.
- **Embeddings:** Storing and querying vectors.
- **Performance:** Indexing strategies (HNSW).

---

## Execution Checklist

- [ ] Create `fastify_plugin_architecture.md`
- [ ] Create `backend_supabase_edge_functions.md`
- [ ] Create `backend_video_pipeline.md`
- [ ] Create `backend_redis_upstash.md`
- [ ] Create `backend_postgres_vectors.md`
