#!/usr/bin/env npx tsx
/**
 * Token Measurement Utility for MCP Tool Profiles (Sub-Phase 5.6.4)
 *
 * Measures the estimated token footprint of tool definitions to verify:
 * - minimal profile: ~2,000-2,500 tokens (87% reduction from full)
 * - mobile profile: ~4,500-5,500 tokens
 * - full profile: ~14,000-16,000 tokens
 *
 * Token counts are ESTIMATES using the chars/3.5 heuristic.
 * Relative deltas between profiles are what matter for validation.
 *
 * Usage:
 *   npx tsx apps/mcp/perf/token-measurement.ts
 *   npx tsx apps/mcp/perf/token-measurement.ts --json
 *   npx tsx apps/mcp/perf/token-measurement.ts --profile minimal
 *
 * @module apps/mcp/perf/token-measurement
 * @since GPT Phase 3: Sub-Phase 5.6.4
 */

import type { RegisteredToolDefinition } from '../src/tool-registry.js';
import type { ProfileName } from '../src/types/profiles.js';

// =============================================================================
// Constants
// =============================================================================

/**
 * Characters per token ratio for estimation.
 * Based on empirical analysis:
 * - Pure English text: ~4 chars/token
 * - Code/technical text: ~3-3.5 chars/token
 * - Mixed content: ~3.5 chars/token
 */
const CHARS_PER_TOKEN = 3.5;

/**
 * Profile tool mappings (matches PROFILES in profiles.ts)
 * Used to filter tools for each profile's token measurement
 */
const PROFILE_TOOLS: Record<ProfileName, { toolpacks: string[]; additionalTools: string[] }> = {
  minimal: {
    toolpacks: [],
    additionalTools: ['list_collections'],
  },
  mobile: {
    toolpacks: ['mobile_core'],
    additionalTools: ['list_collections', 'list_documents', 'search_rag'],
  },
  full: {
    toolpacks: ['core', 'mobile_core', 'introspection', 'graphing'],
    additionalTools: [],
  },
};

/**
 * Gateway tools that are always enabled (never counted in profile-specific tokens)
 */
const GATEWAY_TOOLS = [
  'synthesis_discover_tools',
  'enable_tools',
  'synthesis_router',
  'synthesis_mcp_bridge',
  'synthesis_search',
];

/**
 * Toolpack to tool name mappings (matches TOOLPACKS in toolpacks.ts)
 */
const TOOLPACK_TOOLS: Record<string, string[]> = {
  core: [
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
  ],
  mobile_core: ['search_mobile_docs', 'find_code_examples', 'get_feature_recipe'],
  introspection: ['get_project_tech_stack', 'get_db_schema', 'find_symbol_usages'],
  graphing: ['graph_expand_context'],
  gateway: GATEWAY_TOOLS,
};

// =============================================================================
// Types
// =============================================================================

/**
 * Token measurement for a single tool
 */
export interface TokenMeasurement {
  /** Tool name */
  toolName: string;
  /** Estimated tokens in tool name */
  nameTokens: number;
  /** Estimated tokens in description */
  descriptionTokens: number;
  /** Estimated tokens in input schema JSON */
  schemaTokens: number;
  /** Total estimated tokens */
  totalTokens: number;
}

/**
 * Token measurement for an entire profile
 */
export interface ProfileMeasurement {
  /** Profile name */
  profile: string;
  /** Measurements for each tool */
  tools: TokenMeasurement[];
  /** Total estimated tokens for this profile */
  totalTokens: number;
  /** Number of tools in this profile */
  toolCount: number;
  /** Breakdown by component */
  breakdown: {
    namesTokens: number;
    descriptionsTokens: number;
    schemasTokens: number;
  };
}

/**
 * Complete measurement report
 */
export interface TokenReport {
  /** Timestamp of measurement */
  timestamp: string;
  /** Estimation method used */
  method: 'simple' | 'accurate';
  /** Chars per token ratio */
  charsPerToken: number;
  /** Measurements by profile */
  profiles: ProfileMeasurement[];
  /** Summary statistics */
  summary: {
    minimalTokens: number;
    fullTokens: number;
    reductionPercent: number;
  };
}

