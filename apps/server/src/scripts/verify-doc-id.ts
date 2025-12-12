#!/usr/bin/env node
/**
 * Verify doc_id integrity in chunks table
 *
 * Checks for:
 * - NULL doc_id values
 * - Orphaned chunks (doc_id references deleted documents)
 * - Distribution statistics
 */

import { closePool, getPool } from '@synthesis/db';

async function verifyDocIdIntegrity() {
  const pool = getPool();

  try {
    console.info('=== Doc ID Integrity Report ===\n');

    // Check 1: NULL doc_id
    const nullCheck = await pool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM chunks WHERE doc_id IS NULL'
    );
    console.info(`NULL doc_id: ${nullCheck.rows[0].count}`);

    // Check 2: Empty string doc_id (potential bug)
    const emptyCheck = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM chunks WHERE doc_id::text = ''`
    );
    console.info(`Empty string doc_id: ${emptyCheck.rows[0].count}`);

    // Check 3: Orphaned chunks (doc_id references deleted documents)
    const orphanCheck = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM chunks c
       LEFT JOIN documents d ON c.doc_id = d.id
       WHERE d.id IS NULL`
    );
    console.info(`Orphaned chunks: ${orphanCheck.rows[0].count}`);

    // Check 4: Distribution stats
    const distCheck = await pool.query<{
      total_chunks: string;
      total_docs: string;
      min_per_doc: string;
      max_per_doc: string;
      avg_per_doc: string;
    }>(
      `SELECT
         COUNT(*) as total_chunks,
         COUNT(DISTINCT doc_id) as total_docs,
         MIN(chunk_count) as min_per_doc,
         MAX(chunk_count) as max_per_doc,
         ROUND(AVG(chunk_count), 1) as avg_per_doc
       FROM (
         SELECT doc_id, COUNT(*) as chunk_count
         FROM chunks
         GROUP BY doc_id
       ) counts`
    );

    const stats = distCheck.rows[0];
    console.info('\n--- Distribution Stats ---');
    console.info(`Total chunks: ${stats.total_chunks}`);
    console.info(`Total documents: ${stats.total_docs}`);
    console.info(`Min chunks/doc: ${stats.min_per_doc}`);
    console.info(`Max chunks/doc: ${stats.max_per_doc}`);
    console.info(`Avg chunks/doc: ${stats.avg_per_doc}`);

    // Check 5: Chunks by collection
    const collectionCheck = await pool.query<{
      collection_name: string;
      chunk_count: string;
      doc_count: string;
    }>(
      `SELECT
         col.name as collection_name,
         COUNT(c.id) as chunk_count,
         COUNT(DISTINCT d.id) as doc_count
       FROM chunks c
       JOIN documents d ON c.doc_id = d.id
       JOIN collections col ON d.collection_id = col.id
       GROUP BY col.id, col.name
       ORDER BY chunk_count DESC`
    );

    console.info('\n--- By Collection ---');
    for (const row of collectionCheck.rows) {
      console.info(`  ${row.collection_name}: ${row.chunk_count} chunks, ${row.doc_count} docs`);
    }

    // Check 6: Embedding model distribution
    const embeddingCheck = await pool.query<{
      embedding_model: string | null;
      count: string;
    }>(
      `SELECT embedding_model, COUNT(*) as count
       FROM chunks
       GROUP BY embedding_model
       ORDER BY count DESC`
    );

    console.info('\n--- Embedding Models ---');
    for (const row of embeddingCheck.rows) {
      console.info(`  ${row.embedding_model ?? 'NULL'}: ${row.count} chunks`);
    }

    // Summary
    const hasIssues =
      Number.parseInt(nullCheck.rows[0].count) > 0 ||
      Number.parseInt(emptyCheck.rows[0].count) > 0 ||
      Number.parseInt(orphanCheck.rows[0].count) > 0;

    if (hasIssues) {
      console.info('\n❌ ISSUES FOUND!');
      if (Number.parseInt(nullCheck.rows[0].count) > 0) {
        console.info('  - NULL doc_id values detected');
      }
      if (Number.parseInt(emptyCheck.rows[0].count) > 0) {
        console.info('  - Empty string doc_id values detected');
      }
      if (Number.parseInt(orphanCheck.rows[0].count) > 0) {
        console.info('  - Orphaned chunks detected');
      }
      process.exitCode = 1;
    } else {
      console.info('\n✅ All chunks have valid doc_id references!');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

verifyDocIdIntegrity();
