// Type definitions for the Synthesis RAG application

export interface Collection {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

// Phase 7: Lifecycle status for document versioning
export type LifecycleStatus = 'active' | 'archived' | 'superseded';

export interface Document {
  id: string;
  collection_id: string;
  title: string;
  content_type: string | null;
  file_size: number | null;
  file_path: string | null;
  status: 'pending' | 'extracting' | 'chunking' | 'embedding' | 'complete' | 'error';
  source_url: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  processed_at: string | null;
  updated_at: string;
  version: number;
  source_url_hash: string | null;
  last_checked_at: string | null;
  // Phase 7: Versioning fields
  lifecycle_status: LifecycleStatus;
  superseded_by: string | null;
  doc_version: string | null;
  branch: string | null;
  archived_at: string | null;
}

// Search-related types for Phase 8
// Phase 14: Updated to include tech_stack support
export interface ChunkMetadata {
  file_path?: string;
  language?: string;
  tech_stack?: string[];
  source_quality?: 'official' | 'verified' | 'community' | string | null;
  last_verified?: string | Date | null;
  [key: string]: unknown;
}

export interface SearchResultMetadata extends ChunkMetadata {
  // Inherits all properties from ChunkMetadata
}

/**
 * MMR (Maximal Marginal Relevance) diversification info
 * Phase 13: Result Diversification
 */
export interface MMRInfo {
  /** Whether MMR was enabled */
  enabled: boolean;
  /** Lambda value used (0.0-1.0) */
  lambda: number;
  /** Average pairwise similarity among results (lower = more diverse) */
  avg_pairwise_similarity: number;
  /** Number of results deprioritized from original top-K */
  duplicates_removed: number;
  /** Number of true near-duplicates (similarity >= 0.95) that were filtered */
  near_duplicates_filtered: number;
}

/**
 * Query intent types for search behavior optimization
 * Phase 12: Query Intent Detection
 */
export type QueryIntent =
  | 'code_symbol'
  | 'natural_language'
  | 'error_message'
  | 'api_lookup'
  | 'conceptual'
  | 'comparison';

/**
 * Query intent result returned from search API
 * Phase 12: Query Intent Detection
 */
export interface QueryIntentInfo {
  /** Detected or specified intent type */
  type: QueryIntent;
  /** Confidence score (0.0 - 1.0) */
  confidence: number;
  /** Whether intent was auto-detected or manually specified */
  auto_detected: boolean;
  /** Signals that triggered this classification */
  signals: string[];
}

/**
 * Search diagnostics with weight and score information
 * Phase 8/12: Hybrid Search Diagnostics
 */
export interface SearchDiagnostics {
  /** Vector and BM25 weights used */
  weights?: {
    vector: number;
    bm25: number;
  };
  /** Score statistics */
  vector_scores?: {
    avg: number;
    max: number;
    min: number;
  };
  bm25_scores?: {
    avg: number;
    max: number;
    min: number;
  };
  /** Timing breakdown */
  timing?: {
    vector_ms: number;
    bm25_ms: number;
    fusion_ms: number;
    total_ms: number;
  };
  /** BM25 query type used */
  bm25_query_type?: string;
  /** RRF k value */
  rrf_k?: number;
}

export interface SearchMetadata {
  search_mode: 'vector' | 'hybrid';
  vector_count?: number | null;
  bm25_count?: number | null;
  fused_count?: number | null;
  embedding_provider?: string | null;
  reranked: boolean;
  rerank_provider: string | null;
  pagination?: {
    page: number;
    page_size: number;
    total_results: number;
    total_pages: number;
  };
  /** MMR diversification info (when mmr_enabled is true) */
  mmr?: MMRInfo | null;
  /** Query intent detection info (Phase 12) */
  intent?: QueryIntentInfo | null;
  /** Search diagnostics with weights and scores (Phase 8/12) */
  diagnostics?: SearchDiagnostics | null;
}

export interface SearchResult {
  id: number;
  snippet: string;
  similarity: number;
  vector_score?: number | null;
  bm25_score?: number | null;
  fused_score?: number | null;
  source?: 'vector' | 'bm25' | 'both';
  doc_id: string;
  doc_title: string | null;
  source_url: string | null;
  citation?: {
    title: string | null;
    page?: number | string | null;
    section?: string | null;
  } | null;
  metadata?: SearchResultMetadata | null;
  related_files?: RelatedFiles | null;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total_results: number;
  search_time_ms: number;
  metadata?: SearchMetadata;
}

/**
 * Search request body for POST /api/search
 * Phase 14: Added tech_stack filtering support
 * Phase 13: Added MMR diversification support
 */
export interface SearchRequest {
  query: string;
  collection_id: string;
  top_k?: number;
  min_similarity?: number;
  search_mode?: 'vector' | 'hybrid';
  rerank?: boolean;
  rerank_top_k?: number;
  rerank_max_candidates?: number;
  rerank_provider?: 'cohere' | 'bge' | 'none';
  tech_stack?: string[];
  page?: number;
  page_size?: number;
  include_related_files?: boolean;
  /** Enable MMR diversification (default: false) */
  mmr_enabled?: boolean;
  /** MMR lambda: 0.0 = max diversity, 1.0 = max relevance (default: 0.7) */
  mmr_lambda?: number;
}

export interface CollectionsResponse {
  collections: Collection[];
}

export interface DocumentsResponse {
  documents: Document[];
}

export interface ApiError {
  error: string;
  code: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

// Chat-related types
export interface ToolCall {
  id: string;
  tool: string;
  status: string;
  input?: unknown;
  result?: unknown;
  server?: string;
}

export interface Citation {
  title: string;
  page?: number;
  section?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: ToolCall[];
  citations?: Citation[];
}

export interface AgentChatRequest {
  message: string;
  collection_id: string;
  history?: Array<{ role: string; content: string }>;
  session_id?: string;
}

export interface AgentChatResponse {
  message: string;
  tool_calls: ToolCall[];
  history: Array<{ role: string; content: string }>;
  usage?: Record<string, unknown>;
  session_id?: string;
}

export interface ChatSession {
  id: string;
  collection_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

// Upload-related types
export interface UploadResult {
  filename: string;
  status: 'success' | 'error';
  documentId?: string;
  uploadIndex?: number;
  error?: string;
}

export interface UploadResponse {
  message: string;
  results: UploadResult[];
}

// Synthesis-related types (Phase 12)
export interface SynthesisResponse {
  query: string;
  approaches: Approach[];
  conflicts: Conflict[];
  recommended: Approach | null;
  metadata: SynthesisMetadata;
}

export interface Approach {
  method: string;
  topic: string;
  summary: string;
  consensusScore: number;
  sources: SynthesizedSource[];
}

export interface SynthesizedSource {
  docId: string;
  docTitle: string | null;
  sourceUrl: string | null;
  snippet: string;
  metadata: Record<string, unknown> | null;
}

export interface Conflict {
  id?: string;
  topic: string;
  source_a: ConflictSource;
  source_b: ConflictSource;
  severity: 'high' | 'medium' | 'low';
  difference: string;
  recommendation: string;
}

export interface ConflictSource {
  title: string | null;
  statement: string;
  url: string | null;
}

export interface SynthesisMetadata {
  total_sources: number;
  approaches_found: number;
  conflicts_found: number;
  synthesis_time_ms: number;
}

// Cost tracking types (Phase 12)
export interface CostBreakdownItem {
  provider: string;
  operation: string;
  total_cost: number;
  request_count: number;
}

export interface CostSummaryResponse {
  current_spend: number;
  budget: number;
  percentage_used: number;
  remaining: number;
  breakdown: CostBreakdownItem[];
}

export interface CostHistoryResponse {
  history: CostBreakdownItem[];
}

export interface BudgetAlert {
  id: number;
  alert_type: 'warning' | 'limit_reached';
  threshold_usd: number;
  current_spend_usd: number;
  period: string;
  triggered_at: string;
  acknowledged: boolean;
}

export interface CostAlertsResponse {
  alerts: BudgetAlert[];
}

// Phase 13: Code Intelligence - Related Files
export interface RelatedFiles {
  imports: string[];
  imported_by: string[];
  uses: string[];
  used_by: string[];
  tests: string[];
  tested_by: string[];
  siblings: string[];
  parent: string | null;
}

export interface RelatedFilesResponse {
  file_path: string;
  related_files: RelatedFiles;
}

// Phase 17: Ingestion Agent
export interface IngestionJob {
  id: string;
  collection_id: string;
  topic: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_summary: string | null;
}

export interface IngestionJobStats {
  pending: number;
  scraped: number;
  ingested: number;
  failed: number;
  skipped: number;
  total: number;
}

export interface IngestionJobStatusResponse {
  job: IngestionJob;
  stats: IngestionJobStats;
}

// Phase 16: Document Chunk Types
export interface Chunk {
  id: number;
  chunk_index: number;
  text: string;
  token_count: number | null;
  metadata: Record<string, unknown>;
  has_embedding: boolean;
  embedding_model: string | null;
}

export interface DocumentChunksResponse {
  document: {
    id: string;
    title: string;
    status: string;
  };
  chunks: Chunk[];
  total: number;
}

export interface UpdateChunkRequest {
  text: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateChunkResponse {
  message: string;
  chunk: Chunk;
}

// Phase 16: Repository Types
export interface RepositorySource {
  id: string;
  collection_id: string;
  repo_url: string;
  default_branch: string;
  last_synced_commit: string | null;
  last_synced_at: string | null;
  sync_status: 'idle' | 'syncing' | 'error';
  sync_error: string | null;
  ignored_paths: string[];
  created_at: string;
  updated_at: string;
}

export interface RepositorySourcesResponse {
  repos: RepositorySource[];
}

// Phase C: Tech Stack Profiles
export interface TechStackProfile {
  id: string;
  collection_id: string;
  primary_language: string | null;
  primary_framework: string | null;
  database_type: string | null;
  frameworks: string[];
  version_constraints: Record<string, string>;
  prefer_official_docs: boolean;
  prefer_code_examples: boolean;
  created_at: string;
  updated_at: string;
}

export interface TechStackTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  primary_language: string | null;
  primary_framework: string | null;
  database_type: string | null;
  frameworks: string[];
  search_boost_patterns: Array<{ pattern: string; boost: number }>;
}

// Phase D: Feedback
export interface SearchFeedbackRequest {
  chunk_id?: number;
  doc_id?: string;
  query: string;
  collection_id: string;
  rating: -1 | 0 | 1;
  result_position?: number;
  similarity_score?: number;
  feedback_text?: string;
  feedback_category?: 'irrelevant' | 'outdated' | 'incorrect' | 'helpful' | 'perfect';
}

export interface DocumentQualityScore {
  doc_id: string;
  quality_score: number;
  total_ratings: number;
  positive_ratings: number;
  negative_ratings: number;
}

// Phase 6: Model Configuration Types
export type ModelFeature =
  | 'chat'
  | 'summary'
  | 'ocr'
  | 'embedding_docs'
  | 'embedding_code'
  | 'embedding_writing'
  | 'reranker'
  | 'contradiction';

export type ConfigSource = 'env' | 'db' | 'default';

export interface ModelConfig {
  feature: ModelFeature;
  provider: string;
  model: string;
  localOnly: boolean;
  enabled: boolean;
  source: ConfigSource;
}

export interface ProviderInfo {
  models: string[];
  requiresApiKey: boolean;
  apiKeyEnvVar?: string;
  isLocal: boolean;
}

export interface ModelConfigResponse {
  configs: ModelConfig[];
  availableProviders: Record<string, ProviderInfo>;
  missingApiKeys: string[];
}

export interface ModelConfigUpdate {
  provider?: string;
  model?: string;
  localOnly?: boolean;
  enabled?: boolean;
}

// Phase 6: Embedding Profile Types
export type CostTier = 'free' | 'low' | 'medium' | 'high';

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
  createdAt: string;
  updatedAt: string;
}

export interface EmbeddingProfilesResponse {
  profiles: EmbeddingProfile[];
  defaultProfileId: string | null;
}

// Phase 6: API Key Management Types
export interface ApiKeyStatus {
  provider: string;
  configured: boolean;
  envVar: string;
  maskedValue?: string;
}

export interface ApiKeysResponse {
  keys: ApiKeyStatus[];
}

export interface SetApiKeyRequest {
  provider: string;
  apiKey: string;
}

// Phase F: Workflows
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  tech_stacks: string[];
  steps: Array<{
    id: string;
    name: string;
    description?: string;
    tools: string[];
  }>;
  is_system: boolean;
}

export interface WorkflowInstance {
  id: string;
  template_id: string | null;
  collection_id: string;
  task_description: string;
  task_context: Record<string, unknown>;
  status: 'active' | 'paused' | 'completed' | 'failed';
  current_step_id: string | null;
  completed_steps: string[];
  findings: Array<{ step: string; sources: unknown[]; summary: string }>;
  final_output: string | null;
  started_at: string;
  completed_at: string | null;
}

// ============================================
// Phase 7: Collection Versioning Types
// ============================================

export interface VersionedDocument {
  id: string;
  title: string;
  lifecycle_status: LifecycleStatus;
  doc_version: string | null;
  framework_version: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  superseded_by: string | null;
}

export interface VersionedDocumentsResponse {
  documents: VersionedDocument[];
}

export interface DocumentVersion {
  id: string;
  title: string;
  doc_version: string | null;
  lifecycle_status: LifecycleStatus;
  created_at: string;
  superseded_by: string | null;
  framework_version: string | null;
}

export interface VersionHistoryResponse {
  document_id: string;
  source_url_hash: string | null;
  versions: DocumentVersion[];
}

export interface FrameworkVersionInfo {
  framework_version: string;
  document_count: number;
  active_count: number;
  archived_count: number;
}

export interface CollectionVersionStats {
  collection_id: string;
  total_documents: number;
  active_documents: number;
  archived_documents: number;
  superseded_documents: number;
  framework_versions: FrameworkVersionInfo[];
}

export interface ArchiveResult {
  success: boolean;
  document_id: string;
  previous_status: LifecycleStatus;
  new_status: LifecycleStatus;
  archived_at: string;
}

export interface RestoreResult {
  success: boolean;
  document_id: string;
  previous_status: LifecycleStatus;
  new_status: LifecycleStatus;
}

export interface SupersedeResult {
  success: boolean;
  old_document_id: string;
  new_document_id: string;
  message: string;
}

export interface BatchArchiveResult {
  success: boolean;
  archived_count: number;
  archived_ids: string[];
  failed_ids: string[];
  message: string;
}

export interface BatchRestoreResult {
  restored_count: number;
  restored_ids: string[];
}

// ============================================
// Phase 14: Language Support Types (re-exported from @synthesis/shared)
// ============================================

export type {
  LanguageSupportStatus,
  LanguageSupportLevel,
  ParserType,
  AnalyzerCapabilities,
  FrameworkInfo,
  DocumentLanguage,
  DocumentFramework,
} from '@synthesis/shared';
