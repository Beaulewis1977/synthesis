/**
 * Type Contracts Test Suite
 *
 * Tests for the dynamic tool management type contracts (Sub-Phase 5.6.0).
 * Validates Zod schemas, type guards, and profile configurations.
 *
 * @module apps/mcp/src/types/__tests__/type-contracts.test
 * @since GPT Phase 3: Sub-Phase 5.6.0
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROFILE,
  GATEWAY_SCHEMAS,
  GATEWAY_TOOL_NAMES,
  PROFILES,
  bridgeInputSchema,
  discoverToolsInputSchema,
  enableToolsInputSchema,
  estimateProfileTokens,
  getProfile,
  getSmallestProfileWithToolpack,
  isGatewayTool,
  isRouterError,
  isRouterSuccess,
  isValidCategoryName,
  isValidProfile,
  isValidProfileName,
  isValidRouterMode,
  isValidToolpackName,
  listProfileNames,
  parseEnvConfig,
  routerInputSchema,
  searchInputSchema,
  toToolResult,
  wrapGatewayResponse,
} from '../index.js';

// =============================================================================
// Test Data
// =============================================================================

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const INVALID_UUID = 'not-a-uuid';

// =============================================================================
// Gateway Schema Tests
// =============================================================================

describe('Gateway Tool Input Schemas', () => {
  describe('discoverToolsInputSchema', () => {
    it('accepts task string', () => {
      const result = discoverToolsInputSchema.safeParse({
        task: 'Find Flutter auth examples with Supabase',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.task).toBe('Find Flutter auth examples with Supabase');
        expect(result.data.list_all).toBe(false);
      }
    });

    it('accepts list_all flag', () => {
      const result = discoverToolsInputSchema.safeParse({ list_all: true });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.list_all).toBe(true);
      }
    });

    it('accepts empty object (list_all defaults to false)', () => {
      const result = discoverToolsInputSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.list_all).toBe(false);
      }
    });

    it('accepts both task and list_all', () => {
      const result = discoverToolsInputSchema.safeParse({
        task: 'some task',
        list_all: true,
      });
      expect(result.success).toBe(true);
    });

    it('rejects extra fields (strict mode)', () => {
      const result = discoverToolsInputSchema.safeParse({
        task: 'test',
        unknown_field: 'value',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('enableToolsInputSchema', () => {
    it('accepts tools array', () => {
      const result = enableToolsInputSchema.safeParse({
        tools: ['search_mobile_docs', 'find_code_examples'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tools).toHaveLength(2);
      }
    });

    it('accepts toolpacks array', () => {
      const result = enableToolsInputSchema.safeParse({
        toolpacks: ['mobile_core', 'introspection'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.toolpacks).toEqual(['mobile_core', 'introspection']);
      }
    });

    it('accepts categories array', () => {
      const result = enableToolsInputSchema.safeParse({
        categories: ['mobile', 'graph'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.categories).toEqual(['mobile', 'graph']);
      }
    });

    it('accepts combination of tools, toolpacks, and categories', () => {
      const result = enableToolsInputSchema.safeParse({
        tools: ['search_rag'],
        toolpacks: ['mobile_core'],
        categories: ['graph'],
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty object (refine validation)', () => {
      const result = enableToolsInputSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('At least one of');
      }
    });

    it('rejects empty arrays (refine validation)', () => {
      const result = enableToolsInputSchema.safeParse({
        tools: [],
        toolpacks: [],
        categories: [],
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid toolpack name', () => {
      const result = enableToolsInputSchema.safeParse({
        toolpacks: ['invalid_pack'],
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid category name', () => {
      const result = enableToolsInputSchema.safeParse({
        categories: ['invalid_category'],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('routerInputSchema', () => {
    it('accepts action and params', () => {
      const result = routerInputSchema.safeParse({
        action: 'search_mobile_docs',
        params: {
          collectionId: VALID_UUID,
          query: 'auth with Supabase',
        },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBe('search_mobile_docs');
        expect(result.data.params).toHaveProperty('collectionId');
      }
    });

    it('accepts empty params object', () => {
      const result = routerInputSchema.safeParse({
        action: 'list_collections',
        params: {},
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty action string', () => {
      const result = routerInputSchema.safeParse({
        action: '',
        params: {},
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing params', () => {
      const result = routerInputSchema.safeParse({
        action: 'test',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing action', () => {
      const result = routerInputSchema.safeParse({
        params: {},
      });
      expect(result.success).toBe(false);
    });
  });

  describe('bridgeInputSchema', () => {
    it('accepts synthesis server', () => {
      const result = bridgeInputSchema.safeParse({
        server: 'synthesis',
        tool: 'search_rag',
        params: { collectionId: VALID_UUID, query: 'test' },
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-synthesis server (literal validation)', () => {
      const result = bridgeInputSchema.safeParse({
        server: 'other_server',
        tool: 'search_rag',
        params: {},
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty tool name', () => {
      const result = bridgeInputSchema.safeParse({
        server: 'synthesis',
        tool: '',
        params: {},
      });
      expect(result.success).toBe(false);
    });
  });

  describe('searchInputSchema', () => {
    it('accepts valid search input', () => {
      const result = searchInputSchema.safeParse({
        collectionId: VALID_UUID,
        query: 'flutter authentication',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.collectionId).toBe(VALID_UUID);
        expect(result.data.query).toBe('flutter authentication');
      }
    });

    it('applies default values', () => {
      const result = searchInputSchema.parse({
        collectionId: VALID_UUID,
        query: 'test',
      });
      expect(result.top_k).toBe(5);
      expect(result.min_similarity).toBe(0.5);
    });

    it('accepts custom top_k and min_similarity', () => {
      const result = searchInputSchema.safeParse({
        collectionId: VALID_UUID,
        query: 'test',
        top_k: 10,
        min_similarity: 0.7,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.top_k).toBe(10);
        expect(result.data.min_similarity).toBe(0.7);
      }
    });

    it('rejects invalid UUID', () => {
      const result = searchInputSchema.safeParse({
        collectionId: INVALID_UUID,
        query: 'test',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty query', () => {
      const result = searchInputSchema.safeParse({
        collectionId: VALID_UUID,
        query: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects top_k outside valid range', () => {
      const tooLow = searchInputSchema.safeParse({
        collectionId: VALID_UUID,
        query: 'test',
        top_k: 0,
      });
      expect(tooLow.success).toBe(false);

      const tooHigh = searchInputSchema.safeParse({
        collectionId: VALID_UUID,
        query: 'test',
        top_k: 51,
      });
      expect(tooHigh.success).toBe(false);
    });

    it('rejects min_similarity outside valid range', () => {
      const tooLow = searchInputSchema.safeParse({
        collectionId: VALID_UUID,
        query: 'test',
        min_similarity: -0.1,
      });
      expect(tooLow.success).toBe(false);

      const tooHigh = searchInputSchema.safeParse({
        collectionId: VALID_UUID,
        query: 'test',
        min_similarity: 1.1,
      });
      expect(tooHigh.success).toBe(false);
    });
  });
});

// =============================================================================
// Gateway Tool Registry Tests
// =============================================================================

describe('Gateway Tool Registry', () => {
  it('has exactly 5 gateway tools', () => {
    expect(GATEWAY_TOOL_NAMES).toHaveLength(5);
  });

  it('contains expected tool names', () => {
    expect(GATEWAY_TOOL_NAMES).toContain('synthesis_discover_tools');
    expect(GATEWAY_TOOL_NAMES).toContain('enable_tools');
    expect(GATEWAY_TOOL_NAMES).toContain('synthesis_router');
    expect(GATEWAY_TOOL_NAMES).toContain('synthesis_mcp_bridge');
    expect(GATEWAY_TOOL_NAMES).toContain('synthesis_search');
  });

  it('has schemas for all gateway tools', () => {
    for (const name of GATEWAY_TOOL_NAMES) {
      expect(GATEWAY_SCHEMAS[name]).toBeDefined();
    }
  });

  it('isGatewayTool correctly identifies gateway tools', () => {
    expect(isGatewayTool('synthesis_discover_tools')).toBe(true);
    expect(isGatewayTool('enable_tools')).toBe(true);
    expect(isGatewayTool('search_rag')).toBe(false);
    expect(isGatewayTool('unknown_tool')).toBe(false);
  });
});

// =============================================================================
// Profile System Tests
// =============================================================================

describe('Profile System', () => {
  it('has exactly 3 profiles', () => {
    expect(Object.keys(PROFILES)).toHaveLength(3);
  });

  it('has minimal, mobile, and full profiles', () => {
    expect(PROFILES.minimal).toBeDefined();
    expect(PROFILES.mobile).toBeDefined();
    expect(PROFILES.full).toBeDefined();
  });

  it('default profile is minimal', () => {
    expect(DEFAULT_PROFILE).toBe('minimal');
  });

  it('getProfile returns correct profile', () => {
    expect(getProfile('minimal').name).toBe('minimal');
    expect(getProfile('mobile').name).toBe('mobile');
    expect(getProfile('full').name).toBe('full');
  });

  it('getProfile falls back to default for invalid name', () => {
    expect(getProfile('invalid').name).toBe('minimal');
    expect(getProfile(undefined).name).toBe('minimal');
  });

  it('listProfileNames returns all profile names', () => {
    const names = listProfileNames();
    expect(names).toContain('minimal');
    expect(names).toContain('mobile');
    expect(names).toContain('full');
    expect(names).toHaveLength(3);
  });

  it('isValidProfile correctly validates', () => {
    expect(isValidProfile('minimal')).toBe(true);
    expect(isValidProfile('mobile')).toBe(true);
    expect(isValidProfile('full')).toBe(true);
    expect(isValidProfile('invalid')).toBe(false);
  });

  it('isValidRouterMode correctly validates', () => {
    expect(isValidRouterMode('auto')).toBe(true);
    expect(isValidRouterMode('respect')).toBe(true);
    expect(isValidRouterMode('bypass')).toBe(true);
    expect(isValidRouterMode('invalid')).toBe(false);
  });

  it('estimateProfileTokens returns expected values', () => {
    expect(estimateProfileTokens('minimal')).toBe(2500);
    expect(estimateProfileTokens('mobile')).toBe(5000);
    expect(estimateProfileTokens('full')).toBe(16000);
  });

  it('getSmallestProfileWithToolpack finds correct profile', () => {
    expect(getSmallestProfileWithToolpack('mobile_core')).toBe('mobile');
    expect(getSmallestProfileWithToolpack('core')).toBe('full');
    expect(getSmallestProfileWithToolpack('introspection')).toBe('full');
  });

  it('profile token counts are ordered correctly', () => {
    expect(PROFILES.minimal.estimatedTokens).toBeLessThan(PROFILES.mobile.estimatedTokens);
    expect(PROFILES.mobile.estimatedTokens).toBeLessThan(PROFILES.full.estimatedTokens);
  });
});

// =============================================================================
// Type Guard Tests
// =============================================================================

describe('Type Guards', () => {
  describe('isValidToolpackName', () => {
    it('validates correct toolpack names', () => {
      expect(isValidToolpackName('core')).toBe(true);
      expect(isValidToolpackName('mobile_core')).toBe(true);
      expect(isValidToolpackName('introspection')).toBe(true);
      expect(isValidToolpackName('graphing')).toBe(true);
      expect(isValidToolpackName('gateway')).toBe(true);
    });

    it('rejects invalid toolpack names', () => {
      expect(isValidToolpackName('invalid')).toBe(false);
      expect(isValidToolpackName('')).toBe(false);
      expect(isValidToolpackName(123)).toBe(false);
      expect(isValidToolpackName(null)).toBe(false);
      expect(isValidToolpackName(undefined)).toBe(false);
    });
  });

  describe('isValidCategoryName', () => {
    it('validates correct category names', () => {
      expect(isValidCategoryName('core')).toBe(true);
      expect(isValidCategoryName('mobile')).toBe(true);
      expect(isValidCategoryName('graph')).toBe(true);
      expect(isValidCategoryName('introspection')).toBe(true);
      expect(isValidCategoryName('gateway')).toBe(true);
    });

    it('rejects invalid category names', () => {
      expect(isValidCategoryName('invalid')).toBe(false);
      expect(isValidCategoryName('')).toBe(false);
    });
  });

  describe('isValidProfileName', () => {
    it('validates correct profile names', () => {
      expect(isValidProfileName('minimal')).toBe(true);
      expect(isValidProfileName('mobile')).toBe(true);
      expect(isValidProfileName('full')).toBe(true);
    });

    it('rejects invalid profile names', () => {
      expect(isValidProfileName('invalid')).toBe(false);
      expect(isValidProfileName('')).toBe(false);
    });
  });
});

// =============================================================================
// Response Type Guards Tests
// =============================================================================

describe('Response Type Guards', () => {
  describe('isRouterError', () => {
    it('identifies router errors', () => {
      const error = {
        error: 'Tool not found',
        gated: false,
      };
      expect(isRouterError(error)).toBe(true);
    });

    it('identifies router success as not error', () => {
      const success = {
        result: { content: [{ type: 'text' as const, text: 'ok' }] },
        _routerMetadata: {
          enabledNow: false,
          visibleToClient: true,
          toolVersion: '1.0.0',
          executionMs: 100,
        },
      };
      expect(isRouterError(success)).toBe(false);
    });
  });

  describe('isRouterSuccess', () => {
    it('identifies router success', () => {
      const success = {
        result: { content: [{ type: 'text' as const, text: 'ok' }] },
        _routerMetadata: {
          enabledNow: false,
          visibleToClient: true,
          toolVersion: '1.0.0',
          executionMs: 100,
        },
      };
      expect(isRouterSuccess(success)).toBe(true);
    });

    it('identifies router error as not success', () => {
      const error = {
        error: 'Tool not found',
        gated: false,
      };
      expect(isRouterSuccess(error)).toBe(false);
    });
  });
});

// =============================================================================
// Helper Function Tests
// =============================================================================

describe('Helper Functions', () => {
  describe('toToolResult', () => {
    it('converts string to tool result', () => {
      const result = toToolResult('hello');
      expect(result.content[0].text).toBe('hello');
      expect(result.isError).toBeFalsy();
    });

    it('converts object to JSON tool result', () => {
      const result = toToolResult({ key: 'value' });
      expect(result.content[0].text).toContain('"key"');
      expect(result.content[0].text).toContain('"value"');
    });

    it('sets isError flag when specified', () => {
      const result = toToolResult('error message', true);
      expect(result.isError).toBe(true);
    });
  });

  describe('wrapGatewayResponse', () => {
    it('wraps data with timestamp and source', () => {
      const wrapped = wrapGatewayResponse({ foo: 'bar' }, 'synthesis_search');
      expect(wrapped.data).toEqual({ foo: 'bar' });
      expect(wrapped.source).toBe('synthesis_search');
      expect(wrapped.timestamp).toBeDefined();
      // Verify timestamp is ISO format
      expect(() => new Date(wrapped.timestamp)).not.toThrow();
    });
  });
});

// =============================================================================
// Environment Config Tests
// =============================================================================

describe('parseEnvConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env for each test
    process.env = { ...originalEnv };
    process.env.MCP_TOOL_PROFILE = undefined;
    process.env.ROUTER_MODE = undefined;
    process.env.ROUTER_SENSITIVE_ENFORCE = undefined;
    process.env.MCP_DEBUG = undefined;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns defaults when no env vars set', () => {
    const config = parseEnvConfig();
    expect(config.profile).toBe('minimal');
    expect(config.routerMode).toBe('auto');
    expect(config.sensitiveEnforce).toBe(false);
    expect(config.debug).toBe(false);
  });

  it('parses valid MCP_TOOL_PROFILE', () => {
    process.env.MCP_TOOL_PROFILE = 'mobile';
    const config = parseEnvConfig();
    expect(config.profile).toBe('mobile');
  });

  it('falls back to default for invalid profile', () => {
    process.env.MCP_TOOL_PROFILE = 'invalid';
    const config = parseEnvConfig();
    expect(config.profile).toBe('minimal');
  });

  it('parses ROUTER_MODE', () => {
    process.env.ROUTER_MODE = 'respect';
    const config = parseEnvConfig();
    expect(config.routerMode).toBe('respect');
  });

  it('falls back to auto for invalid router mode', () => {
    process.env.ROUTER_MODE = 'invalid';
    const config = parseEnvConfig();
    expect(config.routerMode).toBe('auto');
  });

  it('parses ROUTER_SENSITIVE_ENFORCE', () => {
    process.env.ROUTER_SENSITIVE_ENFORCE = 'true';
    const config = parseEnvConfig();
    expect(config.sensitiveEnforce).toBe(true);
  });

  it('parses MCP_DEBUG with true', () => {
    process.env.MCP_DEBUG = 'true';
    const config = parseEnvConfig();
    expect(config.debug).toBe(true);
  });

  it('parses MCP_DEBUG with 1', () => {
    process.env.MCP_DEBUG = '1';
    const config = parseEnvConfig();
    expect(config.debug).toBe(true);
  });
});
