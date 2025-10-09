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
  file_size: string; // API returns string, we'll parse it
  file_path: string;
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
