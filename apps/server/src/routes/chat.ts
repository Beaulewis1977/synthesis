/**
 * Chat Session Routes
 *
 * Phase 16G: Added provider/model support for per-chat model selection.
 */

import {
  addChatMessage,
  createChatSession,
  deleteChatSession,
  getChatMessages,
  getChatSession,
  listChatSessions,
  updateChatSessionModel,
  updateChatSessionTitle,
} from '@synthesis/db';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const CreateSessionSchema = z.object({
  collectionId: z.string().uuid(),
  title: z.string().min(1).max(255),
  provider: z.string().optional(), // Phase 16G: Per-chat provider
  model: z.string().optional(), // Phase 16G: Per-chat model
});

const UpdateSessionSchema = z.object({
  title: z.string().min(1).max(255),
});

// Phase 16G: Schema for updating chat session model
const UpdateModelSchema = z.object({
  provider: z.string(),
  model: z.string(),
});

const AddMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

const uuidSchema = z.string().uuid();

export const chatRoutes: FastifyPluginAsync = async (fastify) => {
  // List chat sessions for a collection
  fastify.get<{ Params: { collectionId: string } }>(
    '/api/chats/collection/:collectionId',
    async (request, reply) => {
      const { collectionId } = request.params;
      if (!uuidSchema.safeParse(collectionId).success) {
        fastify.log.warn({ collectionId }, 'Invalid collectionId for chat listing');
        return reply.code(400).send({ error: 'Invalid collectionId' });
      }

      try {
        const sessions = await listChatSessions(collectionId);
        return reply.send({ sessions });
      } catch (error) {
        fastify.log.error(error, 'Failed to list chat sessions');
        return reply.code(500).send({ error: 'Failed to list chat sessions' });
      }
    }
  );

  // Get a single chat session with messages
  fastify.get<{ Params: { id: string } }>('/api/chats/:id', async (request, reply) => {
    const { id: chatId } = request.params;
    if (!uuidSchema.safeParse(chatId).success) {
      fastify.log.warn({ chatId }, 'Invalid chat id requested');
      return reply.code(400).send({ error: 'Invalid chat id' });
    }

    try {
      const session = await getChatSession(chatId);
      if (!session) {
        return reply.code(404).send({ error: 'Chat session not found' });
      }

      const messages = await getChatMessages(chatId);
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
      const { collectionId, title, provider, model } = validation.data;
      // Phase 16G: Pass provider/model to createChatSession
      const session = await createChatSession(collectionId, title, provider, model);
      return reply.code(201).send({ session });
    } catch (error) {
      fastify.log.error(error, 'Failed to create chat session');
      return reply.code(500).send({ error: 'Failed to create chat session' });
    }
  });

  // Delete a chat session
  fastify.delete<{ Params: { id: string } }>('/api/chats/:id', async (request, reply) => {
    const { id: chatId } = request.params;
    if (!uuidSchema.safeParse(chatId).success) {
      return reply.code(400).send({ error: 'Invalid chat id' });
    }

    try {
      // Verify session exists before deleting
      const session = await getChatSession(chatId);
      if (!session) {
        return reply.code(404).send({ error: 'Chat session not found' });
      }

      await deleteChatSession(chatId);
      return reply.code(204).send();
    } catch (error) {
      fastify.log.error(error, 'Failed to delete chat session');
      return reply.code(500).send({ error: 'Failed to delete chat session' });
    }
  });

  // Update chat session title
  fastify.patch<{ Params: { id: string } }>('/api/chats/:id', async (request, reply) => {
    const { id: chatId } = request.params;
    if (!uuidSchema.safeParse(chatId).success) {
      return reply.code(400).send({ error: 'Invalid chat id' });
    }

    const validation = UpdateSessionSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send({
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    try {
      const session = await updateChatSessionTitle(chatId, validation.data.title);
      if (!session) {
        return reply.code(404).send({ error: 'Chat session not found' });
      }
      return reply.send({ session });
    } catch (error) {
      fastify.log.error(error, 'Failed to update chat session');
      return reply.code(500).send({ error: 'Failed to update chat session' });
    }
  });

  // Add message to chat session
  fastify.post<{ Params: { id: string } }>('/api/chats/:id/messages', async (request, reply) => {
    const { id: chatId } = request.params;
    if (!uuidSchema.safeParse(chatId).success) {
      return reply.code(400).send({ error: 'Invalid chat id' });
    }

    const validation = AddMessageSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send({
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    try {
      // Verify session exists
      const session = await getChatSession(chatId);
      if (!session) {
        return reply.code(404).send({ error: 'Chat session not found' });
      }

      const { role, content, metadata } = validation.data;
      const message = await addChatMessage(chatId, role, content, metadata);
      return reply.code(201).send({ message });
    } catch (error) {
      fastify.log.error(error, 'Failed to add chat message');
      return reply.code(500).send({ error: 'Failed to add chat message' });
    }
  });

  // Phase 16G: Update chat session model
  fastify.patch<{ Params: { id: string } }>('/api/chats/:id/model', async (request, reply) => {
    const { id: chatId } = request.params;
    if (!uuidSchema.safeParse(chatId).success) {
      return reply.code(400).send({ error: 'Invalid chat id' });
    }

    const validation = UpdateModelSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send({
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    try {
      const session = await updateChatSessionModel(
        chatId,
        validation.data.provider,
        validation.data.model
      );
      if (!session) {
        return reply.code(404).send({ error: 'Chat session not found' });
      }
      return reply.send({ session });
    } catch (error) {
      fastify.log.error(error, 'Failed to update chat session model');
      return reply.code(500).send({ error: 'Failed to update chat session model' });
    }
  });
};
