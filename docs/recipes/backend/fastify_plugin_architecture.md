---
title: "Fastify Plugin Architecture"
platform: backend
framework: fastify
feature_tags:
  - architecture
  - plugins
usage_tier: recipe
framework_version: "4.28.x"
tech_stack:
  - fastify
  - fastify-plugin
  - zod
difficulty: intermediate
last_updated: 2025-12-08
recommended: true
tested_versions:
  - "Node.js 22"
  - "Fastify 4.28.1"
---

# Fastify Plugin Architecture

> **Summary:** Structure your Fastify application using the plugin system. Learn how to encapsulate features, share dependencies via decorators, and validate requests with Zod.

## Prerequisites

- [ ] Node.js 22+

## Tech Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| fastify | ^4.28.1 | Web Framework |
| fastify-plugin | ^4.5.1 | Plugin Helper |

## Implementation

### 1. Creating a Reusable Service Plugin

Use `fastify-plugin` (fp) when you want to register things (decorators) that should be visible to the rest of the app (breaking encapsulation intentionally for shared resources).

```typescript
// apps/server/src/plugins/db.ts
import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { Pool } from 'pg';

// Type augmentation
declare module 'fastify' {
  interface FastifyInstance {
    db: Pool;
  }
}

const dbPlugin: FastifyPluginAsync = async (fastify, options) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  // Make 'db' available globally
  fastify.decorate('db', pool);

  fastify.addHook('onClose', async (instance) => {
    await instance.db.end();
  });
};

export default fp(dbPlugin);
```

### 2. Creating a Feature Route (Encapsulated)

Do NOT use `fp` for routes. This ensures that hooks and decorators defined inside this plugin do not leak to parents.

```typescript
// apps/server/src/routes/users/index.ts
import { FastifyPluginAsync } from 'fastify';
import z from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const userRoutes: FastifyPluginAsync = async (fastify, options) => {
  
  // Specific hook for user routes only
  fastify.addHook('onRequest', async (req) => {
    fastify.log.info('User route accessed');
  });

  const UserSchema = z.object({
    id: z.string(),
    name: z.string()
  });

  fastify.get('/:id', {
    schema: {
      params: zodToJsonSchema(z.object({ id: z.string() })),
      response: {
        200: zodToJsonSchema(UserSchema)
      }
    }
  }, async (req, reply) => {
    // Access global db
    const result = await fastify.db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    return result.rows[0];
  });
};

export default userRoutes;
```

### 3. Registering (Autoload or Manual)

```typescript
// apps/server/src/app.ts
import Fastify from 'fastify';
import dbPlugin from './plugins/db';
import userRoutes from './routes/users';

const app = Fastify({ logger: true });

// Register globals first
app.register(dbPlugin);

// Register features
app.register(userRoutes, { prefix: '/api/users' });

export default app;
```

## Common Pitfalls

### 1. "fastify.db is undefined"

**Problem:** Using a decorated property before the plugin is registered.

**Solution:** Fastify registration is asynchronous but sequential in the same scope. Ensure `await app.register(dbPlugin)` (or valid promise chain) happens before routes that use it.

### 2. fastify-plugin overuse

**Problem:** Wrapping *everything* in `fp`.

**Solution:** Only wrap plugins that *export* functionality (DB, Auth, Utilities). Routes should remain encapsulated contexts.
