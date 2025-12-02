/**
 * Enable Gateway Tool Tests
 *
 * Tests for the enable_tools gateway tool implementation.
 * Covers enabling by name, toolpack, category, and combined inputs.
 *
 * @module apps/mcp/src/__tests__/enable.test
 * @since GPT Phase 3: Sub-Phase 5.6.2
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  CategoryName,
  DynamicToolRegistry,
  EnableDisableResult,
  ToolpackName,
} from '../tool-registry.js';
import { buildEnableMessage, enableTools } from '../tools/enable.js';
import type { EnableToolsInput } from '../types/gateway-schemas.js';

// =============================================================================
// Mock Registry
// =============================================================================

/**
 * Create a mock DynamicToolRegistry for testing enable operations
 */
function createMockRegistry(options: {
  enabledTools?: Set<string>;
  allTools?: string[];
}): DynamicToolRegistry {
  const { enabledTools = new Set(), allTools = [] } = options;

  const enableFn = vi.fn((name: string): EnableDisableResult => {
    if (!allTools.includes(name)) {
      return { ok: false, reason: 'not_found' };
    }
    if (enabledTools.has(name)) {
      return { ok: false, reason: 'already_enabled' };
    }
    enabledTools.add(name);
    return { ok: true };
  });

  const enableToolpackFn = vi.fn((toolpack: ToolpackName): string[] => {
    // Simulate toolpack enabling based on toolpack name
    const packTools: Record<ToolpackName, string[]> = {
      core: ['search_rag', 'list_collections', 'list_documents'],
      mobile_core: ['search_mobile_docs', 'find_code_examples', 'get_feature_recipe'],
      introspection: ['get_project_tech_stack', 'get_db_schema', 'find_symbol_usages'],
      graphing: ['graph_expand_context'],
      gateway: [],
    };

    const tools = packTools[toolpack] || [];
    const enabled: string[] = [];
    for (const tool of tools) {
      if (allTools.includes(tool) && !enabledTools.has(tool)) {
        enabledTools.add(tool);
        enabled.push(tool);
      }
    }
    return enabled;
  });

  const enableCategoryFn = vi.fn((category: CategoryName): string[] => {
    // Simulate category enabling
    const catTools: Record<CategoryName, string[]> = {
      core: ['search_rag', 'list_collections'],
      mobile: ['search_mobile_docs', 'find_code_examples'],
      graph: ['graph_expand_context'],
      introspection: ['get_db_schema', 'find_symbol_usages'],
      gateway: [],
    };

    const tools = catTools[category] || [];
    const enabled: string[] = [];
    for (const tool of tools) {
      if (allTools.includes(tool) && !enabledTools.has(tool)) {
        enabledTools.add(tool);
        enabled.push(tool);
      }
    }
    return enabled;
  });

  return {
    enable: enableFn,
    enableToolpack: enableToolpackFn,
    enableCategory: enableCategoryFn,
    isEnabled: vi.fn((name: string) => enabledTools.has(name)),
    listTools: vi.fn(() => allTools),
  } as unknown as DynamicToolRegistry;
}

// =============================================================================
// enableTools - Enable by Tool Names
// =============================================================================

describe('enableTools - by tool names', () => {
  it('should enable a single tool', () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: ['search_rag', 'list_collections'],
    });

    const result = enableTools({ tools: ['search_rag'] }, registry);

    expect(result.enabled).toContain('search_rag');
    expect(result.alreadyEnabled).toHaveLength(0);
    expect(result.notFound).toHaveLength(0);
    expect(result.notificationSent).toBe(true);
  });

  it('should enable multiple tools', () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: ['search_rag', 'list_collections', 'list_documents'],
    });

    const result = enableTools(
      { tools: ['search_rag', 'list_collections', 'list_documents'] },
      registry
    );

    expect(result.enabled).toHaveLength(3);
    expect(result.enabled).toContain('search_rag');
    expect(result.enabled).toContain('list_collections');
    expect(result.enabled).toContain('list_documents');
    expect(result.notificationSent).toBe(true);
  });

  it('should report already enabled (idempotent)', () => {
    const registry = createMockRegistry({
      enabledTools: new Set(['search_rag']),
      allTools: ['search_rag', 'list_collections'],
    });

    const result = enableTools({ tools: ['search_rag'] }, registry);

    expect(result.enabled).toHaveLength(0);
    expect(result.alreadyEnabled).toContain('search_rag');
    expect(result.notificationSent).toBe(false);
  });

  it('should report not found tools', () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: ['search_rag'],
    });

    const result = enableTools({ tools: ['nonexistent_tool'] }, registry);

    expect(result.enabled).toHaveLength(0);
    expect(result.notFound).toContain('nonexistent_tool');
    expect(result.notificationSent).toBe(false);
  });

  it('should handle mixed results', () => {
    const registry = createMockRegistry({
      enabledTools: new Set(['list_collections']),
      allTools: ['search_rag', 'list_collections'],
    });

    const result = enableTools(
      { tools: ['search_rag', 'list_collections', 'nonexistent'] },
      registry
    );

    expect(result.enabled).toContain('search_rag');
    expect(result.alreadyEnabled).toContain('list_collections');
    expect(result.notFound).toContain('nonexistent');
    expect(result.notificationSent).toBe(true);
  });
});

