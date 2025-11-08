# Phase 12 Day 3: Comprehensive Implementation Plan

**Date:** 2025-10-14  
**Status:** Ready for Implementation  
**Dependencies:** Day 1 (Reranking) ✅ | Day 2 (Synthesis) ✅

---

## 🔍 Issues Found in Original Plan

### Critical Issues
1. **Missing `budget_alerts` table** - Day 3 prompt only mentions `api_usage`
2. **Integration work not specified** - Service must be wired into existing code
3. **Singleton pattern inconsistency** - Two different patterns shown in docs
4. **Schema differences** - Missing fields between BUILD_PLAN and COST_MONITORING docs

### Medium Issues
5. **Incomplete environment variables** - Missing provider override vars
6. **No feature flag pattern** - Inconsistent with Days 1-2 approach
7. **Testing scope unclear** - When to test integration?

### Minor Issues
8. **Migration number assumption** - May conflict with existing migrations
9. **Documentation inconsistency** - API endpoint naming mismatch

---

## ✅ What's Already Been Done

### Day 1 Complete
- ✅ `apps/server/src/services/reranker.ts` - Cohere & BGE providers
- ✅ Reranking integrated into `POST /api/search`
- ✅ Environment variables in `.env.example` (RERANKER_PROVIDER, COHERE_API_KEY)
- ✅ Tests for reranker

### Day 2 Complete
- ✅ `apps/server/src/services/synthesis.ts` - Multi-source comparison
- ✅ `apps/server/src/services/contradiction-detection.ts` - Anthropic-powered detection
- ✅ `POST /api/synthesis/compare` endpoint
- ✅ Feature flags: ENABLE_SYNTHESIS, ENABLE_CONTRADICTION_DETECTION
- ✅ Tests for synthesis and contradiction detection

### Partial Environment Setup
- ✅ `MONTHLY_BUDGET_USD=10` already in `.env.example`
- ✅ `ENABLE_COST_ALERTS=true` already in `.env.example`

---

## 🎯 Day 3: Corrected Implementation Plan

### Phase 1: Database Schema (1 hour)

#### 1.1 Create Migration `003_cost_tracking.sql`
**Why 003?** Existing migrations: 001 (initial), 002 (seed), 004 (hybrid). Use 003 to fill the gap.

**Complete Schema (from 05_COST_MONITORING.md):**
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
  metadata JSONB DEFAULT '{}'       -- Additional context (e.g., model name)
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

**File:** `packages/db/migrations/003_cost_tracking.sql`

**Run migration:**
```bash
pnpm --filter @synthesis/db migrate
```

---

### Phase 2: Cost Tracker Service (2 hours)

#### 2.1 Create `apps/server/src/services/cost-tracker.ts`

**Use Factory Pattern** (from 05_COST_MONITORING.md) for consistency:
```typescript
export class CostTracker {
  // Full implementation from 05_COST_MONITORING.md lines 68-291
}

// Singleton pattern
let costTrackerInstance: CostTracker | null = null;

export function getCostTracker(db: Pool): CostTracker {
  if (!costTrackerInstance) {
    costTrackerInstance = new CostTracker(db);
  }
  return costTrackerInstance;
}
```

**Key Methods:**
- `track(usage)` - Async tracking, non-blocking
- `calculateCost(usage)` - Per-provider pricing
- `checkBudget()` - 80% warning, 100% limit
- `getMonthlySpend()` - Current month total
- `getCostBreakdown()` - Provider breakdown
- `enableFallbackMode()` - Switch to free providers

**Pricing Table (lines 71-86 of 05_COST_MONITORING.md):**
- OpenAI: $0.00013 per 1K tokens
- Voyage: $0.00012 per 1K tokens
- Cohere: $0.001 per request (fixed)
- Anthropic: $0.00025 per 1K tokens (Claude Haiku)

---

### Phase 3: Cost API Endpoints (1 hour)

#### 3.1 Create `apps/server/src/routes/costs.ts`

**Endpoints:**
```typescript
// GET /api/costs/summary
// Returns: current_spend, budget, percentage_used, remaining, breakdown

// GET /api/costs/history?start_date&end_date
// Returns: detailed breakdown with date range

// GET /api/costs/alerts
// Returns: recent budget alerts (last 10)
```

**Implementation from 05_COST_MONITORING.md lines 398-443**

#### 3.2 Register Routes in `apps/server/src/index.ts`
```typescript
import { registerCostRoutes } from './routes/costs.js';

// After other routes
await registerCostRoutes(app);
```

---

### Phase 4: Integration Points (2 hours) ⚠️ **CRITICAL - Not in Original Plan**

