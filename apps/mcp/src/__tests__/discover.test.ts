/**
 * Discovery Gateway Tool Tests
 *
 * Tests for the synthesis_discover_tools gateway tool implementation.
 * Covers catalog building, task-based recommendations, and toolpack/category info.
 *
 * @module apps/mcp/src/__tests__/discover.test
 * @since GPT Phase 3: Sub-Phase 5.6.2
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DynamicToolRegistry } from '../tool-registry.js';
import {
  buildCategoriesInfo,
  buildDiscoverResult,
  buildSuggestion,
  buildToolpacksInfo,
  computeRecommendations,
} from '../tools/discover.js';
import type { ToolRef } from '../types/gateway-responses.js';
import type { DiscoverToolsInput } from '../types/gateway-schemas.js';

// =============================================================================
// Mock Registry
// =============================================================================

/**
 * Create a mock DynamicToolRegistry for testing
 */
function createMockRegistry(options: {
  enabledTools?: string[];
  allTools?: string[];
}): DynamicToolRegistry {
  const { enabledTools = [], allTools = [] } = options;

  return {
    size: allTools.length,
    getEnabledCount: vi.fn(() => enabledTools.length),
    isEnabled: vi.fn((name: string) => enabledTools.includes(name)),
    getHandle: vi.fn((name: string) => {
      if (allTools.includes(name)) {
        return {
          name,
          toolpack: 'core',
          category: 'core',
          sensitive: false,
          version: '1.0.0',
          isEnabled: enabledTools.includes(name),
        };
      }
      return undefined;
    }),
    listTools: vi.fn(() => allTools),
    listEnabledTools: vi.fn(() => enabledTools),
  } as unknown as DynamicToolRegistry;
}

// =============================================================================
// buildDiscoverResult Tests
// =============================================================================

