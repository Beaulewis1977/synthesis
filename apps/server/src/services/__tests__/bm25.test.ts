import type { Pool } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bm25Search, bm25SearchWithMetadata, buildSmartTsQuery, detectQueryType } from '../bm25.js';

describe('detectQueryType', () => {
  it('detects phrase queries (wrapped in double quotes)', () => {
    expect(detectQueryType('"exact phrase"')).toBe('phrase');
    expect(detectQueryType('"const and final"')).toBe('phrase');
    expect(detectQueryType('"Flutter widgets"')).toBe('phrase');
  });

  it('detects code_symbol queries with camelCase', () => {
    expect(detectQueryType('setState')).toBe('code_symbol');
    expect(detectQueryType('buildContext')).toBe('code_symbol');
    expect(detectQueryType('handleClick')).toBe('code_symbol');
  });

  it('detects code_symbol queries with PascalCase', () => {
    expect(detectQueryType('StatefulWidget')).toBe('code_symbol');
    expect(detectQueryType('BuildContext')).toBe('code_symbol');
    expect(detectQueryType('MaterialApp')).toBe('code_symbol');
  });

  it('detects code_symbol queries with snake_case', () => {
    expect(detectQueryType('my_function')).toBe('code_symbol');
    expect(detectQueryType('get_user_data')).toBe('code_symbol');
    expect(detectQueryType('_private_var')).toBe('code_symbol');
  });

  it('detects code_symbol queries with dot notation', () => {
    expect(detectQueryType('Navigator.push')).toBe('code_symbol');
    expect(detectQueryType('context.read')).toBe('code_symbol');
    expect(detectQueryType('widget.build')).toBe('code_symbol');
  });

  it('detects code_symbol queries with C++ operators', () => {
    expect(detectQueryType('std::vector')).toBe('code_symbol');
    expect(detectQueryType('ptr->member')).toBe('code_symbol');
  });

  it('detects code_symbol queries with function call syntax', () => {
    expect(detectQueryType('build()')).toBe('code_symbol');
    expect(detectQueryType('initState()')).toBe('code_symbol');
  });

  it('detects natural_language queries for questions', () => {
    expect(detectQueryType('What is the difference between stateless and stateful widgets?')).toBe(
      'natural_language'
    );
    expect(detectQueryType('How do you manage state in Flutter?')).toBe('natural_language');
    expect(detectQueryType('Explain the widget lifecycle')).toBe('natural_language');
  });

  it('detects natural_language for simple words', () => {
    expect(detectQueryType('flutter')).toBe('natural_language');
    expect(detectQueryType('widgets')).toBe('natural_language');
    expect(detectQueryType('state management')).toBe('natural_language');
  });

  it('handles edge cases', () => {
    // Mixed but has code pattern
    expect(detectQueryType('Navigator.push between screens')).toBe('code_symbol');
    // All lowercase with spaces
    expect(detectQueryType('const and final differences')).toBe('natural_language');
    // Trimmed whitespace
    expect(detectQueryType('  StatefulWidget  ')).toBe('code_symbol');
  });
});

describe('buildSmartTsQuery', () => {
  it('builds phraseto_tsquery for phrase queries', () => {
    const result = buildSmartTsQuery('"exact phrase"', 'phrase');
    expect(result.tsFunction).toBe('phraseto_tsquery');
    expect(result.tsQuery).toBe('exact phrase');
  });

  it('builds to_tsquery with prefix matching for code_symbol queries', () => {
    const result = buildSmartTsQuery('StatefulWidget lifecycle', 'code_symbol');
    expect(result.tsFunction).toBe('to_tsquery');
    expect(result.tsQuery).toBe('StatefulWidget:* & lifecycle:*');
  });

  it('builds websearch_to_tsquery for natural_language queries with OR logic', () => {
    const result = buildSmartTsQuery('How do you manage state?', 'natural_language');
    expect(result.tsFunction).toBe('websearch_to_tsquery');
    // Stop words are filtered and remaining words joined with OR for broader matching
    expect(result.tsQuery).toBe('manage or state');
  });

  it('sanitizes phrase queries', () => {
    const result = buildSmartTsQuery('"test & query"', 'phrase');
    expect(result.tsQuery).toBe('test query');
  });

  it('throws for empty phrase content', () => {
    expect(() => buildSmartTsQuery('"!!!"', 'phrase')).toThrow(/alphanumeric/i);
  });

  it('throws for empty code_symbol content', () => {
    expect(() => buildSmartTsQuery('!!!', 'code_symbol')).toThrow(/alphanumeric/i);
  });

  it('throws for empty natural_language content', () => {
    expect(() => buildSmartTsQuery('!!!', 'natural_language')).toThrow(/alphanumeric/i);
  });
});

