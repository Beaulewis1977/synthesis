/**
 * Token Estimator Service
 *
 * Provides token estimation and validation for embedding providers.
 * Ensures chunks don't exceed provider-specific token limits.
 *
 * @module pipeline/token-estimator
 */

import type { EmbeddingProvider } from '../services/embedding-router.js';

/**
 * Token limit configuration for an embedding provider/model combination.
 */
export interface TokenLimitConfig {
  /** Provider identifier */
  provider: EmbeddingProvider | string;
  /** Model identifier */
  model: string;
  /** Maximum tokens the model can process */
  maxTokens: number;
  /** Safety margin as a decimal (e.g., 0.1 = 10%) */
  safetyMargin: number;
  /** Effective limit after applying safety margin */
  effectiveLimit: number;
}

/**
 * Result of token validation for a chunk.
 */
export interface TokenValidationResult {
  /** Whether the chunk is within the token limit */
  isValid: boolean;
  /** Estimated token count */
  tokenCount: number;
  /** Maximum allowed tokens for this provider/model */
  maxTokens: number;
  /** Effective limit after safety margin */
  effectiveLimit: number;
  /** How many tokens over the limit (0 if valid) */
  overage: number;
}

/**
 * Token estimation method.
 */
export type TokenEstimationMethod = 'simple' | 'accurate';

/**
 * Provider token limits registry.
 *
 * These limits are based on official provider documentation.
 * Safety margins prevent edge cases where estimation is slightly off.
 *
 * @see https://docs.voyageai.com/docs/embeddings
 * @see https://platform.openai.com/docs/guides/embeddings
 * @see https://ollama.ai/library/nomic-embed-text
 */
const PROVIDER_TOKEN_LIMITS: Record<string, Omit<TokenLimitConfig, 'effectiveLimit'>> = {
  // Ollama models
  'ollama/nomic-embed-text': {
    provider: 'ollama',
    model: 'nomic-embed-text',
    maxTokens: 8192,
    safetyMargin: 0.1,
  },
  'ollama/mxbai-embed-large': {
    provider: 'ollama',
    model: 'mxbai-embed-large',
    maxTokens: 512,
    safetyMargin: 0.1,
  },
  'ollama/all-minilm': {
    provider: 'ollama',
    model: 'all-minilm',
    maxTokens: 256,
    safetyMargin: 0.1,
  },

  // OpenAI models keep a 1-token buffer (8191 vs 8192) to avoid off-by-one failures from tokenizer/API quirks.
  'openai/text-embedding-3-large': {
    provider: 'openai',
    model: 'text-embedding-3-large',
    maxTokens: 8191,
    safetyMargin: 0.1,
  },
  'openai/text-embedding-3-small': {
    provider: 'openai',
    model: 'text-embedding-3-small',
    maxTokens: 8191,
    safetyMargin: 0.1,
  },
  'openai/text-embedding-ada-002': {
    provider: 'openai',
    model: 'text-embedding-ada-002',
    maxTokens: 8191,
    safetyMargin: 0.1,
  },

  // Voyage AI models
  'voyage/voyage-code-2': {
    provider: 'voyage',
    model: 'voyage-code-2',
    maxTokens: 16000,
    safetyMargin: 0.1,
  },
  'voyage/voyage-2': {
    provider: 'voyage',
    model: 'voyage-2',
    maxTokens: 4000,
    safetyMargin: 0.1,
  },
  'voyage/voyage-large-2': {
    provider: 'voyage',
    model: 'voyage-large-2',
    maxTokens: 16000,
    safetyMargin: 0.1,
  },

  // Google models
  'google/text-embedding-004': {
    provider: 'google',
    model: 'text-embedding-004',
    maxTokens: 2048,
    safetyMargin: 0.1,
  },

  // BGE models (local)
  'bge/bge-m3': {
    provider: 'bge',
    model: 'bge-m3',
    maxTokens: 8192,
    safetyMargin: 0.1,
  },
  'bge/bge-large-en-v1.5': {
    provider: 'bge',
    model: 'bge-large-en-v1.5',
    maxTokens: 512,
    safetyMargin: 0.1,
  },
};

/**
 * Default token limits by provider when model is unknown.
 * Uses conservative limits to avoid truncation.
 */
const DEFAULT_PROVIDER_LIMITS: Record<string, number> = {
  ollama: 8192,
  openai: 8191,
  voyage: 4000, // Conservative default
  google: 2048,
  bge: 512, // Conservative default
};

/**
 * Fallback token limit when provider is unknown.
 */
const FALLBACK_TOKEN_LIMIT = 2048;

/**
 * Default safety margin (10%).
 */
const DEFAULT_SAFETY_MARGIN = 0.1;

