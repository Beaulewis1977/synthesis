/**
 * Gateway Integration Tests
 *
 * End-to-end integration tests for the dynamic tool management system.
 * Tests cross-module flows, env var interactions, and state transitions.
 *
 * Focus: Integration flows, NOT duplicating unit tests.
 *
 * Test Categories (~46 tests):
 * - Profile Application (6)
 * - Discover → Enable → Call (8)
 * - Router Auto-Enable (8)
 * - Sensitive Gating (6)
 * - Bridge Bypass (5)
 * - Gateway Protection (4)
 * - Client Compatibility (5)
 * - Multi-Step Workflows (4)
 *
 * @module apps/mcp/src/__tests__/gateway-integration.test
 * @since GPT Phase 3: Sub-Phase 5.6.4
 */

import { describe, expect, it, vi } from 'vitest';

import type {
  CategoryName,
  DynamicToolRegistry,
  EnableDisableResult,
  ToolResult,
  ToolpackName,
} from '../tool-registry.js';
import { executeMcpBridge } from '../tools/bridge.js';
import { buildDiscoverResult, computeRecommendations } from '../tools/discover.js';
import { enableTools } from '../tools/enable.js';
import { executeViaRouter } from '../tools/router.js';
import { isRouterError, isRouterSuccess } from '../types/gateway-responses.js';
import type { DynamicToolConfig } from '../types/profiles.js';
import type { SynthesisToolHandle } from '../types/tool-handle.js';

// =============================================================================
// Test Constants
// =============================================================================

/**
 * All 22 tools registered in the Synthesis MCP server
 */
const ALL_22_TOOLS = [
  // Core (10)
  'search_rag',
  'list_collections',
  'list_documents',
  'create_collection',
  'fetch_and_add_document_from_url',
  'delete_document',
  'delete_collection',
  'add_repo_to_collection',
  'sync_repo',
  'list_repos',
  // Mobile Core (3)
  'search_mobile_docs',
  'find_code_examples',
  'get_feature_recipe',
  // Introspection (3)
  'get_project_tech_stack',
  'get_db_schema',
  'find_symbol_usages',
  // Graphing (1)
  'graph_expand_context',
  // Gateway (5)
  'synthesis_discover_tools',
  'enable_tools',
  'synthesis_router',
  'synthesis_mcp_bridge',
  'synthesis_search',
];

/**
 * Gateway tools (always enabled)
 */
const GATEWAY_TOOLS = [
  'synthesis_discover_tools',
  'enable_tools',
  'synthesis_router',
  'synthesis_mcp_bridge',
  'synthesis_search',
];

/**
 * Core toolpack tools
 */
const CORE_TOOLS = [
  'search_rag',
  'list_collections',
  'list_documents',
  'create_collection',
  'fetch_and_add_document_from_url',
  'delete_document',
  'delete_collection',
  'add_repo_to_collection',
  'sync_repo',
  'list_repos',
];

/**
 * Mobile core toolpack tools
 */
const MOBILE_CORE_TOOLS = ['search_mobile_docs', 'find_code_examples', 'get_feature_recipe'];

/**
 * Introspection toolpack tools
 */
const INTROSPECTION_TOOLS = ['get_project_tech_stack', 'get_db_schema', 'find_symbol_usages'];

/**
 * Graphing toolpack tools
 */
const GRAPHING_TOOLS = ['graph_expand_context'];

/**
 * Sensitive tools requiring explicit enable when ROUTER_SENSITIVE_ENFORCE=true
 */
const SENSITIVE_TOOLS = ['delete_document', 'delete_collection', 'get_db_schema'];

/**
 * Tool metadata for mock factory
 */
const TOOL_METADATA: Record<string, { toolpack: ToolpackName; category: CategoryName }> = {
  // Core
  search_rag: { toolpack: 'core', category: 'core' },
  list_collections: { toolpack: 'core', category: 'core' },
  list_documents: { toolpack: 'core', category: 'core' },
  create_collection: { toolpack: 'core', category: 'core' },
  fetch_and_add_document_from_url: { toolpack: 'core', category: 'core' },
  delete_document: { toolpack: 'core', category: 'core' },
  delete_collection: { toolpack: 'core', category: 'core' },
  add_repo_to_collection: { toolpack: 'core', category: 'core' },
  sync_repo: { toolpack: 'core', category: 'core' },
  list_repos: { toolpack: 'core', category: 'core' },
  // Mobile Core
  search_mobile_docs: { toolpack: 'mobile_core', category: 'mobile' },
  find_code_examples: { toolpack: 'mobile_core', category: 'mobile' },
  get_feature_recipe: { toolpack: 'mobile_core', category: 'mobile' },
  // Introspection
  get_project_tech_stack: { toolpack: 'introspection', category: 'introspection' },
  get_db_schema: { toolpack: 'introspection', category: 'introspection' },
  find_symbol_usages: { toolpack: 'introspection', category: 'introspection' },
  // Graphing
  graph_expand_context: { toolpack: 'graphing', category: 'graph' },
  // Gateway
  synthesis_discover_tools: { toolpack: 'gateway', category: 'gateway' },
  enable_tools: { toolpack: 'gateway', category: 'gateway' },
  synthesis_router: { toolpack: 'gateway', category: 'gateway' },
  synthesis_mcp_bridge: { toolpack: 'gateway', category: 'gateway' },
  synthesis_search: { toolpack: 'gateway', category: 'gateway' },
};

