import { getPool } from '@synthesis/db';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { runAgentChat } from '../agent/agent.js';
import {
  DocumentNotFoundError,
  deleteDocumentById,
  fetchWebContent,
} from '../services/documentOperations.js';

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
