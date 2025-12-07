/**
 * Dynamic Tool Registry Integration Tests
 *
 * Phase 16F: Integration tests for DynamicToolRegistry flows including
 * tool discovery, enable/disable, profile switching, session management,
 * sensitive tool gating, and registry bridge integration.
 */

import type { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CORE_TOOLS,
  GATEWAY_TOOLS,
  GRAPHING_TOOLS,
  INTROSPECTION_TOOLS,
  MOBILE_CORE_TOOLS,
  getAllToolDefinitions,
} from '../../agent/tool-definitions/index.js';
import {
  GATEWAY_TOOL_NAMES,
  TOOLPACKS,
  getAllSensitiveTools,
  getToolpackCounts,
} from '../../agent/tool-definitions/toolpacks.js';
// Type imports used by other parts of the test file for type guards
import { getSessionEnabledDefinitions } from '../chat-providers/registry-bridge.js';
import { DynamicToolRegistry, getToolRegistry, resetToolRegistry } from '../tool-registry.js';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Creates a mock database pool
 */
function createMockPool(): Pool {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    }),
  } as unknown as Pool;
}

// =============================================================================
// Tool Discovery Flow Tests
// =============================================================================

describe('Tool Discovery Flow', () => {
  let registry: DynamicToolRegistry;

  beforeEach(() => {
    resetToolRegistry();
    registry = new DynamicToolRegistry({ defaultProfile: 'core' });
    registry.registerTools(getAllToolDefinitions());
  });

  afterEach(() => {
    registry.destroy();
  });

  it('should discover all toolpacks', () => {
    const summary = registry.getToolpackSummary();
    const toolpackNames = Object.keys(summary);

    expect(toolpackNames).toContain('core');
    expect(toolpackNames).toContain('gateway');
    expect(toolpackNames).toContain('mobile_core');
    expect(toolpackNames).toContain('introspection');
    expect(toolpackNames).toContain('graphing');
    expect(toolpackNames).toHaveLength(5);
  });

  it('should return correct tool counts per toolpack', () => {
    const counts = getToolpackCounts();

    expect(counts.core).toBe(14);
    expect(counts.gateway).toBe(2);
    expect(counts.mobile_core).toBe(3);
    expect(counts.introspection).toBe(3);
    expect(counts.graphing).toBe(1);
  });

  it('should register all tools from getAllToolDefinitions', () => {
    const allDefs = getAllToolDefinitions();
    const expectedTotal = allDefs.length;

    expect(registry.size).toBe(expectedTotal);
    expect(registry.size).toBe(23); // 14 + 2 + 3 + 3 + 1
  });

  it('should return toolpack summary with descriptions', () => {
    const summary = registry.getToolpackSummary();

    expect(summary.core.description).toBe(TOOLPACKS.core.description);
    expect(summary.gateway.description).toBe(TOOLPACKS.gateway.description);
    expect(summary.mobile_core.description).toBe(TOOLPACKS.mobile_core.description);
    expect(summary.introspection.description).toBe(TOOLPACKS.introspection.description);
    expect(summary.graphing.description).toBe(TOOLPACKS.graphing.description);
  });

  it('should return tool metadata for any registered tool', () => {
    const metadata = registry.getToolMetadata('search_rag');

    expect(metadata).toBeDefined();
    expect(metadata?.toolpack).toBe('core');
    expect(metadata?.category).toBe('core');
    expect(metadata?.sensitive).toBe(false);
  });

  it('should return undefined for non-existent tool metadata', () => {
    const metadata = registry.getToolMetadata('non_existent_tool');

    expect(metadata).toBeUndefined();
  });
});

// =============================================================================
// Enable/Disable Flow Tests
// =============================================================================

