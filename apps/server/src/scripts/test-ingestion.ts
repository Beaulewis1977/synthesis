#!/usr/bin/env tsx

// This script tests the document ingestion pipeline.

import { closePool, getPool } from '@synthesis/db';
import { ingestDocument } from '../pipeline/orchestrator.js';

async function testIngestion() {
  console.info('🧪 Testing document ingestion...');

  const pool = getPool();

  try {
    // Get one document to test
    const { rows } = await pool.query(`
      SELECT id, title, file_path, content_type
      FROM documents
      WHERE collection_id = '00000000-0000-0000-0000-000000000002'
      AND status = 'pending'
      LIMIT 1
    `);

    if (rows.length === 0) {
      console.info('❌ No pending documents found');
      return;
    }

    const doc = rows[0];
    console.info(`📄 Testing ingestion for: ${doc.title} (${doc.id})`);

    try {
      await ingestDocument(doc.id);
      console.info('✅ Ingestion completed successfully!');

      // Check final status
      const { rows: updatedRows } = await pool.query(
        `
          SELECT status, error_message FROM documents WHERE id = $1
        `,
        [doc.id]
      );

      if (updatedRows.length > 0) {
        console.info(`📊 Final status: ${updatedRows[0].status}`);
        if (updatedRows[0].error_message) {
          console.info(`❌ Error: ${updatedRows[0].error_message}`);
        }
      }
    } catch (error) {
      console.error('❌ Ingestion failed:', (error as Error).message);
    }
  } finally {
    await closePool();
  }
}

testIngestion().catch(console.error);
