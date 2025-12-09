/**
 * Custom Provider Service
 *
 * Phase 17D: Manages custom OpenAI-compatible LLM providers (vLLM, LMStudio, OpenRouter, etc.)
 *
 * Features:
 * - CRUD operations for custom providers
 * - API key encryption at rest
 * - Connection testing with timeout
 * - Model discovery from OpenAI-compatible /v1/models endpoint
 */

import type { Pool } from 'pg';
import { decryptValue, encryptValue } from './encryption.js';

/**
 * Custom provider representation (returned to clients)
 * API keys are never exposed - only hasApiKey boolean
 */
export interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  hasApiKey: boolean;
  providerType: string;
  maxContextTokens: number;
  supportsVision: boolean;
  supportsTools: boolean;
  customModels: string[];
  discoveredModels: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a new custom provider
 */
export interface CreateCustomProviderInput {
  name: string;
  baseUrl: string;
  apiKey?: string;
  maxContextTokens?: number;
  supportsVision?: boolean;
  supportsTools?: boolean;
  customModels?: string[];
}

/**
 * Result of connection testing
 */
export interface TestConnectionResult {
  valid: boolean;
  models?: string[];
  error?: string;
}

/**
 * Database row structure from custom_providers table
 */
interface CustomProviderRow {
  id: string;
  name: string;
  base_url: string;
  encrypted_key: string | null;
  provider_type: string;
  max_context_tokens: number;
  supports_vision: boolean;
  supports_tools: boolean;
  custom_models: string[];
  discovered_models: string[];
  created_at: Date;
  updated_at: Date;
}

/**
 * Service for managing custom LLM providers
 */
class CustomProviderService {
  constructor(private db: Pool) {}

