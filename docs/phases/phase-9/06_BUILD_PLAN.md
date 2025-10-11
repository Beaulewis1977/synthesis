# Phase 9: Build Plan

**4-day implementation schedule for re-ranking and synthesis**

---

## 📅 Day-by-Day Breakdown

### Day 1: Re-ranking Implementation (6 hours)

**Morning (3 hours): Provider Setup**

```bash
# 1. Install dependencies
pnpm add cohere-ai @xenova/transformers
```

```bash
# 2. Create reranker service
touch apps/server/src/services/reranker.ts
```

Implement as per `01_RERANKING_ARCHITECTURE.md` (~250 lines):
- Core reranking logic
- Provider selection
- Cohere integration
- BGE integration
- Error handling & fallbacks

```bash
# 3. Environment setup
```

Add to `.env.local`:
```bash
# Reranking
RERANKER_PROVIDER=bge  # or 'cohere'
COHERE_API_KEY=<your-key-optional>
RERANK_MAX_CANDIDATES=50
RERANK_DEFAULT_TOP_K=15
```

**Afternoon (3 hours): Integration & Testing**

```bash
# 1. Update search service
# Modify: apps/server/src/services/search.ts
```

Add `searchWithReranking()` wrapper (~50 lines)

```bash
# 2. Update search route
# Modify: apps/server/src/routes/search.ts
```

Support `rerank` parameter in API

```bash
# 3. Write tests
touch apps/server/src/services/reranker.test.ts
```

Test:
- Cohere reranking
- BGE reranking
- Fallback behavior
- Score preservation

```bash
# 4. Manual testing
pnpm --filter @synthesis/server test reranker

# Test with real API
curl -X POST http://localhost:3333/api/search \
  -d '{"query":"test","collection_id":"uuid","rerank":true}'
```

**End of Day 1 Checklist:**
- [ ] Cohere integration working
- [ ] BGE model loads and ranks
- [ ] Fallback to BGE on Cohere error
- [ ] Tests passing
- [ ] Can rerank via API

---

### Day 2: Synthesis Engine (6 hours)

**Morning (3 hours): Multi-Source Comparison**

```bash
# 1. Create synthesis service
touch apps/server/src/services/synthesis.ts
```

Implement (~300 lines):
- Result clustering by topic
- Consensus scoring
- Approach grouping
- Summary generation

**Core Algorithm:**
```typescript
export async function synthesizeResults(
  query: string,
  results: SearchResult[]
): Promise<SynthesisResponse> {
  // 1. Cluster similar results
  const clusters = await clusterByTopic(results);
  
  // 2. Extract approaches
  const approaches = clusters.map(cluster => ({
    method: identifyMethod(cluster),
    sources: cluster.results,
    consensus_score: calculateConsensus(cluster),
    summary: generateSummary(cluster),
  }));
  
  // 3. Detect contradictions
  const conflicts = await detectContradictions(approaches);
  
  return { query, approaches, conflicts };
}
```

```bash
# 2. Create synthesis route
touch apps/server/src/routes/synthesis.ts
```

```typescript
app.post('/api/synthesis/compare', async (request, reply) => {
  const { query, collection_id } = request.body;
  
  // Get reranked results
  const results = await searchWithReranking(db, {
    query,
    collectionId: collection_id,
    rerank: true,
    topK: 50,
  });
  
  // Synthesize
  const synthesis = await synthesizeResults(query, results);
  
  return synthesis;
});
```

**Afternoon (3 hours): Contradiction Detection**

```bash
# 1. Implement contradiction detector
# Part of synthesis.ts
```

**LLM-based detection:**
```typescript
async function detectContradictions(
  approaches: Approach[]
): Promise<Conflict[]> {
  const conflicts: Conflict[] = [];
  
  // Compare approaches pairwise
  for (let i = 0; i < approaches.length; i++) {
    for (let j = i + 1; j < approaches.length; j++) {
      const conflict = await compareApproaches(
        approaches[i],
        approaches[j]
      );
      
      if (conflict) {
        conflicts.push(conflict);
      }
    }
  }
  
  return conflicts;
}

async function compareApproaches(
  a: Approach,
  b: Approach
): Promise<Conflict | null> {
  // Use Claude to detect contradictions
  const prompt = `
