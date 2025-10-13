# Phase 12: Cost Monitoring & Budget Control

**Track API usage and prevent cost overruns**

---

## 🎯 Purpose

Monitor and control costs for all paid APIs:
1. **Track usage** (embeddings, re-ranking, LLM calls)
2. **Calculate costs** (real-time spending)
3. **Budget alerts** (80% and 100% thresholds)
4. **Auto-fallback** (switch to free providers on limit)
5. **Reporting** (monthly/daily cost breakdowns)

---

## 🗄️ Database Schema

### API Usage Table

**File:** `packages/db/migrations/005_cost_tracking.sql`

```sql
-- Track all API usage
CREATE TABLE api_usage (
  id SERIAL PRIMARY KEY,
  provider TEXT NOT NULL,           -- 'openai', 'voyage', 'cohere', 'anthropic'
  operation TEXT NOT NULL,          -- 'embed', 'rerank', 'chat'
  tokens_used BIGINT NOT NULL,      -- Tokens or requests
  cost_usd DECIMAL(10,4) NOT NULL,  -- Calculated cost
  collection_id UUID REFERENCES collections(id),
  user_id TEXT,                     -- Optional user tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'       -- Additional context
);

-- Indexes for efficient querying
CREATE INDEX api_usage_provider_idx ON api_usage(provider);
CREATE INDEX api_usage_created_at_idx ON api_usage(created_at);
CREATE INDEX api_usage_collection_idx ON api_usage(collection_id);

-- Budget alerts table
CREATE TABLE budget_alerts (
  id SERIAL PRIMARY KEY,
  alert_type TEXT NOT NULL,         -- 'warning' | 'limit_reached'
  threshold_usd DECIMAL(10,2),      -- Budget threshold
  current_spend_usd DECIMAL(10,4),  -- Actual spend
  period TEXT NOT NULL,             -- 'daily' | 'monthly'
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT FALSE
);

CREATE INDEX budget_alerts_triggered_idx ON budget_alerts(triggered_at DESC);
```

---

## 📦 Implementation

### Cost Tracker Service

**File:** `apps/server/src/services/cost-tracker.ts`

