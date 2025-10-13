import type { Pool } from 'pg';

export interface BM25Params {
  query: string;
  collectionId: string;
  topK?: number;
  language?: string;
}

export interface BM25Result {
  chunkId: number;
  text: string;
  rank: number;
  score: number;
  docId: string;
  docTitle: string | null;
  sourceUrl: string | null;
  metadata: Record<string, unknown> | null;
}

interface BM25Row {
  chunk_id: number;
  text: string;
  rank: number | null;
  doc_id: string;
  doc_title: string | null;
  source_url: string | null;
  metadata: Record<string, unknown> | null;
}

const DEFAULT_TOP_K = 30;
const DEFAULT_LANGUAGE = 'english';

export async function bm25Search(db: Pool, params: BM25Params): Promise<BM25Result[]> {
  const topK = params.topK ?? DEFAULT_TOP_K;
  const envLanguage = process.env.FTS_LANGUAGE?.trim();
  const language = params.language ?? (envLanguage ? envLanguage : DEFAULT_LANGUAGE);
  const trimmedQuery = params.query.trim();

  if (!trimmedQuery) {
    throw new Error('Query must not be empty');
  }

  if (!Number.isFinite(topK) || topK <= 0) {
    throw new Error('topK must be a positive number');
  }

  const tsQuery = buildPrefixTsQuery(trimmedQuery);
  if (!tsQuery) {
    throw new Error('Query must contain alphanumeric characters');
  }

  const { rows } = await db.query<BM25Row>(
    `
      SELECT
        ch.id AS chunk_id,
        ch.text,
        ch.metadata,
        ch.doc_id,
        d.title AS doc_title,
        d.source_url,
        ts_rank_cd(
          to_tsvector($1::regconfig, ch.text),
          to_tsquery($1::regconfig, $2)
        ) AS rank
      FROM chunks ch
      JOIN documents d ON d.id = ch.doc_id
      WHERE d.collection_id = $3
        AND to_tsvector($1::regconfig, ch.text) @@ to_tsquery($1::regconfig, $2)
      ORDER BY rank DESC
      LIMIT $4
    `,
    [language, tsQuery, params.collectionId, topK]
  );
  if (rows.length === 0) {
    return [];
  }

  const maxRank = rows.reduce((max, row) => {
    const value = typeof row.rank === 'number' ? row.rank : 0;
    return value > max ? value : max;
  }, 0);
  const safeMaxRank = maxRank > 0 ? maxRank : 1;

  return rows.map((row, index) => {
    const metadata =
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : null;
    const rawRank = typeof row.rank === 'number' ? row.rank : 0;

    return {
      chunkId: row.chunk_id,
      text: row.text,
      rank: index + 1,
      score: rawRank / safeMaxRank,
      docId: row.doc_id,
      docTitle: row.doc_title ?? null,
      sourceUrl: row.source_url ?? null,
      metadata,
    };
  });
}

function buildPrefixTsQuery(input: string): string {
  const terms = input
    .split(/\s+/)
    .map((term) => term.replace(/[':*&|!()]/g, '').trim())
    .filter((term) => term.length > 0)
    .map((term) => `${term}:*`);

  return terms.join(' & ');
}
