import { getPool } from '@synthesis/db';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { CostTracker } from '../services/cost-tracker.js';
import { getCostTracker } from '../services/cost-tracker.js';

export async function registerCostRoutes(
  app: FastifyInstance,
  tracker?: CostTracker
): Promise<void> {
  const costTracker = tracker ?? getCostTracker(getPool());

  // Get current month summary
  app.get('/api/costs/summary', async (_request, _reply) => {
    const monthlySpend = await costTracker.getMonthlySpend();
    const breakdown = await costTracker.getCostBreakdown();
    const rawBudget = process.env.MONTHLY_BUDGET_USD;
    const fallbackBudget = 10;
    let budget = fallbackBudget;
    let percentageUsed = 0;

    const normalized = rawBudget?.trim();
    const lowerNormalized = normalized?.toLowerCase();
    const hasConfiguredBudget =
      normalized &&
      normalized !== '' &&
      lowerNormalized !== 'undefined' &&
      lowerNormalized !== 'null';
    const parsedBudget = hasConfiguredBudget ? Number.parseFloat(normalized) : Number.NaN;

    if (Number.isFinite(parsedBudget) && parsedBudget > 0) {
      budget = parsedBudget;
      percentageUsed = (monthlySpend / budget) * 100;
    } else {
      if (hasConfiguredBudget) {
        app.log?.warn?.(
          { rawBudget },
          'Invalid MONTHLY_BUDGET_USD env value. Falling back to default budget of 10 USD.'
        );
      }
      budget = fallbackBudget;
      percentageUsed = 0;
    }

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
    const alerts = await costTracker.getRecentAlerts(10);
    for (const alert of alerts as Array<{ triggered_at: string | Date }>) {
      if (alert.triggered_at instanceof Date) {
        alert.triggered_at = alert.triggered_at.toISOString();
      }
    }

    return { alerts };
  });
}

export const costRoutes: FastifyPluginAsync = async (app) => {
  await registerCostRoutes(app);
};
