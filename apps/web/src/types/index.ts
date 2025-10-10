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
  content_type: string;
  file_size: number;
  file_path: string | null;
  status: 'pending' | 'complete' | 'error';
  source_url: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  processed_at: string | null;
  updated_at: string;
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
