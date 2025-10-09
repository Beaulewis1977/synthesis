import { performance } from 'node:perf_hooks';
import type { Pool } from 'pg';
import { embedText } from '../pipeline/embed.js';

export interface SearchParams {
  query: string;
  collectionId: string;
  topK?: number;
  minSimilarity?: number;
}

export interface SearchResult {
  id: number;
  text: string;
  similarity: number;
  docId: string;
  docTitle: string | null;
  sourceUrl: string | null;
  metadata: Record<string, unknown> | null;
  citation: {
    title: string | null;
    page?: unknown;
    section?: unknown;
  };
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalResults: number;
  searchTimeMs: number;
}

const DEFAULT_TOP_K = 5;
const DEFAULT_MIN_SIMILARITY = 0.5;

function toVectorLiteral(vector: number[]): string {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error('Embedding vector must contain at least one value');
  }

  return `[${vector.join(',')}]`;
}

export async function searchCollection(db: Pool, params: SearchParams): Promise<SearchResponse> {
  const topK = params.topK ?? DEFAULT_TOP_K;
  const minSimilarity = params.minSimilarity ?? DEFAULT_MIN_SIMILARITY;

  if (!Number.isFinite(topK) || topK <= 0) {
    throw new Error('topK must be a positive number');
  }

  const trimmedQuery = params.query.trim();
  if (trimmedQuery.length === 0) {
    throw new Error('Query must not be empty');
  }

  const start = performance.now();
  const embedding = await embedText(trimmedQuery);
  const vectorLiteral = toVectorLiteral(embedding);

  const { rows } = await db.query(
    `
      SELECT
        ch.id,
        ch.text,
        ch.metadata,
        ch.doc_id,
        d.title AS doc_title,
        d.source_url,
        (1 - (ch.embedding <=> $1::vector)) AS similarity
      FROM chunks ch
      JOIN documents d ON d.id = ch.doc_id
      WHERE d.collection_id = $2
        AND ch.embedding IS NOT NULL
        AND (1 - (ch.embedding <=> $1::vector)) >= $3
      ORDER BY ch.embedding <=> $1::vector
      LIMIT $4
    `,
    [vectorLiteral, params.collectionId, minSimilarity, topK]
  );

  const end = performance.now();

  const results: SearchResult[] = rows.map((row) => {
    const metadata = (row.metadata ?? null) as Record<string, unknown> | null;

    return {
      id: row.id as number,
      text: row.text as string,
      similarity: Number(row.similarity) || 0,
      docId: row.doc_id as string,
      docTitle: (row.doc_title as string | null) ?? null,
      sourceUrl: (row.source_url as string | null) ?? null,
      metadata,
      citation: {
        title: (row.doc_title as string | null) ?? null,
        page: metadata?.page,
        section: metadata?.heading,
      },
    };
  });

  return {
    query: trimmedQuery,
    results,
    totalResults: results.length,
    searchTimeMs: Math.round(end - start),
  };
}
