/**
 * Agent Routes
 *
 * Phase 16G: Added per-chat model selection with persistence.
 */

import { addChatMessage, getChatSession, getPool, updateChatSessionModel } from '@synthesis/db';
import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { runAgentChat } from '../agent/agent.js';
import {
  DocumentNotFoundError,
  deleteDocumentById,
  fetchWebContent,
} from '../services/documentOperations.js';
import { getModelConfigService } from '../services/model-config-service.js';

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
    session_id: z.string().uuid().optional(),
    history: z.array(ConversationMessageSchema).max(20).optional(),
    provider: z.string().optional(), // Phase 16G: Per-chat provider override
    model: z.string().optional(), // Phase 16G: Per-chat model override
  })
  .strict();

type AgentChatBody = z.infer<typeof AgentChatBodySchema>;

// =============================================================================
// Model Resolution Helper
// =============================================================================

/**
 * Resolve chat model from request params, session, or global default.
 * Resolution priority: Request Params -> Session DB -> Global Default
 * Phase 16G: Per-chat model persistence
 */
async function resolveChatModel(
  db: Pool,
  body: { provider?: string; model?: string; session_id?: string }
): Promise<{ provider: string; model: string; source: 'request' | 'session' | 'default' }> {
  // 1. Check request params first
  if (body.provider && body.model) {
    // Persist to session if session_id provided
    if (body.session_id) {
      await updateChatSessionModel(body.session_id, body.provider, body.model);
    }
    return { provider: body.provider, model: body.model, source: 'request' };
  }

  // 2. Check session DB
  if (body.session_id) {
    const session = await getChatSession(body.session_id);
    if (session?.provider && session?.model) {
      return { provider: session.provider, model: session.model, source: 'session' };
    }
  }

  // 3. Fall back to global default
  const configService = getModelConfigService(db);
  const config = await configService.getChatModelConfig();
  return { provider: config.provider, model: config.model, source: 'default' };
}

const FetchWebContentSchema = z
  .object({
    url: z.string().url(),
    collection_id: z.string().uuid().optional(),
    collectionId: z.string().uuid().optional(),
    mode: z.enum(['single', 'crawl']).optional(),
    max_pages: z.number().int().min(1).max(200).optional(),
    maxPages: z.number().int().min(1).max(200).optional(),
    title_prefix: z.string().min(1).optional(),
    titlePrefix: z.string().min(1).optional(),
  })
  .strict()
  .refine((data) => Boolean(data.collection_id ?? data.collectionId), {
    message: 'collection_id is required',
    path: ['collection_id'],
  });

const DeleteDocumentSchema = z
  .object({
    doc_id: z.string().uuid().optional(),
    docId: z.string().uuid().optional(),
    confirm: z.boolean(),
  })
  .strict()
  .refine((data) => Boolean(data.doc_id ?? data.docId), {
    message: 'doc_id is required',
    path: ['doc_id'],
  });

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
    const db = getPool();

    try {
      // Resolve model config (Phase 16G)
      const modelConfig = await resolveChatModel(db, body);
      fastify.log.info({ modelConfig }, 'Resolved chat model config');

      // If session_id provided, try to fetch history from DB to use as context
      // Note: We don't use this history for the *agent* memory right now because
      // runAgentChat expects specific AgentConversationMessage[] format and handles its own context window.
      // For now, we rely on the client to pass relevant history or the agent to retrieve it.
      // Future improvement: Load last N messages from DB if history is empty in body.

      // TODO: Phase 16G - Pass provider/model override to runAgentChat once agent.ts is updated
      const result = await runAgentChat(db, {
        message: body.message,
        collectionId: body.collection_id,
        history: body.history ?? [],
        sessionId: body.session_id, // Phase 16F: Pass session ID for dynamic tool filtering
        provider: modelConfig.provider, // Phase 16G: Pass resolved provider
        model: modelConfig.model, // Phase 16G: Pass resolved model
      });

      // If session_id is provided, persist the conversation
      if (body.session_id) {
        try {
          await addChatMessage(body.session_id, 'user', body.message);
          await addChatMessage(body.session_id, 'assistant', result.message, {
            tool_calls: result.toolCalls,
            usage: result.usage,
          });
        } catch (persistError) {
          // Don't fail the request if persistence fails, just log it
          fastify.log.error(persistError, 'Failed to persist chat message');
        }
      }

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
        history: result.history,
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

  fastify.post('/api/agent/fetch-web-content', async (request, reply) => {
    fastify.log.info(request.body, 'request body');
    const validation = FetchWebContentSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.code(400).send({
        error: 'INVALID_INPUT',
        details: validation.error.issues,
      });
    }

    const body = validation.data;
    const collectionId = (body.collectionId ?? body.collection_id) as string;
    const maxPages = body.maxPages ?? body.max_pages;
    const titlePrefix = body.titlePrefix ?? body.title_prefix;

    try {
      const result = await fetchWebContent(getPool(), {
        url: body.url,
        collectionId,
        mode: body.mode,
        maxPages,
        titlePrefix,
      });

      return reply.send({
        message: `Fetched and queued ${result.processed.length} page(s) for ingestion.`,
        processed: result.processed,
      });
    } catch (error) {
      fastify.log.error(error, 'Fetch web content failed');
      return reply.code(500).send({
        error: 'FETCH_WEB_CONTENT_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  fastify.post('/api/agent/delete-document', async (request, reply) => {
    const validation = DeleteDocumentSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.code(400).send({
        error: 'INVALID_INPUT',
        details: validation.error.issues,
      });
    }

    const body = validation.data;
    const docId = (body.docId ?? body.doc_id) as string;

    if (!body.confirm) {
      return reply.code(400).send({
        error: 'CONFIRMATION_REQUIRED',
        message: 'Set confirm=true to permanently remove the document.',
      });
    }

    try {
      const result = await deleteDocumentById(getPool(), { docId });

      return reply.send({
        message: `Document ${result.title} deleted.`,
        doc_id: result.docId,
        title: result.title,
      });
    } catch (error) {
      fastify.log.error(error, 'Delete document failed');
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: string }).code
          : undefined;
      const isNotFoundError =
        error instanceof DocumentNotFoundError || errorCode === 'DOCUMENT_NOT_FOUND';
      if (isNotFoundError) {
        return reply.code(404).send({
          error: 'DOCUMENT_NOT_FOUND',
          message: errorMessage,
        });
      }

      return reply.code(500).send({
        error: 'DELETE_DOCUMENT_ERROR',
        message: errorMessage || 'Unknown error',
      });
    }
  });
};
