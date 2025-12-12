import { getPool } from '@synthesis/db';
import type { DocumentMetadata } from '@synthesis/shared';
import { getModelConfigService } from './model-config-service.js';

export type EmbeddingProvider = 'ollama' | 'openai' | 'voyage' | 'cohere' | 'google';

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  dimensions: number;
}

export interface ContentContext {
  type?: 'code' | 'docs' | 'personal';
  language?: string;
  collectionId?: string;
  isPersonalCollection?: boolean;
}

/**
 * Model dimension map for all supported embedding models
 */
export const MODEL_DIMENSIONS: Record<string, number> = {
  // Voyage v3.5 models (1024 dims default, general-purpose)
  'voyage-3.5': 1024, // General + multilingual
  'voyage-3.5-lite': 1024, // Fast general
  // Voyage v3 models (1024 dims default)
  'voyage-code-3': 1024, // Best for code retrieval
  'voyage-3-large': 1024, // General-purpose
  // Voyage v2 models (legacy)
  'voyage-code-2': 1536,
  'voyage-large-2': 1536,
  'voyage-2': 1024,
  // OpenAI models
  'text-embedding-3-large': 1536,
  'text-embedding-3-small': 1536,
  'text-embedding-ada-002': 1536,
  // Cohere models
  'embed-v4.0': 1536,
  'embed-english-v3.0': 1024,
  'embed-multilingual-v3.0': 1024,
  // Google models
  'text-embedding-004': 768,
  'gemini-embedding-001': 768,
  // Ollama models
  'nomic-embed-text': 768,
  'mxbai-embed-large': 1024,
  'jina-embeddings-v2-base-code': 768, // Code-specialized, 30+ languages
};

/**
 * Get dimensions for a model, with fallback to provider default
 */
export function getModelDimensions(model: string, provider?: EmbeddingProvider): number {
  if (MODEL_DIMENSIONS[model]) {
    return MODEL_DIMENSIONS[model];
  }
  // Fallback to provider defaults (kept in sync with PROVIDER_CONFIGS)
  if (provider) {
    return PROVIDER_CONFIGS[provider].dimensions;
  }
  return 768; // Ultimate fallback
}

const PROVIDER_CONFIGS: Record<EmbeddingProvider, EmbeddingConfig> = {
  ollama: { provider: 'ollama', model: 'nomic-embed-text', dimensions: 768 },
  openai: { provider: 'openai', model: 'text-embedding-3-large', dimensions: 1536 },
  voyage: { provider: 'voyage', model: 'voyage-code-3', dimensions: 1024 }, // Updated to v3
  cohere: { provider: 'cohere', model: 'embed-v4.0', dimensions: 1536 }, // Updated to v4
  google: { provider: 'google', model: 'text-embedding-004', dimensions: 768 },
};

const SUPPORTED_PROVIDERS: EmbeddingProvider[] = ['ollama', 'openai', 'voyage', 'cohere', 'google'];

export function isEmbeddingProvider(candidate: string | undefined): candidate is EmbeddingProvider {
  return candidate !== undefined && SUPPORTED_PROVIDERS.includes(candidate as EmbeddingProvider);
}

export function getProviderConfig(
  provider: EmbeddingProvider | string | undefined,
  fallback: EmbeddingProvider = 'ollama'
): EmbeddingConfig {
  if (!provider) {
    return PROVIDER_CONFIGS[fallback];
  }

  if (!isEmbeddingProvider(provider)) {
    return PROVIDER_CONFIGS[fallback];
  }

  return PROVIDER_CONFIGS[provider];
}

/**
 * Select embedding provider synchronously (legacy, uses env vars)
 * @deprecated Use selectEmbeddingProviderAsync for ModelConfigService support
 */
export function selectEmbeddingProvider(
  content: string,
  context?: ContentContext
): EmbeddingConfig {
  if (context?.type === 'code') {
    return getConfigFromEnv('CODE_EMBEDDING_PROVIDER', 'voyage');
  }

  if (context?.type === 'personal' || context?.isPersonalCollection) {
    return getConfigFromEnv('WRITING_EMBEDDING_PROVIDER', 'openai');
  }

  if (isCodeContent(content, context?.language)) {
    return getConfigFromEnv('CODE_EMBEDDING_PROVIDER', 'voyage');
  }

  return getConfigFromEnv('DOC_EMBEDDING_PROVIDER', 'ollama');
}

/**
 * Select embedding provider using ModelConfigService (async)
 * This is the preferred method for new code
 */
export async function selectEmbeddingProviderAsync(
  content: string,
  context?: ContentContext
): Promise<EmbeddingConfig> {
  try {
    const db = getPool();
    const modelConfigService = getModelConfigService(db);

    let configType: 'docs' | 'code' | 'writing' = 'docs';

    if (context?.type === 'code') {
      configType = 'code';
    } else if (context?.type === 'personal' || context?.isPersonalCollection) {
      configType = 'writing';
    } else if (isCodeContent(content, context?.language)) {
      configType = 'code';
    }

    const config = await modelConfigService.getEmbeddingConfig(configType);

    // Map to EmbeddingConfig format
    const provider = config.provider as EmbeddingProvider;
    if (!isEmbeddingProvider(provider)) {
      // Fall back to default if provider is not valid
      return PROVIDER_CONFIGS[
        configType === 'code' ? 'voyage' : configType === 'writing' ? 'openai' : 'ollama'
      ];
    }

    return {
      provider,
      model: config.model,
      dimensions: getModelDimensions(config.model, provider),
    };
  } catch {
    // Fall back to synchronous method if service unavailable
    return selectEmbeddingProvider(content, context);
  }
}

function getConfigFromEnv(envVar: string, defaultProvider: EmbeddingProvider): EmbeddingConfig {
  const value = process.env[envVar];
  if (value && isEmbeddingProvider(value)) {
    return PROVIDER_CONFIGS[value];
  }

  return PROVIDER_CONFIGS[defaultProvider];
}

const CODE_PATTERNS: RegExp[] = [
  /^\s*(import|export)\s+/m,
  /^\s*(class|interface|enum)\s+\w+/m,
  /^\s*(async\s+)?function\s+\w+/m,
  /<\w+>\s*\(.*\)/,
  /\bconst\s+\w+\s*=/,
  /\/\//,
  /#include\s+</,
];

function isCodeContent(text: string, languageHint?: string): boolean {
  if (!text) {
    return false;
  }

  const lowerHint = languageHint?.toLowerCase() ?? '';
  if (
    ['dart', 'typescript', 'javascript', 'c', 'cpp', 'python', 'java', 'kotlin'].includes(lowerHint)
  ) {
    return true;
  }

  return CODE_PATTERNS.some((pattern) => pattern.test(text));
}

export function deriveContextFromMetadata(
  metadata: Record<string, unknown> | DocumentMetadata | null | undefined
): ContentContext | undefined {
  if (!metadata) {
    return undefined;
  }

  const docType = typeof metadata.doc_type === 'string' ? metadata.doc_type : undefined;
  const language = typeof metadata.language === 'string' ? metadata.language : undefined;
  const framework = typeof metadata.framework === 'string' ? metadata.framework : undefined;

  if (docType === 'code_sample' || docType === 'build_plan' || framework) {
    return { type: 'code', language };
  }

  if (docType === 'personal_writing') {
    return { type: 'personal', language };
  }

  return language ? { type: 'docs', language } : undefined;
}
