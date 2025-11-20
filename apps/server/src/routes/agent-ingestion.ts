import { getIngestionJob, getIngestionJobStats } from '@synthesis/db';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { startIngestionJob } from '../ingestion-agent/worker.js';

const StartJobSchema = z.object({
  collection_id: z.string().uuid(),
  topic: z.string().min(3),
});

export const agentIngestionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/ingestion-agent/start', async (request, reply) => {
    const validation = StartJobSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send({
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const { collection_id, topic } = validation.data;

    try {
      const job = await startIngestionJob(collection_id, topic);
      return reply.code(201).send(job);
    } catch (error) {
      fastify.log.error(error, 'Failed to start ingestion job');
      return reply.code(500).send({ error: 'Failed to start job' });
    }
  });

  fastify.get('/api/ingestion-agent/status/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };

    try {
      const job = await getIngestionJob(jobId);
      if (!job) {
        return reply.code(404).send({ error: 'Job not found' });
      }

      const stats = await getIngestionJobStats(jobId);

      return {
        job,
        stats,
      };
    } catch (error) {
      fastify.log.error(error, 'Failed to get job status');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
