import Anthropic from '@anthropic-ai/sdk';
import type { Tool } from '@anthropic-ai/sdk/resources/messages.js';
import {
  createDocument,
  deleteDocumentChunks,
  getDocument,
  getDocumentChunks,
} from '@synthesis/db';
import type { Pool } from 'pg';
import { chromium } from 'playwright';
import TurndownService from 'turndown';
import { z } from 'zod';
import { ingestDocument } from '../pipeline/orchestrator.js';
import { searchCollection } from '../services/search.js';
import {
  type RemoteDownloadResult,
  deleteFileIfExists,
  downloadRemoteFile,
  inferContentType,
  inferExtension,
  inferTitle,
  isUrl,
  readLocalFile,
  writeDocumentFile,
} from './utils/storage.js';

const SEARCH_TOOL_NAME = 'search_rag';
const ADD_DOCUMENT_TOOL_NAME = 'add_document';
const FETCH_WEB_CONTENT_TOOL_NAME = 'fetch_web_content';
const LIST_COLLECTIONS_TOOL_NAME = 'list_collections';
const LIST_DOCUMENTS_TOOL_NAME = 'list_documents';
const GET_DOCUMENT_STATUS_TOOL_NAME = 'get_document_status';
const DELETE_DOCUMENT_TOOL_NAME = 'delete_document';
const RESTART_INGEST_TOOL_NAME = 'restart_ingest';
const SUMMARIZE_DOCUMENT_TOOL_NAME = 'summarize_document';

export interface ToolContext {
  collectionId: string;
}

type ToolExecutor = (input: unknown) => Promise<string>;

function createToolResponse(message: string, payload?: unknown): string {
  const text = payload ? `${message}\n\n${JSON.stringify(payload, null, 2)}` : message;
  return text;
}

type JsonSchema =
  | { type: 'string'; enum?: string[]; default?: unknown }
  | { type: 'number'; default?: unknown }
  | { type: 'boolean'; default?: unknown }
  | {
      type: 'object';
      properties: Record<string, JsonSchema>;
      required?: string[];
      default?: unknown;
    };

function zodToJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  if (schema instanceof z.ZodString) {
    return { type: 'string' };
  }
  if (schema instanceof z.ZodNumber) {
    return { type: 'number' };
  }
  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }
  if (schema instanceof z.ZodDefault) {
    return zodToJsonSchema(schema._def.innerType);
  }
  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema(schema._def.innerType);
  }
  if (schema instanceof z.ZodObject) {
    const shape = schema._def.shape();
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value as z.ZodTypeAny);
      if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }
  if (schema instanceof z.ZodEnum) {
    return { type: 'string', enum: schema._def.values };
  }
  if (schema instanceof z.ZodRecord) {
    return { type: 'object', properties: {} };
  }
  return { type: 'string' };
}

export function createSearchRagTool(
  db: Pool,
  context: ToolContext
): {
  definition: Tool;
  executor: ToolExecutor;
} {
  const inputSchema = z.object({
    query: z.string().min(1, 'query must not be empty'),
    collection_id: z.string().uuid().optional().default(context.collectionId),
    top_k: z.number().int().min(1).max(50).optional().default(5),
    min_similarity: z.number().min(0).max(1).optional().default(0.5),
  });

  return {
    definition: {
      name: SEARCH_TOOL_NAME,
      description:
        'Search the RAG knowledge base for relevant information and return matching chunks with citations.',
      input_schema: zodToJsonSchema(inputSchema) as Tool['input_schema'],
    },
    executor: async (args: unknown) => {
      const parsed = inputSchema.parse(args);
      const searchResult = await searchCollection(db, {
        query: parsed.query,
        collectionId: parsed.collection_id ?? context.collectionId,
        topK: parsed.top_k ?? 5,
        minSimilarity: parsed.min_similarity ?? 0.5,
      });

      const payload = {
        query: searchResult.query,
        results: searchResult.results,
        total_results: searchResult.totalResults,
        search_time_ms: searchResult.searchTimeMs,
      };

      return createToolResponse(
        `Vector search completed for "${payload.query}". Returning ${payload.total_results} result(s).`,
        payload
      );
    },
  };
}

