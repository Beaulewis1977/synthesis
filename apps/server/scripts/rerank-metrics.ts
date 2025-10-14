import { performance } from 'node:perf_hooks';
import { closePool, getPool } from '@synthesis/db';
import type { Pool } from 'pg';
import { rerankResults } from '../src/services/reranker.js';

interface MetricQuery {
  query: string;
  relevantDocIds: string[];
}

interface MetricRow {
  query: string;
  baselinePrecision: number;
  rerankedPrecision: number;
  precisionDelta: number;
  baselineMs: number;
  rerankedMs: number;
  latencyDelta: number;
}

const metricsCollectionId =
  process.env.METRICS_COLLECTION_ID ?? '00000000-0000-0000-0000-000000000002';

const QUERIES: MetricQuery[] =
  process.env.METRICS_QUERIES_JSON !== undefined
    ? (JSON.parse(process.env.METRICS_QUERIES_JSON) as MetricQuery[])
    : [
        {
          query: 'flutter async widget lifecycle diagram',
          relevantDocIds: ['11111111-1111-1111-1111-111111111111'],
        },
        {
          query: 'stateful counter setState hot reload tips',
          relevantDocIds: ['22222222-2222-2222-2222-222222222222'],
        },
        {
          query: 'flutter router navigator 2 declarative navigation',
          relevantDocIds: ['33333333-3333-3333-3333-333333333333'],
        },
        {
          query: 'dart testing checklist arrange act assert golden tests',
          relevantDocIds: ['44444444-4444-4444-4444-444444444444'],
        },
        {
          query: 'bloc pattern event reducers performance tuning',
          relevantDocIds: ['55555555-5555-5555-5555-555555555555'],
        },
      ];

async function measureQuery(metricsQuery: MetricQuery): Promise<MetricRow> {
  const pool = getPool();

  const baselineStart = performance.now();
  const baselineCandidates = await fetchCandidates(pool, metricsQuery.query);
  const baselineEnd = performance.now();

  // eslint-disable-next-line no-console
  console.log(
    `  Retrieved ${baselineCandidates.length} candidates (baseline precision: ${calculatePrecision(
      baselineCandidates,
      metricsQuery.relevantDocIds
    ).toFixed(2)})`
  );

  const rerankStart = performance.now();
  const reranked = await rerankResults(metricsQuery.query, baselineCandidates, {
    provider: 'bge',
    topK: baselineCandidates.length,
    maxCandidates: 50,
  });
  const rerankEnd = performance.now();

  const baselinePrecision = calculatePrecision(baselineCandidates, metricsQuery.relevantDocIds);
  const rerankedPrecision = calculatePrecision(reranked, metricsQuery.relevantDocIds);

  return {
    query: metricsQuery.query,
    baselinePrecision,
    rerankedPrecision,
    precisionDelta: rerankedPrecision - baselinePrecision,
    baselineMs: baselineEnd - baselineStart,
    rerankedMs: rerankEnd - rerankStart,
    latencyDelta: rerankEnd - rerankStart - (baselineEnd - baselineStart),
  };
}

function calculatePrecision(results: { docId?: string }[], relevantDocIds: string[]): number {
  const relevant = new Set(relevantDocIds);
  const topResults = results.slice(0, 5);
  if (topResults.length === 0) {
    return 0;
  }
  const hits = topResults.filter((item) => item.docId && relevant.has(item.docId)).length;
  return hits / topResults.length;
}

async function main(): Promise<void> {
  process.env.RERANKER_PROVIDER = 'bge';

  const rows: MetricRow[] = [];
  for (const entry of QUERIES) {
    // eslint-disable-next-line no-console
    console.log(`Measuring "${entry.query}"...`);
    const result = await measureQuery(entry);
    rows.push(result);
  }

  await closePool();

  // eslint-disable-next-line no-console
  console.log('\nQuery Metrics');
  // eslint-disable-next-line no-console
  console.table(
    rows.map((row) => ({
      Query: row.query,
      'Baseline P@5': row.baselinePrecision.toFixed(2),
      'Reranked P@5': row.rerankedPrecision.toFixed(2),
      'Δ Precision': row.precisionDelta.toFixed(2),
      'Baseline ms': row.baselineMs.toFixed(1),
      'Reranked ms': row.rerankedMs.toFixed(1),
      'Δ Latency ms': row.latencyDelta.toFixed(1),
    }))
  );

  const averagePrecisionDelta =
    rows.reduce((sum, row) => sum + row.precisionDelta, 0) / rows.length;
  const averageLatencyDelta = rows.reduce((sum, row) => sum + row.latencyDelta, 0) / rows.length;

  // eslint-disable-next-line no-console
  console.log(
    `Average Δ Precision@5: ${averagePrecisionDelta.toFixed(2)} | Average Δ Latency: ${averageLatencyDelta.toFixed(
      1
    )}ms`
  );
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  closePool().finally(() => {
    process.exitCode = 1;
  });
});

interface CandidateRow {
  docId: string;
  docTitle: string;
  text: string;
}

async function fetchCandidates(pool: Pool, query: string): Promise<CandidateRow[]> {
  const sql = `
    SELECT
      c.doc_id AS "docId",
      d.title AS "docTitle",
      c.text
    FROM chunks c
    JOIN documents d ON d.id = c.doc_id
    WHERE d.collection_id = $1
  `;

  const { rows } = await pool.query<CandidateRow>(sql, [metricsCollectionId]);
  const scored = rows
    .map((row) => ({
      ...row,
      similarity: lexicalScore(row.text, query),
    }))
    .filter((row) => row.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 50);

  return scored;
}

function lexicalScore(text: string, rawQuery: string): number {
  const terms = rawQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 2); // ignore very short tokens

  const lowered = text.toLowerCase();
  let score = 0;

  for (const term of terms) {
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = lowered.match(regex);
    if (matches) {
      score += matches.length;
    }
  }

  return score;
}
