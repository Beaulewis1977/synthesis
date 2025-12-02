/**
 * Router Gateway Tool Tests
 *
 * Tests for the synthesis_router gateway tool implementation.
 * Covers all three router modes (auto, respect, bypass), sensitive
 * tool gating, and metadata generation.
 *
 * @module apps/mcp/src/__tests__/router.test
 * @since GPT Phase 3: Sub-Phase 5.6.3
 */

import { describe, expect, it, vi } from 'vitest';

import type {
  CategoryName,
  DynamicToolRegistry,
  EnableDisableResult,
  ToolResult,
  ToolpackName,
} from '../tool-registry.js';
import { executeViaRouter } from '../tools/router.js';
import { isRouterError, isRouterSuccess } from '../types/gateway-responses.js';
import type { RouterInput } from '../types/gateway-schemas.js';
import type { DynamicToolConfig } from '../types/profiles.js';
import type { SynthesisToolHandle } from '../types/tool-handle.js';

// =============================================================================
// Mock Registry Factory
// =============================================================================

interface MockRegistryOptions {
  enabledTools?: Set<string>;
  allTools?: string[];
  sensitiveTools?: Set<string>;
  config?: Partial<DynamicToolConfig>;
  executeResult?: ToolResult;
  executeError?: Error;
}

/**
 * Create a mock DynamicToolRegistry for testing router operations
 */
function createMockRegistry(options: MockRegistryOptions): DynamicToolRegistry {
  const {
    enabledTools = new Set(),
    allTools = [],
    sensitiveTools = new Set(),
    config = {},
    executeResult = { content: [{ type: 'text', text: '{"success": true}' }] },
    executeError,
  } = options;

  const defaultConfig: DynamicToolConfig = {
    profile: 'minimal',
    routerMode: 'auto',
    sensitiveEnforce: false,
    debug: false,
    ...config,
  };

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

  const executeFn = vi.fn(async (_name: string, _params: Record<string, unknown>) => {
    if (executeError) {
      throw executeError;
    }
    return executeResult;
  });

  const getHandleFn = vi.fn((name: string): SynthesisToolHandle | undefined => {
    if (!allTools.includes(name)) {
      return undefined;
    }
    return {
      mcpHandle: { enable: vi.fn(), disable: vi.fn(), update: vi.fn(), remove: vi.fn() },
      name,
      toolpack: 'core' as ToolpackName,
      category: 'core' as CategoryName,
      sensitive: sensitiveTools.has(name),
      version: '1.0.0',
      isEnabled: enabledTools.has(name),
      enable: vi.fn(),
      disable: vi.fn(),
    };
  });

  const getToolHandlerFn = vi.fn((name: string) => {
    if (!allTools.includes(name)) {
      return undefined;
    }
    return async () => executeResult;
  });

  return {
    enable: enableFn,
    disable: vi.fn(),
    isEnabled: vi.fn((name: string) => enabledTools.has(name)),
    getHandle: getHandleFn,
    getToolHandler: getToolHandlerFn,
    listTools: vi.fn(() => allTools),
    getConfig: vi.fn(() => defaultConfig),
    recordCall: vi.fn(),
    execute: executeFn,
  } as unknown as DynamicToolRegistry;
}

// =============================================================================
// Router Mode: auto (default)
// =============================================================================