export function createAddDocumentTool(
  db: Pool,
  context: ToolContext
): {
  definition: Tool;
  executor: ToolExecutor;
} {
  const inputSchema = z.object({
    source: z.string().min(1, 'source must not be empty'),
    collection_id: z.string().uuid().optional().default(context.collectionId),
    title: z.string().min(1).optional(),
    metadata: z.record(z.any()).optional(),
  });

  return {
    definition: {
      name: ADD_DOCUMENT_TOOL_NAME,
      description:
        'Add a document to the RAG system from a file path or URL and trigger ingestion.',
      input_schema: zodToJsonSchema(inputSchema) as Tool['input_schema'],
    },
    executor: async (args: unknown) => {
      const parsed = inputSchema.parse(args);
      const collectionId = parsed.collection_id ?? context.collectionId;
      const source = parsed.source.trim();
      const metadata = parsed.metadata ?? {};

      const remote = isUrl(source);
      const download = remote ? await downloadRemoteFile(source) : await readLocalFile(source);
      const remoteDownload = remote ? (download as RemoteDownloadResult) : null;

      const referenceName = remoteDownload?.fileName ?? source;
      const contentType = inferContentType(
        referenceName,
        remoteDownload?.contentType ?? download.contentType
      );
      const extension = inferExtension(contentType, referenceName);
      const title = parsed.title?.trim()?.length ? parsed.title.trim() : inferTitle(referenceName);

      const document = await createDocument({
        collection_id: collectionId,
        title,
        file_path: undefined,
        content_type: contentType,
        file_size: download.buffer.length,
        source_url: remote ? source : undefined,
      });

      if (Object.keys(metadata).length > 0) {
        await db.query('UPDATE documents SET metadata = $1 WHERE id = $2', [metadata, document.id]);
      }

      const filePath = await writeDocumentFile(
        collectionId,
        document.id,
        extension,
        download.buffer
      );
      await updateDocumentStatusSafe(db, document.id, 'pending', undefined, filePath);

      ingestDocument(document.id).catch((error: unknown) => {
        console.error(`Ingestion failed for ${document.id}`, error);
      });

      return createToolResponse('Document queued for ingestion.', {
        doc_id: document.id,
        title,
        collection_id: collectionId,
        content_type: contentType,
        file_path: filePath,
        metadata,
      });
    },
  };
}

