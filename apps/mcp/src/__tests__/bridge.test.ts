/**
 * MCP Bridge Gateway Tool Tests
 *
 * Tests for the synthesis_mcp_bridge gateway tool implementation.
 * Verifies that bridge bypasses enable/disable state and executes
 * tools directly via the handler.
 *
 * @module apps/mcp/src/__tests__/bridge.test
 * @since GPT Phase 3: Sub-Phase 5.6.3
 */

import { describe, expect, it, vi } from 'vitest';

import type {
  CategoryName,
  DynamicToolRegistry,
  ToolResult,
  ToolpackName,
} from '../tool-registry.js';
import { executeMcpBridge } from '../tools/bridge.js';
import type { BridgeInput } from '../types/gateway-schemas.js';
import type { SynthesisToolHandle } from '../types/tool-handle.js';

// =============================================================================
// Mock Registry Factory
// =============================================================================

interface MockRegistryOptions {
  registeredTools?: Set<string>;
  enabledTools?: Set<string>;
  executeResult?: ToolResult;
  executeError?: Error;
}

/**
 * Create a mock DynamicToolRegistry for testing bridge operations
 */
function createMockRegistry(options: MockRegistryOptions): DynamicToolRegistry {
  const {
    registeredTools = new Set(),
    enabledTools = new Set(),
    executeResult = { content: [{ type: 'text', text: '{"success": true}' }] },
    executeError,
  } = options;

  const executeFn = vi.fn(async (_name: string, _params: Record<string, unknown>) => {
    if (executeError) {
      throw executeError;
    }
    return executeResult;
  });

  const getToolHandlerFn = vi.fn((name: string) => {
    if (!registeredTools.has(name)) {
      return undefined;
    }
    return async () => executeResult;
  });

  const isEnabledFn = vi.fn((name: string) => enabledTools.has(name));

  const enableFn = vi.fn();

  return {
    getToolHandler: getToolHandlerFn,
    isEnabled: isEnabledFn,
    enable: enableFn,
    disable: vi.fn(),
    execute: executeFn,
    getHandle: vi.fn(),
    listTools: vi.fn(() => Array.from(registeredTools)),
    getConfig: vi.fn(),
    recordCall: vi.fn(),
  } as unknown as DynamicToolRegistry;
}

// =============================================================================
// Successful Execution
// =============================================================================

describe('executeMcpBridge - successful execution', () => {
  it('should return success=true with result', async () => {
    const expectedResult: ToolResult = {
      content: [{ type: 'text', text: '{"data": "test"}' }],
    };
    const registry = createMockRegistry({
      registeredTools: new Set(['search_rag']),
      executeResult: expectedResult,
    });

    const result = await executeMcpBridge(
      { server: 'synthesis', tool: 'search_rag', params: { query: 'test' } },
      registry
    );

    expect(result.success).toBe(true);
    expect(result.result).toEqual(expectedResult);
    expect(result.server).toBe('synthesis');
    expect(result.tool).toBe('search_rag');
  });

  it('should execute disabled tool (bypass enable state)', async () => {
    const registry = createMockRegistry({
      registeredTools: new Set(['search_rag']),
      enabledTools: new Set(), // Tool is disabled
    });

    const result = await executeMcpBridge(
      { server: 'synthesis', tool: 'search_rag', params: {} },
      registry
    );

    expect(result.success).toBe(true);
    expect(registry.execute).toHaveBeenCalledWith('search_rag', {});
  });

  it('should execute enabled tool', async () => {
    const registry = createMockRegistry({
      registeredTools: new Set(['search_rag']),
      enabledTools: new Set(['search_rag']), // Tool is enabled
    });

    const result = await executeMcpBridge(
      { server: 'synthesis', tool: 'search_rag', params: {} },
      registry
    );

    expect(result.success).toBe(true);
    expect(registry.execute).toHaveBeenCalledWith('search_rag', {});
  });

  it('should pass params to execute correctly', async () => {
    const registry = createMockRegistry({
      registeredTools: new Set(['search_rag']),
    });

    const params = { collectionId: 'abc-123', query: 'flutter auth', top_k: 10 };
    await executeMcpBridge({ server: 'synthesis', tool: 'search_rag', params }, registry);

    expect(registry.execute).toHaveBeenCalledWith('search_rag', params);
  });
});

// =============================================================================
// Tool Not Found
// =============================================================================

