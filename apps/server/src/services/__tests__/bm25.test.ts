import type { Pool } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bm25Search } from '../bm25.js';

describe('bm25Search', () => {
  afterEach(() => {
    process.env.FTS_LANGUAGE = undefined;
  });

  it('executes BM25 query and normalizes scores', async () => {
    const mockQuery = vi.fn().mockResolvedValue({
      rows: [
        {
          chunk_id: 1,
          text: 'StatefulWidget lifecycle overview',
          metadata: { heading: 'Lifecycle' },
          doc_id: 'doc-1',
          doc_title: 'Flutter Widgets',
          source_url: 'https://flutter.dev/widgets',
          rank: 0.8,
        },
        {
          chunk_id: 2,
          text: 'StatefulWidget build method notes',
          metadata: null,
          doc_id: 'doc-2',
          doc_title: 'Community Tips',
          source_url: null,
          rank: 0.4,
        },
      ],
    });

    const db = { query: mockQuery } as unknown as Pick<Pool, 'query'>;

    const results = await bm25Search(db as Pool, {
      query: 'StatefulWidget lifecycle',
      collectionId: 'collection-1',
    });

    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [
      'english',
      'StatefulWidget:* & lifecycle:*',
      'collection-1',
      30,
    ]);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      chunkId: 1,
      rank: 1,
      score: 1,
      docId: 'doc-1',
      docTitle: 'Flutter Widgets',
      sourceUrl: 'https://flutter.dev/widgets',
      metadata: { heading: 'Lifecycle' },
    });
    expect(results[1]).toMatchObject({
      chunkId: 2,
      rank: 2,
      score: 0.5,
      docId: 'doc-2',
      docTitle: 'Community Tips',
      sourceUrl: null,
      metadata: null,
    });
  });

  it('throws for empty query', async () => {
    const db = { query: vi.fn() } as unknown as Pick<Pool, 'query'>;

    await expect(
      bm25Search(db as Pool, { query: '   ', collectionId: 'collection-1' })
    ).rejects.toThrow(/must not be empty/i);
  });

  it('throws when sanitized query has no terms', async () => {
    const db = { query: vi.fn() } as unknown as Pick<Pool, 'query'>;

    await expect(
      bm25Search(db as Pool, { query: '!!!', collectionId: 'collection-1' })
    ).rejects.toThrow(/alphanumeric/i);
  });

  it('throws when topK is not positive', async () => {
    const db = { query: vi.fn() } as unknown as Pick<Pool, 'query'>;

    await expect(
      bm25Search(db as Pool, { query: 'flutter', collectionId: 'collection-1', topK: 0 })
    ).rejects.toThrow(/topK must be a positive number/);
  });

  it('uses FTS_LANGUAGE environment fallback when language omitted', async () => {
    process.env.FTS_LANGUAGE = 'simple';
    const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
    const db = { query: mockQuery } as unknown as Pick<Pool, 'query'>;

    await bm25Search(db as Pool, { query: 'flutter', collectionId: 'collection-1' });

    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [
      'simple',
      'flutter:*',
      'collection-1',
      30,
    ]);
  });

  it('falls back to default language when FTS_LANGUAGE is empty', async () => {
    process.env.FTS_LANGUAGE = '   ';
    const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
    const db = { query: mockQuery } as unknown as Pick<Pool, 'query'>;

    await bm25Search(db as Pool, { query: 'flutter', collectionId: 'collection-1' });

    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [
      'english',
      'flutter:*',
      'collection-1',
      30,
    ]);
  });
});
