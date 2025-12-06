/**
 * Chat Provider Registry
 *
 * Phase 16A: Registry pattern for multi-provider chat support.
 * Follows singleton pattern from model-config-service.ts.
 */

import { PROVIDER_INFO } from '@synthesis/shared';
import type { Pool } from 'pg';
import { getApiKeyService } from '../api-key-service.js';
import { getModelConfigService } from '../model-config-service.js';
import type { ChatProvider, ChatProviderFactory, ChatProviderType } from './types.js';

// =============================================================================
// Provider Registry
// =============================================================================

/** Provider factory registry */
const providerFactories = new Map<ChatProviderType, ChatProviderFactory>();

/** Cached provider instances (lazy initialization) */
const providerInstances = new Map<ChatProviderType, ChatProvider>();

/**
 * Register a chat provider factory
 * Called at module load time by provider implementations
 */
export function registerChatProvider(name: ChatProviderType, factory: ChatProviderFactory): void {
  providerFactories.set(name, factory);
}

/**
 * Get a chat provider by name (cached)
 * @throws Error if provider not registered
 */
export function getChatProvider(name: ChatProviderType): ChatProvider {
  // Check cache first
  let provider = providerInstances.get(name);
  if (provider) {
    return provider;
  }

  // Get factory
  const factory = providerFactories.get(name);
  if (!factory) {
    throw new Error(
      `Unknown chat provider: ${name}. ` +
        `Available providers: ${Array.from(providerFactories.keys()).join(', ')}`
    );
  }

  // Create and cache instance
  provider = factory();
  providerInstances.set(name, provider);
  return provider;
}

/**
 * Get the configured chat provider from ModelConfigService
 * Uses the 'chat' feature configuration
 */
export async function getConfiguredChatProvider(db: Pool): Promise<ChatProvider> {
  const configService = getModelConfigService(db);
  const config = await configService.getChatModelConfig();

  const providerName = config.provider as ChatProviderType;
  const provider = getChatProvider(providerName);

  // Validate provider is configured (has API key if required)
  const isConfigured = await provider.isConfigured();
  if (!isConfigured) {
    throw new Error(
      `Chat provider '${config.provider}' is not configured. ` +
        'Please set the API key in Settings > API Keys.'
    );
  }

  return provider;
}

/**
 * Get list of registered provider names
 */
export function getRegisteredProviders(): ChatProviderType[] {
  return Array.from(providerFactories.keys());
}

/**
 * Get list of configured (ready to use) providers
 */
export async function getAvailableChatProviders(): Promise<ChatProviderType[]> {
  const available: ChatProviderType[] = [];

  for (const name of providerFactories.keys()) {
    try {
      const provider = getChatProvider(name);
      const isConfigured = await provider.isConfigured();
      if (isConfigured) {
        available.push(name);
      }
    } catch {
      // Provider failed to initialize, skip
    }
  }

  return available;
}

/**
 * Check if a provider supports tools
 */
export function providerSupportsTools(name: ChatProviderType): boolean {
  try {
    const provider = getChatProvider(name);
    return provider.capabilities.supportsTools;
  } catch {
    return false;
  }
}

/**
 * Check if a provider supports streaming
 */
export function providerSupportsStreaming(name: ChatProviderType): boolean {
  try {
    const provider = getChatProvider(name);
    return provider.capabilities.supportsStreaming;
  } catch {
    return false;
  }
}

/**
 * Reset provider cache (for testing)
 */
export function resetChatProviders(): void {
  providerInstances.clear();
}

/**
 * Clear all registrations and cache (for testing)
 */
export function resetChatProviderRegistry(): void {
  providerFactories.clear();
  providerInstances.clear();
}

// =============================================================================
// API Key Resolution Helper
// =============================================================================

/**
 * Get API key for a provider
 * Checks database (ApiKeyService) first, then environment variables
 *
 * @param db Database pool for ApiKeyService
 * @param provider Provider name
 * @returns API key or null if not configured
 */
export async function getProviderApiKey(db: Pool, provider: string): Promise<string | null> {
  // Try database first (via ApiKeyService)
  try {
    const apiKeyService = getApiKeyService(db);
    const dbKey = await apiKeyService.getKey(provider);
    if (dbKey) {
      return dbKey;
    }
  } catch {
    // ApiKeyService may fail if table doesn't exist yet
  }

  // Fall back to environment variable
  const providerInfo = PROVIDER_INFO[provider];
  if (providerInfo?.apiKeyEnvVar) {
    const envKey = process.env[providerInfo.apiKeyEnvVar];
    if (envKey && envKey.trim().length > 0) {
      return envKey;
    }
  }

  return null;
}

/**
 * Check if a provider's API key is configured
 * Checks database first, then environment variables
 */
export async function isProviderApiKeyConfigured(db: Pool, provider: string): Promise<boolean> {
  const key = await getProviderApiKey(db, provider);
  return key !== null;
}

// =============================================================================
// Re-exports
// =============================================================================

export * from './types.js';
export * from './adapters.js';

// =============================================================================
// Provider Registration
// =============================================================================

// Note: Provider implementations will be added in Phase 16B
// They will register themselves when imported:
//
// import { createAnthropicProvider } from './anthropic.js';
// import { createOpenAIProvider } from './openai.js';
// import { createOllamaProvider } from './ollama.js';
//
// registerChatProvider('anthropic', createAnthropicProvider);
// registerChatProvider('openai', createOpenAIProvider);
// registerChatProvider('ollama', createOllamaProvider);
