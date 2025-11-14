import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const { Pool } = pg;

describe('Database Integration Tests', () => {
  let pool: pg.Pool;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required for integration tests');
    }

    pool = new Pool({
      connectionString: databaseUrl,
    });

    await pool.query('SELECT 1');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should connect to the database successfully', async () => {
    const result = await pool.query('SELECT NOW()');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].now).toBeDefined();
  });

  it('should verify pgvector extension is installed', async () => {
    const result = await pool.query("SELECT * FROM pg_extension WHERE extname = 'vector'");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].extname).toBe('vector');
  });

  it('should verify core tables exist', async () => {
    const tables = ['collections', 'documents', 'chunks'];

    for (const tableName of tables) {
      const result = await pool.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        )`,
        [tableName]
      );
      expect(result.rows[0].exists).toBe(true);
    }
  });

  it('should perform basic CRUD operations on collections', async () => {
    const testCollectionName = `test_collection_${Date.now()}`;

    const insertResult = await pool.query(
      'INSERT INTO collections (name, description) VALUES ($1, $2) RETURNING id, name',
      [testCollectionName, 'Integration test collection']
    );

    expect(insertResult.rows).toHaveLength(1);
    const collectionId = insertResult.rows[0].id;
    expect(insertResult.rows[0].name).toBe(testCollectionName);

    const selectResult = await pool.query('SELECT * FROM collections WHERE id = $1', [
      collectionId,
    ]);
    expect(selectResult.rows).toHaveLength(1);
    expect(selectResult.rows[0].name).toBe(testCollectionName);

    const deleteResult = await pool.query('DELETE FROM collections WHERE id = $1 RETURNING id', [
      collectionId,
    ]);
    expect(deleteResult.rows).toHaveLength(1);
    expect(deleteResult.rows[0].id).toBe(collectionId);
  });

  it('should verify vector embeddings can be stored and queried', async () => {
    const testCollectionName = `test_vec_collection_${Date.now()}`;

    const collectionResult = await pool.query(
      'INSERT INTO collections (name, description) VALUES ($1, $2) RETURNING id',
      [testCollectionName, 'Vector test collection']
    );
    const collectionId = collectionResult.rows[0].id;

    const documentResult = await pool.query(
      `INSERT INTO documents (collection_id, title, file_path, status, metadata)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [collectionId, 'Test Doc', '/tmp/test.txt', 'complete', JSON.stringify({})]
    );
    const documentId = documentResult.rows[0].id;

    const testEmbedding = Array.from({ length: 768 }, () => Math.random());
    const chunkResult = await pool.query(
      `INSERT INTO chunks (doc_id, chunk_index, text, embedding, metadata)
       VALUES ($1, $2, $3, $4::vector, $5) RETURNING id`,
      [documentId, 0, 'Test chunk text', `[${testEmbedding.join(',')}]`, JSON.stringify({})]
    );
    expect(chunkResult.rows).toHaveLength(1);

    const queryEmbedding = Array.from({ length: 768 }, () => Math.random());
    const searchResult = await pool.query(
      `SELECT id, text, embedding <=> $1::vector AS distance
       FROM chunks
       WHERE doc_id = $2
       ORDER BY embedding <=> $1::vector
       LIMIT 5`,
      [`[${queryEmbedding.join(',')}]`, documentId]
    );
    expect(searchResult.rows).toHaveLength(1);
    expect(searchResult.rows[0].distance).toBeTypeOf('number');

    await pool.query('DELETE FROM collections WHERE id = $1', [collectionId]);
  });
});