export function createFetchWebContentTool(
  db: Pool,
  context: ToolContext
): {
  definition: Tool;
  executor: ToolExecutor;
} {
  const inputSchema = z.object({
    url: z.string().url(),
    collection_id: z.string().uuid().optional().default(context.collectionId),
    mode: z.enum(['single', 'crawl']).optional().default('single'),
    max_pages: z.number().int().min(1).max(200).optional().default(25),
    title_prefix: z.string().min(1).optional(),
  });

  return {
    definition: {
      name: FETCH_WEB_CONTENT_TOOL_NAME,
      description:
        'Fetch web content (single page or crawl) and ingest it into the active collection.',
      input_schema: zodToJsonSchema(inputSchema) as Tool['input_schema'],
    },
    executor: async (args: unknown) => {
      const parsed = inputSchema.parse(args);
      const collectionId = parsed.collection_id ?? context.collectionId;
      const turndownService = createTurndownService();
      const initialUrl = normalizeUrl(parsed.url);
      const queue = [initialUrl];
      const pending = new Set(queue);
      const visited = new Set<string>();
      const processed: Array<{ docId: string; url: string; title: string }> = [];

      const browser = await chromium.launch({ headless: true });
      try {
        const context = await browser.newContext({
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        });
        const page = await context.newPage();

        while (queue.length > 0 && processed.length < parsed.max_pages) {
          const nextUrl = queue.shift();
          if (!nextUrl) {
            break;
          }
          pending.delete(nextUrl);

          const normalizedUrl = normalizeUrl(nextUrl);

          if (visited.has(normalizedUrl)) {
            continue;
          }

          visited.add(normalizedUrl);
          if (processed.length > 0) {
            // Avoid hammering target servers when crawling multiple pages.
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
          try {
            await page.goto(normalizedUrl, { waitUntil: 'networkidle', timeout: 30_000 });
          } catch (navigationError) {
            console.warn(`Failed to load ${normalizedUrl}`, navigationError);
            continue;
          }

          const title = await page.title();
          const content = await page.evaluate(() => {
            type ElementLike = {
              innerHTML?: string;
              innerText?: string;
            } | null;

            const selectors = ['main', 'article', '.content', '#content'];
            // biome-ignore lint/suspicious/noExplicitAny: This is necessary to bridge the server-side type checker with the browser context where `document` is a full DOM object.
            const doc = document as any;

            if (!doc) {
              return { html: '', text: '' };
            }

            const candidate = selectors
              .map((selector) => doc.querySelector(selector) as ElementLike)
              .find((node) => node && typeof node.innerText === 'string' && node.innerText.trim());

            const element =
              candidate ?? (doc.body as ElementLike) ?? (doc.documentElement as ElementLike);

            return {
              html: element?.innerHTML ?? '',
              text: element?.innerText ?? '',
            };
          });

          const markdown = convertHtmlToMarkdown(content.html, turndownService);
          const textFallback = (content.text ?? '').trim();

          if (!markdown && !textFallback) {
            console.warn(`No content extracted from ${normalizedUrl}`);
            continue;
          }

          const cleanedTitle = parsed.title_prefix
            ? `${parsed.title_prefix} - ${title || inferTitle(normalizedUrl)}`
            : title || inferTitle(normalizedUrl);

          const contentBuffer = Buffer.from(markdown || textFallback, 'utf-8');
          const document = await createDocument({
            collection_id: collectionId,
            title: cleanedTitle,
            file_path: undefined,
            content_type: 'text/markdown',
            file_size: contentBuffer.length,
            source_url: normalizedUrl,
          });

          const filePath = await writeDocumentFile(collectionId, document.id, '.md', contentBuffer);
          await updateDocumentStatusSafe(db, document.id, 'pending', undefined, filePath);

          ingestDocument(document.id).catch((error: unknown) => {
            console.error(`Ingestion failed for ${document.id}`, error);
          });

          processed.push({ docId: document.id, url: normalizedUrl, title: cleanedTitle });

          if (parsed.mode === 'crawl') {
            const discovered = await page.$$eval(
              'a[href]',
              (anchors, origin) => {
                const baseUrl = new URL(origin);
                const originHost = baseUrl.origin;

                return anchors
                  .map((anchor) => {
                    try {
                      type AnchorLike = {
                        href?: string;
                        getAttribute?: (attr: string) => string | null;
                      };
                      const node = anchor as AnchorLike;
                      const candidate: string | null = 
                        typeof node.href === 'string'
                          ? node.href
                          : typeof node.getAttribute === 'function'
                            ? node.getAttribute('href')
                            : null;

                      if (!candidate) {
                        return null;
                      }

                      return new URL(candidate, origin).href;
                    } catch {
                      return null;
                    }
                  })
                  .filter((href): href is string => typeof href === 'string')
                  .filter((href) => href.startsWith(originHost) && !href.includes('#'));
              },
              normalizedUrl
            );

            for (const link of discovered) {
              const normalisedLink = normalizeUrl(link);
              if (!visited.has(normalisedLink) && !pending.has(normalisedLink)) {
                queue.push(normalisedLink);
                pending.add(normalisedLink);
              }
            }
          }
        }
      } finally {
        await browser.close();
      }

      return createToolResponse(
        `Fetched and queued ${processed.length} page(s) for ingestion.`,
        processed
      );
    },
  };
}

export function createListCollectionsTool(db: Pool): { definition: Tool; executor: ToolExecutor } {
  return {
    definition: {
      name: LIST_COLLECTIONS_TOOL_NAME,
      description: 'List available collections with document counts.',
      input_schema: {
        type: 'object',
        properties: {},
      },
    },
    executor: async () => {
      const { rows } = await db.query<{ 
        id: string;
        name: string;
        description: string | null;
        doc_count: string;
        created_at: Date;
      }>(`
        SELECT
          c.id,
          c.name,
          c.description,
          COUNT(d.id)::text AS doc_count,
          c.created_at
        FROM collections c
        LEFT JOIN documents d ON d.collection_id = c.id
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `);

      const collections = rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        doc_count: Number(row.doc_count),
        created_at: row.created_at,
      }));

      return createToolResponse('Collections retrieved.', { collections });
    },
  };
}

