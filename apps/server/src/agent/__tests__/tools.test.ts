import type { Pool } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildAgentTools,
  createAddDocumentTool,
  createDeleteDocumentTool,
  createFetchWebContentTool,
  createGetDocumentStatusTool,
  createListCollectionsTool,
  createListDocumentsTool,
  createSearchRagTool,
  createSummarizeDocumentTool,
} from '../tools.js';

const smartSearchMock = vi.hoisted(() => vi.fn());
const createDocumentMock = vi.hoisted(() => vi.fn());
const getDocumentMock = vi.hoisted(() => vi.fn());
const getDocumentChunksMock = vi.hoisted(() => vi.fn());
const ingestDocumentMock = vi.hoisted(() => vi.fn());
const downloadRemoteFileMock = vi.hoisted(() => vi.fn());
const readLocalFileMock = vi.hoisted(() => vi.fn());
const inferContentTypeMock = vi.hoisted(() => vi.fn());
const inferExtensionMock = vi.hoisted(() => vi.fn());
const inferTitleMock = vi.hoisted(() => vi.fn());
const isUrlMock = vi.hoisted(() => vi.fn());
const writeDocumentFileMock = vi.hoisted(() => vi.fn());
const anthropicCreateMock = vi.hoisted(() => vi.fn());
const fetchWebContentMock = vi.hoisted(() => vi.fn());
const deleteDocumentByIdMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/search.js', () => ({
  __esModule: true,
  smartSearch: smartSearchMock,
}));

vi.mock('@synthesis/db', () => ({
  __esModule: true,
  createDocument: createDocumentMock,
  getDocument: getDocumentMock,
  getDocumentChunks: getDocumentChunksMock,
}));

vi.mock('../../pipeline/orchestrator.js', () => ({
  __esModule: true,
  ingestDocument: ingestDocumentMock,
}));

vi.mock('../utils/storage.js', () => ({
  __esModule: true,
  downloadRemoteFile: downloadRemoteFileMock,
  readLocalFile: readLocalFileMock,
  inferContentType: inferContentTypeMock,
  inferExtension: inferExtensionMock,
  inferTitle: inferTitleMock,
  isUrl: isUrlMock,
  writeDocumentFile: writeDocumentFileMock,
}));

vi.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: anthropicCreateMock,
      },
    })),
  };
});

vi.mock('../../services/documentOperations.js', () => ({
  __esModule: true,
  fetchWebContent: fetchWebContentMock,
  deleteDocumentById: deleteDocumentByIdMock,
}));

function createDbMock() {
  const query = vi.fn().mockResolvedValue({ rows: [] });
  const connect = vi.fn().mockResolvedValue({
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  });

  return {
    query,
    connect,
  } as unknown as Pool;
}

