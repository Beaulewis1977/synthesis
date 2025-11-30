// Phase 5: Embedding Profiles
export * from './embedding-profiles.js';

export type DocumentSourceQuality = 'official' | 'verified' | 'community';
export type DocumentType =
  | 'official_doc'
  | 'code_sample'
  | 'repo'
  | 'tutorial'
  | 'build_plan'
  | 'personal_writing';
export type DocumentFramework =
  | 'flutter'
  | 'dart'
  | 'fastify'
  | 'postgres'
  | 'supabase'
  | 'firebase'
  | 'fastapi'
  | 'django'
  | 'flask'
  | 'spring'
  | 'android'
  | 'react'
  | 'reactnative'
  | 'nextjs'
  | 'express'
  | 'nestjs'
  | 'redis'
  | 'gin'
  | 'echo'
  | 'actix'
  | 'tokio'
  | 'pytorch'
  | 'tensorflow';
export type DocumentLanguage =
  | 'dart'
  | 'typescript'
  | 'tsx'
  | 'javascript'
  | 'jsx'
  | 'yaml'
  | 'sql'
  | 'json'
  | 'markdown'
  | 'kotlin'
  | 'java'
  | 'swift'
  | 'python'
  | 'go'
  | 'rust'
  | 'c'
  | 'cpp'
  | 'csharp'
  | 'ruby'
  | 'php';
export type DocumentContentCategory =
  | 'api_reference'
  | 'tutorial'
  | 'example'
  | 'guide'
  | 'snippet';
export type EmbeddingModel = 'nomic-embed-text' | 'text-embedding-3-large' | 'voyage-code-2';
export type EmbeddingProvider = 'ollama' | 'openai' | 'voyage';

// Phase 3: Source type for metadata guarantees
export type SourceType = 'url' | 'repo' | 'file';

// =============================================================================
// GPT Phase 1: Mobile Feature Metadata Types
// =============================================================================

/**
 * Content platform classification for mobile-aware retrieval
 */
export type ContentPlatform = 'mobile' | 'web' | 'backend' | 'shared';

/**
 * Usage tier for source quality classification
 * - official: Official documentation from framework/library maintainers
 * - reference: Package documentation, API references
 * - example: Code examples, sample projects, demos
 * - recipe: Curated recipes, guides, tutorials with opinionated patterns
 */
export type UsageTier = 'official' | 'reference' | 'example' | 'recipe';

/**
 * Mobile feature tags for feature-aware retrieval.
 * Enables agents to search for specific mobile SaaS features.
 */
export type MobileFeatureTag =
  // Authentication & Identity
  | 'auth'
  | 'onboarding'
  | 'social_auth'
  // Payments & Monetization
  | 'billing'
  | 'payments'
  | 'subscriptions'
  // Communication & Notifications
  | 'push_notifications'
  | 'chat'
  | 'realtime'
  // Data & Storage
  | 'offline'
  | 'sync'
  | 'caching'
  | 'search'
  // Navigation & UI
  | 'navigation'
  | 'state_management'
  | 'forms'
  | 'theming'
  | 'localization'
  // Device Features
  | 'camera'
  | 'file_upload'
  | 'location'
  | 'maps'
  // Analytics & Monitoring
  | 'analytics'
  | 'deep_linking';

// Phase 3: Chunk type classification
export type ChunkType = 'text' | 'code' | 'sql' | 'config' | 'heading' | 'list' | 'analysis';

/**
 * Required document metadata fields (Phase 3: Metadata Guarantees)
 * These fields should be present on all new documents after ingestion.
 */
export interface RequiredDocumentMetadata {
  /** The source URL, repository URL, or file path */
  source: string;
  /** Classification of the source */
  source_type: SourceType;
  /** Programming languages detected in the document */
  languages: string[];
  /** ISO timestamp when the document was ingested */
  ingested_at: string;
  /** Framework version if applicable (e.g., 'Flutter 3.24.5') */
  framework_version?: string;
  /** Git commit SHA for repository sources */
  commit_sha?: string;
}

/**
 * Required chunk metadata fields (Phase 3: Metadata Guarantees)
 * These fields should be present on all chunks after chunking.
 */