describe('Enable/Disable Flow', () => {
  let registry: DynamicToolRegistry;

  beforeEach(() => {
    resetToolRegistry();
    registry = new DynamicToolRegistry({ defaultProfile: 'minimal' });
    registry.registerTools(getAllToolDefinitions());
  });

  afterEach(() => {
    registry.destroy();
  });

  it('should enable a toolpack via enableToolpack', () => {
    const sessionId = 'test-enable-session';
    registry.applyProfile(sessionId, 'minimal');

    // Verify introspection tools are not enabled initially
    expect(registry.isToolEnabled(sessionId, 'get_project_tech_stack')).toBe(false);
    expect(registry.isToolEnabled(sessionId, 'get_db_schema')).toBe(false);
    expect(registry.isToolEnabled(sessionId, 'find_symbol_usages')).toBe(false);

    // Enable introspection toolpack
    const enabled = registry.enableToolpack(sessionId, 'introspection');

    // Verify introspection tools are now enabled
    expect(enabled).toContain('get_project_tech_stack');
    expect(enabled).toContain('get_db_schema');
    expect(enabled).toContain('find_symbol_usages');
    expect(registry.isToolEnabled(sessionId, 'get_project_tech_stack')).toBe(true);
  });

  it('should enable specific tools by name', () => {
    const sessionId = 'test-specific-enable';
    registry.applyProfile(sessionId, 'minimal');

    // Verify tool is not enabled
    expect(registry.isToolEnabled(sessionId, 'graph_expand_context')).toBe(false);

    // Enable specific tool
    const result = registry.enableTool(sessionId, 'graph_expand_context');

    expect(result.ok).toBe(true);
    expect(registry.isToolEnabled(sessionId, 'graph_expand_context')).toBe(true);
    // Other graphing tools remain unaffected (only one in graphing pack)
    expect(registry.getEnabledTools(sessionId)).toContain('graph_expand_context');
  });

  it('should not allow disabling gateway tools', () => {
    const sessionId = 'test-gateway-protection';
    registry.getOrCreateSession(sessionId);

    // Verify gateway tools are enabled
    expect(registry.isToolEnabled(sessionId, 'discover_tools')).toBe(true);
    expect(registry.isToolEnabled(sessionId, 'enable_tools')).toBe(true);

    // Try to disable gateway tools
    const result1 = registry.disableTool(sessionId, 'discover_tools');
    const result2 = registry.disableTool(sessionId, 'enable_tools');

    expect(result1.ok).toBe(false);
    expect(result1.reason).toBe('gateway_protected');
    expect(result2.ok).toBe(false);
    expect(result2.reason).toBe('gateway_protected');

    // Gateway tools should still be enabled
    expect(registry.isToolEnabled(sessionId, 'discover_tools')).toBe(true);
    expect(registry.isToolEnabled(sessionId, 'enable_tools')).toBe(true);
  });

  it('should disable a toolpack while preserving gateway tools', () => {
    const sessionId = 'test-disable-toolpack';
    registry.applyProfile(sessionId, 'core');

    // Enable mobile_core first
    registry.enableToolpack(sessionId, 'mobile_core');
    expect(registry.isToolEnabled(sessionId, 'search_mobile_docs')).toBe(true);

    // Disable mobile_core
    const disabled = registry.disableToolpack(sessionId, 'mobile_core');

    expect(disabled).toContain('search_mobile_docs');
    expect(registry.isToolEnabled(sessionId, 'search_mobile_docs')).toBe(false);

    // Gateway tools should remain enabled
    expect(registry.isToolEnabled(sessionId, 'discover_tools')).toBe(true);
  });

  it('should return appropriate error for non-existent tool', () => {
    const sessionId = 'test-non-existent';
    registry.getOrCreateSession(sessionId);

    const result = registry.enableTool(sessionId, 'fake_tool_xyz');

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('not_found');
  });

  it('should return error when tool is already enabled', () => {
    const sessionId = 'test-already-enabled';
    registry.applyProfile(sessionId, 'core');

    // search_rag should already be enabled in core profile
    const result = registry.enableTool(sessionId, 'search_rag');

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('already_enabled');
  });

  it('should return error when tool is already disabled', () => {
    const sessionId = 'test-already-disabled';
    registry.applyProfile(sessionId, 'minimal');

    // search_rag is not enabled in minimal profile
    const result = registry.disableTool(sessionId, 'search_rag');

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('already_disabled');
  });
});

// =============================================================================
// Profile Switching Tests
// =============================================================================

