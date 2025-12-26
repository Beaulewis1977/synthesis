/**
 * Embedding Profiles Types
 *
 * Phase 5: Types for embedding profile configuration.
 * Profiles bundle provider, model, and chunking settings.
 */

/**
 * Cost tier for UI display
 */
export type CostTier = 'free' | 'low' | 'medium' | 'high';

/**
 * Embedding profile definition
 */
export interface EmbeddingProfile {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  provider: string;
  model: string;
  chunkSize: number;
  chunkOverlap: number;
  codeAware: boolean;
  costTier: CostTier;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Database row for embedding_profiles table
 */
export interface EmbeddingProfileRow {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  provider: string;
  model: string;
  chunk_size: number;
  chunk_overlap: number;
  code_aware: boolean;
  cost_tier: CostTier;
  is_system: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Input for creating a new embedding profile
 */
export interface CreateEmbeddingProfileInput {
  name: string;
  displayName: string;
  description?: string;
  provider: string;
  model: string;
  chunkSize?: number;
  chunkOverlap?: number;
  codeAware?: boolean;
  costTier?: CostTier;
}

/**
 * Input for updating an embedding profile
 */
export interface UpdateEmbeddingProfileInput {
  displayName?: string;
  description?: string;
  provider?: string;
  model?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  codeAware?: boolean;
  costTier?: CostTier;
}

/**
 * Response from GET /api/admin/profiles
 */
export interface EmbeddingProfilesResponse {
  profiles: EmbeddingProfile[];
  defaultProfileId: string | null;
}

/**
 * System profile names (built-in, cannot be deleted)
 */
export const SYSTEM_PROFILE_NAMES = ['none', 'free-local', 'cheap', 'medium', 'high'] as const;
export type SystemProfileName = (typeof SYSTEM_PROFILE_NAMES)[number];

/**
 * Default profile name used when no profile is specified
 */
export const DEFAULT_PROFILE_NAME: SystemProfileName = 'free-local';

/**
 * Profile presets for reference (actual values come from DB)
 * All profiles use 1024-dimension models for consistency.
 */
export const PROFILE_PRESETS: Record<
  SystemProfileName,
  Omit<EmbeddingProfile, 'id' | 'createdAt' | 'updatedAt'>
> = {
  none: {
    name: 'none',
    displayName: 'Manual Configuration',
    description: 'Use per-type model selectors below. No preset applied.',
    provider: '',
    model: '',
    chunkSize: 800,
    chunkOverlap: 150,
    codeAware: false,
    costTier: 'free',
    isSystem: true,
  },
  'free-local': {
    name: 'free-local',
    displayName: 'Free & Local',
    description:
      'Local embedding with Ollama mxbai-embed-large. Free, 1024 dimensions, good for general documentation.',
    provider: 'ollama',
    model: 'mxbai-embed-large',
    chunkSize: 1000,
    chunkOverlap: 150,
    codeAware: false,
    costTier: 'free',
    isSystem: true,
  },
  cheap: {
    name: 'cheap',
    displayName: 'Cheap',
    description: 'Voyage voyage-3.5-lite embeddings. Low cost, 1024 dimensions, good balance.',
    provider: 'voyage',
    model: 'voyage-3.5-lite',
    chunkSize: 800,
    chunkOverlap: 150,
    codeAware: true,
    costTier: 'low',
    isSystem: true,
  },
  medium: {
    name: 'medium',
    displayName: 'Medium',
    description:
      'Voyage voyage-3-large embeddings. Medium cost, 1024 dimensions, excellent for code.',
    provider: 'voyage',
    model: 'voyage-3-large',
    chunkSize: 600,
    chunkOverlap: 100,
    codeAware: true,
    costTier: 'medium',
    isSystem: true,
  },
  high: {
    name: 'high',
    displayName: 'High Quality',
    description: 'Voyage voyage-3.5 embeddings. Highest quality, 1024 dimensions.',
    provider: 'voyage',
    model: 'voyage-3.5',
    chunkSize: 600,
    chunkOverlap: 100,
    codeAware: false,
    costTier: 'high',
    isSystem: true,
  },
};

/**
 * Convert database row to EmbeddingProfile
 */
export function rowToEmbeddingProfile(row: EmbeddingProfileRow): EmbeddingProfile {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    description: row.description,
    provider: row.provider,
    model: row.model,
    chunkSize: row.chunk_size,
    chunkOverlap: row.chunk_overlap,
    codeAware: row.code_aware,
    costTier: row.cost_tier,
    isSystem: row.is_system,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Validate profile input
 */
export function validateProfileInput(
  input: CreateEmbeddingProfileInput | UpdateEmbeddingProfileInput
): string[] {
  const errors: string[] = [];

  if ('name' in input && input.name) {
    if (!/^[a-z0-9-]+$/.test(input.name)) {
      errors.push('Name must contain only lowercase letters, numbers, and hyphens');
    }
    if (input.name.length < 2 || input.name.length > 50) {
      errors.push('Name must be between 2 and 50 characters');
    }
  }

  if ('chunkSize' in input && input.chunkSize !== undefined) {
    if (input.chunkSize < 100 || input.chunkSize > 10000) {
      errors.push('Chunk size must be between 100 and 10000');
    }
  }

  if ('chunkOverlap' in input && input.chunkOverlap !== undefined) {
    if (input.chunkOverlap < 0) {
      errors.push('Chunk overlap must be non-negative');
    }
    if ('chunkSize' in input && input.chunkSize && input.chunkOverlap >= input.chunkSize) {
      errors.push('Chunk overlap must be less than chunk size');
    }
  }

  if ('provider' in input && input.provider !== undefined) {
    const validProviders = ['ollama', 'openai', 'voyage', 'cohere'] as const;
    const provider = input.provider;
    const name = 'name' in input ? input.name : undefined;
    const isNoneProfile = name === 'none';

    if (provider === '' && !isNoneProfile) {
      errors.push("Provider may be empty only for the 'none' profile");
    } else if (
      provider !== '' &&
      !validProviders.includes(provider as (typeof validProviders)[number])
    ) {
      errors.push(`Invalid provider. Must be one of: ${validProviders.join(', ')}`);
    }
  }

  if ('model' in input && input.model !== undefined) {
    const provider = 'provider' in input ? input.provider : undefined;
    if (provider && !input.model) {
      errors.push('Model is required when provider is set');
    }
    if (provider === '' && input.model) {
      errors.push('Model must be empty when provider is empty');
    }
  }

  if ('costTier' in input && input.costTier) {
    const validTiers: CostTier[] = ['free', 'low', 'medium', 'high'];
    if (!validTiers.includes(input.costTier)) {
      errors.push(`Invalid cost tier. Must be one of: ${validTiers.join(', ')}`);
    }
  }

  return errors;
}