export interface RequiredChunkMetadata {
  /** Classification of the chunk content */
  chunk_type: ChunkType;
  /** Inclusive start offset within the source text */
  startOffset: number;
  /** Exclusive end offset within the source text */
  endOffset: number;
  /** Programming language of the chunk (for code chunks) */
  language?: string;
  /** Source file path */
  file_path?: string;
  /** Class name if chunk is part of a class */
  class_name?: string;
  /** Function name if chunk is a function */
  function_name?: string;
}

export interface DocumentMetadata {
  doc_type?: DocumentType;
  source_url?: string;
  source_quality?: DocumentSourceQuality;
  source_author?: string;
  framework?: DocumentFramework;
  framework_version?: string;
  sdk_constraints?: string;
  compatibility_tested?: string[];
  language?: DocumentLanguage;
  content_category?: DocumentContentCategory;
  file_path?: string;
  repo_name?: string;
  repo_stars?: number;
  embedding_model?: EmbeddingModel | string;
  embedding_provider?: EmbeddingProvider | string;
  embedding_dimensions?: number;
  last_verified?: string | Date;
  published_date?: string | Date;
  tags?: string[];
  notes?: string;

  // Phase 3: Required metadata fields (added to existing interface for compatibility)
  /** The source URL, repository URL, or file path */
  source?: string;
  /** Classification of the source: 'url' | 'repo' | 'file' */
  source_type?: SourceType;
  /** Programming languages detected in the document */
  languages?: string[];
  /** ISO timestamp when the document was ingested */
  ingested_at?: string;
  /** Git commit SHA for repository sources */
  commit_sha?: string;

  // GPT Phase 1: Mobile feature metadata
  /** Content platform classification */
  platform?: ContentPlatform;
  /** Mobile feature tags for feature-aware retrieval */
  feature_tags?: MobileFeatureTag[];
  /** Usage tier for source quality classification */
  usage_tier?: UsageTier;
  /** Whether this document is recommended for its feature category */
  recommended?: boolean;

  // Phase 10: File-level imports (stored once per file, not per chunk)
  /** Import statements extracted from the file (stored at document level to avoid duplication) */
  file_imports?: string[];

  [key: string]: unknown;
}

// Phase 9: Chunk hierarchy type for hierarchical code chunking
export type ChunkHierarchy = 'overview' | 'detail';

export interface ChunkMetadata extends DocumentMetadata {
  chunk_type?: ChunkType;
  heading?: string;
  page?: number | string;
  line_range?: [number, number];

  // Phase 10: Import reference flag (only on first chunk when file has imports)
  /** Indicates this chunk's file has imports stored at document level */
  has_file_imports?: boolean;

  // Phase 9: Hierarchical chunking fields
  /** UUID of parent/overview chunk (for method chunks linking to class overview) */
  parent_chunk_id?: string;
  /** UUID identifying this overview chunk (set on overview chunks, referenced by children) */
  overview_chunk_id?: string;
  /** Hierarchy level: 'overview' for class summaries, 'detail' for methods */
  chunk_hierarchy?: ChunkHierarchy;
  /** Number of sibling/child chunks (for overview chunks) */
  sibling_count?: number;
  /** Class context for method chunks (existing field, now also used for hierarchy) */
  class_context?: string;

  // Code intelligence fields (Phase 13)
  function_name?: string;
  parameters?: string[];
  return_type?: string;
  class_name?: string;
  methods?: string[];
  properties?: string[];
  extends?: string;
  implements?: string[];
  imports?: string[];
  dependencies?: Record<string, string>;

  // Code categorization flags (Phase 13)
  is_widget?: boolean;
  is_stateful?: boolean;
  is_service?: boolean;
  is_model?: boolean;
  is_example?: boolean;

  // GPT Phase 1: Mobile feature chunk metadata
  /** Content platform classification (inherited or chunk-specific) */
  platform?: ContentPlatform;
  /** Mobile feature tags for this chunk */
  feature_tags?: MobileFeatureTag[];
  /** Whether this chunk is from a curated recipe document */
  is_recipe?: boolean;

