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
 * - Environment variables take precedence over stored keys
 */

import crypto from 'node:crypto';
import { PROVIDER_INFO } from '@synthesis/shared';
import type { Pool } from 'pg';

// Encryption key from environment (should be 32 bytes for AES-256)
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY || 'default-key-change-in-production!';

// Ensure key is exactly 32 bytes
function getEncryptionKey(): Buffer {
  const key = Buffer.from(ENCRYPTION_KEY);
  if (key.length === 32) return key;
  // Pad or truncate to 32 bytes
  const result = Buffer.alloc(32);
  key.copy(result);
  return result;
}

/**
 * Encrypt an API key
 */
function encryptKey(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an API key
 */
function decryptKey(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted key format');
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

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
   */
  async getAllKeyStatus(): Promise<ApiKeyStatus[]> {
    const statuses: ApiKeyStatus[] = [];

    // Get stored keys from database
    const result = await this.db.query<{ provider: string; encrypted_key: string }>(
      'SELECT provider, encrypted_key FROM provider_api_keys'
    );
    const storedKeys = new Map(result.rows.map((r) => [r.provider, r.encrypted_key]));

    // Check each provider that requires an API key
    for (const [provider, info] of Object.entries(PROVIDER_INFO)) {
      if (!info.requiresApiKey) continue;

      const envVar =
        PROVIDER_ENV_VARS[provider] || info.apiKeyEnvVar || `${provider.toUpperCase()}_API_KEY`;
      const envValue = process.env[envVar];
      const storedValue = storedKeys.get(provider);

      let status: ApiKeyStatus;

      if (envValue) {
        // Environment variable takes precedence
        status = {
          provider,
          configured: true,
          envVar,
          source: 'env',
          maskedValue: maskKey(envValue),
        };
      } else if (storedValue) {
        // Use stored key
        try {
          const decrypted = decryptKey(storedValue);
          status = {
            provider,
            configured: true,
            envVar,
            source: 'db',
            maskedValue: maskKey(decrypted),
          };
        } catch {
          // Decryption failed, treat as not configured
          status = {
            provider,
            configured: false,
            envVar,
            source: 'none',
          };
        }
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

    const encrypted = encryptKey(apiKey.trim());

    await this.db.query(
      `INSERT INTO provider_api_keys (provider, encrypted_key, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (provider) DO UPDATE SET
         encrypted_key = EXCLUDED.encrypted_key,
         updated_at = NOW()`,
      [provider, encrypted]
    );
  }

  /**
   * Delete an API key for a provider
   */
  async deleteKey(provider: string): Promise<void> {
    const result = await this.db.query('DELETE FROM provider_api_keys WHERE provider = $1', [
      provider,
    ]);

    if (result.rowCount === 0) {
      throw new Error(`No stored API key found for provider: ${provider}`);
    }
  }

  /**
   * Get the actual API key for a provider (for internal use)
   * Returns env var value if set, otherwise decrypts stored value
   */
  async getKey(provider: string): Promise<string | null> {
    // Check environment variable first
    const envVar = PROVIDER_ENV_VARS[provider] || `${provider.toUpperCase()}_API_KEY`;
    const envValue = process.env[envVar];
    if (envValue) {
      return envValue;
    }

    // Check database
    const result = await this.db.query<{ encrypted_key: string }>(
      'SELECT encrypted_key FROM provider_api_keys WHERE provider = $1',
      [provider]
    );

    if (result.rows.length === 0) {
      return null;
    }

    try {
      return decryptKey(result.rows[0].encrypted_key);
    } catch {
      return null;
    }
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
        model: 'claude-3-haiku-20240307',
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
}

// Singleton instance
let apiKeyService: ApiKeyService | null = null;

export function getApiKeyService(db: Pool): ApiKeyService {
  if (!apiKeyService) {
    apiKeyService = new ApiKeyService(db);
  }
  return apiKeyService;
}