export function createListDocumentsTool(
  db: Pool,
  context: ToolContext
): {
  definition: Tool;
  executor: ToolExecutor;
} {
  const inputSchema = z.object({
    collection_id: z.string().uuid().optional().default(context.collectionId),
    status:
      z
        .enum(['pending', 'extracting', 'chunking', 'embedding', 'complete', 'error', 'all'])
        .optional()
        .default('all'),
    limit: z.number().int().min(1).max(200).optional().default(50),
  });

  return {
    definition: {
      name: LIST_DOCUMENTS_TOOL_NAME,
      description: 'List documents in a collection with status information.',
      input_schema: zodToJsonSchema(inputSchema) as Tool['input_schema'],
    },
    executor: async (args: unknown) => {
      const parsed = inputSchema.parse(args);
      const collectionId = parsed.collection_id ?? context.collectionId;
      const params: Array<string | number> = [collectionId];
      let paramIndex = 2;

      let statusFilter = '';
      if (parsed.status && parsed.status !== 'all') {
        statusFilter = `AND d.status = $${paramIndex++}`;
        params.push(parsed.status);
      }

      params.push(parsed.limit);

      const { rows } = await db.query<{ 
        id: string;
        title: string;
        status: string;
        file_size: number | null;
        source_url: string | null;
        created_at: Date;
        updated_at: Date;
        chunk_count: string;
        token_count: string | null;
      }>(
        `
        SELECT
          d.id,
          d.title,
          d.status,
          d.file_size,
          d.source_url,
          d.created_at,
          d.updated_at,
          COUNT(ch.id)::text AS chunk_count,
          SUM(ch.token_count)::text AS token_count
        FROM documents d
        LEFT JOIN chunks ch ON ch.doc_id = d.id
        WHERE d.collection_id = $1
        ${statusFilter}
        GROUP BY d.id
        ORDER BY d.created_at DESC
        LIMIT $${paramIndex}
      `,
        params
      );

      const documents = rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        file_size: row.file_size,
        source_url: row.source_url,
        created_at: row.created_at,
        updated_at: row.updated_at,
        chunk_count: Number(row.chunk_count),
        token_count: row.token_count ? Number(row.token_count) : null,
      }));

      return createToolResponse(`Retrieved ${documents.length} document(s).`, { documents });
    },
  };
}