/**
 * Toolpack definitions for the mock factory
 */
const TOOLPACK_TOOLS: Record<ToolpackName, string[]> = {
  core: CORE_TOOLS,
  mobile_core: MOBILE_CORE_TOOLS,
  introspection: INTROSPECTION_TOOLS,
  graphing: GRAPHING_TOOLS,
  gateway: GATEWAY_TOOLS,
};

// =============================================================================
// Integration Mock Factory
// =============================================================================

interface IntegrationMockOptions {
  /** Tools that start as enabled */
  enabledTools?: Set<string>;
  /** All tools available in the registry */
  allTools?: string[];
  /** Tools marked as sensitive */
  sensitiveTools?: Set<string>;
  /** Configuration overrides */
  config?: Partial<DynamicToolConfig>;
  /** Result to return from execute() */
  executeResult?: ToolResult;
  /** Error to throw from execute() */
  executeError?: Error;
}

interface MockState {
  /** Tracking notifications sent */
  notifications: string[];
  /** Currently enabled tools (mutable) */
  enabledTools: Set<string>;
  /** Call counts per tool */
  callCounts: Map<string, number>;
}

/**
 * Create an extended mock DynamicToolRegistry for integration testing
 *
 * This factory extends the pattern from router.test.ts with additional
 * capabilities for integration testing:
 * - State tracking (notifications, enabled set)
 * - Toolpack/category operations
 * - Profile-aware behavior
 */
function createIntegrationMockRegistry(options: IntegrationMockOptions = {}): {
  registry: DynamicToolRegistry;
  state: MockState;
} {
  const {
    enabledTools = new Set<string>(),
    allTools = ALL_22_TOOLS,
    sensitiveTools = new Set(SENSITIVE_TOOLS),
    config = {},
    executeResult = { content: [{ type: 'text' as const, text: '{"success": true}' }] },
    executeError,
  } = options;

  // Mutable state for tracking
  const state: MockState = {
    notifications: [],
    enabledTools: new Set(enabledTools),
    callCounts: new Map(),
  };

  const defaultConfig: DynamicToolConfig = {
    profile: 'minimal',
    routerMode: 'auto',
    sensitiveEnforce: false,
    debug: false,
    ...config,
  };

  // Enable function
  const enableFn = vi.fn((name: string): EnableDisableResult => {
    if (!allTools.includes(name)) {
      return { ok: false, reason: 'not_found' };
    }
    // Gateway tools are protected from state changes
    if (GATEWAY_TOOLS.includes(name) && state.enabledTools.has(name)) {
      return { ok: false, reason: 'already_enabled' };
    }
    if (state.enabledTools.has(name)) {
      return { ok: false, reason: 'already_enabled' };
    }
    state.enabledTools.add(name);
    state.notifications.push(`enabled:${name}`);
    return { ok: true };
  });

  // Disable function
  const disableFn = vi.fn((name: string): EnableDisableResult => {
    if (!allTools.includes(name)) {
      return { ok: false, reason: 'not_found' };
    }
    // Gateway tools cannot be disabled
    if (GATEWAY_TOOLS.includes(name)) {
      return { ok: false, reason: 'gateway_protected' as const };
    }
    if (!state.enabledTools.has(name)) {
      return { ok: false, reason: 'already_disabled' };
    }
    state.enabledTools.delete(name);
    state.notifications.push(`disabled:${name}`);
    return { ok: true };
  });

  // Enable toolpack
  const enableToolpackFn = vi.fn((toolpack: ToolpackName): string[] => {
    const tools = TOOLPACK_TOOLS[toolpack] || [];
    const enabled: string[] = [];
    for (const tool of tools) {
      if (allTools.includes(tool) && !state.enabledTools.has(tool)) {
        state.enabledTools.add(tool);
        enabled.push(tool);
        state.notifications.push(`enabled:${tool}`);
      }
    }
    return enabled;
  });

  // Enable category
  const enableCategoryFn = vi.fn((category: CategoryName): string[] => {
    const enabled: string[] = [];
    for (const [tool, meta] of Object.entries(TOOL_METADATA)) {
      if (meta.category === category && allTools.includes(tool) && !state.enabledTools.has(tool)) {
        state.enabledTools.add(tool);
        enabled.push(tool);
        state.notifications.push(`enabled:${tool}`);
      }
    }
    return enabled;
  });

  // Get handle
  const getHandleFn = vi.fn((name: string): SynthesisToolHandle | undefined => {
    if (!allTools.includes(name)) {
      return undefined;
    }
    const meta = TOOL_METADATA[name] || { toolpack: 'core', category: 'core' };
    return {
      mcpHandle: { enable: vi.fn(), disable: vi.fn(), update: vi.fn(), remove: vi.fn() },
      name,
      toolpack: meta.toolpack,
      category: meta.category,
      sensitive: sensitiveTools.has(name),
      version: '1.0.0',
      description: `${name} description`,
      inputSchemaJson: {},
      isEnabled: state.enabledTools.has(name),
      enable: vi.fn(() => {
        state.enabledTools.add(name);
      }),
      disable: vi.fn(() => {
        state.enabledTools.delete(name);
      }),
    };
  });

  // Get tool handler
  const getToolHandlerFn = vi.fn((name: string) => {
    if (!allTools.includes(name)) {
      return undefined;
    }
    return async () => executeResult;
  });

  // Execute
  const executeFn = vi.fn(async (_name: string, _params: Record<string, unknown>) => {
    if (executeError) {
      throw executeError;
    }
    return executeResult;
  });

  // Record call
  const recordCallFn = vi.fn((name: string) => {
    const count = state.callCounts.get(name) || 0;
    state.callCounts.set(name, count + 1);
  });

  const registry: DynamicToolRegistry = {
    enable: enableFn,
    disable: disableFn,
    enableToolpack: enableToolpackFn,
    enableCategory: enableCategoryFn,
    isEnabled: vi.fn((name: string) => state.enabledTools.has(name)),
    getHandle: getHandleFn,
    getToolHandler: getToolHandlerFn,
    listTools: vi.fn(() => allTools),
    getConfig: vi.fn(() => defaultConfig),
    recordCall: recordCallFn,
    execute: executeFn,
    size: allTools.length,
    getEnabledCount: vi.fn(() => state.enabledTools.size),
  } as unknown as DynamicToolRegistry;

  return { registry, state };
}