```typescript
import type { Pool } from 'pg';

export class CostTracker {
  private db: Pool;
  
  // Pricing per provider (updated 2025-10)
  private pricing = {
    openai: {
      'text-embedding-3-large': 0.00013, // per 1K tokens
      'gpt-4': 0.03,                     // per 1K input tokens
    },
    voyage: {
      'voyage-code-2': 0.00012,          // per 1K tokens
    },
    cohere: {
      'rerank-v3.5': 0.001,              // per request
    },
    anthropic: {
      'claude-3-haiku': 0.00025,         // per 1K input tokens
    },
  };
  
  constructor(db: Pool) {
    this.db = db;
  }
  
  /**
   * Track API usage
   */
  async track(usage: {
    provider: string;
    operation: string;
    tokens: number;
    model?: string;
    collectionId?: string;
    userId?: string;
    metadata?: any;
  }): Promise<void> {
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
    this.checkBudget().catch(err => 
      console.error('Budget check failed:', err)
    );
  }
  
  /**
   * Calculate cost based on provider pricing
   */
  private calculateCost(usage: {
    provider: string;
    operation: string;
    tokens: number;
    model?: string;
  }): number {
    const providerPricing = this.pricing[usage.provider];
    
    if (!providerPricing) {
      console.warn(`Unknown provider: ${usage.provider}`);
      return 0;
    }
    
    // Special case: Cohere rerank is per-request
    if (usage.provider === 'cohere' && usage.operation === 'rerank') {
      return providerPricing['rerank-v3.5'];
    }
    
    // Default: per 1K tokens
    const model = usage.model || Object.keys(providerPricing)[0];
    const rate = providerPricing[model];
    
    if (!rate) {
      console.warn(`Unknown model: ${model} for ${usage.provider}`);
      return 0;
    }
    
    return (usage.tokens / 1000) * rate;
  }
  
  /**
   * Check if budget limit reached
   */
  async checkBudget(): Promise<void> {
    const budget = parseFloat(process.env.MONTHLY_BUDGET_USD || '10');
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
    
    return parseFloat(result.rows[0].total);
  }
  
  /**
   * Get daily spending
   */
  async getDailySpend(date?: Date): Promise<number> {
    const targetDate = date || new Date();
    
    const result = await this.db.query(`
      SELECT COALESCE(SUM(cost_usd), 0) as total
      FROM api_usage
      WHERE created_at >= date_trunc('day', $1::timestamptz)
        AND created_at < date_trunc('day', $1::timestamptz) + INTERVAL '1 day'
    `, [targetDate]);
    
    return parseFloat(result.rows[0].total);
  }
  
  /**
   * Get cost breakdown by provider
   */
  async getCostBreakdown(
    startDate?: Date,
    endDate?: Date
  ): Promise<CostBreakdown[]> {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();
    
    const result = await this.db.query(`
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
    `, [start, end]);
    
    return result.rows;
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
    const recentAlert = await this.db.query(`
      SELECT id FROM budget_alerts
      WHERE alert_type = $1
        AND period = 'monthly'
        AND triggered_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    `, [type]);
    
    if (recentAlert.rows.length > 0) {
      return; // Already alerted
    }
    
    // Log alert
    const message = type === 'warning'
      ? `⚠️  Budget Alert: 80% of monthly budget used ($${currentSpend.toFixed(2)} / $${budget})`
      : `🚨 Budget Limit Reached: $${currentSpend.toFixed(2)} / $${budget}`;
    
    console.warn(message);
    
    // Record in database
    await this.db.query(`
      INSERT INTO budget_alerts
      (alert_type, threshold_usd, current_spend_usd, period)
      VALUES ($1, $2, $3, 'monthly')
    `, [type, budget, currentSpend]);
    
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

export interface CostBreakdown {
  provider: string;
  operation: string;
  request_count: number;
  total_tokens: number;
  total_cost: number;
  avg_cost_per_request: number;
}

// Singleton instance
let costTrackerInstance: CostTracker | null = null;

export function getCostTracker(db: Pool): CostTracker {
  if (!costTrackerInstance) {
    costTrackerInstance = new CostTracker(db);
  }
  return costTrackerInstance;
}
```

---

## 🔌 Integration Points

### Embedding Pipeline

```typescript
// apps/server/src/pipeline/embed.ts

import { getCostTracker } from '../services/cost-tracker.js';

export async function embedText(
  text: string,
  options?: EmbedOptions
): Promise<number[]> {
  const provider = selectProvider(text, options);
  
  // Embed
  const embedding = await provider.embed(text);
  
  // Track cost
  const costTracker = getCostTracker(db);
  await costTracker.track({
    provider: provider.name,
    operation: 'embed',
    tokens: text.split(' ').length, // Rough token count
    model: provider.model,
    collectionId: options?.collectionId,
  });
  
  return embedding;
}
```

### Re-ranking Service

```typescript
// apps/server/src/services/reranker.ts

import { getCostTracker } from './cost-tracker.js';

export async function rerankWithCohere(...): Promise<...> {
  const results = await cohere.rerank({...});

  // Track cost
  const costTracker = getCostTracker(db);
  await costTracker.track({
    provider: 'cohere',
    operation: 'rerank',
    tokens: 1, // Cohere charges per request
    model: 'rerank-v3.5',
  });

  return results;
}
```

### Contradiction Detection

```typescript
// apps/server/src/services/contradiction-detection.ts

import { getCostTracker } from './cost-tracker.js';

async function verifyContradictionWithLLM(...): Promise<...> {
  const response = await claude.messages.create({...});
  
  // Track cost
  const costTracker = getCostTracker(db);
  await costTracker.track({
    provider: 'anthropic',
    operation: 'chat',
    tokens: response.usage.input_tokens + response.usage.output_tokens,
    model: 'claude-3-haiku',
  });
  
  return result;
}
```

