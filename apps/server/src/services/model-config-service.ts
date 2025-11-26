/**
 * Model Config Service
 *
 * Phase 4: Centralized model configuration management.
 * Provides runtime model configuration with precedence: env → DB → default
 */

import {
  type ConfigSource,
  DEFAULT_MODEL_CONFIGS,
  FEATURE_ENV_VARS,
  type ModelConfig,
  type ModelConfigResponse,
  type ModelConfigRow,
  type ModelConfigUpdate,
  type ModelFeature,
  PROVIDER_INFO,
} from '@synthesis/shared';
import type { Pool } from 'pg';

/**
 * Valid feature names for model configuration
 */
const VALID_FEATURES: ModelFeature[] = [
  'chat',
  'summary',
  'ocr',
  'embedding_docs',
  'embedding_code',
  'embedding_writing',
  'reranker',
  'contradiction',
];

/**
 * Check if a string is a valid feature name
 */
export function isValidFeature(feature: string): feature is ModelFeature {
  return VALID_FEATURES.includes(feature as ModelFeature);
}

/**
 * Check if a provider is valid for a given feature
 */
export function isValidProviderForFeature(feature: ModelFeature, provider: string): boolean {
  // LLM features
  if (['chat', 'summary', 'ocr', 'contradiction'].includes(feature)) {
    return ['anthropic', 'openai', 'ollama', 'google'].includes(provider);
  }

  // Embedding features
  if (['embedding_docs', 'embedding_code', 'embedding_writing'].includes(feature)) {
    return ['ollama', 'openai', 'voyage', 'google'].includes(provider);
  }

  // Reranker feature
  if (feature === 'reranker') {
    return ['bge', 'cohere', 'none'].includes(provider);
  }

  return false;
}

/**
 * Check if a model is valid for a given provider
 */
export function isValidModelForProvider(provider: string, model: string): boolean {
  const providerInfo = PROVIDER_INFO[provider];
  if (!providerInfo) {
    return false;
  }

  // Allow any model for ollama (user may have custom models)
  if (provider === 'ollama') {
    return true;
  }

  return providerInfo.models.includes(model);
}

/**
 * Get configuration from environment variables for a feature
 */
function getEnvConfig(feature: ModelFeature): Partial<ModelConfig> | null {
  const envVars = FEATURE_ENV_VARS[feature];
  if (!envVars) {
    return null;
  }

  const provider = envVars.provider ? process.env[envVars.provider] : undefined;
  const model = envVars.model ? process.env[envVars.model] : undefined;

  if (!provider && !model) {
    return null;
  }

  return {
    ...(provider && { provider }),
    ...(model && { model }),
  };
}

/**
 * Model Configuration Service
 *
 * Manages model configurations with precedence:
 * 1. Environment variables (highest priority)
 * 2. Database configuration
 * 3. Default configuration (lowest priority)
 */
export class ModelConfigService {
  private db: Pool;
  private cache: Map<ModelFeature, { config: ModelConfig; timestamp: number }> = new Map();
  private readonly cacheTTL = 60_000; // 1 minute cache

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Get configuration for a specific feature
   */
  async getConfig(feature: ModelFeature): Promise<ModelConfig> {
    // Check cache first
    const cached = this.cache.get(feature);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.config;
    }

    const config = await this.resolveConfig(feature);

    // Update cache
    this.cache.set(feature, { config, timestamp: Date.now() });

