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
  starredModels: string[];
  modelsWithoutTools: string[];
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
  /** Optional success message when connection works but models couldn't be discovered */
  message?: string;
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
  starred_models: string[];
  models_without_tools: string[];
  created_at: Date;
  updated_at: Date;
}

/**
 * Normalize a base URL for OpenAI-compatible API calls
 * Handles various input formats and ensures URL ends with /v1
 *
 * @param input - Raw URL input (e.g., "https://api.openai.com", "https://api.openai.com/v1/models")
 * @returns Normalized URL ending with /v1 (e.g., "https://api.openai.com/v1")
 */
function normalizeBaseUrl(input: string): string {
  // Remove trailing slashes
  const url = input.replace(/\/+$/, '');

  // If URL contains paths after the host (like /v1/models, /v1/chat, etc.)
  // extract just the base with /v1
  const urlMatch = url.match(/^(https?:\/\/[^\/]+)(\/v1)?(\/.*)?$/);
  if (urlMatch) {
    const base = urlMatch[1]; // e.g., "https://api.openai.com"
    return `${base}/v1`;
  }

  // Fallback: append /v1 if not present
  return url.endsWith('/v1') ? url : `${url}/v1`;
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
      starredModels: row.starred_models || [],
      modelsWithoutTools: row.models_without_tools || [],
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
   * Falls back to testing /chat/completions if /models returns 404 (some providers don't expose models list)
   * @param baseUrl - Base URL of the provider (e.g., "http://localhost:8000" or "http://localhost:8000/v1")
   * @param apiKey - Optional API key for authentication
   * @returns Connection test result with models if successful
   */
  async testConnection(baseUrl: string, apiKey?: string): Promise<TestConnectionResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      // Normalize URL - handles various input formats (with /v1, /v1/models, trailing slashes, etc.)
      const normalizedBase = normalizeBaseUrl(baseUrl);
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

      // Handle HTTP errors
      if (!response.ok) {
        if (response.status === 401) {
          clearTimeout(timeoutId);
          return {
            valid: false,
            error: 'Invalid API key or unauthorized',
          };
        }
        if (response.status === 404) {
          // Some providers (MiniMax, etc.) don't expose /models endpoint
          // Fall back to testing /chat/completions with a minimal request
          clearTimeout(timeoutId);
          return this.testChatCompletionsFallback(normalizedBase, apiKey);
        }
        clearTimeout(timeoutId);
        return {
          valid: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      clearTimeout(timeoutId);

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
   * Fallback connection test using /chat/completions endpoint
   * Used when /models returns 404 (e.g., MiniMax, some other providers)
   * Sends a minimal request to verify the endpoint is reachable and API key works
   */
  private async testChatCompletionsFallback(
    normalizedBase: string,
    apiKey?: string
  ): Promise<TestConnectionResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const chatUrl = `${normalizedBase}/chat/completions`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      // Send a minimal request - we expect this to fail with "model required" or similar
      // but a 400/422 error means the endpoint exists and API key is valid
      const response = await fetch(chatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'test-connection',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 401 = bad API key
      if (response.status === 401) {
        return {
          valid: false,
          error: 'Invalid API key or unauthorized',
        };
      }

      // 400, 404 (model not found), 422, 500 = endpoint exists, API key works
      // The request failed because our dummy model doesn't exist, but connection is valid
      // Note: Some providers (MiniMax) return 500 for invalid model names
      if (
        response.status === 400 ||
        response.status === 404 ||
        response.status === 422 ||
        response.status === 500
      ) {
        return {
          valid: true,
          models: [], // No models discovered - user must add manually
          message:
            'Connection successful! This provider does not expose a models list. Please add model names manually in Custom Models field.',
        };
      }

      // 200 = somehow worked (unlikely with fake model)
      if (response.ok) {
        return {
          valid: true,
          models: [],
          message: 'Connection successful! Please add model names manually in Custom Models field.',
        };
      }

      // Other errors (502, 503, etc.)
      return {
        valid: false,
        error: `HTTP ${response.status}: ${response.statusText}. The endpoint may not be OpenAI-compatible.`,
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
        return {
          valid: false,
          error: `Network error: ${error.message}`,
        };
      }

      return {
        valid: false,
        error: 'Unknown error occurred during fallback connection test',
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

  // ==========================================================================
  // Phase 17K: Model Curation & Tool Support
  // ==========================================================================

  /**
   * Update starred models for a provider
   * @param id Provider UUID
   * @param models Array of model names to star
   */
  async updateStarredModels(id: string, models: string[]): Promise<void> {
    const result = await this.db.query(
      'UPDATE custom_providers SET starred_models = $1, updated_at = NOW() WHERE id = $2',
      [models, id]
    );

    if (result.rowCount === 0) {
      throw new Error(`Provider with ID ${id} not found`);
    }

    console.info(`Updated starred models for provider ${id}: ${models.length} models`);
  }

  /**
   * Update models without tools list for a provider
   * @param id Provider UUID
   * @param models Array of model names that don't support tools
   */
  async updateModelsWithoutTools(id: string, models: string[]): Promise<void> {
    const result = await this.db.query(
      'UPDATE custom_providers SET models_without_tools = $1, updated_at = NOW() WHERE id = $2',
      [models, id]
    );

    if (result.rowCount === 0) {
      throw new Error(`Provider with ID ${id} not found`);
    }

    console.info(`Updated models without tools for provider ${id}: ${models.length} models`);
  }

  /**
   * Add a model to the "no tools" list (called when 404 error detected)
   * @param id Provider UUID
   * @param modelName Model name to mark as not supporting tools
   */
  async addModelWithoutTools(id: string, modelName: string): Promise<void> {
    // Use array_append with array_position check to avoid duplicates
    const result = await this.db.query(
      `UPDATE custom_providers
       SET models_without_tools = CASE
         WHEN array_position(models_without_tools, $2) IS NULL
         THEN array_append(models_without_tools, $2)
         ELSE models_without_tools
       END,
       updated_at = NOW()
       WHERE id = $1`,
      [id, modelName]
    );

    if (result.rowCount === 0) {
      throw new Error(`Provider with ID ${id} not found`);
    }

    console.info(`Marked model "${modelName}" as not supporting tools for provider ${id}`);
  }

  /**
   * Check if a specific model supports tools for a given provider
   * @param id Provider UUID
   * @param modelName Model name to check
   * @returns true if model supports tools, false if it doesn't
   */
  async modelSupportsTools(id: string, modelName: string): Promise<boolean> {
    const result = await this.db.query<{ supports: boolean }>(
      `SELECT NOT ($2 = ANY(models_without_tools)) as supports
       FROM custom_providers WHERE id = $1`,
      [id, modelName]
    );

    if (result.rows.length === 0) {
      throw new Error(`Provider with ID ${id} not found`);
    }

    return result.rows[0].supports;
  }

  /**
   * Get models without tools list for a provider
   * @param id Provider UUID
   */
  async getModelsWithoutTools(id: string): Promise<string[]> {
    const result = await this.db.query<{ models_without_tools: string[] }>(
      'SELECT models_without_tools FROM custom_providers WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Provider with ID ${id} not found`);
    }

    return result.rows[0].models_without_tools || [];
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