describe('agent tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('search tool proxies to smartSearch', async () => {
    const db = createDbMock();
    smartSearchMock.mockResolvedValue({
      query: 'Test',
      results: [],
      totalResults: 0,
      searchTimeMs: 5,
      metadata: {
        searchMode: 'vector',
        vectorCount: 0,
        fusedCount: 0,
      },
    });

    const tool = createSearchRagTool(db, { collectionId: '11111111-1111-4111-8111-111111111111' });
    await tool.executor({ query: 'Test', collection_id: '11111111-1111-4111-8111-111111111111' });

    expect(smartSearchMock).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        query: 'Test',
        collectionId: '11111111-1111-4111-8111-111111111111',
        topK: 5,
        minSimilarity: 0.5,
      })
    );
  });

  it('add_document tool downloads remote file and triggers ingestion', async () => {
    const db = createDbMock();
    const buffer = Buffer.from('example');

    isUrlMock.mockReturnValue(true);
    downloadRemoteFileMock.mockResolvedValue({
      buffer,
      contentType: 'application/pdf',
      fileName: 'file.pdf',
    });
    inferContentTypeMock.mockReturnValue('application/pdf');
    inferExtensionMock.mockReturnValue('.pdf');
    inferTitleMock.mockReturnValue('Remote Doc');
    createDocumentMock.mockResolvedValue({ id: 'doc-1' });
    writeDocumentFileMock.mockResolvedValue('/storage/doc-1.pdf');
    ingestDocumentMock.mockResolvedValue(undefined);

    const tool = createAddDocumentTool(db, {
      collectionId: '11111111-1111-4111-8111-111111111111',
    });
    const result = await tool.executor({
      source: 'https://example.com/doc.pdf',
      collection_id: '11111111-1111-4111-8111-111111111111',
    });

    expect(result).toContain('Document queued for ingestion');
    expect(writeDocumentFileMock).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'doc-1',
      '.pdf',
      buffer
    );
    expect(ingestDocumentMock).toHaveBeenCalledWith('doc-1');
  });

  it('fetch_web_content tool delegates to service', async () => {
    const db = createDbMock();
    fetchWebContentMock.mockResolvedValue({
      processed: [
        {
          docId: 'doc-123',
          url: 'https://example.com',
          title: 'Example',
        },
      ],
    });

    const tool = createFetchWebContentTool(db, {
      collectionId: '11111111-1111-4111-8111-111111111111',
    });
    const result = await tool.executor({
      url: 'https://example.com',
      mode: 'single',
      max_pages: 5,
      collection_id: '11111111-1111-4111-8111-111111111111',
    });

    expect(fetchWebContentMock).toHaveBeenCalledWith(db, {
      url: 'https://example.com',
      collectionId: '11111111-1111-4111-8111-111111111111',
      mode: 'single',
      maxPages: 5,
      titlePrefix: undefined,
    });
    expect(result).toContain('Fetched and queued 1 page(s)');
    expect(result).toContain('doc-123');
  });

  it('list_collections tool returns formatted collections', async () => {
    const db = createDbMock();
    (db.query as vi.Mock).mockResolvedValue({
      rows: [
        {
          id: 'col-1',
          name: 'Collection 1',
          description: null,
          doc_count: '2',
          created_at: new Date('2024-01-01'),
        },
      ],
    });

    const tool = createListCollectionsTool(db);
    const result = await tool.executor({});

    expect(result).toContain('Collections retrieved');
    expect(result).toContain('"doc_count": 2');
  });

  it('list_documents tool queries documents with defaults', async () => {
    const db = createDbMock();
    (db.query as vi.Mock).mockResolvedValue({
      rows: [
        {
          id: 'doc-3',
          title: 'Doc 3',
          status: 'complete',
          file_size: 100,
          source_url: null,
          created_at: new Date(),
          updated_at: new Date(),
          chunk_count: '5',
          token_count: '500',
        },
      ],
    });

    const tool = createListDocumentsTool(db, {
      collectionId: '11111111-1111-4111-8111-111111111111',
    });
    const result = await tool.executor({ collection_id: '11111111-1111-4111-8111-111111111111' });

    expect(db.query as vi.Mock).toHaveBeenCalled();
    expect(result).toContain('Retrieved 1 document');
  });

  it('get_document_status tool returns not found message', async () => {
    const db = createDbMock();
    (db.query as vi.Mock).mockResolvedValue({ rows: [] });

    const tool = createGetDocumentStatusTool(db);
    const result = await tool.executor({ doc_id: '11111111-1111-4111-8111-111111111111' });

    expect(result).toContain('not found');
  });

  it('get_document_status tool returns document payload', async () => {
    const db = createDbMock();
    (db.query as vi.Mock).mockResolvedValue({
      rows: [
        {
          id: '11111111-1111-4111-8111-555555555555',
          title: 'Important Doc',
          status: 'complete',
          error_message: null,
          created_at: new Date('2025-01-01T00:00:00Z'),
          processed_at: new Date('2025-01-02T00:00:00Z'),
          file_path: '/storage/doc-5.md',
          chunk_count: '4',
          total_tokens: '1200',
        },
      ],
    });

    const tool = createGetDocumentStatusTool(db);
    const result = await tool.executor({
      doc_id: '11111111-1111-4111-8111-555555555555',
    });

    expect(result).toContain('Status retrieved for document Important Doc');
    expect(result).toContain('"chunk_count": 4');
  });

  it('delete_document tool requires explicit confirmation', async () => {
    const db = createDbMock();
    const tool = createDeleteDocumentTool(db);

    const result = await tool.executor({
      doc_id: '11111111-1111-4111-8111-333333333333',
      confirm: false,
    });

    expect(result).toContain('Deletion not confirmed');
    expect(deleteDocumentByIdMock).not.toHaveBeenCalled();
  });

  it('delete_document tool removes document when confirmed', async () => {
    const db = createDbMock();
    deleteDocumentByIdMock.mockResolvedValue({
      docId: '11111111-1111-4111-8111-666666666666',
      title: 'Deletable Doc',
    });

    const tool = createDeleteDocumentTool(db);
    const result = await tool.executor({
      doc_id: '11111111-1111-4111-8111-666666666666',
      confirm: true,
    });

    expect(deleteDocumentByIdMock).toHaveBeenCalledWith(db, {
      docId: '11111111-1111-4111-8111-666666666666',
    });
    expect(result).toContain('Document Deletable Doc deleted.');
  });

  it('summarize_document tool calls Anthropic API', async () => {
    const db = createDbMock();
    getDocumentMock.mockResolvedValue({
      id: '11111111-1111-4111-8111-222222222222',
      title: 'Doc 4',
    });
    getDocumentChunksMock.mockResolvedValue([
      { id: 1, text: 'Chunk 1' },
      { id: 2, text: 'Chunk 2' },
    ]);

    anthropicCreateMock.mockResolvedValue({
      id: 'msg-1',
      content: [{ type: 'text', text: 'Summary text' }],
    });

    process.env.ANTHROPIC_API_KEY = 'test-key';

    const tool = createSummarizeDocumentTool(db);
    const result = await tool.executor({ doc_id: '11111111-1111-4111-8111-222222222222' });

    expect(anthropicCreateMock).toHaveBeenCalled();
    expect(result).toContain('Summary generated');

    Reflect.deleteProperty(process.env, 'ANTHROPIC_API_KEY');
  });

  it('buildAgentTools returns full tool set with allowed names', () => {
    const db = createDbMock();
    const { tools, toolExecutors } = buildAgentTools(db, { collectionId: 'collection-1' });

    const expectedNames = [
      'search_rag',
      'add_document',
      'fetch_web_content',
      'list_collections',
      'list_documents',
      'get_document_status',
      'delete_document',
      'restart_ingest',
      'summarize_document',
    ];

    expect(tools.map((toolDef) => toolDef.name)).toEqual(expectedNames);
    for (const name of expectedNames) {
      expect(typeof toolExecutors[name]).toBe('function');
    }
  });
});
