/**
 * Feedback routes
 * Handles user feedback on search results and chat responses
 */

import {
  getDocumentQualityScore,
  getTopQualityDocuments,
  submitSearchFeedback,
} from '@synthesis/db';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const SearchFeedbackSchema = z.object({
  chunk_id: z.number().optional(),
  doc_id: z.string().uuid().optional(),
  query: z.string(),
  collection_id: z.string().uuid(),
  rating: z.number().min(-1).max(1), // -1 = thumbs down, 0 = neutral, 1 = thumbs up
  result_position: z.number().optional(),
  similarity_score: z.number().optional(),
  search_mode: z.enum(['vector', 'hybrid']).optional(),
  feedback_text: z.string().max(1000).optional(),
  feedback_category: z
    .enum(['irrelevant', 'outdated', 'incorrect', 'helpful', 'perfect'])
    .optional(),
  session_id: z.string().uuid().optional(),
});

const ChatFeedbackSchema = z.object({
  message_id: z.string().uuid(),
  session_id: z.string().uuid(),
  rating: z.number().min(-1).max(1),
  feedback_categories: z.array(z.string()).optional(),
  feedback_text: z.string().max(1000).optional(),
  query: z.string().optional(),
  sources_used: z.number().optional(),
});

export const feedbackRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/feedback/search - Submit feedback on a search result
  fastify.post('/api/feedback/search', async (request, reply) => {
    const validation = SearchFeedbackSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send({
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const data = validation.data;
    try {
      const feedback = await submitSearchFeedback({
        chunkId: data.chunk_id,
        docId: data.doc_id,
        query: data.query,
        collectionId: data.collection_id,
        rating: data.rating,
        resultPosition: data.result_position,
        similarityScore: data.similarity_score,
        searchMode: data.search_mode,
        feedbackText: data.feedback_text,
        feedbackCategory: data.feedback_category,
        sessionId: data.session_id,
      });

      return reply.code(201).send({
        message: 'Feedback submitted',
        feedback_id: feedback.id,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to submit search feedback');
      return reply.code(500).send({ error: 'Failed to submit feedback' });
    }
  });

  // POST /api/feedback/chat - Submit feedback on a chat response
  fastify.post('/api/feedback/chat', async (request, reply) => {
    const validation = ChatFeedbackSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send({
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const data = validation.data;
    try {
      // For now, store in search_feedback with special handling
      // In production, this would go to chat_feedback table
      const feedback = await submitSearchFeedback({
        query: data.query || '',
        collectionId: data.session_id, // Using session_id as collection reference
        rating: data.rating,
        feedbackText: data.feedback_text,
        sessionId: data.session_id,
      });

      return reply.code(201).send({
        message: 'Chat feedback submitted',
        feedback_id: feedback.id,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to submit chat feedback');
      return reply.code(500).send({ error: 'Failed to submit feedback' });
    }
  });

  // GET /api/feedback/quality/:docId - Get quality score for a document
  fastify.get<{ Params: { docId: string } }>(
    '/api/feedback/quality/:docId',
    async (request, reply) => {
      const { docId } = request.params;
      try {
        const score = await getDocumentQualityScore(docId);
        if (!score) {
          return reply.send({
            doc_id: docId,
            quality_score: 0.5, // Default neutral score
            total_ratings: 0,
            message: 'No feedback yet',
          });
        }
        return reply.send({ quality: score });
      } catch (error) {
        fastify.log.error(error, 'Failed to get quality score');
        return reply.code(500).send({ error: 'Failed to get quality score' });
      }
    }
  );

  // GET /api/feedback/top-quality/:collectionId - Get top quality documents
  fastify.get<{ Params: { collectionId: string }; Querystring: { limit?: string } }>(
    '/api/feedback/top-quality/:collectionId',
    async (request, reply) => {
      const { collectionId } = request.params;
      const limit = Number.parseInt(request.query.limit || '10', 10);

      try {
        const documents = await getTopQualityDocuments(collectionId, limit);
        return reply.send({
          collection_id: collectionId,
          top_documents: documents,
          count: documents.length,
        });
      } catch (error) {
        fastify.log.error(error, 'Failed to get top quality documents');
        return reply.code(500).send({ error: 'Failed to get top quality documents' });
      }
    }
  );
};
