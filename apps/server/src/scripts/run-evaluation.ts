#!/usr/bin/env node
/**
 * RAG Evaluation CLI
 *
 * Usage:
 *   pnpm eval                           # Run all evaluations
 *   pnpm eval --category=code           # Code queries only
 *   pnpm eval --retrieval-only          # Skip generation eval
 *   pnpm eval --compare baseline.json   # Compare against baseline
 *   pnpm eval --generate-dataset        # Generate synthetic dataset
 */

import { parseArgs } from 'node:util';
import { closePool, getPool } from '@synthesis/db';
import {
  type EvalCategory,
  type EvalDataset,
  type EvaluationMode,
  compareReports,
  createConfig,
  createLLMJudge,
  expandGroundTruth,
  generateDataset,
  loadBaselineReport,
  loadDataset,
  runEvaluation,
  saveDataset,
  saveReports,
  validateGroundTruth,
} from '../evaluation/index.js';

// =============================================================================
// Validation Helpers
// =============================================================================

const VALID_CATEGORIES = new Set<EvalCategory>(['docs', 'code', 'mobile', 'general']);
const VALID_EVAL_MODES = new Set<EvaluationMode>(['doc', 'chunk', 'flexible']);

function validateCategory(category: string | undefined): EvalCategory | undefined {
  if (!category) return undefined;
  if (VALID_CATEGORIES.has(category as EvalCategory)) {
    return category as EvalCategory;
  }
  throw new Error(
    `Invalid category: "${category}". Valid categories: ${[...VALID_CATEGORIES].join(', ')}`
  );
}

function validateEvalMode(mode: string | undefined): EvaluationMode {
  const modeToValidate = mode ?? 'doc';
  if (VALID_EVAL_MODES.has(modeToValidate as EvaluationMode)) {
    return modeToValidate as EvaluationMode;
  }
  throw new Error(`Invalid eval mode: "${mode}". Valid modes: ${[...VALID_EVAL_MODES].join(', ')}`);
}

// =============================================================================
// CLI Configuration
// =============================================================================

