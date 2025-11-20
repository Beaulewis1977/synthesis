import type { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CostTracker, getCostTracker } from '../cost-tracker.js';

describe('CostTracker', () => {
  let mockQuery: ReturnType<typeof vi.fn>;
  let mockDb: Pool;
  let tracker: CostTracker;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockQuery = vi.fn();
    mockDb = { query: mockQuery } as unknown as Pool;
    tracker = new CostTracker(mockDb);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('track', () => {
    it('inserts usage record for OpenAI embeddings', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // track insert
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '0.5' }] }); // getMonthlySpend

      await tracker.track({
        provider: 'openai',
        operation: 'embed',
        tokens: 1000,
        model: 'text-embedding-3-large',
        collectionId: 'test-collection',
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO api_usage'),
        expect.arrayContaining(['openai', 'embed', 1000, 0.00013])
      );
    });

    it('inserts usage record for Voyage embeddings', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // track insert
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '0.5' }] }); // getMonthlySpend

      await tracker.track({
        provider: 'voyage',
        operation: 'embed',
        tokens: 1000,
        model: 'voyage-code-2',
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO api_usage'),
        expect.arrayContaining(['voyage', 'embed', 1000, 0.00012])
      );
    });

    it('inserts usage record for Cohere reranking (per-request pricing)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // track insert
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '0.5' }] }); // getMonthlySpend

      await tracker.track({
        provider: 'cohere',
        operation: 'rerank',
        tokens: 1, // Cohere charges per request
        model: 'rerank-english-v3.0',
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO api_usage'),
        expect.arrayContaining(['cohere', 'rerank', 1, 0.001])
      );
    });

    it('inserts usage record for Anthropic chat', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // track insert
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '0.5' }] }); // getMonthlySpend

      await tracker.track({
        provider: 'anthropic',
        operation: 'chat',
        tokens: 1000,
        model: 'claude-3-haiku-20240307',
        metadata: { input_tokens: 600, output_tokens: 400 },
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO api_usage'),
        expect.arrayContaining(['anthropic', 'chat', 1000, 0.00025])
      );
    });

    it('handles unknown provider gracefully', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // track insert
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '0.5' }] }); // getMonthlySpend

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await tracker.track({
        provider: 'unknown-provider',
        operation: 'test',
        tokens: 100,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown provider for cost tracking')
      );

      // Should still insert with 0 cost
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO api_usage'),
        expect.arrayContaining(['unknown-provider', 'test', 100, 0])
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getMonthlySpend', () => {
    it('returns current month total spend', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ total: '2.45' }],
      });

      const spend = await tracker.getMonthlySpend();

      expect(spend).toBe(2.45);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("date_trunc('month', NOW())"));
    });

    it('returns 0 when no usage this month', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ total: 0 }],
      });

      const spend = await tracker.getMonthlySpend();

      expect(spend).toBe(0);
    });
  });

  describe('getDailySpend', () => {
    it('returns daily spend for specified date', async () => {
      const testDate = new Date('2025-10-14');
      mockQuery.mockResolvedValueOnce({
        rows: [{ total: '0.15' }],
      });

      const spend = await tracker.getDailySpend(testDate);

      expect(spend).toBe(0.15);
      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [testDate]);
    });

    it('returns daily spend for today when no date specified', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ total: '0.25' }],
      });

      const spend = await tracker.getDailySpend();

      expect(spend).toBe(0.25);
    });
  });

  describe('getCostBreakdown', () => {
    it('returns breakdown by provider and operation', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            provider: 'voyage',
            operation: 'embed',
            request_count: '1500',
            total_tokens: '450000',
            total_cost: '1.80',
            avg_cost_per_request: '0.0012',
          },
          {
            provider: 'cohere',
            operation: 'rerank',
            request_count: '250',
            total_tokens: '250',
            total_cost: '0.50',
            avg_cost_per_request: '0.002',
          },
        ],
      });

      const breakdown = await tracker.getCostBreakdown();

      expect(breakdown).toHaveLength(2);
      expect(breakdown[0]).toEqual({
        provider: 'voyage',
        operation: 'embed',
        request_count: 1500,
        total_tokens: 450000,
        total_cost: 1.8,
        avg_cost_per_request: 0.0012,
      });
      expect(breakdown[1]).toEqual({
        provider: 'cohere',
        operation: 'rerank',
        request_count: 250,
        total_tokens: 250,
        total_cost: 0.5,
        avg_cost_per_request: 0.002,
      });
    });

    it('accepts custom date range', async () => {
      const start = new Date('2025-10-01');
      const end = new Date('2025-10-14');

      mockQuery.mockResolvedValueOnce({ rows: [] });

      await tracker.getCostBreakdown(start, end);

      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [start, end]);
    });
  });

  describe('checkBudget', () => {
    it('sends warning alert at 80% budget', async () => {
      process.env.MONTHLY_BUDGET_USD = '10';

      // getMonthlySpend
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '8.5' }] });
      // Check for recent alerts
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Insert alert
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await tracker.checkBudget();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('80% of monthly budget'));

      // Check the 3rd call (after getMonthlySpend and check for recent alerts)
      const insertCall = mockQuery.mock.calls[2];
      expect(insertCall[0]).toContain('INSERT INTO budget_alerts');
      expect(insertCall[1]).toEqual(['warning', 10, 8.5]); // 'monthly' is hardcoded in SQL

      consoleSpy.mockRestore();
    });

    it('sends limit alert at 100% budget and enables fallback', async () => {
      process.env.MONTHLY_BUDGET_USD = '10';

      // getMonthlySpend
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '10.5' }] });
      // Check for recent alerts
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Insert alert
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await tracker.checkBudget();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Budget Limit Reached'));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Budget limit reached - enabling fallback mode')
      );

      // Check fallback environment variables are set
      expect(process.env.EMBEDDING_PROVIDER_OVERRIDE).toBe('ollama');
      expect(process.env.RERANKER_PROVIDER_OVERRIDE).toBe('bge');
      expect(process.env.DISABLE_CONTRADICTION_DETECTION).toBe('true');

      consoleSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('does not send duplicate alerts within 24 hours', async () => {
      process.env.MONTHLY_BUDGET_USD = '10';

      // getMonthlySpend
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '8.5' }] });
      // Check for recent alerts - found one
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, alert_type: 'warning' }],
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await tracker.checkBudget();

      // Should not insert another alert
      expect(mockQuery).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO budget_alerts'),
        expect.anything()
      );

      consoleSpy.mockRestore();
    });

    it('does nothing when spending is below 80%', async () => {
      process.env.MONTHLY_BUDGET_USD = '10';

      // getMonthlySpend
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '5.0' }] });

      await tracker.checkBudget();

      // Only getMonthlySpend should be called
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCostTracker singleton', () => {
    it('returns same instance on multiple calls', () => {
      const instance1 = getCostTracker(mockDb);
      const instance2 = getCostTracker(mockDb);

      expect(instance1).toBe(instance2);
    });
  });

  describe('cost calculations', () => {
    it('calculates OpenAI costs correctly', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // track insert
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '0' }] }); // getMonthlySpend

      await tracker.track({
        provider: 'openai',
        operation: 'embed',
        tokens: 10000,
        model: 'text-embedding-3-large',
      });

      // $0.00013 per 1K tokens * 10 = $0.0013
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['openai', 'embed', 10000, 0.0013])
      );
    });

    it('calculates Voyage costs correctly', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // track insert
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '0' }] }); // getMonthlySpend

      await tracker.track({
        provider: 'voyage',
        operation: 'embed',
        tokens: 5000,
        model: 'voyage-code-2',
      });

      // $0.00012 per 1K tokens * 5 = $0.0006
      const firstCall = mockQuery.mock.calls[0];
      expect(firstCall[0]).toContain('INSERT INTO api_usage');
      expect(firstCall[1][0]).toBe('voyage');
      expect(firstCall[1][1]).toBe('embed');
      expect(firstCall[1][2]).toBe(5000);
      expect(firstCall[1][3]).toBeCloseTo(0.0006, 6);
    });

    it('calculates Cohere costs correctly (fixed per request)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // track insert
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '0' }] }); // getMonthlySpend

      await tracker.track({
        provider: 'cohere',
        operation: 'rerank',
        tokens: 1,
        model: 'rerank-english-v3.0',
      });

      // $0.001 per request (fixed)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['cohere', 'rerank', 1, 0.001])
      );
    });

    it('calculates Anthropic costs correctly', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // track insert
      mockQuery.mockResolvedValueOnce({ rows: [{ total: '0' }] }); // getMonthlySpend

      await tracker.track({
        provider: 'anthropic',
        operation: 'chat',
        tokens: 4000,
        model: 'claude-3-haiku-20240307',
      });

      // $0.00025 per 1K tokens * 4 = $0.001
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['anthropic', 'chat', 4000, 0.001])
      );
    });
  });
});
