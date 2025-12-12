#!/usr/bin/env node
/**
 * Re-embed Collection Script
 *
 * Re-embeds all chunks in a collection with a different embedding provider/model.
 * Useful for testing different embedding models (e.g., switching from nomic to voyage-code-3).
 *
 * Usage:
 *   pnpm re-embed --collection <id> --provider voyage --model voyage-code-3
 *   pnpm re-embed --collection <id> --provider voyage --model voyage-code-3 --dry-run
 */

import { parseArgs } from 'node:util';
import { closePool, getPool } from '@synthesis/db';
import { embedText } from '../pipeline/embed.js';
import { type EmbeddingProvider, getModelDimensions } from '../services/embedding-router.js';

// =============================================================================
// CLI Configuration
// =============================================================================

const { values: args } = parseArgs({
  options: {
    collection: {
      type: 'string',
      short: 'c',
      description: 'Collection ID to re-embed',
    },
    provider: {
      type: 'string',
      short: 'p',
      description: 'Embedding provider (ollama, openai, voyage, cohere, google)',
    },
    model: {
      type: 'string',
      short: 'm',
      description: 'Embedding model name',
    },
    'batch-size': {
      type: 'string',
      default: '10',
      description: 'Batch size for embedding (default: 10)',
    },
    'dry-run': {
      type: 'boolean',
      default: false,
      description: 'Show what would be done without making changes',
    },
    help: {
      type: 'boolean',
      short: 'h',
      default: false,
      description: 'Show help',
    },
    verbose: {
      type: 'boolean',
      short: 'v',
      default: false,
      description: 'Verbose output',
    },
  },
  allowPositionals: false,
});

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  if (args.help || !args.collection || !args.provider || !args.model) {
    printHelp();
    if (!args.help) {
      process.exitCode = 1;
    }
    return;
  }

  const pool = getPool();
  const collectionId = args.collection;
  const provider = args.provider as EmbeddingProvider;
  const model = args.model;
  const batchSize = Number.parseInt(args['batch-size'] ?? '10', 10);
  const dryRun = args['dry-run'] ?? false;
  const verbose = args.verbose ?? false;

  try {
    // Validate provider
    const validProviders = ['ollama', 'openai', 'voyage', 'cohere', 'google'];
    if (!validProviders.includes(provider)) {
      console.error(`Invalid provider: ${provider}. Valid: ${validProviders.join(', ')}`);
      process.exitCode = 1;
      return;
    }

    // Fetch collection
    const collectionQuery = await pool.query<{ id: string; name: string }>(
      'SELECT id, name FROM collections WHERE id = $1',
      [collectionId]
    );

    if (collectionQuery.rows.length === 0) {
      console.error(`Collection not found: ${collectionId}`);
      process.exitCode = 1;
      return;
    }

    const collection = collectionQuery.rows[0];
    const expectedDimensions = getModelDimensions(model, provider);

    console.info('\n=== Re-embed Collection ===\n');
    console.info(`Collection: ${collection.name} (${collectionId})`);
    console.info(`Provider: ${provider}`);
    console.info(`Model: ${model}`);
    console.info(`Expected dimensions: ${expectedDimensions}`);
    console.info(`Batch size: ${batchSize}`);
    console.info(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

    // Fetch chunks
    const chunksQuery = await pool.query<{
      id: number;
      text: string;
      embedding_model: string | null;
    }>(
      `SELECT c.id, c.text, c.embedding_model
       FROM chunks c
       JOIN documents d ON c.doc_id = d.id
       WHERE d.collection_id = $1
       ORDER BY c.id`,
      [collectionId]
    );

    const chunks = chunksQuery.rows;
    console.info(`\nChunks to process: ${chunks.length}`);

    if (chunks.length === 0) {
      console.info('No chunks found in this collection.');
      return;
    }

    // Show current model distribution
    const modelCounts = new Map<string, number>();
    for (const chunk of chunks) {
      const m = chunk.embedding_model ?? 'NULL';
      modelCounts.set(m, (modelCounts.get(m) ?? 0) + 1);
    }
    console.info('\nCurrent embedding models:');
    for (const [m, count] of modelCounts) {
      console.info(`  ${m}: ${count} chunks`);
    }

    if (dryRun) {
      console.info('\n[DRY RUN] Would re-embed all chunks with the new model.');
      console.info('[DRY RUN] No changes made.');
      return;
    }

    // Process in batches
    console.info('\nRe-embedding...\n');
    let processed = 0;
    let errors = 0;
    const startTime = Date.now();

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(chunks.length / batchSize);

      if (verbose) {
        console.info(`Batch ${batchNum}/${totalBatches}...`);
      }

      // Embed each chunk in the batch
      const embedPromises = batch.map(async (chunk) => {
        try {
          const result = await embedText(chunk.text, {
            provider,
            model,
          });

          // Update chunk in database
          await pool.query(
            `UPDATE chunks
             SET embedding = $1::vector,
                 embedding_model = $2,
                 metadata = metadata || $3::jsonb
             WHERE id = $4`,
            [
              result.embedding,
              model,
              JSON.stringify({
                re_embedded_at: new Date().toISOString(),
                re_embedded_from: chunk.embedding_model,
              }),
              chunk.id,
            ]
          );

          return { success: true, id: chunk.id };
        } catch (error) {
          console.error(`Error embedding chunk ${chunk.id}:`, error);
          return { success: false, id: chunk.id, error };
        }
      });

      const results = await Promise.all(embedPromises);

      for (const r of results) {
        if (r.success) {
          processed++;
        } else {
          errors++;
        }
      }

      // Progress update
      const pct = (((i + batch.length) / chunks.length) * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (processed / Number.parseFloat(elapsed)).toFixed(1);
      process.stdout.write(
        `\rProgress: ${i + batch.length}/${chunks.length} (${pct}%) - ${rate} chunks/s`
      );
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

    console.info('\n\n=== Complete ===');
    console.info(`Processed: ${processed}`);
    console.info(`Errors: ${errors}`);
    console.info(`Time: ${totalTime}s`);
    console.info(`Rate: ${(processed / Number.parseFloat(totalTime)).toFixed(1)} chunks/s`);

    if (errors > 0) {
      console.info('\n⚠️  Some chunks failed to re-embed. Check logs above.');
      process.exitCode = 1;
    } else {
      console.info('\n✅ All chunks re-embedded successfully!');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

// =============================================================================
// Help
// =============================================================================

function printHelp(): void {
  console.info(`
Re-embed Collection Script

Re-embeds all chunks in a collection with a different embedding provider/model.

Usage:
  pnpm re-embed --collection <id> --provider <provider> --model <model>
  pnpm re-embed -c <id> -p voyage -m voyage-code-3

Required Options:
  -c, --collection <id>    Collection ID (UUID) to re-embed
  -p, --provider <name>    Embedding provider: ollama, openai, voyage, cohere, google
  -m, --model <name>       Model name (e.g., voyage-code-3, nomic-embed-text)

Optional:
  --batch-size <n>         Batch size for embedding (default: 10)
  --dry-run                Show what would be done without making changes
  -v, --verbose            Verbose output
  -h, --help               Show this help

Examples:
  # Re-embed with Voyage code model
  pnpm re-embed -c abc123 -p voyage -m voyage-code-3

  # Dry run to see what would happen
  pnpm re-embed -c abc123 -p voyage -m voyage-code-3 --dry-run

  # Re-embed with Ollama (free, local)
  pnpm re-embed -c abc123 -p ollama -m nomic-embed-text

Model Dimensions:
  voyage-code-3:           1024
  voyage-code-2:           1536
  nomic-embed-text:        768
  text-embedding-3-large:  1536
  embed-english-v3.0:      1024

Note: Chunks will be updated in-place. Consider backing up first.
`);
}

// =============================================================================
// Run
// =============================================================================

main();