Compare these two approaches and identify if they conflict:

Approach A: ${a.summary}
Source: ${a.sources[0].docTitle} (${a.sources[0].metadata?.source_quality})

Approach B: ${b.summary}
Source: ${b.sources[0].docTitle} (${b.sources[0].metadata?.source_quality})

Are they contradictory? Respond in JSON:
{
  "contradictory": boolean,
  "severity": "high" | "medium" | "low",
  "difference": "explanation",
  "recommendation": "which to prefer"
}
  `;
  
  const response = await claude.complete(prompt, { maxTokens: 200 });
  const analysis = JSON.parse(response);
  
  if (analysis.contradictory) {
    return {
      topic: extractCommonTopic(a, b),
      source_a: a.sources[0],
      source_b: b.sources[0],
      severity: analysis.severity,
      difference: analysis.difference,
      recommendation: analysis.recommendation,
    };
  }
  
  return null;
}
```

```bash
# 2. Test synthesis
touch apps/server/src/services/synthesis.test.ts
```

**End of Day 2 Checklist:**
- [ ] Synthesis engine groups results by approach
- [ ] Consensus scoring works
- [ ] Contradiction detection identifies conflicts
- [ ] API endpoint returns structured synthesis
- [ ] Tests passing

---

### Day 3: Cost Monitoring (5 hours)

**Morning (3 hours): Cost Tracking System**

```bash
# 1. Create migration
touch packages/db/migrations/005_cost_tracking.sql
```

```sql
-- Cost tracking table
CREATE TABLE api_usage (
  id SERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  operation TEXT NOT NULL,
  tokens_used BIGINT NOT NULL,
  cost_usd DECIMAL(10,4) NOT NULL,
  collection_id UUID REFERENCES collections(id),
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX api_usage_provider_idx ON api_usage(provider);
CREATE INDEX api_usage_created_at_idx ON api_usage(created_at);
CREATE INDEX api_usage_collection_idx ON api_usage(collection_id);

-- Budget tracking
CREATE TABLE budget_alerts (
  id SERIAL PRIMARY KEY,
  alert_type TEXT NOT NULL,  -- 'warning' | 'limit_reached'
  threshold_usd DECIMAL(10,2),
  current_spend_usd DECIMAL(10,4),
  period TEXT,  -- 'daily' | 'monthly'
  triggered_at TIMESTAMPTZ DEFAULT NOW()
);
```

```bash
# 2. Run migration
pnpm --filter @synthesis/db migrate
```

```bash
# 3. Create cost tracker service
touch apps/server/src/services/cost-tracker.ts
```

```typescript
export class CostTracker {
  private db: Pool;
  
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
    collectionId?: string;
  }): Promise<void> {
    const cost = this.calculateCost(usage);
    
    await this.db.query(
      `INSERT INTO api_usage 
       (provider, operation, tokens_used, cost_usd, collection_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [usage.provider, usage.operation, usage.tokens, cost, usage.collectionId]
    );
    
    // Check budget asynchronously
    this.checkBudget().catch(console.error);
  }
  
  /**
   * Calculate cost based on provider pricing
   */
  private calculateCost(usage: {
    provider: string;
    operation: string;
    tokens: number;
  }): number {
    const pricing = {
      openai: {
        embed: 0.00013 / 1000, // per token
      },
      voyage: {
        embed: 0.00012 / 1000,
      },
      cohere: {
        rerank: 0.001, // per request
      },
      claude: {
        chat: 0.003 / 1000, // input tokens
      },
    };
    
    const rate = pricing[usage.provider]?.[usage.operation];
    if (!rate) return 0;
    
    if (usage.provider === 'cohere' && usage.operation === 'rerank') {
      return rate; // Fixed per-request cost
    }
    
    return usage.tokens * rate;
  }
  
  /**
   * Check if budget limit reached
   */
  async checkBudget(): Promise<void> {
    const monthlySpend = await this.getMonthlySpend();
    const budget = parseFloat(process.env.MONTHLY_BUDGET_USD || '10');
    
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
   * Get current month spend
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
   * Get cost breakdown by provider
   */
  async getCostBreakdown(
    startDate?: Date,
    endDate?: Date
  ): Promise<CostBreakdown[]> {
    const result = await this.db.query(`
      SELECT
        provider,
        operation,
        COUNT(*) as requests,
        SUM(tokens_used) as total_tokens,
        SUM(cost_usd) as total_cost
      FROM api_usage
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY provider, operation
      ORDER BY total_cost DESC
    `, [startDate || new Date(0), endDate || new Date()]);
    
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
    // Log alert
    console.warn(`Budget Alert: ${type} - $${currentSpend.toFixed(2)} / $${budget}`);
    
    // Record in database
    await this.db.query(`
      INSERT INTO budget_alerts
      (alert_type, threshold_usd, current_spend_usd, period)
      VALUES ($1, $2, $3, 'monthly')
    `, [type, budget, currentSpend]);
    
    // TODO: Send email/notification
  }
  
  /**
   * Enable fallback mode (use free providers only)
   */
  private async enableFallbackMode(): Promise<void> {
    console.log('Budget limit reached, enabling fallback mode');
    
    // Set environment to force free providers
    process.env.EMBEDDING_PROVIDER_OVERRIDE = 'ollama';
    process.env.RERANKER_PROVIDER_OVERRIDE = 'bge';
    
    // This affects future requests only
  }
}

