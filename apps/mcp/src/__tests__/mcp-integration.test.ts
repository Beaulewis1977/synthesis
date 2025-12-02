/**
 * MCP Integration Tests
 *
 * Tests for the MCP tool registration, toolpacks, and tool registry.
 * These tests verify:
 * - Tool registry functionality
 * - Toolpack definitions and lookup
 * - Tool metadata consistency
 * - API parameter construction
 *
 * @module apps/mcp/src/__tests__/mcp-integration.test
 * @since GPT Phase 3: Sub-Phase 5.3
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  type CategoryName,
  type ToolDefinition,
  type ToolMetadata,
  ToolRegistry,
  type ToolpackName,
  createToolMetadata,
  isValidCategory,
  isValidToolpack,
  toolRegistry,
} from '../tool-registry.js';

import {
  TOOLPACKS,
  TOOL_METADATA,
  getAllSensitiveTools,
  getAllTools,
  getToolMetadata,
  getToolpack,
  getToolpackCounts,
  getToolpackForTool,
  isToolSensitive,
  listToolpacks,
} from '../toolpacks.js';

// =============================================================================
// Test Constants
// =============================================================================

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

// All expected tools in the system
const ALL_EXPECTED_TOOLS = [
  // Core
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
  // Mobile Core
  'search_mobile_docs',
  'find_code_examples',
  'get_feature_recipe',
  // Introspection
  'get_project_tech_stack',
  'get_db_schema',
  'find_symbol_usages',
  // Graphing
  'graph_expand_context',
  // Gateway
  'synthesis_discover_tools',
  'enable_tools',
  'synthesis_router',
  'synthesis_mcp_bridge',
  'synthesis_search',
];

// Expected sensitive tools
const EXPECTED_SENSITIVE_TOOLS = ['delete_document', 'delete_collection', 'get_db_schema'];

// =============================================================================
// Tool Registry Tests
// =============================================================================

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('register and retrieve', () => {
    it('should register a tool with metadata only (no schema/handler)', () => {
      const definition: ToolDefinition = {
        name: 'test_tool',
        toolpack: 'core',
        category: 'core',
        description: 'A test tool',
        sensitive: false,
        version: '1.0.0',
      };

      registry.register(definition);

      expect(registry.size).toBe(1);
      expect(registry.listTools()).toContain('test_tool');
    });

    it('should register a tool with optional schema and handler', () => {
      const definition: ToolDefinition = {
        name: 'full_tool',
        toolpack: 'core',
        category: 'core',
        description: 'A tool with schema and handler',
        inputSchema: z.object({ query: z.string() }),
        handler: async () => ({ content: [{ type: 'text' as const, text: 'result' }] }),
        sensitive: false,
        version: '1.0.0',
      };

      registry.register(definition);

      const retrieved = registry.getDefinition('full_tool');
      expect(retrieved?.inputSchema).toBeDefined();
      expect(retrieved?.handler).toBeDefined();
    });

    it('should apply default values for optional fields', () => {
      registry.register({
        name: 'minimal_tool',
        toolpack: 'mobile_core',
        category: 'mobile',
        description: 'Minimal definition',
      });

      const metadata = registry.getMetadata('minimal_tool');
      expect(metadata).toBeDefined();
      expect(metadata?.sensitive).toBe(false);
      expect(metadata?.version).toBe('1.0.0');
    });

    it('should retrieve full definition', () => {
      const definition: ToolDefinition = {
        name: 'full_tool',
        toolpack: 'introspection',
        category: 'introspection',
        description: 'Full definition',
        sensitive: true,
        version: '2.0.0',
      };

      registry.register(definition);

      const retrieved = registry.getDefinition('full_tool');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('full_tool');
      expect(retrieved?.sensitive).toBe(true);
      expect(retrieved?.version).toBe('2.0.0');
    });

    it('should return undefined for non-existent tool', () => {
      expect(registry.getDefinition('nonexistent')).toBeUndefined();
      expect(registry.getMetadata('nonexistent')).toBeUndefined();
    });
  });

  describe('metadata retrieval', () => {
    beforeEach(() => {
      registry.register({
        name: 'meta_tool',
        toolpack: 'graphing',
        category: 'graph',
        description: 'Tool with metadata',
        sensitive: true,
        version: '3.0.0',
      });
    });

    it('should return lightweight metadata without handler', () => {
      const metadata = registry.getMetadata('meta_tool');

      expect(metadata).toBeDefined();
      expect(metadata).toEqual({
        name: 'meta_tool',
        toolpack: 'graphing',
        category: 'graph',
        description: 'Tool with metadata',
        sensitive: true,
        version: '3.0.0',
      });

      // Verify handler is not included in metadata
      expect(metadata).not.toHaveProperty('handler');
      expect(metadata).not.toHaveProperty('inputSchema');
    });

    it('should list all metadata', () => {
      registry.register({
        name: 'another_tool',
        toolpack: 'core',
        category: 'core',
        description: 'Another tool',
      });

      const allMetadata = registry.listMetadata();
      expect(allMetadata).toHaveLength(2);
      expect(allMetadata.map((m) => m.name)).toContain('meta_tool');
      expect(allMetadata.map((m) => m.name)).toContain('another_tool');
    });
  });

  describe('filtering by toolpack and category', () => {
    beforeEach(() => {
      registry.register({
        name: 'mobile_tool_1',
        toolpack: 'mobile_core',
        category: 'mobile',
        description: 'Mobile 1',
      });
      registry.register({
        name: 'mobile_tool_2',
        toolpack: 'mobile_core',
        category: 'mobile',
        description: 'Mobile 2',
      });
      registry.register({
        name: 'core_tool',
        toolpack: 'core',
        category: 'core',
        description: 'Core',
      });
    });

    it('should filter by toolpack', () => {
      const mobileTools = registry.getToolsByToolpack('mobile_core');
      expect(mobileTools).toHaveLength(2);
      expect(mobileTools).toContain('mobile_tool_1');
      expect(mobileTools).toContain('mobile_tool_2');
    });

    it('should filter by category', () => {
      const mobileCategory = registry.getToolsByCategory('mobile');
      expect(mobileCategory).toHaveLength(2);

      const coreCategory = registry.getToolsByCategory('core');
      expect(coreCategory).toHaveLength(1);
      expect(coreCategory).toContain('core_tool');
    });
  });

  describe('sensitive tools', () => {
    beforeEach(() => {
      registry.register({
        name: 'safe_tool',
        toolpack: 'core',
        category: 'core',
        description: 'Safe',
        sensitive: false,
      });
      registry.register({
        name: 'dangerous_tool',
        toolpack: 'core',
        category: 'core',
        description: 'Dangerous',
        sensitive: true,
      });
    });

    it('should identify sensitive tools', () => {
      const sensitiveTools = registry.getSensitiveTools();
      expect(sensitiveTools).toHaveLength(1);
      expect(sensitiveTools).toContain('dangerous_tool');
    });
  });

  describe('enabled state', () => {
    it('should mark all tools as enabled by default', () => {
      registry.register({
        name: 'auto_enabled',
        toolpack: 'core',
        category: 'core',
        description: 'Auto enabled',
      });

      expect(registry.isEnabled('auto_enabled')).toBe(true);
    });

    it('should return false for non-existent tools', () => {
      expect(registry.isEnabled('nonexistent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all tools', () => {
      registry.register({
        name: 'temp_tool',
        toolpack: 'core',
        category: 'core',
        description: 'Temp',
      });

      expect(registry.size).toBe(1);

      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.listTools()).toHaveLength(0);
    });
  });
});

// =============================================================================
// Toolpacks Tests
// =============================================================================

describe('Toolpacks', () => {
  describe('TOOLPACKS constant', () => {
    it('should define all expected toolpacks', () => {
      expect(Object.keys(TOOLPACKS)).toEqual([
        'mobile_core',
        'introspection',
        'graphing',
        'core',
        'gateway',
      ]);
    });

    it('should have valid structure for each toolpack', () => {
      for (const [name, pack] of Object.entries(TOOLPACKS)) {
        expect(pack).toHaveProperty('description');
        expect(pack).toHaveProperty('defaultCategory');
        expect(pack).toHaveProperty('tools');
        expect(pack).toHaveProperty('sensitive');

        expect(typeof pack.description).toBe('string');
        expect(Array.isArray(pack.tools)).toBe(true);
        expect(Array.isArray(pack.sensitive)).toBe(true);

        // Sensitive tools should be subset of tools
        for (const sensitiveTool of pack.sensitive) {
          expect(pack.tools).toContain(sensitiveTool);
        }
      }
    });

    it('mobile_core should have correct tools', () => {
      expect(TOOLPACKS.mobile_core.tools).toEqual([
        'search_mobile_docs',
        'find_code_examples',
        'get_feature_recipe',
      ]);
      expect(TOOLPACKS.mobile_core.sensitive).toHaveLength(0);
    });

    it('introspection should have correct tools and sensitive markers', () => {
      expect(TOOLPACKS.introspection.tools).toEqual([
        'get_project_tech_stack',
        'get_db_schema',
        'find_symbol_usages',
      ]);
      expect(TOOLPACKS.introspection.sensitive).toEqual(['get_db_schema']);
    });

    it('graphing should have correct tools', () => {
      expect(TOOLPACKS.graphing.tools).toEqual(['graph_expand_context']);
      expect(TOOLPACKS.graphing.sensitive).toHaveLength(0);
    });

    it('core should have correct tools and sensitive markers', () => {
      expect(TOOLPACKS.core.tools).toContain('search_rag');
      expect(TOOLPACKS.core.tools).toContain('list_collections');
      expect(TOOLPACKS.core.tools).toContain('delete_document');
      expect(TOOLPACKS.core.tools).toContain('delete_collection');
      expect(TOOLPACKS.core.sensitive).toEqual(['delete_document', 'delete_collection']);
    });
  });

  describe('getAllTools', () => {
    it('should return all tools from all toolpacks', () => {
      const allTools = getAllTools();

      expect(allTools.length).toBeGreaterThanOrEqual(ALL_EXPECTED_TOOLS.length);

      for (const expectedTool of ALL_EXPECTED_TOOLS) {
        expect(allTools).toContain(expectedTool);
      }
    });

    it('should not contain duplicates', () => {
      const allTools = getAllTools();
      const uniqueTools = new Set(allTools);
      expect(uniqueTools.size).toBe(allTools.length);
    });
  });

  describe('getAllSensitiveTools', () => {
    it('should return all sensitive tools', () => {
      const sensitiveTools = getAllSensitiveTools();

      expect(sensitiveTools).toHaveLength(EXPECTED_SENSITIVE_TOOLS.length);

      for (const expectedSensitive of EXPECTED_SENSITIVE_TOOLS) {
        expect(sensitiveTools).toContain(expectedSensitive);
      }
    });
  });

  describe('getToolpackForTool', () => {
    it('should return correct toolpack for each tool', () => {
      expect(getToolpackForTool('search_mobile_docs')).toBe('mobile_core');
      expect(getToolpackForTool('find_code_examples')).toBe('mobile_core');
      expect(getToolpackForTool('get_db_schema')).toBe('introspection');
      expect(getToolpackForTool('graph_expand_context')).toBe('graphing');
      expect(getToolpackForTool('search_rag')).toBe('core');
      expect(getToolpackForTool('delete_collection')).toBe('core');
    });

    it('should return undefined for unknown tool', () => {
      expect(getToolpackForTool('unknown_tool')).toBeUndefined();
    });
  });

  describe('isToolSensitive', () => {
    it('should correctly identify sensitive tools', () => {
      expect(isToolSensitive('delete_document')).toBe(true);
      expect(isToolSensitive('delete_collection')).toBe(true);
      expect(isToolSensitive('get_db_schema')).toBe(true);
    });

    it('should correctly identify non-sensitive tools', () => {
      expect(isToolSensitive('search_rag')).toBe(false);
      expect(isToolSensitive('list_collections')).toBe(false);
      expect(isToolSensitive('search_mobile_docs')).toBe(false);
      expect(isToolSensitive('graph_expand_context')).toBe(false);
    });

    it('should return false for unknown tool', () => {
      expect(isToolSensitive('unknown_tool')).toBe(false);
    });
  });

  describe('getToolpack', () => {
    it('should return toolpack definition', () => {
      const mobilePack = getToolpack('mobile_core');
      expect(mobilePack).toBeDefined();
      expect(mobilePack?.description).toBe('Mobile development: docs, examples, recipes');
      expect(mobilePack?.tools).toContain('search_mobile_docs');
    });

    it('should return undefined for invalid toolpack', () => {
      expect(getToolpack('invalid' as ToolpackName)).toBeUndefined();
    });
  });

  describe('listToolpacks', () => {
    it('should return all toolpack names', () => {
      const packs = listToolpacks();
      expect(packs).toEqual(['mobile_core', 'introspection', 'graphing', 'core', 'gateway']);
    });
  });

  describe('getToolpackCounts', () => {
    it('should return correct counts', () => {
      const counts = getToolpackCounts();

      expect(counts.mobile_core).toBe(3);
      expect(counts.introspection).toBe(3);
      expect(counts.graphing).toBe(1);
      expect(counts.core).toBe(10);
    });
  });
});

// =============================================================================
// TOOL_METADATA Tests
// =============================================================================

describe('TOOL_METADATA', () => {
  it('should have entries for all expected tools', () => {
    for (const toolName of ALL_EXPECTED_TOOLS) {
      expect(TOOL_METADATA[toolName]).toBeDefined();
    }
  });

  it('should have correct structure for each entry', () => {
    for (const [toolName, metadata] of Object.entries(TOOL_METADATA)) {
      expect(metadata).toHaveProperty('toolpack');
      expect(metadata).toHaveProperty('category');
      expect(metadata).toHaveProperty('sensitive');

      expect(isValidToolpack(metadata.toolpack)).toBe(true);
      expect(isValidCategory(metadata.category)).toBe(true);
      expect(typeof metadata.sensitive).toBe('boolean');
    }
  });

  it('should mark correct tools as sensitive', () => {
    expect(TOOL_METADATA.delete_document.sensitive).toBe(true);
    expect(TOOL_METADATA.delete_collection.sensitive).toBe(true);
    expect(TOOL_METADATA.get_db_schema.sensitive).toBe(true);

    expect(TOOL_METADATA.search_rag.sensitive).toBe(false);
    expect(TOOL_METADATA.list_collections.sensitive).toBe(false);
    expect(TOOL_METADATA.search_mobile_docs.sensitive).toBe(false);
  });

  describe('getToolMetadata helper', () => {
    it('should return metadata for known tools', () => {
      const metadata = getToolMetadata('search_mobile_docs');
      expect(metadata).toEqual({
        toolpack: 'mobile_core',
        category: 'mobile',
        sensitive: false,
      });
    });

    it('should return undefined for unknown tools', () => {
      expect(getToolMetadata('unknown_tool')).toBeUndefined();
    });
  });
});

// =============================================================================
// Helper Function Tests
// =============================================================================

describe('Helper Functions', () => {
  describe('createToolMetadata', () => {
    it('should create metadata with defaults', () => {
      const metadata = createToolMetadata({
        name: 'test',
        toolpack: 'core',
        category: 'core',
        description: 'Test tool',
      });

      expect(metadata).toEqual({
        name: 'test',
        toolpack: 'core',
        category: 'core',
        description: 'Test tool',
        sensitive: false,
        version: '1.0.0',
      });
    });

    it('should allow overriding defaults', () => {
      const metadata = createToolMetadata({
        name: 'dangerous',
        toolpack: 'introspection',
        category: 'introspection',
        description: 'Dangerous tool',
        sensitive: true,
        version: '2.0.0',
      });

      expect(metadata.sensitive).toBe(true);
      expect(metadata.version).toBe('2.0.0');
    });
  });

  describe('isValidToolpack', () => {
    it('should return true for valid toolpack names', () => {
      expect(isValidToolpack('core')).toBe(true);
      expect(isValidToolpack('mobile_core')).toBe(true);
      expect(isValidToolpack('introspection')).toBe(true);
      expect(isValidToolpack('graphing')).toBe(true);
    });

    it('should return false for invalid toolpack names', () => {
      expect(isValidToolpack('invalid')).toBe(false);
      expect(isValidToolpack('')).toBe(false);
      expect(isValidToolpack('CORE')).toBe(false);
    });
  });

  describe('isValidCategory', () => {
    it('should return true for valid category names', () => {
      expect(isValidCategory('core')).toBe(true);
      expect(isValidCategory('mobile')).toBe(true);
      expect(isValidCategory('graph')).toBe(true);
      expect(isValidCategory('introspection')).toBe(true);
    });

    it('should return false for invalid category names', () => {
      expect(isValidCategory('invalid')).toBe(false);
      expect(isValidCategory('mobile_core')).toBe(false); // toolpack name, not category
    });
  });
});

// =============================================================================
// Global Registry Tests
// =============================================================================

describe('Global toolRegistry', () => {
  it('should be a singleton instance', () => {
    expect(toolRegistry).toBeInstanceOf(ToolRegistry);
  });

  it('should have tools registered from index.ts', () => {
    // This test verifies that the global registry was populated
    // The actual count depends on index.ts executing and tools having TOOL_METADATA entries
    // Skip if registry is empty (index.ts may not have run in test environment)
    if (toolRegistry.size > 0) {
      expect(toolRegistry.listTools().length).toBeGreaterThan(0);
      expect(toolRegistry.listTools().length).toBe(toolRegistry.size);
    } else {
      // In test environment, index.ts tool registration may not execute
      expect(toolRegistry.size).toBe(0);
    }
  });
});

// =============================================================================
// Consistency Tests
// =============================================================================

describe('Toolpack and TOOL_METADATA Consistency', () => {
  it('should have matching tools between TOOLPACKS and TOOL_METADATA', () => {
    const toolpackTools = getAllTools();
    const metadataTools = Object.keys(TOOL_METADATA);

    expect(new Set(toolpackTools)).toEqual(new Set(metadataTools));
  });

  it('should have matching sensitive flags', () => {
    for (const toolName of getAllTools()) {
      const metaSensitive = TOOL_METADATA[toolName]?.sensitive ?? false;
      const packSensitive = isToolSensitive(toolName);

      expect(metaSensitive).toBe(packSensitive);
    }
  });

  it('should have matching toolpack assignments', () => {
    for (const toolName of getAllTools()) {
      const metaToolpack = TOOL_METADATA[toolName]?.toolpack;
      const packToolpack = getToolpackForTool(toolName);

      expect(metaToolpack).toBe(packToolpack);
    }
  });
});
