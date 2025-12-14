/**
 * RAG Evaluation Sweep Configuration Types
 *
 * Type definitions for automated RAG evaluation sweeps.
 * Used by run-lifer-sweep.ts to systematically test different configurations.
 */

// =============================================================================
// Sweep Configuration Types
// =============================================================================

/**
 * Sweep pass identifier - groups configurations by optimization target
 */
export type SweepPass =
  | '1A-code-emb' // Embedding sweep for code (chunking fixed)
  | '1B-docs-emb' // Embedding sweep for docs (optional, if doc regression)
  | '2-chunk' // Chunking sweep (best embedding fixed)
  | '3-rerank' // Reranker sweep (best embedding+chunking fixed)
  | '4-search-tune' // Search strategy + parameter tuning
  | '5-graph'; // Graph expansion sweep (best from Pass 4)

/**
 * Embedding provider identifier
 */
export type EmbeddingProvider = 'voyage' | 'openai' | 'ollama' | 'cohere' | 'google';

/**
 * Reranker provider identifier
 */
export type RerankerProvider = 'voyage' | 'cohere' | 'bge' | 'none';

/**
 * Search mode identifier
 */
export type SearchMode = 'vector' | 'hybrid' | 'bm25';

/**
 * Graph expansion configuration
 */
export interface GraphConfig {
  /** Whether graph expansion is enabled */
  enabled: boolean;
  /** Maximum BFS traversal depth */
  maxDepth: number;
  /** Maximum nodes to visit during expansion */
  maxNodes: number;
}

/**
 * Complete sweep configuration for a single evaluation run
 */
export interface SweepConfig {
  /** Descriptive name (e.g., "lifer-voyage-code-3-ch600-oa100") */
  name: string;

  /** Which pass this belongs to */
  pass: SweepPass;

  /** Embedding configuration */
  embedding: {
    provider: EmbeddingProvider;
    model: string;
  };

  /** Chunking configuration */
  chunking: {
    size: number;
    overlap: number;
    codeAware: boolean;
  };

  /** Reranker configuration */
  reranker: {
    provider: RerankerProvider;
    model?: string;
  };

  /** Search configuration */
  search: {
    mode: SearchMode;
    topK: number;
    minSimilarity: number;
    efSearch: number;
    hybridWeights?: { vector: number; bm25: number };
    queryExpansion: boolean;
    mmrEnabled: boolean;
    mmrLambda?: number;
  };

  /** Graph expansion configuration (optional, used in Pass 5) */
  graph?: GraphConfig;
}

// =============================================================================
// Sweep State Types (for resume capability)
// =============================================================================

/**
 * Dataset evaluation result metrics
 */
export interface DatasetResult {
  datasetName: string;
  queryCount: number;
  original: {
    mrr: number;
    hitRate: number;
    zeroHits: number;
  };
  expanded: {
    mrr: number;
    hitRate: number;
    zeroHits: number;
  };
}

/**
 * Complete result for a single sweep configuration
 */
export interface SweepResult {
  config: SweepConfig;
  collectionId: string;
  collectionName: string;
  profileId: string;
  timestamp: string;
  datasets: {
    code: DatasetResult;
    docs?: DatasetResult;
  };
  ingestion: {
    docCount: number;
    chunkCount: number;
    durationMs: number;
  };
  latency: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  reportPath: string;
}

/**
 * Sweep state for resume capability
 */
export interface SweepState {
  /** When the sweep started */
  startedAt: string;

  /** Last updated timestamp */
  updatedAt: string;

  /** Configuration names that completed successfully */
  completedConfigs: string[];

  /** Configurations that failed with error messages */
  failedConfigs: Array<{ name: string; error: string; timestamp: string }>;

  /** Results from completed configurations */
  results: SweepResult[];

  /** Best configs by pass (updated as sweep progresses) */
  bestByPass: Partial<
    Record<
      SweepPass,
      {
        configName: string;
        collectionId: string;
        metrics: { mrr: number; hitRate: number; zeroHits: number };
      }
    >
  >;
}

// =============================================================================
// Configuration Presets
// =============================================================================

/**
 * Model dimension map for reference
 */
export const MODEL_DIMENSIONS: Record<string, number> = {
  // Voyage
  'voyage-code-3': 1024,
  'voyage-3-large': 1024,
  'voyage-3.5': 1024,
  'voyage-code-2': 1536,
  // OpenAI
  'text-embedding-3-large': 1536,
  'text-embedding-3-small': 1536,
  // Ollama
  'nomic-embed-text': 768,
  'nomic-embed-text:latest': 768,
  'mxbai-embed-large': 1024,
  // Cohere
  'embed-v4.0': 1536,
  // Google
  'text-embedding-004': 768,
};