// =============================================================================
// Token Estimation Functions
// =============================================================================

/**
 * Estimate tokens in a text string using chars/3.5 heuristic
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Measure tokens for a single tool definition
 */
export function measureToolTokens(def: RegisteredToolDefinition): TokenMeasurement {
  const nameTokens = estimateTokens(def.name);
  const descriptionTokens = estimateTokens(def.description);
  const schemaStr = JSON.stringify(def.inputSchemaJson);
  const schemaTokens = estimateTokens(schemaStr);

  return {
    toolName: def.name,
    nameTokens,
    descriptionTokens,
    schemaTokens,
    totalTokens: nameTokens + descriptionTokens + schemaTokens,
  };
}

/**
 * Get tool names for a profile
 */
export function getProfileToolNames(profile: ProfileName): string[] {
  const config = PROFILE_TOOLS[profile];
  const toolNames = new Set<string>();

  // Always add gateway tools
  for (const tool of GATEWAY_TOOLS) {
    toolNames.add(tool);
  }

  // Add tools from toolpacks
  for (const packName of config.toolpacks) {
    const packTools = TOOLPACK_TOOLS[packName];
    if (packTools) {
      for (const tool of packTools) {
        toolNames.add(tool);
      }
    }
  }

  // Add additional individual tools
  for (const tool of config.additionalTools) {
    toolNames.add(tool);
  }

  return Array.from(toolNames);
}

/**
 * Measure tokens for a profile given all tool definitions
 */
export function measureProfile(
  profileName: ProfileName,
  allDefinitions: RegisteredToolDefinition[]
): ProfileMeasurement {
  const profileToolNames = new Set(getProfileToolNames(profileName));

  // Filter definitions to only include tools in this profile
  const profileDefs = allDefinitions.filter((d) => profileToolNames.has(d.name));

  const measurements = profileDefs.map(measureToolTokens);
  const totalTokens = measurements.reduce((sum, m) => sum + m.totalTokens, 0);

  const breakdown = {
    namesTokens: measurements.reduce((sum, m) => sum + m.nameTokens, 0),
    descriptionsTokens: measurements.reduce((sum, m) => sum + m.descriptionTokens, 0),
    schemasTokens: measurements.reduce((sum, m) => sum + m.schemaTokens, 0),
  };

  return {
    profile: profileName,
    tools: measurements,
    totalTokens,
    toolCount: measurements.length,
    breakdown,
  };
}

/**
 * Generate a complete token report for all profiles
 */
export function generateReport(allDefinitions: RegisteredToolDefinition[]): TokenReport {
  const profiles: ProfileMeasurement[] = [
    measureProfile('minimal', allDefinitions),
    measureProfile('mobile', allDefinitions),
    measureProfile('full', allDefinitions),
  ];

  const minimalTokens = profiles[0].totalTokens;
  const fullTokens = profiles[2].totalTokens;
  const reductionPercent = fullTokens > 0 ? Math.round((1 - minimalTokens / fullTokens) * 100) : 0;

  return {
    timestamp: new Date().toISOString(),
    method: 'simple',
    charsPerToken: CHARS_PER_TOKEN,
    profiles,
    summary: {
      minimalTokens,
      fullTokens,
      reductionPercent,
    },
  };
}

// =============================================================================
// Report Formatting
// =============================================================================

/**
 * Format report as Markdown
 */
