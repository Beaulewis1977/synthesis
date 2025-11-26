import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

interface ModeBucket {
  results?: Array<{
    text?: string;
    snippet?: string;
    docTitle?: string | null;
    doc_title?: string | null;
  }>;
  metadata?: unknown;
}

interface QueryEvalEntry {
  queryId: number;
  query: string;
  vector?: ModeBucket;
  bm25?: ModeBucket;
  hybrid?: ModeBucket;
  hybrid_rerank?: ModeBucket;
}

const RESULTS_PREFIX = 'rag_eval_flutter_dart_results_';

const EXPECTED_SNIPPET_ANCHORS: Record<number, string[]> = {
  // Stateless vs Stateful widgets
  1: ['class SimpleWidget extends StatelessWidget', 'class CounterWidget extends StatefulWidget'],
  // Provider state management
  2: ['class CounterModel extends ChangeNotifier', 'notifyListeners()'],
  // Navigation
  5: ['Navigator.push', 'Navigator.pop', 'MaterialPageRoute(builder: (context) => DetailScreen())'],
  // Async / await and HTTP
  7: ['Future<String> fetchUserData() async', 'http.get('],
  13: ['Future<String> fetchUserData() async', 'http.get('],
  // Error handling
  8: ['try {', 'catch (e)', 'UnsupportedError'],
  // ListView vs ListView.builder
  15: ['ListView(', 'ListView.builder('],
  // Streams
  19: ['Stream<int> countStream() async*'],
  // Constructors
  20: ['class Person', 'Person.fromJson', 'const Person.constant'],
};

async function loadLatestResults(pathArg?: string): Promise<QueryEvalEntry[]> {
  if (pathArg) {
    const raw = await readFile(pathArg, 'utf8');
    return JSON.parse(raw) as QueryEvalEntry[];
  }

  const perfDir = resolve(process.cwd(), 'perf');
  const files = await readdir(perfDir);
  const candidates = files
    .filter((name) => name.startsWith(RESULTS_PREFIX) && name.endsWith('.json'))
    .sort();

  if (candidates.length === 0) {
    throw new Error('No Flutter/Dart eval results found in apps/server/perf');
  }

  const latest = candidates[candidates.length - 1];
  const fullPath = resolve(perfDir, latest);
  const raw = await readFile(fullPath, 'utf8');
  return JSON.parse(raw) as QueryEvalEntry[];
}

function extractTopDocTitle(bucket?: ModeBucket): string {
  const top = bucket?.results?.[0];
  if (!top) return '';
  const title =
    (typeof top.docTitle === 'string' && top.docTitle.length > 0
      ? top.docTitle
      : typeof top.doc_title === 'string'
        ? top.doc_title
        : null) ?? '';
  return title;
}

function extractTopText(bucket?: ModeBucket): string {
  const top = bucket?.results?.[0];
  if (!top) return '';
  if (typeof top.text === 'string' && top.text.length > 0) {
    return top.text;
  }
  if (typeof top.snippet === 'string' && top.snippet.length > 0) {
    return top.snippet;
  }
  return '';
}

function containsExpectedSnippet(queryId: number, text: string): string {
  const anchors = EXPECTED_SNIPPET_ANCHORS[queryId];
  if (!anchors || anchors.length === 0) {
    return '';
  }
  const hit = anchors.some((anchor) => text.includes(anchor));
  return hit ? '✅' : '❌';
}

function buildMarkdown(entries: QueryEvalEntry[]): string {
  const lines: string[] = [];
  lines.push('# Flutter/Dart RAG Evaluation Summary');
  lines.push('');
  lines.push('| QID | Query | Mode | Top Doc Title | Expected Snippet? |');
  lines.push('| --- | ----- | ---- | ------------- | ----------------- |');

  const modes = ['vector', 'bm25', 'hybrid', 'hybrid_rerank'] as const;

  for (const entry of entries) {
    const safeQuery = entry.query.replace(/\|/g, '\\|');

    for (const mode of modes) {
      const bucket = entry[mode];
      if (!bucket || !bucket.results || bucket.results.length === 0) {
        continue;
      }

      const title = extractTopDocTitle(bucket).replace(/\|/g, '\\|');
      const text = extractTopText(bucket);
      const flag = containsExpectedSnippet(entry.queryId, text);

      const modeLabel = mode === 'hybrid_rerank' ? 'hybrid+rerank' : mode;

      lines.push(`| ${entry.queryId} | ${safeQuery} | ${modeLabel} | ${title} | ${flag} |`);
    }
  }

  return lines.join('\n');
}

async function main(): Promise<void> {
  const explicitPath = process.argv[2];
  const entries = await loadLatestResults(explicitPath);
  const markdown = buildMarkdown(entries);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = resolve(process.cwd(), `perf/rag_eval_flutter_dart_summary_${timestamp}.md`);

  await writeFile(outPath, markdown, 'utf8');

  console.info(`Wrote Flutter/Dart eval summary to ${outPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to generate Flutter/Dart eval summary', err);
  process.exitCode = 1;
});