/**
 * Get dimensions for an embedding model
 */
export function getModelDimensions(provider: string, model: string): number {
  return MODEL_DIMENSIONS[model] ?? (provider === 'ollama' ? 768 : 1536);
}

/**
 * Cost tier for embedding models
 */
export type CostTier = 'free' | 'low' | 'medium' | 'high';

/**
 * Get cost tier for a provider
 */
export function getCostTier(provider: EmbeddingProvider): CostTier {
  const tiers: Record<EmbeddingProvider, CostTier> = {
    ollama: 'free',
    openai: 'medium',
    voyage: 'medium',
    cohere: 'medium',
    google: 'low',
  };
  return tiers[provider];
}

// =============================================================================
// Pass 1A: Embedding Sweep Configurations (chunking fixed)
// =============================================================================

/**
 * Fixed chunking settings for Pass 1A (code-optimized)
 */
export const PASS_1A_CHUNKING = {
  size: 600,
  overlap: 100,
  codeAware: true,
};

/**
 * Fixed search settings for all sweep passes
 */
export const FIXED_SEARCH_SETTINGS = {
  mode: 'vector' as SearchMode,
  topK: 20,
  minSimilarity: 0.35,
  efSearch: 100,
  queryExpansion: false,
  mmrEnabled: false,
};

/**
 * Generate Pass 1A configurations (embedding sweep)
 */
export function generatePass1AConfigs(): SweepConfig[] {
  const embeddings: Array<{ provider: EmbeddingProvider; model: string }> = [
    { provider: 'voyage', model: 'voyage-code-3' },
    { provider: 'openai', model: 'text-embedding-3-large' },
    { provider: 'ollama', model: 'nomic-embed-text' },
  ];

  return embeddings.map(({ provider, model }) => {
    const modelShort = model.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    return {
      name: `lifer-${provider}-${modelShort}-ch${PASS_1A_CHUNKING.size}-oa${PASS_1A_CHUNKING.overlap}`,
      pass: '1A-code-emb',
      embedding: { provider, model },
      chunking: PASS_1A_CHUNKING,
      reranker: { provider: 'none' },
      search: FIXED_SEARCH_SETTINGS,
    };
  });
}

// =============================================================================
// Pass 1B: Docs Embedding Configurations (optional)
// =============================================================================

/**
 * Fixed chunking settings for Pass 1B (docs-optimized)
 */
export const PASS_1B_CHUNKING = {
  size: 1000,
  overlap: 150,
  codeAware: false,
};

/**
 * Generate Pass 1B configurations (docs embedding sweep)
 */
export function generatePass1BConfigs(): SweepConfig[] {
  const embeddings: Array<{ provider: EmbeddingProvider; model: string }> = [
    { provider: 'ollama', model: 'nomic-embed-text' },
    { provider: 'voyage', model: 'voyage-3-large' },
  ];

  return embeddings.map(({ provider, model }) => {
    const modelShort = model.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    return {
      name: `lifer-${provider}-${modelShort}-ch${PASS_1B_CHUNKING.size}-oa${PASS_1B_CHUNKING.overlap}`,
      pass: '1B-docs-emb',
      embedding: { provider, model },
      chunking: PASS_1B_CHUNKING,
      reranker: { provider: 'none' },
      search: FIXED_SEARCH_SETTINGS,
    };
  });
}

// =============================================================================
// Pass 2: Chunking Sweep Configurations
// =============================================================================

/**
 * Chunking configurations to test
 */
export const CHUNKING_VARIANTS = [
  { size: 400, overlap: 50, codeAware: true },
  { size: 600, overlap: 100, codeAware: true }, // baseline
  { size: 800, overlap: 100, codeAware: true },
];

/**
 * Generate Pass 2 configurations (chunking sweep)
 * Uses best embedding from Pass 1
 */
export function generatePass2Configs(bestEmbedding: {
  provider: EmbeddingProvider;
  model: string;
}): SweepConfig[] {
  return CHUNKING_VARIANTS.map(({ size, overlap, codeAware }) => {
    const modelShort = bestEmbedding.model.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    return {
      name: `lifer-${bestEmbedding.provider}-${modelShort}-ch${size}-oa${overlap}`,
      pass: '2-chunk',
      embedding: bestEmbedding,
      chunking: { size, overlap, codeAware },
      reranker: { provider: 'none' },
      search: FIXED_SEARCH_SETTINGS,
    };
  });
}