describe('executeViaRouter - mode: auto', () => {
  it('should auto-enable disabled tool and execute', async () => {
    const enabledTools = new Set<string>();
    const registry = createMockRegistry({
      enabledTools,
      allTools: ['search_rag'],
      config: { routerMode: 'auto' },
    });

    const result = await executeViaRouter(
      { action: 'search_rag', params: { query: 'test' } },
      registry
    );

    expect(isRouterSuccess(result)).toBe(true);
    if (isRouterSuccess(result)) {
      expect(result._routerMetadata.enabledNow).toBe(true);
    }
    expect(registry.enable).toHaveBeenCalledWith('search_rag');
  });

  it('should execute already-enabled tool without re-enabling', async () => {
    const registry = createMockRegistry({
      enabledTools: new Set(['search_rag']),
      allTools: ['search_rag'],
      config: { routerMode: 'auto' },
    });

    const result = await executeViaRouter(
      { action: 'search_rag', params: { query: 'test' } },
      registry
    );

    expect(isRouterSuccess(result)).toBe(true);
    if (isRouterSuccess(result)) {
      expect(result._routerMetadata.enabledNow).toBe(false);
    }
    expect(registry.enable).not.toHaveBeenCalled();
  });

  it('should return enabledNow=true when auto-enabled', async () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: ['search_rag'],
      config: { routerMode: 'auto' },
    });

    const result = await executeViaRouter({ action: 'search_rag', params: {} }, registry);

    expect(isRouterSuccess(result)).toBe(true);
    if (isRouterSuccess(result)) {
      expect(result._routerMetadata.enabledNow).toBe(true);
    }
  });

  it('should return enabledNow=false when already enabled', async () => {
    const registry = createMockRegistry({
      enabledTools: new Set(['search_rag']),
      allTools: ['search_rag'],
      config: { routerMode: 'auto' },
    });

    const result = await executeViaRouter({ action: 'search_rag', params: {} }, registry);

    expect(isRouterSuccess(result)).toBe(true);
    if (isRouterSuccess(result)) {
      expect(result._routerMetadata.enabledNow).toBe(false);
    }
  });

  it('should block sensitive tool when sensitiveEnforce=true', async () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: ['get_db_schema'],
      sensitiveTools: new Set(['get_db_schema']),
      config: { routerMode: 'auto', sensitiveEnforce: true },
    });

    const result = await executeViaRouter({ action: 'get_db_schema', params: {} }, registry);

    expect(isRouterError(result)).toBe(true);
    if (isRouterError(result)) {
      expect(result.gated).toBe(true);
      expect(result.requiresEnable).toContain('get_db_schema');
    }
  });

  it('should include requiresEnable in sensitive gated error', async () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: ['delete_document'],
      sensitiveTools: new Set(['delete_document']),
      config: { routerMode: 'auto', sensitiveEnforce: true },
    });

    const result = await executeViaRouter({ action: 'delete_document', params: {} }, registry);

    expect(isRouterError(result)).toBe(true);
    if (isRouterError(result)) {
      expect(result.requiresEnable).toBeDefined();
      expect(result.requiresEnable).toContain('delete_document');
    }
  });

  it('should allow sensitive tool when sensitiveEnforce=false', async () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: ['get_db_schema'],
      sensitiveTools: new Set(['get_db_schema']),
      config: { routerMode: 'auto', sensitiveEnforce: false },
    });

    const result = await executeViaRouter({ action: 'get_db_schema', params: {} }, registry);

    expect(isRouterSuccess(result)).toBe(true);
    expect(registry.enable).toHaveBeenCalledWith('get_db_schema');
  });

  it('should allow sensitive tool if already enabled', async () => {
    const registry = createMockRegistry({
      enabledTools: new Set(['get_db_schema']),
      allTools: ['get_db_schema'],
      sensitiveTools: new Set(['get_db_schema']),
      config: { routerMode: 'auto', sensitiveEnforce: true },
    });

    const result = await executeViaRouter({ action: 'get_db_schema', params: {} }, registry);

    expect(isRouterSuccess(result)).toBe(true);
  });
});

// =============================================================================
// Router Mode: respect
// =============================================================================

describe('executeViaRouter - mode: respect', () => {
  it('should execute enabled tool', async () => {
    const registry = createMockRegistry({
      enabledTools: new Set(['search_rag']),
      allTools: ['search_rag'],
      config: { routerMode: 'respect' },
    });

    const result = await executeViaRouter(
      { action: 'search_rag', params: { query: 'test' } },
      registry
    );

    expect(isRouterSuccess(result)).toBe(true);
    expect(registry.execute).toHaveBeenCalled();
  });

  it('should return gated error for disabled tool', async () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: ['search_rag'],
      config: { routerMode: 'respect' },
    });

    const result = await executeViaRouter(
      { action: 'search_rag', params: { query: 'test' } },
      registry
    );

    expect(isRouterError(result)).toBe(true);
    if (isRouterError(result)) {
      expect(result.gated).toBe(true);
      expect(result.error).toContain('not enabled');
    }
  });

  it('should never auto-enable in respect mode', async () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: ['search_rag'],
      config: { routerMode: 'respect' },
    });

    await executeViaRouter({ action: 'search_rag', params: { query: 'test' } }, registry);

    expect(registry.enable).not.toHaveBeenCalled();
  });

  it('should include requiresEnable in error', async () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: ['search_rag'],
      config: { routerMode: 'respect' },
    });

    const result = await executeViaRouter({ action: 'search_rag', params: {} }, registry);

    expect(isRouterError(result)).toBe(true);
    if (isRouterError(result)) {
      expect(result.requiresEnable).toContain('search_rag');
    }
  });
});

// =============================================================================
// Router Mode: bypass
// =============================================================================

describe('executeViaRouter - mode: bypass', () => {
  it('should execute disabled tool without enabling', async () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: ['search_rag'],
      config: { routerMode: 'bypass' },
    });

    const result = await executeViaRouter(
      { action: 'search_rag', params: { query: 'test' } },
      registry
    );

    expect(isRouterSuccess(result)).toBe(true);
    expect(registry.enable).not.toHaveBeenCalled();
  });

  it('should return enabledNow=false always', async () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: ['search_rag'],
      config: { routerMode: 'bypass' },
    });

    const result = await executeViaRouter({ action: 'search_rag', params: {} }, registry);

    expect(isRouterSuccess(result)).toBe(true);
    if (isRouterSuccess(result)) {
      expect(result._routerMetadata.enabledNow).toBe(false);
    }
  });

  it('should not call registry.enable()', async () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: ['search_rag'],
      config: { routerMode: 'bypass' },
    });

    await executeViaRouter({ action: 'search_rag', params: {} }, registry);

    expect(registry.enable).not.toHaveBeenCalled();
  });

  it('should execute sensitive tool without check', async () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: ['get_db_schema'],
      sensitiveTools: new Set(['get_db_schema']),
      config: { routerMode: 'bypass', sensitiveEnforce: true },
    });

    const result = await executeViaRouter({ action: 'get_db_schema', params: {} }, registry);

    expect(isRouterSuccess(result)).toBe(true);
    expect(registry.enable).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Unknown Tool Handling
