/**
 * DynamicToolRegistry Tests
 *
 * Tests for the DynamicToolRegistry class that manages MCP tool handles
 * for enable/disable operations, profile-based startup, and toolpack management.
 *
 * @module apps/mcp/src/__tests__/dynamic-tool-registry.test
 * @since GPT Phase 3: Sub-Phase 5.6.1
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type CategoryName,
  type DynamicToolOptions,
  DynamicToolRegistry,
  type EnableDisableResult,
  type EnhancedRegistrySnapshot,
  type ToolpackName,
  createSynthesisHandle,
} from '../tool-registry.js';

import type { DynamicToolConfig, ProfileName } from '../types/profiles.js';
import type { McpToolHandle, SynthesisToolHandle } from '../types/tool-handle.js';

// =============================================================================
// Mocks
// =============================================================================

/**
 * Create a mock MCP SDK tool handle
 */
function createMockMcpHandle(): McpToolHandle {
  return {
    enable: vi.fn(),
    disable: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
}

/**
 * Create a mock MCP Server that returns mock handles
 */
function createMockMcpServer() {
  const handles = new Map<string, McpToolHandle>();

  return {
    registerTool: vi.fn((name: string) => {
      const handle = createMockMcpHandle();
      handles.set(name, handle);
      return handle;
    }),
    getHandle: (name: string) => handles.get(name),
    getAllHandles: () => handles,
  };
}

/**
 * Default test configuration
 */
const defaultConfig: DynamicToolConfig = {
  profile: 'minimal',
  routerMode: 'auto',
  sensitiveEnforce: false,
  debug: false,
};

/**
 * Create test tool options
 */
function createTestToolOptions(overrides: Partial<DynamicToolOptions> = {}): DynamicToolOptions {
  return {
    description: 'Test tool description',
    toolpack: 'core',
    category: 'core',
    sensitive: false,
    version: '1.0.0',
    ...overrides,
  };
}

/**
 * Simple async handler for tests
 */
async function testHandler() {
  return {
    content: [{ type: 'text' as const, text: 'test result' }],
  };
}

// =============================================================================
// createSynthesisHandle Tests
// =============================================================================

describe('createSynthesisHandle', () => {
  it('should create a handle with correct metadata', () => {
    const mcpHandle = createMockMcpHandle();
    const metadata = {
      name: 'test_tool',
      toolpack: 'core' as ToolpackName,
      category: 'core' as CategoryName,
      description: 'Test tool',
      sensitive: false,
      version: '1.0.0',
    };

    const handle = createSynthesisHandle(mcpHandle, metadata);

    expect(handle.name).toBe('test_tool');
    expect(handle.toolpack).toBe('core');
    expect(handle.category).toBe('core');
    expect(handle.sensitive).toBe(false);
    expect(handle.version).toBe('1.0.0');
    expect(handle.mcpHandle).toBe(mcpHandle);
  });

  it('should start with isEnabled = true', () => {
    const mcpHandle = createMockMcpHandle();
    const metadata = {
      name: 'test_tool',
      toolpack: 'core' as ToolpackName,
      category: 'core' as CategoryName,
      description: 'Test tool',
      sensitive: false,
      version: '1.0.0',
    };

    const handle = createSynthesisHandle(mcpHandle, metadata);

    expect(handle.isEnabled).toBe(true);
  });

  it('should call mcpHandle.disable() when disabling from enabled state', () => {
    const mcpHandle = createMockMcpHandle();
    const metadata = {
      name: 'test_tool',
      toolpack: 'core' as ToolpackName,
      category: 'core' as CategoryName,
      description: 'Test tool',
      sensitive: false,
      version: '1.0.0',
    };

    const handle = createSynthesisHandle(mcpHandle, metadata);
    handle.disable();

    expect(mcpHandle.disable).toHaveBeenCalledTimes(1);
    expect(handle.isEnabled).toBe(false);
  });

  it('should not call mcpHandle.disable() when already disabled', () => {
    const mcpHandle = createMockMcpHandle();
    const metadata = {
      name: 'test_tool',
      toolpack: 'core' as ToolpackName,
      category: 'core' as CategoryName,
      description: 'Test tool',
      sensitive: false,
      version: '1.0.0',
    };

    const handle = createSynthesisHandle(mcpHandle, metadata);
    handle.disable();
    handle.disable(); // Second call

    expect(mcpHandle.disable).toHaveBeenCalledTimes(1);
  });

  it('should call mcpHandle.enable() when enabling from disabled state', () => {
    const mcpHandle = createMockMcpHandle();
    const metadata = {
      name: 'test_tool',
      toolpack: 'core' as ToolpackName,
      category: 'core' as CategoryName,
      description: 'Test tool',
      sensitive: false,
      version: '1.0.0',
    };

    const handle = createSynthesisHandle(mcpHandle, metadata);
    handle.disable();
    handle.enable();

    expect(mcpHandle.enable).toHaveBeenCalledTimes(1);
    expect(handle.isEnabled).toBe(true);
  });

  it('should not call mcpHandle.enable() when already enabled', () => {
    const mcpHandle = createMockMcpHandle();
    const metadata = {
      name: 'test_tool',
      toolpack: 'core' as ToolpackName,
      category: 'core' as CategoryName,
      description: 'Test tool',
      sensitive: false,
      version: '1.0.0',
    };

    const handle = createSynthesisHandle(mcpHandle, metadata);
    handle.enable(); // Already enabled

    expect(mcpHandle.enable).not.toHaveBeenCalled();
  });
});

// =============================================================================
// DynamicToolRegistry - Registration Tests
// =============================================================================

describe('DynamicToolRegistry - Registration', () => {
  let registry: DynamicToolRegistry;
  let mockServer: ReturnType<typeof createMockMcpServer>;

  beforeEach(() => {
    mockServer = createMockMcpServer();
    // biome-ignore lint/suspicious/noExplicitAny: Mock server doesn't match full McpServer type
    registry = new DynamicToolRegistry(mockServer as any, defaultConfig);
  });

  it('should register a tool and return a handle', () => {
    const handle = registry.registerTool('test_tool', createTestToolOptions(), testHandler);

    expect(handle).toBeDefined();
    expect(handle.name).toBe('test_tool');
    expect(mockServer.registerTool).toHaveBeenCalledTimes(1);
  });

  it('should store the handle in the registry', () => {
    registry.registerTool('test_tool', createTestToolOptions(), testHandler);

    const retrieved = registry.getHandle('test_tool');
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('test_tool');
  });

  it('should increment size for each registered tool', () => {
    expect(registry.size).toBe(0);

    registry.registerTool('tool1', createTestToolOptions(), testHandler);
    expect(registry.size).toBe(1);

    registry.registerTool('tool2', createTestToolOptions(), testHandler);
    expect(registry.size).toBe(2);
  });

  it('should register tool with correct metadata', () => {
    const options = createTestToolOptions({
      toolpack: 'mobile_core',
      category: 'mobile',
      sensitive: true,
      version: '2.0.0',
    });

    const handle = registry.registerTool('mobile_tool', options, testHandler);

    expect(handle.toolpack).toBe('mobile_core');
    expect(handle.category).toBe('mobile');
    expect(handle.sensitive).toBe(true);
    expect(handle.version).toBe('2.0.0');
  });

  it('should apply default values for optional fields', () => {
    const options: DynamicToolOptions = {
      description: 'Minimal options',
      toolpack: 'core',
      category: 'core',
    };

    const handle = registry.registerTool('minimal_tool', options, testHandler);

    expect(handle.sensitive).toBe(false);
    expect(handle.version).toBe('1.0.0');
  });

  it('should list all registered tool names', () => {
    registry.registerTool('tool1', createTestToolOptions(), testHandler);
    registry.registerTool('tool2', createTestToolOptions(), testHandler);
    registry.registerTool('tool3', createTestToolOptions(), testHandler);

    const tools = registry.listTools();

    expect(tools).toHaveLength(3);
    expect(tools).toContain('tool1');
    expect(tools).toContain('tool2');
    expect(tools).toContain('tool3');
  });
});

// =============================================================================
// DynamicToolRegistry - Enable/Disable Tests
// =============================================================================

describe('DynamicToolRegistry - Enable/Disable', () => {
  let registry: DynamicToolRegistry;
  let mockServer: ReturnType<typeof createMockMcpServer>;

  beforeEach(() => {
    mockServer = createMockMcpServer();
    // biome-ignore lint/suspicious/noExplicitAny: Mock server doesn't match full McpServer type
    registry = new DynamicToolRegistry(mockServer as any, defaultConfig);

    // Register some test tools
    registry.registerTool(
      'core_tool',
      createTestToolOptions({ toolpack: 'core', category: 'core' }),
      testHandler
    );
    registry.registerTool(
      'mobile_tool',
      createTestToolOptions({ toolpack: 'mobile_core', category: 'mobile' }),
      testHandler
    );
    registry.registerTool(
      'sensitive_tool',
      createTestToolOptions({ sensitive: true }),
      testHandler
    );
  });

  describe('enable()', () => {
    it('should enable a disabled tool', () => {
      // biome-ignore lint/style/noNonNullAssertion: Test setup guarantees handle exists
      const handle = registry.getHandle('core_tool')!;
      handle.disable();

      const result = registry.enable('core_tool');

      expect(result.ok).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(registry.isEnabled('core_tool')).toBe(true);
    });

    it('should return already_enabled for enabled tool', () => {
      const result = registry.enable('core_tool');

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('already_enabled');
    });

    it('should return not_found for unknown tool', () => {
      const result = registry.enable('unknown_tool');

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('not_found');
    });
  });

  describe('disable()', () => {
    it('should disable an enabled tool', () => {
      const result = registry.disable('core_tool');

      expect(result.ok).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(registry.isEnabled('core_tool')).toBe(false);
    });

    it('should return already_disabled for disabled tool', () => {
      registry.disable('core_tool');
      const result = registry.disable('core_tool');

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('already_disabled');
    });

    it('should return not_found for unknown tool', () => {
      const result = registry.disable('unknown_tool');

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('not_found');
    });

    it('should return gateway_protected for gateway tools', () => {
      // Register a gateway tool
      registry.registerTool(
        'synthesis_discover_tools',
        createTestToolOptions({ toolpack: 'gateway', category: 'gateway' }),
        testHandler
      );

      const result = registry.disable('synthesis_discover_tools');

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('gateway_protected');
      expect(registry.isEnabled('synthesis_discover_tools')).toBe(true);
    });
  });

  describe('isEnabled()', () => {
    it('should return true for enabled tools', () => {
      expect(registry.isEnabled('core_tool')).toBe(true);
    });

    it('should return false for disabled tools', () => {
      registry.disable('core_tool');
      expect(registry.isEnabled('core_tool')).toBe(false);
    });

    it('should return false for unknown tools', () => {
      expect(registry.isEnabled('unknown_tool')).toBe(false);
    });
  });

  describe('getEnabledCount()', () => {
    it('should return correct count of enabled tools', () => {
      expect(registry.getEnabledCount()).toBe(3);

      registry.disable('core_tool');
      expect(registry.getEnabledCount()).toBe(2);

      registry.disable('mobile_tool');
      expect(registry.getEnabledCount()).toBe(1);
    });
  });

  describe('listEnabledTools()', () => {
    it('should return only enabled tool names', () => {
      registry.disable('core_tool');

      const enabled = registry.listEnabledTools();

      expect(enabled).toContain('mobile_tool');
      expect(enabled).toContain('sensitive_tool');
      expect(enabled).not.toContain('core_tool');
    });
  });
});

// =============================================================================
// DynamicToolRegistry - Batch Operations Tests
// =============================================================================

describe('DynamicToolRegistry - Batch Operations', () => {
  let registry: DynamicToolRegistry;
  let mockServer: ReturnType<typeof createMockMcpServer>;

  beforeEach(() => {
    mockServer = createMockMcpServer();
    // biome-ignore lint/suspicious/noExplicitAny: Mock server doesn't match full McpServer type
    registry = new DynamicToolRegistry(mockServer as any, defaultConfig);

    // Register tools from different toolpacks
    registry.registerTool(
      'search_mobile_docs',
      createTestToolOptions({ toolpack: 'mobile_core', category: 'mobile' }),
      testHandler
    );
    registry.registerTool(
      'find_code_examples',
      createTestToolOptions({ toolpack: 'mobile_core', category: 'mobile' }),
      testHandler
    );
    registry.registerTool(
      'get_feature_recipe',
      createTestToolOptions({ toolpack: 'mobile_core', category: 'mobile' }),
      testHandler
    );
    registry.registerTool(
      'search_rag',
      createTestToolOptions({ toolpack: 'core', category: 'core' }),
      testHandler
    );
    registry.registerTool(
      'list_collections',
      createTestToolOptions({ toolpack: 'core', category: 'core' }),
      testHandler
    );
    registry.registerTool(
      'get_project_tech_stack',
      createTestToolOptions({ toolpack: 'introspection', category: 'introspection' }),
      testHandler
    );
  });

  describe('enableToolpack()', () => {
    it('should enable all tools in a toolpack', () => {
      // Disable mobile_core tools first
      registry.disable('search_mobile_docs');
      registry.disable('find_code_examples');
      registry.disable('get_feature_recipe');

      const enabled = registry.enableToolpack('mobile_core');

      expect(enabled).toHaveLength(3);
      expect(enabled).toContain('search_mobile_docs');
      expect(enabled).toContain('find_code_examples');
      expect(enabled).toContain('get_feature_recipe');
    });

    it('should return empty array for unknown toolpack', () => {
      const enabled = registry.enableToolpack('unknown' as ToolpackName);
      expect(enabled).toHaveLength(0);
    });

    it('should not include already-enabled tools in result', () => {
      // Only disable 2 of 3 mobile tools
      registry.disable('search_mobile_docs');
      registry.disable('find_code_examples');

      const enabled = registry.enableToolpack('mobile_core');

      expect(enabled).toHaveLength(2);
      expect(enabled).not.toContain('get_feature_recipe'); // Was already enabled
    });
  });

  describe('enableCategory()', () => {
    it('should enable all tools in a category', () => {
      registry.disable('search_mobile_docs');
      registry.disable('find_code_examples');
      registry.disable('get_feature_recipe');

      const enabled = registry.enableCategory('mobile');

      expect(enabled).toHaveLength(3);
      expect(enabled).toContain('search_mobile_docs');
      expect(enabled).toContain('find_code_examples');
      expect(enabled).toContain('get_feature_recipe');
    });

    it('should not include already-enabled tools', () => {
      registry.disable('search_mobile_docs');

      const enabled = registry.enableCategory('mobile');

      expect(enabled).toHaveLength(1);
      expect(enabled).toContain('search_mobile_docs');
    });
  });
});

// =============================================================================
// DynamicToolRegistry - Profile Tests
// =============================================================================

describe('DynamicToolRegistry - Profile Management', () => {
  let registry: DynamicToolRegistry;
  let mockServer: ReturnType<typeof createMockMcpServer>;

  beforeEach(() => {
    mockServer = createMockMcpServer();
    // biome-ignore lint/suspicious/noExplicitAny: Mock server doesn't match full McpServer type
    registry = new DynamicToolRegistry(mockServer as any, defaultConfig);

    // Register tools matching the profile definitions
    // Gateway tools
    registry.registerTool(
      'synthesis_discover_tools',
      createTestToolOptions({ toolpack: 'gateway', category: 'gateway' }),
      testHandler
    );
    registry.registerTool(
      'enable_tools',
      createTestToolOptions({ toolpack: 'gateway', category: 'gateway' }),
      testHandler
    );
    registry.registerTool(
      'synthesis_router',
      createTestToolOptions({ toolpack: 'gateway', category: 'gateway' }),
      testHandler
    );
    registry.registerTool(
      'synthesis_mcp_bridge',
      createTestToolOptions({ toolpack: 'gateway', category: 'gateway' }),
      testHandler
    );
    registry.registerTool(
      'synthesis_search',
      createTestToolOptions({ toolpack: 'gateway', category: 'gateway' }),
      testHandler
    );

    // Core tools
    registry.registerTool(
      'list_collections',
      createTestToolOptions({ toolpack: 'core', category: 'core' }),
      testHandler
    );
    registry.registerTool(
      'list_documents',
      createTestToolOptions({ toolpack: 'core', category: 'core' }),
      testHandler
    );
    registry.registerTool(
      'search_rag',
      createTestToolOptions({ toolpack: 'core', category: 'core' }),
      testHandler
    );
    registry.registerTool(
      'delete_collection',
      createTestToolOptions({ toolpack: 'core', category: 'core', sensitive: true }),
      testHandler
    );

    // Mobile core tools
    registry.registerTool(
      'search_mobile_docs',
      createTestToolOptions({ toolpack: 'mobile_core', category: 'mobile' }),
      testHandler
    );
    registry.registerTool(
      'find_code_examples',
      createTestToolOptions({ toolpack: 'mobile_core', category: 'mobile' }),
      testHandler
    );
    registry.registerTool(
      'get_feature_recipe',
      createTestToolOptions({ toolpack: 'mobile_core', category: 'mobile' }),
      testHandler
    );

    // Introspection tools
    registry.registerTool(
      'get_project_tech_stack',
      createTestToolOptions({ toolpack: 'introspection', category: 'introspection' }),
      testHandler
    );
    registry.registerTool(
      'get_db_schema',
      createTestToolOptions({
        toolpack: 'introspection',
        category: 'introspection',
        sensitive: true,
      }),
      testHandler
    );
  });

  describe('applyProfile()', () => {
    it('should throw error for invalid profile', () => {
      expect(() => registry.applyProfile('invalid' as ProfileName)).toThrow(
        'Invalid profile: invalid. Valid profiles: minimal, mobile, full'
      );
    });

    it('should apply minimal profile correctly', () => {
      registry.applyProfile('minimal');

      // Gateway tools should be enabled
      expect(registry.isEnabled('synthesis_discover_tools')).toBe(true);
      expect(registry.isEnabled('enable_tools')).toBe(true);
      expect(registry.isEnabled('synthesis_router')).toBe(true);
      expect(registry.isEnabled('synthesis_mcp_bridge')).toBe(true);
      expect(registry.isEnabled('synthesis_search')).toBe(true);

      // list_collections is in additionalTools for minimal
      expect(registry.isEnabled('list_collections')).toBe(true);

      // Other tools should be disabled
      expect(registry.isEnabled('list_documents')).toBe(false);
      expect(registry.isEnabled('search_rag')).toBe(false);
      expect(registry.isEnabled('search_mobile_docs')).toBe(false);
      expect(registry.isEnabled('get_project_tech_stack')).toBe(false);
    });

    it('should apply mobile profile correctly', () => {
      registry.applyProfile('mobile');

      // Gateway tools should be enabled
      expect(registry.isEnabled('synthesis_discover_tools')).toBe(true);

      // Mobile core toolpack should be enabled
      expect(registry.isEnabled('search_mobile_docs')).toBe(true);
      expect(registry.isEnabled('find_code_examples')).toBe(true);
      expect(registry.isEnabled('get_feature_recipe')).toBe(true);

      // Additional tools for mobile profile
      expect(registry.isEnabled('list_collections')).toBe(true);
      expect(registry.isEnabled('list_documents')).toBe(true);
      expect(registry.isEnabled('search_rag')).toBe(true);

      // Introspection should be disabled
      expect(registry.isEnabled('get_project_tech_stack')).toBe(false);
    });

    it('should apply full profile correctly', () => {
      registry.applyProfile('full');

      // All tools should be enabled
      expect(registry.isEnabled('synthesis_discover_tools')).toBe(true);
      expect(registry.isEnabled('list_collections')).toBe(true);
      expect(registry.isEnabled('search_mobile_docs')).toBe(true);
      expect(registry.isEnabled('get_project_tech_stack')).toBe(true);
      expect(registry.isEnabled('delete_collection')).toBe(true);
    });

    it('should update active profile', () => {
      expect(registry.getActiveProfile()).toBe('minimal');

      registry.applyProfile('mobile');
      expect(registry.getActiveProfile()).toBe('mobile');

      registry.applyProfile('full');
      expect(registry.getActiveProfile()).toBe('full');
    });

    it('should not disable gateway tools during profile application', () => {
      registry.applyProfile('minimal');

      // Try to disable a gateway tool directly
      const result = registry.disable('synthesis_discover_tools');
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('gateway_protected');
    });
  });
});

// =============================================================================
// DynamicToolRegistry - Call Recording and Snapshot Tests
// =============================================================================

describe('DynamicToolRegistry - Call Recording and Snapshot', () => {
  let registry: DynamicToolRegistry;
  let mockServer: ReturnType<typeof createMockMcpServer>;

  beforeEach(() => {
    mockServer = createMockMcpServer();
    // biome-ignore lint/suspicious/noExplicitAny: Mock server doesn't match full McpServer type
    registry = new DynamicToolRegistry(mockServer as any, defaultConfig);

    registry.registerTool('tool1', createTestToolOptions(), testHandler);
    registry.registerTool('tool2', createTestToolOptions(), testHandler);
    registry.registerTool('tool3', createTestToolOptions(), testHandler);
  });

  describe('recordCall()', () => {
    it('should increment call count', () => {
      const snapshot1 = registry.getSnapshot();
      // biome-ignore lint/style/noNonNullAssertion: Test setup guarantees tool exists
      const tool1State = snapshot1.tools.find((t) => t.name === 'tool1')!;
      expect(tool1State.callCount).toBe(0);

      registry.recordCall('tool1');
      registry.recordCall('tool1');
      registry.recordCall('tool1');

      const snapshot2 = registry.getSnapshot();
      // biome-ignore lint/style/noNonNullAssertion: Test setup guarantees tool exists
      const tool1State2 = snapshot2.tools.find((t) => t.name === 'tool1')!;
      expect(tool1State2.callCount).toBe(3);
    });

    it('should update lastCalledAt timestamp', () => {
      const before = new Date();
      registry.recordCall('tool1');
      const after = new Date();

      const snapshot = registry.getSnapshot();
      // biome-ignore lint/style/noNonNullAssertion: Test setup guarantees tool exists
      const tool1State = snapshot.tools.find((t) => t.name === 'tool1')!;

      expect(tool1State.lastCalledAt).toBeDefined();
      expect(tool1State.lastCalledAt?.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(tool1State.lastCalledAt?.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should handle unknown tool gracefully', () => {
      // Should not throw
      expect(() => registry.recordCall('unknown_tool')).not.toThrow();
    });
  });

  describe('getSnapshot()', () => {
    it('should return correct tool count', () => {
      const snapshot = registry.getSnapshot();

      expect(snapshot.totalCount).toBe(3);
      expect(snapshot.tools).toHaveLength(3);
    });

    it('should return correct enabled count', () => {
      registry.disable('tool1');

      const snapshot = registry.getSnapshot();

      expect(snapshot.enabledCount).toBe(2);
    });

    it('should return active profile', () => {
      const snapshot = registry.getSnapshot();
      expect(snapshot.activeProfile).toBe('minimal');
    });

    it('should return uptime', () => {
      const snapshot = registry.getSnapshot();
      expect(snapshot.uptimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should include call statistics', () => {
      registry.recordCall('tool1');
      registry.recordCall('tool1');
      registry.recordCall('tool2');

      const snapshot = registry.getSnapshot();

      expect(snapshot.callStats.totalCalls).toBe(3);
      expect(snapshot.callStats.topTools).toHaveLength(2);
      expect(snapshot.callStats.topTools[0].name).toBe('tool1');
      expect(snapshot.callStats.topTools[0].count).toBe(2);
    });

    it('should return top 5 tools by usage', () => {
      // Register more tools
      registry.registerTool('tool4', createTestToolOptions(), testHandler);
      registry.registerTool('tool5', createTestToolOptions(), testHandler);
      registry.registerTool('tool6', createTestToolOptions(), testHandler);
      registry.registerTool('tool7', createTestToolOptions(), testHandler);

      // Record calls in various counts
      for (let i = 0; i < 7; i++) registry.recordCall('tool1');
      for (let i = 0; i < 6; i++) registry.recordCall('tool2');
      for (let i = 0; i < 5; i++) registry.recordCall('tool3');
      for (let i = 0; i < 4; i++) registry.recordCall('tool4');
      for (let i = 0; i < 3; i++) registry.recordCall('tool5');
      for (let i = 0; i < 2; i++) registry.recordCall('tool6');
      for (let i = 0; i < 1; i++) registry.recordCall('tool7');

      const snapshot = registry.getSnapshot();

      expect(snapshot.callStats.topTools).toHaveLength(5);
      expect(snapshot.callStats.topTools[0].name).toBe('tool1');
      expect(snapshot.callStats.topTools[0].count).toBe(7);
      expect(snapshot.callStats.topTools[4].name).toBe('tool5');
      expect(snapshot.callStats.topTools[4].count).toBe(3);
    });

    it('should exclude tools with 0 calls from topTools', () => {
      registry.recordCall('tool1');

      const snapshot = registry.getSnapshot();

      expect(snapshot.callStats.topTools).toHaveLength(1);
      expect(snapshot.callStats.topTools[0].name).toBe('tool1');
    });
  });
});

// =============================================================================
// DynamicToolRegistry - Configuration Tests
// =============================================================================

describe('DynamicToolRegistry - Configuration', () => {
  it('should store and return configuration', () => {
    const mockServer = createMockMcpServer();
    const config: DynamicToolConfig = {
      profile: 'mobile',
      routerMode: 'respect',
      sensitiveEnforce: true,
      debug: true,
    };

    // biome-ignore lint/suspicious/noExplicitAny: Mock server doesn't match full McpServer type
    const registry = new DynamicToolRegistry(mockServer as any, config);
    const storedConfig = registry.getConfig();

    expect(storedConfig.profile).toBe('mobile');
    expect(storedConfig.routerMode).toBe('respect');
    expect(storedConfig.sensitiveEnforce).toBe(true);
    expect(storedConfig.debug).toBe(true);
  });

  it('should use profile from config as initial active profile', () => {
    const mockServer = createMockMcpServer();
    const config: DynamicToolConfig = {
      profile: 'full',
      routerMode: 'auto',
      sensitiveEnforce: false,
      debug: false,
    };

    // biome-ignore lint/suspicious/noExplicitAny: Mock server doesn't match full McpServer type
    const registry = new DynamicToolRegistry(mockServer as any, config);

    expect(registry.getActiveProfile()).toBe('full');
  });
});
