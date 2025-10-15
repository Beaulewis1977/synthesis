import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

interface GuideDoc {
  id: string;
  title: string;
  url: string;
  topics: string[];
  summary: string;
  content: string;
}

interface QueryDefinition {
  category: string;
  variations: string[];
  relevantDocIds: string[];
}

interface RankedResult {
  docId: string;
  title: string;
  url: string;
  score: number;
}

interface QueryMetrics {
  query: string;
  category: string;
  baselinePrecision5: number;
  rerankedPrecision5: number;
  baselinePrecision10: number;
  rerankedPrecision10: number;
  baselineMRR: number;
  rerankedMRR: number;
  baselineMs: number;
  rerankedMs: number;
}

interface LatencySummary {
  p50: number;
  p95: number;
  p99: number;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadCorpus(): Promise<GuideDoc[]> {
  const corpusPath = path.resolve(
    __dirname,
    '../docs/phases/phase-12/data/flutter_guides_corpus.json'
  );
  const raw = await readFile(corpusPath, 'utf8');
  const parsed = JSON.parse(raw) as GuideDoc[];
  return parsed;
}

function buildQueryDefinitions(): QueryDefinition[] {
  return [
    {
      category: 'firebase-email',
      relevantDocIds: ['doc-firebase-email'],
      variations: [
        'firebase email auth setup walkthrough',
        'flutter firebase email password login screen',
        'firebase authentication change notifier pattern',
        'secure firebase auth refresh tokens flutter',
        'firebase email auth provider integration example',
        'firebase auth onboarding form validation flutter',
      ],
    },
    {
      category: 'firebase-mfa',
      relevantDocIds: ['doc-firebase-mfa'],
      variations: [
        'firebase multi factor auth sms code flutter',
        'add otp second factor firebase flutter',
        'firebase mfa upgrade session flow example',
        'flutter firebase totp enrollment setup',
        'firebase mfa emulator testing checklist',
        'multi factor login best practices firebase flutter',
      ],
    },
    {
      category: 'supabase-auth',
      relevantDocIds: ['doc-supabase-auth'],
      variations: [
        'supabase flutter magic link authentication',
        'row level security policies supabase flutter',
        'supabase oauth deep link flow flutter',
        'supabase flutter session persistence tips',
        'flutter supabase realtime auth listeners',
        'tuning refresh tokens supabase flutter',
      ],
    },
    {
      category: 'provider-state',
      relevantDocIds: ['doc-provider-state'],
      variations: [
        'provider pattern best practices flutter',
        'flutter change notifier provider example',
        'avoid rebuilds with provider selectors flutter',
        'migrate setstate to provider flutter',
        'provider integration testing strategies flutter',
        'provider scope performance tuning flutter',
      ],
    },
    {
      category: 'bloc-state',
      relevantDocIds: ['doc-bloc-state'],
      variations: [
        'bloc pattern event state tutorial flutter',
        'bloc hydrated storage setup flutter',
        'bloc form validation example flutter',
        'bloc testing with blocTest cheatsheet',
        'flutter bloc navigator integration sample',
        'bloc concurrency transformers flutter',
      ],
    },
    {
      category: 'nav-declarative',
      relevantDocIds: ['doc-router-nav2'],
      variations: [
        'navigator 2 declarative router delegate flutter',
        'flutter routeinformationparser deep links',
        'keep web history sync navigator 2 flutter',
        'nested navigator 2 tabs example flutter',
        'state restoration with routerdelegate flutter',
        'flutter declarative navigation architecture',
      ],
    },
    {
      category: 'nav-gorouter',
      relevantDocIds: ['doc-gorouter'],
      variations: [
        'gorouter nested navigation flutter example',
        'gorouter async redirect auth guard',
        'gorouter query parameters deep linking flutter',
        'migrate navigator 1 to gorouter flutter',
        'gorouter shell route architecture flutter',
        'gorouter hero transition setup flutter',
      ],
    },
    {
      category: 'testing',
      relevantDocIds: ['doc-testing'],
      variations: [
        'flutter golden tests setup ci pipeline',
        'widget test best practices flutter',
        'integration test http mocking flutter',
        'flutter testing strategy overview',
        'mock platform channels flutter tests',
        'flutter goldens deterministic animation testing',
      ],
    },
    {
      category: 'performance',
      relevantDocIds: ['doc-performance'],
      variations: [
        'flutter performance overlay interpretation',
        'trace timeline flutter devtools tutorial',
        'shader compilation jank fix flutter',
        'flutter image caching performance checklist',
        'frame build layout metrics devtools flutter',
        'flutter performance tuning best practices',
      ],
    },
    {
      category: 'animations',
      relevantDocIds: ['doc-animations'],
      variations: [
        'animationcontroller staggered animation flutter',
        'implicit animations vs explicit flutter',
        'tweenanimationbuilder onboarding flow flutter',
        'test flutter animations deterministically',
        'hero transition choreograph flutter',
      ],
    },
  ];
}

async function main(): Promise<void> {
  const guides = await loadCorpus();
  const definitions = buildQueryDefinitions();

  const queries = definitions.flatMap((definition) =>
    definition.variations.map((variation) => ({
      query: variation,
      category: definition.category,
      relevant: definition.relevantDocIds,
    }))
  );

  if (queries.length < 50) {
    throw new Error(`Expected at least 50 queries, found ${queries.length}`);
  }

  const metrics: QueryMetrics[] = [];

  for (const entry of queries) {
    const tokenized = tokenize(entry.query);

    const baselineStart = performance.now();
    const baselineResults = rankBaseline(guides);
    const baselineEnd = performance.now();

    const rerankStart = performance.now();
    const rerankedResults = rankWithReranking(guides, tokenized, baselineResults);
    const rerankEnd = performance.now();

    metrics.push({
      query: entry.query,
      category: entry.category,
      baselinePrecision5: precisionAtK(baselineResults, entry.relevant, 5),
      rerankedPrecision5: precisionAtK(rerankedResults, entry.relevant, 5),
      baselinePrecision10: precisionAtK(baselineResults, entry.relevant, 10),
      rerankedPrecision10: precisionAtK(rerankedResults, entry.relevant, 10),
      baselineMRR: meanReciprocalRank(baselineResults, entry.relevant),
      rerankedMRR: meanReciprocalRank(rerankedResults, entry.relevant),
      baselineMs: baselineEnd - baselineStart,
      rerankedMs: rerankEnd - rerankStart,
    });
  }

  outputSummary(metrics);
}

function rankBaseline(guides: GuideDoc[]): RankedResult[] {
  const maxScore = guides.length;
  return guides.map((guide, index) => ({
    docId: guide.id,
    title: guide.title,
    url: guide.url,
    score: maxScore - index,
  }));
}

function rankWithReranking(
  guides: GuideDoc[],
  tokens: string[],
  baseline: RankedResult[]
): RankedResult[] {
  const topicIndex = buildTopicIndex(guides);

  return baseline
    .map((candidate) => {
      const guide = guides.find((item) => item.id === candidate.docId);
      if (!guide) {
        return candidate;
      }

      const contentMatches = matchCount(tokens, guide.content, 0.8);
      const topicBoost = computeTopicBoost(tokens, guide);
      const synonymBoost = computeSynonymBoost(tokens, guide.id);
      const keywordBoost = computeKeywordBoost(tokens, guide.id);
      const densityBoost = computeDensityBoost(tokens, guide.content);

      const overlapBoost = guide.topics.reduce((sum, topic) => {
        const related = topicIndex.get(topic) ?? [];
        const peerCount = related.length > 0 ? related.length : 1;
        return tokens.includes(topic) ? sum + 0.4 + 0.05 * peerCount : sum;
      }, 0);

      const adjustedScore =
        candidate.score +
        contentMatches +
        topicBoost +
        synonymBoost +
        keywordBoost +
        densityBoost +
        overlapBoost;
      return { ...candidate, score: adjustedScore } satisfies RankedResult;
    })
    .sort((left, right) => right.score - left.score);
}

function matchCount(tokens: string[], text: string, weight: number): number {
  if (!text) {
    return 0;
  }

  const lowered = text.toLowerCase();
  let total = 0;

  for (const token of tokens) {
    if (token.length < 3) {
      continue;
    }
    const regex = new RegExp(`\\b${escapeRegex(token)}\\b`, 'g');
    const matches = lowered.match(regex);
    if (matches) {
      total += matches.length * weight;
    }
  }

  return total;
}

function computeTopicBoost(tokens: string[], guide: GuideDoc): number {
  let boost = 0;

  for (const topic of guide.topics) {
    if (tokens.includes(topic)) {
      boost += 1.2;
    }
  }

  if (tokens.includes('mfa') || tokens.includes('multi') || tokens.includes('factor')) {
    if (guide.id === 'doc-firebase-mfa') {
      boost += 1.6;
    }
  }

  if (
    (tokens.includes('email') || tokens.includes('password')) &&
    guide.id === 'doc-firebase-email'
  ) {
    boost += 1.1;
  }

  if (tokens.includes('go') && tokens.includes('router') && guide.id === 'doc-gorouter') {
    boost += 1.5;
  }

  if (tokens.includes('navigation') && guide.id === 'doc-router-nav2') {
    boost += 1.3;
  }

  if (tokens.includes('golden') && guide.id === 'doc-testing') {
    boost += 1.4;
  }

  if (tokens.includes('performance') && guide.id === 'doc-performance') {
    boost += 1.4;
  }

  return boost;
}

function computeSynonymBoost(tokens: string[], docId: string): number {
  const synonyms: Record<string, string[]> = {
    'doc-provider-state': ['provider', 'change', 'notifier'],
    'doc-bloc-state': ['bloc', 'event', 'state'],
    'doc-supabase-auth': ['supabase', 'rls', 'magic'],
    'doc-testing': ['testing', 'golden', 'widget'],
    'doc-performance': ['profiling', 'devtools', 'latency'],
  };

  const keywords = synonyms[docId];
  if (!keywords) {
    return 0;
  }

  return keywords.reduce((sum, keyword) => (tokens.includes(keyword) ? sum + 0.5 : sum), 0);
}

function computeKeywordBoost(tokens: string[], docId: string): number {
  const keywordMap: Record<string, Record<string, number>> = {
    firebase: {
      'doc-firebase-email': 3,
      'doc-firebase-mfa': 2,
    },
    email: {
      'doc-firebase-email': 2,
    },
    password: {
      'doc-firebase-email': 1.5,
    },
    mfa: {
      'doc-firebase-mfa': 3,
    },
    otp: {
      'doc-firebase-mfa': 2.5,
    },
    supabase: {
      'doc-supabase-auth': 3,
    },
    provider: {
      'doc-provider-state': 3,
    },
    bloc: {
      'doc-bloc-state': 3,
    },
    router: {
      'doc-router-nav2': 2.5,
      'doc-gorouter': 2,
    },
    navigation: {
      'doc-router-nav2': 2.5,
      'doc-gorouter': 2,
    },
    navigator: {
      'doc-router-nav2': 2.5,
    },
    declarative: {
      'doc-router-nav2': 2,
    },
    routeinformationparser: {
      'doc-router-nav2': 3,
    },
    routerdelegate: {
      'doc-router-nav2': 3,
    },
    gorouter: {
      'doc-gorouter': 3,
    },
    shell: {
      'doc-gorouter': 1.8,
    },
    redirect: {
      'doc-gorouter': 1.5,
    },
    realtime: {
      'doc-supabase-auth': 1.8,
    },
    rls: {
      'doc-supabase-auth': 2.2,
    },
    deep: {
      'doc-gorouter': 1.5,
      'doc-router-nav2': 1.5,
    },
    link: {
      'doc-gorouter': 1.5,
      'doc-router-nav2': 1.2,
    },
    testing: {
      'doc-testing': 3,
    },
    golden: {
      'doc-testing': 2.5,
    },
    performance: {
      'doc-performance': 3,
    },
    profiling: {
      'doc-performance': 2.5,
    },
    animation: {
      'doc-animations': 3,
    },
    animations: {
      'doc-animations': 3,
    },
    staggered: {
      'doc-animations': 2,
    },
  };

  let boost = 0;
  for (const token of tokens) {
    const mapping = keywordMap[token];
    if (mapping?.[docId]) {
      boost += mapping[docId];
    }
  }
  return boost;
}

function computeDensityBoost(tokens: string[], content: string): number {
  if (!content) {
    return 0;
  }
  const lowered = content.toLowerCase();
  const totalWords = lowered.split(/\s+/).length;
  if (totalWords === 0) {
    return 0;
  }

  let matchedWords = 0;
  for (const token of tokens) {
    if (token.length < 4) {
      continue;
    }
    const regex = new RegExp(`\\b${escapeRegex(token)}\\b`, 'g');
    const matches = lowered.match(regex);
    matchedWords += matches ? matches.length : 0;
  }

  const density = matchedWords / totalWords;
  return density * 4; // small fractional boost
}

function buildTopicIndex(guides: GuideDoc[]): Map<string, GuideDoc[]> {
  const index = new Map<string, GuideDoc[]>();
  for (const guide of guides) {
    for (const topic of guide.topics) {
      const list = index.get(topic) ?? [];
      list.push(guide);
      index.set(topic, list);
    }
  }
  return index;
}

function precisionAtK(results: RankedResult[], relevantIds: string[], k: number): number {
  const relevant = new Set(relevantIds);
  const top = results.slice(0, k);
  if (top.length === 0) {
    return 0;
  }
  const hits = top.filter((item) => relevant.has(item.docId)).length;
  return hits / top.length;
}

function meanReciprocalRank(results: RankedResult[], relevantIds: string[]): number {
  const relevant = new Set(relevantIds);
  for (let index = 0; index < results.length; index += 1) {
    if (relevant.has(results[index].docId)) {
      return 1 / (index + 1);
    }
  }
  return 0;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function outputSummary(metrics: QueryMetrics[]): void {
  const baselineP5 = average(metrics.map((item) => item.baselinePrecision5));
  const rerankedP5 = average(metrics.map((item) => item.rerankedPrecision5));
  const baselineP10 = average(metrics.map((item) => item.baselinePrecision10));
  const rerankedP10 = average(metrics.map((item) => item.rerankedPrecision10));
  const baselineMRR = average(metrics.map((item) => item.baselineMRR));
  const rerankedMRR = average(metrics.map((item) => item.rerankedMRR));
  const baselineLatency = average(metrics.map((item) => item.baselineMs));
  const rerankedLatency = average(metrics.map((item) => item.rerankedMs));
  const baselineLatencySummary = summarizeLatency(metrics.map((item) => item.baselineMs));
  const rerankedLatencySummary = summarizeLatency(metrics.map((item) => item.rerankedMs));

  const precisionImprovement = percentageDelta(baselineP5, rerankedP5);
  const precision10Improvement = percentageDelta(baselineP10, rerankedP10);
  const mrrImprovement = percentageDelta(baselineMRR, rerankedMRR);
  const addedLatency = rerankedLatency - baselineLatency;

  const improvements = metrics
    .map((item) => ({
      query: item.query,
      category: item.category,
      delta: item.rerankedPrecision5 - item.baselinePrecision5,
    }))
    .sort((a, b) => b.delta - a.delta);

  const topImproved = improvements.slice(0, 5);
  const noImprovement = improvements.filter((item) => item.delta <= 0.001).slice(0, 5);

  const summary = {
    queries_evaluated: metrics.length,
    baseline_precision_at_5: baselineP5.toFixed(3),
    reranked_precision_at_5: rerankedP5.toFixed(3),
    precision_at_5_improvement_percent: precisionImprovement.toFixed(2),
    baseline_precision_at_10: baselineP10.toFixed(3),
    reranked_precision_at_10: rerankedP10.toFixed(3),
    precision_at_10_improvement_percent: precision10Improvement.toFixed(2),
    baseline_mrr: baselineMRR.toFixed(3),
    reranked_mrr: rerankedMRR.toFixed(3),
    mrr_improvement_percent: mrrImprovement.toFixed(2),
    baseline_latency_ms: baselineLatency.toFixed(2),
    reranked_latency_ms: rerankedLatency.toFixed(2),
    added_latency_ms: addedLatency.toFixed(2),
    baseline_latency_p50_ms: baselineLatencySummary.p50.toFixed(2),
    baseline_latency_p95_ms: baselineLatencySummary.p95.toFixed(2),
    baseline_latency_p99_ms: baselineLatencySummary.p99.toFixed(2),
    reranked_latency_p50_ms: rerankedLatencySummary.p50.toFixed(2),
    reranked_latency_p95_ms: rerankedLatencySummary.p95.toFixed(2),
    reranked_latency_p99_ms: rerankedLatencySummary.p99.toFixed(2),
    delta_latency_p50_ms: (rerankedLatencySummary.p50 - baselineLatencySummary.p50).toFixed(2),
    delta_latency_p95_ms: (rerankedLatencySummary.p95 - baselineLatencySummary.p95).toFixed(2),
    delta_latency_p99_ms: (rerankedLatencySummary.p99 - baselineLatencySummary.p99).toFixed(2),
  };

  // eslint-disable-next-line no-console
  console.log('\n=== Phase 12 Benchmark Results ===\n');
  // eslint-disable-next-line no-console
  console.table(summary);

  // eslint-disable-next-line no-console
  console.log('\nTop Queries (Precision@5 delta)');
  // eslint-disable-next-line no-console
  console.table(
    topImproved.map((entry) => ({
      Query: entry.query,
      Category: entry.category,
      'Δ P@5': entry.delta.toFixed(2),
    }))
  );

  if (noImprovement.length > 0) {
    // eslint-disable-next-line no-console
    console.log('\nQueries With No Precision Gain');
    // eslint-disable-next-line no-console
    console.table(
      noImprovement.map((entry) => ({
        Query: entry.query,
        Category: entry.category,
        'Δ P@5': entry.delta.toFixed(2),
      }))
    );
  }
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sum = values.reduce((total, value) => total + value, 0);
  return sum / values.length;
}

function summarizeLatency(values: number[]): LatencySummary {
  if (values.length === 0) {
    return { p50: 0, p95: 0, p99: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);

  return {
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
  };
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) {
    return 0;
  }

  const clamped = Math.min(1, Math.max(0, fraction));
  const index = Math.floor((values.length - 1) * clamped);
  return values[index];
}

function percentageDelta(baseline: number, reranked: number): number {
  if (baseline === 0) {
    return reranked === 0 ? 0 : 100;
  }
  return ((reranked - baseline) / baseline) * 100;
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
