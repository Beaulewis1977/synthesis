import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetProviderHealth,
  __setOllamaClientForTesting,
  __setOpenAIClientForTesting,
  __setVoyageClientForTesting,
  embedBatch,
  embedText,
  embedTextToArray,
  getProviderHealth,
} from '../embed.js';

describe('embed pipeline', () => {
  const mockEmbeddings = vi.fn();
  const openAiCreate = vi.fn();
  const voyageEmbed = vi.fn();

  beforeEach(() => {
    mockEmbeddings.mockReset();
    openAiCreate.mockReset();
    voyageEmbed.mockReset();
    __resetProviderHealth();
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
    // Suppress console output for cleaner test output
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockEmbeddings
      .mockRejectedValueOnce(new Error('network issue'))
      .mockRejectedValueOnce(new Error('still failing'))
      .mockResolvedValue({ embedding: Array(5).fill(1) });

    const result = await embedText('retry me', {
      model: 'custom-model',
    });

    expect(result.embedding).toEqual([1, 1, 1, 1, 1]);
    expect(mockEmbeddings).toHaveBeenCalledTimes(3);

    vi.restoreAllMocks();
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
      model: 'voyage-code-3',
    });
    expect(result.provider).toBe('voyage');
    expect(result.embedding).toHaveLength(1024);
    expect(result.usedFallback).toBe(false);
  });

  it('falls back to Ollama when primary provider fails', async () => {
    // Fail all retry attempts for OpenAI
    openAiCreate.mockRejectedValue(new Error('openai unavailable'));
    mockEmbeddings.mockResolvedValue({ embedding: Array(4).fill(0.4) });

    // Suppress console output for cleaner test output
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});

    const result = await embedText('fallback please', { provider: 'openai' });

    // Should try OpenAI 4 times (initial + 3 retries) then fall back to Ollama
    expect(openAiCreate).toHaveBeenCalledTimes(4);
    expect(mockEmbeddings).toHaveBeenCalledTimes(1);
    expect(result.usedFallback).toBe(true);
    expect(result.provider).toBe('ollama');
    expect(result.embedding).toEqual([0.4, 0.4, 0.4, 0.4]);

    vi.restoreAllMocks();
  });

  it('throws when Ollama response is missing embedding array', async () => {
    mockEmbeddings.mockResolvedValue({ embedding: undefined });

    // Suppress console output for cleaner test output
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(embedTextToArray('invalid response')).rejects.toThrow(/missing embedding array/);

    vi.restoreAllMocks();
  });

  it('throws when batchSize is invalid', async () => {
    await expect(embedBatch(['a'], { batchSize: 0 })).rejects.toThrow(/greater than zero/);
  });

  describe('retry logic and logging', () => {
    it('retries with exponential backoff before fallback', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Fail Voyage 3 times (trigger all retries), then succeed with Ollama fallback
      voyageEmbed
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Rate limit'))
        .mockRejectedValueOnce(new Error('Service unavailable'));

      mockEmbeddings.mockResolvedValue({ embedding: Array(768).fill(0.1) });

      const result = await embedText('test retry', { provider: 'voyage' });

      // Should succeed with fallback
      expect(result.provider).toBe('ollama');
      expect(result.usedFallback).toBe(true);

      // Should have tried Voyage 4 times (initial + 3 retries)
      expect(voyageEmbed).toHaveBeenCalledTimes(4);

      // Should log 3 retry attempts
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Embed] Retry attempt 1/3')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Embed] Retry attempt 2/3')
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Embed] Retry attempt 3/3')
      );

      // Should log exhausted retries and fallback
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Embed] All retries exhausted')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Embed] Primary provider failed after retries')
      );

      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('logs fallback success with original provider info', async () => {
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      openAiCreate.mockRejectedValue(new Error('OpenAI API down'));
      mockEmbeddings.mockResolvedValue({ embedding: Array(768).fill(0.2) });

      const result = await embedText('fallback test', { provider: 'openai' });

      expect(result.provider).toBe('ollama');
      expect(result.usedFallback).toBe(true);

      // Should log fallback warning
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Embed] Falling back: openai/text-embedding-3-large -> ollama/')
      );

      // Should log fallback success
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Embed] Fallback succeeded: ollama/')
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('(original: openai/text-embedding-3-large)')
      );

      consoleInfoSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('provider health tracking', () => {
    it('tracks successful embeddings', async () => {
      mockEmbeddings.mockResolvedValue({ embedding: Array(768).fill(0.5) });

      await embedText('test 1');
      await embedText('test 2');

      const health = getProviderHealth();
      const ollamaHealth = health.get('ollama');

      expect(ollamaHealth).toBeDefined();
      expect(ollamaHealth?.success).toBe(2);
      expect(ollamaHealth?.failure).toBe(0);
    });

    it('tracks failed embeddings with fallback', async () => {
      openAiCreate.mockRejectedValue(new Error('API error'));
      mockEmbeddings.mockResolvedValue({ embedding: Array(768).fill(0.3) });

      // Suppress console output for cleaner test output
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'info').mockImplementation(() => {});

      await embedText('test openai fail', { provider: 'openai' });

      const health = getProviderHealth();
      const openaiHealth = health.get('openai');
      const ollamaHealth = health.get('ollama');

      expect(openaiHealth?.failure).toBe(1);
      expect(openaiHealth?.success).toBe(0);
      expect(openaiHealth?.lastFailure).toBeInstanceOf(Date);

      expect(ollamaHealth?.success).toBe(1);
      expect(ollamaHealth?.failure).toBe(0);

      vi.restoreAllMocks();
    });

    it('tracks multiple provider failures independently', async () => {
      openAiCreate.mockRejectedValue(new Error('OpenAI down'));
      voyageEmbed.mockRejectedValue(new Error('Voyage down'));
      mockEmbeddings.mockResolvedValue({ embedding: Array(768).fill(0.1) });

      // Suppress console output
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'info').mockImplementation(() => {});

      await embedText('openai test', { provider: 'openai' });
      await embedText('voyage test', { provider: 'voyage' });

      const health = getProviderHealth();

      expect(health.get('openai')?.failure).toBe(1);
      expect(health.get('voyage')?.failure).toBe(1);
      expect(health.get('ollama')?.success).toBe(2);

      vi.restoreAllMocks();
    });
  });
});