    return config;
  }

  /**
   * Resolve configuration with precedence: env → DB → default
   */
  private async resolveConfig(feature: ModelFeature): Promise<ModelConfig> {
    const defaultConfig = DEFAULT_MODEL_CONFIGS[feature];
    if (!defaultConfig) {
      throw new Error(`Unknown feature: ${feature}`);
    }

    // Start with default
    let config: ModelConfig = { ...defaultConfig, source: 'default' as ConfigSource };

    // Check database for override
    const dbConfig = await this.getDbConfig(feature);
    if (dbConfig) {
      config = {
        feature,
        provider: dbConfig.provider,
        model: dbConfig.model,
        localOnly: dbConfig.local_only,
        enabled: dbConfig.enabled,
        source: 'db' as ConfigSource,
      };
    }

    // Check environment variables (highest priority)
    const envConfig = getEnvConfig(feature);
    if (envConfig) {
      config = {
        ...config,
        ...envConfig,
        source: 'env' as ConfigSource,
      };
    }

    return config;
  }

  /**
   * Get configuration from database
   */
  private async getDbConfig(feature: ModelFeature): Promise<ModelConfigRow | null> {
    try {
      const result = await this.db.query<ModelConfigRow>(
        `SELECT id, feature, provider, model, local_only, enabled, created_at, updated_at
         FROM model_configs
         WHERE feature = $1 AND enabled = true`,
        [feature]
      );

      return result.rows[0] ?? null;
    } catch (error) {
      // Table might not exist yet (migration not run)
      console.warn(`[ModelConfigService] Failed to query model_configs: ${error}`);
      return null;
    }
  }

  /**
   * Get chat model configuration
   */
  async getChatModelConfig(): Promise<ModelConfig> {
    return this.getConfig('chat');
  }

  /**
   * Get summary model configuration
   */
  async getSummaryModelConfig(): Promise<ModelConfig> {
    return this.getConfig('summary');
  }

  /**
   * Get OCR model configuration
   */
  async getOCRModelConfig(): Promise<ModelConfig> {
    return this.getConfig('ocr');
  }

  /**
   * Get embedding configuration for a content type
   */
  async getEmbeddingConfig(type: 'docs' | 'code' | 'writing'): Promise<ModelConfig> {
    const feature = `embedding_${type}` as ModelFeature;
    return this.getConfig(feature);
  }

  /**
   * Get reranker configuration
   */
  async getRerankerConfig(): Promise<ModelConfig> {
    return this.getConfig('reranker');
  }

  /**
   * Get contradiction detection model configuration
   */
  async getContradictionModelConfig(): Promise<ModelConfig> {
    return this.getConfig('contradiction');
  }

  /**
   * Get all feature configurations
   */
  async getAllConfigs(): Promise<ModelConfig[]> {
    const configs: ModelConfig[] = [];

    for (const feature of VALID_FEATURES) {
      const config = await this.getConfig(feature);
      configs.push(config);
    }

    return configs;
  }

  /**
   * Get full response with configs and provider info
   */
  async getModelConfigResponse(): Promise<ModelConfigResponse> {
    const configs = await this.getAllConfigs();

    return {
      configs,
      availableProviders: PROVIDER_INFO,
    };
  }

  /**
   * Update configuration for a feature (saves to database)
   */
  async setConfig(feature: ModelFeature, update: ModelConfigUpdate): Promise<ModelConfig> {
    if (!isValidFeature(feature)) {
      throw new Error(`Invalid feature: ${feature}`);
    }

    // Get current config to merge with update
    const currentConfig = await this.getConfig(feature);

    const provider = update.provider ?? currentConfig.provider;
    const model = update.model ?? currentConfig.model;
    const localOnly = update.localOnly ?? currentConfig.localOnly;
    const enabled = update.enabled ?? currentConfig.enabled;

    // Validate provider for feature
    if (!isValidProviderForFeature(feature, provider)) {
      throw new Error(`Invalid provider '${provider}' for feature '${feature}'`);
    }

    // Validate model for provider (skip for 'none' provider)
    if (provider !== 'none' && !isValidModelForProvider(provider, model)) {
      throw new Error(`Invalid model '${model}' for provider '${provider}'`);
    }

    // Check local-only constraint
    if (localOnly) {
      const providerInfo = PROVIDER_INFO[provider];
      if (providerInfo && !providerInfo.isLocal) {
        throw new Error(`Provider '${provider}' is not a local provider but local_only is enabled`);
      }
    }

    // Upsert to database
    await this.db.query(
      `INSERT INTO model_configs (feature, provider, model, local_only, enabled)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (feature) DO UPDATE SET
         provider = EXCLUDED.provider,
         model = EXCLUDED.model,
         local_only = EXCLUDED.local_only,
         enabled = EXCLUDED.enabled,
         updated_at = NOW()`,
      [feature, provider, model, localOnly, enabled]
    );

    // Invalidate cache
    this.cache.delete(feature);

    // Return updated config
    return this.getConfig(feature);
  }

  /**
   * Reset a feature to default configuration (removes DB override)
   */
  async resetConfig(feature: ModelFeature): Promise<ModelConfig> {
    if (!isValidFeature(feature)) {
      throw new Error(`Invalid feature: ${feature}`);
    }

    await this.db.query('DELETE FROM model_configs WHERE feature = $1', [feature]);

    // Invalidate cache
    this.cache.delete(feature);

    return this.getConfig(feature);
  }

  /**
   * Reset all configurations to defaults
   */
  async resetAllConfigs(): Promise<void> {
    await this.db.query('DELETE FROM model_configs');

    // Clear entire cache
    this.cache.clear();
  }

  /**
   * Clear the configuration cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Check if a provider's API key is configured
   */
  isApiKeyConfigured(provider: string): boolean {
    const providerInfo = PROVIDER_INFO[provider];
    if (!providerInfo || !providerInfo.requiresApiKey) {
      return true; // No API key required
    }

    const envVar = providerInfo.apiKeyEnvVar;
    if (!envVar) {
      return true;
    }

    const value = process.env[envVar];
    return Boolean(value && value.trim().length > 0);
  }

  /**
   * Get list of providers with missing API keys
   */
  getMissingApiKeys(): string[] {
    const missing: string[] = [];

    for (const [provider, info] of Object.entries(PROVIDER_INFO)) {
      if (info.requiresApiKey && info.apiKeyEnvVar) {
        const value = process.env[info.apiKeyEnvVar];
        if (!value || value.trim().length === 0) {
          missing.push(provider);
        }
      }
    }

    return missing;
  }
}

// Singleton instance (lazy initialization)
let modelConfigServiceInstance: ModelConfigService | null = null;

/**
 * Get the ModelConfigService singleton instance
 */
export function getModelConfigService(db: Pool): ModelConfigService {
  if (!modelConfigServiceInstance) {
    modelConfigServiceInstance = new ModelConfigService(db);
  }
  return modelConfigServiceInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetModelConfigService(): void {
  modelConfigServiceInstance = null;
}
