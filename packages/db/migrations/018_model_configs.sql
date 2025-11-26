-- Migration: 018_model_configs.sql
-- Purpose: Create model_configs table for runtime model configuration
-- Phase 4: Model Config Service

-- Model configs table: Store runtime model configurations per feature
CREATE TABLE IF NOT EXISTS model_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Feature identifier (unique constraint ensures one config per feature)
  feature TEXT NOT NULL UNIQUE,
  -- Supported features:
  --   'chat'           - Main chat/agent model
  --   'summary'        - Document summarization
  --   'ocr'            - Vision OCR for scanned PDFs
  --   'embedding_docs' - Document embeddings
  --   'embedding_code' - Code embeddings  
  --   'embedding_writing' - Personal writing embeddings
  --   'reranker'       - Search result reranking
  --   'contradiction'  - Contradiction detection (future)
  
  -- Provider selection
  provider TEXT NOT NULL,
  -- Supported providers:
  --   LLM: 'anthropic', 'openai', 'ollama', 'google'
  --   Embedding: 'ollama', 'openai', 'voyage'
  --   Reranker: 'bge', 'cohere', 'none'
  
  -- Model identifier (provider-specific)
  model TEXT NOT NULL,
  
  -- Local-only mode: restrict to local models (ollama, bge)
  local_only BOOLEAN NOT NULL DEFAULT false,
  
  -- Enable/disable this configuration
  enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick feature lookups
CREATE INDEX IF NOT EXISTS model_configs_feature_idx ON model_configs (feature);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_model_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on changes
DROP TRIGGER IF EXISTS model_configs_updated_at_trigger ON model_configs;
CREATE TRIGGER model_configs_updated_at_trigger
  BEFORE UPDATE ON model_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_model_configs_updated_at();

-- Add constraint for valid feature names
ALTER TABLE model_configs DROP CONSTRAINT IF EXISTS model_configs_feature_check;
ALTER TABLE model_configs ADD CONSTRAINT model_configs_feature_check
  CHECK (feature IN (
    'chat',
    'summary', 
    'ocr',
    'embedding_docs',
    'embedding_code',
    'embedding_writing',
    'reranker',
    'contradiction'
  ));

-- Add constraint for valid provider names
ALTER TABLE model_configs DROP CONSTRAINT IF EXISTS model_configs_provider_check;
ALTER TABLE model_configs ADD CONSTRAINT model_configs_provider_check
  CHECK (provider IN (
    'anthropic',
    'openai',
    'ollama',
    'google',
    'voyage',
    'cohere',
    'bge',
    'none'
  ));

-- Comments for documentation
COMMENT ON TABLE model_configs IS 'Runtime model configurations for each feature. Overrides env vars and defaults.';
COMMENT ON COLUMN model_configs.feature IS 'Feature identifier: chat, summary, ocr, embedding_*, reranker';
COMMENT ON COLUMN model_configs.provider IS 'Model provider: anthropic, openai, ollama, google, voyage, cohere, bge, none';
COMMENT ON COLUMN model_configs.model IS 'Provider-specific model identifier';
COMMENT ON COLUMN model_configs.local_only IS 'When true, only local models (ollama, bge) are allowed';
COMMENT ON COLUMN model_configs.enabled IS 'When false, feature falls back to defaults';
