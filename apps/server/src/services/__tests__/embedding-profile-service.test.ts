/**
 * Embedding Profile Service Tests
 *
 * Phase 5: Tests for embedding profile management.
 */

import type { Pool, QueryResult } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EmbeddingProfileService,
  resetEmbeddingProfileService,
} from '../embedding-profile-service.js';

// Helper to create a mock QueryResult
function mockQueryResult<T>(rows: T[], rowCount?: number): QueryResult<T> {
  return {
    rows,
    rowCount: rowCount ?? rows.length,
    command: 'SELECT',
    oid: 0,
    fields: [],
  };
}

// Mock database pool
function createMockPool(queryResults: Record<string, { rows: unknown[]; rowCount: number }>): Pool {
  const mockQuery = vi.fn().mockImplementation((sql: string, _params?: unknown[]) => {
    // Match query patterns
    for (const [pattern, result] of Object.entries(queryResults)) {
      if (sql.includes(pattern)) {
        return Promise.resolve(mockQueryResult(result.rows, result.rowCount));
      }
    }
    // Default empty result
    return Promise.resolve(mockQueryResult([], 0));
  });

  return {
    query: mockQuery,
  } as unknown as Pool;
}

// Sample profile data
const sampleProfiles = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'fast-cheap',
    display_name: 'Fast & Cheap',
    description: 'Local embedding with Ollama',
    provider: 'ollama',
    model: 'nomic-embed-text',
    chunk_size: 1000,
    chunk_overlap: 150,
    code_aware: false,
    cost_tier: 'free',
    is_system: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'balanced',
    display_name: 'Balanced',
    description: 'OpenAI embeddings',
    provider: 'openai',
    model: 'text-embedding-3-small',
    chunk_size: 800,
    chunk_overlap: 150,
    code_aware: true,
    cost_tier: 'low',
    is_system: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'custom-profile',
    display_name: 'Custom Profile',
    description: 'User-created profile',
    provider: 'voyage',
    model: 'voyage-code-2',
    chunk_size: 500,
    chunk_overlap: 100,
    code_aware: true,
    cost_tier: 'medium',
    is_system: false,
    created_at: new Date(),
    updated_at: new Date(),
  },
];

