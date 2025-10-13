import { performance } from 'node:perf_hooks';
import type { Pool } from 'pg';
import { type BM25Result, bm25Search } from './bm25.js';
import { type SearchParams, type SearchResult, searchCollection } from './vector.js';

export interface HybridSearchParams extends Omit<SearchParams, 'topK'> {
  topK?: number;
  weights?: {
    vector?: number;
    bm25?: number;
  };
  rrfK?: number;
}

export interface HybridSearchResult extends SearchResult {
  vectorScore: number;
  bm25Score: number;
  fusedScore: number;
  source: 'vector' | 'bm25' | 'both';
}

const DEFAULT_TOP_K = 10;
const DEFAULT_WEIGHTS = { vector: 0.7, bm25: 0.3 };
const DEFAULT_RRF_K = 60;

export async function hybridSearch(
  db: Pool,
  params: HybridSearchParams
): Promise<{
  results: HybridSearchResult[];
  elapsedMs: number;
  vectorCount: number;
  bm25Count: number;
}> {
  const topK = params.topK ?? DEFAULT_TOP_K;
  const weights = {
    vector: params.weights?.vector ?? DEFAULT_WEIGHTS.vector,
    bm25: params.weights?.bm25 ?? DEFAULT_WEIGHTS.bm25,
  };
  const rrfK = params.rrfK ?? DEFAULT_RRF_K;

  const start = performance.now();
  const expandedTopK = Math.max(topK * 3, topK);

  const [vectorResponse, bm25Results] = await Promise.all([
    searchCollection(db, {
      query: params.query,
      collectionId: params.collectionId,
      topK: expandedTopK,
      minSimilarity: params.minSimilarity,
      provider: params.provider,
      context: params.context,
    }),
    bm25Search(db, {
      query: params.query,
      collectionId: params.collectionId,
      topK: expandedTopK,
    }),
  ]);

  const fused = fuseResults(vectorResponse.results, bm25Results, weights, rrfK);
  const sorted = fused.sort((a, b) => b.fusedScore - a.fusedScore).slice(0, topK);

  return {
    results: sorted,
    elapsedMs: Math.round(performance.now() - start),
    vectorCount: vectorResponse.results.length,
    bm25Count: bm25Results.length,
  };
}

export function fuseResults(
  vectorResults: SearchResult[],
  bm25Results: BM25Result[],
  weights = DEFAULT_WEIGHTS,
  rrfK = DEFAULT_RRF_K
): HybridSearchResult[] {
  const scoreMap = new Map<number, HybridSearchResult>();

  vectorResults.forEach((result, index) => {
    const rrfScore = 1 / (rrfK + index + 1);
    scoreMap.set(result.id, {
      ...result,
      vectorScore: result.similarity,
      bm25Score: 0,
      fusedScore: rrfScore * weights.vector,
      source: 'vector',
    });
  });

  bm25Results.forEach((result, index) => {
    const rrfScore = 1 / (rrfK + index + 1);
    const existing = scoreMap.get(result.chunkId);

    if (existing) {
      existing.bm25Score = result.score;
      existing.fusedScore += rrfScore * weights.bm25;
      existing.source = 'both';
    } else {
      scoreMap.set(result.chunkId, {
        id: result.chunkId,
        text: result.text,
        similarity: 0,
        docId: result.docId,
        docTitle: result.docTitle,
        sourceUrl: result.sourceUrl,
        metadata: result.metadata,
        citation: {
          title: result.docTitle,
        },
        vectorScore: 0,
        bm25Score: result.score,
        fusedScore: rrfScore * weights.bm25,
        source: 'bm25',
      });
    }
  });

  return Array.from(scoreMap.values());
}