// =============================================================================
// Pass 3: Reranker Sweep Configurations
// =============================================================================

/**
 * Reranker configurations to test
 */
export const RERANKER_VARIANTS: Array<{ provider: RerankerProvider; model?: string }> = [
  { provider: 'none' },
  { provider: 'bge', model: 'BAAI/bge-reranker-base' },
  { provider: 'voyage', model: 'rerank-2.5' },
];

/**
 * Generate Pass 3 configurations (reranker sweep)
 * Uses best embedding and chunking from Pass 1+2
 */
export function generatePass3Configs(
  bestEmbedding: { provider: EmbeddingProvider; model: string },
  bestChunking: { size: number; overlap: number; codeAware: boolean }
): SweepConfig[] {
  return RERANKER_VARIANTS.map(({ provider, model }) => {
    const modelShort = bestEmbedding.model.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const rerankerSuffix = provider === 'none' ? 'no-rerank' : `${provider}-rerank`;
    return {
      name: `lifer-${modelShort}-ch${bestChunking.size}-${rerankerSuffix}`,
      pass: '3-rerank',
      embedding: bestEmbedding,
      chunking: bestChunking,
      reranker: { provider, model },
      search: {
        ...FIXED_SEARCH_SETTINGS,
        // For reranker testing, we still use vector mode but with rerank flag
      },
    };
  });
}

// =============================================================================
// Pass 4: Search Tuning Configurations
// =============================================================================

/**
 * Search mode variants to test
 */
export const SEARCH_MODE_VARIANTS: SearchMode[] = ['vector', 'hybrid', 'bm25'];

/**
 * MIN_SIMILARITY variants to test
 */
export const MIN_SIMILARITY_VARIANTS = [0.25, 0.35, 0.45];

/**
 * HNSW ef_search variants to test
 */
export const EF_SEARCH_VARIANTS = [40, 100, 200];

/**
 * Generate Pass 4 configurations (search tuning)
 * Uses best embedding, chunking, and reranker from Pass 1+2+3
 */
export function generatePass4Configs(
  bestEmbedding: { provider: EmbeddingProvider; model: string },
  bestChunking: { size: number; overlap: number; codeAware: boolean },
  bestReranker: { provider: RerankerProvider; model?: string }
): SweepConfig[] {
  const configs: SweepConfig[] = [];
  const modelShort = bestEmbedding.model.replace(/[^a-z0-9-]/gi, '-').toLowerCase();

  // Search mode sweep
  for (const mode of SEARCH_MODE_VARIANTS) {
    configs.push({
      name: `lifer-${modelShort}-${mode}`,
      pass: '4-search-tune',
      embedding: bestEmbedding,
      chunking: bestChunking,
      reranker: bestReranker,
      search: {
        ...FIXED_SEARCH_SETTINGS,
        mode,
      },
    });
  }

  // MIN_SIMILARITY sweep (vector mode only)
  for (const minSim of MIN_SIMILARITY_VARIANTS) {
    if (minSim === 0.35) continue; // Skip baseline
    configs.push({
      name: `lifer-${modelShort}-minsim-${minSim}`,
      pass: '4-search-tune',
      embedding: bestEmbedding,
      chunking: bestChunking,
      reranker: bestReranker,
      search: {
        ...FIXED_SEARCH_SETTINGS,
        minSimilarity: minSim,
      },
    });
  }

  // ef_search sweep
  for (const ef of EF_SEARCH_VARIANTS) {
    if (ef === 100) continue; // Skip baseline
    configs.push({
      name: `lifer-${modelShort}-ef-${ef}`,
      pass: '4-search-tune',
      embedding: bestEmbedding,
      chunking: bestChunking,
      reranker: bestReranker,
      search: {
        ...FIXED_SEARCH_SETTINGS,
        efSearch: ef,
      },
    });
  }

  // Query expansion toggle
  configs.push({
    name: `lifer-${modelShort}-query-expand`,
    pass: '4-search-tune',
    embedding: bestEmbedding,
    chunking: bestChunking,
    reranker: bestReranker,
    search: {
      ...FIXED_SEARCH_SETTINGS,
      queryExpansion: true,
    },
  });

  // MMR toggle
  configs.push({
    name: `lifer-${modelShort}-mmr`,
    pass: '4-search-tune',
    embedding: bestEmbedding,
    chunking: bestChunking,
    reranker: bestReranker,
    search: {
      ...FIXED_SEARCH_SETTINGS,
      mmrEnabled: true,
      mmrLambda: 0.5,
    },
  });

  return configs;
}

