import type { Pool, QueryResult } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoist mocks so they can be configured per test while keeping other exports intact.
const hybridSearchMock = vi.hoisted(() => vi.fn());
const vectorSearchMock = vi.hoisted(() => vi.fn());
const rerankResultsMock = vi.hoisted(() => vi.fn());
const embedBatchMock = vi.hoisted(() => vi.fn());
const detectContradictionsMock = vi.hoisted(() => vi.fn());

vi.mock('../hybrid.js', () => ({
  hybridSearch: hybridSearchMock,
}));

vi.mock('../vector.js', () => ({
  searchCollection: vectorSearchMock,
}));

vi.mock('../reranker.js', async () => {
  const actual = await vi.importActual<typeof import('../reranker.js')>('../reranker.js');
  return {
    ...actual,
    rerankResults: rerankResultsMock,
  };
});

vi.mock('../../pipeline/embed.js', async () => {
  const actual =
    await vi.importActual<typeof import('../../pipeline/embed.js')>('../../pipeline/embed.js');
  return {
    ...actual,
    embedBatch: embedBatchMock,
  };
});

vi.mock('../contradiction-detection.js', async () => {
  const actual = await vi.importActual<typeof import('../contradiction-detection.js')>(
    '../contradiction-detection.js'
  );
  return {
    ...actual,
    detectContradictions: detectContradictionsMock,
  };
});

