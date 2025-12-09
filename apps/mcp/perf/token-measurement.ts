#!/usr/bin/env npx tsx
/**
 * Token Measurement Utility for MCP Tool Profiles (Sub-Phase 5.6.4)
 *
 * Measures the estimated token footprint of tool definitions.
 *
 * IMPORTANT: This utility provides ESTIMATES. For accurate measurements,
 * use Claude Code's `/context` command which shows actual token counts.
 *
 * Real measurements from Claude Code (2025-12-02):
 * - minimal profile (6 tools): ~4,000 tokens (2% of 200k context)
 * - mobile profile (11 tools): ~8,500 tokens (projected)
 * - full profile (22 tools): ~15,000 tokens (7.5% of 200k context)
 *
 * The mock measurements in this utility are ~8x lower than reality because
 * real Zod schemas expand to verbose JSON Schema with constraints.
 *
 * Usage:
 *   npx tsx apps/mcp/perf/token-measurement.ts          # Mock (deprecated)
 *   npx tsx apps/mcp/perf/token-measurement.ts --real   # Real Zod schemas
 *   npx tsx apps/mcp/perf/token-measurement.ts --json   # JSON output
 *   npx tsx apps/mcp/perf/token-measurement.ts --profile minimal
 *
 * @module apps/mcp/perf/token-measurement
 * @since GPT Phase 3: Sub-Phase 5.6.4
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
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
// Real Zod Schema Definitions (for accurate measurement)
// =============================================================================

/**
 * Actual Zod schemas matching those in index.ts and gateway-schemas.ts
 * These produce accurate JSON Schema output for token measurement
 */
