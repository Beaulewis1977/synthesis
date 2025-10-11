import { getPool } from '@synthesis/db';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { searchCollection } from '../services/search.js';

const SearchBodySchema = z
  .object({
    query: z.string().min(1, 'query must not be empty'),
    collection_id: z.string().uuid().optional(),
    collectionId: z.string().uuid().optional(),
    top_k: z.number().int().min(1).max(50).optional(),
    topK: z.number().int().min(1).max(50).optional(),
    min_similarity: z.number().min(0).max(1).optional(),
    minSimilarity: z.number().min(0).max(1).optional(),
  })
  .strict()
  .refine((data) => Boolean(data.collection_id ?? data.collectionId), {
    message: 'collection_id is required',
    path: ['collection_id'],
  });

export const searchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/search', async (request, reply) => {
    const validation = SearchBodySchema.safeParse(request.body);

    if (!validation.success) {
      return reply.code(400).send({
        error: 'INVALID_INPUT',
        details: validation.error.issues,
      });
    }

    const {
      query,
      collectionId: camelCollectionId,
      collection_id: snakeCollectionId,
      top_k: snakeTopK,
      topK: camelTopK,
      min_similarity: snakeMinSimilarity,
      minSimilarity: camelMinSimilarity,
    } = validation.data;

    const collectionId = (camelCollectionId ?? snakeCollectionId) as string;
    const topK = camelTopK ?? snakeTopK;
    const minSimilarity = camelMinSimilarity ?? snakeMinSimilarity;

    try {
      const result = await searchCollection(getPool(), {
        query,
        collectionId,
        topK,
        minSimilarity,
      });

      return reply.send({
        query: result.query,
        results: result.results.map((item) => ({
          id: item.id,
          text: item.text,
          similarity: item.similarity,
          doc_id: item.docId,
          doc_title: item.docTitle,
          source_url: item.sourceUrl,
          citation: item.citation,
          metadata: item.metadata,
        })),
        total_results: result.totalResults,
        search_time_ms: result.searchTimeMs,
      });
    } catch (error) {
      fastify.log.error({ error }, 'Vector search failed');
      return reply.code(500).send({
        error: 'SEARCH_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
};
