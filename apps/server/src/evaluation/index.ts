/**
 * Synthesis RAG Evaluation Framework
 *
 * A comprehensive framework for evaluating RAG pipeline quality.
 *
 * @example
 * ```typescript
 * import { runEvaluation, loadDataset, createConfig, createLLMJudge, saveReports } from './evaluation';
 *
 * const dataset = await loadDataset('path/to/dataset.json');
 * const config = createConfig({ searchMode: 'hybrid', rerank: true });
 * const judge = createLLMJudge();
 *
 * const report = await runEvaluation(dataset, {
 *   db: pool,
 *   config,
 *   llmJudge: judge,
 *   onProgress: (done, total) => console.log(`${done}/${total}`)
 * });
 *
 * await saveReports(report, './perf/eval_results');
 * ```
 */

// Types
export type {
  EvalCategory,
  EvalDifficulty,
  EvalQueryType,
  EvalQuery,
  EvalSearchResult,
  RetrievalMetrics,
  GenerationMetrics,
  EvalResult,
  AggregateMetrics,
  EvalReport,
  EvalConfig,
  EvalDataset,
  EvaluationMode,
} from './types.js';

export { DEFAULT_EVAL_CONFIG } from './types.js';

// Metrics
export {
  calculateMRR,
  calculateNDCG,
  calculateRecall,
  calculatePrecision,
  calculateHitRate,
  calculateRetrievalMetrics,
  aggregateMetrics,
  mean,
  stddev,
  percentile,
  formatMetric,
  formatLatency,
  formatDelta,
  compareMetrics,
} from './metrics.js';

// Runner
export {
  runEvaluation,
  loadDataset,
  saveReport,
  createConfig,
  type EvalRunnerOptions,
} from './runner.js';

// Dataset Generator
export {
  generateDataset,
  createManualQuery,
  createManualDataset,
  mergeDatasets,
  saveDataset,
  loadDataset as loadDatasetFile,
  type DatasetGeneratorOptions,
} from './dataset-generator.js';

// LLM Judge
export {
  createLLMJudge,
  batchJudge,
  checkFaithfulness,
  checkRelevancy,
  type LLMJudgeOptions,
  type BatchJudgeInput,
  type BatchJudgeResult,
} from './llm-judge.js';

// Reporter
export {
  generateMarkdownReport,
  generateSummaryJson,
  saveReports,
  loadBaselineReport,
  compareReports,
} from './reporter.js';