// =============================================================================
// enableTools - Enable by Toolpack
// =============================================================================

describe('enableTools - by toolpack', () => {
  it('should enable all tools in mobile_core', () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: ['search_mobile_docs', 'find_code_examples', 'get_feature_recipe'],
    });

    const result = enableTools({ toolpacks: ['mobile_core'] }, registry);

    expect(result.enabled).toContain('search_mobile_docs');
    expect(result.enabled).toContain('find_code_examples');
    expect(result.enabled).toContain('get_feature_recipe');
    expect(result.notificationSent).toBe(true);
  });

  it('should enable all tools in introspection', () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: ['get_project_tech_stack', 'get_db_schema', 'find_symbol_usages'],
    });

    const result = enableTools({ toolpacks: ['introspection'] }, registry);

    expect(result.enabled).toContain('get_project_tech_stack');
    expect(result.enabled).toContain('get_db_schema');
    expect(result.enabled).toContain('find_symbol_usages');
  });

  it('should enable multiple toolpacks at once', () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: [
        'search_mobile_docs',
        'find_code_examples',
        'get_feature_recipe',
        'graph_expand_context',
      ],
    });

    const result = enableTools({ toolpacks: ['mobile_core', 'graphing'] }, registry);

    expect(result.enabled).toContain('search_mobile_docs');
    expect(result.enabled).toContain('graph_expand_context');
    expect(result.notificationSent).toBe(true);
  });
});

// =============================================================================
// enableTools - Enable by Category
// =============================================================================

describe('enableTools - by category', () => {
  it('should enable all tools in mobile category', () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: ['search_mobile_docs', 'find_code_examples'],
    });

    const result = enableTools({ categories: ['mobile'] }, registry);

    expect(result.enabled).toContain('search_mobile_docs');
    expect(result.enabled).toContain('find_code_examples');
    expect(result.notificationSent).toBe(true);
  });

  it('should enable all tools in graph category', () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: ['graph_expand_context'],
    });

    const result = enableTools({ categories: ['graph'] }, registry);

    expect(result.enabled).toContain('graph_expand_context');
  });
});

// =============================================================================
// enableTools - Combined Inputs
// =============================================================================

describe('enableTools - combined inputs', () => {
  it('should handle tools + toolpacks together', () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: ['search_rag', 'search_mobile_docs', 'find_code_examples', 'get_feature_recipe'],
    });

    const result = enableTools(
      {
        tools: ['search_rag'],
        toolpacks: ['mobile_core'],
      },
      registry
    );

    expect(result.enabled).toContain('search_rag');
    expect(result.enabled).toContain('search_mobile_docs');
    expect(result.notificationSent).toBe(true);
  });

  it('should handle all three: tools + toolpacks + categories', () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: [
        'search_rag',
        'search_mobile_docs',
        'find_code_examples',
        'get_feature_recipe',
        'graph_expand_context',
      ],
    });

    const result = enableTools(
      {
        tools: ['search_rag'],
        toolpacks: ['mobile_core'],
        categories: ['graph'],
      },
      registry
    );

    expect(result.enabled).toContain('search_rag');
    expect(result.enabled).toContain('search_mobile_docs');
    expect(result.enabled).toContain('graph_expand_context');
    expect(result.notificationSent).toBe(true);
  });

  it('should deduplicate when same tool from multiple sources', () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: ['search_mobile_docs', 'find_code_examples'],
    });

    // search_mobile_docs is in both tools array and mobile_core toolpack
    const result = enableTools(
      {
        tools: ['search_mobile_docs'],
        toolpacks: ['mobile_core'],
      },
      registry
    );

    // Should only appear once in enabled
    const mobileDocsCount = result.enabled.filter((t) => t === 'search_mobile_docs').length;
    expect(mobileDocsCount).toBe(1);
  });
});