export function formatMarkdownReport(report: TokenReport): string {
  let md = '# Token Measurement Report\n\n';
  md += `**Generated:** ${report.timestamp}\n`;
  md += `**Method:** ${report.method} estimation (${report.charsPerToken} chars/token)\n\n`;

  md += '## Summary\n\n';
  md += '| Profile | Tool Count | Estimated Tokens |\n';
  md += '|---------|------------|------------------|\n';
  for (const p of report.profiles) {
    md += `| ${p.profile} | ${p.toolCount} | ~${p.totalTokens.toLocaleString()} |\n`;
  }
  md += '\n';

  md += `**Token Reduction:** ${report.summary.reductionPercent}% `;
  md += `(minimal vs full: ${report.summary.minimalTokens} vs ${report.summary.fullTokens})\n\n`;

  // Detailed breakdown for each profile
  for (const p of report.profiles) {
    md += `## Profile: ${p.profile}\n\n`;
    md += `**Tools:** ${p.toolCount} | **Total Tokens:** ~${p.totalTokens.toLocaleString()}\n\n`;
    md += '**Breakdown:**\n';
    md += `- Names: ~${p.breakdown.namesTokens} tokens\n`;
    md += `- Descriptions: ~${p.breakdown.descriptionsTokens} tokens\n`;
    md += `- Schemas: ~${p.breakdown.schemasTokens} tokens\n\n`;

    md += '| Tool | Name | Description | Schema | Total |\n';
    md += '|------|------|-------------|--------|-------|\n';
    for (const t of p.tools.sort((a, b) => b.totalTokens - a.totalTokens)) {
      md += `| ${t.toolName} | ${t.nameTokens} | ${t.descriptionTokens} | ${t.schemaTokens} | ${t.totalTokens} |\n`;
    }
    md += '\n';
  }

  md += '---\n\n';
  md +=
    '*Note: Token counts are estimates using chars/3.5 heuristic. Actual tokenization varies by model.*\n';

  return md;
}

/**
 * Format report as JSON
 */
export function formatJsonReport(report: TokenReport): string {
  return JSON.stringify(report, null, 2);
}

// =============================================================================
// Mock Definitions for Standalone Execution
// =============================================================================

/**
 * Create mock tool definitions based on typical MCP tool structure
 * Used when running standalone without the full server
 */
