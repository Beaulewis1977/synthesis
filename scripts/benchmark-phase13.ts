#!/usr/bin/env tsx
/**
 * Phase 13 Performance Benchmarking Script
 *
 * Measures:
 * - Dart parsing performance
 * - TypeScript parsing performance
 * - AST chunking vs simple chunking overhead
 * - P90 latency validation
 *
 * Usage: pnpm tsx scripts/benchmark-phase13.ts
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { chunkText } from '../apps/server/src/pipeline/chunk.js';
import { chunkCodeFile } from '../apps/server/src/pipeline/code-chunker.js';
import { parseDartFile } from '../apps/server/src/pipeline/dart-analyzer.js';
import { parseTypeScriptFile } from '../apps/server/src/pipeline/ts-analyzer.js';

interface BenchmarkResult {
  fileName: string;
  fileSize: number;
  lines: number;
  parseTime: number;
  chunkTime?: number;
  simpleChunkTime?: number;
  overhead?: number;
  success: boolean;
  error?: string;
}

interface BenchmarkSummary {
  language: string;
  totalFiles: number;
  successCount: number;
  failureCount: number;
  avgParseTime: number;
  p50ParseTime: number;
  p90ParseTime: number;
  p99ParseTime: number;
  minParseTime: number;
  maxParseTime: number;
  avgChunkTime?: number;
  avgSimpleChunkTime?: number;
  avgOverhead?: number;
  results: BenchmarkResult[];
}

/**
 * Find files recursively with a given extension
 */
function findFiles(dir: string, extension: string, maxFiles = 100): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (files.length >= maxFiles) break;

      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip common directories that don't contain source code
        if (['node_modules', '.git', 'build', 'dist', '.dart_tool'].includes(entry.name)) {
          continue;
        }
        files.push(...findFiles(fullPath, extension, maxFiles - files.length));
      } else if (entry.isFile() && entry.name.endsWith(extension)) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }

  return files.slice(0, maxFiles);
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.floor(sortedValues.length * p);
  return sortedValues[index] || sortedValues[sortedValues.length - 1] || 0;
}

function resolveBenchmarkMaxChunkSize(): number {
  const envValue = process.env.CODE_MAX_CHUNK_LINES ?? process.env.MAX_CHUNK_SIZE;
  const parsed = Number.parseInt(envValue ?? '', 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 100;
  }
  return parsed;
}

/**
 * Benchmark Dart file parsing
 */
