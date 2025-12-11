/**
 * Evaluation Report Generator
 *
 * Generates human-readable markdown reports and JSON exports
 * from evaluation results.
 */

import { compareMetrics, formatDelta, formatLatency, formatMetric } from './metrics.js';
import type { AggregateMetrics, EvalCategory, EvalDifficulty, EvalReport } from './types.js';

// =============================================================================
// Markdown Report Generation
// =============================================================================

/**
 * Generate a markdown report from evaluation results
 */
export function generateMarkdownReport(report: EvalReport, baselineReport?: EvalReport): string {
  const lines: string[] = [];

  // Header
  lines.push('# RAG Evaluation Report');
  lines.push('');
  lines.push(`**Generated:** ${report.metadata.timestamp}`);
  lines.push(`**Report ID:** ${report.metadata.id}`);
  lines.push(`**Duration:** ${formatLatency(report.metadata.duration_ms)}`);
  lines.push(`**Queries Evaluated:** ${report.overall.count}`);
  lines.push('');

  // Configuration
  lines.push('## Configuration');
  lines.push('');
  lines.push('| Setting | Value |');
  lines.push('|---------|-------|');
  lines.push(`| Search Mode | ${report.metadata.config.searchMode} |`);
  lines.push(`| Reranking | ${report.metadata.config.rerank ? 'Enabled' : 'Disabled'} |`);
  lines.push(`| Top K | ${report.metadata.config.topK} |`);
  lines.push(`| Generation Eval | ${report.metadata.config.evaluateGeneration ? 'Yes' : 'No'} |`);
  lines.push('');

  // Overall Metrics
  lines.push('## Overall Metrics');
  lines.push('');
  lines.push(generateMetricsTable(report.overall, baselineReport?.overall));
  lines.push('');

  // Latency Stats
  lines.push('### Latency Distribution');
  lines.push('');
  lines.push('| Percentile | Latency |');
  lines.push('|------------|---------|');
  lines.push(`| P50 | ${formatLatency(report.overall.percentiles.latency_p50)} |`);
  lines.push(`| P95 | ${formatLatency(report.overall.percentiles.latency_p95)} |`);
  lines.push(`| P99 | ${formatLatency(report.overall.percentiles.latency_p99)} |`);
  lines.push('');

  // By Category
  lines.push('## Results by Category');
  lines.push('');

  const categories: EvalCategory[] = ['docs', 'code', 'mobile', 'general'];
  for (const category of categories) {
    const categoryMetrics = report.byCategory[category];
    if (categoryMetrics && categoryMetrics.count > 0) {
      lines.push(`### ${capitalizeFirst(category)} (${categoryMetrics.count} queries)`);
      lines.push('');
      lines.push(generateMetricsTable(categoryMetrics, baselineReport?.byCategory[category]));
      lines.push('');
    }
  }

  // By Difficulty
  lines.push('## Results by Difficulty');
  lines.push('');

  const difficulties: EvalDifficulty[] = ['easy', 'medium', 'hard'];
  for (const difficulty of difficulties) {
    const diffMetrics = report.byDifficulty[difficulty];
    if (diffMetrics && diffMetrics.count > 0) {
      lines.push(`### ${capitalizeFirst(difficulty)} (${diffMetrics.count} queries)`);
      lines.push('');
      lines.push(generateCompactMetricsTable(diffMetrics));
      lines.push('');
    }
  }

  // Failures
  if (
    report.failures.zeroHits.length > 0 ||
    report.failures.lowFaithfulness.length > 0 ||
    report.failures.highLatency.length > 0
  ) {
    lines.push('## Notable Failures');
    lines.push('');

    if (report.failures.zeroHits.length > 0) {
      lines.push(`### Zero Hits (${report.failures.zeroHits.length} queries)`);
      lines.push('');
      lines.push('Queries that returned no relevant documents:');
      lines.push('');
      for (const queryId of report.failures.zeroHits.slice(0, 10)) {
        const result = report.results.find((r) => r.queryId === queryId);
        if (result) {
          lines.push(`- **${queryId}**: "${result.query.slice(0, 80)}..."`);
        }
      }
      if (report.failures.zeroHits.length > 10) {
        lines.push(`- ... and ${report.failures.zeroHits.length - 10} more`);
      }
      lines.push('');
    }

    if (report.failures.lowFaithfulness.length > 0) {
      lines.push(`### Low Faithfulness (${report.failures.lowFaithfulness.length} queries)`);
      lines.push('');
      lines.push('Queries where the generated answer was not well-grounded in context:');
      lines.push('');
      for (const queryId of report.failures.lowFaithfulness.slice(0, 10)) {
        const result = report.results.find((r) => r.queryId === queryId);
        if (result?.generation) {
          lines.push(
            `- **${queryId}**: faithfulness=${formatMetric(result.generation.faithfulness)}`
          );
        }
      }
      lines.push('');
    }

    if (report.failures.highLatency.length > 0) {
      lines.push(`### High Latency (${report.failures.highLatency.length} queries)`);
      lines.push('');
      lines.push('Queries that took longer than 2 seconds:');
      lines.push('');
      for (const queryId of report.failures.highLatency.slice(0, 10)) {
        const result = report.results.find((r) => r.queryId === queryId);
        if (result) {
          lines.push(`- **${queryId}**: ${formatLatency(result.retrieval.latency_ms)}`);
        }
      }
      lines.push('');
    }
  }

  // Comparison with baseline
  if (report.comparison) {
    lines.push('## Baseline Comparison');
    lines.push('');
    lines.push(`Comparing against baseline: **${report.comparison.baselineId}**`);
    lines.push('');
    lines.push('| Metric | Delta | Status |');
    lines.push('|--------|-------|--------|');
    lines.push(
      `| MRR | ${formatDeltaWithSign(report.comparison.deltas.mrr)} | ${getStatusEmoji(report.comparison.deltas.mrr)} |`
    );
    lines.push(
      `| NDCG@5 | ${formatDeltaWithSign(report.comparison.deltas.ndcg_at_5)} | ${getStatusEmoji(report.comparison.deltas.ndcg_at_5)} |`
    );
    lines.push(
      `| Recall@5 | ${formatDeltaWithSign(report.comparison.deltas.recall_at_5)} | ${getStatusEmoji(report.comparison.deltas.recall_at_5)} |`
    );
    if (report.comparison.deltas.faithfulness !== undefined) {
      lines.push(
        `| Faithfulness | ${formatDeltaWithSign(report.comparison.deltas.faithfulness)} | ${getStatusEmoji(report.comparison.deltas.faithfulness)} |`
      );
    }
    lines.push('');

    if (report.comparison.improved.length > 0) {
      lines.push(`**Improved queries:** ${report.comparison.improved.length}`);
    }
    if (report.comparison.regressed.length > 0) {
      lines.push(`**Regressed queries:** ${report.comparison.regressed.length}`);
    }
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push(`*Generated by Synthesis RAG Evaluation Framework v${report.metadata.version}*`);

  return lines.join('\n');
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a metrics table
 */
function generateMetricsTable(metrics: AggregateMetrics, baseline?: AggregateMetrics): string {
  const lines: string[] = [];

  if (baseline) {
    lines.push('| Metric | Score | Baseline | Delta |');
    lines.push('|--------|-------|----------|-------|');
    lines.push(
      `| MRR | ${formatMetric(metrics.mean.mrr)} | ${formatMetric(baseline.mean.mrr)} | ${formatDelta(metrics.mean.mrr, baseline.mean.mrr)} |`
    );
    lines.push(
      `| NDCG@5 | ${formatMetric(metrics.mean.ndcg_at_5)} | ${formatMetric(baseline.mean.ndcg_at_5)} | ${formatDelta(metrics.mean.ndcg_at_5, baseline.mean.ndcg_at_5)} |`
    );
    lines.push(
      `| NDCG@10 | ${formatMetric(metrics.mean.ndcg_at_10)} | ${formatMetric(baseline.mean.ndcg_at_10)} | ${formatDelta(metrics.mean.ndcg_at_10, baseline.mean.ndcg_at_10)} |`
    );
    lines.push(
      `| Recall@3 | ${formatMetric(metrics.mean.recall_at_3)} | ${formatMetric(baseline.mean.recall_at_3)} | ${formatDelta(metrics.mean.recall_at_3, baseline.mean.recall_at_3)} |`
    );
    lines.push(
      `| Recall@5 | ${formatMetric(metrics.mean.recall_at_5)} | ${formatMetric(baseline.mean.recall_at_5)} | ${formatDelta(metrics.mean.recall_at_5, baseline.mean.recall_at_5)} |`
    );
    lines.push(
      `| Recall@10 | ${formatMetric(metrics.mean.recall_at_10)} | ${formatMetric(baseline.mean.recall_at_10)} | ${formatDelta(metrics.mean.recall_at_10, baseline.mean.recall_at_10)} |`
    );
    lines.push(
      `| Precision@5 | ${formatMetric(metrics.mean.precision_at_5)} | ${formatMetric(baseline.mean.precision_at_5)} | ${formatDelta(metrics.mean.precision_at_5, baseline.mean.precision_at_5)} |`
    );
    lines.push(
      `| Hit Rate | ${formatMetric(metrics.mean.hit_rate)} | ${formatMetric(baseline.mean.hit_rate)} | ${formatDelta(metrics.mean.hit_rate, baseline.mean.hit_rate)} |`
    );
    lines.push(
      `| Latency | ${formatLatency(metrics.mean.latency_ms)} | ${formatLatency(baseline.mean.latency_ms)} | ${(metrics.mean.latency_ms - baseline.mean.latency_ms).toFixed(0)}ms |`
    );

    // Generation metrics if available
    if (metrics.mean.faithfulness !== undefined && baseline.mean.faithfulness !== undefined) {
      lines.push(
        `| Faithfulness | ${formatMetric(metrics.mean.faithfulness)} | ${formatMetric(baseline.mean.faithfulness)} | ${formatDelta(metrics.mean.faithfulness, baseline.mean.faithfulness)} |`
      );
    }
    if (metrics.mean.relevancy !== undefined && baseline.mean.relevancy !== undefined) {
      lines.push(
        `| Relevancy | ${formatMetric(metrics.mean.relevancy)} | ${formatMetric(baseline.mean.relevancy)} | ${formatDelta(metrics.mean.relevancy, baseline.mean.relevancy)} |`
      );
    }
    if (metrics.mean.completeness !== undefined && baseline.mean.completeness !== undefined) {
      lines.push(
        `| Completeness | ${formatMetric(metrics.mean.completeness)} | ${formatMetric(baseline.mean.completeness)} | ${formatDelta(metrics.mean.completeness, baseline.mean.completeness)} |`
      );
    }
  } else {
    lines.push('| Metric | Score | Std Dev |');
    lines.push('|--------|-------|---------|');
    lines.push(`| MRR | ${formatMetric(metrics.mean.mrr)} | ${formatMetric(metrics.stddev.mrr)} |`);
    lines.push(
      `| NDCG@5 | ${formatMetric(metrics.mean.ndcg_at_5)} | ${formatMetric(metrics.stddev.ndcg_at_5)} |`
    );
    lines.push(`| NDCG@10 | ${formatMetric(metrics.mean.ndcg_at_10)} | - |`);
    lines.push(`| Recall@3 | ${formatMetric(metrics.mean.recall_at_3)} | - |`);
    lines.push(
      `| Recall@5 | ${formatMetric(metrics.mean.recall_at_5)} | ${formatMetric(metrics.stddev.recall_at_5)} |`
    );
    lines.push(`| Recall@10 | ${formatMetric(metrics.mean.recall_at_10)} | - |`);
    lines.push(`| Precision@5 | ${formatMetric(metrics.mean.precision_at_5)} | - |`);
    lines.push(`| Hit Rate | ${formatMetric(metrics.mean.hit_rate)} | - |`);
    lines.push(
      `| Latency | ${formatLatency(metrics.mean.latency_ms)} | ${formatLatency(metrics.stddev.latency_ms)} |`
    );

    // Generation metrics if available
    if (metrics.mean.faithfulness !== undefined) {
      lines.push(
        `| Faithfulness | ${formatMetric(metrics.mean.faithfulness)} | ${formatMetric(metrics.stddev.faithfulness ?? 0)} |`
      );
    }
    if (metrics.mean.relevancy !== undefined) {
      lines.push(
        `| Relevancy | ${formatMetric(metrics.mean.relevancy)} | ${formatMetric(metrics.stddev.relevancy ?? 0)} |`
      );
    }
    if (metrics.mean.completeness !== undefined) {
      lines.push(`| Completeness | ${formatMetric(metrics.mean.completeness)} | - |`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate a compact metrics table (for difficulty breakdowns)
 */
function generateCompactMetricsTable(metrics: AggregateMetrics): string {
  const lines: string[] = [];

  lines.push('| Metric | Score |');
  lines.push('|--------|-------|');
  lines.push(`| MRR | ${formatMetric(metrics.mean.mrr)} |`);
  lines.push(`| NDCG@5 | ${formatMetric(metrics.mean.ndcg_at_5)} |`);
  lines.push(`| Recall@5 | ${formatMetric(metrics.mean.recall_at_5)} |`);
  lines.push(`| Hit Rate | ${formatMetric(metrics.mean.hit_rate)} |`);
  lines.push(`| Latency | ${formatLatency(metrics.mean.latency_ms)} |`);

  return lines.join('\n');
}

/**
 * Format a delta with sign
 */
function formatDeltaWithSign(delta: number): string {
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(3)}`;
}

/**
 * Get status emoji based on delta
 */
function getStatusEmoji(delta: number): string {
  if (delta > 0.01) return ':white_check_mark:';
  if (delta < -0.01) return ':x:';
  return ':heavy_minus_sign:';
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// =============================================================================
// JSON Export
// =============================================================================

/**
 * Generate a summary JSON for quick parsing
 */
export function generateSummaryJson(report: EvalReport): object {
  return {
    id: report.metadata.id,
    timestamp: report.metadata.timestamp,
    config: {
      searchMode: report.metadata.config.searchMode,
      rerank: report.metadata.config.rerank,
      topK: report.metadata.config.topK,
    },
    overall: {
      count: report.overall.count,
      mrr: report.overall.mean.mrr,
      ndcg_at_5: report.overall.mean.ndcg_at_5,
      recall_at_5: report.overall.mean.recall_at_5,
      hit_rate: report.overall.mean.hit_rate,
      latency_ms: report.overall.mean.latency_ms,
      faithfulness: report.overall.mean.faithfulness,
      relevancy: report.overall.mean.relevancy,
    },
    failures: {
      zero_hits: report.failures.zeroHits.length,
      low_faithfulness: report.failures.lowFaithfulness.length,
      high_latency: report.failures.highLatency.length,
    },
  };
}

// =============================================================================
// File Output
// =============================================================================

/**
 * Save report to files (JSON + Markdown)
 */
export async function saveReports(
  report: EvalReport,
  outputDir: string,
  baselineReport?: EvalReport
): Promise<{ jsonPath: string; mdPath: string }> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Generate filename based on timestamp
  const date = new Date().toISOString().split('T')[0];
  const baseName = `eval-${date}-${report.metadata.id.slice(-6)}`;

  // Save JSON
  const jsonPath = path.join(outputDir, `${baseName}.json`);
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));

  // Save Markdown
  const mdPath = path.join(outputDir, `${baseName}.md`);
  const markdown = generateMarkdownReport(report, baselineReport);
  await fs.writeFile(mdPath, markdown);

  return { jsonPath, mdPath };
}

/**
 * Load a baseline report for comparison
 */
export async function loadBaselineReport(filePath: string): Promise<EvalReport> {
  const fs = await import('node:fs/promises');
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as EvalReport;
}

/**
 * Compare two reports and add comparison data
 */
export function compareReports(current: EvalReport, baseline: EvalReport): EvalReport {
  const improved: string[] = [];
  const regressed: string[] = [];

  // Compare individual query results
  for (const currentResult of current.results) {
    const baselineResult = baseline.results.find((r) => r.queryId === currentResult.queryId);
    if (baselineResult) {
      const mrrComparison = compareMetrics(
        currentResult.retrieval.mrr,
        baselineResult.retrieval.mrr
      );
      if (mrrComparison === 'improved') {
        improved.push(currentResult.queryId);
      } else if (mrrComparison === 'regressed') {
        regressed.push(currentResult.queryId);
      }
    }
  }

  return {
    ...current,
    comparison: {
      baselineId: baseline.metadata.id,
      deltas: {
        mrr: current.overall.mean.mrr - baseline.overall.mean.mrr,
        ndcg_at_5: current.overall.mean.ndcg_at_5 - baseline.overall.mean.ndcg_at_5,
        recall_at_5: current.overall.mean.recall_at_5 - baseline.overall.mean.recall_at_5,
        faithfulness:
          current.overall.mean.faithfulness !== undefined &&
          baseline.overall.mean.faithfulness !== undefined
            ? current.overall.mean.faithfulness - baseline.overall.mean.faithfulness
            : undefined,
      },
      improved,
      regressed,
    },
  };
}