// =============================================================================
// Pass 5: Graph Expansion Sweep Configurations
// =============================================================================

/**
 * Graph expansion configurations to test
 * Tests different traversal depths and node limits
 */
export const GRAPH_VARIANTS: GraphConfig[] = [
  { enabled: false, maxDepth: 0, maxNodes: 0 }, // Baseline (no graph)
  { enabled: true, maxDepth: 2, maxNodes: 25 }, // Shallow, fast
  { enabled: true, maxDepth: 3, maxNodes: 50 }, // Balanced (recommended)
  { enabled: true, maxDepth: 3, maxNodes: 100 }, // More context, same depth
  { enabled: true, maxDepth: 4, maxNodes: 100 }, // Deep traversal
];

/**
 * Generate Pass 5 configurations (graph expansion sweep)
 * Uses best embedding, chunking, reranker, and search from Pass 1-4
 */
export function generatePass5Configs(
  bestEmbedding: { provider: EmbeddingProvider; model: string },
  bestChunking: { size: number; overlap: number; codeAware: boolean },
  bestReranker: { provider: RerankerProvider; model?: string },
  bestSearch: {
    mode: SearchMode;
    topK: number;
    minSimilarity: number;
    efSearch: number;
    queryExpansion: boolean;
    mmrEnabled: boolean;
    mmrLambda?: number;
  }
): SweepConfig[] {
  const configs: SweepConfig[] = [];
  const modelShort = bestEmbedding.model.replace(/[^a-z0-9-]/gi, '-').toLowerCase();

  for (const graphConfig of GRAPH_VARIANTS) {
    const suffix = graphConfig.enabled
      ? `graph-d${graphConfig.maxDepth}-n${graphConfig.maxNodes}`
      : 'no-graph';

    configs.push({
      name: `lifer-${modelShort}-${suffix}`,
      pass: '5-graph',
      embedding: bestEmbedding,
      chunking: bestChunking,
      reranker: bestReranker,
      search: bestSearch,
      graph: graphConfig,
    });
  }

  return configs;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate profile name from config
 */
export function getProfileName(config: SweepConfig): string {
  const modelShort = config.embedding.model
    .replace(/[^a-z0-9-]/gi, '-')
    .toLowerCase()
    .slice(0, 20);
  return `sweep-${config.embedding.provider}-${modelShort}-ch${config.chunking.size}`;
}

/**
 * Generate collection name from config
 */
export function getCollectionName(config: SweepConfig): string {
  return config.name;
}

/**
 * Check if API key is available for a provider
 */
export function hasApiKey(provider: EmbeddingProvider | RerankerProvider): boolean {
  if (provider === 'ollama' || provider === 'bge' || provider === 'none') {
    return true; // Local providers don't need keys
  }

  const keyMap: Record<string, string | undefined> = {
    voyage: process.env.VOYAGE_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    cohere: process.env.COHERE_API_KEY,
    google: process.env.GOOGLE_API_KEY,
  };

  return !!keyMap[provider];
}

/**
 * Validate that required API keys are available for a config
 */
export function validateApiKeys(config: SweepConfig): string[] {
  const errors: string[] = [];

  if (!hasApiKey(config.embedding.provider)) {
    errors.push(
      `Missing ${config.embedding.provider.toUpperCase()}_API_KEY for embedding provider`
    );
  }

  if (config.reranker.provider !== 'none' && !hasApiKey(config.reranker.provider)) {
    errors.push(`Missing ${config.reranker.provider.toUpperCase()}_API_KEY for reranker provider`);
  }

  return errors;
}

/**
 * Format metrics for display
 */
export function formatMetrics(result: SweepResult): string {
  const { datasets, latency } = result;
  const code = datasets.code;

  return [
    `MRR (orig):     ${code.original.mrr.toFixed(3)}`,
    `MRR (expanded): ${code.expanded.mrr.toFixed(3)}`,
    `Hit Rate:       ${code.expanded.hitRate.toFixed(3)}`,
    `Zero Hits:      ${code.expanded.zeroHits}/${code.queryCount}`,
    `Latency:        ${latency.avg.toFixed(0)}ms avg, ${latency.p95.toFixed(0)}ms p95`,
  ].join('\n  ');
}
