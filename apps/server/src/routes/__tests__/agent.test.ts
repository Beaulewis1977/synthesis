import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agentRoutes } from '../agent.js';

const fetchWebContentMock = vi.hoisted(() => vi.fn());
const deleteDocumentByIdMock = vi.hoisted(() => vi.fn());
const getPoolMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/documentOperations.js', async () => {
  const actual = await vi.importActual<typeof import('../../services/documentOperations.js')>(
    '../../services/documentOperations.js'
  );

  return {
    __esModule: true,
    ...actual,
    fetchWebContent: fetchWebContentMock,
    deleteDocumentById: deleteDocumentByIdMock,
  };
});

vi.mock('@synthesis/db', () => ({
  __esModule: true,
  getPool: getPoolMock,
}));

const { DocumentNotFoundError } = await import('../../services/documentOperations.js');

describe('agent routes', () => {
  let fastify: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    fastify = Fastify();
    await fastify.register(agentRoutes);
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('POST /api/agent/fetch-web-content returns processed payload', async () => {
    const pool = {};
    getPoolMock.mockReturnValue(pool);
    fetchWebContentMock.mockResolvedValue({
      processed: [{ docId: 'doc-1', url: 'https://example.com', title: 'Example' }],
    });

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/agent/fetch-web-content',
      payload: {
        url: 'https://example.com',
        collection_id: '11111111-1111-4111-8111-111111111111',
        mode: 'crawl',
        max_pages: 5,
        title_prefix: 'Prefix',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(fetchWebContentMock).toHaveBeenCalledWith(pool, {
      url: 'https://example.com',
      collectionId: '11111111-1111-4111-8111-111111111111',
      mode: 'crawl',
      maxPages: 5,
      titlePrefix: 'Prefix',
    });
    expect(JSON.parse(response.payload)).toEqual({
      message: 'Fetched and queued 1 page(s) for ingestion.',
      processed: [{ docId: 'doc-1', url: 'https://example.com', title: 'Example' }],
    });
  });

  it('POST /api/agent/delete-document requires confirmation', async () => {
    const pool = {};
    getPoolMock.mockReturnValue(pool);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/agent/delete-document',
      payload: {
        doc_id: '11111111-1111-4111-8111-000000000000',
        confirm: false,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.payload)).toMatchObject({
      error: 'CONFIRMATION_REQUIRED',
    });
    expect(deleteDocumentByIdMock).not.toHaveBeenCalled();
  });

  it('POST /api/agent/delete-document deletes document', async () => {
    const pool = {};
    getPoolMock.mockReturnValue(pool);
    deleteDocumentByIdMock.mockResolvedValue({
      docId: '11111111-2222-3333-4444-555555555555',
      title: 'Old Doc',
    });

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/agent/delete-document',
      payload: {
        doc_id: '11111111-2222-3333-4444-555555555555',
        confirm: true,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(deleteDocumentByIdMock).toHaveBeenCalledWith(pool, {
      docId: '11111111-2222-3333-4444-555555555555',
    });
    expect(JSON.parse(response.payload)).toEqual({
      message: 'Document Old Doc deleted.',
      doc_id: '11111111-2222-3333-4444-555555555555',
      title: 'Old Doc',
    });
  });

  it('POST /api/agent/delete-document returns 404 when not found', async () => {
    const pool = {};
    getPoolMock.mockReturnValue(pool);
    deleteDocumentByIdMock.mockRejectedValue(
      new DocumentNotFoundError('11111111-2222-3333-4444-555555555555')
    );

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/agent/delete-document',
      payload: {
        doc_id: '11111111-2222-3333-4444-555555555555',
        confirm: true,
      },
    });

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.payload)).toMatchObject({
      error: 'DOCUMENT_NOT_FOUND',
    });
  });
});