describe('Phase 12 integration scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of [
      'ENABLE_TRUST_SCORING',
      'ENABLE_CONTRADICTION_DETECTION',
      'ENABLE_COST_ALERTS',
      'MONTHLY_BUDGET_USD',
      'SEARCH_MODE',
      'EMBEDDING_PROVIDER_OVERRIDE',
      'RERANKER_PROVIDER_OVERRIDE',
      'DISABLE_CONTRADICTION_DETECTION',
    ]) {
      Reflect.deleteProperty(process.env, key);
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs the smart search pipeline with reranking and returns reranked metadata', async () => {
    const { smartSearch } = await import('../search.js');

    const db = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    } as unknown as Pool;

    const baselineResults = [
      {
        id: 'a',
        docId: 'doc-a',
        docTitle: 'Baseline A',
        text: 'First baseline result',
        similarity: 0.91,
        fusedScore: 0.91,
        metadata: { source_quality: 'official' },
      },
      {
        id: 'b',
        docId: 'doc-b',
        docTitle: 'Baseline B',
        text: 'Second baseline result',
        similarity: 0.82,
        fusedScore: 0.82,
        metadata: { source_quality: 'community' },
      },
    ];

    hybridSearchMock.mockResolvedValue({
      results: baselineResults,
      elapsedMs: 120,
      vectorCount: 15,
      bm25Count: 15,
    });

    rerankResultsMock.mockImplementation(async (_query, candidates) => {
      return candidates
        .map((item, index) => ({
          ...item,
          rerankScore: item.id === 'b' ? 0.96 : 0.7 - index * 0.1,
          rerankProvider: 'cohere',
          originalSimilarity: item.similarity,
        }))
        .sort((left, right) => right.rerankScore - left.rerankScore);
    });

    const response = await smartSearch(db, {
      query: 'flutter auth best practice',
      collectionId: 'flutter-docs',
      rerank: true,
      topK: 2,
    });

    expect(hybridSearchMock).toHaveBeenCalled();
    expect(rerankResultsMock).toHaveBeenCalledWith(
      'flutter auth best practice',
      expect.arrayContaining([
        expect.objectContaining({ id: 'a' }),
        expect.objectContaining({ id: 'b' }),
      ]),
      expect.objectContaining({ topK: 2 })
    );

    expect(response.metadata.reranked).toBe(true);
    expect(response.results[0]).toMatchObject({
      id: 'b',
      docId: 'doc-b',
      rerankProvider: 'cohere',
      similarity: 0.96,
      rerankScore: 0.96,
    });
    expect(response.results[1]).toMatchObject({
      id: 'a',
      docId: 'doc-a',
      rerankProvider: 'cohere',
      similarity: 0.7,
    });
  });

  it('returns baseline hybrid results unchanged when reranking flag is disabled', async () => {
    const { smartSearch } = await import('../search.js');

    const db = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    } as unknown as Pool;

    process.env.SEARCH_MODE = 'hybrid';

    const baselineResults = [
      {
        id: 'a',
        docId: 'doc-a',
        docTitle: 'Baseline A',
        text: 'First baseline result',
        similarity: 0.9,
        fusedScore: 0.9,
        metadata: {},
      },
      {
        id: 'b',
        docId: 'doc-b',
        docTitle: 'Baseline B',
        text: 'Second baseline result',
        similarity: 0.8,
        fusedScore: 0.8,
        metadata: {},
      },
    ];

    hybridSearchMock.mockResolvedValue({
      results: baselineResults,
      elapsedMs: 110,
      vectorCount: 10,
      bm25Count: 10,
    });

    const response = await smartSearch(db, {
      query: 'flutter state management',
      collectionId: 'flutter-docs',
      rerank: false,
      topK: 2,
    });

    expect(rerankResultsMock).not.toHaveBeenCalled();
    expect(response.metadata.reranked).toBe(false);
    expect(response.results.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('clusters synthesis approaches and merges contradictions into the response', async () => {
    const { synthesizeResults } = await import('../synthesis.js');

    embedBatchMock.mockResolvedValue([
      buildEmbedding([0.9, 0.1]),
      buildEmbedding([0.88, 0.12]),
      buildEmbedding([0.87, 0.11]),
      buildEmbedding([0.1, 0.9]),
      buildEmbedding([0.12, 0.88]),
      buildEmbedding([0.11, 0.87]),
    ]);

    detectContradictionsMock.mockImplementation(async (approaches) => {
      const firebase = approaches.find((item) => item.method.includes('Firebase'));
      const supabase = approaches.find((item) => item.method.includes('Supabase'));
      if (!firebase || !supabase) {
        return [];
      }

      return [
        {
          topic: 'Authentication',
          source_a: firebase.sources[0],
          source_b: supabase.sources[0],
          severity: 'high',
          difference: 'Conflicting guidance between Firebase and Supabase guides.',
          recommendation: 'Prefer the most recent official documentation.',
          confidence: 0.92,
        },
      ];
    });

    const results = createSearchResults();

    const response = await synthesizeResults('Flutter auth comparison', results, {
      maxResults: 15,
    });

    expect(embedBatchMock).toHaveBeenCalled();
    expect(detectContradictionsMock).toHaveBeenCalled();
    expect(response.approaches).toHaveLength(2);
    expect(response.conflicts).toHaveLength(1);
    expect(response.metadata.total_sources).toBe(results.length);

    const [firstApproach, secondApproach] = response.approaches;
    expect(firstApproach.sources.length).toBeGreaterThan(0);
    expect(secondApproach.sources.length).toBeGreaterThan(0);
    expect(response.recommended?.method).toContain('Firebase');
  });

  it('records cost usage and triggers budget alerts with fallback overrides', async () => {
    const inserts: Array<{ sql: string; params: unknown[] }> = [];
    let monthlySpend = 0;

    const db = {
      async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
        if (sql.includes('INSERT INTO api_usage')) {
          inserts.push({ sql, params });
          return { rows: [], rowCount: 1 } as unknown as QueryResult;
        }

        if (sql.includes('SELECT COALESCE(SUM(cost_usd)')) {
          return { rows: [{ total: monthlySpend }], rowCount: 1 } as unknown as QueryResult;
        }

        if (sql.includes('SELECT id FROM budget_alerts')) {
          return { rows: [], rowCount: 0 } as unknown as QueryResult;
        }

        if (sql.includes('INSERT INTO budget_alerts')) {
          inserts.push({ sql, params });
          return { rows: [], rowCount: 1 } as unknown as QueryResult;
        }

        return { rows: [], rowCount: 0 } as unknown as QueryResult;
      },
    } as unknown as Pool;

    const { CostTracker } = await import('../cost-tracker.js');

    process.env.ENABLE_COST_ALERTS = 'true';
    process.env.MONTHLY_BUDGET_USD = '10';

    const tracker = new CostTracker(db);

    await tracker.track({
      provider: 'openai',
      operation: 'embedding',
      tokens: 2000,
      model: 'text-embedding-3-large',
      collectionId: 'flutter-docs',
      metadata: { query: 'firebase auth setup' },
    });

    const usageInsert = inserts.find((entry) => entry.sql.includes('api_usage'));
    expect(usageInsert).toBeDefined();
    expect(usageInsert?.params[0]).toBe('openai');
    expect(typeof usageInsert?.params[3]).toBe('number');
    expect(usageInsert?.params[4]).toBe('flutter-docs');
    expect(usageInsert?.params[6]).toBeDefined();

    monthlySpend = 8.5;
    await tracker.checkBudget();

    const warningAlert = inserts.find(
      (entry) => entry.sql.includes('budget_alerts') && entry.params[0] === 'warning'
    );
    expect(warningAlert).toBeDefined();

    monthlySpend = 10.25;
    await tracker.checkBudget();

    const limitAlert = inserts.find(
      (entry) => entry.sql.includes('budget_alerts') && entry.params[0] === 'limit_reached'
    );
    expect(limitAlert).toBeDefined();
    expect(process.env.EMBEDDING_PROVIDER_OVERRIDE).toBe('ollama');
    expect(process.env.RERANKER_PROVIDER_OVERRIDE).toBe('bge');
    expect(process.env.DISABLE_CONTRADICTION_DETECTION).toBe('true');
  });
});