describe('EmbeddingProfileService', () => {
  beforeEach(() => {
    resetEmbeddingProfileService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllProfiles', () => {
    it('returns all profiles from database', async () => {
      const mockPool = createMockPool({
        'SELECT * FROM embedding_profiles': {
          rows: sampleProfiles,
          rowCount: 3,
        },
      });

      const service = new EmbeddingProfileService(mockPool);
      const profiles = await service.getAllProfiles();

      expect(profiles).toHaveLength(3);
      expect(profiles[0].name).toBe('fast-cheap');
      expect(profiles[0].displayName).toBe('Fast & Cheap');
      expect(profiles[0].isSystem).toBe(true);
    });

    it('caches results for subsequent calls', async () => {
      const mockPool = createMockPool({
        'SELECT * FROM embedding_profiles': {
          rows: sampleProfiles,
          rowCount: 3,
        },
      });

      const service = new EmbeddingProfileService(mockPool);

      await service.getAllProfiles();
      await service.getAllProfiles();

      // Should only query once due to caching
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('getProfileById', () => {
    it('returns profile when found', async () => {
      const mockPool = createMockPool({
        'WHERE id = $1': {
          rows: [sampleProfiles[0]],
          rowCount: 1,
        },
      });

      const service = new EmbeddingProfileService(mockPool);
      const profile = await service.getProfileById('11111111-1111-1111-1111-111111111111');

      expect(profile).not.toBeNull();
      expect(profile?.name).toBe('fast-cheap');
    });

    it('returns null when not found', async () => {
      const mockPool = createMockPool({
        'WHERE id = $1': {
          rows: [],
          rowCount: 0,
        },
      });

      const service = new EmbeddingProfileService(mockPool);
      const profile = await service.getProfileById('nonexistent-id');

      expect(profile).toBeNull();
    });
  });

  describe('getProfileByName', () => {
    it('returns profile when found', async () => {
      const mockPool = createMockPool({
        'WHERE name = $1': {
          rows: [sampleProfiles[1]],
          rowCount: 1,
        },
      });

      const service = new EmbeddingProfileService(mockPool);
      const profile = await service.getProfileByName('balanced');

      expect(profile).not.toBeNull();
      expect(profile?.displayName).toBe('Balanced');
    });
  });

  describe('getDefaultProfile', () => {
    it('returns balanced profile as default', async () => {
      const mockPool = createMockPool({
        'WHERE name = $1': {
          rows: [sampleProfiles[1]],
          rowCount: 1,
        },
      });

      const service = new EmbeddingProfileService(mockPool);
      const profile = await service.getDefaultProfile();

      expect(profile.name).toBe('balanced');
    });

    it('returns fallback when DB not seeded', async () => {
      const mockPool = createMockPool({
        'WHERE name = $1': {
          rows: [],
          rowCount: 0,
        },
      });

      const service = new EmbeddingProfileService(mockPool);
      const profile = await service.getDefaultProfile();

      // Should return in-memory preset
      expect(profile.name).toBe('balanced');
      expect(profile.provider).toBe('openai');
    });
  });

  describe('getProfileForCollection', () => {
    it('returns collection profile when set', async () => {
      const mockPool = createMockPool({
        'SELECT embedding_profile_id FROM collections': {
          rows: [{ embedding_profile_id: '33333333-3333-3333-3333-333333333333' }],
          rowCount: 1,
        },
        'WHERE id = $1': {
          rows: [sampleProfiles[2]],
          rowCount: 1,
        },
      });

      const service = new EmbeddingProfileService(mockPool);
      const profile = await service.getProfileForCollection('collection-id');

      expect(profile.name).toBe('custom-profile');
    });

    it('returns default when collection has no profile', async () => {
      const mockPool = createMockPool({
        'SELECT embedding_profile_id FROM collections': {
          rows: [{ embedding_profile_id: null }],
          rowCount: 1,
        },
        'WHERE name = $1': {
          rows: [sampleProfiles[1]],
          rowCount: 1,
        },
      });

      const service = new EmbeddingProfileService(mockPool);
      const profile = await service.getProfileForCollection('collection-id');

      expect(profile.name).toBe('balanced');
    });
  });

  describe('createProfile', () => {
    it('creates a new profile', async () => {
      const newProfile = {
        ...sampleProfiles[2],
        name: 'new-profile',
        display_name: 'New Profile',
      };

      const mockPool = createMockPool({
        'WHERE name = $1': {
          rows: [],
          rowCount: 0,
        },
        'INSERT INTO embedding_profiles': {
          rows: [newProfile],
          rowCount: 1,
        },
      });

      const service = new EmbeddingProfileService(mockPool);
      const profile = await service.createProfile({
        name: 'new-profile',
        displayName: 'New Profile',
        provider: 'voyage',
        model: 'voyage-code-2',
      });

      expect(profile.name).toBe('new-profile');
    });

    it('throws error for duplicate name', async () => {
      const mockPool = createMockPool({
        'WHERE name = $1': {
          rows: [sampleProfiles[0]],
          rowCount: 1,
        },
      });

      const service = new EmbeddingProfileService(mockPool);

      await expect(
        service.createProfile({
          name: 'fast-cheap',
          displayName: 'Duplicate',
          provider: 'ollama',
          model: 'nomic-embed-text',
        })
      ).rejects.toThrow("Profile with name 'fast-cheap' already exists");
    });

    it('validates input', async () => {
      const mockPool = createMockPool({});
      const service = new EmbeddingProfileService(mockPool);

      await expect(
        service.createProfile({
          name: 'INVALID NAME',
          displayName: 'Test',
          provider: 'ollama',
          model: 'nomic-embed-text',
        })
      ).rejects.toThrow('Invalid profile input');
    });
  });

  describe('updateProfile', () => {
    it('updates a non-system profile', async () => {
      const updatedProfile = {
        ...sampleProfiles[2],
        display_name: 'Updated Name',
      };

      const mockPool = createMockPool({
        'WHERE id = $1': {
          rows: [sampleProfiles[2]],
          rowCount: 1,
        },
        'UPDATE embedding_profiles': {
          rows: [updatedProfile],
          rowCount: 1,
        },
      });

      const service = new EmbeddingProfileService(mockPool);
      const profile = await service.updateProfile('33333333-3333-3333-3333-333333333333', {
        displayName: 'Updated Name',
      });

      expect(profile.displayName).toBe('Updated Name');
    });

    it('restricts updates to system profiles', async () => {
      const mockPool = createMockPool({
        'WHERE id = $1': {
          rows: [sampleProfiles[0]], // System profile
          rowCount: 1,
        },
      });

      const service = new EmbeddingProfileService(mockPool);

      await expect(
        service.updateProfile('11111111-1111-1111-1111-111111111111', {
          provider: 'openai', // Not allowed on system profile
        })
      ).rejects.toThrow('Cannot modify');
    });

    it('allows displayName update on system profiles', async () => {
      const updatedProfile = {
        ...sampleProfiles[0],
        display_name: 'Updated System Name',
      };

      const mockPool = createMockPool({
        'WHERE id = $1': {
          rows: [sampleProfiles[0]],
          rowCount: 1,
        },
        'UPDATE embedding_profiles': {
          rows: [updatedProfile],
          rowCount: 1,
        },
      });

      const service = new EmbeddingProfileService(mockPool);
      const profile = await service.updateProfile('11111111-1111-1111-1111-111111111111', {
        displayName: 'Updated System Name',
      });

      expect(profile.displayName).toBe('Updated System Name');
    });
  });

  describe('deleteProfile', () => {
    it('deletes a non-system profile', async () => {
      const mockPool = createMockPool({
        'WHERE id = $1': {
          rows: [sampleProfiles[2]], // Non-system profile
          rowCount: 1,
        },
        'SELECT COUNT': {
          rows: [{ count: '0' }],
          rowCount: 1,
        },
        'DELETE FROM embedding_profiles': {
          rows: [],
          rowCount: 1,
        },
      });

      const service = new EmbeddingProfileService(mockPool);

      await expect(
        service.deleteProfile('33333333-3333-3333-3333-333333333333')
      ).resolves.not.toThrow();
    });

    it('throws error for system profile', async () => {
      const mockPool = createMockPool({
        'WHERE id = $1': {
          rows: [sampleProfiles[0]], // System profile
          rowCount: 1,
        },
      });

      const service = new EmbeddingProfileService(mockPool);

      await expect(service.deleteProfile('11111111-1111-1111-1111-111111111111')).rejects.toThrow(
        'Cannot delete system profile'
      );
    });

    it('throws error when profile is in use', async () => {
      const mockPool = createMockPool({
        'WHERE id = $1': {
          rows: [sampleProfiles[2]],
          rowCount: 1,
        },
        'SELECT COUNT': {
          rows: [{ count: '3' }], // 3 collections using this profile
          rowCount: 1,
        },
      });

      const service = new EmbeddingProfileService(mockPool);

      await expect(service.deleteProfile('33333333-3333-3333-3333-333333333333')).rejects.toThrow(
        '3 collection(s) are using it'
      );
    });
  });

  describe('setCollectionProfile', () => {
    it('sets profile for collection', async () => {
      const mockPool = createMockPool({
        'WHERE id = $1': {
          rows: [sampleProfiles[2]],
          rowCount: 1,
        },
        'UPDATE collections': {
          rows: [],
          rowCount: 1,
        },
      });

      const service = new EmbeddingProfileService(mockPool);

      await expect(
        service.setCollectionProfile('collection-id', '33333333-3333-3333-3333-333333333333')
      ).resolves.not.toThrow();
    });

    it('clears profile when null', async () => {
      const mockPool = createMockPool({
        'UPDATE collections': {
          rows: [],
          rowCount: 1,
        },
      });

      const service = new EmbeddingProfileService(mockPool);

      await expect(service.setCollectionProfile('collection-id', null)).resolves.not.toThrow();
    });

    it('throws error for non-existent profile', async () => {
      const mockPool = createMockPool({
        'WHERE id = $1': {
          rows: [],
          rowCount: 0,
        },
      });

      const service = new EmbeddingProfileService(mockPool);

      await expect(
        service.setCollectionProfile('collection-id', 'nonexistent-profile-id')
      ).rejects.toThrow('Profile not found');
    });
  });
});