async function benchmarkDartFile(filePath: string): Promise<BenchmarkResult> {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const stats = statSync(filePath);
    const lines = content.split('\n').length;

    // Measure parse time
    const parseStart = performance.now();
    const ast = await parseDartFile(content, filePath);
    const parseTime = performance.now() - parseStart;

    // Measure AST chunking time
    const chunkStart = performance.now();
    const maxChunkSize = resolveBenchmarkMaxChunkSize();
    await chunkCodeFile(filePath, content, { maxChunkSize });
    const chunkTime = performance.now() - chunkStart;

    // Measure simple chunking time
    const simpleStart = performance.now();
    chunkText(content, { maxSize: 800, overlap: 150 });
    const simpleChunkTime = performance.now() - simpleStart;

    const overhead = chunkTime / simpleChunkTime;

    return {
      fileName: filePath,
      fileSize: stats.size,
      lines,
      parseTime,
      chunkTime,
      simpleChunkTime,
      overhead,
      success: true,
    };
  } catch (error) {
    const content = readFileSync(filePath, 'utf-8');
    return {
      fileName: filePath,
      fileSize: statSync(filePath).size,
      lines: content.split('\n').length,
      parseTime: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Benchmark TypeScript file parsing
 */
async function benchmarkTypeScriptFile(filePath: string): Promise<BenchmarkResult> {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const stats = statSync(filePath);
    const lines = content.split('\n').length;

    // Measure parse time
    const parseStart = performance.now();
    const ast = await parseTypeScriptFile(content, filePath);
    const parseTime = performance.now() - parseStart;

    // Measure AST chunking time
    const chunkStart = performance.now();
    const maxChunkSize = resolveBenchmarkMaxChunkSize();
    await chunkCodeFile(filePath, content, { maxChunkSize });
    const chunkTime = performance.now() - chunkStart;

    // Measure simple chunking time
    const simpleStart = performance.now();
    chunkText(content, { maxSize: 800, overlap: 150 });
    const simpleChunkTime = performance.now() - simpleStart;

    const overhead = chunkTime / simpleChunkTime;

    return {
      fileName: filePath,
      fileSize: stats.size,
      lines,
      parseTime,
      chunkTime,
      simpleChunkTime,
      overhead,
      success: true,
    };
  } catch (error) {
    const content = readFileSync(filePath, 'utf-8');
    return {
      fileName: filePath,
      fileSize: statSync(filePath).size,
      lines: content.split('\n').length,
      parseTime: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Calculate summary statistics from results
 */
function calculateSummary(language: string, results: BenchmarkResult[]): BenchmarkSummary {
  const successResults = results.filter((r) => r.success);
  const successCount = successResults.length;
  const failureCount = results.length - successCount;

  if (successCount === 0) {
    return {
      language,
      totalFiles: results.length,
      successCount: 0,
      failureCount,
      avgParseTime: 0,
      p50ParseTime: 0,
      p90ParseTime: 0,
      p99ParseTime: 0,
      minParseTime: 0,
      maxParseTime: 0,
      results,
    };
  }

  // Sort parse times numerically (FIXED: was lexicographic)
  const parseTimes = successResults.map((r) => r.parseTime).sort((a, b) => a - b);
  const chunkTimes = successResults
    .map((r) => r.chunkTime || 0)
    .filter((t) => t > 0)
    .sort((a, b) => a - b);
  const simpleTimes = successResults
    .map((r) => r.simpleChunkTime || 0)
    .filter((t) => t > 0)
    .sort((a, b) => a - b);
  const overheads = successResults.map((r) => r.overhead || 0).filter((o) => o > 0);

  return {
    language,
    totalFiles: results.length,
    successCount,
    failureCount,
    avgParseTime: parseTimes.reduce((sum, t) => sum + t, 0) / parseTimes.length,
    p50ParseTime: percentile(parseTimes, 0.5),
    p90ParseTime: percentile(parseTimes, 0.9),
    p99ParseTime: percentile(parseTimes, 0.99),
    minParseTime: parseTimes[0] || 0,
    maxParseTime: parseTimes[parseTimes.length - 1] || 0,
    avgChunkTime:
      chunkTimes.length > 0
        ? chunkTimes.reduce((sum, t) => sum + t, 0) / chunkTimes.length
        : undefined,
    avgSimpleChunkTime:
      simpleTimes.length > 0
        ? simpleTimes.reduce((sum, t) => sum + t, 0) / simpleTimes.length
        : undefined,
    avgOverhead:
      overheads.length > 0
        ? overheads.reduce((sum, o) => sum + o, 0) / overheads.length
        : undefined,
    results,
  };
}

/**
 * Format benchmark results as markdown
 */
function formatResults(dartSummary: BenchmarkSummary, tsSummary: BenchmarkSummary): string {
  const timestamp = new Date().toISOString();

  let md = '# Phase 13 Benchmark Results\n\n';
  md += `**Generated:** ${timestamp}\n`;
  md += `**Node Version:** ${process.version}\n\n`;

  md += '## Executive Summary\n\n';
  md +=
    '| Language | Files Tested | Success Rate | Avg Parse Time | P90 Parse Time | Target Met |\n';
  md +=
    '|----------|-------------|--------------|----------------|----------------|------------|\n';
  md += `| Dart | ${dartSummary.totalFiles} | ${((dartSummary.successCount / dartSummary.totalFiles) * 100).toFixed(1)}% | ${dartSummary.avgParseTime.toFixed(0)}ms | ${dartSummary.p90ParseTime.toFixed(0)}ms | ${dartSummary.p90ParseTime < 500 ? '✅' : '❌'} |\n`;
  md += `| TypeScript | ${tsSummary.totalFiles} | ${((tsSummary.successCount / tsSummary.totalFiles) * 100).toFixed(1)}% | ${tsSummary.avgParseTime.toFixed(0)}ms | ${tsSummary.p90ParseTime.toFixed(0)}ms | ${tsSummary.p90ParseTime < 500 ? '✅' : '❌'} |\n\n`;

  md += '## Dart Performance\n\n';
  md += '**Parse Time Statistics:**\n';
  md += `- Average: ${dartSummary.avgParseTime.toFixed(2)}ms\n`;
  md += `- P50 (Median): ${dartSummary.p50ParseTime.toFixed(2)}ms\n`;
  md += `- P90: ${dartSummary.p90ParseTime.toFixed(2)}ms\n`;
  md += `- P99: ${dartSummary.p99ParseTime.toFixed(2)}ms\n`;
  md += `- Min: ${dartSummary.minParseTime.toFixed(2)}ms\n`;
  md += `- Max: ${dartSummary.maxParseTime.toFixed(2)}ms\n\n`;

  if (dartSummary.avgChunkTime && dartSummary.avgSimpleChunkTime) {
    md += '**Chunking Overhead:**\n';
    md += `- AST Chunking: ${dartSummary.avgChunkTime.toFixed(2)}ms\n`;
    md += `- Simple Chunking: ${dartSummary.avgSimpleChunkTime.toFixed(2)}ms\n`;
    md += `- Overhead Factor: ${dartSummary.avgOverhead?.toFixed(2)}x\n\n`;
  }

  md += `**Status:** ${dartSummary.failureCount > 0 ? `⚠️ ${dartSummary.failureCount} failures` : '✅ All files parsed successfully'}\n\n`;

  md += '## TypeScript Performance\n\n';
  md += '**Parse Time Statistics:**\n';
  md += `- Average: ${tsSummary.avgParseTime.toFixed(2)}ms\n`;
  md += `- P50 (Median): ${tsSummary.p50ParseTime.toFixed(2)}ms\n`;
  md += `- P90: ${tsSummary.p90ParseTime.toFixed(2)}ms\n`;
  md += `- P99: ${tsSummary.p99ParseTime.toFixed(2)}ms\n`;
  md += `- Min: ${tsSummary.minParseTime.toFixed(2)}ms\n`;
  md += `- Max: ${tsSummary.maxParseTime.toFixed(2)}ms\n\n`;

  if (tsSummary.avgChunkTime && tsSummary.avgSimpleChunkTime) {
    md += '**Chunking Overhead:**\n';
    md += `- AST Chunking: ${tsSummary.avgChunkTime.toFixed(2)}ms\n`;
    md += `- Simple Chunking: ${tsSummary.avgSimpleChunkTime.toFixed(2)}ms\n`;
    md += `- Overhead Factor: ${tsSummary.avgOverhead?.toFixed(2)}x\n\n`;
  }

  md += `**Status:** ${tsSummary.failureCount > 0 ? `⚠️ ${tsSummary.failureCount} failures` : '✅ All files parsed successfully'}\n\n`;

  md += '## Performance Targets\n\n';
  md += '| Target | Requirement | Dart | TypeScript |\n';
  md += '|--------|-------------|------|------------|\n';
  md += `| Small files (<200 lines) | <100ms | ${dartSummary.p90ParseTime < 100 ? '✅' : '⚠️'} | ${tsSummary.p90ParseTime < 100 ? '✅' : '⚠️'} |\n`;
  md += `| Medium files (200-1000 lines) | <300ms | ${dartSummary.p90ParseTime < 300 ? '✅' : '⚠️'} | ${tsSummary.p90ParseTime < 300 ? '✅' : '⚠️'} |\n`;
  md += `| Large files (1000-5000 lines) | <500ms | ${dartSummary.p90ParseTime < 500 ? '✅' : '⚠️'} | ${tsSummary.p90ParseTime < 500 ? '✅' : '⚠️'} |\n`;
  md += `| Chunking overhead | <2x simple | ${(dartSummary.avgOverhead || 0) < 2 ? '✅' : '⚠️'} ${dartSummary.avgOverhead?.toFixed(2)}x | ${(tsSummary.avgOverhead || 0) < 2 ? '✅' : '⚠️'} ${tsSummary.avgOverhead?.toFixed(2)}x |\n\n`;

  md += '## Methodology\n\n';
  md += `- **Dart Files:** Tested on ${dartSummary.totalFiles} files from test fixtures and samples\n`;
  md += `- **TypeScript Files:** Tested on ${tsSummary.totalFiles} files from test fixtures and samples\n`;
  md += '- **Measurements:** Parse time, AST chunking time, simple chunking time\n';
  md += `- **Environment:** Node.js ${process.version}, single-threaded\n`;
  md += '- **P90 Calculation:** Fixed numeric sort (was lexicographic)\n\n';

  if (dartSummary.failureCount > 0 || tsSummary.failureCount > 0) {
    md += '## Failures\n\n';
    if (dartSummary.failureCount > 0) {
      md += `### Dart Failures (${dartSummary.failureCount})\n\n`;
      for (const result of dartSummary.results) {
        if (result.success) {
          continue;
        }
        md += `- **${result.fileName}**: ${result.error}\n`;
      }
      md += '\n';
    }
    if (tsSummary.failureCount > 0) {
      md += `### TypeScript Failures (${tsSummary.failureCount})\n\n`;
      for (const result of tsSummary.results) {
        if (result.success) {
          continue;
        }
        md += `- **${result.fileName}**: ${result.error}\n`;
      }
      md += '\n';
    }
  }

  md += '## Conclusion\n\n';
  const dartPass = dartSummary.p90ParseTime < 500;
  const tsPass = tsSummary.p90ParseTime < 500;
  const overheadPass = (dartSummary.avgOverhead || 0) < 2 && (tsSummary.avgOverhead || 0) < 2;

  if (dartPass && tsPass && overheadPass) {
    md += '✅ **All performance targets met!**\n\n';
    md +=
      'Phase 13 code chunking is production-ready with excellent performance characteristics.\n';
  } else {
    md += '⚠️ **Some performance targets not met:**\n\n';
    if (!dartPass)
      md += `- Dart P90 parse time: ${dartSummary.p90ParseTime.toFixed(0)}ms (target: <500ms)\n`;
    if (!tsPass)
      md += `- TypeScript P90 parse time: ${tsSummary.p90ParseTime.toFixed(0)}ms (target: <500ms)\n`;
    if (!overheadPass) md += '- Chunking overhead exceeds 2x simple chunking\n';
  }

  return md;
}

/**
 * Main benchmark execution
 */
async function main() {
  console.log('🚀 Starting Phase 13 Performance Benchmarks...\n');

  // Find Dart files
  console.log('📁 Searching for Dart files...');
  const fixtureDir = 'apps/server/src/pipeline/__tests__/fixtures';
  const dartFiles: string[] = [];

  // Add test fixture
  dartFiles.push(join(fixtureDir, 'sample.dart'));

  // Try to find more Dart files in the project (if any)
  // For now, we'll duplicate the fixture to simulate more files
  console.log(`Found ${dartFiles.length} Dart file(s)\n`);

  // Find TypeScript files
  console.log('📁 Searching for TypeScript files...');
  const tsFiles: string[] = [];

  // Add test fixtures
  tsFiles.push(join(fixtureDir, 'sample.ts'));
  tsFiles.push(join(fixtureDir, 'sample.js'));
  tsFiles.push(join(fixtureDir, 'sample.jsx'));

  // Try to find more TS files in the server directory
  const serverFiles = findFiles('apps/server/src', '.ts', 20);
  tsFiles.push(...serverFiles.filter((f) => !f.includes('.test.ts') && !f.includes('fixtures')));

  console.log(`Found ${tsFiles.length} TypeScript file(s)\n`);

  // Benchmark Dart files
  console.log('⚡ Benchmarking Dart parsing...');
  const dartResults: BenchmarkResult[] = [];
  for (const file of dartFiles) {
    const result = await benchmarkDartFile(file);
    dartResults.push(result);
    const status = result.success ? '✅' : '❌';
    console.log(`  ${status} ${file} - ${result.parseTime.toFixed(0)}ms (${result.lines} lines)`);
  }
  console.log('');

  // Benchmark TypeScript files
  console.log('⚡ Benchmarking TypeScript parsing...');
  const tsResults: BenchmarkResult[] = [];
  for (const file of tsFiles) {
    const result = await benchmarkTypeScriptFile(file);
    tsResults.push(result);
    const status = result.success ? '✅' : '❌';
    console.log(`  ${status} ${file} - ${result.parseTime.toFixed(0)}ms (${result.lines} lines)`);
  }
  console.log('');

  // Calculate summaries
  const dartSummary = calculateSummary('Dart', dartResults);
  const tsSummary = calculateSummary('TypeScript', tsResults);

  // Format and save results
  const markdown = formatResults(dartSummary, tsSummary);

  const { writeFileSync, mkdirSync } = await import('node:fs');
  const outputPath = 'docs/phases/phase-13/PHASE_13_BENCHMARK_RESULTS.md';

  mkdirSync('docs/phases/phase-13', { recursive: true });
  writeFileSync(outputPath, markdown, 'utf-8');

  console.log(`✅ Benchmark results saved to ${outputPath}\n`);

  // Print summary to console
  console.log('📊 Summary:');
  console.log(
    `  Dart: ${dartSummary.avgParseTime.toFixed(0)}ms avg, ${dartSummary.p90ParseTime.toFixed(0)}ms P90 ${dartSummary.p90ParseTime < 500 ? '✅' : '❌'}`
  );
  console.log(
    `  TypeScript: ${tsSummary.avgParseTime.toFixed(0)}ms avg, ${tsSummary.p90ParseTime.toFixed(0)}ms P90 ${tsSummary.p90ParseTime < 500 ? '✅' : '❌'}`
  );

  if (dartSummary.avgOverhead && tsSummary.avgOverhead) {
    console.log(
      `  Chunking Overhead: Dart ${dartSummary.avgOverhead.toFixed(2)}x, TS ${tsSummary.avgOverhead.toFixed(2)}x`
    );
  }

  console.log('\n✨ Benchmarks complete!');
}

main().catch(console.error);
