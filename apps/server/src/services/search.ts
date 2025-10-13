import type { Pool } from 'pg';
import type { ContentContext, EmbeddingProvider } from './embedding-router.js';
import { deriveContextFromMetadata, isEmbeddingProvider } from './embedding-router.js';
import { type HybridSearchParams, type HybridSearchResult, hybridSearch } from './hybrid.js';
import {
  type SearchParams,
  type SearchResponse,
  type SearchResult,
  searchCollection as vectorSearch,
} from './vector.js';

export type { SearchParams, SearchResponse, SearchResult } from './vector.js';

export interface SmartSearchParams extends SearchParams {
  mode?: 'vector' | 'hybrid';
  weights?: HybridSearchParams['weights'];
  rrfK?: number;
}

export interface SmartSearchResult extends SearchResult {
  vectorScore?: number;
  bm25Score?: number;
  fusedScore?: number;
  source?: HybridSearchResult['source'];
}

export interface SmartSearchResponse extends Omit<SearchResponse, 'results'> {
  results: SmartSearchResult[];
  metadata: {
    searchMode: 'vector' | 'hybrid';
    vectorCount?: number;
    bm25Count?: number;
    fusedCount?: number;
    embeddingProvider?: EmbeddingProvider;
  };
}

export async function smartSearch(
  db: Pool,
  params: SmartSearchParams
): Promise<SmartSearchResponse> {
  const mode = params.mode ?? (process.env.SEARCH_MODE === 'hybrid' ? 'hybrid' : 'vector');
  const hint =
    params.provider && params.context
      ? undefined
      : await inferCollectionEmbeddingHint(db, params.collectionId);
  const provider = params.provider ?? hint?.provider;
  const context = params.context ?? hint?.context;

  if (mode === 'hybrid') {
    const { results, elapsedMs, vectorCount, bm25Count } = await hybridSearch(db, {
      query: params.query,
      collectionId: params.collectionId,
      topK: params.topK,
      minSimilarity: params.minSimilarity,
      weights: params.weights,
      rrfK: params.rrfK,
      provider,
      context,
    });

    return {
      query: params.query,
      results: results.map((item) => ({
        ...item,
        similarity: item.fusedScore,
      })),
      totalResults: results.length,
      searchTimeMs: elapsedMs,
      metadata: {
        searchMode: 'hybrid',
        vectorCount,
        bm25Count,
        fusedCount: results.length,
        embeddingProvider: provider,
      },
    };
  }

  const vectorResult = await vectorSearch(db, {
    query: params.query,
    collectionId: params.collectionId,
    topK: params.topK,
    minSimilarity: params.minSimilarity,
    provider,
    context,
  });

  return {
    ...vectorResult,
    metadata: {
      searchMode: 'vector',
      vectorCount: vectorResult.totalResults,
      fusedCount: vectorResult.totalResults,
      embeddingProvider: provider,
    },
  };
}

export const searchCollection = vectorSearch;

async function inferCollectionEmbeddingHint(
  db: Pool,
  collectionId: string
): Promise<{ provider?: EmbeddingProvider; context?: ContentContext }> {
  const { rows } = await db.query<{
    provider: string | null;
    doc_type: string | null;
    language: string | null;
  }>(
    `
      SELECT
        d.metadata->>'embedding_provider' AS provider,
        d.metadata->>'doc_type' AS doc_type,
        d.metadata->>'language' AS language
      FROM documents d
      WHERE d.collection_id = $1
      ORDER BY d.processed_at DESC NULLS LAST, d.created_at DESC
      LIMIT 1
    `,
    [collectionId]
  );

  if (rows.length === 0) {
    return {};
  }

  const row = rows[0];
  const provider = isEmbeddingProvider(row.provider ?? undefined)
    ? (row.provider as EmbeddingProvider)
    : undefined;

  const contextMetadata: Record<string, unknown> = {};
  if (row.doc_type) {
    contextMetadata.doc_type = row.doc_type;
  }
  if (row.language) {
    contextMetadata.language = row.language;
  }

  const context = Object.keys(contextMetadata).length
    ? deriveContextFromMetadata(contextMetadata)
    : undefined;

  return { provider, context };
}