describe('buildDiscoverResult', () => {
  describe('basic catalog (list_all behavior)', () => {
    it('should return all toolpacks with correct structure', () => {
      const registry = createMockRegistry({
        enabledTools: ['list_collections'],
        allTools: ['search_rag', 'list_collections', 'search_mobile_docs'],
      });

      const result = buildDiscoverResult({ list_all: true }, registry);

      expect(result.toolpacks).toBeDefined();
      expect(result.toolpacks.length).toBeGreaterThan(0);

      // Check toolpack structure
      for (const pack of result.toolpacks) {
        expect(pack).toHaveProperty('name');
        expect(pack).toHaveProperty('description');
        expect(pack).toHaveProperty('tools');
        expect(pack).toHaveProperty('sensitiveTools');
        expect(pack).toHaveProperty('defaultProfile');
        expect(pack).toHaveProperty('enabledCount');
        expect(pack).toHaveProperty('totalCount');
      }
    });

    it('should return all categories with correct structure', () => {
      const registry = createMockRegistry({
        enabledTools: [],
        allTools: [],
      });

      const result = buildDiscoverResult({ list_all: true }, registry);

      expect(result.categories).toBeDefined();
      expect(result.categories.length).toBeGreaterThan(0);

      // Check category structure
      for (const cat of result.categories) {
        expect(cat).toHaveProperty('name');
        expect(cat).toHaveProperty('description');
        expect(cat).toHaveProperty('tools');
        expect(cat).toHaveProperty('enabledCount');
        expect(cat).toHaveProperty('totalCount');
      }
    });

    it('should return totalTools and enabledTools counts', () => {
      const registry = createMockRegistry({
        enabledTools: ['search_rag', 'list_collections'],
        allTools: ['search_rag', 'list_collections', 'create_collection', 'list_documents'],
      });

      const result = buildDiscoverResult({ list_all: true }, registry);

      expect(result.totalTools).toBe(4);
      expect(result.enabledTools).toBe(2);
    });

    it('should not return recommendations when no task provided', () => {
      const registry = createMockRegistry({
        enabledTools: [],
        allTools: [],
      });

      const result = buildDiscoverResult({ list_all: true }, registry);

      expect(result.recommended).toBeUndefined();
      expect(result.suggestion).toBeUndefined();
    });

    it('should always return catalog regardless of list_all value', () => {
      const registry = createMockRegistry({
        enabledTools: [],
        allTools: [],
      });

      // Even with list_all: false (default), catalog is returned
      const result = buildDiscoverResult({}, registry);

      expect(result.toolpacks).toBeDefined();
      expect(result.categories).toBeDefined();
    });
  });

  describe('with task (recommendations)', () => {
    it('should return recommendations for auth task', () => {
      const registry = createMockRegistry({
        enabledTools: [],
        allTools: ['search_mobile_docs', 'find_code_examples', 'get_feature_recipe', 'search_rag'],
      });

      const result = buildDiscoverResult({ task: 'authentication with Supabase' }, registry);

      expect(result.recommended).toBeDefined();
      expect(result.recommended?.length).toBeGreaterThan(0);
      expect(result.suggestion).toBeDefined();
    });

    it('should return recommendations for database task', () => {
      const registry = createMockRegistry({
        enabledTools: [],
        allTools: ['get_db_schema', 'get_project_tech_stack', 'find_symbol_usages'],
      });

      const result = buildDiscoverResult({ task: 'database schema migration' }, registry);

      expect(result.recommended).toBeDefined();
      // Should include introspection tools
      const hasDbSchema = result.recommended?.some((r) => r.name === 'get_db_schema');
      expect(hasDbSchema).toBe(true);
    });

    it('should return relevant suggestion message', () => {
      const registry = createMockRegistry({
        enabledTools: [],
        allTools: ['search_mobile_docs', 'find_code_examples'],
      });

      const result = buildDiscoverResult({ task: 'flutter mobile app' }, registry);

      expect(result.suggestion).toBeDefined();
      expect(typeof result.suggestion).toBe('string');
      expect(result.suggestion?.length).toBeGreaterThan(0);
    });

    it('should handle unmatched task gracefully', () => {
      const registry = createMockRegistry({
        enabledTools: [],
        allTools: ['search_rag'],
      });

      const result = buildDiscoverResult({ task: 'xyz123nonexistent' }, registry);

      // Should still return catalog
      expect(result.toolpacks).toBeDefined();
      expect(result.categories).toBeDefined();

      // Recommendations may be empty
      if (result.recommended && result.recommended.length === 0) {
        expect(result.suggestion).toContain('No specific tools matched');
      }
    });

    it('should work with task + list_all together', () => {
      const registry = createMockRegistry({
        enabledTools: ['search_mobile_docs'],
        allTools: ['search_mobile_docs', 'find_code_examples'],
      });

      const result = buildDiscoverResult({ task: 'mobile examples', list_all: true }, registry);

      // Should have both recommendations and catalog
      expect(result.recommended).toBeDefined();
      expect(result.toolpacks).toBeDefined();
      expect(result.categories).toBeDefined();
    });
  });
});

// =============================================================================
// buildToolpacksInfo Tests
// =============================================================================

