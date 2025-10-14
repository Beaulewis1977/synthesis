import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CostTracker } from '../../services/cost-tracker.js';
import { registerCostRoutes } from '../costs.js';

describe('Cost Routes - Edge Cases', () => {
  let app: FastifyInstance;
  let mockCostTracker: CostTracker;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };

    app = Fastify();

    // Mock cost tracker
    mockCostTracker = {
      getMonthlySpend: vi.fn().mockResolvedValue(5.25),
      getCostBreakdown: vi.fn().mockResolvedValue([
        { provider: 'cohere', operation: 'rerank', total_cost: 2.5, request_count: 250 },
        { provider: 'openai', operation: 'embed', total_cost: 2.75, request_count: 1000 },
      ]),
      getRecentAlerts: vi.fn().mockResolvedValue([]),
    } as unknown as CostTracker;

    // Register routes with mocked tracker
    await registerCostRoutes(app, mockCostTracker);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('GET /api/costs/summary - Budget Validation', () => {
    it('uses default budget of 10 when MONTHLY_BUDGET_USD is not set', async () => {
      process.env.MONTHLY_BUDGET_USD = undefined;

      const response = await app.inject({
        method: 'GET',
        url: '/api/costs/summary',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.budget).toBe(10);
      expect(body.current_spend).toBe(5.25);
      expect(body.percentage_used).toBe(0);
      expect(body.remaining).toBe(4.75);
    });

    it('uses default budget when MONTHLY_BUDGET_USD is invalid string', async () => {
      process.env.MONTHLY_BUDGET_USD = 'not-a-number';

      const response = await app.inject({
        method: 'GET',
        url: '/api/costs/summary',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.budget).toBe(10);
      expect(body.percentage_used).toBe(0);
    });

    it('uses default budget when MONTHLY_BUDGET_USD is zero', async () => {
      process.env.MONTHLY_BUDGET_USD = '0';

      const response = await app.inject({
        method: 'GET',
        url: '/api/costs/summary',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.budget).toBe(10);
      expect(body.percentage_used).toBe(0);
    });

    it('uses default budget when MONTHLY_BUDGET_USD is negative', async () => {
      process.env.MONTHLY_BUDGET_USD = '-5';

      const response = await app.inject({
        method: 'GET',
        url: '/api/costs/summary',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.budget).toBe(10);
      expect(body.percentage_used).toBe(0);
    });

    it('handles valid budget correctly', async () => {
      process.env.MONTHLY_BUDGET_USD = '100';

      const response = await app.inject({
        method: 'GET',
        url: '/api/costs/summary',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.budget).toBe(100);
      expect(body.percentage_used).toBe(5.25);
      expect(body.remaining).toBe(94.75);
    });

    it('prevents division by zero with percentage_used', async () => {
      process.env.MONTHLY_BUDGET_USD = '0';

      const response = await app.inject({
        method: 'GET',
        url: '/api/costs/summary',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.percentage_used).toBe(0);
      expect(Number.isFinite(body.percentage_used)).toBe(true);
    });
  });

  describe('GET /api/costs/history - Date Validation', () => {
    it('accepts valid start_date and end_date', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/costs/history?start_date=2025-10-01&end_date=2025-10-14',
      });

      expect(response.statusCode).toBe(200);
      expect(mockCostTracker.getCostBreakdown).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date)
      );
    });

    it('returns 400 for invalid start_date', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/costs/history?start_date=not-a-date',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid start_date');
    });

    it('returns 400 for invalid end_date', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/costs/history?end_date=invalid-date',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid end_date');
    });

    it('returns 400 for malformed date strings', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/costs/history?start_date=2025-13-45',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid start_date');
    });

    it('works without date parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/costs/history',
      });

      expect(response.statusCode).toBe(200);
      expect(mockCostTracker.getCostBreakdown).toHaveBeenCalledWith(undefined, undefined);
    });

    it('works with only start_date', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/costs/history?start_date=2025-10-01',
      });

      expect(response.statusCode).toBe(200);
      expect(mockCostTracker.getCostBreakdown).toHaveBeenCalledWith(expect.any(Date), undefined);
    });

    it('works with only end_date', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/costs/history?end_date=2025-10-14',
      });

      expect(response.statusCode).toBe(200);
      expect(mockCostTracker.getCostBreakdown).toHaveBeenCalledWith(undefined, expect.any(Date));
    });
  });

  describe('GET /api/costs/alerts', () => {
    it('returns alerts successfully', async () => {
      const mockAlerts = [
        {
          id: 1,
          alert_type: 'warning',
          threshold_usd: 10,
          current_spend_usd: 8.5,
          period: 'monthly',
          triggered_at: new Date(),
        },
      ];

      (mockCostTracker.getRecentAlerts as ReturnType<typeof vi.fn>).mockResolvedValue(mockAlerts);

      const response = await app.inject({
        method: 'GET',
        url: '/api/costs/alerts',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.alerts).toEqual(mockAlerts);
    });
  });
});
