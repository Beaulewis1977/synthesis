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
  | 'markdown';
export type DocumentContentCategory =
  | 'api_reference'
  | 'tutorial'
  | 'example'
  | 'guide'
  | 'snippet';
export type EmbeddingModel = 'nomic-embed-text' | 'text-embedding-3-large' | 'voyage-code-2';
export type EmbeddingProvider = 'ollama' | 'openai' | 'voyage';

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
  [key: string]: unknown;
}

export interface ChunkMetadata extends DocumentMetadata {
  chunk_type?: 'text' | 'code' | 'heading' | 'list';
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
}

export interface FunctionDefinition {
  name: string;
  schema?: string;
  parameters?: Array<{ name: string; type: string; mode?: 'IN' | 'OUT' | 'INOUT' }>;
  return_type?: string;
  language?: string;
  body?: string;
  comment?: string;
}

export interface BackendAST {
  tables: TableDefinition[];
  indexes: IndexDefinition[];
  functions: FunctionDefinition[];
  constraints: ConstraintDefinition[];
}