export function createGetDocumentStatusTool(db: Pool): {
  definition: Tool;
  executor: ToolExecutor;
} {
  const inputSchema = z.object({
    doc_id: z.string().uuid(),
  });

  return {
    definition: {
      name: GET_DOCUMENT_STATUS_TOOL_NAME,
      description: 'Check the processing status of a document.',
      input_schema: zodToJsonSchema(inputSchema) as Tool['input_schema'],
    },
    executor: async (args: unknown) => {
      const parsed = inputSchema.parse(args);
      const { rows } = await db.query<{ 
        id: string;
        title: string;
        status: string;
        error_message: string | null;
        created_at: Date;
        processed_at: Date | null;
        file_path: string | null;
        chunk_count: string;
        total_tokens: string | null;
      }>(
        `
        SELECT
          d.id,
          d.title,
          d.status,
          d.error_message,
          d.created_at,
          d.processed_at,
          d.file_path,
          COUNT(ch.id)::text AS chunk_count,
          SUM(ch.token_count)::text AS total_tokens
        FROM documents d
        LEFT JOIN chunks ch ON ch.doc_id = d.id
        WHERE d.id = $1
        GROUP BY d.id
      `,
        [parsed.doc_id]
      );

      if (rows.length === 0) {
        return createToolResponse(`Document ${parsed.doc_id} not found.`);
      }

      const doc = rows[0];
      const payload = {
        doc_id: doc.id,
        title: doc.title,
        status: doc.status,
        error: doc.error_message,
        created_at: doc.created_at,
        processed_at: doc.processed_at,
        chunk_count: Number(doc.chunk_count),
        total_tokens: doc.total_tokens ? Number(doc.total_tokens) : null,
        file_path: doc.file_path,
      };

      return createToolResponse(`Status retrieved for document ${doc.title}.`, payload);
    },
  };
}