describe('executeMcpBridge - tool not found', () => {
  it('should return success=false for unknown tool', async () => {
    const registry = createMockRegistry({
      registeredTools: new Set(['search_rag']),
    });

    const result = await executeMcpBridge(
      { server: 'synthesis', tool: 'unknown_tool', params: {} },
      registry
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should include tool name in error message', async () => {
    const registry = createMockRegistry({
      registeredTools: new Set(['search_rag']),
    });

    const result = await executeMcpBridge(
      { server: 'synthesis', tool: 'my_custom_tool', params: {} },
      registry
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('my_custom_tool');
  });

  it('should include server name in error response', async () => {
    const registry = createMockRegistry({
      registeredTools: new Set(['search_rag']),
    });

    const result = await executeMcpBridge(
      { server: 'synthesis', tool: 'unknown_tool', params: {} },
      registry
    );

    expect(result.success).toBe(false);
    expect(result.server).toBe('synthesis');
    expect(result.tool).toBe('unknown_tool');
  });
});

// =============================================================================
// Bypasses Enable State
// =============================================================================

describe('executeMcpBridge - bypasses enable state', () => {
  it('should not check registry.isEnabled()', async () => {
    const registry = createMockRegistry({
      registeredTools: new Set(['search_rag']),
      enabledTools: new Set(),
    });

    await executeMcpBridge({ server: 'synthesis', tool: 'search_rag', params: {} }, registry);

    // Bridge uses getToolHandler to check existence, not isEnabled
    expect(registry.isEnabled).not.toHaveBeenCalled();
  });

  it('should not call registry.enable()', async () => {
    const registry = createMockRegistry({
      registeredTools: new Set(['search_rag']),
      enabledTools: new Set(),
    });

    await executeMcpBridge({ server: 'synthesis', tool: 'search_rag', params: {} }, registry);

    expect(registry.enable).not.toHaveBeenCalled();
  });

  it('should not modify tool visibility', async () => {
    const enabledTools = new Set<string>();
    const registry = createMockRegistry({
      registeredTools: new Set(['search_rag']),
      enabledTools,
    });

    await executeMcpBridge({ server: 'synthesis', tool: 'search_rag', params: {} }, registry);

    // Tool should remain disabled
    expect(enabledTools.has('search_rag')).toBe(false);
    expect(registry.enable).not.toHaveBeenCalled();
  });

  it('should use getToolHandler to check existence (not getHandle)', async () => {
    const registry = createMockRegistry({
      registeredTools: new Set(['search_rag']),
    });

    await executeMcpBridge({ server: 'synthesis', tool: 'search_rag', params: {} }, registry);

    expect(registry.getToolHandler).toHaveBeenCalledWith('search_rag');
  });
});

// =============================================================================
// Server Validation
// =============================================================================

describe('executeMcpBridge - server validation', () => {
  it('should only accept synthesis server', async () => {
    const registry = createMockRegistry({
      registeredTools: new Set(['search_rag']),
    });

    const result = await executeMcpBridge(
      { server: 'synthesis', tool: 'search_rag', params: {} },
      registry
    );

    expect(result.success).toBe(true);
    expect(result.server).toBe('synthesis');
  });

  it('should reject unknown server', async () => {
    const registry = createMockRegistry({
      registeredTools: new Set(['search_rag']),
    });

    // TypeScript would prevent this, but we test runtime behavior
    const result = await executeMcpBridge(
      { server: 'other_server' as 'synthesis', tool: 'search_rag', params: {} },
      registry
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('other_server');
  });
});

// =============================================================================
// Error Handling
// =============================================================================

describe('executeMcpBridge - error handling', () => {
  it('should capture execution errors', async () => {
    const registry = createMockRegistry({
      registeredTools: new Set(['search_rag']),
      executeError: new Error('Database connection failed'),
    });

    const result = await executeMcpBridge(
      { server: 'synthesis', tool: 'search_rag', params: {} },
      registry
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Database connection failed');
  });

  it('should return success=false on error', async () => {
    const registry = createMockRegistry({
      registeredTools: new Set(['search_rag']),
      executeError: new Error('Some error'),
    });

    const result = await executeMcpBridge(
      { server: 'synthesis', tool: 'search_rag', params: {} },
      registry
    );

    expect(result.success).toBe(false);
    expect(result.result).toBeUndefined();
  });

  it('should include tool name in execution error', async () => {
    const registry = createMockRegistry({
      registeredTools: new Set(['list_collections']),
      executeError: new Error('API failure'),
    });

    const result = await executeMcpBridge(
      { server: 'synthesis', tool: 'list_collections', params: {} },
      registry
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('list_collections');
    expect(result.error).toContain('API failure');
  });

  it('should handle non-Error exceptions', async () => {
    const registry = createMockRegistry({
      registeredTools: new Set(['search_rag']),
    });

    // Make execute throw a non-Error
    (registry.execute as ReturnType<typeof vi.fn>).mockRejectedValueOnce('string error');

    const result = await executeMcpBridge(
      { server: 'synthesis', tool: 'search_rag', params: {} },
      registry
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown error');
  });
});

// =============================================================================
// Result Structure
// =============================================================================

describe('executeMcpBridge - result structure', () => {
  it('should include server and tool in success response', async () => {
    const registry = createMockRegistry({
      registeredTools: new Set(['search_rag']),
    });

    const result = await executeMcpBridge(
      { server: 'synthesis', tool: 'search_rag', params: {} },
      registry
    );

    expect(result.success).toBe(true);
    expect(result.server).toBe('synthesis');
    expect(result.tool).toBe('search_rag');
  });

  it('should include server and tool in error response', async () => {
    const registry = createMockRegistry({
      registeredTools: new Set(['search_rag']),
      executeError: new Error('fail'),
    });

    const result = await executeMcpBridge(
      { server: 'synthesis', tool: 'search_rag', params: {} },
      registry
    );

    expect(result.success).toBe(false);
    expect(result.server).toBe('synthesis');
    expect(result.tool).toBe('search_rag');
  });

  it('should preserve result structure from registry.execute', async () => {
    const complexResult: ToolResult = {
      content: [{ type: 'text', text: '{"chunks": [], "count": 0}' }],
      isError: false,
    };
    const registry = createMockRegistry({
      registeredTools: new Set(['search_rag']),
      executeResult: complexResult,
    });

    const result = await executeMcpBridge(
      { server: 'synthesis', tool: 'search_rag', params: {} },
      registry
    );

    expect(result.success).toBe(true);
    expect(result.result).toEqual(complexResult);
  });
});
