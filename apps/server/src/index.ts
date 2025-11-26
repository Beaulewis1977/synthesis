/**
 * The main entry point for the Synthesis server.
 * This file initializes the Fastify server, connects to the database, registers routes,
 * and sets up graceful shutdown handlers.
 * @module server
 */

import 'dotenv/config';
import compress from '@fastify/compress';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { closePool, getPool } from '@synthesis/db';
import Fastify from 'fastify';
import { adminModelRoutes } from './routes/admin/models.js';
import { agentIngestionRoutes } from './routes/agent-ingestion.js';
import { agentRoutes } from './routes/agent.js';
import { chatRoutes } from './routes/chat.js';
import { collectionRoutes } from './routes/collections.js';
import { costRoutes } from './routes/costs.js';
import { documentRoutes } from './routes/documents.js';
import { feedbackRoutes } from './routes/feedback.js';
import { ingestRoutes } from './routes/ingest.js';
import { repoRoutes } from './routes/repos.js';
import { searchRoutes } from './routes/search.js';
import { synthesisRoutes } from './routes/synthesis.js';
import { techProfileRoutes } from './routes/tech-profiles.js';
import { workflowRoutes } from './routes/workflows.js';
import { initializeMetrics, registerMetricsRoute } from './services/metrics.js';
import { disconnectRedis } from './services/redis.js';
import { startStaleCheckScheduler, stopStaleCheckScheduler } from './services/stale-check-job.js';

const PORT = Number(process.env.SERVER_PORT) || 3333;
const HOST = process.env.HOST || '0.0.0.0';

// Initialize database pool
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
  console.error('ERROR: DATABASE_URL environment variable is not defined or empty');
  process.exit(1);
}
getPool(process.env.DATABASE_URL);
console.info('Database pool initialized');

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

initializeMetrics();

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

await fastify.register(compress, {
  global: true,
  encodings: ['gzip', 'deflate'],
});

// Register routes
await fastify.register(collectionRoutes);
await fastify.register(chatRoutes);
await fastify.register(searchRoutes);
await fastify.register(synthesisRoutes);
await fastify.register(costRoutes);
await fastify.register(agentRoutes);
await fastify.register(agentIngestionRoutes);
await fastify.register(ingestRoutes);
await fastify.register(documentRoutes);
await fastify.register(repoRoutes);
await fastify.register(techProfileRoutes);
await fastify.register(feedbackRoutes);
await fastify.register(workflowRoutes);
await fastify.register(adminModelRoutes, { prefix: '/api/admin/models' });
await registerMetricsRoute(fastify);

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
  console.info(`🚀 Server listening on http://${HOST}:${PORT}`);

  // Start background stale check scheduler (if enabled)
  if (process.env.ENABLE_STALE_CHECK !== 'false') {
    startStaleCheckScheduler();
    console.info('📅 Stale document check scheduler started');
  }
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
  console.info(`\n${signal} received, shutting down gracefully...`);
  stopStaleCheckScheduler();
  await fastify.close();
  await closePool();
  await disconnectRedis();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
