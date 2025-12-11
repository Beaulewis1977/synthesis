import { performance } from 'node:perf_hooks';
import type { Pool } from 'pg';
import { embedTextToArray } from '../pipeline/embed.js';
import type { ContentContext, EmbeddingProvider } from './embedding-router.js';
import { createSnippet } from './snippet.js';

export interface SearchParams {
  query: string;
  collectionId: string;
  topK?: number;
  minSimilarity?: number;
  provider?: EmbeddingProvider;
  context?: ContentContext;
  techStack?: string[];
  // GPT Phase 1: Feature-aware filtering
  featureTags?: string[];
  platform?: string;
  usageTier?: string;
  // GPT Phase 3: Source quality filtering
  sourceQuality?: 'official' | 'verified' | 'community';
}

export interface SearchResult {
  id: number;
  text: string;
  snippet: string;
  similarity: number;
  docId: string;
  docTitle: string | null;
  sourceUrl: string | null;
  metadata: Record<string, unknown> | null;
  citation: {
    title: string | null;
    page?: string | number | null;
    section?: string | null;
  };
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalResults: number;
  searchTimeMs: number;
}

const DEFAULT_TOP_K = 5;
const DEFAULT_MIN_SIMILARITY = 0.35;

// Validate HNSW_EF_SEARCH to prevent SQL injection
const HNSW_EF_SEARCH = (() => {
  const val = Number.parseInt(process.env.HNSW_EF_SEARCH ?? '100', 10);
  if (!Number.isInteger(val) || val < 1 || val > 1000) {
    console.warn(`Invalid HNSW_EF_SEARCH: ${process.env.HNSW_EF_SEARCH}, using default 100`);
    return 100;
  }
  return val;
})();

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
  const embedding = await embedTextToArray(trimmedQuery, {
    provider: params.provider,
    context: params.context,
  });
  const vectorLiteral = toVectorLiteral(embedding);

  // Handle tech_stack filtering: empty array means no filter
  const techStackFilter = params.techStack && params.techStack.length > 0 ? params.techStack : null;

  // GPT Phase 1: Feature-aware filtering
  const featureTagsFilter =
    params.featureTags && params.featureTags.length > 0 ? params.featureTags : null;
  const platformFilter = params.platform || null;
  const usageTierFilter = params.usageTier || null;

  // GPT Phase 3: Source quality filtering
  const sourceQualityFilter = params.sourceQuality || null;

  // Use a client from the pool to run SET LOCAL in a transaction
  const client = await db.connect();
  let rows: Array<Record<string, unknown>>;
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL hnsw.ef_search = ${HNSW_EF_SEARCH}`);
    const result = await client.query(
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
        AND (
          $5::text[] IS NULL
          OR ch.metadata->'tech_stack' ?| $5::text[]
        )
        AND (
          $6::text[] IS NULL
          OR ch.metadata->'feature_tags' ?| $6::text[]
        )
        AND (
          $7::text IS NULL
          OR ch.metadata->>'platform' = $7::text
        )
        AND (
          $8::text IS NULL
          OR ch.metadata->>'usage_tier' = $8::text
        )
        AND (
          $9::text IS NULL
          OR ch.metadata->>'source_quality' = $9::text
        )
      ORDER BY ch.embedding <=> $1::vector
      LIMIT $4
    `,
      [
        vectorLiteral,
        params.collectionId,
        minSimilarity,
        topK,
        techStackFilter,
        featureTagsFilter,
        platformFilter,
        usageTierFilter,
        sourceQualityFilter,
      ]
    );
    rows = result.rows;
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const end = performance.now();

  const results: SearchResult[] = rows.map((row) => {
    const metadata = (row.metadata ?? null) as Record<string, unknown> | null;
    const rawPage = metadata?.page;
    const page = typeof rawPage === 'number' || typeof rawPage === 'string' ? rawPage : null;
    const rawSection = (metadata?.heading ?? metadata?.section) as unknown;
    const section = typeof rawSection === 'string' ? rawSection : null;

    return {
      id: row.id as number,
      text: row.text as string,
      snippet: createSnippet(row.text as string),
      similarity: Number(row.similarity) || 0,
      docId: row.doc_id as string,
      docTitle: (row.doc_title as string | null) ?? null,
      sourceUrl: (row.source_url as string | null) ?? null,
      metadata,
      citation: {
        title: (row.doc_title as string | null) ?? null,
        page,
        section,
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
