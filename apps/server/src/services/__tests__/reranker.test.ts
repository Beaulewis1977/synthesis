import { beforeEach, describe, expect, it, vi } from 'vitest';

const pipelineMock = vi.fn();
const cohereRerankMock = vi.fn();

vi.mock('@xenova/transformers', () => ({
  pipeline: pipelineMock,
}));

const CohereClientMock = vi.fn().mockImplementation(() => ({
  rerank: cohereRerankMock,
}));

vi.mock('cohere-ai', () => ({
  CohereClient: CohereClientMock,
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.RERANKER_PROVIDER = undefined;
  process.env.COHERE_API_KEY = undefined;
  process.env.RERANK_MAX_CANDIDATES = undefined;
  process.env.RERANK_DEFAULT_TOP_K = undefined;
  process.env.RERANK_BATCH_SIZE = undefined;
});

describe('reranker', () => {
  it('falls back to bge when cohere key missing', async () => {
    process.env.RERANKER_PROVIDER = 'cohere';

    const { selectRerankerProvider } = await import('../reranker.js');
    expect(selectRerankerProvider()).toBe('bge');
  });

  it('reranks with BGE scores', async () => {
    process.env.RERANKER_PROVIDER = 'bge';

    const rerankCalls = vi.fn(async (input: string) => {
      if (input.includes('Doc C')) {
        return { score: 0.9 };
      }
      if (input.includes('Doc B')) {
        return { score: 0.5 };
      }
      return { score: 0.2 };
    });

    pipelineMock.mockImplementationOnce(async () => rerankCalls);

    const { rerankResults } = await import('../reranker.js');

    const results = await rerankResults(
      'test query',
      [
        { id: 1, text: 'Doc A', similarity: 0.3 },
        { id: 2, text: 'Doc B', similarity: 0.4 },
        { id: 3, text: 'Doc C', similarity: 0.1 },
      ],
      { provider: 'bge', topK: 3 }
    );

    expect(pipelineMock).toHaveBeenCalledTimes(1);
    expect(rerankCalls).toHaveBeenCalledTimes(3);
    expect(results.map((item) => item.text)).toEqual(['Doc C', 'Doc B', 'Doc A']);
    expect(results[0].rerankProvider).toBe('bge');
    expect(results[0].rerankScore).toBeCloseTo(0.9);
    expect(results[0].originalSimilarity).toBe(0.1);
  });

  it('falls back to BGE when Cohere rerank fails', async () => {
    process.env.RERANKER_PROVIDER = 'cohere';
    process.env.COHERE_API_KEY = 'test-key';

    cohereRerankMock.mockRejectedValue(new Error('cohere failure'));

    const rerankCalls = vi.fn(async () => ({ score: 0.8 }));
    pipelineMock.mockImplementationOnce(async () => rerankCalls);

    const { rerankResults } = await import('../reranker.js');

    const results = await rerankResults(
      'q',
      [
        { id: 1, text: 'Doc 1', similarity: 0.2 },
        { id: 2, text: 'Doc 2', similarity: 0.4 },
      ],
      { provider: 'cohere', topK: 1 }
    );

    expect(cohereRerankMock).toHaveBeenCalledTimes(1);
    expect(rerankCalls).toHaveBeenCalled();
    expect(results[0].rerankProvider).toBe('bge');
    expect(results[0].rerankScore).toBeCloseTo(0.8);
  });

  it('returns original scores when provider set to none', async () => {
    const { rerankResults } = await import('../reranker.js');

    const original = [
      { id: 1, text: 'Alpha', similarity: 0.7 },
      { id: 2, text: 'Beta', similarity: 0.2 },
    ];

    const results = await rerankResults('q', original, { provider: 'none', topK: 2 });
    expect(results).toHaveLength(2);
    expect(results[0].rerankProvider).toBe('none');
    expect(results[0].rerankScore).toBeCloseTo(0.7);
    expect(results[1].rerankScore).toBeCloseTo(0.2);
  });
});