// =============================================================================

describe('executeViaRouter - unknown tool handling', () => {
  it('should return error with gated=false for unknown tool', async () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: ['search_rag'],
      config: { routerMode: 'auto' },
    });

    const result = await executeViaRouter({ action: 'unknown_tool', params: {} }, registry);

    expect(isRouterError(result)).toBe(true);
    if (isRouterError(result)) {
      expect(result.gated).toBe(false);
      expect(result.error).toContain('Unknown tool');
    }
  });

  it('should include availableActions in error', async () => {
    const registry = createMockRegistry({
      enabledTools: new Set(),
      allTools: ['search_rag', 'list_collections'],
      config: { routerMode: 'auto' },
    });

    const result = await executeViaRouter({ action: 'unknown_tool', params: {} }, registry);

    expect(isRouterError(result)).toBe(true);
    if (isRouterError(result)) {
      expect(result.availableActions).toContain('search_rag');
      expect(result.availableActions).toContain('list_collections');
    }
  });
});

// =============================================================================
// Metadata
// =============================================================================

describe('executeViaRouter - metadata', () => {
  it('should include toolVersion from handle', async () => {
    const registry = createMockRegistry({
      enabledTools: new Set(['search_rag']),
      allTools: ['search_rag'],
      config: { routerMode: 'auto' },
    });

    const result = await executeViaRouter({ action: 'search_rag', params: {} }, registry);

    expect(isRouterSuccess(result)).toBe(true);
    if (isRouterSuccess(result)) {
      expect(result._routerMetadata.toolVersion).toBe('1.0.0');
    }
  });

  it('should calculate executionMs', async () => {
    const registry = createMockRegistry({
      enabledTools: new Set(['search_rag']),
      allTools: ['search_rag'],
      config: { routerMode: 'auto' },
    });

    const result = await executeViaRouter({ action: 'search_rag', params: {} }, registry);

    expect(isRouterSuccess(result)).toBe(true);
    if (isRouterSuccess(result)) {
      expect(result._routerMetadata.executionMs).toBeGreaterThanOrEqual(0);
      expect(typeof result._routerMetadata.executionMs).toBe('number');
    }
  });

  it('should call registry.recordCall()', async () => {
    const registry = createMockRegistry({
      enabledTools: new Set(['search_rag']),
      allTools: ['search_rag'],
      config: { routerMode: 'auto' },
    });

    await executeViaRouter({ action: 'search_rag', params: {} }, registry);

    expect(registry.recordCall).toHaveBeenCalledWith('search_rag');
  });

  it('should include visibleToClient based on enabled state', async () => {
    const registry = createMockRegistry({
      enabledTools: new Set(['search_rag']),
      allTools: ['search_rag'],
      config: { routerMode: 'auto' },
    });

    const result = await executeViaRouter({ action: 'search_rag', params: {} }, registry);

    expect(isRouterSuccess(result)).toBe(true);
    if (isRouterSuccess(result)) {
      expect(typeof result._routerMetadata.visibleToClient).toBe('boolean');
    }
  });
});

// =============================================================================
// Execution Errors
// =============================================================================

describe('executeViaRouter - execution errors', () => {
  it('should handle execution errors gracefully', async () => {
    const registry = createMockRegistry({
      enabledTools: new Set(['search_rag']),
      allTools: ['search_rag'],
      config: { routerMode: 'auto' },
      executeError: new Error('Database connection failed'),
    });

    const result = await executeViaRouter({ action: 'search_rag', params: {} }, registry);

    // Router returns success but with isError flag
    expect(isRouterSuccess(result)).toBe(true);
    if (isRouterSuccess(result)) {
      expect(result.result.isError).toBe(true);
      expect(result.result.content[0].text).toContain('Database connection failed');
    }
  });

  it('should set isError flag on tool errors', async () => {
    const registry = createMockRegistry({
      enabledTools: new Set(['search_rag']),
      allTools: ['search_rag'],
      config: { routerMode: 'auto' },
      executeError: new Error('Test error'),
    });

    const result = await executeViaRouter({ action: 'search_rag', params: {} }, registry);

    expect(isRouterSuccess(result)).toBe(true);
    if (isRouterSuccess(result)) {
      expect(result.result.isError).toBe(true);
    }
  });

  it('should still include metadata on execution error', async () => {
    const registry = createMockRegistry({
      enabledTools: new Set(['search_rag']),
      allTools: ['search_rag'],
      config: { routerMode: 'auto' },
      executeError: new Error('Test error'),
    });

    const result = await executeViaRouter({ action: 'search_rag', params: {} }, registry);

    expect(isRouterSuccess(result)).toBe(true);
    if (isRouterSuccess(result)) {
      expect(result._routerMetadata).toBeDefined();
      expect(result._routerMetadata.toolVersion).toBe('1.0.0');
    }
  });
});