describe('bm25Search', () => {
  afterEach(() => {
    Reflect.deleteProperty(process.env, 'FTS_LANGUAGE');
  });

  it('uses to_tsquery with prefix matching for code_symbol queries (PascalCase)', async () => {
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

    // Should use to_tsquery with prefix matching for PascalCase (code_symbol)
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [
      'english',
      'StatefulWidget:* & lifecycle:*',
      'collection-1',
      30,
      null, // techStack parameter
    ]);

    // Verify the SQL contains to_tsquery
    const sqlArg = mockQuery.mock.calls[0][0] as string;
    expect(sqlArg).toContain('to_tsquery');

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

  it('uses websearch_to_tsquery for natural language queries with OR logic', async () => {
    const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
    const db = { query: mockQuery } as unknown as Pick<Pool, 'query'>;

    await bm25Search(db as Pool, {
      query: 'How do you manage state in Flutter?',
      collectionId: 'collection-1',
    });

    // Should use websearch_to_tsquery with OR logic (stop words filtered)
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [
      'english',
      'manage or state or Flutter', // Stop words removed, OR between terms
      'collection-1',
      30,
      null,
    ]);

    // Verify the SQL contains websearch_to_tsquery
    const sqlArg = mockQuery.mock.calls[0][0] as string;
    expect(sqlArg).toContain('websearch_to_tsquery');
  });

  it('uses phraseto_tsquery for phrase queries', async () => {
    const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
    const db = { query: mockQuery } as unknown as Pick<Pool, 'query'>;

    await bm25Search(db as Pool, {
      query: '"const and final"',
      collectionId: 'collection-1',
    });

    // Should use phraseto_tsquery for phrase queries
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [
      'english',
      'const and final',
      'collection-1',
      30,
      null,
    ]);

    // Verify the SQL contains phraseto_tsquery
    const sqlArg = mockQuery.mock.calls[0][0] as string;
    expect(sqlArg).toContain('phraseto_tsquery');
  });

  it('uses to_tsquery for dot notation (code_symbol)', async () => {
    const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
    const db = { query: mockQuery } as unknown as Pick<Pool, 'query'>;

    await bm25Search(db as Pool, {
      query: 'Navigator.push',
      collectionId: 'collection-1',
    });

    // Should use to_tsquery with prefix matching for dot notation
    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [
      'english',
      'Navigator.push:*',
      'collection-1',
      30,
      null,
    ]);

    const sqlArg = mockQuery.mock.calls[0][0] as string;
    expect(sqlArg).toContain('to_tsquery');
    expect(sqlArg).not.toContain('websearch_to_tsquery');
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

    // Use a natural language query to test language fallback
    await bm25Search(db as Pool, { query: 'flutter widgets', collectionId: 'collection-1' });

    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [
      'simple',
      'flutter or widgets', // OR logic applied
      'collection-1',
      30,
      null, // techStack parameter
    ]);
  });

  it('falls back to default language when FTS_LANGUAGE is empty', async () => {
    process.env.FTS_LANGUAGE = '   ';
    const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
    const db = { query: mockQuery } as unknown as Pick<Pool, 'query'>;

    // Use a natural language query
    await bm25Search(db as Pool, { query: 'flutter widgets', collectionId: 'collection-1' });

    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [
      'english',
      'flutter or widgets', // OR logic applied
      'collection-1',
      30,
      null, // techStack parameter
    ]);
  });
});

describe('bm25SearchWithMetadata', () => {
  afterEach(() => {
    Reflect.deleteProperty(process.env, 'FTS_LANGUAGE');
  });

  it('returns metadata with query type and timing', async () => {
    const mockQuery = vi.fn().mockResolvedValue({
      rows: [
        {
          chunk_id: 1,
          text: 'Test result',
          metadata: null,
          doc_id: 'doc-1',
          doc_title: 'Test Doc',
          source_url: null,
          rank: 0.5,
        },
      ],
    });

    const db = { query: mockQuery } as unknown as Pick<Pool, 'query'>;

    const response = await bm25SearchWithMetadata(db as Pool, {
      query: 'How do you implement navigation?',
      collectionId: 'collection-1',
    });

    expect(response.metadata.queryType).toBe('natural_language');
    expect(response.metadata.tsFunction).toBe('websearch_to_tsquery');
    expect(response.metadata.resultCount).toBe(1);
    expect(typeof response.metadata.elapsedMs).toBe('number');
    expect(response.results).toHaveLength(1);
  });

  it('returns correct metadata for code_symbol queries', async () => {
    const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
    const db = { query: mockQuery } as unknown as Pick<Pool, 'query'>;

    const response = await bm25SearchWithMetadata(db as Pool, {
      query: 'StatefulWidget',
      collectionId: 'collection-1',
    });

    expect(response.metadata.queryType).toBe('code_symbol');
    expect(response.metadata.tsFunction).toBe('to_tsquery');
    expect(response.metadata.resultCount).toBe(0);
  });

  it('returns correct metadata for phrase queries', async () => {
    const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
    const db = { query: mockQuery } as unknown as Pick<Pool, 'query'>;

    const response = await bm25SearchWithMetadata(db as Pool, {
      query: '"state management"',
      collectionId: 'collection-1',
    });

    expect(response.metadata.queryType).toBe('phrase');
    expect(response.metadata.tsFunction).toBe('phraseto_tsquery');
    expect(response.metadata.resultCount).toBe(0);
  });
});
