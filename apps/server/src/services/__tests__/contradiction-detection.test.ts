import { beforeEach, describe, expect, it, vi } from 'vitest';

const createMock = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn(() => ({
      messages: {
        create: createMock,
      },
    })),
  };
});

describe('detectContradictions', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.ENABLE_CONTRADICTION_DETECTION = undefined;
    process.env.ANTHROPIC_API_KEY = undefined;
    process.env.CONTRADICTION_MIN_SIMILARITY = undefined;
    process.env.CONTRADICTION_MAX_SIMILARITY = undefined;
  });

  it('returns empty list when feature flag disabled', async () => {
    process.env.ENABLE_CONTRADICTION_DETECTION = 'false';

    const { detectContradictions } = await import('../contradiction-detection.js');
    const conflicts = await detectContradictions([
      {
        method: 'A',
        sources: [{ title: 'Doc A', statement: 'Use Provider', quality: 'official' }],
      },
      {
        method: 'B',
        sources: [{ title: 'Doc B', statement: 'Use Riverpod', quality: 'community' }],
      },
    ]);

    expect(conflicts).toHaveLength(0);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('detects contradiction when Anthropic returns positive result', async () => {
    process.env.ENABLE_CONTRADICTION_DETECTION = 'true';
    process.env.ANTHROPIC_API_KEY = 'test-key';

    createMock.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            contradiction: true,
            topic: 'state management',
            difference: 'Approach conflicts with new recommendation',
            severity: 'high',
            recommendation: 'Follow the newer source.',
            confidence: 0.92,
          }),
        },
      ],
    });

    const { detectContradictions } = await import('../contradiction-detection.js');
    const conflicts = await detectContradictions([
      {
        method: 'Provider',
        summary: 'Use Provider for state management',
        sources: [
          {
            title: 'Old Guide',
            statement: 'Provider is the recommended solution.',
            quality: 'community',
            date: '2022-01-01',
          },
        ],
      },
      {
        method: 'Riverpod',
        summary: 'Riverpod replaces Provider for testability',
        sources: [
          {
            title: 'New Guide',
            statement: 'Riverpod is the modern approach.',
            quality: 'official',
            date: '2024-01-01',
          },
        ],
      },
    ]);

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      topic: 'state management',
      severity: 'high',
      recommendation: 'Follow the newer source.',
    });
  });

  it('skips low-overlap approaches without calling LLM', async () => {
    process.env.ENABLE_CONTRADICTION_DETECTION = 'true';
    process.env.ANTHROPIC_API_KEY = 'test-key';

    const { detectContradictions } = await import('../contradiction-detection.js');
    const conflicts = await detectContradictions([
      {
        method: 'Firebase Auth',
        summary: 'Firebase authentication setup with providers and email/password',
        sources: [{ title: 'Firebase', statement: 'Use Firebase', quality: 'official' }],
      },
      {
        method: 'Supabase Auth',
        summary: 'Supabase row level security and database triggers for access control',
        sources: [{ title: 'Supabase', statement: 'Use Supabase', quality: 'community' }],
      },
    ]);

    expect(conflicts).toHaveLength(0);
    expect(createMock).not.toHaveBeenCalled();
  });
});
