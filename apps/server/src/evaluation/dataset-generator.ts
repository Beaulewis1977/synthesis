/**
 * Synthetic Dataset Generator
 *
 * Uses Claude to generate realistic evaluation queries from existing documents.
 * This enables creating ground-truth evaluation datasets without manual labeling.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Pool } from 'pg';
import type {
  EvalCategory,
  EvalDataset,
  EvalDifficulty,
  EvalQuery,
  EvalQueryType,
} from './types.js';

// =============================================================================
// Types
// =============================================================================

export interface DatasetGeneratorOptions {
  /** Database pool */
  db: Pool;

  /** Anthropic client (optional, will create if not provided) */
  anthropic?: Anthropic;

  /** Collection IDs to sample from */
  collectionIds?: string[];

  /** Number of queries to generate per category */
  queriesPerCategory: number;

  /** Categories to generate queries for */
  categories: EvalCategory[];

  /** Progress callback */
  onProgress?: (message: string) => void;
}

interface ChunkSample {
  chunkId: string;
  docId: string;
  docTitle: string;
  text: string;
  filePath: string | null;
  collectionId: string;
  metadata: Record<string, unknown>;
}

interface GeneratedQuery {
  query: string;
  difficulty: EvalDifficulty;
  queryType: EvalQueryType;
  requiredKeywords?: string[];
}

// =============================================================================
// Main Generator
// =============================================================================

/**
 * Generate a synthetic evaluation dataset from existing documents
 */
export async function generateDataset(options: DatasetGeneratorOptions): Promise<EvalDataset> {
  const { db, queriesPerCategory, categories, onProgress } = options;

  const anthropic = options.anthropic ?? new Anthropic();

  const allQueries: EvalQuery[] = [];
  let queryIdCounter = 1;

  for (const category of categories) {
    onProgress?.(`Generating ${queriesPerCategory} queries for category: ${category}`);

    // Sample chunks appropriate for this category
    const chunks = await sampleChunksForCategory(
      db,
      category,
      queriesPerCategory * 2,
      options.collectionIds
    );

    if (chunks.length === 0) {
      onProgress?.(`Warning: No chunks found for category ${category}`);
      continue;
    }

    // Generate queries from sampled chunks
    for (let i = 0; i < Math.min(queriesPerCategory, chunks.length); i++) {
      const chunk = chunks[i];

      try {
        const generated = await generateQueriesFromChunk(anthropic, chunk, category);

        for (const gen of generated) {
          allQueries.push({
            id: `${category}-${queryIdCounter++}`,
            query: gen.query,
            category,
            difficulty: gen.difficulty,
            queryType: gen.queryType,
            relevantDocIds: [chunk.docId],
            relevantChunkIds: [chunk.chunkId],
            requiredKeywords: gen.requiredKeywords,
            collectionId: chunk.collectionId,
            metadata: {
              source: 'synthetic',
              createdAt: new Date().toISOString(),
              sourceChunkId: chunk.chunkId,
              sourceDocTitle: chunk.docTitle,
            },
          });
        }
      } catch (error) {
        onProgress?.(`Error generating query for chunk ${chunk.chunkId}: ${error}`);
      }

      // Progress update
      if ((i + 1) % 5 === 0) {
        onProgress?.(`  Generated ${i + 1}/${queriesPerCategory} for ${category}`);
      }
    }
  }

  return {
    metadata: {
      name: 'synthetic-eval-dataset',
      description: `Synthetically generated evaluation dataset with ${allQueries.length} queries`,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      source: 'synthetic',
    },
    queries: allQueries,
  };
}

// =============================================================================
// Chunk Sampling
// =============================================================================

/**
 * Sample chunks appropriate for a given category
 */
async function sampleChunksForCategory(
  db: Pool,
  category: EvalCategory,
  limit: number,
  collectionIds?: string[]
): Promise<ChunkSample[]> {
  // Build category-specific filters
  let categoryFilter = '';
  const params: (string | number | string[])[] = [limit];

  switch (category) {
    case 'code':
      // Look for code-related content
      categoryFilter = `
        AND (
          d.file_path LIKE '%.ts' OR d.file_path LIKE '%.js' OR
          d.file_path LIKE '%.py' OR d.file_path LIKE '%.go' OR
          d.file_path LIKE '%.rs' OR d.file_path LIKE '%.java' OR
          c.text LIKE '%function%' OR c.text LIKE '%class%' OR
          c.text LIKE '%import%' OR c.text LIKE '%export%'
        )
      `;
      break;
    case 'mobile':
      // Look for mobile/Flutter/React Native content
      categoryFilter = `
        AND (
          d.file_path LIKE '%flutter%' OR d.file_path LIKE '%dart%' OR
          d.file_path LIKE '%react-native%' OR d.file_path LIKE '%ios%' OR
          d.file_path LIKE '%android%' OR
          c.text ILIKE '%flutter%' OR c.text ILIKE '%widget%' OR
          c.text ILIKE '%react native%' OR c.text ILIKE '%mobile%'
        )
      `;
      break;
    case 'docs':
      // General documentation
      categoryFilter = `
        AND (
          d.file_path LIKE '%.md' OR d.file_path LIKE '%.mdx' OR
          d.file_path LIKE '%doc%' OR d.file_path LIKE '%readme%'
        )
      `;
      break;
    case 'general':
      // No specific filter
      break;
  }

  // Add collection filter if specified
  let collectionFilter = '';
  if (collectionIds && collectionIds.length > 0) {
    params.push(collectionIds);
    collectionFilter = `AND d.collection_id = ANY($${params.length})`;
  }

  const sql = `
    SELECT
      c.id AS "chunkId",
      c.doc_id AS "docId",
      d.title AS "docTitle",
      c.text,
      d.file_path AS "filePath",
      d.collection_id AS "collectionId",
      d.metadata
    FROM chunks c
    JOIN documents d ON d.id = c.doc_id
    WHERE d.status = 'complete'
      AND LENGTH(c.text) > 200
      AND LENGTH(c.text) < 2000
      ${categoryFilter}
      ${collectionFilter}
    ORDER BY RANDOM()
    LIMIT $1
  `;

  const result = await db.query<ChunkSample>(sql, params);
  return result.rows;
}

