/**
 * Toolpack Definitions for Server-Side Tool Registry
 *
 * Phase 16F: Port toolpack definitions from MCP server to main server.
 * These groupings support dynamic tool management and context optimization.
 */

import type {
  CategoryName,
  ProfileDefinition,
  ProfileName,
  ToolpackDefinition,
  ToolpackName,
} from './types.js';

// =============================================================================
// Toolpack Definitions
// =============================================================================

/**
 * Core Pack - Basic RAG operations (14 tools)
 * Primary use: General knowledge management, collection and repo operations
 */
export const CORE_TOOLPACK: ToolpackDefinition = {
  name: 'core',
  description: 'Core RAG operations: search, collections, documents, repositories',
  defaultCategory: 'core',
  tools: [
    // Search & Discovery
    'search_rag',
    'list_collections',
    'list_documents',
    'get_document_status',
    // Collection Management
    'create_collection',
    'delete_collection',
    // Document Operations
    'add_document',
    'fetch_web_content',
    'delete_document',
    'restart_ingest',
    'summarize_document',
    // Repository Ingestion
    'add_repo_to_collection',
    'sync_repo',
    'list_repos',
  ],
  sensitiveTools: ['delete_document', 'delete_collection'],
};

/**
 * Mobile Core Pack - Mobile development documentation
 * Primary use: Feature implementation workflows
 */
export const MOBILE_CORE_TOOLPACK: ToolpackDefinition = {
  name: 'mobile_core',
  description: 'Mobile development: docs, examples, recipes',
  defaultCategory: 'mobile',
  tools: ['search_mobile_docs', 'find_code_examples', 'get_feature_recipe'],
  sensitiveTools: [],
};

/**
 * Introspection Pack - Project analysis tools
 * Primary use: Understanding existing codebases
 */
export const INTROSPECTION_TOOLPACK: ToolpackDefinition = {
  name: 'introspection',
  description: 'Project analysis: tech stack, symbols, schema',
  defaultCategory: 'introspection',
  tools: ['get_project_tech_stack', 'get_db_schema', 'find_symbol_usages'],
  sensitiveTools: ['get_db_schema'],
};

/**
 * Graphing Pack - Knowledge graph traversal
 * Primary use: Code navigation and relationship discovery
 */
export const GRAPHING_TOOLPACK: ToolpackDefinition = {
  name: 'graphing',
  description: 'Knowledge graph traversal and context expansion',
  defaultCategory: 'graph',
  tools: ['graph_expand_context'],
  sensitiveTools: [],
};

/**
 * Gateway Pack - Always-on tools for dynamic management
 * These tools are never disabled and control access to other tools.
 */
export const GATEWAY_TOOLPACK: ToolpackDefinition = {
  name: 'gateway',
  description: 'Always-on gateway tools for dynamic tool management',
  defaultCategory: 'gateway',
  tools: ['discover_tools', 'enable_tools'],
  sensitiveTools: [],
};

/**
 * Web Pack - Real-time information retrieval
 * Primary use: Web search for current information
 */
export const WEB_TOOLPACK: ToolpackDefinition = {
  name: 'web',
  description: 'Web search and real-time information via Perplexity',
  defaultCategory: 'web',
  tools: ['web_search'],
  sensitiveTools: [],
};

/**
 * Orchestration Pack - Subagent and skill management
 * Primary use: Complex multi-step workflows
 */
export const ORCHESTRATION_TOOLPACK: ToolpackDefinition = {
  name: 'orchestration',
  description: 'Subagent spawning and skill invocation for complex workflows',
  defaultCategory: 'orchestration',
  tools: ['spawn_subagent', 'get_subagent_status', 'invoke_skill', 'list_skills'],
  sensitiveTools: [],
};

/**
 * Native Pack - File system operations (sandboxed)
 * Primary use: Reading and searching files within collection storage
 */
export const NATIVE_TOOLPACK: ToolpackDefinition = {
  name: 'native',
  description: 'Native file system operations (glob, grep, read, bash) - sandboxed to collection',
  defaultCategory: 'introspection',
  tools: ['glob_files', 'grep_pattern', 'read_file', 'bash_command'],
  sensitiveTools: ['bash_command'],
};

// =============================================================================
// Toolpack Registry
// =============================================================================

/**
 * Complete toolpack configuration
 */
