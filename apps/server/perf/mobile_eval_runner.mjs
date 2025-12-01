#!/usr/bin/env node
/**
 * Mobile Feature Recipes Evaluation Runner
 *
 * Runs golden tasks against the search API to evaluate the quality of
 * mobile feature recipe retrieval. Generates a markdown report with
 * pass/fail status and coverage metrics.
 *
 * Usage:
 *   node mobile_eval_runner.mjs [options]
 *
 * Options:
 *   --collection-id <uuid>  Override the collection ID from config
 *   --base-url <url>        Override the base URL (default: http://localhost:3333)
 *   --dry-run               Print tasks without executing
 *   --output <file>         Output file path (default: timestamped)
 *   --verbose               Print detailed results
 *   --help                  Show help
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// Configuration & CLI Parsing
// ============================================================================

function parseArgs(args) {
  const options = {
    collectionId: null,
    baseUrl: null,
    dryRun: false,
    output: null,
    verbose: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--collection-id':
        if (i + 1 >= args.length) throw new Error('--collection-id requires a value');
        options.collectionId = args[++i];
        break;
      case '--base-url':
        if (i + 1 >= args.length) throw new Error('--base-url requires a value');
        options.baseUrl = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--output':
        if (i + 1 >= args.length) throw new Error('--output requires a value');
        options.output = args[++i];
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Mobile Feature Recipes Evaluation Runner

Runs golden tasks against the search API to evaluate the quality of
mobile feature recipe retrieval. Generates a markdown report with
pass/fail status and coverage metrics.

Usage:
  node mobile_eval_runner.mjs [options]

Options:
  --collection-id <uuid>  Override the collection ID from config
  --base-url <url>        Override the base URL (default: http://localhost:3333)
  --dry-run               Print tasks without executing
  --output <file>         Output file path (default: timestamped)
  --verbose               Print detailed results
  --help, -h              Show this help message

Examples:
  node mobile_eval_runner.mjs
  node mobile_eval_runner.mjs --verbose
  node mobile_eval_runner.mjs --collection-id abc-123 --base-url http://prod:3333
  node mobile_eval_runner.mjs --dry-run
`);
}

function loadConfig(options) {
  const configPath = join(__dirname, 'mobile_eval_tasks.json');

  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const config = JSON.parse(readFileSync(configPath, 'utf8'));

  // Apply overrides in order: config < env < CLI
  return {
    ...config,
    collectionId: options.collectionId || process.env.EVAL_COLLECTION_ID || config.collectionId,
    baseUrl:
      options.baseUrl || process.env.EVAL_BASE_URL || config.baseUrl || 'http://localhost:3333',
  };
}

// ============================================================================
// API Calls
// ============================================================================

/**
 * Maps MCP tool name to search API parameters
 */
function buildSearchParams(task, config) {
  const baseParams = {
    collection_id: config.collectionId,
    top_k: config.topK || 10,
  };

  switch (task.mcpTool) {
    case 'search_mobile_docs':
      return {
        ...baseParams,
        query: task.params.query,
        feature_tags: task.params.featureTags,
        platform: task.params.platform,
        tech_stack: task.params.framework ? [task.params.framework] : undefined,
      };

    case 'find_code_examples':
      return {
        ...baseParams,
        query: task.params.query,
        feature_tags: task.params.featureTags,
        usage_tier: 'example',
        tech_stack: task.params.framework ? [task.params.framework] : undefined,
      };

    case 'get_feature_recipe':
      // get_feature_recipe constructs query from feature tags
      return {
        ...baseParams,
        query: `${task.params.featureTags?.join(' ') || 'feature'} implementation guide`.trim(),
        feature_tags: task.params.featureTags,
        usage_tier: 'recipe',
        tech_stack: task.params.framework ? [task.params.framework] : undefined,
      };

    default:
      throw new Error(`Unknown MCP tool: ${task.mcpTool}`);
  }
}

