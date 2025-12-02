/**
 * Profile System Types
 *
 * Defines startup profiles for dynamic tool management.
 * Profiles control which tools are enabled at server startup.
 *
 * @module apps/mcp/src/types/profiles
 * @since GPT Phase 3: Sub-Phase 5.6.0
 */

import type { ToolpackName } from './tool-handle.js';

// =============================================================================
// Core Types
// =============================================================================

/**
 * Startup profile names
 */
export type ProfileName = 'minimal' | 'mobile' | 'full';

/**
 * Router operation mode
 *
 * - `auto`: Auto-enable disabled tools on first use (default)
 * - `respect`: Only execute enabled tools, fail otherwise
 * - `bypass`: Execute any tool without enabling (no notifications)
 */
export type RouterMode = 'auto' | 'respect' | 'bypass';

// =============================================================================
// Profile Definition
// =============================================================================

/**
 * Profile configuration
 */
export interface Profile {
  /** Profile identifier */
  name: ProfileName;

  /** Human-readable description */
  description: string;

  /** Toolpacks to enable for this profile */
  toolpacks: ToolpackName[];

  /** Additional individual tools to enable beyond toolpacks */
  additionalTools: string[];

  /** Estimated token count for this profile's tools */
  estimatedTokens: number;
}

/**
 * Complete profile configuration map
 */
export type ProfileConfig = Record<ProfileName, Profile>;

// =============================================================================
// Profile Definitions
// =============================================================================

/**
 * Available profiles for the Synthesis MCP server
 *
 * @example
 * // At startup with minimal profile
 * // Only gateway tools (~2,000 tokens) + list_collections
 *
 * @example
 * // At startup with mobile profile
 * // Gateway + mobile_core + basic core tools (~5,000 tokens)
 *
 * @example
 * // At startup with full profile
 * // All tools enabled (~16,000 tokens)
 */
export const PROFILES: ProfileConfig = {
  /**
   * Minimal profile (default)
   *
   * Only gateway tools plus read-only collection listing.
   * Ideal for generic MCP clients and token-constrained contexts.
   * Other tools can be enabled on-demand via enable_tools or auto-enabled via router.
   */
  minimal: {
    name: 'minimal',
    description: 'Only always-on tools + basic collections (read-only)',
    toolpacks: [],
    additionalTools: ['list_collections'],
    estimatedTokens: 2500,
  },

  /**
   * Mobile profile
   *
   * Optimized for mobile development workflows.
   * Enables mobile_core toolpack plus essential core tools.
   */
  mobile: {
    name: 'mobile',
    description: 'Mobile development focused',
    toolpacks: ['mobile_core'],
    additionalTools: ['list_collections', 'list_documents', 'search_rag'],
    estimatedTokens: 5000,
  },

  /**
   * Full profile
   *
   * All tools enabled. Maximum capability but high token usage.
   * Use for contexts with unlimited token budgets.
   */
  full: {
    name: 'full',
    description: 'All tools enabled',
    toolpacks: ['core', 'mobile_core', 'introspection', 'graphing'],
    additionalTools: [],
    estimatedTokens: 16000,
  },
};

/**
 * Default profile when MCP_TOOL_PROFILE is not set
 */
export const DEFAULT_PROFILE: ProfileName = 'minimal';

// =============================================================================
// Profile Helpers
// =============================================================================

/**
 * Get profile configuration by name
 *
 * @param name - Profile name (falls back to default if invalid)
 * @returns Profile configuration
 */
export function getProfile(name?: string): Profile {
  if (name && isValidProfile(name)) {
    return PROFILES[name];
  }
  return PROFILES[DEFAULT_PROFILE];
}

/**
 * List all available profile names
 */
export function listProfileNames(): ProfileName[] {
  return Object.keys(PROFILES) as ProfileName[];
}

/**
 * Check if a string is a valid profile name
 */
export function isValidProfile(name: string): name is ProfileName {
  return name in PROFILES;
}

/**
 * Check if a string is a valid router mode
 */
export function isValidRouterMode(mode: string): mode is RouterMode {
  return ['auto', 'respect', 'bypass'].includes(mode);
}

// =============================================================================
// Environment Configuration
// =============================================================================

/**
 * Dynamic tool management configuration
 */
export interface DynamicToolConfig {
  /** Active startup profile */
  profile: ProfileName;

  /** Router operation mode */
  routerMode: RouterMode;

  /** Enforce explicit enable for sensitive tools */
  sensitiveEnforce: boolean;

  /** Enable debug logging */
  debug: boolean;
}

/**
 * Parse dynamic tool configuration from environment variables
 *
 * Environment variables:
 * - `MCP_TOOL_PROFILE`: Startup profile (default: 'minimal')
 * - `ROUTER_MODE`: Router operation mode (default: 'auto')
 * - `ROUTER_SENSITIVE_ENFORCE`: Require explicit enable for sensitive tools (default: 'false')
 * - `MCP_DEBUG`: Enable debug logging (default: 'false')
 *
 * @returns Parsed configuration with validated values
 */
export function parseEnvConfig(): DynamicToolConfig {
  const profileEnv = process.env.MCP_TOOL_PROFILE;
  const routerModeEnv = process.env.ROUTER_MODE || 'auto';
  const sensitiveEnforceEnv = process.env.ROUTER_SENSITIVE_ENFORCE;
  const debugEnv = process.env.MCP_DEBUG;

  return {
    profile: isValidProfile(profileEnv || '') ? (profileEnv as ProfileName) : DEFAULT_PROFILE,
    routerMode: isValidRouterMode(routerModeEnv) ? routerModeEnv : 'auto',
    sensitiveEnforce: sensitiveEnforceEnv === 'true',
    debug: debugEnv === 'true' || debugEnv === '1',
  };
}

// =============================================================================
// Token Estimation
// =============================================================================

/**
 * Estimate token count for a profile
 *
 * @param profile - Profile name
 * @returns Estimated token count
 */
export function estimateProfileTokens(profile: ProfileName): number {
  return PROFILES[profile].estimatedTokens;
}

/**
 * Get the profile with the lowest token count that includes a specific toolpack
 *
 * @param toolpack - Required toolpack
 * @returns Smallest profile that includes the toolpack, or 'full' if not found
 */
export function getSmallestProfileWithToolpack(toolpack: ToolpackName): ProfileName {
  // Sort profiles by token count
  const sorted = listProfileNames().sort(
    (a, b) => PROFILES[a].estimatedTokens - PROFILES[b].estimatedTokens
  );

  // Find first profile that includes the toolpack
  for (const profile of sorted) {
    if (PROFILES[profile].toolpacks.includes(toolpack)) {
      return profile;
    }
  }

  // Fallback to full if toolpack not found in any profile
  return 'full';
}

/**
 * Category descriptions for discovery
 */
export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  core: 'Basic RAG operations: search, collections, documents',
  mobile: 'Mobile development: docs, examples, recipes',
  graph: 'Knowledge graph traversal and context expansion',
  introspection: 'Project analysis: tech stack, symbols, schema',
  gateway: 'Dynamic tool management: discovery, enable, routing',
};
