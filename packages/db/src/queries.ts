import { query } from './client.js';

// Type definitions
export interface Collection {
  id: string;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Document {
  id: string;
  collection_id: string;
  title: string;
  file_path: string | null;
  content_type: string | null;
  file_size: number | null;
  source_url: string | null;
  status: 'pending' | 'extracting' | 'chunking' | 'embedding' | 'complete' | 'error';
  error_message: string | null;
  metadata: Record<string, any>;
  created_at: Date;
  processed_at: Date | null;
  updated_at: Date;
}

export interface Chunk {
  id: number;
  doc_id: string;
  chunk_index: number;
  text: string;
  token_count: number | null;
  embedding: number[] | null;
  embedding_model: string | null;
  metadata: Record<string, any>;
  created_at: Date;
}

// Collection queries
export async function listCollections(): Promise<Collection[]> {
  const result = await query(
    'SELECT * FROM collections ORDER BY created_at DESC'
  );
  return result.rows as Collection[];
}

export async function getCollection(id: string): Promise<Collection | null> {
  const result = await query(
    'SELECT * FROM collections WHERE id = $1',
    [id]
  );
  return result.rows[0] as Collection || null;
}

export async function createCollection(
  name: string,
  description?: string
): Promise<Collection> {
  const result = await query(
    'INSERT INTO collections (name, description) VALUES ($1, $2) RETURNING *',
    [name, description || null]
  );
  return result.rows[0] as Collection;
}

// Document queries
export async function listDocuments(collectionId: string): Promise<Document[]> {
  const result = await query(
    'SELECT * FROM documents WHERE collection_id = $1 ORDER BY created_at DESC',
    [collectionId]
  );
  return result.rows as Document[];
}

export async function getDocument(id: string): Promise<Document | null> {
  const result = await query(
    'SELECT * FROM documents WHERE id = $1',
    [id]
  );
  return result.rows[0] as Document || null;
}

export async function createDocument(doc: {
  collection_id: string;
  title: string;
  file_path?: string;
  content_type?: string;
  file_size?: number;
  source_url?: string;
}): Promise<Document> {
  const result = await query(
    `INSERT INTO documents (collection_id, title, file_path, content_type, file_size, source_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      doc.collection_id,
      doc.title,
      doc.file_path || null,
      doc.content_type || null,
      doc.file_size || null,
      doc.source_url || null,
    ]
  );
  return result.rows[0] as Document;
}

export async function updateDocumentStatus(
  id: string,
  status: Document['status'],
  errorMessage?: string,
  filePath?: string
): Promise<void> {
  await query(
    `UPDATE documents 
     SET status = $1, error_message = $2, updated_at = NOW(), 
         processed_at = CASE WHEN $1 = 'complete' THEN NOW() ELSE processed_at END,
         file_path = COALESCE($4, file_path)
     WHERE id = $3`,
    [status, errorMessage || null, id, filePath || null]
  );
}

// Chunk queries
export async function getDocumentChunks(docId: string): Promise<Chunk[]> {
  const result = await query(
    'SELECT * FROM chunks WHERE doc_id = $1 ORDER BY chunk_index',
    [docId]
  );
  return result.rows as Chunk[];
}

export async function upsertChunk(chunk: {
  doc_id: string;
  chunk_index: number;
  text: string;
  token_count?: number;
  embedding?: number[];
  embedding_model?: string;
  metadata?: Record<string, any>;
}): Promise<Chunk> {
  const result = await query(
    `INSERT INTO chunks (doc_id, chunk_index, text, token_count, embedding, embedding_model, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (doc_id, chunk_index) 
     DO UPDATE SET 
       text = EXCLUDED.text,
       token_count = EXCLUDED.token_count,
       embedding = EXCLUDED.embedding,
       embedding_model = EXCLUDED.embedding_model,
       metadata = EXCLUDED.metadata
     RETURNING *`,
    [
      chunk.doc_id,
      chunk.chunk_index,
      chunk.text,
      chunk.token_count || null,
      chunk.embedding ? `[${chunk.embedding.join(',')}]` : null,
      chunk.embedding_model || null,
      JSON.stringify(chunk.metadata || {}),
    ]
  );
  return result.rows[0] as Chunk;
}

export async function deleteDocumentChunks(docId: string): Promise<void> {
  await query('DELETE FROM chunks WHERE doc_id = $1', [docId]);
}