async function callSearchAPI(config, params) {
  const url = `${config.baseUrl}/api/search`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Search API error (${response.status}): ${error}`);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Search API request timed out after 30s');
    }
    throw error;
  }
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validates search results against task expectations
 * @returns {Object} { passed: boolean, checks: CheckResult[], score: number }
 */
function validateExpectations(task, response) {
  const checks = [];
  const expectations = task.expectations || {};
  const results = response.results || [];

  // Check 1: Minimum results
  if (expectations.minResults !== undefined) {
    const passed = results.length >= expectations.minResults;
    checks.push({
      name: 'minResults',
      passed,
      expected: expectations.minResults,
      actual: results.length,
      message: passed
        ? `Got ${results.length} results (min: ${expectations.minResults})`
        : `Expected at least ${expectations.minResults} results, got ${results.length}`,
    });
  }

  // Check 2: Allow empty results (for edge cases)
  if (expectations.allowEmptyResults && results.length === 0) {
    checks.push({
      name: 'allowEmptyResults',
      passed: true,
      expected: 'empty results allowed',
      actual: 0,
      message: 'Empty results expected and received',
    });
  }

  // Check 3: Required usage tiers present in results
  if (expectations.requiredUsageTiers?.length > 0 && results.length > 0) {
    const foundTiers = new Set();
    for (const result of results) {
      const tier = result.metadata?.usage_tier;
      if (tier) foundTiers.add(tier);
    }

    const requiredTiers = expectations.requiredUsageTiers;
    const hasAtLeastOne = requiredTiers.some((tier) => foundTiers.has(tier));

    checks.push({
      name: 'requiredUsageTiers',
      passed: hasAtLeastOne,
      expected: requiredTiers,
      actual: [...foundTiers],
      message: hasAtLeastOne
        ? `Found usage tier(s): ${[...foundTiers].join(', ')}`
        : `Missing required usage tiers. Expected one of: ${requiredTiers.join(', ')}, found: ${[...foundTiers].join(', ') || 'none'}`,
    });
  }

  // Check 4: Required feature tags present in results
  if (expectations.requiredFeatureTags?.length > 0 && results.length > 0) {
    const foundTags = new Set();
    for (const result of results) {
      const tags = result.metadata?.feature_tags || [];
      for (const tag of tags) foundTags.add(tag);
    }

    const requiredTags = expectations.requiredFeatureTags;
    const hasAtLeastOne = requiredTags.some((tag) => foundTags.has(tag));

    checks.push({
      name: 'requiredFeatureTags',
      passed: hasAtLeastOne,
      expected: requiredTags,
      actual: [...foundTags],
      message: hasAtLeastOne
        ? `Found feature tag(s): ${[...foundTags].join(', ')}`
        : `Missing required feature tags. Expected one of: ${requiredTags.join(', ')}, found: ${[...foundTags].join(', ') || 'none'}`,
    });
  }

  // Check 5: Expected document patterns (case-insensitive substring match)
  if (expectations.expectedDocPatterns?.length > 0 && results.length > 0) {
    const patterns = expectations.expectedDocPatterns;
    const matchedPatterns = [];

    for (const pattern of patterns) {
      const patternLower = pattern.toLowerCase();
      const found = results.some((r) => {
        // Support both camelCase (docTitle, text) and snake_case (doc_title, snippet)
        const title = (r.docTitle || r.doc_title || '').toLowerCase();
        const text = (r.text || r.snippet || '').toLowerCase();
        return title.includes(patternLower) || text.includes(patternLower);
      });
      if (found) matchedPatterns.push(pattern);
    }

    // Require at least half the patterns to match
    const threshold = Math.ceil(patterns.length / 2);
    const passed = matchedPatterns.length >= threshold;

    checks.push({
      name: 'expectedDocPatterns',
      passed,
      expected: `${threshold}+ of [${patterns.join(', ')}]`,
      actual: matchedPatterns,
      message: passed
        ? `Matched patterns: ${matchedPatterns.join(', ')}`
        : `Only matched ${matchedPatterns.length}/${patterns.length} patterns: ${matchedPatterns.join(', ') || 'none'}`,
    });
  }

  // Check 6: Verify metadata is present
  if (expectations.verifyMetadataPresent && results.length > 0) {
    const hasMetadata = results.every((r) => r.metadata && Object.keys(r.metadata).length > 0);

    checks.push({
      name: 'verifyMetadataPresent',
      passed: hasMetadata,
      expected: 'metadata on all results',
      actual: hasMetadata ? 'present' : 'missing on some results',
      message: hasMetadata ? 'All results have metadata' : 'Some results missing metadata',
    });
  }

  // Calculate overall pass/fail
  const passedChecks = checks.filter((c) => c.passed).length;
  const totalChecks = checks.length;
  const passed = totalChecks === 0 || passedChecks === totalChecks;
  const score = totalChecks > 0 ? passedChecks / totalChecks : 1;

  return { passed, checks, score, passedChecks, totalChecks };
}

// ============================================================================
// Evaluation Runner
// ============================================================================

async function runTask(task, config, verbose) {
  const startTime = Date.now();

  try {
    const params = buildSearchParams(task, config);
    const response = await callSearchAPI(config, params);
    const validation = validateExpectations(task, response);
    const elapsedMs = Date.now() - startTime;

    return {
      task,
      params,
      response: {
        totalResults: response.totalResults || response.results?.length || 0,
        searchTimeMs: response.searchTimeMs,
        results: verbose
          ? response.results
          : response.results?.slice(0, 3).map((r) => ({
              docTitle: r.docTitle,
              similarity: r.similarity,
              metadata: r.metadata,
            })),
      },
      validation,
      elapsedMs,
      error: null,
    };
  } catch (error) {
    return {
      task,
      params: null,
      response: null,
      validation: { passed: false, checks: [], score: 0 },
      elapsedMs: Date.now() - startTime,
      error: error.message,
    };
  }
}

async function runEvaluation(config, options) {
  const results = [];
  const tasks = config.tasks || [];

  for (const task of tasks) {
    process.stdout.write(`  [${task.id}] ${task.description}... `);

    if (options.dryRun) {
      results.push({ task, dryRun: true });
      continue;
    }

    const result = await runTask(task, config, options.verbose);

    if (result.error) {
      process.stdout.write('❌ ERROR\n');
    } else if (result.validation.passed) {
      process.stdout.write('✅ PASS\n');
    } else {
      process.stdout.write('❌ FAIL\n');
    }

    results.push(result);
  }

  return results;
}

// ============================================================================
// Report Generation
// ============================================================================

function generateReport(config, results, options) {
  const timestamp = new Date().toISOString();
  const passed = results.filter((r) => r.validation?.passed).length;
  const failed = results.filter((r) => r.validation && !r.validation.passed).length;
  const errors = results.filter((r) => r.error).length;
  const total = results.length;
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;

  // Group by category
  const byCategory = {};
  for (const r of results) {
    const cat = r.task.category || 'uncategorized';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(r);
  }

  let report = `# Mobile Feature Recipes Evaluation Report

**Generated:** ${timestamp}
**Collection ID:** \`${config.collectionId}\`
**Base URL:** ${config.baseUrl}
**Tasks:** ${total}

## Summary

| Metric | Value |
|--------|-------|
| Total Tasks | ${total} |
| Passed | ${passed} |
| Failed | ${failed} |
| Errors | ${errors} |
| **Pass Rate** | **${passRate}%** |

## Results by Category

`;

  for (const [category, categoryResults] of Object.entries(byCategory)) {
    const catPassed = categoryResults.filter((r) => r.validation?.passed).length;
    const catTotal = categoryResults.length;

    report += `### ${category} (${catPassed}/${catTotal})\n\n`;
    report += '| Task ID | Description | MCP Tool | Status | Score |\n';
    report += '|---------|-------------|----------|--------|-------|\n';

    for (const r of categoryResults) {
      const status = r.error ? 'ERROR' : r.validation?.passed ? 'PASS' : 'FAIL';
      const score = r.validation
        ? `${r.validation.passedChecks}/${r.validation.totalChecks}`
        : 'N/A';
      report += `| ${r.task.id} | ${r.task.description} | ${r.task.mcpTool} | ${status} | ${score} |\n`;
    }

    report += '\n';
  }

  // Detailed results for failures
  const failures = results.filter((r) => r.validation && !r.validation.passed);
  if (failures.length > 0) {
    report += '## Failed Tasks Details\n\n';

    for (const r of failures) {
      report += `### ${r.task.id}: ${r.task.description}\n\n`;
      report += `**MCP Tool:** ${r.task.mcpTool}\n`;
      report += `**Results Found:** ${r.response?.totalResults || 0}\n\n`;

      report += '**Checks:**\n';
      for (const check of r.validation.checks) {
        const icon = check.passed ? '' : '';
        report += `- ${icon} **${check.name}:** ${check.message}\n`;
      }

      report += '\n';
    }
  }

  // Error details
  const errorResults = results.filter((r) => r.error);
  if (errorResults.length > 0) {
    report += '## Errors\n\n';

    for (const r of errorResults) {
      report += `### ${r.task.id}: ${r.task.description}\n\n`;
      report += `\`\`\`\n${r.error}\n\`\`\`\n\n`;
    }
  }

  report += '---\n\n_Report generated by mobile_eval_runner.mjs_\n';

  return report;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  try {
    const config = loadConfig(options);

    const results = await runEvaluation(config, options);

    if (options.dryRun) {
      process.exit(0);
    }

    const report = generateReport(config, results, options);

    // Write report
    const outputPath =
      options.output ||
      join(__dirname, `mobile_eval_results_${new Date().toISOString().replace(/[:.]/g, '-')}.md`);
    writeFileSync(outputPath, report);

    // Summary
    const passed = results.filter((r) => r.validation?.passed).length;
    const total = results.length;

    // Exit with error code if any failures
    process.exit(passed === total ? 0 : 1);
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    process.exit(1);
  }
}

main();
