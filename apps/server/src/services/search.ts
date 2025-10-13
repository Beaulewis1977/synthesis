import type { DocumentMetadata } from '@synthesis/shared';
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
  trustWeight?: number;
  recencyWeight?: number;
}

export interface SmartSearchResponse extends Omit<SearchResponse, 'results'> {
  results: SmartSearchResult[];
  metadata: {
    searchMode: 'vector' | 'hybrid';
    vectorCount?: number;
    bm25Count?: number;
    fusedCount?: number;
    embeddingProvider?: EmbeddingProvider;
    trustScoringApplied?: boolean;
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
    const hybridWeights = resolveHybridWeights(params.weights);
    const { results, elapsedMs, vectorCount, bm25Count } = await hybridSearch(db, {
      query: params.query,
      collectionId: params.collectionId,
      topK: params.topK,
      minSimilarity: params.minSimilarity,
      weights: hybridWeights,
      rrfK: params.rrfK,
      provider,
      context,
    });
    let fusedResults: SmartSearchResult[] = results.map((item) => ({
      ...item,
      similarity: item.fusedScore,
    }));

    const trustApplied = shouldApplyTrustScoring();
    if (trustApplied) {
      fusedResults = applyTrustScoring(fusedResults);
      fusedResults.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
    }

    return {
      query: params.query,
      results: fusedResults,
      totalResults: fusedResults.length,
      searchTimeMs: elapsedMs,
      metadata: {
        searchMode: 'hybrid',
        vectorCount,
        bm25Count,
        fusedCount: fusedResults.length,
        embeddingProvider: provider,
        trustScoringApplied: trustApplied,
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

  const trustApplied = shouldApplyTrustScoring();
  let rankedResults: SmartSearchResult[] = vectorResult.results;

  if (trustApplied) {
    rankedResults = applyTrustScoring(vectorResult.results);
    rankedResults.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
  }

  return {
    ...vectorResult,
    results: rankedResults,
    totalResults: rankedResults.length,
    metadata: {
      searchMode: 'vector',
      vectorCount: rankedResults.length,
      fusedCount: rankedResults.length,
      embeddingProvider: provider,
      trustScoringApplied: trustApplied,
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

const DEFAULT_VECTOR_WEIGHT = 0.7;
const DEFAULT_BM25_WEIGHT = 0.3;

function resolveHybridWeights(
  weights: HybridSearchParams['weights']
): NonNullable<HybridSearchParams['weights']> {
  const envVector = Number.parseFloat(process.env.HYBRID_VECTOR_WEIGHT ?? '');
  const envBm25 = Number.parseFloat(process.env.HYBRID_BM25_WEIGHT ?? '');

  const baseVector = Number.isFinite(envVector) ? envVector : DEFAULT_VECTOR_WEIGHT;
  const baseBm25 = Number.isFinite(envBm25) ? envBm25 : DEFAULT_BM25_WEIGHT;

  const overrideVector = weights?.vector ?? baseVector;
  const overrideBm25 = weights?.bm25 ?? baseBm25;

  const sum = overrideVector + overrideBm25;
  if (!Number.isFinite(sum) || sum <= 0) {
    return { vector: DEFAULT_VECTOR_WEIGHT, bm25: DEFAULT_BM25_WEIGHT };
  }

  return {
    vector: overrideVector / sum,
    bm25: overrideBm25 / sum,
  };
}

function shouldApplyTrustScoring(): boolean {
  return (process.env.ENABLE_TRUST_SCORING ?? '').toLowerCase() === 'true';
}

function applyTrustScoring(results: SmartSearchResult[]): SmartSearchResult[] {
  return results.map((result) => {
    const metadata = toDocumentMetadata(result.metadata);
    const trustWeight = computeTrustWeight(metadata);
    const recencyWeight = computeRecencyWeight(metadata);
    const trustMultiplier = trustWeight * recencyWeight;

    const similarity = Number(result.similarity ?? 0) * trustMultiplier;
    const fusedScore =
      typeof result.fusedScore === 'number'
        ? result.fusedScore * trustMultiplier
        : result.fusedScore;

    return {
      ...result,
      similarity,
      fusedScore,
      trustWeight,
      recencyWeight,
    };
  });
}

function toDocumentMetadata(metadata: unknown): DocumentMetadata | undefined {
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }

  return metadata as DocumentMetadata;
}

function computeTrustWeight(metadata: DocumentMetadata | undefined): number {
  const quality = metadata?.source_quality;
  switch (quality) {
    case 'official':
      return 1;
    case 'verified':
      return 0.85;
    case 'community':
      return 0.6;
    default:
      return 0.5;
  }
}

function computeRecencyWeight(metadata: DocumentMetadata | undefined): number {
  const lastVerified = parseTimestamp(metadata?.last_verified);
  if (!lastVerified) {
    return 0.7;
  }

  const now = new Date();
  let months =
    (now.getFullYear() - lastVerified.getFullYear()) * 12 +
    (now.getMonth() - lastVerified.getMonth());

  if (now.getDate() < lastVerified.getDate()) {
    months -= 1;
  }

  if (months < 6) {
    return 1;
  }
  if (months < 12) {
    return 0.9;
  }
  return 0.7;
}

function parseTimestamp(value: string | Date | undefined): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
