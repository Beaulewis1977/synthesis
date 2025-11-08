#!/usr/bin/env node

/**
 * Fix document file paths and trigger reprocessing
 */

import { stdin as input, stdout as output } from 'node:process';
import readline from 'node:readline';
import pkg from 'pg';
const { Client } = pkg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString || connectionString.trim() === '') {
  throw new Error('Missing DATABASE_URL environment variable. Set it before running this script.');
}

const collectionId =
  process.env.DOCUMENT_COLLECTION_ID || process.env.COLLECTION_ID || process.env.DOC_COLLECTION_ID;
const storageBasePath =
  process.env.DOCUMENT_STORAGE_BASE_PATH ||
  process.env.STORAGE_BASE_PATH ||
  process.env.DOC_STORAGE_BASE_PATH;

const FORCE_FLAG = '--force';
const forceExecution = process.argv.includes(FORCE_FLAG);

function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isSafeStoragePath(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.startsWith('storage/') &&
    !value.includes('..') &&
    !value.includes('\\')
  );
}

async function confirmExecution(message) {
  if (forceExecution) {
    return true;
  }

  if (!process.stdin.isTTY) {
    throw new Error(
      `${message} Confirmation required but stdin is not interactive. Use ${FORCE_FLAG}.`
    );
  }

  const rl = readline.createInterface({ input, output });
  try {
    const answer = await new Promise((resolve) => {
      rl.question(`${message} Type "yes" to continue: `, resolve);
    });
    return answer.trim().toLowerCase() === 'yes';
  } finally {
    rl.close();
  }
}

async function fixDocumentPaths() {
  console.log('🔧 Fixing document file paths...');

  if (!collectionId) {
    throw new Error(
      'Missing DOCUMENT_COLLECTION_ID environment variable. Set it before running this script.'
    );
  }

  if (!isValidUuid(collectionId)) {
    throw new Error(`Invalid DOCUMENT_COLLECTION_ID value: ${collectionId}`);
  }

  if (!storageBasePath) {
    throw new Error(
      'Missing DOCUMENT_STORAGE_BASE_PATH environment variable. Set it before running this script.'
    );
  }

  if (!isSafeStoragePath(storageBasePath)) {
    throw new Error(
      `Invalid DOCUMENT_STORAGE_BASE_PATH value: ${storageBasePath}. Must start with "storage/" and contain no traversal segments.`
    );
  }

  if (process.env.NODE_ENV === 'production') {
    const confirmed = await confirmExecution(
      '⚠️  You are about to run fix-document-paths.js in production.'
    );
    if (!confirmed) {
      console.log('❌ Operation cancelled by user.');
      return;
    }
  } else {
    const confirmed = await confirmExecution(
      'This operation will update document paths in the database.'
    );
    if (!confirmed) {
      console.log('❌ Operation cancelled by user.');
      return;
    }
  }

  const normalizedBasePath = storageBasePath.endsWith('/')
    ? storageBasePath
    : `${storageBasePath}/`;

  const client = new Client({ connectionString });
  await client.connect();

  let rows;

  try {
    await client.query('BEGIN');

    // Update all documents in the specified collection to have correct file paths
    const result = await client.query(
      `
      UPDATE documents
      SET file_path = $1 || id || '.md',
          status = 'pending',
          error_message = null,
          updated_at = NOW()
      WHERE collection_id = $2
        AND (
          file_path IS DISTINCT FROM $1 || id || '.md'
          OR status <> 'pending'
          OR error_message IS NOT NULL
        )
      RETURNING id, title, file_path
    `,
      [normalizedBasePath, collectionId]
    );

    rows = result.rows ?? [];

    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Failed to rollback transaction:', rollbackError);
    }
    throw error;
  } finally {
    await client.end();
  }

  console.log(`✅ Updated ${rows.length} documents:`);
  for (const row of rows) {
    console.log(`  - ${row.id}: ${row.title} → ${row.file_path}`);
  }

  console.log('\n📝 Documents are now ready for processing.');
  console.log('The ingestion pipeline should automatically process them.');
}

fixDocumentPaths().catch(console.error);
