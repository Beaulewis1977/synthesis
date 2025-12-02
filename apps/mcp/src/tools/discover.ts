/**
 * Discovery Gateway Tool Implementation
 *
 * Implements the synthesis_discover_tools gateway tool for dynamic tool management.
 * Provides task-based recommendations and full catalog browsing.
 *
 * @module apps/mcp/src/tools/discover
 * @since GPT Phase 3: Sub-Phase 5.6.2
 */

import type { DynamicToolRegistry } from '../tool-registry.js';
import { TOOLPACKS, TOOL_METADATA, getToolpack } from '../toolpacks.js';
import type {
  CategoryInfo,
  DiscoverResult,
  ToolRef,
  ToolpackInfo,
} from '../types/gateway-responses.js';
import type { DiscoverToolsInput } from '../types/gateway-schemas.js';
import type { CategoryName, ProfileName, ToolpackName } from '../types/tool-handle.js';

// =============================================================================
// Category Descriptions
// =============================================================================

/**
 * Human-readable descriptions for each category
 */
const CATEGORY_DESCRIPTIONS: Record<CategoryName, string> = {
  core: 'Basic RAG operations: search, collections, documents, repositories',
  mobile: 'Mobile development: documentation, code examples, feature recipes',
  graph: 'Knowledge graph traversal and context expansion',
  introspection: 'Project analysis: tech stack, database schema, symbol usages',
  gateway: 'Dynamic tool management: discovery, enable, routing, bridging',
};

/**
 * Map of toolpack to default profile (when that toolpack is auto-enabled)
 */
const TOOLPACK_DEFAULT_PROFILES: Record<ToolpackName, ProfileName> = {
  core: 'minimal',
  mobile_core: 'mobile',
  introspection: 'full',
  graphing: 'full',
  gateway: 'minimal', // Always enabled
};

// =============================================================================
// Keyword Matching for Recommendations
// =============================================================================

/**
 * Keywords associated with each tool for recommendation matching
 */
const TOOL_KEYWORDS: Record<string, string[]> = {
  // Mobile Core
  search_mobile_docs: [
    'mobile',
    'flutter',
    'react native',
    'ios',
    'android',
    'documentation',
    'docs',
    'framework',
    'sdk',
  ],
  find_code_examples: [
    'example',
    'code',
    'sample',
    'demo',
    'implementation',
    'snippet',
    'how to',
    'tutorial',
  ],
  get_feature_recipe: [
    'recipe',
    'pattern',
    'best practice',
    'architecture',
    'feature',
    'auth',
    'authentication',
    'payment',
    'billing',
    'notification',
    'push',
    'offline',
    'sync',
    'navigation',
  ],

  // Introspection
  get_project_tech_stack: [
    'tech stack',
    'technology',
    'framework',
    'dependencies',
    'project',
    'stack',
    'what is used',
  ],
  get_db_schema: [
    'database',
    'schema',
    'table',
    'column',
    'sql',
    'postgres',
    'supabase',
    'migration',
  ],
  find_symbol_usages: [
    'symbol',
    'function',
    'class',
    'method',
    'usage',
    'reference',
    'definition',
    'where is',
    'find',
  ],

  // Graphing
  graph_expand_context: [
    'graph',
    'context',
    'relationship',
    'expand',
    'connected',
    'related',
    'trace',
    'flow',
  ],

  // Core
  search_rag: ['search', 'find', 'query', 'lookup', 'information', 'knowledge', 'rag'],
  list_collections: ['collection', 'list', 'available', 'show'],
  list_documents: ['document', 'list', 'files', 'show'],
  create_collection: ['create', 'new', 'collection', 'add'],
  fetch_and_add_document_from_url: ['url', 'fetch', 'web', 'add', 'document', 'crawl'],
  delete_document: ['delete', 'remove', 'document'],
  delete_collection: ['delete', 'remove', 'collection'],
  add_repo_to_collection: ['repository', 'repo', 'git', 'github', 'add'],
  sync_repo: ['sync', 'update', 'repository', 'repo', 'refresh'],
  list_repos: ['repository', 'repo', 'list', 'show'],
};

/**
 * Calculate relevance score for a tool based on task keywords
 *
 * @param toolName Tool name to score
 * @param taskWords Array of normalized words from the task
 * @returns Relevance score (0-1)
 */
function calculateRelevance(toolName: string, taskWords: string[]): number {
  const keywords = TOOL_KEYWORDS[toolName] || [];
  if (keywords.length === 0) return 0;

  let score = 0;
  const maxScore = Math.min(taskWords.length, 5); // Cap at 5 matches

  for (const taskWord of taskWords) {
    for (const keyword of keywords) {
      // Exact match bonus
      if (keyword === taskWord) {
        score += 1.0;
      }
      // Partial match (keyword contains word or vice versa)
      else if (keyword.includes(taskWord) || taskWord.includes(keyword)) {
        score += 0.5;
      }
    }
  }

  // Normalize to 0-1 range
  return Math.min(score / maxScore, 1);
}

/**
 * Compute tool recommendations based on task description
 *
 * Uses simple keyword matching against tool descriptions and keywords.
 *
 * @param task Task description from user
 * @param registry Dynamic tool registry for state lookup
 * @returns Array of recommended tools sorted by relevance
 */
