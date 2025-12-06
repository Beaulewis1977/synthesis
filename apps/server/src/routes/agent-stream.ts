/**
 * Agent Streaming Route
 *
 * Phase 16C: SSE endpoint for real-time chat streaming.
 * Streams token-by-token responses with tool execution progress.
 */

import { addChatMessage, getPool } from '@synthesis/db';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import { BASE_SYSTEM_PROMPT } from '../agent/agent.js';
import { buildAgentTools } from '../agent/tools.js';
import {
  type ChatMessage,
  type ChatStreamChunk,
  type ChatTool,
  type ToolContext,
  getConfiguredChatProvider,
} from '../services/chat-providers/index.js';
import { getModelConfigService } from '../services/model-config-service.js';

// =============================================================================
// Schemas
// =============================================================================

const ConversationMessageSchema = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1),
  })
  .strict();

const AgentStreamBodySchema = z
  .object({
    message: z.string().min(1, 'message must not be empty'),
    collection_id: z.string().uuid(),
    session_id: z.string().uuid().optional(),
    history: z.array(ConversationMessageSchema).max(20).optional(),
  })
  .strict();

// =============================================================================
// SSE Helper
// =============================================================================

/**
 * Send an SSE event to the client
 */
function sendSSE(reply: FastifyReply, event: string, data: unknown): void {
  const payload = JSON.stringify(data);
  reply.raw.write(`event: ${event}\ndata: ${payload}\n\n`);
}

// =============================================================================
// Route Handler
// =============================================================================

export const agentStreamRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/agent/chat/stream
   *
   * SSE endpoint for streaming chat responses.
   * Returns Server-Sent Events with token, tool_start, tool_end, and done events.
   */
  fastify.post('/api/agent/chat/stream', async (request, reply) => {
    // Validate request body
    const validation = AgentStreamBodySchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send({
        error: 'INVALID_INPUT',
        details: validation.error.issues,
      });
    }

    const body = validation.data;
    const db = getPool();
    const context: ToolContext = {
      collectionId: body.collection_id,
      sessionId: body.session_id, // Phase 16F: Pass session ID for dynamic tool filtering
    };

    // Hijack reply to manually control raw response (prevents Fastify auto-send)
    reply.hijack();

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Track accumulated content for session persistence
    let fullContent = '';
    const toolCalls: Array<{
      id: string;
      tool: string;
      status: 'started' | 'completed' | 'error';
      input?: unknown;
    }> = [];

    try {
      // Get configured chat provider
      const provider = await getConfiguredChatProvider(db, context);

      // Check if provider supports streaming
      if (!provider.streamChat) {
        sendSSE(reply, 'error', {
          message: `Provider '${provider.name}' does not support streaming. Use non-streaming endpoint.`,
        });
        // Note: reply.raw.end() is called in the finally block
        return;
      }

      // Build messages array
      const messages: ChatMessage[] = [
        ...(body.history ?? []).map((h) => ({
          role: h.role as 'user' | 'assistant',
          content: h.content,
        })),
        { role: 'user' as const, content: body.message },
      ];

      // Build system prompt with collection context
      const systemPrompt = `${BASE_SYSTEM_PROMPT}\n\nActive collection ID: ${body.collection_id}`;

      // Build tools if provider supports them
      let chatTools: ChatTool[] | undefined;
      if (provider.capabilities.supportsTools) {
        const { tools } = buildAgentTools(db, context);
        chatTools = tools.map((t) => ({
          name: t.name,
          description: t.description ?? '',
          inputSchema: t.input_schema as ChatTool['inputSchema'],
        }));
      }

      // Get model from config (provider was already configured with it)
      const configService = getModelConfigService(db);
      const chatConfig = await configService.getChatModelConfig();

      // Stream response
      for await (const chunk of provider.streamChat({
        messages,
        model: chatConfig.model,
        systemPrompt,
        tools: chatTools,
        maxTokens: 4096,
      })) {
        handleStreamChunk(reply, chunk, toolCalls);

        // Accumulate content
        if (chunk.type === 'text' && chunk.text) {
          fullContent += chunk.text;
        }
      }

      // Persist to session if provided (only on success - we're in try block)
      if (body.session_id) {
        try {
          await addChatMessage(body.session_id, 'user', body.message);
          await addChatMessage(body.session_id, 'assistant', fullContent, {
            tool_calls: toolCalls,
          });
        } catch (persistError) {
          fastify.log.error(persistError, 'Failed to persist streamed chat message');
        }
      }
    } catch (error) {
      fastify.log.error(error, 'Agent stream failed');
      sendSSE(reply, 'error', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      reply.raw.end();
    }
  });
};

/**
 * Handle a stream chunk and send appropriate SSE event
 */
function handleStreamChunk(
  reply: FastifyReply,
  chunk: ChatStreamChunk,
  toolCalls: Array<{
    id: string;
    tool: string;
    status: 'started' | 'completed' | 'error';
    input?: unknown;
  }>
): void {
  switch (chunk.type) {
    case 'text':
      sendSSE(reply, 'token', { content: chunk.text });
      break;

    case 'tool_start':
      if (chunk.toolCall) {
        toolCalls.push({
          id: chunk.toolCall.id ?? '',
          tool: chunk.toolCall.name ?? '',
          status: 'started',
          input: chunk.toolCall.input,
        });
        sendSSE(reply, 'tool_start', {
          id: chunk.toolCall.id,
          tool: chunk.toolCall.name,
          input: chunk.toolCall.input,
        });
      }
      break;

    case 'tool_end':
      if (chunk.toolCall) {
        const toolCall = toolCalls.find((t) => t.id === chunk.toolCall?.id);
        if (toolCall) {
          toolCall.status = 'completed';
        }
        sendSSE(reply, 'tool_end', {
          id: chunk.toolCall?.id ?? null,
          tool: chunk.toolCall.name,
        });
      }
      break;

    case 'tool_delta':
      // Tool delta events are for incremental tool call data
      // We don't need to send these to the client for now
      break;

    case 'usage':
      // Usage events contain token counts
      sendSSE(reply, 'usage', { usage: chunk.usage });
      break;

    case 'done':
      sendSSE(reply, 'done', {
        usage: chunk.usage,
        stopReason: chunk.stopReason,
      });
      break;
  }
}
