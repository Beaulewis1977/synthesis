import {
  createChatSession,
  getChatMessages,
  getChatSession,
  listChatSessions,
} from '@synthesis/db';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const CreateSessionSchema = z.object({
  collectionId: z.string().uuid(),
  title: z.string().min(1).max(255),
});

export const chatRoutes: FastifyPluginAsync = async (fastify) => {
  // List chat sessions for a collection
  fastify.get<{ Params: { collectionId: string } }>(
    '/api/chats/collection/:collectionId',
    async (request, reply) => {
      try {
        const sessions = await listChatSessions(request.params.collectionId);
        return reply.send({ sessions });
      } catch (error) {
        fastify.log.error(error, 'Failed to list chat sessions');
        return reply.code(500).send({ error: 'Failed to list chat sessions' });
      }
    }
  );

  // Get a single chat session with messages
  fastify.get<{ Params: { id: string } }>('/api/chats/:id', async (request, reply) => {
    try {
      const session = await getChatSession(request.params.id);
      if (!session) {
        return reply.code(404).send({ error: 'Chat session not found' });
      }

      const messages = await getChatMessages(request.params.id);
      return reply.send({ session, messages });
    } catch (error) {
      fastify.log.error(error, 'Failed to get chat session');
      return reply.code(500).send({ error: 'Failed to get chat session' });
    }
  });

  // Create a new chat session
  fastify.post('/api/chats', async (request, reply) => {
    const validation = CreateSessionSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send({
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    try {
      const { collectionId, title } = validation.data;
      const session = await createChatSession(collectionId, title);
      return reply.code(201).send({ session });
    } catch (error) {
      fastify.log.error(error, 'Failed to create chat session');
      return reply.code(500).send({ error: 'Failed to create chat session' });
    }
  });
};

