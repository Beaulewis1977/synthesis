import type { Pool, QueryResult } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchCollection } from '../search.js';

vi.mock('../../pipeline/embed.js', () => ({
  embedText: vi.fn(),
}));

const { embedText } = await import('../../pipeline/embed.js');

describe('searchCollection', () => {
  let db: Pick<Pool, 'query'>;
  let performanceSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    db = {
      query: vi.fn(),
    } as unknown as Pick<Pool, 'query'>;

    performanceSpy = vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(160);
  });

  afterEach(() => {
    vi.clearAllMocks();
    performanceSpy.mockRestore();
  });

  it('embeds the query and returns formatted results', async () => {
    (embedText as vi.MockedFunction<typeof embedText>).mockResolvedValue([0.1, 0.2, 0.3]);

    const dbRows = [
      {
        id: 42,
        text: 'Example chunk text',
        metadata: { page: 3, heading: 'Overview' },
        doc_id: 'doc-123',
        doc_title: 'Sample Document',
        source_url: 'https://example.com/doc',
        similarity: 0.87,
      },
    ];

    type SearchRow = (typeof dbRows)[number];
    const queryResult = { rows: dbRows } as unknown as QueryResult<SearchRow>;

    (db.query as vi.MockedFunction<Pool['query']>).mockResolvedValue(queryResult);

    const result = await searchCollection(db as Pool, {
      query: 'Test query',
      collectionId: 'collection-1',
      topK: 7,
      minSimilarity: 0.4,
    });

    expect(embedText).toHaveBeenCalledWith('Test query');
    expect(db.query).toHaveBeenCalledWith(expect.any(String), [
      '[0.1,0.2,0.3]',
      'collection-1',
      0.4,
      7,
    ]);
    expect(result.totalResults).toBe(1);
    expect(result.searchTimeMs).toBe(60);
    expect(result.results[0]).toMatchObject({
      id: 42,
      text: 'Example chunk text',
      similarity: 0.87,
      docId: 'doc-123',
      docTitle: 'Sample Document',
      sourceUrl: 'https://example.com/doc',
      citation: {
        title: 'Sample Document',
        page: 3,
        section: 'Overview',
      },
    });
  });

  it('throws when the query is empty after trimming', async () => {
    await expect(
      searchCollection(db as Pool, { query: '   ', collectionId: 'collection', topK: 5 })
    ).rejects.toThrow(/must not be empty/i);
  });

  it('throws when topK is not positive', async () => {
    await expect(
      searchCollection(db as Pool, { query: 'hello', collectionId: 'collection', topK: 0 })
    ).rejects.toThrow(/topK must be a positive number/);
  });
});