describe('buildToolpacksInfo', () => {
  it('should include all defined toolpacks', () => {
    const registry = createMockRegistry({
      enabledTools: [],
      allTools: [],
    });

    const toolpacks = buildToolpacksInfo(registry);

    // Should have core, mobile_core, introspection, graphing, gateway
    const packNames = toolpacks.map((p) => p.name);
    expect(packNames).toContain('core');
    expect(packNames).toContain('mobile_core');
    expect(packNames).toContain('introspection');
    expect(packNames).toContain('graphing');
    expect(packNames).toContain('gateway');
  });

  it('should populate tools array correctly', () => {
    const registry = createMockRegistry({
      enabledTools: [],
      allTools: [],
    });

    const toolpacks = buildToolpacksInfo(registry);

    // Mobile core should have its 3 tools
    const mobilePack = toolpacks.find((p) => p.name === 'mobile_core');
    expect(mobilePack).toBeDefined();
    expect(mobilePack?.tools).toContain('search_mobile_docs');
    expect(mobilePack?.tools).toContain('find_code_examples');
    expect(mobilePack?.tools).toContain('get_feature_recipe');
  });

  it('should populate sensitiveTools correctly', () => {
    const registry = createMockRegistry({
      enabledTools: [],
      allTools: [],
    });

    const toolpacks = buildToolpacksInfo(registry);

    // Core pack has delete_document and delete_collection as sensitive
    const corePack = toolpacks.find((p) => p.name === 'core');
    expect(corePack).toBeDefined();
    expect(corePack?.sensitiveTools).toContain('delete_document');
    expect(corePack?.sensitiveTools).toContain('delete_collection');

    // Introspection has get_db_schema as sensitive
    const introPack = toolpacks.find((p) => p.name === 'introspection');
    expect(introPack).toBeDefined();
    expect(introPack?.sensitiveTools).toContain('get_db_schema');
  });

  it('should reflect enabledCount from registry state', () => {
    const registry = createMockRegistry({
      enabledTools: ['search_mobile_docs', 'find_code_examples'],
      allTools: ['search_mobile_docs', 'find_code_examples', 'get_feature_recipe'],
    });

    const toolpacks = buildToolpacksInfo(registry);

    const mobilePack = toolpacks.find((p) => p.name === 'mobile_core');
    expect(mobilePack).toBeDefined();
    expect(mobilePack?.enabledCount).toBe(2);
    expect(mobilePack?.totalCount).toBe(3);
  });
});

// =============================================================================
// buildCategoriesInfo Tests
// =============================================================================

describe('buildCategoriesInfo', () => {
  it('should include all defined categories', () => {
    const registry = createMockRegistry({
      enabledTools: [],
      allTools: [],
    });

    const categories = buildCategoriesInfo(registry);

    const catNames = categories.map((c) => c.name);
    expect(catNames).toContain('core');
    expect(catNames).toContain('mobile');
    expect(catNames).toContain('graph');
    expect(catNames).toContain('introspection');
    expect(catNames).toContain('gateway');
  });

  it('should have tools array for each category', () => {
    const registry = createMockRegistry({
      enabledTools: [],
      allTools: [],
    });

    const categories = buildCategoriesInfo(registry);

    for (const cat of categories) {
      expect(Array.isArray(cat.tools)).toBe(true);
    }
  });

  it('should reflect enabledCount from registry state', () => {
    const registry = createMockRegistry({
      enabledTools: ['search_mobile_docs'],
      allTools: ['search_mobile_docs', 'find_code_examples', 'get_feature_recipe'],
    });

    const categories = buildCategoriesInfo(registry);

    const mobileCat = categories.find((c) => c.name === 'mobile');
    expect(mobileCat).toBeDefined();
    expect(mobileCat?.enabledCount).toBe(1);
  });
});

// =============================================================================
// computeRecommendations Tests
// =============================================================================

