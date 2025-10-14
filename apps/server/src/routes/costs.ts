import { getPool } from '@synthesis/db';
import type { FastifyPluginAsync } from 'fastify';
import { getCostTracker } from '../services/cost-tracker.js';

export const costRoutes: FastifyPluginAsync = async (app) => {
  const db = getPool();
  const costTracker = getCostTracker(db);

  // Get current month summary
  app.get('/api/costs/summary', async (_request, _reply) => {
    const monthlySpend = await costTracker.getMonthlySpend();
    const breakdown = await costTracker.getCostBreakdown();
    const rawBudget = process.env.MONTHLY_BUDGET_USD;
    let budget = Number.parseFloat(rawBudget ?? '');

    if (!Number.isFinite(budget) || budget <= 0) {
      app.log?.warn?.(
        { rawBudget },
        'Invalid MONTHLY_BUDGET_USD env value. Falling back to default budget of 10 USD.'
      );
      budget = 10;
    }

    const percentageUsed = budget === 0 ? 0 : (monthlySpend / budget) * 100;

    return {
      current_spend: monthlySpend,
      budget: budget,
      percentage_used: percentageUsed,
      remaining: Math.max(0, budget - monthlySpend),
      breakdown: breakdown,
    };
  });

  // Get detailed usage history
  app.get<{
    Querystring: {
      start_date?: string;
      end_date?: string;
    };
  }>('/api/costs/history', async (request, reply) => {
    const { start_date, end_date } = request.query;

    let startDate: Date | undefined;
    if (start_date) {
      const parsedStart = new Date(start_date);
      if (!Number.isFinite(parsedStart.getTime())) {
        return reply.code(400).send({ error: 'Invalid start_date' });
      }
      startDate = parsedStart;
    }

    let endDate: Date | undefined;
    if (end_date) {
      const parsedEnd = new Date(end_date);
      if (!Number.isFinite(parsedEnd.getTime())) {
        return reply.code(400).send({ error: 'Invalid end_date' });
      }
      endDate = parsedEnd;
    }

    const history = await costTracker.getCostBreakdown(startDate, endDate);

    return { history };
  });

  // Get recent alerts
  app.get('/api/costs/alerts', async (_request, _reply) => {
    const result = await db.query(`
      SELECT * FROM budget_alerts
      ORDER BY triggered_at DESC
      LIMIT 10
    `);

    return { alerts: result.rows };
  });
};