describe('Profile Switching', () => {
  let registry: DynamicToolRegistry;

  beforeEach(() => {
    resetToolRegistry();
    registry = new DynamicToolRegistry({ defaultProfile: 'core' });
    registry.registerTools(getAllToolDefinitions());
  });

  afterEach(() => {
    registry.destroy();
  });

  it('should apply minimal profile (gateway only)', () => {
    const sessionId = 'test-minimal';
    registry.applyProfile(sessionId, 'minimal');

    const enabledTools = registry.getEnabledTools(sessionId);

    // Only gateway tools should be enabled
    expect(enabledTools).toHaveLength(2);
    expect(enabledTools).toContain('discover_tools');
    expect(enabledTools).toContain('enable_tools');

    // Core tools should not be enabled
    expect(enabledTools).not.toContain('search_rag');
    expect(enabledTools).not.toContain('add_document');
  });

  it('should apply core profile (gateway + core)', () => {
    const sessionId = 'test-core';
    registry.applyProfile(sessionId, 'core');

    const enabledTools = registry.getEnabledTools(sessionId);

    // Gateway + core = 2 + 14 = 16 tools
    expect(enabledTools).toHaveLength(16);

    // Verify gateway tools
    expect(enabledTools).toContain('discover_tools');
    expect(enabledTools).toContain('enable_tools');

    // Verify core tools
    expect(enabledTools).toContain('search_rag');
    expect(enabledTools).toContain('add_document');
    expect(enabledTools).toContain('list_documents');
    expect(enabledTools).toContain('list_collections');
    expect(enabledTools).toContain('get_document_status');
    expect(enabledTools).toContain('delete_document');
    expect(enabledTools).toContain('restart_ingest');
    expect(enabledTools).toContain('fetch_web_content');
    expect(enabledTools).toContain('summarize_document');

    // Other toolpacks should not be enabled
    expect(enabledTools).not.toContain('search_mobile_docs');
    expect(enabledTools).not.toContain('get_db_schema');
    expect(enabledTools).not.toContain('graph_expand_context');
  });

  it('should apply full profile (all tools)', () => {
    const sessionId = 'test-full';
    registry.applyProfile(sessionId, 'full');

    const enabledTools = registry.getEnabledTools(sessionId);

    // All tools should be enabled: 2 + 14 + 3 + 3 + 1 = 23
    expect(enabledTools).toHaveLength(23);

    // Verify tools from all packs are enabled
    expect(enabledTools).toContain('discover_tools'); // gateway
    expect(enabledTools).toContain('search_rag'); // core
    expect(enabledTools).toContain('search_mobile_docs'); // mobile_core
    expect(enabledTools).toContain('get_db_schema'); // introspection
    expect(enabledTools).toContain('graph_expand_context'); // graphing
  });

  it('should throw for invalid profile', () => {
    expect(() => {
      // @ts-expect-error Testing invalid profile name
      registry.applyProfile('session1', 'super_duper_profile');
    }).toThrow('Invalid profile');
  });

  it('should switch from one profile to another correctly', () => {
    const sessionId = 'test-switch-profile';

    // Start with full profile
    registry.applyProfile(sessionId, 'full');
    expect(registry.getEnabledToolCount(sessionId)).toBe(23);

    // Switch to minimal
    registry.applyProfile(sessionId, 'minimal');
    expect(registry.getEnabledToolCount(sessionId)).toBe(2);

    // Switch to core
    registry.applyProfile(sessionId, 'core');
    expect(registry.getEnabledToolCount(sessionId)).toBe(16);
  });

  it('should update activeProfile after applying a profile', () => {
    const sessionId = 'test-active-profile';

    registry.applyProfile(sessionId, 'minimal');
    let snapshot = registry.getSnapshot(sessionId);
    expect(snapshot.activeProfile).toBe('minimal');

    registry.applyProfile(sessionId, 'full');
    snapshot = registry.getSnapshot(sessionId);
    expect(snapshot.activeProfile).toBe('full');
  });
});

// =============================================================================
// Session Management Tests
// =============================================================================

