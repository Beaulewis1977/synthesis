import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getPool } from '@synthesis/db';
import { bm25Search } from '../services/bm25.js';
import { smartSearch } from '../services/search.js';

interface EvalQuery {
  id: number;
  text: string;
}

interface EvalConfig {
  collectionId: string;
  topK: number;
  modes: Array<'vector' | 'bm25' | 'hybrid' | 'hybrid_rerank'>;
  queries: EvalQuery[];
}

interface ModeResult {
  results: unknown[];
  metadata?: unknown;
}

interface QueryEvalResult {
  queryId: number;
  query: string;
  vector?: ModeResult;
  bm25?: { results: unknown[] };
  hybrid?: ModeResult;
  hybrid_rerank?: ModeResult;
}

async function loadConfig(): Promise<EvalConfig> {
  const configPath = resolve(process.cwd(), 'perf/rag_eval_flutter_dart.json');
  const raw = await readFile(configPath, 'utf8');
  return JSON.parse(raw) as EvalConfig;
}

async function main(): Promise<void> {
  const config = await loadConfig();
  const pool = getPool();

  const allResults: QueryEvalResult[] = [];

  for (const query of config.queries) {
    const entry: QueryEvalResult = {
      queryId: query.id,
      query: query.text,
    };

    if (config.modes.includes('vector')) {
      const vectorResult = await smartSearch(pool, {
        mode: 'vector',
        collectionId: config.collectionId,
        query: query.text,
        topK: config.topK,
      });
      entry.vector = {
        results: vectorResult.results,
        metadata: vectorResult.metadata,
      };
    }

    if (config.modes.includes('hybrid')) {
      const hybridResult = await smartSearch(pool, {
        mode: 'hybrid',
        collectionId: config.collectionId,
        query: query.text,
        topK: config.topK,
      });
      entry.hybrid = {
        results: hybridResult.results,
        metadata: hybridResult.metadata,
      };
    }

    if (config.modes.includes('hybrid_rerank')) {
      const hybridRerankResult = await smartSearch(pool, {
        mode: 'hybrid',
        collectionId: config.collectionId,
        query: query.text,
        topK: config.topK,
        rerank: true,
      });
      entry.hybrid_rerank = {
        results: hybridRerankResult.results,
        metadata: hybridRerankResult.metadata,
      };
    }

    if (config.modes.includes('bm25')) {
      const bm25Results = await bm25Search(pool, {
        query: query.text,
        collectionId: config.collectionId,
        topK: config.topK,
      });
      entry.bm25 = {
        results: bm25Results,
      };
    }

    allResults.push(entry);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = resolve(process.cwd(), `perf/rag_eval_flutter_dart_results_${timestamp}.json`);

  await writeFile(outPath, JSON.stringify(allResults, null, 2), 'utf8');

  console.info(`Wrote Flutter/Dart eval results to ${outPath}`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`RAG Flutter/Dart eval harness failed: ${message}`, err);
  process.exitCode = 1;
});
