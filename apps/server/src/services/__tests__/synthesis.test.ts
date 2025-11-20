import { beforeEach, describe, expect, it, vi } from 'vitest';

const embedBatchMock = vi.fn();
const detectContradictionsMock = vi.fn();

vi.mock('../../pipeline/embed.js', () => ({
  embedBatch: embedBatchMock,
}));

vi.mock('../contradiction-detection.js', () => ({
  detectContradictions: detectContradictionsMock,
}));

describe('synthesizeResults', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    embedBatchMock.mockResolvedValue([]);
    detectContradictionsMock.mockResolvedValue([]);
  });

  it('clusters results into approaches and summarizes them', async () => {
    const embeddings = [
      [0.95, 0.05, 0],
      [0.05, 0.95, 0],
      [0.9, 0.1, 0],
      [0.08, 0.92, 0],
      [0.88, 0.12, 0],
      [0.1, 0.9, 0],
    ].map((embedding) => ({
      embedding,
      provider: 'openai',
      model: 'test',
      dimensions: 3,
      usedFallback: false,
    }));

    embedBatchMock.mockResolvedValue(embeddings);

    const { synthesizeResults } = await import('../synthesis.js');

    const firebase = [
      createResult(1, 'Firebase Auth Guide', 'Use Firebase Authentication for mobile apps', {
        source_quality: 'official',
        last_verified: '2024-02-01',
      }),
      createResult(3, 'Firebase Auth Best Practices', 'Firebase handles tokens securely', {
        source_quality: 'official',
        last_verified: '2023-12-01',
      }),
      createResult(5, 'Community Firebase Tips', 'Community advice for Firebase auth', {
        source_quality: 'community',
        last_verified: '2023-06-01',
      }),
    ];

    const supabase = [
      createResult(2, 'Supabase Auth Guide', 'Supabase uses Row Level Security policies', {
        source_quality: 'community',
        last_verified: '2023-11-15',
      }),
      createResult(4, 'Supabase Auth Best Practices', 'Configure Supabase OAuth providers', {
        source_quality: 'community',
        last_verified: '2022-08-10',
      }),
      createResult(6, 'Supabase Auth Example', 'Supabase auth code samples', {
        source_quality: 'verified',
        last_verified: '2023-09-01',
      }),
    ];

    const results = [firebase[0], supabase[0], firebase[1], supabase[1], firebase[2], supabase[2]];

    const synthesis = await synthesizeResults('auth strategies', results);

    expect(embedBatchMock).toHaveBeenCalledTimes(1);
    expect(detectContradictionsMock).toHaveBeenCalledTimes(1);
    expect(synthesis.approaches.length).toBeGreaterThanOrEqual(2);
    expect(synthesis.metadata.total_sources).toBe(6);
    expect(synthesis.recommended).not.toBeNull();
    expect(synthesis.approaches[0].summary.length).toBeGreaterThan(0);
  });

  it('penalizes approaches involved in conflicts', async () => {
    const embeddings = [
      [0.95, 0.05, 0],
      [0.05, 0.95, 0],
      [0.9, 0.1, 0],
      [0.08, 0.92, 0],
      [0.88, 0.12, 0],
      [0.1, 0.9, 0],
    ].map((embedding) => ({
      embedding,
      provider: 'openai',
      model: 'test',
      dimensions: 3,
      usedFallback: false,
    }));

    embedBatchMock.mockResolvedValue(embeddings);

    detectContradictionsMock.mockResolvedValue([
      {
        topic: 'auth',
        source_a: {
          title: 'Firebase Auth Guide',
          statement: 'Use Firebase',
          quality: 'official',
          url: 'https://firebase.dev',
        },
        source_b: {
          title: 'Supabase Auth Guide',
          statement: 'Use Supabase',
          quality: 'community',
          url: 'https://supabase.dev',
        },
        severity: 'high',
        difference: 'Conflicting recommendations',
        recommendation: 'Follow latest official docs',
        confidence: 0.9,
      },
    ]);

    const { synthesizeResults } = await import('../synthesis.js');

    const firebaseResults = [
      createResult(1, 'Firebase Auth Guide', 'Firebase official approach', {
        source_quality: 'official',
        last_verified: '2024-01-01',
      }),
      createResult(3, 'Firebase Tips', 'Firebase tutorial', {
        source_quality: 'official',
        last_verified: '2023-10-01',
      }),
      createResult(5, 'Firebase Blog', 'Community firebase post', {
        source_quality: 'community',
        last_verified: '2022-10-01',
      }),
    ];

    const supabaseResults = [
      createResult(2, 'Supabase Auth Guide', 'Supabase RLS approach', {
        source_quality: 'official',
        last_verified: '2024-02-01',
      }),
      createResult(4, 'Supabase Tips', 'Supabase tutorial', {
        source_quality: 'official',
        last_verified: '2023-12-01',
      }),
      createResult(6, 'Supabase Blog', 'Community supabase post', {
        source_quality: 'verified',
        last_verified: '2023-11-01',
      }),
    ];

    const synthesis = await synthesizeResults('auth strategies', [
      firebaseResults[0],
      supabaseResults[0],
      firebaseResults[1],
      supabaseResults[1],
      firebaseResults[2],
      supabaseResults[2],
    ]);

    expect(detectContradictionsMock).toHaveBeenCalledTimes(1);
    expect(synthesis.approaches.length).toBeGreaterThanOrEqual(2);
    const recommendedTitles = synthesis.recommended?.sources.map((source) => source.docTitle);
    expect(recommendedTitles).toContain('Supabase Auth Guide');
  });

  it('returns empty synthesis when no results provided', async () => {
    const { synthesizeResults } = await import('../synthesis.js');
    const synthesis = await synthesizeResults('nothing', []);
    expect(synthesis.approaches).toHaveLength(0);
    expect(synthesis.conflicts).toHaveLength(0);
    expect(synthesis.recommended).toBeNull();
  });
});

function createResult(id: number, title: string, text: string, metadata: Record<string, unknown>) {
  return {
    id,
    text,
    similarity: 0.9,
    docId: `doc-${id}`,
    docTitle: title,
    sourceUrl: `https://example.com/${id}`,
    metadata,
    citation: { title },
    vectorScore: 0.8,
    bm25Score: 0.6,
    fusedScore: 0.85,
    source: 'both',
  };
}