#### 4.1 Embedding Pipeline Integration
**File:** `apps/server/src/pipeline/embed.ts`

**Add cost tracking after successful embedding:**
```typescript
import { getCostTracker } from '../services/cost-tracker.js';
import { db } from '../db.js'; // Import your db Pool

export async function embedText(text: string, options: EmbedOptions = {}): Promise<EmbedResult> {
  const resolved = resolveProviderConfig(text, options);
  // ... existing code ...
  
  try {
    const embedding = await generateEmbedding(text, primaryConfig, options);
    
    // Track cost (async, non-blocking)
    trackEmbeddingCost(primaryConfig, text, options.context).catch(err =>
      console.error('Cost tracking failed:', err)
    );
    
    return {
      embedding,
      provider: primaryConfig.provider,
      model: primaryConfig.model,
      dimensions: primaryConfig.dimensions,
      usedFallback: false,
    };
  } catch (error) {
    // ... existing fallback code ...
  }
}

async function trackEmbeddingCost(
  config: EmbeddingConfig,
  text: string,
  context?: ContentContext
): Promise<void> {
  // Skip tracking for free providers
  if (config.provider === 'ollama') {
    return;
  }
  
  const costTracker = getCostTracker(db);
  const tokens = estimateTokens(text); // Rough estimate: text.split(/\s+/).length
  
  await costTracker.track({
    provider: config.provider,
    operation: 'embed',
    tokens,
    model: config.model,
    collectionId: context?.collectionId,
  });
}

function estimateTokens(text: string): number {
  // Rough estimate: ~0.75 tokens per word
  return Math.ceil(text.split(/\s+/).length * 0.75);
}
```

#### 4.2 Reranker Integration
**File:** `apps/server/src/services/reranker.ts`

**Add cost tracking in `rerankWithCohere`:**
```typescript
import { getCostTracker } from './cost-tracker.js';
import { db } from '../db.js'; // Import your db Pool

async function rerankWithCohere<T extends RerankCandidate>(
  query: string,
  results: T[]
): Promise<RerankedResult<T>[]> {
  const client = await getCohereClient();
  const response = await client.rerank({
    query,
    documents: results.map((item) => item.text ?? ''),
    topN: results.length,
    model: 'rerank-english-v3.0',
    returnDocuments: false,
  });

  // Track cost (Cohere charges a flat $0.002 per search request)
  trackRerankCost().catch(err => console.error('Cost tracking failed:', err));

  const scored = response.results
    // ... existing code ...
}

async function trackRerankCost(): Promise<void> {
  const costTracker = getCostTracker(db);
  await costTracker.track({
    provider: 'cohere',
    operation: 'rerank',
    count: 1,
    unit: 'request',
    costUSD: 0.002,
    model: 'rerank-english-v3.0',
  });
}
```

#### 4.3 Contradiction Detection Integration
**File:** `apps/server/src/services/contradiction-detection.ts`

**Add cost tracking in `analyzePair`:**
```typescript
import { getCostTracker } from './cost-tracker.js';
import { db } from '../db.js'; // Import your db Pool

async function analyzePair(
  client: Anthropic,
  a: ContradictionApproach,
  b: ContradictionApproach,
  signal?: AbortSignal
): Promise<Conflict | null> {
  try {
    // ... existing code to build prompt ...
    
    const response = await client.messages.create(
      {
        model: DEFAULT_MODEL,
        max_tokens: 400,
        temperature: 0,
        system: '...',
        messages: [...],
      },
      signal ? { signal } : undefined
    );

    // Track cost
    trackContradictionCost(response).catch(err => 
      console.error('Cost tracking failed:', err)
    );

    // ... rest of existing code ...
  } catch (error) {
    // ... existing error handling ...
  }
}

async function trackContradictionCost(response: any): Promise<void> {
  const costTracker = getCostTracker(db);
  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  
  await costTracker.track({
    provider: 'anthropic',
    operation: 'chat',
    tokens: inputTokens + outputTokens,
    model: DEFAULT_MODEL,
    metadata: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    },
  });
}
```

**Note:** Anthropic SDK provides `usage` in response, use it for accurate tracking.

---

### Phase 5: Environment Variables (15 minutes)

#### 5.1 Update `apps/server/.env.example`

**Already exists:**
```bash
# Phase 12: Cost Monitoring
MONTHLY_BUDGET_USD=10
ENABLE_COST_ALERTS=true
```

