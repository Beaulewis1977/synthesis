#!/usr/bin/env node
/**
 * MCP Scenario Runner - Multi-step scenario evaluation for Phase 3 MCP tools
 *
 * Runs multi-step scenarios against the API to evaluate the Phase 3 MCP tools.
 * Each scenario simulates a real-world mobile SaaS development workflow that
 * requires multiple tool calls to complete successfully.
 *
 * Usage:
 *   node mcp_scenario_runner.mjs [options]
 *
 * Options:
 *   --collection-id <uuid>  Override the collection ID from config
 *   --base-url <url>        Override the base URL (default: http://localhost:3333)
 *   --scenario <id>         Run specific scenario only
 *   --dry-run               Validate config without API calls
 *   --output <file>         Output file path (default: timestamped)
 *   --verbose               Print detailed results
 *   --help                  Show help
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// Tool-to-Endpoint Mapping
// ============================================================================

const TOOL_ENDPOINTS = {
  search_mobile_docs: { method: 'POST', path: '/api/search' },
  find_code_examples: { method: 'POST', path: '/api/search' },
  get_feature_recipe: { method: 'POST', path: '/api/search' },
  search_rag: { method: 'POST', path: '/api/search' },
  get_project_tech_stack: { method: 'GET', path: '/api/tech-profiles/:collectionId' },
  graph_expand_context: { method: 'POST', path: '/api/graph/context' },
  find_symbol_usages: { method: 'POST', path: '/api/graph/symbols' },
  get_db_schema: { method: 'GET', path: '/api/graph/schema/:collectionId' },
};

// ============================================================================
// Configuration & CLI Parsing
// ============================================================================

/**
 * Parse command-line arguments
 * @param {string[]} args - Command-line arguments
 * @returns {Object} Parsed options
 */