// =============================================================================
// enableTools - Response Structure
// =============================================================================

describe('enableTools - response structure', () => {
  it('should have enabled array containing newly enabled', () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: ['search_rag'],
    });

    const result = enableTools({ tools: ['search_rag'] }, registry);

    expect(Array.isArray(result.enabled)).toBe(true);
    expect(result.enabled).toContain('search_rag');
  });

  it('should have alreadyEnabled for idempotent operations', () => {
    const registry = createMockRegistry({
      enabledTools: new Set(['search_rag']),
      allTools: ['search_rag'],
    });

    const result = enableTools({ tools: ['search_rag'] }, registry);

    expect(Array.isArray(result.alreadyEnabled)).toBe(true);
    expect(result.alreadyEnabled).toContain('search_rag');
  });

  it('should have notFound for invalid tool names', () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: [],
    });

    const result = enableTools({ tools: ['invalid_tool'] }, registry);

    expect(Array.isArray(result.notFound)).toBe(true);
    expect(result.notFound).toContain('invalid_tool');
  });

  it('should have human readable message', () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: ['search_rag'],
    });

    const result = enableTools({ tools: ['search_rag'] }, registry);

    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);
    expect(result.message).toContain('search_rag');
  });

  it('should set notificationSent true when enabled.length > 0', () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: ['search_rag'],
    });

    const result = enableTools({ tools: ['search_rag'] }, registry);

    expect(result.notificationSent).toBe(true);
  });

  it('should set notificationSent false when no tools enabled', () => {
    const registry = createMockRegistry({
      enabledTools: new Set(['search_rag']),
      allTools: ['search_rag'],
    });

    const result = enableTools({ tools: ['search_rag'] }, registry);

    expect(result.notificationSent).toBe(false);
  });
});

// =============================================================================
// enableTools - Edge Cases
// =============================================================================

describe('enableTools - edge cases', () => {
  it('should handle gateway tools as already enabled', () => {
    // Gateway tools are always enabled, so they should report already_enabled
    const registry = createMockRegistry({
      enabledTools: new Set(['synthesis_discover_tools', 'enable_tools']),
      allTools: ['synthesis_discover_tools', 'enable_tools'],
    });

    const result = enableTools({ tools: ['synthesis_discover_tools'] }, registry);

    expect(result.alreadyEnabled).toContain('synthesis_discover_tools');
    expect(result.enabled).not.toContain('synthesis_discover_tools');
  });

  it('should handle empty enabled result with message', () => {
    const registry = createMockRegistry({
      enabledTools: new Set(['search_rag']),
      allTools: ['search_rag'],
    });

    const result = enableTools({ tools: ['search_rag', 'nonexistent'] }, registry);

    expect(result.enabled).toHaveLength(0);
    expect(result.message).toBeDefined();
    expect(result.message.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// buildEnableMessage Tests
// =============================================================================

describe('buildEnableMessage', () => {
  it('should build message for enabled tools', () => {
    const message = buildEnableMessage(['tool1', 'tool2'], [], []);

    expect(message).toContain('Enabled 2 tool(s)');
    expect(message).toContain('tool1');
    expect(message).toContain('tool2');
  });

  it('should build message for already enabled tools', () => {
    const message = buildEnableMessage([], ['tool1'], []);

    expect(message).toContain('Already enabled');
    expect(message).toContain('tool1');
  });

  it('should build message for not found tools', () => {
    const message = buildEnableMessage([], [], ['tool1']);

    expect(message).toContain('Not found');
    expect(message).toContain('tool1');
  });

  it('should build combined message', () => {
    const message = buildEnableMessage(['new_tool'], ['old_tool'], ['bad_tool']);

    expect(message).toContain('Enabled 1 tool(s)');
    expect(message).toContain('Already enabled');
    expect(message).toContain('Not found');
  });

  it('should handle empty arrays', () => {
    const message = buildEnableMessage([], [], []);

    expect(message).toBe('No tools to enable.');
  });
});
