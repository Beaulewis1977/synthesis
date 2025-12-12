/**
 * Ground Truth Expander
 *
 * Uses LLM-as-judge to expand narrow ground truth by evaluating
 * whether search results could answer evaluation queries.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Pool } from 'pg';
import { smartSearch } from '../services/search.js';
import type { EvalDataset, EvalQuery } from './types.js';

// =============================================================================
// Types
// =============================================================================

export interface GroundTruthExpansionOptions {
  /** Database pool */
  db: Pool;

  /** Anthropic client (optional, will create if not provided) */
  anthropic?: Anthropic;

  /** Model to use for judging relevance (default: claude-sonnet-4-20250514) */
  model?: string;

  /** Number of search results to evaluate per query (default: 10) */
  topK?: number;

  /** Confidence threshold for adding to ground truth (default: 0.7) */
  confidenceThreshold?: number;

  /** Search mode to use (default: hybrid) */
  searchMode?: 'vector' | 'hybrid';

  /** Enable reranking during search (default: true) */
  rerank?: boolean;

  /** Progress callback */
  onProgress?: (completed: number, total: number, query: string) => void;

  /** Verbose logging */
  verbose?: boolean;
}

export interface RelevanceJudgment {
  relevant: boolean;
  confidence: number; // 0-1
  reasoning: string;
}

export interface ExpansionStats {
  totalQueries: number;
  queriesExpanded: number;
  originalDocCount: number;
  expandedDocCount: number;
  avgDocsPerQuery: {
    before: number;
    after: number;
  };
}

// =============================================================================
// Main Expander
// =============================================================================

/**
 * Expand ground truth in an evaluation dataset using LLM-as-judge
 */
export async function expandGroundTruth(
  dataset: EvalDataset,
  options: GroundTruthExpansionOptions
): Promise<{ dataset: EvalDataset; stats: ExpansionStats }> {
  const {
    db,
    topK = 10,
    confidenceThreshold = 0.7,
    searchMode = 'hybrid',
    rerank = true,
    onProgress,
    verbose = false,
  } = options;

  const anthropic = options.anthropic ?? new Anthropic();
  const model = options.model ?? 'claude-sonnet-4-20250514';

  const expandedQueries: EvalQuery[] = [];
  let queriesExpanded = 0;
  let originalDocCount = 0;
  let expandedDocCount = 0;

  for (let i = 0; i < dataset.queries.length; i++) {
    const query = dataset.queries[i];
    onProgress?.(i + 1, dataset.queries.length, query.query);

    // Skip queries without collectionId
    if (!query.collectionId) {
      if (verbose) {
        console.info(`  Skipping "${query.id}" - no collectionId`);
      }
      expandedQueries.push(query);
      continue;
    }

    try {
      // Run search
      const searchResponse = await smartSearch(db, {
        query: query.query,
        collectionId: query.collectionId,
        topK,
        mode: searchMode,
        rerank,
      });

      const relevantDocIds = new Set(query.relevantDocIds);
      const originalCount = relevantDocIds.size;
      originalDocCount += originalCount;

      // Judge each result not already in ground truth
      for (const result of searchResponse.results) {
        if (relevantDocIds.has(result.docId)) continue; // Already in GT

        // Extract file path from metadata if available
        const filePath =
          typeof result.metadata?.file_path === 'string' ? result.metadata.file_path : '';

        const judgment = await judgeRelevance(
          anthropic,
          model,
          query.query,
          result.text,
          result.docTitle ?? '',
          filePath
        );

        if (judgment.relevant && judgment.confidence >= confidenceThreshold) {
          relevantDocIds.add(result.docId);
          if (verbose) {
            console.info(
              `  ✓ Added "${result.docTitle ?? filePath}" (conf: ${judgment.confidence.toFixed(2)})`
            );
          }
        } else if (verbose && judgment.relevant) {
          console.info(
            `  ○ Low conf "${result.docTitle ?? filePath}" (conf: ${judgment.confidence.toFixed(2)})`
          );
        }
      }

      const newCount = relevantDocIds.size;
      expandedDocCount += newCount;

      if (newCount > originalCount) {
        queriesExpanded++;
        if (verbose) {
          console.info(`  Query "${query.id}": ${originalCount} → ${newCount} docs`);
        }
      }

      expandedQueries.push({
        ...query,
        relevantDocIds: Array.from(relevantDocIds),
        metadata: {
          ...query.metadata,
          notes: `Expanded from ${originalCount} to ${newCount} docs (model: ${model}, threshold: ${confidenceThreshold})`,
        },
      });
    } catch (error) {
      console.error(`  Error expanding query "${query.id}":`, error);
      expandedQueries.push(query);
    }
  }

  const totalQueries = dataset.queries.length;

  const stats: ExpansionStats = {
    totalQueries,
    queriesExpanded,
    originalDocCount,
    expandedDocCount,
    avgDocsPerQuery: {
      before: totalQueries ? originalDocCount / totalQueries : 0,
      after: totalQueries ? expandedDocCount / totalQueries : 0,
    },
  };

  const expandedDataset: EvalDataset = {
    metadata: {
      ...dataset.metadata,
      name: `${dataset.metadata.name}-expanded`,
      description: `${dataset.metadata.description} (LLM-expanded ground truth)`,
      source: 'mixed',
    },
    queries: expandedQueries,
  };

  return { dataset: expandedDataset, stats };
}

