/**
 * Unit tests for mobile evaluation harness
 *
 * Tests the validation logic, task schema, and report generation
 * used by mobile_eval_runner.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// Types (mirroring mobile_eval_runner.mjs)
// ============================================================================

interface TaskParams {
  query?: string;
  featureTags?: string[];
  platform?: string;
  framework?: string;
}

interface TaskExpectations {
  minResults?: number;
  allowEmptyResults?: boolean;
  requiredUsageTiers?: string[];
  requiredFeatureTags?: string[];
  expectedDocPatterns?: string[];
  verifyMetadataPresent?: boolean;
}

interface EvalTask {
  id: string;
  category: string;
  description: string;
  mcpTool: string;
  params: TaskParams;
  expectations: TaskExpectations;
}

interface EvalConfig {
  version: string;
  description: string;
  collectionId: string;
  topK: number;
  baseUrl: string;
  tasks: EvalTask[];
}

interface SearchResult {
  docTitle?: string;
  text?: string;
  similarity?: number;
  metadata?: {
    usage_tier?: string;
    feature_tags?: string[];
    platform?: string;
    [key: string]: unknown;
  };
}

interface SearchResponse {
  results: SearchResult[];
  totalResults?: number;
  searchTimeMs?: number;
}

interface CheckResult {
  name: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  message: string;
}

interface ValidationResult {
  passed: boolean;
  checks: CheckResult[];
  score: number;
  passedChecks: number;
  totalChecks: number;
}

// ============================================================================
// Validation Logic (extracted from mobile_eval_runner.mjs for testing)
// ============================================================================

function validateExpectations(task: EvalTask, response: SearchResponse): ValidationResult {
  const checks: CheckResult[] = [];
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
  if (
    expectations.requiredUsageTiers &&
    expectations.requiredUsageTiers.length > 0 &&
    results.length > 0
  ) {
    const foundTiers = new Set<string>();
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
  if (
    expectations.requiredFeatureTags &&
    expectations.requiredFeatureTags.length > 0 &&
    results.length > 0
  ) {
    const foundTags = new Set<string>();
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
  if (
    expectations.expectedDocPatterns &&
    expectations.expectedDocPatterns.length > 0 &&
    results.length > 0
  ) {
    const patterns = expectations.expectedDocPatterns;
    const matchedPatterns: string[] = [];

    for (const pattern of patterns) {
      const patternLower = pattern.toLowerCase();
      const found = results.some((r) => {
        // Support both camelCase (docTitle, text) and snake_case (doc_title, snippet)
        const title = (
          ((r as Record<string, unknown>).docTitle as string) ||
          ((r as Record<string, unknown>).doc_title as string) ||
          ''
        ).toLowerCase();
        const text = (
          r.text ||
          ((r as Record<string, unknown>).snippet as string) ||
          ''
        ).toLowerCase();
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

function buildSearchParams(task: EvalTask, config: { collectionId: string; topK: number }) {
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
      return {
        ...baseParams,
        query: `${task.params.featureTags?.join(' ') || ''} implementation guide`,
        feature_tags: task.params.featureTags,
        usage_tier: 'recipe',
        tech_stack: task.params.framework ? [task.params.framework] : undefined,
      };

    default:
      throw new Error(`Unknown MCP tool: ${task.mcpTool}`);
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('mobile_eval_tasks.json schema validation', () => {
  let config: EvalConfig;

  beforeEach(() => {
    const configPath = join(__dirname, '..', 'mobile_eval_tasks.json');
    config = JSON.parse(readFileSync(configPath, 'utf8'));
  });

  it('should have required top-level fields', () => {
    expect(config.version).toBeDefined();
    expect(config.description).toBeDefined();
    expect(config.collectionId).toBeDefined();
    expect(config.topK).toBeGreaterThan(0);
    expect(config.tasks).toBeInstanceOf(Array);
  });

  it('should have valid collection ID format', () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(config.collectionId).toMatch(uuidRegex);
  });

  it('should have at least 5 tasks', () => {
    expect(config.tasks.length).toBeGreaterThanOrEqual(5);
  });

  it('should have unique task IDs', () => {
    const ids = config.tasks.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have valid MCP tool names for all tasks', () => {
    const validTools = ['search_mobile_docs', 'find_code_examples', 'get_feature_recipe'];

    for (const task of config.tasks) {
      expect(validTools).toContain(task.mcpTool);
    }
  });

  it('should have required params for each MCP tool', () => {
    for (const task of config.tasks) {
      expect(task.id).toBeDefined();
      expect(task.description).toBeDefined();
      expect(task.mcpTool).toBeDefined();
      expect(task.params).toBeDefined();

      if (task.mcpTool === 'search_mobile_docs') {
        expect(task.params.query).toBeDefined();
      }

      if (task.mcpTool === 'find_code_examples') {
        expect(task.params.query).toBeDefined();
      }

      if (task.mcpTool === 'get_feature_recipe') {
        expect(task.params.featureTags).toBeDefined();
        expect(task.params.featureTags?.length).toBeGreaterThan(0);
      }
    }
  });

  it('should cover all required categories', () => {
    const categories = new Set(config.tasks.map((t) => t.category));
    expect(categories.has('authentication')).toBe(true);
    expect(categories.has('payments') || categories.has('subscriptions')).toBe(true);
    expect(categories.has('push_notifications') || categories.has('notifications')).toBe(true);
    expect(categories.has('offline')).toBe(true);
  });

  it('should use at least two of three MCP tools', () => {
    const tools = new Set(config.tasks.map((t) => t.mcpTool));
    // Must use search_mobile_docs (primary search tool)
    expect(tools.has('search_mobile_docs')).toBe(true);
    // Must use at least one of the specialized tools
    expect(tools.has('find_code_examples') || tools.has('get_feature_recipe')).toBe(true);
  });
});

describe('validateExpectations', () => {
  const baseTask: EvalTask = {
    id: 'test-001',
    category: 'test',
    description: 'Test task',
    mcpTool: 'search_mobile_docs',
    params: { query: 'test' },
    expectations: {},
  };

  describe('minResults check', () => {
    it('should pass when results meet minimum', () => {
      const task = {
        ...baseTask,
        expectations: { minResults: 1 },
      };
      const response: SearchResponse = {
        results: [{ docTitle: 'Doc 1' }],
      };

      const result = validateExpectations(task, response);
      expect(result.passed).toBe(true);
      expect(result.checks[0].name).toBe('minResults');
      expect(result.checks[0].passed).toBe(true);
    });

    it('should fail when results below minimum', () => {
      const task = {
        ...baseTask,
        expectations: { minResults: 5 },
      };
      const response: SearchResponse = {
        results: [{ docTitle: 'Doc 1' }],
      };

      const result = validateExpectations(task, response);
      expect(result.passed).toBe(false);
      expect(result.checks[0].passed).toBe(false);
    });

    it('should pass with zero minimum and empty results', () => {
      const task = {
        ...baseTask,
        expectations: { minResults: 0 },
      };
      const response: SearchResponse = {
        results: [],
      };

      const result = validateExpectations(task, response);
      expect(result.passed).toBe(true);
    });
  });

  describe('allowEmptyResults check', () => {
    it('should pass when empty results are allowed and received', () => {
      const task = {
        ...baseTask,
        expectations: { allowEmptyResults: true },
      };
      const response: SearchResponse = {
        results: [],
      };

      const result = validateExpectations(task, response);
      expect(result.passed).toBe(true);
      expect(result.checks[0].name).toBe('allowEmptyResults');
    });

    it('should not add check when results are not empty', () => {
      const task = {
        ...baseTask,
        expectations: { allowEmptyResults: true },
      };
      const response: SearchResponse = {
        results: [{ docTitle: 'Doc 1' }],
      };

      const result = validateExpectations(task, response);
      expect(result.checks.find((c) => c.name === 'allowEmptyResults')).toBeUndefined();
    });
  });

  describe('requiredUsageTiers check', () => {
    it('should pass when at least one required tier is found', () => {
      const task = {
        ...baseTask,
        expectations: { requiredUsageTiers: ['official', 'recipe'] },
      };
      const response: SearchResponse = {
        results: [
          { docTitle: 'Doc 1', metadata: { usage_tier: 'recipe' } },
          { docTitle: 'Doc 2', metadata: { usage_tier: 'example' } },
        ],
      };

      const result = validateExpectations(task, response);
      expect(result.passed).toBe(true);
      const check = result.checks.find((c) => c.name === 'requiredUsageTiers');
      expect(check?.passed).toBe(true);
    });

    it('should fail when no required tier is found', () => {
      const task = {
        ...baseTask,
        expectations: { requiredUsageTiers: ['official'] },
      };
      const response: SearchResponse = {
        results: [{ docTitle: 'Doc 1', metadata: { usage_tier: 'example' } }],
      };

      const result = validateExpectations(task, response);
      expect(result.passed).toBe(false);
    });
  });

  describe('requiredFeatureTags check', () => {
    it('should pass when at least one required tag is found', () => {
      const task = {
        ...baseTask,
        expectations: { requiredFeatureTags: ['auth', 'payments'] },
      };
      const response: SearchResponse = {
        results: [{ docTitle: 'Doc 1', metadata: { feature_tags: ['auth', 'social_auth'] } }],
      };

      const result = validateExpectations(task, response);
      expect(result.passed).toBe(true);
      const check = result.checks.find((c) => c.name === 'requiredFeatureTags');
      expect(check?.passed).toBe(true);
    });

    it('should fail when no required tag is found', () => {
      const task = {
        ...baseTask,
        expectations: { requiredFeatureTags: ['payments'] },
      };
      const response: SearchResponse = {
        results: [{ docTitle: 'Doc 1', metadata: { feature_tags: ['auth'] } }],
      };

      const result = validateExpectations(task, response);
      expect(result.passed).toBe(false);
    });

    it('should handle results with no feature_tags', () => {
      const task = {
        ...baseTask,
        expectations: { requiredFeatureTags: ['auth'] },
      };
      const response: SearchResponse = {
        results: [{ docTitle: 'Doc 1', metadata: {} }],
      };

      const result = validateExpectations(task, response);
      expect(result.passed).toBe(false);
    });
  });

  describe('expectedDocPatterns check', () => {
    it('should pass when half or more patterns match', () => {
      const task = {
        ...baseTask,
        expectations: { expectedDocPatterns: ['flutter', 'auth', 'supabase', 'setup'] },
      };
      const response: SearchResponse = {
        results: [{ docTitle: 'Flutter Auth Guide', text: 'Setup Supabase authentication' }],
      };

      const result = validateExpectations(task, response);
      expect(result.passed).toBe(true);
    });

    it('should fail when less than half patterns match', () => {
      const task = {
        ...baseTask,
        expectations: { expectedDocPatterns: ['flutter', 'auth', 'supabase', 'setup'] },
      };
      const response: SearchResponse = {
        results: [{ docTitle: 'Random Doc', text: 'Unrelated content' }],
      };

      const result = validateExpectations(task, response);
      expect(result.passed).toBe(false);
    });

    it('should be case-insensitive', () => {
      const task = {
        ...baseTask,
        expectations: { expectedDocPatterns: ['FLUTTER', 'AUTH'] },
      };
      const response: SearchResponse = {
        results: [{ docTitle: 'flutter auth', text: 'guide' }],
      };

      const result = validateExpectations(task, response);
      expect(result.passed).toBe(true);
    });
  });

  describe('verifyMetadataPresent check', () => {
    it('should pass when all results have metadata', () => {
      const task = {
        ...baseTask,
        expectations: { verifyMetadataPresent: true },
      };
      const response: SearchResponse = {
        results: [
          { docTitle: 'Doc 1', metadata: { platform: 'mobile' } },
          { docTitle: 'Doc 2', metadata: { platform: 'web' } },
        ],
      };

      const result = validateExpectations(task, response);
      expect(result.passed).toBe(true);
    });

    it('should fail when some results lack metadata', () => {
      const task = {
        ...baseTask,
        expectations: { verifyMetadataPresent: true },
      };
      const response: SearchResponse = {
        results: [
          { docTitle: 'Doc 1', metadata: { platform: 'mobile' } },
          { docTitle: 'Doc 2', metadata: {} },
        ],
      };

      const result = validateExpectations(task, response);
      expect(result.passed).toBe(false);
    });
  });

  describe('score calculation', () => {
    it('should calculate correct score with mixed results', () => {
      const task = {
        ...baseTask,
        expectations: {
          minResults: 1,
          requiredUsageTiers: ['official'],
          requiredFeatureTags: ['auth'],
        },
      };
      const response: SearchResponse = {
        results: [
          { docTitle: 'Doc 1', metadata: { usage_tier: 'example', feature_tags: ['auth'] } },
        ],
      };

      const result = validateExpectations(task, response);
      // minResults: pass (1), requiredUsageTiers: fail (example != official), requiredFeatureTags: pass (auth)
      expect(result.passedChecks).toBe(2);
      expect(result.totalChecks).toBe(3);
      expect(result.score).toBeCloseTo(2 / 3);
      expect(result.passed).toBe(false);
    });

    it('should return score of 1 when no expectations', () => {
      const task = { ...baseTask, expectations: {} };
      const response: SearchResponse = { results: [] };

      const result = validateExpectations(task, response);
      expect(result.score).toBe(1);
      expect(result.passed).toBe(true);
    });
  });
});

describe('buildSearchParams', () => {
  const config = { collectionId: 'test-collection', topK: 10 };

  it('should build params for search_mobile_docs', () => {
    const task: EvalTask = {
      id: 'test',
      category: 'test',
      description: 'Test',
      mcpTool: 'search_mobile_docs',
      params: {
        query: 'test query',
        featureTags: ['auth'],
        platform: 'mobile',
        framework: 'flutter',
      },
      expectations: {},
    };

    const params = buildSearchParams(task, config);
    expect(params.collection_id).toBe('test-collection');
    expect(params.top_k).toBe(10);
    expect(params.query).toBe('test query');
    expect(params.feature_tags).toEqual(['auth']);
    expect(params.platform).toBe('mobile');
    expect(params.tech_stack).toEqual(['flutter']);
  });

  it('should build params for find_code_examples with usage_tier', () => {
    const task: EvalTask = {
      id: 'test',
      category: 'test',
      description: 'Test',
      mcpTool: 'find_code_examples',
      params: {
        query: 'test query',
        featureTags: ['payments'],
      },
      expectations: {},
    };

    const params = buildSearchParams(task, config);
    expect(params.usage_tier).toBe('example');
    expect(params.query).toBe('test query');
  });

  it('should build params for get_feature_recipe with constructed query', () => {
    const task: EvalTask = {
      id: 'test',
      category: 'test',
      description: 'Test',
      mcpTool: 'get_feature_recipe',
      params: {
        featureTags: ['offline', 'sync'],
        framework: 'flutter',
      },
      expectations: {},
    };

    const params = buildSearchParams(task, config);
    expect(params.usage_tier).toBe('recipe');
    expect(params.query).toBe('offline sync implementation guide');
    expect(params.feature_tags).toEqual(['offline', 'sync']);
  });

  it('should throw for unknown MCP tool', () => {
    const task: EvalTask = {
      id: 'test',
      category: 'test',
      description: 'Test',
      mcpTool: 'unknown_tool',
      params: {},
      expectations: {},
    };

    expect(() => buildSearchParams(task, config)).toThrow('Unknown MCP tool');
  });

  it('should handle missing framework gracefully', () => {
    const task: EvalTask = {
      id: 'test',
      category: 'test',
      description: 'Test',
      mcpTool: 'search_mobile_docs',
      params: {
        query: 'test',
        platform: 'mobile',
      },
      expectations: {},
    };

    const params = buildSearchParams(task, config);
    expect(params.tech_stack).toBeUndefined();
  });
});

describe('edge cases', () => {
  it('should handle empty results array', () => {
    const task: EvalTask = {
      id: 'test',
      category: 'test',
      description: 'Test',
      mcpTool: 'search_mobile_docs',
      params: { query: 'test' },
      expectations: { minResults: 0, allowEmptyResults: true },
    };
    const response: SearchResponse = { results: [] };

    const result = validateExpectations(task, response);
    expect(result.passed).toBe(true);
  });

  it('should handle null metadata gracefully', () => {
    const task: EvalTask = {
      id: 'test',
      category: 'test',
      description: 'Test',
      mcpTool: 'search_mobile_docs',
      params: { query: 'test' },
      expectations: { requiredFeatureTags: ['auth'] },
    };
    const response: SearchResponse = {
      results: [{ docTitle: 'Doc 1' }],
    };

    const result = validateExpectations(task, response);
    expect(result.passed).toBe(false);
  });

  it('should handle undefined expectations gracefully', () => {
    const task: EvalTask = {
      id: 'test',
      category: 'test',
      description: 'Test',
      mcpTool: 'search_mobile_docs',
      params: { query: 'test' },
      expectations: undefined as unknown as TaskExpectations,
    };
    const response: SearchResponse = { results: [] };

    // Should not throw
    const result = validateExpectations(task, response);
    expect(result.passed).toBe(true);
    expect(result.checks).toHaveLength(0);
  });
});
