import type { Pool } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildAgentTools,
  createAddDocumentTool,
  createFetchWebContentTool,
  createListCollectionsTool,
  createListDocumentsTool,
  createSearchRagTool,
  createSummarizeDocumentTool,
} from '../tools.js';

const searchCollectionMock = vi.hoisted(() => vi.fn());
const createDocumentMock = vi.hoisted(() => vi.fn());
const deleteDocumentChunksMock = vi.hoisted(() => vi.fn());
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
const deleteFileIfExistsMock = vi.hoisted(() => vi.fn());
const chromiumLaunchMock = vi.hoisted(() => vi.fn());
const anthropicCreateMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/search.js', () => ({
  __esModule: true,
  searchCollection: searchCollectionMock,
}));

vi.mock('@synthesis/db', () => ({
  __esModule: true,
  createDocument: createDocumentMock,
  deleteDocumentChunks: deleteDocumentChunksMock,
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
  deleteFileIfExists: deleteFileIfExistsMock,
}));

vi.mock('playwright', () => ({
  __esModule: true,
  chromium: {
    launch: chromiumLaunchMock,
  },
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

function createDbMock() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  } as unknown as Pool;
}

describe('agent tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('search tool proxies to searchCollection', async () => {
    const db = createDbMock();
    searchCollectionMock.mockResolvedValue({
      query: 'Test',
      results: [],
      totalResults: 0,
      searchTimeMs: 5,
    });

    const tool = createSearchRagTool(db, { collectionId: '11111111-1111-4111-8111-111111111111' });
    await tool.executor({ query: 'Test', collection_id: '11111111-1111-4111-8111-111111111111' });

    expect(searchCollectionMock).toHaveBeenCalledWith(db, {
      query: 'Test',
      collectionId: '11111111-1111-4111-8111-111111111111',
      topK: 5,
      minSimilarity: 0.5,
    });
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

  it('fetch_web_content tool processes pages and queues ingestion', async () => {
    const db = createDbMock();
    const pageGoto = vi.fn();
    const pageTitle = vi.fn().mockResolvedValue('Sample Page');
    const pageEvaluate = vi.fn().mockResolvedValueOnce('Page content').mockResolvedValueOnce([]);
    const browserClose = vi.fn();

    chromiumLaunchMock.mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        goto: pageGoto,
        title: pageTitle,
        evaluate: pageEvaluate,
        $$eval: vi.fn().mockResolvedValue([]),
      }),
      close: browserClose,
    });

    createDocumentMock.mockResolvedValue({ id: 'doc-2' });
    writeDocumentFileMock.mockResolvedValue('/storage/doc-2.md');

    const tool = createFetchWebContentTool(db, {
      collectionId: '11111111-1111-4111-8111-111111111111',
    });
    const result = await tool.executor({
      url: 'https://example.com',
      mode: 'single',
      max_pages: 1,
      collection_id: '11111111-1111-4111-8111-111111111111',
    });

    expect(result).toContain('Fetched and queued 1 page');
    expect(createDocumentMock).toHaveBeenCalled();
    expect(writeDocumentFileMock).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'doc-2',
      '.md',
      expect.any(Buffer)
    );
    expect(browserClose).toHaveBeenCalled();
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
