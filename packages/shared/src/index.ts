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
  | 'firebase';
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
  | 'python';
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

  [key: string]: unknown;
}

export interface ChunkMetadata extends DocumentMetadata {
  chunk_type?: ChunkType;
  heading?: string;
  page?: number | string;
  line_range?: [number, number];

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
