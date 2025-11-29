# Phase 1: Foundation & Infrastructure

## Objective
Establish a robust, scalable backend foundation by replacing raw SQL with a modern ORM, implementing secure authentication, and ensuring reliable background processing.

## 1. Database Modernization (ORM)
**Current State**: Raw SQL queries in `packages/db`.
**Target State**: **Drizzle ORM** (recommended) or Prisma.

### Implementation Steps
1.  **Install Drizzle**: Add `drizzle-orm` and `drizzle-kit` to `packages/db`.
2.  **Schema Definition**: Translate existing PostgreSQL schema (`migrations/*.sql`) into Drizzle schema definitions (`schema.ts`).
3.  **Migration**: Generate initial migration and verify it matches the current DB state.
4.  **Refactor Queries**: Systematically replace raw `pool.query` calls in `apps/server` with Drizzle query builder syntax.
    - *Tip*: Start with simple CRUD operations in `routes/` before tackling complex RAG queries.

## 2. Authentication & User Management
**Current State**: API Key only, no user concept.
**Target State**: **Clerk** or **NextAuth.js**.

### Implementation Steps
1.  **Provider Setup**: Configure Clerk (easiest for SaaS) or NextAuth (if self-hosted preference).
2.  **Frontend Integration**: Wrap `apps/web` root provider with Auth Provider. Add Login/Signup pages.
3.  **Backend Middleware**: Add Fastify middleware to verify session tokens/JWTs on protected routes.
4.  **User Context**: Update API resolvers to inject `userId` into the request context.

## 3. Background Job Queue
**Current State**: In-memory, synchronous processing for ingestion.
**Target State**: **BullMQ** with Redis.

### Implementation Steps
1.  **Infrastructure**: Ensure Redis is available (docker-compose).
2.  **Queue Setup**: Initialize `ingestionQueue` in `apps/server`.
3.  **Producer**: Refactor `ingestDocument` to push a job to the queue instead of processing immediately.
4.  **Consumer**: Create a worker process (or separate service) that listens to `ingestionQueue` and executes the pipeline logic.
5.  **Status Tracking**: Implement job status polling (pending, active, completed, failed) for the frontend.

## Success Criteria
- [ ] All database interactions use the ORM.
- [ ] Users must log in to access the application.
- [ ] Document uploads return a Job ID immediately; processing happens in the background.