const { values: args } = parseArgs({
  options: {
    category: {
      type: 'string',
      short: 'c',
      description: 'Category to evaluate (docs, code, mobile, general)',
    },
    'retrieval-only': {
      type: 'boolean',
      short: 'r',
      default: false,
      description: 'Skip generation evaluation',
    },
    compare: {
      type: 'string',
      description: 'Path to baseline report for comparison',
    },
    'generate-dataset': {
      type: 'boolean',
      short: 'g',
      default: false,
      description: 'Generate synthetic dataset instead of running eval',
    },
    'queries-per-category': {
      type: 'string',
      default: '10',
      description: 'Number of queries per category for dataset generation',
    },
    dataset: {
      type: 'string',
      short: 'd',
      description: 'Path to dataset file (default: perf/eval_datasets/combined.json)',
    },
    'search-mode': {
      type: 'string',
      default: 'hybrid',
      description: 'Search mode (vector, hybrid, bm25)',
    },
    rerank: {
      type: 'boolean',
      default: true,
      description: 'Enable reranking',
    },
    'top-k': {
      type: 'string',
      default: '10',
      description: 'Number of results to retrieve',
    },
    'eval-mode': {
      type: 'string',
      default: 'doc',
      description: 'Evaluation mode: doc, chunk, or flexible (default: doc)',
    },
    output: {
      type: 'string',
      short: 'o',
      default: 'perf/eval_results',
      description: 'Output directory for reports',
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
    'expand-ground-truth': {
      type: 'boolean',
      default: false,
      description: 'Expand ground truth using LLM judge before evaluation',
    },
    'expansion-threshold': {
      type: 'string',
      default: '0.7',
      description: 'Confidence threshold for ground truth expansion (0-1)',
    },
    'validate-ground-truth': {
      type: 'boolean',
      default: false,
      description: 'Validate that ground truth doc IDs exist in database',
    },
  },
  allowPositionals: false,
});

// =============================================================================
// Main Entry Point
// =============================================================================

async function main(): Promise<void> {
  if (args.help) {
    printHelp();
    return;
  }

  const pool = getPool();

  try {
    if (args['generate-dataset']) {
      await runDatasetGeneration(pool);
    } else {
      await runEval(pool);
    }
  } finally {
    await closePool();
  }
}

// =============================================================================
// Dataset Generation
// =============================================================================

async function runDatasetGeneration(pool: ReturnType<typeof getPool>): Promise<void> {
  const validatedCategory = validateCategory(args.category);
  const categories: EvalCategory[] = validatedCategory
    ? [validatedCategory]
    : ['docs', 'code', 'mobile', 'general'];

  const queriesPerCategory = Number.parseInt(args['queries-per-category'] ?? '10', 10);

  const dataset = await generateDataset({
    db: pool,
    categories,
    queriesPerCategory,
    onProgress: (msg) => console.info(msg),
  });

  // Save dataset - use path relative to script location
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const outputPath = path.join(__dirname, `../../perf/eval_datasets/synthetic-${Date.now()}.json`);
  await saveDataset(dataset, outputPath);
}

// =============================================================================
// Evaluation
// =============================================================================

async function runEval(pool: ReturnType<typeof getPool>): Promise<void> {
  // Load dataset
  const datasetPath = args.dataset ?? 'apps/server/perf/eval_datasets/combined.json';
  let dataset: EvalDataset;

  try {
    dataset = await loadDataset(datasetPath);
  } catch (error) {
    console.error(`Failed to load dataset from ${datasetPath}`);
    console.error('Run with --generate-dataset to create a new dataset first.');
    process.exit(1);
  }

  // Validate ground truth if requested
  if (args['validate-ground-truth']) {
    console.info('\n=== Validating Ground Truth ===\n');
    const validation = await validateGroundTruth(pool, dataset);
    console.info(`Total doc IDs: ${validation.stats.total}`);
    console.info(`Found in DB: ${validation.stats.found}`);
    console.info(`Missing: ${validation.stats.missing}`);

    if (!validation.valid) {
      console.info('\nMissing doc IDs by query:');
      for (const [queryId, docIds] of validation.missingDocIds) {
        console.info(`  ${queryId}: ${docIds.join(', ')}`);
      }
      console.info('\nRun with --expand-ground-truth to fix these issues.');
    } else {
      console.info('\n✅ All ground truth doc IDs are valid!');
    }
    return;
  }

  // Expand ground truth if requested
  if (args['expand-ground-truth']) {
    console.info('\n=== Expanding Ground Truth ===\n');
    const threshold = Number.parseFloat(args['expansion-threshold'] ?? '0.7');
    const searchMode = (args['search-mode'] as 'vector' | 'hybrid') ?? 'hybrid';

    const { dataset: expandedDataset, stats } = await expandGroundTruth(dataset, {
      db: pool,
      confidenceThreshold: threshold,
      searchMode,
      rerank: args.rerank ?? true,
      verbose: args.verbose ?? false,
      onProgress: (current, total, query) => {
        const pct = ((current / total) * 100).toFixed(0);
        process.stdout.write(
          `\rExpanding: ${current}/${total} (${pct}%) - ${query.slice(0, 40)}...`
        );
      },
    });

    console.info('\n\n=== Expansion Stats ===');
    console.info(`Queries expanded: ${stats.queriesExpanded}/${stats.totalQueries}`);
    console.info(
      `Avg docs/query: ${stats.avgDocsPerQuery.before.toFixed(1)} → ${stats.avgDocsPerQuery.after.toFixed(1)}`
    );
    console.info(`Total doc IDs: ${stats.originalDocCount} → ${stats.expandedDocCount}`);

    // Save expanded dataset
    const expandedPath = datasetPath.replace('.json', '-expanded.json');
    await saveDataset(expandedDataset, expandedPath);
    console.info(`\n✅ Saved expanded dataset to: ${expandedPath}\n`);

    // Use expanded dataset for evaluation
    dataset = expandedDataset;
  }

  // Build config
  const validatedCategory = validateCategory(args.category);
  const categories: EvalCategory[] | undefined = validatedCategory
    ? [validatedCategory]
    : undefined;

  const evaluationMode = validateEvalMode(args['eval-mode']);

  const config = createConfig({
    categories,
    evaluateGeneration: !args['retrieval-only'],
    searchMode: (args['search-mode'] as 'vector' | 'hybrid' | 'bm25') ?? 'hybrid',
    rerank: args.rerank ?? true,
    topK: Number.parseInt(args['top-k'] ?? '10', 10),
    evaluationMode,
  });

  // Create LLM judge if evaluating generation
  const llmJudge = config.evaluateGeneration ? createLLMJudge() : undefined;

  // Run evaluation
  let report = await runEvaluation(dataset, {
    db: pool,
    config,
    llmJudge,
    onProgress: (current, total, _query) => {
      // current is 0-indexed, so add 1 for display
      const displayNum = current + 1;
      const pct = ((displayNum / total) * 100).toFixed(0);
      if (args.verbose) {
        console.info(`Verbose: Processing query ${displayNum}/${total} (${pct}%)`);
      } else if (displayNum % 10 === 0 || displayNum === 1 || displayNum === total) {
        process.stdout.write(`\rProcessing: ${displayNum}/${total} (${pct}%)`);
      }
    },
  });

  // Compare with baseline if provided
  let baselineReport: Awaited<ReturnType<typeof loadBaselineReport>> | undefined;
  if (args.compare) {
    try {
      baselineReport = await loadBaselineReport(args.compare);
      report = compareReports(report, baselineReport);
    } catch (error) {
      console.warn(`Warning: Could not load baseline from ${args.compare}`);
    }
  }

  // Save reports
  const outputDir = args.output ?? 'apps/server/perf/eval_results';
  await saveReports(report, outputDir, baselineReport);
}

// =============================================================================
// Helpers
// =============================================================================

function printHelp(): void {
  console.info(`
RAG Evaluation CLI

Usage:
  pnpm eval                           # Run all evaluations
  pnpm eval --category=code           # Code queries only
  pnpm eval --retrieval-only          # Skip generation eval
  pnpm eval --compare baseline.json   # Compare against baseline
  pnpm eval --generate-dataset        # Generate synthetic dataset
  pnpm eval --expand-ground-truth     # Expand ground truth with LLM judge
  pnpm eval --validate-ground-truth   # Check if doc IDs exist in DB

Options:
  -c, --category <type>       Filter by category: docs, code, mobile, general
  -r, --retrieval-only        Skip LLM generation evaluation (faster, free)
  -g, --generate-dataset      Generate synthetic queries from your docs
  -d, --dataset <path>        Path to dataset JSON file
  --search-mode <mode>        vector | hybrid | bm25 (default: hybrid)
  --rerank                    Enable reranking (default: true)
  --top-k <n>                 Results to retrieve (default: 10)
  --eval-mode <mode>          doc | chunk | flexible (default: doc)
  --compare <path>            Compare against a baseline report
  -o, --output <dir>          Output directory (default: perf/eval_results)
  -v, --verbose               Show per-query progress
  -h, --help                  Show this help

Ground Truth Options:
  --expand-ground-truth       Expand ground truth using LLM judge before eval
  --expansion-threshold <n>   Confidence threshold for expansion (default: 0.7)
  --validate-ground-truth     Validate doc IDs exist in database (no eval)
`);
}

// =============================================================================
// Run
// =============================================================================

main().catch((error) => {
  console.error('Evaluation failed:', error);
  process.exitCode = 1;
});
