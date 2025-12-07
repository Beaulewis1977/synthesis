/**
 * Model Config Service Tests
 *
 * Phase 4: Unit tests for ModelConfigService
 */

import type { Pool, QueryResult } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ModelConfigService,
  getModelConfigService,
  isValidFeature,
  isValidModelForProvider,
  isValidProviderForFeature,
  resetModelConfigService,
} from '../model-config-service.js';

// Mock database pool
function createMockPool(queryResults: Record<string, unknown[]> = {}): Pool {
  const mockQuery = vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
    // Handle SELECT queries
    if (sql.includes('SELECT') && sql.includes('model_configs')) {
      const feature = params?.[0] as string;
      const rows = queryResults[feature] ?? [];
      return Promise.resolve({
        rows,
        rowCount: rows.length,
        command: '',
        oid: 0,
        fields: [],
      } as QueryResult);
    }

    // Handle INSERT/UPDATE/DELETE queries
    return Promise.resolve({
      rows: [],
      rowCount: 1,
      command: '',
      oid: 0,
      fields: [],
    } as QueryResult);
  });

  return {
    query: mockQuery,
  } as unknown as Pool;
}

describe('ModelConfigService', () => {
  beforeEach(() => {
    // Reset singleton and environment
    resetModelConfigService();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('isValidFeature', () => {
    it('should return true for valid features', () => {
      expect(isValidFeature('chat')).toBe(true);
      expect(isValidFeature('summary')).toBe(true);
      expect(isValidFeature('ocr')).toBe(true);
      expect(isValidFeature('embedding_docs')).toBe(true);
      expect(isValidFeature('embedding_code')).toBe(true);
      expect(isValidFeature('embedding_writing')).toBe(true);
      expect(isValidFeature('reranker')).toBe(true);
      expect(isValidFeature('contradiction')).toBe(true);
    });

    it('should return false for invalid features', () => {
      expect(isValidFeature('invalid')).toBe(false);
      expect(isValidFeature('')).toBe(false);
      expect(isValidFeature('CHAT')).toBe(false);
    });
  });

  describe('isValidProviderForFeature', () => {
    it('should validate LLM providers for chat feature', () => {
      expect(isValidProviderForFeature('chat', 'anthropic')).toBe(true);
      expect(isValidProviderForFeature('chat', 'openai')).toBe(true);
      expect(isValidProviderForFeature('chat', 'ollama')).toBe(true);
      expect(isValidProviderForFeature('chat', 'google')).toBe(true);
      expect(isValidProviderForFeature('chat', 'voyage')).toBe(false);
      expect(isValidProviderForFeature('chat', 'bge')).toBe(false);
    });

    it('should validate embedding providers for embedding features', () => {
      expect(isValidProviderForFeature('embedding_docs', 'ollama')).toBe(true);
      expect(isValidProviderForFeature('embedding_docs', 'openai')).toBe(true);
      expect(isValidProviderForFeature('embedding_docs', 'voyage')).toBe(true);
      expect(isValidProviderForFeature('embedding_docs', 'anthropic')).toBe(false);
    });

    it('should validate reranker providers', () => {
      expect(isValidProviderForFeature('reranker', 'bge')).toBe(true);
      expect(isValidProviderForFeature('reranker', 'cohere')).toBe(true);
      expect(isValidProviderForFeature('reranker', 'none')).toBe(true);
      expect(isValidProviderForFeature('reranker', 'anthropic')).toBe(false);
    });
  });

  describe('isValidModelForProvider', () => {
    it('should validate models for anthropic', () => {
      expect(isValidModelForProvider('anthropic', 'claude-3-5-haiku-latest')).toBe(true);
      expect(isValidModelForProvider('anthropic', 'claude-sonnet-4-5-20250929')).toBe(true);
      expect(isValidModelForProvider('anthropic', 'invalid-model')).toBe(false);
    });

    it('should allow any model for ollama', () => {
      expect(isValidModelForProvider('ollama', 'nomic-embed-text')).toBe(true);
      expect(isValidModelForProvider('ollama', 'custom-model')).toBe(true);
      expect(isValidModelForProvider('ollama', 'anything')).toBe(true);
    });

    it('should return false for unknown providers', () => {
      expect(isValidModelForProvider('unknown', 'any-model')).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('should return default config when no DB or env override', async () => {
      const mockPool = createMockPool();
      const service = new ModelConfigService(mockPool);

      const config = await service.getConfig('chat');

      expect(config.feature).toBe('chat');
      expect(config.provider).toBe('anthropic');
      expect(config.model).toBe('claude-3-5-haiku-latest');
      expect(config.source).toBe('default');
    });

    it('should return DB config when available', async () => {
      const mockPool = createMockPool({
        chat: [
          {
            id: '123',
            feature: 'chat',
            provider: 'openai',
            model: 'gpt-4.1-nano',
            local_only: false,
            enabled: true,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });
      const service = new ModelConfigService(mockPool);

      const config = await service.getConfig('chat');

      expect(config.provider).toBe('openai');
      expect(config.model).toBe('gpt-4.1-nano');
      expect(config.source).toBe('db');
    });

    it('should return env config when set (highest priority)', async () => {
      vi.stubEnv('CHAT_PROVIDER', 'ollama');
      vi.stubEnv('CHAT_MODEL', 'llama3.2');

      const mockPool = createMockPool({
        chat: [
          {
            id: '123',
            feature: 'chat',
            provider: 'openai',
            model: 'gpt-4.1-nano',
            local_only: false,
            enabled: true,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });
      const service = new ModelConfigService(mockPool);

      const config = await service.getConfig('chat');

      expect(config.provider).toBe('ollama');
      expect(config.model).toBe('llama3.2');
      expect(config.source).toBe('env');
    });

    it('should cache config results', async () => {
      const mockPool = createMockPool();
      const service = new ModelConfigService(mockPool);

      await service.getConfig('chat');
      await service.getConfig('chat');

      // Should only query once due to caching
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('convenience methods', () => {
    it('getChatModelConfig should return chat config', async () => {
      const mockPool = createMockPool();
      const service = new ModelConfigService(mockPool);

      const config = await service.getChatModelConfig();

      expect(config.feature).toBe('chat');
    });

    it('getSummaryModelConfig should return summary config', async () => {
      const mockPool = createMockPool();
      const service = new ModelConfigService(mockPool);

      const config = await service.getSummaryModelConfig();

      expect(config.feature).toBe('summary');
    });

    it('getOCRModelConfig should return ocr config', async () => {
      const mockPool = createMockPool();
      const service = new ModelConfigService(mockPool);

      const config = await service.getOCRModelConfig();

      expect(config.feature).toBe('ocr');
    });

    it('getEmbeddingConfig should return correct embedding config', async () => {
      const mockPool = createMockPool();
      const service = new ModelConfigService(mockPool);

      const docsConfig = await service.getEmbeddingConfig('docs');
      expect(docsConfig.feature).toBe('embedding_docs');

      const codeConfig = await service.getEmbeddingConfig('code');
      expect(codeConfig.feature).toBe('embedding_code');

      const writingConfig = await service.getEmbeddingConfig('writing');
      expect(writingConfig.feature).toBe('embedding_writing');
    });

    it('getRerankerConfig should return reranker config', async () => {
      const mockPool = createMockPool();
      const service = new ModelConfigService(mockPool);

      const config = await service.getRerankerConfig();

      expect(config.feature).toBe('reranker');
      expect(config.provider).toBe('bge');
    });
  });

  describe('getAllConfigs', () => {
    it('should return all feature configurations', async () => {
      const mockPool = createMockPool();
      const service = new ModelConfigService(mockPool);

      const configs = await service.getAllConfigs();

      expect(configs).toHaveLength(8);
      expect(configs.map((c) => c.feature)).toContain('chat');
      expect(configs.map((c) => c.feature)).toContain('summary');
      expect(configs.map((c) => c.feature)).toContain('ocr');
      expect(configs.map((c) => c.feature)).toContain('embedding_docs');
      expect(configs.map((c) => c.feature)).toContain('embedding_code');
      expect(configs.map((c) => c.feature)).toContain('embedding_writing');
      expect(configs.map((c) => c.feature)).toContain('reranker');
      expect(configs.map((c) => c.feature)).toContain('contradiction');
    });
  });

  describe('setConfig', () => {
    it('should update config in database', async () => {
      const mockPool = createMockPool();
      const service = new ModelConfigService(mockPool);

      await service.setConfig('chat', {
        provider: 'openai',
        model: 'gpt-4.1-nano',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO model_configs'),
        expect.arrayContaining(['chat', 'openai', 'gpt-4.1-nano'])
      );
    });

    it('should reject invalid provider for feature', async () => {
      const mockPool = createMockPool();
      const service = new ModelConfigService(mockPool);

      await expect(service.setConfig('chat', { provider: 'voyage' })).rejects.toThrow();
    });

    it('should reject invalid model for provider', async () => {
      const mockPool = createMockPool();
      const service = new ModelConfigService(mockPool);

      await expect(
        service.setConfig('chat', { provider: 'anthropic', model: 'invalid-model' })
      ).rejects.toThrow("Invalid model 'invalid-model' for provider 'anthropic'");
    });

    it('should reject non-local provider when localOnly is true', async () => {
      const mockPool = createMockPool();
      const service = new ModelConfigService(mockPool);

      await expect(
        service.setConfig('chat', { provider: 'anthropic', localOnly: true })
      ).rejects.toThrow("Provider 'anthropic' is not a local provider but local_only is enabled");
    });

    it('should invalidate cache after update', async () => {
      const mockPool = createMockPool();
      const service = new ModelConfigService(mockPool);

      // First call - caches result
      await service.getConfig('chat');

      // Update config
      await service.setConfig('chat', { provider: 'ollama', model: 'llama3.2' });

      // Second call - should query again (cache invalidated)
      await service.getConfig('chat');

      // Should have 3 queries: initial get, update, and get after invalidation
      expect(mockPool.query).toHaveBeenCalledTimes(3);
    });
  });

  describe('resetConfig', () => {
    it('should delete config from database', async () => {
      const mockPool = createMockPool();
      const service = new ModelConfigService(mockPool);

      await service.resetConfig('chat');

      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM model_configs WHERE feature = $1',
        expect.arrayContaining(['chat'])
      );
    });

    it('should return default config after reset', async () => {
      const mockPool = createMockPool();
      const service = new ModelConfigService(mockPool);

      const config = await service.resetConfig('chat');

      expect(config.source).toBe('default');
      expect(config.provider).toBe('anthropic');
    });
  });

  describe('resetAllConfigs', () => {
    it('should delete all configs from database', async () => {
      const mockPool = createMockPool();
      const service = new ModelConfigService(mockPool);

      await service.resetAllConfigs();

      expect(mockPool.query).toHaveBeenCalledWith('DELETE FROM model_configs');
    });
  });

  describe('isApiKeyConfigured', () => {
    it('should return true for local providers', () => {
      const mockPool = createMockPool();
      const service = new ModelConfigService(mockPool);

      expect(service.isApiKeyConfigured('ollama')).toBe(true);
      expect(service.isApiKeyConfigured('bge')).toBe(true);
    });

    it('should return true when API key is set', () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');

      const mockPool = createMockPool();
      const service = new ModelConfigService(mockPool);

      expect(service.isApiKeyConfigured('anthropic')).toBe(true);
    });

    it('should return false when API key is not set', () => {
      vi.stubEnv('ANTHROPIC_API_KEY', '');

      const mockPool = createMockPool();
      const service = new ModelConfigService(mockPool);

      expect(service.isApiKeyConfigured('anthropic')).toBe(false);
    });
  });

  describe('getMissingApiKeys', () => {
    it('should return list of providers with missing API keys', () => {
      vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
      vi.stubEnv('OPENAI_API_KEY', '');
      vi.stubEnv('VOYAGE_API_KEY', '');
      vi.stubEnv('COHERE_API_KEY', '');
      vi.stubEnv('GOOGLE_API_KEY', '');

      const mockPool = createMockPool();
      const service = new ModelConfigService(mockPool);

      const missing = service.getMissingApiKeys();

      expect(missing).not.toContain('anthropic');
      expect(missing).toContain('openai');
      expect(missing).toContain('voyage');
      expect(missing).toContain('cohere');
      expect(missing).toContain('google');
    });
  });

  describe('getModelConfigService singleton', () => {
    it('should return same instance on multiple calls', () => {
      const mockPool = createMockPool();

      const service1 = getModelConfigService(mockPool);
      const service2 = getModelConfigService(mockPool);

      expect(service1).toBe(service2);
    });

    it('should create new instance after reset', () => {
      const mockPool = createMockPool();

      const service1 = getModelConfigService(mockPool);
      resetModelConfigService();
      const service2 = getModelConfigService(mockPool);

      expect(service1).not.toBe(service2);
    });
  });
});