export function createDeleteDocumentTool(db: Pool): { definition: Tool; executor: ToolExecutor } {
  const inputSchema = z.object({
    doc_id: z.string().uuid(),
    confirm: z.boolean().optional().default(false),
  });

  return {
    definition: {
      name: DELETE_DOCUMENT_TOOL_NAME,
      description: 'Delete a document and all associated chunks (requires confirm=true).',
      input_schema: zodToJsonSchema(inputSchema) as Tool['input_schema'],
    },
    executor: async (args: unknown) => {
      const parsed = inputSchema.parse(args);
      if (!parsed.confirm) {
        return createToolResponse(
          'Deletion not confirmed. Set confirm=true to permanently remove the document.'
        );
      }

      const document = await getDocument(parsed.doc_id);
      if (!document) {
        return createToolResponse(`Document ${parsed.doc_id} not found.`);
      }

      const client = await db.connect();
      try {
        await client.query('BEGIN');
        await deleteDocumentChunks(document.id, client);
        await client.query('DELETE FROM documents WHERE id = $1', [document.id]);
        await client.query('COMMIT');
        await deleteFileIfExists(document.file_path);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      return createToolResponse(`Document ${document.title} deleted.`, {
        doc_id: document.id,
        title: document.title,
      });
    },
  };
}

export function createRestartIngestTool(db: Pool): { definition: Tool; executor: ToolExecutor } {
  const inputSchema = z.object({
    doc_id: z.string().uuid(),
  });

  return {
    definition: {
      name: RESTART_INGEST_TOOL_NAME,
      description: 'Retry ingestion for a document that previously failed or is stuck.',
      input_schema: zodToJsonSchema(inputSchema) as Tool['input_schema'],
    },
    executor: async (args: unknown) => {
      const parsed = inputSchema.parse(args);
      const document = await getDocument(parsed.doc_id);
      if (!document) {
        return createToolResponse(`Document ${parsed.doc_id} not found.`);
      }

      if (!document.file_path) {
        return createToolResponse(`Document ${document.id} has no stored file to ingest.`);
      }

      await db.query(
        `UPDATE documents
         SET status = 'pending',
             error_message = NULL,
             processed_at = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [document.id]
      );

      ingestDocument(document.id).catch((error: unknown) => {
        console.error(`Re-ingestion failed for ${document.id}`, error);
      });

      return createToolResponse(`Re-ingestion started for document ${document.title}.`);
    },
  };
}

export function createSummarizeDocumentTool(_db: Pool): {
  definition: Tool;
  executor: ToolExecutor;
} {
  const inputSchema = z.object({
    doc_id: z.string().uuid(),
    max_chunks: z.number().int().min(1).max(25).optional().default(10),
  });

  return {
    definition: {
      name: SUMMARIZE_DOCUMENT_TOOL_NAME,
      description: 'Summarize a document using Claude based on its stored chunks.',
      input_schema: zodToJsonSchema(inputSchema) as Tool['input_schema'],
    },
    executor: async (args: unknown) => {
      const parsed = inputSchema.parse(args);
      if (!process.env.ANTHROPIC_API_KEY) {
        return createToolResponse(
          'Summarization unavailable: ANTHROPIC_API_KEY environment variable is not set.'
        );
      }

      const document = await getDocument(parsed.doc_id);
      if (!document) {
        return createToolResponse(`Document ${parsed.doc_id} not found.`);
      }

      const chunks = await getDocumentChunks(document.id);
      if (chunks.length === 0) {
        return createToolResponse(`Document ${document.title} has no chunks to summarize.`);
      }

      const selectedChunks = chunks.slice(0, parsed.max_chunks);
      const combinedText = selectedChunks.map((chunk) => chunk.text).join('\n\n');

      const client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const response = await client.messages.create({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 512,
        system:
          'You are a documentation assistant that summarizes technical documents concisely with key points and citations when possible.',
        messages: [
          {
            role: 'user',
            content: `Summarize the following document titled "${document.title}". Highlight the main points and include section references if provided.\n\n${combinedText}`,
          },
        ],
      });

      const summary = extractTextContent(response);

      return createToolResponse(`Summary generated for document ${document.title}.`, {
        doc_id: document.id,
        title: document.title,
        summary,
      });
    },
  };
}

function createTurndownService(): TurndownService {
  return new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
  });
}

function convertHtmlToMarkdown(html: string | null | undefined, service: TurndownService): string {
  const trimmed = (html ?? '').trim();
  if (!trimmed) {
    return '';
  }

  try {
    return service.turndown(trimmed).trim();
  } catch (error) {
    console.warn('Failed to convert HTML to Markdown', error);
    return '';
  }
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return url;
    }

    parsed.hash = '';
    parsed.searchParams.sort();

    if (parsed.pathname && parsed.pathname !== '/') {
      parsed.pathname = parsed.pathname.replace(/\/+/g, '/');
      parsed.pathname = parsed.pathname.replace(/\/+$/, '');
      if (parsed.pathname === '') {
        parsed.pathname = '/';
      }
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

function extractTextContent(
  response: Awaited<ReturnType<Anthropic['messages']['create']>>
): string {
  if (!('content' in response) || !Array.isArray(response.content)) {
    return '';
  }
  const textParts: string[] = [];
  const blocks = response.content;
  for (const block of blocks) {
    if (
      block &&
      typeof block === 'object' &&
      block.type === 'text' &&
      typeof block.text === 'string'
    ) {
      textParts.push(block.text);
    }
  }
  return textParts.join('\n').trim();
}

async function updateDocumentStatusSafe(
  db: Pool,
  documentId: string,
  status: string,
  errorMessage?: string,
  filePath?: string
): Promise<void> {
  await db.query(
    `UPDATE documents
     SET status = $1,
         error_message = $2,
         updated_at = NOW(),
         processed_at = CASE WHEN $1 = 'complete' THEN NOW() ELSE processed_at END,
         file_path = COALESCE($3, file_path)
     WHERE id = $4`,
    [status, errorMessage ?? null, filePath ?? null, documentId]
  );
}

export function buildAgentTools(
  db: Pool,
  context: ToolContext
): { tools: Tool[]; toolExecutors: Record<string, ToolExecutor> } {
  const toolBuilders = [
    createSearchRagTool(db, context),
    createAddDocumentTool(db, context),
    createFetchWebContentTool(db, context),
    createListCollectionsTool(db),
    createListDocumentsTool(db, context),
    createGetDocumentStatusTool(db),
    createDeleteDocumentTool(db),
    createRestartIngestTool(db),
    createSummarizeDocumentTool(db),
  ];

  const tools: Tool[] = [];
  const toolExecutors: Record<string, ToolExecutor> = {};

  for (const builder of toolBuilders) {
    tools.push(builder.definition);
    toolExecutors[builder.definition.name] = builder.executor;
  }

  return { tools, toolExecutors };
}