describe('Session Management', () => {
  let registry: DynamicToolRegistry;

  beforeEach(() => {
    resetToolRegistry();
    registry = new DynamicToolRegistry({ defaultProfile: 'core' });
    registry.registerTools(getAllToolDefinitions());
  });

  afterEach(() => {
    registry.destroy();
  });

  it('should isolate tool state between sessions', () => {
    // Create session A with core profile (default)
    const sessionA = 'session-a';
    registry.getOrCreateSession(sessionA);

    // Create session B with minimal profile
    const sessionB = 'session-b';
    registry.applyProfile(sessionB, 'minimal');

    // Enable introspection in session A
    registry.enableToolpack(sessionA, 'introspection');

    // Verify session A has introspection enabled
    expect(registry.isToolEnabled(sessionA, 'get_db_schema')).toBe(true);
    expect(registry.getEnabledToolCount(sessionA)).toBe(19); // 16 core + 3 introspection

    // Verify session B still has minimal profile
    expect(registry.isToolEnabled(sessionB, 'get_db_schema')).toBe(false);
    expect(registry.getEnabledToolCount(sessionB)).toBe(2); // only gateway
  });

  it('should track tool call statistics per session', () => {
    const sessionId = 'test-stats-session';
    registry.getOrCreateSession(sessionId);

    // Record tool calls
    registry.recordToolCall('search_rag');
    registry.recordToolCall('search_rag');
    registry.recordToolCall('add_document');

    // Verify call counts in snapshot
    const snapshot = registry.getSnapshot(sessionId);
    const searchRagTool = snapshot.tools.find((t) => t.name === 'search_rag');
    const addDocTool = snapshot.tools.find((t) => t.name === 'add_document');

    expect(searchRagTool?.callCount).toBe(2);
    expect(addDocTool?.callCount).toBe(1);
    expect(searchRagTool?.lastCalledAt).toBeDefined();
  });

  it('should update lastActivityAt on session access', async () => {
    const sessionId = 'test-activity-session';
    const session1 = registry.getOrCreateSession(sessionId);
    const initialTime = session1.lastActivityAt.getTime();

    // Wait a bit and access again (use 50ms to avoid flaky tests on slow CI)
    await new Promise((resolve) => setTimeout(resolve, 50));
    const session2 = registry.getOrCreateSession(sessionId);

    expect(session2.lastActivityAt.getTime()).toBeGreaterThan(initialTime);
  });

  it('should delete a session correctly', () => {
    const sessionId = 'test-delete-session';
    registry.getOrCreateSession(sessionId);

    expect(registry.getSessionCount()).toBe(1);

    const deleted = registry.deleteSession(sessionId);

    expect(deleted).toBe(true);
    expect(registry.getSessionCount()).toBe(0);
  });

  it('should return false when deleting non-existent session', () => {
    const deleted = registry.deleteSession('non-existent-session');

    expect(deleted).toBe(false);
  });

  it('should create multiple isolated sessions', () => {
    const sessions = ['session-1', 'session-2', 'session-3'];

    for (const id of sessions) {
      registry.getOrCreateSession(id);
    }

    expect(registry.getSessionCount()).toBe(3);

    // Apply different profiles
    registry.applyProfile('session-1', 'minimal');
    registry.applyProfile('session-2', 'core');
    registry.applyProfile('session-3', 'full');

    expect(registry.getEnabledToolCount('session-1')).toBe(2);
    expect(registry.getEnabledToolCount('session-2')).toBe(16);
    expect(registry.getEnabledToolCount('session-3')).toBe(23);
  });
});

// =============================================================================
// Sensitive Tool Gating Tests
// =============================================================================