function createMockDefinitions(): RegisteredToolDefinition[] {
  const definitions: RegisteredToolDefinition[] = [];

  // Gateway tools
  definitions.push({
    name: 'synthesis_discover_tools',
    description:
      'Discover available tools and toolpacks. Returns recommendations based on task description or full catalog.',
    inputSchemaJson: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'Describe what you want to accomplish' },
        list_all: { type: 'boolean', description: 'Return full catalog of all tools' },
      },
    },
  });

  definitions.push({
    name: 'enable_tools',
    description:
      'Enable tools by name, toolpack, or category. Emits notifications/tools/list_changed.',
    inputSchemaJson: {
      type: 'object',
      properties: {
        tools: { type: 'array', description: 'Specific tool names to enable' },
        toolpacks: { type: 'array', description: 'Toolpacks to enable' },
        categories: { type: 'array', description: 'Categories to enable' },
      },
    },
  });

  definitions.push({
    name: 'synthesis_router',
    description:
      'Execute any tool with auto-enable support. Use when native tool is not visible in tool list.',
    inputSchemaJson: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Tool name to execute' },
        params: { type: 'object', description: 'Tool parameters' },
      },
    },
  });

  definitions.push({
    name: 'synthesis_mcp_bridge',
    description:
      'Direct MCP call bypassing local state. Last resort when router is gated or client visibility is stale.',
    inputSchemaJson: {
      type: 'object',
      properties: {
        server: { type: 'string', description: 'MCP server name (synthesis)' },
        tool: { type: 'string', description: 'MCP tool name to call' },
        params: { type: 'object', description: 'Tool parameters' },
      },
    },
  });

  definitions.push({
    name: 'synthesis_search',
    description:
      'Always-on search fallback. Search the RAG knowledge base for relevant information.',
    inputSchemaJson: {
      type: 'object',
      properties: {
        collectionId: { type: 'string', description: 'Collection to search' },
        query: { type: 'string', description: 'Search query' },
        top_k: { type: 'number', description: 'Number of results' },
        min_similarity: { type: 'number', description: 'Minimum similarity threshold' },
      },
    },
  });

  // Core tools
  definitions.push({
    name: 'search_rag',
    description:
      'Search the RAG knowledge base for relevant information and return matching chunks with citations.',
    inputSchemaJson: {
      type: 'object',
      properties: {
        collectionId: { type: 'string', description: 'The ID of the collection to search' },
        query: { type: 'string', description: 'The search query' },
        top_k: { type: 'number', description: 'Number of results to return' },
        min_similarity: { type: 'number', description: 'Minimum similarity threshold' },
      },
    },
  });

  definitions.push({
    name: 'list_collections',
    description: 'List all available document collections.',
    inputSchemaJson: { type: 'object', properties: {} },
  });

  definitions.push({
    name: 'list_documents',
    description: 'Lists all documents in a specific collection.',
    inputSchemaJson: {
      type: 'object',
      properties: {
        collectionId: { type: 'string', description: 'The ID of the collection' },
      },
    },
  });

  definitions.push({
    name: 'create_collection',
    description: 'Create a new document collection.',
    inputSchemaJson: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the collection' },
        description: { type: 'string', description: 'Description of the collection' },
      },
    },
  });

  definitions.push({
    name: 'fetch_and_add_document_from_url',
    description: 'Fetch content from a URL and add it to a collection.',
    inputSchemaJson: {
      type: 'object',
      properties: {
        collectionId: { type: 'string', description: 'Collection ID' },
        url: { type: 'string', description: 'URL to fetch' },
        title: { type: 'string', description: 'Document title' },
      },
    },
  });

  definitions.push({
    name: 'delete_document',
    description: 'Delete a document from a collection.',
    inputSchemaJson: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'Document ID to delete' },
      },
    },
  });

  definitions.push({
    name: 'delete_collection',
    description: 'Delete an entire collection and all its documents.',
    inputSchemaJson: {
      type: 'object',
      properties: {
        collectionId: { type: 'string', description: 'Collection ID to delete' },
      },
    },
  });

  definitions.push({
    name: 'add_repo_to_collection',
    description: 'Add a git repository to a collection for indexing.',
    inputSchemaJson: {
      type: 'object',
      properties: {
        collectionId: { type: 'string', description: 'Collection ID' },
        repoUrl: { type: 'string', description: 'Git repository URL' },
        branch: { type: 'string', description: 'Branch to index' },
      },
    },
  });

  definitions.push({
    name: 'sync_repo',
    description: 'Sync a repository to update its indexed content.',
    inputSchemaJson: {
      type: 'object',
      properties: {
        repoId: { type: 'string', description: 'Repository ID to sync' },
      },
    },
  });

  definitions.push({
    name: 'list_repos',
    description: 'List all indexed repositories.',
    inputSchemaJson: {
      type: 'object',
      properties: {
        collectionId: { type: 'string', description: 'Optional collection filter' },
      },
    },
  });

  // Mobile core tools
  definitions.push({
    name: 'search_mobile_docs',
    description:
      'Search mobile development documentation with framework and feature filtering. Supports Flutter, React Native, Swift, Kotlin.',
    inputSchemaJson: {
      type: 'object',
      properties: {
        collectionId: { type: 'string', description: 'Collection to search' },
        query: { type: 'string', description: 'Search query' },
        framework: {
          type: 'string',
          description: 'Filter by framework (flutter, react_native, swift, kotlin)',
        },
        featureTags: { type: 'array', description: 'Filter by feature tags' },
        sourceQuality: { type: 'string', description: 'Filter by source quality' },
      },
    },
  });

  definitions.push({
    name: 'find_code_examples',
    description:
      'Find code examples and snippets for specific features. Returns working code samples with usage context.',
    inputSchemaJson: {
      type: 'object',
      properties: {
        collectionId: { type: 'string', description: 'Collection to search' },
        query: { type: 'string', description: 'What you want code for' },
        framework: { type: 'string', description: 'Target framework' },
        language: { type: 'string', description: 'Programming language' },
      },
    },
  });

  definitions.push({
    name: 'get_feature_recipe',
    description:
      'Get curated implementation guides for common mobile features. Returns step-by-step recipes with best practices.',
    inputSchemaJson: {
      type: 'object',
      properties: {
        collectionId: { type: 'string', description: 'Collection to search' },
        feature: { type: 'string', description: 'Feature to implement (auth, payments, etc.)' },
        framework: { type: 'string', description: 'Target framework' },
      },
    },
  });

  // Introspection tools
  definitions.push({
    name: 'get_project_tech_stack',
    description:
      'Get technology stack profile for a project collection. Returns detected frameworks, languages, and dependencies.',
    inputSchemaJson: {
      type: 'object',
      properties: {
        collectionId: { type: 'string', description: 'Collection ID' },
      },
    },
  });

  definitions.push({
    name: 'get_db_schema',
    description:
      'Extract database schema from codebase. Returns tables, columns, and relationships.',
    inputSchemaJson: {
      type: 'object',
      properties: {
        collectionId: { type: 'string', description: 'Collection ID' },
        tables: { type: 'string', description: 'Comma-separated table names to filter' },
        includeRelationships: { type: 'boolean', description: 'Include foreign key relationships' },
      },
    },
  });

  definitions.push({
    name: 'find_symbol_usages',
    description:
      'Find where a symbol is defined and used in the codebase. Returns definitions and usage locations.',
    inputSchemaJson: {
      type: 'object',
      properties: {
        collectionId: { type: 'string', description: 'Collection ID' },
        symbolName: { type: 'string', description: 'Symbol name to find' },
        symbolKind: { type: 'string', description: 'Type of symbol (function, class, etc.)' },
        includeDefinitions: { type: 'boolean', description: 'Include definition locations' },
        includeUsages: { type: 'boolean', description: 'Include usage locations' },
      },
    },
  });

  // Graphing tools
  definitions.push({
    name: 'graph_expand_context',
    description:
      'Expand context using knowledge graph traversal. Returns related nodes and edges for deeper understanding.',
    inputSchemaJson: {
      type: 'object',
      properties: {
        collectionId: { type: 'string', description: 'Collection ID' },
        query: { type: 'string', description: 'Starting query for expansion' },
        maxDepth: { type: 'number', description: 'Maximum traversal depth' },
        nodeTypes: { type: 'array', description: 'Filter by node types' },
      },
    },
  });

  return definitions;
}