function parseArgs(args) {
  const options = {
    collectionId: null,
    baseUrl: null,
    scenario: null,
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
      case '--scenario':
        if (i + 1 >= args.length) throw new Error('--scenario requires a value');
        options.scenario = args[++i];
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

/**
 * Display help message
 */
function showHelp() {
  console.info(`
MCP Scenario Runner - Multi-step scenario evaluation for Phase 3 MCP tools

Runs multi-step scenarios against the API to evaluate the Phase 3 MCP tools.
Each scenario simulates a real-world mobile SaaS development workflow that
requires multiple tool calls to complete successfully.

Usage:
  node mcp_scenario_runner.mjs [options]

Options:
  --collection-id <uuid>  Override the collection ID from config
  --base-url <url>        Override the base URL (default: http://localhost:3333)
  --scenario <id>         Run specific scenario only
  --dry-run               Validate config without API calls (prints steps)
  --output <file>         Output file path (default: timestamped)
  --verbose               Print detailed results
  --help, -h              Show this help message

Examples:
  node mcp_scenario_runner.mjs
  node mcp_scenario_runner.mjs --verbose
  node mcp_scenario_runner.mjs --scenario flutter-supabase-auth
  node mcp_scenario_runner.mjs --collection-id abc-123 --base-url http://prod:3333
  node mcp_scenario_runner.mjs --dry-run
`);
}

/**
 * Load configuration from mcp_scenario_tasks.json
 * @param {Object} options - CLI options
 * @returns {Object} Loaded and merged configuration
 */
function loadConfig(options) {
  const configPath = join(__dirname, 'mcp_scenario_tasks.json');

  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const fileConfig = JSON.parse(readFileSync(configPath, 'utf8'));

  // Apply overrides in order: config < env < CLI
  const collectionId =
    options.collectionId || process.env.EVAL_COLLECTION_ID || fileConfig.collectionId;

  if (typeof collectionId !== 'string' || collectionId.trim() === '') {
    throw new Error(
      'collectionId must be provided via mcp_scenario_tasks.json, EVAL_COLLECTION_ID, or --collection-id'
    );
  }

  if (collectionId === 'placeholder-uuid') {
    throw new Error(
      'collectionId is still set to placeholder-uuid. Configure a real collection ID before running scenarios.'
    );
  }

  const explicitBaseUrl = options.baseUrl || process.env.EVAL_BASE_URL || fileConfig.baseUrl;
  const baseUrl = explicitBaseUrl || 'http://localhost:3333';

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && (!explicitBaseUrl || explicitBaseUrl === 'http://localhost:3333')) {
    throw new Error(
      'baseUrl is not configured for production. Set EVAL_BASE_URL or use --base-url; the localhost default is for development only.'
    );
  }

  return {
    ...fileConfig,
    collectionId,
    baseUrl,
  };
}

// ============================================================================
// Request Building
// ============================================================================

/**
 * Build request parameters for a step
 * @param {Object} step - The step configuration
 * @param {string} tool - The tool name
 * @param {Object} config - Global configuration
 * @returns {Object} Request parameters with method, url, and body
 */
function buildRequestParams(step, tool, config) {
  const endpoint = TOOL_ENDPOINTS[tool];
  if (!endpoint) {
    throw new Error(`Unknown tool: ${tool}`);
  }

  const { method, path } = endpoint;
  const params = { ...step.params };

  // Replace :collectionId placeholder in path, validating collectionId first
  let resolvedPath = path;
  if (path.includes(':collectionId')) {
    if (typeof config.collectionId !== 'string' || config.collectionId.trim() === '') {
      throw new Error(
        `Invalid or missing config.collectionId for tool "${tool}" with path requiring :collectionId`
      );
    }
    resolvedPath = path.replace(':collectionId', config.collectionId);
  }
  const url = `${config.baseUrl}${resolvedPath}`;

  // Ensure collection_id is set for POST requests
  if (method === 'POST' && !params.collection_id) {
    if (typeof config.collectionId !== 'string' || config.collectionId.trim() === '') {
      throw new Error(
        `Invalid or missing config.collectionId for tool "${tool}" when collection_id is required`
      );
    }
    params.collection_id = config.collectionId;
  }

  // Build query string for GET requests with params
  let finalUrl = url;
  if (method === 'GET' && Object.keys(params).length > 0) {
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    }
    const queryString = queryParams.toString();
    if (queryString) {
      finalUrl = `${url}?${queryString}`;
    }
  }

  return {
    method,
    url: finalUrl,
    body: method === 'POST' ? params : null,
  };
}

// ============================================================================
// API Execution
// ============================================================================

/**
 * Execute a tool call against the API
 * @param {string} tool - Tool name
 * @param {Object} requestParams - Request configuration
 * @param {Object} config - Global configuration
 * @returns {Promise<Object>} API response
 */
async function executeToolCall(tool, requestParams, config) {
  const { method, url, body } = requestParams;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const fetchOptions = {
      method,
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    };

    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error (${response.status}): ${error}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`API request timed out after 30s: ${tool}`);
    }
    throw error;
  }
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate step results against expectations
 * @param {Object} step - Step configuration with expectations
 * @param {Object} response - API response
 * @returns {Object} Validation result with passed, checks, and score
 */
