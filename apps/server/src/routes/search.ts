import { getPool } from '@synthesis/db';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { smartSearch } from '../services/search.js';

const SearchBodySchema = z
  .object({
    query: z.string().min(1, 'query must not be empty'),
    collection_id: z.string().uuid().optional(),
    collectionId: z.string().uuid().optional(),
    top_k: z.number().int().min(1).max(50).optional(),
    topK: z.number().int().min(1).max(50).optional(),
    min_similarity: z.number().min(0).max(1).optional(),
    minSimilarity: z.number().min(0).max(1).optional(),
    search_mode: z.enum(['vector', 'hybrid']).optional(),
    searchMode: z.enum(['vector', 'hybrid']).optional(),
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
      search_mode: snakeSearchMode,
      searchMode: camelSearchMode,
    } = validation.data;

    const collectionId = (camelCollectionId ?? snakeCollectionId) as string;
    const topK = camelTopK ?? snakeTopK;
    const minSimilarity = camelMinSimilarity ?? snakeMinSimilarity;

    // Validate and normalize SEARCH_MODE environment variable
    const envSearchMode = process.env.SEARCH_MODE?.trim().toLowerCase();
    const validatedEnvMode: 'vector' | 'hybrid' | undefined =
      envSearchMode === 'vector' || envSearchMode === 'hybrid' ? envSearchMode : undefined;

    const searchMode = camelSearchMode ?? snakeSearchMode ?? validatedEnvMode ?? 'vector';

    try {
      const result = await smartSearch(getPool(), {
        query,
        collectionId,
        topK,
        minSimilarity,
        mode: searchMode,
      });

      return reply.send({
        query: result.query,
        results: result.results.map((item) => ({
          id: item.id,
          text: item.text,
          similarity: item.similarity,
          vector_score: item.vectorScore,
          bm25_score: item.bm25Score,
          fused_score: item.fusedScore,
          source: item.source,
          doc_id: item.docId,
          doc_title: item.docTitle,
          source_url: item.sourceUrl,
          citation: item.citation,
          metadata: item.metadata,
        })),
        total_results: result.totalResults,
        search_time_ms: result.searchTimeMs,
        metadata: {
          search_mode: result.metadata.searchMode,
          vector_count: result.metadata.vectorCount,
          bm25_count: result.metadata.bm25Count,
          fused_count: result.metadata.fusedCount,
          embedding_provider: result.metadata.embeddingProvider ?? null,
        },
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
