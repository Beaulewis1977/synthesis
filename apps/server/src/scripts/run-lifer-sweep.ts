#!/usr/bin/env tsx
/**
 * Lifer RAG Evaluation Sweep Script
 *
 * Automated multi-pass sweep to optimize RAG pipeline configuration.
 * Tests embedding models, chunking parameters, rerankers, and search settings.
 *
 * Usage:
 *   pnpm sweep:lifer                    # Run all passes
 *   pnpm sweep:lifer --pass=1A          # Run specific pass
 *   pnpm sweep:lifer --dry-run          # Preview without changes
 *   pnpm sweep:lifer --resume=false     # Start fresh (ignore state)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createCollection, createRepoSource, getPool, listDocuments } from '@synthesis/db';
import type { Pool } from 'pg';
import { createConfig, loadDataset, runEvaluation } from '../evaluation/runner.js';
import {
  type DatasetResult,
  type SweepConfig,
  type SweepPass,
  type SweepResult,
  type SweepState,
  formatMetrics,
  generatePass1AConfigs,
  generatePass1BConfigs,
  generatePass2Configs,
  generatePass3Configs,
  generatePass4Configs,
  getCollectionName,
  getCostTier,
  getModelDimensions,
  getProfileName,
  validateApiKeys,
} from '../evaluation/sweep-config.js';
import type { EvalDataset, EvalReport } from '../evaluation/types.js';
import {
  type EmbeddingProfileService,
  getEmbeddingProfileService,
} from '../services/embedding-profile-service.js';
import { syncRepository } from '../services/repo-ingestion.js';

// =============================================================================
// Constants
// =============================================================================

const LIFER_REPO_URL = 'https://github.com/ahmedtohamy1/lifer';
const LIFER_DEFAULT_BRANCH = 'development'; // Note: lifer repo uses 'development' as default branch

const STATE_FILE = 'perf/eval_results/lifer-sweep-state.json';
const RESULTS_DIR = 'perf/eval_results';
const DATASETS_DIR = 'perf/eval_datasets';

const CODE_DATASET = 'lifer-flutter-eval.json';
const CODE_DATASET_EXPANDED = 'lifer-flutter-eval-expanded.json';
const DOCS_DATASET = 'lifer-docs.json';
const DOCS_DATASET_EXPANDED = 'lifer-docs-expanded.json';

const INGESTION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const INGESTION_POLL_INTERVAL_MS = 5000; // 5 seconds

// =============================================================================
// CLI Argument Parsing
// =============================================================================

function parseCliArgs() {
  const { values } = parseArgs({
    allowPositionals: true,
    options: {
      pass: {
        type: 'string',
        short: 'p',
        default: 'all',
      },
      resume: {
        type: 'boolean',
        default: true,
      },
      'dry-run': {
        type: 'boolean',
        default: false,
      },
      'skip-ingestion': {
        type: 'boolean',
        default: false,
      },
      verbose: {
        type: 'boolean',
        short: 'v',
        default: false,
      },
      help: {
        type: 'boolean',
        short: 'h',
        default: false,
      },
    },
  });

  return {
    pass: values.pass as string,
    resume: values.resume as boolean,
    dryRun: values['dry-run'] as boolean,
    skipIngestion: values['skip-ingestion'] as boolean,
    verbose: values.verbose as boolean,
    help: values.help as boolean,
  };
}

function showHelp(): void {
  console.info(`
Lifer RAG Evaluation Sweep

Usage: pnpm sweep:lifer [options]

Options:
  -p, --pass <pass>      Run specific pass (1A, 1B, 2, 3, 4) or "all" (default: all)
  --resume               Resume from last state (default: true)
  --no-resume            Start fresh, ignore existing state
  --dry-run              Preview what would be done without making changes
  --skip-ingestion       Skip ingestion, use existing collections
  -v, --verbose          Show detailed progress
  -h, --help             Show this help

Passes:
  1A  Embedding sweep (code) - voyage-code-3, text-embedding-3-large, nomic-embed-code
  1B  Embedding sweep (docs) - nomic-embed-text, voyage-3-large (optional)
  2   Chunking sweep - 400/50, 600/100, 800/100 (uses best from 1A)
  3   Reranker sweep - none, bge, voyage (uses best from 1A+2)
  4   Search tuning - modes, similarity, ef_search (uses best from 1A+2+3)

Examples:
  pnpm sweep:lifer                  # Run all passes
  pnpm sweep:lifer --pass=1A        # Only run embedding sweep
  pnpm sweep:lifer --dry-run        # Preview configurations
  pnpm sweep:lifer --no-resume      # Start fresh
`);
}

// =============================================================================
// State Management
// =============================================================================

async function loadState(): Promise<SweepState> {
  const statePath = path.join(process.cwd(), STATE_FILE);
  try {
    const content = await fs.readFile(statePath, 'utf-8');
    return JSON.parse(content) as SweepState;
  } catch {
    return createInitialState();
  }
}

function createInitialState(): SweepState {
  return {
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedConfigs: [],
    failedConfigs: [],
    results: [],
    bestByPass: {},
  };
}

async function saveState(state: SweepState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  const statePath = path.join(process.cwd(), STATE_FILE);
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(state, null, 2));
}

// =============================================================================
// Profile Management
// =============================================================================

async function ensureProfile(
  profileService: EmbeddingProfileService,
  config: SweepConfig
): Promise<string> {
  const profileName = getProfileName(config);

  // Check if profile already exists
  const existing = await profileService.getProfileByName(profileName);
  if (existing) {
    return existing.id;
  }

  // Create new profile
  const profile = await profileService.createProfile({
    name: profileName,
    displayName: `Sweep: ${config.embedding.provider}/${config.embedding.model}`,
    description: `Auto-generated for sweep: ${config.name}`,
    provider: config.embedding.provider,
    model: config.embedding.model,
    chunkSize: config.chunking.size,
    chunkOverlap: config.chunking.overlap,
    codeAware: config.chunking.codeAware,
    costTier: getCostTier(config.embedding.provider),
  });

  return profile.id;
}

// =============================================================================
// Collection Management
// =============================================================================

async function createSweepCollection(
  db: Pool,
  config: SweepConfig,
  profileId: string
): Promise<{ collectionId: string; collectionName: string }> {
  const collectionName = getCollectionName(config);

  // Check if collection already exists
  const existing = await db.query<{ id: string }>('SELECT id FROM collections WHERE name = $1', [
    collectionName,
  ]);

  if (existing.rows.length > 0) {
    // Update existing collection's profile
    await db.query(
      'UPDATE collections SET embedding_profile_id = $1, updated_at = NOW() WHERE id = $2',
      [profileId, existing.rows[0].id]
    );
    return { collectionId: existing.rows[0].id, collectionName };
  }

  // Create new collection
  const collection = await createCollection(collectionName, `Sweep collection for ${config.name}`);

  // Assign profile
  await db.query(
    'UPDATE collections SET embedding_profile_id = $1, updated_at = NOW() WHERE id = $2',
    [profileId, collection.id]
  );

  return { collectionId: collection.id, collectionName };
}

// =============================================================================
// Repository Ingestion
// =============================================================================

async function ingestLiferRepo(
  db: Pool,
  collectionId: string,
  verbose: boolean
): Promise<{ repoSourceId: string }> {
  // Check if repo source already exists
  const existing = await db.query<{ id: string }>(
    'SELECT id FROM repository_sources WHERE collection_id = $1 AND repo_url = $2',
    [collectionId, LIFER_REPO_URL]
  );

  let repoSourceId: string;

  if (existing.rows.length > 0) {
    repoSourceId = existing.rows[0].id;
    if (verbose) {
      console.info(`  Using existing repo source: ${repoSourceId}`);
    }
  } else {
    const repoSource = await createRepoSource({
      collectionId,
      repoUrl: LIFER_REPO_URL,
      defaultBranch: LIFER_DEFAULT_BRANCH,
      ignoredPaths: ['node_modules/', '.git/', 'build/', '.dart_tool/', '*.lock'],
    });
    repoSourceId = repoSource.id;
    if (verbose) {
      console.info(`  Created repo source: ${repoSourceId}`);
    }
  }

  // Trigger sync
  if (verbose) {
    console.info('  Triggering repository sync...');
  }

  // Fire and forget - sync runs in background
  syncRepository(db, repoSourceId).catch((error) => {
    console.error(`  Sync error: ${error.message}`);
  });

  return { repoSourceId };
}

async function waitForIngestion(
  db: Pool,
  collectionId: string,
  verbose: boolean
): Promise<{ docCount: number; chunkCount: number; durationMs: number }> {
  const startTime = Date.now();

  while (Date.now() - startTime < INGESTION_TIMEOUT_MS) {
    // Check document statuses
    const statusResult = await db.query<{
      status: string;
      count: string;
    }>(
      `SELECT status, COUNT(*) as count
       FROM documents
       WHERE collection_id = $1
       GROUP BY status`,
      [collectionId]
    );

    const statusMap: Record<string, number> = {};
    for (const row of statusResult.rows) {
      statusMap[row.status] = Number.parseInt(row.count, 10);
    }

    const complete = statusMap.complete ?? 0;
    const pending = statusMap.pending ?? 0;
    const extracting = statusMap.extracting ?? 0;
    const chunking = statusMap.chunking ?? 0;
    const embedding = statusMap.embedding ?? 0;
    const error = statusMap.error ?? 0;

    const inProgress = pending + extracting + chunking + embedding;
    const total = complete + inProgress + error;

    if (verbose) {
      console.info(
        `  Progress: ${complete}/${total} complete, ${inProgress} in progress, ${error} errors`
      );
    }

    if (total > 0 && inProgress === 0) {
      // All documents processed
      const chunkResult = await db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM chunks c
         JOIN documents d ON c.doc_id = d.id
         WHERE d.collection_id = $1`,
        [collectionId]
      );

      const durationMs = Date.now() - startTime;

      return {
        docCount: complete,
        chunkCount: Number.parseInt(chunkResult.rows[0].count, 10),
        durationMs,
      };
    }

    await sleep(INGESTION_POLL_INTERVAL_MS);
  }

  throw new Error(`Ingestion timeout after ${INGESTION_TIMEOUT_MS}ms`);
}

// =============================================================================
// Evaluation Execution
// =============================================================================

async function runSweepEvaluation(
  db: Pool,
  collectionId: string,
  config: SweepConfig,
  datasetPath: string,
  expandedDatasetPath: string | null,
  verbose: boolean
): Promise<DatasetResult> {
  const fullDatasetPath = path.join(process.cwd(), DATASETS_DIR, datasetPath);

  // Check if dataset exists
  try {
    await fs.access(fullDatasetPath);
  } catch {
    throw new Error(`Dataset not found: ${fullDatasetPath}`);
  }

  // Load dataset
  const dataset = await loadDataset(fullDatasetPath);

  // Patch collection IDs
  const patchedDataset = patchCollectionIds(dataset, collectionId);

  // Create eval config
  const evalConfig = createConfig({
    searchMode: config.search.mode === 'bm25' ? 'hybrid' : config.search.mode,
    rerank: config.reranker.provider !== 'none',
    topK: config.search.topK,
    evaluateGeneration: false,
    evaluationMode: 'doc',
  });

  // Set search tuning via environment
  const originalEnv = {
    MIN_SIMILARITY: process.env.MIN_SIMILARITY,
    HNSW_EF_SEARCH: process.env.HNSW_EF_SEARCH,
    ENABLE_QUERY_EXPANSION: process.env.ENABLE_QUERY_EXPANSION,
    RERANKER_PROVIDER: process.env.RERANKER_PROVIDER,
    RERANKER_MODEL: process.env.RERANKER_MODEL,
  };

  try {
    process.env.MIN_SIMILARITY = String(config.search.minSimilarity);
    process.env.HNSW_EF_SEARCH = String(config.search.efSearch);
    process.env.ENABLE_QUERY_EXPANSION = String(config.search.queryExpansion);

    if (config.reranker.provider !== 'none') {
      process.env.RERANKER_PROVIDER = config.reranker.provider;
      if (config.reranker.model) {
        process.env.RERANKER_MODEL = config.reranker.model;
      }
    } else {
      process.env.RERANKER_PROVIDER = 'none';
    }

    // Run evaluation on original GT
    if (verbose) {
      console.info(`  Running eval on ${datasetPath}...`);
    }

    const origReport = await runEvaluation(patchedDataset, {
      db,
      config: evalConfig,
      onProgress: verbose
        ? (completed, total, query) => {
            process.stdout.write(`\r    ${completed}/${total}: ${query.slice(0, 50)}...`);
          }
        : undefined,
    });

    if (verbose) {
      console.info(''); // Newline after progress
    }

    // Run evaluation on expanded GT if available
    let expandedReport: EvalReport | null = null;
    if (expandedDatasetPath) {
      const fullExpandedPath = path.join(process.cwd(), DATASETS_DIR, expandedDatasetPath);
      try {
        await fs.access(fullExpandedPath);
        const expandedDataset = await loadDataset(fullExpandedPath);
        const patchedExpandedDataset = patchCollectionIds(expandedDataset, collectionId);

        if (verbose) {
          console.info(`  Running eval on ${expandedDatasetPath}...`);
        }

        expandedReport = await runEvaluation(patchedExpandedDataset, {
          db,
          config: evalConfig,
        });
      } catch {
        if (verbose) {
          console.info(`  Expanded dataset not found: ${expandedDatasetPath}`);
        }
      }
    }

    return {
      datasetName: datasetPath,
      queryCount: patchedDataset.queries.length,
      original: {
        mrr: origReport.overall.mean.mrr,
        hitRate: origReport.overall.mean.hit_rate,
        zeroHits: origReport.failures.zeroHits.length,
      },
      expanded: expandedReport
        ? {
            mrr: expandedReport.overall.mean.mrr,
            hitRate: expandedReport.overall.mean.hit_rate,
            zeroHits: expandedReport.failures.zeroHits.length,
          }
        : { mrr: 0, hitRate: 0, zeroHits: 0 },
    };
  } finally {
    // Restore original environment
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function patchCollectionIds(dataset: EvalDataset, collectionId: string): EvalDataset {
  return {
    ...dataset,
    queries: dataset.queries.map((q) => ({
      ...q,
      collectionId,
    })),
  };
}

// =============================================================================
// Reporting
// =============================================================================

async function saveResultReport(result: SweepResult, verbose: boolean): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportName = `sweep-${result.config.name}-${timestamp}.json`;
  const reportPath = path.join(process.cwd(), RESULTS_DIR, reportName);

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(result, null, 2));

  if (verbose) {
    console.info(`  Report saved: ${reportPath}`);
  }

  return reportName;
}

async function appendToSweepTable(result: SweepResult, summaryPath: string): Promise<void> {
  // Read existing summary
  let content: string;
  try {
    content = await fs.readFile(summaryPath, 'utf-8');
  } catch {
    console.warn(`  Warning: Could not read ${summaryPath}`);
    return;
  }

  // Find the sweep table
  const tableMarker = '| Date | Pass | Collection Name |';
  const tableIndex = content.indexOf(tableMarker);

  if (tableIndex === -1) {
    console.warn('  Warning: Sweep table not found in EVAL_RESULTS_SUMMARY.md');
    return;
  }

  // Build new row
  const config = result.config;
  const dims = getModelDimensions(config.embedding.model, config.embedding.provider);
  const date = new Date().toISOString().split('T')[0];

  const row = [
    date,
    config.pass,
    result.collectionName,
    result.collectionId.slice(0, 8),
    config.embedding.provider,
    config.embedding.model,
    dims,
    `${config.chunking.size}/${config.chunking.overlap}`,
    config.chunking.codeAware,
    config.reranker.provider,
    config.reranker.model ?? '-',
    config.search.mode,
    config.search.topK,
    config.search.minSimilarity,
    config.search.efSearch,
    config.search.mode === 'hybrid'
      ? `${config.search.hybridWeights?.vector ?? 0.6}/${config.search.hybridWeights?.bm25 ?? 0.4}`
      : '-',
    config.search.queryExpansion ? 'on' : 'off',
    config.search.mmrEnabled ? `on(${config.search.mmrLambda})` : 'off',
    `${result.latency.avg.toFixed(0)}/${result.latency.p95.toFixed(0)}`,
    result.datasets.code.original.mrr.toFixed(3),
    result.datasets.code.original.hitRate.toFixed(3),
    result.datasets.code.original.zeroHits,
    result.datasets.code.expanded.mrr.toFixed(3),
    result.datasets.code.expanded.hitRate.toFixed(3),
    result.datasets.code.expanded.zeroHits,
    '', // Notes
    result.reportPath,
  ].join(' | ');

  // Find insertion point (after header separator)
  const headerEnd = content.indexOf('\n', tableIndex);
  const separatorEnd = content.indexOf('\n', headerEnd + 1);
  const insertPoint = separatorEnd;

  // Insert new row
  const updated =
    content.slice(0, insertPoint + 1) + `| ${row} |\n` + content.slice(insertPoint + 1);

  await fs.writeFile(summaryPath, updated);
}

// =============================================================================
// Main Sweep Logic
// =============================================================================

async function runSingleConfig(
  db: Pool,
  profileService: EmbeddingProfileService,
  config: SweepConfig,
  _state: SweepState,
  options: {
    dryRun: boolean;
    skipIngestion: boolean;
    verbose: boolean;
  }
): Promise<SweepResult | null> {
  const { dryRun, skipIngestion, verbose } = options;
  const startTime = Date.now();

  console.info(`\n${'='.repeat(70)}`);
  console.info(`Configuration: ${config.name}`);
  console.info(`Pass: ${config.pass}`);
  console.info(`Embedding: ${config.embedding.provider}/${config.embedding.model}`);
  console.info(
    `Chunking: ${config.chunking.size}/${config.chunking.overlap}, codeAware=${config.chunking.codeAware}`
  );
  console.info(
    `Reranker: ${config.reranker.provider}${config.reranker.model ? '/' + config.reranker.model : ''}`
  );
  console.info(`${'='.repeat(70)}`);

  // Validate API keys
  const keyErrors = validateApiKeys(config);
  if (keyErrors.length > 0) {
    console.error('\n[SKIP] Missing API keys:');
    for (const err of keyErrors) {
      console.error(`  - ${err}`);
    }
    return null;
  }

  if (dryRun) {
    console.info('\n[DRY RUN] Would execute this configuration');
    return null;
  }

  try {
    // Step 1: Create/get embedding profile
    console.info('\n1. Setting up embedding profile...');
    const profileId = await ensureProfile(profileService, config);
    if (verbose) {
      console.info(`  Profile ID: ${profileId}`);
    }

    // Step 2: Create/get collection
    console.info('2. Setting up collection...');
    const { collectionId, collectionName } = await createSweepCollection(db, config, profileId);
    if (verbose) {
      console.info(`  Collection: ${collectionName} (${collectionId})`);
    }

    // Step 3: Ingest repository (unless skipped)
    let ingestionStats = { docCount: 0, chunkCount: 0, durationMs: 0 };

    if (!skipIngestion) {
      console.info('3. Ingesting lifer repository...');
      await ingestLiferRepo(db, collectionId, verbose);

      console.info('4. Waiting for ingestion to complete...');
      ingestionStats = await waitForIngestion(db, collectionId, verbose);
      console.info(
        `  Ingestion complete: ${ingestionStats.docCount} docs, ${ingestionStats.chunkCount} chunks`
      );
    } else {
      console.info('3-4. Skipping ingestion (using existing collection)');
      // Get existing stats
      const docs = await listDocuments(collectionId);
      const chunkResult = await db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM chunks c
         JOIN documents d ON c.doc_id = d.id
         WHERE d.collection_id = $1`,
        [collectionId]
      );
      ingestionStats = {
        docCount: docs.length,
        chunkCount: Number.parseInt(chunkResult.rows[0].count, 10),
        durationMs: 0,
      };
    }

    // Step 5: Run evaluation
    console.info('5. Running evaluation...');
    const codeResult = await runSweepEvaluation(
      db,
      collectionId,
      config,
      CODE_DATASET,
      CODE_DATASET_EXPANDED,
      verbose
    );

    // Optionally run docs evaluation
    let docsResult: DatasetResult | undefined;
    try {
      const docsPath = path.join(process.cwd(), DATASETS_DIR, DOCS_DATASET);
      await fs.access(docsPath);
      docsResult = await runSweepEvaluation(
        db,
        collectionId,
        config,
        DOCS_DATASET,
        DOCS_DATASET_EXPANDED,
        verbose
      );
    } catch {
      if (verbose) {
        console.info('  Docs dataset not found, skipping');
      }
    }

    // Build result
    const result: SweepResult = {
      config,
      collectionId,
      collectionName,
      profileId,
      timestamp: new Date().toISOString(),
      datasets: {
        code: codeResult,
        ...(docsResult ? { docs: docsResult } : {}),
      },
      ingestion: ingestionStats,
      latency: {
        avg: 0, // Would need to track this during eval
        p50: 0,
        p95: 0,
        p99: 0,
      },
      reportPath: '',
    };

    // Save report
    console.info('6. Saving results...');
    result.reportPath = await saveResultReport(result, verbose);

    // Update summary table
    const summaryPath = path.join(
      process.cwd(),
      'apps/server/src/evaluation/EVAL_RESULTS_SUMMARY.md'
    );
    await appendToSweepTable(result, summaryPath);

    // Print summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.info(`\n[SUCCESS] ${config.name} completed in ${duration}s`);
    console.info(`  ${formatMetrics(result)}`);

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\n[ERROR] ${config.name} failed: ${errorMsg}`);
    throw error;
  }
}

async function runPass(
  db: Pool,
  profileService: EmbeddingProfileService,
  pass: SweepPass | 'all',
  state: SweepState,
  options: {
    dryRun: boolean;
    skipIngestion: boolean;
    verbose: boolean;
  }
): Promise<void> {
  const configs: SweepConfig[] = [];

  // Generate configurations based on pass
  if (pass === 'all' || pass === '1A-code-emb') {
    configs.push(...generatePass1AConfigs());
  }

  if (pass === 'all' || pass === '1B-docs-emb') {
    configs.push(...generatePass1BConfigs());
  }

  if (pass === '2-chunk') {
    // Need best embedding from Pass 1A
    const best1A = state.bestByPass['1A-code-emb'];
    if (!best1A) {
      throw new Error('Pass 2 requires Pass 1A results. Run Pass 1A first.');
    }
    // Find the embedding config from the best result
    const bestResult = state.results.find((r) => r.config.name === best1A.configName);
    if (!bestResult) {
      throw new Error(`Best config from 1A not found: ${best1A.configName}`);
    }
    configs.push(...generatePass2Configs(bestResult.config.embedding));
  }

  if (pass === '3-rerank') {
    const best1A = state.bestByPass['1A-code-emb'];
    const best2 = state.bestByPass['2-chunk'];
    if (!best1A) {
      throw new Error('Pass 3 requires Pass 1A results.');
    }
    const embeddingResult = state.results.find((r) => r.config.name === best1A.configName);
    const chunkingResult = best2
      ? state.results.find((r) => r.config.name === best2.configName)
      : embeddingResult;

    if (!embeddingResult || !chunkingResult) {
      throw new Error('Could not find best configs from previous passes.');
    }

    configs.push(
      ...generatePass3Configs(embeddingResult.config.embedding, chunkingResult.config.chunking)
    );
  }

  if (pass === '4-search-tune') {
    const best1A = state.bestByPass['1A-code-emb'];
    const best2 = state.bestByPass['2-chunk'];
    const best3 = state.bestByPass['3-rerank'];

    if (!best1A) {
      throw new Error('Pass 4 requires Pass 1A results.');
    }

    const embeddingResult = state.results.find((r) => r.config.name === best1A.configName);
    const chunkingResult = best2
      ? state.results.find((r) => r.config.name === best2.configName)
      : embeddingResult;
    const rerankerResult = best3
      ? state.results.find((r) => r.config.name === best3.configName)
      : chunkingResult;

    if (!embeddingResult || !chunkingResult || !rerankerResult) {
      throw new Error('Could not find best configs from previous passes.');
    }

    configs.push(
      ...generatePass4Configs(
        embeddingResult.config.embedding,
        chunkingResult.config.chunking,
        rerankerResult.config.reranker
      )
    );
  }

  console.info(`\nConfigurations to run: ${configs.length}`);

  // Filter out already completed
  const pendingConfigs = configs.filter((c) => !state.completedConfigs.includes(c.name));
  console.info(`Already completed: ${configs.length - pendingConfigs.length}`);
  console.info(`Remaining: ${pendingConfigs.length}`);

  if (options.dryRun) {
    console.info('\n[DRY RUN] Would run these configurations:');
    for (const config of pendingConfigs) {
      console.info(`  - ${config.name}`);
    }
    return;
  }

  // Run each configuration
  for (const config of pendingConfigs) {
    try {
      const result = await runSingleConfig(db, profileService, config, state, options);

      if (result) {
        state.completedConfigs.push(config.name);
        state.results.push(result);

        // Update best by pass
        const passResults = state.results.filter((r) => r.config.pass === config.pass);
        const best = passResults.reduce((best, curr) => {
          const bestMRR = best?.datasets.code.expanded.mrr ?? 0;
          const currMRR = curr.datasets.code.expanded.mrr;
          return currMRR > bestMRR ? curr : best;
        }, passResults[0]);

        if (best) {
          state.bestByPass[config.pass] = {
            configName: best.config.name,
            collectionId: best.collectionId,
            metrics: {
              mrr: best.datasets.code.expanded.mrr,
              hitRate: best.datasets.code.expanded.hitRate,
              zeroHits: best.datasets.code.expanded.zeroHits,
            },
          };
        }

        await saveState(state);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      state.failedConfigs.push({
        name: config.name,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      });
      await saveState(state);
      // Continue with next config
    }
  }
}

// =============================================================================
// Entry Point
// =============================================================================

async function main(): Promise<void> {
  const args = parseCliArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  console.info('='.repeat(70));
  console.info('LIFER RAG EVALUATION SWEEP');
  console.info('='.repeat(70));

  // Load state
  let state: SweepState;
  if (args.resume) {
    state = await loadState();
    console.info(`\nResuming from state (started: ${state.startedAt})`);
    console.info(`  Completed: ${state.completedConfigs.length}`);
    console.info(`  Failed: ${state.failedConfigs.length}`);
  } else {
    state = createInitialState();
    console.info('\nStarting fresh sweep');
  }

  // Get database pool
  const db = getPool();
  const profileService = getEmbeddingProfileService(db);

  try {
    // Parse pass argument
    let pass: SweepPass | 'all';
    const passArg = args.pass.toUpperCase();

    if (passArg === 'ALL') {
      pass = 'all';
    } else if (passArg === '1A') {
      pass = '1A-code-emb';
    } else if (passArg === '1B') {
      pass = '1B-docs-emb';
    } else if (passArg === '2') {
      pass = '2-chunk';
    } else if (passArg === '3') {
      pass = '3-rerank';
    } else if (passArg === '4') {
      pass = '4-search-tune';
    } else {
      console.error(`Unknown pass: ${args.pass}`);
      process.exit(1);
    }

    // Run sweep
    await runPass(db, profileService, pass, state, {
      dryRun: args.dryRun,
      skipIngestion: args.skipIngestion,
      verbose: args.verbose,
    });

    // Final summary
    console.info('\n' + '='.repeat(70));
    console.info('SWEEP COMPLETE');
    console.info('='.repeat(70));
    console.info(`\nTotal completed: ${state.completedConfigs.length}`);
    console.info(`Total failed: ${state.failedConfigs.length}`);

    if (Object.keys(state.bestByPass).length > 0) {
      console.info('\nBest by pass:');
      for (const [passKey, best] of Object.entries(state.bestByPass)) {
        if (best) {
          console.info(`  ${passKey}: ${best.configName}`);
          console.info(
            `    MRR: ${best.metrics.mrr.toFixed(3)}, Hit Rate: ${best.metrics.hitRate.toFixed(3)}`
          );
        }
      }
    }
  } finally {
    await db.end();
  }
}

// =============================================================================
// Utilities
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
