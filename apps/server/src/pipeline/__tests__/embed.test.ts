import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __setOllamaClientForTesting,
  __setOpenAIClientForTesting,
  __setVoyageClientForTesting,
  embedBatch,
  embedText,
  embedTextToArray,
} from '../embed.js';

describe('embed pipeline', () => {
  const mockEmbeddings = vi.fn();
  const openAiCreate = vi.fn();
  const voyageEmbed = vi.fn();

  beforeEach(() => {
    mockEmbeddings.mockReset();
    openAiCreate.mockReset();
    voyageEmbed.mockReset();
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.VOYAGE_API_KEY = 'test-voyage-key';

    __setOllamaClientForTesting({
      embeddings: mockEmbeddings,
    });
    __setOpenAIClientForTesting({
      embeddings: {
        create: openAiCreate,
      },
    } as unknown as Parameters<typeof __setOpenAIClientForTesting>[0]);
    __setVoyageClientForTesting({
      embed: voyageEmbed,
    });
  });

  afterEach(() => {
    __setOllamaClientForTesting(null);
    __setOpenAIClientForTesting(null);
    __setVoyageClientForTesting(null);
    process.env.OPENAI_API_KEY = undefined;
    process.env.VOYAGE_API_KEY = undefined;
  });

  it('returns numeric vector from embedText', async () => {
    mockEmbeddings.mockResolvedValue({ embedding: Array(768).fill(0.25) });

    const result = await embedText('hello world');

    expect(result.embedding).toHaveLength(768);
    expect(result.embedding.every((value) => typeof value === 'number')).toBe(true);
    expect(result.provider).toBe('ollama');
    expect(result.usedFallback).toBe(false);
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

  it('routes to OpenAI when provider specified', async () => {
    openAiCreate.mockResolvedValue({
      data: [
        {
          embedding: Array(1536).fill(0.5),
        },
      ],
    });

    const result = await embedText('personal writing example', { provider: 'openai' });

    expect(openAiCreate).toHaveBeenCalledWith({
      model: 'text-embedding-3-large',
      input: 'personal writing example',
      dimensions: 1536,
    });
    expect(result.provider).toBe('openai');
    expect(result.embedding).toHaveLength(1536);
    expect(result.usedFallback).toBe(false);
  });

  it('routes to Voyage when provider specified', async () => {
    voyageEmbed.mockResolvedValue({
      data: [
        {
          embedding: Array(1024).fill(0.2),
        },
      ],
    });

    const result = await embedText('code example', { provider: 'voyage' });

    expect(voyageEmbed).toHaveBeenCalledWith({
      input: ['code example'],
      model: 'voyage-code-2',
    });
    expect(result.provider).toBe('voyage');
    expect(result.embedding).toHaveLength(1024);
    expect(result.usedFallback).toBe(false);
  });

  it('falls back to Ollama when primary provider fails', async () => {
    openAiCreate.mockRejectedValueOnce(new Error('openai unavailable'));
    mockEmbeddings.mockResolvedValue({ embedding: Array(4).fill(0.4) });

    const result = await embedText('fallback please', { provider: 'openai', retryDelayMs: 0 });

    expect(openAiCreate).toHaveBeenCalledTimes(1);
    expect(mockEmbeddings).toHaveBeenCalledTimes(1);
    expect(result.usedFallback).toBe(true);
    expect(result.provider).toBe('ollama');
    expect(result.embedding).toEqual([0.4, 0.4, 0.4, 0.4]);
  });

  it('throws when Ollama response is missing embedding array', async () => {
    mockEmbeddings.mockResolvedValue({ embedding: undefined });

    await expect(embedTextToArray('invalid response')).rejects.toThrow(/missing embedding array/);
  });

  it('throws when batchSize is invalid', async () => {
    await expect(embedBatch(['a'], { batchSize: 0 })).rejects.toThrow(/greater than zero/);
  });
});