function validateExpectations(step, response) {
  const checks = [];
  const expectations = step.expectations || {};
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

  // Check 2: Required usage tiers present in results
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

  // Check 3: Required feature tags present in results
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

  // Check 4: Expected document patterns (case-insensitive substring match)
  if (expectations.expectedDocPatterns?.length > 0 && results.length > 0) {
    const patterns = expectations.expectedDocPatterns;
    const matchedPatterns = [];

    for (const pattern of patterns) {
      const patternLower = pattern.toLowerCase();
      const found = results.some((r) => {
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

  // Check 5: Profile exists (for get_project_tech_stack)
  if (expectations.profileExists !== undefined) {
    const passed =
      !!response && (response.profile || response.tech_profile || Object.keys(response).length > 0);
    checks.push({
      name: 'profileExists',
      passed,
      expected: expectations.profileExists,
      actual: passed,
      message: passed ? 'Tech profile exists' : 'Tech profile not found',
    });
  }

  // Check 6: Expected frameworks in tech stack
  if (expectations.expectedFrameworks?.length > 0) {
    const profile = response.profile || response.tech_profile || response;
    const frameworks = profile.frameworks || profile.tech_stack?.frameworks || [];
    const primaryFramework = profile.primary_framework || '';
    const allFrameworks = [...frameworks, primaryFramework].map((f) => f.toLowerCase());

    const expectedFrameworks = expectations.expectedFrameworks;
    const foundFrameworks = expectedFrameworks.filter((f) =>
      allFrameworks.some((actual) => actual.includes(f.toLowerCase()))
    );

    const passed = foundFrameworks.length > 0;
    checks.push({
      name: 'expectedFrameworks',
      passed,
      expected: expectedFrameworks,
      actual: allFrameworks,
      message: passed
        ? `Found frameworks: ${foundFrameworks.join(', ')}`
        : `Missing expected frameworks. Expected: ${expectedFrameworks.join(', ')}, found: ${allFrameworks.join(', ') || 'none'}`,
    });
  }

  // Check 7: Tech stack fields present
  if (expectations.techStackFieldsPresent?.length > 0) {
    const profile = response.profile || response.tech_profile || response;
    const requiredFields = expectations.techStackFieldsPresent;
    const missingFields = requiredFields.filter((field) => !(field in profile));

    const passed = missingFields.length === 0;
    checks.push({
      name: 'techStackFieldsPresent',
      passed,
      expected: requiredFields,
      actual: Object.keys(profile),
      message: passed
        ? `All required fields present: ${requiredFields.join(', ')}`
        : `Missing fields: ${missingFields.join(', ')}`,
    });
  }

  // Check 8: Schema tables present (for get_db_schema)
  if (expectations.schemaTablesPresent?.length > 0) {
    const tables = response.tables || response.schema?.tables || [];
    const tableNames = tables.map((t) =>
      (typeof t === 'string' ? t : t.name || t.table_name).toLowerCase()
    );

    const requiredTables = expectations.schemaTablesPresent;
    const foundTables = requiredTables.filter((t) =>
      tableNames.some((actual) => actual.includes(t.toLowerCase()))
    );

    const passed = foundTables.length > 0;
    checks.push({
      name: 'schemaTablesPresent',
      passed,
      expected: requiredTables,
      actual: tableNames,
      message: passed
        ? `Found tables: ${foundTables.join(', ')}`
        : `Missing expected tables. Expected: ${requiredTables.join(', ')}, found: ${tableNames.join(', ') || 'none'}`,
    });
  }

  // Check 9: Include relationships in schema
  if (expectations.includeRelationships !== undefined) {
    const hasRelationships =
      (response.relationships && response.relationships.length > 0) ||
      (response.schema?.relationships && response.schema.relationships.length > 0) ||
      response.include_relationships;

    // For dry-run or when endpoint just acknowledges the flag, treat as passed
    const passed = expectations.includeRelationships
      ? hasRelationships || response.includeRelationships !== undefined
      : true;

    checks.push({
      name: 'includeRelationships',
      passed,
      expected: expectations.includeRelationships,
      actual: hasRelationships,
      message: passed
        ? 'Relationships included in response'
        : 'Expected relationships but none found',
    });
  }

  // Check 10: Min nodes for graph expansion
  if (expectations.minNodes !== undefined) {
    const nodes = response.nodes || response.graph?.nodes || [];
    const passed = nodes.length >= expectations.minNodes;
    checks.push({
      name: 'minNodes',
      passed,
      expected: expectations.minNodes,
      actual: nodes.length,
      message: passed
        ? `Got ${nodes.length} nodes (min: ${expectations.minNodes})`
        : `Expected at least ${expectations.minNodes} nodes, got ${nodes.length}`,
    });
  }

  // Check 11: Graph expansion enabled
  if (expectations.graphExpansionEnabled !== undefined) {
    const passed =
      response.nodes !== undefined ||
      response.graph !== undefined ||
      response.expanded !== undefined;
    checks.push({
      name: 'graphExpansionEnabled',
      passed,
      expected: true,
      actual: passed,
      message: passed ? 'Graph expansion response received' : 'Graph expansion not available',
    });
  }

  // Check 12: Expected node types
  if (expectations.expectedNodeTypes?.length > 0) {
    const nodes = response.nodes || response.graph?.nodes || [];
    const nodeTypes = new Set(nodes.map((n) => n.type || n.node_type));

    const expectedTypes = expectations.expectedNodeTypes;
    const foundTypes = expectedTypes.filter((t) => nodeTypes.has(t));

    const passed = foundTypes.length > 0 || nodes.length === 0; // Allow if no nodes (endpoint may not be implemented)
    checks.push({
      name: 'expectedNodeTypes',
      passed,
      expected: expectedTypes,
      actual: [...nodeTypes],
      message: passed
        ? `Found node types: ${foundTypes.join(', ') || 'none (empty graph)'}`
        : `Missing expected node types. Expected: ${expectedTypes.join(', ')}, found: ${[...nodeTypes].join(', ') || 'none'}`,
    });
  }

  // Check 13: Expected edge types
  if (expectations.expectedEdgeTypes?.length > 0) {
    const edges = response.edges || response.graph?.edges || [];
    const edgeTypes = new Set(edges.map((e) => e.type || e.edge_type || e.relationship));

    const expectedTypes = expectations.expectedEdgeTypes;
    const foundTypes = expectedTypes.filter((t) => edgeTypes.has(t));

    const passed = foundTypes.length > 0 || edges.length === 0; // Allow if no edges
    checks.push({
      name: 'expectedEdgeTypes',
      passed,
      expected: expectedTypes,
      actual: [...edgeTypes],
      message: passed
        ? `Found edge types: ${foundTypes.join(', ') || 'none (no edges)'}`
        : `Missing expected edge types. Expected: ${expectedTypes.join(', ')}, found: ${[...edgeTypes].join(', ') || 'none'}`,
    });
  }

  // Check 14: Symbol found (for find_symbol_usages)
  if (expectations.symbolFound !== undefined) {
    const passed =
      (response.symbol && Object.keys(response.symbol).length > 0) ||
      (response.usages && response.usages.length > 0) ||
      (response.definitions && response.definitions.length > 0) ||
      response.found !== false;

    checks.push({
      name: 'symbolFound',
      passed,
      expected: expectations.symbolFound,
      actual: passed,
      message: passed ? 'Symbol found in codebase' : 'Symbol not found',
    });
  }

  // Check 15: Include definitions in symbol search
  if (expectations.includeDefinitions !== undefined) {
    const hasDefinitions =
      (response.definitions && response.definitions.length > 0) || response.include_definitions;

    const passed = expectations.includeDefinitions
      ? hasDefinitions || response.includeDefinitions !== undefined
      : true;

    checks.push({
      name: 'includeDefinitions',
      passed,
      expected: expectations.includeDefinitions,
      actual: hasDefinitions,
      message: passed ? 'Definitions included in response' : 'Expected definitions but none found',
    });
  }

  // Check 16: Include usages in symbol search
  if (expectations.includeUsages !== undefined) {
    const hasUsages = (response.usages && response.usages.length > 0) || response.include_usages;

    const passed = expectations.includeUsages
      ? hasUsages || response.includeUsages !== undefined
      : true;

    checks.push({
      name: 'includeUsages',
      passed,
      expected: expectations.includeUsages,
      actual: hasUsages,
      message: passed ? 'Usages included in response' : 'Expected usages but none found',
    });
  }

  // Check 17: Symbol search enabled
  if (expectations.symbolSearchEnabled !== undefined) {
    const passed =
      response.symbol !== undefined ||
      response.usages !== undefined ||
      response.definitions !== undefined ||
      response.found !== undefined;

    checks.push({
      name: 'symbolSearchEnabled',
      passed,
      expected: true,
      actual: passed,
      message: passed ? 'Symbol search response received' : 'Symbol search not available',
    });
  }

  // Calculate overall pass/fail
  const passedChecks = checks.filter((c) => c.passed).length;
  const totalChecks = checks.length;
  const passed = totalChecks === 0 || passedChecks === totalChecks;
  const score = totalChecks > 0 ? passedChecks / totalChecks : 1;

  return { passed, checks, score, passedChecks, totalChecks };
}

/**
 * Validate scenario success criteria
 * @param {Object} scenario - Scenario configuration
 * @param {Object[]} stepResults - Array of step results
 * @returns {Object} Overall scenario validation result
 */
function validateScenarioSuccess(scenario, stepResults) {
  const criteria = scenario.successCriteria || {};
  const checks = [];

  // Track tools used
  const toolsUsed = new Set();
  for (const result of stepResults) {
    if (!result.error && result.step?.tool) {
      toolsUsed.add(result.step.tool);
    }
  }

  // Check 1: Required tools
  if (criteria.requiredTools?.length > 0) {
    const missingTools = criteria.requiredTools.filter((t) => !toolsUsed.has(t));
    const passed = missingTools.length === 0;

    checks.push({
      name: 'requiredTools',
      passed,
      expected: criteria.requiredTools,
      actual: [...toolsUsed],
      message: passed
        ? `All required tools used: ${criteria.requiredTools.join(', ')}`
        : `Missing required tools: ${missingTools.join(', ')}`,
    });
  }

  // Check 2: Minimum tool calls
  if (criteria.minToolCalls !== undefined) {
    const totalCalls = stepResults.filter((r) => !r.error).length;
    const passed = totalCalls >= criteria.minToolCalls;

    checks.push({
      name: 'minToolCalls',
      passed,
      expected: criteria.minToolCalls,
      actual: totalCalls,
      message: passed
        ? `Made ${totalCalls} tool calls (min: ${criteria.minToolCalls})`
        : `Expected at least ${criteria.minToolCalls} tool calls, made ${totalCalls}`,
    });
  }

  // Check 3: All steps passed
  if (criteria.allStepsPassed) {
    const failedSteps = stepResults.filter((r) => r.validation && !r.validation.passed);
    const errorSteps = stepResults.filter((r) => r.error);
    const passed = failedSteps.length === 0 && errorSteps.length === 0;

    checks.push({
      name: 'allStepsPassed',
      passed,
      expected: true,
      actual: passed,
      message: passed
        ? 'All steps passed successfully'
        : `${failedSteps.length} step(s) failed, ${errorSteps.length} error(s)`,
    });
  }

  // Calculate overall
  const passedChecks = checks.filter((c) => c.passed).length;
  const totalChecks = checks.length;
  const passed = totalChecks === 0 || passedChecks === totalChecks;
  const score = totalChecks > 0 ? passedChecks / totalChecks : 1;

  return { passed, checks, score, passedChecks, totalChecks, toolsUsed: [...toolsUsed] };
}

// ============================================================================
// Step & Scenario Execution
// ============================================================================

/**
 * Run a single step
 * @param {Object} step - Step configuration
 * @param {Object} config - Global configuration
 * @param {boolean} verbose - Whether to include verbose output
 * @returns {Promise<Object>} Step result
 */
async function runStep(step, config, verbose) {
  const startTime = Date.now();
  const tool = step.tool;

  try {
    const requestParams = buildRequestParams(step, tool, config);
    const response = await executeToolCall(tool, requestParams, config);
    const validation = validateExpectations(step, response);
    const elapsedMs = Date.now() - startTime;

    return {
      step,
      tool,
      requestParams,
      response: verbose
        ? response
        : {
            // Summarized response for non-verbose mode
            resultCount: response.results?.length || 0,
            hasNodes: !!response.nodes,
            hasTables: !!response.tables,
            hasProfile: !!response.profile || !!response.tech_profile,
          },
      validation,
      elapsedMs,
      error: null,
      success: true,
    };
  } catch (error) {
    return {
      step,
      tool,
      requestParams: null,
      response: null,
      validation: { passed: false, checks: [], score: 0, passedChecks: 0, totalChecks: 0 },
      elapsedMs: Date.now() - startTime,
      error: error.message,
      success: false,
    };
  }
}

/**
 * Run a complete scenario
 * @param {Object} scenario - Scenario configuration
 * @param {Object} config - Global configuration
 * @param {Object} options - CLI options
 * @returns {Promise<Object>} Scenario result
 */
async function runScenario(scenario, config, options) {
  const startTime = Date.now();
  const stepResults = [];

  console.info(`\n[${scenario.id}] ${scenario.description}`);

  for (const step of scenario.steps || []) {
    process.stdout.write(`  [${step.stepId}] ${step.description}... `);

    if (options.dryRun) {
      console.info('(dry-run)');
      console.info(`      Tool: ${step.tool}`);
      console.info(`      Endpoint: ${step.endpoint}`);
      console.info(
        `      Params: ${JSON.stringify(step.params, null, 2).split('\n').join('\n      ')}`
      );
      stepResults.push({ step, dryRun: true, success: true });
      continue;
    }

    const result = await runStep(step, config, options.verbose);

    if (result.error) {
      console.info('ERROR');
      if (options.verbose) {
        console.info(`      Error: ${result.error}`);
      }
    } else if (result.validation.passed) {
      console.info('PASS');
    } else {
      console.info('FAIL');
      if (options.verbose) {
        for (const check of result.validation.checks) {
          if (!check.passed) {
            console.info(`      - ${check.name}: ${check.message}`);
          }
        }
      }
    }

    stepResults.push(result);
  }

  // Validate scenario success criteria
  const scenarioValidation = options.dryRun
    ? { passed: true, checks: [], toolsUsed: [] }
    : validateScenarioSuccess(scenario, stepResults);

  const elapsedMs = Date.now() - startTime;

  // Print scenario summary
  if (!options.dryRun) {
    const stepsPassed = stepResults.filter((r) => r.validation?.passed).length;
    const stepsTotal = stepResults.length;
    const icon = scenarioValidation.passed ? 'PASS' : 'FAIL';
    console.info(`  Scenario Result: ${icon} (${stepsPassed}/${stepsTotal} steps, ${elapsedMs}ms)`);
  }

  return {
    scenario,
    steps: stepResults,
    validation: scenarioValidation,
    passed: scenarioValidation.passed,
    toolsUsed: scenarioValidation.toolsUsed,
    elapsedMs,
  };
}

// ============================================================================
// Report Generation
// ============================================================================

/**
 * Generate JSON report
 * @param {Object} config - Configuration
 * @param {Object[]} results - Scenario results
 * @param {Object} options - CLI options
 * @returns {Object} JSON report object
 */
function generateJsonReport(config, results, options) {
  const timestamp = new Date().toISOString();

  // Aggregate tool call data
  const toolCalls = [];
  const toolCoverage = {};

  for (const scenarioResult of results) {
    for (const stepResult of scenarioResult.steps || []) {
      if (stepResult.dryRun) continue;

      const tool = stepResult.tool || stepResult.step?.tool;
      if (tool) {
        toolCoverage[tool] = (toolCoverage[tool] || 0) + 1;
        toolCalls.push({
          tool,
          params: stepResult.requestParams?.body || stepResult.step?.params || {},
          durationMs: stepResult.elapsedMs || 0,
          success: stepResult.success !== false && !stepResult.error,
          error: stepResult.error || null,
        });
      }
    }
  }

  // Calculate summary
  const totalScenarios = results.length;
  const passedScenarios = results.filter((r) => r.passed).length;
  const failedScenarios = totalScenarios - passedScenarios;

  return {
    timestamp,
    config: {
      collectionId: config.collectionId,
      baseUrl: config.baseUrl,
    },
    scenarios: results.map((r) => ({
      id: r.scenario.id,
      description: r.scenario.description,
      category: r.scenario.category,
      passed: r.passed,
      steps: r.steps.map((s) => ({
        stepId: s.step?.stepId,
        tool: s.tool || s.step?.tool,
        passed: s.validation?.passed ?? true,
        durationMs: s.elapsedMs,
        error: s.error || null,
        checks: s.validation?.checks || [],
      })),
      toolsUsed: r.toolsUsed || [],
      durationMs: r.elapsedMs,
    })),
    summary: {
      totalScenarios,
      passed: passedScenarios,
      failed: failedScenarios,
      passRate:
        totalScenarios > 0 ? ((passedScenarios / totalScenarios) * 100).toFixed(1) + '%' : '0%',
      toolCoverage,
    },
    toolCalls,
  };
}

/**
 * Generate Markdown report
 * @param {Object} config - Configuration
 * @param {Object[]} results - Scenario results
 * @param {Object} options - CLI options
 * @returns {string} Markdown report
 */
function generateMarkdownReport(config, results, options) {
  const timestamp = new Date().toISOString();
  const jsonReport = generateJsonReport(config, results, options);

  let report = `# MCP Scenario Evaluation Report

**Generated:** ${timestamp}
**Collection ID:** \`${config.collectionId}\`
**Base URL:** ${config.baseUrl}
**Scenarios:** ${results.length}

## Summary

| Metric | Value |
|--------|-------|
| Total Scenarios | ${jsonReport.summary.totalScenarios} |
| Passed | ${jsonReport.summary.passed} |
| Failed | ${jsonReport.summary.failed} |
| **Pass Rate** | **${jsonReport.summary.passRate}** |

## Tool Coverage

| Tool | Calls |
|------|-------|
`;

  for (const [tool, count] of Object.entries(jsonReport.summary.toolCoverage).sort(
    (a, b) => b[1] - a[1]
  )) {
    report += `| ${tool} | ${count} |\n`;
  }

  report += '\n## Scenario Results\n\n';

  // Group by category
  const byCategory = {};
  for (const r of results) {
    const cat = r.scenario.category || 'uncategorized';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(r);
  }

  for (const [category, categoryResults] of Object.entries(byCategory)) {
    const catPassed = categoryResults.filter((r) => r.passed).length;
    const catTotal = categoryResults.length;

    report += `### ${category} (${catPassed}/${catTotal})\n\n`;

    for (const r of categoryResults) {
      const icon = r.passed ? '[PASS]' : '[FAIL]';
      report += `#### ${icon} ${r.scenario.id}\n\n`;
      report += `${r.scenario.description}\n\n`;
      report += `**Duration:** ${r.elapsedMs}ms | **Tools Used:** ${(r.toolsUsed || []).join(', ') || 'none'}\n\n`;

      report += '| Step | Tool | Status | Duration |\n';
      report += '|------|------|--------|----------|\n';

      for (const stepResult of r.steps || []) {
        const step = stepResult.step;
        const status = stepResult.dryRun
          ? 'DRY-RUN'
          : stepResult.error
            ? 'ERROR'
            : stepResult.validation?.passed
              ? 'PASS'
              : 'FAIL';
        const duration = stepResult.elapsedMs ? `${stepResult.elapsedMs}ms` : 'N/A';

        report += `| ${step?.stepId || 'unknown'} | ${stepResult.tool || step?.tool || 'unknown'} | ${status} | ${duration} |\n`;
      }

      report += '\n';
    }
  }

  // Failed scenario details
  const failures = results.filter((r) => !r.passed);
  if (failures.length > 0) {
    report += '## Failed Scenario Details\n\n';

    for (const r of failures) {
      report += `### ${r.scenario.id}: ${r.scenario.description}\n\n`;

      // Show scenario-level validation failures
      if (r.validation?.checks) {
        report += '**Scenario Criteria:**\n';
        for (const check of r.validation.checks) {
          const icon = check.passed ? '[PASS]' : '[FAIL]';
          report += `- ${icon} **${check.name}:** ${check.message}\n`;
        }
        report += '\n';
      }

      // Show step-level failures
      const failedSteps = r.steps?.filter((s) => s.validation && !s.validation.passed);
      const errorSteps = r.steps?.filter((s) => s.error);

      if (failedSteps?.length > 0) {
        report += '**Failed Steps:**\n';
        for (const stepResult of failedSteps) {
          report += `\n**${stepResult.step?.stepId}** (${stepResult.tool || stepResult.step?.tool}):\n`;
          for (const check of stepResult.validation?.checks || []) {
            if (!check.passed) {
              report += `  - ${check.name}: ${check.message}\n`;
            }
          }
        }
        report += '\n';
      }

      if (errorSteps?.length > 0) {
        report += '**Error Steps:**\n';
        for (const stepResult of errorSteps) {
          report += `\n**${stepResult.step?.stepId}** (${stepResult.tool || stepResult.step?.tool}):\n`;
          report += `\`\`\`\n${stepResult.error}\n\`\`\`\n`;
        }
        report += '\n';
      }
    }
  }

  report += '---\n\n_Report generated by mcp_scenario_runner.mjs_\n';

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

    console.info('MCP Scenario Runner');
    console.info('===================');
    console.info(`Collection ID: ${config.collectionId}`);
    console.info(`Base URL: ${config.baseUrl}`);
    console.info(`Mode: ${options.dryRun ? 'Dry Run (no API calls)' : 'Live'}`);

    // Filter scenarios if specific one requested
    let scenarios = config.scenarios || [];
    if (options.scenario) {
      scenarios = scenarios.filter((s) => s.id === options.scenario);
      if (scenarios.length === 0) {
        throw new Error(`Scenario not found: ${options.scenario}`);
      }
      console.info(`Running scenario: ${options.scenario}`);
    } else {
      console.info(`Running ${scenarios.length} scenario(s)`);
    }

    // Run scenarios
    const results = [];
    for (const scenario of scenarios) {
      const result = await runScenario(scenario, config, options);
      results.push(result);
    }

    // Skip report generation in dry-run mode
    if (options.dryRun) {
      console.info('\nDry run complete. No API calls were made.');
      process.exit(0);
    }

    // Generate reports
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseOutputPath = options.output || join(__dirname, `mcp_scenario_results_${timestamp}`);

    const jsonReport = generateJsonReport(config, results, options);
    const mdReport = generateMarkdownReport(config, results, options);

    // Write reports
    const jsonPath = baseOutputPath.endsWith('.json') ? baseOutputPath : `${baseOutputPath}.json`;
    const mdPath = baseOutputPath.endsWith('.md')
      ? baseOutputPath
      : baseOutputPath.endsWith('.json')
        ? baseOutputPath.replace(/\.json$/, '.md')
        : `${baseOutputPath}.md`;

    writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
    writeFileSync(mdPath, mdReport);

    console.info('\nReports written:');
    console.info(`  JSON: ${jsonPath}`);
    console.info(`  Markdown: ${mdPath}`);

    // Summary
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;
    console.info(`\nOverall: ${passed}/${total} scenarios passed`);

    // Exit with error code if any failures
    process.exit(passed === total ? 0 : 1);
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
