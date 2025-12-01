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
        null, // featureTags
        null, // platform
        null, // usageTier
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
        null, // featureTags
        null, // platform
        null, // usageTier
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
        null, // featureTags
        null, // platform
        null, // usageTier
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
        null, // featureTags
        null, // platform
        null, // usageTier
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
      expect.arrayContaining([
        expect.any(String), // vector
        '11111111-1111-4111-8111-111111111111', // collectionId
        0.7, // minSimilarity
        5, // topK
        ['postgres'], // techStack
        null, // featureTags
        null, // platform
        null, // usageTier
      ])
    );

    expect(results.results.length).toBe(1);
    expect(results.results[0].similarity).toBe(0.9);
  });
});

// GPT Phase 1: Feature-aware filtering tests
describe('vectorSearch with feature-aware filtering', () => {
  let db: Pick<Pool, 'query'>;

  beforeEach(() => {
    db = {
      query: vi.fn(),
    } as unknown as Pick<Pool, 'query'>;

    embedTextToArrayMock.mockResolvedValue([0.1, 0.2, 0.3]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should filter results by feature_tags when provided', async () => {
    const mockRows = [
      {
        id: 1,
        text: 'Supabase auth example',
        metadata: { feature_tags: ['auth', 'social_auth'] },
        doc_id: 'doc-1',
        doc_title: 'Auth Guide',
        source_url: 'https://example.com/auth',
        similarity: 0.85,
      },
    ];

    (db.query as vi.Mock).mockResolvedValue({
      rows: mockRows,
    } as QueryResult);

    const results = await searchCollection(db as Pool, {
      query: 'authentication',
      collectionId: '11111111-1111-4111-8111-111111111111',
      topK: 10,
      featureTags: ['auth'],
    });

    // Verify query was called with feature_tags filter
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("metadata->'feature_tags' ?|"),
      expect.arrayContaining([
        expect.any(String), // vector literal
        '11111111-1111-4111-8111-111111111111', // collectionId
        expect.any(Number), // minSimilarity
        10, // topK
        null, // techStack
        ['auth'], // featureTags
        null, // platform
        null, // usageTier
      ])
    );

    expect(results.results.length).toBe(1);
    expect(results.results[0].metadata?.feature_tags).toEqual(['auth', 'social_auth']);
  });

  it('should filter by multiple feature_tags (OR logic)', async () => {
    const mockRows = [
      {
        id: 1,
        text: 'Auth content',
        metadata: { feature_tags: ['auth'] },
        doc_id: 'doc-1',
        doc_title: 'Auth Doc',
        source_url: null,
        similarity: 0.9,
      },
      {
        id: 2,
        text: 'Billing content',
        metadata: { feature_tags: ['billing', 'payments'] },
        doc_id: 'doc-2',
        doc_title: 'Billing Doc',
        source_url: null,
        similarity: 0.8,
      },
    ];

    (db.query as vi.Mock).mockResolvedValue({
      rows: mockRows,
    } as QueryResult);

    const results = await searchCollection(db as Pool, {
      query: 'user features',
      collectionId: '11111111-1111-4111-8111-111111111111',
      topK: 10,
      featureTags: ['auth', 'billing'],
    });

    // Verify query was called with both feature tags
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("metadata->'feature_tags' ?|"),
      expect.arrayContaining([['auth', 'billing']])
    );

    expect(results.results.length).toBe(2);
  });

  it('should filter by platform', async () => {
    const mockRows = [
      {
        id: 1,
        text: 'Flutter mobile widget',
        metadata: { platform: 'mobile' },
        doc_id: 'doc-1',
        doc_title: 'Mobile Doc',
        source_url: null,
        similarity: 0.88,
      },
    ];

    (db.query as vi.Mock).mockResolvedValue({
      rows: mockRows,
    } as QueryResult);

    const results = await searchCollection(db as Pool, {
      query: 'flutter widget',
      collectionId: '11111111-1111-4111-8111-111111111111',
      topK: 10,
      platform: 'mobile',
    });

    // Verify query was called with platform filter
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("metadata->>'platform' = $7"),
      expect.arrayContaining([
        expect.any(String), // vector literal
        '11111111-1111-4111-8111-111111111111', // collectionId
        expect.any(Number), // minSimilarity
        10, // topK
        null, // techStack
        null, // featureTags
        'mobile', // platform
        null, // usageTier
      ])
    );

    expect(results.results.length).toBe(1);
    expect(results.results[0].metadata?.platform).toBe('mobile');
  });

  it('should filter by usage_tier', async () => {
    const mockRows = [
      {
        id: 1,
        text: 'Official Flutter docs',
        metadata: { usage_tier: 'official' },
        doc_id: 'doc-1',
        doc_title: 'Official Doc',
        source_url: 'https://docs.flutter.dev',
        similarity: 0.92,
      },
    ];

    (db.query as vi.Mock).mockResolvedValue({
      rows: mockRows,
    } as QueryResult);

    const results = await searchCollection(db as Pool, {
      query: 'flutter documentation',
      collectionId: '11111111-1111-4111-8111-111111111111',
      topK: 10,
      usageTier: 'official',
    });

    // Verify query was called with usage_tier filter
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("metadata->>'usage_tier' = $8"),
      expect.arrayContaining([
        expect.any(String), // vector literal
        '11111111-1111-4111-8111-111111111111', // collectionId
        expect.any(Number), // minSimilarity
        10, // topK
        null, // techStack
        null, // featureTags
        null, // platform
        'official', // usageTier
      ])
    );

    expect(results.results.length).toBe(1);
    expect(results.results[0].metadata?.usage_tier).toBe('official');
  });

  it('should apply combined filters (feature_tags + platform + usage_tier)', async () => {
    const mockRows = [
      {
        id: 1,
        text: 'Official Flutter auth recipe',
        metadata: {
          feature_tags: ['auth'],
          platform: 'mobile',
          usage_tier: 'recipe',
        },
        doc_id: 'doc-1',
        doc_title: 'Auth Recipe',
        source_url: null,
        similarity: 0.95,
      },
    ];

    (db.query as vi.Mock).mockResolvedValue({
      rows: mockRows,
    } as QueryResult);

    const results = await searchCollection(db as Pool, {
      query: 'flutter authentication',
      collectionId: '11111111-1111-4111-8111-111111111111',
      topK: 5,
      featureTags: ['auth'],
      platform: 'mobile',
      usageTier: 'recipe',
    });

    // Verify all filters are applied
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("metadata->'feature_tags' ?|"),
      expect.arrayContaining([
        expect.any(String), // vector literal
        '11111111-1111-4111-8111-111111111111', // collectionId
        expect.any(Number), // minSimilarity
        5, // topK
        null, // techStack
        ['auth'], // featureTags
        'mobile', // platform
        'recipe', // usageTier
      ])
    );

    expect(results.results.length).toBe(1);
  });

  it('should not filter when feature filters are undefined or empty', async () => {
    const mockRows = [
      {
        id: 1,
        text: 'Any content',
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
      featureTags: [], // Empty array should mean no filter
      platform: undefined,
      usageTier: undefined,
    });

    // Verify query was called with NULL for all feature filters
    expect(db.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([
        expect.any(String), // vector literal
        '11111111-1111-4111-8111-111111111111', // collectionId
        expect.any(Number), // minSimilarity
        10, // topK
        null, // techStack
        null, // featureTags (empty array becomes null)
        null, // platform
        null, // usageTier
      ])
    );

    expect(results.results.length).toBe(1);
  });
});
