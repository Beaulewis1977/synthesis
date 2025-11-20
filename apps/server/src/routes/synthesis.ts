import { getPool } from '@synthesis/db';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { smartSearch } from '../services/search.js';
import { synthesizeResults } from '../services/synthesis.js';

const SynthesisBodySchema = z
  .object({
    query: z.string().min(1, 'query must not be empty'),
    collection_id: z.string().uuid(),
    top_k: z.number().int().min(1).max(50).optional(),
    rerank_provider: z.enum(['cohere', 'bge', 'none']).optional(),
  })
  .strict();

function synthesisEnabled(): boolean {
  return (process.env.ENABLE_SYNTHESIS ?? '').trim().toLowerCase() === 'true';
}

export const synthesisRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/synthesis/compare', async (request, reply) => {
    if (!synthesisEnabled()) {
      return reply.code(404).send({ message: 'Synthesis disabled' });
    }

    const validation = SynthesisBodySchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send({
        error: 'INVALID_INPUT',
        details: validation.error.issues,
      });
    }

    const {
      query,
      collection_id: collectionId,
      top_k: topK,
      rerank_provider: rerankProvider,
    } = validation.data;

    try {
      const searchResponse = await smartSearch(getPool(), {
        query,
        collectionId,
        mode: 'hybrid',
        rerank: true,
        rerankProvider,
        rerankTopK: topK,
        topK,
      });

      const synthesis = await synthesizeResults(query, searchResponse.results, {
        maxResults: topK,
      });

      return reply.send(synthesis);
    } catch (error) {
      fastify.log.error({ error }, 'Synthesis request failed');
      return reply.code(500).send({
        error: 'SYNTHESIS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
};
