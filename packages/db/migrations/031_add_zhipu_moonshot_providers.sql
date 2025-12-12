-- Migration: 031_add_zhipu_moonshot_providers.sql
-- Purpose: Add zhipu and moonshot to valid providers for model_configs
-- Phase 16: Multi-provider support for Chinese AI providers

-- Update constraint for valid provider names to include zhipu and moonshot
DO $$
BEGIN
  -- Replace existing constraint so the provider list stays current.
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'model_configs_provider_check'
  ) THEN
    ALTER TABLE model_configs DROP CONSTRAINT model_configs_provider_check;
  END IF;

  ALTER TABLE model_configs ADD CONSTRAINT model_configs_provider_check
    CHECK (provider IN (
      'anthropic',
      'openai',
      'ollama',
      'google',
      'voyage',
      'cohere',
      'bge',
      'none',
      'zhipu',
      'moonshot'
    ));
END $$;

-- Update comments
COMMENT ON COLUMN model_configs.provider IS 'Model provider: anthropic, openai, ollama, google, voyage, cohere, bge, none, zhipu, moonshot';
