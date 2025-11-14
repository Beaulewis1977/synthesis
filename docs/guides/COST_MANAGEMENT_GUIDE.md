# Cost Management Guide

**Version:** 1.0
**Last Updated:** November 13, 2025
**Applies to:** Phase 12+

---

## Table of Contents

1. [Overview](#overview)
2. [Understanding API Costs](#understanding-api-costs)
3. [Setting Budget Limits](#setting-budget-limits)
4. [Automatic Fallbacks](#automatic-fallbacks)
5. [Cost Dashboard](#cost-dashboard)
6. [Alerts & Monitoring](#alerts--monitoring)
7. [Provider Comparison](#provider-comparison)
8. [Optimization Tips](#optimization-tips)
9. [Troubleshooting](#troubleshooting)

---

## Overview

### Why Cost Management Matters

Synthesis leverages multiple AI service providers to deliver optimal performance. While local providers like Ollama are free, paid providers (OpenAI, Voyage, Cohere) offer specialized capabilities that come with usage costs:

- **Voyage AI** - Code-optimized embeddings for technical documentation
- **Cohere** - Advanced semantic reranking for improved search relevance
- **OpenAI** - High-quality embeddings for personal writing and notes
- **Anthropic** - Advanced reasoning for contradiction detection (Claude Haiku)

Without cost management, these services could lead to unexpected bills. Phase 12 introduced automatic cost tracking, budget monitoring, and intelligent fallback mechanisms to keep your costs predictable and under control.

### Key Features

- **Real-time cost tracking** - Every API call is tracked with sub-cent accuracy
- **Monthly budget limits** - Set a spending cap and never exceed it
- **Automatic fallbacks** - System switches to free providers when budget is reached
- **Budget alerts** - Get warned at 80% threshold before hitting limits
- **Cost breakdown** - Detailed analytics by provider, operation, and time period
- **Zero configuration** - Works out of the box with sensible defaults

---

## Understanding API Costs

### Provider Pricing (as of Phase 12, October 2025)

#### Free Providers (No API Key Required)

| Provider | Service | Cost | Notes |
|----------|---------|------|-------|
| **Ollama** | Embeddings (nomic-embed-text) | **Free** | Runs locally, requires GPU/CPU resources |
| **Ollama** | Chat (llama3.2) | **Free** | Optional local LLM fallback |
| **BGE** | Reranking (BAAI/bge-reranker-base) | **Free** | Local reranking model |

#### Paid Providers (API Key Required)

| Provider | Service | Cost | Notes |
|----------|---------|------|-------|
| **Voyage** | Code embeddings (voyage-code-2) | **$0.00012 per 1K tokens** | Optimized for code/technical docs |
| **OpenAI** | Text embeddings (text-embedding-3-large) | **$0.00013 per 1K tokens** | High-quality, best for personal writing |
| **Cohere** | Reranking (rerank-v3.5) | **$0.001 per request** | Advanced semantic reranking |
| **Anthropic** | Contradiction detection (claude-3-haiku) | **$0.00025 per 1K input tokens** | Optional quality analysis |

### How Costs Accumulate

**Embeddings:**
- Generated once per text chunk during document ingestion
- Also generated for each search query
- Token count ≈ number of words × 1.3 (English)
- Example: 1,000 words = ~1,300 tokens = ~$0.00016 with Voyage

**Reranking:**
- Applied to top search results (default: top 10)
- Charged per reranking request, not per result
- Example: 100 searches with reranking = $0.10 with Cohere

**Contradiction Detection:**
- Analyzes pairs of search results for conflicts
- Only runs when `ENABLE_CONTRADICTION_DETECTION=true`
- Token usage varies by result length (typically 500-2000 tokens per check)

### Example Cost Scenarios

**Light Usage (Personal project):**
- 50 documents ingested (Ollama embeddings): **$0.00**
- 200 searches per month (Ollama embeddings): **$0.00**
- **Total: $0.00/month**

**Medium Usage (Team documentation with code):**
- 500 code files ingested (Voyage embeddings): **~$0.50**
- 1,000 searches per month (Ollama embeddings): **$0.00**
- Reranking enabled for 500 searches (Cohere): **$0.50**
- **Total: ~$1.00/month**

**Heavy Usage (Production with all features):**
- 2,000 documents ingested (mixed providers): **~$2.00**
- 5,000 searches per month (Ollama embeddings): **$0.00**
- Reranking enabled for 2,000 searches (Cohere): **$2.00**
- Contradiction detection on 500 searches (Claude Haiku): **~$1.50**
- **Total: ~$5.50/month**

---

## Setting Budget Limits

### Default Configuration

Synthesis ships with a **$10/month** default budget limit. This is enough for most personal and small team use cases while preventing runaway costs.

### Configuring Your Budget

Set your monthly budget in the `.env` file:

```bash
# Phase 12: Cost Monitoring
MONTHLY_BUDGET_USD=10.00        # Set your monthly spending limit
ENABLE_COST_ALERTS=true         # Enable budget monitoring (recommended)
```

**Recommended budget amounts:**

- **$5/month** - Personal projects, light documentation
- **$10/month** - Small teams, moderate search usage (default)
- **$25/month** - Active development teams with heavy search
- **$50/month** - Production systems with all features enabled
- **$100/month** - High-volume enterprise usage

### Budget Validation

The cost tracker validates your budget configuration:

- Must be a positive number (e.g., `10`, `10.00`, `25.50`)
- Invalid values fall back to $10 default with a warning
- Budget is checked after every paid API call
- Resets automatically on the 1st of each month

**Valid configurations:**
```bash
MONTHLY_BUDGET_USD=10           # Integer
MONTHLY_BUDGET_USD=25.50        # Decimal
MONTHLY_BUDGET_USD=100          # Higher limit
```

**Invalid configurations (will use $10 default):**
```bash
MONTHLY_BUDGET_USD=              # Empty
MONTHLY_BUDGET_USD=abc           # Non-numeric
MONTHLY_BUDGET_USD=-5            # Negative
```

---

## Automatic Fallbacks

### How Fallback Mode Works

When your monthly spending reaches the configured budget limit, Synthesis **automatically switches to free providers** for the remainder of the month. This ensures:

1. Your costs never exceed the budget
2. The system continues functioning without interruption
3. Search quality degrades gracefully (Ollama embeddings are still excellent)
4. You maintain full read access to existing collections

### What Changes in Fallback Mode

When the budget limit is reached, the cost tracker sets runtime overrides:

```typescript
// Automatically set when budget reached
process.env.EMBEDDING_PROVIDER_OVERRIDE = 'ollama'
process.env.RERANKER_PROVIDER_OVERRIDE = 'bge'
process.env.DISABLE_CONTRADICTION_DETECTION = 'true'
```

**Detailed changes:**

| Feature | Normal Operation | Fallback Mode |
|---------|------------------|---------------|
| **Code embeddings** | Voyage ($) | Ollama (free) |
| **Doc embeddings** | Ollama (free) | Ollama (free) |
| **Personal embeddings** | OpenAI ($) | Ollama (free) |
| **Reranking** | Cohere ($) | BGE (free) |
| **Contradiction detection** | Claude Haiku ($) | Disabled |
| **Search** | Fully functional | Fully functional |
| **Document ingestion** | Fully functional | Fully functional |

### Fallback Quality Impact

**Minimal impact:**
- Document ingestion continues normally
- Search remains highly accurate (Ollama is excellent for embeddings)
- Vector similarity search is unaffected

**Moderate impact:**
- Code embeddings switch from specialized (Voyage) to general-purpose (Ollama)
- Reranking uses local BGE model instead of cloud-based Cohere
- Personal writing embeddings use Ollama instead of OpenAI

**Features disabled:**
- Contradiction detection (optional feature, low usage impact)

### Fallback Console Messages

When fallback mode activates, you'll see clear console output:

```
💰 Budget limit reached - enabling fallback mode
  → Embeddings: Ollama (free)
  → Re-ranking: BGE (free)
  → Contradiction Detection: Disabled
```

### Resetting Fallback Mode

Fallback mode automatically resets on the 1st of each month when your budget counter resets. If you need to manually reset before then:

1. Increase `MONTHLY_BUDGET_USD` in `.env`
2. Restart the server: `pnpm --filter @synthesis/server dev`

---

## Cost Dashboard

### Viewing Current Spending

Get a real-time summary of your monthly costs:

```bash
curl http://localhost:3333/api/costs/summary
```

**Example response:**

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
      "request_count": 500,
      "total_tokens": 125000,
      "total_cost": 1.50,
      "avg_cost_per_request": 0.003
    },
    {
      "provider": "cohere",
      "operation": "rerank",
      "request_count": 150,
      "total_tokens": 0,
      "total_cost": 0.15,
      "avg_cost_per_request": 0.001
    },
    {
      "provider": "anthropic",
      "operation": "chat",
      "request_count": 80,
      "total_tokens": 320000,
      "total_cost": 0.80,
      "avg_cost_per_request": 0.01
    }
  ]
}
```

### Understanding the Summary

**Top-level fields:**
- `current_spend` - Total spent this month (USD)
- `budget` - Your configured monthly limit (USD)
- `percentage_used` - Percentage of budget consumed (0-100)
- `remaining` - Budget left for the month (USD, never negative)

**Breakdown fields:**
- `provider` - API provider name (voyage, cohere, openai, anthropic, ollama)
- `operation` - Type of operation (embed, rerank, chat)
- `request_count` - Number of API calls made
- `total_tokens` - Cumulative tokens processed (0 for per-request pricing)
- `total_cost` - Total cost for this provider/operation (USD)
- `avg_cost_per_request` - Average cost per API call (USD)

### Cost History

View detailed historical spending with custom date ranges:

```bash
# Last 30 days (default)
curl http://localhost:3333/api/costs/history

# Custom date range
curl "http://localhost:3333/api/costs/history?start_date=2025-10-01&end_date=2025-10-31"
```

**Response format:**

```json
{
  "history": [
    {
      "provider": "voyage",
      "operation": "embed",
      "request_count": 500,
      "total_tokens": 125000,
      "total_cost": 1.50,
      "avg_cost_per_request": 0.003
    }
  ]
}
```

### Date Range Parameters

- `start_date` - ISO 8601 date string (e.g., `2025-10-01`)
- `end_date` - ISO 8601 date string (e.g., `2025-10-31`)
- Defaults to last 30 days if not specified
- Invalid dates return 400 error with message

---

## Alerts & Monitoring

### Budget Alert Thresholds

Synthesis monitors your spending and triggers alerts at key thresholds:

| Threshold | Alert Type | Action Taken |
|-----------|-----------|--------------|
| **80%** | Warning | Log to console + database record |
| **100%** | Limit Reached | Log + enable fallback mode + database record |

### Alert Configuration

```bash
# Enable/disable budget monitoring
ENABLE_COST_ALERTS=true         # Default: true

# Budget limit (alerts trigger at 80% and 100%)
MONTHLY_BUDGET_USD=10.00
```

**Disabling alerts:**
```bash
ENABLE_COST_ALERTS=false        # No budget checks, tracking still active
```

Note: Even with alerts disabled, costs are still tracked in the database. Disabling alerts only prevents budget enforcement and fallback activation.

### Console Alert Messages

**80% warning:**
```
⚠️  Budget Alert: 80% of monthly budget used ($8.00 / $10.00)
```

**100% limit reached:**
```
🚨 Budget Limit Reached: $10.00 / $10.00
💰 Budget limit reached - enabling fallback mode
  → Embeddings: Ollama (free)
  → Re-ranking: BGE (free)
  → Contradiction Detection: Disabled
```

### Alert Deduplication

To prevent alert spam, the system deduplicates alerts:

- Only one alert per type per 24 hours
- Example: If you hit 80% threshold, you won't get another warning until 24 hours later (even if usage continues)
- Limit reached alerts are also deduplicated for 24 hours

### Viewing Alert History

Retrieve the last 10 budget alerts:

```bash
curl http://localhost:3333/api/costs/alerts
```

**Example response:**

```json
{
  "alerts": [
    {
      "id": 42,
      "alert_type": "limit_reached",
      "threshold_usd": 10.00,
      "current_spend_usd": 10.05,
      "period": "monthly",
      "triggered_at": "2025-10-15T14:32:00.000Z",
      "acknowledged": false
    },
    {
      "id": 41,
      "alert_type": "warning",
      "threshold_usd": 10.00,
      "current_spend_usd": 8.20,
      "period": "monthly",
      "triggered_at": "2025-10-14T10:15:00.000Z",
      "acknowledged": false
    }
  ]
}
```

### Alert Database Schema

Alerts are stored in the `budget_alerts` table:

```sql
CREATE TABLE budget_alerts (
  id SERIAL PRIMARY KEY,
  alert_type TEXT NOT NULL,         -- 'warning' | 'limit_reached'
  threshold_usd DECIMAL(10,2),      -- Budget threshold (e.g., 10.00)
  current_spend_usd DECIMAL(10,4),  -- Actual spend when triggered
  period TEXT NOT NULL,             -- 'monthly' (daily alerts not yet implemented)
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT FALSE
);
```

---

## Provider Comparison

### When to Use Each Provider

#### Ollama (Free, Local)

**Best for:**
- General documentation and knowledge bases
- Personal projects with cost constraints
- Air-gapped or privacy-sensitive deployments
- Development and testing

**Strengths:**
- Completely free (zero ongoing costs)
- Fast embedding generation with GPU
- No API key management
- Works offline

**Limitations:**
- General-purpose embeddings (not code-specialized)
- Requires local compute resources (4-8GB VRAM recommended)
- Slightly lower accuracy than specialized models for code

**Cost:** $0.00/month

#### Voyage (Paid, Code-Specialized)

**Best for:**
- Code repositories and technical documentation
- API documentation and SDK references
- Framework and library documentation
- Architecture and system design docs

**Strengths:**
- Optimized for code understanding
- Excellent at capturing code semantics
- Better cross-language similarity
- 1024 dimensions (good balance)

**Limitations:**
- Requires API key and billing
- Small per-token cost adds up with large codebases
- Cloud dependency

**Cost:** $0.00012 per 1K tokens (~$0.15 per 1M tokens)

#### OpenAI (Paid, High-Quality)

**Best for:**
- Personal writing and notes
- Blog posts and articles
- Creative content
- General knowledge capture

**Strengths:**
- Highest quality general-purpose embeddings
- Excellent semantic understanding
- 1536 dimensions (most detailed)
- Widely supported and stable API

**Limitations:**
- Most expensive embedding option
- Overkill for code or structured docs
- Cloud dependency

**Cost:** $0.00013 per 1K tokens (~$0.13 per 1M tokens)

#### Cohere (Paid, Reranking)

**Best for:**
- Production search applications
- High-stakes queries where accuracy matters
- Complex semantic queries
- Multi-step reasoning queries

**Strengths:**
- Significant accuracy improvement over pure vector search
- Understands semantic nuances
- Per-request pricing (predictable)
- Fast inference

**Limitations:**
- Adds cost to every search that uses it
- Requires API key and billing
- Not needed for simple exact-match queries

**Cost:** $0.001 per rerank request

#### BGE (Free, Local Reranking)

**Best for:**
- Cost-conscious deployments
- Moderate search accuracy needs
- Fallback when budget is exhausted
- Development and testing

**Strengths:**
- Completely free
- Still provides meaningful reranking
- Fast with GPU acceleration
- No API dependencies

**Limitations:**
- Lower accuracy than Cohere
- Requires local compute resources
- Smaller model capacity

**Cost:** $0.00/month

### Cost vs. Quality Matrix

| Provider | Quality (Embeddings) | Cost | Best Use Case |
|----------|---------------------|------|---------------|
| **Ollama** | ⭐⭐⭐⭐ | Free | General docs, fallback |
| **Voyage** | ⭐⭐⭐⭐⭐ (code) | Low | Code repositories |
| **OpenAI** | ⭐⭐⭐⭐⭐ (text) | Low | Personal writing |
| **Cohere** | ⭐⭐⭐⭐⭐ (rerank) | Low | Search accuracy boost |
| **BGE** | ⭐⭐⭐ (rerank) | Free | Cost-conscious reranking |

### Recommended Configurations

**Zero-cost (all free):**
```bash
DOC_EMBEDDING_PROVIDER=ollama
CODE_EMBEDDING_PROVIDER=ollama
WRITING_EMBEDDING_PROVIDER=ollama
RERANKER_PROVIDER=bge
ENABLE_CONTRADICTION_DETECTION=false
MONTHLY_BUDGET_USD=0.01         # Essentially disable paid providers
```

**Balanced (default, optimize code):**
```bash
DOC_EMBEDDING_PROVIDER=ollama
CODE_EMBEDDING_PROVIDER=voyage  # Only paid provider
WRITING_EMBEDDING_PROVIDER=ollama
RERANKER_PROVIDER=bge           # Free reranking
ENABLE_CONTRADICTION_DETECTION=false
MONTHLY_BUDGET_USD=10.00
```

**Premium (best quality):**
```bash
DOC_EMBEDDING_PROVIDER=ollama
CODE_EMBEDDING_PROVIDER=voyage
WRITING_EMBEDDING_PROVIDER=openai
RERANKER_PROVIDER=cohere
ENABLE_CONTRADICTION_DETECTION=true
CONTRADICTION_MODEL=claude-3-haiku-20240307
MONTHLY_BUDGET_USD=50.00
```

---

## Optimization Tips

### Strategy 1: Smart Provider Selection

**Recommendation:** Use paid providers only where they provide maximum value.

```bash
# Optimize costs by using free Ollama for general docs
DOC_EMBEDDING_PROVIDER=ollama          # Free (bulk of content)
CODE_EMBEDDING_PROVIDER=voyage         # Paid (specialized value)
WRITING_EMBEDDING_PROVIDER=ollama      # Free (unless critical quality need)
```

**Impact:** Reduces costs by 60-80% while maintaining quality for code.

### Strategy 2: Selective Reranking

**Problem:** Reranking every search adds up quickly.

**Solution:** Use reranking only for complex queries or critical collections.

```bash
# Option 1: Use free BGE reranking
RERANKER_PROVIDER=bge

# Option 2: Disable reranking entirely
RERANKER_PROVIDER=none

# Option 3: Use Cohere but limit via code
# (Implement query complexity detection in your application layer)
```

**Impact:** Saves $0.001 per search (~$1.00 per 1,000 searches).

### Strategy 3: Disable Optional Features

**Contradiction detection** is powerful but optional. Disable if not critical:

```bash
ENABLE_CONTRADICTION_DETECTION=false   # Disables Claude Haiku calls
```

**Impact:** Saves $0.00025 per 1K tokens analyzed (~$0.50-$2.00/month).

### Strategy 4: Batch Document Ingestion

**Recommendation:** Upload documents in batches during off-peak times to leverage caching.

**Why it helps:**
- Embedding cache reduces duplicate computations
- Ollama processes large batches efficiently
- Fixed reranking costs don't apply to ingestion

**Implementation:**
```bash
# Ingest large doc sets at once instead of one-by-one
pnpm --filter @synthesis/server ingest --collection my-docs --batch ./docs/
```

### Strategy 5: Cache-Friendly Search Patterns

**Recommendation:** Structure queries to hit the embedding cache.

**Cache TTL settings:**
```bash
EMBEDDING_CACHE_TTL_MS=900000          # 15 minutes (default)
SEARCH_CACHE_TTL_SECONDS=1800          # 30 minutes (default)
```

**Best practices:**
- Use consistent query phrasing within your team
- Avoid unnecessary query variations
- Let users refine results instead of new searches

**Impact:** Reduces paid API calls by 20-40% in collaborative environments.

### Strategy 6: Monitor and Adjust

**Weekly budget check:**
```bash
# Check spending trends
curl http://localhost:3333/api/costs/summary | jq '.'

# Review cost breakdown
curl http://localhost:3333/api/costs/history | jq '.history[]'
```

**Adjust based on usage patterns:**
- High Voyage costs → Consider Ollama for some code
- High Cohere costs → Switch to BGE reranking
- High Anthropic costs → Disable contradiction detection

### Strategy 7: Set Realistic Budgets

**Start conservative:**
```bash
MONTHLY_BUDGET_USD=5.00    # Start low
```

**Monitor for 1-2 weeks**, then adjust:
```bash
# If hitting limits too early
MONTHLY_BUDGET_USD=10.00

# If consistently under budget
MONTHLY_BUDGET_USD=3.00
```

### Cost Optimization Checklist

- [ ] Use Ollama for general documentation (not code)
- [ ] Use Voyage only for code-heavy collections
- [ ] Use free BGE reranking instead of Cohere (unless quality-critical)
- [ ] Disable contradiction detection if not needed
- [ ] Enable embedding and search caching
- [ ] Batch document uploads
- [ ] Monitor weekly spending trends
- [ ] Set budget alerts to catch spikes early
- [ ] Review provider breakdown monthly

---

## Troubleshooting

### Issue: Costs Higher Than Expected

**Symptoms:**
- Budget consumed faster than anticipated
- Unexpected spending spike

**Diagnosis:**
```bash
# Check cost breakdown
curl http://localhost:3333/api/costs/summary | jq '.breakdown'

# Review recent usage
curl http://localhost:3333/api/costs/history | jq '.history[] | select(.total_cost > 1)'
```

**Common causes:**
1. **Reranking enabled on all searches** → Switch to `RERANKER_PROVIDER=bge` or `none`
2. **Large document ingestion with paid providers** → Check `CODE_EMBEDDING_PROVIDER` and `WRITING_EMBEDDING_PROVIDER`
3. **Contradiction detection running frequently** → Set `ENABLE_CONTRADICTION_DETECTION=false`
4. **Cache not working** → Verify `EMBEDDING_CACHE_TTL_MS` is set and Redis is running

**Solution:**
```bash
# Review and adjust provider config
vim .env

# Restart server to apply changes
pnpm --filter @synthesis/server dev
```

### Issue: Fallback Mode Activated Unexpectedly

**Symptoms:**
- Console shows "Budget limit reached" message
- Search quality slightly degraded
- Paid features unavailable

**Diagnosis:**
```bash
# Check current spending
curl http://localhost:3333/api/costs/summary

# Check recent alerts
curl http://localhost:3333/api/costs/alerts
```

**Causes:**
- Budget set too low for usage patterns
- Unexpected spike in API usage
- Budget not reset on month boundary (rare bug)

**Solution:**
```bash
# Temporarily increase budget
# Edit .env
MONTHLY_BUDGET_USD=20.00

# Restart server
pnpm --filter @synthesis/server dev
```

### Issue: Cost Tracking Not Working

**Symptoms:**
- `/api/costs/summary` returns empty breakdown
- `current_spend` always shows $0.00
- No alerts triggered despite paid API usage

**Diagnosis:**
```bash
# Check database connection
docker compose logs synthesis-db

# Verify migration applied
docker compose exec synthesis-db psql -U postgres -d synthesis -c "\d api_usage"
```

**Causes:**
1. **Migration not applied** → `api_usage` table missing
2. **Database connection error** → Cost tracker can't write
3. **Cost alerts disabled** → Set `ENABLE_COST_ALERTS=true`

**Solution:**
```bash
# Apply migrations
pnpm --filter @synthesis/db migrate

# Verify tables exist
docker compose exec synthesis-db psql -U postgres -d synthesis -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_name IN ('api_usage', 'budget_alerts');
"

# Check environment config
cat .env | grep ENABLE_COST_ALERTS
```

### Issue: Invalid Budget Configuration

**Symptoms:**
- Console warning: "Invalid MONTHLY_BUDGET_USD env value"
- Budget defaults to $10 unexpectedly

**Diagnosis:**
```bash
# Check environment variable
echo $MONTHLY_BUDGET_USD

# Check .env file
cat .env | grep MONTHLY_BUDGET_USD
```

**Common mistakes:**
```bash
MONTHLY_BUDGET_USD=              # Empty - invalid
MONTHLY_BUDGET_USD=$10           # Dollar sign - invalid
MONTHLY_BUDGET_USD=10USD         # Unit suffix - invalid
MONTHLY_BUDGET_USD=-5            # Negative - invalid
MONTHLY_BUDGET_USD=ten           # Non-numeric - invalid
```

**Solution:**
```bash
# Use numeric value only
MONTHLY_BUDGET_USD=10.00         # Correct
MONTHLY_BUDGET_USD=25            # Correct
MONTHLY_BUDGET_USD=5.50          # Correct
```

### Issue: Costs Not Resetting Monthly

**Symptoms:**
- New month started but `current_spend` still shows last month's total

**Diagnosis:**
```bash
# Check spending for current month
curl http://localhost:3333/api/costs/summary | jq '.current_spend'

# Verify database query (via psql)
docker compose exec synthesis-db psql -U postgres -d synthesis -c "
  SELECT COALESCE(SUM(cost_usd), 0) as total
  FROM api_usage
  WHERE created_at >= date_trunc('month', NOW());
"
```

**Causes:**
- Server timezone mismatch
- Database timestamp issue
- Cache not cleared

**Solution:**
```bash
# Restart server (clears in-memory state)
pnpm --filter @synthesis/server dev

# Verify server timezone
docker compose exec synthesis-server date

# If timezone mismatch, set TZ environment variable
TZ=UTC pnpm --filter @synthesis/server dev
```

### Issue: Fallback Mode Not Reverting

**Symptoms:**
- New month started but system still in fallback mode
- Paid providers not re-enabled automatically

**Diagnosis:**
```bash
# Check environment overrides
env | grep OVERRIDE

# Check current spending (should be near $0 for new month)
curl http://localhost:3333/api/costs/summary
```

**Cause:**
- Fallback mode sets runtime environment variables that persist until restart

**Solution:**
```bash
# Restart server to clear runtime overrides
pnpm --filter @synthesis/server dev

# Verify overrides cleared
env | grep OVERRIDE  # Should return nothing
```

### Issue: Provider API Key Errors During Fallback

**Symptoms:**
- Errors like "VOYAGE_API_KEY not set" even though budget not reached
- Paid providers being called when they shouldn't be

**Diagnosis:**
```bash
# Check budget status
curl http://localhost:3333/api/costs/summary

# Check server logs
docker compose logs synthesis-server | grep -i "api key"
```

**Cause:**
- Provider hardcoded in application layer (bypassing automatic selection)
- Bug in provider override logic

**Solution:**
```bash
# Remove any provider overrides in .env
# Comment out these lines if present:
# EMBEDDING_PROVIDER_OVERRIDE=voyage
# RERANKER_PROVIDER_OVERRIDE=cohere

# Restart server
pnpm --filter @synthesis/server dev
```

### Getting Help

If issues persist after troubleshooting:

1. **Check server logs:**
   ```bash
   docker compose logs synthesis-server --tail=100
   ```

2. **Verify database state:**
   ```bash
   docker compose exec synthesis-db psql -U postgres -d synthesis -c "
     SELECT provider, SUM(cost_usd) as total
     FROM api_usage
     WHERE created_at >= date_trunc('month', NOW())
     GROUP BY provider;
   "
   ```

3. **Review cost tracker implementation:**
   - Source: `apps/server/src/services/cost-tracker.ts`
   - Tests: `apps/server/src/services/__tests__/cost-tracker.test.ts`

4. **Open an issue:**
   - Include cost summary output
   - Include relevant server logs
   - Specify provider configuration

---

## Summary

**Cost management in Synthesis is:**
- ✅ Automatic and transparent
- ✅ Budget-enforcing with graceful fallbacks
- ✅ Detailed and queryable
- ✅ Zero-config with sensible defaults
- ✅ Optimized for developer experience

**Key takeaways:**
1. Start with the $10 default budget and adjust based on usage
2. Use free providers (Ollama, BGE) wherever quality is acceptable
3. Reserve paid providers (Voyage, Cohere) for specialized needs
4. Monitor spending weekly via `/api/costs/summary`
5. Trust automatic fallbacks to protect your budget
6. Optimize based on cost breakdown insights

**Cost management is not about restricting features—it's about making informed choices and preventing surprises.**

---

**Related Documentation:**
- [Architecture Overview](/docs/02_ARCHITECTURE.md) - System design and provider integration
- [Environment Setup](/docs/10_ENV_SETUP.md) - Configuring API keys and providers
- [Phase 12 Summary](/docs/phases/phase-12/PHASE_12_SUMMARY.md) - Cost tracking implementation details
- [Provider Configuration](/docs/phases/phase-8/02_EMBEDDING_PROVIDERS.md) - Multi-provider embedding setup