/**
 * Create minimal profile enabled set (gateway + list_collections)
 */
function createMinimalEnabledSet(): Set<string> {
  return new Set([...GATEWAY_TOOLS, 'list_collections']);
}

/**
 * Create mobile profile enabled set
 */
function createMobileEnabledSet(): Set<string> {
  return new Set([
    ...GATEWAY_TOOLS,
    ...MOBILE_CORE_TOOLS,
    'list_collections',
    'list_documents',
    'search_rag',
  ]);
}

/**
 * Create full profile enabled set (all tools)
 */
function createFullEnabledSet(): Set<string> {
  return new Set(ALL_22_TOOLS);
}

// =============================================================================
// 1. Profile Application Tests (6 tests)
// =============================================================================

describe('Integration: Profile Application', () => {
  it('minimal profile: 6 tools enabled (5 gateway + list_collections)', () => {
    const { state } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
      config: { profile: 'minimal' },
    });

    expect(state.enabledTools.size).toBe(6);
    // Gateway tools all enabled
    for (const gw of GATEWAY_TOOLS) {
      expect(state.enabledTools.has(gw)).toBe(true);
    }
    // Plus list_collections
    expect(state.enabledTools.has('list_collections')).toBe(true);
  });

  it('mobile profile: ~11 tools enabled (gateway + mobile_core + additionals)', () => {
    const { state } = createIntegrationMockRegistry({
      enabledTools: createMobileEnabledSet(),
      config: { profile: 'mobile' },
    });

    expect(state.enabledTools.size).toBe(11);
    // Gateway tools all enabled
    for (const gw of GATEWAY_TOOLS) {
      expect(state.enabledTools.has(gw)).toBe(true);
    }
    // Mobile core tools
    for (const mobile of MOBILE_CORE_TOOLS) {
      expect(state.enabledTools.has(mobile)).toBe(true);
    }
    // Additional tools
    expect(state.enabledTools.has('list_collections')).toBe(true);
    expect(state.enabledTools.has('list_documents')).toBe(true);
    expect(state.enabledTools.has('search_rag')).toBe(true);
  });

  it('full profile: All 22 tools enabled', () => {
    const { state } = createIntegrationMockRegistry({
      enabledTools: createFullEnabledSet(),
      config: { profile: 'full' },
    });

    expect(state.enabledTools.size).toBe(22);
    for (const tool of ALL_22_TOOLS) {
      expect(state.enabledTools.has(tool)).toBe(true);
    }
  });

  it('enabled set changes correctly when enabling a toolpack', () => {
    const { registry, state } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
      config: { profile: 'minimal' },
    });

    expect(state.enabledTools.size).toBe(6);

    // Enable mobile_core toolpack
    const result = enableTools({ toolpacks: ['mobile_core'] }, registry);

    expect(result.enabled.length).toBe(3);
    expect(state.enabledTools.size).toBe(9); // 6 + 3 mobile tools
    for (const mobile of MOBILE_CORE_TOOLS) {
      expect(state.enabledTools.has(mobile)).toBe(true);
    }
  });

  it('gateway tools remain enabled across all profiles', () => {
    // Check minimal
    const minimal = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
      config: { profile: 'minimal' },
    });
    for (const gw of GATEWAY_TOOLS) {
      expect(minimal.state.enabledTools.has(gw)).toBe(true);
    }

    // Check mobile
    const mobile = createIntegrationMockRegistry({
      enabledTools: createMobileEnabledSet(),
      config: { profile: 'mobile' },
    });
    for (const gw of GATEWAY_TOOLS) {
      expect(mobile.state.enabledTools.has(gw)).toBe(true);
    }

    // Check full
    const full = createIntegrationMockRegistry({
      enabledTools: createFullEnabledSet(),
      config: { profile: 'full' },
    });
    for (const gw of GATEWAY_TOOLS) {
      expect(full.state.enabledTools.has(gw)).toBe(true);
    }
  });

  it('profile switch updates enabled set correctly', () => {
    // Start with minimal
    const { registry, state } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
      config: { profile: 'minimal' },
    });

    expect(state.enabledTools.size).toBe(6);

    // Simulate switching to mobile by enabling relevant tools
    enableTools({ toolpacks: ['mobile_core'] }, registry);
    enableTools({ tools: ['list_documents', 'search_rag'] }, registry);

    expect(state.enabledTools.size).toBe(11);
    // Mobile core enabled
    for (const mobile of MOBILE_CORE_TOOLS) {
      expect(state.enabledTools.has(mobile)).toBe(true);
    }
  });
});

