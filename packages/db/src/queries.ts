import type { PoolClient } from 'pg';
import { getPool, query } from './client.js';

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
  version: number;
  source_url_hash: string | null;
  last_checked_at: Date | null;
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
  parent_chunk_id: string | null;
  split_index: number | null;
  total_splits: number | null;
  // biome-ignore lint/suspicious/noExplicitAny: Metadata can be any shape
  metadata: Record<string, any>;
  created_at: Date;
}

/**
 * Represents a persistent chat session.
 */
export interface ChatSession {
  id: string;
  collection_id: string;
  title: string;
  provider: string | null;
  model: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Represents a message within a chat session.
 */
export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: Date;
  // biome-ignore lint/suspicious/noExplicitAny: Metadata can be any shape
  metadata: Record<string, any>;
}

/**
 * Represents an autonomous ingestion job.
 */
export interface IngestionJob {
  id: string;
  collection_id: string;
  topic: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: Date;
  updated_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  error_summary: string | null;
}

/**
 * Represents a specific URL discovered during an ingestion job.
 */
export interface IngestionJobUrl {
  id: string; // BigInt returned as string by pg driver usually
  job_id: string;
  url: string;
  status: 'pending' | 'processing' | 'scraped' | 'ingested' | 'failed' | 'skipped';
  failure_count: number;
  last_attempt_at: Date | null;
  retry_after: Date | null;
  content_hash: string | null;
  document_id: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Represents a repository source for GitHub/Git ingestion.
 */
export interface RepositorySource {
  id: string;
  collection_id: string;
  repo_url: string;
  default_branch: string;
  last_synced_commit: string | null;
  last_synced_at: Date | null;
  sync_status: 'idle' | 'syncing' | 'error';
  sync_error: string | null;
  ignored_paths: string[];
  created_at: Date;
  updated_at: Date;
}

/**
 * Represents a table schema in the database.
 */
export interface TableSchema {
  table_name: string;
  schema_name: string;
  columns: Array<{
    name: string;
    type: string;
    is_nullable: boolean;
    default_value: string | null;
  }>;
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

export type DocumentFileInfo = Pick<Document, 'file_path' | 'collection_id'>;

/**
 * Retrieves the file path and collection id for a document without loading the full record.
 * @param id The UUID of the document.
 * @returns A promise that resolves to the file info or null if not found.
 */
export async function getDocumentFileInfo(id: string): Promise<DocumentFileInfo | null> {
  const result = await query('SELECT file_path, collection_id FROM documents WHERE id = $1', [id]);
  return (result.rows[0] as DocumentFileInfo) || null;
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
    parent_chunk_id?: string | null;
    split_index?: number | null;
    total_splits?: number | null;
    // biome-ignore lint/suspicious/noExplicitAny: Metadata can be any shape
    metadata?: Record<string, any>;
  },
  client?: PoolClient
): Promise<Chunk> {
  const queryFn = client ? client.query.bind(client) : query;
  const result = await queryFn(
    `INSERT INTO chunks (doc_id, chunk_index, text, token_count, embedding, embedding_model, metadata, parent_chunk_id, split_index, total_splits)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (doc_id, chunk_index)
     DO UPDATE SET
       text = EXCLUDED.text,
       token_count = EXCLUDED.token_count,
       embedding = EXCLUDED.embedding,
       embedding_model = EXCLUDED.embedding_model,
       metadata = EXCLUDED.metadata,
       parent_chunk_id = EXCLUDED.parent_chunk_id,
       split_index = EXCLUDED.split_index,
       total_splits = EXCLUDED.total_splits
     RETURNING *`,
    [
      chunk.doc_id,
      chunk.chunk_index,
      chunk.text,
      chunk.token_count ?? null,
      chunk.embedding ? `[${chunk.embedding.join(',')}]` : null,
      chunk.embedding_model ?? null,
      JSON.stringify(chunk.metadata || {}),
      chunk.parent_chunk_id ?? null,
      chunk.split_index ?? null,
      chunk.total_splits ?? null,
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

// Chat Session queries

/**
 * Creates a new chat session.
 * @param collectionId The collection this chat belongs to.
 * @param title The title of the chat session.
 * @param provider Optional provider override (e.g., 'anthropic', 'ollama').
 * @param model Optional model override (e.g., 'claude-sonnet-4-20250514').
 * @returns The created chat session.
 */
export async function createChatSession(
  collectionId: string,
  title: string,
  provider?: string,
  model?: string
): Promise<ChatSession> {
  const result = await query(
    'INSERT INTO chat_sessions (collection_id, title, provider, model) VALUES ($1, $2, $3, $4) RETURNING *',
    [collectionId, title, provider ?? null, model ?? null]
  );
  return result.rows[0] as ChatSession;
}

/**
 * Retrieves all chat sessions for a collection.
 * @param collectionId The collection ID.
 * @returns List of chat sessions.
 */
export async function listChatSessions(collectionId: string): Promise<ChatSession[]> {
  const result = await query(
    'SELECT * FROM chat_sessions WHERE collection_id = $1 ORDER BY updated_at DESC',
    [collectionId]
  );
  return result.rows as ChatSession[];
}

/**
 * Retrieves a single chat session.
 * @param id The chat session ID.
 */
export async function getChatSession(id: string): Promise<ChatSession | null> {
  const result = await query('SELECT * FROM chat_sessions WHERE id = $1', [id]);
  return (result.rows[0] as ChatSession) || null;
}

/**
 * Adds a message to a chat session.
 * @param sessionId The chat session ID.
 * @param role The role (user/assistant).
 * @param content The message content.
 * @param metadata Optional metadata.
 */
export async function addChatMessage(
  sessionId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  metadata?: Record<string, unknown>
): Promise<ChatMessage> {
  const result = await query(
    'INSERT INTO chat_messages (session_id, role, content, metadata) VALUES ($1, $2, $3, $4) RETURNING *',
    [sessionId, role, content, JSON.stringify(metadata || {})]
  );

  // Update session updated_at
  await query('UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1', [sessionId]);

  return result.rows[0] as ChatMessage;
}

/**
 * Retrieves messages for a chat session.
 * @param sessionId The chat session ID.
 */
export async function getChatMessages(sessionId: string): Promise<ChatMessage[]> {
  const result = await query(
    'SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
    [sessionId]
  );
  return result.rows as ChatMessage[];
}

/**
 * Deletes a chat session and all its messages (cascade).
 * @param sessionId The chat session ID.
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  await query('DELETE FROM chat_sessions WHERE id = $1', [sessionId]);
}

/**
 * Updates the title of a chat session.
 * @param sessionId The chat session ID.
 * @param title The new title.
 */
export async function updateChatSessionTitle(
  sessionId: string,
  title: string
): Promise<ChatSession | null> {
  const result = await query(
    'UPDATE chat_sessions SET title = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [title, sessionId]
  );
  return (result.rows[0] as ChatSession) || null;
}

/**
 * Updates the model configuration of a chat session.
 * @param sessionId The chat session ID.
 * @param provider The provider name (e.g., 'anthropic', 'ollama').
 * @param model The model name (e.g., 'claude-sonnet-4-20250514').
 */
export async function updateChatSessionModel(
  sessionId: string,
  provider: string | null,
  model: string | null
): Promise<ChatSession | null> {
  const result = await query(
    'UPDATE chat_sessions SET provider = $1, model = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
    [provider, model, sessionId]
  );
  return (result.rows[0] as ChatSession) || null;
}

// Ingestion Agent queries

export async function createIngestionJob(
  collectionId: string,
  topic: string
): Promise<IngestionJob> {
  const result = await query(
    'INSERT INTO ingestion_jobs (collection_id, topic, status, started_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
    [collectionId, topic, 'processing']
  );
  return result.rows[0] as IngestionJob;
}

export async function getIngestionJob(id: string): Promise<IngestionJob | null> {
  const result = await query('SELECT * FROM ingestion_jobs WHERE id = $1', [id]);
  return (result.rows[0] as IngestionJob) || null;
}

export async function updateIngestionJobStatus(
  id: string,
  status: IngestionJob['status'],
  errorSummary?: string
): Promise<void> {
  const updates: string[] = ['status = $2', 'updated_at = NOW()'];
  const params: (string | null)[] = [id, status];

  if (status === 'completed' || status === 'failed') {
    updates.push('completed_at = NOW()');
  }

  if (errorSummary) {
    updates.push('error_summary = $3');
    params.push(errorSummary);
  }

  await query(`UPDATE ingestion_jobs SET ${updates.join(', ')} WHERE id = $1`, params);
}

export async function createIngestionJobUrls(jobId: string, urls: string[]): Promise<void> {
  if (urls.length === 0) return;

  // Bulk insert
  const valueStrings = urls.map((_, i) => `($1, $${i + 2})`).join(', ');
  const params = [jobId, ...urls];

  await query(
    `INSERT INTO ingestion_job_urls (job_id, url) VALUES ${valueStrings} ON CONFLICT (job_id, url) DO NOTHING`,
    params
  );
}

export async function getNextPendingUrl(jobId: string): Promise<IngestionJobUrl | null> {
  const result = await query(
    `WITH next_url AS (
       SELECT id
       FROM ingestion_job_urls 
       WHERE job_id = $1 AND status = 'pending' 
       ORDER BY id ASC 
       FOR UPDATE SKIP LOCKED 
       LIMIT 1
     )
     UPDATE ingestion_job_urls AS urls
     SET status = 'processing',
         updated_at = NOW(),
         last_attempt_at = NOW()
     FROM next_url
     WHERE urls.id = next_url.id
     RETURNING urls.*`,
    [jobId]
  );
  return (result.rows[0] as IngestionJobUrl) || null;
}

export async function updateIngestionJobUrlStatus(
  id: string | number,
  status: IngestionJobUrl['status'],
  updates: Partial<
    Pick<IngestionJobUrl, 'document_id' | 'notes' | 'content_hash' | 'failure_count'>
  > = {}
): Promise<void> {
  const setClauses = ['status = $2', 'updated_at = NOW()'];
  const params: (string | number | null)[] = [id, status];
  let paramIndex = 3;

  if (updates.document_id !== undefined) {
    setClauses.push(`document_id = $${paramIndex++}`);
    params.push(updates.document_id);
  }
  if (updates.notes !== undefined) {
    setClauses.push(`notes = $${paramIndex++}`);
    params.push(updates.notes);
  }
  if (updates.content_hash !== undefined) {
    setClauses.push(`content_hash = $${paramIndex++}`);
    params.push(updates.content_hash);
  }
  if (updates.failure_count !== undefined) {
    setClauses.push(`failure_count = $${paramIndex++}`);
    params.push(updates.failure_count);
  }

  await query(`UPDATE ingestion_job_urls SET ${setClauses.join(', ')} WHERE id = $1`, params);
}

export async function getIngestionJobStats(jobId: string) {
  const result = await query(
    `SELECT status, COUNT(*) as count 
     FROM ingestion_job_urls 
     WHERE job_id = $1 
     GROUP BY status`,
    [jobId]
  );

  const stats = {
    pending: 0,
    scraped: 0,
    ingested: 0,
    failed: 0,
    skipped: 0,
    total: 0,
  };

  for (const row of result.rows) {
    const status = row.status as keyof typeof stats;
    const count = Number(row.count);
    if (status in stats) {
      stats[status] = count;
    }
    stats.total += count;
  }

  return stats;
}

// Repository Source queries

export async function createRepoSource(data: {
  collectionId: string;
  repoUrl: string;
  defaultBranch?: string;
  ignoredPaths?: string[];
}): Promise<RepositorySource> {
  const pool = getPool();
  const ignoredPaths = data.ignoredPaths || ['node_modules/', '.git/', 'dist/', 'build/', '*.log'];
  const result = await pool.query(
    `INSERT INTO repository_sources (collection_id, repo_url, default_branch, ignored_paths)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.collectionId, data.repoUrl, data.defaultBranch || 'main', ignoredPaths]
  );
  return result.rows[0] as RepositorySource;
}

export async function getRepoSource(id: string): Promise<RepositorySource | null> {
  const result = await query('SELECT * FROM repository_sources WHERE id = $1', [id]);
  return (result.rows[0] as RepositorySource) || null;
}

export async function listRepoSources(collectionId: string): Promise<RepositorySource[]> {
  const result = await query(
    'SELECT * FROM repository_sources WHERE collection_id = $1 ORDER BY created_at DESC',
    [collectionId]
  );
  return result.rows as RepositorySource[];
}

export async function updateRepoSyncStatus(
  id: string,
  updates: {
    syncStatus?: 'idle' | 'syncing' | 'error';
    syncError?: string | null;
    lastSyncedCommit?: string;
    lastSyncedAt?: Date;
  }
): Promise<void> {
  const pool = getPool();
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: Array<string | number | boolean | null | Date> = [id];
  let paramIndex = 2;

  if (updates.syncStatus !== undefined) {
    setClauses.push(`sync_status = $${paramIndex++}`);
    params.push(updates.syncStatus);
  }
  if (updates.syncError !== undefined) {
    setClauses.push(`sync_error = $${paramIndex++}`);
    params.push(updates.syncError);
  }
  if (updates.lastSyncedCommit !== undefined) {
    setClauses.push(`last_synced_commit = $${paramIndex++}`);
    params.push(updates.lastSyncedCommit);
  }
  if (updates.lastSyncedAt !== undefined) {
    setClauses.push(`last_synced_at = $${paramIndex++}`);
    params.push(updates.lastSyncedAt);
  }

  await pool.query(`UPDATE repository_sources SET ${setClauses.join(', ')} WHERE id = $1`, params);
}

export async function deleteRepoSource(id: string): Promise<void> {
  await query('DELETE FROM repository_sources WHERE id = $1', [id]);
}

// ============================================
// Tech Stack Profiles
// ============================================

export interface TechStackProfile {
  id: string;
  collection_id: string;
  primary_language: string | null;
  primary_framework: string | null;
  database_type: string | null;
  database_version: string | null;
  frameworks: string[];
  prefer_official_docs: boolean;
  prefer_code_examples: boolean;
  min_source_quality: string;
  version_constraints: Record<string, string>;
  code_embedding_provider: string;
  doc_embedding_provider: string;
  created_at: Date;
  updated_at: Date;
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
  version_constraints: Record<string, string>;
  search_boost_patterns: Array<{ pattern: string; boost: number }>;
  created_at: Date;
}

export async function getTechStackProfile(collectionId: string): Promise<TechStackProfile | null> {
  const result = await query<TechStackProfile>(
    'SELECT * FROM collection_tech_profiles WHERE collection_id = $1',
    [collectionId]
  );
  return result.rows[0] || null;
}

export async function createTechStackProfile(data: {
  collectionId: string;
  primaryLanguage?: string;
  primaryFramework?: string;
  databaseType?: string;
  frameworks?: string[];
  versionConstraints?: Record<string, string>;
}): Promise<TechStackProfile> {
  const result = await query<TechStackProfile>(
    `INSERT INTO collection_tech_profiles 
     (collection_id, primary_language, primary_framework, database_type, frameworks, version_constraints)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.collectionId,
      data.primaryLanguage || null,
      data.primaryFramework || null,
      data.databaseType || null,
      JSON.stringify(data.frameworks || []),
      JSON.stringify(data.versionConstraints || {}),
    ]
  );
  return result.rows[0];
}

export async function updateTechStackProfile(
  collectionId: string,
  updates: Partial<Omit<TechStackProfile, 'id' | 'collection_id' | 'created_at' | 'updated_at'>>
): Promise<TechStackProfile | null> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: (string | number | boolean | null | Date | object)[] = [collectionId];
  let idx = 2;

  if (updates.primary_language !== undefined) {
    setClauses.push(`primary_language = $${idx++}`);
    params.push(updates.primary_language);
  }
  if (updates.primary_framework !== undefined) {
    setClauses.push(`primary_framework = $${idx++}`);
    params.push(updates.primary_framework);
  }
  if (updates.database_type !== undefined) {
    setClauses.push(`database_type = $${idx++}`);
    params.push(updates.database_type);
  }
  if (updates.frameworks !== undefined) {
    setClauses.push(`frameworks = $${idx++}`);
    params.push(JSON.stringify(updates.frameworks));
  }
  if (updates.version_constraints !== undefined) {
    setClauses.push(`version_constraints = $${idx++}`);
    params.push(JSON.stringify(updates.version_constraints));
  }

  const result = await query<TechStackProfile>(
    `UPDATE collection_tech_profiles SET ${setClauses.join(', ')} WHERE collection_id = $1 RETURNING *`,
    params
  );
  return result.rows[0] || null;
}

export async function listTechStackTemplates(category?: string): Promise<TechStackTemplate[]> {
  if (category) {
    const result = await query<TechStackTemplate>(
      'SELECT * FROM tech_stack_templates WHERE category = $1 ORDER BY name',
      [category]
    );
    return result.rows;
  }
  const result = await query<TechStackTemplate>(
    'SELECT * FROM tech_stack_templates ORDER BY category, name'
  );
  return result.rows;
}

export async function applyTechStackTemplate(
  collectionId: string,
  templateName: string
): Promise<TechStackProfile> {
  const template = await query<TechStackTemplate>(
    'SELECT * FROM tech_stack_templates WHERE name = $1',
    [templateName]
  );
  if (!template.rows[0]) {
    throw new Error(`Template ${templateName} not found`);
  }
  const t = template.rows[0];

  const result = await query<TechStackProfile>(
    `INSERT INTO collection_tech_profiles 
     (collection_id, primary_language, primary_framework, database_type, frameworks, version_constraints)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (collection_id) DO UPDATE SET
       primary_language = EXCLUDED.primary_language,
       primary_framework = EXCLUDED.primary_framework,
       database_type = EXCLUDED.database_type,
       frameworks = EXCLUDED.frameworks,
       version_constraints = EXCLUDED.version_constraints,
       updated_at = NOW()
     RETURNING *`,
    [
      collectionId,
      t.primary_language,
      t.primary_framework,
      t.database_type,
      JSON.stringify(t.frameworks),
      JSON.stringify(t.version_constraints),
    ]
  );
  return result.rows[0];
}

// ============================================
// Feedback & Quality
// ============================================

export interface SearchFeedback {
  id: string;
  chunk_id: number | null;
  doc_id: string | null;
  query: string;
  collection_id: string;
  rating: number;
  result_position: number | null;
  similarity_score: number | null;
  search_mode: string | null;
  feedback_text: string | null;
  feedback_category: string | null;
  session_id: string | null;
  user_id: string | null;
  created_at: Date;
}

export interface DocumentQualityScore {
  id: string;
  doc_id: string;
  total_ratings: number;
  positive_ratings: number;
  negative_ratings: number;
  quality_score: number;
  relevance_score: number;
  accuracy_score: number;
  freshness_score: number;
  times_retrieved: number;
  times_cited: number;
  last_feedback_at: Date | null;
  updated_at: Date;
}

export async function submitSearchFeedback(data: {
  chunkId?: number;
  docId?: string;
  query: string;
  collectionId: string;
  rating: number;
  resultPosition?: number;
  similarityScore?: number;
  searchMode?: string;
  feedbackText?: string;
  feedbackCategory?: string;
  sessionId?: string;
  userId?: string;
}): Promise<SearchFeedback> {
  const result = await query<SearchFeedback>(
    `INSERT INTO search_feedback 
     (chunk_id, doc_id, query, collection_id, rating, result_position, similarity_score, search_mode, feedback_text, feedback_category, session_id, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      data.chunkId || null,
      data.docId || null,
      data.query,
      data.collectionId,
      data.rating,
      data.resultPosition || null,
      data.similarityScore || null,
      data.searchMode || null,
      data.feedbackText || null,
      data.feedbackCategory || null,
      data.sessionId || null,
      data.userId || null,
    ]
  );
  return result.rows[0];
}

export async function getDocumentQualityScore(docId: string): Promise<DocumentQualityScore | null> {
  const result = await query<DocumentQualityScore>(
    'SELECT * FROM document_quality_scores WHERE doc_id = $1',
    [docId]
  );
  return result.rows[0] || null;
}

export async function incrementDocumentRetrievalCount(docId: string): Promise<void> {
  await query(
    `INSERT INTO document_quality_scores (doc_id, times_retrieved)
     VALUES ($1, 1)
     ON CONFLICT (doc_id) DO UPDATE SET
       times_retrieved = document_quality_scores.times_retrieved + 1,
       updated_at = NOW()`,
    [docId]
  );
}

export async function getTopQualityDocuments(
  collectionId: string,
  limit = 10
): Promise<DocumentQualityScore[]> {
  const result = await query<DocumentQualityScore>(
    `SELECT dqs.* FROM document_quality_scores dqs
     JOIN documents d ON d.id = dqs.doc_id
     WHERE d.collection_id = $1 AND dqs.total_ratings >= 3
     ORDER BY dqs.quality_score DESC
     LIMIT $2`,
    [collectionId, limit]
  );
  return result.rows;
}

// ============================================
// Workflow Tools
// ============================================

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
    query_template?: string;
    filters?: Record<string, unknown>;
  }>;
  is_system: boolean;
  created_by: string | null;
  created_at: Date;
}

export interface WorkflowInstance {
  id: string;
  template_id: string | null;
  collection_id: string;
  user_id: string | null;
  session_id: string | null;
  task_description: string;
  task_context: Record<string, unknown>;
  status: 'active' | 'paused' | 'completed' | 'failed';
  current_step_id: string | null;
  completed_steps: string[];
  findings: Array<{ step: string; sources: unknown[]; summary: string }>;
  final_output: string | null;
  started_at: Date;
  completed_at: Date | null;
  updated_at: Date;
}

export async function listWorkflowTemplates(
  category?: string,
  techStack?: string
): Promise<WorkflowTemplate[]> {
  let sql = 'SELECT * FROM workflow_templates WHERE 1=1';
  const params: (string | number | boolean | null | Date | object)[] = [];

  if (category) {
    params.push(category);
    sql += ` AND category = $${params.length}`;
  }
  if (techStack) {
    params.push(JSON.stringify([techStack]));
    sql += ` AND (tech_stacks @> $${params.length}::jsonb OR tech_stacks = '[]'::jsonb)`;
  }

  sql += ' ORDER BY is_system DESC, name';
  const result = await query<WorkflowTemplate>(sql, params);
  return result.rows;
}

export async function getWorkflowTemplate(id: string): Promise<WorkflowTemplate | null> {
  const result = await query<WorkflowTemplate>('SELECT * FROM workflow_templates WHERE id = $1', [
    id,
  ]);
  return result.rows[0] || null;
}

export async function createWorkflowInstance(data: {
  templateId?: string;
  collectionId: string;
  userId?: string;
  sessionId?: string;
  taskDescription: string;
  taskContext?: Record<string, unknown>;
}): Promise<WorkflowInstance> {
  const result = await query<WorkflowInstance>(
    `INSERT INTO workflow_instances 
     (template_id, collection_id, user_id, session_id, task_description, task_context)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.templateId || null,
      data.collectionId,
      data.userId || null,
      data.sessionId || null,
      data.taskDescription,
      JSON.stringify(data.taskContext || {}),
    ]
  );
  return result.rows[0];
}

export async function updateWorkflowInstance(
  id: string,
  updates: {
    status?: 'active' | 'paused' | 'completed' | 'failed';
    currentStepId?: string | null;
    completedSteps?: string[];
    findings?: Array<{ step: string; sources: unknown[]; summary: string }>;
    finalOutput?: string;
  }
): Promise<WorkflowInstance | null> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: (string | number | boolean | null | Date | object)[] = [id];
  let idx = 2;