export const TOOLPACKS: Record<ToolpackName, ToolpackDefinition> = {
  core: CORE_TOOLPACK,
  mobile_core: MOBILE_CORE_TOOLPACK,
  introspection: INTROSPECTION_TOOLPACK,
  graphing: GRAPHING_TOOLPACK,
  gateway: GATEWAY_TOOLPACK,
  web: WEB_TOOLPACK,
  orchestration: ORCHESTRATION_TOOLPACK,
  native: NATIVE_TOOLPACK,
};

// =============================================================================
// Profile Definitions
// =============================================================================

/**
 * Minimal profile - Only gateway tools for discovery
 */
export const MINIMAL_PROFILE: ProfileDefinition = {
  name: 'minimal',
  description: 'Only gateway tools enabled, discover and enable tools as needed',
  toolpacks: ['gateway'],
  additionalTools: [],
};

/**
 * Core profile - Gateway + core RAG tools (default)
 */
export const CORE_PROFILE: ProfileDefinition = {
  name: 'core',
  description: 'Gateway and core RAG tools enabled, discover advanced tools as needed',
  toolpacks: ['gateway', 'core'],
  additionalTools: [],
};

/**
 * Full profile - All tools enabled
 */
export const FULL_PROFILE: ProfileDefinition = {
  name: 'full',
  description: 'All tools enabled, maximum context usage',
  toolpacks: [
    'gateway',
    'core',
    'mobile_core',
    'introspection',
    'graphing',
    'web',
    'orchestration',
  ],
  additionalTools: [],
};

/**
 * Profile registry
 */
export const PROFILES: Record<ProfileName, ProfileDefinition> = {
  minimal: MINIMAL_PROFILE,
  core: CORE_PROFILE,
  full: FULL_PROFILE,
};

// =============================================================================
// Gateway Tool Names (protected from disable)
// =============================================================================

/**
 * Tool names that are always enabled and cannot be disabled
 */
export const GATEWAY_TOOL_NAMES: readonly string[] = ['discover_tools', 'enable_tools'] as const;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get all tools across all toolpacks
 */
export function getAllTools(): string[] {
  const tools = new Set<string>();
  for (const pack of Object.values(TOOLPACKS)) {
    for (const tool of pack.tools) {
      tools.add(tool);
    }
  }
  return Array.from(tools);
}

/**
 * Get all sensitive tools across all toolpacks
 */
export function getAllSensitiveTools(): string[] {
  const sensitive = new Set<string>();
  for (const pack of Object.values(TOOLPACKS)) {
    for (const tool of pack.sensitiveTools) {
      sensitive.add(tool);
    }
  }
  return Array.from(sensitive);
}

/**
 * Get the toolpack a tool belongs to
 */
export function getToolpackForTool(toolName: string): ToolpackName | undefined {
  for (const [packName, pack] of Object.entries(TOOLPACKS)) {
    if (pack.tools.includes(toolName)) {
      return packName as ToolpackName;
    }
  }
  return undefined;
}

/**
 * Check if a tool is marked as sensitive
 */
export function isToolSensitive(toolName: string): boolean {
  for (const pack of Object.values(TOOLPACKS)) {
    if (pack.sensitiveTools.includes(toolName)) {
      return true;
    }
  }
  return false;
}

/**
 * Validate that a string is a valid toolpack name
 * Derived from TOOLPACKS registry keys to avoid maintenance burden
 */
export function isValidToolpack(value: string): value is ToolpackName {
  return value in TOOLPACKS;
}

/**
 * Validate that a string is a valid category name
 * Derived from toolpack default categories to avoid maintenance burden
 */
export function isValidCategory(value: string): value is CategoryName {
  const validCategories = new Set(Object.values(TOOLPACKS).map((p) => p.defaultCategory));
  return validCategories.has(value as CategoryName);
}

/**
 * Validate that a string is a valid profile name
 * Derived from PROFILES registry keys to avoid maintenance burden
 */
export function isValidProfile(value: string): value is ProfileName {
  return value in PROFILES;
}

/**
 * Get tool count per toolpack
 */
export function getToolpackCounts(): Record<ToolpackName, number> {
  const counts: Record<ToolpackName, number> = {} as Record<ToolpackName, number>;
  for (const [name, pack] of Object.entries(TOOLPACKS)) {
    counts[name as ToolpackName] = pack.tools.length;
  }
  return counts;
}