---

## 🌐 API Endpoints

```typescript
// apps/server/src/routes/costs.ts

import { FastifyInstance } from 'fastify';
import { getCostTracker } from '../services/cost-tracker.js';

export async function registerCostRoutes(app: FastifyInstance) {
  const costTracker = getCostTracker(db);
  
  // Get monthly summary
  app.get('/api/costs/summary', async (request, reply) => {
    const monthlySpend = await costTracker.getMonthlySpend();
    const budget = parseFloat(process.env.MONTHLY_BUDGET_USD || '10');
    const breakdown = await costTracker.getCostBreakdown();
    
    return {
      current_spend: monthlySpend,
      budget: budget,
      percentage_used: (monthlySpend / budget) * 100,
      remaining: Math.max(0, budget - monthlySpend),
      breakdown: breakdown,
    };
  });
  
  // Get cost history
  app.get('/api/costs/history', async (request, reply) => {
    const { start_date, end_date } = request.query as any;
    
    const startDate = start_date ? new Date(start_date) : undefined;
    const endDate = end_date ? new Date(end_date) : undefined;
    
    const history = await costTracker.getCostBreakdown(startDate, endDate);
    
    return { history };
  });
  
  // Get recent alerts
  app.get('/api/costs/alerts', async (request, reply) => {
    const result = await db.query(`
      SELECT * FROM budget_alerts
      ORDER BY triggered_at DESC
      LIMIT 10
    `);
    
    return { alerts: result.rows };
  });
}
```

---

## 📊 Usage Examples

### Query Current Costs

```bash
curl http://localhost:3333/api/costs/summary
```

**Response:**
```json
{
  "current_spend": 2.45,
  "budget": 10.00,
  "percentage_used": 24.5,
  "remaining": 7.55,
  "breakdown": [
    {
      "provider": "voyage",
      "operation": "embed",
      "request_count": 1500,
      "total_tokens": 450000,
      "total_cost": 1.80,
      "avg_cost_per_request": 0.0012
    },
    {
      "provider": "cohere",
      "operation": "rerank",
      "request_count": 250,
      "total_cost": 0.50,
      "avg_cost_per_request": 0.002
    }
  ]
}
```

---

## 🧪 Testing

```typescript
describe('Cost Tracking', () => {
  it('calculates OpenAI embedding costs correctly', async () => {
    const tracker = getCostTracker(db);
    
    await tracker.track({
      provider: 'openai',
      operation: 'embed',
      tokens: 1000,
      model: 'text-embedding-3-large',
    });
    
    const spend = await tracker.getMonthlySpend();
    expect(spend).toBeCloseTo(0.00013);
  });
  
  it('triggers budget alert at 80%', async () => {
    process.env.MONTHLY_BUDGET_USD = '1';
    
    // Spend $0.85
    await tracker.track({
      provider: 'openai',
      tokens: 6538, // = $0.85
    });
    
    const alerts = await db.query('SELECT * FROM budget_alerts');
    expect(alerts.rows.length).toBeGreaterThan(0);
    expect(alerts.rows[0].alert_type).toBe('warning');
  });
});
```

---

## ✅ Acceptance Criteria

- [ ] All API calls tracked in database
- [ ] Cost calculations accurate (±1%)
- [ ] Budget alerts trigger at 80% and 100%
- [ ] Fallback mode activates on limit
- [ ] Cost API endpoints return real-time data
- [ ] Dashboard shows cost breakdown
- [ ] No performance impact (<10ms overhead)
- [ ] Works with all providers (OpenAI, Voyage, Cohere, Anthropic)

---

**Next:** See `06_BUILD_PLAN.md` for implementation schedule
