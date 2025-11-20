import type { Pool, QueryResult } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchCollection } from '../vector.js';

// Mock the embed function
const embedTextToArrayMock = vi.hoisted(() => vi.fn());

vi.mock('../../pipeline/embed.js', () => ({
  embedTextToArray: embedTextToArrayMock,
}));

describe('vectorSearch with tech_stack filtering', () => {
  let db: Pick<Pool, 'query'>;

  beforeEach(() => {
    db = {
      query: vi.fn(),
    } as unknown as Pick<Pool, 'query'>;

    // Mock embedding function to return a simple vector
    embedTextToArrayMock.mockResolvedValue([0.1, 0.2, 0.3]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should filter results by tech_stack when provided', async () => {
    const mockRows = [
      {
        id: 1,
        text: 'PostgreSQL query example',
        metadata: { tech_stack: ['postgres', 'sql'] },
        doc_id: 'doc-1',
        doc_title: 'Database Guide',
        source_url: 'https://example.com/db',
        similarity: 0.8,
      },
    ];

    (db.query as vi.Mock).mockResolvedValue({
      rows: mockRows,
    } as QueryResult);

    const results = await searchCollection(db as Pool, {
      query: 'database connection',
      collectionId: '11111111-1111-4111-8111-111111111111',
      topK: 10,
      techStack: ['postgres'],
    });

    // Verify query was called with tech_stack filter
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('metadata->' + "'tech_stack' ?|"),
      expect.arrayContaining([
        expect.any(String), // vector literal
        '11111111-1111-4111-8111-111111111111', // collectionId
        expect.any(Number), // minSimilarity
        10, // topK
        ['postgres'], // techStack filter
      ])
    );

    // Verify results are returned
    expect(results.results.length).toBe(1);
    expect(results.results[0].text).toBe('PostgreSQL query example');
    expect(results.results[0].snippet).toBe('PostgreSQL query example');
    expect(results.results[0].metadata?.tech_stack).toEqual(['postgres', 'sql']);
  });

  it('should filter by multiple tech_stack values (OR logic)', async () => {
    const mockRows = [
      {
        id: 1,
        text: 'PostgreSQL content',
        metadata: { tech_stack: ['postgres', 'supabase'] },
        doc_id: 'doc-1',
        doc_title: 'DB Doc',
        source_url: null,
        similarity: 0.9,
      },
      {
        id: 2,
        text: 'Redis content',
        metadata: { tech_stack: ['redis'] },
        doc_id: 'doc-2',
        doc_title: 'Cache Doc',
        source_url: null,
        similarity: 0.7,
      },
    ];

    (db.query as vi.Mock).mockResolvedValue({
      rows: mockRows,
    } as QueryResult);

    const results = await searchCollection(db as Pool, {
      query: 'cache or database',
      collectionId: '11111111-1111-4111-8111-111111111111',
      topK: 10,
      techStack: ['postgres', 'redis'],
    });

    // Verify query was called with both tech stacks
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('metadata->' + "'tech_stack' ?|"),
      expect.arrayContaining([
        expect.any(String),
        '11111111-1111-4111-8111-111111111111',
        expect.any(Number),
        10,
        ['postgres', 'redis'],
      ])
    );

    // Verify results include both postgres and redis chunks
    expect(results.results.length).toBe(2);
    expect(results.results[0].snippet.length).toBeGreaterThan(0);
  });

  it('should return all results when tech_stack is undefined', async () => {
    const mockRows = [
      {
        id: 1,
        text: 'Some content',
        metadata: {},
        doc_id: 'doc-1',
        doc_title: 'Doc',
        source_url: null,
        similarity: 0.8,
      },
    ];

    (db.query as vi.Mock).mockResolvedValue({
      rows: mockRows,
    } as QueryResult);

    const results = await searchCollection(db as Pool, {
      query: 'test query',
      collectionId: '11111111-1111-4111-8111-111111111111',
      topK: 10,
      // techStack is undefined
    });

    // Verify query was called with NULL for tech_stack filter
    expect(db.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([
        expect.any(String),
        '11111111-1111-4111-8111-111111111111',
        expect.any(Number),
        10,
        null, // techStack should be null when undefined
      ])
    );

    // Results should not be filtered
    expect(results.results.length).toBe(1);
  });

  it('should return all results when tech_stack is empty array (no filter)', async () => {
    const mockRows = [
      {
        id: 1,
        text: 'Untagged content',
        metadata: {},
        doc_id: 'doc-1',
        doc_title: 'Doc',
        source_url: null,
        similarity: 0.8,
      },
    ];

    (db.query as vi.Mock).mockResolvedValue({
      rows: mockRows,
    } as QueryResult);

    const results = await searchCollection(db as Pool, {
      query: 'test query',
      collectionId: '11111111-1111-4111-8111-111111111111',
      topK: 10,
      techStack: [], // Empty array should mean no filter
    });

    // Verify query was called with NULL for tech_stack filter
    expect(db.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([
        expect.any(String),
        '11111111-1111-4111-8111-111111111111',
        expect.any(Number),
        10,
        null, // Empty array should become null (no filter)
      ])
    );

    // Results should not be filtered
    expect(results.results.length).toBe(1);
  });

  it('should work correctly with minSimilarity and tech_stack together', async () => {
    const mockRows = [
      {
        id: 1,
        text: 'High similarity postgres content',
        metadata: { tech_stack: ['postgres'] },
        doc_id: 'doc-1',
        doc_title: 'Doc',
        source_url: null,
        similarity: 0.9,
      },
    ];

    (db.query as vi.Mock).mockResolvedValue({
      rows: mockRows,
    } as QueryResult);

    const results = await searchCollection(db as Pool, {
      query: 'database',
      collectionId: '11111111-1111-4111-8111-111111111111',
      topK: 5,
      minSimilarity: 0.7,
      techStack: ['postgres'],
    });

    // Verify both filters are applied
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('metadata->' + "'tech_stack' ?|"),
      [
        expect.any(String), // vector
        '11111111-1111-4111-8111-111111111111', // collectionId
        0.7, // minSimilarity
        5, // topK
        ['postgres'], // techStack
      ]
    );

    expect(results.results.length).toBe(1);
    expect(results.results[0].similarity).toBe(0.9);
  });
});