  // Backend intelligence fields (Phase 13.5)
  tech_stack?: string[];
  table?: string;
  schema?: string;
  columns?: Array<{ name: string; type: string; constraints?: string[] }>;
  indexes?: string[];
  foreign_keys?: Array<{ column: string; references_table: string; references_column: string }>;
  sql_type?: 'table' | 'index' | 'function' | 'view' | 'migration';
  format?: 'yaml' | 'json';
  keys?: string[];
  nested_paths?: string[];
  config_section?: string;
  maps_to?: { type: 'table' | 'model' | 'endpoint'; name: string };

  // Legacy fields
  startOffset?: number;
  endOffset?: number;
  section?: string;
  pageNumber?: number;
}

// Backend AST Types (Phase 13.5)

export interface ColumnDefinition {
  name: string;
  type: string;
  constraints?: string[];
  nullable?: boolean;
  default_value?: string;
  comment?: string;
}

export interface IndexDefinition {
  name: string;
  table: string;
  columns: string[];
  unique?: boolean;
  index_type?: 'btree' | 'hash' | 'gist' | 'gin' | 'brin' | 'spgist';
  where_clause?: string;
  comment?: string;
  code?: string;
  lineRange?: [number, number];
  startOffset?: number;
  endOffset?: number;
}

export interface ForeignKeyDefinition {
  name?: string;
  column: string;
  references_table: string;
  references_column: string;
  on_delete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  on_update?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

export interface ConstraintDefinition {
  name?: string;
  type: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK' | 'NOT NULL';
  columns?: string[];
  definition?: string;
  foreign_key?: ForeignKeyDefinition;
}

export interface TableDefinition {
  name: string;
  schema?: string;
  columns: ColumnDefinition[];
  primary_key?: string[];
  foreign_keys?: ForeignKeyDefinition[];
  constraints?: ConstraintDefinition[];
  indexes?: IndexDefinition[];
  comment?: string;
  code?: string;
  lineRange?: [number, number];
  startOffset?: number;
  endOffset?: number;
}

export interface FunctionDefinition {
  name: string;
  schema?: string;
  parameters?: Array<{ name: string; type: string; mode?: 'IN' | 'OUT' | 'INOUT' }>;
  return_type?: string;
  language?: string;
  body?: string;
  comment?: string;
  code?: string;
  lineRange?: [number, number];
  startOffset?: number;
  endOffset?: number;
}

export interface BackendAST {
  tables: TableDefinition[];
  indexes: IndexDefinition[];
  functions: FunctionDefinition[];
  constraints: ConstraintDefinition[];
}

// =============================================================================
// Phase 4: Model Config Service Types
// =============================================================================

/**
 * Feature identifiers for model configuration
 */
export type ModelFeature =
  | 'chat'
  | 'summary'
  | 'ocr'
  | 'embedding_docs'
  | 'embedding_code'
  | 'embedding_writing'
  | 'reranker'
  | 'contradiction';

/**
 * LLM providers
 */
export type LLMProvider = 'anthropic' | 'openai' | 'ollama' | 'google';

/**
 * Reranker providers
 */
export type RerankerProvider = 'bge' | 'cohere' | 'none';

/**
 * All supported providers
 */
export type ModelProvider = LLMProvider | EmbeddingProvider | RerankerProvider;

/**
 * Source of the configuration (for UI display)
 */
export type ConfigSource = 'env' | 'db' | 'default';

/**
 * Model configuration for a feature
 */
export interface ModelConfig {
  /** Feature this config applies to */
  feature: ModelFeature;
  /** Provider for this feature */
  provider: string;
  /** Model identifier (provider-specific) */
  model: string;
  /** Restrict to local models only */
  localOnly: boolean;
  /** Whether this config is enabled */
  enabled: boolean;
  /** Where this config came from */
  source: ConfigSource;
}

/**
 * Database row for model_configs table
 */
export interface ModelConfigRow {
  id: string;
  feature: ModelFeature;
  provider: string;
  model: string;
  local_only: boolean;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Input for updating a model config
 */
export interface ModelConfigUpdate {
  provider?: string;
  model?: string;
  localOnly?: boolean;
  enabled?: boolean;
}

/**
 * Provider metadata for UI
 */
export interface ProviderInfo {
  /** Available models for this provider */
  models: string[];
  /** Whether this provider requires an API key */
  requiresApiKey: boolean;
  /** Environment variable name for API key (if required) */
  apiKeyEnvVar?: string;
  /** Whether this is a local provider (ollama, bge) */
  isLocal: boolean;
}

/**
 * Response from GET /api/admin/models
 */
export interface ModelConfigResponse {
  /** All feature configurations */
  configs: ModelConfig[];
  /** Available providers with metadata */
  availableProviders: Record<string, ProviderInfo>;
}

/**
 * Default model configurations per feature
 */
export const DEFAULT_MODEL_CONFIGS: Record<ModelFeature, Omit<ModelConfig, 'source'>> = {
  chat: {
    feature: 'chat',
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    localOnly: false,
    enabled: true,
  },
  summary: {
    feature: 'summary',
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    localOnly: false,
    enabled: true,
  },
  ocr: {
    feature: 'ocr',
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    localOnly: false,
    enabled: true,
  },
  embedding_docs: {
    feature: 'embedding_docs',
    provider: 'ollama',
    model: 'nomic-embed-text',
    localOnly: false,
    enabled: true,
  },
  embedding_code: {
    feature: 'embedding_code',
    provider: 'voyage',
    model: 'voyage-code-2',
    localOnly: false,
    enabled: true,
  },
  embedding_writing: {
    feature: 'embedding_writing',
    provider: 'openai',
    model: 'text-embedding-3-large',
    localOnly: false,
    enabled: true,
  },
  reranker: {
    feature: 'reranker',
    provider: 'bge',
    model: 'BAAI/bge-reranker-base',
    localOnly: false,
    enabled: true,
  },
  contradiction: {
    feature: 'contradiction',
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    localOnly: false,
    enabled: false,
  },
};

/**
 * Provider information for all supported providers
 */
export const PROVIDER_INFO: Record<string, ProviderInfo> = {
  anthropic: {
    models: [
      'claude-3-5-haiku-20241022',
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-sonnet-4-20250514',
    ],
    requiresApiKey: true,
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    isLocal: false,
  },
  openai: {
    models: [
      // Chat models
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-5-mini-2025-08-07',
      'gpt-5-nano-2025-08-07',
      // Embedding models
      'text-embedding-3-large',
      'text-embedding-3-small',
    ],
    requiresApiKey: true,
    apiKeyEnvVar: 'OPENAI_API_KEY',
    isLocal: false,
  },
  ollama: {
    models: [
      // Embedding models
      'nomic-embed-text',
      // Chat models
      'llama3.2',
      'mistral',
      'codellama',
      'phi3',
      'gpt-oss-20b',
    ],
    requiresApiKey: false,
    isLocal: true,
  },
  google: {
    models: [
      // Chat models
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
      // Vision models
      'gemini-2.5-flash-image',
      // Embedding models
      'text-embedding-004',
      'gemini-embedding-001',
    ],
    requiresApiKey: true,
    apiKeyEnvVar: 'GOOGLE_API_KEY',
    isLocal: false,
  },
  voyage: {
    models: ['voyage-code-2', 'voyage-large-2', 'voyage-2'],
    requiresApiKey: true,
    apiKeyEnvVar: 'VOYAGE_API_KEY',
    isLocal: false,
  },
  cohere: {
    models: ['rerank-v3.5', 'rerank-english-v3.0', 'rerank-multilingual-v3.0'],
    requiresApiKey: true,
    apiKeyEnvVar: 'COHERE_API_KEY',
    isLocal: false,
  },
  bge: {
    models: ['BAAI/bge-reranker-base', 'BAAI/bge-reranker-large'],
    requiresApiKey: false,
    isLocal: true,
  },
  none: {
    models: [],
    requiresApiKey: false,
    isLocal: true,
  },
};

/**
 * Environment variable mappings for features
 */
export const FEATURE_ENV_VARS: Record<ModelFeature, { provider?: string; model?: string }> = {
  chat: { provider: 'CHAT_PROVIDER', model: 'CHAT_MODEL' },
  summary: { provider: 'SUMMARY_PROVIDER', model: 'SUMMARY_MODEL' },
  ocr: { provider: 'OCR_PROVIDER', model: 'VISION_OCR_MODEL' },
  embedding_docs: { provider: 'DOC_EMBEDDING_PROVIDER', model: 'DOC_EMBEDDING_MODEL' },
  embedding_code: { provider: 'CODE_EMBEDDING_PROVIDER', model: 'CODE_EMBEDDING_MODEL' },
  embedding_writing: { provider: 'WRITING_EMBEDDING_PROVIDER', model: 'WRITING_EMBEDDING_MODEL' },
  reranker: { provider: 'RERANKER_PROVIDER', model: 'RERANKER_MODEL' },
  contradiction: { provider: 'CONTRADICTION_PROVIDER', model: 'CONTRADICTION_MODEL' },
};

// =============================================================================
// Phase 14: Language Analyzer Registry Types
// =============================================================================

/**
 * Parser type classification for language analyzers
 */
export type ParserType = 'ast' | 'regex' | 'line-based';

/**
 * Language support level for UI display
 */
export type LanguageSupportLevel = 'full' | 'partial' | 'basic' | 'none';

/**
 * Framework detection result
 */
export interface FrameworkInfo {
  /** Framework name */
  name: DocumentFramework;
  /** Detection confidence (0-1) */
  confidence: number;
  /** Indicators that triggered detection */
  indicators: string[];
  /** Framework version if detected */
  version?: string;
}

/**
 * Language analyzer capabilities
 */
export interface AnalyzerCapabilities {
  /** Supports hierarchical chunking (class overview + methods) */
  hierarchicalChunking: boolean;
  /** Can detect frameworks */
  frameworkDetection: boolean;
  /** Extracts import statements */
  importExtraction: boolean;
  /** Extracts class/function metadata */
  symbolExtraction: boolean;
  /** Detects async/await patterns */
  asyncDetection: boolean;
  /** Detects decorators/annotations */
  decoratorDetection: boolean;
}

/**
 * Language support status for a collection/document
 */
export interface LanguageSupportStatus {
  /** Programming language */
  language: DocumentLanguage;
  /** File extension */
  extension: string;
  /** Parser type used */
  parserType: ParserType;
  /** Support level */
  supportLevel: LanguageSupportLevel;
  /** Detected frameworks */
  frameworks: FrameworkInfo[];
  /** Analyzer capabilities */
  capabilities: AnalyzerCapabilities;
  /** Number of files with this language */
  fileCount?: number;
  /** Chunking quality score (0-100) */
  chunkingQuality?: number;
}

/**
 * Collection language summary for UI
 */
export interface CollectionLanguageSummary {
  /** All languages detected in collection */
  languages: LanguageSupportStatus[];
  /** Overall chunking quality (0-100) */
  overallQuality: number;
  /** Primary language */
  primaryLanguage?: DocumentLanguage;
  /** Primary framework */
  primaryFramework?: DocumentFramework;
}

/**
 * Default analyzer capabilities (for basic/line-based analyzers)
 */
export const DEFAULT_ANALYZER_CAPABILITIES: AnalyzerCapabilities = {
  hierarchicalChunking: false,
  frameworkDetection: false,
  importExtraction: false,
  symbolExtraction: false,
  asyncDetection: false,
  decoratorDetection: false,
};

/**
 * Full AST analyzer capabilities
 */
export const FULL_AST_CAPABILITIES: AnalyzerCapabilities = {
  hierarchicalChunking: true,
  frameworkDetection: true,
  importExtraction: true,
  symbolExtraction: true,
  asyncDetection: true,
  decoratorDetection: true,
};

// =============================================================================
// MMR (Maximal Marginal Relevance) Constants
// =============================================================================

/**
 * Default MMR lambda value (0.0 = max diversity, 1.0 = max relevance)
 * Used as default for collection settings and search requests
 */
export const DEFAULT_MMR_LAMBDA = 0.7;
