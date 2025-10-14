/**
 * The main entry point for the Synthesis server.
 * This file initializes the Fastify server, connects to the database, registers routes,
 * and sets up graceful shutdown handlers.
 * @module server
 */

import 'dotenv/config';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { closePool, getPool } from '@synthesis/db';
import Fastify from 'fastify';
import { agentRoutes } from './routes/agent.js';
import { collectionRoutes } from './routes/collections.js';
import { ingestRoutes } from './routes/ingest.js';
import { searchRoutes } from './routes/search.js';
import { synthesisRoutes } from './routes/synthesis.js';

const PORT = Number(process.env.SERVER_PORT) || 3333;
const HOST = process.env.HOST || '0.0.0.0';

// Initialize database pool
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
  console.error('ERROR: DATABASE_URL environment variable is not defined or empty');
  process.exit(1);
}
getPool(process.env.DATABASE_URL);
console.log('Database pool initialized');

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

// Register plugins
const isProduction = process.env.NODE_ENV === 'production';
const corsOrigins = isProduction
  ? process.env.CORS_ALLOWED_ORIGINS
    ? (() => {
        const origins = process.env.CORS_ALLOWED_ORIGINS.split(',')
          .map((o) => o.trim())
          .filter(Boolean);
        return origins.length > 0 ? origins : false;
      })()
    : false
  : true;

await fastify.register(cors, {
  origin: corsOrigins,
});

await fastify.register(multipart, {
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  },
});

// Register routes
await fastify.register(collectionRoutes);
await fastify.register(searchRoutes);
await fastify.register(synthesisRoutes);
await fastify.register(agentRoutes);
await fastify.register(ingestRoutes);

/**
 * Health check endpoint to verify the server is running.
 * @name /health
 * @function
 * @memberof module:server
 */
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Start server
try {
  await fastify.listen({ port: PORT, host: HOST });
  console.log(`🚀 Server listening on http://${HOST}:${PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

/**
 * Handles graceful shutdown of the server.
 * Closes the Fastify server and the database pool before exiting.
 * @param {string} signal The signal that triggered the shutdown (e.g., 'SIGTERM').
 */
const shutdown = async (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);
  await fastify.close();
  await closePool();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