**Add fallback override variables:**
```bash
# Phase 12: Cost Monitoring & Budget Control
MONTHLY_BUDGET_USD=10
ENABLE_COST_ALERTS=true

# Budget fallback overrides (set by system when budget exceeded)
# Do not set these manually - they are auto-enabled by cost tracker
# EMBEDDING_PROVIDER_OVERRIDE=ollama
# RERANKER_PROVIDER_OVERRIDE=bge
# DISABLE_CONTRADICTION_DETECTION=true
```

**Document in comment:**
```bash
# When monthly budget is exceeded:
# - Embeddings switch to Ollama (free)
# - Reranking switches to BGE (free)  
# - Contradiction detection disabled
# These happen automatically - no manual config needed
```

---

### Phase 6: Database Integration (30 minutes)

#### 6.1 Export Database Pool

**Check if db Pool is exported:**
- If `apps/server/src/db.ts` exists and exports `db: Pool`, use it
- If not, create it or use dependency injection

**Option A: If db is already available**
```typescript
// In cost-tracker.ts
import { db } from '../db.js';
export const costTracker = getCostTracker(db);
```

**Option B: If db needs to be passed**
```typescript
// In routes/costs.ts
export async function registerCostRoutes(app: FastifyInstance, db: Pool) {
  const costTracker = getCostTracker(db);
  // ... routes
}

// In index.ts
await registerCostRoutes(app, db);
```

**Use Option B** for better testability and no circular dependencies.

---

### Phase 7: Testing (1 hour)

#### 7.1 Unit Tests: `apps/server/src/services/__tests__/cost-tracker.test.ts`

**Test Coverage:**
- ✅ Cost calculation accuracy (OpenAI, Voyage, Cohere, Anthropic)
- ✅ Tracking inserts records into database
- ✅ Monthly spend calculation
- ✅ Budget alerts trigger at 80% and 100%
- ✅ Fallback mode activation
- ✅ Cost breakdown by provider

```typescript
describe('CostTracker', () => {
  it('calculates OpenAI embedding costs correctly', async () => {
    const tracker = getCostTracker(testDb);
    
    await tracker.track({
      provider: 'openai',
      operation: 'embed',
      tokens: 1000,
      model: 'text-embedding-3-large',
    });
    
    const spend = await tracker.getMonthlySpend();
    expect(spend).toBeCloseTo(0.00013); // $0.00013 per 1K tokens
  });
  
  it('triggers budget alert at 80%', async () => {
    process.env.MONTHLY_BUDGET_USD = '1';
    
    // Spend $0.85
    await tracker.track({
      provider: 'cohere',
      operation: 'rerank',
      tokens: 850, // 850 requests * $0.001 = $0.85
    });
    
    const alerts = await testDb.query('SELECT * FROM budget_alerts WHERE alert_type = $1', ['warning']);
    expect(alerts.rows.length).toBeGreaterThan(0);
  });
  
  // ... more tests from 05_COST_MONITORING.md lines 487-516
});
```

#### 7.2 Integration Tests (Optional for Day 3, Required for Day 4)

**From 06_BUILD_PLAN.md lines 512-541:**
- End-to-end: search → rerank → synthesize with cost tracking
- Budget limit triggers fallback mode
- All paid operations tracked correctly

---

## 📋 Complete Day 3 Checklist

### Database
- [ ] Create `packages/db/migrations/003_cost_tracking.sql` with BOTH tables
- [ ] Include `metadata JSONB` and `acknowledged BOOLEAN` fields
- [ ] Run migration: `pnpm --filter @synthesis/db migrate`
- [ ] Verify tables exist: `SELECT * FROM api_usage LIMIT 1;`

### Service
- [ ] Create `apps/server/src/services/cost-tracker.ts`
- [ ] Use factory pattern: `getCostTracker(db)`
- [ ] Implement all methods from 05_COST_MONITORING.md
- [ ] Add pricing table (OpenAI, Voyage, Cohere, Anthropic)
- [ ] Implement async tracking (non-blocking)
- [ ] Implement budget checking (80%, 100%)
- [ ] Implement fallback mode activation

### API Endpoints
- [ ] Create `apps/server/src/routes/costs.ts`
- [ ] Implement `GET /api/costs/summary`
- [ ] Implement `GET /api/costs/history`
- [ ] Implement `GET /api/costs/alerts`
- [ ] Register routes in `apps/server/src/index.ts`

### Integration ⚠️ **CRITICAL**
- [ ] Integrate into `apps/server/src/pipeline/embed.ts`
  - Track OpenAI embeddings
  - Track Voyage embeddings
  - Skip Ollama (free)
- [ ] Integrate into `apps/server/src/services/reranker.ts`
  - Track Cohere reranking
  - Skip BGE (free)