// =============================================================================
// CLI Entry Point
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const outputJson = args.includes('--json');
  const profileArg = args.find((a) => a.startsWith('--profile='));
  const specificProfile = profileArg ? (profileArg.split('=')[1] as ProfileName) : null;

  // Use mock definitions (real definitions require server to be running)
  const definitions = createMockDefinitions();

  console.log('Token Measurement Utility (Sub-Phase 5.6.4)');
  console.log('===========================================\n');
  console.log(`Using mock tool definitions (${definitions.length} tools)`);
  console.log(`Estimation method: simple (${CHARS_PER_TOKEN} chars/token)\n`);

  if (specificProfile) {
    // Measure single profile
    const measurement = measureProfile(specificProfile, definitions);
    console.log(`Profile: ${specificProfile}`);
    console.log(`Tools: ${measurement.toolCount}`);
    console.log(`Estimated Tokens: ~${measurement.totalTokens.toLocaleString()}`);
    console.log('\nBreakdown:');
    console.log(`  Names: ~${measurement.breakdown.namesTokens} tokens`);
    console.log(`  Descriptions: ~${measurement.breakdown.descriptionsTokens} tokens`);
    console.log(`  Schemas: ~${measurement.breakdown.schemasTokens} tokens`);
  } else {
    // Full report
    const report = generateReport(definitions);

    if (outputJson) {
      console.log(formatJsonReport(report));
    } else {
      console.log(formatMarkdownReport(report));
    }
  }
}

// Run if executed directly
main().catch(console.error);
