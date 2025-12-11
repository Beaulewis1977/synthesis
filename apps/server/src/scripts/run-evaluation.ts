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
  generateDataset,
  loadBaselineReport,
  loadDataset,
  runEvaluation,
  saveDataset,
  saveReports,
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
    onProgress: (msg) => console.log(msg),
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
        console.log(`Verbose: Processing query ${displayNum}/${total} (${pct}%)`);
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
  console.log(`
RAG Evaluation CLI

Usage:
  pnpm eval                           # Run all evaluations
  pnpm eval --category=code           # Code queries only
  pnpm eval --retrieval-only          # Skip generation eval
  pnpm eval --compare baseline.json   # Compare against baseline
  pnpm eval --generate-dataset        # Generate synthetic dataset

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
`);
}

// =============================================================================
// Run
// =============================================================================

main().catch((error) => {
  console.error('Evaluation failed:', error);
  process.exitCode = 1;
});