describe('Sensitive Tool Gating', () => {
  let registry: DynamicToolRegistry;

  beforeEach(() => {
    resetToolRegistry();
    registry = new DynamicToolRegistry({ defaultProfile: 'core' });
    registry.registerTools(getAllToolDefinitions());
  });

  afterEach(() => {
    registry.destroy();
  });

  it('should mark get_db_schema as sensitive', () => {
    const metadata = registry.getToolMetadata('get_db_schema');

    expect(metadata).toBeDefined();
    expect(metadata?.sensitive).toBe(true);
    expect(metadata?.toolpack).toBe('introspection');
  });

  it('should mark delete_document as sensitive', () => {
    const metadata = registry.getToolMetadata('delete_document');

    expect(metadata).toBeDefined();
    expect(metadata?.sensitive).toBe(true);
    expect(metadata?.toolpack).toBe('core');
  });

  it('should identify all sensitive tools via getAllSensitiveTools', () => {
    const sensitiveTools = getAllSensitiveTools();

    expect(sensitiveTools).toContain('get_db_schema');
    expect(sensitiveTools).toContain('delete_document');
    expect(sensitiveTools).toContain('delete_collection');
    expect(sensitiveTools).toHaveLength(3);
  });

  it('should include sensitive tools in full profile', () => {
    const sessionId = 'test-sensitive-full';
    registry.applyProfile(sessionId, 'full');

    // Sensitive tools should be enabled in full profile
    expect(registry.isToolEnabled(sessionId, 'get_db_schema')).toBe(true);
    expect(registry.isToolEnabled(sessionId, 'delete_document')).toBe(true);
  });

  it('should include delete_document in core profile', () => {
    const sessionId = 'test-sensitive-core';
    registry.applyProfile(sessionId, 'core');

    // delete_document is in core toolpack
    expect(registry.isToolEnabled(sessionId, 'delete_document')).toBe(true);
    // get_db_schema is in introspection toolpack (not in core profile)
    expect(registry.isToolEnabled(sessionId, 'get_db_schema')).toBe(false);
  });

  it('should not include sensitive tools in minimal profile', () => {
    const sessionId = 'test-sensitive-minimal';
    registry.applyProfile(sessionId, 'minimal');

    expect(registry.isToolEnabled(sessionId, 'get_db_schema')).toBe(false);
    expect(registry.isToolEnabled(sessionId, 'delete_document')).toBe(false);
  });

  it('should correctly identify non-sensitive tools', () => {
    const metadata = registry.getToolMetadata('search_rag');

    expect(metadata).toBeDefined();
    expect(metadata?.sensitive).toBe(false);
  });
});

// =============================================================================
// Registry Bridge Integration Tests
// =============================================================================

describe('Registry Bridge Integration', () => {
  beforeEach(() => {
    resetToolRegistry();
    createMockPool(); // Keep pool creation for side effects

    // Initialize the global registry
    const registry = getToolRegistry();
    registry.registerTools(getAllToolDefinitions());
  });

  afterEach(() => {
    resetToolRegistry();
  });

  it('should filter tools by session via getSessionEnabledDefinitions', () => {
    const registry = getToolRegistry();
    const sessionId = 'test-bridge-session';

    // Apply minimal profile
    registry.applyProfile(sessionId, 'minimal');

    const definitions = getSessionEnabledDefinitions(sessionId);
    const toolNames = definitions.map((d) => d.name);

    // Only gateway tools should be returned
    expect(toolNames).toHaveLength(2);
    expect(toolNames).toContain('discover_tools');
    expect(toolNames).toContain('enable_tools');
    expect(toolNames).not.toContain('search_rag');
  });

  it('should return all tools when no sessionId provided', () => {
    const definitions = getSessionEnabledDefinitions(undefined);

    // All 23 tools should be returned
    expect(definitions).toHaveLength(23);
  });

  it('should return core profile tools for core session', () => {
    const registry = getToolRegistry();
    const sessionId = 'test-core-bridge';

    registry.applyProfile(sessionId, 'core');

    const definitions = getSessionEnabledDefinitions(sessionId);
    const toolNames = definitions.map((d) => d.name);

    expect(toolNames).toHaveLength(16);
    expect(toolNames).toContain('search_rag');
    expect(toolNames).toContain('discover_tools');
  });

  it('should return full profile tools for full session', () => {
    const registry = getToolRegistry();
    const sessionId = 'test-full-bridge';

    registry.applyProfile(sessionId, 'full');

    const definitions = getSessionEnabledDefinitions(sessionId);

    expect(definitions).toHaveLength(23);
  });

  it('should reflect dynamic tool enablement', () => {
    const registry = getToolRegistry();
    const sessionId = 'test-dynamic-bridge';

    // Start with minimal
    registry.applyProfile(sessionId, 'minimal');
    let definitions = getSessionEnabledDefinitions(sessionId);
    expect(definitions).toHaveLength(2);

    // Enable graphing
    registry.enableToolpack(sessionId, 'graphing');
    definitions = getSessionEnabledDefinitions(sessionId);
    expect(definitions).toHaveLength(3);
    expect(definitions.map((d) => d.name)).toContain('graph_expand_context');
  });

  it('should reflect dynamic tool disablement', () => {
    const registry = getToolRegistry();
    const sessionId = 'test-disable-bridge';

    // Start with core
    registry.applyProfile(sessionId, 'core');
    let definitions = getSessionEnabledDefinitions(sessionId);
    expect(definitions).toHaveLength(16);

    // Disable a core tool
    registry.disableTool(sessionId, 'add_document');
    definitions = getSessionEnabledDefinitions(sessionId);
    expect(definitions).toHaveLength(15);
    expect(definitions.map((d) => d.name)).not.toContain('add_document');
  });
});