// Singleton instance
export const costTracker = new CostTracker(db);
```

**Afternoon (2 hours): Cost API & Dashboard Data**

```bash
# 1. Create cost routes
touch apps/server/src/routes/costs.ts
```

```typescript
import { costTracker } from '../services/cost-tracker.js';

export async function registerCostRoutes(app: FastifyInstance) {
  // Get current month summary
  app.get('/api/costs/summary', async (request, reply) => {
    const monthlySpend = await costTracker.getMonthlySpend();
    const breakdown = await costTracker.getCostBreakdown();
    const budget = parseFloat(process.env.MONTHLY_BUDGET_USD || '10');
    
    return {
      current_spend: monthlySpend,
      budget: budget,
      percentage_used: (monthlySpend / budget) * 100,
      breakdown: breakdown,
    };
  });
  
  // Get detailed usage history
  app.get('/api/costs/history', async (request, reply) => {
    const { start_date, end_date } = request.query as any;
    
    const history = await costTracker.getCostBreakdown(
      start_date ? new Date(start_date) : undefined,
      end_date ? new Date(end_date) : undefined
    );
    
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

```bash
# 2. Register routes
# Modify: apps/server/src/index.ts
```

Add: `await registerCostRoutes(app);`

**End of Day 3 Checklist:**
- [ ] Cost tracking table created
- [ ] CostTracker service implemented
- [ ] Budget alerts working
- [ ] Fallback mode activates on limit
- [ ] Cost API endpoints working
- [ ] Can query cost breakdown

---

### Day 4: Testing & Integration (3 hours)

**Morning (2 hours): Comprehensive Testing**

```bash
# 1. Integration tests
touch apps/server/src/services/integration.test.ts
```

```typescript
describe('Phase 9 Integration', () => {
  it('end-to-end: search → rerank → synthesize', async () => {
    // Insert test docs
    await insertTestDocuments([
      { text: 'Method A: Use Provider', quality: 'official' },
      { text: 'Method A: Provider is recommended', quality: 'official' },
      { text: 'Method B: Use Custom Auth', quality: 'community' },
    ]);
    
    // Search with reranking
    const results = await searchWithReranking(db, {
      query: 'authentication methods',
      collectionId: 'test',
      rerank: true,
    });
    
    expect(results[0].rerankScore).toBeGreaterThan(0);
    
    // Synthesize
    const synthesis = await synthesizeResults(
      'authentication methods',
      results
    );
    
    expect(synthesis.approaches).toHaveLength(2); // Method A and B
    expect(synthesis.approaches[0].consensus_score).toBeGreaterThan(
      synthesis.approaches[1].consensus_score
    ); // Official sources have higher consensus
  });
  
  it('cost tracking records all operations', async () => {
    const initialSpend = await costTracker.getMonthlySpend();
    
    // Trigger paid operations
    await rerankWithCohere('test', mockResults());
    await embedText('test', { provider: 'openai' });
    
    const finalSpend = await costTracker.getMonthlySpend();
    
    expect(finalSpend).toBeGreaterThan(initialSpend);
  });
  
  it('budget limit triggers fallback', async () => {
    // Set low budget
    process.env.MONTHLY_BUDGET_USD = '0.01';
    
    // Spend over budget
    for (let i = 0; i < 20; i++) {
      await costTracker.track({
        provider: 'cohere',
        operation: 'rerank',
        tokens: 1,
      });
    }
    
    // Check fallback enabled
    const provider = selectEmbeddingProvider('test code');
    expect(provider.provider).toBe('ollama'); // Fallback to free
  });
});
```

```bash
# 2. Performance benchmarks
touch scripts/benchmark-phase9.ts
```

```typescript
// Measure reranking improvement
const queries = [
  'Flutter authentication',
  'StatefulWidget lifecycle',
  'StreamBuilder usage',
  // ... 50+ test queries
];

for (const query of queries) {
  // Without reranking
  const withoutRerank = await searchWithReranking(db, {
    query,
    rerank: false,
  });
  
  // With reranking
  const withRerank = await searchWithReranking(db, {
    query,
    rerank: true,
  });
  
  // Calculate precision@5
  const precisionWithout = calculatePrecision(withoutRerank.slice(0, 5));
  const precisionWith = calculatePrecision(withRerank.slice(0, 5));
  
  console.log(`Query: ${query}`);
  console.log(`  Without rerank: ${precisionWithout.toFixed(2)}`);
  console.log(`  With rerank: ${precisionWith.toFixed(2)}`);
  console.log(`  Improvement: ${((precisionWith - precisionWithout) * 100).toFixed(1)}%`);
}
```

**Afternoon (1 hour): Documentation & PR Prep**

```bash
# 1. Update README
# Document new environment variables
# Add cost monitoring section
```

```bash
# 2. Update API docs
# Document synthesis endpoint
# Document cost endpoints
```

```bash
# 3. Run full test suite
pnpm test

# 4. Check linting
pnpm lint

# 5. Build all packages
pnpm build
```

**End of Day 4 Checklist:**
- [ ] All tests passing
- [ ] Performance benchmarks show improvement
- [ ] Cost tracking accurate
- [ ] Documentation updated
- [ ] Ready for PR review

---

## 🎯 Acceptance Criteria Validation

Before marking Phase 9 complete, verify:

**Functional:**
- [ ] Reranking improves precision@5 by 20%+
- [ ] Can switch between Cohere and BGE
- [ ] Synthesis API groups results by approach
- [ ] Contradiction detection identifies conflicts
- [ ] Cost tracking shows real-time spend
- [ ] Budget alerts trigger at 80% and 100%

**Performance:**
- [ ] Reranking adds <300ms latency
- [ ] Synthesis completes in <2 seconds
- [ ] Cost tracking doesn't block requests

**Quality:**
- [ ] All tests passing (>80% coverage)
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] MCP tools still work

---

## 🐛 Troubleshooting

### Issue: BGE Model Download Fails

```bash
# Manually download model
mkdir -p ~/.cache/huggingface
cd ~/.cache/huggingface

# Download from Hugging Face
git lfs install
git clone https://huggingface.co/BAAI/bge-reranker-base
```

### Issue: Cohere Rate Limits

```bash
# Check retry logic is working
# Should see exponential backoff in logs

# Or switch to BGE
export RERANKER_PROVIDER=bge
```

### Issue: Cost Tracking Missing Entries

```sql
-- Check if table exists
SELECT * FROM api_usage LIMIT 5;

-- Check if inserts are happening
SELECT COUNT(*) FROM api_usage 
WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

## ✅ Sign-Off

**Demo the improvements:**

```bash
# 1. Show reranking improvement
curl -X POST http://localhost:3333/api/search \
  -d '{
    "query":"StatefulWidget lifecycle",
    "collection_id":"flutter-docs",
    "rerank":true
  }'

# 2. Show synthesis
curl -X POST http://localhost:3333/api/synthesis/compare \
  -d '{
    "query":"authentication methods",
    "collection_id":"flutter-docs"
  }'

# 3. Show cost tracking
curl http://localhost:3333/api/costs/summary
```

**Tag release:**
```bash
git tag v1.2.0-phase-9
git push --tags
```

---

**Phase 9 Complete!** Ready for Phase 10 (Code Intelligence) 🚀