  /**
   * Convert database row to CustomProvider interface
   */
  private rowToProvider(row: CustomProviderRow): CustomProvider {
    return {
      id: row.id,
      name: row.name,
      baseUrl: row.base_url,
      hasApiKey: row.encrypted_key !== null,
      providerType: row.provider_type,
      maxContextTokens: row.max_context_tokens,
      supportsVision: row.supports_vision,
      supportsTools: row.supports_tools,
      customModels: row.custom_models || [],
      discoveredModels: row.discovered_models || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * List all custom providers
   */
  async list(): Promise<CustomProvider[]> {
    try {
      const result = await this.db.query<CustomProviderRow>(
        'SELECT * FROM custom_providers ORDER BY created_at DESC'
      );

      return result.rows.map((row) => this.rowToProvider(row));
    } catch (error) {
      console.error('Failed to list custom providers:', error);
      throw new Error('Failed to list custom providers');
    }
  }

  /**
   * Get a single custom provider by ID
   * @returns Provider or null if not found
   */
  async get(id: string): Promise<CustomProvider | null> {
    try {
      const result = await this.db.query<CustomProviderRow>(
        'SELECT * FROM custom_providers WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToProvider(result.rows[0]);
    } catch (error) {
      console.error(`Failed to get custom provider ${id}:`, error);
      throw new Error(`Failed to get custom provider ${id}`);
    }
  }

  /**
   * Get a custom provider by name (unique)
   * @returns Provider or null if not found
   */
  async getByName(name: string): Promise<CustomProvider | null> {
    try {
      const result = await this.db.query<CustomProviderRow>(
        'SELECT * FROM custom_providers WHERE name = $1',
        [name]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToProvider(result.rows[0]);
    } catch (error) {
      console.error(`Failed to get custom provider by name '${name}':`, error);
      throw new Error(`Failed to get custom provider by name '${name}'`);
    }
  }

  /**
   * Create a new custom provider
   * Optionally attempts model discovery if API key is provided
   */
  async create(input: CreateCustomProviderInput): Promise<CustomProvider> {
    try {
      // Validate name uniqueness
      const existing = await this.getByName(input.name);
      if (existing) {
        throw new Error(`Provider with name '${input.name}' already exists`);
      }

      // Encrypt API key if provided
      const encryptedKey = input.apiKey ? encryptValue(input.apiKey) : null;

      // Insert with defaults
      const result = await this.db.query<CustomProviderRow>(
        `INSERT INTO custom_providers (
          name, base_url, encrypted_key, provider_type,
          max_context_tokens, supports_vision, supports_tools, custom_models
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          input.name,
          input.baseUrl,
          encryptedKey,
          'openai-compatible',
          input.maxContextTokens ?? 8192,
          input.supportsVision ?? false,
          input.supportsTools ?? true,
          input.customModels ?? [],
        ]
      );

      const provider = this.rowToProvider(result.rows[0]);

      // Attempt model discovery if API key provided (non-blocking)
      if (input.apiKey) {
        try {
          await this.refreshDiscoveredModels(provider.id);
        } catch (error) {
          // Model discovery failure is non-fatal
          console.warn(`Model discovery failed for provider '${input.name}':`, error);
        }
      }

      return provider;
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        throw error;
      }
      console.error('Failed to create custom provider:', error);
      throw new Error('Failed to create custom provider');
    }
  }

  /**
   * Update an existing custom provider
   * Supports partial updates
   */
  async update(id: string, updates: Partial<CreateCustomProviderInput>): Promise<CustomProvider> {
    try {
      // Check provider exists
      const existing = await this.get(id);
      if (!existing) {
        throw new Error(`Provider with ID '${id}' not found`);
      }

      // Build dynamic SQL for partial updates
      const setClauses: string[] = ['updated_at = NOW()'];
      const params: unknown[] = [id];
      let paramIndex = 2;

      if (updates.name !== undefined) {
        // Check name uniqueness if changing
        if (updates.name !== existing.name) {
          const nameConflict = await this.getByName(updates.name);
          if (nameConflict) {
            throw new Error(`Provider with name '${updates.name}' already exists`);
          }
        }
        setClauses.push(`name = $${paramIndex++}`);
        params.push(updates.name);
      }

      if (updates.baseUrl !== undefined) {
        setClauses.push(`base_url = $${paramIndex++}`);
        params.push(updates.baseUrl);
      }

      if (updates.apiKey !== undefined) {
        const encryptedKey = updates.apiKey ? encryptValue(updates.apiKey) : null;
        setClauses.push(`encrypted_key = $${paramIndex++}`);
        params.push(encryptedKey);
      }

      if (updates.maxContextTokens !== undefined) {
        setClauses.push(`max_context_tokens = $${paramIndex++}`);
        params.push(updates.maxContextTokens);
      }

      if (updates.supportsVision !== undefined) {
        setClauses.push(`supports_vision = $${paramIndex++}`);
        params.push(updates.supportsVision);
      }

      if (updates.supportsTools !== undefined) {
        setClauses.push(`supports_tools = $${paramIndex++}`);
        params.push(updates.supportsTools);
      }

      if (updates.customModels !== undefined) {
        setClauses.push(`custom_models = $${paramIndex++}`);
        params.push(updates.customModels);
      }

      // Only update if there are actual changes
      if (setClauses.length === 1) {
        return existing;
      }

      const result = await this.db.query<CustomProviderRow>(
        `UPDATE custom_providers
         SET ${setClauses.join(', ')}
         WHERE id = $1
         RETURNING *`,
        params
      );

      if (result.rowCount === 0) {
        throw new Error(`Failed to update provider with ID '${id}'`);
      }

      return this.rowToProvider(result.rows[0]);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('not found') || error.message.includes('already exists'))
      ) {
        throw error;
      }
      console.error(`Failed to update custom provider ${id}:`, error);
      throw new Error(`Failed to update custom provider ${id}`);
    }
  }

  /**
   * Delete a custom provider
   * @throws Error if provider not found
   */
  async delete(id: string): Promise<void> {
    try {
      const result = await this.db.query('DELETE FROM custom_providers WHERE id = $1', [id]);

      if (result.rowCount === 0) {
        throw new Error(`Provider with ID '${id}' not found`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw error;
      }
      console.error(`Failed to delete custom provider ${id}:`, error);
      throw new Error(`Failed to delete custom provider ${id}`);
    }
  }

  /**
   * Get decrypted API key for a provider
   * @returns API key or null if not set
   */
  async getApiKey(id: string): Promise<string | null> {
    try {
      const result = await this.db.query<{ encrypted_key: string | null }>(
        'SELECT encrypted_key FROM custom_providers WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const encryptedKey = result.rows[0].encrypted_key;
      if (!encryptedKey) {
        return null;
      }

      try {
        return decryptValue(encryptedKey);
      } catch (error) {
        console.error(`Failed to decrypt API key for provider ${id}:`, error);
        return null;
      }
    } catch (error) {
      console.error(`Failed to retrieve API key for provider ${id}:`, error);
      return null;
    }
  }

  /**
   * Test connection to a custom provider endpoint
   * Attempts to fetch models from OpenAI-compatible /v1/models endpoint
   * @param baseUrl - Base URL of the provider (e.g., "http://localhost:8000" or "http://localhost:8000/v1")
   * @param apiKey - Optional API key for authentication
   * @returns Connection test result with models if successful
   */
  async testConnection(baseUrl: string, apiKey?: string): Promise<TestConnectionResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      // Normalize URL - ensure it ends with /v1 for models endpoint
      const normalizedBase = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
      const modelsUrl = `${normalizedBase}/models`;

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      // Fetch models endpoint
      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle HTTP errors
      if (!response.ok) {
        if (response.status === 401) {
          return {
            valid: false,
            error: 'Invalid API key or unauthorized',
          };
        }
        if (response.status === 404) {
          return {
            valid: false,
            error: 'Models endpoint not found. Ensure the URL is correct and server is running.',
          };
        }
        return {
          valid: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      // Parse response
      const data: unknown = await response.json();

      // Validate OpenAI format: { object: "list", data: [{ id: "model-name" }] }
      if (
        !data ||
        typeof data !== 'object' ||
        !('data' in data) ||
        !Array.isArray((data as { data: unknown }).data)
      ) {
        return {
          valid: false,
          error: 'Invalid response format (expected OpenAI format with data array)',
        };
      }

      // Extract model IDs
      const responseData = data as { data: Array<{ id?: string }> };
      const models = responseData.data
        .map((m) => m.id)
        .filter((id): id is string => typeof id === 'string');

      if (models.length === 0) {
        return {
          valid: false,
          error: 'No models found in response',
        };
      }

      return {
        valid: true,
        models,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            valid: false,
            error: 'Connection timeout (10 seconds). Server may be offline or unreachable.',
          };
        }

        // Network errors
        if (error.message.includes('fetch')) {
          return {
            valid: false,
            error: `Network error: ${error.message}`,
          };
        }

        return {
          valid: false,
          error: error.message,
        };
      }

      return {
        valid: false,
        error: 'Unknown error occurred during connection test',
      };
    }
  }

  /**
   * Discover models for an existing provider
   * @returns Array of discovered model IDs (empty on failure)
   */
  async discoverModels(id: string): Promise<string[]> {
    try {
      const provider = await this.get(id);
      if (!provider) {
        console.warn(`Cannot discover models: provider ${id} not found`);
        return [];
      }

      const apiKey = await this.getApiKey(id);
      const result = await this.testConnection(provider.baseUrl, apiKey || undefined);

      if (result.valid && result.models) {
        return result.models;
      }

      console.warn(`Model discovery failed for provider '${provider.name}': ${result.error}`);
      return [];
    } catch (error) {
      console.error(`Error discovering models for provider ${id}:`, error);
      return [];
    }
  }

  /**
   * Refresh discovered models for a provider and update database
   * @returns Updated array of discovered models
   */
  async refreshDiscoveredModels(id: string): Promise<string[]> {
    try {
      const models = await this.discoverModels(id);

      // Update database with discovered models
      await this.db.query(
        'UPDATE custom_providers SET discovered_models = $1, updated_at = NOW() WHERE id = $2',
        [models, id]
      );

      return models;
    } catch (error) {
      console.error(`Failed to refresh discovered models for provider ${id}:`, error);
      throw new Error(`Failed to refresh discovered models for provider ${id}`);
    }
  }
}

/**
 * Singleton instance
 */
let customProviderServiceInstance: CustomProviderService | null = null;

/**
 * Get CustomProviderService singleton instance
 */
export function getCustomProviderService(db: Pool): CustomProviderService {
  if (!customProviderServiceInstance) {
    customProviderServiceInstance = new CustomProviderService(db);
  }
  return customProviderServiceInstance;
}

/**
 * Reset singleton instance (for testing)
 */
export function resetCustomProviderService(): void {
  customProviderServiceInstance = null;
}