- [ ] Integrate into `apps/server/src/services/contradiction-detection.ts`
  - Track Anthropic API calls
  - Use response.usage for accurate token counts

### Environment
- [ ] Update `apps/server/.env.example` with fallback override vars
- [ ] Document auto-enable behavior
- [ ] Verify existing MONTHLY_BUDGET_USD and ENABLE_COST_ALERTS

### Database Pool
- [ ] Verify db Pool is exported and accessible
- [ ] Use dependency injection in routes
- [ ] Pass db to getCostTracker()

### Testing
- [ ] Create `apps/server/src/services/__tests__/cost-tracker.test.ts`
- [ ] Test cost calculations (all providers)
- [ ] Test budget alerts
- [ ] Test fallback mode
- [ ] Run tests: `pnpm --filter @synthesis/server test cost-tracker`

### Documentation
- [ ] Create `docs/phases/phase-12/day3-implementation-notes.md`
- [ ] Document expected monthly costs
- [ ] Note integration points
- [ ] Post update to GitHub issue #61

---

## 🎯 Acceptance Criteria (Day 3)

From 07_ACCEPTANCE_CRITERIA.md:

### Must Pass
- [ ] All API calls tracked in database
- [ ] Cost calculations accurate (±1%)
- [ ] Budget alerts trigger at 80% and 100%
- [ ] Fallback mode activates on limit
- [ ] Cost API endpoints return real-time data
- [ ] No performance impact (<10ms overhead)
- [ ] Works with all providers (OpenAI, Voyage, Cohere, Anthropic)

### Can Defer to Day 4
- [ ] Dashboard shows cost breakdown (frontend)
- [ ] Integration tests for full flow

---

## 📊 Expected Monthly Costs

**Typical Usage (1,000 searches/month):**
- Embeddings (Voyage): ~$0.50
- Reranking (Cohere): ~$1.00
- Contradiction Detection (Claude Haiku): ~$0.15
- **Total: ~$1.65/month**

**Budget Alerts:**
- Warning at $8.00 (80% of $10)
- Limit at $10.00
- Fallback to free providers (Ollama + BGE)

---

## 🚀 Implementation Order

1. **Database** (30 min) - Both tables, run migration
2. **Service** (2 hours) - CostTracker class with all methods
3. **API Routes** (1 hour) - Three endpoints
4. **Integration** (2 hours) - Wire into embed, rerank, contradiction
5. **Environment** (15 min) - Update .env.example
6. **Testing** (1 hour) - Unit tests
7. **Documentation** (30 min) - Implementation notes

**Total: 7 hours** (vs. 5 hours originally planned - integration adds 2 hours)

---

## ⚠️ Breaking Changes: NONE

- Feature is additive-only
- Default behavior unchanged (tracking is async, non-blocking)
- No existing functionality affected
- Backwards compatible with Phase 11

---

## 🔗 Next Steps

**Day 4:**
- Integration tests for full flow
- Performance validation (<10ms overhead)
- Metrics collection (precision, latency, costs)
- PR preparation

**Days 5-6 (Frontend):**
- Cost dashboard UI (uses these endpoints)
- Synthesis view UI

---

## 📝 Notes for Implementation

1. **Use getCostTracker(db) pattern** - Not singleton export
2. **Both tables required** - api_usage AND budget_alerts
3. **Integration is critical** - Service alone won't track anything
4. **Async tracking** - Never block main request flow
5. **Error handling** - Tracking failures should log, not crash
6. **Token estimation** - Use actual usage when available (Anthropic), estimate for embeddings
7. **Cohere is per-request** - Not per-token
8. **Test with real DB** - Mock won't catch migration issues

---

## ✅ Definition of Done

Day 3 is complete when:
- ✅ Both database tables exist and are indexed
- ✅ CostTracker service fully implemented
- ✅ All three API endpoints working
- ✅ Cost tracking integrated into 3 locations (embed, rerank, contradiction)
- ✅ Unit tests passing (>80% coverage)
- ✅ Manual test shows costs being tracked
- ✅ Budget alert fires at 80%
- ✅ Fallback mode activates at 100%
- ✅ Implementation notes posted to #61

---

**Conflicts Resolved:**
- ✅ Both tables in migration (not just api_usage)
- ✅ Integration work explicitly specified
- ✅ Factory pattern chosen (getCostTracker)
- ✅ Full schema with metadata and acknowledged fields
- ✅ All environment variables documented
- ✅ Testing scope clarified (unit Day 3, integration Day 4)
- ✅ Migration number verified (003)
- ✅ 7-hour timeline reflects real scope