// =============================================================================
// Query Generation via LLM
// =============================================================================

/**
 * Generate evaluation queries from a chunk using Claude
 */
async function generateQueriesFromChunk(
  anthropic: Anthropic,
  chunk: ChunkSample,
  category: EvalCategory
): Promise<GeneratedQuery[]> {
  const categoryContext = getCategoryContext(category);

  const prompt = `You are generating realistic search queries for a RAG evaluation benchmark.

Given this documentation chunk from a ${categoryContext} context:

---
Title: ${chunk.docTitle}
File: ${chunk.filePath ?? 'N/A'}
Content:
${chunk.text.slice(0, 1500)}
---

Generate 2 realistic search queries that a developer would use to find this information.

Requirements:
1. Queries should be natural language questions or search phrases
2. Each query should be uniquely answerable by this chunk
3. Include a mix of difficulties:
   - easy: Direct lookup, single concept
   - medium: Requires understanding context, multiple concepts
   - hard: Complex reasoning, comparison, troubleshooting

Output format (JSON array):
[
  {
    "query": "the search query text",
    "difficulty": "easy" | "medium" | "hard",
    "queryType": "factual" | "conceptual" | "how-to" | "comparison" | "troubleshooting",
    "requiredKeywords": ["key", "terms", "that", "must", "appear"]
  }
]

Only output the JSON array, no other text.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  // Parse response
  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  try {
    // Extract JSON from response (handle potential markdown code blocks)
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonText) as GeneratedQuery[];
    return parsed;
  } catch {
    throw new Error(`Failed to parse generated queries: ${content.text}`);
  }
}

/**
 * Get context description for a category
 */
function getCategoryContext(category: EvalCategory): string {
  switch (category) {
    case 'code':
      return 'code documentation, API reference, or programming tutorial';
    case 'mobile':
      return 'mobile development (Flutter, React Native, iOS, Android)';
    case 'docs':
      return 'technical documentation or README';
    case 'general':
      return 'general technical documentation';
  }
}

// =============================================================================
// Manual Dataset Creation Helpers
// =============================================================================

/**
 * Create a manual evaluation query
 */
export function createManualQuery(
  id: string,
  query: string,
  category: EvalCategory,
  relevantDocIds: string[],
  options: {
    difficulty?: EvalDifficulty;
    queryType?: EvalQueryType;
    relevantChunkIds?: string[];
    expectedAnswer?: string;
    requiredKeywords?: string[];
    collectionId?: string;
  } = {}
): EvalQuery {
  return {
    id,
    query,
    category,
    difficulty: options.difficulty ?? 'medium',
    queryType: options.queryType ?? 'factual',
    relevantDocIds,
    relevantChunkIds: options.relevantChunkIds,
    expectedAnswer: options.expectedAnswer,
    requiredKeywords: options.requiredKeywords,
    collectionId: options.collectionId,
    metadata: {
      source: 'manual',
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Create a dataset from an array of manual queries
 */
export function createManualDataset(
  name: string,
  description: string,
  queries: EvalQuery[]
): EvalDataset {
  return {
    metadata: {
      name,
      description,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      source: 'manual',
    },
    queries,
  };
}

/**
 * Merge multiple datasets into one
 */
export function mergeDatasets(datasets: EvalDataset[]): EvalDataset {
  const allQueries: EvalQuery[] = [];
  const seenIds = new Set<string>();

  for (const dataset of datasets) {
    for (const query of dataset.queries) {
      // Ensure unique IDs
      let id = query.id;
      if (seenIds.has(id)) {
        id = `${id}-${Date.now()}`;
      }
      seenIds.add(id);

      allQueries.push({ ...query, id });
    }
  }

  return {
    metadata: {
      name: 'merged-dataset',
      description: `Merged from ${datasets.length} datasets`,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      source: 'mixed',
    },
    queries: allQueries,
  };
}

/**
 * Save dataset to a JSON file
 */
export async function saveDataset(dataset: EvalDataset, filePath: string): Promise<void> {
  const fs = await import('node:fs/promises');
  await fs.writeFile(filePath, JSON.stringify(dataset, null, 2));
}

/**
 * Load dataset from a JSON file
 */
export async function loadDataset(filePath: string): Promise<EvalDataset> {
  const fs = await import('node:fs/promises');
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as EvalDataset;
}
