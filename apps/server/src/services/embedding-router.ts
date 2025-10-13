export type EmbeddingProvider = 'ollama' | 'openai' | 'voyage';

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

const PROVIDER_CONFIGS: Record<EmbeddingProvider, EmbeddingConfig> = {
  ollama: { provider: 'ollama', model: 'nomic-embed-text', dimensions: 768 },
  openai: { provider: 'openai', model: 'text-embedding-3-large', dimensions: 1536 },
  voyage: { provider: 'voyage', model: 'voyage-code-2', dimensions: 1024 },
};

const SUPPORTED_PROVIDERS: EmbeddingProvider[] = ['ollama', 'openai', 'voyage'];

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

export interface ProviderSelection {
  primary: EmbeddingConfig;
  fallback: EmbeddingConfig;
}

export function selectEmbeddingProvider(
  content: string,
  context?: ContentContext
): ProviderSelection {
  // Explicit context type wins.
  if (context?.type === 'code' || isCodeContent(content, context?.language)) {
    return {
      primary: getConfigFromEnv('CODE_EMBEDDING_PROVIDER', 'voyage'),
      fallback: PROVIDER_CONFIGS.ollama,
    };
  }

  if (context?.type === 'personal' || context?.isPersonalCollection) {
    return {
      primary: getConfigFromEnv('WRITING_EMBEDDING_PROVIDER', 'openai'),
      fallback: PROVIDER_CONFIGS.ollama,
    };
  }

  return {
    primary: getConfigFromEnv('DOC_EMBEDDING_PROVIDER', 'ollama'),
    fallback: PROVIDER_CONFIGS.ollama,
  };
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
  /<\w+>\s*\(.*\)/, // generics/function calls
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
  metadata: Record<string, unknown> | null | undefined
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