// =============================================================================
// 2. Discover → Enable → Call Workflow Tests (8 tests)
// =============================================================================

describe('Integration: Discover → Enable → Call Workflow', () => {
  it('recommends mobile_core tools for "flutter auth" task', () => {
    const { registry } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
    });

    const recommendations = computeRecommendations('flutter authentication', registry);

    expect(recommendations.length).toBeGreaterThan(0);
    // Should recommend mobile tools
    const hasFlutterTool = recommendations.some(
      (r) => r.toolpack === 'mobile_core' || r.name.includes('mobile')
    );
    expect(hasFlutterTool).toBe(true);
  });

  it('recommends introspection tools for "database schema" task', () => {
    const { registry } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
    });

    const recommendations = computeRecommendations('database schema analysis', registry);

    expect(recommendations.length).toBeGreaterThan(0);
    // Should include get_db_schema
    const hasSchemaTools = recommendations.some(
      (r) => r.name === 'get_db_schema' || r.category === 'introspection'
    );
    expect(hasSchemaTools).toBe(true);
  });

  it('enable recommended tools emits notification', () => {
    const { registry, state } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
    });

    // Enable mobile_core
    const result = enableTools({ toolpacks: ['mobile_core'] }, registry);

    expect(result.notificationSent).toBe(true);
    expect(result.enabled.length).toBe(3);
    // Notifications were recorded
    expect(state.notifications.filter((n) => n.startsWith('enabled:')).length).toBe(3);
  });

  it('enabled tool can be called via router successfully', async () => {
    const { registry, state } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
      config: { routerMode: 'auto' },
    });

    // Enable search_mobile_docs first
    enableTools({ tools: ['search_mobile_docs'] }, registry);
    expect(state.enabledTools.has('search_mobile_docs')).toBe(true);

    // Call via router
    const result = await executeViaRouter(
      { action: 'search_mobile_docs', params: { query: 'flutter' } },
      registry
    );

    expect(isRouterSuccess(result)).toBe(true);
  });

  it('re-discover shows updated enabled counts', () => {
    const { registry } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
    });

    // Initial discover
    const before = buildDiscoverResult({ list_all: true }, registry);
    const mobilePackBefore = before.toolpacks.find((t) => t.name === 'mobile_core');
    expect(mobilePackBefore?.enabledCount).toBe(0);

    // Enable mobile_core
    enableTools({ toolpacks: ['mobile_core'] }, registry);

    // Re-discover
    const after = buildDiscoverResult({ list_all: true }, registry);
    const mobilePackAfter = after.toolpacks.find((t) => t.name === 'mobile_core');
    expect(mobilePackAfter?.enabledCount).toBe(3);
  });

  it('state transitions tracked correctly across operations', () => {
    const { registry, state } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
    });

    // Track initial state
    const initialEnabled = state.enabledTools.size;
    expect(initialEnabled).toBe(6);

    // Enable a toolpack
    enableTools({ toolpacks: ['mobile_core'] }, registry);
    expect(state.enabledTools.size).toBe(9);

    // Enable individual tool
    enableTools({ tools: ['graph_expand_context'] }, registry);
    expect(state.enabledTools.size).toBe(10);

    // Verify notifications
    expect(state.notifications.length).toBe(4); // 3 mobile + 1 graph
  });

  it('discover result includes recommendation with enabled state', () => {
    const { registry } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
    });

    const result = buildDiscoverResult({ task: 'mobile flutter app' }, registry);

    expect(result.recommended).toBeDefined();
    if (result.recommended && result.recommended.length > 0) {
      // Each recommendation should have enabled field
      for (const rec of result.recommended) {
        expect(typeof rec.enabled).toBe('boolean');
      }
    }
  });

  it('discover suggestion guides next action', () => {
    const { registry } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
    });

    const result = buildDiscoverResult({ task: 'search for mobile docs' }, registry);

    expect(result.suggestion).toBeDefined();
    // Suggestion should mention enable_tools when tools are disabled
    if (result.suggestion) {
      expect(result.suggestion.length).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// 3. Router Auto-Enable Tests (8 tests)
// =============================================================================

describe('Integration: Router Auto-Enable Flow', () => {
  it('ROUTER_MODE=auto: auto-enables disabled tool, enabledNow=true', async () => {
    const { registry, state } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
      config: { routerMode: 'auto' },
    });

    expect(state.enabledTools.has('search_rag')).toBe(false);

    const result = await executeViaRouter({ action: 'search_rag', params: {} }, registry);

    expect(isRouterSuccess(result)).toBe(true);
    if (isRouterSuccess(result)) {
      expect(result._routerMetadata.enabledNow).toBe(true);
    }
    expect(state.enabledTools.has('search_rag')).toBe(true);
  });

  it('ROUTER_MODE=respect: fails for disabled tool, gated=true', async () => {
    const { registry, state } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
      config: { routerMode: 'respect' },
    });

    expect(state.enabledTools.has('search_rag')).toBe(false);

    const result = await executeViaRouter({ action: 'search_rag', params: {} }, registry);

    expect(isRouterError(result)).toBe(true);
    if (isRouterError(result)) {
      expect(result.gated).toBe(true);
    }
    // Tool should NOT be enabled
    expect(state.enabledTools.has('search_rag')).toBe(false);
  });

  it('ROUTER_MODE=bypass: executes without enabling, enabledNow=false', async () => {
    const { registry, state } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
      config: { routerMode: 'bypass' },
    });

    expect(state.enabledTools.has('search_rag')).toBe(false);

    const result = await executeViaRouter({ action: 'search_rag', params: {} }, registry);

    expect(isRouterSuccess(result)).toBe(true);
    if (isRouterSuccess(result)) {
      expect(result._routerMetadata.enabledNow).toBe(false);
    }
    // Tool should NOT be enabled (bypass doesn't change state)
    expect(state.enabledTools.has('search_rag')).toBe(false);
  });

  it('tool visible in enabled set after auto-enable', async () => {
    const { registry, state } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
      config: { routerMode: 'auto' },
    });

    // Verify initial state
    expect(state.enabledTools.has('find_code_examples')).toBe(false);

    // Auto-enable via router
    await executeViaRouter({ action: 'find_code_examples', params: {} }, registry);

    // Now visible
    expect(state.enabledTools.has('find_code_examples')).toBe(true);
  });

  it('auto-enabled tool works on subsequent calls without re-enable', async () => {
    const { registry } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
      config: { routerMode: 'auto' },
    });

    // First call - auto-enables
    const first = await executeViaRouter({ action: 'search_rag', params: {} }, registry);
    expect(isRouterSuccess(first)).toBe(true);
    if (isRouterSuccess(first)) {
      expect(first._routerMetadata.enabledNow).toBe(true);
    }

    // Second call - already enabled
    const second = await executeViaRouter({ action: 'search_rag', params: {} }, registry);
    expect(isRouterSuccess(second)).toBe(true);
    if (isRouterSuccess(second)) {
      expect(second._routerMetadata.enabledNow).toBe(false);
    }
  });

  it('respect mode returns requiresEnable array', async () => {
    const { registry } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
      config: { routerMode: 'respect' },
    });

    const result = await executeViaRouter({ action: 'search_rag', params: {} }, registry);

    expect(isRouterError(result)).toBe(true);
    if (isRouterError(result)) {
      expect(result.requiresEnable).toBeDefined();
      expect(result.requiresEnable).toContain('search_rag');
    }
  });

  it('bypass mode executes sensitive tools without check', async () => {
    const { registry, state } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
      sensitiveTools: new Set(SENSITIVE_TOOLS),
      config: { routerMode: 'bypass', sensitiveEnforce: true },
    });

    // Even with sensitiveEnforce=true, bypass mode ignores it
    const result = await executeViaRouter({ action: 'get_db_schema', params: {} }, registry);

    expect(isRouterSuccess(result)).toBe(true);
    // Tool NOT enabled (bypass doesn't change state)
    expect(state.enabledTools.has('get_db_schema')).toBe(false);
  });

  it('auto mode records tool call after execution', async () => {
    const { registry } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
      config: { routerMode: 'auto' },
    });

    await executeViaRouter({ action: 'search_rag', params: {} }, registry);

    expect(registry.recordCall).toHaveBeenCalledWith('search_rag');
  });
});

