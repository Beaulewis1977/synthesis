// Type definitions for the Synthesis RAG application

export interface Collection {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

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
}

// Search-related types for Phase 8
export interface SearchResultMetadata {
  source_quality?: 'official' | 'verified' | 'community' | string | null;
  last_verified?: string | Date | null;
  [key: string]: unknown;
}

export interface SearchResult {
  id: number;
  text: string;
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
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total_results: number;
  search_time_ms: number;
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
}

export interface AgentChatResponse {
  message: string;
  tool_calls: ToolCall[];
  history: Array<{ role: string; content: string }>;
}

// Upload-related types
export interface UploadResponse {
  documents: {
    doc_id: string;
    title: string;
    status: string;
  }[];
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