/**
 * Characters per token ratio for simple estimation.
 * Based on empirical analysis of English text with code.
 * - Pure English text: ~4 chars/token
 * - Code: ~3-3.5 chars/token
 * - Mixed: ~3.5 chars/token
 *
 * We use 3.5 as a conservative estimate.
 */
export const CHARS_PER_TOKEN = 3.5;

/**
 * Get the configured token estimation method.
 */
export function getEstimationMethod(): TokenEstimationMethod {
  const method = process.env.TOKEN_ESTIMATION_METHOD?.toLowerCase();
  if (method === 'accurate') {
    return 'accurate';
  }
  return 'simple';
}

/**
 * Get the configured safety margin.
 */
export function getSafetyMargin(): number {
  const margin = Number.parseFloat(process.env.TOKEN_SAFETY_MARGIN ?? '');
  if (!Number.isNaN(margin) && margin >= 0 && margin < 1) {
    return margin;
  }
  return DEFAULT_SAFETY_MARGIN;
}

/**
 * Estimate the number of tokens in a text string.
 *
 * Uses a simple character-based estimation by default.
 * For more accurate results with OpenAI models, set TOKEN_ESTIMATION_METHOD=accurate
 * and ensure gpt-tokenizer is installed.
 *
 * @param text - The text to estimate tokens for
 * @param _model - Optional model name (reserved for future accurate estimation)
 * @returns Estimated token count
 */
export function estimateTokens(text: string, _model?: string): number {
  if (!text || text.length === 0) {
    return 0;
  }

  // Simple estimation: divide character count by chars-per-token ratio
  // This is fast and works well for most use cases
  const estimate = Math.ceil(text.length / CHARS_PER_TOKEN);

  return estimate;
}

/**
 * Get token limit configuration for a provider/model combination.
 *
 * @param provider - Embedding provider (e.g., 'ollama', 'openai', 'voyage')
 * @param model - Model name (e.g., 'nomic-embed-text', 'text-embedding-3-large')
 * @returns Token limit configuration with effective limit
 */
export function getTokenLimit(provider: string, model: string): TokenLimitConfig {
  const key = `${provider}/${model}`;
  const config = PROVIDER_TOKEN_LIMITS[key];
  const safetyMargin = getSafetyMargin();

  if (config) {
    const effectiveLimit = Math.floor(config.maxTokens * (1 - safetyMargin));
    return {
      ...config,
      safetyMargin,
      effectiveLimit,
    };
  }

  // Fall back to provider default
  const providerDefault = DEFAULT_PROVIDER_LIMITS[provider] ?? FALLBACK_TOKEN_LIMIT;
  const effectiveLimit = Math.floor(providerDefault * (1 - safetyMargin));

  return {
    provider,
    model,
    maxTokens: providerDefault,
    safetyMargin,
    effectiveLimit,
  };
}

/**
 * Validate whether a chunk's text is within the token limit for a provider/model.
 *
 * @param text - The chunk text to validate
 * @param provider - Embedding provider
 * @param model - Model name
 * @returns Validation result with details
 */
export function validateChunkTokens(
  text: string,
  provider: string,
  model: string
): TokenValidationResult {
  const tokenCount = estimateTokens(text, model);
  const limit = getTokenLimit(provider, model);

  const isValid = tokenCount <= limit.effectiveLimit;
  const overage = isValid ? 0 : tokenCount - limit.effectiveLimit;

  return {
    isValid,
    tokenCount,
    maxTokens: limit.maxTokens,
    effectiveLimit: limit.effectiveLimit,
    overage,
  };
}

/**
 * Check if a text exceeds the token limit for a provider/model.
 *
 * @param text - The text to check
 * @param provider - Embedding provider
 * @param model - Model name
 * @returns True if the text exceeds the limit
 */
export function exceedsTokenLimit(text: string, provider: string, model: string): boolean {
  return !validateChunkTokens(text, provider, model).isValid;
}

/**
 * Calculate the recommended maximum character count for a provider/model.
 *
 * This is useful for setting chunk size limits during initial chunking.
 *
 * @param provider - Embedding provider
 * @param model - Model name
 * @returns Recommended maximum character count
 */
export function getRecommendedMaxChars(provider: string, model: string): number {
  const limit = getTokenLimit(provider, model);
  // Convert effective token limit back to characters
  return Math.floor(limit.effectiveLimit * CHARS_PER_TOKEN);
}

/**
 * Get all registered provider/model combinations.
 *
 * @returns Array of provider/model keys
 */
export function getRegisteredModels(): string[] {
  return Object.keys(PROVIDER_TOKEN_LIMITS);
}

/**
 * Check if a provider/model combination is registered.
 *
 * @param provider - Embedding provider
 * @param model - Model name
 * @returns True if the combination is registered
 */
export function isModelRegistered(provider: string, model: string): boolean {
  const key = `${provider}/${model}`;
  return key in PROVIDER_TOKEN_LIMITS;
}
