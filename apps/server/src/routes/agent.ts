import { getPool } from '@synthesis/db';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { AgentConversationMessage } from '../agent/agent.js';
import { runAgentChat } from '../agent/agent.js';

const ConversationMessageSchema = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1),
  })
  .strict();

const AgentChatBodySchema = z
  .object({
    message: z.string().min(1, 'message must not be empty'),
    collection_id: z.string().uuid(),
    history: z.array(ConversationMessageSchema).max(20).optional(),
  })
  .strict();

type AgentChatBody = z.infer<typeof AgentChatBodySchema>;

function mapHistory(history: AgentConversationMessage[]) {
  return history.map((item) => ({
    role: item.role,
    content: item.content,
  }));
}

export const agentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/agent/chat', async (request, reply) => {
    const validation = AgentChatBodySchema.safeParse(request.body);

    if (!validation.success) {
      return reply.code(400).send({
        error: 'INVALID_INPUT',
        details: validation.error.issues,
      });
    }

    const body = validation.data as AgentChatBody;

    try {
      const result = await runAgentChat(getPool(), {
        message: body.message,
        collectionId: body.collection_id,
        history: body.history ?? [],
      });

      return reply.send({
        message: result.message,
        tool_calls: result.toolCalls.map((call) => ({
          id: call.id,
          tool: call.tool,
          status: call.status,
          input: call.input,
          result: call.result,
          server: call.serverName,
        })),
        history: mapHistory(result.history),
        usage: result.usage,
      });
    } catch (error) {
      fastify.log.error(error, 'Agent chat failed');
      return reply.code(500).send({
        error: 'AGENT_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
};