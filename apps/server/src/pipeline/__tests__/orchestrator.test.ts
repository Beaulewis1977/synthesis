import { beforeEach, describe, expect, it, vi } from 'vitest';

const readFileMock = vi.fn<(path: string) => Promise<Buffer>>();

const getDocumentMock = vi.fn();
const updateDocumentStatusMock = vi.fn();
const updateDocumentMetadataMock = vi.fn();
const extractMock = vi.fn();
const chunkTextMock = vi.fn();
const embedBatchMock = vi.fn();
const storeChunksMock = vi.fn();

vi.mock('node:fs/promises', () => ({
  __esModule: true,
  default: {
    readFile: readFileMock,
  },
  readFile: readFileMock,
}));

vi.mock('@synthesis/db', () => ({
  __esModule: true,
  getDocument: (...args: unknown[]) => getDocumentMock(...args),
  updateDocumentStatus: (...args: unknown[]) => updateDocumentStatusMock(...args),
  updateDocumentMetadata: (...args: unknown[]) => updateDocumentMetadataMock(...args),
}));

vi.mock('../extract.js', () => ({
  __esModule: true,
  extract: (...args: unknown[]) => extractMock(...args),
}));

vi.mock('../chunk.js', () => ({
  __esModule: true,
  chunkText: (...args: unknown[]) => chunkTextMock(...args),
}));

vi.mock('../embed.js', () => ({
  __esModule: true,
  embedBatch: (...args: unknown[]) => embedBatchMock(...args),
}));

vi.mock('../store.js', () => ({
  __esModule: true,
  storeChunks: (...args: unknown[]) => storeChunksMock(...args),
}));

const documentFixture = {
  id: 'doc-123',
  collection_id: 'col-1',
  title: 'test.txt',
  file_path: '/tmp/doc-123.txt',
  content_type: 'text/plain',
  file_size: 12,
  source_url: null,
  status: 'pending',
  error_message: null,
  metadata: {},
  created_at: new Date(),
  processed_at: null,
  updated_at: new Date(),
};

const chunksFixture = [
  { text: 'chunk-1', index: 0, metadata: { startOffset: 0, endOffset: 7 } },
  { text: 'chunk-2', index: 1, metadata: { startOffset: 7, endOffset: 14 } },
];

const embeddingResultsFixture = [
  {
    embedding: [0.1, 0.2],
    provider: 'ollama',
    model: 'nomic-embed-text',
    dimensions: 768,
    usedFallback: false,
  },
  {
    embedding: [0.3, 0.4],
    provider: 'ollama',
    model: 'nomic-embed-text',
    dimensions: 768,
    usedFallback: false,
  },
];

describe('ingestDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getDocumentMock.mockResolvedValue({ ...documentFixture });
    readFileMock.mockResolvedValue(Buffer.from('file-content'));
    extractMock.mockResolvedValue({ text: 'combined text', metadata: { pageCount: 1 } });
    chunkTextMock.mockReturnValue([...chunksFixture]);
    embedBatchMock.mockResolvedValue([...embeddingResultsFixture]);
    storeChunksMock.mockResolvedValue(undefined);
    updateDocumentMetadataMock.mockResolvedValue(undefined);
  });

  it('orchestrates the full pipeline and updates statuses sequentially', async () => {
    const { ingestDocument } = await import('../orchestrator.js');

    await ingestDocument('doc-123', {
      chunk: { maxSize: 100, overlap: 20 },
      embed: { model: 'custom-model', batchSize: 2 },
    });

    expect(getDocumentMock).toHaveBeenCalledWith('doc-123');
    expect(readFileMock).toHaveBeenCalledWith('/tmp/doc-123.txt');
    expect(extractMock).toHaveBeenCalledWith(expect.any(Buffer), 'text/plain', 'test.txt');
    expect(chunkTextMock).toHaveBeenCalledWith(
      'combined text',
      { maxSize: 100, overlap: 20 },
      {
        pageCount: 1,
        documentId: 'doc-123',
      }
    );
    expect(embedBatchMock).toHaveBeenCalledWith(['chunk-1', 'chunk-2'], {
      model: 'custom-model',
      batchSize: 2,
      context: expect.objectContaining({
        type: 'docs',
        collectionId: 'col-1',
      }),
      contexts: [
        expect.objectContaining({ type: 'docs', collectionId: 'col-1' }),
        expect.objectContaining({ type: 'docs', collectionId: 'col-1' }),
      ],
    });
    expect(storeChunksMock).toHaveBeenCalledWith(
      'doc-123',
      [
        expect.objectContaining({
          metadata: expect.objectContaining({
            embedding_provider: 'ollama',
            embedding_model: 'nomic-embed-text',
            embedding_dimensions: 768,
          }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            embedding_provider: 'ollama',
            embedding_model: 'nomic-embed-text',
            embedding_dimensions: 768,
          }),
        }),
      ],
      [
        [0.1, 0.2],
        [0.3, 0.4],
      ],
      {
        embeddingModel: 'nomic-embed-text',
        embeddingProvider: 'ollama',
        embeddingDimensions: 768,
      }
    );

    expect(updateDocumentStatusMock).toHaveBeenNthCalledWith(1, 'doc-123', 'extracting');
    expect(updateDocumentStatusMock).toHaveBeenNthCalledWith(2, 'doc-123', 'chunking');
    expect(updateDocumentStatusMock).toHaveBeenNthCalledWith(3, 'doc-123', 'embedding');
    expect(updateDocumentStatusMock).toHaveBeenLastCalledWith('doc-123', 'complete');
    expect(updateDocumentMetadataMock).toHaveBeenCalledWith(
      'doc-123',
      expect.objectContaining({
        doc_type: 'tutorial',
        source_quality: 'community',
        embedding_provider: 'ollama',
        embedding_model: 'nomic-embed-text',
        embedding_dimensions: 768,
        file_path: '/tmp/doc-123.txt',
      })
    );
  });

  it('short-circuits embedding when no chunks are produced', async () => {
    chunkTextMock.mockReturnValueOnce([]);

    const { ingestDocument } = await import('../orchestrator.js');

    await ingestDocument('doc-123');

    expect(embedBatchMock).not.toHaveBeenCalled();
    expect(storeChunksMock).toHaveBeenCalledWith('doc-123', [], []);
    expect(updateDocumentStatusMock).toHaveBeenNthCalledWith(1, 'doc-123', 'extracting');
    expect(updateDocumentStatusMock).toHaveBeenNthCalledWith(2, 'doc-123', 'chunking');
    expect(updateDocumentStatusMock).toHaveBeenLastCalledWith('doc-123', 'complete');
  });

  it('marks document as error when any stage fails', async () => {
    extractMock.mockRejectedValueOnce(new Error('boom'));

    const { ingestDocument } = await import('../orchestrator.js');

    await expect(ingestDocument('doc-123')).rejects.toThrow('boom');

    const statuses = updateDocumentStatusMock.mock.calls.map((call) => call[1]);
    expect(statuses).toContain('error');
    const errorCall = updateDocumentStatusMock.mock.calls.find((call) => call[1] === 'error');
    expect(errorCall?.[2]).toBe('boom');
    expect(storeChunksMock).not.toHaveBeenCalled();
    expect(updateDocumentMetadataMock).not.toHaveBeenCalled();
  });
});