// =============================================================================
// 4. Sensitive Tool Gating Tests (6 tests)
// =============================================================================

describe('Integration: Sensitive Tool Gating', () => {
  it('ROUTER_SENSITIVE_ENFORCE=true blocks get_db_schema', async () => {
    const { registry } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
      sensitiveTools: new Set(SENSITIVE_TOOLS),
      config: { routerMode: 'auto', sensitiveEnforce: true },
    });

    const result = await executeViaRouter({ action: 'get_db_schema', params: {} }, registry);

    expect(isRouterError(result)).toBe(true);
    if (isRouterError(result)) {
      expect(result.gated).toBe(true);
    }
  });

  it('ROUTER_SENSITIVE_ENFORCE=true blocks delete_document', async () => {
    const { registry } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
      sensitiveTools: new Set(SENSITIVE_TOOLS),
      config: { routerMode: 'auto', sensitiveEnforce: true },
    });

    const result = await executeViaRouter({ action: 'delete_document', params: {} }, registry);

    expect(isRouterError(result)).toBe(true);
    if (isRouterError(result)) {
      expect(result.gated).toBe(true);
    }
  });

  it('ROUTER_SENSITIVE_ENFORCE=true blocks delete_collection', async () => {
    const { registry } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
      sensitiveTools: new Set(SENSITIVE_TOOLS),
      config: { routerMode: 'auto', sensitiveEnforce: true },
    });

    const result = await executeViaRouter({ action: 'delete_collection', params: {} }, registry);

    expect(isRouterError(result)).toBe(true);
    if (isRouterError(result)) {
      expect(result.gated).toBe(true);
    }
  });

  it('sensitive gated error includes requiresEnable array', async () => {
    const { registry } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
      sensitiveTools: new Set(SENSITIVE_TOOLS),
      config: { routerMode: 'auto', sensitiveEnforce: true },
    });

    const result = await executeViaRouter({ action: 'get_db_schema', params: {} }, registry);

    expect(isRouterError(result)).toBe(true);
    if (isRouterError(result)) {
      expect(result.requiresEnable).toBeDefined();
      expect(result.requiresEnable).toContain('get_db_schema');
    }
  });

  it('after explicit enable, sensitive tool executes successfully', async () => {
    const { registry, state } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
      sensitiveTools: new Set(SENSITIVE_TOOLS),
      config: { routerMode: 'auto', sensitiveEnforce: true },
    });

    // Explicitly enable
    enableTools({ tools: ['get_db_schema'] }, registry);
    expect(state.enabledTools.has('get_db_schema')).toBe(true);

    // Now execute
    const result = await executeViaRouter({ action: 'get_db_schema', params: {} }, registry);

    expect(isRouterSuccess(result)).toBe(true);
  });

  it('already-enabled sensitive tools execute normally', async () => {
    const enabledWithSensitive = createMinimalEnabledSet();
    enabledWithSensitive.add('get_db_schema');

    const { registry } = createIntegrationMockRegistry({
      enabledTools: enabledWithSensitive,
      sensitiveTools: new Set(SENSITIVE_TOOLS),
      config: { routerMode: 'auto', sensitiveEnforce: true },
    });

    const result = await executeViaRouter({ action: 'get_db_schema', params: {} }, registry);

    expect(isRouterSuccess(result)).toBe(true);
  });
});

