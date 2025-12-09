/**
 * Chat Provider Registry
 *
 * Phase 16A: Registry pattern for multi-provider chat support.
 * Phase 16B: Updated with context-aware provider creation.
 * Phase 16G: Added provider override support for per-chat model selection.
 * Follows singleton pattern from model-config-service.ts.
 */

import { PROVIDER_INFO } from '@synthesis/shared';
import type { Pool } from 'pg';
import { getApiKeyService } from '../api-key-service.js';
import { getCustomProviderService } from '../custom-provider-service.js';
import { getModelConfigService } from '../model-config-service.js';
import { createAnthropicProvider } from './anthropic.js';
import { createGoogleProvider } from './google.js';
import { createMoonshotProvider } from './moonshot.js';
import { createOllamaProvider } from './ollama.js';
import { OpenAICompatibleProvider } from './openai-compatible.js';
import { createOpenAIProvider } from './openai.js';
import type { ChatProvider, ChatProviderFactory, ChatProviderType, ToolContext } from './types.js';
import { createZhipuProvider } from './zhipu.js';

// =============================================================================
// Provider Registry
// =============================================================================

/** Provider factory registry */
const providerFactories = new Map<ChatProviderType, ChatProviderFactory>();

/**
 * Cache key for provider instances
 * Includes provider name and context for proper isolation
 */
function getCacheKey(name: ChatProviderType, collectionId: string): string {
  return `${name}:${collectionId}`;
}

/** Cached provider instances (lazy initialization, keyed by provider+context) */
const providerInstances = new Map<string, ChatProvider>();

/**
 * Register a chat provider factory
 * Called at module load time by provider implementations
 */
export function registerChatProvider(name: ChatProviderType, factory: ChatProviderFactory): void {
  providerFactories.set(name, factory);
}

/**
 * Get a chat provider by name with context (cached per context)
 * Phase 16B: Updated to accept db and context for tool support
 * @throws Error if provider not registered
 */
export function getChatProvider(
  name: ChatProviderType,
  db: Pool,
  context: ToolContext
): ChatProvider {
  const cacheKey = getCacheKey(name, context.collectionId);

  // Check cache first
  let provider = providerInstances.get(cacheKey);
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
  provider = factory(db, context);
  providerInstances.set(cacheKey, provider);
  return provider;
}

/**
 * Get the configured chat provider from ModelConfigService
 * Phase 16B: Updated to accept context for tool support
 * Uses the 'chat' feature configuration
 */
export async function getConfiguredChatProvider(
  db: Pool,
  context: ToolContext
): Promise<ChatProvider> {
  const configService = getModelConfigService(db);
  const config = await configService.getChatModelConfig();

  const providerName = config.provider as ChatProviderType;
  const provider = getChatProvider(providerName, db, context);

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
 * Get chat provider with optional provider override.
 * Phase 16G: Supports per-chat model selection.
 * Phase 17F: Supports custom:uuid format for custom providers.
 *
 * @param db Database pool
 * @param context Tool context with collection ID
 * @param providerOverride Optional provider name to override the global config
 * @returns The configured ChatProvider instance
 * @throws Error if provider is not configured (missing API key)
 */
export async function getConfiguredChatProviderWithOverride(
  db: Pool,
  context: ToolContext,
  providerOverride?: string
): Promise<ChatProvider> {
  // Handle custom:uuid format for custom providers (Phase 17F)
  if (providerOverride?.startsWith('custom:')) {
    const customId = providerOverride.slice('custom:'.length);

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(customId)) {
      throw new Error(`Invalid custom provider ID format: ${customId}`);
    }

    return getCustomChatProvider(db, context, customId);
  }

  let providerName: ChatProviderType;

  if (providerOverride) {
    providerName = providerOverride as ChatProviderType;
  } else {
    const configService = getModelConfigService(db);
    const config = await configService.getChatModelConfig();
    providerName = config.provider as ChatProviderType;
  }

  const provider = getChatProvider(providerName, db, context);

  // Validate provider is configured
  const isConfigured = await provider.isConfigured();
  if (!isConfigured) {
    throw new Error(
      `Chat provider '${providerName}' is not configured. ` +
        'Please set the API key in Settings > API Keys.'
    );
  }

  return provider;
}

/**
 * Get a custom chat provider by UUID
 * Phase 17F: Creates OpenAICompatibleProvider with custom provider config
 * Phase 17K: Added support for model-level tool disabling and auto-detection
 *
 * @param db Database pool
 * @param context Tool context with collection ID
 * @param customProviderId UUID of the custom provider
 * @param modelOverride Optional model name for checking tool support
 * @returns ChatProvider instance
 * @throws Error if custom provider not found
 */
export async function getCustomChatProvider(
  db: Pool,
  context: ToolContext,
  customProviderId: string,
  modelOverride?: string
): Promise<ChatProvider> {
  const service = getCustomProviderService(db);
  const provider = await service.get(customProviderId);

  if (!provider) {
    throw new Error(`Custom provider not found: ${customProviderId}`);
  }

  // Get decrypted API key from custom_providers table
  const apiKey = await service.getApiKey(customProviderId);

  // Check if model is known to not support tools (Phase 17K)
  let disableTools = false;
  if (modelOverride && provider.modelsWithoutTools?.includes(modelOverride)) {
    disableTools = true;
    console.info(`Model ${modelOverride} is marked as not supporting tools, disabling tools`);
  }

  return new OpenAICompatibleProvider(db, context, {
    providerName: `custom:${provider.id}` as ChatProviderType,
    baseURL: provider.baseUrl,
    apiKeyProvider: customProviderId, // Used only for error message context
    apiKey: apiKey ?? undefined, // Direct API key (bypasses provider lookup)
    maxContextTokens: provider.maxContextTokens,
    supportsVision: provider.supportsVision,
    disableTools,
    customProviderId,
    // Callback to auto-mark models that don't support tools
    onModelNoToolSupport: async (providerId: string, model: string) => {
      await service.addModelWithoutTools(providerId, model);
    },
  });
}

/**
 * Get list of registered provider names
 */
export function getRegisteredProviders(): ChatProviderType[] {
  return Array.from(providerFactories.keys());
}

/**
 * Get list of configured (ready to use) providers
 * Phase 16B: Updated to accept db and context
 */
export async function getAvailableChatProviders(
  db: Pool,
  context: ToolContext
): Promise<ChatProviderType[]> {
  const available: ChatProviderType[] = [];

  for (const name of providerFactories.keys()) {
    try {
      const provider = getChatProvider(name, db, context);
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
 * Phase 16B: Updated to accept db and context
 */
export function providerSupportsTools(
  name: ChatProviderType,
  db: Pool,
  context: ToolContext
): boolean {
  try {
    const provider = getChatProvider(name, db, context);
    return provider.capabilities.supportsTools;
  } catch {
    return false;
  }
}

/**
 * Check if a provider supports streaming
 * Phase 16B: Updated to accept db and context
 */
export function providerSupportsStreaming(
  name: ChatProviderType,
  db: Pool,
  context: ToolContext
): boolean {
  try {
    const provider = getChatProvider(name, db, context);
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
// Provider Registration (Phase 16B)
// =============================================================================

// Register all available chat providers
registerChatProvider('anthropic', createAnthropicProvider);
registerChatProvider('google', createGoogleProvider);
registerChatProvider('moonshot', createMoonshotProvider);
registerChatProvider('openai', createOpenAIProvider);
registerChatProvider('ollama', createOllamaProvider);
registerChatProvider('zhipu', createZhipuProvider);