// =============================================================================
// Relevance Judgment
// =============================================================================

/**
 * Use LLM to judge if a document could answer a query
 */
async function judgeRelevance(
  anthropic: Anthropic,
  model: string,
  query: string,
  chunkText: string,
  docTitle: string,
  filePath: string
): Promise<RelevanceJudgment> {
  const prompt = `You are evaluating if a document chunk could help answer a search query.

QUERY: ${query}

DOCUMENT: ${docTitle || filePath || 'Untitled'}
${filePath ? `File: ${filePath}` : ''}

CONTENT:
${chunkText.slice(0, 2000)}

---

Could this document help answer the query? Consider:
1. Does it contain information directly relevant to the question?
2. Would a user find this document helpful for their query?
3. Is the relevance clear and direct (not tangential)?

Respond ONLY with valid JSON (no markdown):
{
  "relevant": true or false,
  "confidence": 0.0 to 1.0,
  "reasoning": "1-2 sentences explaining why"
}`;

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse JSON (handle potential markdown code blocks)
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonText) as RelevanceJudgment;

    // Clamp confidence to valid range
    parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));

    return parsed;
  } catch (error) {
    // Default to not relevant on error
    return {
      relevant: false,
      confidence: 0,
      reasoning: `Error judging relevance: ${error}`,
    };
  }
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate that ground truth doc IDs exist in the database
 */
export async function validateGroundTruth(
  db: Pool,
  dataset: EvalDataset
): Promise<{
  valid: boolean;
  missingDocIds: Map<string, string[]>;
  stats: { total: number; found: number; missing: number };
}> {
  const allDocIds = new Set<string>();
  const queryDocMap = new Map<string, string[]>();

  // Collect all doc IDs
  for (const query of dataset.queries) {
    for (const docId of query.relevantDocIds) {
      allDocIds.add(docId);
    }
    queryDocMap.set(query.id, query.relevantDocIds);
  }

  // Check which exist
  const existingDocIds = new Set<string>();
  if (allDocIds.size > 0) {
    const result = await db.query<{ id: string }>(
      'SELECT id FROM documents WHERE id = ANY($1::uuid[])',
      [Array.from(allDocIds)]
    );
    for (const row of result.rows) {
      existingDocIds.add(row.id);
    }
  }

  // Find missing
  const missingDocIds = new Map<string, string[]>();
  for (const query of dataset.queries) {
    const missing = query.relevantDocIds.filter((id) => !existingDocIds.has(id));
    if (missing.length > 0) {
      missingDocIds.set(query.id, missing);
    }
  }

  return {
    valid: missingDocIds.size === 0,
    missingDocIds,
    stats: {
      total: allDocIds.size,
      found: existingDocIds.size,
      missing: allDocIds.size - existingDocIds.size,
    },
  };
}

/**
 * Remove invalid doc IDs from dataset
 */
export async function cleanGroundTruth(db: Pool, dataset: EvalDataset): Promise<EvalDataset> {
  const validation = await validateGroundTruth(db, dataset);

  if (validation.valid) {
    return dataset;
  }

  const cleanedQueries = dataset.queries.map((query) => {
    const invalidIds = validation.missingDocIds.get(query.id) ?? [];
    if (invalidIds.length === 0) {
      return query;
    }

    const invalidSet = new Set(invalidIds);
    return {
      ...query,
      relevantDocIds: query.relevantDocIds.filter((id) => !invalidSet.has(id)),
      metadata: {
        ...query.metadata,
        removedInvalidDocIds: invalidIds,
      },
    };
  });

  return {
    ...dataset,
    metadata: {
      ...dataset.metadata,
      description: `${dataset.metadata.description} (cleaned invalid doc IDs)`,
    },
    queries: cleanedQueries,
  };
}