// =============================================================================
// 5. Bridge Bypass Tests (5 tests)
// =============================================================================

describe('Integration: Bridge Bypass Flow', () => {
  it('executes disabled tool via bridge successfully', async () => {
    const { registry, state } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
    });

    expect(state.enabledTools.has('search_rag')).toBe(false);

    const result = await executeMcpBridge(
      { server: 'synthesis', tool: 'search_rag', params: {} },
      registry
    );

    expect(result.success).toBe(true);
  });

  it("bridge doesn't call registry.enable()", async () => {
    const { registry, state } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
    });

    await executeMcpBridge({ server: 'synthesis', tool: 'search_rag', params: {} }, registry);

    // Enable should not have been called
    expect(registry.enable).not.toHaveBeenCalled();
    // Tool should still be disabled
    expect(state.enabledTools.has('search_rag')).toBe(false);
  });

  it('bridge works when router (respect mode) fails', async () => {
    const { registry } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
      config: { routerMode: 'respect' },
    });

    // Router fails in respect mode
    const routerResult = await executeViaRouter({ action: 'search_rag', params: {} }, registry);
    expect(isRouterError(routerResult)).toBe(true);

    // Bridge succeeds
    const bridgeResult = await executeMcpBridge(
      { server: 'synthesis', tool: 'search_rag', params: {} },
      registry
    );
    expect(bridgeResult.success).toBe(true);
  });

  it('no tool visibility changes from bridge calls', async () => {
    const { registry, state } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
    });

    const before = new Set(state.enabledTools);

    await executeMcpBridge({ server: 'synthesis', tool: 'search_rag', params: {} }, registry);
    await executeMcpBridge(
      { server: 'synthesis', tool: 'find_code_examples', params: {} },
      registry
    );

    // Enabled set unchanged
    expect(state.enabledTools).toEqual(before);
    // No notifications
    expect(state.notifications.length).toBe(0);
  });

  it('bridge returns error for non-existent tool', async () => {
    const { registry } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
    });

    const result = await executeMcpBridge(
      { server: 'synthesis', tool: 'nonexistent_tool', params: {} },
      registry
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// =============================================================================
// 6. Gateway Tool Protection Tests (4 tests)
// =============================================================================

describe('Integration: Gateway Tool Protection', () => {
  it('rejects disable of synthesis_discover_tools', () => {
    const { registry, state } = createIntegrationMockRegistry({
      enabledTools: createFullEnabledSet(),
    });

    const result = registry.disable('synthesis_discover_tools');

    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toBe('gateway_protected');
    expect(state.enabledTools.has('synthesis_discover_tools')).toBe(true);
  });

  it('rejects disable of all 5 gateway tools', () => {
    const { registry, state } = createIntegrationMockRegistry({
      enabledTools: createFullEnabledSet(),
    });

    for (const gw of GATEWAY_TOOLS) {
      const result = registry.disable(gw);
      expect(result.ok).toBe(false);
      expect((result as { reason: string }).reason).toBe('gateway_protected');
      expect(state.enabledTools.has(gw)).toBe(true);
    }
  });

  it('gateway tools remain enabled after enabling toolpack', () => {
    const { registry, state } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
    });

    // Enable a toolpack
    enableTools({ toolpacks: ['mobile_core'] }, registry);

    // Gateway tools still enabled
    for (const gw of GATEWAY_TOOLS) {
      expect(state.enabledTools.has(gw)).toBe(true);
    }
  });

  it('gateway tools cannot be accidentally disabled via state mutation', () => {
    const { registry } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
    });

    // Even if we try to mutate the set directly (in real code, registry would protect)
    // This test verifies the disable function returns gateway_protected
    for (const gw of GATEWAY_TOOLS) {
      const result = registry.disable(gw);
      expect(result.ok).toBe(false);
    }
  });
});