// =============================================================================
// Singleton Registry Tests
// =============================================================================

describe('Singleton Registry', () => {
  beforeEach(() => {
    resetToolRegistry();
  });

  afterEach(() => {
    resetToolRegistry();
  });

  it('should return the same instance on multiple calls', () => {
    const registry1 = getToolRegistry();
    const registry2 = getToolRegistry();

    expect(registry1).toBe(registry2);
  });

  it('should reset instance and create new on reset', () => {
    const registry1 = getToolRegistry();
    registry1.registerTools(getAllToolDefinitions());
    expect(registry1.size).toBe(23);

    resetToolRegistry();

    const registry2 = getToolRegistry();
    expect(registry2.size).toBe(0);
    expect(registry1).not.toBe(registry2);
  });

  it('should maintain state across getToolRegistry calls', () => {
    const registry1 = getToolRegistry();
    registry1.registerTools(getAllToolDefinitions());
    registry1.applyProfile('session-test', 'minimal');

    const registry2 = getToolRegistry();
    expect(registry2.getEnabledToolCount('session-test')).toBe(2);
  });
});

// =============================================================================
// Change Callbacks Tests
// =============================================================================

describe('Change Callbacks', () => {
  let registry: DynamicToolRegistry;

  beforeEach(() => {
    resetToolRegistry();
    registry = new DynamicToolRegistry({ defaultProfile: 'core' });
    registry.registerTools(getAllToolDefinitions());
  });

  afterEach(() => {
    registry.destroy();
  });

  it('should notify callback on tool enable', () => {
    const callback = vi.fn();
    registry.onToolStateChange(callback);

    const sessionId = 'test-callback-enable';
    registry.applyProfile(sessionId, 'minimal');
    callback.mockClear();

    registry.enableTool(sessionId, 'search_rag');

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      sessionId,
      expect.any(Array),
      expect.arrayContaining(['search_rag'])
    );
  });

  it('should notify callback on tool disable', () => {
    const callback = vi.fn();
    registry.onToolStateChange(callback);

    const sessionId = 'test-callback-disable';
    registry.applyProfile(sessionId, 'core');
    callback.mockClear();

    registry.disableTool(sessionId, 'add_document');

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      sessionId,
      expect.any(Array),
      expect.arrayContaining(['add_document'])
    );
  });

  it('should notify callback on profile change', () => {
    const callback = vi.fn();
    registry.onToolStateChange(callback);

    const sessionId = 'test-callback-profile';
    registry.applyProfile(sessionId, 'minimal');
    callback.mockClear();

    registry.applyProfile(sessionId, 'full');

    // Should be notified about changed tools
    expect(callback).toHaveBeenCalled();
  });

  it('should allow unregistering callback', () => {
    const callback = vi.fn();
    const unregister = registry.onToolStateChange(callback);

    unregister();

    const sessionId = 'test-unregister-callback';
    registry.applyProfile(sessionId, 'minimal');
    registry.enableTool(sessionId, 'search_rag');

    expect(callback).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Tool Counts Verification Tests
// =============================================================================

describe('Tool Counts Verification', () => {
  beforeEach(() => {
    resetToolRegistry();
  });

  afterEach(() => {
    resetToolRegistry();
  });

  it('should have correct number of CORE_TOOLS', () => {
    expect(CORE_TOOLS).toHaveLength(14);
  });

  it('should have correct number of GATEWAY_TOOLS', () => {
    expect(GATEWAY_TOOLS).toHaveLength(2);
  });

  it('should have correct number of MOBILE_CORE_TOOLS', () => {
    expect(MOBILE_CORE_TOOLS).toHaveLength(3);
  });

  it('should have correct number of INTROSPECTION_TOOLS', () => {
    expect(INTROSPECTION_TOOLS).toHaveLength(3);
  });

  it('should have correct number of GRAPHING_TOOLS', () => {
    expect(GRAPHING_TOOLS).toHaveLength(1);
  });

  it('should have 23 total tools from getAllToolDefinitions', () => {
    const allTools = getAllToolDefinitions();
    expect(allTools).toHaveLength(23);
  });

  it('should match GATEWAY_TOOL_NAMES constant', () => {
    expect(GATEWAY_TOOL_NAMES).toEqual(['discover_tools', 'enable_tools']);
    expect(GATEWAY_TOOL_NAMES).toHaveLength(2);
  });
});

// =============================================================================
// Tool Building Tests
// =============================================================================

describe('Tool Building', () => {
  let registry: DynamicToolRegistry;
  let mockDb: Pool;

  beforeEach(() => {
    resetToolRegistry();
    registry = new DynamicToolRegistry({ defaultProfile: 'core' });
    registry.registerTools(getAllToolDefinitions());
    mockDb = createMockPool();
  });

  afterEach(() => {
    registry.destroy();
  });

  it('should build agent tools for session', () => {
    const sessionId = 'test-build-agent';
    registry.applyProfile(sessionId, 'core');

    const context = { collectionId: 'test-collection' };
    const built = registry.buildAgentToolsForSession(sessionId, mockDb, context);

    expect(built.tools).toHaveLength(16);
    expect(Object.keys(built.toolExecutors)).toHaveLength(16);
    expect(Object.keys(built.toolMetadata)).toHaveLength(16);
    expect(built.toolExecutors.search_rag).toBeDefined();
    expect(typeof built.toolExecutors.search_rag).toBe('function');
  });

  it('should build chat tools for session', () => {
    const sessionId = 'test-build-chat';
    registry.applyProfile(sessionId, 'minimal');

    const context = { collectionId: 'test-collection' };
    const built = registry.buildChatToolsForSession(sessionId, mockDb, context);

    expect(built.tools).toHaveLength(2);
    expect(Object.keys(built.toolExecutors)).toHaveLength(2);
    expect(built.tools[0].name).toBeDefined();
    expect(built.tools[0].description).toBeDefined();
    expect(built.tools[0].inputSchema).toBeDefined();
  });

  it('should only include enabled tools in built output', () => {
    const sessionId = 'test-build-filtered';
    registry.applyProfile(sessionId, 'minimal');
    registry.enableTool(sessionId, 'search_rag');

    const context = { collectionId: 'test-collection' };
    const built = registry.buildAgentToolsForSession(sessionId, mockDb, context);

    expect(built.tools).toHaveLength(3);
    expect(built.toolExecutors.discover_tools).toBeDefined();
    expect(built.toolExecutors.enable_tools).toBeDefined();
    expect(built.toolExecutors.search_rag).toBeDefined();
    expect(built.toolExecutors.add_document).toBeUndefined();
  });
});

// =============================================================================
// Snapshot Tests
// =============================================================================

describe('Snapshot', () => {
  let registry: DynamicToolRegistry;

  beforeEach(() => {
    resetToolRegistry();
    registry = new DynamicToolRegistry({ defaultProfile: 'core' });
    registry.registerTools(getAllToolDefinitions());
  });

  afterEach(() => {
    registry.destroy();
  });

  it('should return correct snapshot for session', () => {
    const sessionId = 'test-snapshot';
    registry.applyProfile(sessionId, 'core');

    const snapshot = registry.getSnapshot(sessionId);

    expect(snapshot.totalCount).toBe(23);
    expect(snapshot.enabledCount).toBe(16);
    expect(snapshot.activeProfile).toBe('core');
    expect(snapshot.tools).toHaveLength(23);
  });

  it('should reflect enabled state in snapshot tools', () => {
    const sessionId = 'test-snapshot-enabled';
    registry.applyProfile(sessionId, 'minimal');

    const snapshot = registry.getSnapshot(sessionId);

    const discoverTool = snapshot.tools.find((t) => t.name === 'discover_tools');
    const searchTool = snapshot.tools.find((t) => t.name === 'search_rag');

    expect(discoverTool?.enabled).toBe(true);
    expect(searchTool?.enabled).toBe(false);
  });

  it('should use default profile for unknown session', () => {
    const snapshot = registry.getSnapshot('unknown-session-xyz');

    expect(snapshot.activeProfile).toBe('core');
    expect(snapshot.enabledCount).toBe(0); // No session means no enabled tracking
  });
});
