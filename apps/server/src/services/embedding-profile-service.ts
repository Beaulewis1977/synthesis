/**
 * Embedding Profile Service
 *
 * Phase 5: Manages embedding profiles for per-collection configuration.
 * Profiles bundle provider, model, and chunking settings.
 */

import {
  type CreateEmbeddingProfileInput,
  DEFAULT_PROFILE_NAME,
  type EmbeddingProfile,
  type EmbeddingProfileRow,
  PROFILE_PRESETS,
  type UpdateEmbeddingProfileInput,
  rowToEmbeddingProfile,
  validateProfileInput,
} from '@synthesis/shared';
import type { Pool } from 'pg';
import {
  getDefaultEmbeddingProfileId,
  setDefaultEmbeddingProfileId,
} from './system-settings-service.js';

/**
 * Embedding Profile Service
 *
 * Manages embedding profiles with caching for performance.
 */
export class EmbeddingProfileService {
  private db: Pool;
  private cache: Map<string, { profile: EmbeddingProfile; timestamp: number }> = new Map();
  private allProfilesCache: { profiles: EmbeddingProfile[]; timestamp: number } | null = null;
  private readonly cacheTTL = 60_000; // 1 minute cache

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Get all embedding profiles
   */
  async getAllProfiles(): Promise<EmbeddingProfile[]> {
    // Check cache
    if (this.allProfilesCache && Date.now() - this.allProfilesCache.timestamp < this.cacheTTL) {
      return this.allProfilesCache.profiles;
    }

    try {
      const result = await this.db.query<EmbeddingProfileRow>(
        'SELECT * FROM embedding_profiles ORDER BY is_system DESC, name ASC'
      );

      const profiles = result.rows.map(rowToEmbeddingProfile);

      // Update cache
      this.allProfilesCache = { profiles, timestamp: Date.now() };

      return profiles;
    } catch {
      // Fallback to in-memory presets if DB table doesn't exist
      const profiles = Object.values(PROFILE_PRESETS).map((preset, index) => ({
        ...preset,
        id: `preset-${index}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      // Update cache with fallback
      this.allProfilesCache = { profiles, timestamp: Date.now() };

      return profiles;
    }
  }

  /**
   * Get profile by ID
   */
  async getProfileById(id: string): Promise<EmbeddingProfile | null> {
    // Check cache
    const cached = this.cache.get(`id:${id}`);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.profile;
    }

    const result = await this.db.query<EmbeddingProfileRow>(
      'SELECT * FROM embedding_profiles WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const profile = rowToEmbeddingProfile(result.rows[0]);

    // Update cache
    this.cache.set(`id:${id}`, { profile, timestamp: Date.now() });
    this.cache.set(`name:${profile.name}`, { profile, timestamp: Date.now() });

    return profile;
  }

  /**
   * Get profile by name
   */
  async getProfileByName(name: string): Promise<EmbeddingProfile | null> {
    // Check cache
    const cached = this.cache.get(`name:${name}`);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.profile;
    }

    const result = await this.db.query<EmbeddingProfileRow>(
      'SELECT * FROM embedding_profiles WHERE name = $1',
      [name]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const profile = rowToEmbeddingProfile(result.rows[0]);

    // Update cache
    this.cache.set(`id:${profile.id}`, { profile, timestamp: Date.now() });
    this.cache.set(`name:${name}`, { profile, timestamp: Date.now() });

    return profile;
  }

  /**
   * Get profile by ID or name
   */
  async getProfile(idOrName: string): Promise<EmbeddingProfile | null> {
    // Try by ID first (UUID format)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrName)) {
      const byId = await this.getProfileById(idOrName);
      if (byId) return byId;
    }

    // Try by name
    return this.getProfileByName(idOrName);
  }

  /**
   * Get the default profile
   *
   * Checks system settings first, then falls back to 'balanced' profile.
   */
  async getDefaultProfile(): Promise<EmbeddingProfile> {
    // Check system settings for user-configured default
    const configuredProfileId = await getDefaultEmbeddingProfileId(this.db);

    if (configuredProfileId) {
      const configuredProfile = await this.getProfileById(configuredProfileId);
      if (configuredProfile) {
        return configuredProfile;
      }
      // Profile was deleted, fall through to default
    }

    // Use 'balanced' as the default
    const profile = await this.getProfileByName(DEFAULT_PROFILE_NAME);

    if (!profile) {
      // Fallback to in-memory preset if DB not seeded
      const preset = PROFILE_PRESETS[DEFAULT_PROFILE_NAME];
      return {
        ...preset,
        id: 'default',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return profile;
  }

  /**
   * Set the default profile
   *
   * @param profileId - Profile ID to set as default, or null to use 'balanced'
   */
  async setDefaultProfile(profileId: string | null): Promise<EmbeddingProfile> {
    if (profileId) {
      // Verify profile exists
      const profile = await this.getProfileById(profileId);
      if (!profile) {
        throw new Error(`Profile not found: ${profileId}`);
      }
    }

    await setDefaultEmbeddingProfileId(this.db, profileId);

    // Return the new default profile
    return this.getDefaultProfile();
  }

  /**
   * Get profile for a collection (with fallback to default)
   */
  async getProfileForCollection(collectionId: string): Promise<EmbeddingProfile> {
    // Query collection's profile
    const result = await this.db.query<{ embedding_profile_id: string | null }>(
      'SELECT embedding_profile_id FROM collections WHERE id = $1',
      [collectionId]
    );

    if (result.rows.length === 0) {
      // Collection not found, return default
      return this.getDefaultProfile();
    }

    const profileId = result.rows[0].embedding_profile_id;

    if (!profileId) {
      // No profile set, return default
      return this.getDefaultProfile();
    }

    const profile = await this.getProfileById(profileId);

    if (!profile) {
      // Profile not found (deleted?), return default
      return this.getDefaultProfile();
    }

    return profile;
  }

  /**
   * Set collection's embedding profile
   */
  async setCollectionProfile(collectionId: string, profileId: string | null): Promise<void> {
    if (profileId) {
      // Verify profile exists
      const profile = await this.getProfileById(profileId);
      if (!profile) {
        throw new Error(`Profile not found: ${profileId}`);
      }
    }

    await this.db.query(
      'UPDATE collections SET embedding_profile_id = $1, updated_at = NOW() WHERE id = $2',
      [profileId, collectionId]
    );
  }

  /**
   * Create a new embedding profile
   */
  async createProfile(input: CreateEmbeddingProfileInput): Promise<EmbeddingProfile> {
    // Validate input
    const errors = validateProfileInput(input);
    if (errors.length > 0) {
      throw new Error(`Invalid profile input: ${errors.join(', ')}`);
    }

    // Check name uniqueness
    const existing = await this.getProfileByName(input.name);
    if (existing) {
      throw new Error(`Profile with name '${input.name}' already exists`);
    }

    const result = await this.db.query<EmbeddingProfileRow>(
      `INSERT INTO embedding_profiles 
       (name, display_name, description, provider, model, chunk_size, chunk_overlap, code_aware, cost_tier, is_system)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
       RETURNING *`,
      [
        input.name,
        input.displayName,
        input.description ?? null,
        input.provider,
        input.model,
        input.chunkSize ?? 800,
        input.chunkOverlap ?? 150,
        input.codeAware ?? false,
        input.costTier ?? 'low',
      ]
    );

    const profile = rowToEmbeddingProfile(result.rows[0]);

    // Invalidate caches
    this.invalidateCache();

    return profile;
  }

  /**
   * Update an embedding profile
   */
  async updateProfile(id: string, input: UpdateEmbeddingProfileInput): Promise<EmbeddingProfile> {
    // Get existing profile
    const existing = await this.getProfileById(id);
    if (!existing) {
      throw new Error(`Profile not found: ${id}`);
    }

    // System profiles can only have display_name and description updated
    if (existing.isSystem) {
      const allowedKeys = ['displayName', 'description'];
      const inputKeys = Object.keys(input).filter(
        (k) => input[k as keyof UpdateEmbeddingProfileInput] !== undefined
      );
      const disallowedKeys = inputKeys.filter((k) => !allowedKeys.includes(k));

      if (disallowedKeys.length > 0) {
        throw new Error(
          `Cannot modify ${disallowedKeys.join(', ')} on system profiles. Only displayName and description can be changed.`
        );
      }
    }

    // Validate chunk overlap against effective chunk size when updating
    if (input.chunkOverlap !== undefined) {
      const effectiveChunkSize = input.chunkSize ?? existing.chunkSize;
      if (input.chunkOverlap >= effectiveChunkSize) {
        throw new Error('Invalid profile input: Chunk overlap must be less than chunk size');
      }
    }

    // Validate input
    const errors = validateProfileInput(input);
    if (errors.length > 0) {
      throw new Error(`Invalid profile input: ${errors.join(', ')}`);
    }

    // Build update query
    const updates: string[] = ['updated_at = NOW()'];
    const params: (string | number | boolean | null)[] = [id];
    let paramIndex = 2;

    if (input.displayName !== undefined) {
      updates.push(`display_name = $${paramIndex++}`);
      params.push(input.displayName);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(input.description);
    }
    if (input.provider !== undefined) {
      updates.push(`provider = $${paramIndex++}`);
      params.push(input.provider);
    }
    if (input.model !== undefined) {
      updates.push(`model = $${paramIndex++}`);
      params.push(input.model);
    }
    if (input.chunkSize !== undefined) {
      updates.push(`chunk_size = $${paramIndex++}`);
      params.push(input.chunkSize);
    }
    if (input.chunkOverlap !== undefined) {
      updates.push(`chunk_overlap = $${paramIndex++}`);
      params.push(input.chunkOverlap);
    }
    if (input.codeAware !== undefined) {
      updates.push(`code_aware = $${paramIndex++}`);
      params.push(input.codeAware);
    }
    if (input.costTier !== undefined) {
      updates.push(`cost_tier = $${paramIndex++}`);
      params.push(input.costTier);
    }

    const result = await this.db.query<EmbeddingProfileRow>(
      `UPDATE embedding_profiles SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );

    const profile = rowToEmbeddingProfile(result.rows[0]);

    // Invalidate caches
    this.invalidateCache();

    return profile;
  }

  /**
   * Delete an embedding profile
   */
  async deleteProfile(id: string): Promise<void> {
    // Get existing profile
    const existing = await this.getProfileById(id);
    if (!existing) {
      throw new Error(`Profile not found: ${id}`);
    }

    // Cannot delete system profiles
    if (existing.isSystem) {
      throw new Error(`Cannot delete system profile: ${existing.name}`);
    }

    // Check if any collections are using this profile
    const usageResult = await this.db.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM collections WHERE embedding_profile_id = $1',
      [id]
    );

    const usageCount = Number.parseInt(usageResult.rows[0].count, 10);
    if (usageCount > 0) {
      throw new Error(
        `Cannot delete profile: ${usageCount} collection(s) are using it. Remove the profile from those collections first.`
      );
    }

    await this.db.query('DELETE FROM embedding_profiles WHERE id = $1', [id]);

    // Invalidate caches
    this.invalidateCache();
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.invalidateCache();
  }

  /**
   * Check if profile indicates manual/per-type configuration
   *
   * When this returns true, the pipeline should use per-type model configs
   * instead of the profile's provider/model settings.
   */
  isManualProfile(profile: EmbeddingProfile): boolean {
    return profile.name === 'none' || !profile.provider;
  }

  /**
   * Invalidate all caches
   */
  private invalidateCache(): void {
    this.cache.clear();
    this.allProfilesCache = null;
  }
}

// Singleton instance
let embeddingProfileServiceInstance: EmbeddingProfileService | null = null;

/**
 * Get the EmbeddingProfileService singleton instance
 */
export function getEmbeddingProfileService(db: Pool): EmbeddingProfileService {
  if (!embeddingProfileServiceInstance) {
    embeddingProfileServiceInstance = new EmbeddingProfileService(db);
  }
  return embeddingProfileServiceInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetEmbeddingProfileService(): void {
  embeddingProfileServiceInstance = null;
}
