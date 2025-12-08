/**
 * System Settings Service
 *
 * Provides typed access to app-wide configuration stored in the system_settings table.
 * Uses a singleton pattern with caching for performance.
 */

import type { Pool } from 'pg';

// Type for the system settings table row
interface SystemSettingRow {
  key: string;
  value: unknown;
  created_at: Date;
  updated_at: Date;
}

/**
 * Cache entry with timestamp for TTL-based invalidation
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

/**
 * System Settings Service
 *
 * Manages app-wide configuration with caching.
 */
export class SystemSettingsService {
  private db: Pool;
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private readonly cacheTTL = 60_000; // 1 minute cache

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Get a setting value by key
   */
  async getSetting<T>(key: string): Promise<T | null> {
    // Check cache first
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.value as T;
    }

    const result = await this.db.query<SystemSettingRow>(
      'SELECT value FROM system_settings WHERE key = $1',
      [key]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const value = result.rows[0].value as T;

    // Update cache
    this.cache.set(key, { value, timestamp: Date.now() });

    return value;
  }

  /**
   * Set a setting value
   */
  async setSetting<T>(key: string, value: T): Promise<void> {
    await this.db.query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = NOW()`,
      [key, JSON.stringify(value)]
    );

    // Update cache
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  /**
   * Delete a setting
   */
  async deleteSetting(key: string): Promise<boolean> {
    const result = await this.db.query('DELETE FROM system_settings WHERE key = $1 RETURNING key', [
      key,
    ]);

    // Remove from cache
    this.cache.delete(key);

    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Get all settings
   */
  async getAllSettings(): Promise<Record<string, unknown>> {
    const result = await this.db.query<SystemSettingRow>(
      'SELECT key, value FROM system_settings ORDER BY key'
    );

    const settings: Record<string, unknown> = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
      // Update cache for each
      this.cache.set(row.key, { value: row.value, timestamp: Date.now() });
    }

    return settings;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Singleton instance
let systemSettingsServiceInstance: SystemSettingsService | null = null;

/**
 * Get the SystemSettingsService singleton instance
 */
export function getSystemSettingsService(db: Pool): SystemSettingsService {
  if (!systemSettingsServiceInstance) {
    systemSettingsServiceInstance = new SystemSettingsService(db);
  }
  return systemSettingsServiceInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetSystemSettingsService(): void {
  systemSettingsServiceInstance = null;
}

// ----- Typed Setting Accessors -----

/**
 * Default embedding profile setting shape
 */
export interface DefaultEmbeddingProfileSetting {
  profileId: string | null;
}

const SETTING_KEYS = {
  DEFAULT_EMBEDDING_PROFILE: 'default_embedding_profile',
} as const;

/**
 * Get the default embedding profile ID
 */
export async function getDefaultEmbeddingProfileId(db: Pool): Promise<string | null> {
  const service = getSystemSettingsService(db);
  const setting = await service.getSetting<DefaultEmbeddingProfileSetting>(
    SETTING_KEYS.DEFAULT_EMBEDDING_PROFILE
  );
  return setting?.profileId ?? null;
}

/**
 * Set the default embedding profile ID
 */
export async function setDefaultEmbeddingProfileId(
  db: Pool,
  profileId: string | null
): Promise<void> {
  const service = getSystemSettingsService(db);
  await service.setSetting<DefaultEmbeddingProfileSetting>(SETTING_KEYS.DEFAULT_EMBEDDING_PROFILE, {
    profileId,
  });
}
