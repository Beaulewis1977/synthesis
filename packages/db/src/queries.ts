import type { PoolClient } from 'pg';
import { query } from './client.js';

// Type definitions
/**
 * Represents a collection of documents.
 */
export interface Collection {
  id: string;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Represents a single document within a collection.
 */
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
  // biome-ignore lint/suspicious/noExplicitAny: Metadata can be any shape
  metadata: Record<string, any>;
  created_at: Date;
  processed_at: Date | null;
  updated_at: Date;
}

/**
 * Represents a chunk of text from a document, with optional embedding.
 */
export interface Chunk {
  id: number;
  doc_id: string;
  chunk_index: number;
  text: string;
  token_count: number | null;
  embedding: number[] | null;
  embedding_model: string | null;
  // biome-ignore lint/suspicious/noExplicitAny: Metadata can be any shape
  metadata: Record<string, any>;
  created_at: Date;
}

// Collection queries
/**
 * Retrieves all collections from the database, ordered by creation date.
 * @returns A promise that resolves to an array of Collection objects.
 */
export async function listCollections(): Promise<Collection[]> {
  const result = await query('SELECT * FROM collections ORDER BY created_at DESC');
  return result.rows as Collection[];
}

/**
 * Retrieves a single collection by its ID.
 * @param id The UUID of the collection to retrieve.
 * @returns A promise that resolves to a Collection object, or null if not found.
 */
export async function getCollection(id: string): Promise<Collection | null> {
  const result = await query('SELECT * FROM collections WHERE id = $1', [id]);
  return (result.rows[0] as Collection) || null;
}

/**
 * Creates a new collection.
 * @param name The name of the new collection.
 * @param description An optional description for the collection.
 * @returns A promise that resolves to the newly created Collection object.
 */
export async function createCollection(name: string, description?: string): Promise<Collection> {
  const result = await query(
    'INSERT INTO collections (name, description) VALUES ($1, $2) RETURNING *',
    [name, description || null]
  );
  return result.rows[0] as Collection;
}

/**
 * Deletes a collection and all associated documents and chunks.
 * This operation cascades to delete all documents in the collection and their chunks.
 * @param id The UUID of the collection to delete.
 * @param client Optional PoolClient for transaction support.
 * @returns A promise that resolves when the collection has been deleted.
 */
export async function deleteCollection(id: string, client?: PoolClient): Promise<void> {
  const queryFn = client ? client.query.bind(client) : query;
  // The database schema should have CASCADE on foreign keys, so deleting the collection
  // will automatically delete all associated documents and chunks
  await queryFn('DELETE FROM collections WHERE id = $1', [id]);
}

// Document queries
/**
 * Retrieves all documents within a specific collection, ordered by creation date.
 * @param collectionId The UUID of the collection.
 * @returns A promise that resolves to an array of Document objects.
 */
export async function listDocuments(collectionId: string): Promise<Document[]> {
  const result = await query(
    'SELECT * FROM documents WHERE collection_id = $1 ORDER BY created_at DESC',
    [collectionId]
  );
  return result.rows as Document[];
}

/**
 * Retrieves a single document by its ID.
 * @param id The UUID of the document to retrieve.
 * @returns A promise that resolves to a Document object, or null if not found.
 */
export async function getDocument(id: string): Promise<Document | null> {
  const result = await query('SELECT * FROM documents WHERE id = $1', [id]);
  return (result.rows[0] as Document) || null;
}

/**
 * Creates a new document record in the database.
 * @param doc An object containing the document's properties.
 * @returns A promise that resolves to the newly created Document object.
 */
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

/**
 * Updates the status and other properties of a document.
 * @param id The UUID of the document to update.
 * @param status The new status of the document.
 * @param errorMessage An optional error message if the status is 'error'.
 * @param filePath An optional file path to update.
 */
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

export async function updateDocumentMetadata(
  id: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await query(
    `UPDATE documents
     SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
         updated_at = NOW()
     WHERE id = $1`,
    [id, JSON.stringify(metadata)]
  );
}

// Chunk queries
/**
 * Retrieves all chunks for a specific document, ordered by their index.
 * @param docId The UUID of the document.
 * @returns A promise that resolves to an array of Chunk objects.
 */
export async function getDocumentChunks(docId: string): Promise<Chunk[]> {
  const result = await query('SELECT * FROM chunks WHERE doc_id = $1 ORDER BY chunk_index', [
    docId,
  ]);
  return result.rows as Chunk[];
}

/**
 * Inserts or updates a chunk in the database.
 * If a chunk with the same doc_id and chunk_index already exists, it will be updated.
 * @param chunk An object containing the chunk's properties.
 * @param client Optional PoolClient for transaction support.
 * @returns A promise that resolves to the created or updated Chunk object.
 */
export async function upsertChunk(
  chunk: {
    doc_id: string;
    chunk_index: number;
    text: string;
    token_count?: number;
    embedding?: number[];
    embedding_model?: string;
    // biome-ignore lint/suspicious/noExplicitAny: Metadata can be any shape
    metadata?: Record<string, any>;
  },
  client?: PoolClient
): Promise<Chunk> {
  const queryFn = client ? client.query.bind(client) : query;
  const result = await queryFn(
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
      chunk.token_count ?? null,
      chunk.embedding ? `[${chunk.embedding.join(',')}]` : null,
      chunk.embedding_model ?? null,
      JSON.stringify(chunk.metadata || {}),
    ]
  );
  return result.rows[0] as Chunk;
}

/**
 * Deletes all chunks associated with a specific document.
 * @param docId The UUID of the document whose chunks should be deleted.
 * @param client Optional PoolClient for transaction support.
 * @returns A promise that resolves when the chunks have been deleted.
 */
export async function deleteDocumentChunks(docId: string, client?: PoolClient): Promise<void> {
  const queryFn = client ? client.query.bind(client) : query;
  await queryFn('DELETE FROM chunks WHERE doc_id = $1', [docId]);
}