  if (updates.status !== undefined) {
    setClauses.push(`status = $${idx++}`);
    params.push(updates.status);
    if (updates.status === 'completed' || updates.status === 'failed') {
      setClauses.push('completed_at = NOW()');
    }
  }
  if (updates.currentStepId !== undefined) {
    setClauses.push(`current_step_id = $${idx++}`);
    params.push(updates.currentStepId);
  }
  if (updates.completedSteps !== undefined) {
    setClauses.push(`completed_steps = $${idx++}`);
    params.push(JSON.stringify(updates.completedSteps));
  }
  if (updates.findings !== undefined) {
    setClauses.push(`findings = $${idx++}`);
    params.push(JSON.stringify(updates.findings));
  }
  if (updates.finalOutput !== undefined) {
    setClauses.push(`final_output = $${idx++}`);
    params.push(updates.finalOutput);
  }

  const result = await query<WorkflowInstance>(
    `UPDATE workflow_instances SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  return result.rows[0] || null;
}

export async function getWorkflowInstance(id: string): Promise<WorkflowInstance | null> {
  const result = await query<WorkflowInstance>('SELECT * FROM workflow_instances WHERE id = $1', [
    id,
  ]);
  return result.rows[0] || null;
}

export async function listWorkflowInstances(
  collectionId: string,
  status?: string
): Promise<WorkflowInstance[]> {
  let sql = 'SELECT * FROM workflow_instances WHERE collection_id = $1';
  const params: (string | number | boolean | null | Date | object)[] = [collectionId];

  if (status) {
    params.push(status);
    sql += ` AND status = $${params.length}`;
  }

  sql += ' ORDER BY started_at DESC';
  const result = await query<WorkflowInstance>(sql, params);
  return result.rows;
}
