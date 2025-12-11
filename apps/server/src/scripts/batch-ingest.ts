#!/usr/bin/env node
/**
 * Batch Ingestion Script
 *
 * Processes pending documents for a collection in batches.
 * Usage: npx tsx src/scripts/batch-ingest.ts <collection-id> [--batch-size=10] [--limit=100]
 */

import { closePool, getPool } from '@synthesis/db';
import { ingestDocument } from '../pipeline/orchestrator.js';

const args = process.argv.slice(2);
const collectionId = args[0];
const batchSize = Number.parseInt(
  args.find((a) => a.startsWith('--batch-size='))?.split('=')[1] || '5',
  10
);
const limit = Number.parseInt(
  args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '1000',
  10
);

if (!collectionId) {
  console.error(
    'Usage: npx tsx src/scripts/batch-ingest.ts <collection-id> [--batch-size=5] [--limit=1000]'
  );
  process.exit(1);
}

async function main() {
  const pool = getPool();

  // Get pending documents
  const result = await pool.query(
    `SELECT id, title FROM documents
     WHERE collection_id = $1 AND status = 'pending'
     ORDER BY created_at
     LIMIT $2`,
    [collectionId, limit]
  );

  const docs = result.rows as { id: string; title: string }[];

  if (docs.length === 0) {
    await closePool();
    return;
  }

  let processed = 0;
  let failed = 0;
  const startTime = Date.now();

  // Process in batches
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map(async (doc) => {
        try {
          await ingestDocument(doc.id);
          return { id: doc.id, success: true };
        } catch (error) {
          return {
            id: doc.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        processed++;
      } else {
        failed++;
        if (result.status === 'fulfilled') {
          console.error(`Failed: ${result.value.id} - ${result.value.error}`);
        }
      }
    }

    // Calculate stats for progress logging
    void ((Date.now() - startTime) / 1000);
  }
  await closePool();
}

main().catch((error) => {
  console.error('Batch ingestion failed:', error);
  closePool().finally(() => process.exit(1));
});
