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
export const SYSTEM_PROFILE_NAMES = [
  'none',
  'fast-cheap',
  'balanced',
  'high-accuracy-code',
  'high-accuracy-docs',
] as const;
export type SystemProfileName = (typeof SYSTEM_PROFILE_NAMES)[number];

/**
 * Default profile name used when no profile is specified
 */
export const DEFAULT_PROFILE_NAME: SystemProfileName = 'balanced';

/**
 * Profile presets for reference (actual values come from DB)
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
  'fast-cheap': {
    name: 'fast-cheap',
    displayName: 'Fast & Cheap',
    description:
      'Local embedding with Ollama nomic-embed-text. Free, fast, good for general documentation.',
    provider: 'ollama',
    model: 'nomic-embed-text',
    chunkSize: 1000,
    chunkOverlap: 150,
    codeAware: false,
    costTier: 'free',
    isSystem: true,
  },
  balanced: {
    name: 'balanced',
    displayName: 'Balanced',
    description:
      'OpenAI text-embedding-3-small with code-aware chunking. Good balance of cost and quality.',
    provider: 'openai',
    model: 'text-embedding-3-small',
    chunkSize: 800,
    chunkOverlap: 150,
    codeAware: true,
    costTier: 'low',
    isSystem: true,
  },
  'high-accuracy-code': {
    name: 'high-accuracy-code',
    displayName: 'High Accuracy (Code)',
    description: 'Voyage voyage-code-3 embeddings optimized for code. Best for code repositories.',
    provider: 'voyage',
    model: 'voyage-code-3',
    chunkSize: 600,
    chunkOverlap: 100,
    codeAware: true,
    costTier: 'medium',
    isSystem: true,
  },
  'high-accuracy-docs': {
    name: 'high-accuracy-docs',
    displayName: 'High Accuracy (Docs)',
    description: 'OpenAI text-embedding-3-large for general documentation. Best quality for docs.',
    provider: 'openai',
    model: 'text-embedding-3-large',
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

  if ('provider' in input && input.provider) {
    // Empty provider is allowed for 'none' profile (manual configuration)
    const validProviders = ['ollama', 'openai', 'voyage', 'cohere', 'google', ''];
    if (!validProviders.includes(input.provider)) {
      errors.push(
        `Invalid provider. Must be one of: ${validProviders.filter((p) => p).join(', ')}`
      );
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