export function computeRecommendations(task: string, registry: DynamicToolRegistry): ToolRef[] {
  // Normalize task to lowercase words
  const taskWords = task
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2); // Filter out short words

  if (taskWords.length === 0) {
    return [];
  }

  const recommendations: Array<ToolRef & { relevance: number }> = [];

  // Score all tools
  for (const [toolName, meta] of Object.entries(TOOL_METADATA)) {
    // Skip gateway tools - they're always available
    if (meta.toolpack === 'gateway') continue;

    const relevance = calculateRelevance(toolName, taskWords);
    if (relevance > 0.1) {
      // Threshold to filter noise
      const handle = registry.getHandle(toolName);
      const packDef = getToolpack(meta.toolpack);

      recommendations.push({
        name: toolName,
        description: packDef?.description || 'Tool description',
        toolpack: meta.toolpack,
        category: meta.category,
        sensitive: meta.sensitive,
        version: handle?.version || '1.0.0',
        enabled: handle?.isEnabled ?? false,
        relevance,
      });
    }
  }

  // Sort by relevance descending, limit to top 10
  return recommendations.sort((a, b) => b.relevance - a.relevance).slice(0, 10);
}

/**
 * Build suggestion message based on recommendations
 *
 * @param recommendations Array of recommended tools
 * @returns Human-readable suggestion message
 */
export function buildSuggestion(recommendations: ToolRef[] | undefined): string | undefined {
  if (!recommendations || recommendations.length === 0) {
    return 'No specific tools matched your task. Try enable_tools with a toolpack like "mobile_core" or "introspection".';
  }

  // Find toolpacks that cover most recommendations
  const toolpackCounts = new Map<ToolpackName, number>();
  for (const rec of recommendations) {
    const count = toolpackCounts.get(rec.toolpack) || 0;
    toolpackCounts.set(rec.toolpack, count + 1);
  }

  // Get the dominant toolpack
  let maxPack: ToolpackName = 'core';
  let maxCount = 0;
  for (const [pack, count] of toolpackCounts) {
    if (count > maxCount) {
      maxPack = pack;
      maxCount = count;
    }
  }

  const disabledCount = recommendations.filter((r) => !r.enabled).length;
  if (disabledCount > 0) {
    return `Found ${recommendations.length} relevant tools. ${disabledCount} are disabled. Run enable_tools({ toolpacks: ["${maxPack}"] }) to enable them.`;
  }

  return `Found ${recommendations.length} relevant tools, all enabled. Top match: ${recommendations[0].name}`;
}

// =============================================================================
// Toolpack Info Builder
// =============================================================================

/**
 * Build toolpack information from registry state
 *
 * @param registry Dynamic tool registry
 * @returns Array of toolpack info objects
 */
export function buildToolpacksInfo(registry: DynamicToolRegistry): ToolpackInfo[] {
  const result: ToolpackInfo[] = [];

  for (const [packName, packDef] of Object.entries(TOOLPACKS)) {
    // Count enabled tools in this pack
    let enabledCount = 0;
    for (const toolName of packDef.tools) {
      if (registry.isEnabled(toolName)) {
        enabledCount++;
      }
    }

    result.push({
      name: packName as ToolpackName,
      description: packDef.description,
      tools: [...packDef.tools],
      sensitiveTools: [...packDef.sensitive],
      defaultProfile: TOOLPACK_DEFAULT_PROFILES[packName as ToolpackName],
      enabledCount,
      totalCount: packDef.tools.length,
    });
  }

  return result;
}

// =============================================================================
// Category Info Builder
// =============================================================================

/**
 * Build category information from registry state
 *
 * @param registry Dynamic tool registry
 * @returns Array of category info objects
 */
export function buildCategoriesInfo(registry: DynamicToolRegistry): CategoryInfo[] {
  // Group tools by category
  const categoryTools = new Map<CategoryName, string[]>();
  const categoryEnabled = new Map<CategoryName, number>();

  for (const [toolName, meta] of Object.entries(TOOL_METADATA)) {
    const tools = categoryTools.get(meta.category) || [];
    tools.push(toolName);
    categoryTools.set(meta.category, tools);

    if (registry.isEnabled(toolName)) {
      const count = categoryEnabled.get(meta.category) || 0;
      categoryEnabled.set(meta.category, count + 1);
    }
  }

  const result: CategoryInfo[] = [];
  for (const [category, description] of Object.entries(CATEGORY_DESCRIPTIONS)) {
    const tools = categoryTools.get(category as CategoryName) || [];
    result.push({
      name: category as CategoryName,
      description,
      tools,
      enabledCount: categoryEnabled.get(category as CategoryName) || 0,
      totalCount: tools.length,
    });
  }

  return result;
}

// =============================================================================
// Main Discovery Function
// =============================================================================

/**
 * Build discovery result for synthesis_discover_tools
 *
 * This is the main entry point for the discovery gateway tool.
 *
 * Behavior:
 * - list_all: true → full catalog always returned (toolpacks/categories)
 * - task alone → recommendations + catalog
 * - task + list_all: true → both (recommendations + full catalog)
 * - The catalog (toolpacks/categories) is always included in the response
 *
 * @param input Validated discovery input
 * @param registry Dynamic tool registry for state lookup
 * @returns DiscoverResult with recommendations and/or catalog
 */
export function buildDiscoverResult(
  input: DiscoverToolsInput,
  registry: DynamicToolRegistry
): DiscoverResult {
  // 1. Build toolpacks info from TOOLPACKS + registry state
  const toolpacks: ToolpackInfo[] = buildToolpacksInfo(registry);

  // 2. Build categories info from TOOL_METADATA + registry state
  const categories: CategoryInfo[] = buildCategoriesInfo(registry);

  // 3. If task provided, compute recommendations via keyword matching
  const recommended = input.task ? computeRecommendations(input.task, registry) : undefined;

  // 4. Build suggestion message
  const suggestion = input.task ? buildSuggestion(recommended) : undefined;

  return {
    recommended,
    toolpacks,
    categories,
    suggestion,
    totalTools: registry.size,
    enabledTools: registry.getEnabledCount(),
  };
}