const REAL_SCHEMAS = {
  // Gateway tools
  synthesis_discover_tools: z
    .object({
      task: z
        .string()
        .optional()
        .describe('Describe what you want to accomplish - returns recommended tools/toolpacks'),
      list_all: z
        .boolean()
        .optional()
        .default(false)
        .describe('Return full catalog of all tools and toolpacks'),
    })
    .strict(),

  enable_tools: z
    .object({
      tools: z.array(z.string()).optional().describe('Specific tool names to enable'),
      toolpacks: z
        .array(z.enum(['core', 'mobile_core', 'introspection', 'graphing']))
        .optional()
        .describe('Toolpacks to enable'),
      categories: z
        .array(z.enum(['core', 'mobile', 'graph', 'introspection']))
        .optional()
        .describe('Categories to enable'),
    })
    .strict(),

  synthesis_router: z
    .object({
      action: z.string().min(1).describe('Tool name to execute'),
      params: z.record(z.unknown()).describe('Tool parameters (validated server-side via Zod)'),
    })
    .strict(),

  synthesis_mcp_bridge: z
    .object({
      server: z.literal('synthesis').describe('MCP server name (must be "synthesis")'),
      tool: z.string().min(1).describe('MCP tool name to call'),
      params: z.record(z.unknown()).describe('Tool parameters'),
    })
    .strict(),

  synthesis_search: z
    .object({
      collectionId: z.string().uuid().describe('Collection to search'),
      query: z.string().min(1).describe('Search query'),
      top_k: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(5)
        .describe('Number of results to return (default: 5)'),
      min_similarity: z
        .number()
        .min(0)
        .max(1)
        .default(0.5)
        .describe('Minimum similarity threshold (default: 0.5)'),
    })
    .strict(),

  // Core tools
  search_rag: z
    .object({
      collectionId: z.string().uuid().describe('The ID of the collection to search'),
      query: z.string().min(1).describe('The search query'),
      top_k: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(5)
        .describe('Number of results to return (default: 5)'),
      min_similarity: z
        .number()
        .min(0)
        .max(1)
        .default(0.5)
        .describe('Minimum similarity threshold (default: 0.5)'),
    })
    .strict(),

  list_collections: z.object({}).strict(),

  list_documents: z
    .object({
      collectionId: z.string().uuid().describe('The ID of the collection'),
    })
    .strict(),

  create_collection: z
    .object({
      name: z.string().min(1).max(255).describe('Name of the collection'),
      description: z.string().optional().describe('Description of the collection'),
    })
    .strict(),

  fetch_and_add_document_from_url: z
    .object({
      collectionId: z.string().uuid().describe('Collection ID'),
      url: z.string().url().describe('URL to fetch'),
      mode: z.enum(['single', 'crawl']).default('single').describe('Fetch mode'),
    })
    .strict(),

  delete_document: z
    .object({
      docId: z.string().uuid().describe('Document ID to delete'),
      confirm: z.boolean().describe('Confirmation flag'),
    })
    .strict(),

  delete_collection: z
    .object({
      collectionId: z.string().uuid().describe('Collection ID to delete'),
    })
    .strict(),

  add_repo_to_collection: z
    .object({
      collection_id: z.string().uuid().describe('Collection ID'),
      repo_url: z.string().url().describe('Git repository URL'),
      default_branch: z.string().default('main').describe('Branch to index'),
      ignored_paths: z.array(z.string()).optional().describe('Paths to ignore'),
    })
    .strict(),

  sync_repo: z
    .object({
      repoSourceId: z.string().uuid().describe('Repository source ID to sync'),
    })
    .strict(),

  list_repos: z
    .object({
      collection_id: z.string().uuid().optional().describe('Optional collection filter'),
    })
    .strict(),

  // Mobile core tools
  search_mobile_docs: z
    .object({
      collectionId: z.string().uuid().describe('The ID of the collection to search'),
      query: z.string().min(1).describe('Search query for mobile documentation'),
      featureTags: z.array(z.string()).optional(),
      platform: z.enum(['mobile', 'web', 'backend', 'shared']).optional(),
      framework: z.string().optional(),
      top_k: z.number().int().min(1).max(50).default(10),
    })
    .strict(),

  find_code_examples: z
    .object({
      collectionId: z.string().uuid().describe('The ID of the collection to search'),
      query: z.string().min(1).describe('Search query for code examples'),
      framework: z.string().optional(),
      featureTags: z.array(z.string()).optional(),
      top_k: z.number().int().min(1).max(20).default(5),
    })
    .strict(),

  get_feature_recipe: z
    .object({
      collectionId: z.string().uuid().describe('The ID of the collection to search'),
      featureTags: z.array(z.string()).min(1).describe('Feature tags to search for'),
      framework: z.string().optional(),
    })
    .strict(),

  // Introspection tools
  get_project_tech_stack: z
    .object({
      collectionId: z.string().uuid().describe('The ID of the collection'),
    })
    .strict(),

  get_db_schema: z
    .object({
      collectionId: z.string().uuid().describe('The ID of the collection'),
      tables: z.array(z.string()).optional(),
      includeRelationships: z.boolean().default(true),
    })
    .strict(),

  find_symbol_usages: z
    .object({
      collectionId: z.string().uuid().describe('The ID of the collection'),
      symbolName: z.string().min(1).describe('Name of the symbol to find'),
      symbolKind: z.enum(['function', 'class', 'widget', 'method', 'constant']).optional(),
      includeDefinitions: z.boolean().default(true),
      includeUsages: z.boolean().default(true),
      maxResults: z.number().int().min(1).max(100).default(20),
    })
    .strict(),

  // Graph tools
  graph_expand_context: z
    .object({
      collectionId: z.string().uuid().describe('The ID of the collection'),
      seedChunkIds: z.array(z.number().int()).optional(),
      seedNodeIds: z.array(z.string()).optional(),
      query: z.string().optional(),
      maxDepth: z.number().int().min(1).max(5).default(2),
      maxNodes: z.number().int().min(1).max(100).default(20),
      edgeTypes: z.array(z.string()).optional(),
      nodeTypes: z.array(z.string()).optional(),
    })
    .strict(),
};

/**
 * Tool descriptions matching index.ts
 */
const TOOL_DESCRIPTIONS: Record<string, string> = {
  synthesis_discover_tools:
    'Discover available tools and toolpacks. Returns recommendations based on task or full catalog with list_all=true.',
  enable_tools:
    'Enable tools by name, toolpack, or category. Emits notifications/tools/list_changed when tools are enabled.',
  synthesis_router:
    'Execute any tool with auto-enable support. Use when native tool is not visible. Validates params server-side.',
  synthesis_mcp_bridge:
    'Direct MCP call bypassing local state. Last resort when router and native tools fail.',
  synthesis_search:
    'Always-on search fallback. Search the RAG knowledge base for relevant information.',
  search_rag:
    'Search the RAG knowledge base for relevant information and return matching chunks with citations.',
  list_collections: 'List all available document collections.',
  list_documents: 'List all documents in a specific collection.',
  create_collection: 'Create a new document collection.',
  fetch_and_add_document_from_url:
    'Fetch content from a public URL and ingest it as a new document.',
  delete_document: 'Delete a document and all associated chunks.',
  delete_collection: 'Delete an entire collection and all its documents. Use with caution.',
  add_repo_to_collection: 'Add a GitHub/Git repository to a collection for code ingestion.',
  sync_repo: 'Trigger a sync for a repository to pull and ingest latest changes.',
  list_repos: 'List all repository sources for a collection.',
  search_mobile_docs:
    'Search mobile documentation with feature-aware filtering. Returns docs filtered by platform, feature tags, and framework.',
  find_code_examples:
    'Find code examples and sample implementations. Returns results biased toward example code, demos, and sample projects.',
  get_feature_recipe:
    'Get curated recipe documentation for mobile features. Returns opinionated guides and patterns for implementing specific features.',
  get_project_tech_stack:
    'Get the technology stack profile for a project collection. Returns detected frameworks, languages, databases, and libraries.',
  get_db_schema:
    'Extract database schema from the codebase. Returns tables, columns, data types, and relationships found in SQL migrations or ORM code.',
  find_symbol_usages:
    'Search for symbol definitions and usages across the codebase. Returns where a function, class, or method is defined and where it is called or imported.',
  graph_expand_context:
    'Expand context from seed nodes using BFS traversal of the knowledge graph. Returns connected nodes, edges, and associated chunks for end-to-end context retrieval.',
};