// =============================================================================
// 7. Client Compatibility Tests (5 tests)
// =============================================================================

describe('Integration: Client Compatibility', () => {
  it('no Anthropic-specific fields in tool results', async () => {
    const { registry } = createIntegrationMockRegistry({
      enabledTools: createFullEnabledSet(),
    });

    const result = await executeViaRouter({ action: 'search_rag', params: {} }, registry);

    expect(isRouterSuccess(result)).toBe(true);
    if (isRouterSuccess(result)) {
      // Check result structure - should be standard MCP
      expect(result.result).toBeDefined();
      expect(result.result.content).toBeDefined();
      expect(Array.isArray(result.result.content)).toBe(true);

      // No Anthropic-specific fields
      const resultStr = JSON.stringify(result);
      expect(resultStr).not.toContain('anthropic');
      expect(resultStr).not.toContain('claude');
    }
  });

  it('standard MCP content format', async () => {
    const { registry } = createIntegrationMockRegistry({
      enabledTools: createFullEnabledSet(),
    });

    const result = await executeViaRouter({ action: 'search_rag', params: {} }, registry);

    expect(isRouterSuccess(result)).toBe(true);
    if (isRouterSuccess(result)) {
      // Standard MCP format
      expect(result.result.content).toBeDefined();
      expect(Array.isArray(result.result.content)).toBe(true);
      if (result.result.content.length > 0) {
        expect(result.result.content[0]).toHaveProperty('type');
        expect(result.result.content[0]).toHaveProperty('text');
      }
    }
  });

  it('minimal profile functional using only gateway + core tools', () => {
    const { registry, state } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
    });

    // Verify minimal profile is functional
    expect(state.enabledTools.size).toBe(6);

    // Can discover
    const discover = buildDiscoverResult({ list_all: true }, registry);
    expect(discover.toolpacks).toBeDefined();
    expect(discover.categories).toBeDefined();

    // Can enable
    const enable = enableTools({ tools: ['search_rag'] }, registry);
    expect(enable.enabled).toContain('search_rag');
  });

  it('tools callable via router for clients without tools/list_changed support', async () => {
    // Clients that don't support list_changed can still use router
    const { registry } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
      config: { routerMode: 'auto' },
    });

    // Even though tool isn't in client's tools/list, router can auto-enable and call it
    const result = await executeViaRouter({ action: 'search_rag', params: {} }, registry);

    expect(isRouterSuccess(result)).toBe(true);
  });

  it('error responses follow standard MCP format', async () => {
    const { registry } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
      config: { routerMode: 'respect' },
    });

    const result = await executeViaRouter({ action: 'search_rag', params: {} }, registry);

    expect(isRouterError(result)).toBe(true);
    if (isRouterError(result)) {
      // Error structure is well-defined
      expect(typeof result.error).toBe('string');
      expect(typeof result.gated).toBe('boolean');
    }
  });
});

