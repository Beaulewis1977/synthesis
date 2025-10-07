/**
 * The main entry point for the Synthesis server.
 * This file initializes the Fastify server, connects to the database, registers routes,
 * and sets up graceful shutdown handlers.
 * @module server
 */

import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { closePool, getPool } from '@synthesis/db';
import Fastify from 'fastify';
import { collectionRoutes } from './routes/collections.js';
import { ingestRoutes } from './routes/ingest.js';

const PORT = Number(process.env.SERVER_PORT) || 3333;
const HOST = process.env.HOST || '0.0.0.0';

// Initialize database pool
getPool(process.env.DATABASE_URL);
console.log('Database pool initialized');

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

// Register plugins
await fastify.register(cors, {
  origin: true, // Allow all origins in development
});

await fastify.register(multipart, {
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  },
});

// Register routes
await fastify.register(collectionRoutes);
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