describe('computeRecommendations', () => {
  it('should match partial words', () => {
    const registry = createMockRegistry({
      enabledTools: [],
      allTools: ['search_mobile_docs', 'find_code_examples'],
    });

    // 'mob' should match 'mobile'
    const recs = computeRecommendations('mob app', registry);

    expect(recs.length).toBeGreaterThan(0);
  });

  it('should be case insensitive', () => {
    const registry = createMockRegistry({
      enabledTools: [],
      allTools: ['search_mobile_docs'],
    });

    const recs1 = computeRecommendations('MOBILE', registry);
    const recs2 = computeRecommendations('mobile', registry);
    const recs3 = computeRecommendations('Mobile', registry);

    // All should match
    expect(recs1.length).toBeGreaterThan(0);
    expect(recs2.length).toBeGreaterThan(0);
    expect(recs3.length).toBeGreaterThan(0);
  });

  it('should rank exact matches higher', () => {
    const registry = createMockRegistry({
      enabledTools: [],
      allTools: ['search_mobile_docs', 'get_db_schema', 'find_code_examples'],
    });

    // 'mobile' is exact match for search_mobile_docs keywords
    const recs = computeRecommendations('mobile documentation', registry);

    if (recs.length > 0) {
      // First result should be mobile-related
      expect(recs[0].name).toContain('mobile');
    }
  });

  it('should limit results to top N', () => {
    const registry = createMockRegistry({
      enabledTools: [],
      allTools: [
        'search_mobile_docs',
        'find_code_examples',
        'get_feature_recipe',
        'search_rag',
        'list_collections',
        'list_documents',
        'create_collection',
        'get_db_schema',
        'get_project_tech_stack',
        'find_symbol_usages',
        'graph_expand_context',
        'delete_document',
        'delete_collection',
      ],
    });

    // Very broad query that might match many tools
    const recs = computeRecommendations('search find list get', registry);

    // Should be capped at 10
    expect(recs.length).toBeLessThanOrEqual(10);
  });

  it('should include relevance score in results', () => {
    const registry = createMockRegistry({
      enabledTools: [],
      allTools: ['search_mobile_docs'],
    });

    const recs = computeRecommendations('mobile', registry);

    if (recs.length > 0) {
      expect(recs[0]).toHaveProperty('relevance');
      expect(typeof recs[0].relevance).toBe('number');
      expect(recs[0].relevance).toBeGreaterThan(0);
      expect(recs[0].relevance).toBeLessThanOrEqual(1);
    }
  });

  it('should filter out gateway tools', () => {
    const registry = createMockRegistry({
      enabledTools: [],
      allTools: ['synthesis_discover_tools', 'enable_tools', 'search_mobile_docs'],
    });

    const recs = computeRecommendations('discover enable tools', registry);

    // Should not include gateway tools in recommendations
    const hasGateway = recs.some(
      (r) => r.name === 'synthesis_discover_tools' || r.name === 'enable_tools'
    );
    expect(hasGateway).toBe(false);
  });
});

// =============================================================================
// buildSuggestion Tests
// =============================================================================

describe('buildSuggestion', () => {
  it('should return helpful message when no recommendations', () => {
    const suggestion = buildSuggestion([]);

    expect(suggestion).toBeDefined();
    expect(suggestion).toContain('No specific tools matched');
    expect(suggestion).toContain('enable_tools');
  });

  it('should return helpful message for undefined recommendations', () => {
    const suggestion = buildSuggestion(undefined);

    expect(suggestion).toBeDefined();
    expect(suggestion).toContain('No specific tools matched');
  });

  it('should mention disabled tools count', () => {
    const recs: ToolRef[] = [
      { name: 'tool1', enabled: false, toolpack: 'mobile_core' },
      { name: 'tool2', enabled: false, toolpack: 'mobile_core' },
      { name: 'tool3', enabled: true, toolpack: 'mobile_core' },
    ];

    const suggestion = buildSuggestion(recs);

    expect(suggestion).toContain('disabled');
    expect(suggestion).toContain('enable_tools');
  });

  it('should suggest relevant toolpack', () => {
    const recs: ToolRef[] = [
      { name: 'search_mobile_docs', enabled: false, toolpack: 'mobile_core' },
      { name: 'find_code_examples', enabled: false, toolpack: 'mobile_core' },
    ];

    const suggestion = buildSuggestion(recs);

    expect(suggestion).toContain('mobile_core');
  });

  it('should mention top match when all enabled', () => {
    const recs: ToolRef[] = [
      {
        name: 'search_mobile_docs',
        enabled: true,
        toolpack: 'mobile_core',
        relevance: 0.9,
      },
    ];

    const suggestion = buildSuggestion(recs);

    expect(suggestion).toContain('all enabled');
    expect(suggestion).toContain('search_mobile_docs');
  });
});
