import type { Pool } from 'pg';

export interface CostBreakdown {
  provider: string;
  operation: string;
  request_count: number;
  total_tokens: number;
  total_cost: number;
  avg_cost_per_request: number;
}

export interface TrackUsageParams {
  provider: string;
  operation: string;
  tokens: number;
  model?: string;
  collectionId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export class CostTracker {
  private db: Pool;

  // Pricing per provider (updated 2025-10)
  private pricing: Record<string, Record<string, number>> = {
    openai: {
      'text-embedding-3-large': 0.00013, // per 1K tokens
      'gpt-4': 0.03, // per 1K input tokens
    },
    voyage: {
      'voyage-code-2': 0.00012, // per 1K tokens
    },
    cohere: {
      'rerank-english-v3.0': 0.001, // per request
      'rerank-v3.5': 0.001, // per request
    },
    anthropic: {
      'claude-3-haiku': 0.00025, // per 1K input tokens
      'claude-3-haiku-20240307': 0.00025, // per 1K input tokens (alias)
    },
  };

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Track API usage
   */
  async track(usage: TrackUsageParams): Promise<void> {
    const cost = this.calculateCost(usage);

    // Insert usage record
    await this.db.query(
      `INSERT INTO api_usage 
       (provider, operation, tokens_used, cost_usd, collection_id, user_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        usage.provider,
        usage.operation,
        usage.tokens,
        cost,
        usage.collectionId || null,
        usage.userId || null,
        JSON.stringify(usage.metadata || {}),
      ]
    );

    // Check budget (async, non-blocking)
    if (isCostAlertsEnabled()) {
      this.checkBudget().catch((err) => console.error('Budget check failed:', err));
    }
  }

  /**
   * Calculate cost based on provider pricing
   */
  private calculateCost(usage: TrackUsageParams): number {
    const providerPricing = this.pricing[usage.provider];

    if (!providerPricing) {
      console.warn(`Unknown provider for cost tracking: ${usage.provider}`);
      return 0;
    }

    // Special case: Cohere rerank is per-request
    if (usage.provider === 'cohere' && usage.operation === 'rerank') {
      const modelKey = usage.model && providerPricing[usage.model] ? usage.model : 'rerank-v3.5';
      return providerPricing[modelKey] || 0;
    }

    // Default: per 1K tokens
    const model =
      usage.model && providerPricing[usage.model] ? usage.model : Object.keys(providerPricing)[0];
    const rate = providerPricing[model];

    if (!rate) {
      console.warn(`Unknown model for cost tracking: ${model} for ${usage.provider}`);
      return 0;
    }

    return (usage.tokens / 1000) * rate;
  }

  /**
   * Check if budget limit reached
   */
  async checkBudget(): Promise<void> {
    const budget = Number.parseFloat(process.env.MONTHLY_BUDGET_USD || '10');
    const monthlySpend = await this.getMonthlySpend();

    // Warning at 80%
    if (monthlySpend > budget * 0.8 && monthlySpend < budget) {
      await this.sendAlert('warning', budget, monthlySpend);
    }

    // Limit reached
    if (monthlySpend >= budget) {
      await this.sendAlert('limit_reached', budget, monthlySpend);
      await this.enableFallbackMode();
    }
  }

  /**
   * Get current month spending
   */
  async getMonthlySpend(): Promise<number> {
    const result = await this.db.query(`
      SELECT COALESCE(SUM(cost_usd), 0) as total
      FROM api_usage
      WHERE created_at >= date_trunc('month', NOW())
    `);

    return Number.parseFloat(result.rows[0].total);
  }

  /**
   * Get daily spending
   */
  async getDailySpend(date?: Date): Promise<number> {
    const targetDate = date || new Date();

    const result = await this.db.query(
      `
      SELECT COALESCE(SUM(cost_usd), 0) as total
      FROM api_usage
      WHERE created_at >= date_trunc('day', $1::timestamptz)
        AND created_at < date_trunc('day', $1::timestamptz) + INTERVAL '1 day'
    `,
      [targetDate]
    );

    return Number.parseFloat(result.rows[0].total);
  }

  /**
   * Get cost breakdown by provider
   */
  async getCostBreakdown(startDate?: Date, endDate?: Date): Promise<CostBreakdown[]> {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const result = await this.db.query(
      `
      SELECT
        provider,
        operation,
        COUNT(*) as request_count,
        SUM(tokens_used) as total_tokens,
        SUM(cost_usd) as total_cost,
        AVG(cost_usd) as avg_cost_per_request
      FROM api_usage
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY provider, operation
      ORDER BY total_cost DESC
    `,
      [start, end]
    );

    return result.rows.map((row) => ({
      provider: row.provider,
      operation: row.operation,
      request_count: Number(row.request_count ?? 0),
      total_tokens: Number(row.total_tokens ?? 0),
      total_cost: Number(row.total_cost ?? 0),
      avg_cost_per_request: Number(row.avg_cost_per_request ?? 0),
    }));
  }

  /**
   * Send budget alert
   */
  private async sendAlert(
    type: 'warning' | 'limit_reached',
    budget: number,
    currentSpend: number
  ): Promise<void> {
    // Check if alert already sent recently (within 24 hours)
    const recentAlert = await this.db.query(
      `
      SELECT id FROM budget_alerts
      WHERE alert_type = $1
        AND period = 'monthly'
        AND triggered_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    `,
      [type]
    );

    if (recentAlert.rows.length > 0) {
      return; // Already alerted
    }

    // Log alert
    const message =
      type === 'warning'
        ? `⚠️  Budget Alert: 80% of monthly budget used ($${currentSpend.toFixed(2)} / $${budget})`
        : `🚨 Budget Limit Reached: $${currentSpend.toFixed(2)} / $${budget}`;

    console.warn(message);

    // Record in database
    await this.db.query(
      `
      INSERT INTO budget_alerts
      (alert_type, threshold_usd, current_spend_usd, period)
      VALUES ($1, $2, $3, 'monthly')
    `,
      [type, budget, currentSpend]
    );

    // TODO: Send email/webhook notification
    // await sendEmail({ subject: 'Budget Alert', body: message });
  }

  /**
   * Enable fallback mode (use free providers only)
   */
  private async enableFallbackMode(): Promise<void> {
    console.log('💰 Budget limit reached - enabling fallback mode');

    // Set environment overrides
    process.env.EMBEDDING_PROVIDER_OVERRIDE = 'ollama';
    process.env.RERANKER_PROVIDER_OVERRIDE = 'bge';
    process.env.DISABLE_CONTRADICTION_DETECTION = 'true';

    // Log fallback activation
    console.log('  → Embeddings: Ollama (free)');
    console.log('  → Re-ranking: BGE (free)');
    console.log('  → Contradiction Detection: Disabled');
  }
}

// Singleton instance
let costTrackerInstance: CostTracker | null = null;

export function getCostTracker(db: Pool): CostTracker {
  if (!costTrackerInstance) {
    costTrackerInstance = new CostTracker(db);
  }
  return costTrackerInstance;
}

function isCostAlertsEnabled(): boolean {
  const raw = process.env.ENABLE_COST_ALERTS ?? 'true';
  return raw.trim().toLowerCase() === 'true';
}