function createSearchResults() {
  const now = new Date().toISOString();
  return [
    buildResult('firebase-a', 'Firebase Authentication Overview', 'firebase.com/auth', {
      topic: 'Firebase Authentication',
      approach: 'Firebase Auth',
      source_quality: 'official',
      last_verified: now,
    }),
    buildResult('firebase-b', 'Firebase Email Sign-In', 'firebase.com/email', {
      topic: 'Firebase Authentication',
      approach: 'Firebase Auth',
      source_quality: 'official',
      last_verified: now,
    }),
    buildResult('firebase-c', 'Firebase Multi-factor', 'firebase.com/mfa', {
      topic: 'Firebase Authentication',
      approach: 'Firebase Auth',
      source_quality: 'verified',
      last_verified: now,
    }),
    buildResult('supabase-a', 'Supabase Auth Overview', 'supabase.com/auth', {
      topic: 'Supabase Authentication',
      approach: 'Supabase Auth',
      source_quality: 'community',
      last_verified: now,
    }),
    buildResult('supabase-b', 'Supabase Row Level Security', 'supabase.com/rls', {
      topic: 'Supabase Authentication',
      approach: 'Supabase Auth',
      source_quality: 'community',
      last_verified: now,
    }),
    buildResult('supabase-c', 'Supabase Magic Links', 'supabase.com/magic', {
      topic: 'Supabase Authentication',
      approach: 'Supabase Auth',
      source_quality: 'verified',
      last_verified: now,
    }),
  ];
}

function buildResult(docId: string, title: string, url: string, metadata: Record<string, unknown>) {
  return {
    id: docId,
    docId,
    docTitle: title,
    sourceUrl: `https://${url}`,
    text: `${title} guidance for Flutter apps`,
    similarity: 0.9,
    fusedScore: 0.9,
    metadata,
  };
}

function buildEmbedding(vector: number[]) {
  return {
    embedding: vector,
    provider: 'test',
    model: 'test',
    dimensions: vector.length,
    usedFallback: false,
  };
}
