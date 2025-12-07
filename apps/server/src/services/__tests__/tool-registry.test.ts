/**
 * Tool Registry Tests
 *
 * Phase 16F: Tests for DynamicToolRegistry and unified tool definitions.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { UnifiedToolDefinition } from '../../agent/tool-definitions/types.js';
import { DynamicToolRegistry, getToolRegistry, resetToolRegistry } from '../tool-registry.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const createMockTool = (
  name: string,
  toolpack: 'core' | 'gateway' = 'core'
): UnifiedToolDefinition => ({
  name,
  description: `Mock ${name} tool`,
  inputSchema: z.object({ input: z.string() }),
  metadata: {
    toolpack,
    category: toolpack === 'gateway' ? 'gateway' : 'core',
    sensitive: false,
    version: '1.0.0',
  },
  createExecutor: () => async () => `Result from ${name}`,
});

// =============================================================================
// Tests
// =============================================================================

describe('DynamicToolRegistry', () => {
  let registry: DynamicToolRegistry;

  beforeEach(() => {
    resetToolRegistry();
    registry = new DynamicToolRegistry({ defaultProfile: 'core' });
  });

  afterEach(() => {
    registry.destroy();
  });

  describe('Tool Registration', () => {
    it('should register a tool', () => {
      const tool = createMockTool('test_tool');
      registry.registerTool(tool);

      expect(registry.size).toBe(1);
      expect(registry.getToolDefinition('test_tool')).toBeDefined();
    });

    it('should register multiple tools', () => {
      const tools = [createMockTool('tool_a'), createMockTool('tool_b'), createMockTool('tool_c')];
      registry.registerTools(tools);

      expect(registry.size).toBe(3);
    });

    it('should return all tool definitions', () => {
      registry.registerTools([createMockTool('tool_a'), createMockTool('tool_b')]);

      const definitions = registry.getAllToolDefinitions();
      expect(definitions).toHaveLength(2);
      expect(definitions.map((d) => d.name)).toContain('tool_a');
      expect(definitions.map((d) => d.name)).toContain('tool_b');
    });
  });

  describe('Session Management', () => {
    beforeEach(() => {
      registry.registerTools([
        createMockTool('search_rag'),
        createMockTool('add_document'),
        createMockTool('discover_tools', 'gateway'),
        createMockTool('enable_tools', 'gateway'),
      ]);
    });

    it('should create a session with default profile', () => {
      const session = registry.getOrCreateSession('session1');

      expect(session.sessionId).toBe('session1');
      expect(session.activeProfile).toBe('core');
      expect(session.enabledTools.size).toBeGreaterThan(0);
    });

    it('should reuse existing session', () => {
      const session1 = registry.getOrCreateSession('session1');
      session1.lastActivityAt = new Date(Date.now() - 1000);
      const previousTimestamp = session1.lastActivityAt.getTime();

      const session2 = registry.getOrCreateSession('session1');

      // Should return the same session instance
      expect(session2).toBe(session1);
      // And lastActivityAt should be updated
      expect(session2.lastActivityAt.getTime()).toBeGreaterThan(previousTimestamp);
    });

    it('should delete a session', () => {
      registry.getOrCreateSession('session1');
      expect(registry.getSessionCount()).toBe(1);

      registry.deleteSession('session1');
      expect(registry.getSessionCount()).toBe(0);
    });
  });

  describe('Enable/Disable Operations', () => {
    beforeEach(() => {
      registry.registerTools([
        createMockTool('search_rag'),
        createMockTool('add_document'),
        createMockTool('list_documents'),
        createMockTool('discover_tools', 'gateway'),
        createMockTool('enable_tools', 'gateway'),
      ]);
    });

    it('should enable a tool', () => {
      const sessionId = 'test-session';
      registry.getOrCreateSession(sessionId);

      // First disable the tool
      registry.disableTool(sessionId, 'search_rag');
      expect(registry.isToolEnabled(sessionId, 'search_rag')).toBe(false);

      // Then enable it
      const result = registry.enableTool(sessionId, 'search_rag');
      expect(result.ok).toBe(true);
      expect(registry.isToolEnabled(sessionId, 'search_rag')).toBe(true);
    });

    it('should disable a tool', () => {
      const sessionId = 'test-session';
      registry.getOrCreateSession(sessionId);

      const result = registry.disableTool(sessionId, 'search_rag');
      expect(result.ok).toBe(true);
      expect(registry.isToolEnabled(sessionId, 'search_rag')).toBe(false);
    });

    it('should not disable gateway tools', () => {
      const sessionId = 'test-session';
      registry.getOrCreateSession(sessionId);

      const result = registry.disableTool(sessionId, 'discover_tools');
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('gateway_protected');
    });

    it('should return error for non-existent tool', () => {
      const result = registry.enableTool('session1', 'non_existent');
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('not_found');
    });

    it('should return error for already enabled tool', () => {
      const sessionId = 'test-session';
      registry.getOrCreateSession(sessionId);

      // search_rag should be enabled by default in core profile
      const result = registry.enableTool(sessionId, 'search_rag');
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('already_enabled');
    });
  });

  describe('Toolpack Operations', () => {
    beforeEach(() => {
      registry.registerTools([
        createMockTool('search_rag'),
        createMockTool('add_document'),
        createMockTool('discover_tools', 'gateway'),
        createMockTool('enable_tools', 'gateway'),
      ]);
    });

    it('should enable a toolpack', () => {
      const sessionId = 'test-session';
      registry.applyProfile(sessionId, 'minimal'); // Start with minimal

      const enabled = registry.enableToolpack(sessionId, 'core');
      expect(enabled).toContain('search_rag');
      expect(enabled).toContain('add_document');
    });

    it('should disable a toolpack', () => {
      const sessionId = 'test-session';
      registry.getOrCreateSession(sessionId);

      const disabled = registry.disableToolpack(sessionId, 'core');
      expect(disabled).toContain('search_rag');
      expect(disabled).toContain('add_document');
      expect(registry.isToolEnabled(sessionId, 'search_rag')).toBe(false);
    });
  });

  describe('Profile Operations', () => {
    beforeEach(() => {
      registry.registerTools([
        createMockTool('search_rag'),
        createMockTool('add_document'),
        createMockTool('discover_tools', 'gateway'),
        createMockTool('enable_tools', 'gateway'),
      ]);
    });

    it('should apply minimal profile', () => {
      const sessionId = 'test-session';
      registry.applyProfile(sessionId, 'minimal');

      const enabledTools = registry.getEnabledTools(sessionId);

      // Only gateway tools should be enabled
      expect(enabledTools).toContain('discover_tools');
      expect(enabledTools).toContain('enable_tools');
      expect(enabledTools).not.toContain('search_rag');
    });

    it('should apply core profile', () => {
      const sessionId = 'test-session';
      registry.applyProfile(sessionId, 'core');

      const enabledTools = registry.getEnabledTools(sessionId);

      // Gateway and core tools should be enabled
      expect(enabledTools).toContain('discover_tools');
      expect(enabledTools).toContain('search_rag');
    });

    it('should throw for invalid profile', () => {
      expect(() => {
        // @ts-expect-error Testing invalid profile name
        registry.applyProfile('session1', 'invalid');
      }).toThrow('Invalid profile');
    });
  });

  describe('Snapshot & Statistics', () => {
    it('should return registry snapshot', () => {
      registry.registerTools([
        createMockTool('search_rag'),
        createMockTool('discover_tools', 'gateway'),
      ]);

      const snapshot = registry.getSnapshot('session1');

      expect(snapshot.totalCount).toBe(2);
      expect(snapshot.tools).toHaveLength(2);
      expect(snapshot.activeProfile).toBe('core');
    });

    it('should record tool calls', () => {
      registry.registerTool(createMockTool('search_rag'));

      registry.recordToolCall('search_rag');
      registry.recordToolCall('search_rag');

      const snapshot = registry.getSnapshot('session1');
      const searchTool = snapshot.tools.find((t) => t.name === 'search_rag');

      expect(searchTool?.callCount).toBe(2);
    });
  });

  describe('Change Callbacks', () => {
    it('should notify on tool enable', () => {
      const callback = vi.fn();
      registry.onToolStateChange(callback);

      registry.registerTools([
        createMockTool('search_rag'),
        createMockTool('discover_tools', 'gateway'),
      ]);

      const sessionId = 'test-session';
      registry.applyProfile(sessionId, 'minimal');
      registry.enableTool(sessionId, 'search_rag');

      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(sessionId, expect.any(Array), ['search_rag']);
    });

    it('should unregister callback', () => {
      const callback = vi.fn();
      const unregister = registry.onToolStateChange(callback);

      registry.registerTool(createMockTool('search_rag'));
      unregister();

      const sessionId = 'test-session';
      registry.applyProfile(sessionId, 'minimal');
      registry.enableTool(sessionId, 'search_rag');

      // Callback should not be called after unregister
      expect(callback).not.toHaveBeenCalled();
    });
  });
});

describe('Singleton Registry', () => {
  beforeEach(() => {
    resetToolRegistry();
  });

  afterEach(() => {
    resetToolRegistry();
  });

  it('should return the same instance', () => {
    const registry1 = getToolRegistry();
    const registry2 = getToolRegistry();

    expect(registry1).toBe(registry2);
  });

  it('should reset instance', () => {
    const registry1 = getToolRegistry();
    registry1.registerTool(createMockTool('test'));

    resetToolRegistry();

    const registry2 = getToolRegistry();
    expect(registry2.size).toBe(0);
  });
});
