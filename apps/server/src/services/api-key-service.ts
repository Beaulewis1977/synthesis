/**
 * API Key Management Service
 *
 * Phase 6: Secure storage and management of API keys.
 * Keys are stored encrypted in the database and can be managed via admin API.
 *
 * Security considerations:
 * - Keys are encrypted at rest using AES-256-GCM
 * - Keys are never returned in full after initial storage
 * - Only masked versions are shown in the UI
 * - Stored keys take precedence over environment variables
 */

import { PROVIDER_INFO } from '@synthesis/shared';
import type { Pool } from 'pg';
import { decryptValue, encryptValue } from './encryption.js';

// Anthropic model used for API key validation. Configurable so updates are easy.
const ANTHROPIC_TEST_MODEL = process.env.ANTHROPIC_TEST_MODEL || 'claude-3-5-haiku-20241022';

/**
 * Mask an API key for display (show first 4 and last 4 chars)
 */
function maskKey(key: string): string {
  if (key.length <= 8) {
    return '****';
  }
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

/**
 * Provider to environment variable mapping
 */
const PROVIDER_ENV_VARS: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_API_KEY',
  voyage: 'VOYAGE_API_KEY',
  cohere: 'COHERE_API_KEY',
};

/**
 * API Key status for a provider
 */
export interface ApiKeyStatus {
  provider: string;
  configured: boolean;
  envVar: string;
  source: 'env' | 'db' | 'none';
  maskedValue?: string;
}

/**
 * API Key Service
 */
export class ApiKeyService {
  constructor(private db: Pool) {}

  /**
   * Get status of all API keys
   *
   * IMPORTANT: Database (UI-configured keys) takes precedence over environment variables.
   * This allows users to override env vars via the UI without restarting the server.
   */
  async getAllKeyStatus(): Promise<ApiKeyStatus[]> {
    const statuses: ApiKeyStatus[] = [];

    // Get stored keys from database
    let storedKeys: Map<string, string> = new Map();
    try {
      const result = await this.db.query<{ provider: string; encrypted_key: string }>(
        'SELECT provider, encrypted_key FROM provider_api_keys'
      );
      storedKeys = new Map(result.rows.map((r) => [r.provider, r.encrypted_key]));
    } catch (error) {
      // If the DB is unavailable or the table is missing, log and fall back to treating
      // all providers as having no stored keys so the UI can still render statuses.
      // eslint-disable-next-line no-console
      console.error('Failed to load stored API keys from database', error);
      storedKeys = new Map();
    }

    // Check each provider that requires an API key
    for (const [provider, info] of Object.entries(PROVIDER_INFO)) {
      if (!info.requiresApiKey) continue;

      const envVar =
        PROVIDER_ENV_VARS[provider] || info.apiKeyEnvVar || `${provider.toUpperCase()}_API_KEY`;
      const envValue = process.env[envVar];
      const storedValue = storedKeys.get(provider);

      let status: ApiKeyStatus;

      // Database (UI-configured) takes precedence over environment variables
      if (storedValue) {
        try {
          const decrypted = decryptValue(storedValue);
          status = {
            provider,
            configured: true,
            envVar,
            source: 'db',
            maskedValue: maskKey(decrypted),
          };
        } catch {
          // Decryption failed, fall through to env check
          status = {
            provider,
            configured: false,
            envVar,
            source: 'none',
          };
        }
      } else if (envValue) {
        // Fall back to environment variable
        status = {
          provider,
          configured: true,
          envVar,
          source: 'env',
          maskedValue: maskKey(envValue),
        };
      } else {
        status = {
          provider,
          configured: false,
          envVar,
          source: 'none',
        };
      }

      statuses.push(status);
    }

    return statuses;
  }

  /**
   * Set an API key for a provider
   */
  async setKey(provider: string, apiKey: string): Promise<void> {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('API key cannot be empty');
    }

    const encrypted = encryptValue(apiKey.trim());