/**
 * Create REAL tool definitions using zod-to-json-schema
 * This produces accurate JSON Schema output matching what Claude sees
 */
function createRealDefinitions(): RegisteredToolDefinition[] {
  const definitions: RegisteredToolDefinition[] = [];

  for (const [name, schema] of Object.entries(REAL_SCHEMAS)) {
    const jsonSchema = zodToJsonSchema(schema, { target: 'openApi3' });
    definitions.push({
      name,
      description: TOOL_DESCRIPTIONS[name] || `Tool: ${name}`,
      inputSchemaJson: jsonSchema as Record<string, unknown>,
    });
  }

  return definitions;
}

// =============================================================================
// Mock Definitions (DEPRECATED - use --real flag)
// =============================================================================

/**
 * Create mock tool definitions
 * @deprecated Use createRealDefinitions() with --real flag
 * Note: Mock schemas use simplified property names and may not match actual implementations.
 */
function createMockDefinitions(): RegisteredToolDefinition[] {
  const definitions: RegisteredToolDefinition[] = [];

  // Gateway tools
  definitions.push({
    name: 'synthesis_discover_tools',
    description:
      'Discover available tools and toolpacks. Returns recommendations based on task or full catalog.',
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
    description: 'Fetch content from a URL and ingest it as a new document.',
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
        docId: { type: 'string', description: 'Document ID to delete' },
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
        repo_url: { type: 'string', description: 'Git repository URL' },
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
        repoSourceId: { type: 'string', description: 'Repository ID to sync' },
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
      'Extract database schema from the codebase. Returns tables, columns, data types, and relationships found in SQL migrations or ORM code.',
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
  const useReal = args.includes('--real');
  const profileArg = args.find((a) => a.startsWith('--profile='));
  const specificProfile = profileArg ? (profileArg.split('=')[1] as ProfileName) : null;

  // Use real definitions with --real flag, otherwise mock
  const definitions = useReal ? createRealDefinitions() : createMockDefinitions();

  console.info('Token Measurement Utility (Sub-Phase 5.6.4)');
  console.info('===========================================\n');

  if (useReal) {
    console.info(`Using REAL Zod schemas with zod-to-json-schema (${definitions.length} tools)`);
    console.info("\n⚠️  Note: For ground-truth measurements, use Claude Code's /context command\n");
  } else {
    console.info(`Using MOCK tool definitions (${definitions.length} tools)`);
    console.info('\n⚠️  WARNING: Mock measurements are ~8x lower than reality!');
    console.info('   Run with --real flag for accurate estimates\n');
  }
  console.info(`Estimation method: simple (${CHARS_PER_TOKEN} chars/token)\n`);

  if (specificProfile) {
    // Measure single profile
    const measurement = measureProfile(specificProfile, definitions);
    console.info(`Profile: ${specificProfile}`);
    console.info(`Tools: ${measurement.toolCount}`);
    console.info(`Estimated Tokens: ~${measurement.totalTokens.toLocaleString()}`);
    console.info('\nBreakdown:');
    console.info(`  Names: ~${measurement.breakdown.namesTokens} tokens`);
    console.info(`  Descriptions: ~${measurement.breakdown.descriptionsTokens} tokens`);
    console.info(`  Schemas: ~${measurement.breakdown.schemasTokens} tokens`);
  } else {
    // Full report
    const report = generateReport(definitions);

    if (outputJson) {
      console.info(formatJsonReport(report));
    } else {
      console.info(formatMarkdownReport(report));
    }
  }
}

// Run if executed directly
main().catch(console.error);
