-- Phase 12: Cost Tracking & Budget Monitoring
-- Migration: 003_cost_tracking.sql

-- Track all API usage for cost monitoring
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