    try {
      await this.db.query(
        `INSERT INTO provider_api_keys (provider, encrypted_key, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (provider) DO UPDATE SET
           encrypted_key = EXCLUDED.encrypted_key,
           updated_at = NOW()`,
        [provider, encrypted]
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to set API key for provider ${provider}:`, error);
      // Re-throw with context so callers can handle the failure
      throw new Error(
        `Failed to store API key for provider ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete an API key for a provider
   */
  async deleteKey(provider: string): Promise<void> {
    try {
      const result = await this.db.query('DELETE FROM provider_api_keys WHERE provider = $1', [
        provider,
      ]);

      if (result.rowCount === 0) {
        throw new Error(`No stored API key found for provider: ${provider}`);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to delete API key for provider ${provider}:`, error);
      // Re-throw with context to preserve original error details
      throw new Error(
        `Failed to delete API key for provider ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get the actual API key for a provider (for internal use)
   *
   * IMPORTANT: Database (UI-configured keys) takes precedence over environment variables.
   * This allows users to override env vars via the UI without restarting the server.
   */
  async getKey(provider: string): Promise<string | null> {
    // Check database FIRST (UI-configured keys take precedence)
    try {
      const result = await this.db.query<{ encrypted_key: string }>(
        'SELECT encrypted_key FROM provider_api_keys WHERE provider = $1',
        [provider]
      );

      if (result.rows.length > 0) {
        try {
          return decryptValue(result.rows[0].encrypted_key);
        } catch {
          // Decryption failed, fall through to env check
        }
      }
    } catch (error) {
      // Log database error and fall through to env check
      // eslint-disable-next-line no-console
      console.error(`Failed to retrieve API key for provider ${provider}:`, error);
    }

    // Fall back to environment variable
    const envVar = PROVIDER_ENV_VARS[provider] || `${provider.toUpperCase()}_API_KEY`;
    const envValue = process.env[envVar];
    if (envValue) {
      return envValue;
    }

    return null;
  }

  /**
   * Test an API key by making a simple request to the provider
   */
  async testKey(provider: string): Promise<{ valid: boolean; message: string }> {
    const key = await this.getKey(provider);

    if (!key) {
      return { valid: false, message: 'No API key configured for this provider' };
    }

    try {
      switch (provider) {
        case 'anthropic':
          return await this.testAnthropicKey(key);
        case 'openai':
          return await this.testOpenAIKey(key);
        case 'google':
          return await this.testGoogleKey(key);
        case 'voyage':
          return await this.testVoyageKey(key);
        case 'cohere':
          return await this.testCohereKey(key);
        case 'zhipu':
          return await this.testZhipuKey(key);
        case 'moonshot':
          return await this.testMoonshotKey(key);
        default:
          return { valid: false, message: `Testing not supported for provider: ${provider}` };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { valid: false, message };
    }
  }

  private async testAnthropicKey(key: string): Promise<{ valid: boolean; message: string }> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_TEST_MODEL,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });

    if (response.ok) {
      return { valid: true, message: 'API key is valid' };
    }

    const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    if (response.status === 401) {
      return { valid: false, message: 'Invalid API key' };
    }
    return { valid: false, message: data.error?.message || `API error: ${response.status}` };
  }

  private async testOpenAIKey(key: string): Promise<{ valid: boolean; message: string }> {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });

    if (response.ok) {
      return { valid: true, message: 'API key is valid' };
    }

    if (response.status === 401) {
      return { valid: false, message: 'Invalid API key' };
    }
    return { valid: false, message: `API error: ${response.status}` };
  }

  private async testGoogleKey(key: string): Promise<{ valid: boolean; message: string }> {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${key}`);

    if (response.ok) {
      return { valid: true, message: 'API key is valid' };
    }

    if (response.status === 400 || response.status === 403) {
      return { valid: false, message: 'Invalid API key' };
    }
    return { valid: false, message: `API error: ${response.status}` };
  }

  private async testVoyageKey(key: string): Promise<{ valid: boolean; message: string }> {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'voyage-2',
        input: ['test'],
      }),
    });

    if (response.ok) {
      return { valid: true, message: 'API key is valid' };
    }

    if (response.status === 401) {
      return { valid: false, message: 'Invalid API key' };
    }
    return { valid: false, message: `API error: ${response.status}` };
  }

  private async testCohereKey(key: string): Promise<{ valid: boolean; message: string }> {
    // Use the rerank endpoint with minimal data to validate the key
    const response = await fetch('https://api.cohere.com/v2/rerank', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'rerank-v3.5',
        query: 'test',
        documents: ['test document'],
      }),
    });

    if (response.ok) {
      return { valid: true, message: 'API key is valid' };
    }

    if (response.status === 401 || response.status === 403) {
      return { valid: false, message: 'Invalid API key' };
    }

    // 400 might mean the key is valid but request format issue - check error
    if (response.status === 400) {
      const data = (await response.json()) as { message?: string };
      if (data.message?.includes('invalid_api_key') || data.message?.includes('unauthorized')) {
        return { valid: false, message: 'Invalid API key' };
      }
      // If it's a different 400 error, the key is likely valid
      return { valid: true, message: 'API key is valid' };
    }

    return { valid: false, message: `API error: ${response.status}` };
  }

  private async testZhipuKey(key: string): Promise<{ valid: boolean; message: string }> {
    try {
      // Check if coding plan endpoint is enabled
      const settingsService = getProviderSettingsService(this.db);
      const useCodingPlan = await settingsService.isZhipuCodingPlanEnabled();

      // Use appropriate endpoint based on setting
      const baseURL = useCodingPlan
        ? 'https://api.z.ai/api/coding/paas/v4'
        : 'https://api.z.ai/api/paas/v4';

      const response = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: 'glm-4.5-air',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
        }),
      });
      if (response.ok) {
        const endpointType = useCodingPlan ? 'Coding Plan' : 'Pay-per-use';
        return { valid: true, message: `API key is valid (${endpointType} endpoint)` };
      }
      if (response.status === 401) return { valid: false, message: 'Invalid API key' };

      const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      return { valid: false, message: data.error?.message || `API error: ${response.status}` };
    } catch (error) {
      return {
        valid: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async testMoonshotKey(key: string): Promise<{ valid: boolean; message: string }> {
    try {
      const response = await fetch('https://api.moonshot.ai/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (response.ok) return { valid: true, message: 'API key is valid' };
      if (response.status === 401) return { valid: false, message: 'Invalid API key' };
      return { valid: false, message: `API error: ${response.status}` };
    } catch (error) {
      return {
        valid: false,
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // ==========================================================================
  // Anthropic OAuth Token Management (Phase 17A)
  // ==========================================================================

  /**
   * Set an OAuth token for Anthropic (Claude subscription)
   * Stored separately from API key to allow switching between modes
   */
  async setOAuthToken(provider: string, oauthToken: string): Promise<void> {
    if (provider !== 'anthropic') {
      throw new Error('OAuth tokens are only supported for Anthropic provider');
    }

    if (!oauthToken || oauthToken.trim().length === 0) {
      throw new Error('OAuth token cannot be empty');
    }

    const encrypted = encryptValue(oauthToken.trim());

    try {
      // Store with a special key format to differentiate from API key
      await this.db.query(
        `INSERT INTO provider_api_keys (provider, encrypted_key, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (provider) DO UPDATE SET
           encrypted_key = EXCLUDED.encrypted_key,
           updated_at = NOW()`,
        [`${provider}_oauth`, encrypted]
      );
    } catch (error) {
      console.error(`Failed to set OAuth token for provider ${provider}:`, error);
      throw new Error(
        `Failed to store OAuth token for provider ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get the OAuth token for Anthropic
   *
   * IMPORTANT: Database takes precedence over environment variables.
   * This is because configureAuthentication() sets process.env at runtime,
   * which would otherwise cache old tokens and ignore user updates via UI.
   */
  async getOAuthToken(provider: string): Promise<string | null> {
    if (provider !== 'anthropic') {
      return null;
    }

    // Check database FIRST (source of truth for user-configured tokens)
    try {
      const result = await this.db.query<{ encrypted_key: string }>(
        'SELECT encrypted_key FROM provider_api_keys WHERE provider = $1',
        [`${provider}_oauth`]
      );

      if (result.rows.length > 0) {
        try {
          return decryptValue(result.rows[0].encrypted_key);
        } catch {
          // Decryption failed, fall through to env check
        }
      }
    } catch (error) {
      console.error(`Failed to retrieve OAuth token for provider ${provider}:`, error);
      // Fall through to env check
    }

    // Fall back to environment variable (for startup/external config)
    const envValue = process.env.CLAUDE_CODE_OAUTH_TOKEN;
    if (envValue) {
      return envValue;
    }

    return null;
  }

  /**
   * Delete OAuth token for Anthropic
   */
  async deleteOAuthToken(provider: string): Promise<void> {
    if (provider !== 'anthropic') {
      throw new Error('OAuth tokens are only supported for Anthropic provider');
    }

    try {
      const result = await this.db.query('DELETE FROM provider_api_keys WHERE provider = $1', [
        `${provider}_oauth`,
      ]);

      if (result.rowCount === 0) {
        throw new Error(`No stored OAuth token found for provider: ${provider}`);
      }
    } catch (error) {
      console.error(`Failed to delete OAuth token for provider ${provider}:`, error);
      throw new Error(
        `Failed to delete OAuth token for provider ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get OAuth token status for Anthropic
   *
   * IMPORTANT: Database takes precedence over environment variables.
   * This matches getOAuthToken() behavior.
   */
  async getOAuthTokenStatus(): Promise<{
    configured: boolean;
    source: 'env' | 'db' | 'none';
    maskedValue?: string;
  }> {
    // Check database FIRST (source of truth for user-configured tokens)
    try {
      const result = await this.db.query<{ encrypted_key: string }>(
        'SELECT encrypted_key FROM provider_api_keys WHERE provider = $1',
        ['anthropic_oauth']
      );

      if (result.rows.length > 0) {
        try {
          const decrypted = decryptValue(result.rows[0].encrypted_key);
          return {
            configured: true,
            source: 'db',
            maskedValue: maskKey(decrypted),
          };
        } catch {
          // Decryption failed, fall through to env check
        }
      }
    } catch (error) {
      console.error('Failed to get OAuth token status:', error);
      // Fall through to env check
    }

    // Fall back to environment variable
    const envValue = process.env.CLAUDE_CODE_OAUTH_TOKEN;
    if (envValue) {
      return {
        configured: true,
        source: 'env',
        maskedValue: maskKey(envValue),
      };
    }

    return { configured: false, source: 'none' };
  }

  /**
   * Test Anthropic OAuth token by checking if Claude CLI is accessible
   * and the token is valid
   */
  async testAnthropicOAuth(): Promise<{ valid: boolean; message: string }> {
    const token = await this.getOAuthToken('anthropic');

    if (!token) {
      return { valid: false, message: 'No OAuth token configured' };
    }

    const cliPath = process.env.CLAUDE_CLI_PATH || 'claude';

    try {
      const { execSync } = await import('node:child_process');

      // Test CLI accessibility first
      try {
        execSync(`${cliPath} --version`, { timeout: 5000, stdio: 'pipe' });
      } catch {
        return {
          valid: false,
          message: `Claude CLI not found at '${cliPath}'. Install with: npm install -g @anthropic-ai/claude-code`,
        };
      }

      // Token is set and CLI is accessible - this is the best we can verify
      // without actually making an API call (token validity checked on first use)
      return {
        valid: true,
        message:
          'OAuth token configured. Claude CLI accessible. Token will be validated on first use.',
      };
    } catch (error) {
      return {
        valid: false,
        message: `OAuth validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

// Singleton instance
let apiKeyService: ApiKeyService | null = null;

export function getApiKeyService(db: Pool): ApiKeyService {
  if (!apiKeyService) {
    apiKeyService = new ApiKeyService(db);
  }
  return apiKeyService;
}

// ============================================================================
// Provider Settings Service
// ============================================================================

/**
 * Provider setting value
 */
export interface ProviderSetting {
  provider: string;
  settingKey: string;
  settingValue: string;
}

/**
 * Provider Settings Service
 *
 * Manages provider-specific configuration settings (e.g., Z.AI coding plan endpoint).
 * Settings are stored in the provider_settings table.
 */
export class ProviderSettingsService {
  constructor(private db: Pool) {}

  /**
   * Get a specific setting for a provider
   */
  async getSetting(provider: string, settingKey: string): Promise<string | null> {
    try {
      const result = await this.db.query<{ setting_value: string }>(
        'SELECT setting_value FROM provider_settings WHERE provider = $1 AND setting_key = $2',
        [provider, settingKey]
      );
      return result.rows[0]?.setting_value ?? null;
    } catch (error) {
      // Table might not exist yet, return null
      console.error(`Failed to get provider setting ${provider}.${settingKey}:`, error);
      return null;
    }
  }

  /**
   * Get all settings for a provider
   */
  async getProviderSettings(provider: string): Promise<Record<string, string>> {
    try {
      const result = await this.db.query<{ setting_key: string; setting_value: string }>(
        'SELECT setting_key, setting_value FROM provider_settings WHERE provider = $1',
        [provider]
      );
      const settings: Record<string, string> = {};
      for (const row of result.rows) {
        settings[row.setting_key] = row.setting_value;
      }
      return settings;
    } catch (error) {
      console.error(`Failed to get settings for provider ${provider}:`, error);
      return {};
    }
  }

  /**
   * Get all provider settings
   */
  async getAllSettings(): Promise<ProviderSetting[]> {
    try {
      const result = await this.db.query<{
        provider: string;
        setting_key: string;
        setting_value: string;
      }>(
        'SELECT provider, setting_key, setting_value FROM provider_settings ORDER BY provider, setting_key'
      );
      return result.rows.map((row) => ({
        provider: row.provider,
        settingKey: row.setting_key,
        settingValue: row.setting_value,
      }));
    } catch (error) {
      console.error('Failed to get all provider settings:', error);
      return [];
    }
  }

  /**
   * Set a setting for a provider
   */
  async setSetting(provider: string, settingKey: string, settingValue: string): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO provider_settings (provider, setting_key, setting_value, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (provider, setting_key) DO UPDATE SET
           setting_value = EXCLUDED.setting_value,
           updated_at = NOW()`,
        [provider, settingKey, settingValue]
      );
    } catch (error) {
      console.error(`Failed to set provider setting ${provider}.${settingKey}:`, error);
      throw new Error(
        `Failed to store setting for provider ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete a setting for a provider
   */
  async deleteSetting(provider: string, settingKey: string): Promise<void> {
    try {
      await this.db.query(
        'DELETE FROM provider_settings WHERE provider = $1 AND setting_key = $2',
        [provider, settingKey]
      );
    } catch (error) {
      console.error(`Failed to delete provider setting ${provider}.${settingKey}:`, error);
      throw new Error(
        `Failed to delete setting for provider ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if Z.AI coding plan endpoint is enabled
   */
  async isZhipuCodingPlanEnabled(): Promise<boolean> {
    const value = await this.getSetting('zhipu', 'use_coding_plan');
    return value === 'true';
  }

  /**
   * Get Anthropic authentication mode
   * @returns 'oauth' if using Claude subscription (CLAUDE_CODE_OAUTH_TOKEN), 'api_key' otherwise
   */
  async getAnthropicAuthMode(): Promise<'oauth' | 'api_key'> {
    const value = await this.getSetting('anthropic', 'auth_mode');
    return value === 'oauth' ? 'oauth' : 'api_key';
  }
}

// Singleton instance
let providerSettingsService: ProviderSettingsService | null = null;

export function getProviderSettingsService(db: Pool): ProviderSettingsService {
  if (!providerSettingsService) {
    providerSettingsService = new ProviderSettingsService(db);
  }
  return providerSettingsService;
}