// =============================================================================
// 8. Multi-Step Workflow Tests (4 tests)
// =============================================================================

describe('Integration: Multi-Step Workflow Scenarios', () => {
  it('scenario: discover → enable toolpack → search → expand context', async () => {
    const { registry, state } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
      config: { routerMode: 'auto' },
    });

    // Step 1: Discover mobile tools
    const discover = buildDiscoverResult({ task: 'build flutter app' }, registry);
    expect(discover.recommended).toBeDefined();

    // Step 2: Enable mobile_core toolpack
    const enable = enableTools({ toolpacks: ['mobile_core'] }, registry);
    expect(enable.enabled.length).toBe(3);
    expect(enable.notificationSent).toBe(true);

    // Step 3: Search using mobile tool
    const search = await executeViaRouter(
      { action: 'search_mobile_docs', params: { query: 'auth' } },
      registry
    );
    expect(isRouterSuccess(search)).toBe(true);

    // Step 4: Expand context (auto-enables graphing)
    const expand = await executeViaRouter({ action: 'graph_expand_context', params: {} }, registry);
    expect(isRouterSuccess(expand)).toBe(true);
    expect(state.enabledTools.has('graph_expand_context')).toBe(true);
  });

  it('scenario: unknown tool → discover → enable → retry via router', async () => {
    const { registry, state } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
      config: { routerMode: 'respect' },
    });

    // Step 1: Try to call unknown tool - fails
    const first = await executeViaRouter({ action: 'get_db_schema', params: {} }, registry);
    expect(isRouterError(first)).toBe(true);

    // Step 2: Discover to understand what's available
    const discover = buildDiscoverResult({ task: 'database schema' }, registry);
    expect(discover.recommended).toBeDefined();

    // Step 3: Enable the tool
    enableTools({ tools: ['get_db_schema'] }, registry);
    expect(state.enabledTools.has('get_db_schema')).toBe(true);

    // Step 4: Retry - now succeeds
    const retry = await executeViaRouter({ action: 'get_db_schema', params: {} }, registry);
    expect(isRouterSuccess(retry)).toBe(true);
  });

  it('scenario: profile switch mid-session tracks state transitions', () => {
    const { registry, state } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
    });

    // Initial: minimal (6 tools)
    expect(state.enabledTools.size).toBe(6);

    // Enable mobile_core (simulating profile enhancement)
    enableTools({ toolpacks: ['mobile_core'] }, registry);
    expect(state.enabledTools.size).toBe(9);

    // Enable introspection (further enhancement)
    enableTools({ toolpacks: ['introspection'] }, registry);
    expect(state.enabledTools.size).toBe(12);

    // Verify gateway tools still present
    for (const gw of GATEWAY_TOOLS) {
      expect(state.enabledTools.has(gw)).toBe(true);
    }

    // Verify notification history
    expect(state.notifications.length).toBe(6); // 3 mobile + 3 introspection
  });

  it('scenario: sensitive tool workflow with explicit enable', async () => {
    const { registry, state } = createIntegrationMockRegistry({
      enabledTools: createMinimalEnabledSet(),
      sensitiveTools: new Set(SENSITIVE_TOOLS),
      config: { routerMode: 'auto', sensitiveEnforce: true },
    });

    // Step 1: Discover database tools
    const discover = buildDiscoverResult({ task: 'analyze database schema' }, registry);
    const hasDbSchema = discover.recommended?.some((r) => r.name === 'get_db_schema');
    expect(hasDbSchema).toBe(true);

    // Step 2: Try to call - blocked due to sensitive
    const blocked = await executeViaRouter({ action: 'get_db_schema', params: {} }, registry);
    expect(isRouterError(blocked)).toBe(true);
    if (isRouterError(blocked)) {
      expect(blocked.gated).toBe(true);
      expect(blocked.requiresEnable).toContain('get_db_schema');
    }

    // Step 3: Explicitly enable (user acknowledges sensitivity)
    enableTools({ tools: ['get_db_schema'] }, registry);
    expect(state.enabledTools.has('get_db_schema')).toBe(true);

    // Step 4: Now call succeeds
    const success = await executeViaRouter({ action: 'get_db_schema', params: {} }, registry);
    expect(isRouterSuccess(success)).toBe(true);
  });
});
