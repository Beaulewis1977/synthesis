import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __setOllamaClientForTesting, embedBatch, embedText, embedTextToArray } from '../embed.js';

describe('embed pipeline', () => {
  const mockEmbeddings = vi.fn();

  beforeEach(() => {
    mockEmbeddings.mockReset();
    __setOllamaClientForTesting({
      embeddings: mockEmbeddings,
    });
  });

  afterEach(() => {
    __setOllamaClientForTesting(null);
  });

  it('returns numeric vector from embedText', async () => {
    mockEmbeddings.mockResolvedValue({ embedding: Array(768).fill(0.25) });

    const result = await embedText('hello world');

    expect(result.embedding).toHaveLength(768);
    expect(result.embedding.every((value) => typeof value === 'number')).toBe(true);
    expect(result.provider).toBe('ollama');
    expect(mockEmbeddings).toHaveBeenCalledTimes(1);
    expect(mockEmbeddings).toHaveBeenCalledWith({
      model: 'nomic-embed-text',
      prompt: 'hello world',
    });
  });

  it('retries transient failures before succeeding', async () => {
    mockEmbeddings
      .mockRejectedValueOnce(new Error('network issue'))
      .mockRejectedValueOnce(new Error('still failing'))
      .mockResolvedValue({ embedding: Array(5).fill(1) });

    const result = await embedText('retry me', {
      model: 'custom-model',
      maxRetries: 3,
      retryDelayMs: 0,
    });

    expect(result.embedding).toEqual([1, 1, 1, 1, 1]);
    expect(mockEmbeddings).toHaveBeenCalledTimes(3);
  });

  it('processes texts in batches with embedBatch', async () => {
    mockEmbeddings.mockResolvedValue({ embedding: [0.1, 0.2, 0.3] });

    const texts = ['one', 'two', 'three'];
    const vectors = await embedBatch(texts, { batchSize: 2, retryDelayMs: 0 });

    expect(vectors).toHaveLength(3);
    expect(mockEmbeddings).toHaveBeenCalledTimes(3);
    expect(vectors.every((vector) => vector.embedding.length === 3)).toBe(true);
  });

  it('throws when Ollama response is missing embedding array', async () => {
    mockEmbeddings.mockResolvedValue({ embedding: undefined });

    await expect(embedTextToArray('invalid response')).rejects.toThrow(/missing embedding array/);
  });

  it('throws when batchSize is invalid', async () => {
    await expect(embedBatch(['a'], { batchSize: 0 })).rejects.toThrow(/greater than zero/);
  });
});
